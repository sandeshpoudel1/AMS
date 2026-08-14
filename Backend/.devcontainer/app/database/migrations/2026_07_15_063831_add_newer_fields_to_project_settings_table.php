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
            if (!Schema::hasColumn('project_settings', 'project_start_date')) {
                $table->date('project_start_date')->nullable();
            }
            if (!Schema::hasColumn('project_settings', 'trade')) {
                $table->string('trade', 120)->nullable();
            }
            if (!Schema::hasColumn('project_settings', 'number_of_requirements')) {
                $table->integer('number_of_requirements')->nullable();
            }
            if (!Schema::hasColumn('project_settings', 'project_reference_code')) {
                $table->string('project_reference_code', 50)->nullable();
            }
            if (!Schema::hasColumn('project_settings', 'office_rate_per_trade')) {
                $table->decimal('office_rate_per_trade', 10, 2)->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('project_settings', function (Blueprint $table) {
            $table->dropColumn(['project_start_date', 'trade', 'number_of_requirements', 'project_reference_code', 'office_rate_per_trade']);
        });
    }
};
