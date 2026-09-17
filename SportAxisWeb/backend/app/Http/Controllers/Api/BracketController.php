<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesSeason;
use App\Http\Controllers\Controller;
use App\Models\Bracket;
use App\Models\BracketMatch;
use App\Models\Category;
use App\Models\Department;
use App\Models\DisciplineEntry;
use App\Models\Event;
use App\Models\TeamMatch;
use App\Services\BracketService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Persisted brackets + progression.
 *
 *   GET    /api/brackets                              (public; ?sport= filter)
 *   GET    /api/brackets/{id}                         (public; full tree)
 *   POST   /api/brackets                              (admin; generate + persist)
 *   POST   /api/brackets/{id}/publish                 (admin; create the Events)
 *   POST   /api/brackets/{id}/matches/{mid}/advance   (admin; record a winner)
 *   DELETE /api/brackets/{id}?withEvents=1            (admin)
 */
class BracketController extends Controller
{
    use ResolvesSeason;

    public function __construct(private BracketService $brackets) {}

    public function index(Request $request)
    {
        $query = Bracket::withCount('matches')->orderByDesc('created_at');
        if ($request->filled('sport')) {
            $query->where('sport', $request->query('sport'));
        }
        if ($seasonId = $this->seasonScope($request)) {
            $query->where('season_id', $seasonId);
        }

        return response()->json(
            $query->get()->map(fn ($b) => [
                'id' => $b->id,
                'sport' => $b->sport,
                'format' => $b->format,
                'name' => $b->name,
                'status' => $b->status,
                'seeded' => $b->seeded,
                'champion' => $b->champion,
                'matchCount' => $b->matches_count,
                'createdAt' => $b->created_at,
            ])
        );
    }

    public function show(string $id)
    {
        $bracket = Bracket::with('matches')->findOrFail($id);
        $data = $bracket->toApiFormat();

        // Attach the actual scored result for each match (from team_matches,
        // keyed by the backing event) so the page can show "CICS 78–65 CET".
        $results = TeamMatch::whereIn('event_id', $bracket->matches->pluck('event_id')->filter())
            ->get()->keyBy('event_id');

        // For a racquet discipline ("Badminton — M Doubles" …) the bracket still
        // pits colleges against each other, but each side is shown as the
        // assigned athlete + college abbreviation, e.g. "Santos (CET)".
        $label = $this->disciplineLabeller($bracket->sport);

        $data['matches'] = collect($data['matches'])->map(function ($m) use ($results, $label) {
            $tm = $m['eventId'] ? ($results[$m['eventId']] ?? null) : null;
            $m['homeScore'] = null;
            $m['awayScore'] = null;
            $m['scored'] = false;
            $m['homeLabel'] = $label($m['homeTeam']);
            $m['awayLabel'] = $label($m['awayTeam']);

            if ($tm && $tm->home_score !== null) {
                // team_matches may order the two sides differently — align by name.
                if ($tm->home_team === $m['homeTeam']) {
                    [$m['homeScore'], $m['awayScore']] = [(float) $tm->home_score, (float) $tm->away_score];
                } elseif ($tm->home_team === $m['awayTeam']) {
                    [$m['homeScore'], $m['awayScore']] = [(float) $tm->away_score, (float) $tm->home_score];
                }
                $m['scored'] = $tm->status !== 'scheduled';
            }

            return $m;
        })->values();

        return response()->json($data);
    }

