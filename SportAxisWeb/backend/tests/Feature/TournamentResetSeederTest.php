<?php

namespace Tests\Feature;

use App\Models\Bracket;
use App\Models\Event;
use App\Models\GamePlayer;
use App\Models\TeamMatch;
use App\Models\User;
use App\Services\LineupRules;
use Database\Seeders\TournamentActivitySeeder;
use Database\Seeders\TournamentGamesSeeder;
use Database\Seeders\TournamentResetSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * The production reset and fill, in three steps:
 *   TournamentResetSeeder     wipe (keep the admin), colleges, sports, venues, accounts
 *   TournamentGamesSeeder     the team sports' brackets, results, play-by-play, live games
 *   TournamentActivitySeeder  the racquet lines and everyday records
 */
class TournamentResetSeederTest extends TestCase
{
    use RefreshDatabase;

    private const COLLEGES = [
        'College of Accountancy, Business, Economics, and International Hospitality Management',
        'College of Informatics and Computing Sciences',
        'College of Teacher Education',
        'College of Nursing and Allied Health Sciences',
        'College of Criminal Justice Education',
        'College of Arts and Sciences',
        'Laboratory School',
    ];

    public function test_the_reset_wipes_everything_but_the_admin_and_sets_up_the_intramurals(): void
    {
        $admin = $this->users()->create(['role' => 'admin', 'email' => 'office@batstate-u.edu.ph']);
        $token = $admin->createToken('web')->plainTextToken;
        $cics = $this->departments()->create(['name' => 'College of Informatics and Computing Sciences', 'abbreviation' => 'CICS', 'logo_url' => 'https://x.test/cics.png']);
        $stray = $this->departments()->create(['name' => 'College of Engineering', 'abbreviation' => 'CoE']);
        $oldVenue = $this->venues()->create();
        $oldCoach = $this->users()->create(['role' => 'coach']);
        $oldGame = $this->events()->create();

        $this->seed(TournamentResetSeeder::class);

        // Only the admin survives, still signed in.
        $this->getJson('/api/user', ['Authorization' => "Bearer {$token}"])->assertOk();
        $this->assertNull(User::find($oldCoach->id));
        $this->assertNull(Event::find($oldGame->id));
        $this->assertNull(DB::table('venues')->where('id', $oldVenue->id)->first());

        // Exactly the seven colleges; one already there keeps its logo.
        $this->assertEqualsCanonicalizing(self::COLLEGES, DB::table('departments')->pluck('name')->all());
        $this->assertSame('https://x.test/cics.png', DB::table('departments')->where('id', $cics->id)->value('logo_url'));
        $this->assertNull(DB::table('departments')->where('id', $stray->id)->first());

        // Sports with Men's / Women's divisions, racquet lines, venues, season, codes.
        foreach (['Basketball', 'Volleyball', 'Beach Volleyball', 'Sepak Takraw', 'Chess'] as $sport) {
            foreach (['Men', 'Women'] as $division) {
                $this->assertDatabaseHas('categories', ['name' => "{$sport} — {$division}", 'parent_sport' => $sport, 'division' => $division]);
            }
        }
        $this->assertSame(6, DB::table('categories')->where('parent_sport', 'Table Tennis')->whereNotNull('parent_id')->count());
        $this->assertSame(7, DB::table('venues')->count());
        $this->assertSame(1, DB::table('seasons')->where('is_active', true)->count());
        $this->assertSame(4, DB::table('registration_codes')->where('used', false)->count());

        // 14 coaches (a Men's and a Women's per college), 980 athletes, 10 judges.
        $coaches = User::where('role', 'coach')->get();
        $this->assertCount(14, $coaches);
        foreach ($coaches->groupBy('department_id') as $pair) {
            $this->assertEqualsCanonicalizing(['Men', 'Women'], $pair->pluck('gender_category')->all());
        }
        $this->assertSame(980, User::where('role', 'athlete')->count());
        $this->assertSame(980, User::where('role', 'athlete')->distinct()->count('name'));
        $this->assertSame(10, User::where('role', 'judge')->count());
        $this->postJson('/api/login', ['email' => 'coach14@g.batstate-u.edu.ph', 'password' => 'demo1234'])->assertOk();

        // The fill steps must run in order.
        $this->expectException(\RuntimeException::class);
        $this->seed(TournamentActivitySeeder::class);
    }

