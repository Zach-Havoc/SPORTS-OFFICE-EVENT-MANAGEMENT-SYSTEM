<?php

namespace Tests;

use App\Models\User;
use Database\Factories\AnnouncementFactory;
use Database\Factories\AthleteFactory;
use Database\Factories\AttendanceRecordFactory;
use Database\Factories\CategoryFactory;
use Database\Factories\DepartmentFactory;
use Database\Factories\EmailVerificationFactory;
use Database\Factories\EventFactory;
use Database\Factories\PerformanceRecordFactory;
use Database\Factories\RegistrationCodeFactory;
use Database\Factories\RequirementFactory;
use Database\Factories\ScoreFactory;
use Database\Factories\TeamMatchFactory;
use Database\Factories\TryoutApplicationFactory;
use Database\Factories\UserFactory;
use Database\Factories\VenueFactory;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;

abstract class TestCase extends BaseTestCase
{
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

    protected function users(): UserFactory { return UserFactory::new(); }
    protected function departments(): DepartmentFactory { return DepartmentFactory::new(); }
    protected function categories(): CategoryFactory { return CategoryFactory::new(); }
    protected function venues(): VenueFactory { return VenueFactory::new(); }
    protected function events(): EventFactory { return EventFactory::new(); }
    protected function regCodes(): RegistrationCodeFactory { return RegistrationCodeFactory::new(); }
    protected function athletes(): AthleteFactory { return AthleteFactory::new(); }
    protected function announcements(): AnnouncementFactory { return AnnouncementFactory::new(); }
    protected function scores(): ScoreFactory { return ScoreFactory::new(); }
    protected function teamMatches(): TeamMatchFactory { return TeamMatchFactory::new(); }
    protected function requirements(): RequirementFactory { return RequirementFactory::new(); }
    protected function tryouts(): TryoutApplicationFactory { return TryoutApplicationFactory::new(); }
    protected function attendance(): AttendanceRecordFactory { return AttendanceRecordFactory::new(); }
    protected function performance(): PerformanceRecordFactory { return PerformanceRecordFactory::new(); }
    protected function emailVerifications(): EmailVerificationFactory { return EmailVerificationFactory::new(); }

    // ── Auth helpers ────────────────────────────────────────────────────

    /** Create a user of the given role and authenticate as them via Sanctum. */
    protected function actingAsRole(string $role, array $attrs = []): User
    {
        $user = $this->users()->state(['role' => $role])->create($attrs);
        Sanctum::actingAs($user, ['*']);

        return $user;
    }

    /** Authenticate as an existing user via Sanctum. */
    protected function loginAs(User $user): User
    {
        Sanctum::actingAs($user, ['*']);

        return $user;
    }
}
