<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class DocumentPayment extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'candidate_id',
        'country',
        'category',
        'passport_number',
        'document_type',
        'amount',
        'payment_date',
        'payment_mode',
        'receipt_number',
        'notes',
        'police_report_included',
        'medical_report_included',
        'cv_included',
        'video_included',
        'police_report_file',
        'medical_report_file',
        'visa_status',
        'created_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'payment_date' => 'date',
        'police_report_included' => 'boolean',
        'medical_report_included' => 'boolean',
        'cv_included' => 'boolean',
        'video_included' => 'boolean',
    ];

    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public static function getTotalForCandidate(int $candidateId): float
    {
        return (float) self::where('candidate_id', $candidateId)->sum('amount');
    }
}
