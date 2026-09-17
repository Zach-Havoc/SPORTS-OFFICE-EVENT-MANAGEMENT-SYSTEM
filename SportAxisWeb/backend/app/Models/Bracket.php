<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Bracket extends Model
{
    use Auditable;
    use SoftDeletes;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'sport', 'format', 'name', 'status',
        'seeded', 'champion', 'settings', 'created_by', 'season_id',
    ];

    protected $casts = [
        'seeded' => 'boolean',
        'settings' => 'array',
    ];

    protected static function booted(): void
    {
        static::creating(function (Bracket $bracket) {
            if (! $bracket->season_id) {
                $bracket->season_id = Season::current()?->id;
            }
        });
    }

    public function matches()
    {
        return $this->hasMany(BracketMatch::class)->orderBy('round')->orderBy('slot');
    }

    public function season()
    {
        return $this->belongsTo(Season::class, 'season_id');
    }

    public function toApiFormat(): array
    {
        return [
            'id' => $this->id,
            'sport' => $this->sport,
            'format' => $this->format,
            'name' => $this->name,
            'status' => $this->status,
            'seeded' => $this->seeded,
            'champion' => $this->champion,
            'settings' => $this->settings ?? [],
            'rounds' => (int) ($this->matches->max('round') ?? 0),
            'matches' => $this->matches->map->toApiFormat()->values(),
            'seasonId' => $this->season_id,
            'createdAt' => $this->created_at,
        ];
    }
}
