<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class CandidateReference extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'candidate_id',
        'referred_by_candidate_id',
        'reference_id',
        'referred_by_name',
        'recruitment_company',
        'referee_count',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'referee_count' => 'integer',
    ];

    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class);
    }

    public function referredByCandidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class, 'referred_by_candidate_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Generate a unique reference ID like REF-2026-0001
     */
    public static function generateReferenceId(): string
    {
        $year = now()->year;
        $prefix = "REF-{$year}-";
        $last = self::withTrashed()
            ->where('reference_id', 'like', $prefix . '%')
            ->orderByDesc('id')
            ->value('reference_id');

        if ($last) {
            $seq = (int)substr($last, strlen($prefix)) + 1;
        } else {
            $seq = 1;
        }

        return $prefix . str_pad($seq, 4, '0', STR_PAD_LEFT);
    }
}
