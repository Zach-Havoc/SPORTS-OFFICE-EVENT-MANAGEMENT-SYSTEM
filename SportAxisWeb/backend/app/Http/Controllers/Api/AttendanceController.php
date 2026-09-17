<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Athlete;
use App\Models\AttendanceRecord;
use App\Models\AttendanceSession;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class AttendanceController extends Controller
{
    /** Legacy sentinel for the old (pre-session) POST /attendance path. */
    private const TRAINING = 'training';

    // ── History (used by the per-athlete rate + the athlete's own view) ──────

    public function index(Request $request)
    {
        $user = $request->user();
        $query = AttendanceRecord::query()->with('session:id,title')->orderByDesc('date');

        if ($user->role === 'coach') {
            $query->whereIn('athlete_id', $this->rosterIds($user)->values());
        } elseif ($user->role === 'athlete') {
            $query->where('athlete_id', $this->athleteIdFor($user));
        }

        if ($request->filled('date')) {
            $query->whereDate('date', $request->query('date'));
        }
        if ($request->filled('from')) {
            $query->whereDate('date', '>=', $request->query('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('date', '<=', $request->query('to'));
        }

        return response()->json(
            $query->get()->map(function (AttendanceRecord $r) {
                $data = $r->toArray();
                $data['session_title'] = $r->session?->title ?? $r->session_label;
                unset($data['session']);

                return $data;
            })
        );
    }

    // ── Sessions ────────────────────────────────────────────────────────────

    public function sessions(Request $request)
    {
        $coach = $request->user();
        $rosterCount = $this->rosterIds($coach)->count();

        $sessions = AttendanceSession::where('coach_id', $coach->id)
            ->orderByDesc('date')->orderByDesc('created_at')->get();

        $marked = AttendanceRecord::whereIn('session_id', $sessions->pluck('id'))
            ->select('session_id')->selectRaw('COUNT(DISTINCT athlete_id) as c')
            ->groupBy('session_id')->pluck('c', 'session_id');

        return response()->json(
            $sessions->map(fn ($s) => $this->sessionApi($s, (int) ($marked[$s->id] ?? 0), $rosterCount))
        );
    }

    public function createSession(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string|max:120',
            'date' => 'required|date',
        ]);

        $coach = $request->user();
        $session = AttendanceSession::create([
            'id' => (string) Str::uuid(),
            'coach_id' => $coach->id,
            'title' => trim($data['title']),
            'date' => $data['date'],
            'created_by' => $coach->id,
        ]);

        return response()->json(
            $this->sessionApi($session, 0, $this->rosterIds($coach)->count()),
            201,
        );
    }

    public function updateSession(Request $request, string $id)
    {
        $session = $this->ownedSession($request, $id);

        $data = $request->validate([
            'title' => 'sometimes|required|string|max:120',
            'date' => 'sometimes|required|date',
        ]);
        if (isset($data['title'])) {
            $data['title'] = trim($data['title']);
        }
        $session->update($data);

        $marked = AttendanceRecord::where('session_id', $id)->distinct('athlete_id')->count('athlete_id');

        return response()->json($this->sessionApi($session, $marked, $this->rosterIds($request->user())->count()));
    }

    public function deleteSession(Request $request, string $id)
    {
        $session = $this->ownedSession($request, $id);
        AttendanceRecord::where('session_id', $id)->delete();
        $session->delete();

        return response()->json(['message' => 'Session deleted']);
    }

    public function showSession(Request $request, string $id)
    {
        $session = $this->ownedSession($request, $id);
        $records = AttendanceRecord::where('session_id', $id)->get();

        return response()->json([
            'session' => $this->sessionApi($session, $records->pluck('athlete_id')->unique()->count(), $this->rosterIds($request->user())->count()),
            'records' => $records,
        ]);
    }

    public function saveRecords(Request $request, string $id)
    {
        $session = $this->ownedSession($request, $id);
        $coach = $request->user();

        $request->validate([
            'records' => 'required|array',
            'records.*.athleteId' => 'required|string',
            'records.*.status' => 'required|in:present,absent,late,excused',
            'records.*.notes' => 'sometimes|nullable|string',
        ]);

        $roster = $this->rosterIds($coach)->flip();
        $saved = 0;
        $skipped = 0;

        foreach ($request->records as $rec) {
            if (! $roster->has($rec['athleteId'])) {
                $skipped++;

                continue;
            }
            AttendanceRecord::updateOrCreate(
                ['session_id' => $id, 'athlete_id' => $rec['athleteId']],
                [
                    'id' => (string) Str::uuid(),
                    'date' => $session->date->toDateString(),
                    'status' => $rec['status'],
                    'notes' => $rec['notes'] ?? null,
                    'recorded_by' => $coach->id,
                    'recorded_at' => now(),
                ]
            );
            $saved++;
        }

        $markedCount = AttendanceRecord::where('session_id', $id)->distinct('athlete_id')->count('athlete_id');

        return response()->json([
            'saved' => $saved,
            'skipped' => $skipped,
            'markedCount' => $markedCount,
            'rosterCount' => $roster->count(),
        ]);
    }

    // ── Legacy single-shot save (kept for back-compat) ──────────────────────

    public function store(Request $request)
    {
        $request->validate([
            'records' => 'required|array',
            'records.*.athleteId' => 'required|string',
            'records.*.date' => 'required|date',
            'records.*.status' => 'required|in:present,absent,late,excused',
            'records.*.eventId' => 'sometimes|nullable|string',
            'records.*.sessionLabel' => 'sometimes|nullable|string|max:80',
            'records.*.notes' => 'sometimes|nullable|string',
        ]);

        $user = $request->user();
        $roster = $this->rosterIds($user)->flip();

        $saved = [];
        $skipped = 0;

        foreach ($request->records as $rec) {
            if ($user->role === 'coach' && ! $roster->has($rec['athleteId'])) {
                $skipped++;

                continue;
            }

            $eventId = ($rec['eventId'] ?? null) ?: self::TRAINING;
            $isTraining = $eventId === self::TRAINING || str_starts_with($eventId, self::TRAINING.':');
            $label = $isTraining && ! empty($rec['sessionLabel']) ? trim($rec['sessionLabel']) : null;

            $record = AttendanceRecord::updateOrCreate(
                ['athlete_id' => $rec['athleteId'], 'date' => $rec['date'], 'event_id' => $eventId],
                [
                    'id' => (string) Str::uuid(),
                    'session_label' => $label,
                    'status' => $rec['status'],
                    'notes' => $rec['notes'] ?? null,
                    'recorded_by' => $user->id,
                    'recorded_at' => now(),
                ]
            );
            $saved[] = $record;
        }

        return response()->json(['saved' => count($saved), 'skipped' => $skipped, 'records' => $saved], 201);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    /** Athlete + self-registered-user ids on this coach's roster. */
    private function rosterIds(User $coach): Collection
    {
        return Athlete::where('coach_id', $coach->id)->pluck('id')
            ->merge(User::where('coach_id', $coach->id)->pluck('id'))
            ->unique();
    }

    /**
     * The id `attendance_records.athlete_id` is stored under for this caller.
     * Prefers the `user_id` link (authoritative); an email match is only a
     * fallback for legacy rows that were never linked.
     */
    private function athleteIdFor(User $user): string
    {
        $athlete = Athlete::where('user_id', $user->id)->first()
            ?? Athlete::whereNull('user_id')->where('email', $user->email)->first();

        return $athlete?->id ?? $user->id;
    }

    private function ownedSession(Request $request, string $id): AttendanceSession
    {
        return AttendanceSession::where('coach_id', $request->user()->id)->findOrFail($id);
    }

    private function sessionApi(AttendanceSession $s, int $markedCount, int $rosterCount): array
    {
        return [
            'id' => $s->id,
            'title' => $s->title,
            'date' => $s->date->toDateString(),
            'markedCount' => $markedCount,
            'rosterCount' => $rosterCount,
            'complete' => $rosterCount > 0 && $markedCount >= $rosterCount,
            'createdAt' => $s->created_at,
        ];
    }
}
