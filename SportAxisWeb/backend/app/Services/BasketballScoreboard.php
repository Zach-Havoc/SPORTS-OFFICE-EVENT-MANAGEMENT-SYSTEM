<?php

namespace App\Services;

use App\Models\Athlete;
use App\Models\Department;
use App\Models\Event;
use App\Models\GameEvent;
use App\Models\GamePlayer;
use App\Models\LiveScore;
use Illuminate\Support\Collection;

/**
 * Computes a basketball game's scoreboard from its plays (game_events).
 * Nothing here is stored — the score, team fouls and box score are derived
 * fresh each time, in a fixed number of queries regardless of how many plays
 * or players there are.
 *
 * Home is the event's first college, away its second, as everywhere else.
 */
class BasketballScoreboard
{
    /**
     * The event's two colleges as [home, away], or null if the event doesn't
     * name two colleges that exist. Matched on full name or abbreviation,
     * the same way Event::syncTaxonomyKeys does.
     *
     * @return array{0: Department, 1: Department}|null
     */
    public function teams(Event $event): ?array
    {
        $labels = array_values($event->departments ?? []);
        if (count($labels) !== 2) {
            return null;
        }

        $all = Department::all(['id', 'name', 'abbreviation', 'logo_url']);
        $teams = array_map(fn ($label) => $all->first(fn ($d) => self::isCollege($d, $label)), $labels);

        if (! $teams[0] || ! $teams[1] || $teams[0]->id === $teams[1]->id) {
            return null;
        }

        return $teams;
    }

    /** Whether a stored college value (name or abbreviation) means this department. */
    public static function isCollege(Department $dept, ?string $value): bool
    {
        $key = fn (?string $v) => mb_strtolower(trim((string) $v));
        $v = $key($value);

        return $v !== '' && ($v === $key($dept->name) || $v === $key($dept->abbreviation));
    }

    public static function regulationPeriods(): int
    {
        return (int) config('sportaxis.basketball.regulation_periods', 4);
    }

    /** 1 → "Q1" … 4 → "Q4", 5 → "OT1", 6 → "OT2". */
    public static function periodLabel(int $period): string
    {
        $reg = self::regulationPeriods();

        return $period <= $reg ? 'Q'.$period : 'OT'.($period - $reg);
    }

    /** The period whose team-foul count a play in `$period` adds to. */
    public static function foulPeriod(int $period): int
    {
        return config('sportaxis.basketball.overtime_team_fouls_carry_over', true)
            ? min($period, self::regulationPeriods())
            : $period;
    }

    /** An athlete's display name — from their account when linked (it owns their identity). */
    public static function nameOf(?Athlete $a): string
    {
        if (! $a) {
            return 'Unknown player';
        }
        $name = $a->account ? trim((string) $a->account->name) : trim($a->first_name.' '.$a->last_name);

        return $name !== '' ? $name : 'Unknown player';
    }

    /**
     * Build each team's game roster from the athletes' profiles: every active
     * athlete of that college, in this sport, with a jersey number. Players
     * who already have plays are frozen (their jersey and place stay as the
     * plays recorded them); everyone else follows their current profile.
     *
     * @return array<int, string> notes for the scorekeeper (who was left out and why)
     */
    public function syncRoster(Event $event, array $teams): array
    {
        $existing = GamePlayer::where('game_id', $event->id)->get()->keyBy('player_id');
        $withPlays = GameEvent::where('game_id', $event->id)->whereNotNull('player_id')
            ->distinct()->pluck('player_id')->flip();

        $candidates = Athlete::with('account')
            ->where('status', 'active')
            ->where(fn ($q) => $q
                ->when($event->category_id, fn ($q) => $q->where('category_id', $event->category_id))
                ->orWhereRaw('LOWER(?) LIKE CONCAT(LOWER(sport), \'%\')', [$event->category]))
            ->get();

        // Rebuild everyone without plays from scratch — updating row by row
        // could trip the unique jersey index mid-way (two players swapping).
        GamePlayer::where('game_id', $event->id)->whereNotIn('player_id', $withPlays->keys()->all())->delete();

        $notes = [];

        foreach ($teams as $team) {
            // The college lives on the linked account for a registered athlete.
            $mine = $candidates->filter(fn (Athlete $a) => self::isCollege($team, $a->account?->department ?? $a->department));

            $frozen = $existing->where('team_id', $team->id)->filter(fn ($gp) => $withPlays->has($gp->player_id));
            $taken = $frozen->pluck('jersey_number')->flip();

            $noJersey = $mine->filter(fn ($a) => $a->jersey_number === null || $a->jersey_number === '');
            if ($noJersey->isNotEmpty()) {
                $notes[] = $team->name.': '.$noJersey->map(fn ($a) => self::nameOf($a))->implode(', ')
                    .($noJersey->count() === 1 ? ' has' : ' have').' no jersey number yet.';
            }

            foreach ($mine->diff($noJersey)->sortBy(fn ($a) => self::nameOf($a)) as $a) {
                if ($withPlays->has($a->id)) {
                    continue; // already frozen
                }
                if ($taken->has($a->jersey_number)) {
                    $notes[] = "{$team->name}: ".self::nameOf($a)." shares #{$a->jersey_number} with a teammate and was left off.";

                    continue;
                }
                $taken[$a->jersey_number] = true;

                GamePlayer::create([
                    'game_id' => $event->id,
                    'team_id' => $team->id,
                    'player_id' => $a->id,
                    'jersey_number' => $a->jersey_number,
                ]);
            }
        }

        return $notes;
    }

