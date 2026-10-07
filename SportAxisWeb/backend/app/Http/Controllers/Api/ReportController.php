<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesSeason;
use App\Http\Controllers\Controller;
use App\Models\BracketMatch;
use App\Models\Department;
use App\Models\Event;
use App\Models\GameEvent;
use App\Models\LiveScore;
use App\Models\Protest;
use App\Models\Ranking;
use App\Models\Score;
use App\Models\Season;
use App\Models\TeamMatch;
use App\Models\User;
use App\Services\BasketballScoreboard;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Response;

/**
 * Office-grade output: a structured result for one event, plus CSV / printable
 * exports for an event sheet, every result of the season, the season
 * standings and medal tally, and champion certificates. Admin only.
 *
 * An event is decided one of two ways, and the report covers both:
 *   - a match (two colleges): the recorded result — final score, the
 *     set / game / board / quarter breakdown, the winner and the stage;
 *   - a judged event (many colleges): the judges' scores and the ranking.
 *
 * `format=csv` downloads a spreadsheet; `format=html` returns a self-contained
 * page styled for printing (the browser's Print dialog makes the PDF).
 */
class ReportController extends Controller
{
    use ResolvesSeason;

    private const ORG = 'BatStateU-TNEU ARASOF Sports Office';

    /** GET /api/reports/events/{eventId} — the full result, as JSON. */
    public function event(string $eventId)
    {
        return response()->json($this->eventResult($eventId));
    }

    /** GET /api/reports/events/{eventId}/export?format=csv|html */
    public function exportEvent(Request $request, string $eventId)
    {
        $r = $this->eventResult($eventId);
        $slug = str($r['event']['name'])->slug()->value() ?: 'event';

        if ($request->query('format') === 'html') {
            return $this->htmlPage("Result — {$r['event']['name']}", $this->eventResultHtml($r));
        }

        $e = $r['event'];
        $rows = [
            ['Event', $e['name']],
            ['Sport', $e['category']],
            ['Date', $e['schedule'] ?? ''],
            ['Venue', $e['venue'] ?? ''],
            ['Season', $e['season'] ?? ''],
        ];
        if ($m = $r['match']) {
            $rows[] = ['Stage', $m['stage'] ?? ''];
            $rows[] = [];
            $rows[] = array_merge(['College'], array_column($m['periods'], 'label'), ['Final']);
            foreach (['home', 'away'] as $side) {
                $rows[] = array_merge(
                    [$m[$side]],
                    array_map(fn ($p) => $p[$side], $m['periods']),
                    [$m[$side.'Score']],
                );
            }
            $rows[] = ['Winner', $m['isDraw'] ? 'Draw' : ($m['winner'] ?? '')];
        }
        if ($r['rankings']) {
            $rows[] = [];
            $rows[] = ['Rank', 'College', 'Total', 'Medal'];
            foreach ($r['rankings'] as $row) {
                $rows[] = [$row['rank'], $row['department'], $row['total'], $row['medal'] ?? ''];
            }
        }
        if ($r['scores']) {
            $rows[] = [];
            $rows[] = ['Judge', 'College', 'Score', 'Status'];
            foreach ($r['scores'] as $s) {
                $rows[] = [$s['judgeName'], $s['department'], $s['total'], $s['status']];
            }
        }

        return $this->csv("result-{$slug}.csv", $rows);
    }

    /**
     * GET /api/reports/results/export?format=csv|html&season=&sport=
     * Every finished event of the season in one document, grouped by sport:
     * each match's score and winner, each judged event's podium.
     */
    public function exportResults(Request $request)
    {
        $season = $this->seasonRow($request);
        $sport = trim((string) $request->query('sport', ''));
        $groups = $this->seasonResults($season, $sport);

        $title = 'Results'.($sport !== '' ? " — {$sport}" : '').($season ? " · {$season->name}" : '');

        if ($request->query('format') === 'html') {
            return $this->htmlPage($title, $this->resultsHtml($title, $groups));
        }

        $rows = [['Sport', 'Date', 'Stage', 'Event', 'Home', 'Home Score', 'Away Score', 'Away', 'Winner']];
        foreach ($groups as $sportName => $items) {
            foreach ($items as $it) {
                if ($it['match']) {
                    $m = $it['match'];
                    $rows[] = [$sportName, $it['date'], $m['stage'] ?? '', $it['name'], $m['home'], $m['homeScore'],
                        $m['awayScore'], $m['away'], $m['isDraw'] ? 'Draw' : ($m['winner'] ?? '')];
                } else {
                    $podium = implode(' / ', array_map(fn ($p) => "{$p['rank']}. {$p['department']}", $it['podium']));
                    $rows[] = [$sportName, $it['date'], '', $it['name'], '', '', '', '', $podium];
                }
            }
        }

        return $this->csv(str($title)->slug()->value().'.csv', $rows);
    }

