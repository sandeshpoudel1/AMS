<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('candidate_deployments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('candidate_id')->constrained('candidates')->onDelete('cascade');
            $table->string('destination');
            $table->string('flight_ticket')->nullable();
            $table->date('flight_date')->nullable();
            $table->enum('status', ['waiting', 'deployed'])->default('waiting');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['candidate_id', 'status']);
            $table->index('flight_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('candidate_deployments');
    }
};
