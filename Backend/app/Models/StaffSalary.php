<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class StaffSalary extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'staff_salary';

    protected $fillable = [
        'staff_id',
        'base_salary',
        'current_bonus',
        'total_compensation',
        'effective_from',
        'effective_to',
        'status',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'base_salary' => 'decimal:2',
        'current_bonus' => 'decimal:2',
        'total_compensation' => 'decimal:2',
        'effective_from' => 'date',
        'effective_to' => 'date',
    ];

    public function staff(): BelongsTo
    {
        return $this->belongsTo(Staff::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active')->where(function ($q) {
            $q->whereNull('effective_to')
                ->orWhere('effective_to', '>=', now()->toDateString());
        });
    }

    public function scopeByStaff($query, $staffId)
    {
        return $query->where('staff_id', $staffId);
    }

    public static function getActiveSalaryForStaff($staffId)
    {
        return self::active()
            ->where('staff_id', $staffId)
            ->latest('effective_from')
            ->first();
    }
};
