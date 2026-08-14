<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('training_enrollments', function (Blueprint $table) {
            $table->string('participant_name')->nullable()->after('candidate_id');
        });
        
        // Make candidate_id nullable (PostgreSQL syntax)
        DB::statement('ALTER TABLE training_enrollments ALTER COLUMN candidate_id DROP NOT NULL');
    }

    public function down(): void
    {
        Schema::table('training_enrollments', function (Blueprint $table) {
            $table->dropColumn('participant_name');
        });
        
        // Revert candidate_id back to NOT NULL (PostgreSQL syntax)
        DB::statement('ALTER TABLE training_enrollments ALTER COLUMN candidate_id SET NOT NULL');
    }
};
