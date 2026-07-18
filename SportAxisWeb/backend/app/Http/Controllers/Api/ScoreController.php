<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Score;
use App\Models\Event;
use App\Models\Ranking;
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
            'judgeId'        => 'required|string',
            'judgeName'      => 'required|string',
            'scores'         => 'required|array',
            'totalScore'     => 'required|numeric',
            'method'         => 'sometimes|in:manual,ocr',
            'image_url'      => 'sometimes|nullable|string',
            'submittedViaQr' => 'sometimes|boolean',
        ]);

        $score = Score::updateOrCreate(
            [
                'event_id'   => $request->eventId,
                'department' => $request->department,
                'judge_id'   => $request->judgeId,
            ],
            [
                'id'               => Str::uuid(),
                'judge_name'       => $request->judgeName,
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

    private function recalculateRankings(string $eventId): void
    {
        $scores = Score::where('event_id', $eventId)->get();

        $byDept = $scores->groupBy('department')->map(function ($deptScores) {
            return [
                'total_score' => $deptScores->avg('total_score'),
                'judge_count' => $deptScores->count(),
            ];
        });

        $sorted = $byDept->sortByDesc('total_score')->values();

        foreach ($sorted as $rank => $data) {
            Ranking::updateOrCreate(
                ['event_id' => $eventId, 'department' => $sorted->keys()[$rank]],
                [
                    'total_score' => $data['total_score'],
                    'judge_count' => $data['judge_count'],
                    'rank'        => $rank + 1,
                ]
            );
        }
    }
}
