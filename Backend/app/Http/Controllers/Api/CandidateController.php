<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\Candidate;
use App\Models\CandidateDocument;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CandidateController extends Controller
{
    private const PASSPORT_META_PREFIX = "\n\n[MOPL_PASSPORT_META]";

    private function candidateDbPayload(Request $request): array
    {
        $payload = $request->only([
            'full_name',
            'email',
            'phone',
            'passport_number',
            'date_of_birth',
            'gender',
            'nationality',
            'status',
            'is_active',
            'source',
            'address',
            'notes',
            'paid_amount',
            'project_id',
            'passport_store_status',
            'passport_store_out_by',
            'passport_store_out_date',
        ]);

        $schemaColumns = Schema::getColumnListing('candidates');
        $availableColumns = array_fill_keys($schemaColumns, true);

        foreach (['passport_store_status', 'passport_store_out_by'] as $optionalColumn) {
            if (!isset($availableColumns[$optionalColumn])) {
                unset($payload[$optionalColumn]);
            }
        }

            if (isset($availableColumns['passport_store_out_date'])) {
                if ($request->filled('passport_store_out_date')) {
                    $payload['passport_store_out_date'] = $request->input('passport_store_out_date');
                }
            }

        return $payload;
    }

    public function index(Request $request): JsonResponse
    {
        if ($authError = $this->ensureCandidateReadAccess($request)) {
            return $authError;
        }

        $perPage = min(max((int) $request->get('per_page', 15), 1), 100);
        $query = Candidate::query()->with([
            'creator:id,full_name,name,email',
            'loginAccount:id,full_name,name,email,role,is_active',
            'project:id,project_name,agency_name,trade,office_rate_per_trade',
        ]);

        if ($request->filled('search')) {
            $search = $request->get('search');

            $query->where(function ($q) use ($search) {
                $q->where('full_name', 'like', '%' . $search . '%')
                    ->orWhere('email', 'like', '%' . $search . '%')
                    ->orWhere('phone', 'like', '%' . $search . '%')
                    ->orWhere('passport_number', 'like', '%' . $search . '%')
                    ->orWhere('source', 'like', '%' . $search . '%')
                    ->orWhereHas('project', function ($projectQuery) use ($search) {
                        $projectQuery->where('project_name', 'like', '%' . $search . '%');
                    });
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->get('status'));
        }

        if ($request->filled('nationality')) {
            $query->where('nationality', $request->get('nationality'));
        }

        if ($request->filled('is_active')) {
            $isActive = filter_var($request->get('is_active'), FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);

            if ($isActive !== null) {
                $query->where('is_active', $isActive);
            }
        }

        $candidates = $query
            ->orderByDesc('id')
            ->paginate($perPage);
        $candidateItems = $candidates->items();
        $fallbackMap = $this->passportFallbackByCandidateIds(array_map(static fn ($candidate) => (int) $candidate->id, $candidateItems));

        foreach ($candidateItems as $candidate) {
            $this->hydrateCandidatePassportFallback($candidate, $fallbackMap);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'candidates' => $candidateItems,
            ],
            'pagination' => [
                'current_page' => $candidates->currentPage(),
                'last_page' => $candidates->lastPage(),
                'per_page' => $candidates->perPage(),
                'total' => $candidates->total(),
            ],
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureCandidateReadAccess($request)) {
            return $authError;
        }

        $candidate = Candidate::with([
            'creator:id,full_name,name,email',
            'loginAccount:id,full_name,name,email,role,is_active',
            'project:id,project_name,agency_name,trade,office_rate_per_trade',
        ])->find($id);

        if (!$candidate) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_NOT_FOUND',
                'message' => 'Candidate not found.',
            ], 404);
        }

        $this->hydrateCandidatePassportFallback(
            $candidate,
            $this->passportFallbackByCandidateIds([(int) $candidate->id])
        );

        return response()->json([
            'success' => true,
            'data' => [
                'candidate' => $candidate,
            ],
        ]);
    }

    public function paymentBookings(Request $request, ?int $id = null): JsonResponse
    {
        if ($authError = $this->ensureCandidateReadAccess($request)) {
            return $authError;
        }

        $candidateId = $id ?? $request->query('candidate_id');

        if (!$candidateId) {
            return response()->json([
                'success' => true,
                'data' => null,
            ]);
        }

        $candidate = Candidate::with('project:id,project_name,agency_name,office_rate_per_trade')->find($candidateId);

        if (!$candidate) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_NOT_FOUND',
                'message' => 'Candidate not found.',
            ], 404);
        }

        if (!$candidate->project_id) {
            return response()->json([
                'success' => true,
                'data' => null,
            ]);
        }

        $paidAmount = (float) ($candidate->paid_amount ?? 0);
        $officeRate = (float) ($candidate->project?->office_rate_per_trade ?? 0);
        $dueAmount = max(0, $officeRate - $paidAmount);

        if ($officeRate > 0) {
            if ($paidAmount >= $officeRate) {
                $status = 'Paid';
            } elseif ($paidAmount > 0) {
                $status = 'Partial';
            } else {
                $status = 'Pending';
            }
        } else {
            $status = $paidAmount > 0 ? 'Paid' : 'Pending';
        }
        $bookedAt = $candidate->updated_at ?? $candidate->created_at;

        $booking = [
            'amount' => $paidAmount,
            'office_rate' => $officeRate,
            'due_amount' => $dueAmount,
            'status' => $status,
            'booked_at' => $bookedAt?->toISOString(),
            'project_name' => $candidate->project?->project_name,
        ];

        return response()->json([
            'success' => true,
            'data' => $booking,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $request->merge([
            'passport_number' => $this->normalizePassportNumber($request->input('passport_number')),
            'status' => $this->normalizeCandidateStatus($request->input('status')),
        ]);

        // If passport is marked as taken out and the DB column exists, auto-set the out date
        if (Schema::hasColumn('candidates', 'passport_store_out_date')) {
            $statusVal = strtolower((string) $request->input('passport_store_status', ''));
            if (str_contains($statusVal, 'passport out') && !$request->filled('passport_store_out_date')) {
                $request->merge(['passport_store_out_date' => Carbon::now()->toDateString()]);
            }
        }

        $validator = Validator::make($request->all(), [
            'full_name' => 'required|string|max:255',
            'email' => 'nullable|email|max:255|unique:candidates,email',
            'phone' => 'nullable|string|max:20',
            'passport_number' => 'required|string|max:50|unique:candidates,passport_number',
            'date_of_birth' => 'nullable|date',
            'passport_issue_date' => 'nullable|date',
            'passport_expiry_date' => 'nullable|date|after_or_equal:passport_issue_date',
            'passport_renewal_day' => 'nullable|date',
            'gender' => 'nullable|in:male,female,other',
            'nationality' => 'nullable|string|max:100',
            'status' => 'nullable|string|max:50|regex:/^[a-z0-9_]+$/',
            'passport_store_status' => 'required|string|max:120',
            'passport_store_out_by' => 'nullable|string|max:255',
            'is_active' => 'sometimes|boolean',
            'source' => 'nullable|string|max:120',
            'address' => 'nullable|string',
            'notes' => 'nullable|string',
            'paid_amount' => 'nullable|numeric|min:0',
            'project_id' => 'required|exists:project_settings,id',
            'create_login_account' => 'sometimes|boolean',
            'login_email' => 'nullable|email|max:255',
            'login_password' => 'nullable|string|min:8|max:128',
        ], [
            'passport_number.required' => 'Passport number is required.',
            'passport_number.unique' => 'This passport number is already registered.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_CREATE_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $candidate = Candidate::create(array_merge(
            $this->candidateDbPayload($request),
            $this->candidatePassportDatePayload($request),
            [
                'status' => $request->get('status', 'registered'),
                'is_active' => $request->has('is_active') ? (bool) $request->is_active : true,
                'created_by' => optional($request->user())->id,
            ]
        ));

        $this->persistPassportFallback($request, $candidate);

        $loginAccountData = null;

        if ($request->boolean('create_login_account')) {
            try {
                $loginAccountData = $this->provisionCandidateLoginAccount(
                    $candidate,
                    $request->get('login_email'),
                    $request->get('login_password')
                );
            } catch (\InvalidArgumentException $e) {
                $candidate->delete();

                return response()->json([
                    'success' => false,
                    'error_code' => 'CANDIDATE_LOGIN_ACCOUNT_FAILED',
                    'message' => $e->getMessage(),
                ], 422);
            }
        }

        $this->logActivity($request, 'Candidate Created', 'Candidate', 'Created candidate: ' . $candidate->full_name);
        $this->recordHistory($request, $candidate->id, 'created', 'Candidate profile created', null, $candidate->status, [
            'source' => 'manual',
        ]);

        $responseCandidate = $candidate->fresh()->load([
            'creator:id,full_name,name,email',
            'loginAccount:id,full_name,name,email,role,is_active',
            'project:id,project_name,agency_name,trade',
        ]);
        $this->hydrateCandidatePassportFallback(
            $responseCandidate,
            $this->passportFallbackByCandidateIds([(int) $responseCandidate->id])
        );

        return response()->json([
            'success' => true,
            'message' => 'Candidate created successfully',
            'data' => [
                'candidate' => $responseCandidate,
                'login_account' => $loginAccountData,
            ],
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        if ($request->has('passport_number')) {
            $request->merge([
                'passport_number' => $this->normalizePassportNumber($request->input('passport_number')),
            ]);
        }

        if ($request->has('status')) {
            $request->merge([
                'status' => $this->normalizeCandidateStatus($request->input('status')),
            ]);
        }

        $candidate = Candidate::find($id);

        if (!$candidate) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_NOT_FOUND',
                'message' => 'Candidate not found.',
            ], 404);
        }

        // Enforce passport out date lock: if DB column exists and candidate already has an out date,
        // prevent clients from changing it. If not set and status changes to 'passport out', set it now.
        if (Schema::hasColumn('candidates', 'passport_store_out_date')) {
            if (!empty($candidate->passport_store_out_date)) {
                $request->merge(['passport_store_out_date' => $candidate->passport_store_out_date?->toDateString()]);
            } else {
                $statusVal = strtolower((string) $request->input('passport_store_status', $candidate->passport_store_status ?? ''));
                if (str_contains($statusVal, 'passport out') && !$request->filled('passport_store_out_date')) {
                    $request->merge(['passport_store_out_date' => Carbon::now()->toDateString()]);
                }
            }
        }

        $validator = Validator::make($request->all(), [
            'full_name' => 'sometimes|required|string|max:255',
            'email' => 'nullable|email|max:255|unique:candidates,email,' . $id,
            'phone' => 'nullable|string|max:20',
            'passport_number' => 'sometimes|required|string|max:50|unique:candidates,passport_number,' . $id,
            'date_of_birth' => 'nullable|date',
            'passport_issue_date' => 'nullable|date',
            'passport_expiry_date' => 'nullable|date|after_or_equal:passport_issue_date',
            'passport_renewal_day' => 'nullable|date',
            'gender' => 'nullable|in:male,female,other',
            'nationality' => 'nullable|string|max:100',
            'status' => 'sometimes|string|max:50|regex:/^[a-z0-9_]+$/',
            'passport_store_status' => 'sometimes|required|string|max:120',
            'passport_store_out_by' => 'nullable|string|max:255',
            'is_active' => 'sometimes|boolean',
            'source' => 'nullable|string|max:120',
            'address' => 'nullable|string',
            'notes' => 'nullable|string',
            'paid_amount' => 'nullable|numeric|min:0',
            'project_id' => 'required|exists:project_settings,id',
            'create_login_account' => 'sometimes|boolean',
            'login_email' => 'nullable|email|max:255',
            'login_password' => 'nullable|string|min:8|max:128',
        ], [
            'passport_number.required' => 'Passport number is required when updating passport details.',
            'passport_number.unique' => 'This passport number is already registered.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_UPDATE_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $oldStatus = $candidate->status;

        $candidate->update(array_merge(
            $this->candidateDbPayload($request),
            $this->candidatePassportDatePayload($request)
        ));

        $this->persistPassportFallback($request, $candidate);

        $loginAccountData = null;

        if ($request->boolean('create_login_account')) {
            try {
                $loginAccountData = $this->provisionCandidateLoginAccount(
                    $candidate,
                    $request->get('login_email'),
                    $request->get('login_password')
                );
            } catch (\InvalidArgumentException $e) {
                return response()->json([
                    'success' => false,
                    'error_code' => 'CANDIDATE_LOGIN_ACCOUNT_FAILED',
                    'message' => $e->getMessage(),
                ], 422);
            }
        }

        $this->logActivity($request, 'Candidate Updated', 'Candidate', 'Updated candidate: ' . $candidate->full_name);
        $this->recordHistory($request, $candidate->id, 'updated', 'Candidate profile updated', $oldStatus, $candidate->status, [
            'fields' => array_keys($request->all()),
        ]);

        $responseCandidate = $candidate->fresh()->load([
            'creator:id,full_name,name,email',
            'loginAccount:id,full_name,name,email,role,is_active',
            'project:id,project_name,agency_name,trade',
        ]);
        $this->hydrateCandidatePassportFallback(
            $responseCandidate,
            $this->passportFallbackByCandidateIds([(int) $responseCandidate->id])
        );

        return response()->json([
            'success' => true,
            'message' => 'Candidate updated successfully',
            'data' => [
                'candidate' => $responseCandidate,
                'login_account' => $loginAccountData,
            ],
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $candidate = Candidate::find($id);

        if (!$candidate) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_NOT_FOUND',
                'message' => 'Candidate not found.',
            ], 404);
        }

        $name = $candidate->full_name;
        $this->logActivity($request, 'Candidate Deleted', 'Candidate', 'Deleted candidate: ' . $name);
        $this->recordHistory($request, $candidate->id, 'deleted', 'Candidate deleted');
        $candidate->delete();

        return response()->json([
            'success' => true,
            'message' => 'Candidate deleted successfully',
        ]);
    }

    public function activate(Request $request, int $id): JsonResponse
    {
        return $this->setActiveState($request, $id, true);
    }

    public function deactivate(Request $request, int $id): JsonResponse
    {
        return $this->setActiveState($request, $id, false);
    }

    public function changeStatus(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $request->merge([
            'status' => $this->normalizeCandidateStatus($request->input('status')),
        ]);

        $validator = Validator::make($request->all(), [
            'status' => 'required|string|max:50|regex:/^[a-z0-9_]+$/',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_STATUS_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $candidate = Candidate::find($id);

        if (!$candidate) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_NOT_FOUND',
                'message' => 'Candidate not found.',
            ], 404);
        }

        $fromStatus = $candidate->status;
        $candidate->status = $request->status;
        $candidate->save();

        $this->logActivity($request, 'Candidate Status Changed', 'Candidate', 'Candidate ' . $candidate->full_name . ' status changed to ' . $request->status);
        $this->recordHistory($request, $candidate->id, 'status_changed', 'Status updated', $fromStatus, $candidate->status);

        return response()->json([
            'success' => true,
            'message' => 'Candidate status updated successfully',
            'data' => [
                'candidate' => $candidate->fresh()->load([
                    'creator:id,full_name,name,email',
                    'loginAccount:id,full_name,name,email,role,is_active',
                    'project:id,project_name,agency_name,trade',
                ]),
            ],
        ]);
    }

    public function createLoginAccount(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $candidate = Candidate::find($id);

        if (!$candidate) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_NOT_FOUND',
                'message' => 'Candidate not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'login_email' => 'nullable|email|max:255',
            'login_password' => 'nullable|string|min:8|max:128',
            'reset_password' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_LOGIN_ACCOUNT_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $loginAccountData = $this->provisionCandidateLoginAccount(
                $candidate,
                $request->get('login_email'),
                $request->get('login_password'),
                $request->boolean('reset_password')
            );
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_LOGIN_ACCOUNT_FAILED',
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Candidate login account prepared successfully',
            'data' => [
                'candidate' => $candidate->fresh()->load([
                    'creator:id,full_name,name,email',
                    'loginAccount:id,full_name,name,email,role,is_active',
                ]),
                'login_account' => $loginAccountData,
            ],
        ]);
    }

    public function timeline(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureCandidateReadAccess($request)) {
            return $authError;
        }

        $candidate = Candidate::find($id);

        if (!$candidate) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_NOT_FOUND',
                'message' => 'Candidate not found.',
            ], 404);
        }

        $timeline = DB::table('candidate_histories as h')
            ->leftJoin('users as u', 'u.id', '=', 'h.user_id')
            ->where('h.candidate_id', $id)
            ->orderByDesc('h.created_at')
            ->select([
                'h.id',
                'h.action',
                'h.from_status',
                'h.to_status',
                'h.description',
                'h.metadata',
                'h.created_at',
                'u.id as user_id',
                'u.full_name as user_full_name',
                'u.name as user_name',
                'u.email as user_email',
            ])
            ->get()
            ->map(function ($event) {
                return [
                    'id' => $event->id,
                    'action' => $event->action,
                    'from_status' => $event->from_status,
                    'to_status' => $event->to_status,
                    'description' => $event->description,
                    'metadata' => $event->metadata ? json_decode($event->metadata, true) : null,
                    'created_at' => $event->created_at,
                    'user' => $event->user_id ? [
                        'id' => $event->user_id,
                        'name' => $event->user_full_name ?? $event->user_name,
                        'email' => $event->user_email,
                    ] : null,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => [
                'timeline' => $timeline,
            ],
        ]);
    }

    public function documents(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureCandidateReadAccess($request)) {
            return $authError;
        }

        $candidate = Candidate::find($id);

        if (!$candidate) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_NOT_FOUND',
                'message' => 'Candidate not found.',
            ], 404);
        }

        $docs = CandidateDocument::query()
            ->with([
                'uploader:id,full_name,name,email',
                'project:id,project_name',
            ])
            ->where('candidate_id', $id)
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'documents' => $docs,
            ],
        ]);
    }

    public function uploadDocument(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $candidate = Candidate::find($id);

        if (!$candidate) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_NOT_FOUND',
                'message' => 'Candidate not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:pdf,jpg,jpeg,png,doc,docx|max:20480',
            'title' => 'nullable|string|max:255',
            'project_id' => 'required|exists:project_settings,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_DOCUMENT_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $file = $request->file('file');
        $stored = $file->store('candidate-documents/' . $candidate->id, 'public');

        $document = CandidateDocument::create([
            'candidate_id' => $candidate->id,
            'project_id' => $request->get('project_id'),
            'title' => $request->get('title'),
            'file_path' => $stored,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getClientMimeType(),
            'size_bytes' => (int) $file->getSize(),
            'uploaded_by' => optional($request->user())->id,
        ]);

        $this->recordHistory($request, $candidate->id, 'document_uploaded', 'Document uploaded: ' . $document->original_name);
        $this->logActivity($request, 'Candidate Document Uploaded', 'Candidate', 'Uploaded document for candidate: ' . $candidate->full_name);

        return response()->json([
            'success' => true,
            'message' => 'Document uploaded successfully',
            'data' => [
                'document' => $document->load('uploader:id,full_name,name,email'),
            ],
        ], 201);
    }

    public function downloadDocument(Request $request, int $documentId)
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $document = CandidateDocument::find($documentId);

        if (!$document) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_DOCUMENT_NOT_FOUND',
                'message' => 'Document not found.',
            ], 404);
        }

        if (!Storage::disk('public')->exists($document->file_path)) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_DOCUMENT_MISSING',
                'message' => 'Stored file not found.',
            ], 404);
        }

        return response()->download(
            Storage::disk('public')->path($document->file_path),
            $document->original_name
        );
    }

    public function batchDownloadDocuments(Request $request)
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $validator = Validator::make($request->all(), [
            'document_ids' => 'required|array|min:1|max:100',
            'document_ids.*' => 'required|integer|distinct|exists:candidate_documents,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_DOCUMENT_BATCH_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $documentIds = collect($validator->validated()['document_ids'])
            ->map(fn ($id) => (int) $id)
            ->values();

        $documents = CandidateDocument::query()
            ->whereIn('id', $documentIds)
            ->orderByDesc('id')
            ->get();

        if ($documents->isEmpty()) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_DOCUMENT_NOT_FOUND',
                'message' => 'No valid documents found for download.',
            ], 404);
        }

        $tempFile = tempnam(sys_get_temp_dir(), 'mopl_docs_');

        if ($tempFile === false) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_DOCUMENT_ZIP_TEMP_FILE_FAILED',
                'message' => 'Unable to prepare batch download.',
            ], 500);
        }

        $zipPath = $tempFile . '.zip';
        @unlink($tempFile);

        $zip = new \ZipArchive();
        $openResult = $zip->open($zipPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE);

        if ($openResult !== true) {
            @unlink($zipPath);

            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_DOCUMENT_ZIP_OPEN_FAILED',
                'message' => 'Unable to create download archive.',
            ], 500);
        }

        $addedCount = 0;
        $usedNames = [];

        foreach ($documents as $document) {
            if (!Storage::disk('public')->exists($document->file_path)) {
                continue;
            }

            $physicalPath = Storage::disk('public')->path($document->file_path);
            $baseName = trim((string) ($document->original_name ?: ('document_' . $document->id)));
            $safeName = preg_replace('/[^A-Za-z0-9._-]/', '_', $baseName);
            $safeName = $safeName !== '' ? $safeName : ('document_' . $document->id);

            if (isset($usedNames[$safeName])) {
                $usedNames[$safeName]++;
                $pathInfo = pathinfo($safeName);
                $name = $pathInfo['filename'] ?? ('document_' . $document->id);
                $ext = isset($pathInfo['extension']) ? ('.' . $pathInfo['extension']) : '';
                $safeName = $name . '_' . $usedNames[$safeName] . $ext;
            } else {
                $usedNames[$safeName] = 1;
            }

            if ($zip->addFile($physicalPath, $safeName)) {
                $addedCount++;
            }
        }

        $zip->close();

        if ($addedCount === 0) {
            @unlink($zipPath);

            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_DOCUMENT_MISSING',
                'message' => 'None of the selected files are available for download.',
            ], 404);
        }

        $this->logActivity(
            $request,
            'Candidate Documents Batch Downloaded',
            'Candidate',
            'Downloaded ' . $addedCount . ' candidate documents as ZIP'
        );

        $downloadName = 'candidate-documents-' . now()->format('Ymd-His') . '.zip';

        return response()->download($zipPath, $downloadName, [
            'Content-Type' => 'application/zip',
        ])->deleteFileAfterSend(true);
    }

    public function updateDocumentTitle(Request $request, int $documentId): JsonResponse
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $document = CandidateDocument::find($documentId);

        if (!$document) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_DOCUMENT_NOT_FOUND',
                'message' => 'Document not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_DOCUMENT_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $newTitle = trim((string) ($request->get('title') ?? ''));
        $document->title = $newTitle === '' ? null : $newTitle;
        $document->save();

        $this->recordHistory(
            $request,
            $document->candidate_id,
            'document_title_updated',
            'Updated document title: ' . ($document->original_name ?? ('Document #' . $document->id))
        );
        $this->logActivity($request, 'Candidate Document Title Updated', 'Candidate', 'Updated title for: ' . $document->original_name);

        return response()->json([
            'success' => true,
            'message' => 'Document title updated successfully',
            'data' => [
                'document' => $document->fresh()->load('uploader:id,full_name,name,email'),
            ],
        ]);
    }

    public function deleteDocument(Request $request, int $documentId): JsonResponse
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $document = CandidateDocument::find($documentId);

        if (!$document) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_DOCUMENT_NOT_FOUND',
                'message' => 'Document not found.',
            ], 404);
        }

        $candidateId = $document->candidate_id;
        $name = $document->original_name;

        if (Storage::disk('public')->exists($document->file_path)) {
            Storage::disk('public')->delete($document->file_path);
        }

        $document->delete();

        $this->recordHistory($request, $candidateId, 'document_deleted', 'Document deleted: ' . $name);
        $this->logActivity($request, 'Candidate Document Deleted', 'Candidate', 'Deleted candidate document: ' . $name);

        return response()->json([
            'success' => true,
            'message' => 'Document deleted successfully',
        ]);
    }

    public function export(Request $request): StreamedResponse|JsonResponse
    {
        if ($authError = $this->ensureCandidateReadAccess($request)) {
            return $authError;
        }

        $query = Candidate::query();

        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where(function ($q) use ($search) {
                $q->where('full_name', 'like', '%' . $search . '%')
                    ->orWhere('email', 'like', '%' . $search . '%')
                    ->orWhere('phone', 'like', '%' . $search . '%')
                    ->orWhere('passport_number', 'like', '%' . $search . '%');
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->get('status'));
        }

        $filename = 'candidates_' . now()->format('Ymd_His') . '.csv';

        return response()->streamDownload(function () use ($query) {
            $handle = fopen('php://output', 'w');

            fputcsv($handle, [
                'id',
                'full_name',
                'email',
                'phone',
                'passport_number',
                'date_of_birth',
                'gender',
                'nationality',
                'status',
                'is_active',
                'source',
                'address',
                'notes',
                'paid_amount',
                'created_at',
            ]);

            $query->orderBy('id')->chunk(200, function ($rows) use ($handle) {
                foreach ($rows as $row) {
                    $dateOfBirth = null;

                    if (!empty($row->date_of_birth)) {
                        try {
                            $dateOfBirth = Carbon::parse($row->date_of_birth)->format('Y-m-d');
                        } catch (\Throwable $e) {
                            $dateOfBirth = (string) $row->date_of_birth;
                        }
                    }

                    fputcsv($handle, [
                        $row->id,
                        $row->full_name,
                        $row->email,
                        $row->phone,
                        $row->passport_number,
                        $dateOfBirth,
                        $row->gender,
                        $row->nationality,
                        $row->status,
                        $row->is_active ? '1' : '0',
                        $row->source,
                        $row->address,
                        $row->notes,
                        $row->paid_amount,
                        $row->created_at,
                    ]);
                }
            });

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    public function import(Request $request): JsonResponse
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:csv,txt|max:5120',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_IMPORT_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $path = $request->file('file')->getRealPath();
        $handle = fopen($path, 'r');

        if ($handle === false) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_IMPORT_FILE_ERROR',
                'message' => 'Unable to open CSV file.',
            ], 422);
        }

        $header = fgetcsv($handle);

        if (!$header) {
            fclose($handle);
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_IMPORT_EMPTY_FILE',
                'message' => 'CSV file is empty.',
            ], 422);
        }

        $normalizedHeader = array_map(function ($column) {
            return strtolower(trim((string) $column));
        }, $header);

        $summary = [
            'created' => 0,
            'updated' => 0,
            'skipped' => 0,
            'errors' => 0,
        ];

        while (($row = fgetcsv($handle)) !== false) {
            $data = [];

            foreach ($normalizedHeader as $index => $column) {
                $data[$column] = isset($row[$index]) ? trim((string) $row[$index]) : null;
            }

            if (empty($data['full_name'])) {
                $summary['skipped']++;
                continue;
            }

            $payload = [
                'full_name' => $data['full_name'],
                'email' => ($data['email'] ?? '') !== '' ? $data['email'] : null,
                'phone' => ($data['phone'] ?? '') !== '' ? $data['phone'] : null,
                'passport_number' => $this->normalizePassportNumber(($data['passport_number'] ?? '') !== '' ? $data['passport_number'] : null),
                'date_of_birth' => ($data['date_of_birth'] ?? '') !== '' ? $data['date_of_birth'] : null,
                'gender' => ($data['gender'] ?? '') !== '' ? $data['gender'] : null,
                'nationality' => ($data['nationality'] ?? '') !== '' ? $data['nationality'] : null,
                'status' => ($data['status'] ?? '') !== '' ? $data['status'] : 'registered',
                'source' => ($data['source'] ?? '') !== '' ? $data['source'] : 'csv_import',
                'address' => ($data['address'] ?? '') !== '' ? $data['address'] : null,
                'notes' => ($data['notes'] ?? '') !== '' ? $data['notes'] : null,
                'paid_amount' => ($data['paid_amount'] ?? '') !== '' ? (float) $data['paid_amount'] : 0,
                'is_active' => isset($data['is_active']) ? in_array(strtolower((string) $data['is_active']), ['1', 'true', 'yes'], true) : true,
            ];

            if (empty($payload['passport_number'])) {
                $summary['skipped']++;
                continue;
            }

            try {
                $existing = Candidate::query()
                    ->where('passport_number', $payload['passport_number'])
                    ->first();

                if ($existing) {
                    $oldStatus = $existing->status;
                    $existing->update($payload);
                    $summary['updated']++;
                    $this->recordHistory($request, $existing->id, 'import_updated', 'Candidate updated from CSV import', $oldStatus, $existing->status, ['source' => 'csv_import']);
                } else {
                    $created = Candidate::create([
                        ...$payload,
                        'created_by' => optional($request->user())->id,
                    ]);
                    $summary['created']++;
                    $this->recordHistory($request, $created->id, 'import_created', 'Candidate created from CSV import', null, $created->status, ['source' => 'csv_import']);
                }
            } catch (\Throwable $e) {
                $summary['errors']++;
            }
        }

        fclose($handle);

        $this->logActivity($request, 'Candidate CSV Import', 'Candidate', 'Imported candidates from CSV file');

        return response()->json([
            'success' => true,
            'message' => 'Candidate import completed',
            'data' => [
                'summary' => $summary,
            ],
        ]);
    }

    private function setActiveState(Request $request, int $id, bool $isActive): JsonResponse
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $candidate = Candidate::find($id);

        if (!$candidate) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_NOT_FOUND',
                'message' => 'Candidate not found.',
            ], 404);
        }

        $candidate->is_active = $isActive;
        $candidate->save();

        $this->logActivity(
            $request,
            $isActive ? 'Candidate Activated' : 'Candidate Deactivated',
            'Candidate',
            ($isActive ? 'Activated candidate: ' : 'Deactivated candidate: ') . $candidate->full_name
        );

        $this->recordHistory(
            $request,
            $candidate->id,
            $isActive ? 'activated' : 'deactivated',
            $isActive ? 'Candidate profile activated' : 'Candidate profile deactivated',
            $candidate->status,
            $candidate->status
        );

        return response()->json([
            'success' => true,
            'message' => $isActive ? 'Candidate activated successfully' : 'Candidate deactivated successfully',
            'data' => [
                'candidate' => $candidate->fresh()->load('creator:id,full_name,name,email'),
            ],
        ]);
    }

    private function provisionCandidateLoginAccount(
        Candidate $candidate,
        ?string $loginEmail,
        ?string $loginPassword,
        bool $resetPassword = false
    ): array {
        $resolvedEmail = $this->resolveCandidateLoginEmail($candidate, $loginEmail);

        $existingByEmail = User::query()
            ->whereRaw('LOWER(email) = ?', [strtolower($resolvedEmail)])
            ->first();

        if ($existingByEmail && (int) $candidate->user_id !== (int) $existingByEmail->id) {
            throw new \InvalidArgumentException('Login email is already used by another account.');
        }

        $isNewAccount = false;
        $passwordChanged = false;
        $generatedPassword = null;

        $user = $candidate->user_id ? User::find($candidate->user_id) : null;

        if (!$user) {
            if ($existingByEmail) {
                $user = $existingByEmail;
            } else {
                $generatedPassword = $loginPassword ?: Str::password(10);

                $user = User::create([
                    'full_name' => $candidate->full_name,
                    'email' => $resolvedEmail,
                    'password' => Hash::make($generatedPassword),
                    'role' => 'candidate',
                    'is_active' => true,
                ]);

                $isNewAccount = true;
                $passwordChanged = true;
            }
        }

        $user->full_name = $candidate->full_name;
        $user->email = $resolvedEmail;
        $user->role = $user->role ?: 'candidate';
        $user->is_active = true;

        if ($resetPassword || (!$isNewAccount && !empty($loginPassword))) {
            $generatedPassword = $loginPassword ?: Str::password(10);
            $user->password = Hash::make($generatedPassword);
            $passwordChanged = true;
        }

        $user->save();

        if ((int) $candidate->user_id !== (int) $user->id) {
            $candidate->user_id = $user->id;
            $candidate->save();
        }

        return [
            'user_id' => $user->id,
            'email' => $user->email,
            'password' => $generatedPassword,
            'password_generated' => $generatedPassword !== null,
            'password_changed' => $passwordChanged,
            'is_new_account' => $isNewAccount,
        ];
    }

    private function resolveCandidateLoginEmail(Candidate $candidate, ?string $loginEmail): string
    {
        if (!empty($loginEmail)) {
            return strtolower(trim($loginEmail));
        }

        if (!empty($candidate->email)) {
            return strtolower(trim((string) $candidate->email));
        }

        throw new \InvalidArgumentException('Candidate email is required to create login account.');
    }

    private function normalizePassportNumber(?string $passportNumber): ?string
    {
        if ($passportNumber === null) {
            return null;
        }

        $normalized = preg_replace('/\s+/', '', trim((string) $passportNumber));

        if ($normalized === '') {
            return null;
        }

        return strtoupper($normalized);
    }

    private function normalizeCandidateStatus(?string $status): ?string
    {
        if ($status === null) {
            return null;
        }

        $normalized = strtolower(trim((string) $status));
        $normalized = preg_replace('/\s+/', '_', $normalized);
        $normalized = str_replace('-', '_', $normalized);
        $normalized = preg_replace('/[^a-z0-9_]/', '', $normalized);

        if ($normalized === '') {
            return null;
        }

        return $normalized;
    }

    private function candidatePassportDatePayload(Request $request): array
    {
        $payload = [];

        if (Schema::hasColumn('candidates', 'passport_issue_date') && $request->filled('passport_issue_date')) {
            $payload['passport_issue_date'] = $request->input('passport_issue_date');
        }

        if (Schema::hasColumn('candidates', 'passport_expiry_date') && $request->filled('passport_expiry_date')) {
            $payload['passport_expiry_date'] = $request->input('passport_expiry_date');
        }

        if (Schema::hasColumn('candidates', 'passport_renewal_day') && $request->filled('passport_renewal_day')) {
            $payload['passport_renewal_day'] = $request->input('passport_renewal_day');
        }

        return $payload;
    }

    private function persistPassportFallback(Request $request, Candidate $candidate): void
    {
        $requiresDateFallback = !$this->hasCandidatePassportColumns() && $request->hasAny([
            'passport_issue_date',
            'passport_expiry_date',
            'passport_renewal_day',
        ]);

        $requiresStatusFallback = !$this->hasPassportStoreStatusColumns() && $request->hasAny([
            'passport_store_status',
            'passport_store_out_by',
        ]);

        if (!$requiresDateFallback && !$requiresStatusFallback) {
            return;
        }

        $value = [];

        if ($requiresDateFallback) {
            $value['passport_issue_date'] = $request->filled('passport_issue_date') ? $request->input('passport_issue_date') : null;
            $value['passport_expiry_date'] = $request->filled('passport_expiry_date') ? $request->input('passport_expiry_date') : null;
            $value['passport_renewal_day'] = $request->filled('passport_renewal_day') ? $request->input('passport_renewal_day') : null;
        }

        if ($requiresStatusFallback) {
            $value['passport_store_status'] = $request->filled('passport_store_status') ? $request->input('passport_store_status') : null;
            $value['passport_store_out_by'] = $request->filled('passport_store_out_by') ? $request->input('passport_store_out_by') : null;
        }

        if (Schema::hasTable('app_settings')) {
            $setting = AppSetting::query()->firstOrNew(['key' => $this->passportFallbackKey((int) $candidate->id)]);
            $setting->value = array_merge(is_array($setting->value) ? $setting->value : [], $value);

            if (!$setting->exists) {
                $setting->created_by = optional($request->user())->id;
            }

            $setting->updated_by = optional($request->user())->id;
            $setting->save();
        }

        // Fallback that survives across devices via shared candidates table.
        $candidate->notes = $this->withPassportMetaInNotes($candidate->notes, $value);
        $candidate->save();
    }

    private function passportFallbackByCandidateIds(array $candidateIds): array
    {
        if ($this->hasCandidatePassportColumns() && $this->hasPassportStoreStatusColumns()) {
            return [];
        }

        if (!Schema::hasTable('app_settings')) {
            return [];
        }

        $ids = array_values(array_filter(array_unique(array_map('intval', $candidateIds)), static fn ($id) => $id > 0));
        if (count($ids) === 0) {
            return [];
        }

        $keys = array_map(fn ($id) => $this->passportFallbackKey((int) $id), $ids);
        $rows = AppSetting::query()->whereIn('key', $keys)->get(['key', 'value']);
        $map = [];

        foreach ($rows as $row) {
            $candidateId = (int) str_replace('candidate_passport_dates:', '', (string) $row->key);
            if ($candidateId <= 0) {
                continue;
            }

            $map[$candidateId] = is_array($row->value) ? $row->value : [];
        }

        return $map;
    }

    private function hydrateCandidatePassportFallback(Candidate $candidate, array $fallbackMap): void
    {
        $needsDateHydration = !$this->hasCandidatePassportColumns();
        $needsStatusHydration = !$this->hasPassportStoreStatusColumns();

        if (!$needsDateHydration && !$needsStatusHydration) {
            return;
        }

        $fallback = $fallbackMap[(int) $candidate->id] ?? $this->passportMetaFromNotes($candidate->notes);
        if (!is_array($fallback)) {
            return;
        }

        if ($needsDateHydration) {
            if (empty($candidate->passport_issue_date) && !empty($fallback['passport_issue_date'])) {
                $candidate->setAttribute('passport_issue_date', $fallback['passport_issue_date']);
            }

            if (empty($candidate->passport_expiry_date) && !empty($fallback['passport_expiry_date'])) {
                $candidate->setAttribute('passport_expiry_date', $fallback['passport_expiry_date']);
            }

            if (empty($candidate->passport_renewal_day) && !empty($fallback['passport_renewal_day'])) {
                $candidate->setAttribute('passport_renewal_day', $fallback['passport_renewal_day']);
            }
        }

        if ($needsStatusHydration) {
            if (empty($candidate->passport_store_status) && !empty($fallback['passport_store_status'])) {
                $candidate->setAttribute('passport_store_status', $fallback['passport_store_status']);
            }

            if (empty($candidate->passport_store_out_by) && !empty($fallback['passport_store_out_by'])) {
                $candidate->setAttribute('passport_store_out_by', $fallback['passport_store_out_by']);
            }
        }
    }

    private function passportFallbackKey(int $candidateId): string
    {
        return 'candidate_passport_dates:' . $candidateId;
    }

    private function hasCandidatePassportColumns(): bool
    {
        return Schema::hasColumn('candidates', 'passport_issue_date')
            && Schema::hasColumn('candidates', 'passport_expiry_date')
            && Schema::hasColumn('candidates', 'passport_renewal_day');
    }

    private function hasPassportStoreStatusColumns(): bool
    {
        return Schema::hasColumn('candidates', 'passport_store_status')
            && Schema::hasColumn('candidates', 'passport_store_out_by');
    }

    private function withPassportMetaInNotes($notes, array $meta): string
    {
        $cleanNotes = preg_replace('/\n\n\[MOPL_PASSPORT_META\]\{.*\}\s*$/s', '', (string) ($notes ?? ''));
        $payload = [
            'passport_issue_date' => $meta['passport_issue_date'] ?? null,
            'passport_expiry_date' => $meta['passport_expiry_date'] ?? null,
            'passport_renewal_day' => $meta['passport_renewal_day'] ?? null,
            'passport_store_status' => $meta['passport_store_status'] ?? null,
            'passport_store_out_by' => $meta['passport_store_out_by'] ?? null,
        ];

        return rtrim($cleanNotes) . self::PASSPORT_META_PREFIX . json_encode($payload);
    }

    private function passportMetaFromNotes($notes): array
    {
        $value = (string) ($notes ?? '');
        $markerPosition = strrpos($value, self::PASSPORT_META_PREFIX);
        if ($markerPosition === false) {
            return [];
        }

        $json = substr($value, $markerPosition + strlen(self::PASSPORT_META_PREFIX));
        $parsed = json_decode(trim($json), true);
        return is_array($parsed) ? $parsed : [];
    }

    private function ensureCandidateReadAccess(Request $request): ?JsonResponse
    {
        $authUser = $request->user();

        if (!$authUser) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_UNAUTHENTICATED',
                'message' => 'Unauthenticated.',
            ], 401);
        }

        if (!in_array($authUser->role, ['admin', 'superadmin', 'super_admin', 'candidate_officer', 'finance_officer', 'management', 'documentation', 'documentation_head', 'account'], true)) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_FORBIDDEN',
                'message' => 'You do not have access to candidate management.',
            ], 403);
        }

        return null;
    }

    private function ensureCandidateAccess(Request $request): ?JsonResponse
    {
        $authUser = $request->user();

        if (!$authUser) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_UNAUTHENTICATED',
                'message' => 'Unauthenticated.',
            ], 401);
        }

        if (!in_array($authUser->role, ['admin', 'superadmin', 'super_admin', 'candidate_officer', 'finance_officer', 'management', 'documentation', 'documentation_head', 'account'], true)) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_FORBIDDEN',
                'message' => 'You do not have access to candidate management.',
            ], 403);
        }

        return null;
    }

    private function logActivity(Request $request, string $action, string $module, string $description): void
    {
        try {
            DB::table('activity_logs')->insert([
                'user_id' => optional($request->user())->id,
                'action' => $action,
                'module' => $module,
                'description' => $description,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (\Throwable $e) {
            // Non-blocking when activity table is not ready.
        }
    }

    private function recordHistory(
        Request $request,
        int $candidateId,
        string $action,
        ?string $description = null,
        ?string $fromStatus = null,
        ?string $toStatus = null,
        ?array $metadata = null
    ): void {
        try {
            DB::table('candidate_histories')->insert([
                'candidate_id' => $candidateId,
                'user_id' => optional($request->user())->id,
                'action' => $action,
                'from_status' => $fromStatus,
                'to_status' => $toStatus,
                'description' => $description,
                'metadata' => $metadata ? json_encode($metadata) : null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (\Throwable $e) {
            // Non-blocking when history table is not ready.
        }
    }
}
