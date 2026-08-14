<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Candidate;
use App\Models\Training;
use App\Models\TrainingEnrollment;
use App\Models\TrainingAssessment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class TrainingController extends Controller
{
    /**
     * Get all training enrollments with pagination
     */
    public function listEnrollments(Request $request): JsonResponse
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $perPage = min(max((int) $request->get('per_page', 15), 1), 100);
        $query = TrainingEnrollment::with('candidate:id,full_name,passport_number,email', 'training:id,name,category,daily_rate', 'trainingCompany:id,company_name', 'creator:id,full_name,name');

        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where(function ($q) use ($search) {
                $q->where('participant_name', 'like', '%' . $search . '%')
                    ->orWhereHas('candidate', function ($subQ) use ($search) {
                        $subQ->where('full_name', 'like', '%' . $search . '%')
                            ->orWhere('email', 'like', '%' . $search . '%')
                            ->orWhere('passport_number', 'like', '%' . $search . '%');
                    });
            });
        }

        if ($request->filled('training_id')) {
            $query->where('training_id', $request->get('training_id'));
        }

        if ($request->filled('payment_status')) {
            $query->where('payment_status', $request->get('payment_status'));
        }

        $enrollments = $query->orderByDesc('enrollment_date')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'enrollments' => $enrollments->items(),
            ],
            'pagination' => [
                'current_page' => $enrollments->currentPage(),
                'last_page' => $enrollments->lastPage(),
                'per_page' => $enrollments->perPage(),
                'total' => $enrollments->total(),
            ],
        ]);
    }

    /**
     * Get all trainings
     */
    public function getTrainings(Request $request): JsonResponse
    {
        $category = $request->get('category');
        $query = Training::active();

        if ($category) {
            $query->byCategory($category);
        }

        $trainings = $query->orderBy('category')->orderBy('name')->get();

        return response()->json([
            'success' => true,
            'data' => $trainings,
        ]);
    }

    /**
     * Get candidate training enrollments
     */
    public function getCandidateTrainings(Request $request, int $candidateId): JsonResponse
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $candidate = Candidate::find($candidateId);

        if (!$candidate) {
            return response()->json([
                'success' => false,
                'error_code' => 'CANDIDATE_NOT_FOUND',
                'message' => 'Candidate not found.',
            ], 404);
        }

        $enrollments = TrainingEnrollment::byCandidate($candidateId)
            ->with('training', 'creator:id,full_name,name')
            ->orderByDesc('enrollment_date')
            ->get();

        $totalTrainingAmount = TrainingEnrollment::getTotalTrainingAmount($candidateId);
        $totalPaidAmount = TrainingEnrollment::getTotalPaidAmount($candidateId);

        return response()->json([
            'success' => true,
            'data' => [
                'enrollments' => $enrollments,
                'summary' => [
                    'total_trainings' => $enrollments->count(),
                    'total_training_amount' => (float)$totalTrainingAmount,
                    'total_paid_amount' => (float)$totalPaidAmount,
                    'total_remaining' => (float)($totalTrainingAmount - $totalPaidAmount),
                ],
            ],
        ]);
    }

    /**
     * Enroll candidate in training
     */
    public function enrollTraining(Request $request): JsonResponse
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $validator = Validator::make($request->all(), [
            'candidate_id' => 'nullable|exists:candidates,id',
            'participant_name' => 'required|string|max:255',
            'training_id' => 'required|exists:trainings,id',
            'training_company_id' => 'required|exists:training_companies,id',
            'duration_days' => 'required|integer|min:1',
            'enrollment_date' => 'required|date',
            'passport_number' => 'nullable|string',
            'previous_experience' => 'nullable|string',
            'instructor_assigned' => 'nullable|string|max:255',
            'record_document' => 'nullable|file|mimes:pdf,doc,docx,jpg,jpeg,png|max:5120',
            'paid_amount' => 'nullable|numeric|min:0',
            'advance_payment_1' => 'nullable|numeric|min:0',
            'advance_payment_2' => 'nullable|numeric|min:0',
            'advance_payment_3' => 'nullable|numeric|min:0',
            'discount_amount' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'TRAINING_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $training = Training::find($request->get('training_id'));
        $durationDays = (int)$request->get('duration_days');
        $trainingAmount = (float)($training->daily_rate * $durationDays);
        $paidAmount = (float)($request->get('paid_amount', 0));
        $advancePayment1 = (float)($request->get('advance_payment_1', 0));
        $advancePayment2 = (float)($request->get('advance_payment_2', 0));
        $advancePayment3 = (float)($request->get('advance_payment_3', 0));
        $discountAmount = (float)($request->get('discount_amount', 0));

        $paymentStatus = 'unpaid';
        if ($paidAmount >= $trainingAmount && $trainingAmount > 0) {
            $paymentStatus = 'paid';
        } elseif ($paidAmount > 0) {
            $paymentStatus = 'partial';
        }

        // Handle file upload
        $documentPath = null;
        if ($request->hasFile('record_document')) {
            $documentPath = $request->file('record_document')->store('training-documents', 'public');
        }

        $enrollmentData = [
            'candidate_id' => $request->get('candidate_id') ?? null,
            'participant_name' => $request->get('participant_name') ?? null,
            'training_id' => $request->get('training_id'),
            'training_company_id' => $request->get('training_company_id'),
            'enrollment_date' => $request->get('enrollment_date'),
            'duration_days' => $durationDays,
            'passport_number' => $request->get('passport_number'),
            'previous_experience' => $request->get('previous_experience'),
            'instructor_assigned' => $request->get('instructor_assigned'),
            'record_document' => $documentPath,
            'certificate_status' => 'pending',
            'training_amount' => $trainingAmount,
            'paid_amount' => $paidAmount,
            'advance_payment_1' => $advancePayment1,
            'advance_payment_2' => $advancePayment2,
            'advance_payment_3' => $advancePayment3,
            'discount_amount' => $discountAmount,
            'payment_status' => $paymentStatus,
            'notes' => $request->get('notes'),
            'created_by' => $request->user()->id,
        ];

        $enrollment = TrainingEnrollment::create($enrollmentData);

        $this->logActivity(
            $request,
            'Training Enrollment Created',
            'Training',
            'Enrolled candidate in ' . $training->name . ' training for ' . $durationDays . ' days'
        );

        return response()->json([
            'success' => true,
            'message' => 'Candidate enrolled in training successfully',
            'data' => $enrollment->load('training', 'trainingCompany:id,company_name', 'creator:id,full_name,name'),
        ], 201);
    }

    /**
     * Update training enrollment
     */
    public function updateEnrollment(Request $request, int $enrollmentId): JsonResponse
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $enrollment = TrainingEnrollment::find($enrollmentId);

        if (!$enrollment) {
            return response()->json([
                'success' => false,
                'error_code' => 'ENROLLMENT_NOT_FOUND',
                'message' => 'Training enrollment not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'candidate_id' => 'sometimes|nullable|exists:candidates,id',
            'participant_name' => 'sometimes|string|max:255',
            'training_company_id' => 'sometimes|exists:training_companies,id',
            'status' => 'sometimes|in:enrolled,ongoing,completed,cancelled',
            'start_date' => 'sometimes|date',
            'end_date' => 'sometimes|date',
            'duration_days' => 'sometimes|integer|min:1',
            'passport_number' => 'sometimes|string',
            'previous_experience' => 'sometimes|string',
            'instructor_assigned' => 'sometimes|nullable|string|max:255',
            'certificate_status' => 'sometimes|in:pending,received,to_be_given',
            'paid_amount' => 'sometimes|numeric|min:0',
            'advance_payment_1' => 'sometimes|numeric|min:0',
            'advance_payment_2' => 'sometimes|numeric|min:0',
            'advance_payment_3' => 'sometimes|numeric|min:0',
            'discount_amount' => 'sometimes|numeric|min:0',
            'payment_reference' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'TRAINING_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $updates = $request->only(['candidate_id', 'participant_name', 'training_company_id', 'status', 'start_date', 'end_date', 'notes', 'payment_reference', 'passport_number', 'previous_experience', 'instructor_assigned', 'certificate_status', 'advance_payment_1', 'advance_payment_2', 'advance_payment_3', 'discount_amount']);

        // Recalculate amount if duration changes
        if ($request->filled('duration_days')) {
            $durationDays = (int)$request->get('duration_days');
            $updates['duration_days'] = $durationDays;
            $updates['training_amount'] = (float)($enrollment->training->daily_rate * $durationDays);
        }

        // Update paid amount and payment status
        if ($request->filled('paid_amount')) {
            $paidAmount = (float)$request->get('paid_amount');
            $updates['paid_amount'] = $paidAmount;
            
            if ($paidAmount >= $enrollment->training_amount) {
                $updates['payment_status'] = 'paid';
            } elseif ($paidAmount > 0) {
                $updates['payment_status'] = 'partial';
            } else {
                $updates['payment_status'] = 'unpaid';
            }
        }

        $enrollment->update($updates);

        $this->logActivity(
            $request,
            'Training Enrollment Updated',
            'Training',
            'Updated enrollment for ' . $enrollment->training->name . ' training'
        );

        return response()->json([
            'success' => true,
            'message' => 'Training enrollment updated successfully',
            'data' => $enrollment->load('training', 'trainingCompany:id,company_name', 'creator:id,full_name,name'),
        ]);
    }

    /**
     * Update training enrollment payment
     */
    public function updateEnrollmentPayment(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $enrollment = TrainingEnrollment::find($id);

        if (!$enrollment) {
            return response()->json([
                'success' => false,
                'error_code' => 'ENROLLMENT_NOT_FOUND',
                'message' => 'Training enrollment not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'paid_amount' => 'required|numeric|min:0',
            'payment_reference' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'TRAINING_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $paidAmount = (float) $request->get('paid_amount');
        $trainingAmount = (float) $enrollment->training_amount;

        // Set payment status based on paid amount
        if ($paidAmount >= $trainingAmount) {
            $enrollment->payment_status = 'paid';
        } elseif ($paidAmount > 0) {
            $enrollment->payment_status = 'partial';
        } else {
            $enrollment->payment_status = 'unpaid';
        }

        $enrollment->update([
            'paid_amount' => round($paidAmount, 2),
            'payment_status' => $enrollment->payment_status,
            'payment_reference' => $request->get('payment_reference'),
        ]);

        $this->logActivity(
            $request,
            'Training Enrollment Payment Updated',
            'Training',
            'Updated payment for training enrollment'
        );

        return response()->json([
            'success' => true,
            'message' => 'Training enrollment payment updated successfully',
            'data' => $enrollment->fresh()->load('training:id,name,category,daily_rate', 'trainingCompany:id,company_name', 'candidate:id,full_name,passport_number,email'),
        ]);
    }

    /**
     * Delete training enrollment.
     */
    public function destroyEnrollment(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $enrollment = TrainingEnrollment::find($id);

        if (!$enrollment) {
            return response()->json([
                'success' => false,
                'error_code' => 'ENROLLMENT_NOT_FOUND',
                'message' => 'Training enrollment not found.',
            ], 404);
        }

        $enrollment->delete();

        $this->logActivity(
            $request,
            'Training Enrollment Deleted',
            'Training',
            'Deleted training enrollment #' . $id
        );

        return response()->json([
            'success' => true,
            'message' => 'Training enrollment deleted successfully',
        ]);
    }

    /**
     * Get training statistics for finance
     */
    public function getTrainingStatistics(Request $request): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        $totalEnrollments = TrainingEnrollment::count();
        $totalTrainingAmount = (float)TrainingEnrollment::sum('training_amount');
        $totalPaidAmount = (float)TrainingEnrollment::sum('paid_amount');
        $totalAdvance = (float)TrainingEnrollment::sum(DB::raw('COALESCE(advance_payment_1, 0) + COALESCE(advance_payment_2, 0) + COALESCE(advance_payment_3, 0)'));
        $totalDiscount = (float)TrainingEnrollment::sum('discount_amount');
        $totalUnpaidAmount = $totalTrainingAmount - $totalPaidAmount;

        // By status
        $byStatus = TrainingEnrollment::select('payment_status', DB::raw('COUNT(*) as count'), DB::raw('SUM(training_amount) as total_amount'))
            ->groupBy('payment_status')
            ->get()
            ->map(function ($item) {
                return [
                    'status' => $item->payment_status,
                    'count' => (int)$item->count,
                    'total_amount' => (float)$item->total_amount,
                ];
            })
            ->toArray();

        // By training
        $byTraining = Training::select('trainings.id', 'trainings.name', DB::raw('COUNT(training_enrollments.id) as count'), DB::raw('SUM(training_enrollments.training_amount) as total_amount'), DB::raw('SUM(training_enrollments.paid_amount) as total_paid'))
            ->leftJoin('training_enrollments', 'trainings.id', '=', 'training_enrollments.training_id')
            ->groupBy('trainings.id', 'trainings.name')
            ->get()
            ->map(function ($item) {
                return [
                    'training_id' => $item->id,
                    'training_name' => $item->name,
                    'enrollments' => (int)$item->count,
                    'total_amount' => (float)($item->total_amount ?? 0),
                    'total_paid' => (float)($item->total_paid ?? 0),
                    'balance' => (float)(($item->total_amount ?? 0) - ($item->total_paid ?? 0)),
                ];
            })
            ->toArray();

        return response()->json([
            'success' => true,
            'data' => [
                'summary' => [
                    'total_enrollments' => $totalEnrollments,
                    'total_training_amount' => round($totalTrainingAmount, 2),
                    'total_paid_amount' => round($totalPaidAmount, 2),
                    'total_advance' => round($totalAdvance, 2),
                    'total_discount' => round($totalDiscount, 2),
                    'total_unpaid_amount' => round($totalUnpaidAmount, 2),
                ],
                'by_status' => $byStatus,
                'by_training' => $byTraining,
            ],
        ]);
    }

    /**
     * Create a new training
     */
    public function storeTraining(Request $request): JsonResponse
    {
        if ($authError = $this->ensureAdminAccess($request)) {
            return $authError;
        }

        $validator = Validator::make($request->all(), [
            'name' => [
                'required',
                'string',
                Rule::unique('trainings', 'name')->whereNull('deleted_at'),
            ],
            'category' => 'required|string',
            'subcategory' => 'nullable|string',
            'description' => 'nullable|string',
            'daily_rate' => 'required|numeric|min:0',
            'duration_days' => 'sometimes|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'TRAINING_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $training = Training::create([
            'name' => $request->get('name'),
            'category' => $request->get('category'),
            'subcategory' => $request->get('subcategory'),
            'description' => $request->get('description'),
            'daily_rate' => $request->get('daily_rate'),
            'duration_days' => $request->get('duration_days', 5),
        ]);

        $this->logActivity($request, 'Training Created', 'Training', 'Created training: ' . $training->name);

        return response()->json([
            'success' => true,
            'message' => 'Training created successfully',
            'data' => $training,
        ], 201);
    }

    /**
     * Update training
     */
    public function updateTraining(Request $request, int $trainingId): JsonResponse
    {
        if ($authError = $this->ensureAdminAccess($request)) {
            return $authError;
        }

        $training = Training::find($trainingId);

        if (!$training) {
            return response()->json([
                'success' => false,
                'error_code' => 'TRAINING_NOT_FOUND',
                'message' => 'Training not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => [
                'sometimes',
                'string',
                Rule::unique('trainings', 'name')
                    ->ignore($trainingId)
                    ->whereNull('deleted_at'),
            ],
            'category' => 'sometimes|string',
            'subcategory' => 'sometimes|nullable|string',
            'description' => 'sometimes|nullable|string',
            'daily_rate' => 'sometimes|numeric|min:0',
            'duration_days' => 'sometimes|integer|min:1',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'TRAINING_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $training->update($request->only(['name', 'category', 'subcategory', 'description', 'daily_rate', 'duration_days', 'is_active']));

        $this->logActivity($request, 'Training Updated', 'Training', 'Updated training: ' . $training->name);

        return response()->json([
            'success' => true,
            'message' => 'Training updated successfully',
            'data' => $training,
        ]);
    }

    /**
     * Delete training
     */
    public function destroyTraining(Request $request, int $trainingId): JsonResponse
    {
        if ($authError = $this->ensureAdminAccess($request)) {
            return $authError;
        }

        $training = Training::find($trainingId);

        if (!$training) {
            return response()->json([
                'success' => false,
                'error_code' => 'TRAINING_NOT_FOUND',
                'message' => 'Training not found.',
            ], 404);
        }

        $trainingName = $training->name;
        $training->delete();

        $this->logActivity($request, 'Training Deleted', 'Training', 'Deleted training: ' . $trainingName);

        return response()->json([
            'success' => true,
            'message' => 'Training deleted successfully',
        ]);
    }

    /**
     * Save or update certification
     */
    public function saveCertification(Request $request, int $enrollmentId): JsonResponse
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $enrollment = TrainingEnrollment::find($enrollmentId);

        if (!$enrollment) {
            return response()->json([
                'success' => false,
                'error_code' => 'ENROLLMENT_NOT_FOUND',
                'message' => 'Training enrollment not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'certificate_number' => 'sometimes|string|unique:certifications,certificate_number',
            'certificate_received_date' => 'sometimes|date',
            'certificate_to_be_given_date' => 'sometimes|date',
            'certification_level' => 'sometimes|string',
            'issuing_authority' => 'sometimes|string',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'CERTIFICATION_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $certData = $request->only(['certificate_number', 'certificate_received_date', 'certificate_to_be_given_date', 'certification_level', 'issuing_authority', 'notes']);
        $certData['training_enrollment_id'] = $enrollmentId;
        $certData['created_by'] = $request->user()->id;

        $certification = $enrollment->certification;

        if ($certification) {
            $certification->update($certData);
        } else {
            $certification = \App\Models\Certification::create($certData);
        }

        // Update certificate status in enrollment if dates provided
        if ($request->filled('certificate_received_date')) {
            $enrollment->update(['certificate_status' => 'received']);
        } elseif ($request->filled('certificate_to_be_given_date')) {
            $enrollment->update(['certificate_status' => 'to_be_given']);
        }

        $this->logActivity(
            $request,
            'Certification Saved',
            'Training',
            'Certificate saved for enrollment ' . $enrollmentId
        );

        return response()->json([
            'success' => true,
            'message' => 'Certification saved successfully',
            'data' => [
                'enrollment' => $enrollment->load('certification', 'training', 'creator:id,full_name,name'),
                'certification' => $certification,
            ],
        ]);
    }

    /**
     * Get enrollment with certification details
     */
    public function getEnrollmentDetail(Request $request, int $enrollmentId): JsonResponse
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $enrollment = TrainingEnrollment::with('candidate:id,full_name,passport_number,email', 'training:id,name,category,daily_rate', 'certification', 'creator:id,full_name,name')->find($enrollmentId);

        if (!$enrollment) {
            return response()->json([
                'success' => false,
                'error_code' => 'ENROLLMENT_NOT_FOUND',
                'message' => 'Training enrollment not found.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $enrollment,
        ]);
    }

    private function ensureAdminAccess(Request $request): ?JsonResponse
    {
        $authUser = $request->user();

        if (!$authUser) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_UNAUTHENTICATED',
                'message' => 'Unauthenticated.',
            ], 401);
        }

        $role = strtolower(str_replace(' ', '_', (string) ($authUser->role ?? '')));
        if (!in_array($role, ['admin', 'superadmin', 'super_admin'], true)) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_FORBIDDEN',
                'message' => 'Only admin or superadmin can access training administration.',
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

        $role = strtolower(str_replace(' ', '_', (string) ($authUser->role ?? '')));
        if (!in_array($role, ['admin', 'candidate_officer', 'documentation', 'documentation_head', 'superadmin', 'super_admin'], true)) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_FORBIDDEN',
                'message' => 'You do not have access to candidate management.',
            ], 403);
        }

        return null;
    }

    private function ensureFinanceAccess(Request $request): ?JsonResponse
    {
        $authUser = $request->user();

        if (!$authUser) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_UNAUTHENTICATED',
                'message' => 'Unauthenticated.',
            ], 401);
        }

        $role = strtolower(str_replace(' ', '_', (string) ($authUser->role ?? '')));
        if (!in_array($role, ['admin', 'finance_officer', 'superadmin', 'super_admin'], true)) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_FORBIDDEN',
                'message' => 'You do not have access to finance management.',
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

    /* ─────────────────────────────────────────────────────────────────────
     * Assessment & Certification
     * ───────────────────────────────────────────────────────────────────── */

    /**
     * List all training assessments with optional filters.
     */
    public function listAssessments(Request $request): JsonResponse
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $perPage = min(max((int) $request->get('per_page', 20), 1), 200);
        $query = TrainingAssessment::with([
            'enrollment.candidate:id,full_name,passport_number',
            'enrollment.training:id,name',
            'enrollment.trainingCompany:id,company_name',
        ]);

        if ($request->filled('enrollment_id')) {
            $query->where('enrollment_id', $request->get('enrollment_id'));
        }

        if ($request->filled('result')) {
            $query->where('result', $request->get('result'));
        }

        $assessments = $query->orderByDesc('created_at')->paginate($perPage);

        // Compute totals
        $totals = TrainingAssessment::selectRaw(
            'SUM(invoice_amount) as total_invoice, SUM(card_payment) as total_card_payment'
        )->first();

        return response()->json([
            'success' => true,
            'data' => [
                'assessments' => $assessments->items(),
                'totals' => [
                    'total_invoice_amount'    => (float) ($totals->total_invoice ?? 0),
                    'total_card_payment'      => (float) ($totals->total_card_payment ?? 0),
                    'total_payment_due'       => max(0, (float) ($totals->total_invoice ?? 0) - (float) ($totals->total_card_payment ?? 0)),
                ],
            ],
            'pagination' => [
                'current_page' => $assessments->currentPage(),
                'last_page'    => $assessments->lastPage(),
                'per_page'     => $assessments->perPage(),
                'total'        => $assessments->total(),
            ],
        ]);
    }

    /**
     * Create a new assessment record.
     */
    public function storeAssessment(Request $request): JsonResponse
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $validator = Validator::make($request->all(), [
            'enrollment_id'            => 'required|exists:training_enrollments,id',
            'result'                   => 'required|in:pass,fail,pending',
            're_assessment_required'   => 'boolean',
            'reassessment_1_date'      => 'nullable|date',
            'reassessment_1_result'    => 'nullable|in:pass,fail',
            'reassessment_2_date'      => 'nullable|date',
            'reassessment_2_result'    => 'nullable|in:pass,fail',
            'certificate_card_status'  => 'in:received,not_received,pending',
            'dispatch_status'          => 'in:dispatched,not_dispatched',
            'certification_expiry_date'=> 'nullable|date',
            'invoice_number'           => 'nullable|string|max:100',
            'invoice_amount'           => 'nullable|numeric|min:0',
            'card_payment'             => 'nullable|numeric|min:0',
            'notes'                    => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $assessment = TrainingAssessment::create(array_merge(
            $validator->validated(),
            ['created_by' => $request->user()?->id]
        ));

        $assessment->load(['enrollment.candidate:id,full_name', 'enrollment.training:id,name', 'enrollment.trainingCompany:id,company_name']);

        $this->logActivity($request, 'Assessment Saved', 'Training', "Assessment saved for enrollment #{$assessment->enrollment_id}");

        return response()->json(['success' => true, 'data' => $assessment, 'message' => 'Assessment saved'], 201);
    }

    /**
     * Update an existing assessment record.
     */
    public function updateAssessment(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $assessment = TrainingAssessment::find($id);
        if (!$assessment) {
            return response()->json(['success' => false, 'message' => 'Assessment not found'], 404);
        }

        $validator = Validator::make($request->all(), [
            'enrollment_id'            => 'sometimes|exists:training_enrollments,id',
            'result'                   => 'sometimes|in:pass,fail,pending',
            're_assessment_required'   => 'sometimes|boolean',
            'reassessment_1_date'      => 'nullable|date',
            'reassessment_1_result'    => 'nullable|in:pass,fail',
            'reassessment_2_date'      => 'nullable|date',
            'reassessment_2_result'    => 'nullable|in:pass,fail',
            'certificate_card_status'  => 'sometimes|in:received,not_received,pending',
            'dispatch_status'          => 'sometimes|in:dispatched,not_dispatched',
            'certification_expiry_date'=> 'nullable|date',
            'invoice_number'           => 'nullable|string|max:100',
            'invoice_amount'           => 'nullable|numeric|min:0',
            'card_payment'             => 'nullable|numeric|min:0',
            'notes'                    => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $assessment->update($validator->validated());
        $assessment->load(['enrollment.candidate:id,full_name', 'enrollment.training:id,name', 'enrollment.trainingCompany:id,company_name']);

        return response()->json(['success' => true, 'data' => $assessment, 'message' => 'Assessment updated']);
    }

    /**
     * Delete an assessment record.
     */
    public function destroyAssessment(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $assessment = TrainingAssessment::find($id);
        if (!$assessment) {
            return response()->json(['success' => false, 'message' => 'Assessment not found'], 404);
        }

        $assessment->delete();

        return response()->json(['success' => true, 'message' => 'Assessment deleted']);
    }
}
