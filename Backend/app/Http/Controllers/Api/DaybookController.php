<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Candidate;
use App\Models\DaybookEntry;
use App\Models\SubHeadCandidateCharge;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Schema;

class DaybookController extends Controller
{
    /**
     * Get all daybook entries for a specific date or date range
     */
    public function index(Request $request): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        $perPage = min(max((int) $request->get('per_page', 50), 1), 100);
        $query = DaybookEntry::query()->with('creator:id,full_name,name', 'expenseHead:id,name');

        // Filter by type (receipt/payment)
        if ($request->filled('type')) {
            $query->where('type', $request->get('type'));
        }

        // Filter by date
        if ($request->filled('date')) {
            $query->byDate($request->get('date'));
        }

        // Filter by date range
        if ($request->filled('start_date') && $request->filled('end_date')) {
            $query->byDateRange($request->get('start_date'), $request->get('end_date'));
        }

        // Filter by approval status
        if ($request->filled('approval_status')) {
            $query->where('approval_status', $request->get('approval_status'));
        }

        // Search by company, particulars, reference number
        if ($request->filled('search')) {
            $search = trim((string) $request->get('search'));
            $query->where(function ($q) use ($search) {
                $q->where('company_name', 'ilike', '%' . $search . '%')
                  ->orWhere('particulars', 'ilike', '%' . $search . '%')
                  ->orWhere('sub_passport_number', 'ilike', '%' . $search . '%')
                  ->orWhere('reference_number', 'ilike', '%' . $search . '%')
                  ->orWhere('linked_module', 'ilike', '%' . $search . '%')
                  ->orWhere('linked_record_name', 'ilike', '%' . $search . '%')
                  ->orWhere('description', 'ilike', '%' . $search . '%')
                  ->orWhereHas('expenseHead', function ($headQuery) use ($search) {
                      $headQuery->where('name', 'ilike', '%' . $search . '%');
                  });
            });
        }

        if ($request->filled('reference_prefix')) {
            $query->where('reference_number', 'like', $request->get('reference_prefix') . '%');
        }

        $entries = $query->orderByDesc('entry_date')->orderByDesc('id')->paginate($perPage);

