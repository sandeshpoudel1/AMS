<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProjectSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_name',
        'agency_name',
        'agency_id',
        'project_start_date',
        'trade',
        'number_of_requirements',
        'salary_per_trade',
        'food_per_trade',
        'allowance_per_trade',
        'project_reference_code',
        'office_rate_per_trade',
        'country',
        'total_demand',
        'note',
        'is_active',
        'bd',
        'client',
        'created_by',
    ];

    protected $casts = [
        'project_start_date' => 'date',
        'number_of_requirements' => 'integer',
        'salary_per_trade' => 'decimal:2',
        'food_per_trade' => 'decimal:2',
        'allowance_per_trade' => 'decimal:2',
        'office_rate_per_trade' => 'decimal:2',
        'total_demand' => 'integer',
        'is_active' => 'boolean',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
