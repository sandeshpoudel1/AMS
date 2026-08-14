<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'two_factor_secret')) {
                $table->text('two_factor_secret')->nullable()->after('remember_token');
            }

            if (!Schema::hasColumn('users', 'two_factor_enabled')) {
                $table->boolean('two_factor_enabled')->default(false)->after('two_factor_secret');
            }

            if (!Schema::hasColumn('users', 'two_factor_confirmed_at')) {
                $table->timestamp('two_factor_confirmed_at')->nullable()->after('two_factor_enabled');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $drops = [];

            if (Schema::hasColumn('users', 'two_factor_confirmed_at')) {
                $drops[] = 'two_factor_confirmed_at';
            }

            if (Schema::hasColumn('users', 'two_factor_enabled')) {
                $drops[] = 'two_factor_enabled';
            }

            if (Schema::hasColumn('users', 'two_factor_secret')) {
                $drops[] = 'two_factor_secret';
            }

            if (!empty($drops)) {
                $table->dropColumn($drops);
            }
        });
    }
};
