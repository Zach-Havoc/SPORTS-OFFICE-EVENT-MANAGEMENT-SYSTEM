<?php

namespace App\Services;

use App\Models\Department;
use App\Models\Event;
use App\Models\GameEvent;
use App\Models\GamePlayer;
use App\Models\LiveScore;
use Illuminate\Support\Collection;

/**
 * Computes a basketball game's scoreboard from its plays (game_events).
 * Nothing here is stored — the score, team fouls, bonus and box score are
 * derived fresh each time, in a fixed number of queries regardless of how
 * many plays or players there are.
 *
 * Home is the event's first college, away its second, as everywhere else.
 */
class BasketballScoreboard
{
    /** How many plays the log shows. */
    public const RECENT_PLAYS = 10;

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

        $key = fn (?string $v) => mb_strtolower(trim((string) $v));
        $all = Department::all(['id', 'name', 'abbreviation', 'logo_url']);

        $teams = array_map(
            fn ($label) => $all->first(fn ($d) => $key($d->name) === $key($label) || $key($d->abbreviation) === $key($label)),
            $labels,
        );

        if (! $teams[0] || ! $teams[1] || $teams[0]->id === $teams[1]->id) {
            return null;
        }

        return $teams;
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

    /** Team fouls at or above this mean the team's next foul sends the opponent to the line. */
    public static function bonusAt(): int
    {
        return max(0, (int) config('sportaxis.basketball.bonus_threshold', 5) - 1);
    }

    public static function foulOutLimit(): int
    {
        return (int) config('sportaxis.basketball.foul_out_limit', 5);
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

    /** The full scoreboard in API shape (camelCase — also the socket payload). */
    public function build(Event $event, ?array $teams = null): array
    {
        $teams ??= $this->teams($event);
        $live = LiveScore::where('event_id', $event->id)->first();

        $plays = GameEvent::where('game_id', $event->id)->orderBy('id')->get();
        $roster = GamePlayer::with('athlete')
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
            $fouls = $teamPlays->where('type', 'FOUL');

            $periodScores = [];
            for ($p = 1; $p <= max($period, $reg); $p++) {
                $periodScores[] = [
                    'period' => $p,
                    'label' => self::periodLabel($p),
                    'points' => $teamPlays->where('period', $p)->sum(fn ($x) => $x->points()),
                ];
            }

            $teamFouls = $fouls->filter(fn ($f) => self::foulPeriod($f->period) === self::foulPeriod($period))->count();

            $players = $roster->where('team_id', $team->id)->map(function (GamePlayer $gp) use ($teamPlays) {
                $mine = $teamPlays->where('player_id', $gp->player_id);
                $pf = $mine->where('type', 'FOUL')->count();

                return [
                    'playerId' => $gp->player_id,
                    'jersey' => $gp->jersey_number,
                    'name' => $this->nameOf($gp),
                    'isStarter' => $gp->is_starter,
                    'pts' => $mine->sum(fn ($x) => $x->points()),
                    'fg2' => $mine->where('type', 'FG2')->count(),
                    'fg3' => $mine->where('type', 'FG3')->count(),
                    'ft' => $mine->where('type', 'FT')->count(),
                    'pf' => $pf,
                    'fouledOut' => $pf >= self::foulOutLimit(),
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
                'inBonus' => $teamFouls >= self::bonusAt(),
                'unassignedPoints' => $teamPlays->whereNull('player_id')->sum(fn ($x) => $x->points()),
                'players' => $players,
            ];
        }

        $winnerTeamId = null;
        if ($status === 'finished' && count($teamRows) === 2 && $teamRows[0]['score'] !== $teamRows[1]['score']) {
            $winnerTeamId = $teamRows[0]['score'] > $teamRows[1]['score'] ? $teamRows[0]['id'] : $teamRows[1]['id'];
        }

        $shape = fn (GameEvent $p) => $this->playRow($p, $rosterByPlayer);

        return [
            'eventId' => $event->id,
            'eventName' => $event->name,
            'category' => $event->category,
            'venueName' => $event->venue_name,
            'version' => (int) ($live?->version ?? 0),
            'status' => $status,
            'period' => $period,
            'periodLabel' => self::periodLabel($period),
            'rules' => [
                'regulationPeriods' => $reg,
                'foulOutLimit' => self::foulOutLimit(),
                'bonusThreshold' => (int) config('sportaxis.basketball.bonus_threshold', 5),
            ],
            'ready' => $teams !== null,
            'winnerTeamId' => $winnerTeamId,
            'teams' => $teamRows,
            'recentPlays' => $plays->reverse()->take(self::RECENT_PLAYS)->map($shape)->values()->all(),
            // Every scoring play still waiting for a player, newest first —
            // may be older than the log's last few.
            'unassignedPlays' => $plays->whereNull('player_id')->where('type', '!=', 'FOUL')
                ->reverse()->map($shape)->values()->all(),
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
            'playerName' => $gp ? $this->nameOf($gp) : null,
            'type' => $p->type,
            'points' => $p->points(),
            'period' => $p->period,
            'periodLabel' => self::periodLabel($p->period),
            'gameClock' => $p->game_clock,
            'createdAt' => $p->created_at,
        ];
    }

    private function nameOf(GamePlayer $gp): string
    {
        $a = $gp->athlete;

        return $a ? trim($a->first_name.' '.$a->last_name) : 'Unknown player';
    }
}
