<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reference_sources', function (Blueprint $table) {
            $table->id();
            $table->string('reference_name', 255);
            $table->string('contact_number', 50);
            $table->string('email', 255);
            $table->string('source_company', 255)->nullable();
            $table->string('notes', 500)->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['reference_name', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reference_sources');
    }
};
