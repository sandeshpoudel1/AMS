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
            $table->string('visa_received_status', 20)->default('not_received')->after('mol_status');
            $table->string('medical_online_status', 20)->default('not_done')->after('visa_received_status');
            $table->string('orientation_online_status', 20)->default('not_done')->after('medical_online_status');
            $table->date('ticket_date')->nullable()->after('orientation_online_status');
            $table->string('deployment_status', 20)->default('pending')->after('ticket_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('visa_pipeline_entries', function (Blueprint $table) {
            $table->dropColumn([
                'visa_received_status',
                'medical_online_status',
                'orientation_online_status',
                'ticket_date',
                'deployment_status',
            ]);
        });
    }
};
