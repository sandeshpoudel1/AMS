<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('candidate_id')->constrained('candidates')->onDelete('cascade');
            $table->string('country');                          // Country they are applying to
            $table->string('category');                         // Job category / visa type
            $table->string('document_type')->nullable();        // Passport, Visa, Work Permit, Medical, etc.
            $table->decimal('amount', 15, 2)->default(0);       // Amount paid
            $table->date('payment_date');                       // When payment was made
            $table->string('payment_mode')->default('cash');    // cash | online | bank
            $table->string('receipt_number')->nullable();       // Receipt / reference number
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index('candidate_id');
            $table->index('country');
            $table->index('payment_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_payments');
    }
};
