<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('candidate_references', function (Blueprint $table) {
            // Nullable FK – links to an existing candidate as the referrer
            $table->foreignId('referred_by_candidate_id')
                ->nullable()
                ->after('candidate_id')
                ->constrained('candidates')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('candidate_references', function (Blueprint $table) {
            $table->dropForeign(['referred_by_candidate_id']);
            $table->dropColumn('referred_by_candidate_id');
        });
    }
};
