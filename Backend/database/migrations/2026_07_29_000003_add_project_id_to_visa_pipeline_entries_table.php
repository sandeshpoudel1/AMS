<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('visa_pipeline_entries', function (Blueprint $table) {
            if (!Schema::hasColumn('visa_pipeline_entries', 'project_id')) {
                $table->foreignId('project_id')->nullable()->constrained('project_settings')->nullOnDelete()->after('bd_name');
            }
        });
    }

    public function down(): void
    {
        Schema::table('visa_pipeline_entries', function (Blueprint $table) {
            if (Schema::hasColumn('visa_pipeline_entries', 'project_id')) {
                $table->dropConstrainedForeignId('project_id');
            }
        });
    }
};
