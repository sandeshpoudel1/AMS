<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DaybookEntry;
use App\Models\Payroll;
use App\Models\Staff;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class PayrollController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        $perPage = min(max((int) $request->get('per_page', 15), 1), 100);
        $query = Payroll::query()
            ->with(['staff:id,full_name,email,position', 'createdBy:id,full_name,name'])
            ->orderByDesc('pay_period_start');

        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->whereHas('staff', function ($q) use ($search) {
                $q->where('full_name', 'like', '%' . $search . '%')
                    ->orWhere('email', 'like', '%' . $search . '%');
            });
        }

        if ($request->filled('payment_status')) {
            $query->where('payment_status', $request->get('payment_status'));
        }

        if ($request->filled('payment_method')) {
            $query->where('payment_method', $request->get('payment_method'));
        }

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $query->whereBetween('pay_period_start', [
                $request->get('start_date'),
                $request->get('end_date')
            ]);
        }

        $payroll = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $payroll->items(),
            'summary' => $this->buildSummary(),
            'pagination' => [
                'current_page' => $payroll->currentPage(),
                'last_page' => $payroll->lastPage(),
                'total' => $payroll->total(),
                'per_page' => $payroll->perPage(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        $validator = Validator::make($request->all(), [
            'staff_id' => 'required|exists:staff,id',
            'pay_period_start' => 'required|date',
            'pay_period_end' => 'required|date|after:pay_period_start',
            'base_salary' => 'required|numeric|min:0',
            'allowances' => 'nullable|numeric|min:0',
            'overtime_hours' => 'nullable|numeric|min:0',
            'overtime_rate' => 'nullable|numeric|min:0',
            'tax_deduction' => 'nullable|numeric|min:0',
            'insurance_deduction' => 'nullable|numeric|min:0',
            'other_deductions' => 'nullable|numeric|min:0',
            'payment_method' => 'required|in:cash,online,check,bank_transfer',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Check if payroll record already exists for this period
        $existing = Payroll::where('staff_id', $request->get('staff_id'))
            ->where('pay_period_start', $request->get('pay_period_start'))
            ->where('pay_period_end', $request->get('pay_period_end'))
            ->first();

        if ($existing) {
            return response()->json([
                'success' => false,
                'message' => 'Payroll record already exists for this period',
            ], 422);
        }

        $overtime_amount = ($request->get('overtime_hours') ?? 0) * ($request->get('overtime_rate') ?? 0);
        $gross_amount = $request->get('base_salary') + ($request->get('allowances') ?? 0) + $overtime_amount;
        $total_deductions = ($request->get('tax_deduction') ?? 0) + 
                          ($request->get('insurance_deduction') ?? 0) + 
                          ($request->get('other_deductions') ?? 0);
        $net_amount = $gross_amount - $total_deductions;

        $payroll = Payroll::create([
            'staff_id' => $request->get('staff_id'),
            'pay_period_start' => $request->get('pay_period_start'),
            'pay_period_end' => $request->get('pay_period_end'),
            'base_salary' => $request->get('base_salary'),
            'allowances' => $request->get('allowances') ?? 0,
            'overtime_hours' => $request->get('overtime_hours') ?? 0,
            'overtime_rate' => $request->get('overtime_rate') ?? 0,
            'overtime_amount' => $overtime_amount,
            'gross_amount' => $gross_amount,
            'tax_deduction' => $request->get('tax_deduction') ?? 0,
            'insurance_deduction' => $request->get('insurance_deduction') ?? 0,
            'other_deductions' => $request->get('other_deductions') ?? 0,
            'total_deductions' => $total_deductions,
            'net_amount' => $net_amount,
            'payment_status' => 'pending',
            'amount_paid' => 0,
            'payment_method' => $request->get('payment_method'),
            'notes' => $request->get('notes'),
            'created_by' => Auth::id(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Payroll record created',
            'data' => $payroll->load(['staff', 'createdBy']),
        ], 201);
    }

    public function show(Payroll $payroll): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess(request())) {
            return $authError;
        }

        return response()->json([
            'success' => true,
            'data' => $payroll->load(['staff', 'createdBy']),
        ]);
    }

    public function update(Request $request, Payroll $payroll): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        // Don't allow updating if already paid
        if ($payroll->payment_status === 'paid') {
            return response()->json([
                'success' => false,
                'message' => 'Cannot update payroll that is already fully paid',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'base_salary' => 'nullable|numeric|min:0',
            'allowances' => 'nullable|numeric|min:0',
            'overtime_hours' => 'nullable|numeric|min:0',
            'overtime_rate' => 'nullable|numeric|min:0',
            'tax_deduction' => 'nullable|numeric|min:0',
            'insurance_deduction' => 'nullable|numeric|min:0',
            'other_deductions' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Recalculate amounts
        $base_salary = $request->get('base_salary') ?? $payroll->base_salary;
        $allowances = $request->get('allowances') ?? $payroll->allowances;
        $overtime_hours = $request->get('overtime_hours') ?? $payroll->overtime_hours;
        $overtime_rate = $request->get('overtime_rate') ?? $payroll->overtime_rate;
        $overtime_amount = $overtime_hours * $overtime_rate;
        $gross_amount = $base_salary + $allowances + $overtime_amount;
        
        $tax_deduction = $request->get('tax_deduction') ?? $payroll->tax_deduction;
        $insurance_deduction = $request->get('insurance_deduction') ?? $payroll->insurance_deduction;
        $other_deductions = $request->get('other_deductions') ?? $payroll->other_deductions;
        $total_deductions = $tax_deduction + $insurance_deduction + $other_deductions;
        $net_amount = $gross_amount - $total_deductions;

        $payroll->update([
            'base_salary' => $base_salary,
            'allowances' => $allowances,
            'overtime_hours' => $overtime_hours,
            'overtime_rate' => $overtime_rate,
            'overtime_amount' => $overtime_amount,
            'gross_amount' => $gross_amount,
            'tax_deduction' => $tax_deduction,
            'insurance_deduction' => $insurance_deduction,
            'other_deductions' => $other_deductions,
            'total_deductions' => $total_deductions,
            'net_amount' => $net_amount,
            'notes' => $request->get('notes') ?? $payroll->notes,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Payroll record updated',
            'data' => $payroll->load(['staff', 'createdBy']),
        ]);
    }

    public function updatePayment(Request $request, Payroll $payroll): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        $validator = Validator::make($request->all(), [
            'amount_paid' => 'required|numeric|min:0',
            'payment_date' => 'nullable|date',
            'payment_reference' => 'nullable|string',
            'payment_method' => 'nullable|in:cash,online,check,bank_transfer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $amount_paid = $request->get('amount_paid');

        // Validate amount doesn't exceed net amount
        if ($amount_paid > $payroll->net_amount) {
            return response()->json([
                'success' => false,
                'message' => 'Payment amount cannot exceed net salary',
            ], 422);
        }

        // Determine payment status
        if ($amount_paid >= $payroll->net_amount) {
            $status = 'paid';
            $payment_date = $request->get('payment_date') ?? now()->toDateString();
        } elseif ($amount_paid > 0) {
            $status = 'partial';
            $payment_date = $request->get('payment_date') ?? now()->toDateString();
        } else {
            $status = 'pending';
            $payment_date = null;
        }

        DB::beginTransaction();
        try {
            $payroll->update([
                'amount_paid' => $amount_paid,
                'payment_status' => $status,
                'payment_date' => $payment_date,
                'payment_reference' => $request->get('payment_reference') ?? $payroll->payment_reference,
                'payment_method' => $request->get('payment_method') ?? $payroll->payment_method,
            ]);

            $this->syncPayrollToDaybook($request, $payroll->fresh(['staff']));
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to sync payroll payment to finance records.',
            ], 500);
        }

        return response()->json([
            'success' => true,
            'message' => 'Payment updated successfully',
            'data' => $payroll->load(['staff', 'createdBy']),
            'summary' => $this->buildSummary(),
        ]);
    }

    public function destroy(Payroll $payroll): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess(request())) {
            return $authError;
        }

        if ($payroll->payment_status === 'paid') {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete payroll that is already paid',
            ], 422);
        }

        $payroll->delete();

        return response()->json([
            'success' => true,
            'message' => 'Payroll record deleted',
        ]);
    }

    private function buildSummary(): array
    {
        $total_payroll = Payroll::sum('gross_amount');
        $total_deductions = Payroll::sum('total_deductions');
        $total_net = Payroll::sum('net_amount');
        $total_paid = Payroll::sum('amount_paid');
        $pending_payroll = Payroll::where('payment_status', 'pending')->sum('net_amount');
        $partial_payroll = Payroll::where('payment_status', 'partial')->sum('net_amount');
        $paid_count = Payroll::where('payment_status', 'paid')->count();

        return [
            'total_payroll' => $total_payroll,
            'total_deductions' => $total_deductions,
            'total_net' => $total_net,
            'total_paid' => $total_paid,
            'total_pending' => $total_payroll - $total_paid,
            'pending_payroll_count' => Payroll::where('payment_status', 'pending')->count(),
            'partial_payroll_count' => Payroll::where('payment_status', 'partial')->count(),
            'paid_count' => $paid_count,
        ];
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

    private function syncPayrollToDaybook(Request $request, Payroll $payroll): void
    {
        $reference = 'PAYROLL:' . $payroll->id;
        $existing = DaybookEntry::query()
            ->where('reference_number', $reference)
            ->where('type', 'payment')
            ->first();

        $amountPaid = (float) ($payroll->amount_paid ?? 0);

        if ($amountPaid <= 0) {
            if ($existing) {
                $existing->delete();
            }
            return;
        }

        $staffName = $payroll->staff?->full_name ?: ('Staff #' . $payroll->staff_id);
        $payload = [
            'entry_date' => $payroll->payment_date ?? now()->toDateString(),
            'type' => 'payment',
            'company_name' => 'Staff Payroll',
            'particulars' => 'Salary payment - ' . $staffName,
            'transaction_type' => in_array($payroll->payment_method, ['cash', 'online'], true) ? $payroll->payment_method : 'online',
            'sub_passport_number' => null,
            'amount' => $amountPaid,
            'description' => 'Payroll #' . $payroll->id . ' | Period: ' . optional($payroll->pay_period_start)->format('Y-m-d') . ' to ' . optional($payroll->pay_period_end)->format('Y-m-d'),
            'reference_number' => $reference,
            'created_by' => optional($request->user())->id,
        ];

        if ($existing) {
            $existing->update($payload);
            return;
        }

        DaybookEntry::create($payload);
    }
}
