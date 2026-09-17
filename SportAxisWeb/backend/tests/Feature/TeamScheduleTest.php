<?php

namespace Tests\Feature;

use App\Models\Category;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * GET /api/athlete/schedule and GET /api/coach/schedule — each sees only their
 * own team's fixtures.
 *
 * "Their team" is (their college) x (their sport), resolved by key on both
 * sides: the college through `event_department`, the sport through
 * `events.category_id` including any discipline whose `parent_id` is that
 * sport. An athlete has one rostered sport; a coach can handle several.
 */
class TeamScheduleTest extends TestCase
{
    use RefreshDatabase;

    /** An athlete rostered for $sport at $college, plus their account. */
    private function athleteFor($college, $sport)
    {
        $account = $this->users()->athlete()->create([
            'department' => $college->name,
            'department_id' => $college->id,
        ]);
        $this->athletes()->create([
            'user_id' => $account->id,
            'sport' => $sport->name,
            'category_id' => $sport->id,
        ]);

        return $account;
    }

    /** An event of $sport contested by the given colleges. */
    private function game(string $name, $sport, array $colleges, array $extra = [])
    {
        return $this->events()->create(array_merge([
            'name' => $name,
            'category' => $sport->name,
            'departments' => collect($colleges)->pluck('name')->all(),
        ], $extra));
    }

    public function test_the_schedule_requires_an_athlete(): void
    {
        $this->getJson('/api/athlete/schedule')->assertUnauthorized();

        $this->actingAsRole('coach');
        $this->getJson('/api/athlete/schedule')->assertForbidden();
    }

    public function test_it_shows_only_the_athletes_own_college_and_sport(): void
    {
        $cics = $this->departments()->create(['name' => 'College of Informatics and Computing Sciences', 'abbreviation' => 'CICS']);
        $cet = $this->departments()->create(['name' => 'College of Engineering', 'abbreviation' => 'CoE']);
        $basketball = $this->categories()->create(['name' => 'Basketball']);
        $volleyball = $this->categories()->create(['name' => 'Volleyball']);

        $mine = $this->game('CICS vs CoE — Basketball', $basketball, [$cics, $cet]);
        $this->game('Not my sport', $volleyball, [$cics, $cet]);      // right college, wrong sport
        $this->game('Not my college', $basketball, [$cet, $cet]);      // right sport, wrong college

        $this->loginAs($this->athleteFor($cics, $basketball));

        $res = $this->getJson('/api/athlete/schedule')->assertOk();

        $this->assertCount(1, $res->json('events'));
        $this->assertSame($mine->id, $res->json('events.0.id'));
        $this->assertSame('CICS', $res->json('team.collegeAbbreviation'));
        $this->assertSame(['Basketball'], $res->json('team.sports'));
    }

    public function test_it_names_the_opponent_and_excludes_the_athletes_own_college(): void
    {
        $cics = $this->departments()->create(['name' => 'College of Informatics and Computing Sciences', 'abbreviation' => 'CICS']);
        $cet = $this->departments()->create(['name' => 'College of Engineering', 'abbreviation' => 'CoE']);
        $basketball = $this->categories()->create(['name' => 'Basketball']);

        $this->game('Round 1', $basketball, [$cics, $cet]);
        $this->loginAs($this->athleteFor($cics, $basketball));

        $opponents = $this->getJson('/api/athlete/schedule')->assertOk()->json('events.0.opponents');

        $this->assertCount(1, $opponents);
        $this->assertSame('CoE', $opponents[0]['abbreviation']);
    }

    /** A Badminton player must still see "Badminton — M Singles A". */
    public function test_it_includes_the_disciplines_played_under_the_athletes_sport(): void
    {
        $cics = $this->departments()->create(['name' => 'College of Informatics and Computing Sciences', 'abbreviation' => 'CICS']);
        $cet = $this->departments()->create(['name' => 'College of Engineering', 'abbreviation' => 'CoE']);
        // 2026_09_03_000003 seeds the six Badminton lines; the parent sport row
        // comes from the admin's sport list. Reuse whichever already exist.
        $badminton = Category::firstOrCreate(
            ['name' => 'Badminton'],
            ['id' => (string) Str::uuid(), 'description' => 'Badminton']
        );
        $singlesA = Category::firstOrCreate(
            ['name' => 'Badminton — M Singles A'],
            ['id' => (string) Str::uuid(), 'parent_sport' => 'Badminton']
        );
        $singlesA->update(['parent_id' => $badminton->id]);

        $this->game('Quarter-Finals', $singlesA, [$cics, $cet]);
        $this->loginAs($this->athleteFor($cics, $badminton));

        $this->getJson('/api/athlete/schedule')
            ->assertOk()
            ->assertJsonCount(1, 'events')
            ->assertJsonPath('events.0.category', 'Badminton — M Singles A');
    }

    /** The college is matched by key, so name-vs-abbreviation spellings still line up. */
    public function test_it_matches_the_college_by_key_not_by_spelling(): void
    {
        $cics = $this->departments()->create(['name' => 'College of Informatics and Computing Sciences', 'abbreviation' => 'CICS']);
        $cet = $this->departments()->create(['name' => 'College of Engineering', 'abbreviation' => 'CoE']);
        $basketball = $this->categories()->create(['name' => 'Basketball']);

        $this->game('Round 1', $basketball, [$cics, $cet]);

        // The account stores the abbreviation; the event stores the full name.
        $account = $this->users()->athlete()->create(['department' => 'CICS', 'department_id' => $cics->id]);
        $this->athletes()->create(['user_id' => $account->id, 'sport' => 'Basketball', 'category_id' => $basketball->id]);
        $this->loginAs($account);

        $this->getJson('/api/athlete/schedule')->assertOk()->assertJsonCount(1, 'events');
    }

