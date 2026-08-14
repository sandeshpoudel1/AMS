<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('candidates', function (Blueprint $table) {
            if (!Schema::hasColumn('candidates', 'passport_issue_date')) {
                $table->date('passport_issue_date')->nullable()->after('date_of_birth');
            }

            if (!Schema::hasColumn('candidates', 'passport_expiry_date')) {
                $table->date('passport_expiry_date')->nullable()->after('passport_issue_date');
            }

            if (!Schema::hasColumn('candidates', 'passport_renewal_day')) {
                $table->date('passport_renewal_day')->nullable()->after('passport_expiry_date');
            }
        });
    }

    public function down(): void
    {
        Schema::table('candidates', function (Blueprint $table) {
            if (Schema::hasColumn('candidates', 'passport_renewal_day')) {
                $table->dropColumn('passport_renewal_day');
            }

            if (Schema::hasColumn('candidates', 'passport_expiry_date')) {
                $table->dropColumn('passport_expiry_date');
            }

            if (Schema::hasColumn('candidates', 'passport_issue_date')) {
                $table->dropColumn('passport_issue_date');
            }
        });
    }
};