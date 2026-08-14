<?php

namespace Database\Seeders;

use App\Models\Staff;
use Illuminate\Database\Seeder;

class StaffSeeder extends Seeder
{
    public function run(): void
    {
        Staff::create([
            'full_name' => 'John Doe',
            'email' => 'john.doe@mopl.test',
            'phone' => '+353 1 234 5678',
            'position' => 'Senior Technician',
            'employment_type' => 'full_time',
            'hire_date' => '2023-01-15',
            'department' => 'Operations',
            'base_salary' => 3500.00,
            'status' => 'active',
            'notes' => 'Experienced technician',
            'created_by' => 1,
        ]);

        Staff::create([
            'full_name' => 'Jane Smith',
            'email' => 'jane.smith@mopl.test',
            'phone' => '+353 1 234 5679',
            'position' => 'Supervisor',
            'employment_type' => 'full_time',
            'hire_date' => '2022-06-01',
            'department' => 'Operations',
            'base_salary' => 4000.00,
            'status' => 'active',
            'notes' => 'Team lead',
            'created_by' => 1,
        ]);

        Staff::create([
            'full_name' => 'Michael Johnson',
            'email' => 'michael.johnson@mopl.test',
            'phone' => '+353 1 234 5680',
            'position' => 'Technician',
            'employment_type' => 'full_time',
            'hire_date' => '2023-03-10',
            'department' => 'Operations',
            'base_salary' => 2800.00,
            'status' => 'active',
            'notes' => 'Training operator',
            'created_by' => 1,
        ]);

        Staff::create([
            'full_name' => 'Sarah Williams',
            'email' => 'sarah.williams@mopl.test',
            'phone' => '+353 1 234 5681',
            'position' => 'Safety Officer',
            'employment_type' => 'full_time',
            'hire_date' => '2021-09-20',
            'department' => 'Safety',
            'base_salary' => 3200.00,
            'status' => 'active',
            'notes' => 'HSE certified',
            'created_by' => 1,
        ]);

        Staff::create([
            'full_name' => 'Robert Brown',
            'email' => 'robert.brown@mopl.test',
            'phone' => '+353 1 234 5682',
            'position' => 'Part-time Technician',
            'employment_type' => 'part_time',
            'hire_date' => '2024-01-01',
            'department' => 'Operations',
            'base_salary' => 1500.00,
            'status' => 'active',
            'notes' => 'Weekend shifts',
            'created_by' => 1,
        ]);
    }
}
