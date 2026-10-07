<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Athlete;
use App\Models\CmoSubmission;
use App\Models\CmoSubmissionAthlete;
use App\Models\Requirement;
use App\Models\User;
use App\Notifications\CmoReviewed;
use App\Notifications\CmoSubmitted;
use App\Services\CmoClearance;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

/**
 * CMO documents, from the coach to the sports office.
 *
 * The coach reviews each athlete's documents (RequirementController), then
 * forwards the athletes whose required documents are all approved, in
 * batches. The office accepts each athlete or returns them with a note; a
 * returned athlete can be fixed and forwarded again.
 *
 *   GET  /api/cmo/roster              coach: their athletes, clearance and office status
 *   POST /api/cmo/submissions         coach: forward cleared athletes {athleteIds[], note?}
 *   GET  /api/cmo/overview            admin: every forwarded athlete (latest), for grouping
 *   GET  /api/cmo/athletes/{id}/documents   admin / their coach: an athlete's documents
 *   POST /api/cmo/review              admin: {entryIds[], status: accepted|returned, note?}
 */
class CmoSubmissionController extends Controller
{
    public function __construct(private CmoClearance $clearance) {}

    public function roster(Request $request)
    {
        $rows = $this->rosterOf($request->user());
        $clear = $this->clearance->for($rows->map(fn ($r) => ['id' => $r['id'], 'sport' => $r['sport']])->all());
        $latest = $this->latestEntries($rows->pluck('id')->all());

        return response()->json($rows->map(function ($r) use ($clear, $latest) {
            $entry = $latest->get($r['id']);

            return $r + [
                'cleared' => $clear[$r['id']]['cleared'],
                'requiredCount' => $clear[$r['id']]['required'],
                'approvedCount' => $clear[$r['id']]['approved'],
                'missing' => $clear[$r['id']]['missing'],
                'office' => $entry?->toApiFormat(),
            ];
        })->sortBy('name')->values());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'athleteIds' => 'required|array|min:1|max:200',
            'athleteIds.*' => 'string',
            'note' => 'sometimes|nullable|string|max:1000',
        ]);

        $coach = $request->user();
        $roster = $this->rosterOf($coach)->keyBy('id');
        $picked = collect($data['athleteIds'])->unique()->values();

        $notMine = $picked->reject(fn ($id) => $roster->has($id));
        if ($notMine->isNotEmpty()) {
            return $this->refuse('Some of those athletes are not on your roster.');
        }

        $clear = $this->clearance->for($picked->map(fn ($id) => ['id' => $id, 'sport' => $roster[$id]['sport']])->all());
        $notCleared = $picked->reject(fn ($id) => $clear[$id]['cleared']);
        if ($notCleared->isNotEmpty()) {
            return $this->refuse('Only athletes with every required document approved can be forwarded: '
                .$notCleared->map(fn ($id) => $roster[$id]['name'])->join(', ').'.');
        }

        // Waiting for the office, or already accepted: nothing to forward again.
        $latest = $this->latestEntries($picked->all());
        $inProgress = $picked->filter(fn ($id) => in_array($latest->get($id)?->status, ['submitted', 'accepted'], true));
        if ($inProgress->isNotEmpty()) {
            return $this->refuse('Already with the office: '.$inProgress->map(fn ($id) => $roster[$id]['name'])->join(', ').'.');
        }

        $submission = DB::transaction(function () use ($coach, $picked, $roster, $data) {
            $first = $roster[$picked[0]];
            $submission = CmoSubmission::create([
                'id' => (string) Str::uuid(),
                'coach_id' => $coach->id,
                'department' => $coach->department ?: $first['department'],
                'sport' => $first['sport'],
                'note' => $data['note'] ?? null,
                'submitted_at' => now(),
            ]);
            foreach ($picked as $id) {
                $a = $roster[$id];
                $submission->athletes()->create([
                    'athlete_id' => $id,
                    'athlete_name' => $a['name'],
                    'department' => $a['department'] ?: ($coach->department ?? 'Unknown'),
                    'sport' => $a['sport'],
                    'division' => $a['division'],
                    'status' => 'submitted',
                ]);
            }

            return $submission;
        });

        Notification::send(
            User::where('role', 'admin')->where('active', true)->get(),
            new CmoSubmitted($submission->loadCount('athletes')),
        );

        return response()->json([
            'id' => $submission->id,
            'count' => $picked->count(),
            'submittedAt' => $submission->submitted_at,
        ], 201);
    }

    public function overview()
    {
        $entries = CmoSubmissionAthlete::with(['submission.coach', 'reviewer'])
            ->orderByDesc('id')
            ->get()
            ->unique('athlete_id')
            ->values();

        return response()->json($entries->map->toApiFormat());
    }

    public function documents(Request $request, string $athleteId)
    {
        $user = $request->user();
        if ($user->role === 'coach' && ! $this->rosterOf($user)->contains('id', $athleteId)) {
            return response()->json(['error' => 'Not found'], 404);
        }

        $docs = Requirement::with('requirementType')
            ->where('athlete_id', $athleteId)
            ->orderByDesc('submitted_at')
            ->get()
            // A rejected document that was replaced is history, not a current document.
            ->unique(fn (Requirement $r) => $r->requirement_type_id ?? $r->id)
            ->values()
            ->map(fn (Requirement $r) => [
                'id' => $r->id,
                'type' => $r->requirementType?->name ?? $r->type,
                'name' => $r->name,
                'fileUrl' => $r->file_url,
                'status' => $r->status,
                'notes' => $r->notes,
                'submittedAt' => $r->submitted_at,
                'reviewedAt' => $r->reviewed_at,
            ]);

        return response()->json($docs);
    }

    public function review(Request $request)
    {
        $data = $request->validate([
            'entryIds' => 'required|array|min:1|max:500',
            'entryIds.*' => 'integer',
            'status' => 'required|in:accepted,returned',
            'note' => 'required_if:status,returned|nullable|string|max:1000',
        ]);

        $entries = CmoSubmissionAthlete::with('submission')
            ->whereIn('id', $data['entryIds'])
            ->where('status', 'submitted')
            ->get();
        if ($entries->isEmpty()) {
            return $this->refuse('Those athletes have already been decided.');
        }

        CmoSubmissionAthlete::whereIn('id', $entries->pluck('id'))->update([
            'status' => $data['status'],
            'office_note' => $data['note'] ?? null,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        // One notice per coach, naming their athletes.
        $entries->groupBy(fn ($e) => $e->submission->coach_id)->each(function (Collection $mine, $coachId) use ($data) {
            User::find($coachId)?->notify(new CmoReviewed(
                $data['status'],
                $mine->pluck('athlete_name')->all(),
                $data['note'] ?? null,
            ));
        });

        return response()->json(['updated' => $entries->count()]);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    /**
     * A coach's athletes: roster rows, plus legacy athlete accounts linked to
     * the coach directly. `id` is the key their requirements are filed under.
     *
     * @return Collection<int, array{id: string, name: string, department: ?string, sport: ?string, division: ?string}>
     */
    private function rosterOf(User $coach): Collection
    {
        $athletes = Athlete::with(['account:id,name', 'categoryRow:id,name'])->where('coach_id', $coach->id)->get();
        $linked = $athletes->pluck('user_id')->filter();

        $rows = $athletes->map(fn (Athlete $a) => [
            'id' => $a->id,
            'name' => $a->account?->name ?: trim("{$a->first_name} {$a->last_name}"),
            'department' => $a->department,
            'sport' => $a->sport,
            'division' => $a->categoryRow?->name,
        ]);

        $legacy = User::where('coach_id', $coach->id)->where('role', 'athlete')
            ->whereNotIn('id', $linked)
            ->get(['id', 'name', 'department', 'sport'])
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'department' => $u->department,
                'sport' => $u->sport,
                'division' => null,
            ]);

        return $rows->concat($legacy)->values();
    }

    /** Each athlete's latest CMO entry, keyed by athlete id. */
    private function latestEntries(array $athleteIds): Collection
    {
        return CmoSubmissionAthlete::with(['submission', 'reviewer'])
            ->whereIn('athlete_id', $athleteIds)
            ->orderByDesc('id')
            ->get()
            ->unique('athlete_id')
            ->keyBy('athlete_id');
    }

    private function refuse(string $message)
    {
        return response()->json(['error' => $message, 'message' => $message], 422);
    }
}
