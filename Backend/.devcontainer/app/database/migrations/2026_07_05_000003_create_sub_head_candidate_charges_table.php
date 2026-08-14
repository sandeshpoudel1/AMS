<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sub_head_candidate_charges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('expense_head_id')->constrained('expense_heads')->cascadeOnDelete();
            $table->foreignId('candidate_id')->constrained('candidates')->cascadeOnDelete();
            $table->decimal('amount', 12, 2)->default(0);
            $table->string('notes', 500)->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['expense_head_id', 'candidate_id']);
            $table->index(['candidate_id', 'is_active']);
            $table->index(['expense_head_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sub_head_candidate_charges');
    }
};
