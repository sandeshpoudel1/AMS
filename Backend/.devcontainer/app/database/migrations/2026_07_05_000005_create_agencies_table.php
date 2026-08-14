<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agencies', function (Blueprint $table) {
            $table->id();
            $table->string('company_name', 255);
            $table->string('contact_person', 120)->nullable();
            $table->string('phone', 50)->nullable();
            $table->string('email', 255)->nullable();
            $table->string('contact_person_1', 120)->nullable();
            $table->string('designation_1', 120)->nullable();
            $table->string('phone_number_1', 50)->nullable();
            $table->string('email_1', 255)->nullable();
            $table->string('contact_person_2', 120)->nullable();
            $table->string('designation_2', 120)->nullable();
            $table->string('phone_number_2', 50)->nullable();
            $table->string('email_2', 255)->nullable();
            $table->string('country', 120)->nullable();
            $table->string('note', 500)->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['company_name', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agencies');
    }
};
