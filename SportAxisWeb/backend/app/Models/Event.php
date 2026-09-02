<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

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

    /**
     * Parse a stored time string to minutes-since-midnight.
     * Accepts "20:00", "8:00", "08:00 AM", "8:00 PM". Returns null if unparseable.
     */
    public static function timeToMinutes(?string $time): ?int
    {
        if ($time === null) {
            return null;
        }
        $time = trim($time);

        if (preg_match('/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/', $time, $m)) {
            $h = ((int) $m[1]) % 12;
            if (strtolower($m[3]) === 'pm') {
                $h += 12;
            }

            return $h * 60 + (int) $m[2];
        }

        if (preg_match('/^(\d{1,2}):(\d{2})/', $time, $m)) {
            return ((int) $m[1]) * 60 + (int) $m[2];
        }

        return null;
    }

    /**
     * Other events booked in the SAME venue on the SAME day whose time window
     * overlaps [$startTime, $endTime]. An empty collection means "no clash".
     *
     * Two events share a venue if their venue_id matches, or (when an id is
     * missing on either side) their venue_name matches — so a duplicated
     * "Main Gymnasium" row still counts as the same physical room.
     */
    public static function venueConflicts(
        ?string $venueId,
        ?string $venueName,
        ?string $schedule,
        ?string $startTime,
        ?string $endTime,
        ?string $ignoreId = null
    ): Collection {
        $start = self::timeToMinutes($startTime);
        $end   = self::timeToMinutes($endTime);
        $date  = $schedule ? substr($schedule, 0, 10) : null;

        // Nothing to clash with: no venue, no date, or no readable time window.
        if (! $date || $start === null || $end === null) {
            return collect();
        }
        if (! $venueId && ! $venueName) {
            return collect();
        }
        if ($end <= $start) {
            $end = $start + 1;
        }

        return self::query()
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->whereDate('schedule', $date)
            ->where(function ($q) use ($venueId, $venueName) {
                if ($venueId) {
                    $q->where('venue_id', $venueId);
                    if ($venueName) {
                        $q->orWhere('venue_name', $venueName);
                    }
                } else {
                    $q->where('venue_name', $venueName);
                }
            })
            ->get()
            ->filter(function (Event $e) use ($start, $end) {
                $s  = self::timeToMinutes($e->start_time);
                $en = self::timeToMinutes($e->end_time);
                if ($s === null || $en === null) {
                    return false;
                }
                if ($en <= $s) {
                    $en = $s + 1;
                }

                return $start < $en && $s < $end; // half-open overlap
            })
            ->values();
    }

    /** Short phrase describing a clashing event. */
    public static function conflictMessage(Event $c): string
    {
        return "Venue already scheduled: {$c->venue_name}, {$c->start_time}-{$c->end_time}.";
    }

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
            'status'      => $this->status,
            'qrToken'     => $this->qr_token,
            'createdAt'   => $this->created_at,
        ];
    }
}
