<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Coach profile (coach) + coach administration (admin):
 *   GET/PUT /api/coach/profile
 *   GET     /api/admin/coaches
 *   PUT     /api/admin/coaches/{id}
 *
 * Intramurals model: a coach belongs to ONE department and runs one or more
 * sports for it; each (department, sport) team has exactly one coach.
 */
class CoachTest extends TestCase
{
    use RefreshDatabase;

    /** A valid PUT /coach/profile body (department is now required). */
    private function profile(array $overrides = []): array
    {
        return array_merge([
            'sports'         => ['Basketball'],
            'department'     => 'College of Engineering',
            'genderCategory' => 'Men',
        ], $overrides);
    }

    public function test_coach_profile_requires_a_coach(): void
    {
        $this->getJson('/api/coach/profile')->assertUnauthorized();

        $this->actingAsRole('athlete');
        $this->getJson('/api/coach/profile')->assertForbidden();
    }

    public function test_coach_can_read_their_profile(): void
    {
        $this->actingAsRole('coach', [
            'email'      => 'coach@x.com',
            'sport'      => 'Volleyball',
            'sports'     => ['Volleyball', 'Badminton'],
            'department' => 'College of Business',
        ]);

        $this->getJson('/api/coach/profile')
            ->assertOk()
            ->assertJsonFragment(['email' => 'coach@x.com', 'sport' => 'Volleyball'])
            ->assertJsonPath('sports', ['Volleyball', 'Badminton'])
            ->assertJsonPath('department', 'College of Business');
    }

    public function test_first_profile_save_generates_an_enrollment_code_and_a_registration_code(): void
    {
        // A fresh coach with no enrollment_code yet.
        $coach = $this->users()->create(['role' => 'coach']);
        $this->loginAs($coach);

        $this->putJson('/api/coach/profile', $this->profile())
            ->assertOk()
            ->assertJsonPath('sport', 'Basketball')
            ->assertJsonPath('sports', ['Basketball'])
            ->assertJsonPath('department', 'College of Engineering');

        $coach->refresh();
        $this->assertNotNull($coach->enrollment_code);
        $this->assertDatabaseHas('registration_codes', [
            'code'       => $coach->enrollment_code,
            'role'       => 'athlete',
            'created_by' => $coach->id,
        ]);
    }

    public function test_a_coach_can_handle_multiple_sports(): void
    {
        $coach = $this->actingAsRole('coach', ['enrollment_code' => 'HASCODE1']);
        // An already-enrolled athlete on a single previous sport.
        $athlete = $this->athletes()->create(['coach_id' => $coach->id, 'sport' => 'Basketball']);

        $this->putJson('/api/coach/profile', $this->profile(['sports' => ['Basketball', 'Volleyball']]))
            ->assertOk()
            ->assertJsonPath('sports', ['Basketball', 'Volleyball'])
            ->assertJsonPath('sport', 'Basketball'); // first entry is the primary

        $this->assertSame(['Basketball', 'Volleyball'], $coach->fresh()->sports);

        // With >1 sport the athlete keeps their own assignment (no blanket sync).
        $this->assertSame('Basketball', $athlete->fresh()->sport);
    }

    public function test_duplicate_and_blank_sports_are_de_duplicated(): void
    {
        $this->actingAsRole('coach', ['enrollment_code' => 'HASCODE1']);

        $this->putJson('/api/coach/profile', $this->profile(['sports' => ['Chess', ' Chess ', '', 'Arnis']]))
            ->assertOk()
            ->assertJsonPath('sports', ['Chess', 'Arnis']);
    }

