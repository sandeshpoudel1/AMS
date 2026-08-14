<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DashboardController extends Controller
{
    public function stats(Request $request)
    {
        return response()->json([
            'success' => true,
            'data' => [
                'users' => $this->getUserStats(),
                'candidates' => $this->getCandidateStats(),
                'trainings' => $this->getTrainingStats(),
                'assessments' => $this->getAssessmentStats(),
                'deployments' => $this->getDeploymentStats(),
                'certificates' => $this->getCertificateStats(),
                'financials' => $this->getFinancialStats(),
                'recent_activities' => $this->getRecentActivities(),
                'charts' => $this->getChartsData(),
                'quick_stats' => $this->getQuickStats(),
            ],
        ]);
    }

    public function activities(Request $request)
    {
        $perPage = (int) ($request->per_page ?? 15);

        if (!Schema::hasTable('activity_logs')) {
            return response()->json([
                'success' => true,
                'data' => [],
                'pagination' => [
                    'current_page' => 1,
                    'last_page' => 1,
                    'per_page' => $perPage,
                    'total' => 0,
                ],
            ]);
        }

        $query = DB::table('activity_logs as a')
            ->leftJoin('users as u', 'u.id', '=', 'a.user_id')
            ->select([
                'a.id',
                'a.user_id',
                'a.action',
                'a.module',
                'a.description',
                'a.ip_address',
                'a.created_at',
                'u.full_name as user_full_name',
                'u.name as user_name',
                'u.email as user_email',
            ]);

        if ($request->filled('module')) {
            $query->where('a.module', $request->module);
        }

        if ($request->filled('action')) {
            $query->where('a.action', $request->action);
        }

        if ($request->filled('search')) {
            $query->where('a.description', 'like', '%' . $request->search . '%');
        }

        $activities = $query->orderByDesc('a.created_at')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => collect($activities->items())->map(function ($log) {
                $createdAt = $log->created_at ? Carbon::parse($log->created_at) : null;

                return [
                    'id' => $log->id,
                    'user' => $log->user_id ? [
                        'id' => $log->user_id,
                        'name' => $log->user_full_name ?? $log->user_name,
                        'email' => $log->user_email,
                    ] : null,
                    'action' => $log->action,
                    'module' => $log->module,
                    'description' => $log->description,
                    'ip_address' => $log->ip_address,
                    'created_at' => $createdAt ? $createdAt->format('Y-m-d H:i:s') : null,
                    'time_ago' => $createdAt ? $createdAt->diffForHumans() : null,
                ];
            }),
            'pagination' => [
                'current_page' => $activities->currentPage(),
                'last_page' => $activities->lastPage(),
                'per_page' => $activities->perPage(),
                'total' => $activities->total(),
            ],
        ]);
    }

    public function candidateStatus(Request $request)
    {
        if (!Schema::hasTable('candidates')) {
            return response()->json(['success' => true, 'data' => []]);
        }

        $total = DB::table('candidates')->count();

        $statuses = DB::table('candidates')
            ->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->get()
            ->map(function ($item) use ($total) {
                return [
                    'status' => $item->status,
                    'status_label' => ucwords(str_replace('_', ' ', (string) $item->status)),
                    'count' => (int) $item->count,
                    'percentage' => $total > 0 ? round(($item->count / $total) * 100, 2) : 0,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $statuses,
        ]);
    }

    public function monthlyTrends(Request $request)
    {
        $months = max(1, (int) ($request->months ?? 6));
        $startDate = Carbon::now()->subMonths($months - 1)->startOfMonth();

        $trends = collect(range(0, $months - 1))->map(function ($i) use ($startDate) {
            $date = $startDate->copy()->addMonths($i);
            $year = $date->year;
            $month = $date->month;

            return [
                'month' => $date->format('M Y'),
                'candidates_registered' => $this->countByMonth('candidates', 'created_at', $year, $month),
                'trainings_conducted' => $this->countByMonth('trainings', 'start_date', $year, $month),
                'assessments_done' => $this->countByMonth('assessments', 'assessment_date', $year, $month),
                'deployments' => $this->countByMonth('deployments', 'deployment_date', $year, $month),
                'certificates_issued' => $this->countByMonth('certificates', 'issue_date', $year, $month),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $trends,
        ]);
    }

    public function topPerformers(Request $request)
    {
        $limit = max(1, (int) ($request->limit ?? 10));

        if (!Schema::hasTable('candidates')) {
            return response()->json(['success' => true, 'data' => []]);
        }

        $query = DB::table('candidates')->limit($limit);

        if (Schema::hasColumn('candidates', 'created_at')) {
            $query->orderByDesc('created_at');
        }

        $topCandidates = $query->get()->map(function ($candidate) {
            $name = $candidate->full_name ?? $candidate->name ?? null;
            $status = $candidate->status ?? null;

            return [
                'id' => $candidate->id,
                'name' => $name,
                'passport' => $candidate->passport_number ?? null,
                'passed_assessments' => 0,
                'status' => $status,
                'status_label' => $status ? ucwords(str_replace('_', ' ', (string) $status)) : null,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $topCandidates,
        ]);
    }

    public function health()
    {
        try {
            DB::connection()->getPdo();
            $dbStatus = 'connected';
        } catch (\Throwable $e) {
            $dbStatus = 'disconnected';
        }

        return response()->json([
            'success' => true,
            'data' => [
                'database' => $dbStatus,
                'storage' => is_dir(storage_path()) ? 'accessible' : 'inaccessible',
                'cache' => cache()->get('health_check', 'working'),
                'timestamp' => Carbon::now()->toIso8601String(),
                'version' => [
                    'php' => phpversion(),
                    'laravel' => app()->version(),
                ],
                'environment' => app()->environment(),
                'debug_mode' => config('app.debug'),
            ],
        ]);
    }

    private function getUserStats(): array
    {
        if (!Schema::hasTable('users')) {
            return [
                'total' => 0,
                'active' => 0,
                'inactive' => 0,
                'by_role' => [],
                'new_this_month' => 0,
                'new_this_week' => 0,
            ];
        }

        $total = DB::table('users')->count();
        $active = Schema::hasColumn('users', 'is_active')
            ? DB::table('users')->where('is_active', true)->count()
            : 0;

        $byRole = Schema::hasColumn('users', 'role')
            ? DB::table('users')
                ->select('role', DB::raw('count(*) as count'))
                ->groupBy('role')
                ->get()
                ->map(function ($item) {
                    return [
                        'role' => $item->role,
                        'role_label' => ucwords(str_replace('_', ' ', (string) $item->role)),
                        'count' => (int) $item->count,
                    ];
                })
            : collect();

        return [
            'total' => $total,
            'active' => $active,
            'inactive' => max(0, $total - $active),
            'by_role' => $byRole,
            'new_this_month' => $this->countByMonth('users', 'created_at', Carbon::now()->year, Carbon::now()->month),
            'new_this_week' => $this->countBetween('users', 'created_at', Carbon::now()->startOfWeek(), Carbon::now()->endOfWeek()),
        ];
    }

    private function getCandidateStats(): array
    {
        return [
            'total' => $this->safeCount('candidates'),
            'by_status' => $this->groupCount('candidates', 'status', true),
            'new_this_month' => $this->countByMonth('candidates', 'created_at', Carbon::now()->year, Carbon::now()->month),
            'new_this_week' => $this->countBetween('candidates', 'created_at', Carbon::now()->startOfWeek(), Carbon::now()->endOfWeek()),
            'registered' => $this->safeCountWhere('candidates', 'status', 'registered'),
            'training' => $this->safeCountWhere('candidates', 'status', 'training'),
            'certified' => $this->safeCountWhere('candidates', 'status', 'certified'),
            'deployed' => $this->safeCountWhere('candidates', 'status', 'deployed'),
            'rejected' => $this->safeCountWhere('candidates', 'status', 'rejected'),
            'gender_distribution' => $this->groupCount('candidates', 'gender', false),
            'top_nationalities' => $this->groupCount('candidates', 'nationality', false, 5),
        ];
    }

    private function getTrainingStats(): array
    {
        return [
            'total' => $this->safeCount('trainings'),
            'by_status' => $this->groupCount('trainings', 'status', false),
            'by_type' => $this->groupCount('trainings', 'type', false),
            'upcoming' => $this->safeCountWhere('trainings', 'status', 'upcoming'),
            'ongoing' => $this->safeCountWhere('trainings', 'status', 'ongoing'),
            'completed' => $this->safeCountWhere('trainings', 'status', 'completed'),
            'cancelled' => $this->safeCountWhere('trainings', 'status', 'cancelled'),
            'total_enrollments' => $this->safeCount('candidate_trainings'),
            'completion_rate' => $this->calculateTrainingCompletionRate(),
        ];
    }

    private function getAssessmentStats(): array
    {
        return [
            'total' => $this->safeCount('assessments'),
            'by_status' => $this->groupCount('assessments', 'status', false),
            'by_type' => $this->groupCount('assessments', 'type', false),
            'passed' => $this->safeCountWhere('assessments', 'status', 'passed'),
            'failed' => $this->safeCountWhere('assessments', 'status', 'failed'),
            'pending' => $this->safeCountWhere('assessments', 'status', 'pending'),
            'reassessment' => $this->safeCountWhere('assessments', 'status', 'reassessment'),
            'pass_rate' => $this->calculatePassRate(),
            'average_score' => $this->averageColumn('assessments', 'percentage'),
            'this_month' => $this->countByMonth('assessments', 'created_at', Carbon::now()->year, Carbon::now()->month),
        ];
    }

    private function getDeploymentStats(): array
    {
        return [
            'total' => $this->safeCount('deployments'),
            'by_status' => $this->groupCount('deployments', 'status', true),
            'deployed' => $this->safeCountWhere('deployments', 'status', 'deployed'),
            'pending' => $this->safeCountWhere('deployments', 'status', 'pending'),
            'visa_processing' => $this->safeCountWhere('deployments', 'status', 'visa_processing'),
            'visa_approved' => $this->safeCountWhere('deployments', 'status', 'visa_approved'),
            'this_month' => $this->countByMonth('deployments', 'deployment_date', Carbon::now()->year, Carbon::now()->month),
            'top_destinations' => $this->groupCount('deployments', 'destination_country', false, 5),
            'top_companies' => $this->groupCount('deployments', 'company_name', false, 5),
        ];
    }

    private function getCertificateStats(): array
    {
        $expiringSoon = 0;

        if (Schema::hasTable('certificates') && Schema::hasColumn('certificates', 'expiry_date')) {
            $expiringSoon = DB::table('certificates')
                ->where('expiry_date', '<=', Carbon::now()->addMonths(3))
                ->where('status', 'active')
                ->count();
        }

        return [
            'total' => $this->safeCount('certificates'),
            'active' => $this->safeCountWhere('certificates', 'status', 'active'),
            'expired' => $this->safeCountWhere('certificates', 'status', 'expired'),
            'revoked' => $this->safeCountWhere('certificates', 'status', 'revoked'),
            'by_type' => $this->groupCount('certificates', 'type', false),
            'expiring_soon' => $expiringSoon,
            'this_month' => $this->countByMonth('certificates', 'issue_date', Carbon::now()->year, Carbon::now()->month),
        ];
    }

    private function getFinancialStats(): array
    {
        return [
            'total_income' => 0,
            'total_expenses' => 0,
            'net_profit' => 0,
            'pending_invoices' => 0,
            'overdue_payments' => 0,
        ];
    }

    private function getRecentActivities()
    {
        if (!Schema::hasTable('activity_logs')) {
            return [];
        }

        return DB::table('activity_logs as a')
            ->leftJoin('users as u', 'u.id', '=', 'a.user_id')
            ->select([
                'a.id',
                'a.action',
                'a.module',
                'a.description',
                'a.created_at',
                'u.id as user_id',
                'u.full_name as user_full_name',
                'u.name as user_name',
                'u.email as user_email',
            ])
            ->orderByDesc('a.created_at')
            ->limit(10)
            ->get()
            ->map(function ($log) {
                $createdAt = $log->created_at ? Carbon::parse($log->created_at) : null;

                return [
                    'id' => $log->id,
                    'user' => $log->user_id ? [
                        'id' => $log->user_id,
                        'name' => $log->user_full_name ?? $log->user_name,
                        'email' => $log->user_email,
                    ] : null,
                    'action' => $log->action,
                    'module' => $log->module,
                    'description' => $log->description,
                    'created_at' => $createdAt ? $createdAt->format('Y-m-d H:i:s') : null,
                    'time_ago' => $createdAt ? $createdAt->diffForHumans() : null,
                ];
            });
    }

    private function getChartsData(): array
    {
        $months = collect(range(0, 5))->map(function ($i) {
            return Carbon::now()->subMonths($i)->format('M');
        })->reverse()->values();

        $candidateRegistrations = collect(range(0, 5))->map(function ($i) {
            $date = Carbon::now()->subMonths($i);
            return $this->countByMonth('candidates', 'created_at', $date->year, $date->month);
        })->reverse()->values();

        $trainingEnrollments = collect(range(0, 5))->map(function ($i) {
            $date = Carbon::now()->subMonths($i);
            return $this->countByMonth('candidate_trainings', 'created_at', $date->year, $date->month);
        })->reverse()->values();

        $deployments = collect(range(0, 5))->map(function ($i) {
            $date = Carbon::now()->subMonths($i);
            return $this->countByMonth('deployments', 'deployment_date', $date->year, $date->month);
        })->reverse()->values();

        return [
            'months' => $months,
            'candidate_registrations' => $candidateRegistrations,
            'training_enrollments' => $trainingEnrollments,
            'deployments' => $deployments,
            'candidate_status_distribution' => [
                'labels' => ['Registered', 'In Training', 'Certified', 'Deployed', 'Rejected'],
                'data' => [
                    $this->safeCountWhere('candidates', 'status', 'registered'),
                    $this->safeCountWhere('candidates', 'status', 'training'),
                    $this->safeCountWhere('candidates', 'status', 'certified'),
                    $this->safeCountWhere('candidates', 'status', 'deployed'),
                    $this->safeCountWhere('candidates', 'status', 'rejected'),
                ],
                'colors' => ['#6366f1', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'],
            ],
            'assessment_results' => [
                'labels' => ['Passed', 'Failed', 'Pending', 'Reassessment'],
                'data' => [
                    $this->safeCountWhere('assessments', 'status', 'passed'),
                    $this->safeCountWhere('assessments', 'status', 'failed'),
                    $this->safeCountWhere('assessments', 'status', 'pending'),
                    $this->safeCountWhere('assessments', 'status', 'reassessment'),
                ],
                'colors' => ['#10b981', '#ef4444', '#f59e0b', '#6366f1'],
            ],
            'training_types' => [
                'labels' => ['Induction', 'Technical', 'Language', 'Safety', 'Certification'],
                'data' => [
                    $this->safeCountWhere('trainings', 'type', 'induction'),
                    $this->safeCountWhere('trainings', 'type', 'technical'),
                    $this->safeCountWhere('trainings', 'type', 'language'),
                    $this->safeCountWhere('trainings', 'type', 'safety'),
                    $this->safeCountWhere('trainings', 'type', 'certification'),
                ],
                'colors' => ['#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b'],
            ],
        ];
    }

    private function getQuickStats(): array
    {
        return [
            'total_candidates' => $this->safeCount('candidates'),
            'candidates_in_training' => $this->safeCountWhere('candidates', 'status', 'training'),
            'total_deployments' => $this->safeCountWhere('deployments', 'status', 'deployed'),
            'total_trainings' => $this->safeCountWhere('trainings', 'status', 'ongoing'),
            'pass_rate' => $this->calculatePassRate() . '%',
            'total_certificates' => $this->safeCountWhere('certificates', 'status', 'active'),
            'recent_activities' => $this->safeCount('activity_logs'),
            'last_30_days' => [
                'new_candidates' => $this->countAfter('candidates', 'created_at', Carbon::now()->subDays(30)),
                'new_trainings' => $this->countAfter('trainings', 'created_at', Carbon::now()->subDays(30)),
                'new_deployments' => $this->countAfter('deployments', 'created_at', Carbon::now()->subDays(30)),
                'new_certificates' => $this->countAfter('certificates', 'created_at', Carbon::now()->subDays(30)),
            ],
        ];
    }

    private function calculateTrainingCompletionRate(): float
    {
        $total = $this->safeCount('candidate_trainings');
        $completed = $this->safeCountWhere('candidate_trainings', 'status', 'completed');

        return $total > 0 ? round(($completed / $total) * 100, 2) : 0;
    }

    private function calculatePassRate(): float
    {
        $total = $this->safeCount('assessments');
        $passed = $this->safeCountWhere('assessments', 'status', 'passed');

        return $total > 0 ? round(($passed / $total) * 100, 2) : 0;
    }

    private function safeCount(string $table): int
    {
        if (!Schema::hasTable($table)) {
            return 0;
        }

        return DB::table($table)->count();
    }

    private function safeCountWhere(string $table, string $column, $value): int
    {
        if (!Schema::hasTable($table) || !Schema::hasColumn($table, $column)) {
            return 0;
        }

        return DB::table($table)->where($column, $value)->count();
    }

    private function countByMonth(string $table, string $dateColumn, int $year, int $month): int
    {
        if (!Schema::hasTable($table) || !Schema::hasColumn($table, $dateColumn)) {
            return 0;
        }

        return DB::table($table)
            ->whereYear($dateColumn, $year)
            ->whereMonth($dateColumn, $month)
            ->count();
    }

    private function countBetween(string $table, string $dateColumn, Carbon $start, Carbon $end): int
    {
        if (!Schema::hasTable($table) || !Schema::hasColumn($table, $dateColumn)) {
            return 0;
        }

        return DB::table($table)
            ->whereBetween($dateColumn, [$start, $end])
            ->count();
    }

    private function countAfter(string $table, string $dateColumn, Carbon $date): int
    {
        if (!Schema::hasTable($table) || !Schema::hasColumn($table, $dateColumn)) {
            return 0;
        }

        return DB::table($table)
            ->where($dateColumn, '>=', $date)
            ->count();
    }

    private function averageColumn(string $table, string $column): float
    {
        if (!Schema::hasTable($table) || !Schema::hasColumn($table, $column)) {
            return 0;
        }

        return (float) (DB::table($table)->whereNotNull($column)->avg($column) ?? 0);
    }

    private function groupCount(string $table, string $column, bool $humanizeLabel = false, int $limit = 0)
    {
        if (!Schema::hasTable($table) || !Schema::hasColumn($table, $column)) {
            return collect();
        }

        $query = DB::table($table)
            ->select($column, DB::raw('count(*) as count'))
            ->whereNotNull($column)
            ->groupBy($column)
            ->orderBy('count', 'desc');

        if ($limit > 0) {
            $query->limit($limit);
        }

        return $query->get()->map(function ($item) use ($column, $humanizeLabel) {
            $value = $item->{$column};

            $result = [
                $column => $value,
                'count' => (int) $item->count,
            ];

            if ($humanizeLabel) {
                $result[$column . '_label'] = ucwords(str_replace('_', ' ', (string) $value));
            }

            return $result;
        });
    }
}
