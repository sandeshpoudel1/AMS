<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_payments', function (Blueprint $table) {
            $table->boolean('medical_report_included')->default(false)->after('police_report_included');
            $table->string('medical_report_file')->nullable()->after('police_report_file');
        });
    }

    public function down(): void
    {
        Schema::table('document_payments', function (Blueprint $table) {
            $table->dropColumn(['medical_report_included', 'medical_report_file']);
        });
    }
};
