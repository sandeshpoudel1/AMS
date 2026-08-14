<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payroll', function (Blueprint $table) {
            $table->decimal('bonus', 10, 2)->default(0)->after('allowances');
            $table->decimal('advance_deduction', 10, 2)->default(0)->after('bonus');
        });
    }

    public function down(): void
    {
        Schema::table('payroll', function (Blueprint $table) {
            $table->dropColumn('bonus');
            $table->dropColumn('advance_deduction');
        });
    }
};
