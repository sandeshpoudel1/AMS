<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payroll', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_id')->constrained('staff')->onDelete('cascade');
            $table->date('pay_period_start');
            $table->date('pay_period_end');
            $table->date('payment_date')->nullable();
            $table->decimal('base_salary', 10, 2);
            $table->decimal('allowances', 10, 2)->default(0);
            $table->decimal('overtime_hours', 5, 2)->default(0);
            $table->decimal('overtime_rate', 10, 2)->default(0);
            $table->decimal('overtime_amount', 10, 2)->default(0);
            $table->decimal('gross_amount', 10, 2);
            $table->decimal('tax_deduction', 10, 2)->default(0);
            $table->decimal('insurance_deduction', 10, 2)->default(0);
            $table->decimal('other_deductions', 10, 2)->default(0);
            $table->decimal('total_deductions', 10, 2)->default(0);
            $table->decimal('net_amount', 10, 2);
            $table->enum('payment_status', ['pending', 'partial', 'paid'])->default('pending');
            $table->decimal('amount_paid', 10, 2)->default(0);
            $table->string('payment_reference')->nullable();
            $table->enum('payment_method', ['cash', 'online', 'check', 'bank_transfer'])->default('bank_transfer');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->constrained('users')->onDelete('restrict');
            $table->timestamps();
            $table->softDeletes();

            $table->index('staff_id');
            $table->index('payment_date');
            $table->index('payment_status');
            $table->unique(['staff_id', 'pay_period_start', 'pay_period_end']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll');
    }
};
