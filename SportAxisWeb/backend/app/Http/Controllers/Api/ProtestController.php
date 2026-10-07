<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Event;
use App\Models\LiveScore;
use App\Models\Protest;
use App\Models\TeamMatch;
use App\Models\User;
use App\Notifications\ProtestCounterFiled;
use App\Notifications\ProtestCounterRequested;
use App\Notifications\ProtestFiled;
use App\Notifications\ProtestResolved;
use App\Services\PlayByPlay;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Protests (shown to users as appeals) about a game's outcome.
 *
 *   GET  /api/protests                 admin: all (?status= / ?season=); coach:
 *                                      their college's, and counters asked of it
 *   GET  /api/protests/eligible-games  coach: their games still open for a protest
 *   POST /api/protests                 coach files one (reason + formal form PDF)
 *                                      within 12 hours after the game
 *   POST /api/protests/{id}/request-counter  admin asks the other team for a counter
 *   POST /api/protests/{id}/counter    the other team's coach files it (reason +
 *                                      form PDF) within 12 hours of the request
 *   POST /api/protests/{id}/resolve    admin upholds or dismisses, with a note
 */
class ProtestController extends Controller
{
    private const FORM_RULE = 'required|file|mimes:pdf|max:10240';

    /** @var \Illuminate\Support\Collection<int, Department>|null loaded once per request */
    private $colleges = null;

    public function index(Request $request)
    {
        $user = $request->user();

        $query = Protest::query()->with(['event', 'filer', 'resolver', 'counterFiler'])->latest();

        if ($user->role === 'coach') {
            $query->where(function ($q) use ($user) {
                $q->where('filed_by', $user->id);
                if ($user->department) {
                    $q->orWhere('department', $user->department)
                        ->orWhere('counter_department', $user->department);
                }
            });
        } else {
            $query->when($request->query('status'), fn ($q, $s) => $q->where('status', $s))
                ->when($request->query('season'), fn ($q, $s) => $q->where('season_id', $s));
        }

        return response()->json($query->get()->map->toApiFormat());
    }

