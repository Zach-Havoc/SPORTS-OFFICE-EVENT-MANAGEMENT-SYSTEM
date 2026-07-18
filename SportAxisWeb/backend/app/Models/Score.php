<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Score extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'event_id', 'department', 'judge_id', 'judge_name',
        'scores', 'total_score', 'submitted_via_qr', 'method', 'image_url',
    ];

    protected $casts = [
        'scores'           => 'array',
        'submitted_via_qr' => 'boolean',
        'total_score'      => 'decimal:4',
    ];

    public function event()
    {
        return $this->belongsTo(Event::class, 'event_id');
    }
}
