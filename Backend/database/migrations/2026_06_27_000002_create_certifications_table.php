<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('certifications', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('training_enrollment_id');
            $table->string('certificate_number')->unique()->nullable();
            $table->date('certificate_received_date')->nullable();
            $table->date('certificate_to_be_given_date')->nullable();
            $table->string('certification_level')->nullable();
            $table->string('issuing_authority')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('training_enrollment_id')->references('id')->on('training_enrollments')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            $table->index('training_enrollment_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('certifications');
    }
};
