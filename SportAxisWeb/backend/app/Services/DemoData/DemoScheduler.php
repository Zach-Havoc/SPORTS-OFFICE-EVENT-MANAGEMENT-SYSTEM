<?php

namespace App\Services\DemoData;

use App\Models\Bracket;
use App\Models\BracketMatch;
use App\Models\Event;
use App\Models\GamePlayer;
use App\Models\TeamMatch;
use App\Services\BracketService;
use App\Services\LineupRules;
use App\Services\PlayByPlay;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Puts demo games on the calendar the way the Sports Office does: brackets
 * through the real BracketService (draw, byes, publish with its venue
 * conflict check), a judge on every game, and both colleges' lineups on
 * every game whose teams are known.
 */
class DemoScheduler
{
    private BracketService $brackets;

    public function __construct(private DemoContext $ctx)
    {
        $this->brackets = app(BracketService::class);
    }

    public function service(): BracketService
    {
        return $this->brackets;
    }

    /**
     * Generate and publish a bracket. An elimination bracket takes the day
     * `$days` gives each round — for a double elimination a round is a step
     * in its order of play (upper 1, lower 1, upper 2, …, grand final, reset),
     * and rounds sharing a day follow on from each other. A round robin runs
     * from `$days[0]`, the generator rolling on to the next day at 6 PM.
     * Teams go in seed order (best first), so the top seeds get the byes.
     */
    public function bracket(string $category, string $format, array $teams, string $venue, array $days, string $time, int $minutes, string $draw = 'manual', ?string $name = null): Bracket
    {
        $bracket = $this->brackets->generate([
            'sport' => $category, 'format' => $format, 'participants' => $teams, 'drawMethod' => $draw,
            'startDate' => $this->day($days[0])->toDateString(), 'startTime' => $time,
            'matchDuration' => $minutes, 'breakDuration' => 15, 'venueId' => $this->venueId($venue),
        ], $this->ctx->adminId);

        [$sport, $division] = DemoContext::parse($category);
        $bracket->update([
            'name' => $name ?? "{$division}'s {$sport} — ".BracketService::formatName($format),
            'seeded' => true,
            'settings' => $bracket->settings + ['seedSource' => $draw === 'standings' ? 'group stage standings' : DemoContext::PREVIOUS_SEASON.' final ranking'],
        ]);

        // Each elimination round on its day, back to back from `$time`.
        if (BracketService::isElimination($format)) {
            $step = $minutes + 15;
            $clocks = [];
            foreach ($bracket->matches->groupBy('round')->sortKeys() as $round => $matches) {
                $date = $this->day($days[$round - 1] ?? end($days))->toDateString();
                $clock = $clocks[$date] ??= Carbon::parse($time);
                foreach ($matches->where('is_bye', false)->sortBy('slot') as $bm) {
                    $bm->update(['scheduled_date' => $date, 'scheduled_time' => $clock->format('H:i')]);
                    $clock->addMinutes($step);
                }
            }
        }

        $result = $this->brackets->publish($bracket->fresh('matches'));
        if (! empty($result['conflicts'])) {
            throw new \RuntimeException("Couldn't schedule {$bracket->name}: {$venue} is already booked then.");
        }

        $events = Event::whereIn('id', $bracket->fresh('matches')->matches->pluck('event_id')->filter())
            ->orderBy('schedule')->orderBy('start_time')->orderBy('name')->get();
        foreach ($events as $event) {
            $this->assignJudge($event);
            $this->lineUp($event);
        }

        return $bracket->fresh('matches');
    }

    /** Top-4 playoffs seeded from a finished group stage: #1 v #4, #2 v #3, then the final. */
    public function playoffs(string $category, string $venue, array $days, string $time, int $minutes): Bracket
    {
        $top = array_slice(array_column(TeamMatch::standings($category), 'department'), 0, 4);
        [$sport, $division] = DemoContext::parse($category);

        return $this->bracket($category, 'single_elimination', $top, $venue, $days, $time, $minutes, 'standings', "{$division}'s {$sport} — Playoffs");
    }

    /** A game outside any bracket (a friendly, an invitational, an open). */
    public function game(string $category, string $name, string $home, string $away, string $venue, int $day, string $time, int $minutes): Event
    {
        $start = Carbon::parse($time);
        $date = $this->day($day)->toDateString();
        $end = $start->copy()->addMinutes($minutes)->format('H:i');
        if (Event::venueConflicts($this->venueId($venue), $venue, $date, $time, $end)->isNotEmpty()) {
            throw new \RuntimeException("Couldn't schedule {$name}: {$venue} is already booked then.");
        }
        $event = Event::create([
            'id' => (string) Str::uuid(), 'name' => $name, 'category' => $category,
            'schedule' => $date, 'start_time' => $time, 'end_time' => $end,
            'venue_id' => $this->venueId($venue), 'venue_name' => $venue,
            'departments' => [DemoContext::COLLEGES[$home], DemoContext::COLLEGES[$away]],
            'status' => 'upcoming', 'qr_token' => Str::random(32),
        ]);
        $this->assignJudge($event);
        $this->lineUp($event);

        return $event;
    }

