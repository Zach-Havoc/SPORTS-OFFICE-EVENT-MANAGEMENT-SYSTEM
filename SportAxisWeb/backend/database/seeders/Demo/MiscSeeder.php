<?php

namespace Database\Seeders\Demo;

use App\Models\Bracket;
use App\Models\Event;
use App\Models\TeamMatch;
use App\Models\User;
use App\Services\DemoData\DemoContext;
use App\Support\EventQr;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The everyday records around the games, so no screen is empty:
 * announcements and tryouts with applicants, training attendance, the
 * eligibility checklist at every stage (with a real PDF behind each upload),
 * appeals on played games, notifications for every role, and the audit
 * trail of who did what.
 */
class MiscSeeder extends Seeder
{
    private DemoContext $ctx;

    public function run(DemoContext $ctx): void
    {
        $this->ctx = $ctx;
        $this->announcementsAndTryouts();
        $this->attendance();
        $this->requirements();
        $this->appeals();
        $this->notifications();
        $this->auditTrail();
    }

    private function venueFor(string $sport): string
    {
        foreach (DemoContext::VENUES as $name => $v) {
            if (in_array($sport, $v[2], true)) {
                return $name;
            }
        }

        return 'University Gymnasium';
    }

    /** Every coach posts the week's training and a requirements reminder; every other coach runs a tryout. */
    private function announcementsAndTryouts(): void
    {
        $announcements = $applications = $registry = [];
        foreach (DemoContext::teams() as $team) {
            $coach = $this->ctx->coach($team['college'], $team['sport'], $team['division']);
            $n = $team['n'];
            $sport = $team['sport'];
            $label = "{$team['division']}'s {$sport}";
            $venue = $this->venueFor($sport);
            $posted = fn (int $days) => now()->subDays($days)->setTime(8 + $n % 9, ($n * 7) % 60);

            $rows = [
                [(string) Str::uuid(), "{$label}: training this week",
                    "{$team['college']} {$label} trains Monday, Wednesday and Friday, 4:00–6:00 PM at the {$venue}. Conditioning on Saturday at 7:00 AM. Be on time for the warm-up.",
                    false, 3 + $n % 5, null],
                [(string) Str::uuid(), 'Submit your eligibility requirements',
                    'Players without an approved Medical Clearance and Certificate of Enrollment cannot be listed on a game lineup. Upload them under Requirements before Friday.',
                    false, 8 + $n % 4, null],
            ];
            if ($n % 2 === 1) {
                $rows[] = [(string) Str::uuid(), "{$label} Tryouts — {$team['college']}",
                    "Open to all {$team['college']} students. Bring your PE uniform and a copy of your COR. Walk-ins welcome; pre-register below so we can plan the drills.",
                    true, 10 - $n % 7, $this->ctx->today->copy()->addDays(2 + $n % 6)];
            }

            foreach ($rows as [$id, $title, $content, $tryout, $days, $date]) {
                $announcements[] = [
                    'id' => $id, 'title' => $title, 'content' => $content, 'is_tryout' => $tryout,
                    'tryout_date' => $date?->toDateString(), 'tryout_start_time' => $tryout ? '16:00' : null,
                    'tryout_end_time' => $tryout ? '18:00' : null, 'tryout_venue' => $tryout ? $venue : null,
                    'sport' => $sport, 'coach_id' => $coach->id, 'coach_name' => $coach->name,
                    'created_at' => $posted($days), 'updated_at' => $posted($days), 'deleted_at' => null,
                ];
                if (! $tryout) {
                    continue;
                }

                // Applicants from the coach's own college.
                foreach (['pending', 'pending', 'accepted', 'rejected'] as $k => $status) {
                    $female = $team['division'] === 'Women';
                    $first = $this->ctx->faker->randomElement($female ? DemoContext::WOMEN : DemoContext::MEN);
                    $last = $this->ctx->faker->randomElement(DemoContext::SURNAMES);
                    $sr = sprintf('26-%05d', 1000 + $n * 10 + $k);   // athletes' codes start at 10000
                    $email = "{$sr}".DemoContext::DOMAIN;
                    $registry[] = [
                        'sr_code' => $sr, 'first_name' => $first, 'last_name' => $last, 'middle_name' => null,
                        'gender' => $female ? 'Female' : 'Male', 'college' => $coach->department,
                        'program' => $this->ctx->faker->randomElement(DemoContext::PROGRAMS[$team['college']]),
                        'year_level' => $team['college'] === 'LS' ? 'Grade 11' : '1st Year', 'email' => $email,
                        'created_at' => now(), 'updated_at' => now(),
                    ];
                    $applied = now()->subDays(1 + $k * 2)->setTime(10 + $k, 15);
                    $applications[] = [
                        'id' => (string) Str::uuid(), 'announcement_id' => $id, 'sport' => $sport,
                        'coach_id' => $coach->id, 'first_name' => $first, 'last_name' => $last, 'email' => $email,
                        'student_id' => $sr, 'department' => $coach->department, 'phone' => '09'.$this->ctx->faker->numerify('#########'),
                        'year_level' => $team['college'] === 'LS' ? 'Grade 11' : '1st Year', 'status' => $status,
                        'reviewed_by' => $status === 'pending' ? null : $coach->id,
                        'reviewed_at' => $status === 'pending' ? null : $applied->copy()->addDay(),
                        'review_note' => $status === 'rejected' ? 'Roster is full this season — try again next semester.' : null,
                        'applied_at' => $applied, 'created_at' => $applied, 'updated_at' => $applied,
                    ];
                }
            }
        }
        foreach (['announcements' => $announcements, 'campus_students' => $registry, 'tryout_applications' => $applications] as $table => $rows) {
            foreach (array_chunk($rows, 250) as $chunk) {
                DB::table($table)->insert($chunk);
            }
        }
    }

