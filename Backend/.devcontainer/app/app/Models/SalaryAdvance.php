<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalaryAdvance extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'staff_id',
        'amount',
        'amount_repaid',
        'advance_date',
        'status',
        'reference_number',
        'payment_method',
        'reason',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'amount_repaid' => 'decimal:2',
        'advance_date' => 'date',
    ];

    public function staff(): BelongsTo
    {
        return $this->belongsTo(Staff::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getRemainingBalance(): float
    {
        return (float) ($this->amount - $this->amount_repaid);
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopePartial($query)
    {
        return $query->where('status', 'partial');
    }

    public function scopeRepaid($query)
    {
        return $query->where('status', 'repaid');
    }

    public function scopeByStaff($query, $staffId)
    {
        return $query->where('staff_id', $staffId);
    }

    public static function getTotalAdvancesForStaff($staffId)
    {
        return self::where('staff_id', $staffId)
            ->whereIn('status', ['pending', 'partial'])
            ->sum('amount');
    }

    public static function getTotalAdvancesPendingForStaff($staffId)
    {
        return self::where('staff_id', $staffId)
            ->whereIn('status', ['pending', 'partial'])
            ->sum(\DB::raw('amount - amount_repaid'));
    }
};