    /** GET /api/reports/leaderboard/export?format=csv|html&season= */
    public function exportLeaderboard(Request $request)
    {
        $season = $this->seasonRow($request);
        $board = app(RankingController::class)->leaderboard($request)->getData(true);

        $title = 'College Standings'.($season ? " — {$season->name}" : '');

        if ($request->query('format') === 'html') {
            return $this->htmlPage($title, $this->leaderboardHtml($title, $board));
        }

        $rows = [['Rank', 'College', 'Total Points', 'Gold', 'Silver', 'Bronze', 'Events']];
        foreach ($board as $i => $row) {
            $rows[] = [
                $i + 1, $row['department'], $row['points'] ?? '',
                $row['gold'], $row['silver'], $row['bronze'], $row['eventCount'] ?? $row['event_count'] ?? 0,
            ];
        }

        return $this->csv('standings.csv', $rows);
    }

    /** GET /api/reports/certificates?season= — printable certificates for medaling colleges. */
    public function certificates(Request $request)
    {
        $season = $this->seasonRow($request);
        $board = app(RankingController::class)->leaderboard($request)->getData(true);
        $medalists = array_values(array_filter(
            $board,
            fn ($r) => ($r['gold'] ?? 0) + ($r['silver'] ?? 0) + ($r['bronze'] ?? 0) > 0,
        ));

        $title = 'Certificates'.($season ? " — {$season->name}" : '');

        return $this->htmlPage($title, $this->certificatesHtml($season?->name ?? 'Intramurals', $medalists), letterhead: false);
    }

    // ── Result assembly ───────────────────────────────────────────────────

    /** @return array<string, mixed> */
    private function eventResult(string $eventId): array
    {
        $event = Event::with(['season', 'categoryRow'])->findOrFail($eventId);
        $rankings = Ranking::where('event_id', $eventId)->orderBy('rank')->get();
        $medal = [1 => 'Gold', 2 => 'Silver', 3 => 'Bronze'];
        $colleges = array_values($event->departments ?? []);

        return [
            'event' => [
                'id' => $event->id,
                'name' => $event->name,
                'category' => $event->category,
                'format' => $event->categoryRow?->eventFormat() ?? (count($colleges) === 2 ? 'versus' : 'ranked'),
                'schedule' => $event->schedule ? substr((string) $event->schedule, 0, 10) : null,
                'startTime' => $event->start_time,
                'endTime' => $event->end_time,
                'venue' => $event->venue_name,
                'status' => $event->status,
                'season' => $event->season?->name,
                'departments' => $colleges,
                'officials' => collect($event->judges ?? [])->pluck('name')->filter()->values()->all(),
            ],
            'match' => $this->matchResult($event),
            'rankings' => $rankings->map(fn (Ranking $r) => [
                'rank' => $r->rank,
                'department' => $r->department,
                'total' => (float) $r->total_score,
                'medal' => $medal[$r->rank] ?? null,
            ])->all(),
            'scores' => Score::where('event_id', $eventId)->orderBy('department')->get()
                ->map(fn (Score $s) => [
                    'judgeName' => $s->judge_name,
                    'department' => $s->department,
                    'total' => (float) $s->total_score,
                    'status' => $s->status,
                    'disputeReason' => $s->dispute_reason,
                ])->all(),
            'protests' => Protest::where('event_id', $eventId)->get()
                ->map(fn (Protest $p) => [
                    'department' => $p->department,
                    'status' => $p->status,
                    'reason' => $p->reason,
                    'resolution' => $p->resolution,
                ])->all(),
            'generatedAt' => now()->toDateTimeString(),
        ];
    }

