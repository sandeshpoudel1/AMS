<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($adminError = $this->ensureAdmin($request)) {
            return $adminError;
        }

        $perPage = min(max((int) $request->get('per_page', 15), 1), 100);
        $query = User::query()->with('profile');

        $authRole = strtolower(str_replace(' ', '_', (string) ($request->user()->role ?? '')));
        if ($authRole === 'admin') {
            $query->whereNotIn('role', ['super_admin', 'superadmin']);
        }

        if ($request->filled('search')) {
            $search = $request->get('search');

            $query->where(function ($q) use ($search) {
                $q->where('full_name', 'like', '%' . $search . '%')
                    ->orWhere('name', 'like', '%' . $search . '%')
                    ->orWhere('email', 'like', '%' . $search . '%')
                    ->orWhere('phone', 'like', '%' . $search . '%');
            });
        }

        if ($request->filled('role')) {
            $query->where('role', $request->get('role'));
        }

        if ($request->filled('is_active')) {
            $isActive = filter_var($request->get('is_active'), FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);

            if ($isActive !== null) {
                $query->where('is_active', $isActive);
            }
        }

        $users = $query->orderByDesc('id')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'users' => $users->items(),
            ],
            'pagination' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        if ($adminError = $this->ensureAdmin($request)) {
            return $adminError;
        }

        $user = User::with('profile')->find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'error_code' => 'USER_NOT_FOUND',
                'message' => 'User not found.',
            ], 404);
        }

        if ($this->isAdminRole($request->user()) && $this->isSuperAdminRole($user)) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_FORBIDDEN',
                'message' => 'Superadmin records are confidential and cannot be viewed by admin.',
            ], 403);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'user' => $user,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($adminError = $this->ensureUserManagementAccess($request)) {
            return $adminError;
        }

        $validator = Validator::make($request->all(), [
            'full_name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email',
            'password' => 'required|string|min:8|confirmed',
            'phone' => 'nullable|string|max:20',
            'role' => 'required|in:super_admin,admin,documentation,documentation_head,account,bd',
            'is_active' => 'sometimes|boolean',
            'address' => 'nullable|string',
            'date_of_birth' => 'nullable|date',
            'gender' => 'nullable|in:male,female,other',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'USER_CREATE_VALIDATION_FAILED',
                'message' => $validator->errors()->first() ?: 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        if ($this->isAdminRole($request->user()) && $this->isSuperAdminRoleValue((string) $request->role)) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_FORBIDDEN',
                'message' => 'Admin cannot create a superadmin account.',
            ], 403);
        }

        $user = User::create([
            'full_name' => $request->full_name,
            'name' => $request->full_name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'phone' => $request->phone,
            'role' => $request->role,
            'is_active' => $request->has('is_active') ? (bool) $request->is_active : true,
            'address' => $request->address,
            'date_of_birth' => $request->date_of_birth,
            'gender' => $request->gender,
        ]);

        $this->createProfileIfAvailable($user->id);
        $this->logActivity($request, 'User Created', 'User', 'Created user: ' . $user->email);

        return response()->json([
            'success' => true,
            'message' => 'User created successfully',
            'data' => [
                'user' => $user->load('profile'),
            ],
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $user = User::find($id);
        if ($adminError = $this->ensureUserManagementAccess($request, $user)) {
            return $adminError;
        }

        if (!$user) {
            return response()->json([
                'success' => false,
                'error_code' => 'USER_NOT_FOUND',
                'message' => 'User not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'full_name' => 'sometimes|required|string|max:255',
            'email' => 'sometimes|required|string|email|max:255|unique:users,email,' . $id,
            'phone' => 'nullable|string|max:20',
            'role' => 'sometimes|in:super_admin,admin,documentation,documentation_head,account,bd',
            'is_active' => 'sometimes|boolean',
            'address' => 'nullable|string',
            'date_of_birth' => 'nullable|date',
            'gender' => 'nullable|in:male,female,other',
            'password' => 'sometimes|string|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'USER_UPDATE_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }
        $updates = $request->only([
            'full_name',
            'email',
            'phone',
            'role',
            'is_active',
            'address',
            'date_of_birth',
            'gender',
        ]);

        if ($this->isAdminRole($request->user()) && isset($updates['role']) && $this->isSuperAdminRoleValue((string) $updates['role'])) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_FORBIDDEN',
                'message' => 'Admin cannot assign the superadmin role.',
            ], 403);
        }

        if (isset($updates['full_name'])) {
            $updates['name'] = $updates['full_name'];
        }

        if ($request->filled('password')) {
            $updates['password'] = Hash::make($request->password);
        }

        $user->update($updates);
        $this->logActivity($request, 'User Updated', 'User', 'Updated user: ' . $user->email);

        return response()->json([
            'success' => true,
            'message' => 'User updated successfully',
            'data' => [
                'user' => $user->fresh()->load('profile'),
            ],
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = User::find($id);
        if ($adminError = $this->ensureUserManagementAccess($request, $user)) {
            return $adminError;
        }

        if (!$user) {
            return response()->json([
                'success' => false,
                'error_code' => 'USER_NOT_FOUND',
                'message' => 'User not found.',
            ], 404);
        }

        if ((int) $request->user()->id === (int) $id) {
            return response()->json([
                'success' => false,
                'error_code' => 'USER_DELETE_SELF_FORBIDDEN',
                'message' => 'You cannot delete your own account.',
            ], 422);
        }

        $email = $user->email;
        $user->delete();
        $this->logActivity($request, 'User Deleted', 'User', 'Deleted user: ' . $email);

        return response()->json([
            'success' => true,
            'message' => 'User deleted successfully',
        ]);
    }

    public function activate(Request $request, int $id): JsonResponse
    {
        return $this->setActiveState($request, $id, true);
    }

    public function deactivate(Request $request, int $id): JsonResponse
    {
        return $this->setActiveState($request, $id, false);
    }

    public function changeRole(Request $request, int $id): JsonResponse
    {
        $user = User::find($id);
        if ($adminError = $this->ensureUserManagementAccess($request, $user)) {
            return $adminError;
        }

        $validator = Validator::make($request->all(), [
            'role' => 'required|in:super_admin,admin,candidate_officer,finance_officer,hr_officer,management,candidate',
        ]);

        if ($this->isAdminRole($request->user()) && $this->isSuperAdminRoleValue((string) $request->role)) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_FORBIDDEN',
                'message' => 'Admin cannot assign the superadmin role.',
            ], 403);
        }

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'USER_CHANGE_ROLE_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'error_code' => 'USER_NOT_FOUND',
                'message' => 'User not found.',
            ], 404);
        }

        $user->role = $request->role;
        $user->save();

        $this->logActivity($request, 'User Role Changed', 'User', 'Role changed for user: ' . $user->email . ' to ' . $request->role);

        return response()->json([
            'success' => true,
            'message' => 'User role updated successfully',
            'data' => [
                'user' => $user->fresh()->load('profile'),
            ],
        ]);
    }

    private function setActiveState(Request $request, int $id, bool $isActive): JsonResponse
    {
        $user = User::find($id);
        if ($adminError = $this->ensureUserManagementAccess($request, $user)) {
            return $adminError;
        }

        if (!$user) {
            return response()->json([
                'success' => false,
                'error_code' => 'USER_NOT_FOUND',
                'message' => 'User not found.',
            ], 404);
        }

        $user->is_active = $isActive;
        $user->save();

        $this->logActivity(
            $request,
            $isActive ? 'User Activated' : 'User Deactivated',
            'User',
            ($isActive ? 'Activated user: ' : 'Deactivated user: ') . $user->email
        );

        return response()->json([
            'success' => true,
            'message' => $isActive ? 'User activated successfully' : 'User deactivated successfully',
            'data' => [
                'user' => $user->fresh()->load('profile'),
            ],
        ]);
    }

    private function ensureAdmin(Request $request): ?JsonResponse
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
                'message' => 'Admin or Super Admin access is required.',
            ], 403);
        }

        return null;
    }

    private function ensureUserManagementAccess(Request $request, ?User $targetUser = null): ?JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError) {
            return $authError;
        }

        if ($targetUser && $this->isSuperAdminRole($targetUser) && !$this->isSuperAdminRole($request->user())) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_FORBIDDEN',
                'message' => 'Superadmin records are confidential and cannot be managed by admin.',
            ], 403);
        }

        return null;
    }

    private function isAdminRole(?User $user): bool
    {
        if (!$user) {
            return false;
        }

        $role = strtolower(str_replace(' ', '_', (string) ($user->role ?? '')));
        return $role === 'admin';
    }

    private function isSuperAdminRoleValue(string $role): bool
    {
        $normalized = strtolower(str_replace(' ', '_', $role));
        return in_array($normalized, ['superadmin', 'super_admin'], true);
    }

    private function isSuperAdminRole(?User $user): bool
    {
        if (!$user) {
            return false;
        }

        $role = strtolower(str_replace(' ', '_', (string) ($user->role ?? '')));
        return in_array($role, ['superadmin', 'super_admin'], true);
    }

    private function createProfileIfAvailable(int $userId): void
    {
        try {
            DB::table('user_profiles')->insert([
                'user_id' => $userId,
                'nationality' => 'Nepali',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (QueryException $e) {
            // Non-blocking when profile table is not ready.
        }
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
        } catch (QueryException $e) {
            // Non-blocking when activity table is not ready.
        }
    }
}
