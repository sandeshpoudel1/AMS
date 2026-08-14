<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SalaryAdvance;
use App\Models\SalaryHistory;
use App\Models\Staff;
use App\Models\StaffSalary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class SalaryController extends Controller
{
    public function getStaffSalaryDetails($staffId): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess(request())) {
            return $authError;
        }

        $staff = Staff::findOrFail($staffId);
        $currentSalary = StaffSalary::where('staff_id', $staffId)->active()->latest('effective_from')->first();
        $advances = SalaryAdvance::where('staff_id', $staffId)->whereIn('status', ['pending', 'partial'])->get();
        $totalAdvances = SalaryAdvance::getTotalAdvancesPendingForStaff($staffId);
        $salaryHistory = SalaryHistory::where('staff_id', $staffId)->latest('effective_date')->take(10)->get();

        return response()->json([
            'success' => true,
            'data' => [
                'staff' => $staff,
                'current_salary' => $currentSalary,
                'advances' => $advances,
                'total_advances_pending' => $totalAdvances,
                'salary_history' => $salaryHistory,
            ],
        ]);
    }

    public function setSalary(Request $request, Staff $staff): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        $validator = Validator::make($request->all(), [
            'base_salary' => 'required|numeric|min:0',
            'current_bonus' => 'nullable|numeric|min:0',
            'effective_from' => 'required|date',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        // End previous active salary
        StaffSalary::where('staff_id', $staff->id)
            ->where('status', 'active')
            ->update(['effective_to' => $request->get('effective_from'), 'status' => 'inactive']);

        $baseSalary = $request->get('base_salary');
        $bonus = $request->get('current_bonus') ?? 0;
        $totalCompensation = $baseSalary + $bonus;

        $salary = StaffSalary::create([
            'staff_id' => $staff->id,
            'base_salary' => $baseSalary,
            'current_bonus' => $bonus,
            'total_compensation' => $totalCompensation,
            'effective_from' => $request->get('effective_from'),
            'status' => 'active',
            'notes' => $request->get('notes'),
            'created_by' => Auth::id(),
        ]);

        // Record in history
        SalaryHistory::create([
            'staff_id' => $staff->id,
            'old_salary' => $staff->base_salary,
            'new_salary' => $baseSalary,
            'effective_date' => $request->get('effective_from'),
            'change_type' => $bonus > 0 ? 'adjustment' : 'increment',
            'reason' => $request->get('notes'),
            'created_by' => Auth::id(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Salary set successfully',
            'data' => $salary,
        ], 201);
    }

    public function giveAdvance(Request $request): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        $validator = Validator::make($request->all(), [
            'staff_id' => 'required|exists:staff,id',
            'amount' => 'required|numeric|min:0.01',
            'advance_date' => 'required|date',
            'reason' => 'nullable|string',
            'payment_method' => 'nullable|in:cash,online,check,bank_transfer',
            'reference_number' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $advance = SalaryAdvance::create([
            'staff_id' => $request->get('staff_id'),
            'amount' => $request->get('amount'),
            'amount_repaid' => 0,
            'advance_date' => $request->get('advance_date'),
            'status' => 'pending',
            'reason' => $request->get('reason'),
            'payment_method' => $request->get('payment_method') ?? 'bank_transfer',
            'reference_number' => $request->get('reference_number'),
            'created_by' => Auth::id(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Advance given successfully',
            'data' => $advance->load('staff'),
        ], 201);
    }

    public function repayAdvance(Request $request, SalaryAdvance $advance): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        $validator = Validator::make($request->all(), [
            'amount_repaid' => 'required|numeric|min:0.01',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $newTotal = $advance->amount_repaid + $request->get('amount_repaid');

        if ($newTotal > $advance->amount) {
            return response()->json([
                'success' => false,
                'message' => 'Repayment amount exceeds outstanding advance',
            ], 422);
        }

        // Determine new status
        if ($newTotal >= $advance->amount) {
            $status = 'repaid';
        } elseif ($newTotal > 0) {
            $status = 'partial';
        } else {
            $status = 'pending';
        }

        $advance->update([
            'amount_repaid' => $newTotal,
            'status' => $status,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Advance repayment recorded successfully',
            'data' => $advance->load('staff'),
        ]);
    }

    public function addBonus(Request $request, Staff $staff): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        $validator = Validator::make($request->all(), [
            'bonus_amount' => 'required|numeric|min:0.01',
            'reason' => 'nullable|string',
            'effective_date' => 'required|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $currentSalary = StaffSalary::where('staff_id', $staff->id)
            ->active()
            ->latest('effective_from')
            ->first();

        if (!$currentSalary) {
            return response()->json([
                'success' => false,
                'message' => 'No active salary record found for this staff',
            ], 422);
        }

        $newBonus = $currentSalary->current_bonus + $request->get('bonus_amount');
        $newTotal = $currentSalary->base_salary + $newBonus;

        $currentSalary->update([
            'current_bonus' => $newBonus,
            'total_compensation' => $newTotal,
        ]);

        SalaryHistory::create([
            'staff_id' => $staff->id,
            'old_salary' => $currentSalary->total_compensation,
            'new_salary' => $newTotal,
            'effective_date' => $request->get('effective_date'),
            'change_type' => 'bonus',
            'reason' => $request->get('reason'),
            'created_by' => Auth::id(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Bonus added successfully',
            'data' => $currentSalary,
        ]);
    }

    public function getAllStaffSalary(Request $request): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        $perPage = min(max((int) $request->get('per_page', 15), 1), 100);
        $query = Staff::with(['salary' => function ($q) {
            $q->where('status', 'active');
        }]);

        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where('full_name', 'like', '%' . $search . '%')
                ->orWhere('email', 'like', '%' . $search . '%');
        }

        if ($request->filled('department')) {
            $query->where('department', $request->get('department'));
        }

        $staff = $query->paginate($perPage);

        // Enhance with salary details
        $data = $staff->map(function ($s) {
            $activeSalary = $s->salary->first();
            $advances = SalaryAdvance::getTotalAdvancesPendingForStaff($s->id);

            return [
                'id' => $s->id,
                'full_name' => $s->full_name,
                'email' => $s->email,
                'department' => $s->department,
                'base_salary' => $activeSalary?->base_salary ?? 0,
                'bonus' => $activeSalary?->current_bonus ?? 0,
                'total_compensation' => $activeSalary?->total_compensation ?? 0,
                'total_advances_pending' => $advances,
                'status' => $s->status,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $data,
            'pagination' => [
                'current_page' => $staff->currentPage(),
                'last_page' => $staff->lastPage(),
                'total' => $staff->total(),
                'per_page' => $staff->perPage(),
            ],
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