    public function assignJudge(Event $event): void
    {
        [$start, $end] = $this->window($event);
        if ($current = $event->judges[0]['id'] ?? null) {
            $this->ctx->releaseJudge($current, $start, $end);
        }
        $j = $this->ctx->pickJudge($event->category, $start, $end);
        $judges = [['id' => $j->id, 'name' => $j->name, 'email' => $j->email]];
        DB::table('events')->where('id', $event->id)->update(['judges' => json_encode($judges)]);
        $event->judges = $judges;
    }

    /**
     * Both colleges' lineups for a game whose teams are known, from each
     * team's coach: the starters (the volleyball rotation I–VI, the sepak
     * takraw regu, chess boards 1–4) and the bench. Badminton and table
     * tennis players come from the racquet lines instead.
     */
    public function lineUp(Event $event, bool $onlyMissing = false): void
    {
        $sport = LineupRules::sportOf($event);
        $teams = $sport ? PlayByPlay::teams($event) : null;
        if (! $teams) {
            return;
        }
        $rules = LineupRules::for($sport);
        [$sportName, $division] = DemoContext::parse($event->category);
        $starters = ['basketball' => 5, 'beach volleyball' => 2][$sport] ?? count($rules['positions']);
        $rows = [];

        foreach ($teams as $team) {
            if ($onlyMissing && GamePlayer::where('game_id', $event->id)->where('team_id', $team->id)->exists()) {
                continue;
            }
            $roster = array_values(array_filter(
                $this->ctx->roster($this->ctx->coach($team->name, $sportName), $division),
                fn ($a) => $a->status !== 'injured',
            ));
            foreach (array_slice($roster, 0, $rules['max']) as $k => $a) {
                $rows[] = [
                    'game_id' => $event->id, 'team_id' => $team->id, 'player_id' => $a->id,
                    'jersey_number' => $a->jersey_number,
                    'rotation_position' => $k < count($rules['positions']) ? $k + 1 : null,
                    'is_starter' => $k < $starters, 'created_at' => now(), 'updated_at' => now(),
                ];
            }
        }
        DB::table('game_players')->insert($rows);
    }

    /** A team off a bye has no earlier game to carry a lineup from: fill in every game still to play. */
    public function lineUpRemaining(): void
    {
        foreach (Event::where('status', '!=', 'completed')->get() as $event) {
            if (count($event->departments ?? []) === 2) {
                $this->lineUp($event, onlyMissing: true);
            }
        }
    }

    /** Reschedule a game (and its bracket match); its judge is re-picked for the new slot. */
    public function move(Event $event, Carbon $date, string $time, int $minutes): Event
    {
        [$start, $end] = $this->window($event);
        if ($judge = $event->judges[0]['id'] ?? null) {
            $this->ctx->releaseJudge($judge, $start, $end);
        }
        $to = ['schedule' => $date->toDateString(), 'start_time' => $time, 'end_time' => Carbon::parse($time)->addMinutes($minutes)->format('H:i')];
        DB::table('events')->where('id', $event->id)->update($to);
        DB::table('bracket_matches')->where('event_id', $event->id)->update(['scheduled_date' => $to['schedule'], 'scheduled_time' => $time]);
        $event = Event::find($event->id);
        $event->judges = null;
        $this->assignJudge($event);

        return $event;
    }

    /** [start, end] of a game. */
    public function window(Event $event): array
    {
        $date = substr((string) $event->schedule, 0, 10);
        $start = Carbon::parse("{$date} {$event->start_time}");
        $end = Carbon::parse("{$date} {$event->end_time}");

        return [$start, $end->lessThanOrEqualTo($start) ? $start->copy()->addHour() : $end];
    }

    public function day(int $offset): Carbon
    {
        return $this->ctx->today->copy()->addDays($offset);
    }

    public function venueId(string $venue): ?string
    {
        return $this->ctx->venues[$venue] ?? throw new \RuntimeException("Unknown venue {$venue}.");
    }

    public function finalOf(Bracket $bracket): ?BracketMatch
    {
        return BracketMatch::where('bracket_id', $bracket->id)->orderByDesc('round')->first();
    }
}