    /** Four training sessions per team over the past two weeks, everyone marked; two more coming up. */
    private function attendance(): void
    {
        $pattern = ['present', 'present', 'present', 'late', 'present', 'excused', 'present', 'absent', 'present', 'present', 'present', 'late'];
        $sessions = $records = [];
        foreach (DemoContext::teams() as $team) {
            $coach = $this->ctx->coach($team['college'], $team['sport'], $team['division']);
            foreach ([3, 6, 9, 12] as $s => $ago) {
                $date = $this->ctx->today->copy()->subDays($ago + $team['n'] % 2)->toDateString();
                $sid = (string) Str::uuid();
                $sessions[] = [
                    'id' => $sid, 'coach_id' => $coach->id, 'title' => "{$team['division']}'s ".['training', 'conditioning', 'tactical session', 'scrimmage'][$s],
                    'date' => $date, 'start_time' => '16:00', 'end_time' => '18:00', 'venue_name' => $this->venueFor($team['sport']),
                    'created_by' => $coach->id, 'created_at' => $date, 'updated_at' => $date,
                ];
                foreach ($this->ctx->roster($coach, $team['division']) as $k => $a) {
                    $status = $a->status === 'injured' ? 'excused' : $pattern[($k + $s * 5 + $team['n']) % count($pattern)];
                    $records[] = [
                        'id' => (string) Str::uuid(), 'session_id' => $sid, 'athlete_id' => $a->id, 'event_id' => 'training',
                        'session_label' => null, 'date' => $date, 'status' => $status,
                        'notes' => $a->status === 'injured' ? 'Injured — rehab with the trainer.' : null,
                        'recorded_by' => $coach->id, 'recorded_at' => $date.' 18:05:00', 'created_at' => $date, 'updated_at' => $date,
                    ];
                }
            }
        }
        // Coming up: the coach has already put next week's sessions on the calendar.
        foreach (DemoContext::teams() as $team) {
            $coach = $this->ctx->coach($team['college'], $team['sport'], $team['division']);
            foreach ([['Training', 1 + $team['n'] % 3], ['Scrimmage', 4 + $team['n'] % 3]] as [$title, $in]) {
                $sessions[] = [
                    'id' => (string) Str::uuid(), 'coach_id' => $coach->id, 'title' => "{$team['division']}'s ".lcfirst($title),
                    'date' => $this->ctx->today->copy()->addDays($in)->toDateString(), 'start_time' => '16:00', 'end_time' => '18:00',
                    'venue_name' => $this->venueFor($team['sport']), 'created_by' => $coach->id,
                    'created_at' => now()->subDays(2), 'updated_at' => now()->subDays(2),
                ];
            }
        }
        DB::table('attendance_sessions')->insert($sessions);
        foreach (array_chunk($records, 400) as $chunk) {
            DB::table('attendance_records')->insert($chunk);
        }
    }

