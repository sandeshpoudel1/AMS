<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('visa_pipeline_entries') && !Schema::hasTable('candidate_flown_entries')) {
            Schema::rename('visa_pipeline_entries', 'candidate_flown_entries');
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('candidate_flown_entries') && !Schema::hasTable('visa_pipeline_entries')) {
            Schema::rename('candidate_flown_entries', 'visa_pipeline_entries');
        }
    }
};
