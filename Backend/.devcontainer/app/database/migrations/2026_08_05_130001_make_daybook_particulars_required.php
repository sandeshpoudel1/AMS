<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('daybook_entries', function (Blueprint $table) {
            if (Schema::hasColumn('daybook_entries', 'particulars')) {
                $table->string('particulars', 500)->nullable(false)->change();
            }
        });
    }

    public function down(): void
    {
        Schema::table('daybook_entries', function (Blueprint $table) {
            if (Schema::hasColumn('daybook_entries', 'particulars')) {
                $table->string('particulars', 500)->nullable()->change();
            }
        });
    }
};
