<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProjectSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ProjectSettingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($authError = $this->ensureProjectReadAccess($request)) {
            return $authError;
        }

        $query = ProjectSetting::query();

        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where(function ($q) use ($search) {
                $q->where('project_name', 'like', '%' . $search . '%')
                    ->orWhere('agency_name', 'like', '%' . $search . '%')
                    ->orWhere('trade', 'like', '%' . $search . '%')
                    ->orWhere('project_reference_code', 'like', '%' . $search . '%')
                    ->orWhere('note', 'like', '%' . $search . '%')
                    ->orWhere('bd', 'like', '%' . $search . '%')
                    ->orWhere('client', 'like', '%' . $search . '%');
            });
        }

        if ($request->filled('is_active')) {
            $isActive = filter_var($request->get('is_active'), FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
            if ($isActive !== null) {
                $query->where('is_active', $isActive);
            }
        }

        $rows = $query->orderByDesc('id')->get();

        return response()->json([
            'success' => true,
            'data' => $rows,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($authError = $this->ensureAdminAccess($request)) {
            return $authError;
        }

        $validator = Validator::make($request->all(), [
            'project_name' => 'required|string|max:120',
            'agency_name' => 'nullable|string|max:255',
            'project_start_date' => 'nullable|date',
            'trade' => 'nullable|string|max:120',
            'number_of_requirements' => 'nullable|integer|min:1',
            'total_demand' => 'nullable|integer|min:1',
            'salary_per_trade' => 'nullable|numeric|min:0',
            'project_reference_code' => 'nullable|string|max:50',
            'office_rate_per_trade' => 'nullable|numeric|min:0',
            'country' => 'nullable|string|max:120',
            'note' => 'nullable|string|max:500',
            'is_active' => 'sometimes|boolean',
            'bd' => 'nullable|string|max:120',
            'client' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'PROJECT_SETTING_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $payload = [
            'project_name' => trim((string) $request->get('project_name')),
            'agency_name' => trim((string) $request->get('agency_name', $request->get('agency'))),
            'project_start_date' => $request->filled('project_start_date') ? $request->get('project_start_date') : now()->toDateString(),
            'country' => $request->filled('country') ? trim((string) $request->get('country')) : null,
            'note' => $request->get('note'),
            'is_active' => $request->has('is_active') ? (bool) $request->get('is_active') : true,
            'created_by' => optional($request->user())->id,
            'bd' => $request->get('bd'),
            'client' => $request->get('client'),
        ];

        if ($request->filled('agency_id')) {
            $payload['agency_id'] = (int) $request->get('agency_id');
        }

        if ($request->filled('project_start_date')) {
            $payload['project_start_date'] = $request->get('project_start_date');
        }

        if ($request->filled('trade')) {
            $payload['trade'] = trim((string) $request->get('trade'));
        }

        if ($request->filled('number_of_requirements')) {
            $payload['number_of_requirements'] = (int) $request->get('number_of_requirements');
        }

        if ($request->filled('salary_per_trade')) {
            $payload['salary_per_trade'] = (float) $request->get('salary_per_trade');
        }

        if ($request->filled('food_per_trade')) {
            $payload['food_per_trade'] = (float) $request->get('food_per_trade');
        }

        if ($request->filled('allowance_per_trade')) {
            $payload['allowance_per_trade'] = (float) $request->get('allowance_per_trade');
        }

        if ($request->filled('project_reference_code')) {
            $payload['project_reference_code'] = trim((string) $request->get('project_reference_code'));
        }

        if ($request->filled('total_demand')) {
            $payload['total_demand'] = (int) $request->get('total_demand');
        }

        if ($request->filled('office_rate_per_trade')) {
            $payload['office_rate_per_trade'] = (float) $request->get('office_rate_per_trade');
        }

        $row = ProjectSetting::create($payload);

        return response()->json([
            'success' => true,
            'message' => 'Project mapping created successfully',
            'data' => $row,
        ], 201);
    }

    private function ensureProjectReadAccess(Request $request): ?JsonResponse
    {
        $authUser = $request->user();

        if (!$authUser) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_UNAUTHENTICATED',
                'message' => 'Unauthenticated.',
            ], 401);
        }

        $allowed = ['admin', 'superadmin', 'super_admin', 'finance_officer', 'candidate_officer', 'documentation', 'documentation_head', 'account'];
        if (!in_array($authUser->role, $allowed, true)) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_FORBIDDEN',
                'message' => 'You do not have access to project settings.',
            ], 403);
        }

        return null;
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureAdminAccess($request)) {
            return $authError;
        }

        $row = ProjectSetting::find($id);

        if (!$row) {
            return response()->json([
                'success' => false,
                'error_code' => 'PROJECT_SETTING_NOT_FOUND',
                'message' => 'Project mapping not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'project_name' => 'required|string|max:120',
            'agency_name' => 'nullable|string|max:255',
            'project_start_date' => 'nullable|date',
            'trade' => 'nullable|string|max:120',
            'number_of_requirements' => 'nullable|integer|min:1',
            'total_demand' => 'nullable|integer|min:1',
            'salary_per_trade' => 'nullable|numeric|min:0',
            'food_per_trade' => 'nullable|numeric|min:0',
            'allowance_per_trade' => 'nullable|numeric|min:0',
            'project_reference_code' => 'nullable|string|max:50',
            'office_rate_per_trade' => 'nullable|numeric|min:0',
            'country' => 'nullable|string|max:120',
            'note' => 'nullable|string|max:500',
            'is_active' => 'sometimes|boolean',
            'bd' => 'nullable|string|max:120',
            'client' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'PROJECT_SETTING_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $payload = [
            'project_name' => trim((string) $request->get('project_name')),
            'agency_name' => trim((string) $request->get('agency_name', $request->get('agency'))),
            'country' => $request->filled('country') ? trim((string) $request->get('country')) : null,
            'note' => $request->get('note'),
            'is_active' => $request->has('is_active') ? (bool) $request->get('is_active') : $row->is_active,
            'bd' => $request->get('bd'),
            'client' => $request->get('client'),
        ];

        if ($request->filled('agency_id')) {
            $payload['agency_id'] = (int) $request->get('agency_id');
        }

        if ($request->filled('project_start_date')) {
            $payload['project_start_date'] = $request->get('project_start_date');
        }

        if ($request->filled('trade')) {
            $payload['trade'] = trim((string) $request->get('trade'));
        }

        if ($request->filled('number_of_requirements')) {
            $payload['number_of_requirements'] = (int) $request->get('number_of_requirements');
        }

        if ($request->filled('salary_per_trade')) {
            $payload['salary_per_trade'] = (float) $request->get('salary_per_trade');
        }

        if ($request->filled('food_per_trade')) {
            $payload['food_per_trade'] = (float) $request->get('food_per_trade');
        }

        if ($request->filled('allowance_per_trade')) {
            $payload['allowance_per_trade'] = (float) $request->get('allowance_per_trade');
        }

        if ($request->filled('project_reference_code')) {
            $payload['project_reference_code'] = trim((string) $request->get('project_reference_code'));
        }

        if ($request->filled('total_demand')) {
            $payload['total_demand'] = (int) $request->get('total_demand');
        }

        if ($request->filled('office_rate_per_trade')) {
            $payload['office_rate_per_trade'] = (float) $request->get('office_rate_per_trade');
        }

        $row->update($payload);

        return response()->json([
            'success' => true,
            'message' => 'Project mapping updated successfully',
            'data' => $row,
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureAdminAccess($request)) {
            return $authError;
        }

        $row = ProjectSetting::find($id);

        if (!$row) {
            return response()->json([
                'success' => false,
                'error_code' => 'PROJECT_SETTING_NOT_FOUND',
                'message' => 'Project mapping not found.',
            ], 404);
        }

        $row->delete();

        return response()->json([
            'success' => true,
            'message' => 'Project mapping deleted successfully',
        ]);
    }

    private function ensureAdminAccess(Request $request): ?JsonResponse
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
        if (!in_array($role, ['admin', 'superadmin', 'super_admin'], true)) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_FORBIDDEN',
                'message' => 'Only admin or superadmin can manage project mappings.',
            ], 403);
        }

        return null;
    }
}