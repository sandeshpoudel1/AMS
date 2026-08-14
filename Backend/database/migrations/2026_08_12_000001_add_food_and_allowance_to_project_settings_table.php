<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('project_settings', 'food_per_trade')) {
                $table->decimal('food_per_trade', 10, 2)->nullable()->after('salary_per_trade');
            }

            if (!Schema::hasColumn('project_settings', 'allowance_per_trade')) {
                $table->decimal('allowance_per_trade', 10, 2)->nullable()->after('food_per_trade');
            }
        });
    }

    public function down(): void
    {
        Schema::table('project_settings', function (Blueprint $table) {
            if (Schema::hasColumn('project_settings', 'allowance_per_trade')) {
                $table->dropColumn('allowance_per_trade');
            }

            if (Schema::hasColumn('project_settings', 'food_per_trade')) {
                $table->dropColumn('food_per_trade');
            }
        });
    }
};