    /** Every athlete's eligibility checklist, most cleared, some still in review or sent back. */
    private function requirements(): void
    {
        // A sample PDF shipped with the app (public/samples), so "View file" works
        // wherever the demo is loaded from — even into a remote database.
        $file = public_path('samples/requirement-sample.pdf');
        if (! is_file($file)) {
            @mkdir(dirname($file), 0775, true);
            file_put_contents($file, $this->samplePdf());
        }
        $url = url('samples/requirement-sample.pdf');
        $types = DB::table('requirement_types')->pluck('id', 'name');
        $cleared = ['Waiver Form' => 'approved', 'Certificate of Enrollment' => 'approved', 'Medical Clearance' => 'approved'];
        $states = [
            $cleared, $cleared, $cleared, $cleared + ['Parental Consent' => 'approved'], $cleared,
            ['Waiver Form' => 'approved', 'Certificate of Enrollment' => 'approved', 'Medical Clearance' => 'pending'],
            ['Waiver Form' => 'approved', 'Certificate of Enrollment' => 'rejected', 'Medical Clearance' => 'approved'],
            ['Waiver Form' => 'approved', 'Certificate of Enrollment' => 'approved', 'Medical Clearance' => 'rejected'],
        ];
        $notes = [
            'Certificate of Enrollment' => 'This is last semester\'s COR — please upload the current one.',
            'Medical Clearance' => 'Missing the physician\'s signature and license number.',
        ];
        $rows = [];
        $k = 0;
        foreach ($this->ctx->athletes as $a) {
            foreach ($states[$k % count($states)] as $name => $status) {
                $at = now()->subDays(20 - $k % 12)->setTime(9 + $k % 8, $k % 60);
                $rows[] = [
                    'id' => (string) Str::uuid(), 'athlete_id' => $a->id, 'athlete_name' => "{$a->first_name} {$a->last_name}",
                    'type' => 'checklist', 'requirement_type_id' => $types[$name] ?? null, 'supersedes_id' => null,
                    'name' => $name, 'description' => null, 'file_url' => $url, 'status' => $status,
                    'notes' => $status === 'rejected' ? ($notes[$name] ?? 'Unreadable scan — please resubmit.') : null,
                    'reviewed_by' => $status === 'pending' ? null : $a->coach_id,
                    'reviewed_at' => $status === 'pending' ? null : $at->copy()->addDay(),
                    'submitted_at' => $at, 'created_at' => $at, 'updated_at' => $at,
                ];
            }
            $k++;
        }
        foreach (array_chunk($rows, 400) as $chunk) {
            DB::table('requirements')->insert($chunk);
        }
    }

    /** Appeals on played games, filed by the losing side's coach, open and decided. */
    private function appeals(): void
    {
        $season = DB::table('seasons')->where('is_active', true)->value('id');
        $played = collect(['Basketball — Men', 'Basketball — Women', 'Volleyball — Women', 'Volleyball — Men', 'Sepak Takraw — Men', 'Chess — Men'])
            ->map(fn ($sport) => TeamMatch::where('sport', $sport)->where('stage', '!=', 'friendly')->orderBy('played_at')->orderBy('home_team')->first())
            ->filter()->values();
        $cases = [
            ['open', 'The shot clock was not reset after an offensive rebound with 1:12 left in the 4th quarter; the resulting possession decided the game.', null],
            ['upheld', 'A foul was charged to the wrong jersey, fouling our player out.', 'Confirmed from the scoresheet: the foul was charged to the wrong jersey. Box score corrected; result stands.'],
            ['dismissed', 'The net touch on set point of the second set was never called.', 'The first referee\'s report shows no net contact. Result stands.'],
            ['open', 'The rotation was out of order on the final rally of the fourth set.', null],
            ['dismissed', 'An ineligible player (no approved clearance) was fielded in the third set.', 'Records show the player was cleared before the game. Result stands.'],
            ['dismissed', 'Board 2 flag fell after the result was already signed.', 'Both players signed the scoresheet. Result stands.'],
        ];
        foreach ($played as $k => $match) {
            [$status, $reason, $resolution] = $cases[$k];
            $loser = $match->winner === $match->home_team ? $match->away_team : $match->home_team;
            [$sport, $division] = DemoContext::parse($match->sport);
            $coach = $this->ctx->coach($loser, $sport, $division);
            $filed = Carbon::parse($match->played_at)->addHours(3);
            DB::table('protests')->insert([
                'id' => (string) Str::uuid(), 'event_id' => $match->event_id, 'season_id' => $season, 'filed_by' => $coach->id,
                'department' => $loser, 'reason' => $reason, 'status' => $status, 'resolution' => $resolution,
                'resolved_by' => $status === 'open' ? null : $this->ctx->adminId,
                'resolved_at' => $status === 'open' ? null : $filed->copy()->addDay(),
                'created_at' => $filed, 'updated_at' => $filed,
            ]);
            $this->notify($this->ctx->adminId, 'ProtestFiled', 'protest_filed', 'New appeal', "{$this->ctx->abbr($loser)} appealed a {$match->sport} result.", '/admin/protests', $filed, $status !== 'open');
            if ($status !== 'open') {
                $this->notify($coach->id, 'ProtestResolved', 'protest_resolved', 'Appeal '.$status, "Your appeal about {$match->sport} was {$status}.", '/coach/protests', $filed->copy()->addDay(), false);
            }
        }
    }

