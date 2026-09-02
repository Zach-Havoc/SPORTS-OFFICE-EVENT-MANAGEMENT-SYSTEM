<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Bracket extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'sport', 'format', 'name', 'status',
        'seeded', 'champion', 'settings', 'created_by',
    ];

    protected $casts = [
        'seeded'   => 'boolean',
        'settings' => 'array',
    ];

    public function matches()
    {
        return $this->hasMany(BracketMatch::class)->orderBy('round')->orderBy('slot');
    }

    public function toApiFormat(): array
    {
        return [
            'id'       => $this->id,
            'sport'    => $this->sport,
            'format'   => $this->format,
            'name'     => $this->name,
            'status'   => $this->status,
            'seeded'   => $this->seeded,
            'champion' => $this->champion,
            'settings' => $this->settings ?? [],
            'rounds'   => (int) ($this->matches->max('round') ?? 0),
            'matches'  => $this->matches->map->toApiFormat()->values(),
            'createdAt' => $this->created_at,
        ];
    }
}
