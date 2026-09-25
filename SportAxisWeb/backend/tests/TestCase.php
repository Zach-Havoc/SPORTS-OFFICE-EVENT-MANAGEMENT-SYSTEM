<?php

namespace Tests;

use App\Models\User;
use Database\Factories\AnnouncementFactory;
use Database\Factories\AthleteFactory;
use Database\Factories\AttendanceRecordFactory;
use Database\Factories\AttendanceSessionFactory;
use Database\Factories\CampusStudentFactory;
use Database\Factories\CategoryFactory;
use Database\Factories\DepartmentFactory;
use Database\Factories\DisciplineEntryFactory;
use Database\Factories\EmailVerificationFactory;
use Database\Factories\EventFactory;
use Database\Factories\LiveScoreFactory;
use Database\Factories\PerformanceRecordFactory;
use Database\Factories\RegistrationCodeFactory;
use Database\Factories\RequirementFactory;
use Database\Factories\ScoreFactory;
use Database\Factories\SiteSlideFactory;
use Database\Factories\TeamMatchFactory;
use Database\Factories\TryoutApplicationFactory;
use Database\Factories\UserFactory;
use Database\Factories\VenueFactory;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;

abstract class TestCase extends BaseTestCase
{
    // Tests using RefreshDatabase migrate an empty schema, then rely on this
    // to get baseline reference data (eligibility checklist, racquet
    // disciplines, default season) — that data used to be seeded inline by
    // three migrations, moved out to keep `schema:dump`'s fast-install path
    // working. Deliberately NOT DatabaseSeeder — that also creates demo
    // accounts with known passwords, which no test should depend on existing.
    //
    // This must be a PROPERTY, not a `seeder()` method: RefreshDatabase's
    // CanConfigureMigrationCommands trait defines its own `seeder()` method
    // that reads `$this->seeder` as a property — and since RefreshDatabase is
    // `use`d directly inside each test class (not here), a same-named method
    // defined on this parent class would be shadowed by the trait's, and
    // silently never called.
    protected $seeder = ReferenceDataSeeder::class;

    protected function setUp(): void
    {
        parent::setUp();

        // The throttle middleware and the password-reset cooldown both use the
        // cache. The array cache store persists for the whole test process, so
        // flush it between tests to keep rate-limit state from leaking.
        Cache::flush();
    }

    // ── Factory shortcuts ───────────────────────────────────────────────
    // The app models don't use the HasFactory trait, so we invoke the
    // factory classes directly instead of Model::factory().

    protected function users(): UserFactory
    {
        return UserFactory::new();
    }

    protected function departments(): DepartmentFactory
    {
        return DepartmentFactory::new();
    }

    protected function categories(): CategoryFactory
    {
        return CategoryFactory::new();
    }

    protected function disciplineEntries(): DisciplineEntryFactory
    {
        return DisciplineEntryFactory::new();
    }

    protected function venues(): VenueFactory
    {
        return VenueFactory::new();
    }

    protected function events(): EventFactory
    {
        return EventFactory::new();
    }

    protected function liveScores(): LiveScoreFactory
    {
        return LiveScoreFactory::new();
    }

    protected function regCodes(): RegistrationCodeFactory
    {
        return RegistrationCodeFactory::new();
    }

    protected function campusStudents(): CampusStudentFactory
    {
        return CampusStudentFactory::new();
    }

    protected function athletes(): AthleteFactory
    {
        return AthleteFactory::new();
    }

    protected function announcements(): AnnouncementFactory
    {
        return AnnouncementFactory::new();
    }

    protected function scores(): ScoreFactory
    {
        return ScoreFactory::new();
    }

    protected function siteSlides(): SiteSlideFactory
    {
        return SiteSlideFactory::new();
    }

    protected function teamMatches(): TeamMatchFactory
    {
        return TeamMatchFactory::new();
    }

    protected function requirements(): RequirementFactory
    {
        return RequirementFactory::new();
    }

    protected function tryouts(): TryoutApplicationFactory
    {
        return TryoutApplicationFactory::new();
    }

    protected function attendance(): AttendanceRecordFactory
    {
        return AttendanceRecordFactory::new();
    }

    protected function attendanceSessions(): AttendanceSessionFactory
    {
        return AttendanceSessionFactory::new();
    }

    protected function performance(): PerformanceRecordFactory
    {
        return PerformanceRecordFactory::new();
    }

    protected function emailVerifications(): EmailVerificationFactory
    {
        return EmailVerificationFactory::new();
    }

    // ── Auth helpers ────────────────────────────────────────────────────

    /** Create a user of the given role and authenticate as them via Sanctum. */
    protected function actingAsRole(string $role, array $attrs = []): User
    {
        $user = $this->users()->state(['role' => $role])->create($attrs);
        Sanctum::actingAs($user, ['*']);

        return $user;
    }

    /**
     * Create a committee member, assign them to this game, and sign in as
     * them — only assigned committee members (or an admin) may score it.
     */
    protected function actingAsJudgeFor(\App\Models\Event $event, array $attrs = []): User
    {
        $judge = $this->actingAsRole('judge', $attrs);
        $event->refresh();
        $event->update(['judges' => [
            ...($event->judges ?? []),
            ['id' => $judge->id, 'name' => $judge->name, 'email' => $judge->email],
        ]]);

        return $judge;
    }

    /** Authenticate as an existing user via Sanctum. */
    protected function loginAs(User $user): User
    {
        Sanctum::actingAs($user, ['*']);

        return $user;
    }
}
