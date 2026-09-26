<?php

namespace App\Services;

use App\Models\Athlete;
use App\Models\AttendanceSession;
use App\Models\Category;
use App\Models\Event;
use App\Models\User;
use App\Notifications\ScheduleChanged;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

/**
 * Tells the people a game is for when it is scheduled, moved or cancelled.
 *
 * A game's audience, resolved by key like the team schedules are
 * (TeamScheduleController): coaches of a competing college who handle the
 * sport, athletes of a competing college rostered in it, and the committee
 * assigned to score it.
 */
class ScheduleNotifier
{
    /** Schedule fields whose change is worth telling people about. */
    public const WATCHED = ['schedule', 'start_time', 'end_time', 'venue_name'];

    /** @return Collection<int, User> */
    public function audience(Event $event): Collection
    {
        $users = collect();

        $judgeIds = collect($event->judges ?? [])->pluck('id')->filter();
        if ($judgeIds->isNotEmpty()) {
            $users = $users->merge(User::whereIn('id', $judgeIds)->get());
        }

        $departmentIds = DB::table('event_department')->where('event_id', $event->id)->pluck('department_id');
        $sportIds = collect([$event->category_id, Category::whereKey($event->category_id)->value('parent_id')])->filter();

        if ($departmentIds->isNotEmpty() && $sportIds->isNotEmpty()) {
            $users = $users
                ->merge(User::where('role', 'coach')
                    ->whereIn('department_id', $departmentIds)
                    ->whereHas('sportCategories', fn ($q) => $q->whereIn('categories.id', $sportIds))
                    ->get())
                ->merge(User::where('role', 'athlete')
                    ->whereIn('department_id', $departmentIds)
                    ->whereIn('id', Athlete::whereIn('category_id', $sportIds)->whereNotNull('user_id')->pluck('user_id'))
                    ->get());
        }

        return $users->unique('id')->values();
    }

    /** A new game was put on the schedule. */
    public function created(Event $event): void
    {
        // The committee already got the assignment email with the QR code.
        $judgeIds = collect($event->judges ?? [])->pluck('id');
        $audience = $this->audience($event)->reject(fn (User $u) => $judgeIds->contains($u->id));

        $this->send($audience, new ScheduleChanged(
            'scheduled',
            "New game scheduled: {$event->name}",
            [$this->when($event), $this->where($event)],
            '/',
        ));
    }

    /**
     * Compare the schedule before and after an edit and say what moved.
     *
     * @param  array<string, mixed>  $before  the WATCHED fields before the edit
     */
    public function updated(Event $event, array $before): void
    {
        $changed = collect(self::WATCHED)->filter(fn ($f) => (string) ($before[$f] ?? '') !== (string) ($event->{$f} ?? ''));
        if ($changed->isEmpty() || $event->status === 'completed') {
            return;
        }

        $movedDate = $changed->contains('schedule') || $changed->contains('start_time') || $changed->contains('end_time');
        $later = $movedDate && $this->startsAt($event->schedule, $event->start_time)
            ->greaterThan($this->startsAt($before['schedule'] ?? null, $before['start_time'] ?? null));

        [$change, $verb] = match (true) {
            $movedDate && $later => ['postponed', 'Postponed'],
            $movedDate => ['rescheduled', 'Rescheduled'],
            default => ['venue_changed', 'Venue changed'],
        };

        $details = [];
        if ($movedDate) {
            $details[] = 'Was: '.$this->when((object) ['schedule' => $before['schedule'] ?? null, 'start_time' => $before['start_time'] ?? null, 'end_time' => $before['end_time'] ?? null]);
            $details[] = 'Now: '.$this->when($event);
        } else {
            $details[] = $this->when($event);
        }
        $details[] = $changed->contains('venue_name')
            ? 'Venue: '.($event->venue_name ?: 'to be decided').' (was '.(($before['venue_name'] ?? null) ?: 'to be decided').')'
            : $this->where($event);

        $this->send($this->audience($event), new ScheduleChanged($change, "{$verb}: {$event->name}", $details, '/'));
    }

    /** A game was taken off the schedule. Call before deleting (the audience needs its links). */
    public function cancelled(Event $event): void
    {
        if ($event->status === 'completed') {
            return;
        }

        $this->send($this->audience($event), new ScheduleChanged(
            'cancelled',
            "Cancelled: {$event->name}",
            ['This game was taken off the schedule.', 'It was set for '.$this->when($event).'.'],
            '/',
        ));
    }

