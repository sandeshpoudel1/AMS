<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Candidate;
use App\Models\CandidateReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ReferenceController extends Controller
{
    /**
     * List all references for a candidate.
     */
    public function index(Request $request, int $candidateId): JsonResponse
    {
        if ($authError = $this->ensureAccess($request)) {
            return $authError;
        }

        $candidate = Candidate::find($candidateId);
        if (!$candidate) {
            return response()->json(['success' => false, 'message' => 'Candidate not found.'], 404);
        }

        $references = CandidateReference::where('candidate_id', $candidateId)
            ->with('creator:id,full_name,name', 'referredByCandidate:id,full_name,passport_number')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'references' => $references,
                'summary' => [
                    'total_references' => $references->count(),
                    'total_referees' => $references->sum('referee_count'),
                    'companies' => $references->pluck('recruitment_company')->filter()->unique()->values(),
                ],
            ],
        ]);
    }

    /**
     * Create a new reference entry for a candidate.
     */
    public function store(Request $request, int $candidateId): JsonResponse
    {
        if ($authError = $this->ensureAccess($request)) {
            return $authError;
        }

        $candidate = Candidate::find($candidateId);
        if (!$candidate) {
            return response()->json(['success' => false, 'message' => 'Candidate not found.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'referred_by_candidate_id' => 'nullable|exists:candidates,id',
            'referred_by_name' => 'nullable|string|max:255',
            'recruitment_company' => 'nullable|string|max:255',
            'referee_count' => 'nullable|integer|min:1',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        // If a candidate is selected, clear manual name (use candidate name as display)
        $referredByCandidateId = $request->get('referred_by_candidate_id');
        $referredByName = $referredByCandidateId ? null : $request->get('referred_by_name');

        $reference = CandidateReference::create([
            'candidate_id' => $candidateId,
            'referred_by_candidate_id' => $referredByCandidateId,
            'reference_id' => CandidateReference::generateReferenceId(),
            'referred_by_name' => $referredByName,
            'recruitment_company' => $request->get('recruitment_company'),
            'referee_count' => $request->get('referee_count', 1),
            'notes' => $request->get('notes'),
            'created_by' => $request->user()->id,
        ]);

        $this->logActivity($request, 'Reference Added', 'Reference', "Added reference {$reference->reference_id} for candidate {$candidate->full_name}");

        return response()->json([
            'success' => true,
            'message' => 'Reference added successfully',
            'data' => $reference->load('creator:id,full_name,name', 'referredByCandidate:id,full_name,passport_number'),
        ], 201);
    }

    /**
     * Update a reference entry.
     */
    public function update(Request $request, int $referenceId): JsonResponse
    {
        if ($authError = $this->ensureAccess($request)) {
            return $authError;
        }

        $reference = CandidateReference::find($referenceId);
        if (!$reference) {
            return response()->json(['success' => false, 'message' => 'Reference not found.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'referred_by_candidate_id' => 'nullable|exists:candidates,id',
            'referred_by_name' => 'nullable|string|max:255',
            'recruitment_company' => 'nullable|string|max:255',
            'referee_count' => 'nullable|integer|min:1',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $referredByCandidateId = $request->get('referred_by_candidate_id');
        $updates = $request->only(['recruitment_company', 'referee_count', 'notes']);
        $updates['referred_by_candidate_id'] = $referredByCandidateId;
        $updates['referred_by_name'] = $referredByCandidateId ? null : $request->get('referred_by_name');

        $reference->update($updates);

        $this->logActivity($request, 'Reference Updated', 'Reference', "Updated reference {$reference->reference_id}");

        return response()->json([
            'success' => true,
            'message' => 'Reference updated successfully',
            'data' => $reference->load('creator:id,full_name,name', 'referredByCandidate:id,full_name,passport_number'),
        ]);
    }

    /**
     * Delete a reference entry.
     */
    public function destroy(Request $request, int $referenceId): JsonResponse
    {
        if ($authError = $this->ensureAccess($request)) {
            return $authError;
        }

        $reference = CandidateReference::find($referenceId);
        if (!$reference) {
            return response()->json(['success' => false, 'message' => 'Reference not found.'], 404);
        }

        $refId = $reference->reference_id;
        $reference->delete();

        $this->logActivity($request, 'Reference Deleted', 'Reference', "Deleted reference {$refId}");

        return response()->json(['success' => true, 'message' => 'Reference deleted successfully']);
    }

    private function ensureAccess(Request $request): ?JsonResponse
    {
        $authUser = $request->user();

        if (!$authUser) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $role = strtolower(str_replace(' ', '_', (string) ($authUser->role ?? '')));
        if (!in_array($role, ['admin', 'candidate_officer', 'superadmin', 'super_admin'], true)) {
            return response()->json(['success' => false, 'message' => 'Access denied.'], 403);
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
            // Non-blocking
        }
    }
}
