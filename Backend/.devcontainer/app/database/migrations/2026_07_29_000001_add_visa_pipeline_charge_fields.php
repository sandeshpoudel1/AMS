<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddVisaPipelineChargeFields extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('visa_pipeline_entries', function (Blueprint $table) {
            if (!Schema::hasColumn('visa_pipeline_entries', 'visa_charge')) {
                $table->decimal('visa_charge', 15, 2)->default(0)->after('visa_received_status');
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
            if (!Schema::hasColumn('visa_pipeline_entries', 'total_fee')) {
                $table->decimal('total_fee', 15, 2)->default(0)->after('additional_charge');
            }

            // advance payments
            if (!Schema::hasColumn('visa_pipeline_entries', 'advance_1')) {
                $table->decimal('advance_1', 15, 2)->default(0)->after('total_fee');
            }
            if (!Schema::hasColumn('visa_pipeline_entries', 'advance_2')) {
                $table->decimal('advance_2', 15, 2)->default(0)->after('advance_1');
            }
            if (!Schema::hasColumn('visa_pipeline_entries', 'advance_3')) {
                $table->decimal('advance_3', 15, 2)->default(0)->after('advance_2');
            }
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('visa_pipeline_entries', function (Blueprint $table) {
            if (Schema::hasColumn('visa_pipeline_entries', 'advance_3')) {
                $table->dropColumn('advance_3');
            }
            if (Schema::hasColumn('visa_pipeline_entries', 'advance_2')) {
                $table->dropColumn('advance_2');
            }
            if (Schema::hasColumn('visa_pipeline_entries', 'advance_1')) {
                $table->dropColumn('advance_1');
            }
            if (Schema::hasColumn('visa_pipeline_entries', 'total_fee')) {
                $table->dropColumn('total_fee');
            }
            if (Schema::hasColumn('visa_pipeline_entries', 'additional_charge')) {
                $table->dropColumn('additional_charge');
            }
            if (Schema::hasColumn('visa_pipeline_entries', 'service_charge')) {
                $table->dropColumn('service_charge');
            }
            if (Schema::hasColumn('visa_pipeline_entries', 'qvc_charge')) {
                $table->dropColumn('qvc_charge');
            }
            if (Schema::hasColumn('visa_pipeline_entries', 'vfs_charge')) {
                $table->dropColumn('vfs_charge');
            }
            if (Schema::hasColumn('visa_pipeline_entries', 'svp_charge')) {
                $table->dropColumn('svp_charge');
            }
            if (Schema::hasColumn('visa_pipeline_entries', 'fla_charge')) {
                $table->dropColumn('fla_charge');
            }
            if (Schema::hasColumn('visa_pipeline_entries', 'ticket_charge')) {
                $table->dropColumn('ticket_charge');
            }
            if (Schema::hasColumn('visa_pipeline_entries', 'visa_charge')) {
                $table->dropColumn('visa_charge');
            }
        });
    }
}
