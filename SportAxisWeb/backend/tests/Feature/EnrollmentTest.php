<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Athlete self-enrollment:
 *   POST   /api/enroll
 *   DELETE /api/unenroll
 *   GET    /api/my-coach
 */
class EnrollmentTest extends TestCase
{
    use RefreshDatabase;

    public function test_enroll_is_athlete_only(): void
    {
        $this->postJson('/api/enroll', ['enrollmentCode' => 'X'])->assertUnauthorized();

        $this->actingAsRole('coach');
        $this->postJson('/api/enroll', ['enrollmentCode' => 'X'])->assertForbidden();
    }

    public function test_athlete_can_enroll_with_a_valid_coach_code(): void
    {
        $coach = $this->users()->coach()->create([
            'enrollment_code' => 'JOINME01',
            'sport'           => 'Football',
            'department'      => 'College of Engineering',
        ]);
        // Athlete already registered under the same department.
        $athlete = $this->actingAsRole('athlete', ['department' => 'College of Engineering']);

        $this->postJson('/api/enroll', ['enrollmentCode' => 'JOINME01'])
            ->assertOk()
            ->assertJsonFragment(['message' => 'Enrolled successfully', 'sport' => 'Football']);

        $athlete->refresh();
        $this->assertSame($coach->id, $athlete->coach_id);
        $this->assertSame('Football', $athlete->sport);
        $this->assertNotNull($athlete->enrolled_at);
    }

    public function test_athlete_without_a_department_inherits_the_coachs_on_enroll(): void
    {
        $this->users()->coach()->create([
            'enrollment_code' => 'JOINME01',
            'department'      => 'College of Business',
        ]);
        $athlete = $this->actingAsRole('athlete'); // no department set at signup

        $this->postJson('/api/enroll', ['enrollmentCode' => 'JOINME01'])
            ->assertOk()
            ->assertJsonFragment(['department' => 'College of Business']);

        $this->assertSame('College of Business', $athlete->fresh()->department);
    }

    public function test_athlete_from_another_department_cannot_enroll(): void
    {
        $this->users()->coach()->create([
            'enrollment_code' => 'JOINME01',
            'department'      => 'College of Engineering',
        ]);
        $athlete = $this->actingAsRole('athlete', ['department' => 'College of Business']);

        $this->postJson('/api/enroll', ['enrollmentCode' => 'JOINME01'])
            ->assertStatus(400)
            ->assertJsonFragment(['error' => 'This code belongs to College of Engineering. Your account is registered under College of Business.']);

        $this->assertNull($athlete->fresh()->coach_id);
    }

    public function test_enroll_fails_when_the_coach_has_no_department(): void
    {
        $this->users()->create([
            'role'            => 'coach',
            'enrollment_code' => 'JOINME01',
            'sports'          => ['Chess'],
            'department'      => null,
        ]);
        $this->actingAsRole('athlete', ['department' => 'College of Engineering']);

        $this->postJson('/api/enroll', ['enrollmentCode' => 'JOINME01'])
            ->assertStatus(400)
            ->assertJsonFragment(['error' => 'This coach has not been assigned to a department yet. Please contact your administrator.']);
    }

    public function test_enroll_rejects_an_unknown_code(): void
    {
        $this->actingAsRole('athlete');

        $this->postJson('/api/enroll', ['enrollmentCode' => 'NOPE'])
            ->assertStatus(400)
            ->assertJsonFragment(['error' => 'Invalid enrollment code']);
    }

    public function test_enroll_requires_a_code(): void
    {
        $this->actingAsRole('athlete');

        $this->postJson('/api/enroll', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors('enrollmentCode');
    }

    public function test_athlete_cannot_enroll_twice(): void
    {
        $coach = $this->users()->coach()->create(['enrollment_code' => 'JOINME01']);
        $this->actingAsRole('athlete', ['coach_id' => $coach->id]);

        $this->postJson('/api/enroll', ['enrollmentCode' => 'JOINME01'])
            ->assertStatus(400)
            ->assertJsonFragment(['error' => 'You are already enrolled with a coach']);
    }

    public function test_athlete_can_unenroll(): void
    {
        $coach = $this->users()->coach()->create();
        $athlete = $this->actingAsRole('athlete', [
            'coach_id' => $coach->id, 'coach_name' => $coach->name, 'enrolled_at' => now(),
        ]);

        $this->deleteJson('/api/unenroll')->assertOk();

        $athlete->refresh();
        $this->assertNull($athlete->coach_id);
        $this->assertNull($athlete->enrolled_at);
    }

    public function test_my_coach_reflects_enrollment_state(): void
    {
        $athlete = $this->actingAsRole('athlete');
        $this->getJson('/api/my-coach')->assertOk()->assertJsonFragment(['enrolled' => false]);

        $coach = $this->users()->coach()->create(['email' => 'thecoach@x.com']);
        $athlete->update(['coach_id' => $coach->id]);

        $this->getJson('/api/my-coach')
            ->assertOk()
            ->assertJsonFragment(['enrolled' => true])
            ->assertJsonPath('coach.email', 'thecoach@x.com');
    }
}