    /**
     * Judges hear about the games they're assigned; athletes about their
     * requirement reviews and today's changed game times; coaches about
     * their games moving.
     */
    private function notifications(): void
    {
        $k = 0;
        foreach (Event::whereIn('status', ['upcoming', 'ongoing'])->whereNotNull('judges')->orderBy('schedule')->orderBy('start_time')->orderBy('name')->get() as $event) {
            if ($judge = $event->judges[0]['id'] ?? null) {
                $this->notify($judge, 'CommitteeAssigned', 'committee_assigned', 'Assigned to score '.$event->name,
                    'Tap to open the score sheet. The QR code was also emailed to you.', EventQr::path($event), now()->subDays(2)->addMinutes($k), $k % 3 === 0);
                $k++;
            }
        }

        $reviewed = DB::table('requirements')->whereIn('status', ['approved', 'rejected'])->where('name', 'Medical Clearance')->get();
        foreach ($reviewed as $r) {
            $this->notify($r->athlete_id, 'RequirementReviewed', 'requirement_reviewed', 'Requirement '.$r->status,
                "\"{$r->name}\" was {$r->status}.", '/athlete/requirements', Carbon::parse($r->reviewed_at), $r->status === 'approved');
        }

        // Each team hears about its games still to come, the way ScheduleNotifier::created() words it.
        foreach (Event::whereDate('schedule', '>', $this->ctx->today)->where('status', 'upcoming')->orderBy('schedule')->orderBy('start_time')->orderBy('name')->get() as $event) {
            [$sport, $division] = DemoContext::parse($event->category);
            $date = Carbon::parse($event->schedule);
            $body = $date->format('D, M j, Y').' · '.$event->start_time.'–'.$event->end_time.' · Venue: '.$event->venue_name;
            foreach ($event->departments ?? [] as $college) {
                $coach = $this->ctx->coach($college, $sport, $division);
                foreach ([$coach, ...$this->ctx->roster($coach, $division)] as $user) {
                    if ($user) {
                        $this->notify($user->id, 'ScheduleChanged', 'schedule_changed', 'New game scheduled: '.$event->name, $body, '/', now()->subDays(3), $date->diffInDays($this->ctx->today, true) > 4, 'scheduled');
                    }
                }
            }
        }

        // Today's games were re-timed around the live ones: tell the players and coaches.
        foreach (Event::whereDate('schedule', $this->ctx->today)->where('status', 'upcoming')->orderBy('start_time')->orderBy('name')->get() as $event) {
            [$sport, $division] = DemoContext::parse($event->category);
            foreach ($event->departments ?? [] as $college) {
                $coach = $this->ctx->coach($college, $sport, $division);
                $time = Carbon::parse($event->start_time)->format('g:i A');
                $body = "Now {$time} today · {$event->venue_name}";
                if ($coach) {
                    $this->notify($coach->id, 'ScheduleChanged', 'schedule_changed', 'Game time changed: '.$event->name, $body, '/coach/schedule', now()->subHours(3), false, 'rescheduled');
                }
                foreach (array_slice($this->ctx->roster($coach, $division), 0, 6) as $a) {
                    $this->notify($a->id, 'ScheduleChanged', 'schedule_changed', 'Game time changed: '.$event->name, $body, '/athlete/schedule', now()->subHours(3), false, 'rescheduled');
                }
            }
        }
        $this->flushNotifications();
    }

