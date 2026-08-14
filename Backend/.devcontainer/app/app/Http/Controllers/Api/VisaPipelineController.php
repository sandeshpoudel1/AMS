<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProjectSetting;
use App\Models\VisaPipelineEntry;
use App\Models\Candidate;
use App\Models\DaybookEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

class VisaPipelineController extends Controller
{
    /**
     * Ensure numeric columns never receive null for DB NOT NULL fields.
     */
    private function normalizeNumericFields(array $data): array
    {
        $numericFields = [
            'visa_charge',
            'ticket_charge',
            'fla_charge',
            'svp_charge',
            'vfs_charge',
            'qvc_charge',
            'service_charge',
            'additional_charge',
            'total_fee',
            'office_rate',
            'advance_1',
            'advance_2',
            'advance_3',
        ];

        foreach ($numericFields as $field) {
            if (!array_key_exists($field, $data) || $data[$field] === null || $data[$field] === '') {
                $data[$field] = 0;
            }
        }

        return $data;
    }

    private function ensureAccess(Request $request): ?JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        }
        $allowed = ['admin', 'superadmin', 'super_admin', 'candidate_officer', 'finance_officer', 'documentation', 'documentation_head', 'account'];
        if (!in_array($user->role, $allowed, true)) {
            return response()->json(['success' => false, 'message' => 'Forbidden'], 403);
        }
        return null;
    }

    private function getVisaPipelineTable(): string
    {
        static $table = null;

        if ($table === null) {
            $table = Schema::hasTable('candidate_flown_entries')
                ? 'candidate_flown_entries'
                : 'visa_pipeline_entries';
        }

        return $table;
    }

    private function hasVisaPipelineColumn(string $column): bool
    {
        return Schema::hasColumn($this->getVisaPipelineTable(), $column);
    }

    private function sqlSplitPart(string $column, int $position): string
    {
        if (DB::getDriverName() === 'pgsql') {
            return "split_part({$column}, ':', {$position})";
        }

        if ($position === 1) {
            return "CASE WHEN instr({$column}, ':') = 0 THEN {$column} ELSE substr({$column}, 1, instr({$column}, ':') - 1) END";
        }

        return "CASE WHEN instr({$column}, ':') = 0 THEN '' ELSE substr({$column}, instr({$column}, ':') + 1) END";
    }

    private function buildSubHeadBookingExpression(string $candidateIdColumn): string
    {
        $split1 = $this->sqlSplitPart('de.sub_passport_number', 1);
        $split2 = $this->sqlSplitPart('de.sub_passport_number', 2);

        return "COALESCE((
            SELECT SUM(de.amount)
            FROM daybook_entries de
            LEFT JOIN sub_head_candidate_charges shcc
                ON {$split1} = 'subhead_link'
                AND CAST({$split2} AS integer) = shcc.id
            WHERE de.linked_module = 'sub_head'
                AND COALESCE(de.approval_status, 'pending') <> 'rejected'
                AND (({$split1} = 'candidate'
                    AND CAST({$split2} AS integer) = {$candidateIdColumn})
                    OR ({$split1} = 'subhead_link'
                        AND shcc.candidate_id = {$candidateIdColumn}))
        ), 0)";
    }

    private function buildVisaPipelineBaseQuery()
    {
        $directBookingExpression = $this->buildSubHeadBookingExpression('vp.candidate_id');
        $candidateBookingExpression = $this->buildSubHeadBookingExpression('c.id');
        $chargeColumns = ['visa_charge', 'ticket_charge', 'fla_charge', 'svp_charge', 'vfs_charge', 'qvc_charge', 'service_charge', 'additional_charge'];
        $chargeSelect = [];

        foreach ($chargeColumns as $column) {
            if ($this->hasVisaPipelineColumn($column)) {
                $chargeSelect[] = "COALESCE(vp.{$column}, 0) as {$column}";
            } else {
                $chargeSelect[] = "0 as {$column}";
            }
        }

        $hasProjectId = $this->hasVisaPipelineColumn('project_id');
        $hasProjectNumber = $this->hasVisaPipelineColumn('project_number');
        $hasCompanyName = $this->hasVisaPipelineColumn('company_name');
        $hasBdName = $this->hasVisaPipelineColumn('bd_name');
        $hasCountry = $this->hasVisaPipelineColumn('country');
        $hasOfficeRate = $this->hasVisaPipelineColumn('office_rate');
        $hasWorkingCategory = $this->hasVisaPipelineColumn('working_category');
        $hasTotalFee = $this->hasVisaPipelineColumn('total_fee');
        $hasFlightDate = $this->hasVisaPipelineColumn('flight_date');
        $hasAdvance1 = $this->hasVisaPipelineColumn('advance_1');
        $hasAdvance2 = $this->hasVisaPipelineColumn('advance_2');
        $hasAdvance3 = $this->hasVisaPipelineColumn('advance_3');
        $hasPaymentBooked = $this->hasVisaPipelineColumn('is_payment_booked');
        $hasOriginalPassportStatus = $this->hasVisaPipelineColumn('original_passport_status');
        $hasPhotoStatus = $this->hasVisaPipelineColumn('photo_status');
        $hasPccStatus = $this->hasVisaPipelineColumn('pcc_status');
        $hasMedicalStatus = $this->hasVisaPipelineColumn('medical_status');
        $hasQvcStatus = $this->hasVisaPipelineColumn('qvc_status');
        $hasSvpStatus = $this->hasVisaPipelineColumn('svp_status');
        $hasVfsStatus = $this->hasVisaPipelineColumn('vfs_status');
        $hasMolStatus = $this->hasVisaPipelineColumn('mol_status');
        $hasVisaReceivedStatus = $this->hasVisaPipelineColumn('visa_received_status');
        $hasMedicalOnlineStatus = $this->hasVisaPipelineColumn('medical_online_status');
        $hasOrientationOnlineStatus = $this->hasVisaPipelineColumn('orientation_online_status');
        $hasManualChecklist = $this->hasVisaPipelineColumn('manual_checklist');
        $hasSource = $this->hasVisaPipelineColumn('source');
        $visaTable = $this->getVisaPipelineTable();

        $sameProjectCompanyExpr = $hasProjectNumber
            ? "COALESCE((
                SELECT NULLIF(vp2.company_name, '')
                FROM {$visaTable} vp2
                WHERE NULLIF(vp.project_number, '') IS NOT NULL
                    AND vp2.project_number = vp.project_number
                    AND NULLIF(vp2.company_name, '') IS NOT NULL
                    AND vp2.id <> vp.id
                    AND vp2.deleted_at IS NULL
                ORDER BY vp2.id DESC
                LIMIT 1
            ), '')"
            : "''";

        $sameProjectCountryExpr = $hasProjectNumber && $hasCountry
            ? "COALESCE((
                SELECT NULLIF(vp2.country, '')
                FROM {$visaTable} vp2
                WHERE NULLIF(vp.project_number, '') IS NOT NULL
                    AND vp2.project_number = vp.project_number
                    AND NULLIF(vp2.country, '') IS NOT NULL
                    AND vp2.id <> vp.id
                    AND vp2.deleted_at IS NULL
                ORDER BY vp2.id DESC
                LIMIT 1
            ), '')"
            : "''";

        $sameProjectTradeExpr = $hasProjectNumber && $hasWorkingCategory
            ? "COALESCE((
                SELECT NULLIF(vp2.working_category, '')
                FROM {$visaTable} vp2
                WHERE NULLIF(vp.project_number, '') IS NOT NULL
                    AND vp2.project_number = vp.project_number
                    AND NULLIF(vp2.working_category, '') IS NOT NULL
                    AND vp2.id <> vp.id
                    AND vp2.deleted_at IS NULL
                ORDER BY vp2.id DESC
                LIMIT 1
            ), '')"
            : "''";

        $sameProjectOfficeExpr = $hasProjectNumber && $hasOfficeRate
            ? "COALESCE((
                SELECT NULLIF(vp2.office_rate, 0)
                FROM {$visaTable} vp2
                WHERE NULLIF(vp.project_number, '') IS NOT NULL
                    AND vp2.project_number = vp.project_number
                    AND COALESCE(vp2.office_rate, 0) > 0
                    AND vp2.id <> vp.id
                    AND vp2.deleted_at IS NULL
                ORDER BY vp2.id DESC
                LIMIT 1
            ), 0)"
            : "0";

        $sameProjectTotalFeeExpr = $hasProjectNumber && $hasTotalFee
            ? "COALESCE((
                SELECT NULLIF(vp2.total_fee, 0)
                FROM {$visaTable} vp2
                WHERE NULLIF(vp.project_number, '') IS NOT NULL
                    AND vp2.project_number = vp.project_number
                    AND COALESCE(vp2.total_fee, 0) > 0
                    AND vp2.id <> vp.id
                    AND vp2.deleted_at IS NULL
                ORDER BY vp2.id DESC
                LIMIT 1
            ), 0)"
            : "0";

        $candidateNameExpr = "COALESCE(NULLIF(c.full_name, ''), NULLIF(vp.candidate_name, ''), '')";

        $referenceNameExpr = $hasSource
            ? "COALESCE(NULLIF(vp.source, ''), NULLIF(c.source, ''), '')"
            : "COALESCE(NULLIF(c.source, ''), '')";

        $passportNumberExpr = $this->hasVisaPipelineColumn('passport_number')
            ? "COALESCE(vp.passport_number, c.passport_number, '')"
            : "COALESCE(c.passport_number, '')";

        $companyExpr = $hasCompanyName
            ? ($hasProjectId
                ? "COALESCE(NULLIF(vp.company_name, ''), p.agency_name, pn.agency_name, cp.agency_name, NULLIF({$sameProjectCompanyExpr}, ''), NULLIF(vp.project_number, ''), '')"
                : "COALESCE(NULLIF(vp.company_name, ''), pn.agency_name, cp.agency_name, NULLIF({$sameProjectCompanyExpr}, ''), NULLIF(vp.project_number, ''), '')")
            : ($hasProjectId
                ? "COALESCE(p.agency_name, pn.agency_name, cp.agency_name, NULLIF({$sameProjectCompanyExpr}, ''), NULLIF(vp.project_number, ''), '')"
                : "COALESCE(pn.agency_name, cp.agency_name, NULLIF({$sameProjectCompanyExpr}, ''), NULLIF(vp.project_number, ''), '')");

        $bdExpr = $hasBdName
            ? ($hasProjectId
                ? "COALESCE(NULLIF(vp.bd_name, ''), p.bd, pn.bd, cp.bd, '')"
                : "COALESCE(NULLIF(vp.bd_name, ''), pn.bd, cp.bd, '')")
            : ($hasProjectId
                ? "COALESCE(p.bd, pn.bd, cp.bd, '')"
                : "COALESCE(pn.bd, cp.bd, '')");

        $projectIdExpr = $hasProjectId
            ? 'COALESCE(vp.project_id, p.id, pn.id, cp.id)'
            : 'COALESCE(pn.id, cp.id, NULL)';

        $projectNumberExpr = $hasProjectNumber
            ? ($hasProjectId
                ? "COALESCE(NULLIF(vp.project_number, ''), p.project_name, pn.project_name, cp.project_name, '')"
                : "COALESCE(NULLIF(vp.project_number, ''), pn.project_name, cp.project_name, '')")
            : ($hasProjectId
                ? "COALESCE(p.project_name, pn.project_name, cp.project_name, '')"
                : "COALESCE(pn.project_name, cp.project_name, '')");

        $countryExpr = $hasCountry
            ? ($hasProjectId
                ? "COALESCE(NULLIF(vp.country, ''), p.country, pn.country, cp.country, NULLIF({$sameProjectCountryExpr}, ''), '')"
                : "COALESCE(NULLIF(vp.country, ''), pn.country, cp.country, NULLIF({$sameProjectCountryExpr}, ''), '')")
            : ($hasProjectId
                ? "COALESCE(p.country, pn.country, cp.country, NULLIF({$sameProjectCountryExpr}, ''), '')"
                : "COALESCE(pn.country, cp.country, NULLIF({$sameProjectCountryExpr}, ''), '')");

        $officeRateExpr = $hasOfficeRate
            ? ($hasProjectId
                ? "COALESCE(NULLIF(vp.office_rate, 0), p.office_rate_per_trade, pn.office_rate_per_trade, cp.office_rate_per_trade, NULLIF({$sameProjectOfficeExpr}, 0), 0)"
                : "COALESCE(NULLIF(vp.office_rate, 0), pn.office_rate_per_trade, cp.office_rate_per_trade, NULLIF({$sameProjectOfficeExpr}, 0), 0)")
            : ($hasProjectId
                ? "COALESCE(p.office_rate_per_trade, pn.office_rate_per_trade, cp.office_rate_per_trade, NULLIF({$sameProjectOfficeExpr}, 0), 0)"
                : "COALESCE(pn.office_rate_per_trade, cp.office_rate_per_trade, NULLIF({$sameProjectOfficeExpr}, 0), 0)");

        $workingCategoryExpr = $hasWorkingCategory
            ? ($hasProjectId
                ? "COALESCE(NULLIF(vp.working_category, ''), p.trade, pn.trade, cp.trade, NULLIF({$sameProjectTradeExpr}, ''), '')"
                : "COALESCE(NULLIF(vp.working_category, ''), pn.trade, cp.trade, NULLIF({$sameProjectTradeExpr}, ''), '')")
            : ($hasProjectId
                ? "COALESCE(p.trade, pn.trade, cp.trade, NULLIF({$sameProjectTradeExpr}, ''), '')"
                : "COALESCE(pn.trade, cp.trade, NULLIF({$sameProjectTradeExpr}, ''), '')");

        $totalFeeExpr = $hasTotalFee
            ? ($hasProjectId
                ? "COALESCE(NULLIF(vp.total_fee, 0), p.office_rate_per_trade, pn.office_rate_per_trade, cp.office_rate_per_trade, NULLIF({$sameProjectTotalFeeExpr}, 0), NULLIF({$sameProjectOfficeExpr}, 0), 0)"
                : "COALESCE(NULLIF(vp.total_fee, 0), pn.office_rate_per_trade, cp.office_rate_per_trade, NULLIF({$sameProjectTotalFeeExpr}, 0), NULLIF({$sameProjectOfficeExpr}, 0), 0)")
            : ($hasProjectId
                ? "COALESCE(p.office_rate_per_trade, pn.office_rate_per_trade, cp.office_rate_per_trade, NULLIF({$sameProjectTotalFeeExpr}, 0), NULLIF({$sameProjectOfficeExpr}, 0), 0)"
                : "COALESCE(pn.office_rate_per_trade, cp.office_rate_per_trade, NULLIF({$sameProjectTotalFeeExpr}, 0), NULLIF({$sameProjectOfficeExpr}, 0), 0)");

        $flightDateExpr = $hasFlightDate ? 'vp.flight_date' : 'NULL';

        $advance1Expr = $hasAdvance1 ? 'COALESCE(vp.advance_1, 0)' : '0';
        $advance2Expr = $hasAdvance2 ? 'COALESCE(vp.advance_2, 0)' : '0';
        $advance3Expr = $hasAdvance3 ? 'COALESCE(vp.advance_3, 0)' : '0';
        $advanceTotalExpr = "({$advance1Expr} + {$advance2Expr} + {$advance3Expr})";

        $visaDaybookPaidExpr = "COALESCE((
            SELECT SUM(de.amount)
            FROM daybook_entries de
            WHERE de.type = 'payment'
                AND de.linked_module = 'visa_pipeline'
                AND COALESCE(de.approval_status, 'pending') <> 'rejected'
                AND de.linked_record_id = CAST(vp.id AS text)
        ), 0)";

        $candidatePaidExpr = 'COALESCE(c.paid_amount, 0)';
        $daybookPaidTotalExpr = "({$candidatePaidExpr} + {$visaDaybookPaidExpr})";
        $paidAmountExpr = "CASE WHEN {$daybookPaidTotalExpr} > {$advanceTotalExpr} THEN {$daybookPaidTotalExpr} ELSE {$advanceTotalExpr} END";

        $isPaymentBookedExpr = $hasPaymentBooked
            ? 'CASE WHEN COALESCE(vp.is_payment_booked, false) THEN 1 ELSE 0 END'
            : '0';

        $originalPassportStatusExpr = $hasOriginalPassportStatus
            ? "COALESCE(vp.original_passport_status, 'not_received')"
            : "'not_received'";

        $photoStatusExpr = $hasPhotoStatus
            ? "COALESCE(vp.photo_status, 'not_received')"
            : "'not_received'";

        $pccStatusExpr = $hasPccStatus
            ? "COALESCE(vp.pcc_status, 'not_received')"
            : "'not_received'";

        $medicalStatusExpr = $hasMedicalStatus
            ? "COALESCE(vp.medical_status, 'not_received')"
            : "'not_received'";

        $qvcStatusExpr = $hasQvcStatus
            ? "COALESCE(vp.qvc_status, 'not_received')"
            : "'not_received'";

        $svpStatusExpr = $hasSvpStatus
            ? "COALESCE(vp.svp_status, 'not_received')"
            : "'not_received'";

        $vfsStatusExpr = $hasVfsStatus
            ? "COALESCE(vp.vfs_status, 'not_received')"
            : "'not_received'";

        $molStatusExpr = $hasMolStatus
            ? "COALESCE(vp.mol_status, 'not_received')"
            : "'not_received'";

        $visaReceivedStatusExpr = $hasVisaReceivedStatus
            ? "COALESCE(vp.visa_received_status, 'not_received')"
            : "'not_received'";

        $medicalOnlineStatusExpr = $hasMedicalOnlineStatus
            ? "COALESCE(vp.medical_online_status, 'not_done')"
            : "'not_done'";

        $orientationOnlineStatusExpr = $hasOrientationOnlineStatus
            ? "COALESCE(vp.orientation_online_status, 'not_done')"
            : "'not_done'";

        $manualChecklistExpr = $hasManualChecklist
            ? "COALESCE(vp.manual_checklist, '[]')"
            : "'[]'";
        $directQuery = DB::table("{$visaTable} as vp")
            ->leftJoin('candidates as c', 'c.id', '=', 'vp.candidate_id')
            ->leftJoin('project_settings as cp', 'cp.id', '=', 'c.project_id');

        if ($hasProjectNumber) {
            $directQuery->leftJoin('project_settings as pn', function ($join) {
                $join->where(function ($q) {
                    $q->whereRaw("LOWER(TRIM(pn.project_name)) = LOWER(TRIM(vp.project_number))")
                      ->orWhereRaw("LOWER(TRIM(pn.project_reference_code)) = LOWER(TRIM(vp.project_number))");
                });
            });
        }

        if ($hasProjectId) {
            $directQuery->leftJoin('project_settings as p', 'p.id', '=', 'vp.project_id');
        }

        $projectNameExpr = $hasProjectId
            ? "COALESCE(p.project_name, pn.project_name, cp.project_name, '')"
            : "COALESCE(pn.project_name, cp.project_name, '')";

        $projectTradeExpr = $hasProjectId
            ? "COALESCE(p.trade, pn.trade, cp.trade, '')"
            : "COALESCE(pn.trade, cp.trade, '')";

        $directQuery = $directQuery
            ->selectRaw(
                "vp.id,
                 vp.candidate_id,
                 {$candidateNameExpr} as candidate_name,
                 {$passportNumberExpr} as passport_number,
                 {$companyExpr} as company_name,
                 {$bdExpr} as bd_name,
                 {$referenceNameExpr} as reference_name,
                 {$projectIdExpr} as project_id,
                 {$projectNumberExpr} as project_number,
                 {$projectNameExpr} as project_name,
                 {$countryExpr} as country,
                 {$officeRateExpr} as office_rate,
                 {$workingCategoryExpr} as working_category,
                 {$projectTradeExpr} as project_trade,
                 {$totalFeeExpr} as total_fee,
                 " . implode(",\n                 ", $chargeSelect) . ",
                 {$flightDateExpr} as flight_date,
                 {$advance1Expr} as advance_1,
                 {$advance2Expr} as advance_2,
                 {$advance3Expr} as advance_3,
                 {$paidAmountExpr} as paid_amount,
                 {$isPaymentBookedExpr} as is_payment_booked,
                 {$originalPassportStatusExpr} as original_passport_status,
                 {$photoStatusExpr} as photo_status,
                 {$pccStatusExpr} as pcc_status,
                 {$medicalStatusExpr} as medical_status,
                 {$qvcStatusExpr} as qvc_status,
                 {$svpStatusExpr} as svp_status,
                 {$vfsStatusExpr} as vfs_status,
                 {$molStatusExpr} as mol_status,
                 {$visaReceivedStatusExpr} as visa_received_status,
                 {$medicalOnlineStatusExpr} as medical_online_status,
                 {$orientationOnlineStatusExpr} as orientation_online_status,
                 {$manualChecklistExpr} as manual_checklist,
                 {$directBookingExpression} as sub_head_booked_amount,
                 vp.created_at,
                 vp.updated_at"
            )
            ->whereNull('vp.deleted_at');

        $candidateQuery = DB::table('candidates as c')
            ->leftJoin('project_settings as p', 'p.id', '=', 'c.project_id')
            ->whereNotNull('c.project_id')
            ->whereNotExists(function ($query) use ($visaTable) {
                $query->select(DB::raw('1'))
                    ->from("{$visaTable} as vp")
                    ->whereRaw('vp.candidate_id = c.id')
                    ->whereNull('vp.deleted_at');
            })
            ->selectRaw(
                "(-1 * c.id) as id,
                 c.id as candidate_id,
                 c.full_name as candidate_name,
                 c.source as reference_name,
                 c.passport_number as passport_number,
                 COALESCE(p.agency_name, '') as company_name,
                 COALESCE(p.bd, '') as bd_name,
                 c.project_id as project_id,
                 COALESCE(p.project_name, '') as project_number,
                 COALESCE(p.project_name, '') as project_name,
                 COALESCE(p.country, '') as country,
                 COALESCE(p.office_rate_per_trade, 0) as office_rate,
                 '' as working_category,
                 COALESCE(p.trade, '') as project_trade,
                 COALESCE(p.office_rate_per_trade, 0) as total_fee,
                 " . implode(",\n                 ", array_map(fn ($column) => '0 as ' . $column, $chargeColumns)) . ",
                 NULL as flight_date,
                 COALESCE(c.paid_amount, 0) as advance_1,
                 0 as advance_2,
                 0 as advance_3,
                 COALESCE(c.paid_amount, 0) as paid_amount,
                 CASE WHEN COALESCE(c.paid_amount, 0) > 0 THEN 1 ELSE 0 END as is_payment_booked,
                 'not_received' as original_passport_status,
                 'not_received' as photo_status,
                 'not_received' as pcc_status,
                 'not_received' as medical_status,
                 'not_received' as qvc_status,
                 'not_received' as svp_status,
                 'not_received' as vfs_status,
                 'not_received' as mol_status,
                 'not_received' as visa_received_status,
                 'not_done' as medical_online_status,
                 'not_done' as orientation_online_status,
                 '[]' as manual_checklist,
                 {$candidateBookingExpression} as sub_head_booked_amount,
                 c.created_at,
                 c.updated_at"
            );

        return $directQuery->unionAll($candidateQuery);
    }

    private function applyVisaPipelineFilters($query, Request $request)
    {
        if ($request->filled('search')) {
            $s = mb_strtolower($request->get('search'));

            $query->where(function ($q) use ($s) {
                $q->whereRaw("LOWER(COALESCE(candidate_name, '')) LIKE ?", ["%{$s}%"])
                  ->orWhereRaw("LOWER(COALESCE(passport_number, '')) LIKE ?", ["%{$s}%"])
                  ->orWhereRaw("LOWER(COALESCE(company_name, '')) LIKE ?", ["%{$s}%"])
                  ->orWhereRaw("LOWER(COALESCE(country, '')) LIKE ?", ["%{$s}%"])
                  ->orWhereRaw("LOWER(COALESCE(project_number, '')) LIKE ?", ["%{$s}%"])
                  ->orWhereRaw("LOWER(COALESCE(project_name, '')) LIKE ?", ["%{$s}%"])
                  ->orWhereRaw("LOWER(COALESCE(project_trade, '')) LIKE ?", ["%{$s}%"])
                  ->orWhereRaw("LOWER(COALESCE(reference_name, '')) LIKE ?", ["%{$s}%"]);
            });
        }

        if ($request->filled('country')) {
            $query->where('country', $request->get('country'));
        }

        if ($request->filled('candidate_id')) {
            $query->where('candidate_id', $request->get('candidate_id'));
        }

        return $query;
    }

    /**
     * List all visa pipeline entries with pagination and search.
     */
    public function export(Request $request): StreamedResponse|JsonResponse
    {
        if ($err = $this->ensureAccess($request)) return $err;

        $baseQuery = $this->buildVisaPipelineBaseQuery();
        $query = DB::query()->fromSub($baseQuery, 'visa_entries');
        $query = $this->applyVisaPipelineFilters($query, $request);

        $filename = 'candidate_flown_' . now()->format('Ymd_His') . '.csv';

        return response()->streamDownload(function () use ($query) {
            $handle = fopen('php://output', 'w');

            fputcsv($handle, [
                'id',
                'candidate_id',
                'candidate_name',
                'passport_number',
                'company_name',
                'bd_name',
                'reference_name',
                'project_id',
                'project_number',
                'project_name',
                'country',
                'office_rate',
                'working_category',
                'total_fee',
                'advance_1',
                'advance_2',
                'advance_3',
                'paid_amount',
                'is_payment_booked',
                'sub_head_booked_amount',
                'created_at',
            ]);

            $query->orderByDesc('created_at')->chunk(200, function ($rows) use ($handle) {
                foreach ($rows as $row) {
                    fputcsv($handle, [
                        $row->id,
                        $row->candidate_id,
                        $row->candidate_name,
                        $row->passport_number,
                        $row->company_name,
                        $row->bd_name,
                        $row->reference_name,
                        $row->project_id,
                        $row->project_number,
                        $row->project_name,
                        $row->country,
                        $row->office_rate,
                        $row->working_category,
                        $row->total_fee,
                        $row->advance_1,
                        $row->advance_2,
                        $row->advance_3,
                        $row->paid_amount,
                        $row->is_payment_booked,
                        $row->sub_head_booked_amount,
                        $row->created_at,
                    ]);
                }
            });

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function candidateIndex(Request $request, int $id): JsonResponse
    {
        $request->merge(['candidate_id' => $id]);
        return $this->index($request);
    }

    public function index(Request $request): JsonResponse
    {
        if ($err = $this->ensureAccess($request)) return $err;

        $perPage = min(max((int) $request->get('per_page', 20), 1), 200);
        $baseQuery = $this->buildVisaPipelineBaseQuery();
        $query = DB::query()->fromSub($baseQuery, 'visa_entries');

        $query = $this->applyVisaPipelineFilters($query, $request);

        $entries = $query->orderByDesc('created_at')->paginate($perPage);

        $totalQuery = DB::query()->fromSub($baseQuery, 'visa_entries')
            ->selectRaw(<<<'SQL'
SUM(total_fee) as total_fee,
SUM(advance_1) as total_adv1,
SUM(advance_2) as total_adv2,
SUM(advance_3) as total_adv3,
SUM(COALESCE(paid_amount, advance_1 + advance_2 + advance_3)) as total_received,
SUM(total_fee - COALESCE(paid_amount, advance_1 + advance_2 + advance_3)) as total_due,
SUM(sub_head_booked_amount) as total_sub_head_booked_amount
SQL
            );

        $totalQuery = $this->applyVisaPipelineFilters($totalQuery, $request);
        $totals = $totalQuery->first();

        return response()->json([
            'success' => true,
            'data' => [
                'entries' => $entries->items(),
                'totals'  => [
                    'total_fee'                   => (float) ($totals->total_fee ?? 0),
                    'total_received'              => (float) ($totals->total_received ?? 0),
                    'total_due'                   => (float) ($totals->total_due ?? 0),
                    'total_sub_head_booked_amount' => (float) ($totals->total_sub_head_booked_amount ?? 0),
                ],
            ],
            'pagination' => [
                'current_page' => $entries->currentPage(),
                'last_page'    => $entries->lastPage(),
                'per_page'     => $entries->perPage(),
                'total'        => $entries->total(),
            ],
        ]);
    }

    /**
     * Create a new visa pipeline entry.
     */
    public function store(Request $request): JsonResponse
    {
        if ($err = $this->ensureAccess($request)) return $err;

        $validator = Validator::make($request->all(), [
            'candidate_id'     => 'nullable|exists:candidates,id',
            'candidate_name'   => 'nullable|string|max:255',
            'passport_number'  => 'nullable|string|max:50',
            'company_name'     => 'nullable|string|max:255',
            'bd_name'          => 'nullable|string|max:255',
            'project_id'       => 'nullable|exists:project_settings,id',
            'project_number'   => 'nullable|string|max:100',
            'country'          => 'nullable|string|max:100',
            'office_rate'      => 'nullable|numeric|min:0',
            'working_category' => 'nullable|string|max:100',
            'original_passport_status' => 'nullable|string|in:received,not_received',
            'photo_status'     => 'nullable|string|in:received,not_received',
            'pcc_status'       => 'nullable|string|in:received,not_received',
            'medical_status'   => 'nullable|string|in:received,not_received',
            'qvc_status'       => 'nullable|string|in:received,not_received',
            'svp_status'       => 'nullable|string|in:received,not_received',
            'vfs_status'       => 'nullable|string|in:received,not_received',
            'mol_status'       => 'nullable|string|in:received,not_received',
            'visa_received_status' => 'nullable|string|in:received,not_received',
            'visa_charge'      => 'nullable|numeric|min:0',
            'ticket_charge'    => 'nullable|numeric|min:0',
            'fla_charge'       => 'nullable|numeric|min:0',
            'svp_charge'       => 'nullable|numeric|min:0',
            'vfs_charge'       => 'nullable|numeric|min:0',
            'qvc_charge'       => 'nullable|numeric|min:0',
            'service_charge'   => 'nullable|numeric|min:0',
            'additional_charge'=> 'nullable|numeric|min:0',
            'total_fee'        => 'nullable|numeric|min:0',
            'flight_date'      => 'nullable|date',
            'advance_1'        => 'nullable|numeric|min:0',
            'advance_2'        => 'nullable|numeric|min:0',
            'advance_3'        => 'nullable|numeric|min:0',
            'is_payment_booked' => 'nullable|boolean',
            'manual_checklist' => 'nullable|array',
            'manual_checklist.*.key' => 'required|string|max:100',
            'manual_checklist.*.label' => 'required|string|max:255',
            // allow passport store specific statuses and registration marker
            // allow passport store specific statuses, deployment flown statuses and registration marker
            'manual_checklist.*.status' => 'nullable|string|in:received,not_received,not_applicable,original_passport_out,original_passport_in,registered,flown,not_flown',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $payload = $this->normalizeNumericFields($validator->validated());
        if (!empty($payload['project_id']) && empty($payload['project_number'])) {
            $project = ProjectSetting::find($payload['project_id']);
            if ($project) {
                $payload['project_number'] = $project->project_name;
            }
        }

        $entry = VisaPipelineEntry::create(array_merge(
            $payload,
            ['created_by' => $request->user()?->id]
        ));

        // Create daybook receipt entry when payment is booked
        if (!empty($payload['is_payment_booked']) && !empty($payload['office_rate'])) {
            DaybookEntry::create([
                'entry_date' => now()->toDateString(),
                'type' => 'receipt',
                'linked_module' => 'visa_pipeline',
                'linked_record_id' => (string)$entry->id,
                'linked_record_name' => $payload['candidate_name'] ?? 'Visa Entry ' . $entry->id,
                'company_name' => $payload['company_name'] ?? '',
                'particulars' => 'Visa Processing - Advance Payment Booked',
                'amount' => $payload['office_rate'],
                'description' => 'Booked from visa pipeline entry for ' . ($payload['passport_number'] ?? 'candidate'),
                'created_by' => $request->user()?->id,
                'approval_status' => 'approved',
                'approved_by' => $request->user()?->id,
                'approved_at' => now(),
            ]);
        }

        $entry->load(['candidate:id,full_name,passport_number', 'project:id,project_name,agency_name,trade']);

        return response()->json(['success' => true, 'data' => $entry, 'message' => 'Entry created'], 201);
    }

    /**
     * Update an existing visa pipeline entry.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        if ($err = $this->ensureAccess($request)) return $err;

        $entry = VisaPipelineEntry::find($id);
        if (!$entry) {
            return response()->json(['success' => false, 'message' => 'Entry not found'], 404);
        }

        $validator = Validator::make($request->all(), [
            'candidate_id'     => 'nullable|exists:candidates,id',
            'candidate_name'   => 'nullable|string|max:255',
            'passport_number'  => 'nullable|string|max:50',
            'company_name'     => 'nullable|string|max:255',
            'bd_name'          => 'nullable|string|max:255',
            'project_id'       => 'nullable|exists:project_settings,id',
            'project_number'   => 'nullable|string|max:100',
            'country'          => 'nullable|string|max:100',
            'office_rate'      => 'nullable|numeric|min:0',
            'working_category' => 'nullable|string|max:100',
            'original_passport_status' => 'nullable|string|in:received,not_received',
            'photo_status'     => 'nullable|string|in:received,not_received',
            'pcc_status'       => 'nullable|string|in:received,not_received',
            'medical_status'   => 'nullable|string|in:received,not_received',
            'qvc_status'       => 'nullable|string|in:received,not_received',
            'svp_status'       => 'nullable|string|in:received,not_received',
            'vfs_status'       => 'nullable|string|in:received,not_received',
            'mol_status'       => 'nullable|string|in:received,not_received',
            'visa_received_status' => 'nullable|string|in:received,not_received',
            'visa_charge'      => 'nullable|numeric|min:0',
            'ticket_charge'    => 'nullable|numeric|min:0',
            'fla_charge'       => 'nullable|numeric|min:0',
            'svp_charge'       => 'nullable|numeric|min:0',
            'vfs_charge'       => 'nullable|numeric|min:0',
            'qvc_charge'       => 'nullable|numeric|min:0',
            'service_charge'   => 'nullable|numeric|min:0',
            'additional_charge'=> 'nullable|numeric|min:0',
            'total_fee'        => 'nullable|numeric|min:0',
            'flight_date'      => 'nullable|date',
            'advance_1'        => 'nullable|numeric|min:0',
            'advance_2'        => 'nullable|numeric|min:0',
            'advance_3'        => 'nullable|numeric|min:0',
            'is_payment_booked' => 'nullable|boolean',
            'manual_checklist' => 'nullable|array',
            'manual_checklist.*.key' => 'required|string|max:100',
            'manual_checklist.*.label' => 'required|string|max:255',
            // allow passport store specific statuses and registration marker
            // allow passport store specific statuses, deployment flown statuses and registration marker
            'manual_checklist.*.status' => 'nullable|string|in:received,not_received,not_applicable,original_passport_out,original_passport_in,registered,flown,not_flown',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $payload = $this->normalizeNumericFields($validator->validated());
        if (!empty($payload['project_id']) && empty($payload['project_number'])) {
            $project = ProjectSetting::find($payload['project_id']);
            if ($project) {
                $payload['project_number'] = $project->project_name;
            }
        }

        $wasBooked = $entry->is_payment_booked ?? false;
        $entry->update($payload);
        $isNowBooked = !empty($payload['is_payment_booked']);

        // Create daybook receipt entry if payment is being booked for the first time
        if (!$wasBooked && $isNowBooked && !empty($payload['office_rate'])) {
            DaybookEntry::create([
                'entry_date' => now()->toDateString(),
                'type' => 'receipt',
                'linked_module' => 'visa_pipeline',
                'linked_record_id' => (string)$entry->id,
                'linked_record_name' => $entry->candidate_name ?? 'Visa Entry ' . $entry->id,
                'company_name' => $entry->company_name ?? '',
                'particulars' => 'Visa Processing - Advance Payment Booked',
                'amount' => $payload['office_rate'],
                'description' => 'Booked from visa pipeline entry for ' . ($entry->passport_number ?? 'candidate'),
                'created_by' => $request->user()?->id,
                'approval_status' => 'approved',
                'approved_by' => $request->user()?->id,
                'approved_at' => now(),
            ]);
        }

        $entry->load(['candidate:id,full_name,passport_number', 'project:id,project_name,agency_name,trade']);

        return response()->json(['success' => true, 'data' => $entry, 'message' => 'Entry updated']);
    }

    /**
     * Delete a visa pipeline entry.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        if ($err = $this->ensureAccess($request)) return $err;

        $entry = VisaPipelineEntry::find($id);
        if (!$entry) {
            return response()->json(['success' => false, 'message' => 'Entry not found'], 404);
        }

        $entry->delete();

        return response()->json(['success' => true, 'message' => 'Entry deleted']);
    }
}