    /** The coach's games that have started and are still inside the 12-hour window. */
    public function eligibleGames(Request $request)
    {
        $user = $request->user();
        $now = now();

        $games = $this->collegeEvents($user)
            ->filter(fn (Event $e) => $this->hasStarted($e, $now) && $now->lessThanOrEqualTo($this->filingDeadline($e)))
            ->sortByDesc(fn (Event $e) => $this->gameEnd($e)->timestamp)
            ->values()
            ->map(fn (Event $e) => [
                'id' => $e->id,
                'name' => $e->name,
                'category' => $e->category,
                'schedule' => $e->schedule,
                'startTime' => $e->start_time,
                'status' => $e->status,
                'deadline' => $this->filingDeadline($e)->toIso8601String(),
            ]);

        return response()->json($games);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'eventId' => 'required|string|exists:events,id',
            'reason' => 'required|string|min:15|max:2000',
            'form' => self::FORM_RULE,
        ]);

        $user = $request->user();
        $event = Event::findOrFail($data['eventId']);
        $department = $user->department ?: 'Unknown';

        if (! $this->takesPart($event, $department)) {
            return $this->refuse('Only a college that played this game can protest it.');
        }
        if (! $this->hasStarted($event, now())) {
            return $this->refuse('This game has not started yet.');
        }
        $deadline = $this->filingDeadline($event);
        if (now()->greaterThan($deadline)) {
            return $this->refuse('The '.Protest::windowHours().'-hour protest window for this game closed on '.$this->local($deadline).'.');
        }
        if (Protest::where('event_id', $event->id)->where('department', $department)->whereIn('status', ['open', 'awaiting_counter'])->exists()) {
            return $this->refuse('Your college already has a protest under review for this game.');
        }

        $protest = Protest::create([
            'id' => (string) Str::uuid(),
            'event_id' => $event->id,
            'season_id' => $event->season_id,
            'filed_by' => $user->id,
            'department' => $department,
            'reason' => $data['reason'],
            'form_url' => $this->storeForm($request->file('form')),
            'status' => 'open',
        ]);

        Notification::send($this->admins(), new ProtestFiled($protest->fresh('event')));

        return response()->json($protest->fresh(['event', 'filer'])->toApiFormat(), 201);
    }

    public function requestCounter(Request $request, string $id)
    {
        $protest = Protest::with('event')->findOrFail($id);
        if ($protest->status !== 'open' || $protest->counter_requested_at) {
            return $this->refuse('A counter can only be asked for once, while the protest is open.');
        }

        $others = $this->otherColleges($protest);
        $data = $request->validate([
            'department' => 'sometimes|nullable|string|max:255',
        ]);
        $department = $data['department'] ?? (count($others) === 1 ? $others[0] : null);
        if (! $department || ! in_array($department, $others, true)) {
            return $this->refuse('Choose which college should file the counter.', ['colleges' => $others]);
        }

        $protest->update([
            'status' => 'awaiting_counter',
            'counter_department' => $department,
            'counter_requested_by' => $request->user()->id,
            'counter_requested_at' => now(),
            'counter_due_at' => now()->addHours(Protest::windowHours()),
        ]);

        Notification::send($this->coachesOf($department), new ProtestCounterRequested($protest->fresh('event')));

        return response()->json($protest->fresh(['event', 'filer', 'resolver', 'counterFiler'])->toApiFormat());
    }

    public function counter(Request $request, string $id)
    {
        $data = $request->validate([
            'reason' => 'required|string|min:15|max:2000',
            'form' => self::FORM_RULE,
        ]);

        $user = $request->user();
        $protest = Protest::with('event')->findOrFail($id);

        if ($protest->status !== 'awaiting_counter' || $protest->counter_filed_at) {
            return $this->refuse('This protest is not waiting for a counter.');
        }
        if (! $this->sameCollege($user->department, $protest->counter_department)) {
            return response()->json(['error' => 'Only '.$protest->counter_department.' can file this counter.'], 403);
        }
        if ($protest->counter_due_at->isPast()) {
            return $this->refuse('The '.Protest::windowHours().'-hour counter window closed on '.$this->local($protest->counter_due_at).'.');
        }

        $protest->update([
            'status' => 'open',
            'counter_reason' => $data['reason'],
            'counter_form_url' => $this->storeForm($request->file('form')),
            'counter_filed_by' => $user->id,
            'counter_filed_at' => now(),
        ]);

        Notification::send($this->admins(), new ProtestCounterFiled($protest->fresh('event')));

        return response()->json($protest->fresh(['event', 'filer', 'resolver', 'counterFiler'])->toApiFormat());
    }

    public function resolve(Request $request, string $id)
    {
        $data = $request->validate([
            'status' => 'required|in:upheld,dismissed',
            'resolution' => 'required|string|min:10|max:2000',
        ]);

        $protest = Protest::findOrFail($id);
        if (! in_array($protest->status, ['open', 'awaiting_counter'], true)) {
            return $this->refuse('This protest has already been decided.');
        }
        // While the other team's window is open, its counter is still due.
        if ($protest->status === 'awaiting_counter' && ! $protest->counterLapsed()) {
            return $this->refuse("Waiting for {$protest->counter_department}'s counter until {$this->local($protest->counter_due_at)}.");
        }

        $protest->update([
            'status' => $data['status'],
            'resolution' => $data['resolution'],
            'resolved_by' => $request->user()->id,
            'resolved_at' => now(),
        ]);

        $protest->loadMissing(['event', 'filer']);
        $protest->filer?->notify(new ProtestResolved($protest));

        return response()->json($protest->fresh(['event', 'filer', 'resolver', 'counterFiler'])->toApiFormat());
    }

    // ── Timing ─────────────────────────────────────────────────────────────

    /** A local date + time on the event (stored without a zone), in UTC. */
    private function localMoment(Event $event, ?string $time): Carbon
    {
        $tz = (string) config('sportaxis.local_timezone', 'Asia/Manila');
        $minutes = Event::timeToMinutes($time) ?? 0;

        return Carbon::parse(substr((string) $event->schedule, 0, 10), $tz)->startOfDay()->addMinutes($minutes)->utc();
    }

    private function hasStarted(Event $event, Carbon $now): bool
    {
        return $event->status !== 'upcoming' || $now->greaterThanOrEqualTo($this->localMoment($event, $event->start_time));
    }

    /**
     * When the game ended: its scheduled end, or, if its result was recorded
     * later (the game ran long), that moment.
     */
    private function gameEnd(Event $event): Carbon
    {
        $end = $this->localMoment($event, $event->end_time ?: ($event->start_time ?: '23:59'));
        $recorded = collect([
            LiveScore::where('event_id', $event->id)->value('finalized_at'),
            TeamMatch::where('event_id', $event->id)->max('played_at'),
        ])->filter()->map(fn ($t) => Carbon::parse($t))->max();

        return $recorded && $recorded->greaterThan($end) ? $recorded : $end;
    }

    private function filingDeadline(Event $event): Carbon
    {
        return $this->gameEnd($event)->copy()->addHours(Protest::windowHours());
    }

    private function local(Carbon $t): string
    {
        return $t->copy()->setTimezone((string) config('sportaxis.local_timezone', 'Asia/Manila'))->format('M j, g:i A');
    }

    // ── Colleges ───────────────────────────────────────────────────────────

    private function sameCollege(?string $a, ?string $b): bool
    {
        $key = fn (?string $v) => mb_strtolower(trim((string) $v));
        if ($key($a) === '' || $key($b) === '') {
            return false;
        }
        if ($key($a) === $key($b)) {
            return true;
        }
        $this->colleges ??= Department::all(['id', 'name', 'abbreviation']);
        $dept = $this->colleges->first(fn (Department $d) => PlayByPlay::isCollege($d, $a));

        return $dept !== null && PlayByPlay::isCollege($dept, $b);
    }

    private function takesPart(Event $event, string $department): bool
    {
        return collect($event->departments ?? [])->contains(fn ($d) => $this->sameCollege($d, $department));
    }

    /** The game's other colleges: who can be asked for a counter. */
    private function otherColleges(Protest $protest): array
    {
        return collect($protest->event?->departments ?? [])
            ->filter(fn ($d) => $d && ! $this->sameCollege($d, $protest->department))
            ->values()
            ->all();
    }

    /** The events a coach's college is in (by the college link, else by name). */
    private function collegeEvents(User $user)
    {
        if (! $user->department) {
            return collect();
        }
        $ids = $user->department_id
            ? DB::table('event_department')->where('department_id', $user->department_id)->pluck('event_id')
            : collect();

        return Event::query()
            ->where('status', '!=', 'upcoming')
            ->orWhere('schedule', '<=', now()->toDateString())
            ->get()
            ->filter(fn (Event $e) => $ids->contains($e->id) || $this->takesPart($e, $user->department));
    }

    private function coachesOf(string $department)
    {
        return User::where('role', 'coach')->where('active', true)->get()
            ->filter(fn (User $u) => $this->sameCollege($u->department, $department))
            ->values();
    }

    private function admins()
    {
        return User::where('role', 'admin')->where('active', true)->get();
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    /** A random, extension-controlled name: never the client's file name. */
    private function storeForm(UploadedFile $file): string
    {
        $path = $file->storeAs('protests', Str::uuid().'.pdf', 'public');

        return Storage::disk('public')->url($path);
    }

    private function refuse(string $message, array $extra = [])
    {
        return response()->json(['error' => $message, 'message' => $message] + $extra, 422);
    }
}
