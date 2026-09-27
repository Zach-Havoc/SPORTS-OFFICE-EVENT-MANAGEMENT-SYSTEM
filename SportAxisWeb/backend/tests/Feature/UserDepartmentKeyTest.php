<?php

namespace Tests\Feature;

use App\Models\Category;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * An account's college key (`department_id`) follows its college name on
 * every save. The schedules and the coach's game lineups match by the key,
 * so an account with only the name saw no games at all.
 */
class UserDepartmentKeyTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_college_key_follows_the_name_or_abbreviation(): void
    {
        $cabe = $this->departments()->create(['name' => 'College of Business Test', 'abbreviation' => 'CBT']);
        $other = $this->departments()->create(['name' => 'College of Other Test', 'abbreviation' => 'COT']);

        $coach = $this->users()->create(['role' => 'coach', 'department' => 'College of Business Test']);
        $this->assertSame($cabe->id, $coach->fresh()->department_id);

        $coach->update(['department' => 'cot']);      // abbreviation, any case
        $this->assertSame($other->id, $coach->fresh()->department_id);

        $coach->update(['department' => '']);
        $this->assertNull($coach->fresh()->department_id);

        // A key set on its own is kept.
        $coach->update(['department_id' => $cabe->id]);
        $this->assertSame($cabe->id, $coach->fresh()->department_id);
    }

    public function test_a_coach_with_only_a_college_name_sees_their_games_to_line_up(): void
    {
        Category::firstOrCreate(['name' => 'Basketball'], ['id' => (string) Str::uuid()]);
        $home = $this->departments()->create(['name' => 'College of Hoops Key', 'abbreviation' => 'CHK']);
        $away = $this->departments()->create();
        $game = $this->events()->create(['category' => 'Basketball', 'departments' => [$home->name, $away->name]]);

        // Created the way the admin form does it: the name, no key.
        $this->actingAsRole('coach', ['department' => $home->name, 'sports' => ['Basketball']]);

        $this->getJson('/api/coach/lineups')->assertOk()->assertJsonPath('games.0.id', $game->id);
    }
}
