<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    private const LOGIN_MAX_ATTEMPTS = 5;
    private const LOGIN_DECAY_SECONDS = 60;
    private const TWO_FACTOR_CHALLENGE_TTL_SECONDS = 300;
    private const TWO_FACTOR_SETUP_TTL_SECONDS = 600;
    private const TOTP_STEP_SECONDS = 30;
    private const TOTP_DIGITS = 6;
    private const TOTP_DRIFT_STEPS = 1;

    /**
     * Register a new user
     */
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'full_name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'phone' => 'required|string|max:20',
            'role' => 'sometimes|in:super_admin,admin,documentation,documentation_head,account,bd',
            'address' => 'nullable|string',
            'date_of_birth' => 'nullable|date',
            'gender' => 'nullable|in:male,female,other',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_REGISTER_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = User::create([
            'full_name' => $request->full_name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'phone' => $request->phone,
            'role' => $request->role ?? 'candidate',
            'address' => $request->address,
            'date_of_birth' => $request->date_of_birth,
            'gender' => $request->gender,
        ]);

        // Create user profile when the table exists.
        try {
            DB::table('user_profiles')->insert([
                'user_id' => $user->id,
                'nationality' => $request->nationality ?? 'Nepali',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (\Throwable $e) {
            // Profile creation should not block registration when schema is incomplete.
        }

        // Log the activity
        $this->logActivity($user->id, 'User Registration', 'Auth', 'New user registered: ' . $user->email);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'User registered successfully',
            'data' => [
                'user' => $user,
                'token' => $token,
                'token_type' => 'Bearer'
            ]
        ], 201);
    }

    /**
     * Login user
     */
    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|string|email',
            'password' => 'required|string',
            'remember' => 'boolean'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_LOGIN_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        if ($throttleError = $this->ensureLoginIsNotRateLimited($request)) {
            return $throttleError;
        }

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            RateLimiter::hit($this->throttleKey($request), self::LOGIN_DECAY_SECONDS);
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_INVALID_CREDENTIALS',
                'message' => 'Invalid credentials'
            ], 401);
        }

        if (!$user->is_active) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_ACCOUNT_DEACTIVATED',
                'message' => 'Your account has been deactivated. Please contact administrator.'
            ], 403);
        }

        if (!Auth::attempt($request->only('email', 'password'), $request->remember ?? false)) {
            RateLimiter::hit($this->throttleKey($request), self::LOGIN_DECAY_SECONDS);
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_INVALID_CREDENTIALS',
                'message' => 'Invalid credentials'
            ], 401);
        }

        RateLimiter::clear($this->throttleKey($request));

        if ($user->two_factor_enabled && !empty($user->two_factor_secret)) {
            $challengeToken = Str::random(64);

            Cache::put(
                $this->twoFactorChallengeCacheKey($challengeToken),
                [
                    'user_id' => $user->id,
                    'remember' => (bool) ($request->remember ?? false),
                ],
                now()->addSeconds(self::TWO_FACTOR_CHALLENGE_TTL_SECONDS)
            );

            return response()->json([
                'success' => true,
                'message' => 'Two-factor authentication required',
                'data' => [
                    'requires_2fa' => true,
                    'challenge_token' => $challengeToken,
                    'user' => [
                        'id' => $user->id,
                        'email' => $user->email,
                        'full_name' => $user->full_name,
                        'role' => $user->role,
                        'role_label' => $user->role_label,
                    ],
                ],
            ]);
        }

        $user->updateLastLogin();
        $this->logActivity($user->id, 'User Login', 'Auth', 'User logged in');

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login successful',
            'data' => [
                'user' => $user->load('profile'),
                'token' => $token,
                'token_type' => 'Bearer',
                'role' => $user->role,
                'role_label' => $user->role_label,
                'requires_2fa' => false,
            ]
        ]);
    }

    public function verifyLoginTwoFactor(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'challenge_token' => 'required|string',
            'code' => 'required|string|size:6',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_2FA_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $cacheKey = $this->twoFactorChallengeCacheKey($request->challenge_token);
        $challenge = Cache::get($cacheKey);

        if (!$challenge || empty($challenge['user_id'])) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_2FA_CHALLENGE_EXPIRED',
                'message' => '2FA challenge expired. Please login again.',
            ], 401);
        }

        $user = User::find($challenge['user_id']);

        if (!$user || !$user->is_active || !$user->two_factor_enabled || empty($user->two_factor_secret)) {
            Cache::forget($cacheKey);

            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_2FA_ACCOUNT_INVALID',
                'message' => 'Account is not available for 2FA login.',
            ], 401);
        }

        if (!$this->verifyTotpCode($user->two_factor_secret, $request->code)) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_2FA_INVALID_CODE',
                'message' => 'Invalid verification code.',
            ], 422);
        }

        Cache::forget($cacheKey);

        $user->updateLastLogin();
        $this->logActivity($user->id, 'User Login (2FA)', 'Auth', 'User logged in with 2FA');

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login successful',
            'data' => [
                'user' => $user->load('profile'),
                'token' => $token,
                'token_type' => 'Bearer',
                'role' => $user->role,
                'role_label' => $user->role_label,
                'requires_2fa' => false,
            ],
        ]);
    }

    public function setupTwoFactor(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_UNAUTHENTICATED',
                'message' => 'Unauthenticated.',
            ], 401);
        }

        $secret = $this->generateTotpSecret();
        Cache::put($this->twoFactorSetupCacheKey($user->id), $secret, now()->addSeconds(self::TWO_FACTOR_SETUP_TTL_SECONDS));

        $issuer = 'MOPL RMS';
        $account = $user->email;
        $otpauth = sprintf(
            'otpauth://totp/%s:%s?secret=%s&issuer=%s&algorithm=SHA1&digits=%d&period=%d',
            rawurlencode($issuer),
            rawurlencode($account),
            $secret,
            rawurlencode($issuer),
            self::TOTP_DIGITS,
            self::TOTP_STEP_SECONDS
        );

        $qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=' . rawurlencode($otpauth);

        return response()->json([
            'success' => true,
            'message' => '2FA setup generated',
            'data' => [
                'secret' => $secret,
                'otpauth_url' => $otpauth,
                'qr_url' => $qrUrl,
            ],
        ]);
    }

    public function verifyTwoFactorSetup(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'code' => 'required|string|size:6',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_2FA_SETUP_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_UNAUTHENTICATED',
                'message' => 'Unauthenticated.',
            ], 401);
        }

        $secret = Cache::get($this->twoFactorSetupCacheKey($user->id));
        if (!$secret) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_2FA_SETUP_EXPIRED',
                'message' => '2FA setup expired. Generate setup again.',
            ], 422);
        }

        if (!$this->verifyTotpCode($secret, $request->code)) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_2FA_INVALID_CODE',
                'message' => 'Invalid verification code.',
            ], 422);
        }

        $user->forceFill([
            'two_factor_secret' => $secret,
            'two_factor_enabled' => true,
            'two_factor_confirmed_at' => now(),
        ])->save();

        Cache::forget($this->twoFactorSetupCacheKey($user->id));

        $this->logActivity($user->id, '2FA Enabled', 'Auth', 'User enabled two-factor authentication');

        return response()->json([
            'success' => true,
            'message' => 'Two-factor authentication enabled successfully',
            'data' => [
                'two_factor_enabled' => true,
            ],
        ]);
    }

    public function disableTwoFactor(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'password' => 'required|string',
            'code' => 'required|string|size:6',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_2FA_DISABLE_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_UNAUTHENTICATED',
                'message' => 'Unauthenticated.',
            ], 401);
        }

        if (!$user->two_factor_enabled || empty($user->two_factor_secret)) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_2FA_NOT_ENABLED',
                'message' => 'Two-factor authentication is not enabled.',
            ], 422);
        }

        if (!Hash::check($request->password, $user->password)) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_CURRENT_PASSWORD_INCORRECT',
                'message' => 'Current password is incorrect',
            ], 422);
        }

        if (!$this->verifyTotpCode($user->two_factor_secret, $request->code)) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_2FA_INVALID_CODE',
                'message' => 'Invalid verification code.',
            ], 422);
        }

        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_enabled' => false,
            'two_factor_confirmed_at' => null,
        ])->save();

        $this->logActivity($user->id, '2FA Disabled', 'Auth', 'User disabled two-factor authentication');

        return response()->json([
            'success' => true,
            'message' => 'Two-factor authentication disabled successfully',
            'data' => [
                'two_factor_enabled' => false,
            ],
        ]);
    }

    /**
     * Refresh current access token
     */
    public function refreshToken(Request $request)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_UNAUTHENTICATED',
                'message' => 'Unauthenticated.'
            ], 401);
        }

        $currentToken = $user->currentAccessToken();

        if ($currentToken) {
            $currentToken->delete();
        }

        $newToken = $user->createToken('auth_token')->plainTextToken;

        $this->logActivity($user->id, 'Token Refreshed', 'Auth', 'Access token refreshed');

        return response()->json([
            'success' => true,
            'message' => 'Token refreshed successfully',
            'data' => [
                'token' => $newToken,
                'token_type' => 'Bearer',
            ],
        ]);
    }

    /**
     * Logout user
     */
    public function logout(Request $request)
    {
        $user = $request->user();
        
        if ($user) {
            $this->logActivity($user->id, 'User Logout', 'Auth', 'User logged out');
            $user->tokens()->delete();
        }

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully'
        ]);
    }

    /**
     * Get authenticated user
     */
    public function user(Request $request)
    {
        $user = $request->user()->load('profile');
        
        return response()->json([
            'success' => true,
            'data' => [
                'user' => $user,
                'role' => $user->role,
                'role_label' => $user->role_label,
                'avatar' => $user->profile_photo_url,
                'two_factor_enabled' => (bool) $user->two_factor_enabled,
            ]
        ]);
    }

    private function ensureLoginIsNotRateLimited(Request $request): ?JsonResponse
    {
        $key = $this->throttleKey($request);

        if (!RateLimiter::tooManyAttempts($key, self::LOGIN_MAX_ATTEMPTS)) {
            return null;
        }

        $seconds = RateLimiter::availableIn($key);

        return response()->json([
            'success' => false,
            'error_code' => 'AUTH_TOO_MANY_ATTEMPTS',
            'message' => 'Too many login attempts. Try again later.',
            'meta' => [
                'retry_after_seconds' => $seconds,
            ],
        ], 429);
    }

    private function throttleKey(Request $request): string
    {
        return Str::lower((string) $request->input('email')) . '|' . (string) $request->ip();
    }

    private function twoFactorChallengeCacheKey(string $token): string
    {
        return 'auth:2fa:challenge:' . $token;
    }

    private function twoFactorSetupCacheKey(int $userId): string
    {
        return 'auth:2fa:setup:' . $userId;
    }

    private function generateTotpSecret(int $bytes = 20): string
    {
        return $this->base32Encode(random_bytes($bytes));
    }

    private function verifyTotpCode(string $base32Secret, string $code): bool
    {
        $normalized = preg_replace('/\s+/', '', strtoupper(trim($code)));
        if (!is_string($normalized) || strlen($normalized) !== self::TOTP_DIGITS || !ctype_digit($normalized)) {
            return false;
        }

        for ($window = -self::TOTP_DRIFT_STEPS; $window <= self::TOTP_DRIFT_STEPS; $window++) {
            if (hash_equals($this->generateTotpCode($base32Secret, time() + ($window * self::TOTP_STEP_SECONDS)), $normalized)) {
                return true;
            }
        }

        return false;
    }

    private function generateTotpCode(string $base32Secret, int $timestamp): string
    {
        $secret = $this->base32Decode($base32Secret);
        $counter = (int) floor($timestamp / self::TOTP_STEP_SECONDS);
        $binaryCounter = pack('N2', 0, $counter);
        $hash = hash_hmac('sha1', $binaryCounter, $secret, true);
        $offset = ord(substr($hash, -1)) & 0x0f;

        $binary =
            ((ord($hash[$offset]) & 0x7f) << 24)
            | ((ord($hash[$offset + 1]) & 0xff) << 16)
            | ((ord($hash[$offset + 2]) & 0xff) << 8)
            | (ord($hash[$offset + 3]) & 0xff);

        return str_pad((string) ($binary % (10 ** self::TOTP_DIGITS)), self::TOTP_DIGITS, '0', STR_PAD_LEFT);
    }

    private function base32Encode(string $data): string
    {
        if ($data === '') {
            return '';
        }

        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $binary = '';
        $length = strlen($data);

        for ($i = 0; $i < $length; $i++) {
            $binary .= str_pad(decbin(ord($data[$i])), 8, '0', STR_PAD_LEFT);
        }

        $chunks = str_split($binary, 5);
        $base32 = '';

        foreach ($chunks as $chunk) {
            if (strlen($chunk) < 5) {
                $chunk = str_pad($chunk, 5, '0', STR_PAD_RIGHT);
            }
            $base32 .= $alphabet[bindec($chunk)];
        }

        return $base32;
    }

    private function base32Decode(string $base32): string
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $base32 = strtoupper(trim($base32));
        $base32 = preg_replace('/[^A-Z2-7]/', '', $base32);

        if ($base32 === '') {
            return '';
        }

        $binary = '';
        $length = strlen($base32);

        for ($i = 0; $i < $length; $i++) {
            $position = strpos($alphabet, $base32[$i]);
            if ($position === false) {
                continue;
            }
            $binary .= str_pad(decbin($position), 5, '0', STR_PAD_LEFT);
        }

        $bytes = str_split($binary, 8);
        $output = '';

        foreach ($bytes as $byte) {
            if (strlen($byte) === 8) {
                $output .= chr(bindec($byte));
            }
        }

        return $output;
    }

    /**
     * Change password
     */
    public function changePassword(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|confirmed'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_CHANGE_PASSWORD_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = $request->user();

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_CURRENT_PASSWORD_INCORRECT',
                'message' => 'Current password is incorrect'
            ], 422);
        }

        $user->password = Hash::make($request->new_password);
        $user->save();

        $this->logActivity($user->id, 'Password Changed', 'Auth', 'Password changed successfully');

        return response()->json([
            'success' => true,
            'message' => 'Password changed successfully'
        ]);
    }

    /**
     * Forgot password
     */
    public function forgotPassword(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|string|email|exists:users,email'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_FORGOT_PASSWORD_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = User::where('email', $request->email)->first();
        $token = Str::random(60);
        
        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $request->email],
            [
                'token' => Hash::make($token),
                'created_at' => now()
            ]
        );

        $this->logActivity($user->id, 'Password Reset Request', 'Auth', 'Password reset requested');

        return response()->json([
            'success' => true,
            'message' => 'Password reset link sent to your email',
            'data' => app()->environment('local')
                ? ['reset_token' => $token] // Only for local testing
                : (object) []
        ]);
    }

    /**
     * Reset password
     */
    public function resetPassword(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|string|email|exists:users,email',
            'token' => 'required|string',
            'password' => 'required|string|min:8|confirmed'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_RESET_PASSWORD_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $reset = DB::table('password_reset_tokens')
            ->where('email', $request->email)
            ->first();

        if (!$reset || !Hash::check($request->token, $reset->token)) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_INVALID_OR_EXPIRED_RESET_TOKEN',
                'message' => 'Invalid or expired reset token'
            ], 422);
        }

        $user = User::where('email', $request->email)->first();
        $user->password = Hash::make($request->password);
        $user->save();

        DB::table('password_reset_tokens')->where('email', $request->email)->delete();
        $user->tokens()->delete();

        $this->logActivity($user->id, 'Password Reset', 'Auth', 'Password reset successfully');

        return response()->json([
            'success' => true,
            'message' => 'Password reset successfully'
        ]);
    }

    /**
     * Log activity
     */
    private function logActivity($userId, $action, $module, $description = null)
    {
        try {
            DB::table('activity_logs')->insert([
                'user_id' => $userId,
                'action' => $action,
                'module' => $module,
                'description' => $description,
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (\Throwable $e) {
            // Activity logging should not block auth flows when the table is unavailable.
        }
    }
}
