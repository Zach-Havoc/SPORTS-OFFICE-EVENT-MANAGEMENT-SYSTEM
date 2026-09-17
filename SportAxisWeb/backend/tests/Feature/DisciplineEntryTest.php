<?php

namespace Tests\Feature;

use App\Models\DisciplineEntry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The coach-owned racquet line-up.
 *
 *   GET    /api/discipline-entries?category=…   (public)
 *   POST   /api/discipline-entries              (coach; owns the athlete)
 *   DELETE /api/discipline-entries/{id}         (coach; owns the row)
 *
 * The 12 line categories ("Badminton — M Singles A" …) are created by the
 * seed migration, so tests can reference them directly.
 */
class DisciplineEntryTest extends TestCase
{
    use RefreshDatabase;

    private const SINGLES_A = 'Badminton — M Singles A';

    private const DOUBLES = 'Badminton — M Doubles';

    private function coach(string $department = 'College of Engineering')
    {
        return $this->actingAsRole('coach', ['department' => $department]);
    }

    public function test_a_coach_assigns_an_owned_athlete_to_a_singles_line(): void
    {
        $coach = $this->coach();
        $athlete = $this->athletes()->create(['coach_id' => $coach->id, 'department' => 'College of Engineering']);

        $this->postJson('/api/discipline-entries', [
            'category' => self::SINGLES_A,
            'athleteId' => $athlete->id,
        ])->assertCreated()
            ->assertJsonPath('department', 'College of Engineering')
            ->assertJsonPath('athleteName', trim("{$athlete->first_name} {$athlete->last_name}"));

        $this->assertDatabaseCount('discipline_entries', 1);
    }

    public function test_a_coach_cannot_assign_another_coachs_athlete(): void
    {
        $otherCoach = $this->users()->coach()->create();
        $athlete = $this->athletes()->create(['coach_id' => $otherCoach->id]);

        $this->coach();
        $this->postJson('/api/discipline-entries', [
            'category' => self::SINGLES_A,
            'athleteId' => $athlete->id,
        ])->assertStatus(422)->assertJsonValidationErrors('athleteId');
    }

    public function test_re_picking_a_singles_line_swaps_the_athlete(): void
    {
        $coach = $this->coach();
        $a = $this->athletes()->create(['coach_id' => $coach->id, 'first_name' => 'Ana',  'last_name' => 'Reyes']);
        $b = $this->athletes()->create(['coach_id' => $coach->id, 'first_name' => 'Bea',  'last_name' => 'Cruz']);

        $this->postJson('/api/discipline-entries', ['category' => self::SINGLES_A, 'athleteId' => $a->id])->assertCreated();
        $this->postJson('/api/discipline-entries', ['category' => self::SINGLES_A, 'athleteId' => $b->id])->assertCreated();

        $rows = DisciplineEntry::where('category', self::SINGLES_A)->get();
        $this->assertCount(1, $rows);
        $this->assertSame('Bea Cruz', $rows->first()->athlete_name);
    }

    public function test_doubles_line_takes_two_athletes_by_pair_slot(): void
    {
        $coach = $this->coach();
        $c = $this->athletes()->create(['coach_id' => $coach->id]);
        $d = $this->athletes()->create(['coach_id' => $coach->id]);

        $this->postJson('/api/discipline-entries', ['category' => self::DOUBLES, 'athleteId' => $c->id, 'pairSlot' => 'C'])->assertCreated();
        $this->postJson('/api/discipline-entries', ['category' => self::DOUBLES, 'athleteId' => $d->id, 'pairSlot' => 'D'])->assertCreated();

        $this->assertSame(2, DisciplineEntry::where('category', self::DOUBLES)->count());
    }

    public function test_doubles_requires_a_pair_slot(): void
    {
        $coach = $this->coach();
        $a = $this->athletes()->create(['coach_id' => $coach->id]);

        $this->postJson('/api/discipline-entries', ['category' => self::DOUBLES, 'athleteId' => $a->id])
            ->assertStatus(422)->assertJsonValidationErrors('pairSlot');
    }

    public function test_a_non_discipline_category_is_rejected(): void
    {
        $coach = $this->coach();
        $this->categories()->create(['name' => 'Basketball', 'format' => 'versus']);
        $a = $this->athletes()->create(['coach_id' => $coach->id]);

        $this->postJson('/api/discipline-entries', ['category' => 'Basketball', 'athleteId' => $a->id])
            ->assertStatus(422)->assertJsonValidationErrors('category');
    }

    public function test_public_can_read_entries_by_category(): void
    {
        $this->disciplineEntries()->create([
            'category' => self::SINGLES_A, 'department' => 'CET', 'athlete_name' => 'Santos',
        ]);

        $this->getJson('/api/discipline-entries?category='.urlencode(self::SINGLES_A))
            ->assertOk()
            ->assertJsonPath('0.athleteName', 'Santos')
            ->assertJsonPath('0.department', 'CET');
    }

    public function test_a_coach_owns_deletion(): void
    {
        $coach = $this->coach();
        $mine = $this->disciplineEntries()->create(['coach_id' => $coach->id]);
        $otherCoach = $this->users()->coach()->create();
        $theirs = $this->disciplineEntries()->create(['coach_id' => $otherCoach->id]);

        $this->deleteJson("/api/discipline-entries/{$theirs->id}")->assertNotFound();
        $this->deleteJson("/api/discipline-entries/{$mine->id}")->assertOk();
        $this->assertDatabaseMissing('discipline_entries', ['id' => $mine->id]);
    }
}
