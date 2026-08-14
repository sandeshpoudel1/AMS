<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_payments', function (Blueprint $table) {
            $table->string('passport_number', 50)->nullable()->after('category');
            $table->string('police_report_file')->nullable()->after('video_included');
        });
    }

    public function down(): void
    {
        Schema::table('document_payments', function (Blueprint $table) {
            $table->dropColumn(['passport_number', 'police_report_file']);
        });
    }
};
