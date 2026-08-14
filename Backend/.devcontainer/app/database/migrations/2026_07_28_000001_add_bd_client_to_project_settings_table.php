<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('project_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('project_settings', 'bd')) {
                $table->string('bd', 120)->nullable()->after('is_active');
            }
            if (!Schema::hasColumn('project_settings', 'client')) {
                $table->string('client', 255)->nullable()->after('bd');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('project_settings', function (Blueprint $table) {
            if (Schema::hasColumn('project_settings', 'client')) {
                $table->dropColumn('client');
            }
            if (Schema::hasColumn('project_settings', 'bd')) {
                $table->dropColumn('bd');
            }
        });
    }
};
