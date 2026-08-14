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
        Schema::table('visa_pipeline_entries', function (Blueprint $table) {
            if (!Schema::hasColumn('visa_pipeline_entries', 'office_rate')) {
                $table->decimal('office_rate', 12, 2)->nullable()->default(0)->after('country');
            }
            if (!Schema::hasColumn('visa_pipeline_entries', 'is_payment_booked')) {
                $table->boolean('is_payment_booked')->default(false)->after('office_rate');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('visa_pipeline_entries', function (Blueprint $table) {
            if (Schema::hasColumn('visa_pipeline_entries', 'office_rate')) {
                $table->dropColumn('office_rate');
            }
            if (Schema::hasColumn('visa_pipeline_entries', 'is_payment_booked')) {
                $table->dropColumn('is_payment_booked');
            }
        });
    }
};
