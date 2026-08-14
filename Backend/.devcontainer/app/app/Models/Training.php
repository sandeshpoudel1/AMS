<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Training extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'category',
        'subcategory',
        'description',
        'daily_rate',
        'duration_days',
        'is_active',
    ];

    protected $casts = [
        'daily_rate' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function enrollments()
    {
        return $this->hasMany(TrainingEnrollment::class);
    }

    public function candidates()
    {
        return $this->hasManyThrough(Candidate::class, TrainingEnrollment::class);
    }

    /**
     * Scope to get active trainings
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to get trainings by category
     */
    public function scopeByCategory($query, $category)
    {
        return $query->where('category', $category);
    }
}
