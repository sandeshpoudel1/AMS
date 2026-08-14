<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Payroll extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'payroll';

    protected $fillable = [
        'staff_id',
        'pay_period_start',
        'pay_period_end',
        'payment_date',
        'base_salary',
        'allowances',
        'bonus',
        'advance_deduction',
        'overtime_hours',
        'overtime_rate',
        'overtime_amount',
        'gross_amount',
        'tax_deduction',
        'insurance_deduction',
        'other_deductions',
        'total_deductions',
        'net_amount',
        'payment_status',
        'amount_paid',
        'payment_reference',
        'payment_method',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'base_salary' => 'decimal:2',
        'allowances' => 'decimal:2',
        'bonus' => 'decimal:2',
        'advance_deduction' => 'decimal:2',
        'overtime_hours' => 'decimal:2',
        'overtime_rate' => 'decimal:2',
        'overtime_amount' => 'decimal:2',
        'gross_amount' => 'decimal:2',
        'tax_deduction' => 'decimal:2',
        'insurance_deduction' => 'decimal:2',
        'other_deductions' => 'decimal:2',
        'total_deductions' => 'decimal:2',
        'net_amount' => 'decimal:2',
        'amount_paid' => 'decimal:2',
        'pay_period_start' => 'date',
        'pay_period_end' => 'date',
        'payment_date' => 'date',
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
        return (float) ($this->net_amount - $this->amount_paid);
    }

    public function scopePending($query)
    {
        return $query->where('payment_status', 'pending');
    }

    public function scopePartial($query)
    {
        return $query->where('payment_status', 'partial');
    }

    public function scopePaid($query)
    {
        return $query->where('payment_status', 'paid');
    }

    public function scopeByPayPeriod($query, $startDate, $endDate)
    {
        return $query->whereBetween('pay_period_start', [$startDate, $endDate]);
    }

    public function scopeByStaff($query, $staffId)
    {
        return $query->where('staff_id', $staffId);
    }

    public static function getTotalGross($startDate = null, $endDate = null)
    {
        $query = self::query();
        if ($startDate && $endDate) {
            $query->byPayPeriod($startDate, $endDate);
        }
        return $query->sum('gross_amount');
    }

    public static function getTotalDeductions($startDate = null, $endDate = null)
    {
        $query = self::query();
        if ($startDate && $endDate) {
            $query->byPayPeriod($startDate, $endDate);
        }
        return $query->sum('total_deductions');
    }

    public static function getTotalNet($startDate = null, $endDate = null)
    {
        $query = self::query();
        if ($startDate && $endDate) {
            $query->byPayPeriod($startDate, $endDate);
        }
        return $query->sum('net_amount');
    }

    public static function getTotalPaid($startDate = null, $endDate = null)
    {
        $query = self::query();
        if ($startDate && $endDate) {
            $query->byPayPeriod($startDate, $endDate);
        }
        return $query->sum('amount_paid');
    }
};
