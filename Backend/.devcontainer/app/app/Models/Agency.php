<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Agency extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_name',
        'contact_person',
        'phone',
        'email',
        'contact_person_1',
        'designation_1',
        'phone_number_1',
        'email_1',
        'contact_person_2',
        'designation_2',
        'phone_number_2',
        'email_2',
        'country',
        'note',
        'is_active',
        'created_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
