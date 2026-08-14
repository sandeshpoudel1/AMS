<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('project_settings', 'total_demand')) {
                $table->integer('total_demand')->nullable()->after('country');
            }
        });
    }

    public function down(): void
    {
        Schema::table('project_settings', function (Blueprint $table) {
            if (Schema::hasColumn('project_settings', 'total_demand')) {
                $table->dropColumn('total_demand');
            }
        });
    }
};
