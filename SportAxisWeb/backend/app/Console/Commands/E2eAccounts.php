<?php

namespace App\Console\Commands;

use App\Models\Athlete;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Temporary accounts for the Selenium suite (SportAxisWeb/e2e/selenium).
 *
 *   php artisan sportaxis:e2e-accounts create   → prints the accounts as JSON
 *   php artisan sportaxis:e2e-accounts delete   → removes them again
 *
 * `create` makes one admin, one committee member, one coach and three
 * athletes on that coach's roster (the first athlete can sign in), all with
 * a fresh random password and an @e2e.sportaxis.test address. `delete`
 * removes every account on that domain together with what hangs off it
 * (roster rows, sign-in tokens, notifications, audit entries), so nothing of
 * a test run stays in the database. `create` cleans up a previous run first,
 * in case it was interrupted.
 *
 * Local and test environments only: it refuses to run in production.
 */
class E2eAccounts extends Command
{
    protected $signature = 'sportaxis:e2e-accounts {action : create or delete}';

    protected $description = 'Create or delete the temporary accounts the Selenium tests sign in with (local only)';

    public const DOMAIN = '@e2e.sportaxis.test';

    private const SPORT = 'Basketball';

    public function handle(): int
    {
        if (! app()->environment(['local', 'testing', 'e2e'])) {
            $this->error('Test accounts are only for local and test environments (APP_ENV is '.app()->environment().').');

            return self::FAILURE;
        }

        return match ($this->argument('action')) {
            'create' => $this->create(),
            'delete' => $this->remove(),
            default => $this->invalid(),
        };
    }

    private function create(): int
    {
        $this->purge();

        $college = DB::table('departments')->where('name', 'College of Arts and Sciences')->first()
            ?? DB::table('departments')->orderBy('name')->first();
        if (! $college) {
            $this->error('No colleges in the database yet; seed it first.');

            return self::FAILURE;
        }
        $sportCategory = DB::table('categories')->where('name', self::SPORT)->value('id');

        $password = Str::password(20, symbols: false);
        $hash = Hash::make($password);
        $privacy = ['privacy_notice_accepted_at' => now(), 'privacy_notice_version' => '2026-09-21'];

        $accounts = AuditLog::withoutRecording(function () use ($college, $sportCategory, $hash, $privacy) {
            $make = fn (string $role, string $name, array $extra = []) => User::forceCreate(array_merge([
                'id' => (string) Str::uuid(),
                'email' => "e2e.{$role}".self::DOMAIN,
                'password' => $hash,
                'name' => $name,
                'role' => $role,
                'active' => true,
            ], $privacy, $extra));

            $admin = $make('admin', 'E2E Admin');
            $judge = $make('judge', 'E2E Committee', ['sport' => self::SPORT, 'sports' => [self::SPORT]]);
            $coach = $make('coach', 'E2E Coach', [
                'department' => $college->name,
                'department_id' => $college->id,
                'sport' => self::SPORT,
                'sports' => [self::SPORT],
                'gender_category' => 'Men & Women',
            ]);

            $athletes = [];
            foreach ([['Ana', 'Tester'], ['Ben', 'Tester'], ['Cara', 'Tester']] as $i => [$first, $last]) {
                $n = $i + 1;
                $user = $make($n === 1 ? 'athlete' : "athlete{$n}", "{$first} {$last}", [
                    'role' => 'athlete',
                    'department' => $college->name,
                    'department_id' => $college->id,
                    'year_level' => '1st Year',
                    'course' => 'BS Testing',
                    'sport' => self::SPORT,
                    'sports' => [self::SPORT],
                    'coach_id' => $coach->id,
                    'coach_name' => $coach->name,
                    'enrolled_at' => now(),
                ]);
                Athlete::create([
                    'id' => (string) Str::uuid(),
                    'user_id' => $user->id,
                    'student_id' => sprintf('99-%05d', $n),
                    'first_name' => $first,
                    'last_name' => $last,
                    'email' => $user->email,
                    'department' => $college->name,
                    'year_level' => '1st Year',
                    'course' => 'BS Testing',
                    'coach_id' => $coach->id,
                    'sport' => self::SPORT,
                    'category_id' => $sportCategory,
                    'status' => 'active',
                    'enrolled_at' => now(),
                ]);
                $athletes[] = $user;
            }

            return ['admin' => $admin, 'coach' => $coach, 'athlete' => $athletes[0], 'judge' => $judge];
        });

        $this->line(json_encode([
            'password' => $password,
            'accounts' => collect($accounts)->map(fn (User $u) => ['email' => $u->email, 'name' => $u->name]),
        ]));

        return self::SUCCESS;
    }

    private function remove(): int
    {
        $this->line(json_encode(['deleted' => $this->purge()]));

        return self::SUCCESS;
    }

    /** Remove every test account and what hangs off it. @return array<string, int> */
    private function purge(): array
    {
        $ids = User::where('email', 'like', '%'.self::DOMAIN)->pluck('id');
        if ($ids->isEmpty()) {
            return ['users' => 0];
        }

        return AuditLog::withoutRecording(fn () => DB::transaction(function () use ($ids) {
            $athleteIds = Athlete::withTrashed()
                ->whereIn('coach_id', $ids)->orWhereIn('user_id', $ids)->pluck('id');

            return [
                'roster' => Athlete::withTrashed()->whereIn('id', $athleteIds)->forceDelete(),
                'tokens' => DB::table('personal_access_tokens')->where('tokenable_type', User::class)->whereIn('tokenable_id', $ids)->delete(),
                'notifications' => DB::table('notifications')->whereIn('notifiable_id', $ids)->delete(),
                'audit' => DB::table('audit_logs')
                    ->whereIn('user_id', $ids)
                    ->orWhereIn('auditable_id', $ids->merge($athleteIds))
                    ->delete(),
                'users' => User::whereIn('id', $ids)->delete(),
            ];
        }));
    }

    private function invalid(): int
    {
        $this->error('Use "create" or "delete".');

        return self::FAILURE;
    }
}
