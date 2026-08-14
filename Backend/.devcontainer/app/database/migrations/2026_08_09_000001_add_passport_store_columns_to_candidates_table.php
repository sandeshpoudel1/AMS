<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('candidates')) {
            return;
        }

        Schema::table('candidates', function (Blueprint $table) {
            if (!Schema::hasColumn('candidates', 'passport_store_status')) {
                $table->string('passport_store_status', 120)->nullable()->after('status');
            }

            if (!Schema::hasColumn('candidates', 'passport_store_out_by')) {
                $table->string('passport_store_out_by', 255)->nullable()->after('passport_store_status');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('candidates')) {
            return;
        }

        Schema::table('candidates', function (Blueprint $table) {
            if (Schema::hasColumn('candidates', 'passport_store_out_by')) {
                $table->dropColumn('passport_store_out_by');
            }

            if (Schema::hasColumn('candidates', 'passport_store_status')) {
                $table->dropColumn('passport_store_status');
            }
        });
    }
};
