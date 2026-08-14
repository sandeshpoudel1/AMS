<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('training_enrollments', function (Blueprint $table) {
            $table->decimal('advance_payment_1', 15, 2)->default(0)->after('paid_amount');
            $table->decimal('advance_payment_2', 15, 2)->default(0)->after('advance_payment_1');
            $table->decimal('advance_payment_3', 15, 2)->default(0)->after('advance_payment_2');
        });

        DB::statement('UPDATE training_enrollments SET advance_payment_1 = COALESCE(advance_payment, 0)');

        Schema::table('training_enrollments', function (Blueprint $table) {
            $table->dropColumn('advance_payment');
        });
    }

    public function down(): void
    {
        Schema::table('training_enrollments', function (Blueprint $table) {
            $table->decimal('advance_payment', 15, 2)->default(0)->after('paid_amount');
        });

        DB::statement('UPDATE training_enrollments SET advance_payment = COALESCE(advance_payment_1, 0) + COALESCE(advance_payment_2, 0) + COALESCE(advance_payment_3, 0)');

        Schema::table('training_enrollments', function (Blueprint $table) {
            $table->dropColumn(['advance_payment_1', 'advance_payment_2', 'advance_payment_3']);
        });
    }
};
