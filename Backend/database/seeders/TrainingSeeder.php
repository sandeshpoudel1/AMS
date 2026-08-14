<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class TrainingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $trainings = [
            [
                'name' => 'Welding - MIG',
                'category' => 'welding',
                'subcategory' => 'MIG',
                'description' => 'MIG (Metal Inert Gas) welding training',
                'daily_rate' => 500,
                'duration_days' => 5,
            ],
            [
                'name' => 'Welding - TIG',
                'category' => 'welding',
                'subcategory' => 'TIG',
                'description' => 'TIG (Tungsten Inert Gas) welding training',
                'daily_rate' => 550,
                'duration_days' => 5,
            ],
            [
                'name' => 'Scaffolding',
                'category' => 'scaffolding',
                'subcategory' => null,
                'description' => 'Scaffolding and safety training',
                'daily_rate' => 450,
                'duration_days' => 3,
            ],
            [
                'name' => 'Rope Access',
                'category' => 'rope_access',
                'subcategory' => null,
                'description' => 'Rope access and height working training',
                'daily_rate' => 600,
                'duration_days' => 5,
            ],
            [
                'name' => 'Steel Fixer',
                'category' => 'steelfixer',
                'subcategory' => null,
                'description' => 'Steel fixing and reinforcement training',
                'daily_rate' => 400,
                'duration_days' => 4,
            ],
            [
                'name' => 'Shuttering Carpenter',
                'category' => 'shuttering_carpenter',
                'subcategory' => null,
                'description' => 'Shuttering and carpentry training',
                'daily_rate' => 450,
                'duration_days' => 5,
            ],
        ];

        foreach ($trainings as $training) {
            DB::table('trainings')->insertOrIgnore([
                'name' => $training['name'],
                'category' => $training['category'],
                'subcategory' => $training['subcategory'],
                'description' => $training['description'],
                'daily_rate' => $training['daily_rate'],
                'duration_days' => $training['duration_days'],
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
