<?php

namespace Tests\Feature;

use App\Models\Athlete;
use App\Models\Department;
use App\Models\TryoutApplication;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * An athlete can only join their own college's team — a CICS student can't
 * join CABEIHM's Basketball team — however they try: a coach's enrolment
 * code, a tryout application (and its acceptance), or the coach adding them.
 */
class TeamMembershipTest extends TestCase
{
    use RefreshDatabase;

    private Department $cics;

    private Department $cabe;

    private const REFUSED = "You can't join this team. It's CABEIHM's Basketball team, and you're from CICS. "
        ."Athletes can only join their own college's team.";

    protected function setUp(): void
    {
        parent::setUp();

        $this->cics = $this->departments()->create(['name' => 'College of Informatics and Computing Sciences', 'abbreviation' => 'CICS']);
        $this->cabe = $this->departments()->create(['name' => 'College of Accountancy, Business, Economics, and International Hospitality Management', 'abbreviation' => 'CABEIHM']);
    }

    private function cabeCoach(array $attrs = [])
    {
        return $this->users()->coach()->create([
            'enrollment_code' => 'CABEBALL',
            'sport' => 'Basketball',
            'department' => $this->cabe->name,
            ...$attrs,
        ]);
    }

    // ── Enrolment code ──────────────────────────────────────────────────

    public function test_an_athlete_cannot_enroll_on_another_colleges_team(): void
    {
        $this->cabeCoach();
        $athlete = $this->actingAsRole('athlete', ['department' => $this->cics->name]);

        $this->postJson('/api/enroll', ['enrollmentCode' => 'CABEBALL'])
            ->assertStatus(400)
            ->assertJsonPath('error', self::REFUSED);

        $this->assertNull($athlete->fresh()->coach_id);
        $this->assertSame(0, Athlete::count());
    }

    public function test_the_same_college_by_abbreviation_or_full_name_can_enroll(): void
    {
        $coach = $this->cabeCoach(['department' => 'CABEIHM']);
        $athlete = $this->actingAsRole('athlete', ['department' => $this->cabe->name]);

        $this->postJson('/api/enroll', ['enrollmentCode' => 'CABEBALL'])->assertOk();
        $this->assertSame($coach->id, $athlete->fresh()->coach_id);
    }

    // ── Tryouts ─────────────────────────────────────────────────────────

    private function applyAs(string $formCollege, string $coachId)
    {
        $this->emailVerifications()->create(['email' => 'sam@batstate-u.edu.ph', 'code' => '123456']);

        return $this->postJson('/api/tryouts/apply', [
            'firstName' => 'Sam', 'lastName' => 'Cruz', 'email' => 'sam@batstate-u.edu.ph',
            'studentId' => '24-00001', 'department' => $formCollege, 'phone' => '09123456789',
            'verificationCode' => '123456', 'coachId' => $coachId, 'sport' => 'Basketball',
        ]);
    }

    public function test_a_tryout_for_another_colleges_team_is_refused_by_the_registrar_college(): void
    {
        // The registrar has Sam in CICS…
        $this->campusStudents()->create([
            'sr_code' => '24-00001', 'first_name' => 'Sam', 'last_name' => 'Cruz',
            'email' => 'sam@batstate-u.edu.ph', 'college' => 'CICS',
        ]);
        $coach = $this->cabeCoach();

        // …so picking CABEIHM on the form doesn't get them onto CABEIHM's team.
        $this->applyAs($this->cabe->name, $coach->id)
            ->assertStatus(422)
            ->assertJsonPath('message', self::REFUSED);
        $this->assertSame(0, TryoutApplication::count());
    }

    public function test_the_student_is_told_before_a_code_is_mailed(): void
    {
        $this->campusStudents()->create([
            'sr_code' => '24-00001', 'first_name' => 'Sam', 'last_name' => 'Cruz',
            'email' => 'sam@batstate-u.edu.ph', 'college' => $this->cics->name,
        ]);

        $this->postJson('/api/tryouts/verify-email', [
            'email' => 'sam@batstate-u.edu.ph', 'studentId' => '24-00001', 'firstName' => 'Sam', 'lastName' => 'Cruz',
            'coachId' => $this->cabeCoach()->id,
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', self::REFUSED);
        $this->assertDatabaseMissing('email_verifications', ['email' => 'sam@batstate-u.edu.ph']);
    }

    public function test_a_tryout_for_your_own_colleges_team_goes_through(): void
    {
        $this->campusStudents()->create([
            'sr_code' => '24-00001', 'first_name' => 'Sam', 'last_name' => 'Cruz',
            'email' => 'sam@batstate-u.edu.ph', 'college' => $this->cabe->name,
        ]);

        $this->applyAs($this->cabe->name, $this->cabeCoach()->id)->assertCreated();
    }

    public function test_accepting_an_earlier_application_from_another_college_is_refused(): void
    {
        $coach = $this->cabeCoach();
        $app = $this->tryouts()->create(['coach_id' => $coach->id, 'department' => $this->cics->name]);
        $this->loginAs($coach);

        $this->putJson("/api/tryouts/{$app->id}/status", ['status' => 'accepted'])
            ->assertStatus(422)
            ->assertJsonPath('error', self::REFUSED);

        $this->assertSame('pending', $app->fresh()->status);
        $this->assertSame(0, Athlete::count());
    }

    // ── The coach adding an athlete ─────────────────────────────────────

    public function test_a_coach_cannot_add_an_athlete_from_another_college(): void
    {
        $this->loginAs($this->cabeCoach());
        $this->users()->create(['role' => 'athlete', 'email' => 'ben@batstate-u.edu.ph', 'department' => $this->cics->name]);

        $this->postJson('/api/athletes', [
            'studentId' => '24-00002', 'firstName' => 'Ben', 'lastName' => 'Uy', 'email' => 'ben@batstate-u.edu.ph',
        ])
            ->assertStatus(422)
            ->assertJsonPath('error', "This athlete can't join your team. They're from CICS, and yours is CABEIHM's Basketball team. "
                ."Athletes can only join their own college's team.");

        // A coach-added athlete with no account is checked by the college given.
        $this->postJson('/api/athletes', [
            'studentId' => '24-00003', 'firstName' => 'Cy', 'lastName' => 'Go', 'email' => 'cy@batstate-u.edu.ph',
            'department' => 'CICS',
        ])->assertStatus(422);

        $this->postJson('/api/athletes', [
            'studentId' => '24-00004', 'firstName' => 'Di', 'lastName' => 'Lim', 'email' => 'di@batstate-u.edu.ph',
            'department' => $this->cabe->name,
        ])->assertCreated();
    }
}