    public function test_a_newly_created_event_appears_without_any_extra_wiring(): void
    {
        $cics = $this->departments()->create(['name' => 'College of Informatics and Computing Sciences', 'abbreviation' => 'CICS']);
        $cet = $this->departments()->create(['name' => 'College of Engineering', 'abbreviation' => 'CoE']);
        $basketball = $this->categories()->create(['name' => 'Basketball']);
        $athlete = $this->athleteFor($cics, $basketball);

        $this->loginAs($athlete);
        $this->getJson('/api/athlete/schedule')->assertOk()->assertJsonCount(0, 'events');

        // An admin schedules the game through the normal endpoint.
        $this->actingAsRole('admin');
        $this->postJson('/api/events', [
            'name' => 'Semi-Final', 'category' => 'Basketball',
            'schedule' => now()->addWeek()->toDateString(),
            'startTime' => '09:00', 'endTime' => '10:00',
            'departments' => [$cics->name, $cet->name],
        ])->assertCreated();

        $this->loginAs($athlete);
        $this->getJson('/api/athlete/schedule')
            ->assertOk()
            ->assertJsonCount(1, 'events')
            ->assertJsonPath('events.0.name', 'Semi-Final');
    }

    public function test_it_explains_an_empty_schedule_instead_of_just_showing_nothing(): void
    {
        $basketball = $this->categories()->create(['name' => 'Basketball']);
        $cics = $this->departments()->create(['name' => 'College of Informatics and Computing Sciences', 'abbreviation' => 'CICS']);

        // No college on the account.
        $noCollege = $this->users()->athlete()->create(['department' => null, 'department_id' => null]);
        $this->athletes()->create(['user_id' => $noCollege->id, 'category_id' => $basketball->id]);
        $this->loginAs($noCollege);
        $this->getJson('/api/athlete/schedule')->assertOk()->assertJsonPath('reason', 'no_college');

        // College but no rostered sport.
        $noSport = $this->users()->athlete()->create(['department' => $cics->name, 'department_id' => $cics->id]);
        $this->athletes()->create(['user_id' => $noSport->id, 'sport' => null, 'category_id' => null]);
        $this->loginAs($noSport);
        $this->getJson('/api/athlete/schedule')->assertOk()->assertJsonPath('reason', 'no_sport');

        // Everything set, simply no games yet.
        $this->loginAs($this->athleteFor($cics, $basketball));
        $this->getJson('/api/athlete/schedule')->assertOk()->assertJsonPath('reason', 'no_games');
    }

    // ── coach side ────────────────────────────────────────────────────────

    /** A coach handling two sports sees both, and nothing from other colleges. */
    public function test_a_coach_sees_every_sport_they_handle_for_their_college(): void
    {
        $cics = $this->departments()->create(['name' => 'College of Informatics and Computing Sciences', 'abbreviation' => 'CICS']);
        $cet = $this->departments()->create(['name' => 'College of Engineering', 'abbreviation' => 'CoE']);
        $basketball = $this->categories()->create(['name' => 'Basketball']);
        $volleyball = $this->categories()->create(['name' => 'Volleyball']);
        $chess = $this->categories()->create(['name' => 'Chess']);

        $this->game('Basketball R1', $basketball, [$cics, $cet]);
        $this->game('Volleyball R1', $volleyball, [$cics, $cet]);
        $this->game('Chess R1', $chess, [$cics, $cet]);        // a sport they do not handle
        $this->game('Someone else', $basketball, [$cet, $cet]); // not their college

        $coach = $this->users()->coach()->create([
            'department' => $cics->name,
            'department_id' => $cics->id,
            'sport' => 'Basketball',
            'sports' => ['Basketball', 'Volleyball'],
        ]);
        $this->loginAs($coach);

        $res = $this->getJson('/api/coach/schedule')->assertOk();

        $names = collect($res->json('events'))->pluck('name')->sort()->values()->all();
        $this->assertSame(['Basketball R1', 'Volleyball R1'], $names);
        $this->assertSame('CICS', $res->json('team.collegeAbbreviation'));
        $this->assertEqualsCanonicalizing(['Basketball', 'Volleyball'], $res->json('team.sports'));
    }

    /** Changing the sports a coach handles re-keys them without any extra call. */
    public function test_updating_a_coachs_sports_updates_their_schedule(): void
    {
        $cics = $this->departments()->create(['name' => 'College of Informatics and Computing Sciences', 'abbreviation' => 'CICS']);
        $cet = $this->departments()->create(['name' => 'College of Engineering', 'abbreviation' => 'CoE']);
        $basketball = $this->categories()->create(['name' => 'Basketball']);
        $volleyball = $this->categories()->create(['name' => 'Volleyball']);

        $this->game('Basketball R1', $basketball, [$cics, $cet]);
        $this->game('Volleyball R1', $volleyball, [$cics, $cet]);

        $coach = $this->users()->coach()->create([
            'department' => $cics->name, 'department_id' => $cics->id,
            'sport' => 'Basketball', 'sports' => ['Basketball'],
        ]);
        $this->loginAs($coach);
        $this->getJson('/api/coach/schedule')->assertOk()->assertJsonCount(1, 'events');

        $coach->update(['sports' => ['Basketball', 'Volleyball']]);

        $this->getJson('/api/coach/schedule')->assertOk()->assertJsonCount(2, 'events');
    }

    public function test_the_coach_schedule_is_coach_only(): void
    {
        $this->getJson('/api/coach/schedule')->assertUnauthorized();

        $this->actingAsRole('athlete');
        $this->getJson('/api/coach/schedule')->assertForbidden();
    }
}
