<?php

namespace Tests\Feature;

use App\Models\Athlete;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A coach's roster record (`athletes`) and the athlete's own login account
 * (`users`) are tied together by `athletes.user_id`. While linked, the account
 * owns the athlete's name and email — the coach sees whatever the athlete set
 * and cannot overwrite it from the roster form.
 */
class AthleteAccountLinkTest extends TestCase
{
    use RefreshDatabase;

    public function test_adding_an_athlete_by_a_matching_email_links_the_account(): void
    {
        $account = $this->users()->athlete()->create([
            'name' => 'Maria Cruz', 'email' => 'maria@student.edu',
        ]);
        $coach = $this->actingAsRole('coach');

        $this->postJson('/api/athletes', [
            'studentId' => '24-10001',
            'firstName' => 'Mary',            // coach's guess — dropped once linked
            'lastName' => 'C',
            'email' => 'MARIA@STUDENT.EDU', // case-insensitive match
            'department' => 'College of Engineering',
        ])->assertCreated();

        // The roster row only links; identity is left to the account.
        $this->assertDatabaseHas('athletes', [
            'coach_id' => $coach->id,
            'user_id' => $account->id,
            'first_name' => '',
            'student_id' => null,
        ]);

        $this->getJson('/api/athletes')
            ->assertOk()
            ->assertJsonFragment(['first_name' => 'Maria', 'last_name' => 'Cruz']);
    }

    public function test_renaming_the_account_updates_the_coachs_roster(): void
    {
        $account = $this->users()->athlete()->create([
            'name' => 'Maria Cruz', 'email' => 'maria@student.edu',
        ]);
        $coach = $this->users()->coach()->create();
        $this->athletes()->create([
            'coach_id' => $coach->id, 'user_id' => $account->id,
            'first_name' => 'Maria', 'last_name' => 'Cruz', 'email' => 'maria@student.edu',
        ]);

        $this->loginAs($account);
        $this->putJson('/api/account/profile', ['name' => 'Maria Santos-Cruz'])->assertOk();

        $this->loginAs($coach);
        $this->getJson('/api/athletes')
            ->assertOk()
            ->assertJsonFragment(['first_name' => 'Maria', 'last_name' => 'Santos-Cruz']);
    }

    public function test_coach_can_only_change_status_never_personal_details(): void
    {
        $account = $this->users()->athlete()->create([
            'name' => 'Leo Tan', 'email' => 'leo@student.edu',
        ]);
        $coach = $this->actingAsRole('coach');
        $athlete = $this->athletes()->create([
            'coach_id' => $coach->id, 'user_id' => $account->id,
            'first_name' => 'Leo', 'last_name' => 'Tan', 'email' => 'leo@student.edu',
            'year_level' => '1st Year', 'status' => 'active',
        ]);

        $this->putJson("/api/athletes/{$athlete->id}", [
            'firstName' => 'Hacked',
            'lastName' => 'Name',
            'yearLevel' => '3rd Year',
            'status' => 'injured',
        ])->assertOk()
            ->assertJsonFragment(['first_name' => 'Leo', 'last_name' => 'Tan']);

        $fresh = $athlete->fresh();
        $this->assertSame('1st Year', $fresh->year_level);
        $this->assertSame('injured', $fresh->status);
    }

    public function test_adding_the_same_linked_account_twice_is_rejected(): void
    {
        $account = $this->users()->athlete()->create(['email' => 'dup@student.edu']);
        $coach = $this->actingAsRole('coach');
        $this->athletes()->create([
            'coach_id' => $coach->id, 'user_id' => $account->id, 'email' => 'dup@student.edu',
        ]);

        $this->postJson('/api/athletes', [
            'studentId' => '24-20002',
            'firstName' => 'A', 'lastName' => 'B',
            'email' => 'dup@student.edu',
            'department' => 'College of Engineering',
        ])->assertStatus(422)->assertJsonFragment(['error' => 'This athlete is already on your roster.']);
    }

    public function test_enrolling_creates_one_linked_roster_row(): void
    {
        $coach = $this->users()->coach()->create(['department' => 'College of Engineering']);
        $account = $this->users()->athlete()->create([
            'name' => 'Sam Reyes', 'department' => 'College of Engineering',
        ]);

        $this->loginAs($account);
        $this->postJson('/api/enroll', ['enrollmentCode' => $coach->enrollment_code])
            ->assertOk()
            ->assertJsonFragment(['message' => 'Enrolled successfully']);

        $this->assertDatabaseHas('athletes', [
            'user_id' => $account->id, 'coach_id' => $coach->id, 'enrolled_via_code' => true,
        ]);

        $this->loginAs($coach);
        $this->getJson('/api/athletes')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonFragment(['first_name' => 'Sam', 'last_name' => 'Reyes']);
    }

    public function test_enrolling_reuses_a_roster_row_the_coach_already_added(): void
    {
        $coach = $this->users()->coach()->create(['department' => 'College of Engineering']);
        $account = $this->users()->athlete()->create([
            'name' => 'Ana Lim', 'email' => 'ana@student.edu', 'department' => 'College of Engineering',
        ]);
        // Coach added her earlier by email that didn't match an account yet.
        $row = $this->athletes()->create([
            'coach_id' => $coach->id, 'user_id' => null, 'email' => 'ana@student.edu',
            'first_name' => 'Ana', 'last_name' => 'L', 'student_id' => '24-30003',
        ]);

        $this->loginAs($account);
        $this->postJson('/api/enroll', ['enrollmentCode' => $coach->enrollment_code])->assertOk();

        $this->assertDatabaseHas('athletes', ['id' => $row->id, 'user_id' => $account->id]);

        $this->loginAs($coach);
        $this->getJson('/api/athletes')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_unenrolling_removes_the_athlete_from_the_roster(): void
    {
        $coach = $this->users()->coach()->create(['department' => 'College of Engineering']);
        $account = $this->users()->athlete()->create(['department' => 'College of Engineering']);

        $this->loginAs($account);
        $this->postJson('/api/enroll', ['enrollmentCode' => $coach->enrollment_code])->assertOk();
        $this->deleteJson('/api/unenroll')->assertOk();

        $this->loginAs($coach);
        $this->getJson('/api/athletes')->assertOk()->assertJsonCount(0, 'data');
    }
}
