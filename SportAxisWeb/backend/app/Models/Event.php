<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Event extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'name', 'category', 'schedule', 'start_time', 'end_time',
        'venue_id', 'venue_name', 'departments', 'judges', 'criteria', 'status', 'qr_token',
    ];

    protected $casts = [
        'departments' => 'array',
        'judges'      => 'array',
        'criteria'    => 'array',
    ];

    public function scores()
    {
        return $this->hasMany(Score::class, 'event_id');
    }

    public function rankings()
    {
        return $this->hasMany(Ranking::class, 'event_id');
    }

    public function toApiFormat(): array
    {
        return [
            'id'          => $this->id,
            'name'        => $this->name,
            'category'    => $this->category,
            'schedule'    => $this->schedule,
            'startTime'   => $this->start_time,
            'endTime'     => $this->end_time,
            'venueId'     => $this->venue_id,
            'venueName'   => $this->venue_name,
            'departments' => $this->departments ?? [],
            'judges'      => $this->judges ?? [],
            'criteria'    => $this->criteria ?? [],
            'status'      => $this->status,
            'qrToken'     => $this->qr_token,
            'createdAt'   => $this->created_at,
        ];
    }
}
