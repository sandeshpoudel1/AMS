<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TrainingCompany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class TrainingCompanyController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $query = TrainingCompany::query();

        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where(function ($q) use ($search) {
                $q->where('company_name', 'like', '%' . $search . '%')
                    ->orWhere('phone', 'like', '%' . $search . '%')
                    ->orWhere('email', 'like', '%' . $search . '%')
                    ->orWhere('country', 'like', '%' . $search . '%')
                    ->orWhere('invoice_number', 'like', '%' . $search . '%');
            });
        }

        $companies = $query->orderByDesc('id')->get();

        return response()->json([
            'success' => true,
            'data' => $companies,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $validator = Validator::make($request->all(), [
            'company_name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'country' => 'nullable|string|max:100',
            'invoice_number' => 'nullable|string|max:100',
            'invoice_amount' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'TRAINING_COMPANY_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $company = TrainingCompany::create([
            'company_name' => trim((string) $request->get('company_name')),
            'phone' => $request->get('phone'),
            'email' => $request->get('email'),
            'country' => $request->get('country'),
            'invoice_number' => $request->get('invoice_number'),
            'invoice_amount' => $request->get('invoice_amount', 0),
            'notes' => $request->get('notes'),
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Training company created successfully',
            'data' => $company,
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $company = TrainingCompany::find($id);

        if (!$company) {
            return response()->json([
                'success' => false,
                'error_code' => 'TRAINING_COMPANY_NOT_FOUND',
                'message' => 'Training company not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'company_name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'country' => 'nullable|string|max:100',
            'invoice_number' => 'nullable|string|max:100',
            'invoice_amount' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'TRAINING_COMPANY_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $company->update([
            'company_name' => trim((string) $request->get('company_name')),
            'phone' => $request->get('phone'),
            'email' => $request->get('email'),
            'country' => $request->get('country'),
            'invoice_number' => $request->get('invoice_number'),
            'invoice_amount' => $request->get('invoice_amount', 0),
            'notes' => $request->get('notes'),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Training company updated successfully',
            'data' => $company,
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if ($authError = $this->ensureCandidateAccess($request)) {
            return $authError;
        }

        $company = TrainingCompany::find($id);

        if (!$company) {
            return response()->json([
                'success' => false,
                'error_code' => 'TRAINING_COMPANY_NOT_FOUND',
                'message' => 'Training company not found.',
            ], 404);
        }

        $company->delete();

        return response()->json([
            'success' => true,
            'message' => 'Training company deleted successfully',
        ]);
    }

    private function ensureCandidateAccess(Request $request): ?JsonResponse
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
        if (!in_array($role, ['admin', 'candidate_officer', 'superadmin', 'super_admin'], true)) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_FORBIDDEN',
                'message' => 'You do not have access to training management.',
            ], 403);
        }

        return null;
    }
}
