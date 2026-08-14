<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('candidate_documents') && !Schema::hasColumn('candidate_documents', 'project_id')) {
            Schema::table('candidate_documents', function (Blueprint $table) {
                $table->foreignId('project_id')->nullable()->after('candidate_id')->constrained('project_settings')->nullOnDelete();
                $table->index(['project_id', 'candidate_id']);
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('candidate_documents') && Schema::hasColumn('candidate_documents', 'project_id')) {
            Schema::table('candidate_documents', function (Blueprint $table) {
                $table->dropForeign(['project_id']);
                $table->dropIndex(['project_id', 'candidate_id']);
                $table->dropColumn('project_id');
            });
        }
    }
};
