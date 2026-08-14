<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('project_settings')) {
            return;
        }

        Schema::table('project_settings', function (Blueprint $table) {
            try {
                $table->dropUnique('project_settings_project_reference_code_unique');
            } catch (\Throwable $e) {
                // Constraint may not exist in some environments.
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('project_settings')) {
            return;
        }

        Schema::table('project_settings', function (Blueprint $table) {
            try {
                $table->unique('project_reference_code');
            } catch (\Throwable $e) {
                // Re-creation may fail if duplicates exist.
            }
        });
    }
};
