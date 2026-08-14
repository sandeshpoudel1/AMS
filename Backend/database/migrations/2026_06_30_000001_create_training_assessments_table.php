<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('training_assessments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('enrollment_id')->constrained('training_enrollments')->onDelete('cascade');

            // Initial assessment result
            $table->enum('result', ['pass', 'fail', 'pending'])->default('pending');
            $table->boolean('re_assessment_required')->default(false);

            // Reassessment 1
            $table->date('reassessment_1_date')->nullable();
            $table->enum('reassessment_1_result', ['pass', 'fail'])->nullable();

            // Reassessment 2
            $table->date('reassessment_2_date')->nullable();
            $table->enum('reassessment_2_result', ['pass', 'fail'])->nullable();

            // Certificate / Card tracking
            $table->enum('certificate_card_status', ['received', 'not_received', 'pending'])->default('pending');
            $table->enum('dispatch_status', ['dispatched', 'not_dispatched'])->default('not_dispatched');
            $table->date('certification_expiry_date')->nullable();

            // Invoice from certification body
            $table->string('invoice_number')->nullable();
            $table->decimal('invoice_amount', 10, 2)->default(0);

            // Card/Certificate payment
            $table->decimal('card_payment', 10, 2)->default(0);

            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('training_assessments');
    }
};
