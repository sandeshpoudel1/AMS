<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('candidates')) return;

        Schema::table('candidates', function (Blueprint $table) {
            if (!Schema::hasColumn('candidates', 'passport_store_out_date')) {
                $table->date('passport_store_out_date')->nullable()->after('passport_store_out_by');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('candidates')) return;

        Schema::table('candidates', function (Blueprint $table) {
            if (Schema::hasColumn('candidates', 'passport_store_out_date')) {
                $table->dropColumn('passport_store_out_date');
            }
        });
    }
};
