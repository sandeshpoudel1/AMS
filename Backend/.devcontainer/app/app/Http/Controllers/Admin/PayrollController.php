<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PayrollController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['success' => true, 'message' => 'Payroll list placeholder', 'data' => []]);
    }

    public function create(): JsonResponse
    {
        return response()->json(['success' => true, 'message' => 'Payroll create placeholder']);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['success' => false, 'message' => 'Payroll store is not implemented yet.'], 501);
    }

    public function show(int $id): JsonResponse
    {
        return response()->json(['success' => true, 'message' => 'Payroll show placeholder', 'data' => ['id' => $id]]);
    }

    public function edit(int $id): JsonResponse
    {
        return response()->json(['success' => true, 'message' => 'Payroll edit placeholder', 'data' => ['id' => $id]]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        return response()->json(['success' => false, 'message' => 'Payroll update is not implemented yet.', 'data' => ['id' => $id]], 501);
    }

    public function destroy(int $id): JsonResponse
    {
        return response()->json(['success' => false, 'message' => 'Payroll delete is not implemented yet.', 'data' => ['id' => $id]], 501);
    }

    public function processPayroll(Request $request): JsonResponse
    {
        return response()->json(['success' => false, 'message' => 'Payroll processing is not implemented yet.'], 501);
    }
}
