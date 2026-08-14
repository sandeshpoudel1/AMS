<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('daybook_entries', function (Blueprint $table) {
            if (!Schema::hasColumn('daybook_entries', 'expense_head_id')) {
                $table->foreignId('expense_head_id')->nullable()->after('type')->constrained('expense_heads')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('daybook_entries', function (Blueprint $table) {
            if (Schema::hasColumn('daybook_entries', 'expense_head_id')) {
                $table->dropConstrainedForeignId('expense_head_id');
            }
        });
    }
};
