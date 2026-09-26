<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\Paginates;
use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\Event;
use App\Models\TryoutApplication;
use App\Notifications\ScheduleChanged;
use App\Services\ScheduleNotifier;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AnnouncementController extends Controller
{
    use Paginates;

    public function index(Request $request)
    {
        $announcements = Announcement::orderByDesc('created_at')->paginate($this->perPage($request, 25));
        // Ensure is_tryout is always boolean (default to true for existing records)
        $announcements->getCollection()->each(function ($announcement) {
            if ($announcement->is_tryout === null) {
                $announcement->is_tryout = true;
            }
        });

        return response()->json($announcements);
    }

    public function store(Request $request)
    {
        $request->validate([
            'title' => 'required|string',
            'content' => 'required|string',
            'isTryout' => 'boolean',
            ...self::TRYOUT_RULES,
        ]);

        if ($clash = $this->venueClash($request)) {
            return response()->json(['error' => $clash], 422);
        }

        $user = $request->user();

        $ann = Announcement::create([
            'id' => Str::uuid(),
            'title' => $request->title,
            'content' => $request->content,
            'sport' => $request->sport,
            'coach_id' => $user->id,
            'coach_name' => $user->name,
            'is_tryout' => $request->has('isTryout') ? $request->isTryout : true,
            ...$this->tryoutFields($request),
        ]);

        return response()->json($ann, 201);
    }

    public function update(Request $request, string $id)
    {
        $ann = Announcement::findOrFail($id);

        // Only the coach who created it (or admin) can update
        if ($request->user()->role !== 'admin' && $ann->coach_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'content' => 'sometimes|required|string',
            'sport' => 'sometimes|nullable|string|max:100',
            'isTryout' => 'sometimes|boolean',
            ...self::TRYOUT_RULES,
        ]);

        if ($clash = $this->venueClash($request, $ann)) {
            return response()->json(['error' => $clash], 422);
        }

        $before = $ann->only(['tryout_date', 'tryout_start_time', 'tryout_end_time', 'tryout_venue']);
        $before['tryout_date'] = $ann->tryout_date?->toDateString();

        $data = $request->only('title', 'content', 'sport');
        if ($request->has('isTryout')) {
            $data['is_tryout'] = $request->isTryout;
        }
        $ann->update($data + $this->tryoutFields($request));
        $ann->refresh();

        $this->tellApplicants($ann, $before);

        return response()->json($ann);
    }

    private const TRYOUT_RULES = [
        'tryoutDate' => 'sometimes|nullable|date',
        'tryoutStartTime' => 'sometimes|nullable|date_format:H:i',
        'tryoutEndTime' => 'sometimes|nullable|date_format:H:i|after:tryoutStartTime',
        'tryoutVenue' => 'sometimes|nullable|string|max:120',
    ];

    /** @return array<string, mixed> only the tryout fields the request actually sent */
    private function tryoutFields(Request $request): array
    {
        $map = ['tryoutDate' => 'tryout_date', 'tryoutStartTime' => 'tryout_start_time',
            'tryoutEndTime' => 'tryout_end_time', 'tryoutVenue' => 'tryout_venue'];
        $out = [];
        foreach ($map as $in => $col) {
            if ($request->exists($in)) {
                $v = $request->input($in);
                $out[$col] = is_string($v) && trim($v) === '' ? null : $v;
            }
        }

        return $out;
    }

    /** A tryout can't take a venue a game is already using at that time. */
    private function venueClash(Request $request, ?Announcement $ann = null): ?string
    {
        $date = $request->exists('tryoutDate') ? $request->input('tryoutDate') : $ann?->tryout_date?->toDateString();
        $start = $request->exists('tryoutStartTime') ? $request->input('tryoutStartTime') : $ann?->tryout_start_time;
        $end = $request->exists('tryoutEndTime') ? $request->input('tryoutEndTime') : $ann?->tryout_end_time;
        $venue = $request->exists('tryoutVenue') ? $request->input('tryoutVenue') : $ann?->tryout_venue;

        $clash = ($date && $start && $end && $venue)
            ? Event::venueConflicts(null, $venue, $date, $start, $end)->first()
            : null;

        return $clash ? "{$venue} is booked for {$clash->name} ({$clash->start_time}–{$clash->end_time}) that day." : null;
    }

    /**
     * Email everyone still in the running when the tryout's date, time or
     * venue changes. Applicants have no accounts, so it is mail only.
     *
     * @param  array<string, mixed>  $before
     */
    private function tellApplicants(Announcement $ann, array $before): void
    {
        $now = [
            'tryout_date' => $ann->tryout_date?->toDateString(), 'tryout_start_time' => $ann->tryout_start_time,
            'tryout_end_time' => $ann->tryout_end_time, 'tryout_venue' => $ann->tryout_venue,
        ];
        if (! $ann->is_tryout || ! $now['tryout_date'] || $now == $before) {
            return;
        }
        if (Carbon::parse($now['tryout_date'])->lt(Carbon::today())) {
            return;
        }

        $fmt = fn (array $s) => ($s['tryout_date'] ? Carbon::parse($s['tryout_date'])->format('D, M j, Y') : 'date to be announced')
            .($s['tryout_start_time'] ? ' · '.$s['tryout_start_time'].($s['tryout_end_time'] ? '–'.$s['tryout_end_time'] : '') : '')
            .' · '.($s['tryout_venue'] ?: 'venue to be announced');

        $emails = TryoutApplication::where('announcement_id', $ann->id)
            ->whereIn('status', ['pending', 'accepted'])->pluck('email')->unique();

        $notification = new ScheduleChanged(
            'rescheduled',
            "Tryout schedule updated: {$ann->title}",
            array_values(array_filter([$before['tryout_date'] ? 'Was: '.$fmt($before) : null, 'Now: '.$fmt($now)])),
            '/announcements',
        );
        app(ScheduleNotifier::class)->send(
            $emails->map(fn ($email) => Notification::route('mail', $email)),
            $notification,
        );
    }

    public function destroy(Request $request, string $id)
    {
        $ann = Announcement::findOrFail($id);

        if ($request->user()->role !== 'admin' && $ann->coach_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $ann->delete();

        return response()->json(['message' => 'Announcement deleted']);
    }

    /** POST /api/announcements/{id}/restore — the admin or the owning coach. */
    public function restore(Request $request, string $id)
    {
        $ann = Announcement::onlyTrashed()->findOrFail($id);

        if ($request->user()->role !== 'admin' && $ann->coach_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $ann->restore();

        return response()->json($ann->fresh());
    }
}