    public function test_profile_update_requires_a_department(): void
    {
        $this->actingAsRole('coach');

        $this->putJson('/api/coach/profile', ['sports' => ['Basketball'], 'genderCategory' => 'Men'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('department');
    }

    public function test_profile_update_requires_at_least_one_sport(): void
    {
        $this->actingAsRole('coach');

        // department is present, so validation passes and the manual sports
        // check fires.
        $this->putJson('/api/coach/profile', $this->profile(['sports' => []]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('sports');
    }

    public function test_two_coaches_in_the_same_department_cannot_run_the_same_sport(): void
    {
        // Coach A already runs Basketball for College of Engineering.
        $this->users()->coach()->create([
            'department' => 'College of Engineering',
            'sport'      => 'Basketball',
            'sports'     => ['Basketball'],
        ]);

        // Coach B (same department) tries to claim Basketball too.
        $this->actingAsRole('coach', ['enrollment_code' => 'HASCODE1']);
        $this->putJson('/api/coach/profile', $this->profile([
            'sports'     => ['Basketball', 'Volleyball'],
            'department' => 'College of Engineering',
        ]))->assertStatus(422)->assertJsonValidationErrors('sports');

        // But a sport that's still free in that department is fine.
        $this->putJson('/api/coach/profile', $this->profile([
            'sports'     => ['Volleyball'],
            'department' => 'College of Engineering',
        ]))->assertOk();
    }

    public function test_the_same_sport_is_allowed_in_a_different_department(): void
    {
        $this->users()->coach()->create([
            'department' => 'College of Engineering',
            'sports'     => ['Basketball'],
        ]);

        $this->actingAsRole('coach', ['enrollment_code' => 'HASCODE1']);
        $this->putJson('/api/coach/profile', $this->profile([
            'sports'     => ['Basketball'],
            'department' => 'College of Business',
        ]))->assertOk();
    }

    public function test_changing_the_single_sport_still_cascades_to_athletes(): void
    {
        $coach = $this->actingAsRole('coach', ['enrollment_code' => 'HASCODE1']);
        $this->athletes()->create(['coach_id' => $coach->id, 'sport' => 'OldSport']);
        $this->users()->athlete()->create(['coach_id' => $coach->id, 'sport' => 'OldSport']);

        $this->putJson('/api/coach/profile', $this->profile(['sports' => ['NewSport']]))->assertOk();

        $this->assertDatabaseHas('athletes', ['coach_id' => $coach->id, 'sport' => 'NewSport']);
        $this->assertDatabaseHas('users', ['coach_id' => $coach->id, 'sport' => 'NewSport']);
    }

    public function test_legacy_single_sport_field_is_still_accepted(): void
    {
        $this->actingAsRole('coach', ['enrollment_code' => 'HASCODE1']);

        $this->putJson('/api/coach/profile', ['sport' => 'Football', 'department' => 'College of Engineering'])
            ->assertOk()
            ->assertJsonPath('sports', ['Football']);
    }

    public function test_admin_coaches_list_requires_an_admin_and_returns_only_coaches(): void
    {
        $this->users()->coach()->create(['name' => 'A Coach']);
        $this->users()->athlete()->create(['name' => 'An Athlete']);

        $this->getJson('/api/admin/coaches')->assertUnauthorized();

        $this->actingAsRole('coach');
        $this->getJson('/api/admin/coaches')->assertForbidden();

        $this->actingAsRole('admin');
        $this->getJson('/api/admin/coaches')
            ->assertOk()
            ->assertJsonFragment(['name' => 'A Coach'])
            ->assertJsonMissing(['name' => 'An Athlete']);
    }

    public function test_admin_can_assign_a_department_to_a_coach(): void
    {
        $this->actingAsRole('admin');
        $coach = $this->users()->create(['role' => 'coach', 'sports' => ['Chess']]);

        $this->putJson("/api/admin/coaches/{$coach->id}", ['department' => 'College of Education'])
            ->assertOk();

        $this->assertSame('College of Education', $coach->fresh()->department);
    }

    public function test_admin_cannot_move_a_coach_into_a_department_where_their_sport_is_taken(): void
    {
        $this->actingAsRole('admin');
        $this->users()->coach()->create(['department' => 'College of Education', 'sports' => ['Chess']]);
        $moving = $this->users()->create(['role' => 'coach', 'sports' => ['Chess']]);

        $this->putJson("/api/admin/coaches/{$moving->id}", ['department' => 'College of Education'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('department');
    }

    public function test_admin_cannot_target_a_non_coach_user(): void
    {
        $this->actingAsRole('admin');
        $athlete = $this->users()->athlete()->create();

        $this->putJson("/api/admin/coaches/{$athlete->id}", ['department' => 'X'])
            ->assertNotFound();
    }
}
