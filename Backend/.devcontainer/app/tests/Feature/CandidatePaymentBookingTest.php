<?php

namespace Tests\Feature;

use App\Models\Candidate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CandidatePaymentBookingTest extends TestCase
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

    public function test_candidate_payment_bookings_endpoint_returns_success_payload(): void
    {
        $this->actingAsAdmin();

        $candidate = Candidate::create([
            'full_name' => 'Booked Candidate',
            'passport_number' => 'PB123456',
            'status' => 'registered',
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/candidates/' . $candidate->id . '/payment-bookings');

        $response
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'success',
                'data',
            ]);
    }

    public function test_payment_bookings_fallback_endpoint_accepts_candidate_id_query(): void
    {
        $this->actingAsAdmin();

        $candidate = Candidate::create([
            'full_name' => 'Fallback Candidate',
            'passport_number' => 'FB123456',
            'status' => 'registered',
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/payment-bookings?candidate_id=' . $candidate->id);

        $response
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'success',
                'data',
            ]);
    }
}
