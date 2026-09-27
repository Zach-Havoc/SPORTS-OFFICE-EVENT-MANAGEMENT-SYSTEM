<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\DemoData\DatabaseBackup;
use App\Services\DemoData\DemoContext;
use App\Services\DemoData\DemoDataService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

/**
 * `sportaxis:reset-demo` and Settings → "Reset & Load Demo Data": the
 * safety gates, and what the demo intramurals look like afterwards.
 */
class DemoResetTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // mysqldump against the test database isn't what's under test here.
        $this->app->instance(DatabaseBackup::class, new class extends DatabaseBackup
        {
            public function dump(string $path): string
            {
                File::ensureDirectoryExists(dirname($path));
                File::put($path, "-- test backup\n");

                return $path;
            }
        });
    }

    private function signedUrl(): string
    {
        return URL::temporarySignedRoute('admin.system.reset-demo', now()->addMinutes(15), absolute: false);
    }

    public function test_it_is_off_unless_the_env_allows_it(): void
    {
        config(['sportaxis.allow_demo_reset' => false]);
        $this->actingAsRole('admin');

        $this->getJson('/api/admin/system/reset-demo/link')->assertOk()->assertJson(['enabled' => false]);
        $this->postJson($this->signedUrl(), ['confirmation' => 'RESET SPORTAXIS'])->assertStatus(409);
        $this->artisan('sportaxis:reset-demo', ['--force' => true])->assertFailed();
    }

    public function test_only_an_admin_with_a_signed_link_and_the_typed_phrase_can_reset(): void
    {
        config(['sportaxis.allow_demo_reset' => true]);

        $this->actingAsRole('coach');
        $this->getJson('/api/admin/system/reset-demo/link')->assertForbidden();
        $this->postJson($this->signedUrl(), ['confirmation' => 'RESET SPORTAXIS'])->assertForbidden();

        $this->actingAsRole('admin');
        $link = $this->getJson('/api/admin/system/reset-demo/link')->assertOk()->assertJson(['enabled' => true, 'confirmation' => 'RESET SPORTAXIS']);
        $this->assertStringStartsWith('/api/admin/system/reset-demo?expires=', $link->json('url'));

        $this->postJson('/api/admin/system/reset-demo', ['confirmation' => 'RESET SPORTAXIS'])->assertForbidden();   // unsigned
        $this->postJson(URL::temporarySignedRoute('admin.system.reset-demo', now()->subMinute(), absolute: false), ['confirmation' => 'RESET SPORTAXIS'])->assertForbidden();   // expired
        $this->postJson($this->signedUrl(), ['confirmation' => 'reset sportaxis'])->assertStatus(422);
    }

    public function test_a_failed_backup_stops_the_reset_before_anything_is_wiped(): void
    {
        config(['sportaxis.allow_demo_reset' => true]);
        $this->app->instance(DatabaseBackup::class, new class extends DatabaseBackup
        {
            public function dump(string $path): string
            {
                throw new \RuntimeException('Backup failed: mysqldump not found');
            }
        });
        $this->actingAsRole('admin');
        $coach = $this->users()->create(['role' => 'coach']);

        $this->postJson($this->signedUrl(), ['confirmation' => 'RESET SPORTAXIS'])->assertStatus(500);
        $this->assertNotNull(User::find($coach->id));
    }

    public function test_the_reset_keeps_the_admins_and_loads_the_demo_intramurals(): void
    {
        config(['sportaxis.allow_demo_reset' => true]);
        $admin = $this->users()->create(['role' => 'admin', 'email' => 'office@batstate-u.edu.ph']);
        $token = $admin->createToken('web')->plainTextToken;
        $oldCoach = $this->users()->create(['role' => 'coach']);
        $this->loginAs($admin);

        $this->postJson($this->signedUrl(), ['confirmation' => 'RESET SPORTAXIS'])->assertOk()
            ->assertJsonPath('counts.colleges', 7)->assertJsonPath('counts.athletes', 630);

        // The admin survives, still signed in; everyone else is gone.
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/user', ['Authorization' => "Bearer {$token}"])->assertOk();
        $this->assertNull(User::find($oldCoach->id));
        $this->assertDatabaseHas('audit_logs', ['event' => 'demo_reset', 'user_id' => $admin->id]);

        // Colleges, sports, divisions.
        $this->assertEqualsCanonicalizing(array_values(DemoContext::COLLEGES), DB::table('departments')->pluck('name')->all());
        foreach (DemoContext::DIVISION_SPORTS as $sport) {
            foreach (['Men', 'Women'] as $division) {
                $this->assertDatabaseHas('categories', ['name' => "{$sport} — {$division}", 'parent_sport' => $sport, 'division' => $division]);
            }
        }

        // Coaches: one per college per sport, running both divisions; coach1–7 each
        // their own sport at their own college, coach1–14 two per college.
        $coaches = User::where('role', 'coach')->get();
        $this->assertCount(49, $coaches);
        $this->assertCount(49, $coaches->unique(fn ($c) => "{$c->department}|{$c->sport}"));
        $this->assertSame(['Men & Women'], $coaches->pluck('gender_category')->unique()->values()->all());
        $firstSeven = $coaches->filter(fn ($c) => DemoContext::number($c->email) <= 7);
        $this->assertCount(7, $firstSeven->pluck('sport')->unique());
        $this->assertCount(7, $firstSeven->pluck('department')->unique());
        $first = $coaches->filter(fn ($c) => DemoContext::number($c->email) <= 14);
        $this->assertSame([2], $first->countBy('department')->unique()->values()->all());

        // Judges cover every sport; athletes numbered 1…630.
        $this->assertSame(10, User::where('role', 'judge')->count());
        $this->assertEqualsCanonicalizing(array_keys(DemoContext::SPORTS), User::where('role', 'judge')->pluck('sports')->flatten()->unique()->values()->all());
        $athletes = User::where('role', 'athlete')->get();
        $this->assertSame(range(1, 630), $athletes->map(fn ($a) => DemoContext::number($a->email))->sort()->values()->all());
        foreach ($athletes as $a) {
            $this->assertMatchesRegularExpression('/^\d{2}-\d{5}$/', $a->sr_code);
        }

        // Each coach: a full Men's and a full Women's roster, jerseys unique within each team; ≥10 per sport and category.
        foreach ($coaches as $coach) {
            foreach (['Male', 'Female'] as $sex) {
                $jerseys = DB::table('athletes')->join('users', 'users.id', '=', 'athletes.user_id')
                    ->where('athletes.coach_id', $coach->id)->where('users.gender', $sex)->pluck('athletes.jersey_number');
                $this->assertCount(DemoContext::ROSTER[$coach->sport], $jerseys, "{$coach->email} {$sex}");
                $this->assertCount($jerseys->count(), $jerseys->unique());
            }
        }
        foreach (array_keys(DemoContext::SPORTS) as $sport) {
            foreach (['Male', 'Female'] as $gender) {
                $this->assertGreaterThanOrEqual(10, User::where('role', 'athlete')->where('sport', $sport)->where('gender', $gender)->count());
            }
        }

        // Brackets, games in every state, no venue double-booked, a judge on every game.
        $this->assertSame(23, DB::table('brackets')->count());
        $this->assertGreaterThan(0, DB::table('events')->where('status', 'ongoing')->count());
        $this->assertGreaterThan(200, DB::table('events')->where('status', 'completed')->count());
        $this->assertGreaterThan(50, DB::table('events')->where('status', 'upcoming')->count());
        $this->assertSame(0, DemoDataService::counts()['venue double-bookings']);
        $this->assertSame(0, DB::table('events')->whereNull('judges')->count());
        $this->assertGreaterThanOrEqual(7, DB::table('brackets')->whereNotNull('champion')->count());
        $this->assertTrue(DB::table('bracket_matches')->where('is_bye', true)->exists());

        // The demo logins work, and each role's home screens have something to show.
        $this->app['auth']->forgetGuards();
        $as = function (string $email) {
            $token = $this->postJson('/api/login', ['email' => $email, 'password' => DemoContext::PASSWORD])->assertOk()->json('token');
            $this->app['auth']->forgetGuards();

            return ['Authorization' => "Bearer {$token}"];
        };
        $coach = $as('coach1@g.batstate-u.edu.ph');
        $this->assertNotEmpty($this->getJson('/api/athletes', $coach)->assertOk()->json());
        $this->assertNotEmpty($this->getJson('/api/coach/schedule', $coach)->assertOk()->json());
        $athlete = $as('athlete1@g.batstate-u.edu.ph');
        $this->assertNotEmpty($this->getJson('/api/athlete/schedule', $athlete)->assertOk()->json());
        $this->getJson('/api/my-coach', $athlete)->assertOk();
        $judge = $as('judge1@g.batstate-u.edu.ph');
        $judge1 = User::where('email', 'judge1@g.batstate-u.edu.ph')->first();
        $assigned = 0;
        for ($page = 1, $last = 1; $page <= $last; $page++) {
            $res = $this->getJson("/api/events?page={$page}", $judge)->assertOk();
            $last = $res->json('last_page');
            $assigned += collect($res->json('data'))->filter(fn ($e) => collect($e['judges'] ?? [])->contains('id', $judge1->id))->count();
        }
        $this->assertGreaterThan(0, $assigned);

        $this->assertFileExists(storage_path('app/demo-credentials.csv'));
    }

    public function test_running_it_twice_gives_the_same_accounts(): void
    {
        config(['sportaxis.allow_demo_reset' => true]);
        $this->users()->create(['role' => 'admin']);
        $service = app(DemoDataService::class);

        $service->reset(null, 'console');
        $first = DB::table('users')->where('role', '!=', 'admin')->orderBy('email')->pluck('name', 'email')->all();
        $service->reset(null, 'console');
        $second = DB::table('users')->where('role', '!=', 'admin')->orderBy('email')->pluck('name', 'email')->all();

        $this->assertSame($first, $second);
        $this->assertSame(DB::table('users')->count(), DB::table('users')->distinct()->count('email'));
    }
}
