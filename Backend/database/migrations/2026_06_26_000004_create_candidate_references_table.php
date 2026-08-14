<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('candidate_references', function (Blueprint $table) {
            $table->id();
            $table->foreignId('candidate_id')->constrained('candidates')->onDelete('cascade');
            $table->string('reference_id')->unique();           // Unique reference code e.g. REF-2026-0001
            $table->string('referred_by_name')->nullable();     // Name of person who referred
            $table->string('recruitment_company')->nullable();  // Recruitment agency / company
            $table->integer('referee_count')->default(1);       // Number of referees sent
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index('candidate_id');
            $table->index('reference_id');
            $table->index('recruitment_company');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('candidate_references');
    }
};
