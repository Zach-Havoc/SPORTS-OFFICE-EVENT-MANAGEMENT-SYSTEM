<?php

namespace App\Services;

use App\Models\Bracket;
use App\Models\BracketMatch;
use App\Models\Event;
use App\Models\Ranking;
use App\Models\TeamMatch;
use App\Models\Venue;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Generates, publishes, and progresses tournament brackets.
 *
 *  generate() — build + persist the tree (no Events yet; status "draft")
 *  publish()  — create the scheduled Event for every match (status "active")
 *  advance()  — a match's result is in: record the winner and feed it forward
 */
class BracketService
{
    /**
     * Standard single-elimination slot order for a bracket of `size` (a power
     * of two): the SEED NUMBER that belongs in each slot, top to bottom.
     *   size 4 -> [1, 4, 2, 3]
     *   size 8 -> [1, 8, 4, 5, 2, 7, 3, 6]
     */
    public static function seedSlots(int $size): array
    {
        $seeds = [1, 2];
        for ($rounds = (int) round(log($size, 2)), $r = 1; $r < $rounds; $r++) {
            $sum = count($seeds) * 2 + 1;
            $next = [];
            foreach ($seeds as $s) {
                $next[] = $s;
                $next[] = $sum - $s;
            }
            $seeds = $next;
        }

        return $seeds;
    }

    /**
     * @param  array{sport:string,format:string,participants:array<int,string>,drawMethod?:string,seedFromStandings?:bool,startDate?:string,startTime?:string,matchDuration?:int,breakDuration?:int,venueId?:string}  $cfg
     */
    public function generate(array $cfg, ?string $userId = null): Bracket
    {
        $participants = array_values(array_unique(array_filter($cfg['participants'] ?? [])));
        if (count($participants) < 2) {
            throw ValidationException::withMessages(['participants' => ['Select at least 2 participants.']]);
        }

        $format   = $cfg['format'] ?? 'single_elimination';
        $sport    = $cfg['sport'];
        $settings = [
            'startDate'     => $cfg['startDate'] ?? now()->toDateString(),
            'startTime'     => $cfg['startTime'] ?? '09:00',
            'matchDuration' => (int) ($cfg['matchDuration'] ?? 60),
            'breakDuration' => (int) ($cfg['breakDuration'] ?? 15),
            'venueId'       => $cfg['venueId'] ?? null,
        ];

        // How the field is ordered before the standard serpentine slotting:
        //   standings — best record first (#1 vs the lowest seed)
        //   random    — shuffled draw
        //   manual    — the order the admin chose them in (default)
        $method = $cfg['drawMethod'] ?? (! empty($cfg['seedFromStandings']) ? 'standings' : 'manual');
        $seeded = false;
        if ($format === 'single_elimination') {
            if ($method === 'standings') {
                $participants = $this->orderBySeed($participants, $sport);
                $seeded = true;
            } elseif ($method === 'random') {
                shuffle($participants);
            }
        }

        $bracket = Bracket::create([
            'id'         => (string) Str::uuid(),
            'sport'      => $sport,
            'format'     => $format,
            'name'       => "{$sport} — " . ($format === 'round_robin' ? 'Round Robin' : 'Elimination'),
            'status'     => 'draft',
            'seeded'     => $seeded,
            'settings'   => $settings,
            'created_by' => $userId,
        ]);

        $format === 'round_robin'
            ? $this->buildRoundRobin($bracket, $participants, $settings)
            : $this->buildSingleElimination($bracket, $participants, $settings);

        return $bracket->fresh('matches');
    }

    // ── Single elimination ──────────────────────────────────────────────

