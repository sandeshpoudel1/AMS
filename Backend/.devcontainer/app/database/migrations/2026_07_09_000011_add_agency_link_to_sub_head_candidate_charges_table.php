<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sub_head_candidate_charges', function (Blueprint $table) {
            if (!Schema::hasColumn('sub_head_candidate_charges', 'agency_id')) {
                $table->foreignId('agency_id')->nullable()->after('candidate_id')->constrained('agencies')->nullOnDelete();
            }
        });

        Schema::table('sub_head_candidate_charges', function (Blueprint $table) {
            if (Schema::hasColumn('sub_head_candidate_charges', 'candidate_id')) {
                $table->unsignedBigInteger('candidate_id')->nullable()->change();
            }
        });
    }

    public function down(): void
    {
        Schema::table('sub_head_candidate_charges', function (Blueprint $table) {
            if (Schema::hasColumn('sub_head_candidate_charges', 'agency_id')) {
                $table->dropConstrainedForeignId('agency_id');
            }
        });
    }
};
