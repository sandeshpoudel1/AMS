<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agency;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

class AgencyController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($authError = $this->ensureAdminAccess($request)) {
            return $authError;
        }

        $query = Agency::query();

        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where(function ($q) use ($search) {
                $q->where('company_name', 'like', '%' . $search . '%')
                    ->orWhere('contact_person', 'like', '%' . $search . '%')
                    ->orWhere('contact_person_1', 'like', '%' . $search . '%')
                    ->orWhere('designation_1', 'like', '%' . $search . '%')
                    ->orWhere('phone_number_1', 'like', '%' . $search . '%')
                    ->orWhere('email_1', 'like', '%' . $search . '%')
                    ->orWhere('contact_person_2', 'like', '%' . $search . '%')
                    ->orWhere('designation_2', 'like', '%' . $search . '%')
                    ->orWhere('phone_number_2', 'like', '%' . $search . '%')
                    ->orWhere('email_2', 'like', '%' . $search . '%')
                    ->orWhere('country', 'like', '%' . $search . '%')
                    ->orWhere('note', 'like', '%' . $search . '%');
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
            'company_name' => 'required|string|max:255',
            'contact_person_1' => 'nullable|string|max:120',
            'designation_1' => 'nullable|string|max:120',
            'phone_number_1' => 'nullable|string|max:50',
            'email_1' => 'nullable|email|max:255',
            'contact_person_2' => 'nullable|string|max:120',
            'designation_2' => 'nullable|string|max:120',
            'phone_number_2' => 'nullable|string|max:50',
            'email_2' => 'nullable|email|max:255',
            'country' => 'nullable|string|max:120',
            'note' => 'nullable|string|max:500',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'AGENCY_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $row = Agency::create(array_merge(
            [
                'company_name' => trim((string) $request->get('company_name')),
                'country' => $request->filled('country') ? trim((string) $request->get('country')) : null,
                'note' => $request->filled('note') ? trim((string) $request->get('note')) : null,
                'is_active' => $request->has('is_active') ? (bool) $request->get('is_active') : true,
                'created_by' => optional($request->user())->id,
            ],
            $this->contactPayload($request)
        ));

        return response()->json([
            'success' => true,
            'message' => 'Agency created successfully',
            'data' => $row,
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureAdminAccess($request)) {
            return $authError;
        }

        $row = Agency::find($id);

        if (!$row) {
            return response()->json([
                'success' => false,
                'error_code' => 'AGENCY_NOT_FOUND',
                'message' => 'Agency not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'company_name' => 'required|string|max:255',
            'contact_person_1' => 'nullable|string|max:120',
            'designation_1' => 'nullable|string|max:120',
            'phone_number_1' => 'nullable|string|max:50',
            'email_1' => 'nullable|email|max:255',
            'contact_person_2' => 'nullable|string|max:120',
            'designation_2' => 'nullable|string|max:120',
            'phone_number_2' => 'nullable|string|max:50',
            'email_2' => 'nullable|email|max:255',
            'country' => 'nullable|string|max:120',
            'note' => 'nullable|string|max:500',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'AGENCY_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $row->update(array_merge(
            [
                'company_name' => trim((string) $request->get('company_name')),
                'country' => $request->filled('country') ? trim((string) $request->get('country')) : null,
                'note' => $request->filled('note') ? trim((string) $request->get('note')) : null,
                'is_active' => $request->has('is_active') ? (bool) $request->get('is_active') : $row->is_active,
            ],
            $this->contactPayload($request)
        ));

        return response()->json([
            'success' => true,
            'message' => 'Agency updated successfully',
            'data' => $row,
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureAdminAccess($request)) {
            return $authError;
        }

        $row = Agency::find($id);

        if (!$row) {
            return response()->json([
                'success' => false,
                'error_code' => 'AGENCY_NOT_FOUND',
                'message' => 'Agency not found.',
            ], 404);
        }

        $row->delete();

        return response()->json([
            'success' => true,
            'message' => 'Agency deleted successfully',
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
                'message' => 'Only admin or superadmin can manage agencies.',
            ], 403);
        }

        return null;
    }

    private function contactPayload(Request $request): array
    {
        $payload = [];

        $contactPerson1 = $request->filled('contact_person_1') ? trim((string) $request->get('contact_person_1')) : null;
        $designation1 = $request->filled('designation_1') ? trim((string) $request->get('designation_1')) : null;
        $phoneNumber1 = $request->filled('phone_number_1') ? trim((string) $request->get('phone_number_1')) : null;
        $email1 = $request->filled('email_1') ? trim((string) $request->get('email_1')) : null;
        $contactPerson2 = $request->filled('contact_person_2') ? trim((string) $request->get('contact_person_2')) : null;
        $designation2 = $request->filled('designation_2') ? trim((string) $request->get('designation_2')) : null;
        $phoneNumber2 = $request->filled('phone_number_2') ? trim((string) $request->get('phone_number_2')) : null;
        $email2 = $request->filled('email_2') ? trim((string) $request->get('email_2')) : null;

        if (Schema::hasColumn('agencies', 'contact_person_1')) {
            $payload['contact_person_1'] = $contactPerson1;
        }
        if (Schema::hasColumn('agencies', 'designation_1')) {
            $payload['designation_1'] = $designation1;
        }
        if (Schema::hasColumn('agencies', 'phone_number_1')) {
            $payload['phone_number_1'] = $phoneNumber1;
        }
        if (Schema::hasColumn('agencies', 'email_1')) {
            $payload['email_1'] = $email1;
        }
        if (Schema::hasColumn('agencies', 'contact_person_2')) {
            $payload['contact_person_2'] = $contactPerson2;
        }
        if (Schema::hasColumn('agencies', 'designation_2')) {
            $payload['designation_2'] = $designation2;
        }
        if (Schema::hasColumn('agencies', 'phone_number_2')) {
            $payload['phone_number_2'] = $phoneNumber2;
        }
        if (Schema::hasColumn('agencies', 'email_2')) {
            $payload['email_2'] = $email2;
        }

        if (Schema::hasColumn('agencies', 'contact_person')) {
            $payload['contact_person'] = $contactPerson1;
        }
        if (Schema::hasColumn('agencies', 'email')) {
            $payload['email'] = $email1;
        }
        if (Schema::hasColumn('agencies', 'phone')) {
            $payload['phone'] = $phoneNumber1;
        }

        return $payload;
    }
}
