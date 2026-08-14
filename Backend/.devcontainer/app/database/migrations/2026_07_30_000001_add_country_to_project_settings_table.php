<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('project_settings') && !Schema::hasColumn('project_settings', 'country')) {
            Schema::table('project_settings', function (Blueprint $table) {
                $table->string('country', 120)->nullable()->after('office_rate_per_trade');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('project_settings') && Schema::hasColumn('project_settings', 'country')) {
            Schema::table('project_settings', function (Blueprint $table) {
                $table->dropColumn('country');
            });
        }
    }
};
