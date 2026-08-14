<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Candidate;
use App\Models\DaybookEntry;
use App\Models\DocumentPayment;
use App\Models\Payroll;
use App\Models\Staff;
use App\Models\TrainingEnrollment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class FinanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        $perPage = min(max((int) $request->get('per_page', 15), 1), 100);
        $query = Candidate::query()->with('creator:id,full_name,name,email');

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

        $candidates = $query->orderByDesc('id')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'candidates' => $candidates->items(),
                'summary' => $this->buildSummary(),
            ],
            'pagination' => [
                'current_page' => $candidates->currentPage(),
                'last_page' => $candidates->lastPage(),
                'per_page' => $candidates->perPage(),
                'total' => $candidates->total(),
            ],
        ]);
    }

    /**
     * Get training enrollments for Finance module
     */
    public function listTrainingEnrollments(Request $request): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        $perPage = min(max((int) $request->get('per_page', 15), 1), 100);
        $query = TrainingEnrollment::with('candidate:id,full_name,passport_number,email', 'training:id,name,category,daily_rate');

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

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $query->whereBetween('enrollment_date', [
                $request->get('start_date'),
                $request->get('end_date'),
            ]);
        }

        $enrollments = $query->orderByDesc('enrollment_date')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'enrollments' => $enrollments->items(),
                'summary' => $this->buildSummary(),
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
     * Update training enrollment payment
     */
    public function updateTrainingPayment(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
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
            'advance_payment_1' => 'nullable|numeric|min:0',
            'advance_payment_2' => 'nullable|numeric|min:0',
            'advance_payment_3' => 'nullable|numeric|min:0',
            'discount_amount' => 'nullable|numeric|min:0',
            'payment_reference' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'FINANCE_PAYMENT_VALIDATION_FAILED',
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
            'advance_payment_1' => $request->has('advance_payment_1') ? (float) $request->get('advance_payment_1') : $enrollment->advance_payment_1,
            'advance_payment_2' => $request->has('advance_payment_2') ? (float) $request->get('advance_payment_2') : $enrollment->advance_payment_2,
            'advance_payment_3' => $request->has('advance_payment_3') ? (float) $request->get('advance_payment_3') : $enrollment->advance_payment_3,
            'discount_amount' => $request->has('discount_amount') ? (float) $request->get('discount_amount') : $enrollment->discount_amount,
            'payment_status' => $enrollment->payment_status,
            'payment_reference' => $request->has('payment_reference') ? $request->get('payment_reference') : $enrollment->payment_reference,
        ]);

        $this->logActivity(
            $request,
            'Training Enrollment Payment Updated',
            'Finance',
            'Updated payment for training enrollment: ' . ($enrollment->candidate?->full_name ?? $enrollment->participant_name)
        );

        return response()->json([
            'success' => true,
            'message' => 'Training enrollment payment updated successfully',
            'data' => [
                'enrollment' => $enrollment->fresh()->load('candidate:id,full_name,passport_number,email', 'training:id,name,category,daily_rate'),
                'summary' => $this->buildSummary(),
            ],
        ]);
    }

    public function updatePayment(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
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
            'paid_amount' => 'required|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'FINANCE_PAYMENT_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $oldAmount = (float) ($candidate->paid_amount ?? 0);
        $candidate->paid_amount = $request->get('paid_amount');
        $candidate->save();

        $this->logActivity(
            $request,
            'Candidate Payment Updated',
            'Finance',
            'Updated payment for candidate: ' . $candidate->full_name
        );

        $this->recordHistory(
            $request,
            $candidate->id,
            'payment_updated',
            'Candidate payment updated from ' . number_format($oldAmount, 2) . ' to ' . number_format((float) $candidate->paid_amount, 2),
            [
                'old_paid_amount' => $oldAmount,
                'new_paid_amount' => (float) $candidate->paid_amount,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Candidate payment updated successfully',
            'data' => [
                'candidate' => $candidate->fresh()->load('creator:id,full_name,name,email'),
                'summary' => $this->buildSummary(),
            ],
        ]);
    }

    /**
     * Get overall payment statistics including daybook entries
     */
    public function paymentStatistics(Request $request): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        $today = now()->toDateString();
        $thisMonth = now()->format('Y-m');

        // Candidate payments
        $totalCandidatePayments = (float) Candidate::sum('paid_amount');
        $paidCandidates = Candidate::where('paid_amount', '>', 0)->count();

        // Daybook receipts (today)
        $receiptsTodayTotal = (float) DaybookEntry::receipts()->byDate($today)->sum('amount');
        $receiptsTodayCount = DaybookEntry::receipts()->byDate($today)->count();

        // Daybook receipts by transaction type (today)
        $receiptsCashToday = (float) DaybookEntry::receipts()
            ->where('transaction_type', 'cash')
            ->byDate($today)
            ->sum('amount');
        $receiptsOnlineToday = (float) DaybookEntry::receipts()
            ->where('transaction_type', 'online')
            ->byDate($today)
            ->sum('amount');

        // Daybook payments (today)
        $paymentsTodayTotal = (float) DaybookEntry::payments()->byDate($today)->sum('amount');
        $paymentsTodayCount = DaybookEntry::payments()->byDate($today)->count();
        $payrollPaymentsTodayTotal = (float) DaybookEntry::payments()
            ->byDate($today)
            ->where('reference_number', 'like', 'PAYROLL:%')
            ->sum('amount');
        $payrollPaymentsTodayCount = DaybookEntry::payments()
            ->byDate($today)
            ->where('reference_number', 'like', 'PAYROLL:%')
            ->count();
        $miscExpensesTodayTotal = (float) DaybookEntry::payments()
            ->byDate($today)
            ->where('reference_number', 'like', 'MISC:%')
            ->sum('amount');
        $miscExpensesTodayCount = DaybookEntry::payments()
            ->byDate($today)
            ->where('reference_number', 'like', 'MISC:%')
            ->count();

        // Monthly totals
        $monthlyReceipts = (float) DaybookEntry::receipts()
            ->whereRaw("to_char(entry_date, 'YYYY-MM') = ?", [$thisMonth])
            ->sum('amount');
        $monthlyPayments = (float) DaybookEntry::payments()
            ->whereRaw("to_char(entry_date, 'YYYY-MM') = ?", [$thisMonth])
            ->sum('amount');
        $monthlyPayrollPayments = (float) DaybookEntry::payments()
            ->whereRaw("to_char(entry_date, 'YYYY-MM') = ?", [$thisMonth])
            ->where('reference_number', 'like', 'PAYROLL:%')
            ->sum('amount');
        $monthlyMiscExpenses = (float) DaybookEntry::payments()
            ->whereRaw("to_char(entry_date, 'YYYY-MM') = ?", [$thisMonth])
            ->where('reference_number', 'like', 'MISC:%')
            ->sum('amount');

        // Payment mode breakdown (today)
        $paymentModeBreakdown = DB::table('daybook_entries')
            ->where('type', 'receipt')
            ->whereDate('entry_date', $today)
            ->whereNull('deleted_at')
            ->groupBy('transaction_type')
            ->select('transaction_type', DB::raw('SUM(amount) as total'), DB::raw('COUNT(*) as count'))
            ->get()
            ->map(function ($item) {
                return [
                    'mode' => $item->transaction_type ?? 'N/A',
                    'total' => (float) $item->total,
                    'count' => (int) $item->count,
                ];
            })
            ->toArray();

        return response()->json([
            'success' => true,
            'data' => [
                'candidate_payments' => [
                    'total_collected' => round($totalCandidatePayments, 2),
                    'paid_candidates' => $paidCandidates,
                    'total_candidates' => Candidate::count(),
                ],
                'daily_receipts' => [
                    'total' => round($receiptsTodayTotal, 2),
                    'count' => $receiptsTodayCount,
                    'cash' => round($receiptsCashToday, 2),
                    'online' => round($receiptsOnlineToday, 2),
                ],
                'daily_payments' => [
                    'total' => round($paymentsTodayTotal, 2),
                    'count' => $paymentsTodayCount,
                ],
                'daily_payroll_payments' => [
                    'total' => round($payrollPaymentsTodayTotal, 2),
                    'count' => $payrollPaymentsTodayCount,
                ],
                'daily_misc_expenses' => [
                    'total' => round($miscExpensesTodayTotal, 2),
                    'count' => $miscExpensesTodayCount,
                ],
                'daily_balance' => round($receiptsTodayTotal - $paymentsTodayTotal, 2),
                'monthly_summary' => [
                    'receipts' => round($monthlyReceipts, 2),
                    'payments' => round($monthlyPayments, 2),
                    'payroll_payments' => round($monthlyPayrollPayments, 2),
                    'misc_expenses' => round($monthlyMiscExpenses, 2),
                    'balance' => round($monthlyReceipts - $monthlyPayments, 2),
                ],
                'payment_mode_breakdown' => $paymentModeBreakdown,
            ],
        ]);
    }

    private function buildSummary(): array
    {
        $totalCandidates = Candidate::count();
        $paidCandidates = Candidate::where('paid_amount', '>', 0)->count();
        $totalCollected = (float) Candidate::sum('paid_amount');

        // Training data
        $totalTrainingAmount = (float) TrainingEnrollment::sum('training_amount');
        $totalTrainingPaid = (float) TrainingEnrollment::sum('paid_amount');
        $totalTrainingEnrollments = TrainingEnrollment::count();
        $trainingPaidEnrollments = TrainingEnrollment::where('payment_status', 'paid')->count();

        // Document payment data
        $totalDocPayments = (float) DocumentPayment::sum('amount');
        $docPaymentCount = DocumentPayment::count();
        $docPaymentByCountry = DocumentPayment::select('country', DB::raw('SUM(amount) as total'), DB::raw('COUNT(*) as count'))
            ->groupBy('country')
            ->orderByDesc('total')
            ->limit(10)
            ->get()
            ->map(fn($r) => ['country' => $r->country, 'total' => round((float)$r->total, 2), 'count' => (int)$r->count])
            ->toArray();

        // Staff salary summary (from payroll records)
        $totalStaff = Staff::count();
        $payrollRecordCount = Payroll::count();
        $payrollTotalNet = (float) Payroll::sum('net_amount');
        $payrollTotalPaid = (float) Payroll::sum('amount_paid');
        $payrollTotalPending = (float) max(0, $payrollTotalNet - $payrollTotalPaid);
        $payrollPaidCount = Payroll::where('payment_status', 'paid')->count();
        $payrollPartialCount = Payroll::where('payment_status', 'partial')->count();
        $payrollPendingCount = Payroll::where('payment_status', 'pending')->count();

        return [
            'total_candidates' => $totalCandidates,
            'paid_candidates' => $paidCandidates,
            'unpaid_candidates' => max(0, $totalCandidates - $paidCandidates),
            'total_collected' => round($totalCollected, 2),
            'training_enrollments' => $totalTrainingEnrollments,
            'training_total_amount' => round($totalTrainingAmount, 2),
            'training_total_paid' => round($totalTrainingPaid, 2),
            'training_total_unpaid' => round($totalTrainingAmount - $totalTrainingPaid, 2),
            'training_paid_count' => $trainingPaidEnrollments,
            'doc_payment_total' => round($totalDocPayments, 2),
            'doc_payment_count' => $docPaymentCount,
            'doc_payment_by_country' => $docPaymentByCountry,
            'staff_count' => $totalStaff,
            'payroll_record_count' => $payrollRecordCount,
            'payroll_total_net' => round($payrollTotalNet, 2),
            'payroll_total_paid' => round($payrollTotalPaid, 2),
            'payroll_total_pending' => round($payrollTotalPending, 2),
            'payroll_paid_count' => $payrollPaidCount,
            'payroll_partial_count' => $payrollPartialCount,
            'payroll_pending_count' => $payrollPendingCount,
        ];
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
        if (!in_array($role, ['admin', 'finance_officer', 'account', 'superadmin', 'super_admin'], true)) {
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

    private function recordHistory(Request $request, int $candidateId, string $action, ?string $description = null, ?array $metadata = null): void
    {
        try {
            DB::table('candidate_histories')->insert([
                'candidate_id' => $candidateId,
                'user_id' => optional($request->user())->id,
                'action' => $action,
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