    /**
     * Many games at once (a published bracket): one notification per person
     * listing their games, not one per game.
     *
     * @param  iterable<Event>  $events
     */
    public function createdMany(iterable $events, string $label): void
    {
        $perUser = [];
        foreach ($events as $event) {
            foreach ($this->audience($event) as $user) {
                $perUser[$user->id]['user'] = $user;
                $perUser[$user->id]['lines'][] = "{$event->name} — ".$this->when($event);
            }
        }

        foreach ($perUser as ['user' => $user, 'lines' => $lines]) {
            $count = count($lines);
            $this->send(collect([$user]), new ScheduleChanged(
                'scheduled',
                "{$label}: {$count} ".($count === 1 ? 'game' : 'games').' scheduled',
                $lines,
                '/',
            ));
        }
    }

    /** Account holders on a coach's roster — the people a training session is for. */
    public function roster(string $coachId): Collection
    {
        return User::where('role', 'athlete')
            ->where(fn ($q) => $q->where('coach_id', $coachId)
                ->orWhereIn('id', Athlete::where('coach_id', $coachId)->whereNotNull('user_id')->pluck('user_id')))
            ->get();
    }

    /**
     * A training session changed. Past sessions are just attendance records,
     * so only upcoming ones are announced.
     *
     * @param  'scheduled'|'rescheduled'|'postponed'|'venue_changed'|'cancelled'  $change
     */
    public function training(AttendanceSession $s, string $change, ?array $before = null): void
    {
        if ($s->date->lt(Carbon::today())) {
            return;
        }

        $when = $this->when((object) ['schedule' => $s->date, 'start_time' => $s->start_time, 'end_time' => $s->end_time]);
        $details = match ($change) {
            'cancelled' => ["Training on {$when} was cancelled."],
            'scheduled' => [$when, 'Venue: '.($s->venue_name ?: 'to be announced')],
            default => array_values(array_filter([
                $before ? 'Was: '.$this->when((object) ['schedule' => $before['date'], 'start_time' => $before['start_time'] ?? null, 'end_time' => $before['end_time'] ?? null]) : null,
                'Now: '.$when,
                'Venue: '.($s->venue_name ?: 'to be announced'),
            ])),
        };
        $verb = ['scheduled' => 'Training scheduled', 'cancelled' => 'Training cancelled', 'postponed' => 'Training postponed',
            'venue_changed' => 'Training venue changed'][$change] ?? 'Training rescheduled';

        $this->send($this->roster($s->coach_id), new ScheduleChanged($change, "{$verb}: {$s->title}", $details, '/athlete/schedule'));
    }

    /** What an edit to a session amounts to, or null when nothing schedule-related moved. */
    public function trainingChange(AttendanceSession $s, array $before): ?string
    {
        $moved = (string) $before['date'] !== $s->date->toDateString()
            || ($before['start_time'] ?? null) !== $s->start_time || ($before['end_time'] ?? null) !== $s->end_time;
        if ($moved) {
            return $this->startsAt($s->date, $s->start_time)->greaterThan($this->startsAt($before['date'], $before['start_time'] ?? null))
                ? 'postponed' : 'rescheduled';
        }

        return ($before['venue_name'] ?? null) !== $s->venue_name ? 'venue_changed' : null;
    }

    /**
     * Deliver without ever failing the request that caused it: the schedule
     * change is saved either way, a mail outage just means fewer emails.
     *
     * @param  Collection<int, mixed>  $notifiables
     */
    public function send(Collection $notifiables, ScheduleChanged $notification): void
    {
        foreach ($notifiables as $notifiable) {
            try {
                Notification::send($notifiable, $notification);
            } catch (\Throwable $e) {
                Log::warning('Schedule notification failed: '.$e->getMessage());
            }
        }
    }

    private function when(object $e): string
    {
        $date = $e->schedule ? Carbon::parse($e->schedule)->format('D, M j, Y') : 'date to be decided';
        $time = $e->start_time ? ' · '.$e->start_time.($e->end_time ? '–'.$e->end_time : '') : '';

        return $date.$time;
    }

    private function where(Event $e): string
    {
        return 'Venue: '.($e->venue_name ?: 'to be decided');
    }

    private function startsAt(mixed $date, ?string $time): Carbon
    {
        $d = $date ? Carbon::parse($date)->startOfDay() : Carbon::createFromTimestamp(0);
        $minutes = Event::timeToMinutes($time) ?? 0;

        return $d->addMinutes($minutes);
    }
}