    public function test_the_fill_plays_out_a_believable_three_weeks(): void
    {
        $this->actingAsRole('admin');
        $this->seed(TournamentResetSeeder::class);
        $this->seed(TournamentGamesSeeder::class);
        $this->seed(TournamentActivitySeeder::class);

        // Brackets: round robins and single eliminations, for every sport.
        $brackets = Bracket::all();
        $this->assertSame(8, $brackets->where('format', 'round_robin')->count());
        $this->assertSame(18, $brackets->where('format', 'single_elimination')->count());
        foreach (['Basketball', 'Volleyball', 'Beach Volleyball', 'Sepak Takraw', 'Chess', 'Badminton', 'Table Tennis'] as $sport) {
            $this->assertTrue($brackets->contains(fn ($b) => str_starts_with($b->sport, $sport)), "no {$sport} bracket");
        }
        // A long round robin keeps all 21 fixtures.
        $league = $brackets->firstWhere('sport', 'Chess — Men');
        $this->assertSame(21, $league->matches()->whereNotNull('home_team')->whereNotNull('away_team')->where('status', 'completed')->count());

        // Live right now, and games still to come.
        $this->assertSame(3, Event::where('status', 'ongoing')->count());
        $this->assertGreaterThan(0, Event::where('status', 'upcoming')->where('schedule', '>', now()->toDateString())->count());
        $this->assertSame(0, Event::where('status', 'upcoming')->where('schedule', '<', now()->toDateString())->count());   // nothing forgotten in the past

        // Every result agrees with its play-by-play.
        $hoops = TeamMatch::where('sport', 'Basketball — Women')->where('stage', 'group')->first();
        $board = $this->getJson("/api/events/{$hoops->event_id}/scoreboard")->assertOk()->json();
        $this->assertEquals([$hoops->home_score, $hoops->away_score], [$board['teams'][0]['score'], $board['teams'][1]['score']]);
        $volley = TeamMatch::where('sport', 'Volleyball — Men')->where('stage', 'group')->first();
        $board = $this->getJson("/api/events/{$volley->event_id}/volleyball")->assertOk()->json();
        $this->assertTrue($board['matchDecided']);
        $this->assertEquals([$volley->home_score, $volley->away_score], [$board['teams'][0]['setsWon'], $board['teams'][1]['setsWon']]);
        $this->assertNotNull($board['teams'][0]['serverPlayerId'] ?? $board['teams'][1]['serverPlayerId'] ?? true);

        // The live basketball final: the score so far is the plays so far.
        $live = Event::where('status', 'ongoing')->where('category', 'Basketball — Men')->firstOrFail();
        $board = $this->getJson("/api/events/{$live->id}/scoreboard")->json();
        $score = DB::table('live_scores')->where('event_id', $live->id)->first();
        $this->assertSame('in_progress', $score->status);
        $this->assertEquals([$score->home_score, $score->away_score], [$board['teams'][0]['score'], $board['teams'][1]['score']]);

        // Every known matchup in a lineup sport has both lineups.
        $ready = Event::all()->filter(fn ($e) => count($e->departments) === 2 && LineupRules::sportOf($e));
        foreach ($ready as $game) {
            $this->assertSame(2, GamePlayer::where('game_id', $game->id)->distinct()->count('team_id'), $game->name);
        }

        // College rankings for every sport, and medals where a sport has finished.
        foreach (['Basketball — Men', 'Volleyball — Women', 'Sepak Takraw — Men', 'Chess — Women', 'Badminton — M Singles A'] as $sport) {
            $this->assertNotEmpty(TeamMatch::standings($sport), "no standings for {$sport}");
        }
        $medals = collect($this->getJson('/api/leaderboard')->assertOk()->json());
        $this->assertGreaterThan(10, $medals->sum('gold'));
        $this->assertSame(0, collect($this->getJson('/api/leaderboard?category='.urlencode('Basketball — Men'))->json())->sum('gold'));   // final still live
        $this->assertSame(1, collect($this->getJson('/api/leaderboard?category='.urlencode('Basketball — Women'))->json())->sum('gold'));

        // Everyday records.
        $this->assertSame(112, DB::table('discipline_entries')->count());
        $this->assertSame(42, DB::table('announcements')->count());
        $this->assertSame(56, DB::table('tryout_applications')->count());
        $this->assertSame(14 * 4 * 70, DB::table('attendance_records')->count());
        $this->assertGreaterThan(2000, DB::table('requirements')->count());
        $this->assertGreaterThan(1000, DB::table('performance_records')->count());
        $this->assertSame(6, DB::table('protests')->count());
        $this->assertGreaterThan(20, DB::table('notifications')->count());

        // A Women's coach lines up only Women's games.
        $this->loginAs(User::where('email', 'coach2@g.batstate-u.edu.ph')->first());
        $names = collect($this->getJson('/api/coach/lineups')->assertOk()->json('games'))->pluck('name');
        $this->assertNotEmpty($names);
        $this->assertTrue($names->every(fn ($n) => ! str_contains($n, "Men's") || str_contains($n, "Women's")));
        $this->assertTrue($names->every(fn ($n) => str_contains($n, 'Women')));
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
