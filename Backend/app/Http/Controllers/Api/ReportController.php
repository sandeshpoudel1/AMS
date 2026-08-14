<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Candidate;
use App\Models\DaybookEntry;
use App\Models\Payroll;
use App\Models\Staff;
use App\Models\Training;
use App\Models\TrainingEnrollment;
use App\Models\VisaPipelineEntry;
use Carbon\Carbon;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function overall(Request $request): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        // Daybook income/expenses
        $totalIncome = (float) DaybookEntry::receipts()->sum('amount');
        $totalDaybookPayments = (float) DaybookEntry::payments()->sum('amount');
        $totalDaybookSalaryPayments = (float) DaybookEntry::payments()
            ->whereRaw("LOWER(COALESCE(description, '')) LIKE ?", ['%salary payment%'])
            ->sum('amount');
        $totalDaybookCompanyPayments = (float) DaybookEntry::payments()
            ->whereRaw("LOWER(COALESCE(description, '')) LIKE ?", ['%company payment%'])
            ->sum('amount');
        $totalDaybookOtherPayments = max($totalDaybookPayments - $totalDaybookSalaryPayments - $totalDaybookCompanyPayments, 0);
        
        // Training revenue
        $totalTrainingFees = (float) TrainingEnrollment::sum('training_amount');
        $totalTrainingPaid = (float) TrainingEnrollment::sum('paid_amount');
        $totalTrainingDue = $totalTrainingFees - $totalTrainingPaid;

        // Visa pipeline revenue
        $totalVisaFees = (float) VisaPipelineEntry::sum('total_fee');
        $totalVisaAdvances = (float) VisaPipelineEntry::sum(DB::raw('advance_1 + advance_2 + advance_3'));
        $totalVisaDue = $totalVisaFees - $totalVisaAdvances;
        $totalVisaExpenses = (float) VisaPipelineEntry::sum(DB::raw('
            ticket_expenses + admin_expenses + other_topic_expense + 
            skill_verification_payment + pcc_attestation_charge + 
            typing_stamping_charge + demand_attestation_mofa_chamber_fee + 
            translation_color_print_documentation + final_approval_fee_shram + 
            visa_stamping_ksa + commission_npr'
        ));

        // Candidate direct payments
        $totalCandidatePayments = (float) Candidate::sum('paid_amount');

        // Payroll
        $totalPayrollPaid = (float) Payroll::sum('amount_paid');
        $totalPayrollNet = (float) Payroll::sum('net_amount');

        // Calculate total revenue and expenses
        $totalRevenue = $totalIncome + $totalTrainingPaid + $totalVisaAdvances + $totalCandidatePayments;
        $totalExpenses = $totalDaybookPayments + $totalPayrollPaid + $totalVisaExpenses;
        $profitLoss = $totalRevenue - $totalExpenses;

        // Training summary
        $trainingByStatus = TrainingEnrollment::query()
            ->selectRaw('payment_status, COUNT(*) as total, SUM(training_amount) as total_fees, SUM(paid_amount) as total_paid')
            ->groupBy('payment_status')
            ->get()
            ->map(fn ($row) => [
                'status' => $row->payment_status,
                'count' => (int) $row->total,
                'fees' => round($row->total_fees, 2),
                'paid' => round($row->total_paid, 2),
            ])
            ->toArray();

        // Visa pipeline summary by payment status
        $visaByStatus = VisaPipelineEntry::query()
            ->selectRaw('
                CASE 
                    WHEN (advance_1 + advance_2 + advance_3) >= total_fee THEN \'paid\'
                    WHEN (advance_1 + advance_2 + advance_3) > 0 THEN \'partial\'
                    ELSE \'unpaid\'
                END as payment_status,
                COUNT(*) as total,
                SUM(total_fee) as total_fees,
                SUM(advance_1 + advance_2 + advance_3) as total_received
            ')
            ->groupByRaw('
                CASE 
                    WHEN (advance_1 + advance_2 + advance_3) >= total_fee THEN \'paid\'
                    WHEN (advance_1 + advance_2 + advance_3) > 0 THEN \'partial\'
                    ELSE \'unpaid\'
                END
            ')
            ->get()
            ->map(fn ($row) => [
                'status' => $row->payment_status,
                'count' => (int) $row->total,
                'fees' => round($row->total_fees, 2),
                'received' => round($row->total_received, 2),
            ])
            ->toArray();

        // Candidate summary
        $totalCandidates = Candidate::count();
        $candidatesWithFees = Candidate::where('paid_amount', '>', 0)->count();
        $candidatesPending = $totalCandidates - $candidatesWithFees;

        $staffByStatus = Staff::query()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->get()
            ->map(fn ($row) => [
                'status' => $row->status,
                'total' => (int) $row->total,
            ])
            ->toArray();

        $payrollByStatus = Payroll::query()
            ->selectRaw('payment_status, COUNT(*) as total')
            ->groupBy('payment_status')
            ->get()
            ->map(fn ($row) => [
                'status' => $row->payment_status,
                'total' => (int) $row->total,
            ])
            ->toArray();

        $monthly = [];
        for ($i = 5; $i >= 0; $i--) {
            $date = Carbon::now()->subMonths($i);
            $year = (int) $date->format('Y');
            $month = (int) $date->format('m');

            $monthIncome = (float) DaybookEntry::receipts()
                ->whereYear('entry_date', $year)
                ->whereMonth('entry_date', $month)
                ->sum('amount');

            $monthDaybookExpense = (float) DaybookEntry::payments()
                ->whereYear('entry_date', $year)
                ->whereMonth('entry_date', $month)
                ->sum('amount');

            $monthPayrollPaid = (float) Payroll::whereYear('payment_date', $year)
                ->whereMonth('payment_date', $month)
                ->sum('amount_paid');

            $monthExpense = $monthDaybookExpense + $monthPayrollPaid;

            $monthly[] = [
                'label' => $date->format('M Y'),
                'income' => round($monthIncome, 2),
                'expense' => round($monthExpense, 2),
                'profit_loss' => round($monthIncome - $monthExpense, 2),
            ];
        }

        $now = Carbon::now();
        $dailyReport = $this->calculatePeriodReport($now->copy()->startOfDay(), $now->copy()->endOfDay(), 'Today');
        $weeklyReport = $this->calculatePeriodReport($now->copy()->startOfWeek(), $now->copy()->endOfWeek(), 'This Week');
        $monthlyReport = $this->calculatePeriodReport($now->copy()->startOfMonth(), $now->copy()->endOfMonth(), 'This Month');
        $yearlyReport = $this->calculatePeriodReport($now->copy()->startOfYear(), $now->copy()->endOfYear(), 'This Year');

        return response()->json([
            'success' => true,
            'data' => [
                'overview' => [
                    'total_revenue' => round($totalRevenue, 2),
                    'total_expenses' => round($totalExpenses, 2),
                    'total_profit_loss' => round($profitLoss, 2),
                ],
                'revenue_summary' => [
                    'daybook_income' => round($totalIncome, 2),
                    'daybook_salary_payments' => round($totalDaybookSalaryPayments, 2),
                    'daybook_company_payments' => round($totalDaybookCompanyPayments, 2),
                    'daybook_other_payments' => round($totalDaybookOtherPayments, 2),
                    'daybook_total_payments' => round($totalDaybookPayments, 2),
                    'training_fees_paid' => round($totalTrainingPaid, 2),
                    'visa_advances' => round($totalVisaAdvances, 2),
                    'candidate_payments' => round($totalCandidatePayments, 2),
                ],
                'daybook_summary' => [
                    'total_receipts' => round($totalIncome, 2),
                    'total_salary_payments' => round($totalDaybookSalaryPayments, 2),
                    'total_company_payments' => round($totalDaybookCompanyPayments, 2),
                    'total_other_payments' => round($totalDaybookOtherPayments, 2),
                    'total_payments' => round($totalDaybookPayments, 2),
                    'net_balance' => round($totalIncome - $totalDaybookPayments, 2),
                ],
                'candidate_summary' => [
                    'total_candidates' => $totalCandidates,
                    'with_payments' => $candidatesWithFees,
                    'pending_payment' => $candidatesPending,
                    'total_paid' => round($totalCandidatePayments, 2),
                ],
                'training_summary' => [
                    'total_programs' => Training::count(),
                    'total_enrollments' => TrainingEnrollment::count(),
                    'total_fees' => round($totalTrainingFees, 2),
                    'total_paid' => round($totalTrainingPaid, 2),
                    'total_due' => round($totalTrainingDue, 2),
                    'by_status' => $trainingByStatus,
                ],
                'visa_summary' => [
                    'total_entries' => VisaPipelineEntry::count(),
                    'total_visa_fees' => round($totalVisaFees, 2),
                    'total_advances_received' => round($totalVisaAdvances, 2),
                    'total_visa_due' => round($totalVisaDue, 2),
                    'total_visa_expenses' => round($totalVisaExpenses, 2),
                    'by_status' => $visaByStatus,
                ],
                'payroll_summary' => [
                    'total_net_salary' => round($totalPayrollNet, 2),
                    'total_paid' => round($totalPayrollPaid, 2),
                    'total_pending' => round($totalPayrollNet - $totalPayrollPaid, 2),
                    'by_status' => $payrollByStatus,
                ],
                'staff_summary' => [
                    'total_staff' => Staff::count(),
                    'active_staff' => Staff::where('status', 'active')->count(),
                    'by_status' => $staffByStatus,
                ],
                'period_reports' => [
                    'daily' => $dailyReport,
                    'weekly' => $weeklyReport,
                    'monthly' => $monthlyReport,
                    'yearly' => $yearlyReport,
                ],
                'monthly_profit_loss' => $monthly,
            ],
        ]);
    }

    private function calculatePeriodReport(Carbon $startDate, Carbon $endDate, string $label): array
    {
        $income = (float) DaybookEntry::receipts()
            ->whereDate('entry_date', '>=', $startDate->toDateString())
            ->whereDate('entry_date', '<=', $endDate->toDateString())
            ->sum('amount');

        $salaryPayments = (float) DaybookEntry::payments()
            ->whereDate('entry_date', '>=', $startDate->toDateString())
            ->whereDate('entry_date', '<=', $endDate->toDateString())
            ->whereRaw("LOWER(COALESCE(description, '')) LIKE ?", ['%salary payment%'])
            ->sum('amount');

        $companyPayments = (float) DaybookEntry::payments()
            ->whereDate('entry_date', '>=', $startDate->toDateString())
            ->whereDate('entry_date', '<=', $endDate->toDateString())
            ->whereRaw("LOWER(COALESCE(description, '')) LIKE ?", ['%company payment%'])
            ->sum('amount');

        $daybookExpenses = (float) DaybookEntry::payments()
            ->whereDate('entry_date', '>=', $startDate->toDateString())
            ->whereDate('entry_date', '<=', $endDate->toDateString())
            ->sum('amount');

        $payrollPaid = (float) Payroll::query()
            ->whereDate('payment_date', '>=', $startDate->toDateString())
            ->whereDate('payment_date', '<=', $endDate->toDateString())
            ->sum('amount_paid');

        $expenses = $daybookExpenses + $payrollPaid;

        return [
            'label' => $label,
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
            'total_income' => round($income, 2),
            'total_expenses' => round($expenses, 2),
            'profit_loss' => round($income - $expenses, 2),
            'daybook_expenses' => round($daybookExpenses, 2),
            'daybook_salary_payments' => round($salaryPayments, 2),
            'daybook_company_payments' => round($companyPayments, 2),
            'payroll_paid' => round($payrollPaid, 2),
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
                'message' => 'You do not have access to reports.',
            ], 403);
        }

        return null;
    }
}
