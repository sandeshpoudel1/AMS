<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('salary_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_id')->constrained('staff')->onDelete('cascade');
            $table->decimal('old_salary', 10, 2)->nullable();
            $table->decimal('new_salary', 10, 2);
            $table->date('effective_date');
            $table->enum('change_type', ['increment', 'decrement', 'bonus', 'adjustment'])->default('adjustment');
            $table->text('reason')->nullable();
            $table->foreignId('created_by')->constrained('users')->onDelete('restrict');
            $table->timestamps();
            $table->softDeletes();

            $table->index('staff_id');
            $table->index('change_type');
            $table->index('effective_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('salary_history');
    }
};
