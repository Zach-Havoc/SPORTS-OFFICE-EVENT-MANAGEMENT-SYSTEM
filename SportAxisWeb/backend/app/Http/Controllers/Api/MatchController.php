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
        return response()->json(TeamMatch::standings($sport));
    }
}
