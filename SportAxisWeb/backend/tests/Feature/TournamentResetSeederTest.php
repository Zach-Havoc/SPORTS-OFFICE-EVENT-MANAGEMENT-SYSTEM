<?php

namespace Tests\Feature;

use App\Models\Athlete;
use App\Models\CampusStudent;
use App\Models\Category;
use App\Models\Event;
use App\Models\User;
use Database\Seeders\TournamentResetSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * The production reset: wipes everything but the admin and the site's setup,
 * then seeds 10 coaches (one per college, all seven sports), 10 men + 10
 * women per sport per coach, 10 judges and a sample schedule.
 */
class TournamentResetSeederTest extends TestCase
{
    use RefreshDatabase;

    private const SPORTS = ['Basketball', 'Volleyball', 'Beach Volleyball', 'Sepak Takraw', 'Badminton', 'Table Tennis', 'Chess'];

    public function test_it_resets_to_a_full_intramurals_keeping_the_admin_and_setup(): void
    {
        // A site in use.
        $admin = $this->users()->create(['role' => 'admin', 'email' => 'office@batstate-u.edu.ph']);
        $token = $admin->createToken('web')->plainTextToken;
        $colleges = collect(['CICS', 'CABEIHM', 'CAS', 'CoE', 'CTE', 'CIT', 'CONAHS', 'CCJE', 'CoB', 'CoEd'])
            ->map(fn ($abbr) => $this->departments()->create(['name' => "College {$abbr} Test", 'abbreviation' => $abbr]));
        $venue = $this->venues()->create(['created_by' => $this->users()->create(['role' => 'coach'])->id]);
        $oldCoach = $this->users()->create(['role' => 'coach', 'email' => 'old.coach@x.test']);
        $this->athletes()->create(['coach_id' => $oldCoach->id]);
        $oldGame = $this->events()->create();
        $real = $this->campusStudents()->create(['sr_code' => '23-12345']);

        $this->seed(TournamentResetSeeder::class);

        // Kept: the admin (still signed in), colleges, venue, registry.
        $this->assertNotNull(User::find($admin->id));
        $this->getJson('/api/user', ['Authorization' => "Bearer {$token}"])->assertOk();
        $this->assertSame(10, DB::table('departments')->count());
        $this->assertNotNull(DB::table('venues')->where('id', $venue->id)->first());
        $this->assertNull(DB::table('venues')->where('id', $venue->id)->value('created_by'));   // its creator is gone
        $this->assertNotNull(CampusStudent::find($real->sr_code));

        // Wiped: other accounts and their games.
        $this->assertNull(User::find($oldCoach->id));
        $this->assertNull(Event::find($oldGame->id));

        // The seven sports, with the racquet sports' Men's and Women's lines.
        foreach (self::SPORTS as $sport) {
            $this->assertNotNull(Category::where('name', $sport)->first(), "{$sport} missing");
        }
        $this->assertSame(6, Category::where('parent_sport', 'Badminton')->whereNotNull('parent_id')->count());

        // 10 coaches, one per college, all seven sports.
        $coaches = User::where('role', 'coach')->get();
        $this->assertCount(10, $coaches);
        $this->assertCount(10, $coaches->pluck('department_id')->unique());
        $this->assertEqualsCanonicalizing(
            array_map(fn ($n) => "coach{$n}@g.batstate-u.edu.ph", range(1, 10)),
            $coaches->pluck('email')->all(),
        );

        foreach ($coaches as $coach) {
            $this->assertSame('Men & Women', $coach->gender_category);
            $this->assertCount(7, $coach->sportCategories);
            $team = Athlete::where('coach_id', $coach->id)->with('account')->get();
            foreach (self::SPORTS as $sport) {
                $players = $team->where('sport', $sport);
                $this->assertSame(10, $players->filter(fn ($a) => $a->account->gender === 'Male')->count(), "{$coach->email} {$sport} men");
                $this->assertSame(10, $players->filter(fn ($a) => $a->account->gender === 'Female')->count(), "{$coach->email} {$sport} women");
                $this->assertSame(20, $players->pluck('jersey_number')->unique()->count());   // jerseys unique per sport
            }
        }

        $this->assertSame(1400, User::where('role', 'athlete')->count());
        $this->assertSame(1400, User::where('role', 'athlete')->distinct()->count('name'));
        $this->assertSame(10, User::where('role', 'judge')->count());
        $this->postJson('/api/login', ['email' => 'athlete1400@g.batstate-u.edu.ph', 'password' => 'demo1234'])->assertOk();

        // A sample schedule: every sport, Men's and Women's, two different colleges, a judge each.
        $games = Event::all();
        $this->assertCount(28, $games);
        foreach ($games as $game) {
            $this->assertCount(2, array_unique($game->departments));
            $this->assertCount(1, $game->judges);
            $this->assertSame('upcoming', $game->status);
            $this->assertNotNull($game->category_id, "{$game->category} not linked to a sport");
        }
        $this->assertSame(2, $games->where('name', "Women's Sepak Takraw")->count());
    }

    public function test_it_refuses_to_reset_a_site_with_no_admin(): void
    {
        $coach = $this->users()->create(['role' => 'coach']);

        try {
            $this->seed(TournamentResetSeeder::class);
            $this->fail('It should have refused.');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('No admin account', $e->getMessage());
        }
        $this->assertNotNull(User::find($coach->id));
    }
}
