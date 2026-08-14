<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('daybook_entries', function (Blueprint $table) {
            if (!Schema::hasColumn('daybook_entries', 'linked_module')) {
                $table->string('linked_module', 50)->nullable()->after('expense_head_id');
            }

            if (!Schema::hasColumn('daybook_entries', 'linked_record_id')) {
                $table->string('linked_record_id', 100)->nullable()->after('linked_module');
            }

            if (!Schema::hasColumn('daybook_entries', 'linked_record_name')) {
                $table->string('linked_record_name', 255)->nullable()->after('linked_record_id');
            }

            $table->index(['linked_module', 'linked_record_id'], 'daybook_entries_linked_source_index');
        });
    }

    public function down(): void
    {
        Schema::table('daybook_entries', function (Blueprint $table) {
            $table->dropIndex('daybook_entries_linked_source_index');

            if (Schema::hasColumn('daybook_entries', 'linked_record_name')) {
                $table->dropColumn('linked_record_name');
            }

            if (Schema::hasColumn('daybook_entries', 'linked_record_id')) {
                $table->dropColumn('linked_record_id');
            }

            if (Schema::hasColumn('daybook_entries', 'linked_module')) {
                $table->dropColumn('linked_module');
            }
        });
    }
};
