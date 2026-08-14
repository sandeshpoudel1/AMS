<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Staff;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class StaffController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        $perPage = min(max((int) $request->get('per_page', 50), 1), 100);
        $query = Staff::query()->orderBy('full_name');

        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where(function ($q) use ($search) {
                $q->where('full_name', 'like', '%' . $search . '%')
                    ->orWhere('email', 'like', '%' . $search . '%')
                    ->orWhere('position', 'like', '%' . $search . '%');
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->get('status'));
        }

        if ($request->filled('department')) {
            $query->where('department', $request->get('department'));
        }

        $staff = $request->get('all') === '1' 
            ? $query->get() 
            : $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $request->get('all') === '1' ? $staff : $staff->items(),
            'pagination' => $request->get('all') !== '1' ? [
                'current_page' => $staff->currentPage(),
                'last_page' => $staff->lastPage(),
                'total' => $staff->total(),
                'per_page' => $staff->perPage(),
            ] : null,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        $validator = Validator::make($request->all(), [
            'full_name' => 'required|string|max:255',
            'email' => 'nullable|email|unique:staff,email',
            'phone' => 'nullable|string|max:20',
            'position' => 'nullable|string|max:255',
            'employment_type' => 'required|in:full_time,part_time,contract,temporary',
            'hire_date' => 'nullable|date',
            'department' => 'nullable|string|max:255',
            'base_salary' => 'nullable|numeric|min:0',
            'status' => 'required|in:active,inactive,on_leave,terminated',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $staff = Staff::create([
            ...$request->only(['full_name', 'email', 'phone', 'position', 'employment_type', 'hire_date', 'department', 'base_salary', 'status', 'notes']),
            'created_by' => Auth::id(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Staff member created',
            'data' => $staff,
        ], 201);
    }

    public function show(Staff $staff): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess(request())) {
            return $authError;
        }

        return response()->json([
            'success' => true,
            'data' => $staff,
        ]);
    }

    public function update(Request $request, Staff $staff): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        $validator = Validator::make($request->all(), [
            'full_name' => 'nullable|string|max:255',
            'email' => 'nullable|email|unique:staff,email,' . $staff->id,
            'phone' => 'nullable|string|max:20',
            'position' => 'nullable|string|max:255',
            'employment_type' => 'nullable|in:full_time,part_time,contract,temporary',
            'hire_date' => 'nullable|date',
            'department' => 'nullable|string|max:255',
            'base_salary' => 'nullable|numeric|min:0',
            'status' => 'nullable|in:active,inactive,on_leave,terminated',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $staff->update($request->only(['full_name', 'email', 'phone', 'position', 'employment_type', 'hire_date', 'department', 'base_salary', 'status', 'notes']));

        return response()->json([
            'success' => true,
            'message' => 'Staff member updated',
            'data' => $staff,
        ]);
    }

    public function destroy(Staff $staff): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess(request())) {
            return $authError;
        }

        $staff->delete();

        return response()->json([
            'success' => true,
            'message' => 'Staff member deleted',
        ]);
    }

    private function ensureFinanceAccess(Request $request): ?JsonResponse
    {
        $user = Auth::user();
        $role = strtolower(str_replace(' ', '_', (string) ($user?->role ?? '')));
        if (!$user || !in_array($role, ['admin', 'finance_officer', 'hr_officer', 'account', 'superadmin', 'super_admin'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 403);
        }
        return null;
    }
}
