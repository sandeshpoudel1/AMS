<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            ['name' => 'Administrator', 'slug' => 'admin', 'description' => 'Full system access'],
            ['name' => 'Candidate Officer', 'slug' => 'candidate-officer', 'description' => 'Manage candidates and training'],
            ['name' => 'Finance Officer', 'slug' => 'finance-officer', 'description' => 'Manage finances and daybook'],
            ['name' => 'HR Officer', 'slug' => 'hr-officer', 'description' => 'Manage staff and payroll'],
            ['name' => 'Management', 'slug' => 'management', 'description' => 'View reports and analytics'],
        ];

        foreach ($roles as $role) {
            DB::table('roles')->updateOrInsert(
                ['slug' => $role['slug']],
                [
                    'name' => $role['name'],
                    'description' => $role['description'],
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }
    }
}