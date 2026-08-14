<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Certification extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'training_enrollment_id',
        'certificate_number',
        'certificate_received_date',
        'certificate_to_be_given_date',
        'certification_level',
        'issuing_authority',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'certificate_received_date' => 'date',
        'certificate_to_be_given_date' => 'date',
    ];

    public function trainingEnrollment()
    {
        return $this->belongsTo(TrainingEnrollment::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