    /** [teamId => points] from the plays that count (undone ones excluded). */
    public function totals(string $eventId): array
    {
        return GameEvent::where('game_id', $eventId)
            ->get(['team_id', 'type'])
            ->groupBy('team_id')
            ->map(fn (Collection $plays) => $plays->sum(fn (GameEvent $p) => $p->points()))
            ->all();
    }

    /** The full scoreboard in API shape (camelCase — the mobile client reads it as-is). */
    public function build(Event $event, ?array $teams = null): array
    {
        $teams ??= $this->teams($event);
        $live = LiveScore::where('event_id', $event->id)->first();

        $plays = GameEvent::where('game_id', $event->id)->orderBy('id')->get();
        $roster = GamePlayer::with('athlete.account')
            ->where('game_id', $event->id)
            ->get()
            ->sortBy(fn (GamePlayer $p) => [(int) $p->jersey_number, strlen($p->jersey_number)])
            ->values();
        $rosterByPlayer = $roster->keyBy('player_id');

        $reg = self::regulationPeriods();
        $period = (int) ($live?->current_period ?: max(1, (int) $plays->max('period')));
        $status = match (true) {
            $live?->status === 'final' => 'finished',
            $live?->status === 'in_progress' => 'live',
            default => 'scheduled',
        };

        $teamRows = [];
        foreach ($teams ?? [] as $i => $team) {
            $teamPlays = $plays->where('team_id', $team->id);

            $periodScores = [];
            for ($p = 1; $p <= max($period, $reg); $p++) {
                $periodScores[] = [
                    'period' => $p,
                    'label' => self::periodLabel($p),
                    'points' => $teamPlays->where('period', $p)->sum(fn ($x) => $x->points()),
                ];
            }

            $teamFouls = $teamPlays->where('type', 'FOUL')
                ->filter(fn ($f) => self::foulPeriod($f->period) === self::foulPeriod($period))
                ->count();

            $players = $roster->where('team_id', $team->id)->map(function (GamePlayer $gp) use ($teamPlays) {
                $mine = $teamPlays->where('player_id', $gp->player_id);

                return [
                    'playerId' => $gp->player_id,
                    'jersey' => $gp->jersey_number,
                    'name' => self::nameOf($gp->athlete),
                    'pts' => $mine->sum(fn ($x) => $x->points()),
                    'fg2' => $mine->where('type', 'FG2')->count(),
                    'fg3' => $mine->where('type', 'FG3')->count(),
                    'ft' => $mine->where('type', 'FT')->count(),
                    'pf' => $mine->where('type', 'FOUL')->count(),
                ];
            })->values()->all();

            $teamRows[] = [
                'id' => $team->id,
                'side' => $i === 0 ? 'home' : 'away',
                'name' => $team->name,
                'label' => $event->departments[$i] ?? $team->name,
                'abbreviation' => $team->abbreviation,
                'logoUrl' => $team->logo_url,
                'score' => $teamPlays->sum(fn ($x) => $x->points()),
                'periodScores' => $periodScores,
                'teamFouls' => $teamFouls,
                'unassignedPoints' => $teamPlays->whereNull('player_id')->sum(fn ($x) => $x->points()),
                'players' => $players,
            ];
        }

        $winnerTeamId = null;
        if ($status === 'finished' && count($teamRows) === 2 && $teamRows[0]['score'] !== $teamRows[1]['score']) {
            $winnerTeamId = $teamRows[0]['score'] > $teamRows[1]['score'] ? $teamRows[0]['id'] : $teamRows[1]['id'];
        }

        return [
            'eventId' => $event->id,
            'eventName' => $event->name,
            'category' => $event->category,
            'version' => (int) ($live?->version ?? 0),
            'status' => $status,
            'period' => $period,
            'periodLabel' => self::periodLabel($period),
            'regulationPeriods' => $reg,
            'ready' => $teams !== null,
            'winnerTeamId' => $winnerTeamId,
            'playCount' => $plays->count(),
            'teams' => $teamRows,
            'recentPlays' => $plays->reverse()->take(10)->map(fn (GameEvent $p) => $this->playRow($p, $rosterByPlayer))->values()->all(),
            'updatedAt' => $live?->updated_at,
        ];
    }

    private function playRow(GameEvent $p, Collection $rosterByPlayer): array
    {
        $gp = $p->player_id ? $rosterByPlayer->get($p->player_id) : null;

        return [
            'id' => $p->id,
            'teamId' => $p->team_id,
            'playerId' => $p->player_id,
            'jersey' => $gp?->jersey_number,
            'playerName' => $gp ? self::nameOf($gp->athlete) : null,
            'type' => $p->type,
            'points' => $p->points(),
            'period' => $p->period,
            'periodLabel' => self::periodLabel($p->period),
            'createdAt' => $p->created_at,
        ];
    }
}
