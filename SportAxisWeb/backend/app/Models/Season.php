<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One tournament edition (a school year's intramurals). Exactly one row is
 * `is_active`; that one is the default scope for the public boards.
 */
class Season extends Model
{
    use Auditable;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'name', 'starts_on', 'ends_on', 'is_active'];

    protected $casts = [
        'starts_on' => 'date',
        'ends_on' => 'date',
        'is_active' => 'boolean',
    ];

    public function events(): HasMany
    {
        return $this->hasMany(Event::class, 'season_id');
    }

    public function brackets(): HasMany
    {
        return $this->hasMany(Bracket::class, 'season_id');
    }

    /** The single active season, or null before any season exists. */
    public static function current(): ?self
    {
        return static::query()->where('is_active', true)->first();
    }

    public function toApiFormat(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'startsOn' => $this->starts_on?->toDateString(),
            'endsOn' => $this->ends_on?->toDateString(),
            'isActive' => (bool) $this->is_active,
            'eventCount' => $this->events()->count(),
            'createdAt' => $this->created_at,
        ];
    }
}
