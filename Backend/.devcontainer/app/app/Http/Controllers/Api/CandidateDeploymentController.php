<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Candidate;
use App\Models\CandidateDeployment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class CandidateDeploymentController extends Controller
{
    public function index(Request $request, int $candidateId): JsonResponse
    {
        if ($authError = $this->ensureAccess($request)) {
            return $authError;
        }

        $candidate = Candidate::find($candidateId);
        if (!$candidate) {
            return response()->json(['success' => false, 'message' => 'Candidate not found.'], 404);
        }

        $deployments = CandidateDeployment::where('candidate_id', $candidateId)
            ->with('creator:id,full_name,name')
            ->orderByDesc('flight_date')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'deployments' => $deployments,
                'summary' => [
                    'count' => $deployments->count(),
                    'deployed' => $deployments->where('status', 'deployed')->count(),
                    'waiting' => $deployments->where('status', 'waiting')->count(),
                ],
            ],
        ]);
    }

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
            'destination' => 'required|string|max:150',
            'flight_ticket' => 'nullable|string|max:150',
            'flight_date' => 'nullable|date',
            'status' => 'required|in:waiting,deployed',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validation failed', 'errors' => $validator->errors()], 422);
        }

        $deployment = CandidateDeployment::create([
            'candidate_id' => $candidateId,
            'destination' => $request->get('destination'),
            'flight_ticket' => $request->get('flight_ticket'),
            'flight_date' => $request->get('flight_date'),
            'status' => $request->get('status', 'waiting'),
            'notes' => $request->get('notes'),
            'created_by' => optional($request->user())->id,
        ]);

        $this->logActivity($request, 'Candidate Deployment Added', 'CandidateDeployment',
            "Added deployment entry for {$candidate->full_name} to {$deployment->destination}");

        return response()->json([
            'success' => true,
            'message' => 'Deployment entry added successfully',
            'data' => $deployment->load('creator:id,full_name,name'),
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureAccess($request)) {
            return $authError;
        }

        $deployment = CandidateDeployment::find($id);
        if (!$deployment) {
            return response()->json(['success' => false, 'message' => 'Deployment entry not found.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'destination' => 'sometimes|required|string|max:150',
            'flight_ticket' => 'nullable|string|max:150',
            'flight_date' => 'nullable|date',
            'status' => 'sometimes|required|in:waiting,deployed',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validation failed', 'errors' => $validator->errors()], 422);
        }

        $deployment->update($request->only([
            'destination',
            'flight_ticket',
            'flight_date',
            'status',
            'notes',
        ]));

        $this->logActivity($request, 'Candidate Deployment Updated', 'CandidateDeployment', "Updated deployment entry #{$deployment->id}");

        return response()->json([
            'success' => true,
            'message' => 'Deployment entry updated successfully',
            'data' => $deployment->load('creator:id,full_name,name'),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureAccess($request)) {
            return $authError;
        }

        $deployment = CandidateDeployment::find($id);
        if (!$deployment) {
            return response()->json(['success' => false, 'message' => 'Deployment entry not found.'], 404);
        }

        $deployment->delete();

        $this->logActivity($request, 'Candidate Deployment Deleted', 'CandidateDeployment', "Deleted deployment entry #{$id}");

        return response()->json(['success' => true, 'message' => 'Deployment entry deleted successfully']);
    }

    private function ensureAccess(Request $request): ?JsonResponse
    {
        $authUser = $request->user();
        if (!$authUser) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $role = strtolower(str_replace(' ', '_', (string) ($authUser->role ?? '')));
        if (!in_array($role, ['admin', 'candidate_officer', 'finance_officer', 'superadmin', 'super_admin'], true)) {
            return response()->json(['success' => false, 'message' => 'Access denied.'], 403);
        }
        return null;
    }

    private function logActivity(Request $request, string $action, string $module, string $description): void
    {
        try {
            DB::table('activity_logs')->insert([
                'user_id'    => optional($request->user())->id,
                'action'     => $action,
                'module'     => $module,
                'description' => $description,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (\Throwable $e) { /* non-blocking */ }
    }
}
