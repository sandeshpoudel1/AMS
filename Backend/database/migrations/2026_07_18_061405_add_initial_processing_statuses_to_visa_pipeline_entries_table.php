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
            $table->string('original_passport_status', 20)->default('not_received')->after('candidate_id');
            $table->string('photo_status', 20)->default('not_received')->after('original_passport_status');
            $table->string('pcc_status', 20)->default('not_received')->after('photo_status');
            $table->string('medical_status', 20)->default('not_received')->after('pcc_status');
            $table->string('qvc_status', 20)->default('not_received')->after('medical_status');
            $table->string('svp_status', 20)->default('not_received')->after('qvc_status');
            $table->string('vfs_status', 20)->default('not_received')->after('svp_status');
            $table->string('mol_status', 20)->default('not_received')->after('vfs_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('visa_pipeline_entries', function (Blueprint $table) {
            $table->dropColumn([
                'original_passport_status',
                'photo_status',
                'pcc_status',
                'medical_status',
                'qvc_status',
                'svp_status',
                'vfs_status',
                'mol_status',
            ]);
        });
    }
};
