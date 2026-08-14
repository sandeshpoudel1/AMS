<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SubHeadCandidateCharge;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SubHeadCandidateChargeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($authError = $this->ensureFinanceViewAccess($request)) {
            return $authError;
        }

        $query = SubHeadCandidateCharge::query()->with([
            'expenseHead:id,name,is_active',
            'candidate:id,full_name,passport_number,is_active,project_id',
            'candidate.project:id,project_name',
            'agency:id,company_name,is_active',
        ]);

        if ($request->filled('expense_head_id')) {
            $query->where('expense_head_id', (int) $request->get('expense_head_id'));
        }

        if ($request->filled('agency_id')) {
            $query->where('agency_id', (int) $request->get('agency_id'));
        }

        if ($request->filled('candidate_id')) {
            $query->where('candidate_id', (int) $request->get('candidate_id'));
        }

        if ($request->filled('is_active')) {
            $isActive = filter_var($request->get('is_active'), FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
            if ($isActive !== null) {
                $query->where('is_active', $isActive);
            }
        }

        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where(function ($q) use ($search) {
                $q->whereHas('expenseHead', function ($headQuery) use ($search) {
                    $headQuery->where('name', 'like', '%' . $search . '%');
                })->orWhereHas('agency', function ($agencyQuery) use ($search) {
                    $agencyQuery->where('company_name', 'like', '%' . $search . '%');
                })->orWhereHas('candidate', function ($candidateQuery) use ($search) {
                    $candidateQuery->where('full_name', 'like', '%' . $search . '%')
                        ->orWhere('passport_number', 'like', '%' . $search . '%');
                });
            });
        }

        $rows = $query->orderByDesc('id')->get();

        return response()->json([
            'success' => true,
            'data' => $rows,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($authError = $this->ensureAdminAccess($request)) {
            return $authError;
        }

        $validator = Validator::make($request->all(), [
            'expense_head_id' => 'required|exists:expense_heads,id',
            'candidate_id' => 'nullable|exists:candidates,id',
            'agency_id' => 'nullable|exists:agencies,id',
            'amount' => 'required|numeric|min:0',
            'notes' => 'nullable|string|max:500',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'SUB_HEAD_CHARGE_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        if (!$request->filled('candidate_id') && !$request->filled('agency_id')) {
            return response()->json([
                'success' => false,
                'error_code' => 'SUB_HEAD_CHARGE_VALIDATION_FAILED',
                'message' => 'Please select at least one candidate or client.',
                'errors' => [
                    'candidate_id' => ['Candidate or client is required.'],
                    'agency_id' => ['Candidate or client is required.'],
                ],
            ], 422);
        }

        $existsQuery = SubHeadCandidateCharge::query()
            ->where('expense_head_id', (int) $request->get('expense_head_id'));

        if ($request->filled('candidate_id')) {
            $existsQuery->where('candidate_id', (int) $request->get('candidate_id'));
        } else {
            $existsQuery->whereNull('candidate_id');
        }

        if ($request->filled('agency_id')) {
            $existsQuery->where('agency_id', (int) $request->get('agency_id'));
        } else {
            $existsQuery->whereNull('agency_id');
        }

        $exists = $existsQuery->first();

        if ($exists) {
            return response()->json([
                'success' => false,
                'error_code' => 'SUB_HEAD_CHARGE_EXISTS',
                'message' => 'This candidate/client combination is already linked to the selected sub head.',
            ], 422);
        }

        $row = SubHeadCandidateCharge::create([
            'expense_head_id' => (int) $request->get('expense_head_id'),
            'agency_id' => $request->filled('agency_id') ? (int) $request->get('agency_id') : null,
            'candidate_id' => $request->filled('candidate_id') ? (int) $request->get('candidate_id') : null,
            'amount' => (float) $request->get('amount'),
            'notes' => $request->get('notes'),
            'is_active' => $request->has('is_active') ? (bool) $request->get('is_active') : true,
            'created_by' => optional($request->user())->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Sub head link created successfully',
            'data' => $row->load(['expenseHead:id,name', 'agency:id,company_name', 'candidate:id,full_name,passport_number']),
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureAdminAccess($request)) {
            return $authError;
        }

        $row = SubHeadCandidateCharge::find($id);

        if (!$row) {
            return response()->json([
                'success' => false,
                'error_code' => 'SUB_HEAD_CHARGE_NOT_FOUND',
                'message' => 'Sub head link not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:0',
            'notes' => 'nullable|string|max:500',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'SUB_HEAD_CHARGE_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $row->update([
            'amount' => (float) $request->get('amount'),
            'notes' => $request->get('notes'),
            'is_active' => $request->has('is_active') ? (bool) $request->get('is_active') : $row->is_active,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Sub head link updated successfully',
            'data' => $row->load(['expenseHead:id,name', 'agency:id,company_name', 'candidate:id,full_name,passport_number']),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureAdminAccess($request)) {
            return $authError;
        }

        $row = SubHeadCandidateCharge::find($id);

        if (!$row) {
            return response()->json([
                'success' => false,
                'error_code' => 'SUB_HEAD_CHARGE_NOT_FOUND',
                'message' => 'Sub head link not found.',
            ], 404);
        }

        $row->delete();

        return response()->json([
            'success' => true,
            'message' => 'Sub head link deleted successfully',
        ]);
    }

    private function ensureFinanceViewAccess(Request $request): ?JsonResponse
    {
        $authUser = $request->user();

        if (!$authUser) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_UNAUTHENTICATED',
                'message' => 'Unauthenticated.',
            ], 401);
        }

        if (!in_array($authUser->role, ['admin', 'finance_officer', 'account'], true)) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_FORBIDDEN',
                'message' => 'You do not have access to sub head links.',
            ], 403);
        }

        return null;
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
                'message' => 'Only admin or superadmin can manage sub head links.',
            ], 403);
        }

        return null;
    }
}
