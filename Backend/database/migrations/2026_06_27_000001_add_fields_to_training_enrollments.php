<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('training_enrollments', function (Blueprint $table) {
            $table->string('passport_number')->nullable()->after('duration_days');
            $table->text('previous_experience')->nullable()->after('passport_number');
            $table->string('record_document')->nullable()->after('previous_experience');
            $table->enum('certificate_status', ['pending', 'received', 'to_be_given'])->default('pending')->after('record_document');
        });
    }

    public function down(): void
    {
        Schema::table('training_enrollments', function (Blueprint $table) {
            $table->dropColumn(['passport_number', 'previous_experience', 'record_document', 'certificate_status']);
        });
    }
};