    /**
     * A match's result: the recorded one when there is one (team_matches),
     * else what the live board shows. Null when the event was never played
     * as a match.
     *
     * @return array<string, mixed>|null
     */
    private function matchResult(Event $event): ?array
    {
        $tm = TeamMatch::where('event_id', $event->id)->orderByDesc('played_at')->first();
        $live = LiveScore::where('event_id', $event->id)->first();
        if (! $tm && ! $live) {
            return null;
        }

        $colleges = array_values($event->departments ?? []);
        $home = $tm?->home_team ?? $live?->home_team ?? ($colleges[0] ?? 'Home');
        $away = $tm?->away_team ?? $live?->away_team ?? ($colleges[1] ?? 'Away');
        $homeScore = (float) ($tm ? $tm->home_score : $live->home_score);
        $awayScore = (float) ($tm ? $tm->away_score : $live->away_score);

        $state = $tm
            ? match ($tm->status) {
                'completed' => 'final', 'forfeit' => 'forfeit', default => 'scheduled'
            }
        : match ($live->status) {
            'final' => 'final', 'in_progress' => 'live', default => 'scheduled'
        };
        $decided = in_array($state, ['final', 'forfeit'], true);
        $isDraw = $tm ? (bool) $tm->is_draw : ($decided && $homeScore === $awayScore);
        $winner = $tm?->winner
            ?? ($decided && ! $isDraw ? ($homeScore > $awayScore ? $home : $away) : null);

        [$unit, $periods, $scorers] = $this->breakdown($event, $live);
        $recorder = $tm?->recorded_by ?? $live?->updated_by;

        return [
            'state' => $state,
            'home' => $home,
            'away' => $away,
            'homeScore' => $this->num($homeScore),
            'awayScore' => $this->num($awayScore),
            'winner' => $winner,
            'isDraw' => $isDraw,
            'stage' => BracketMatch::where('event_id', $event->id)->value('stage_label')
                ?? ($tm?->stage ? ucfirst($tm->stage) : null),
            'playedAt' => ($tm?->played_at ?? $live?->finalized_at)?->toDateTimeString(),
            'recordedBy' => $recorder ? User::whereKey($recorder)->value('name') : null,
            'periodUnit' => $unit,
            'periods' => $periods,
            'scorers' => $scorers,
        ];
    }

    /**
     * The score by set / game / board / quarter, and a basketball game's
     * leading scorers, from the live board or the play-by-play.
     *
     * @return array{0: ?string, 1: array<int, array{label: string, home: float|int, away: float|int}>, 2: array<string, array<int, array{name: string, jersey: ?string, points: int}>>}
     */
    private function breakdown(Event $event, ?LiveScore $live): array
    {
        $detail = is_array($live?->detail) ? $live->detail : [];

        if (! empty($detail['sets']) && is_array($detail['sets'])) {
            $unit = str_starts_with((string) $live->period, 'Game') ? 'Game' : 'Set';
            $periods = [];
            foreach (array_values($detail['sets']) as $i => $set) {
                $periods[] = ['label' => "{$unit} ".($i + 1), 'home' => $this->num($set[0] ?? 0), 'away' => $this->num($set[1] ?? 0)];
            }

            return [$unit, $periods, []];
        }

        if (! empty($detail['boards']) && is_array($detail['boards'])) {
            $periods = [];
            foreach (array_values($detail['boards']) as $i => $b) {
                $periods[] = ['label' => 'Board '.($i + 1), 'home' => $this->num((float) $b), 'away' => $this->num(1 - (float) $b)];
            }

            return ['Board', $periods, []];
        }

        if (GameEvent::where('game_id', $event->id)->exists()) {
            $board = app(BasketballScoreboard::class)->build($event);
            if (count($board['teams']) === 2) {
                [$h, $a] = $board['teams'];
                $periods = [];
                foreach ($h['periodScores'] as $i => $p) {
                    $periods[] = ['label' => $p['label'], 'home' => $p['points'], 'away' => $a['periodScores'][$i]['points'] ?? 0];
                }
                $top = fn (array $team) => collect($team['players'])
                    ->filter(fn ($pl) => $pl['pts'] > 0)
                    ->sortByDesc('pts')->take(3)
                    ->map(fn ($pl) => ['name' => $pl['name'], 'jersey' => $pl['jersey'], 'points' => $pl['pts']])
                    ->values()->all();

                return ['Quarter', $periods, ['home' => $top($h), 'away' => $top($a)]];
            }
        }

        return [null, [], []];
    }

