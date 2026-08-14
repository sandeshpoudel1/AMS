<?php

namespace Tests\Feature;

use App\Models\Candidate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CandidateRegistrationTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsAdmin(): User
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'is_active' => true,
            'full_name' => 'Admin User',
        ]);

        Sanctum::actingAs($admin);

        return $admin;
    }

    public function test_admin_can_register_candidate_successfully(): void
    {
        $this->actingAsAdmin();

        $response = $this->postJson('/api/candidates', [
            'full_name' => 'Test Candidate',
            'email' => 'candidate@example.com',
            'phone' => '9800000000',
            'passport_number' => 'P1234567',
            'status' => 'registered',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.candidate.full_name', 'Test Candidate');

        $this->assertDatabaseHas('candidates', [
            'full_name' => 'Test Candidate',
            'email' => 'candidate@example.com',
            'passport_number' => 'P1234567',
            'status' => 'registered',
        ]);
    }

    public function test_registration_with_login_account_requires_candidate_or_login_email(): void
    {
        $this->actingAsAdmin();

        $response = $this->postJson('/api/candidates', [
            'full_name' => 'No Email Candidate',
            'passport_number' => 'P7654321',
            'create_login_account' => true,
        ]);

        $response
            ->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'CANDIDATE_LOGIN_ACCOUNT_FAILED');
    }

    public function test_registration_requires_passport_number(): void
    {
        $this->actingAsAdmin();

        $response = $this->postJson('/api/candidates', [
            'full_name' => 'Missing Passport',
            'email' => 'missing-passport@example.com',
            'status' => 'registered',
        ]);

        $response
            ->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'CANDIDATE_CREATE_VALIDATION_FAILED')
            ->assertJsonValidationErrors(['passport_number']);
    }

    public function test_registration_rejects_duplicate_passport_after_normalization(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/candidates', [
            'full_name' => 'First Candidate',
            'email' => 'first-candidate@example.com',
            'passport_number' => 'ab 123 456',
            'status' => 'registered',
        ])->assertCreated();

        $duplicate = $this->postJson('/api/candidates', [
            'full_name' => 'Second Candidate',
            'email' => 'second-candidate@example.com',
            'passport_number' => 'AB123456',
            'status' => 'registered',
        ]);

        $duplicate
            ->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'CANDIDATE_CREATE_VALIDATION_FAILED')
            ->assertJsonValidationErrors(['passport_number']);
    }

    public function test_management_role_can_access_candidate_listing(): void
    {
        $management = User::factory()->create([
            'role' => 'management',
            'is_active' => true,
            'full_name' => 'Management User',
        ]);

        Sanctum::actingAs($management);

        $candidate = Candidate::create([
            'full_name' => 'Managed Candidate',
            'passport_number' => 'MGMT1001',
            'status' => 'registered',
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/candidates');

        $response
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'success',
                'data' => ['candidates'],
                'pagination' => ['current_page', 'last_page', 'per_page', 'total'],
            ])
            ->assertJsonFragment([
                'id' => $candidate->id,
                'full_name' => 'Managed Candidate',
                'passport_number' => 'MGMT1001',
            ]);
    }
}
