<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExpenseHead;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ExpenseHeadController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($authError = $this->ensureFinanceViewAccess($request)) {
            return $authError;
        }

        $query = ExpenseHead::query();

        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', '%' . $search . '%')
                  ->orWhere('description', 'like', '%' . $search . '%');
            });
        }

        if ($request->filled('is_active')) {
            $isActive = filter_var($request->get('is_active'), FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
            if ($isActive !== null) {
                $query->where('is_active', $isActive);
            }
        }

        $heads = $query->orderBy('name')->get();

        return response()->json([
            'success' => true,
            'data' => $heads,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($authError = $this->ensureAdminAccess($request)) {
            return $authError;
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:120|unique:expense_heads,name',
            'description' => 'nullable|string|max:500',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'EXPENSE_HEAD_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $head = ExpenseHead::create([
            'name' => trim((string) $request->get('name')),
            'description' => $request->get('description'),
            'is_active' => $request->has('is_active') ? (bool) $request->get('is_active') : true,
            'created_by' => optional($request->user())->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Expense head created successfully',
            'data' => $head,
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureAdminAccess($request)) {
            return $authError;
        }

        $head = ExpenseHead::find($id);

        if (!$head) {
            return response()->json([
                'success' => false,
                'error_code' => 'EXPENSE_HEAD_NOT_FOUND',
                'message' => 'Expense head not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:120|unique:expense_heads,name,' . $id,
            'description' => 'nullable|string|max:500',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'EXPENSE_HEAD_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $head->update([
            'name' => trim((string) $request->get('name')),
            'description' => $request->get('description'),
            'is_active' => $request->has('is_active') ? (bool) $request->get('is_active') : $head->is_active,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Expense head updated successfully',
            'data' => $head,
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureAdminAccess($request)) {
            return $authError;
        }

        $head = ExpenseHead::find($id);

        if (!$head) {
            return response()->json([
                'success' => false,
                'error_code' => 'EXPENSE_HEAD_NOT_FOUND',
                'message' => 'Expense head not found.',
            ], 404);
        }

        $head->delete();

        return response()->json([
            'success' => true,
            'message' => 'Expense head deleted successfully',
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

        $role = strtolower(str_replace(' ', '_', (string) $authUser->role));
        if (!in_array($role, ['admin', 'finance_officer', 'superadmin', 'super_admin', 'account'], true)) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_FORBIDDEN',
                'message' => 'You do not have access to expense heads.',
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

        $role = strtolower(str_replace(' ', '_', (string) $authUser->role));
        if ($role !== 'admin' && $role !== 'superadmin' && $role !== 'super_admin') {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_FORBIDDEN',
                'message' => 'Only admin can manage expense heads.',
            ], 403);
        }

        return null;
    }
}
