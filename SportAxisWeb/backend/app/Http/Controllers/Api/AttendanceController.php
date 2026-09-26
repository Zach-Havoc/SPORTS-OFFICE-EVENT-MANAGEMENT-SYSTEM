<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Athlete;
use App\Models\AttendanceRecord;
use App\Models\AttendanceSession;
use App\Models\Event;
use App\Models\User;
use App\Services\ScheduleNotifier;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class AttendanceController extends Controller
{
    public function __construct(private ScheduleNotifier $notifier) {}

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
            ...self::TIME_RULES,
        ]);

        $coach = $request->user();
        $session = AttendanceSession::create([
            'id' => (string) Str::uuid(),
            'coach_id' => $coach->id,
            'title' => trim($data['title']),
            'date' => $data['date'],
            'start_time' => $data['startTime'] ?? null,
            'end_time' => $data['endTime'] ?? null,
            'venue_name' => $this->venueName($data),
            'created_by' => $coach->id,
        ]);
        $this->notifier->training($session, 'scheduled');

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
            ...self::TIME_RULES,
        ]);
        $before = [
            'date' => $session->date->toDateString(), 'start_time' => $session->start_time,
            'end_time' => $session->end_time, 'venue_name' => $session->venue_name,
        ];

        $changes = array_filter([
            'title' => isset($data['title']) ? trim($data['title']) : null,
            'date' => $data['date'] ?? null,
        ]);
        foreach (['startTime' => 'start_time', 'endTime' => 'end_time'] as $in => $col) {
            if (array_key_exists($in, $data)) {
                $changes[$col] = $data[$in];
            }
        }
        if (array_key_exists('venueName', $data)) {
            $changes['venue_name'] = $this->venueName($data);
        }
        $session->update($changes);
        $session->refresh();

        if ($change = $this->notifier->trainingChange($session, $before)) {
            $this->notifier->training($session, $change, $before);
        }

        $marked = AttendanceRecord::where('session_id', $id)->distinct('athlete_id')->count('athlete_id');

        return response()->json($this->sessionApi($session, $marked, $this->rosterIds($request->user())->count()));
    }

    public function deleteSession(Request $request, string $id)
    {
        $session = $this->ownedSession($request, $id);
        $this->notifier->training($session, 'cancelled');
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

    /**
     * POST /api/attendance/sessions/recurring — automated training scheduling.
     *
     * Generates one session on each chosen weekday between two dates (e.g.
     * "Training, Mon/Wed/Fri 4–6 PM at the Gym, for the next 8 weeks").
     * A date is skipped, and reported, when the coach already has a session
     * with that title that day or when a game is booked at the same venue
     * and time. The roster gets one notification for the whole schedule.
     */
    public function createRecurring(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string|max:120',
            'from' => 'required|date',
            'to' => 'required|date|after_or_equal:from|before_or_equal:'.Carbon::parse($request->input('from', 'today'))->addDays(180)->toDateString(),
            'weekdays' => 'required|array|min:1',
            'weekdays.*' => 'integer|between:0,6', // 0 = Sunday … 6 = Saturday
            ...self::TIME_RULES,
        ], ['to.before_or_equal' => 'A recurring schedule can span at most 180 days.']);

        $coach = $request->user();
        $title = trim($data['title']);
        $venue = $this->venueName($data);
        $weekdays = array_map('intval', $data['weekdays']);

        $created = collect();
        $skipped = [];
        for ($day = Carbon::parse($data['from']); $day->lte(Carbon::parse($data['to'])); $day->addDay()) {
            if (! in_array($day->dayOfWeek, $weekdays, true)) {
                continue;
            }
            $date = $day->toDateString();

            if (AttendanceSession::where('coach_id', $coach->id)->whereDate('date', $date)->where('title', $title)->exists()) {
                $skipped[] = ['date' => $date, 'reason' => 'You already have this session that day.'];

                continue;
            }
            if ($venue && ! empty($data['startTime']) && ! empty($data['endTime'])) {
                $clash = Event::venueConflicts(null, $venue, $date, $data['startTime'], $data['endTime'])->first();
                if ($clash) {
                    $skipped[] = ['date' => $date, 'reason' => "{$venue} is booked for {$clash->name} ({$clash->start_time}–{$clash->end_time})."];

                    continue;
                }
            }

            $created->push(AttendanceSession::create([
                'id' => (string) Str::uuid(),
                'coach_id' => $coach->id,
                'title' => $title,
                'date' => $date,
                'start_time' => $data['startTime'] ?? null,
                'end_time' => $data['endTime'] ?? null,
                'venue_name' => $venue,
                'created_by' => $coach->id,
            ]));
        }

        if ($created->isNotEmpty()) {
            $first = $created->first();
            $count = $created->count();
            $days = collect($weekdays)->sort()->map(fn ($d) => Carbon::create()->startOfWeek(Carbon::SUNDAY)->addDays($d)->format('D'))->implode('/');
            $this->notifier->send($this->notifier->roster($coach->id), new \App\Notifications\ScheduleChanged(
                'scheduled',
                "Training schedule: {$title}",
                array_values(array_filter([
                    "{$count} ".($count === 1 ? 'session' : 'sessions')." every {$days}, ".$first->date->format('M j').' to '.$created->last()->date->format('M j, Y'),
                    $first->start_time ? "Time: {$first->start_time}".($first->end_time ? "–{$first->end_time}" : '') : null,
                    'Venue: '.($venue ?: 'to be announced'),
                ])),
                '/athlete/schedule',
            ));
        }

        $rosterCount = $this->rosterIds($coach)->count();

        return response()->json([
            'created' => $created->map(fn ($s) => $this->sessionApi($s, 0, $rosterCount))->values(),
            'skipped' => $skipped,
        ], 201);
    }

    /**
     * GET /api/athlete/training — the signed-in athlete's upcoming training:
     * every future session of the coach (or coaches) they're rostered under.
     */
    public function athleteTraining(Request $request)
    {
        $user = $request->user();
        $coachIds = Athlete::where('user_id', $user->id)->pluck('coach_id')
            ->push($user->coach_id)->filter()->unique();

        $sessions = AttendanceSession::whereIn('coach_id', $coachIds)
            ->whereDate('date', '>=', Carbon::today())
            ->orderBy('date')->orderBy('start_time')
            ->limit(60)->get();
        $coaches = User::whereIn('id', $coachIds)->pluck('name', 'id');

        return response()->json($sessions->map(fn (AttendanceSession $s) => [
            'id' => $s->id,
            'title' => $s->title,
            'date' => $s->date->toDateString(),
            'startTime' => $s->start_time,
            'endTime' => $s->end_time,
            'venueName' => $s->venue_name,
            'coachName' => $coaches[$s->coach_id] ?? null,
        ])->values());
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    /** Optional time + venue accepted on every session write. */
    private const TIME_RULES = [
        'startTime' => 'sometimes|nullable|date_format:H:i',
        'endTime' => 'sometimes|nullable|date_format:H:i|after:startTime',
        'venueName' => 'sometimes|nullable|string|max:120',
    ];

    private function venueName(array $data): ?string
    {
        $v = trim((string) ($data['venueName'] ?? ''));

        return $v === '' ? null : $v;
    }

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
            'startTime' => $s->start_time,
            'endTime' => $s->end_time,
            'venueName' => $s->venue_name,
            'markedCount' => $markedCount,
            'rosterCount' => $rosterCount,
            'complete' => $rosterCount > 0 && $markedCount >= $rosterCount,
            'createdAt' => $s->created_at,
        ];
    }
}
