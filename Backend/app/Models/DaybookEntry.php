<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class DaybookEntry extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'daybook_entries';
    protected $fillable = [
        'entry_date',
        'type',
        'expense_head_id',
        'linked_module',
        'linked_record_id',
        'linked_record_name',
        'company_name',
        'particulars',
        'transaction_type',
        'sub_passport_number',
        'amount',
        'ssf_amount',
        'welfare_amount',
        'insurance_amount',
        'description',
        'reference_number',
        'created_by',
        'approval_status',
        'approved_by',
        'approved_at',
    ];

    protected $casts = [
        'entry_date' => 'date',
        'amount' => 'decimal:2',
        'ssf_amount' => 'decimal:2',
        'welfare_amount' => 'decimal:2',
        'insurance_amount' => 'decimal:2',
    ];

    protected $dates = [
        'approved_at',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function expenseHead()
    {
        return $this->belongsTo(ExpenseHead::class, 'expense_head_id');
    }

    /**
     * Scope to get all receipts
     */
    public function scopeReceipts($query)
    {
        return $query->where('type', 'receipt');
    }

    /**
     * Scope to get all payments
     */
    public function scopePayments($query)
    {
        return $query->where('type', 'payment');
    }

    /**
     * Scope to get entries by date
     */
    public function scopeByDate($query, $date)
    {
        return $query->whereDate('entry_date', $date);
    }

    /**
     * Scope to get entries by date range
     */
    public function scopeByDateRange($query, $startDate, $endDate)
    {
        return $query->whereDate('entry_date', '>=', $startDate)
                     ->whereDate('entry_date', '<=', $endDate);
    }

    /**
     * Get total receipts for a date
     */
    public static function getTotalReceipts($date = null)
    {
        $query = self::receipts();
        if ($date) {
            $query->byDate($date);
        }
        return $query->sum('amount');
    }

    /**
     * Get total payments for a date
     */
    public static function getTotalPayments($date = null)
    {
        $query = self::payments();
        if ($date) {
            $query->byDate($date);
        }
        return $query->sum('amount');
    }
}
