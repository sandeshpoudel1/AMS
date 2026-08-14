<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ReferenceSource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ReferenceSourceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($authError = $this->ensureViewAccess($request)) {
            return $authError;
        }

        $query = ReferenceSource::query();

        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where(function ($q) use ($search) {
                $q->where('reference_name', 'like', '%' . $search . '%')
                    ->orWhere('contact_number', 'like', '%' . $search . '%')
                    ->orWhere('email', 'like', '%' . $search . '%')
                    ->orWhere('source_company', 'like', '%' . $search . '%')
                    ->orWhere('notes', 'like', '%' . $search . '%');
            });
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
            'reference_name' => 'required|string|max:255',
            'contact_number' => 'required|string|max:50',
            'email' => 'required|email|max:255',
            'source_company' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:500',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'REFERENCE_SOURCE_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $row = ReferenceSource::create([
            'reference_name' => trim((string) $request->get('reference_name')),
            'contact_number' => trim((string) $request->get('contact_number')),
            'email' => trim((string) $request->get('email')),
            'source_company' => $request->filled('source_company') ? trim((string) $request->get('source_company')) : null,
            'notes' => $request->filled('notes') ? trim((string) $request->get('notes')) : null,
            'is_active' => $request->has('is_active') ? (bool) $request->get('is_active') : true,
            'created_by' => optional($request->user())->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Reference created successfully',
            'data' => $row,
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureAdminAccess($request)) {
            return $authError;
        }

        $row = ReferenceSource::find($id);

        if (!$row) {
            return response()->json([
                'success' => false,
                'error_code' => 'REFERENCE_SOURCE_NOT_FOUND',
                'message' => 'Reference not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'reference_name' => 'required|string|max:255',
            'contact_number' => 'required|string|max:50',
            'email' => 'required|email|max:255',
            'source_company' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:500',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'REFERENCE_SOURCE_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $row->update([
            'reference_name' => trim((string) $request->get('reference_name')),
            'contact_number' => trim((string) $request->get('contact_number')),
            'email' => trim((string) $request->get('email')),
            'source_company' => $request->filled('source_company') ? trim((string) $request->get('source_company')) : null,
            'notes' => $request->filled('notes') ? trim((string) $request->get('notes')) : null,
            'is_active' => $request->has('is_active') ? (bool) $request->get('is_active') : $row->is_active,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Reference updated successfully',
            'data' => $row,
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureAdminAccess($request)) {
            return $authError;
        }

        $row = ReferenceSource::find($id);

        if (!$row) {
            return response()->json([
                'success' => false,
                'error_code' => 'REFERENCE_SOURCE_NOT_FOUND',
                'message' => 'Reference not found.',
            ], 404);
        }

        $row->delete();

        return response()->json([
            'success' => true,
            'message' => 'Reference deleted successfully',
        ]);
    }

    private function ensureViewAccess(Request $request): ?JsonResponse
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
        if (!in_array($role, ['admin', 'finance_officer', 'candidate_officer', 'documentation', 'documentation_head', 'account', 'superadmin', 'super_admin'], true)) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_FORBIDDEN',
                'message' => 'You do not have access to reference sources.',
            ], 403);
        }

        return null;
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
        if (!in_array($role, ['admin', 'documentation', 'documentation_head', 'superadmin', 'super_admin'], true)) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_FORBIDDEN',
                'message' => 'Only admin or documentation users can manage reference sources.',
            ], 403);
        }

        return null;
    }
}
