<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('project_settings', 'salary_per_trade')) {
                $table->decimal('salary_per_trade', 10, 2)->nullable()->after('number_of_requirements');
            }
        });
    }

    public function down(): void
    {
        Schema::table('project_settings', function (Blueprint $table) {
            if (Schema::hasColumn('project_settings', 'salary_per_trade')) {
                $table->dropColumn('salary_per_trade');
            }
        });
    }
};
