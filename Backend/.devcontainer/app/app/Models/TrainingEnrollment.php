<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class TrainingEnrollment extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'candidate_id',
        'participant_name',
        'training_id',
        'training_company_id',
        'enrollment_date',
        'start_date',
        'end_date',
        'duration_days',
        'passport_number',
        'previous_experience',
        'instructor_assigned',
        'record_document',
        'certificate_status',
        'status',
        'training_amount',
        'paid_amount',
        'advance_payment_1',
        'advance_payment_2',
        'advance_payment_3',
        'discount_amount',
        'payment_reference',
        'payment_status',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'enrollment_date' => 'date',
        'start_date' => 'date',
        'end_date' => 'date',
        'training_amount' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'advance_payment_1' => 'decimal:2',
        'advance_payment_2' => 'decimal:2',
        'advance_payment_3' => 'decimal:2',
        'discount_amount' => 'decimal:2',
    ];

    public function candidate()
    {
        return $this->belongsTo(Candidate::class);
    }

    public function training()
    {
        return $this->belongsTo(Training::class);
    }

    public function trainingCompany()
    {
        return $this->belongsTo(TrainingCompany::class, 'training_company_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function certification()
    {
        return $this->hasOne(Certification::class);
    }

    /**
     * Calculate remaining balance
     */
    public function getRemainingBalance()
    {
        return (float)($this->training_amount - $this->paid_amount);
    }

    /**
     * Scope to get by candidate
     */
    public function scopeByCandidate($query, $candidateId)
    {
        return $query->where('candidate_id', $candidateId);
    }

    /**
     * Scope to get by status
     */
    public function scopeByStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Scope to get unpaid enrollments
     */
    public function scopeUnpaid($query)
    {
        return $query->whereIn('payment_status', ['unpaid', 'partial']);
    }

    /**
     * Get total training amount for a candidate
     */
    public static function getTotalTrainingAmount($candidateId)
    {
        return self::byCandidate($candidateId)->sum('training_amount');
    }

    /**
     * Get total paid amount for a candidate
     */
    public static function getTotalPaidAmount($candidateId)
    {
        return self::byCandidate($candidateId)->sum('paid_amount');
    }
}
