<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\Paginates;
use App\Http\Controllers\Concerns\ResolvesSeason;
use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Event;
use App\Models\Ranking;
use App\Models\TeamMatch;
use App\Models\User;
use App\Models\Venue;
use App\Notifications\CommitteeAssigned;
use App\Services\ScheduleNotifier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class EventController extends Controller
{
    /** One committee member scores each event. */
    private const RESEND_COOLDOWN_MINUTES = 5;

    private const ONE_COMMITTEE = ['judges.max' => 'Only one committee member can be assigned to an event.'];

    use Paginates, ResolvesSeason;

    /**
     * Reject a roster that doesn't fit how the sport is contested:
     *   versus → exactly two distinct colleges (one game)
     *   ranked → two or more
     * Returns an error phrase, or null when the roster is fine.
     */
    /**
     * Reject an end time at or before the start time.
     *
     * Reads both sides through Event::timeToMinutes() so the rule agrees with
     * venueConflicts() by construction — start/end are stored as clock strings
     * ("09:00", "08:00 AM"), not datetimes, so Laravel's after: rule would both
     * parse them differently and, on a partial update, try to parse the literal
     * field name. A side that won't parse is left alone, matching the leniency
     * venueConflicts() already applies.
     */
    private function endAfterStart(callable $startValue): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail) use ($startValue) {
            $start = Event::timeToMinutes(is_string($s = $startValue()) ? $s : null);
            $end = Event::timeToMinutes(is_string($value) ? $value : null);
            if ($start !== null && $end !== null && $end <= $start) {
                $fail('The end time must be after the start time.');
            }
        };
    }

    /** Mirror of endAfterStart() for a partial update that sends only startTime. */
    private function startBeforeEnd(callable $endValue): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail) use ($endValue) {
            $start = Event::timeToMinutes(is_string($value) ? $value : null);
            $end = Event::timeToMinutes(is_string($e = $endValue()) ? $e : null);
            if ($start !== null && $end !== null && $start >= $end) {
                $fail('The start time must be before the end time.');
            }
        };
    }

    private function rosterError(?string $category, array $departments): ?string
    {
        $depts = array_values(array_unique(array_filter(
            array_map(fn ($d) => is_string($d) ? trim($d) : $d, $departments)
        )));

        $format = Category::where('name', $category)->value('format') ?: 'ranked';

        if ($format === 'versus' && count($depts) !== 2) {
            return 'Two-team sport — pick exactly two colleges.';
        }
        if (count($depts) < 2) {
            return 'Pick at least two colleges.';
        }

        return null;
    }

    public function index(Request $request)
    {
        $query = Event::orderBy('schedule', 'asc');

        if ($request->has('date') && $request->date) {
            $query->whereDate('schedule', $request->date);
        }

        // Default to the active edition; ?season=all or ?season=<id> overrides.
        if ($seasonId = $this->seasonScope($request)) {
            $query->where('season_id', $seasonId);
        }

        $events = $query->paginate($this->perPage($request, 50));
        $results = $this->resultsFor($events->getCollection());
        $events->getCollection()->transform(
            fn ($e) => $e->toApiFormat() + ['result' => $results[$e->id] ?? null]
        );

        return response()->json($events);
    }

    public function show(string $id)
    {
        $event = Event::findOrFail($id);

        return response()->json($event->toApiFormat());
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string',
            'category' => 'required|string',
            'schedule' => 'required|date',
            'startTime' => 'required|string',
            'endTime' => ['required', 'string', $this->endAfterStart(fn () => $request->startTime)],
            'departments' => 'required|array',
            'judges' => 'sometimes|array|max:1',
            'status' => 'in:upcoming,ongoing,completed',
        ], self::ONE_COMMITTEE, ['category' => 'sport']);

        if ($rosterError = $this->rosterError($request->category, (array) $request->departments)) {
            return response()->json(['error' => $rosterError], 422);
        }

        // Resolve the venue once. An id that matches no row falls back to the
        // free-text name; only the resolved id is ever stored, because
        // events.venue_id is a foreign key and a bogus id aborts the insert.
        $venue = $request->venueId ? Venue::find($request->venueId) : null;
        $venueName = $venue?->name ?? $request->venueName;

        // Block double-booking: same venue, same day, overlapping time.
        $conflicts = Event::venueConflicts(
            $venue?->id,
            $venueName,
            $request->schedule,
            $request->startTime,
            $request->endTime,
        );
        if ($conflicts->isNotEmpty()) {
            return response()->json([
                'error' => Event::conflictMessage($conflicts->first()),
                'conflicts' => $conflicts->map->toApiFormat(),
            ], 422);
        }

        $event = Event::create([
            'id' => Str::uuid(),
            'name' => $request->name,
            'category' => $request->category,
            'schedule' => $request->schedule,
            'start_time' => $request->startTime,
            'end_time' => $request->endTime,
            'venue_id' => $venue?->id,
            'venue_name' => $venueName,
            'departments' => $request->departments,
            'judges' => $request->judges ?? [],
            'status' => $request->status ?? 'upcoming',
            'qr_token' => Str::random(32),
        ]);

        $emailed = $this->notifyCommittee($event);
        app(ScheduleNotifier::class)->created($event);

        return response()->json($event->toApiFormat() + ['committeeEmail' => $emailed], 201);
    }

    public function update(Request $request, string $id)
    {
        $event = Event::findOrFail($id);

        // Either half of the time pair may be absent; the missing side is read
        // from the stored event so a partial edit can't invert the window.
        $rules = [
            'name' => 'sometimes|string',
            'category' => 'sometimes|string',
            'schedule' => 'sometimes|date',
            'startTime' => ['sometimes', 'string'],
            'endTime' => ['sometimes', 'string'],
            'venueId' => 'sometimes|nullable|string',
            'venueName' => 'sometimes|string',
            'departments' => 'sometimes|array',
            'judges' => 'sometimes|array|max:1',
            'status' => 'sometimes|in:upcoming,ongoing,completed',
        ];
        if ($request->has('endTime')) {
            $rules['endTime'][] = $this->endAfterStart(
                fn () => $request->has('startTime') ? $request->startTime : $event->start_time
            );
        } elseif ($request->has('startTime')) {
            $rules['startTime'][] = $this->startBeforeEnd(fn () => $event->end_time);
        }
        $request->validate($rules, self::ONE_COMMITTEE, ['category' => 'sport']);

        // Same rule as store: only a venue id that resolves may be stored.
        $venue = $request->venueId ? Venue::find($request->venueId) : null;

        // Re-check the roster whenever the colleges or the sport change.
        if ($request->has('departments') || $request->has('category')) {
            $category = $request->input('category', $event->category);
            $depts = $request->has('departments') ? (array) $request->departments : ($event->departments ?? []);
            if ($rosterError = $this->rosterError($category, $depts)) {
                return response()->json(['error' => $rosterError], 422);
            }
        }

        // Only re-check for double-booking when this request actually moves the
        // event in time or space (not on a bare status flip). Compared against
        // every other event, using the new value where sent, the current
        // value otherwise.
        $touchesSchedule = $request->hasAny(['venueId', 'venueName', 'schedule', 'startTime', 'endTime']);
        if ($touchesSchedule) {
            $conflicts = Event::venueConflicts(
                $request->has('venueId') ? $venue?->id : $event->venue_id,
                $request->has('venueName') ? $request->venueName : $event->venue_name,
                $request->has('schedule') ? $request->schedule : $event->schedule,
                $request->has('startTime') ? $request->startTime : $event->start_time,
                $request->has('endTime') ? $request->endTime : $event->end_time,
                $event->id,
            );
            if ($conflicts->isNotEmpty()) {
                return response()->json([
                    'error' => Event::conflictMessage($conflicts->first()),
                    'conflicts' => $conflicts->map->toApiFormat(),
                ], 422);
            }
        }

        $data = array_filter([
            'name' => $request->name,
            'category' => $request->category,
            'schedule' => $request->schedule,
            'start_time' => $request->startTime,
            'end_time' => $request->endTime,
            'venue_name' => $request->venueName,
            'departments' => $request->departments,
            'judges' => $request->judges,
            'status' => $request->status,
        ], fn ($v) => ! is_null($v));

        // Assigned after the filter on purpose: clearing an unresolved venue
        // means writing null, which array_filter would have stripped, leaving
        // the stale venue in place.
        if ($request->has('venueId')) {
            $data['venue_id'] = $venue?->id;
        }

        $before = $this->judgeIds($event);
        $scheduleBefore = $event->only(ScheduleNotifier::WATCHED);
        $event->update($data);
        app(ScheduleNotifier::class)->updated($event->fresh(), $scheduleBefore);

        // Only the members added by this edit — the rest already have it.
        $emailed = $request->has('judges') ? $this->notifyCommittee($event, $before) : null;

        return response()->json($event->fresh()->toApiFormat() + ['committeeEmail' => $emailed]);
    }

    public function destroy(string $id)
    {
        $event = Event::findOrFail($id);
        app(ScheduleNotifier::class)->cancelled($event);
        $event->delete();

        return response()->json(['message' => 'Event deleted']);
    }

    /** POST /api/events/{id}/restore — bring a soft-deleted event back. */
    public function restore(string $id)
    {
        $event = Event::onlyTrashed()->findOrFail($id);
        $event->restore();

        return response()->json($event->fresh()->toApiFormat());
    }

    /**
     * POST /api/events/bulk-delete  { ids: [] } — delete many in one request.
     * Iterated rather than a mass delete so each removal fires its model
     * events (soft delete + audit trail).
     */
    public function bulkDestroy(Request $request)
    {
        $data = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'string',
        ]);

        $events = Event::whereIn('id', $data['ids'])->get();
        $notifier = app(ScheduleNotifier::class);
        $events->each(function (Event $event) use ($notifier) {
            $notifier->cancelled($event);
            $event->delete();
        });

        return response()->json(['deleted' => $events->count()]);
    }

    /** POST /api/events/bulk-status  { ids: [], status } — update status for many. */
    public function bulkStatus(Request $request)
    {
        $data = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'string',
            'status' => 'required|in:upcoming,ongoing,completed',
        ]);

        $events = Event::whereIn('id', $data['ids'])->get();
        $events->each(fn (Event $event) => $event->update(['status' => $data['status']]));

        return response()->json(['updated' => $events->count()]);
    }

    /**
     * POST /api/events/{id}/send-qr (admin) — email the QR code to every
     * assigned committee member again, e.g. after one lost it.
     */
    public function sendQr(string $id)
    {
        $event = Event::findOrFail($id);

        // A resend is for a lost email, not a button to hammer: one per event
        // every few minutes, so the committee member's inbox isn't spammed.
        $cooldown = "send-qr:{$event->id}";
        if (Cache::has($cooldown)) {
            return response()->json(['error' => 'The QR code was just emailed. Please wait a few minutes before sending it again.'], 429);
        }

        $emailed = $this->notifyCommittee($event);

        if ($emailed === null) {
            return response()->json(['error' => 'No committee member is assigned to this event yet.'], 422);
        }
        if ($emailed['sent']) {
            Cache::put($cooldown, true, now()->addMinutes(self::RESEND_COOLDOWN_MINUTES));
        }

        return response()->json($emailed);
    }

    /** @return array<int, string> */
    private function judgeIds(Event $event): array
    {
        return collect($event->judges ?? [])->pluck('id')->filter()->values()->all();
    }

    /**
     * Send the assignment (email with the QR code + in-app notification) to
     * the event's committee, skipping $except. A failed email never fails the
     * save — the admin sees it in the result and can resend from the QR dialog.
     * Mail is sent in the request (not queued), so "sent" means the mail
     * server accepted it.
     *
     * @param  array<int, string>  $except
     * @return array{sent: array<int, array{name: string, email: string}>, failed: array<int, array{name: string, email: string}>, noEmail: array<int, array{name: string}>}|null
     *     null when nobody needed notifying
     */
    private function notifyCommittee(Event $event, array $except = []): ?array
    {
        $ids = array_diff($this->judgeIds($event), $except);
        $judges = $ids ? User::whereIn('id', $ids)->where('role', 'judge')->get() : collect();
        if ($judges->isEmpty()) {
            return null;
        }

        $result = ['sent' => [], 'failed' => [], 'noEmail' => []];
        foreach ($judges as $judge) {
            try {
                $judge->notify(new CommitteeAssigned($event));
                if ($judge->email) {
                    $result['sent'][] = ['name' => $judge->name, 'email' => $judge->email];
                } else {
                    $result['noEmail'][] = ['name' => $judge->name];
                }
            } catch (\Throwable $e) {
                Log::warning("Committee QR email to {$judge->email} failed: ".$e->getMessage());
                $result['failed'][] = ['name' => $judge->name, 'email' => (string) $judge->email];
            }
        }

        return $result;
    }

    /**
     * Who won each completed event on this page, in two queries rather than
     * one per event: a game's recorded head-to-head result, else the top of
     * a judged event's ranking.
     *
     * @param  \Illuminate\Support\Collection<int, Event>  $events
     * @return array<string, array<string, mixed>>
     */
    private function resultsFor($events): array
    {
        $ids = $events->where('status', 'completed')->pluck('id');
        if ($ids->isEmpty()) {
            return [];
        }

        $out = [];

        TeamMatch::whereIn('event_id', $ids)
            ->whereIn('status', ['completed', 'forfeit'])
            ->orderBy('updated_at')
            ->get()
            ->each(function (TeamMatch $m) use (&$out) {
                $out[$m->event_id] = [
                    'type' => 'match',
                    'winner' => $m->is_draw ? null : $m->winner,
                    'isDraw' => (bool) $m->is_draw,
                    'homeTeam' => $m->home_team,
                    'awayTeam' => $m->away_team,
                    'homeScore' => $m->home_score !== null ? (float) $m->home_score : null,
                    'awayScore' => $m->away_score !== null ? (float) $m->away_score : null,
                ];
            });

        Ranking::whereIn('event_id', $ids->diff(array_keys($out)))
            ->where('rank', 1)
            ->get()
            ->each(function (Ranking $r) use (&$out) {
                $out[$r->event_id] = [
                    'type' => 'ranked',
                    'winner' => $r->department,
                    'score' => (float) $r->total_score,
                ];
            });

        return $out;
    }
}
