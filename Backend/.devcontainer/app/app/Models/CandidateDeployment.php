<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class CandidateDeployment extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'candidate_id',
        'destination',
        'flight_ticket',
        'flight_date',
        'status',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'flight_date' => 'date',
    ];

    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
