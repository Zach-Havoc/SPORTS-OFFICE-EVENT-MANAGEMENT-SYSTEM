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
use App\Services\LineupRules;
use App\Services\PlayByPlay;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * A coach's lineup for a game: which of their athletes play, under which
 * jersey number, and — where the sport has them — their positions: the
 * volleyball rotation I–VI (the scorer confirms it at each set start), a
 * sepak takraw regu's Tekong / Feeder / Striker, chess board order. Every
 * head-to-head sport except Badminton and Table Tennis, whose players are
 * entered per racquet line instead (see LineupRules). The committee's scorer
 * only scores — the players it can credit are exactly the ones lined up.
 *
 *   GET /api/events/{id}/lineups  (public — both teams' lineups, for the game details)
 *   GET /api/coach/lineups        (coach — their games and lineup status)
 *   GET /api/events/{id}/lineup   (coach — their team's lineup + who they can add)
 *   PUT /api/events/{id}/lineup   (coach — {players: [{playerId, jerseyNumber, rotationPosition?}]})
 *
 * A coach may line up a game when their college plays in it and it's one of
 * their sports — the same rule as their schedule — and, for a college with a
 * Men's and a Women's coach, when it's their division (PlayByPlay::divisionOf).
 * Each coach sees and edits only their own players in a game's lineup. The lineup can change until
 * the game is finished, but a player whose plays are already on the board
 * stays, under the number those plays were recorded with.
 */
class GameLineupController extends Controller
{
    /**
     * GET /api/events/{id}/lineups — who plays for each college in a game:
     * jersey numbers and names only, plus each player's position where the
     * sport has them. Empty for a sport without game lineups.
     */
    public function publicShow(string $eventId)
    {
        $event = Event::findOrFail($eventId);
        $sport = LineupRules::sportOf($event);
        $teams = $sport ? PlayByPlay::teams($event) : null;
        if (! $teams) {
            return response()->json(['sport' => $sport, ...$this->positionsOf($sport), 'teams' => []]);
        }

        $roster = GamePlayer::with('athlete.account')->where('game_id', $eventId)->get()
            ->sortBy(fn (GamePlayer $p) => [(int) $p->jersey_number, strlen($p->jersey_number)]);

        return response()->json([
            'sport' => $sport,
            ...$this->positionsOf($sport),
            'teams' => array_map(fn ($team, $i) => [
                'id' => $team->id,
                'side' => $i === 0 ? 'home' : 'away',
                'name' => $team->name,
                'label' => $event->departments[$i] ?? $team->name,
                'abbreviation' => $team->abbreviation,
                'players' => $roster->where('team_id', $team->id)->map(fn (GamePlayer $gp) => [
                    'jersey' => $gp->jersey_number,
                    'name' => PlayByPlay::nameOf($gp->athlete),
                    'rotationPosition' => LineupRules::for($sport)['positions'] ? $gp->rotation_position : null,
                ])->values()->all(),
            ], $teams, array_keys($teams)),
        ]);
    }

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
            ->filter(fn (Event $e) => LineupRules::sportOf($e) && count($e->departments ?? []) === 2 && $this->inDivision($coach, $e));

        $counts = GamePlayer::whereIn('game_id', $events->pluck('id'))
            ->where('team_id', $coach->department_id)
            ->whereHas('athlete', fn ($q) => $q->where('coach_id', $coach->id))
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
                'sport' => LineupRules::sportOf($e),
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

        $lineup = $this->ownRows($request->user(), $eventId, $team->id)->with('athlete.account')->get();
        $withPlays = $this->playersWithPlays($eventId);

        return response()->json([
            'event' => ['id' => $event->id, 'name' => $event->name, 'category' => $event->category, 'schedule' => $event->schedule],
            'sport' => LineupRules::sportOf($event),
            ...$this->positionsOf(LineupRules::sportOf($event)),
            'max' => LineupRules::for(LineupRules::sportOf($event))['max'],
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
        $coach = $request->user();
        $event = Event::findOrFail($eventId);
        $team = $this->coachTeam($coach, $event);
        $rules = LineupRules::for(LineupRules::sportOf($event));
        $slots = count($rules['positions']);

        $data = $request->validate([
            'players' => "present|array|max:{$rules['max']}",
            'players.*.playerId' => 'required|string|distinct',
            'players.*.jerseyNumber' => ['required', 'string', 'regex:/^\d{1,2}$/', 'distinct'],
            'players.*.rotationPosition' => $slots ? "nullable|integer|between:1,{$slots}|distinct" : 'nullable|prohibited',
        ], [
            'players.*.rotationPosition.distinct' => 'Each position takes one player.',
            'players.*.rotationPosition.prohibited' => "{$rules['label']} lineups don't have positions.",
            'players.max' => "A {$rules['label']} lineup has at most {$rules['max']} players.",
            'players.*.jerseyNumber.required' => 'Every player in the lineup needs a jersey number.',
            'players.*.jerseyNumber.regex' => 'Jersey numbers are 0–99 (00 allowed).',
            'players.*.jerseyNumber.distinct' => 'Two players can\'t wear the same jersey number.',
        ]);

        // Positions (a rotation, a regu, board order) are all filled or none.
        $filled = collect($data['players'])->pluck('rotationPosition')->filter()->count();
        if ($rules['allOrNone'] && ! in_array($filled, [0, $slots], true)) {
            $this->fail($rules['incomplete']);
        }

        DB::transaction(function () use ($coach, $event, $team, $data, $slots) {
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

            // Another coach of this college (Men's / Women's) may have players
            // in this lineup too; their numbers are taken.
            $theirs = GamePlayer::where('game_id', $event->id)->where('team_id', $team->id)
                ->whereDoesntHave('athlete', fn ($q) => $q->where('coach_id', $coach->id))
                ->pluck('jersey_number');
            if ($clash = collect($data['players'])->pluck('jerseyNumber')->intersect($theirs)->first()) {
                $this->fail("#{$clash} is already worn by another coach's player in this game.");
            }

            // Players already on the board keep their place and number.
            $current = $this->ownRows($coach, $event->id, $team->id)->with('athlete.account')->get()->keyBy('player_id');
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

            // Rebuild the rest of this coach's players (deleting first so two
            // players can swap numbers).
            $this->ownRows($coach, $event->id, $team->id)
                ->whereNotIn('player_id', $withPlays->keys()->all())->delete();
            foreach ($wanted as $playerId => $p) {
                $position = $slots ? ($p['rotationPosition'] ?? null) : null;
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
        if (! LineupRules::sportOf($event)) {
            $this->fail('This sport has no game lineup (Badminton and Table Tennis use racquet lines).');
        }

        $teams = PlayByPlay::teams($event);
        $team = collect($teams ?? [])->firstWhere('id', $coach->department_id);
        $theirSport = $coach->sportCategories()->where('categories.id', $event->category_id)->exists();

        if (! $team || ! $theirSport) {
            $this->fail('You can only set the lineup for your own college\'s games in your sport.', status: 403);
        }
        if (! $this->inDivision($coach, $event)) {
            $division = PlayByPlay::divisionOf($event);
            $this->fail("This is a {$division}'s game — its lineup is set by your college's {$division}'s coach.", status: 403);
        }

        return $team;
    }

    /** The sport's position labels, for the client to show. */
    private function positionsOf(?string $sport): array
    {
        $rules = $sport ? LineupRules::for($sport) : null;

        return ['positionName' => $rules['positionName'] ?? null, 'positions' => $rules['positions'] ?? []];
    }

    /**
     * Whether a game is in the coach's division. A coach of Men or Women only
     * sees that division's games; a Men & Women coach, and a game whose name
     * doesn't say, go either way.
     */
    private function inDivision(User $coach, Event $event): bool
    {
        $mine = in_array($coach->gender_category, ['Men', 'Women'], true) ? $coach->gender_category : null;
        $game = PlayByPlay::divisionOf($event);

        return ! $mine || ! $game || $mine === $game;
    }

    /** This coach's own players in a game's lineup for their college. */
    private function ownRows(User $coach, string $eventId, string $teamId)
    {
        return GamePlayer::where('game_id', $eventId)->where('team_id', $teamId)
            ->whereHas('athlete', fn ($q) => $q->where('coach_id', $coach->id));
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