    /**
     * Every finished event of the season, grouped by sport and in date order.
     *
     * @return array<string, array<int, array<string, mixed>>>
     */
    private function seasonResults(?Season $season, string $sport): array
    {
        $events = Event::query()
            ->when($season, fn ($q) => $q->where('season_id', $season->id))
            ->when($sport !== '', fn ($q) => $q->where(fn ($w) => $w->where('category', $sport)->orWhere('category', 'like', "{$sport} —%")))
            ->where('status', 'completed')
            ->orderBy('category')->orderBy('schedule')->orderBy('start_time')
            ->get(['id', 'name', 'category', 'schedule', 'departments']);

        $ids = $events->pluck('id');
        $matches = TeamMatch::whereIn('event_id', $ids)->orderByDesc('played_at')->get()->unique('event_id')->keyBy('event_id');
        $stages = BracketMatch::whereIn('event_id', $ids)->pluck('stage_label', 'event_id');
        $podiums = Ranking::whereIn('event_id', $ids)->where('rank', '<=', 3)->orderBy('rank')->get()->groupBy('event_id');

        $groups = [];
        foreach ($events as $e) {
            $tm = $matches->get($e->id);
            $podium = $podiums->get($e->id, new Collection);
            if (! $tm && $podium->isEmpty()) {
                continue;
            }
            $groups[$e->category][] = [
                'id' => $e->id,
                'name' => $e->name,
                'date' => $e->schedule ? substr((string) $e->schedule, 0, 10) : '',
                'match' => $tm ? [
                    'home' => $tm->home_team,
                    'away' => $tm->away_team,
                    'homeScore' => $this->num((float) $tm->home_score),
                    'awayScore' => $this->num((float) $tm->away_score),
                    'winner' => $tm->winner,
                    'isDraw' => (bool) $tm->is_draw,
                    'forfeit' => $tm->status === 'forfeit',
                    'stage' => $stages->get($e->id) ?? ($tm->stage ? ucfirst($tm->stage) : null),
                ] : null,
                'podium' => $podium->map(fn (Ranking $r) => ['rank' => $r->rank, 'department' => $r->department])->all(),
            ];
        }

        return $groups;
    }

    private function seasonRow(Request $request): ?Season
    {
        $id = $this->seasonScope($request);

        return $id ? Season::find($id) : null;
    }

    /** 3.0 → 3, 2.5 → 2.5 — scores read as people write them. */
    private function num(float $v): float|int
    {
        return floor($v) === $v ? (int) $v : round($v, 2);
    }

    // ── Response builders ────────────────────────────────────────────────

