<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class RemoveOldChargeFieldsFromVisaPipeline extends Migration
{
    /**
     * Run the migrations.
     * Drops now-unused charge columns added previously.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('visa_pipeline_entries', function (Blueprint $table) {
            if (Schema::hasColumn('visa_pipeline_entries', 'visa_charge')) {
                $table->dropColumn('visa_charge');
            }
            if (Schema::hasColumn('visa_pipeline_entries', 'ticket_charge')) {
                $table->dropColumn('ticket_charge');
            }
            if (Schema::hasColumn('visa_pipeline_entries', 'fla_charge')) {
                $table->dropColumn('fla_charge');
            }
            if (Schema::hasColumn('visa_pipeline_entries', 'svp_charge')) {
                $table->dropColumn('svp_charge');
            }
            if (Schema::hasColumn('visa_pipeline_entries', 'vfs_charge')) {
                $table->dropColumn('vfs_charge');
            }
            if (Schema::hasColumn('visa_pipeline_entries', 'qvc_charge')) {
                $table->dropColumn('qvc_charge');
            }
            if (Schema::hasColumn('visa_pipeline_entries', 'service_charge')) {
                $table->dropColumn('service_charge');
            }
            if (Schema::hasColumn('visa_pipeline_entries', 'additional_charge')) {
                $table->dropColumn('additional_charge');
            }
        });
    }

    /**
     * Reverse the migrations.
     * Recreates the dropped columns with the original types.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('visa_pipeline_entries', function (Blueprint $table) {
            if (!Schema::hasColumn('visa_pipeline_entries', 'visa_charge')) {
                $table->decimal('visa_charge', 15, 2)->default(0)->after('working_category');
            }
            if (!Schema::hasColumn('visa_pipeline_entries', 'ticket_charge')) {
                $table->decimal('ticket_charge', 15, 2)->default(0)->after('visa_charge');
            }
            if (!Schema::hasColumn('visa_pipeline_entries', 'fla_charge')) {
                $table->decimal('fla_charge', 15, 2)->default(0)->after('ticket_charge');
            }
            if (!Schema::hasColumn('visa_pipeline_entries', 'svp_charge')) {
                $table->decimal('svp_charge', 15, 2)->default(0)->after('fla_charge');
            }
            if (!Schema::hasColumn('visa_pipeline_entries', 'vfs_charge')) {
                $table->decimal('vfs_charge', 15, 2)->default(0)->after('svp_charge');
            }
            if (!Schema::hasColumn('visa_pipeline_entries', 'qvc_charge')) {
                $table->decimal('qvc_charge', 15, 2)->default(0)->after('vfs_charge');
            }
            if (!Schema::hasColumn('visa_pipeline_entries', 'service_charge')) {
                $table->decimal('service_charge', 15, 2)->default(0)->after('qvc_charge');
            }
            if (!Schema::hasColumn('visa_pipeline_entries', 'additional_charge')) {
                $table->decimal('additional_charge', 15, 2)->default(0)->after('service_charge');
            }
        });
    }
}
