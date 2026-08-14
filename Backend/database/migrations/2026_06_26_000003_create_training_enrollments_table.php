<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('training_enrollments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('candidate_id');
            $table->unsignedBigInteger('training_id');
            $table->date('enrollment_date')->default(DB::raw('CURRENT_DATE'));
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->integer('duration_days')->comment('Actual training duration in days');
            $table->enum('status', ['enrolled', 'ongoing', 'completed', 'cancelled'])->default('enrolled');
            $table->decimal('training_amount', 15, 2)->comment('Total training cost (daily_rate * duration_days)');
            $table->decimal('paid_amount', 15, 2)->default(0)->comment('Amount paid by candidate');
            $table->string('payment_reference')->nullable()->comment('Receipt or reference number');
            $table->enum('payment_status', ['unpaid', 'partial', 'paid'])->default('unpaid');
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
            
            $table->foreign('candidate_id')->references('id')->on('candidates')->onDelete('cascade');
            $table->foreign('training_id')->references('id')->on('trainings')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            
            $table->index(['candidate_id', 'training_id']);
            $table->index('status');
            $table->index('enrollment_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('training_enrollments');
    }
};
