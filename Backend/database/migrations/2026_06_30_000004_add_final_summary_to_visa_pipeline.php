<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('visa_pipeline_entries', function (Blueprint $table) {
            // Final summary fields
            $table->decimal('visa_stamping_ksa', 14, 2)->default(0)->after('final_approval_fee_shram');
            // total_expenses = sum of all expenses (computed in model)
            // p_l = profit/loss (computed in model)
            // grand_total_expenses = computed in model
            // grand_total_amount_due = computed in model
        });
    }

    public function down(): void
    {
        Schema::table('visa_pipeline_entries', function (Blueprint $table) {
            $table->dropColumn('visa_stamping_ksa');
        });
    }
};
