<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('trainings', function (Blueprint $table) {
            $table->id();
            $table->string('name', 255)->unique()->comment('Training name: welding, scaffolding, etc.');
            $table->string('category', 100)->comment('Category: welding, scaffolding, rope_access, steelfixer, shuttering_carpenter');
            $table->string('subcategory', 100)->nullable()->comment('Subcategory: e.g., mig, tig for welding');
            $table->text('description')->nullable();
            $table->decimal('daily_rate', 15, 2)->comment('Per day training rate');
            $table->integer('duration_days')->default(5)->comment('Default training duration in days');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
            
            $table->index('category');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('trainings');
    }
};
