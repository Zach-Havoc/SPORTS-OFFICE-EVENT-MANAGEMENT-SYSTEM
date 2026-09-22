<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesSeason;
use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\Protest;
use App\Models\Ranking;
use App\Models\Score;
use App\Models\Season;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Response;

/**
 * Office-grade output: a structured result for one event, plus CSV / printable
 * exports for an event sheet, the season standings and medal tally, and
 * champion certificates. Admin only.
 *
 * `format=csv` downloads a spreadsheet; `format=html` returns a self-contained
 * page styled for printing (the browser's Print dialog makes the PDF).
 */
class ReportController extends Controller
{
    use ResolvesSeason;

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

        $rows = [['Rank', 'College', 'Total', 'Medal']];
        foreach ($r['rankings'] as $row) {
            $rows[] = [$row['rank'], $row['department'], $row['total'], $row['medal'] ?? ''];
        }
        $rows[] = [];
        $rows[] = ['Judge', 'College', 'Score', 'Status'];
        foreach ($r['scores'] as $s) {
            $rows[] = [$s['judgeName'], $s['department'], $s['total'], $s['status']];
        }

        return $this->csv("result-{$slug}.csv", $rows);
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
                $i + 1, $row['department'], $row['total'],
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

        return $this->htmlPage($title, $this->certificatesHtml($season?->name ?? 'Intramurals', $medalists));
    }

    // ── Result assembly ───────────────────────────────────────────────────

    /** @return array<string, mixed> */
    private function eventResult(string $eventId): array
    {
        $event = Event::with('season')->findOrFail($eventId);
        $rankings = Ranking::where('event_id', $eventId)->orderBy('rank')->get();
        $medal = [1 => 'Gold', 2 => 'Silver', 3 => 'Bronze'];

        return [
            'event' => [
                'id' => $event->id,
                'name' => $event->name,
                'category' => $event->category,
                'schedule' => $event->schedule,
                'venue' => $event->venue_name,
                'status' => $event->status,
                'season' => $event->season?->name,
            ],
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

    private function seasonRow(Request $request): ?Season
    {
        $id = $this->seasonScope($request);

        return $id ? Season::find($id) : null;
    }

    // ── Response builders ────────────────────────────────────────────────

    /** @param  array<int, array<int, string|int|float>>  $rows */
    private function csv(string $filename, array $rows)
    {
        $handle = fopen('php://temp', 'r+');
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

    private function htmlPage(string $title, string $inner)
    {
        $safeTitle = e($title);
        $html = <<<HTML
        <!doctype html><html lang="en"><head><meta charset="utf-8">
        <title>{$safeTitle}</title>
        <style>
          *{box-sizing:border-box} body{font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;margin:0;padding:32px;background:#fff}
          h1{font-size:20px;margin:0 0 4px} h2{font-size:15px;margin:24px 0 8px}
          .muted{color:#64748b;font-size:12px}
          table{border-collapse:collapse;width:100%;margin-top:8px}
          th,td{border:1px solid #e2e8f0;padding:6px 10px;text-align:left}
          th{background:#f8fafc;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
          .cert{border:3px double #c8102e;border-radius:12px;padding:40px;margin:0 0 24px;text-align:center;page-break-inside:avoid}
          .cert h3{font-size:22px;margin:0 0 8px;letter-spacing:.02em} .cert .big{font-size:28px;font-weight:800;color:#c8102e;margin:12px 0}
          @media print{body{padding:0}.noprint{display:none}}
        </style></head><body>
        <button class="noprint" onclick="window.print()" style="float:right;padding:8px 14px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;cursor:pointer">Print / Save PDF</button>
        {$inner}
        <p class="muted" style="margin-top:32px">Generated by SportsAxis · {$this->now()}</p>
        </body></html>
        HTML;

        return Response::make($html, 200, ['Content-Type' => 'text/html; charset=UTF-8']);
    }

    private function now(): string
    {
        return now()->format('M j, Y g:i A');
    }

    /** @param  array<string, mixed>  $r */
    private function eventResultHtml(array $r): string
    {
        $e = $r['event'];
        $rankRows = '';
        foreach ($r['rankings'] as $row) {
            $rankRows .= '<tr><td>'.$row['rank'].'</td><td>'.e($row['department']).'</td><td>'.$row['total']
                .'</td><td>'.e($row['medal'] ?? '').'</td></tr>';
        }
        $scoreRows = '';
        foreach ($r['scores'] as $s) {
            $scoreRows .= '<tr><td>'.e($s['judgeName']).'</td><td>'.e($s['department']).'</td><td>'
                .$s['total'].'</td><td>'.e(ucfirst($s['status'])).'</td></tr>';
        }
        $protests = '';
        foreach ($r['protests'] as $p) {
            $protests .= '<li><strong>'.e($p['department']).'</strong> — '.e(ucfirst($p['status'])).': '
                .e($p['reason']).($p['resolution'] ? ' <em>('.e($p['resolution']).')</em>' : '').'</li>';
        }

        return '<h1>'.e($e['name']).'</h1>'
            .'<p class="muted">'.e($e['category']).' · '.e((string) $e['schedule']).' · '.e((string) $e['venue'])
            .' · '.e((string) $e['season']).'</p>'
            .'<h2>Final standing</h2><table><tr><th>Rank</th><th>College</th><th>Total</th><th>Medal</th></tr>'.$rankRows.'</table>'
            .'<h2>Score sheet</h2><table><tr><th>Judge</th><th>College</th><th>Score</th><th>Status</th></tr>'.$scoreRows.'</table>'
            .($protests ? '<h2>Protests</h2><ul>'.$protests.'</ul>' : '');
    }

    /** @param  array<int, array<string, mixed>>  $board */
    private function leaderboardHtml(string $title, array $board): string
    {
        $rows = '';
        foreach ($board as $i => $row) {
            $rows .= '<tr><td>'.($i + 1).'</td><td>'.e($row['department']).'</td><td>'.$row['total']
                .'</td><td>'.($row['gold'] ?? 0).'</td><td>'.($row['silver'] ?? 0).'</td><td>'
                .($row['bronze'] ?? 0).'</td></tr>';
        }

        return '<h1>'.e($title).'</h1>'
            .'<table><tr><th>Rank</th><th>College</th><th>Points</th><th>Gold</th><th>Silver</th><th>Bronze</th></tr>'
            .$rows.'</table>';
    }

    /** @param  array<int, array<string, mixed>>  $medalists */
    private function certificatesHtml(string $seasonName, array $medalists): string
    {
        if ($medalists === []) {
            return '<h1>Certificates</h1><p class="muted">No medals have been awarded yet.</p>';
        }

        $out = '';
        foreach ($medalists as $i => $m) {
            $place = match ($i) {
                0 => 'Overall Champion',
                1 => 'First Runner-Up',
                2 => 'Second Runner-Up',
                default => 'Awardee',
            };
            $out .= '<div class="cert"><h3>Certificate of Recognition</h3>'
                .'<p class="muted">'.e($seasonName).'</p>'
                .'<div class="big">'.e($m['department']).'</div>'
                .'<p>is hereby recognized as <strong>'.$place.'</strong></p>'
                .'<p class="muted">'.($m['gold'] ?? 0).' gold · '.($m['silver'] ?? 0).' silver · '
                .($m['bronze'] ?? 0).' bronze · '.$m['total'].' points</p></div>';
        }

        return $out;
    }
}