    private function buildSingleElimination(Bracket $bracket, array $participants, array $settings): void
    {
        $n = count($participants);
        $rounds = (int) ceil(log($n, 2));
        $size = 2 ** $rounds;

        // Always place teams in the standard serpentine slot order (#1 vs the
        // lowest, #1/#2 in opposite halves). This spreads the byes against the
        // top slots so "BYE vs BYE" can never occur. "Seeded" only decides
        // whether `$participants` was pre-sorted by standings; unseeded keeps
        // the admin's selection order.
        $slots = array_map(
            fn ($seedNo) => $participants[$seedNo - 1] ?? null,
            self::seedSlots($size),
        );

        $cursor = $this->startCursor($settings);
        $step   = ($settings['matchDuration'] + $settings['breakDuration']);

        // Create every node first (so parents exist for wiring), round by round.
        $byRound = [];
        for ($round = 1; $round <= $rounds; $round++) {
            $count = 2 ** ($rounds - $round);
            for ($slot = 0; $slot < $count; $slot++) {
                $home = $away = null;
                $isBye = false;

                if ($round === 1) {
                    $home = $slots[$slot * 2] ?? null;
                    $away = $slots[$slot * 2 + 1] ?? null;
                    $isBye = ($home === null) !== ($away === null); // exactly one side empty
                }

                $bm = BracketMatch::create([
                    'id'             => (string) Str::uuid(),
                    'bracket_id'     => $bracket->id,
                    'round'          => $round,
                    'slot'           => $slot,
                    'stage_label'    => $this->stageLabel($round, $rounds),
                    'home_team'      => $home,
                    'away_team'      => $away,
                    'is_bye'         => $isBye,
                    'status'         => 'pending',
                    'scheduled_date' => $cursor->toDateString(),
                    'scheduled_time' => $cursor->format('H:i'),
                    'venue_id'       => $settings['venueId'],
                    'venue_name'     => $this->venueName($settings['venueId']),
                ]);

                $byRound[$round][$slot] = $bm;
                $cursor = $cursor->copy()->addMinutes($step);
            }
            $cursor = $cursor->copy()->addMinutes(30); // breather between rounds
        }

        // Wire parents/sources and set initial statuses.
        foreach ($byRound as $round => $slots2) {
            foreach ($slots2 as $slot => $bm) {
                if ($round < $rounds) {
                    $parent = $byRound[$round + 1][intdiv($slot, 2)];
                    $bm->next_match_id   = $parent->id;
                    $bm->next_match_slot = $slot % 2 === 0 ? 'home' : 'away';
                }
                if ($round > 1) {
                    $bm->home_source_match_id = $byRound[$round - 1][$slot * 2]->id;
                    $bm->away_source_match_id = $byRound[$round - 1][$slot * 2 + 1]->id;
                }
                if ($round === 1 && ! $bm->is_bye && $bm->bothTeamsKnown()) {
                    $bm->status = 'ready';
                }
                $bm->save();
            }
        }

        // Settle byes and let their walkover teams fall into the next round.
        $this->resolve($bracket->fresh('matches'));
    }

    // ── Round robin ─────────────────────────────────────────────────────

    private function buildRoundRobin(Bracket $bracket, array $participants, array $settings): void
    {
        $cursor = $this->startCursor($settings);
        $step   = ($settings['matchDuration'] + $settings['breakDuration']);
        [$sh, $sm] = array_map('intval', explode(':', $settings['startTime']));
        $round = 1;
        $slot  = 0;
        $n = count($participants);

        for ($i = 0; $i < $n; $i++) {
            for ($j = $i + 1; $j < $n; $j++) {
                BracketMatch::create([
                    'id'             => (string) Str::uuid(),
                    'bracket_id'     => $bracket->id,
                    'round'          => $round,
                    'slot'           => $slot++,
                    'stage_label'    => "Round {$round}",
                    'home_team'      => $participants[$i],
                    'away_team'      => $participants[$j],
                    'status'         => 'ready',
                    'scheduled_date' => $cursor->toDateString(),
                    'scheduled_time' => $cursor->format('H:i'),
                    'venue_id'       => $settings['venueId'],
                    'venue_name'     => $this->venueName($settings['venueId']),
                ]);

                $cursor = $cursor->copy()->addMinutes($step);
                if ((int) $cursor->format('H') >= 18) {
                    $cursor = $cursor->copy()->addDay()->setTime($sh ?: 9, $sm ?: 0);
                    $round++;
                    $slot = 0;
                }
            }
        }
    }

    // ── Publish: turn every match into a scheduled Event ─────────────────