        // Calculate summary
        $today = now()->toDateString();
        $summary = [
            'total_receipts_today' => DaybookEntry::receipts()->byDate($today)->sum('amount'),
            'total_payments_today' => DaybookEntry::payments()->byDate($today)->sum('amount'),
            'net_balance_today' => (float)(DaybookEntry::receipts()->byDate($today)->sum('amount') - DaybookEntry::payments()->byDate($today)->sum('amount')),
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'entries' => $entries->items(),
                'summary' => $summary,
            ],
            'pagination' => [
                'current_page' => $entries->currentPage(),
                'last_page' => $entries->lastPage(),
                'per_page' => $entries->perPage(),
                'total' => $entries->total(),
            ],
        ]);
    }

    /**
     * Store a new daybook entry
     */
    public function store(Request $request): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        $rules = [
            'entry_date' => 'required|date',
            'type' => 'required|in:receipt,payment',
            'expense_head_id' => 'nullable|exists:expense_heads,id',
            'linked_module' => 'nullable|in:candidates,staff,agencies,reference,bd,visa_pipeline,project,sub_head',
            'linked_record_id' => 'required_if:linked_module,sub_head|nullable|string|max:100',
            'linked_record_name' => 'nullable|string|max:255',
            'company_name' => 'nullable|string|max:255',
            'particulars' => 'required|string|max:500',
            'transaction_type' => 'nullable|in:cash,online',
            'sub_passport_number' => 'required_if:linked_module,sub_head|nullable|string|max:50',
            'amount' => 'required|numeric|min:0.01',
        ];

        if (Schema::hasColumn('daybook_entries', 'ssf_amount')) {
            $rules['ssf_amount'] = 'nullable|numeric|min:0';
        }
        if (Schema::hasColumn('daybook_entries', 'welfare_amount')) {
            $rules['welfare_amount'] = 'nullable|numeric|min:0';
        }
        if (Schema::hasColumn('daybook_entries', 'insurance_amount')) {
            $rules['insurance_amount'] = 'nullable|numeric|min:0';
        }

        $rules = array_merge($rules, [
            'description' => 'nullable|string',
            'reference_number' => 'nullable|string|max:100',
        ]);

        $validator = Validator::make($request->all(), $rules);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'DAYBOOK_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $payload = [
            'entry_date' => $request->get('entry_date'),
            'type' => $request->get('type'),
            'expense_head_id' => $request->get('expense_head_id'),
            'linked_module' => $request->get('linked_module'),
            'linked_record_id' => $request->get('linked_record_id'),
            'linked_record_name' => $request->get('linked_record_name'),
            'company_name' => $request->get('company_name'),
            'particulars' => $request->get('particulars'),
            'transaction_type' => $request->get('transaction_type'),
            'sub_passport_number' => $request->get('sub_passport_number'),
            'amount' => $request->get('amount'),
        ];

        // Only persist SSF/Welfare/Insurance values for payment entries
        if ($request->get('type') === 'payment') {
            if (Schema::hasColumn('daybook_entries', 'ssf_amount')) {
                $payload['ssf_amount'] = $request->get('ssf_amount');
            }
            if (Schema::hasColumn('daybook_entries', 'welfare_amount')) {
                $payload['welfare_amount'] = $request->get('welfare_amount');
            }
            if (Schema::hasColumn('daybook_entries', 'insurance_amount')) {
                $payload['insurance_amount'] = $request->get('insurance_amount');
            }
        }

        $userRole = strtolower(str_replace(' ', '_', (string) ($request->user()->role ?? '')));
        $payload = array_merge($payload, [
            'description' => $request->get('description'),
            'reference_number' => $request->get('reference_number'),
            'created_by' => $request->user()->id,
            'approval_status' => in_array($userRole, ['superadmin', 'super_admin'], true) ? 'approved' : 'pending',
            'approved_by' => in_array($userRole, ['superadmin', 'super_admin'], true) ? $request->user()->id : null,
            'approved_at' => in_array($userRole, ['superadmin', 'super_admin'], true) ? now() : null,
        ]);

        $entry = DaybookEntry::create($payload);

        if ($entry->type === 'receipt' && $entry->linked_module === 'candidates' && !empty($entry->linked_record_id)) {
            $candidate = Candidate::find((int)$entry->linked_record_id);
            if ($candidate) {
                /** @phpstan-ignore-next-line */
                $candidate->setAttribute('paid_amount', number_format(max(0, (float) $candidate->paid_amount + (float) $entry->amount), 2, '.', ''));
                $candidate->save();
            }
        }

        if ($entry->type === 'receipt' && $entry->linked_module === 'sub_head' && !empty($entry->sub_passport_number)) {
            $candidate = null;
            $reference = (string) $entry->sub_passport_number;

            if (str_starts_with($reference, 'subhead_link:')) {
                $linkId = (int) str_replace('subhead_link:', '', $reference);
                $candidate = optional(SubHeadCandidateCharge::find($linkId))->candidate;
            } elseif (str_starts_with($reference, 'candidate:')) {
                $candidate = Candidate::find((int) str_replace('candidate:', '', $reference));
            }

            if ($candidate) {
                /** @phpstan-ignore-next-line */
                $candidate->setAttribute('paid_amount', number_format(max(0, (float) $candidate->paid_amount + (float) $entry->amount), 2, '.', ''));
                $candidate->save();
            }
        }

        $this->logActivity(
            $request,
            'Daybook Entry Created',
            'Finance',
            'Created daybook ' . $entry->type . ' entry for amount: ' . number_format((float)$entry->amount, 2)
        );

        return response()->json([
            'success' => true,
            'message' => 'Daybook entry created successfully',
            'data' => $entry->load('creator:id,full_name,name', 'expenseHead:id,name'),
        ], 201);
    }

    /**
     * Get a single daybook entry
     */
    public function show(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        $entry = DaybookEntry::with('creator:id,full_name,name', 'expenseHead:id,name')->find($id);

        if (!$entry) {
            return response()->json([
                'success' => false,
                'error_code' => 'DAYBOOK_ENTRY_NOT_FOUND',
                'message' => 'Daybook entry not found.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $entry,
        ]);
    }

    /**
     * Update a daybook entry
     */
    public function update(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        $entry = DaybookEntry::find($id);
        if (!$entry) {
            return response()->json([
                'success' => false,
                'error_code' => 'DAYBOOK_ENTRY_NOT_FOUND',
                'message' => 'Daybook entry not found.',
            ], 404);
        }

        $role = strtolower(str_replace(' ', '_', (string) ($request->user()->role ?? '')));
        if ($entry->approval_status === 'approved' && !in_array($role, ['superadmin', 'super_admin'], true)) {
            return response()->json([
                'success' => false,
                'error_code' => 'DAYBOOK_APPROVED',
                'message' => 'Approved daybook entries can only be edited by superadmin.',
            ], 403);
        }

        $rules = [
            'entry_date' => 'sometimes|date',
            'type' => 'sometimes|in:receipt,payment',
            'expense_head_id' => 'nullable|exists:expense_heads,id',
            'linked_module' => 'nullable|in:candidates,staff,agencies,reference,bd,visa_pipeline,project,sub_head',
            'linked_record_id' => 'required_if:linked_module,sub_head|nullable|string|max:100',
            'linked_record_name' => 'nullable|string|max:255',
            'company_name' => 'nullable|string|max:255',
            'particulars' => 'sometimes|required|string|max:500',
            'transaction_type' => 'nullable|in:cash,online',
            'sub_passport_number' => 'required_if:linked_module,sub_head|nullable|string|max:50',
            'amount' => 'sometimes|numeric|min:0.01',
            'description' => 'nullable|string',
            'reference_number' => 'nullable|string|max:100',
        ];

        if (Schema::hasColumn('daybook_entries', 'ssf_amount')) {
            $rules['ssf_amount'] = 'nullable|numeric|min:0';
        }
        if (Schema::hasColumn('daybook_entries', 'welfare_amount')) {
            $rules['welfare_amount'] = 'nullable|numeric|min:0';
        }
        if (Schema::hasColumn('daybook_entries', 'insurance_amount')) {
            $rules['insurance_amount'] = 'nullable|numeric|min:0';
        }

        $validator = Validator::make($request->all(), $rules);
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'DAYBOOK_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Enforce edit lock based on configured hours (default 72); restrict edits for finance_officer
        $lockHours = (int) (cache()->get('daybook.edit_lock_hours', env('DAYBOOK_EDIT_WINDOW_HOURS', 72)) ?: 72);
        $entryDate = \Illuminate\Support\Carbon::parse($entry->entry_date ?? $entry->created_at);
        $hoursSince = now()->diffInHours($entryDate);
        $role = strtolower(str_replace(' ', '_', (string) ($request->user()->role ?? '')));
        // Enforce lock for all non-admin roles (admin/superadmin exceptions)
        if ($hoursSince > $lockHours && !in_array($role, ['superadmin', 'super_admin', 'admin'], true)) {
            return response()->json([
                'success' => false,
                'error_code' => 'DAYBOOK_LOCKED',
                'message' => 'This entry is locked for editing after configured time. Contact admin or superadmin.'
            ], 403);
        }

        $updatePayload = $request->only([
            'entry_date',
            'type',
            'expense_head_id',
            'linked_module',
            'linked_record_id',
            'linked_record_name',
            'company_name',
            'particulars',
            'transaction_type',
            'sub_passport_number',
            'amount',
            'description',
            'reference_number',
        ]);

        // Only allow SSF/Welfare/Insurance updates for payment entries
        if ($entry->type === 'payment') {
            if (Schema::hasColumn('daybook_entries', 'ssf_amount')) {
                $updatePayload['ssf_amount'] = $request->get('ssf_amount');
            }
            if (Schema::hasColumn('daybook_entries', 'welfare_amount')) {
                $updatePayload['welfare_amount'] = $request->get('welfare_amount');
            }
            if (Schema::hasColumn('daybook_entries', 'insurance_amount')) {
                $updatePayload['insurance_amount'] = $request->get('insurance_amount');
            }
        }

        $entry->update($updatePayload);

        $this->logActivity(
            $request,
            'Daybook Entry Updated',
            'Finance',
            'Updated daybook entry with ID: ' . $id
        );

        return response()->json([
            'success' => true,
            'message' => 'Daybook entry updated successfully',
            'data' => $entry->load('creator:id,full_name,name', 'expenseHead:id,name'),
        ]);
    }

    /**
     * Delete a daybook entry
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        $entry = DaybookEntry::find($id);

        if (!$entry) {
            return response()->json([
                'success' => false,
                'error_code' => 'DAYBOOK_ENTRY_NOT_FOUND',
                'message' => 'Daybook entry not found.',
            ], 404);
        }

        if ($entry->approval_status === 'approved') {
            return response()->json([
                'success' => false,
                'error_code' => 'DAYBOOK_APPROVED',
                'message' => 'Approved daybook entries cannot be deleted.',
            ], 403);
        }

        // Enforce delete lock based on configured hours (default 72); restrict deletes for finance_officer
        $lockHours = (int) (cache()->get('daybook.edit_lock_hours', env('DAYBOOK_EDIT_WINDOW_HOURS', 72)) ?: 72);
        $entryDate = \Illuminate\Support\Carbon::parse($entry->entry_date ?? $entry->created_at);
        $hoursSince = now()->diffInHours($entryDate);
        $role = strtolower(str_replace(' ', '_', (string) ($request->user()->role ?? '')));
        if ($hoursSince > $lockHours && !in_array($role, ['superadmin', 'super_admin', 'admin'], true)) {
            return response()->json([
                'success' => false,
                'error_code' => 'DAYBOOK_LOCKED',
                'message' => 'This entry is locked for deletion after configured time. Contact admin or superadmin.'
            ], 403);
        }

        $amount = $entry->amount;
        $type = $entry->type;
        $entry->delete();

        $this->logActivity(
            $request,
            'Daybook Entry Deleted',
            'Finance',
            'Deleted daybook ' . $type . ' entry for amount: ' . number_format((float)$amount, 2)
        );

        return response()->json([
            'success' => true,
            'message' => 'Daybook entry deleted successfully',
        ]);
    }

    /**
     * Get daybook summary for a date
     */
    public function summary(Request $request): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        $date = $request->get('date', now()->toDateString());

        $totalReceipts = DaybookEntry::receipts()->byDate($date)->sum('amount');
        $totalPayments = DaybookEntry::payments()->byDate($date)->sum('amount');
        $pendingQuery = DaybookEntry::where('approval_status', 'pending')->byDate($date);
        $pendingAmount = (float) $pendingQuery->sum('amount');

        return response()->json([
            'success' => true,
            'data' => [
                'date' => $date,
                'total_receipts' => (float)$totalReceipts,
                'total_payments' => (float)$totalPayments,
                'net_balance' => (float)($totalReceipts - $totalPayments),
                'receipt_count' => DaybookEntry::receipts()->byDate($date)->count(),
                'payment_count' => DaybookEntry::payments()->byDate($date)->count(),
                'pending_amount' => $pendingAmount,
                'pending_count' => (int) $pendingQuery->count(),
                'pending_receipts' => (float) DaybookEntry::receipts()->byDate($date)->where('approval_status', 'pending')->sum('amount'),
                'pending_payments' => (float) DaybookEntry::payments()->byDate($date)->where('approval_status', 'pending')->sum('amount'),
            ],
        ]);
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
        if (!in_array($role, ['admin', 'finance_officer', 'superadmin', 'super_admin', 'account'], true)) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_FORBIDDEN',
                'message' => 'You do not have access to finance management.',
            ], 403);
        }

        return null;
    }

    // Approve a daybook entry (superadmin only)
    public function approve(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        if ($authError = $this->ensureSuperAdmin($request)) {
            return $authError;
        }

        $entry = DaybookEntry::find($id);
        if (!$entry) {
            return response()->json(['success' => false, 'message' => 'Entry not found'], 404);
        }

        $entry->update([
            'approval_status' => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);

        $this->logActivity($request, 'Daybook Entry Approved', 'Finance', 'Approved daybook entry ID: ' . $id);

        return response()->json(['success' => true, 'message' => 'Entry approved', 'data' => $entry]);
    }

    // Reject a daybook entry (superadmin only)
    public function reject(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        if ($authError = $this->ensureSuperAdmin($request)) {
            return $authError;
        }

        $entry = DaybookEntry::find($id);
        if (!$entry) {
            return response()->json(['success' => false, 'message' => 'Entry not found'], 404);
        }

        $entry->update([
            'approval_status' => 'rejected',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);

        $this->logActivity($request, 'Daybook Entry Rejected', 'Finance', 'Rejected daybook entry ID: ' . $id);

        return response()->json(['success' => true, 'message' => 'Entry rejected', 'data' => $entry]);
    }

    // Get or set daybook settings (edit lock hours)
    public function getSettings(Request $request): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        $hours = (int) cache()->get('daybook.edit_lock_hours', env('DAYBOOK_EDIT_WINDOW_HOURS', 24));
        return response()->json(['success' => true, 'data' => ['edit_lock_hours' => $hours]]);
    }

    public function setSettings(Request $request): JsonResponse
    {
        if ($authError = $this->ensureFinanceAccess($request)) {
            return $authError;
        }

        if ($authError = $this->ensureSuperAdmin($request)) {
            return $authError;
        }

        $validator = Validator::make($request->all(), [
            'edit_lock_hours' => 'required|integer|min:0|max:168',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validation failed', 'errors' => $validator->errors()], 422);
        }

        cache()->put('daybook.edit_lock_hours', (int) $request->get('edit_lock_hours'));

        return response()->json(['success' => true, 'message' => 'Settings saved']);
    }

    private function ensureSuperAdmin(Request $request): ?JsonResponse
    {
        $authUser = $request->user();
        $role = strtolower(str_replace(' ', '_', (string) ($authUser->role ?? '')));
        if (!$authUser || !in_array($role, ['superadmin', 'super_admin', 'admin'], true)) {
            return response()->json(['success' => false, 'error_code' => 'AUTH_FORBIDDEN', 'message' => 'Superadmin (or admin) access required.'], 403);
        }
        return null;
    }

    private function logActivity(Request $request, string $action, string $module, string $description): void
    {
        try {
            \Illuminate\Support\Facades\DB::table('activity_logs')->insert([
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

}
