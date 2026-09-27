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
use App\Services\BasketballScoreboard;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * A coach's lineup for a play-by-play basketball game: which of their
 * athletes play, under which jersey number. The committee's scorer only
 * scores — the players it can credit are exactly the ones the coach lined up.
 *
 *   GET /api/coach/lineups        (coach — their basketball games and lineup status)
 *   GET /api/events/{id}/lineup   (coach — their team's lineup + who they can add)
 *   PUT /api/events/{id}/lineup   (coach — {players: [{playerId, jerseyNumber}]})
 *
 * A coach may line up a game when their college plays in it and it's one of
 * their sports — the same rule as their schedule. The lineup can change until
 * the game is finished, but a player whose plays are already on the board
 * stays, under the number those plays were recorded with.
 */
class GameLineupController extends Controller
{
    public function __construct(private BasketballScoreboard $scoreboard) {}

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
            ->filter(fn (Event $e) => $this->isBasketball($e) && count($e->departments ?? []) === 2);

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
                'schedule' => $e->schedule,
                'startTime' => $e->start_time,
                'venueName' => $e->venue_name,
                'status' => $e->status,
                'opponent' => collect($e->departments)->first(fn ($d) => ! BasketballScoreboard::isCollege($coach->departmentRow, $d)),
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
            'team' => ['id' => $team->id, 'name' => $team->name, 'abbreviation' => $team->abbreviation],
            'locked' => LiveScore::where('event_id', $eventId)->where('status', 'final')->exists(),
            'players' => $lineup->map(fn (GamePlayer $gp) => [
                'playerId' => $gp->player_id,
                'name' => BasketballScoreboard::nameOf($gp->athlete),
                'jerseyNumber' => $gp->jersey_number,
                'hasPlays' => $withPlays->has($gp->player_id),
            ])->sortBy(fn ($p) => [(int) $p['jerseyNumber'], strlen($p['jerseyNumber'])])->values(),
            'candidates' => $this->eligible($request->user(), $event)->get()
                ->map(fn (Athlete $a) => [
                    'playerId' => $a->id,
                    'name' => BasketballScoreboard::nameOf($a),
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
        ], [
            'players.max' => 'A lineup has at most 20 players.',
            'players.*.jerseyNumber.required' => 'Every player in the lineup needs a jersey number.',
            'players.*.jerseyNumber.regex' => 'Jersey numbers are 0–99 (00 allowed).',
            'players.*.jerseyNumber.distinct' => 'Two players can\'t wear the same jersey number.',
        ]);

        $coach = $request->user();
        $event = Event::findOrFail($eventId);
        $team = $this->coachTeam($coach, $event);

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
                $name = BasketballScoreboard::nameOf($gp->athlete);
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
            foreach ($wanted as $playerId => $p) {
                if ($withPlays->has($playerId) && $current->has($playerId)) {
                    continue;
                }
                GamePlayer::create([
                    'game_id' => $event->id,
                    'team_id' => $team->id,
                    'player_id' => $playerId,
                    'jersey_number' => $p['jerseyNumber'],
                ]);
            }
        });

        return $this->show($request, $eventId);
    }

    // ── Internals ─────────────────────────────────────────────────────

    /** The coach's college in this game, or a 403 if it isn't theirs to line up. */
    private function coachTeam(User $coach, Event $event): Department
    {
        if (! $this->isBasketball($event)) {
            $this->fail('Lineups are only used for play-by-play basketball games.');
        }

        $teams = $this->scoreboard->teams($event);
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

    private function playersWithPlays(string $eventId)
    {
        return GameEvent::where('game_id', $eventId)->whereNotNull('player_id')->distinct()->pluck('player_id')->flip();
    }

    private function isBasketball(Event $event): bool
    {
        return str_contains(mb_strtolower((string) $event->category), 'basketball');
    }

    private function fail(string $message, array $extra = [], int $status = 422): never
    {
        throw new HttpResponseException(response()->json(['error' => $message, ...$extra], $status));
    }
}
