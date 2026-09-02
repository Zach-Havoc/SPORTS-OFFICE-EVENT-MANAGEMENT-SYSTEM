<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\LiveScore;
use App\Models\TeamMatch;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * The running score of a game while it is being played.
 *
 *   GET    /api/live-scores            (public — every in-progress / just-final game)
 *   GET    /api/events/{id}/live       (public — one game, or {live:null})
 *   PUT    /api/events/{id}/live       (committee / admin — start & update)
 *   DELETE /api/events/{id}/live       (admin — reset)
 *
 * `version` bumps on every write; a client that sends a lower version than the
 * stored one is told to reload (409). Starting a game flips the event to
 * `ongoing`; finalising flips it to `completed` and records the head-to-head
 * result in `team_matches`.
 */
class LiveScoreController extends Controller
{
    /** GET /api/live-scores  (?active=1 to exclude games that already went final) */
    public function index(Request $request)
    {
        $statuses = $request->boolean('active') ? ['in_progress'] : ['in_progress', 'final'];

        $rows = LiveScore::whereIn('status', $statuses)
            ->orderByDesc('updated_at')
            ->get();

        $events = Event::whereIn('id', $rows->pluck('event_id'))->get()->keyBy('id');

        return response()->json(
            $rows->map(fn (LiveScore $l) => $l->toApiFormat($events->get($l->event_id)))->values()
        );
    }

    /** GET /api/events/{id}/live */
    public function show(string $eventId)
    {
        $event = Event::findOrFail($eventId);
        $live  = LiveScore::where('event_id', $eventId)->first();

        return response()->json(['live' => $live?->toApiFormat($event)]);
    }

    /** PUT /api/events/{id}/live */
    public function upsert(Request $request, string $eventId)
    {
        $event = Event::findOrFail($eventId);

        $data = $request->validate([
            'homeTeam'  => 'sometimes|nullable|string|max:255',
            'awayTeam'  => 'sometimes|nullable|string|max:255',
            'homeScore' => 'sometimes|integer|min:0|max:9999',
            'awayScore' => 'sometimes|integer|min:0|max:9999',
            'period'    => 'sometimes|nullable|string|max:40',
            'detail'    => 'sometimes|nullable|array',
            'status'    => 'sometimes|in:scheduled,in_progress,final',
            'version'   => 'sometimes|integer|min:0',
        ]);

        $live = LiveScore::firstOrNew(['event_id' => $eventId]);

        // Stale-write guard — the client is behind; hand back the current state.
        if ($live->exists && isset($data['version']) && $data['version'] < $live->version) {
            return response()->json([
                'error' => 'This game was updated elsewhere.',
                'live'  => $live->toApiFormat($event),
            ], 409);
        }

        $newStatus = $data['status']
            ?? ($live->status && $live->status !== 'scheduled' ? $live->status : 'in_progress');

        $live->fill([
            'id'         => $live->id ?: (string) Str::uuid(),
            'event_id'   => $eventId,
            'sport'      => $event->category,
            'home_team'  => $data['homeTeam']  ?? $live->home_team  ?? ($event->departments[0] ?? null),
            'away_team'  => $data['awayTeam']  ?? $live->away_team  ?? ($event->departments[1] ?? null),
            'home_score' => $data['homeScore'] ?? $live->home_score ?? 0,
            'away_score' => $data['awayScore'] ?? $live->away_score ?? 0,
            'period'     => array_key_exists('period', $data) ? $data['period'] : $live->period,
            'detail'     => array_key_exists('detail', $data) ? $data['detail'] : $live->detail,
            'status'     => $newStatus,
            'updated_by' => $request->user()->id,
            'version'    => (int) ($live->version ?? 0) + 1,
        ]);

        if ($newStatus === 'in_progress' && ! $live->started_at) {
            $live->started_at = now();
        }
        if ($newStatus === 'final') {
            $live->finalized_at = now();
        }

        $live->save();

        // Event lifecycle side-effects.
        if ($newStatus === 'in_progress' && $event->status === 'upcoming') {
            $event->update(['status' => 'ongoing']);
        }
        if ($newStatus === 'final') {
            if ($event->status !== 'completed') {
                $event->update(['status' => 'completed']);
            }
            $this->recordHeadToHead($live, $event);
        }

        return response()->json(['live' => $live->fresh()->toApiFormat($event)]);
    }

    /** DELETE /api/events/{id}/live */
    public function destroy(string $eventId)
    {
        LiveScore::where('event_id', $eventId)->delete();

        return response()->json(['message' => 'Live score cleared']);
    }

    /**
     * On finalisation, keep a `team_matches` row in sync so standings / bracket
     * seeding pick up the result. Mirrors ScoreController::syncTeamMatch but
     * driven by the explicit home/away of the live score.
     */
    private function recordHeadToHead(LiveScore $live, Event $event): void
    {
        if (! $live->home_team || ! $live->away_team || $live->home_team === $live->away_team) {
            return;
        }

        $match = TeamMatch::firstOrNew(['event_id' => $event->id]);
        if (! $match->exists) {
            $match->id = (string) Str::uuid();
        }

        $match->fill([
            'sport'       => $event->category,
            'stage'       => $match->stage ?: 'elimination',
            'home_team'   => $live->home_team,
            'away_team'   => $live->away_team,
            'home_score'  => $live->home_score,
            'away_score'  => $live->away_score,
            'status'      => 'completed',
            'played_at'   => $match->played_at ?? now(),
            'recorded_by' => $live->updated_by,
        ]);
        $match->resolveOutcome();
        $match->save();
    }
}
