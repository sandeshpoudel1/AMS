<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

class AppSettingController extends Controller
{
    private const STATUS_TEMPLATES_KEY = 'candidate_status_templates_v1';

    public function getStatusTemplates(Request $request): JsonResponse
    {
        if ($authError = $this->ensureAuthenticated($request)) {
            return $authError;
        }

        if (!Schema::hasTable('app_settings')) {
            return response()->json([
                'success' => true,
                'data' => [
                    'entries' => [],
                ],
                'meta' => [
                    'storage' => 'fallback',
                    'message' => 'app_settings table is not migrated yet.',
                ],
            ]);
        }

        $setting = AppSetting::query()->where('key', self::STATUS_TEMPLATES_KEY)->first();

        return response()->json([
            'success' => true,
            'data' => [
                'entries' => is_array($setting?->value) ? $setting->value : [],
            ],
        ]);
    }

    public function saveStatusTemplates(Request $request): JsonResponse
    {
        if ($authError = $this->ensureAdminAccess($request)) {
            return $authError;
        }

        if (!Schema::hasTable('app_settings')) {
            return response()->json([
                'success' => false,
                'error_code' => 'APP_SETTINGS_TABLE_MISSING',
                'message' => 'Status storage table is missing. Please run database migrations.',
            ], 503);
        }

        $validator = Validator::make($request->all(), [
            'entries' => 'required|array',
            'entries.*.key' => 'nullable|string|max:120',
            'entries.*.label' => 'required|string|max:120',
            'entries.*.status' => 'nullable|string|max:50',
            'entries.*.manual' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error_code' => 'APP_SETTING_VALIDATION_FAILED',
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $entries = collect($request->input('entries', []))
            ->map(function ($entry) {
                return [
                    'key' => isset($entry['key']) && $entry['key'] !== ''
                        ? trim((string) $entry['key'])
                        : 'tmpl_' . substr(md5((string) ($entry['label'] ?? uniqid('', true))), 0, 12),
                    'label' => trim((string) $entry['label']),
                    'status' => isset($entry['status']) ? trim((string) $entry['status']) : 'not_received',
                    'manual' => array_key_exists('manual', $entry) ? (bool) $entry['manual'] : true,
                ];
            })
            ->filter(fn ($entry) => $entry['label'] !== '')
            ->values()
            ->all();

        $setting = AppSetting::query()->updateOrCreate(
            ['key' => self::STATUS_TEMPLATES_KEY],
            [
                'value' => $entries,
                'created_by' => optional($request->user())->id,
                'updated_by' => optional($request->user())->id,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Status templates saved successfully',
            'data' => [
                'entries' => is_array($setting->value) ? $setting->value : [],
            ],
        ]);
    }

    private function ensureAuthenticated(Request $request): ?JsonResponse
    {
        if (!$request->user()) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_UNAUTHENTICATED',
                'message' => 'Unauthenticated.',
            ], 401);
        }

        return null;
    }

    private function ensureAdminAccess(Request $request): ?JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_UNAUTHENTICATED',
                'message' => 'Unauthenticated.',
            ], 401);
        }

        $role = strtolower(str_replace(' ', '_', (string) ($user->role ?? '')));
        if (!in_array($role, ['admin', 'documentation', 'documentation_head', 'superadmin', 'super_admin'], true)) {
            return response()->json([
                'success' => false,
                'error_code' => 'AUTH_FORBIDDEN',
                'message' => 'Only admin, documentation users, or superadmin can manage status templates.',
            ], 403);
        }

        return null;
    }
}