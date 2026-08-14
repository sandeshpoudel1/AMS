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
        Schema::create('daybook_entries', function (Blueprint $table) {
            $table->id();
            $table->date('entry_date')->default(DB::raw('CURRENT_DATE'));
            $table->enum('type', ['receipt', 'payment'])->comment('Type of entry: receipt or payment');
            $table->string('company_name', 255)->nullable()->comment('Company name (trade)');
            $table->string('particulars', 500)->nullable()->comment('Particulars or reference');
            $table->enum('transaction_type', ['cash', 'online'])->nullable()->comment('Transaction type for receipts');
            $table->string('sub_passport_number', 50)->nullable()->comment('Sub passport number');
            $table->decimal('amount', 15, 2)->comment('Transaction amount');
            $table->text('description')->nullable()->comment('Additional description');
            $table->string('reference_number', 100)->nullable()->comment('Reference or receipt number');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
            
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            $table->index('entry_date');
            $table->index('type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('daybook_entries');
    }
};
