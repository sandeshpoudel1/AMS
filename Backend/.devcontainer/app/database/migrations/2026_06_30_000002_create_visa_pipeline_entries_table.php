<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('visa_pipeline_entries', function (Blueprint $table) {
            $table->id();

            // Candidate link (optional – can be manually entered)
            $table->foreignId('candidate_id')->nullable()->constrained('candidates')->nullOnDelete();
            $table->string('candidate_name')->nullable();   // manual override if no candidate_id

            // Identity
            $table->string('passport_number')->nullable();

            // Company & project
            $table->string('company_name')->nullable();
            $table->string('bd_name')->nullable();          // Business Development representative
            $table->foreignId('project_id')->nullable()->constrained('project_settings')->nullOnDelete();
            $table->string('project_number')->nullable();

            // Deployment info
            $table->string('country')->nullable();
            $table->string('working_category')->nullable();

            // Fee
            $table->decimal('total_fee', 14, 2)->default(0);

            // Flight
            $table->date('flight_date')->nullable();        // departure date

            // Advance payments
            $table->decimal('advance_1', 14, 2)->default(0);
            $table->decimal('advance_2', 14, 2)->default(0);
            $table->decimal('advance_3', 14, 2)->default(0);

            // Notes / status
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visa_pipeline_entries');
    }
};
