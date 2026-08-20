<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(RoleSeeder::class);

        // User::factory(10)->create();

        User::updateOrCreate(
            ['email' => 'test@example.com'],
            [
                'name' => 'Test User',
                'full_name' => 'Test User',
                'password' => Hash::make('password'),
            ]
        );

        User::updateOrCreate(
            ['email' => 'admin@mopl.test'],
            [
                'name' => 'Admin User',
                'full_name' => 'System Administrator',
                'password' => Hash::make('Admin@12345'),
                'role' => 'admin',
                'is_active' => true,
            ]
        );

        User::updateOrCreate(
            ['email' => 'candidate.officer@mopl.test'],
            [
                'name' => 'Candidate Officer',
                'full_name' => 'Candidate Officer',
                'password' => Hash::make('Candidate@12345'),
                'role' => 'candidate_officer',
                'is_active' => true,
            ]
        );

        User::updateOrCreate(
            ['email' => 'finance.officer@mopl.test'],
            [
                'name' => 'Finance Officer',
                'full_name' => 'Finance Officer',
                'password' => Hash::make('Finance@12345'),
                'role' => 'finance_officer',
                'is_active' => true,
            ]
        );

        User::updateOrCreate( 
            ['email' => 'tekbdrpdl999@mopl.superadmin.com'],
            [
                'name' => 'Super Admin',
                'full_name' => 'Super Admin',
                'password' => Hash::make('12345678'),
                'role' => 'superadmin',
                'is_active' => true,
            ]
        );
    }
}
