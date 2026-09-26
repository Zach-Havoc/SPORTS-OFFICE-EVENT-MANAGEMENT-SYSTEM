<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class Event extends Model
{
    use Auditable;
    use SoftDeletes;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'name', 'category', 'schedule', 'start_time', 'end_time',
        'venue_id', 'venue_name', 'departments', 'judges', 'status', 'qr_token', 'category_id',
        'season_id',
    ];

    protected $casts = [
        'departments' => 'array',
        'judges' => 'array',
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
        $end = self::timeToMinutes($endTime);
        $date = $schedule ? substr($schedule, 0, 10) : null;

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
                $s = self::timeToMinutes($e->start_time);
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

    protected static function booted(): void
    {
        // A new event with no explicit season joins the active one, so no
        // write path (admin form, bracket publish, seeder) can leave it
        // unattached.
        static::creating(function (Event $event) {
            if (! $event->season_id) {
                $event->season_id = Season::current()?->id;
            }
        });

        // Every write path goes through save(), so keeping the taxonomy keys
        // in step here means none of them can forget to.
        static::saved(fn (Event $event) => $event->syncTaxonomyKeys());
    }

    /**
     * Whether this user may score this game: a committee member (judge) only
     * if the office assigned them to it, and the office (admin) always, so a
     * game can still be recorded if its committee can't make it.
     */
    public function isScorableBy(?User $user): bool
    {
        if (! $user) {
            return false;
        }
        if ($user->role === 'admin') {
            return true;
        }

        return $user->role === 'judge'
            && collect($this->judges ?? [])->contains(fn ($j) => ($j['id'] ?? null) === $user->id);
    }

    /** The tournament edition this event belongs to. */
    public function season()
    {
        return $this->belongsTo(Season::class, 'season_id');
    }

    /**
     * Mirror the `category` / `departments` name fields onto the real keys:
     * `category_id` and the `event_department` junction. Colleges are matched
     * on full name OR abbreviation, because both spellings exist in the data.
     */
    public function syncTaxonomyKeys(): void
    {
        $key = fn (?string $v) => mb_strtolower(trim((string) $v));

        if ($this->wasRecentlyCreated || $this->wasChanged('category') || $this->category_id === null) {
            $categoryId = Category::whereRaw('LOWER(name) = ?', [$key($this->category)])->value('id');
            if ($categoryId !== $this->category_id) {
                DB::table('events')->where('id', $this->id)->update(['category_id' => $categoryId]);
                $this->attributes['category_id'] = $categoryId;
            }
        }

        $stale = $this->wasRecentlyCreated
            || $this->wasChanged('departments')
            || ! DB::table('event_department')->where('event_id', $this->id)->exists();

        if (! $stale) {
            return;
        }

        $wanted = collect($this->departments ?? [])->map($key)->filter()->unique();

        $ids = $wanted->isEmpty()
            ? collect()
            : Department::all(['id', 'name', 'abbreviation'])
                ->filter(fn ($d) => $wanted->contains($key($d->name)) || $wanted->contains($key($d->abbreviation)))
                ->pluck('id');

        DB::table('event_department')->where('event_id', $this->id)->delete();

        if ($ids->isNotEmpty()) {
            DB::table('event_department')->insertOrIgnore(
                $ids->map(fn ($id) => ['event_id' => $this->id, 'department_id' => $id])->all()
            );
        }
    }

    /** The competing colleges, by key (the `departments` JSON stays as the label cache). */
    public function departmentRows()
    {
        return $this->belongsToMany(Department::class, 'event_department', 'event_id', 'department_id');
    }

    /** The sport (or racquet discipline) this event is played under. */
    public function categoryRow()
    {
        return $this->belongsTo(Category::class, 'category_id');
    }

    public function toApiFormat(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'category' => $this->category,
            'schedule' => $this->schedule,
            'startTime' => $this->start_time,
            'endTime' => $this->end_time,
            'venueId' => $this->venue_id,
            'venueName' => $this->venue_name,
            'departments' => $this->departments ?? [],
            // Public endpoint: expose only what consumers need to show, never
            // a judge's contact details (mirrors EventSessionController).
            'judges' => collect($this->judges ?? [])
                ->map(fn ($j) => ['id' => $j['id'] ?? null, 'name' => $j['name'] ?? null])
                ->values()
                ->all(),
            'status' => $this->status,
            'qrToken' => $this->qr_token,
            'seasonId' => $this->season_id,
            'createdAt' => $this->created_at,
        ];
    }
}
