<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Score;
use App\Models\Event;
use App\Models\Ranking;
use App\Models\TeamMatch;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ScoreController extends Controller
{
    public function show(string $eventId)
    {
        $scores = Score::where('event_id', $eventId)->get();
        return response()->json($scores);
    }

    public function status(string $judgeId, Request $request)
    {
        $request->validate([
            'eventId' => 'required|string|exists:events,id',
        ]);

        $score = Score::where('judge_id', $judgeId)
            ->where('event_id', $request->eventId)
            ->first();

        return response()->json([
            'submitted' => (bool) $score,
            'eventId' => $request->eventId,
            'judgeId' => $judgeId,
            'score' => $score,
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'eventId'        => 'required|string|exists:events,id',
            'department'     => 'required|string',
            'judgeName'      => 'sometimes|string',
            'scores'         => 'required|array',
            'totalScore'     => 'required|numeric',
            'method'         => 'sometimes|in:manual,ocr',
            'image_url'      => 'sometimes|nullable|string',
            'submittedViaQr' => 'sometimes|boolean',
        ]);

        // Trust the authenticated token for the judge's identity — never the
        // request body. This prevents one judge (or a malicious client) from
        // submitting or overwriting scores on behalf of another judge and
        // rigging the event rankings.
        $judge = $request->user();

        $score = Score::updateOrCreate(
            [
                'event_id'   => $request->eventId,
                'department' => $request->department,
                'judge_id'   => $judge->id,
            ],
            [
                'id'               => Str::uuid(),
                'judge_name'       => $request->judgeName ?: $judge->name,
                'scores'           => $request->scores,
                'total_score'      => $request->totalScore,
                'submitted_via_qr' => $request->submittedViaQr ?? false,
                'method'           => $request->method ?? 'manual',
                'image_url'        => $request->image_url ?? null,
            ]
        );

        // Recalculate rankings for this event
        $this->recalculateRankings($request->eventId);

        return response()->json([
            'score'   => $score,
            'message' => 'Score submitted successfully.',
        ], 201);
    }

    public static function recalculateRankings(string $eventId): void
    {
        $scores = Score::where('event_id', $eventId)->get();
        if ($scores->isEmpty()) {
            Ranking::where('event_id', $eventId)->delete();
            return;
        }

        $byDept = $scores->groupBy('department')->map(function ($deptScores) {
            return [
                'total_score' => (float) $deptScores->avg('total_score'),
                'judge_count' => $deptScores->count(),
            ];
        });

        $sorted = $byDept->sortByDesc('total_score');

        Ranking::where('event_id', $eventId)->delete();

        $rank = 1;
        foreach ($sorted as $deptName => $data) {
            Ranking::create([
                'event_id'    => $eventId,
                'department'  => (string) $deptName,
                'total_score' => $data['total_score'],
                'judge_count' => $data['judge_count'],
                'rank'        => $rank,
            ]);
            $rank++;
        }

        self::syncTeamMatch($eventId, $sorted);
    }

    /**
     * When a scored event has exactly two departments, keep a head-to-head
     * `team_matches` record in sync so standings/seeding have a source of truth.
     * Multi-team (judged) events are left alone.
     */
    private static function syncTeamMatch(string $eventId, $sortedByDept): void
    {
        // Not a head-to-head (0/1 team scored, or a multi-team judged event):
        // drop any match that was derived at an earlier 2-team moment.
        if ($sortedByDept->count() !== 2) {
            TeamMatch::where('event_id', $eventId)->delete();

            return;
        }

        $event = Event::find($eventId);
        if (! $event) {
            return;
        }

        $entries = $sortedByDept
            ->map(fn ($data, $dept) => ['dept' => (string) $dept, 'score' => (float) $data['total_score']])
            ->values();

        [$a, $b] = [$entries[0], $entries[1]]; // already sorted highest score first

        $match = TeamMatch::firstOrNew(['event_id' => $eventId]);
        if (! $match->exists) {
            $match->id = (string) Str::uuid();
        }

        $match->fill([
            'sport'      => $event->category,
            'stage'      => $match->stage ?: 'elimination',
            'home_team'  => $a['dept'],
            'away_team'  => $b['dept'],
            'home_score' => $a['score'],
            'away_score' => $b['score'],
            'status'     => 'completed',
            'played_at'  => $match->played_at ?? now(),
        ]);
        $match->resolveOutcome();
        $match->save();
    }
}