    /**
     * @return array{conflicts: array<int, array<string,mixed>>}  empty conflicts = published
     */
    public function publish(Bracket $bracket): array
    {
        $bracket->loadMissing('matches');
        $playable = $bracket->matches->reject->is_bye;

        // Pre-flight venue conflicts against everything already on the calendar.
        $conflicts = collect();
        foreach ($playable as $bm) {
            $end = $this->endTime($bm->scheduled_time, $bracket->settings['matchDuration'] ?? 60);
            $conflicts = $conflicts->merge(Event::venueConflicts(
                $bm->venue_id,
                $bm->venue_name,
                $bm->scheduled_date,
                $bm->scheduled_time,
                $end,
                $bm->event_id,
            ));
        }
        if ($conflicts->isNotEmpty()) {
            return ['conflicts' => $conflicts->unique('id')->map->toApiFormat()->values()->all()];
        }

        $bracket->update(['status' => 'active']);
        foreach ($playable as $bm) {
            $this->syncEvent($bracket, $bm);
        }
        $this->resolve($bracket->fresh('matches')); // normalise statuses / event names

        return ['conflicts' => []];
    }

    /** Create (or refresh) the Event backing one bracket match. */
    private function syncEvent(Bracket $bracket, BracketMatch $bm): void
    {
        $payload = [
            'name'        => $this->eventName($bracket, $bm),
            'category'    => $bracket->sport,
            'schedule'    => $bm->scheduled_date,
            'start_time'  => $bm->scheduled_time,
            'end_time'    => $this->endTime($bm->scheduled_time, $bracket->settings['matchDuration'] ?? 60),
            'venue_id'    => $bm->venue_id,
            'venue_name'  => $bm->venue_name,
            'departments' => array_values(array_filter([$bm->home_team, $bm->away_team])),
            'criteria'    => [],
            'status'      => 'upcoming',
        ];

        if ($bm->event_id && ($event = Event::find($bm->event_id))) {
            $event->update($payload);
        } else {
            $event = Event::create($payload + [
                'id'       => (string) Str::uuid(),
                'qr_token' => Str::random(32),
            ]);
            $bm->event_id = $event->id;
            $bm->save();
        }
    }

    // ── Advance: a result is in ─────────────────────────────────────────

    public function advance(BracketMatch $bm, ?string $winner = null, bool $force = false): BracketMatch
    {
        if ($bm->is_bye) {
            throw ValidationException::withMessages(['match' => ['This is a bye — nothing to record.']]);
        }
        if ($bm->status === 'completed' && ! $force) {
            throw ValidationException::withMessages(['match' => ['This match is already decided. Use "change result" to correct it.']]);
        }
        if (! $bm->bothTeamsKnown()) {
            throw ValidationException::withMessages(['match' => ['Both teams are not set yet.']]);
        }

        $winner = $winner ?: $this->resolveWinner($bm);
        if (! in_array($winner, [$bm->home_team, $bm->away_team], true)) {
            throw ValidationException::withMessages(['winner' => ['No final result for this match yet.']]);
        }

        $bm->winner = $winner;
        $bm->loser  = $winner === $bm->home_team ? $bm->away_team : $bm->home_team;
        $bm->save();

        // Rebuild the whole tree from the decided matches. Deterministic — a
        // corrected result cascades correctly with no fragile unwinding.
        $this->resolve($bm->bracket()->first());

        return $bm->fresh();
    }

