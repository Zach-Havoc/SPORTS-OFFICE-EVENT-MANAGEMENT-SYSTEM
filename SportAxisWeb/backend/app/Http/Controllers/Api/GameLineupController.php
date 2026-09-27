<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Athlete;
use App\Models\Department;
use App\Models\Event;
use App\Models\GameEvent;
use App\Models\GamePlayer;
use App\Models\LiveScore;
use App\Models\User;
use App\Services\PlayByPlay;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * A coach's lineup for a play-by-play game (basketball, volleyball): which of
 * their athletes play, under which jersey number — and for volleyball, the
 * default starting rotation (positions I–VI; I serves), which the scorer
 * confirms at each set start. The committee's scorer only scores — the
 * players it can credit are exactly the ones the coach lined up.
 *
 *   GET /api/coach/lineups        (coach — their games and lineup status)
 *   GET /api/events/{id}/lineup   (coach — their team's lineup + who they can add)
 *   PUT /api/events/{id}/lineup   (coach — {players: [{playerId, jerseyNumber, rotationPosition?}]})
 *
 * A coach may line up a game when their college plays in it and it's one of
 * their sports — the same rule as their schedule. The lineup can change until
 * the game is finished, but a player whose plays are already on the board
 * stays, under the number those plays were recorded with.
 */
class GameLineupController extends Controller
{
    /** GET /api/coach/lineups */
    public function index(Request $request)
    {
        $coach = $request->user();
        $sportIds = $coach->sportCategories()->pluck('categories.id');

        if (! $coach->department_id || $sportIds->isEmpty()) {
            return response()->json(['games' => [], 'reason' => ! $coach->department_id ? 'no_college' : 'no_sport']);
        }

        $events = Event::query()
            ->whereIn('category_id', $sportIds)
            ->where('status', '!=', 'completed')
            ->whereHas('departmentRows', fn ($q) => $q->where('departments.id', $coach->department_id))
            ->orderBy('schedule')
            ->orderBy('start_time')
            ->get()
            ->filter(fn (Event $e) => PlayByPlay::sportOf($e) && count($e->departments ?? []) === 2);

        $counts = GamePlayer::whereIn('game_id', $events->pluck('id'))
            ->where('team_id', $coach->department_id)
            ->selectRaw('game_id, COUNT(*) as n')
            ->groupBy('game_id')
            ->pluck('n', 'game_id');
        $final = LiveScore::whereIn('event_id', $events->pluck('id'))->where('status', 'final')->pluck('event_id')->flip();

        return response()->json([
            'reason' => $events->isEmpty() ? 'no_games' : null,
            'games' => $events->values()->map(fn (Event $e) => [
                'id' => $e->id,
                'name' => $e->name,
                'category' => $e->category,
                'sport' => PlayByPlay::sportOf($e),
                'schedule' => $e->schedule,
                'startTime' => $e->start_time,
                'venueName' => $e->venue_name,
                'status' => $e->status,
                'opponent' => collect($e->departments)->first(fn ($d) => ! PlayByPlay::isCollege($coach->departmentRow, $d)),
                'lineupCount' => (int) ($counts[$e->id] ?? 0),
                'locked' => $final->has($e->id),
            ]),
        ]);
    }

    /** GET /api/events/{id}/lineup */
    public function show(Request $request, string $eventId)
    {
        $event = Event::findOrFail($eventId);
        $team = $this->coachTeam($request->user(), $event);

        $lineup = GamePlayer::with('athlete.account')->where('game_id', $eventId)->where('team_id', $team->id)->get();
        $withPlays = $this->playersWithPlays($eventId);

        return response()->json([
            'event' => ['id' => $event->id, 'name' => $event->name, 'category' => $event->category, 'schedule' => $event->schedule],
            'sport' => PlayByPlay::sportOf($event),
            'team' => ['id' => $team->id, 'name' => $team->name, 'abbreviation' => $team->abbreviation],
            'locked' => LiveScore::where('event_id', $eventId)->where('status', 'final')->exists(),
            'players' => $lineup->map(fn (GamePlayer $gp) => [
                'playerId' => $gp->player_id,
                'name' => PlayByPlay::nameOf($gp->athlete),
                'jerseyNumber' => $gp->jersey_number,
                'rotationPosition' => $gp->rotation_position,
                'hasPlays' => $withPlays->has($gp->player_id),
            ])->sortBy(fn ($p) => [(int) $p['jerseyNumber'], strlen($p['jerseyNumber'])])->values(),
            'candidates' => $this->eligible($request->user(), $event)->get()
                ->map(fn (Athlete $a) => [
                    'playerId' => $a->id,
                    'name' => PlayByPlay::nameOf($a),
                    'jerseyNumber' => $a->jersey_number, // the profile's number, as a default
                ])->sortBy('name')->values(),
        ]);
    }

    /** PUT /api/events/{id}/lineup */
    public function update(Request $request, string $eventId)
    {
        $data = $request->validate([
            'players' => 'present|array|max:20',
            'players.*.playerId' => 'required|string|distinct',
            'players.*.jerseyNumber' => ['required', 'string', 'regex:/^\d{1,2}$/', 'distinct'],
            'players.*.rotationPosition' => 'nullable|integer|between:1,6|distinct',
        ], [
            'players.*.rotationPosition.distinct' => 'Each rotation position (I–VI) takes one player.',
            'players.max' => 'A lineup has at most 20 players.',
            'players.*.jerseyNumber.required' => 'Every player in the lineup needs a jersey number.',
            'players.*.jerseyNumber.regex' => 'Jersey numbers are 0–99 (00 allowed).',
            'players.*.jerseyNumber.distinct' => 'Two players can\'t wear the same jersey number.',
        ]);

        $coach = $request->user();
        $event = Event::findOrFail($eventId);
        $team = $this->coachTeam($coach, $event);

        // Volleyball: a starting rotation is all six positions, or none.
        $positions = collect($data['players'])->pluck('rotationPosition')->filter()->count();
        if (PlayByPlay::sportOf($event) === 'volleyball' && ! in_array($positions, [0, 6], true)) {
            $this->fail('A starting rotation needs all six positions, I to VI — or leave it empty.');
        }

        DB::transaction(function () use ($coach, $event, $team, $data) {
            // Same lock as the scorer's writes, so a lineup change can't land
            // between a play being validated and recorded.
            Event::whereKey($event->id)->lockForUpdate()->first();

            if (LiveScore::where('event_id', $event->id)->where('status', 'final')->exists()) {
                $this->fail('This game is finished — its lineup can no longer change.');
            }

            $wanted = collect($data['players'])->keyBy('playerId');
            $eligible = $this->eligible($coach, $event)->whereIn('id', $wanted->keys())->pluck('id');
            if ($stranger = $wanted->keys()->diff($eligible)->first()) {
                $this->fail('Only active athletes on your roster for this sport can be lined up.', ['playerId' => $stranger]);
            }

            // Players already on the board keep their place and number.
            $current = GamePlayer::with('athlete.account')->where('game_id', $event->id)->where('team_id', $team->id)->get()->keyBy('player_id');
            $withPlays = $this->playersWithPlays($event->id);
            foreach ($current as $playerId => $gp) {
                if (! $withPlays->has($playerId)) {
                    continue;
                }
                $name = PlayByPlay::nameOf($gp->athlete);
                if (! $wanted->has($playerId)) {
                    $this->fail("#{$gp->jersey_number} {$name} already has plays in this game and can't be taken out of the lineup.");
                }
                if ($wanted[$playerId]['jerseyNumber'] !== $gp->jersey_number) {
                    $this->fail("#{$gp->jersey_number} {$name} already has plays in this game, so their number can't change.");
                }
            }

            // Rebuild the rest (deleting first so two players can swap numbers).
            GamePlayer::where('game_id', $event->id)->where('team_id', $team->id)
                ->whereNotIn('player_id', $withPlays->keys()->all())->delete();
            $isVolleyball = PlayByPlay::sportOf($event) === 'volleyball';
            foreach ($wanted as $playerId => $p) {
                $position = $isVolleyball ? ($p['rotationPosition'] ?? null) : null;
                if ($withPlays->has($playerId) && $current->has($playerId)) {
                    // Frozen number; the default rotation only affects sets not yet started.
                    $current[$playerId]->update(['rotation_position' => $position]);

                    continue;
                }
                GamePlayer::create([
                    'game_id' => $event->id,
                    'team_id' => $team->id,
                    'player_id' => $playerId,
                    'jersey_number' => $p['jerseyNumber'],
                    'rotation_position' => $position,
                ]);
            }
        });

        return $this->show($request, $eventId);
    }

    // ── Internals ─────────────────────────────────────────────────────

    /** The coach's college in this game, or a 403 if it isn't theirs to line up. */
    private function coachTeam(User $coach, Event $event): Department
    {
        if (! PlayByPlay::sportOf($event)) {
            $this->fail('Lineups are only used for play-by-play games (basketball, volleyball).');
        }

        $teams = PlayByPlay::teams($event);
        $team = collect($teams ?? [])->firstWhere('id', $coach->department_id);
        $theirSport = $coach->sportCategories()->where('categories.id', $event->category_id)->exists();

        if (! $team || ! $theirSport) {
            $this->fail('You can only set the lineup for your own college\'s games in your sport.', status: 403);
        }

        return $team;
    }

    /** The coach's own active athletes in this game's sport. */
    private function eligible(User $coach, Event $event)
    {
        return Athlete::with('account')
            ->where('coach_id', $coach->id)
            ->where('status', 'active')
            ->where(fn ($q) => $q
                ->when($event->category_id, fn ($q) => $q->where('category_id', $event->category_id))
                ->orWhereRaw('LOWER(?) LIKE CONCAT(LOWER(sport), \'%\')', [$event->category]));
    }

    /**
     * Players the recorded plays refer to: whoever a play credits, whoever a
     * substitution took off, and everyone in a volleyball set's rotation.
     */
    private function playersWithPlays(string $eventId)
    {
        $plays = GameEvent::where('game_id', $eventId)->get(['player_id', 'player_out_id', 'detail']);

        return $plays->pluck('player_id')
            ->merge($plays->pluck('player_out_id'))
            ->merge($plays->flatMap(fn ($p) => collect($p->detail['rotations'] ?? [])->flatten()))
            ->filter()->unique()->flip();
    }

    private function fail(string $message, array $extra = [], int $status = 422): never
    {
        throw new HttpResponseException(response()->json(['error' => $message, ...$extra], $status));
    }
}
