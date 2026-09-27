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

    private const COLLEGES = [
        'College of Accountancy, Business, Economics, and International Hospitality Management',
        'College of Informatics and Computing Sciences',
        'College of Teacher Education',
        'College of Nursing and Allied Health Sciences',
        'College of Criminal Justice Education',
        'College of Arts and Sciences',
        'Laboratory School',
    ];

    public function test_it_resets_to_a_full_intramurals_keeping_the_admin_and_setup(): void
    {
        // A site in use.
        $admin = $this->users()->create(['role' => 'admin', 'email' => 'office@batstate-u.edu.ph']);
        $token = $admin->createToken('web')->plainTextToken;
        $cics = $this->departments()->create(['name' => 'College of Informatics and Computing Sciences', 'abbreviation' => 'CICS', 'logo_url' => 'https://x.test/cics.png']);
        $nursing = $this->departments()->create(['name' => 'Nursing (old name)', 'abbreviation' => 'CONHAS']);
        $stray = $this->departments()->create(['name' => 'College of Engineering', 'abbreviation' => 'CoE']);
        $venue = $this->venues()->create(['created_by' => $this->users()->create(['role' => 'coach'])->id]);
        $oldCoach = $this->users()->create(['role' => 'coach', 'email' => 'old.coach@x.test']);
        $this->athletes()->create(['coach_id' => $oldCoach->id]);
        $oldGame = $this->events()->create();
        $real = $this->campusStudents()->create(['sr_code' => '23-12345']);

        $this->seed(TournamentResetSeeder::class);

        // Kept: the admin (still signed in), venue, registry.
        $this->assertNotNull(User::find($admin->id));
        $this->getJson('/api/user', ['Authorization' => "Bearer {$token}"])->assertOk();
        $this->assertNotNull(DB::table('venues')->where('id', $venue->id)->first());
        $this->assertNull(DB::table('venues')->where('id', $venue->id)->value('created_by'));   // its creator is gone
        $this->assertNotNull(CampusStudent::find($real->sr_code));

        // Exactly the seven colleges; existing ones keep their row and logo.
        $this->assertEqualsCanonicalizing(self::COLLEGES, DB::table('departments')->pluck('name')->all());
        $this->assertSame('https://x.test/cics.png', DB::table('departments')->where('id', $cics->id)->value('logo_url'));
        $this->assertSame('College of Nursing and Allied Health Sciences', DB::table('departments')->where('id', $nursing->id)->value('name'));
        $this->assertNull(DB::table('departments')->where('id', $stray->id)->first());
        $this->assertSame('LS', DB::table('departments')->where('name', 'Laboratory School')->value('abbreviation'));

        // Wiped: other accounts and their games.
        $this->assertNull(User::find($oldCoach->id));
        $this->assertNull(Event::find($oldGame->id));

        // The seven sports, with the racquet sports' Men's and Women's lines.
        foreach (self::SPORTS as $sport) {
            $this->assertNotNull(Category::where('name', $sport)->first(), "{$sport} missing");
        }
        $this->assertSame(6, Category::where('parent_sport', 'Badminton')->whereNotNull('parent_id')->count());

        // 14 coaches: a Men's and a Women's per college, all seven sports.
        $coaches = User::where('role', 'coach')->get();
        $this->assertCount(14, $coaches);
        $this->assertEqualsCanonicalizing(
            array_map(fn ($n) => "coach{$n}@g.batstate-u.edu.ph", range(1, 14)),
            $coaches->pluck('email')->all(),
        );
        foreach ($coaches->groupBy('department_id') as $pair) {
            $this->assertEqualsCanonicalizing(['Men', 'Women'], $pair->pluck('gender_category')->all());
        }

        foreach ($coaches as $coach) {
            $this->assertCount(7, $coach->sportCategories);
            $gender = $coach->gender_category === 'Men' ? 'Male' : 'Female';
            $team = Athlete::where('coach_id', $coach->id)->with('account')->get();
            foreach (self::SPORTS as $sport) {
                $players = $team->where('sport', $sport);
                $this->assertCount(10, $players, "{$coach->email} {$sport}");
                $this->assertTrue($players->every(fn ($a) => $a->account->gender === $gender));
                $this->assertTrue($players->every(fn ($a) => $a->account->department_id === $coach->department_id));
                $this->assertSame(10, $players->pluck('jersey_number')->unique()->count());
            }
        }

        $this->assertSame(980, User::where('role', 'athlete')->count());
        $this->assertSame(980, User::where('role', 'athlete')->distinct()->count('name'));
        $this->assertSame(10, User::where('role', 'judge')->count());
        $this->postJson('/api/login', ['email' => 'athlete980@g.batstate-u.edu.ph', 'password' => 'demo1234'])->assertOk();

        // A sample schedule: every sport, Men's and Women's, two different colleges, a judge each.
        $games = Event::all();
        $this->assertCount(28, $games);
        foreach ($games as $game) {
            $this->assertCount(2, array_unique($game->departments));
            $this->assertCount(1, $game->judges);
            $this->assertNotNull($game->category_id, "{$game->category} not linked to a sport");
        }

        // A Women's coach lines up only Women's games.
        $womensCoach = User::where('email', 'coach2@g.batstate-u.edu.ph')->first();
        $this->loginAs($womensCoach);
        $names = collect($this->getJson('/api/coach/lineups')->assertOk()->json('games'))->pluck('name');
        $this->assertNotEmpty($names);
        $this->assertTrue($names->every(fn ($n) => str_starts_with($n, "Women's")));
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
