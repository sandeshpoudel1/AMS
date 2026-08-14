<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SubHeadCandidateCharge extends Model
{
    use HasFactory;

    protected $fillable = [
        'expense_head_id',
        'candidate_id',
        'agency_id',
        'amount',
        'notes',
        'is_active',
        'created_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function expenseHead()
    {
        return $this->belongsTo(ExpenseHead::class, 'expense_head_id');
    }

    public function candidate()
    {
        return $this->belongsTo(Candidate::class, 'candidate_id');
    }

    public function agency()
    {
        return $this->belongsTo(Agency::class, 'agency_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
