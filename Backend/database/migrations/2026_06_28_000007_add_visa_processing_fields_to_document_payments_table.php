<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_payments', function (Blueprint $table) {
            $table->boolean('police_report_included')->default(false)->after('notes');
            $table->boolean('cv_included')->default(false)->after('police_report_included');
            $table->boolean('video_included')->default(false)->after('cv_included');
            $table->enum('visa_status', ['pending', 'approved', 'rejected'])->default('pending')->after('video_included');
        });
    }

    public function down(): void
    {
        Schema::table('document_payments', function (Blueprint $table) {
            $table->dropColumn(['police_report_included', 'cv_included', 'video_included', 'visa_status']);
        });
    }
};