    /** @param  array<int, array<int, string|int|float|null>>  $rows */
    private function csv(string $filename, array $rows)
    {
        $handle = fopen('php://temp', 'r+');
        // A BOM so Excel opens the file as UTF-8 (college names carry "—").
        fwrite($handle, "\xEF\xBB\xBF");
        foreach ($rows as $row) {
            fputcsv($handle, $row);
        }
        rewind($handle);
        $body = stream_get_contents($handle);
        fclose($handle);

        return Response::make($body, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }

    private function htmlPage(string $title, string $inner, bool $letterhead = true)
    {
        $safeTitle = e($title);
        $org = e(self::ORG);
        $head = $letterhead
            ? "<header class=\"letterhead\"><div><div class=\"org\">{$org}</div><div class=\"sys\">SportsAxis · Official record</div></div><div class=\"stamp\">{$this->now()}</div></header>"
            : '';
        $html = <<<HTML
        <!doctype html><html lang="en"><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>{$safeTitle}</title>
        <style>
          @page{size:A4;margin:14mm 14mm 16mm}
          *{box-sizing:border-box}
          body{font:13px/1.5 Archivo,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0f172a;margin:0;background:#e2e8f0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
          .toolbar{position:sticky;top:0;display:flex;gap:12px;align-items:center;justify-content:space-between;padding:10px 16px;background:#0f172a;color:#e2e8f0;font-size:12px;z-index:1}
          .toolbar button{font:600 13px/1 inherit;padding:9px 16px;border:0;border-radius:8px;background:#c8102e;color:#fff;cursor:pointer}
          .sheet{max-width:820px;margin:24px auto;background:#fff;padding:40px 44px;box-shadow:0 1px 3px rgba(15,23,42,.12)}
          .letterhead{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;border-bottom:3px solid #c8102e;padding-bottom:10px;margin-bottom:22px}
          .org{font-weight:800;font-size:15px;letter-spacing:.02em;text-transform:uppercase}
          .sys,.stamp,.muted{color:#64748b;font-size:11.5px}
          .overline{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#c8102e;margin:0 0 4px}
          h1{font-size:21px;line-height:1.25;margin:0 0 14px} h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#334155;margin:26px 0 8px;padding-bottom:4px;border-bottom:1px solid #e2e8f0}
          .meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 28px;margin:0}
          .meta div{display:flex;gap:8px;min-width:0} .meta dt{color:#64748b;min-width:92px;flex:none} .meta dd{margin:0;font-weight:600;min-width:0}
          table{border-collapse:collapse;width:100%;margin-top:6px}
          th,td{border:1px solid #cbd5e1;padding:6px 9px;text-align:left;vertical-align:top}
          th{background:#f1f5f9;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
          td.n,th.n{text-align:center;font-variant-numeric:tabular-nums;white-space:nowrap} .nw{white-space:nowrap} abbr{text-decoration:none}
          tr.win td{font-weight:700} .tag{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:99px;background:#c8102e;color:#fff;font-size:10px;font-weight:700;letter-spacing:.06em;vertical-align:1px}
          .scoreline{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:18px;padding:18px 20px;border:1px solid #cbd5e1;border-radius:10px;margin-top:6px}
          .side{font-weight:700;font-size:14px} .side.away{text-align:right} .side.lose{color:#64748b;font-weight:600}
          .final{font-size:34px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}
          .verdict{margin:10px 0 0;font-weight:600}
          .sport{page-break-inside:auto} .sport h2{page-break-after:avoid}
          .empty{padding:14px;border:1px dashed #cbd5e1;border-radius:8px;color:#64748b}
          .sign{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;margin-top:48px;page-break-inside:avoid}
          .sign div{border-top:1px solid #0f172a;padding-top:6px;font-size:11.5px} .sign b{display:block;font-size:12px}
          .foot{margin-top:28px;color:#94a3b8;font-size:10.5px}
          .cert{border:3px double #c8102e;border-radius:12px;padding:56px 40px;margin:0 0 24px;text-align:center;page-break-inside:avoid;page-break-after:always}
          .cert:last-child{page-break-after:auto}
          .cert h3{font-size:24px;margin:0 0 6px;letter-spacing:.04em} .cert .big{font-size:30px;font-weight:800;color:#c8102e;margin:16px 0}
          @media (max-width:640px){.sheet{margin:0;padding:24px 18px}.meta{grid-template-columns:1fr}.final{font-size:26px}}
          @media print{body{background:#fff}.toolbar{display:none}.sheet{max-width:none;margin:0;padding:0;box-shadow:none}}
        </style></head><body>
        <div class="toolbar"><span>{$safeTitle}</span><button type="button" onclick="window.print()">Print / Save as PDF</button></div>
        <main class="sheet">{$head}{$inner}
        <p class="foot">Generated by SportsAxis on {$this->now()}. Results are official once confirmed by the Sports Office.</p>
        </main></body></html>
        HTML;

        return Response::make($html, 200, ['Content-Type' => 'text/html; charset=UTF-8']);
    }

    private function now(): string
    {
        return now()->format('M j, Y g:i A');
    }

    private function signatures(): string
    {
        return '<div class="sign">'
            .'<div><b>Prepared by</b>Sports Office staff</div>'
            .'<div><b>Checked by</b>Tournament committee</div>'
            .'<div><b>Approved by</b>Head, Sports Office</div>'
            .'</div>';
    }

    private function when(array $e): string
    {
        $date = $e['schedule'] ? date('F j, Y', strtotime($e['schedule'])) : '—';
        $time = trim(($e['startTime'] ?? '').(($e['endTime'] ?? '') ? '–'.$e['endTime'] : ''));

        return $time !== '' ? "{$date} · {$time}" : $date;
    }

    /** @param  array<string, mixed>  $r */
    private function eventResultHtml(array $r): string
    {
        $e = $r['event'];
        $m = $r['match'];

        $meta = [
            'Sport' => $e['category'],
            'Stage' => $m['stage'] ?? null,
            'Date' => $this->when($e),
            'Venue' => $e['venue'],
            'Season' => $e['season'],
            'Status' => ucfirst((string) $e['status']),
            'Recorded by' => $m['recordedBy'] ?? null,
            'Officials' => $e['officials'] ? implode(', ', $e['officials']) : null,
        ];
        if (! $m && $e['departments']) {
            $meta['Colleges'] = implode(', ', $e['departments']);
        }
        $metaHtml = '';
        foreach ($meta as $k => $v) {
            if ($v !== null && $v !== '') {
                $metaHtml .= '<div><dt>'.e($k).'</dt><dd>'.e((string) $v).'</dd></div>';
            }
        }

        $out = '<p class="overline">Official event result</p><h1>'.e($e['name']).'</h1><dl class="meta">'.$metaHtml.'</dl>';

        if ($m) {
            $out .= $this->matchHtml($m);
        } elseif ($e['format'] === 'versus' && ! $r['rankings']) {
            $out .= '<h2>Result</h2><p class="empty">No result has been recorded for this match yet.</p>';
        }

        if ($r['rankings']) {
            $rows = '';
            foreach ($r['rankings'] as $row) {
                $rows .= '<tr'.($row['rank'] === 1 ? ' class="win"' : '').'><td class="n">'.$row['rank'].'</td><td>'.e($row['department'])
                    .'</td><td class="n">'.$this->num($row['total']).'</td><td>'.e($row['medal'] ?? '').'</td></tr>';
            }
            $out .= '<h2>Final standing</h2><table><tr><th class="n">Rank</th><th>College</th><th class="n">Total</th><th>Medal</th></tr>'.$rows.'</table>';
        }

        if ($r['scores']) {
            $rows = '';
            foreach ($r['scores'] as $s) {
                $rows .= '<tr><td>'.e($s['judgeName']).'</td><td>'.e($s['department']).'</td><td class="n">'.$this->num($s['total'])
                    .'</td><td>'.e(ucfirst($s['status'])).($s['status'] === 'disputed' && $s['disputeReason'] ? ' — '.e($s['disputeReason']) : '').'</td></tr>';
            }
            $out .= '<h2>Judges\' scores</h2><table><tr><th>Judge</th><th>College</th><th class="n">Score</th><th>Status</th></tr>'.$rows.'</table>';
        } elseif (! $m && $e['format'] === 'ranked') {
            $out .= '<h2>Judges\' scores</h2><p class="empty">No scores have been submitted for this event yet.</p>';
        }

        if ($r['protests']) {
            $rows = '';
            foreach ($r['protests'] as $p) {
                $rows .= '<tr><td>'.e($p['department']).'</td><td>'.e(['open' => 'Under review', 'awaiting_counter' => 'Waiting for counter'][$p['status']] ?? ucfirst($p['status'])).'</td><td>'.e($p['reason'])
                    .'</td><td>'.e($p['resolution'] ?? '—').'</td></tr>';
            }
            $out .= '<h2>Protests</h2><table><tr><th>Filed by</th><th>Status</th><th>Reason</th><th>Resolution</th></tr>'.$rows.'</table>';
        }

        return $out.$this->signatures();
    }

    /** @param  array<string, mixed>  $m */
    private function matchHtml(array $m): string
    {
        $homeWon = $m['winner'] !== null && $m['winner'] === $m['home'];
        $awayWon = $m['winner'] !== null && $m['winner'] === $m['away'];
        $decided = in_array($m['state'], ['final', 'forfeit'], true);

        $out = '<h2>Result</h2><div class="scoreline">'
            .'<div class="side'.($awayWon ? ' lose' : '').'">'.e($m['home']).($homeWon ? '<span class="tag">WIN</span>' : '').'</div>'
            .'<div class="final">'.$m['homeScore'].' – '.$m['awayScore'].'</div>'
            .'<div class="side away'.($homeWon ? ' lose' : '').'">'.($awayWon ? '<span class="tag">WIN</span> ' : '').e($m['away']).'</div>'
            .'</div>';

        $verdict = match (true) {
            ! $decided => $m['state'] === 'live' ? 'In progress — this score is not final.' : 'Not played yet.',
            $m['isDraw'] => 'The match ended in a draw.',
            $m['state'] === 'forfeit' => e((string) $m['winner']).' won by forfeit.',
            default => e((string) $m['winner']).' won.',
        };
        $out .= '<p class="verdict">'.$verdict.($m['playedAt'] ? ' <span class="muted">Recorded '.e(date('M j, Y g:i A', strtotime($m['playedAt']))).'.</span>' : '').'</p>';

        if ($m['periods']) {
            $head = '';
            foreach ($m['periods'] as $p) {
                $head .= '<th class="n">'.e($p['label']).'</th>';
            }
            $row = function (string $side) use ($m) {
                $cells = '';
                foreach ($m['periods'] as $p) {
                    $cells .= '<td class="n">'.$p[$side].'</td>';
                }
                $won = $m['winner'] === $m[$side];

                return '<tr'.($won ? ' class="win"' : '').'><td>'.e($m[$side]).'</td>'.$cells.'<td class="n">'.$m[$side.'Score'].'</td></tr>';
            };
            $out .= '<h2>Score by '.strtolower((string) $m['periodUnit']).'</h2><table><tr><th>College</th>'.$head.'<th class="n">Final</th></tr>'
                .$row('home').$row('away').'</table>';
        }

        if (! empty($m['scorers']['home']) || ! empty($m['scorers']['away'])) {
            $rows = '';
            foreach (['home', 'away'] as $side) {
                foreach ($m['scorers'][$side] ?? [] as $pl) {
                    $rows .= '<tr><td>'.e($m[$side]).'</td><td class="n">'.e((string) $pl['jersey']).'</td><td>'.e($pl['name']).'</td><td class="n">'.$pl['points'].'</td></tr>';
                }
            }
            $out .= '<h2>Leading scorers</h2><table><tr><th>College</th><th class="n">No.</th><th>Player</th><th class="n">Pts</th></tr>'.$rows.'</table>';
        }

        return $out;
    }

    /** @param  array<string, array<int, array<string, mixed>>>  $groups */
    private function resultsHtml(string $title, array $groups): string
    {
        $count = array_sum(array_map('count', $groups));
        $out = '<p class="overline">Season results</p><h1>'.e($title).'</h1>'
            .'<p class="muted">'.$count.' finished '.($count === 1 ? 'event' : 'events').' in '.count($groups).' '.(count($groups) === 1 ? 'sport' : 'sports').'.</p>';

        if ($groups === []) {
            return $out.'<p class="empty">No finished events with a recorded result yet.</p>';
        }

        // Full college names wrap every row of a long table; use the
        // abbreviation, with a key at the end. (The CSV keeps full names.)
        $abbr = Department::whereNotNull('abbreviation')->pluck('abbreviation', 'name')->filter()->all();
        $used = [];
        $short = function (?string $name) use ($abbr, &$used) {
            if ($name === null || ! isset($abbr[$name])) {
                return e((string) $name);
            }
            $used[$abbr[$name]] = $name;

            return '<abbr title="'.e($name).'">'.e($abbr[$name]).'</abbr>';
        };

        foreach ($groups as $sport => $items) {
            $rows = '';
            foreach ($items as $it) {
                $date = $it['date'] ? date('M j', strtotime($it['date'])) : '—';
                if ($m = $it['match']) {
                    $result = $m['isDraw'] ? 'Draw' : $short($m['winner']).($m['forfeit'] ? ' (forfeit)' : '');
                    $rows .= '<tr><td class="n">'.$date.'</td><td class="nw">'.e((string) ($m['stage'] ?? '')).'</td><td>'.$short($m['home'])
                        .'</td><td class="n"><b>'.$m['homeScore'].' – '.$m['awayScore'].'</b></td><td>'.$short($m['away']).'</td><td>'.$result.'</td></tr>';
                } else {
                    $podium = implode('<br>', array_map(fn ($p) => $p['rank'].'. '.$short($p['department']), $it['podium']));
                    $rows .= '<tr><td class="n">'.$date.'</td><td colspan="4">'.e($it['name']).'</td><td>'.$podium.'</td></tr>';
                }
            }
            $out .= '<section class="sport"><h2>'.e($sport).'</h2><table><tr><th class="n">Date</th><th>Stage</th><th>Home</th><th class="n">Score</th><th>Away</th><th>Winner</th></tr>'
                .$rows.'</table></section>';
        }

        if ($used) {
            ksort($used);
            $out .= '<h2>Colleges</h2><p class="muted">'.implode(' · ', array_map(
                fn ($a, $n) => '<b>'.e($a).'</b> '.e($n), array_keys($used), $used,
            )).'</p>';
        }

        return $out.$this->signatures();
    }

    /** @param  array<int, array<string, mixed>>  $board */
    private function leaderboardHtml(string $title, array $board): string
    {
        // Olympic-style standings have no points column.
        $withPoints = collect($board)->contains(fn ($r) => ($r['points'] ?? null) !== null);
        $rows = '';
        foreach ($board as $i => $row) {
            $rows .= '<tr'.($i === 0 ? ' class="win"' : '').'><td class="n">'.($i + 1).'</td><td>'.e($row['department']).'</td>'
                .($withPoints ? '<td class="n">'.($row['points'] ?? 0).'</td>' : '')
                .'<td class="n">'.($row['gold'] ?? 0).'</td><td class="n">'.($row['silver'] ?? 0).'</td><td class="n">'
                .($row['bronze'] ?? 0).'</td><td class="n">'.($row['eventCount'] ?? $row['event_count'] ?? 0).'</td></tr>';
        }
        $totals = fn (string $k) => array_sum(array_map(fn ($r) => (int) ($r[$k] ?? 0), $board));

        $out = '<p class="overline">Overall standings</p><h1>'.e($title).'</h1>';
        if ($board === []) {
            return $out.'<p class="empty">No medals have been awarded yet.</p>';
        }

        return $out.'<table><tr><th class="n">Rank</th><th>College</th>'.($withPoints ? '<th class="n">Points</th>' : '')
            .'<th class="n">Gold</th><th class="n">Silver</th><th class="n">Bronze</th><th class="n">Events</th></tr>'
            .$rows.'<tr><td></td><td><b>Medals awarded</b></td>'.($withPoints ? '<td></td>' : '')
            .'<td class="n"><b>'.$totals('gold').'</b></td><td class="n"><b>'.$totals('silver').'</b></td><td class="n"><b>'.$totals('bronze').'</b></td><td></td></tr></table>'
            .$this->signatures();
    }

    /** @param  array<int, array<string, mixed>>  $medalists */
    private function certificatesHtml(string $seasonName, array $medalists): string
    {
        if ($medalists === []) {
            return '<h1>Certificates</h1><p class="empty">No medals have been awarded yet.</p>';
        }

        $out = '';
        foreach ($medalists as $i => $m) {
            $place = match ($i) {
                0 => 'Overall Champion',
                1 => 'First Runner-Up',
                2 => 'Second Runner-Up',
                default => 'Awardee',
            };
            $out .= '<div class="cert"><p class="overline">'.e(self::ORG).'</p><h3>Certificate of Recognition</h3>'
                .'<p class="muted">'.e($seasonName).'</p>'
                .'<div class="big">'.e($m['department']).'</div>'
                .'<p>is hereby recognized as <strong>'.$place.'</strong></p>'
                .'<p class="muted">'.($m['gold'] ?? 0).' gold · '.($m['silver'] ?? 0).' silver · '
                .($m['bronze'] ?? 0).' bronze'.(isset($m['points']) ? ' · '.$m['points'].' points' : '').'</p>'
                .$this->signatures().'</div>';
        }

        return $out;
    }
}
