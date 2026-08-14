<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('training_enrollments', function (Blueprint $table) {
            $table->foreignId('training_company_id')
                ->nullable()
                ->after('training_id')
                ->constrained('training_companies')
                ->nullOnDelete();

            $table->index('training_company_id');
        });
    }

    public function down(): void
    {
        Schema::table('training_enrollments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('training_company_id');
        });
    }
};
