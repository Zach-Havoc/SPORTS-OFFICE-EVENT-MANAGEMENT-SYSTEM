<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\Ranking;
use App\Models\Score;
use App\Models\ScoreAmendment;
use App\Models\TeamMatch;
use App\Models\User;
use App\Notifications\ScoreDisputed;
use App\Services\BracketService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
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
            'eventId' => 'required|string|exists:events,id',
            'department' => 'required|string',
            'judgeName' => 'sometimes|string',
            'scores' => 'sometimes|nullable|array',
            'totalScore' => 'required|numeric|min:0|max:100',
            'method' => 'sometimes|in:manual,ocr',
            'image_url' => 'sometimes|nullable|string',
            'submittedViaQr' => 'sometimes|boolean',
        ]);

        // Trust the authenticated token for the judge's identity — never the
        // request body. This prevents one judge (or a malicious client) from
        // submitting or overwriting scores on behalf of another judge and
        // rigging the event rankings.
        $judge = $request->user();

        $score = Score::updateOrCreate(
            [
                'event_id' => $request->eventId,
                'department' => $request->department,
                'judge_id' => $judge->id,
            ],
            [
                'id' => Str::uuid(),
                'judge_name' => $request->judgeName ?: $judge->name,
                'scores' => $request->scores ?? [],
                'total_score' => $request->totalScore,
                'submitted_via_qr' => $request->submittedViaQr ?? false,
                'method' => $request->method ?? 'manual',
                'image_url' => $request->image_url ?? null,
                // A fresh submission supersedes any earlier dispute.
                'status' => 'verified',
                'dispute_reason' => null,
            ]
        );

        // Recalculate rankings for this event
        self::recalculateRankings($request->eventId);

        return response()->json([
            'score' => $score,
            'message' => 'Score submitted successfully.',
        ], 201);
    }

    /**
     * DELETE /api/scores/{id} — soft-delete one submitted score (admin).
     * The event's rankings are recomputed without it.
     */
    public function destroy(string $id)
    {
        $score = Score::findOrFail($id);
        $eventId = $score->event_id;

        $score->delete();
        self::recalculateRankings($eventId);

        return response()->json(['message' => 'Score removed']);
    }

    /** POST /api/scores/{id}/restore — bring a soft-deleted score back (admin). */
    public function restore(string $id)
    {
        $score = Score::onlyTrashed()->findOrFail($id);
        $score->restore();
        self::recalculateRankings($score->event_id);

        return response()->json(['score' => $score->fresh(), 'message' => 'Score restored']);
    }

    /** POST /api/scores/{id}/verify — clear a dispute; the score counts again. */
    public function verify(string $id)
    {
        $score = Score::findOrFail($id);
        $score->update([
            'status' => $score->status === 'official' ? 'official' : 'verified',
            'dispute_reason' => null,
            'verified_by' => request()->user()->id,
            'verified_at' => now(),
        ]);
        self::recalculateRankings($score->event_id);

        return response()->json(['score' => $score->fresh()]);
    }

    /** POST /api/scores/{id}/dispute {reason} — set the score aside pending review. */
    public function dispute(Request $request, string $id)
    {
        $data = $request->validate(['reason' => 'required|string|min:5|max:1000']);

        $score = Score::with('event')->findOrFail($id);
        $score->update(['status' => 'disputed', 'dispute_reason' => $data['reason']]);
        self::recalculateRankings($score->event_id);

        Notification::send(
            User::where('role', 'admin')->where('active', true)->get(),
            new ScoreDisputed($score->fresh(), $score->event?->name ?? 'an event'),
        );

        return response()->json(['score' => $score->fresh()]);
    }

    /**
     * POST /api/scores/{id}/amend {scores?, totalScore, reason} — correct a
     * score after the fact. The old and new values and the reason are kept in
     * `score_amendments`.
     */
    public function amend(Request $request, string $id)
    {
        $data = $request->validate([
            'scores' => 'sometimes|nullable|array',
            'totalScore' => 'required|numeric|min:0|max:100',
            'reason' => 'required|string|min:5|max:1000',
        ]);

        $score = Score::findOrFail($id);

        ScoreAmendment::create([
            'id' => (string) Str::uuid(),
            'score_id' => $score->id,
            'amended_by' => $request->user()->id,
            'old_scores' => $score->scores,
            'new_scores' => $data['scores'] ?? $score->scores,
            'old_total' => $score->total_score,
            'new_total' => $data['totalScore'],
            'reason' => $data['reason'],
        ]);

        $score->update([
            'scores' => $data['scores'] ?? $score->scores,
            'total_score' => $data['totalScore'],
        ]);
        self::recalculateRankings($score->event_id);

        return response()->json(['score' => $score->fresh(['amendments'])]);
    }

    /**
     * POST /api/events/{id}/officialize — lock in an event's verified scores as
     * the official result (admin). The leaderboard is unchanged.
     */
    public function officialize(string $eventId)
    {
        Event::findOrFail($eventId);

        $scores = Score::where('event_id', $eventId)->where('status', 'verified')->get();
        $scores->each(fn (Score $s) => $s->update(['status' => 'official']));
        self::recalculateRankings($eventId);

        return response()->json(['officialized' => $scores->count()]);
    }

    public static function recalculateRankings(string $eventId): void
    {
        // Only verified / official scores decide the table; a disputed score is
        // held out until it is checked and re-verified.
        $scores = Score::where('event_id', $eventId)
            ->whereIn('status', Score::COUNTING_STATUSES)
            ->get();
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
                'event_id' => $eventId,
                'department' => (string) $deptName,
                'total_score' => $data['total_score'],
                'judge_count' => $data['judge_count'],
                'rank' => $rank,
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
            'sport' => $event->category,
            'stage' => $match->stage ?: 'elimination',
            'home_team' => $a['dept'],
            'away_team' => $b['dept'],
            'home_score' => $a['score'],
            'away_score' => $b['score'],
            'status' => 'completed',
            'played_at' => $match->played_at ?? now(),
        ]);
        $match->resolveOutcome();
        $match->save();

        // If this event is a bracket match, feed the winner into the next round.
        app(BracketService::class)->advanceFromEvent($eventId);
    }
}
