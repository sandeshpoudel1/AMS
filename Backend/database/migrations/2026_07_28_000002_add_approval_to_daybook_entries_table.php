<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('daybook_entries', function (Blueprint $table) {
            if (!Schema::hasColumn('daybook_entries', 'approval_status')) {
                $table->string('approval_status')->default('approved')->after('description');
            }
            if (!Schema::hasColumn('daybook_entries', 'approved_by')) {
                $table->unsignedBigInteger('approved_by')->nullable()->after('approval_status');
            }
            if (!Schema::hasColumn('daybook_entries', 'approved_at')) {
                $table->timestamp('approved_at')->nullable()->after('approved_by');
            }
        });
    }

    public function down()
    {
        Schema::table('daybook_entries', function (Blueprint $table) {
            if (Schema::hasColumn('daybook_entries', 'approved_at')) {
                $table->dropColumn('approved_at');
            }
            if (Schema::hasColumn('daybook_entries', 'approved_by')) {
                $table->dropColumn('approved_by');
            }
            if (Schema::hasColumn('daybook_entries', 'approval_status')) {
                $table->dropColumn('approval_status');
            }
        });
    }
};
