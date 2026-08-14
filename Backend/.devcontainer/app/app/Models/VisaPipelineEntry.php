<?php

namespace App\Models;

use App\Models\ProjectSetting;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Schema;

class VisaPipelineEntry extends Model
{
    use SoftDeletes;

    /**
     * Use the new candidate_flown_entries table when available,
     * otherwise fall back to visa_pipeline_entries for older DBs.
     */
    protected static ?string $resolvedTable = null;

    public function getTable(): string
    {
        if (static::$resolvedTable === null) {
            static::$resolvedTable = Schema::hasTable('candidate_flown_entries')
                ? 'candidate_flown_entries'
                : 'visa_pipeline_entries';
        }

        return static::$resolvedTable;
    }

    protected $fillable = [
        'candidate_id',
        'original_passport_status',
        'photo_status',
        'pcc_status',
        'medical_status',
        'qvc_status',
        'svp_status',
        'vfs_status',
        'mol_status',
        'visa_received_status',
        'medical_online_status',
        'orientation_online_status',
        'ticket_date',
        'deployment_status',
        'candidate_name',
        'passport_number',
        'company_name',
        'bd_name',
        'project_id',
        'project_number',
        'country',
        'office_rate',
        'working_category',
        'total_fee',
        'flight_date',
        'advance_1',
        'advance_2',
        'advance_3',
        'is_payment_booked',
        'manual_checklist',
        'created_by',
    ];

    protected $casts = [
        'flight_date'   => 'date',
        'ticket_date'   => 'date',
        'manual_checklist' => 'array',
        'total_fee'     => 'decimal:2',
        'office_rate'   => 'decimal:2',
        'advance_1'     => 'decimal:2',
        'advance_2'     => 'decimal:2',
        'advance_3'     => 'decimal:2',
        'is_payment_booked' => 'boolean',
    ];

    /** @return \Illuminate\Database\Eloquent\Relations\BelongsTo */
    public function candidate()
    {
        return $this->belongsTo(Candidate::class, 'candidate_id');
    }

    /** @return \Illuminate\Database\Eloquent\Relations\BelongsTo */
    public function project()
    {
        return $this->belongsTo(ProjectSetting::class, 'project_id');
    }

    /** @return \Illuminate\Database\Eloquent\Relations\BelongsTo */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** Total received = sum of all three advances */
    public function getTotalReceivedAttribute(): float
    {
        return (float) $this->advance_1 + (float) $this->advance_2 + (float) $this->advance_3;
    }

    /** Amount due = total_fee - total_received */
    public function getAmountDueAttribute(): float
    {
        return max(0, (float) $this->total_fee - $this->total_received);
    }

    /** Service fee due = service_fee_company - service_fee_received */
    public function getServiceFeeDueAttribute(): float
    {
        return max(0, (float) $this->service_fee_company - (float) $this->service_fee_received);
    }

    /** Total expenses = sum of all expense items */
    public function getTotalExpensesAttribute(): float
    {
        return (float) $this->ticket_expenses
            + (float) $this->admin_expenses
            + (float) $this->other_topic_expense
            + (float) $this->skill_verification_payment
            + (float) $this->pcc_attestation_charge
            + (float) $this->typing_stamping_charge
            + (float) $this->demand_attestation_mofa_chamber_fee
            + (float) $this->translation_color_print_documentation
            + (float) $this->final_approval_fee_shram
            + (float) $this->visa_stamping_ksa;
    }

    /** Grand total expenses = commission + total_expenses */
    public function getGrandTotalExpensesAttribute(): float
    {
        return (float) $this->commission_npr + $this->total_expenses;
    }

    /** P/L = total_fee - grand_total_expenses */
    public function getProfitLossAttribute(): float
    {
        return (float) $this->total_fee - $this->grand_total_expenses;
    }

    /** Grand total amount due = max(0, grand_total_expenses - total_fee) */
    public function getGrandTotalAmountDueAttribute(): float
    {
        return max(0, $this->grand_total_expenses - (float) $this->total_fee);
    }
}
