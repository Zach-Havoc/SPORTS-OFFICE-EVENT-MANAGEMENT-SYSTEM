<?php

namespace App\Services;

use App\Http\Controllers\Api\RankingController;
use App\Models\Bracket;
use App\Models\BracketMatch;
use App\Models\Department;
use App\Models\Event;
use App\Models\GamePlayer;
use App\Models\Ranking;
use App\Models\TeamMatch;
use App\Models\Venue;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
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

        $format = $cfg['format'] ?? 'single_elimination';
        if ($format === 'double_elimination' && count($participants) < 3) {
            throw ValidationException::withMessages(['participants' => ['Double elimination needs at least 3 participants.']]);
        }
        $sport = $cfg['sport'];
        $settings = [
            'startDate' => $cfg['startDate'] ?? now()->toDateString(),
            'startTime' => $cfg['startTime'] ?? '09:00',
            'matchDuration' => (int) ($cfg['matchDuration'] ?? 60),
            'breakDuration' => (int) ($cfg['breakDuration'] ?? 15),
            'venueId' => $cfg['venueId'] ?? null,
            // Men's / Women's, for a team sport played in both. It names the
            // bracket and its games ("Men's Basketball (Semifinal): …"), which
            // is how a college's Men's and Women's coaches tell them apart.
            'division' => in_array($cfg['division'] ?? null, ['Men', 'Women'], true) ? $cfg['division'] : null,
        ];
        if ($format === 'double_elimination') {
            // The lower-bracket champion has to beat the unbeaten upper-bracket
            // champion twice: if they win the grand final, a reset game decides it.
            $settings['grandFinalReset'] = (bool) ($cfg['grandFinalReset'] ?? true);
        }

        // How the field is ordered before the standard serpentine slotting:
        //   standings — best record first (#1 vs the lowest seed)
        //   random    — the draw the admin already previewed and shuffled
        //               client-side; the backend trusts that order as-is
        //   manual    — the order the admin chose them in (default)
        $method = $cfg['drawMethod'] ?? (! empty($cfg['seedFromStandings']) ? 'standings' : 'manual');
        $seeded = false;
        if (self::isElimination($format)) {
            if ($method === 'standings') {
                $participants = $this->orderBySeed($participants, $sport);
                $seeded = true;
            }
            // 'random' and 'manual' both fall through unchanged: re-shuffling
            // here would create a bracket different from the one the admin
            // previewed and approved on the frontend.
        }

        $bracket = Bracket::create([
            'id' => (string) Str::uuid(),
            'sport' => $sport,
            'format' => $format,
            'name' => ($settings['division'] ? "{$settings['division']}'s " : '')."{$sport} — ".self::formatName($format),
            'status' => 'draft',
            'seeded' => $seeded,
            'settings' => $settings,
            'created_by' => $userId,
        ]);

        match ($format) {
            'round_robin' => $this->buildRoundRobin($bracket, $participants, $settings),
            'double_elimination' => $this->buildDoubleElimination($bracket, $participants, $settings),
            default => $this->buildSingleElimination($bracket, $participants, $settings),
        };

        return $bracket->fresh('matches');
    }

    /** Single or double elimination — a knockout tree, seeded and with byes. */
    public static function isElimination(?string $format): bool
    {
        return in_array($format, ['single_elimination', 'double_elimination'], true);
    }

    /** "Round Robin" / "Elimination" / "Double Elimination", as a bracket's name ends. */
    public static function formatName(?string $format): string
    {
        return match ($format) {
            'round_robin' => 'Round Robin',
            'double_elimination' => 'Double Elimination',
            default => 'Elimination',
        };
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
        $step = ($settings['matchDuration'] + $settings['breakDuration']);

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
                    'id' => (string) Str::uuid(),
                    'bracket_id' => $bracket->id,
                    'round' => $round,
                    'slot' => $slot,
                    'stage_label' => $this->stageLabel($round, $rounds),
                    'home_team' => $home,
                    'away_team' => $away,
                    'is_bye' => $isBye,
                    'status' => 'pending',
                    'scheduled_date' => $cursor->toDateString(),
                    'scheduled_time' => $cursor->format('H:i'),
                    'venue_id' => $settings['venueId'],
                    'venue_name' => $this->venueName($settings['venueId']),
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
                    $bm->next_match_id = $parent->id;
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

    // ── Double elimination ──────────────────────────────────────────────

    /**
     * A team is out after its second loss.
     *
     *   upper        the single-elimination tree (same seeding and byes)
     *   lower        every upper-bracket loser drops in; a loss here is the end.
     *                For a field of 2^R it has 2(R-1) rounds, alternating:
     *                odd rounds pair lower survivors off, even rounds bring in
     *                the losers of the next upper round (in reversed / swapped
     *                order, so teams don't meet again straight away)
     *   grand_final  upper champion (home) vs lower champion (away); with
     *                `grandFinalReset`, a second game if the lower champion wins
     *
     * An upper bye has no loser, so lower matches it would have fed are left
     * out: a lower match with one team waiting passes that team straight on,
     * one with none disappears. Every match created is a real game, and a
     * field of N plays 2N-2 games (2N-1 with a reset).
     *
     * `round` is the order of play across the whole bracket (upper 1, lower 1,
     * upper 2, lower 2, lower 3, upper 3, …, grand final), so a team's earlier
     * games always have a lower `round`. `slot` counts within a section's round.
     */
    private function buildDoubleElimination(Bracket $bracket, array $participants, array $settings): void
    {
        $rounds = (int) ceil(log(count($participants), 2));
        $size = 2 ** $rounds;
        $lowerRounds = 2 * ($rounds - 1);
        $slots = array_map(fn ($seedNo) => $participants[$seedNo - 1] ?? null, self::seedSlots($size));

        // Each planned match: [section, sectionRound, home, away, homeFeed, awayFeed, isBye]
        // where a feed is [matchKey, 'winner'|'loser'] or null (no team comes).
        $plan = [];
        $feed = fn (string $key, string $outcome) => [$key, $outcome];

        // Upper bracket — the single-elimination tree.
        for ($r = 1; $r <= $rounds; $r++) {
            for ($s = 0; $s < 2 ** ($rounds - $r); $s++) {
                if ($r === 1) {
                    $home = $slots[$s * 2];
                    $away = $slots[$s * 2 + 1];
                    $plan["U{$r}-{$s}"] = ['upper', $r, $home, $away, null, null, ($home === null) !== ($away === null)];
                } else {
                    $prev = $r - 1;
                    $plan["U{$r}-{$s}"] = ['upper', $r, null, null, $feed("U{$prev}-".($s * 2), 'winner'), $feed("U{$prev}-".($s * 2 + 1), 'winner'), false];
                }
            }
        }
        // The loser of an upper match — none from a bye.
        $upperLoser = fn (int $r, int $s) => $plan["U{$r}-{$s}"][6] ? null : $feed("U{$r}-{$s}", 'loser');

        // A lower match between two feeds: created only when both teams come.
        $lowerSlot = [];
        $lower = function (int $j, ?array $home, ?array $away) use (&$plan, &$lowerSlot, $feed): ?array {
            if ($home === null || $away === null) {
                return $home ?? $away;   // one team walks on (or nobody comes)
            }
            $slot = $lowerSlot[$j] = ($lowerSlot[$j] ?? -1) + 1;
            $plan["L{$j}-{$slot}"] = ['lower', $j, null, null, $home, $away, false];

            return $feed("L{$j}-{$slot}", 'winner');
        };

        // Lower round 1: the first-round upper losers, in pairs.
        $survivors = [];
        for ($s = 0; $s < $size / 4; $s++) {
            $survivors[] = $lower(1, $upperLoser(1, $s * 2), $upperLoser(1, $s * 2 + 1));
        }
        for ($k = 1; $k < $rounds; $k++) {
            // Lower round 2k: the survivors meet the losers of upper round k+1.
            $count = count($survivors);
            $next = [];
            foreach ($survivors as $s => $survivor) {
                $from = $k % 2 === 1 ? $count - 1 - $s : ($s + intdiv($count, 2)) % $count;
                $next[] = $lower(2 * $k, $survivor, $upperLoser($k + 1, $from));
            }
            $survivors = $next;

            // Lower round 2k+1: the survivors pair off (not after the last drop-in).
            if ($k < $rounds - 1) {
                $next = [];
                for ($s = 0; $s < count($survivors); $s += 2) {
                    $next[] = $lower(2 * $k + 1, $survivors[$s], $survivors[$s + 1]);
                }
                $survivors = $next;
            }
        }

        // Grand final: upper champion vs lower champion, then the reset.
        $plan['G1-0'] = ['grand_final', 1, null, null, $feed("U{$rounds}-0", 'winner'), $survivors[0], false];
        if ($settings['grandFinalReset'] ?? true) {
            // Played only if the lower champion wins game 1 — the same two
            // teams, the upper champion (game 1's loser) at home again.
            $plan['G2-0'] = ['grand_final', 2, null, null, $feed('G1-0', 'loser'), $feed('G1-0', 'winner'), false];
        }

        // The order of play: upper 1, then (lower 2k-1, upper k+1, lower 2k) for each k.
        $phases = [['upper', 1]];
        for ($k = 1; $k < $rounds; $k++) {
            array_push($phases, ['lower', 2 * $k - 1], ['upper', $k + 1], ['lower', 2 * $k]);
        }
        array_push($phases, ['grand_final', 1], ['grand_final', 2]);

        // Lower rounds that were all walk-ons are dropped, so the labels count real rounds.
        $realLower = array_values(array_unique(array_map(fn ($p) => $p[1], array_filter($plan, fn ($p) => $p[0] === 'lower'))));
        sort($realLower);

        $cursor = $this->startCursor($settings);
        $step = ($settings['matchDuration'] + $settings['breakDuration']);
        $created = [];
        $order = 0;
        foreach ($phases as [$section, $sectionRound]) {
            $keys = array_keys(array_filter($plan, fn ($p) => $p[0] === $section && $p[1] === $sectionRound));
            if (! $keys) {
                continue;
            }
            $order++;
            foreach ($keys as $key) {
                [, , $home, $away, , , $isBye] = $plan[$key];
                $created[$key] = BracketMatch::create([
                    'id' => (string) Str::uuid(),
                    'bracket_id' => $bracket->id,
                    'round' => $order,
                    'slot' => (int) explode('-', $key)[1],
                    'section' => $section,
                    'stage_label' => match ($section) {
                        'upper' => 'Upper '.$this->stageLabel($sectionRound, $rounds),
                        'lower' => $this->lowerStageLabel(array_search($sectionRound, $realLower, true) + 1, count($realLower)),
                        default => $sectionRound === 1 ? 'Grand Final' : 'Grand Final (Reset)',
                    },
                    'home_team' => $home,
                    'away_team' => $away,
                    'is_bye' => $isBye,
                    'status' => 'pending',
                    'scheduled_date' => $cursor->toDateString(),
                    'scheduled_time' => $cursor->format('H:i'),
                    'venue_id' => $settings['venueId'],
                    'venue_name' => $this->venueName($settings['venueId']),
                ]);
                if (! $isBye) {
                    $cursor = $cursor->copy()->addMinutes($step);   // a bye takes no court time
                }
            }
            $cursor = $cursor->copy()->addMinutes(30); // breather between rounds
        }

        // Wire every match to the matches that feed it. A winner's next match
        // is what the bracket views draw lines to; losers just drop.
        foreach ($plan as $key => [, , , , $homeFeed, $awayFeed]) {
            $bm = $created[$key];
            foreach (['home' => $homeFeed, 'away' => $awayFeed] as $side => $f) {
                if ($f === null) {
                    continue;
                }
                [$sourceKey, $outcome] = $f;
                $bm->{"{$side}_source_match_id"} = $created[$sourceKey]->id;
                $bm->{"{$side}_source_outcome"} = $outcome;
                if ($outcome === 'winner') {
                    $created[$sourceKey]->next_match_id = $bm->id;
                    $created[$sourceKey]->next_match_slot = $side;
                }
            }
        }
        foreach ($created as $bm) {
            if ($bm->section === 'upper' && ! $bm->is_bye && $bm->bothTeamsKnown()) {
                $bm->status = 'ready';
            }
            $bm->save();
        }

        $this->resolve($bracket->fresh('matches'));
    }

    private function lowerStageLabel(int $round, int $totalRounds): string
    {
        return $round === $totalRounds ? 'Lower Final' : "Lower Round {$round}";
    }

    /**
     * The grand-final reset game: the grand-final match fed by the other one.
     * Null for any other bracket (or a double elimination without a reset).
     */
    private function resetMatch(Collection $matches): ?BracketMatch
    {
        $byId = $matches->keyBy('id');   // callers pass both keyed and plain lists

        return $byId->first(fn ($m) => $m->section === 'grand_final'
            && $m->home_source_match_id
            && optional($byId->get($m->home_source_match_id))->section === 'grand_final');
    }

    /** The first grand-final game of a double elimination. */
    private function grandFinal(Collection $matches): ?BracketMatch
    {
        $reset = $this->resetMatch($matches);

        return $matches->first(fn ($m) => $m->section === 'grand_final' && $m->id !== $reset?->id);
    }

    /** True once the reset has to be played: the lower champion (away) won game 1. */
    private function resetNeeded(Collection $matches): bool
    {
        $gf = $this->grandFinal($matches);

        return $gf && $gf->status === 'completed' && $gf->winner !== null && $gf->winner === $gf->away_team;
    }

    // ── Round robin ─────────────────────────────────────────────────────

    private function buildRoundRobin(Bracket $bracket, array $participants, array $settings): void
    {
        $cursor = $this->startCursor($settings);
        $step = ($settings['matchDuration'] + $settings['breakDuration']);
        [$sh, $sm] = array_map('intval', explode(':', $settings['startTime']));
        $round = 1;
        $slot = 0;
        $n = count($participants);

        for ($i = 0; $i < $n; $i++) {
            for ($j = $i + 1; $j < $n; $j++) {
                BracketMatch::create([
                    'id' => (string) Str::uuid(),
                    'bracket_id' => $bracket->id,
                    'round' => $round,
                    'slot' => $slot++,
                    'stage_label' => "Round {$round}",
                    'home_team' => $participants[$i],
                    'away_team' => $participants[$j],
                    'status' => 'ready',
                    'scheduled_date' => $cursor->toDateString(),
                    'scheduled_time' => $cursor->format('H:i'),
                    'venue_id' => $settings['venueId'],
                    'venue_name' => $this->venueName($settings['venueId']),
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
     * @return array{conflicts: array<int, array<string,mixed>>} empty conflicts = published
     */
    public function publish(Bracket $bracket): array
    {
        $bracket->loadMissing('matches');
        // A grand-final reset goes on the calendar only once it's needed
        // (resolve() schedules it), so an unplayed game never shows up.
        $reset = $this->resetMatch($bracket->matches);
        $playable = $bracket->matches->reject(fn ($m) => $m->is_bye || $m->id === $reset?->id);

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
            'name' => $this->eventName($bracket, $bm),
            'category' => $bracket->sport,
            'schedule' => $bm->scheduled_date,
            'start_time' => $bm->scheduled_time,
            'end_time' => $this->endTime($bm->scheduled_time, $bracket->settings['matchDuration'] ?? 60),
            'venue_id' => $bm->venue_id,
            'venue_name' => $bm->venue_name,
            'departments' => array_values(array_filter([$bm->home_team, $bm->away_team])),
            'status' => 'upcoming',
        ];

        if ($bm->event_id && ($event = Event::find($bm->event_id))) {
            $event->update($payload);
        } else {
            $event = Event::create($payload + [
                'id' => (string) Str::uuid(),
                'qr_token' => Str::random(32),
            ]);
            $bm->event_id = $event->id;
            $bm->save();
        }
        $this->carryLineups($bracket, $bm, $event);
    }

    /**
     * A team that advances brings its lineup: when a match's game has a team
     * with no lineup yet, copy the one it used in its previous game in this
     * bracket. The coach can still change it before the game.
     */
    /** The colleges, loaded once per service (carryLineups runs after every result). */
    private ?Collection $colleges = null;

    private function carryLineups(Bracket $bracket, BracketMatch $bm, Event $event, ?Collection $linedUp = null): void
    {
        // Only elimination rounds after the first (a round robin's fixtures are
        // all known from the start), and only sports with game lineups
        // (racquet sports use racquet lines). `round` is the order of play in
        // a double elimination too, so "previous game" below holds there.
        if ($bm->round <= 1 || ! self::isElimination($bracket->format) || ! LineupRules::sportOf($event)) {
            return;
        }

        // Each side as soon as it's known — the other semifinal may still be on.
        $colleges = $this->colleges ??= Department::all(['id', 'name', 'abbreviation']);
        foreach (array_filter([$bm->home_team, $bm->away_team]) as $label) {
            $team = $colleges->first(fn ($d) => PlayByPlay::isCollege($d, $label));
            if (! $team) {
                continue;
            }
            $has = $linedUp ? $linedUp->has($event->id.'|'.$team->id)
                : GamePlayer::where('game_id', $event->id)->where('team_id', $team->id)->exists();
            if ($has) {
                continue;
            }
            $previous = BracketMatch::where('bracket_id', $bracket->id)
                ->where('round', '<', $bm->round)
                ->whereNotNull('event_id')
                ->where(fn ($q) => $q->where('home_team', $label)->orWhere('away_team', $label))
                ->orderByDesc('round')
                ->value('event_id');
            if (! $previous) {
                continue;
            }

            foreach (GamePlayer::where('game_id', $previous)->where('team_id', $team->id)->get() as $gp) {
                GamePlayer::create([
                    'game_id' => $event->id,
                    'team_id' => $team->id,
                    'player_id' => $gp->player_id,
                    'jersey_number' => $gp->jersey_number,
                    'rotation_position' => $gp->rotation_position,
                    'is_starter' => $gp->is_starter,   // the starting five come along too
                ]);
            }
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
        $bm->loser = $winner === $bm->home_team ? $bm->away_team : $bm->home_team;
        $bm->save();

        // Rebuild the whole tree from the decided matches. Deterministic — a
        // corrected result cascades correctly with no fragile unwinding.
        $this->resolve($bm->bracket()->first());

        return $bm->fresh();
    }

    /**
     * A bracket match's scheduled Event just got a final result — advance the
     * bracket automatically. Called from the scoring / live-score paths. Silent
     * and idempotent: no linked bracket match, an unplayable state, or a result
     * that's already recorded → nothing happens.
     */
    public function advanceFromEvent(string $eventId): void
    {
        $bm = BracketMatch::where('event_id', $eventId)->first();
        if (! $bm || $bm->is_bye || ! $bm->bothTeamsKnown()) {
            return;
        }

        try {
            $winner = $this->resolveWinner($bm);
            if (! in_array($winner, [$bm->home_team, $bm->away_team], true)) {
                return; // no usable result yet (e.g. a draw)
            }
            if ($bm->status === 'completed' && $bm->winner === $winner) {
                return; // already advanced with this result
            }
            $this->advance($bm, $winner, force: true);
        } catch (\Throwable $e) {
            \Log::warning('Bracket auto-advance skipped: '.$e->getMessage(), ['event_id' => $eventId]);
        }
    }

    /**
     * Recompute every derived slot, every match status, and the champion from
     * the set of matches that currently have a `winner`. Safe to call after any
     * change (a first result, a correction, or a re-publish).
     */
    public function resolve(Bracket $bracket): void
    {
        $bracket->load('matches');
        $matches = $bracket->matches->keyBy('id');
        $reset = $this->resetMatch($matches);

        // Every match, its feeders first: fill each fed slot (an elimination
        // round after the first) from its source match — that match's winner,
        // or in a double elimination its loser — then decide the match. A
        // round robin's later "rounds" are just later days of fixed fixtures:
        // nothing feeds them, so their teams stay.
        foreach ($this->inPlayOrder($matches) as $m) {
            foreach (['home', 'away'] as $side) {
                if ($sourceId = $m->{"{$side}_source_match_id"}) {
                    $source = $matches->get($sourceId);
                    $m->{"{$side}_team"} = $source && $source->status === 'completed'
                        ? ($m->{"{$side}_source_outcome"} === 'loser' ? $source->loser : $source->winner)
                        : null;
                }
            }

            if ($m->is_bye) {
                $m->winner = $m->home_team ?? $m->away_team;
                $m->loser = null;
                $m->status = 'completed';

                continue;
            }

            // The grand-final reset waits on game 1, and is skipped when the
            // upper-bracket champion wins it.
            if ($m->id === $reset?->id && ! $this->resetNeeded($matches)) {
                $m->home_team = $m->away_team = $m->winner = $m->loser = null;
                $m->status = optional($this->grandFinal($matches))->status === 'completed' ? 'skipped' : 'pending';

                continue;
            }

            $bothKnown = $m->home_team !== null && $m->away_team !== null;
            $decided = $bothKnown && in_array($m->winner, [$m->home_team, $m->away_team], true);

            if ($decided) {
                $m->loser = $m->winner === $m->home_team ? $m->away_team : $m->home_team;
                $m->status = 'completed';
            } else {
                $m->winner = null;
                $m->loser = null;
                $m->status = $bothKnown
                    ? ($m->event_id ? 'scheduled' : 'ready')
                    : 'pending';
            }
        }

        // The reset's game: on the calendar once it's needed, off it again if
        // a corrected result means it isn't (a draft has no games yet).
        if ($reset && $bracket->status !== 'draft') {
            if (in_array($reset->status, ['ready', 'scheduled'], true) && ! $reset->event_id) {
                $this->syncEvent($bracket, $reset);
                $reset->status = 'scheduled';
            } elseif (in_array($reset->status, ['pending', 'skipped'], true) && $reset->event_id) {
                Event::find($reset->event_id)?->delete();
                $reset->event_id = null;
            }
        }

        // Pass 3: persist, keep each match's Event in step, find the champion.
        // The games are loaded once, and only touched when their name or
        // teams actually change — this runs after every result.
        $champion = null;
        $events = Event::whereIn('id', $matches->pluck('event_id')->filter())->get()->keyBy('id');
        // Which games already have which team's lineup, in one query.
        $linedUp = GamePlayer::whereIn('game_id', $events->keys())->distinct()->get(['game_id', 'team_id'])
            ->map(fn ($r) => $r->game_id.'|'.$r->team_id)->flip();
        foreach ($matches as $m) {
            $m->save();

            if ($m->event_id && ($event = $events->get($m->event_id))) {
                $name = $this->eventName($bracket, $m);
                $departments = array_values(array_filter([$m->home_team, $m->away_team]));
                if ($event->name !== $name || array_values($event->departments ?? []) !== $departments) {
                    $event->update(['name' => $name, 'departments' => $departments]);
                }
                if ($m->status !== 'completed') {
                    $this->carryLineups($bracket, $m, $event, $linedUp);
                }
            }

            if (! $m->next_match_id && $m->status === 'completed' && $m->winner) {
                $champion = $m->winner;
            }
        }

        // "The match with no next match" is the final only in elimination.
        // In round-robin every fixture has no next match, so the loop above
        // would crown whoever won the first game played. A round-robin has a
        // champion only once every fixture is decided, and only if one team
        // has outright the most wins — a tie is left for the office to settle.
        if ($bracket->format === 'round_robin') {
            $champion = null;
            $playable = $matches->reject(fn ($m) => $m->is_bye);
            if ($playable->isNotEmpty() && $playable->every(fn ($m) => $m->status === 'completed')) {
                $wins = $playable->countBy('winner')->sortDesc()->values();
                $leader = $playable->countBy('winner')->sortDesc()->keys()->first();
                $champion = ($wins->count() === 1 || $wins[0] > $wins[1]) ? $leader : null;
            }
        }

        // Double elimination: the grand final decides it — game 1 when the
        // upper champion wins it (or there's no reset), else the reset.
        if ($bracket->format === 'double_elimination') {
            $champion = null;
            $gf = $this->grandFinal($matches);
            if ($gf && $gf->status === 'completed') {
                $champion = $reset && $this->resetNeeded($matches)
                    ? ($reset->status === 'completed' ? $reset->winner : null)
                    : $gf->winner;
            }
        }

        $bracket->update([
            'champion' => $champion,
            'status' => $champion ? 'completed' : ($bracket->status === 'draft' ? 'draft' : 'active'),
        ]);

        // The bracket's podium (champion / standings) is a leaderboard input —
        // any cached view for this sport/season is now stale.
        RankingController::forgetLeaderboardCacheFor($bracket->sport, $bracket->season_id);
    }

    // ── Helpers ────────────────────────────────────────────────────────

    /**
     * The matches with every match after the ones that feed it: by round and
     * slot (generation always gives a feeder an earlier round), walking a
     * match's sources first in case an edited row ever breaks that.
     *
     * @return array<int, BracketMatch>
     */
    private function inPlayOrder(Collection $matches): array
    {
        $ordered = [];
        $state = [];   // id => 'visiting' | 'done'
        $visit = function (BracketMatch $m) use (&$visit, &$ordered, &$state, $matches) {
            if (isset($state[$m->id])) {
                return;   // done, or a cycle in bad data — never loop
            }
            $state[$m->id] = 'visiting';
            foreach ([$m->home_source_match_id, $m->away_source_match_id] as $sourceId) {
                if ($sourceId && ($source = $matches->get($sourceId))) {
                    $visit($source);
                }
            }
            $state[$m->id] = 'done';
            $ordered[] = $m;
        };
        foreach ($matches->sortBy([['round', 'asc'], ['slot', 'asc']]) as $m) {
            $visit($m);
        }

        return $ordered;
    }

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

        $division = $bracket->settings['division'] ?? null;
        $sport = $division ? "{$division}'s {$bracket->sport}" : $bracket->sport;

        return "{$sport} ({$bm->stage_label}): {$home} vs {$away}";
    }
}
