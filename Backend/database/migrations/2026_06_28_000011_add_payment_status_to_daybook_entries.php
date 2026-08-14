<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('daybook_entries', function (Blueprint $table) {
            $table->enum('payment_status', ['received', 'partial_paid', 'pending', 'cancelled'])->nullable()->after('type')->comment('Payment status: received, partial_paid, pending, cancelled');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('daybook_entries', function (Blueprint $table) {
            $table->dropColumn('payment_status');
        });
    }
};
