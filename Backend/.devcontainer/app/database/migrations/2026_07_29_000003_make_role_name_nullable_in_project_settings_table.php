<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('project_settings') && Schema::hasColumn('project_settings', 'role_name')) {
            DB::statement('ALTER TABLE project_settings ALTER COLUMN role_name DROP NOT NULL');
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('project_settings') && Schema::hasColumn('project_settings', 'role_name')) {
            DB::statement("UPDATE project_settings SET role_name = '' WHERE role_name IS NULL");
            DB::statement('ALTER TABLE project_settings ALTER COLUMN role_name SET NOT NULL');
        }
    }
};
