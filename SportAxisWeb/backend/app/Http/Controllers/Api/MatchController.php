<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TeamMatch;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Head-to-head match records + the standings computed from them.
 *
 *   GET    /api/matches            (public; ?sport= filter)
 *   GET    /api/matches/{id}       (public)
 *   GET    /api/standings/{sport}  (public; the bracket-seeding source)
 *   POST   /api/matches            (admin)
 *   PUT    /api/matches/{id}       (admin)
 *   DELETE /api/matches/{id}       (admin)
 */
class MatchController extends Controller
{
    public function index(Request $request)
    {
        $query = TeamMatch::query()->orderByDesc('played_at')->orderByDesc('created_at');

        if ($request->filled('sport')) {
            $query->where('sport', $request->query('sport'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        return response()->json($query->get());
    }

    public function show(string $id)
    {
        return response()->json(TeamMatch::findOrFail($id));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'sport'      => 'required|string',
            'stage'      => 'sometimes|string',
            'eventId'    => 'sometimes|nullable|string',
            'homeTeam'   => 'required|string',
            'awayTeam'   => 'required|string|different:homeTeam',
            'homeScore'  => 'sometimes|nullable|numeric|min:0',
            'awayScore'  => 'sometimes|nullable|numeric|min:0',
            'status'     => 'sometimes|in:scheduled,completed,forfeit',
        ]);

        $match = new TeamMatch([
            'id'          => (string) Str::uuid(),
            'sport'       => $data['sport'],
            'stage'       => $data['stage'] ?? 'elimination',
            'event_id'    => $data['eventId'] ?? null,
            'home_team'   => $data['homeTeam'],
            'away_team'   => $data['awayTeam'],
            'home_score'  => $data['homeScore'] ?? null,
            'away_score'  => $data['awayScore'] ?? null,
            'status'      => $data['status'] ?? (isset($data['homeScore'], $data['awayScore']) ? 'completed' : 'scheduled'),
            'recorded_by' => $request->user()?->id,
        ]);

        if ($match->status !== 'scheduled') {
            $match->played_at = now();
        }
        $match->resolveOutcome();
        $match->save();

        return response()->json($match, 201);
    }

    public function update(Request $request, string $id)
    {
        $match = TeamMatch::findOrFail($id);

        $data = $request->validate([
            'stage'     => 'sometimes|string',
            'homeScore' => 'sometimes|nullable|numeric|min:0',
            'awayScore' => 'sometimes|nullable|numeric|min:0',
            'status'    => 'sometimes|in:scheduled,completed,forfeit',
        ]);

        if (array_key_exists('stage', $data)) $match->stage = $data['stage'];
        if (array_key_exists('homeScore', $data)) $match->home_score = $data['homeScore'];
        if (array_key_exists('awayScore', $data)) $match->away_score = $data['awayScore'];
        if (array_key_exists('status', $data)) $match->status = $data['status'];

        if ($match->status !== 'scheduled' && ! $match->played_at) {
            $match->played_at = now();
        }
        $match->resolveOutcome();
        $match->save();

        return response()->json($match->fresh());
    }

    public function destroy(string $id)
    {
        TeamMatch::findOrFail($id)->delete();

        return response()->json(['message' => 'Match deleted']);
    }

    /**
     * GET /api/standings/{sport}
     *
     * Aggregates completed matches into a standings table, ordered
     * wins ↓ → point differential ↓ → points scored ↓, with a head-to-head
     * tie-break for two-way ties. The `seed` field is what a bracket uses.
     */
    public function standings(string $sport)
    {
        $matches = TeamMatch::where('sport', $sport)
            ->whereIn('status', ['completed', 'forfeit'])
            ->get();

        $rows = [];

        $touch = function (string $team) use (&$rows) {
            $rows[$team] ??= [
                'department'     => $team,
                'played'         => 0,
                'wins'           => 0,
                'losses'         => 0,
                'draws'          => 0,
                'points_for'     => 0.0,
                'points_against' => 0.0,
            ];
        };

        foreach ($matches as $m) {
            $touch($m->home_team);
            $touch($m->away_team);

            $rows[$m->home_team]['played']++;
            $rows[$m->away_team]['played']++;

            $rows[$m->home_team]['points_for']     += (float) $m->home_score;
            $rows[$m->home_team]['points_against'] += (float) $m->away_score;
            $rows[$m->away_team]['points_for']     += (float) $m->away_score;
            $rows[$m->away_team]['points_against'] += (float) $m->home_score;

            if ($m->is_draw) {
                $rows[$m->home_team]['draws']++;
                $rows[$m->away_team]['draws']++;
            } elseif ($m->winner === $m->home_team) {
                $rows[$m->home_team]['wins']++;
                $rows[$m->away_team]['losses']++;
            } elseif ($m->winner === $m->away_team) {
                $rows[$m->away_team]['wins']++;
                $rows[$m->home_team]['losses']++;
            }
        }

        $table = collect($rows)->map(function ($r) {
            $r['point_diff'] = round($r['points_for'] - $r['points_against'], 2);
            $r['win_pct']    = $r['played'] ? round($r['wins'] / $r['played'], 3) : 0.0;

            return $r;
        })->values()->all();

        // Primary sort.
        usort($table, function ($a, $b) {
            return [$b['wins'], $b['point_diff'], $b['points_for']]
                <=> [$a['wins'], $a['point_diff'], $a['points_for']];
        });

        // Head-to-head tie-break for adjacent teams that are otherwise identical.
        for ($i = 0; $i < count($table) - 1; $i++) {
            $a = $table[$i];
            $b = $table[$i + 1];

            $tied = $a['wins'] === $b['wins']
                && $a['point_diff'] === $b['point_diff']
                && $a['points_for'] === $b['points_for'];

            if (! $tied) {
                continue;
            }

            $h2h = $matches->first(fn ($m) => ! $m->is_draw && (
                ($m->home_team === $a['department'] && $m->away_team === $b['department']) ||
                ($m->home_team === $b['department'] && $m->away_team === $a['department'])
            ));

            if ($h2h && $h2h->winner === $b['department']) {
                [$table[$i], $table[$i + 1]] = [$table[$i + 1], $table[$i]];
            }
        }

        foreach ($table as $i => &$row) {
            $row['seed'] = $i + 1;
        }

        return response()->json($table);
    }
}
