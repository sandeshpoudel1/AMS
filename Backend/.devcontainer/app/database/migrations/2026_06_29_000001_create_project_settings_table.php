<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_settings', function (Blueprint $table) {
            $table->id();
            $table->string('project_name', 120);
            $table->string('agency_name', 255);
            $table->date('project_start_date');
            $table->string('trade', 120);
            $table->integer('number_of_requirements');
            $table->string('project_reference_code', 50)->unique();
            $table->decimal('office_rate_per_trade', 10, 2);
            $table->boolean('is_active')->default(true);
            $table->string('note', 500)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['project_name', 'is_active']);
            $table->index(['agency_name', 'is_active']);
            $table->index(['trade', 'is_active']);
            $table->index(['project_reference_code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_settings');
    }
};