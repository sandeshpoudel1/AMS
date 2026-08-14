<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class TrainingAssessment extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'enrollment_id',
        'result',
        're_assessment_required',
        'reassessment_1_date',
        'reassessment_1_result',
        'reassessment_2_date',
        'reassessment_2_result',
        'certificate_card_status',
        'dispatch_status',
        'certification_expiry_date',
        'invoice_number',
        'invoice_amount',
        'card_payment',
        'notes',
        'created_by',
    ];

    protected $casts = [
        're_assessment_required' => 'boolean',
        'reassessment_1_date'    => 'date',
        'reassessment_2_date'    => 'date',
        'certification_expiry_date' => 'date',
        'invoice_amount'         => 'decimal:2',
        'card_payment'           => 'decimal:2',
    ];

    /** @return \Illuminate\Database\Eloquent\Relations\BelongsTo */
    public function enrollment()
    {
        return $this->belongsTo(TrainingEnrollment::class, 'enrollment_id');
    }

    /** @return \Illuminate\Database\Eloquent\Relations\BelongsTo */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Due amount = invoice_amount - card_payment
     */
    public function getDueAttribute(): float
    {
        return max(0, (float) $this->invoice_amount - (float) $this->card_payment);
    }
}
