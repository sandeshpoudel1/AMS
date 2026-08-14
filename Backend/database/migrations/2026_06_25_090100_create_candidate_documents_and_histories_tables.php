<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('candidate_documents')) {
            Schema::create('candidate_documents', function (Blueprint $table) {
                $table->id();
                $table->foreignId('candidate_id')->constrained('candidates')->cascadeOnDelete();
                $table->string('title')->nullable();
                $table->string('file_path');
                $table->string('original_name');
                $table->string('mime_type', 120)->nullable();
                $table->unsignedBigInteger('size_bytes')->default(0);
                $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->index(['candidate_id', 'created_at']);
            });
        }

        if (!Schema::hasTable('candidate_histories')) {
            Schema::create('candidate_histories', function (Blueprint $table) {
                $table->id();
                $table->foreignId('candidate_id')->constrained('candidates')->cascadeOnDelete();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('action', 80);
                $table->string('from_status', 50)->nullable();
                $table->string('to_status', 50)->nullable();
                $table->text('description')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->index(['candidate_id', 'created_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('candidate_histories');
        Schema::dropIfExists('candidate_documents');
    }
};
