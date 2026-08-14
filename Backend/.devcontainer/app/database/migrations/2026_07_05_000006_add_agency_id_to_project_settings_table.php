<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_settings', function (Blueprint $table) {
            $table->foreignId('agency_id')->nullable()->after('project_name')->constrained('agencies')->nullOnDelete();
            $table->index(['agency_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::table('project_settings', function (Blueprint $table) {
            $table->dropIndex('project_settings_agency_id_is_active_index');
            $table->dropConstrainedForeignId('agency_id');
        });
    }
};
