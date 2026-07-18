<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Ranking extends Model
{
    protected $fillable = [
        'event_id', 'department', 'total_score', 'judge_count', 'rank',
    ];

    protected $casts = [
        'total_score' => 'decimal:4',
        'judge_count' => 'integer',
        'rank'        => 'integer',
    ];

    public function event()
    {
        return $this->belongsTo(Event::class, 'event_id');
    }
}