    /**
     * Recompute every derived slot, every match status, and the champion from
     * the set of matches that currently have a `winner`. Safe to call after any
     * change (a first result, a correction, or a re-publish).
     */
    public function resolve(Bracket $bracket): void
    {
        $bracket->load('matches');
        $matches   = $bracket->matches->keyBy('id');
        $maxRound  = (int) ($matches->max('round') ?? 0);

        // Pass 1: clear derived (round > 1) team slots; settle byes.
        foreach ($matches as $m) {
            if ($m->round > 1) {
                $m->home_team = null;
                $m->away_team = null;
            }
            if ($m->is_bye) {
                $m->winner = $m->home_team ?? $m->away_team;
                $m->loser  = null;
                $m->status = 'completed';
            }
        }

        // Pass 2: round by round — decide each match, then push its result up.
        for ($r = 1; $r <= $maxRound; $r++) {
            foreach ($matches->where('round', $r)->sortBy('slot') as $m) {
                if (! $m->is_bye) {
                    $bothKnown = $m->home_team !== null && $m->away_team !== null;
                    $decided   = $bothKnown && in_array($m->winner, [$m->home_team, $m->away_team], true);

                    if ($decided) {
                        $m->loser  = $m->winner === $m->home_team ? $m->away_team : $m->home_team;
                        $m->status = 'completed';
                    } else {
                        $m->winner = null;
                        $m->loser  = null;
                        $m->status = $bothKnown
                            ? ($m->event_id ? 'scheduled' : 'ready')
                            : 'pending';
                    }
                }

                if ($m->status === 'completed' && $m->next_match_id && isset($matches[$m->next_match_id])) {
                    $parent = $matches[$m->next_match_id];
                    if ($parent->home_source_match_id === $m->id) {
                        $parent->home_team = $parent->home_source_outcome === 'loser' ? $m->loser : $m->winner;
                    }
                    if ($parent->away_source_match_id === $m->id) {
                        $parent->away_team = $parent->away_source_outcome === 'loser' ? $m->loser : $m->winner;
                    }
                }
            }
        }

        // Pass 3: persist, keep each match's Event in step, find the champion.
        $champion = null;
        foreach ($matches as $m) {
            $m->save();

            if ($m->event_id && ($event = Event::find($m->event_id))) {
                $event->update([
                    'name'        => $this->eventName($bracket, $m),
                    'departments' => array_values(array_filter([$m->home_team, $m->away_team])),
                ]);
            }

            if (! $m->next_match_id && $m->status === 'completed' && $m->winner) {
                $champion = $m->winner;
            }
        }

        $bracket->update([
            'champion' => $champion,
            'status'   => $champion ? 'completed' : ($bracket->status === 'draft' ? 'draft' : 'active'),
        ]);
    }

    // ── Helpers ────────────────────────────────────────────────────────

    private function resolveWinner(BracketMatch $bm): ?string
    {
        if ($bm->event_id) {
            $tm = TeamMatch::where('event_id', $bm->event_id)->first();
            if ($tm && $tm->winner) {
                return $tm->winner;
            }
            $top = Ranking::where('event_id', $bm->event_id)->orderBy('rank')->first();
            if ($top && Ranking::where('event_id', $bm->event_id)->count() >= 2) {
                return $top->department;
            }
        }

        return null;
    }

    private function orderBySeed(array $participants, string $sport): array
    {
        $rank = [];
        foreach (TeamMatch::standings($sport) as $i => $row) {
            $rank[$row['department']] = $i;
        }
        usort($participants, fn ($a, $b) => ($rank[$a] ?? 9999) <=> ($rank[$b] ?? 9999));

        return $participants;
    }

    private function startCursor(array $settings): Carbon
    {
        [$h, $m] = array_map('intval', array_pad(explode(':', $settings['startTime'] ?: '09:00'), 2, 0));

        return Carbon::parse($settings['startDate'])->setTime($h ?: 9, $m ?: 0);
    }

    private function endTime(?string $start, int $durationMin): string
    {
        [$h, $m] = array_map('intval', array_pad(explode(':', $start ?: '09:00'), 2, 0));
        $total = ($h * 60 + $m + $durationMin) % (24 * 60);

        return sprintf('%02d:%02d', intdiv($total, 60), $total % 60);
    }

    private function venueName(?string $venueId): ?string
    {
        return $venueId ? Venue::find($venueId)?->name : null;
    }

    private function stageLabel(int $round, int $totalRounds): string
    {
        return match ($totalRounds - $round) {
            0 => 'Finals',
            1 => 'Semi-Finals',
            2 => 'Quarter-Finals',
            default => "Round {$round}",
        };
    }

    private function eventName(Bracket $bracket, BracketMatch $bm): string
    {
        $home = $bm->home_team ?? 'TBD';
        $away = $bm->away_team ?? 'TBD';

        return "{$bracket->sport} ({$bm->stage_label}): {$home} vs {$away}";
    }
}
