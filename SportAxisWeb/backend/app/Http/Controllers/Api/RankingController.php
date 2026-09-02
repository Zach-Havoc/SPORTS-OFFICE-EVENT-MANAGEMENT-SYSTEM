<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bracket;
use App\Models\Category;
use App\Models\Ranking;
use App\Models\Score;
use App\Models\Event;
use App\Models\Department;
use App\Models\TeamMatch;
use Illuminate\Http\Request;

class RankingController extends Controller
{
    public function show(string $eventId)
    {
        if (Ranking::where('event_id', $eventId)->count() === 0 && Score::where('event_id', $eventId)->exists()) {
            ScoreController::recalculateRankings($eventId);
        }

        $rankings = Ranking::where('event_id', $eventId)->orderBy('rank')->get();
        return response()->json($rankings);
    }

    /**
     * The college medal table.
     *
     *   ranked sports (track, swimming, cultural) — each event's own top 3 is a
     *     gold / silver / bronze, and the judged scores sum into `total`.
     *   versus sports (basketball, volleyball …) — a single game is a win, not a
     *     medal. The medal is the sport's final podium: a completed
     *     single-elimination bracket (champion / finalist / both semi-final
     *     losers = joint bronze), or the standings top 3 of a fully-played
     *     round-robin. Per-game rankings never mint medals.
     */
    public function leaderboard(Request $request)
    {
        $category = $request->query('category');

        $events = Event::query()
            ->when($category, fn ($q) => $q->where('category', $category))
            ->get(['id', 'category']);
        $eventIds = $events->pluck('id');

        // format ('versus' | 'ranked') per event, via its sport
        $sportFormat = Category::whereIn('name', $events->pluck('category')->filter()->unique())
            ->pluck('format', 'name');
        $formatOf = fn (string $eventId) => $sportFormat[$events->firstWhere('id', $eventId)?->category] ?? 'versus';

        // Recalculate rankings for any events that have scores
        foreach (Score::whereIn('event_id', $eventIds)->pluck('event_id')->unique() as $eId) {
            ScoreController::recalculateRankings($eId);
        }

        $blank = fn (string $name) => [
            'department' => $name, 'total' => 0.0, 'event_count' => 0,
            'gold' => 0, 'silver' => 0, 'bronze' => 0,
        ];
        $rows = [];
        foreach (Department::pluck('name') as $name) {
            $rows[$name] = $blank($name);
        }
        $ensure = function (?string $name) use (&$rows, $blank) {
            if ($name && ! isset($rows[$name])) {
                $rows[$name] = $blank($name);
            }
        };

        // ── Ranked sports: the event's own placement is the medal ──────────
        $ranked = Ranking::whereIn('event_id', $eventIds)->get()
            ->filter(fn ($r) => $formatOf($r->event_id) !== 'versus');

        foreach ($ranked->groupBy('department') as $deptName => $deptRankings) {
            if (! $deptName) {
                continue;
            }
            $ensure($deptName);
            $rows[$deptName]['total']      += (float) $deptRankings->sum('total_score');
            $rows[$deptName]['event_count'] += $deptRankings->pluck('event_id')->unique()->count();
            $rows[$deptName]['gold']        += $deptRankings->where('rank', 1)->count();
            $rows[$deptName]['silver']      += $deptRankings->where('rank', 2)->count();
            $rows[$deptName]['bronze']      += $deptRankings->where('rank', 3)->count();
        }

        // ── Versus sports: the podium of the finished tournament ───────────
        $brackets = Bracket::query()
            ->when($category, fn ($q) => $q->where('sport', $category))
            ->with('matches')
            ->get();

        foreach ($brackets as $bracket) {
            $podium = $this->bracketPodium($bracket);
            if ($podium['gold']) {
                $ensure($podium['gold']);
                $rows[$podium['gold']]['gold']++;
                $rows[$podium['gold']]['event_count']++;
            }
            if ($podium['silver']) {
                $ensure($podium['silver']);
                $rows[$podium['silver']]['silver']++;
                $rows[$podium['silver']]['event_count']++;
            }
            foreach ($podium['bronze'] as $b) {
                $ensure($b);
                $rows[$b]['bronze']++;
                $rows[$b]['event_count']++;
            }
        }

        $leaderboard = array_values($rows);
        usort($leaderboard, fn ($a, $b) => [$b['total'], $b['gold'], $b['silver'], $b['bronze']]
            <=> [$a['total'], $a['gold'], $a['silver'], $a['bronze']]);

        return response()->json($leaderboard);
    }

    /**
     * The three medal slots for a tournament, or empty when it isn't finished.
     *
     * @return array{gold: ?string, silver: ?string, bronze: array<int, string>}
     */
    private function bracketPodium(Bracket $bracket): array
    {
        $empty = ['gold' => null, 'silver' => null, 'bronze' => []];

        if ($bracket->format === 'single_elimination') {
            if ($bracket->status !== 'completed' || ! $bracket->champion) {
                return $empty;
            }
            $matches  = $bracket->matches;
            $maxRound = (int) $matches->max('round');
            $final    = $matches->firstWhere('round', $maxRound);

            $silver = $final?->loser
                ?: ($final && $final->winner
                    ? ($final->winner === $final->home_team ? $final->away_team : $final->home_team)
                    : null);

            $bronze = $matches->where('round', $maxRound - 1)
                ->pluck('loser')->filter()->unique()->values()->all();

            return ['gold' => $bracket->champion, 'silver' => $silver, 'bronze' => $bronze];
        }

        if ($bracket->format === 'round_robin') {
            // Only once every game has been played.
            if ($bracket->matches->isEmpty() || $bracket->matches->contains(fn ($m) => $m->status !== 'completed')) {
                return $empty;
            }
            $standings = TeamMatch::standings($bracket->sport);
            return [
                'gold'   => $standings[0]['department'] ?? null,
                'silver' => $standings[1]['department'] ?? null,
                'bronze' => isset($standings[2]) ? [$standings[2]['department']] : [],
            ];
        }

        return $empty;
    }
}
