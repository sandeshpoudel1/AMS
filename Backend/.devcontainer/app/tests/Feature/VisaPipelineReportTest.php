<?php

namespace Tests\Feature;

use App\Models\Candidate;
use App\Models\DaybookEntry;
use App\Models\ExpenseHead;
use App\Models\ProjectSetting;
use App\Models\SubHeadCandidateCharge;
use App\Models\User;
use App\Models\VisaPipelineEntry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class VisaPipelineReportTest extends TestCase
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

    public function test_visa_pipeline_returns_sub_head_booked_amount_in_entry_and_totals(): void
    {
        $admin = $this->actingAsAdmin();

        $candidate = Candidate::create([
            'full_name' => 'Visa Candidate',
            'passport_number' => 'VC123456',
            'status' => 'registered',
            'is_active' => true,
        ]);

        $visaEntry = VisaPipelineEntry::create([
            'candidate_id' => $candidate->id,
            'candidate_name' => $candidate->full_name,
            'passport_number' => $candidate->passport_number,
            'company_name' => 'Test Company',
            'bd_name' => 'Test BD',
            'project_number' => 'PJ-001',
            'country' => 'Testland',
            'total_fee' => 1500,
            'advance_1' => 500,
            'advance_2' => 200,
            'advance_3' => 0,
        ]);

        $expenseHead = ExpenseHead::create([
            'name' => 'Sub Head Expense',
            'is_active' => true,
        ]);

        $subHeadCharge = SubHeadCandidateCharge::create([
            'expense_head_id' => $expenseHead->id,
            'candidate_id' => $candidate->id,
            'amount' => 750,
            'is_active' => true,
        ]);

        DaybookEntry::create([
            'entry_date' => now()->toDateString(),
            'type' => 'receipt',
            'linked_module' => 'sub_head',
            'sub_passport_number' => 'subhead_link:' . $subHeadCharge->id,
            'particulars' => 'Sub head receipt',
            'amount' => 350,
            'approval_status' => 'approved',
            'created_by' => $admin->id,
        ]);

        DaybookEntry::create([
            'entry_date' => now()->toDateString(),
            'type' => 'receipt',
            'linked_module' => 'sub_head',
            'sub_passport_number' => 'candidate:' . $candidate->id,
            'particulars' => 'Candidate receipt',
            'amount' => 150,
            'approval_status' => 'approved',
            'created_by' => $admin->id,
        ]);

        $response = $this->getJson('/api/visa-pipeline?candidate_id=' . $candidate->id);

        $response
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.totals.total_sub_head_booked_amount', 500)
            ->assertJsonPath('data.entries.0.sub_head_booked_amount', 500)
            ->assertJsonPath('data.entries.0.candidate_id', $candidate->id);
    }

    public function test_visa_pipeline_returns_candidate_backfill_for_project_and_daybook_payments(): void
    {
        $admin = $this->actingAsAdmin();

        $project = ProjectSetting::create([
            'project_name' => 'Visa Project',
            'agency_name' => 'Test Client',
            'trade' => 'Trade A',
            'country' => 'Testland',
            'office_rate_per_trade' => 1200,
            'project_start_date' => now()->toDateString(),
            'number_of_requirements' => 0,
            'project_reference_code' => 'REF-001',
            'is_active' => true,
        ]);

        $candidate = Candidate::create([
            'full_name' => 'Backfill Candidate',
            'passport_number' => 'BC123456',
            'status' => 'registered',
            'is_active' => true,
            'project_id' => $project->id,
            'paid_amount' => 300,
        ]);

        $expenseHead = ExpenseHead::create([
            'name' => 'Sub Head Expense',
            'is_active' => true,
        ]);

        $subHeadCharge = SubHeadCandidateCharge::create([
            'expense_head_id' => $expenseHead->id,
            'candidate_id' => $candidate->id,
            'amount' => 500,
            'is_active' => true,
        ]);

        DaybookEntry::create([
            'entry_date' => now()->toDateString(),
            'type' => 'receipt',
            'linked_module' => 'sub_head',
            'sub_passport_number' => 'subhead_link:' . $subHeadCharge->id,
            'particulars' => 'Sub head receipt',
            'amount' => 200,
            'approval_status' => 'approved',
            'created_by' => $admin->id,
        ]);

        $response = $this->getJson('/api/visa-pipeline?candidate_id=' . $candidate->id);

        $response
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.entries.0.candidate_id', $candidate->id)
            ->assertJsonPath('data.entries.0.total_fee', 1200)
            ->assertJsonPath('data.entries.0.advance_1', 300)
            ->assertJsonPath('data.entries.0.sub_head_booked_amount', 200)
            ->assertJsonPath('data.totals.total_fee', 1200)
            ->assertJsonPath('data.totals.total_received', 300)
            ->assertJsonPath('data.totals.total_sub_head_booked_amount', 200);
    }

    public function test_superadmin_can_access_reference_and_bd_source_endpoints(): void
    {
        $superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'is_active' => true,
            'full_name' => 'Super Admin',
        ]);

        Sanctum::actingAs($superAdmin);

        $this->getJson('/api/reference-sources')
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->getJson('/api/bd-sources')
            ->assertOk()
            ->assertJsonPath('success', true);
    }

    public function test_admin_can_manage_regular_users_but_cannot_see_or_manage_superadmin(): void
    {
        $superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'is_active' => true,
            'full_name' => 'Super Admin',
        ]);

        User::factory()->create([
            'role' => 'admin',
            'is_active' => true,
            'full_name' => 'Regular Admin',
        ]);

        User::factory()->create([
            'role' => 'account',
            'is_active' => true,
            'full_name' => 'Account User',
        ]);

        $admin = User::factory()->create([
            'role' => 'admin',
            'is_active' => true,
            'full_name' => 'Secondary Admin',
        ]);

        Sanctum::actingAs($admin);

        $this->getJson('/api/users')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(3, 'data.users')
            ->assertJsonMissing(['data' => ['users' => [['role' => 'super_admin']]]]);

        $this->postJson('/api/users', [
            'full_name' => 'New Team User',
            'email' => 'newteamuser@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => 'account',
        ])->assertStatus(201)
            ->assertJsonPath('success', true);

        $this->deleteJson('/api/users/' . $superAdmin->id)
            ->assertStatus(403)
            ->assertJsonPath('success', false);
    }

    public function test_superadmin_can_edit_approved_daybook_entries(): void
    {
        $superAdmin = User::factory()->create([
            'role' => 'superadmin',
            'is_active' => true,
            'full_name' => 'Super Admin',
        ]);

        Sanctum::actingAs($superAdmin);

        $entry = DaybookEntry::create([
            'entry_date' => now()->toDateString(),
            'type' => 'payment',
            'linked_module' => 'visa_pipeline',
            'linked_record_id' => '99',
            'linked_record_name' => 'Approved entry',
            'particulars' => 'Original approved payment',
            'amount' => 250,
            'approval_status' => 'approved',
            'created_by' => $superAdmin->id,
        ]);

        $this->putJson('/api/daybook/' . $entry->id, [
            'particulars' => 'Corrected approved payment',
            'amount' => 300,
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.particulars', 'Corrected approved payment');

        $entry->refresh();
        $this->assertSame('Corrected approved payment', $entry->particulars);
        $this->assertSame(300.0, (float) $entry->amount);
    }

    public function test_finance_officer_cannot_edit_approved_daybook_entries(): void
    {
        $financeOfficer = User::factory()->create([
            'role' => 'finance_officer',
            'is_active' => true,
            'full_name' => 'Finance Officer',
        ]);

        Sanctum::actingAs($financeOfficer);

        $entry = DaybookEntry::create([
            'entry_date' => now()->toDateString(),
            'type' => 'payment',
            'linked_module' => 'visa_pipeline',
            'linked_record_id' => '100',
            'linked_record_name' => 'Approved entry',
            'particulars' => 'Original approved payment',
            'amount' => 250,
            'approval_status' => 'approved',
            'created_by' => $financeOfficer->id,
        ]);

        $this->putJson('/api/daybook/' . $entry->id, [
            'particulars' => 'Unauthorised update',
            'amount' => 999,
        ])->assertStatus(403)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'DAYBOOK_APPROVED');

        $entry->refresh();
        $this->assertSame('Original approved payment', $entry->particulars);
        $this->assertSame(250.0, (float) $entry->amount);
    }

    public function test_daybook_payment_approval_does_not_change_linked_visa_pipeline_amount(): void
    {
        $admin = $this->actingAsAdmin();

        $visaEntry = VisaPipelineEntry::create([
            'candidate_name' => 'Payment Candidate',
            'passport_number' => 'PC123456',
            'company_name' => 'Payment Client',
            'bd_name' => 'Payment BD',
            'project_number' => 'PAY-001',
            'country' => 'Payland',
            'office_rate' => 1000,
            'total_fee' => 1000,
            'advance_1' => 0,
            'advance_2' => 0,
            'advance_3' => 0,
        ]);

        $daybookEntry = DaybookEntry::create([
            'entry_date' => now()->toDateString(),
            'type' => 'payment',
            'linked_module' => 'visa_pipeline',
            'linked_record_id' => (string) $visaEntry->id,
            'linked_record_name' => 'Visa payment pending approval',
            'particulars' => 'Visa pipeline payment',
            'amount' => 250,
            'approval_status' => 'pending',
            'created_by' => $admin->id,
        ]);

        $this->postJson('/api/daybook/' . $daybookEntry->id . '/approve')
            ->assertOk()
            ->assertJsonPath('success', true);

        $visaEntry->refresh();
        $this->assertSame(1000.00, (float) $visaEntry->office_rate);
    }

    public function test_approved_visa_pipeline_daybook_payment_does_not_mutate_visa_entry_amount(): void
    {
        $admin = $this->actingAsAdmin();

        $visaEntry = VisaPipelineEntry::create([
            'candidate_name' => 'Approved Payment Candidate',
            'passport_number' => 'APC123456',
            'company_name' => 'Approved Payment Client',
            'bd_name' => 'Approved Payment BD',
            'project_number' => 'APP-001',
            'country' => 'Approvedland',
            'office_rate' => 1000,
            'total_fee' => 1000,
            'advance_1' => 0,
            'advance_2' => 0,
            'advance_3' => 0,
        ]);

        DaybookEntry::create([
            'entry_date' => now()->toDateString(),
            'type' => 'payment',
            'linked_module' => 'visa_pipeline',
            'linked_record_id' => (string) $visaEntry->id,
            'linked_record_name' => 'Visa payment approved on create',
            'particulars' => 'Visa pipeline payment',
            'amount' => 250,
            'approval_status' => 'approved',
            'approved_by' => $admin->id,
            'approved_at' => now(),
            'created_by' => $admin->id,
        ]);

        $visaEntry->refresh();
        $this->assertSame(1000.00, (float) $visaEntry->office_rate);
    }
}
