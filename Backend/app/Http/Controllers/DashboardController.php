<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Candidate;
use App\Models\TrainingRegistration;
use App\Models\Deployment;
use App\Models\Daybook;
use App\Models\Staff;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index()
    {
        // Get current month and year
        $currentMonth = Carbon::now()->month;
        $currentYear = Carbon::now()->year;

        // Key Metrics
        $totalCandidates = Candidate::count();
        $activeCandidates = Candidate::whereNotIn('status', ['completed', 'rejected'])->count();
        $candidatesInTraining = Candidate::where('status', 'in_training')->count();
        $certifiedCandidates = Candidate::where('status', 'certified')->count();
        $deployedCandidates = Candidate::where('status', 'deployed')->count();

        // Training Metrics
        $totalTrainings = DB::table('training_registrations')->count();
        $ongoingTrainings = DB::table('training_registrations')->where('status', 'ongoing')->count();
        $completedTrainings = DB::table('training_registrations')->where('status', 'completed')->count();

        // Deployment Metrics
        $totalDeployments = Deployment::count();
        $pendingDeployments = Deployment::where('status', 'pending')->count();
        $visaProcessing = Deployment::where('status', 'visa_processing')->count();
        $deployed = Deployment::where('status', 'deployed')->count();

        // Financial Metrics (Current Month)
        $monthlyReceipts = DB::table('daybook')->where('type', 'receipt')
            ->whereMonth('transaction_date', $currentMonth)
            ->whereYear('transaction_date', $currentYear)
            ->sum('amount');

        $monthlyExpenses = DB::table('daybook')->where('type', 'expense')
            ->whereMonth('transaction_date', $currentMonth)
            ->whereYear('transaction_date', $currentYear)
            ->sum('amount');

        $monthlyProfit = $monthlyReceipts - $monthlyExpenses;

        // Staff Metrics
        $totalStaff = DB::table('staff')->where('status', 'active')->count();
        $totalUsers = \App\Models\User::count();

        // Recent Activities
        $recentCandidates = Candidate::with(['creator'])
            ->latest()
            ->limit(5)
            ->get();

        $recentDeployments = Deployment::with(['candidate', 'company'])
            ->latest()
            ->limit(5)
            ->get();

        // Chart Data: Monthly trends (last 6 months)
        $monthlyTrends = [];
        for ($i = 5; $i >= 0; $i--) {
            $month = Carbon::now()->subMonths($i);
            $monthlyTrends[] = [
                'month' => $month->format('M Y'),
                'candidates' => Candidate::whereMonth('created_at', $month->month)
                    ->whereYear('created_at', $month->year)
                    ->count(),
                'deployments' => Deployment::whereMonth('created_at', $month->month)
                    ->whereYear('created_at', $month->year)
                    ->count(),
            ];
        }

        // Chart Data: Candidate Status Distribution
        $statusDistribution = [
            'Registered' => Candidate::where('status', 'registered')->count(),
            'In Training' => Candidate::where('status', 'in_training')->count(),
            'Assessed' => Candidate::where('status', 'assessed')->count(),
            'Certified' => Candidate::where('status', 'certified')->count(),
            'Deployed' => Candidate::where('status', 'deployed')->count(),
            'Completed' => Candidate::where('status', 'completed')->count(),
            'Rejected' => Candidate::where('status', 'rejected')->count(),
        ];

        return view('admin.dashboard', compact(
            'totalCandidates',
            'activeCandidates',
            'candidatesInTraining',
            'certifiedCandidates',
            'deployedCandidates',
            'totalTrainings',
            'ongoingTrainings',
            'completedTrainings',
            'totalDeployments',
            'pendingDeployments',
            'visaProcessing',
            'deployed',
            'monthlyReceipts',
            'monthlyExpenses',
            'monthlyProfit',
            'totalStaff',
            'totalUsers',
            'recentCandidates',
            'recentDeployments',
            'monthlyTrends',
            'statusDistribution'
        ));
    }
}
