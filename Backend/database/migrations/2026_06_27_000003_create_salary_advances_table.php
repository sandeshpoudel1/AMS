<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('salary_advances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_id')->constrained('staff')->onDelete('cascade');
            $table->decimal('amount', 10, 2);
            $table->decimal('amount_repaid', 10, 2)->default(0);
            $table->date('advance_date');
            $table->enum('status', ['pending', 'partial', 'repaid'])->default('pending');
            $table->string('reference_number')->nullable();
            $table->enum('payment_method', ['cash', 'online', 'check', 'bank_transfer'])->default('bank_transfer');
            $table->text('reason')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->constrained('users')->onDelete('restrict');
            $table->timestamps();
            $table->softDeletes();

            $table->index('staff_id');
            $table->index('status');
            $table->index('advance_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('salary_advances');
    }
};
