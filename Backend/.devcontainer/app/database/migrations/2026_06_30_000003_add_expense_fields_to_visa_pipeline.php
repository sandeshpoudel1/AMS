<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('visa_pipeline_entries', function (Blueprint $table) {
            // Service Fee tracking
            $table->decimal('service_fee_company', 14, 2)->default(0)->after('advance_3');
            $table->decimal('service_fee_received', 14, 2)->default(0)->after('service_fee_company');
            // service_fee_due is computed: service_fee_company - service_fee_received

            // Ticket
            $table->string('ticket_by')->nullable()->after('service_fee_received');
            $table->decimal('ticket_expenses', 14, 2)->default(0)->after('ticket_by');

            // Expenses
            $table->decimal('admin_expenses', 14, 2)->default(0)->after('ticket_expenses');
            $table->decimal('other_topic_expense', 14, 2)->default(0)->after('admin_expenses');

            // Commission
            $table->decimal('commission_npr', 14, 2)->default(0)->after('other_topic_expense');

            // Remarks
            $table->text('remarks')->nullable()->after('commission_npr');

            // Document processing fees
            $table->decimal('skill_verification_payment', 14, 2)->default(0)->after('remarks');
            $table->decimal('pcc_attestation_charge', 14, 2)->default(0)->after('skill_verification_payment');
            $table->decimal('typing_stamping_charge', 14, 2)->default(0)->after('pcc_attestation_charge');

            // UNT
            $table->string('unt')->nullable()->after('typing_stamping_charge');
            $table->text('unt_remarks')->nullable()->after('unt');

            // Additional fees
            $table->decimal('demand_attestation_mofa_chamber_fee', 14, 2)->default(0)->after('unt_remarks');
            $table->decimal('translation_color_print_documentation', 14, 2)->default(0)->after('demand_attestation_mofa_chamber_fee');
            $table->string('fla_from')->nullable()->after('translation_color_print_documentation');
            $table->decimal('final_approval_fee_shram', 14, 2)->default(0)->after('fla_from');
        });
    }

    public function down(): void
    {
        Schema::table('visa_pipeline_entries', function (Blueprint $table) {
            $table->dropColumn([
                'service_fee_company', 'service_fee_received',
                'ticket_by', 'ticket_expenses',
                'admin_expenses', 'other_topic_expense', 'commission_npr', 'remarks',
                'skill_verification_payment', 'pcc_attestation_charge', 'typing_stamping_charge',
                'unt', 'unt_remarks',
                'demand_attestation_mofa_chamber_fee', 'translation_color_print_documentation',
                'fla_from', 'final_approval_fee_shram',
            ]);
        });
    }
};
