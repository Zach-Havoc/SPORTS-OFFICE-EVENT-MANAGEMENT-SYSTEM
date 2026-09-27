<?php

namespace Database\Seeders\Demo;

use App\Http\Controllers\Api\RankingController;
use App\Models\Bracket;
use App\Models\TeamMatch;
use App\Services\DemoData\DemoContext;
use Illuminate\Database\Seeder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Nothing is hardcoded: the standings and medals come from the results, via
 * the app's own leaderboard (the same one the Rankings page shows). This
 * warms that leaderboard and works out the overall college race for the
 * report — medals (1st Gold, 2nd Silver, 3rd Bronze), plus points per
 * finished bracket: 10 / 7 / 5 for the podium, 3 and 1 for 4th and 5th in
 * a round robin.
 */
class RankingSeeder extends Seeder
{
    private const POINTS = [10, 7, 5, 3, 1];

    public function run(DemoContext $ctx): void
    {
        $this->settleTies();
        Cache::flush();
        $leaderboard = app(RankingController::class)->leaderboard(Request::create('/api/rankings/leaderboard'))->getData(true);

        $points = [];
        foreach ($leaderboard as $row) {
            $points[$row['department']] = 10 * $row['gold'] + 7 * $row['silver'] + 5 * $row['bronze'];
        }

        // 4th and 5th of every fully played round robin that isn't a group stage.
        $withPlayoffs = Bracket::where('format', 'single_elimination')->pluck('sport')->flip();
        $champions = $divisionsCrowned = [];
        foreach (Bracket::with('matches')->get() as $bracket) {
            $done = $bracket->matches->reject->is_bye->every(fn ($m) => $m->status === 'completed');
            if ($bracket->format === 'round_robin' && $withPlayoffs->has($bracket->sport)) {
                continue;
            }
            if ($bracket->format === 'round_robin' && $done) {
                $standings = TeamMatch::standings($bracket->sport);
                foreach ([3, 4] as $place) {
                    if ($college = $standings[$place]['department'] ?? null) {
                        $points[$college] = ($points[$college] ?? 0) + self::POINTS[$place];
                    }
                }
                $champions[$bracket->name] = $standings[0]['department'] ?? null;
            } elseif ($bracket->champion) {
                $champions[$bracket->name] = $bracket->champion;
            }
            if ($done) {
                [$sport, $division] = DemoContext::parse($bracket->sport);
                $divisionsCrowned["{$sport}|{$division}"][] = true;
            }
        }

        $ctx->report['leaderboard'] = array_map(fn ($row) => [
            'college' => $ctx->abbr($row['department']),
            'gold' => $row['gold'], 'silver' => $row['silver'], 'bronze' => $row['bronze'],
            'points' => $points[$row['department']] ?? 0,
        ], $leaderboard);
        usort($ctx->report['leaderboard'], fn ($a, $b) => [$b['points'], $b['gold'], $b['silver']] <=> [$a['points'], $a['gold'], $a['silver']]);
        $ctx->report['champions'] = array_map(fn ($c) => $c ? $ctx->abbr($c) : null, $champions);

        // A division is crowned when every one of its brackets is decided
        // (Badminton and Table Tennis have three lines each).
        $crowned = 0;
        foreach (array_keys(DemoContext::SPORTS) as $sport) {
            foreach (['Men', 'Women'] as $division) {
                $total = Bracket::get()->filter(fn ($b) => DemoContext::parse($b->sport) === [$sport, $division]
                    && ! ($b->format === 'round_robin' && $withPlayoffs->has($b->sport)))->count();
                if ($total && count($divisionsCrowned["{$sport}|{$division}"] ?? []) >= $total) {
                    $crowned++;
                }
            }
        }
        $ctx->report['divisions_crowned'] = $crowned;
    }

    /**
     * A fully played round robin with two colleges level on wins has no
     * champion until the office settles it (BracketService leaves ties
     * open). The office goes by the standings' tiebreak — point
     * difference, then points scored.
     */
    private function settleTies(): void
    {
        $bracketed = Bracket::where('format', 'single_elimination')->pluck('sport')->flip();
        foreach (Bracket::with('matches')->where('format', 'round_robin')->whereNull('champion')->get() as $bracket) {
            if ($bracketed->has($bracket->sport) || $bracket->matches->contains(fn ($m) => $m->status !== 'completed')) {
                continue;
            }
            if ($leader = TeamMatch::standings($bracket->sport)[0]['department'] ?? null) {
                $bracket->update(['champion' => $leader, 'status' => 'completed']);
            }
        }
    }
}
