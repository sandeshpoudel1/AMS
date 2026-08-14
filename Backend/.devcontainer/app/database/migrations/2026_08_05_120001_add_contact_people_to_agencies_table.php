<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agencies', function (Blueprint $table) {
            if (!Schema::hasColumn('agencies', 'contact_person_1')) {
                $table->string('contact_person_1', 120)->nullable()->after('email');
            }

            if (!Schema::hasColumn('agencies', 'designation_1')) {
                $table->string('designation_1', 120)->nullable()->after('contact_person_1');
            }

            if (!Schema::hasColumn('agencies', 'phone_number_1')) {
                $table->string('phone_number_1', 50)->nullable()->after('designation_1');
            }

            if (!Schema::hasColumn('agencies', 'email_1')) {
                $table->string('email_1', 255)->nullable()->after('phone_number_1');
            }

            if (!Schema::hasColumn('agencies', 'contact_person_2')) {
                $table->string('contact_person_2', 120)->nullable()->after('email_1');
            }

            if (!Schema::hasColumn('agencies', 'designation_2')) {
                $table->string('designation_2', 120)->nullable()->after('contact_person_2');
            }

            if (!Schema::hasColumn('agencies', 'phone_number_2')) {
                $table->string('phone_number_2', 50)->nullable()->after('designation_2');
            }

            if (!Schema::hasColumn('agencies', 'email_2')) {
                $table->string('email_2', 255)->nullable()->after('phone_number_2');
            }
        });
    }

    public function down(): void
    {
        Schema::table('agencies', function (Blueprint $table) {
            if (Schema::hasColumn('agencies', 'email_2')) {
                $table->dropColumn('email_2');
            }

            if (Schema::hasColumn('agencies', 'phone_number_2')) {
                $table->dropColumn('phone_number_2');
            }

            if (Schema::hasColumn('agencies', 'designation_2')) {
                $table->dropColumn('designation_2');
            }

            if (Schema::hasColumn('agencies', 'contact_person_2')) {
                $table->dropColumn('contact_person_2');
            }

            if (Schema::hasColumn('agencies', 'email_1')) {
                $table->dropColumn('email_1');
            }

            if (Schema::hasColumn('agencies', 'phone_number_1')) {
                $table->dropColumn('phone_number_1');
            }

            if (Schema::hasColumn('agencies', 'designation_1')) {
                $table->dropColumn('designation_1');
            }

            if (Schema::hasColumn('agencies', 'contact_person_1')) {
                $table->dropColumn('contact_person_1');
            }
        });
    }
};
