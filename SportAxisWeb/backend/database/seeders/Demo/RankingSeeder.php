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
 * the app's own leaderboard (the same one the Rankings page shows) — ranked
 * and pointed the way Settings → Standings says (by default Gold 10, Silver
 * 7, Bronze 5). This settles tied round robins, warms that leaderboard and
 * reports the overall college race.
 */
class RankingSeeder extends Seeder
{
    public function run(DemoContext $ctx): void
    {
        $this->settleTies();
        Cache::flush();
        $leaderboard = app(RankingController::class)->leaderboard(Request::create('/api/rankings/leaderboard'))->getData(true);

        // Champions, and which divisions are fully decided.
        $withPlayoffs = Bracket::where('format', 'single_elimination')->pluck('sport')->flip();
        $champions = $divisionsCrowned = [];
        foreach (Bracket::with('matches')->get() as $bracket) {
            if ($bracket->format === 'round_robin' && $withPlayoffs->has($bracket->sport)) {
                continue;
            }
            if ($bracket->champion) {
                $champions[$bracket->name] = $bracket->champion;
            }
            if ($bracket->matches->reject->is_bye->every(fn ($m) => $m->status === 'completed')) {
                [$sport, $division] = DemoContext::parse($bracket->sport);
                $divisionsCrowned["{$sport}|{$division}"][] = true;
            }
        }

        $ctx->report['leaderboard'] = array_map(fn ($row) => [
            'college' => $ctx->abbr($row['department']),
            'gold' => $row['gold'], 'silver' => $row['silver'], 'bronze' => $row['bronze'],
            'points' => $row['points'] ?? '—',
        ], $leaderboard);
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
