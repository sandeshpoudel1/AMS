<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\ProjectSetting;

class Candidate extends Model
{
    use HasFactory;

    protected $fillable = [
        'full_name',
        'email',
        'phone',
        'passport_number',
        'date_of_birth',
        'passport_issue_date',
        'passport_expiry_date',
        'passport_renewal_day',
        'gender',
        'nationality',
        'status',
        'passport_store_status',
        'passport_store_out_by',
        'passport_store_out_date',
        'is_active',
        'source',
        'address',
        'notes',
        'paid_amount',
        'created_by',
        'user_id',
        'project_id',
    ];

    protected $casts = [
        'date_of_birth' => 'date',
        'passport_issue_date' => 'date',
        'passport_expiry_date' => 'date',
        'passport_renewal_day' => 'date',
        'is_active' => 'boolean',
        'paid_amount' => 'decimal:2',
        'passport_store_out_date' => 'date',
    ];

    protected $appends = [
        'status_label',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(CandidateDocument::class);
    }

    public function loginAccount(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(ProjectSetting::class);
    }

    public function trainingEnrollments(): HasMany
    {
        return $this->hasMany(TrainingEnrollment::class);
    }

    public function trainings()
    {
        return $this->hasManyThrough(Training::class, TrainingEnrollment::class);
    }

    public function subHeadCharges(): HasMany
    {
        return $this->hasMany(SubHeadCandidateCharge::class);
    }

    public function getStatusLabelAttribute(): string
    {
        return ucwords(str_replace('_', ' ', (string) $this->status));
    }
}