    /**
     * Build a closure that turns a college name into its racquet-line display
     * label ("Santos (CET)" / "Santos / Dela Cruz (CET)"). Returns a closure
     * that yields null for every team when the bracket isn't a discipline, so
     * the client keeps showing the plain college name.
     */
    private function disciplineLabeller(string $sport): \Closure
    {
        $category = Category::where('name', $sport)->first();
        if (! $category || ! $category->isDiscipline()) {
            return fn ($team) => null;
        }

        $slot = $category->lineSlot();                          // 'A' | 'B' | 'CD'
        $abbrs = Department::pluck('abbreviation', 'name');
        $byDept = DisciplineEntry::where('category', $sport)->get()->groupBy('department');

        return function (?string $team) use ($slot, $abbrs, $byDept) {
            if (! $team || in_array($team, ['TBD', 'BYE'], true)) {
                return null;
            }
            $abbr = $abbrs[$team] ?? $team;
            $entries = $byDept[$team] ?? collect();

            if ($slot === 'CD') {
                $names = collect(['C', 'D'])
                    ->map(fn ($s) => optional($entries->firstWhere('pair_slot', $s))->athlete_name)
                    ->filter()
                    ->values();
                if ($names->isEmpty()) {
                    $names = $entries->pluck('athlete_name')->filter()->values();
                }

                return $names->isEmpty() ? $abbr : $names->implode(' / ')." ({$abbr})";
            }

            $name = optional($entries->first())->athlete_name;

            return $name ? "{$name} ({$abbr})" : $abbr;
        };
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'sport' => 'required|string|max:100',
            'format' => ['required', Rule::in(['single_elimination', 'round_robin'])],
            'participants' => 'required|array|min:2',
            'participants.*' => 'string',
            'drawMethod' => ['sometimes', Rule::in(['random', 'standings', 'manual'])],
            'seedFromStandings' => 'sometimes|boolean', // legacy alias for drawMethod=standings
            'startDate' => 'required|date',
            'startTime' => 'required|string',
            'matchDuration' => 'sometimes|integer|min:5|max:600',
            'breakDuration' => 'sometimes|integer|min:0|max:600',
            'venueId' => 'sometimes|nullable|string|exists:venues,id',
        ]);

        $bracket = $this->brackets->generate($data, $request->user()->id);

        return response()->json($bracket->toApiFormat(), 201);
    }

    public function publish(string $id)
    {
        $bracket = Bracket::with('matches')->findOrFail($id);

        $result = $this->brackets->publish($bracket);
        if (! empty($result['conflicts'])) {
            return response()->json([
                'error' => 'Venue already scheduled for one or more matches.',
                'conflicts' => $result['conflicts'],
            ], 422);
        }

        return response()->json($bracket->fresh('matches')->toApiFormat());
    }

    public function advance(Request $request, string $id, string $matchId)
    {
        $data = $request->validate([
            'winner' => 'sometimes|nullable|string',
        ]);

        $bracket = Bracket::findOrFail($id);
        $bm = BracketMatch::where('bracket_id', $bracket->id)->findOrFail($matchId);

        $this->brackets->advance($bm, $data['winner'] ?? null, $request->boolean('force'));

        return response()->json($bracket->fresh('matches')->toApiFormat());
    }

    public function destroy(Request $request, string $id)
    {
        $bracket = Bracket::with('matches')->findOrFail($id);

        if ($request->boolean('withEvents')) {
            $eventIds = $bracket->matches->pluck('event_id')->filter()->all();
            Event::whereIn('id', $eventIds)->get()->each->delete();
        }

        // The bracket is soft-deleted; its `bracket_matches` tree is left in
        // place (the CASCADE only fires on a hard delete) so restore() brings
        // the whole bracket back.
        $bracket->delete();

        return response()->json(['message' => 'Bracket deleted']);
    }

    /**
     * POST /api/brackets/{id}/restore — bring a soft-deleted bracket back.
     * With `?withEvents=1`, also restore the linked events that were removed
     * alongside it.
     */
    public function restore(Request $request, string $id)
    {
        $bracket = Bracket::onlyTrashed()->with('matches')->findOrFail($id);
        $bracket->restore();

        if ($request->boolean('withEvents')) {
            $eventIds = $bracket->matches->pluck('event_id')->filter()->all();
            Event::onlyTrashed()->whereIn('id', $eventIds)->get()->each->restore();
        }

        return response()->json($bracket->fresh('matches')->toApiFormat());
    }
}