    /**
     * The audit trail, as the app records it: the office publishing brackets
     * and adding venues, judges recording results, coaches reviewing
     * requirements.
     */
    private function auditTrail(): void
    {
        $admin = User::find($this->ctx->adminId);
        $rows = [];
        $row = fn (?object $user, string $role, string $event, string $type, string $id, ?array $old, ?array $new, Carbon $at, string $url) => [
            'user_id' => $user?->id, 'user_name' => $user?->name, 'user_role' => $role, 'event' => $event,
            'auditable_type' => $type, 'auditable_id' => $id,
            'old_values' => $old ? json_encode($old) : null, 'new_values' => $new ? json_encode($new) : null,
            'ip_address' => '10.20.'.(crc32($user?->id ?? '') % 200).'.'.(crc32($id) % 250 + 2),
            'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
            'url' => $url, 'created_at' => $at,
        ];

        foreach (DB::table('venues')->get() as $v) {
            $rows[] = $row($admin, 'admin', 'created', 'App\\Models\\Venue', $v->id, null, ['name' => $v->name, 'capacity' => $v->capacity], Carbon::parse($v->created_at), '/api/venues');
        }
        foreach (Bracket::all() as $b) {
            $at = Carbon::parse($b->settings['startDate'] ?? now())->subDays(3)->setTime(15, 0);
            $rows[] = $row($admin, 'admin', 'created', 'App\\Models\\Bracket', $b->id, null, ['name' => $b->name, 'format' => $b->format], $at, '/api/brackets');
            $rows[] = $row($admin, 'admin', 'updated', 'App\\Models\\Bracket', $b->id, ['status' => 'draft'], ['status' => 'active'], $at->copy()->addMinutes(10), "/api/brackets/{$b->id}/publish");
        }

        $judges = collect($this->ctx->judges)->keyBy('id');
        foreach (TeamMatch::all() as $m) {
            $judge = $judges[$m->recorded_by] ?? null;
            $rows[] = $row($judge, 'judge', 'created', 'App\\Models\\TeamMatch', $m->id, null,
                ['sport' => $m->sport, 'home_score' => $m->home_score, 'away_score' => $m->away_score, 'winner' => $m->winner],
                Carbon::parse($m->played_at), "/api/events/{$m->event_id}/result");
        }

        $coaches = collect($this->ctx->coaches)->keyBy('id');
        foreach (DB::table('requirements')->whereNotNull('reviewed_by')->where('name', 'Medical Clearance')->get() as $r) {
            $rows[] = $row($coaches[$r->reviewed_by] ?? null, 'coach', 'updated', 'App\\Models\\Requirement', $r->id,
                ['status' => 'pending'], ['status' => $r->status], Carbon::parse($r->reviewed_at), "/api/requirements/{$r->id}/status");
        }

        usort($rows, fn ($a, $b) => $a['created_at'] <=> $b['created_at']);
        foreach (array_chunk($rows, 400) as $chunk) {
            DB::table('audit_logs')->insert($chunk);
        }
    }

    private array $notifications = [];

    private function notify(string $userId, string $class, string $kind, string $title, string $body, string $url, Carbon $at, bool $read, ?string $change = null): void
    {
        $data = ['kind' => $kind] + ($change ? ['change' => $change] : []) + ['title' => $title, 'body' => $body, 'url' => $url];
        $this->notifications[] = [
            'id' => (string) Str::uuid(), 'type' => 'App\\Notifications\\'.$class, 'notifiable_type' => 'App\\Models\\User',
            'notifiable_id' => $userId, 'data' => json_encode($data),
            'read_at' => $read ? $at->copy()->addHours(2) : null, 'created_at' => $at, 'updated_at' => $at,
        ];
        if (count($this->notifications) >= 400) {
            $this->flushNotifications();
        }
    }

    private function flushNotifications(): void
    {
        if ($this->notifications) {
            DB::table('notifications')->insert($this->notifications);
            $this->notifications = [];
        }
    }

    /** A tiny valid one-page PDF so "View file" links open something real. */
    private function samplePdf(): string
    {
        $stream = 'BT /F1 18 Tf 72 720 Td (SportAxis - sample requirement upload) Tj ET';
        $objs = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
            '<< /Length '.strlen($stream)." >>\nstream\n{$stream}\nendstream",
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        ];
        $out = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objs as $i => $obj) {
            $offsets[] = strlen($out);
            $out .= ($i + 1)." 0 obj\n{$obj}\nendobj\n";
        }
        $xref = strlen($out);
        $out .= "xref\n0 ".(count($objs) + 1)."\n0000000000 65535 f \n";
        foreach ($offsets as $o) {
            $out .= sprintf("%010d 00000 n \n", $o);
        }

        return $out.'trailer << /Size '.(count($objs) + 1)." /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";
    }
}
