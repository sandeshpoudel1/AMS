<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('training_companies', function (Blueprint $table) {
            if (!Schema::hasColumn('training_companies', 'invoice_number')) {
                $table->string('invoice_number', 100)->nullable()->after('country');
            }

            if (!Schema::hasColumn('training_companies', 'invoice_amount')) {
                $table->decimal('invoice_amount', 12, 2)->default(0)->after('invoice_number');
            }
        });
    }

    public function down(): void
    {
        Schema::table('training_companies', function (Blueprint $table) {
            if (Schema::hasColumn('training_companies', 'invoice_amount')) {
                $table->dropColumn('invoice_amount');
            }

            if (Schema::hasColumn('training_companies', 'invoice_number')) {
                $table->dropColumn('invoice_number');
            }
        });
    }
};
