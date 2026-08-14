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
        if (!Schema::hasTable('daybook_entries')) return;

        Schema::table('daybook_entries', function (Blueprint $table) {
            if (!Schema::hasColumn('daybook_entries', 'ssf_amount')) {
                $table->decimal('ssf_amount', 15, 2)->nullable()->after('amount');
            }
            if (!Schema::hasColumn('daybook_entries', 'welfare_amount')) {
                $table->decimal('welfare_amount', 15, 2)->nullable()->after('ssf_amount');
            }
            if (!Schema::hasColumn('daybook_entries', 'insurance_amount')) {
                $table->decimal('insurance_amount', 15, 2)->nullable()->after('welfare_amount');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (!Schema::hasTable('daybook_entries')) return;

        Schema::table('daybook_entries', function (Blueprint $table) {
            if (Schema::hasColumn('daybook_entries', 'insurance_amount')) {
                $table->dropColumn('insurance_amount');
            }
            if (Schema::hasColumn('daybook_entries', 'welfare_amount')) {
                $table->dropColumn('welfare_amount');
            }
            if (Schema::hasColumn('daybook_entries', 'ssf_amount')) {
                $table->dropColumn('ssf_amount');
            }
        });
    }
};
