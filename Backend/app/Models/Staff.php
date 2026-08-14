<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Staff extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'full_name',
        'email',
        'phone',
        'position',
        'employment_type',
        'hire_date',
        'department',
        'base_salary',
        'status',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'hire_date' => 'date',
        'base_salary' => 'decimal:2',
    ];

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function payroll(): HasMany
    {
        return $this->hasMany(Payroll::class);
    }

    public function salary(): HasMany
    {
        return $this->hasMany(StaffSalary::class);
    }

    public function advances(): HasMany
    {
        return $this->hasMany(SalaryAdvance::class);
    }

    public function salaryHistory(): HasMany
    {
        return $this->hasMany(SalaryHistory::class);
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeByDepartment($query, $department)
    {
        return $query->where('department', $department);
    }

    public static function getActiveStaff()
    {
        return self::where('status', 'active')->orderBy('full_name')->get();
    }
};
