<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class TrainingCompany extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'company_name',
        'phone',
        'email',
        'country',
        'invoice_number',
        'invoice_amount',
        'notes',
        'created_by',
    ];

    public function enrollments()
    {
        return $this->hasMany(TrainingEnrollment::class, 'training_company_id');
    }
}
