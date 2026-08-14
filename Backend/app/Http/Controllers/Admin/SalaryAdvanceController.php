<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SalaryAdvanceController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['success' => true, 'message' => 'Salary advance list placeholder', 'data' => []]);
    }

    public function create(): JsonResponse
    {
        return response()->json(['success' => true, 'message' => 'Salary advance create placeholder']);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['success' => false, 'message' => 'Salary advance store is not implemented yet.'], 501);
    }

    public function show(int $id): JsonResponse
    {
        return response()->json(['success' => true, 'message' => 'Salary advance show placeholder', 'data' => ['id' => $id]]);
    }

    public function edit(int $id): JsonResponse
    {
        return response()->json(['success' => true, 'message' => 'Salary advance edit placeholder', 'data' => ['id' => $id]]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        return response()->json(['success' => false, 'message' => 'Salary advance update is not implemented yet.', 'data' => ['id' => $id]], 501);
    }

    public function destroy(int $id): JsonResponse
    {
        return response()->json(['success' => false, 'message' => 'Salary advance delete is not implemented yet.', 'data' => ['id' => $id]], 501);
    }

    public function approve(int $advance): JsonResponse
    {
        return response()->json(['success' => false, 'message' => 'Salary advance approval is not implemented yet.', 'data' => ['id' => $advance]], 501);
    }
}
