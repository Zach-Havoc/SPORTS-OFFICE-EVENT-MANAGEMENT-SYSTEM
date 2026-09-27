<?php

namespace Tests\Feature;

use App\Models\Athlete;
use App\Models\User;
use Database\Seeders\TestAccountsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** The numbered test accounts: complete, sign-in-able, and safe to seed twice. */
class TestAccountsSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_coach_is_a_different_college_with_at_least_ten_athletes(): void
    {
        foreach ([
            'College of Informatics and Computing Sciences' => 'CICS',
            'College of Accountancy, Business, Economics, and International Hospitality Management' => 'CABEIHM',
            'College of Arts and Sciences' => 'CAS',
            'College of Engineering' => 'CoE',
            'College of Teacher Education' => 'CTE',
        ] as $name => $abbr) {
            $this->departments()->create(['name' => $name, 'abbreviation' => $abbr]);
        }

        $this->seed(TestAccountsSeeder::class);
        $this->seed(TestAccountsSeeder::class);   // safe to run again

        $coaches = User::where('role', 'coach')->where('email', 'like', 'coach%@g.batstate-u.edu.ph')->get();
        $this->assertCount(5, $coaches);
        $this->assertCount(5, $coaches->pluck('department_id')->filter()->unique());   // five colleges

        foreach ($coaches as $coach) {
            $team = Athlete::where('coach_id', $coach->id)->get();
            $this->assertGreaterThanOrEqual(10, $team->count(), "{$coach->email} has too few athletes");
            foreach ($team->groupBy('sport') as $players) {
                $this->assertSame($players->count(), $players->pluck('jersey_number')->unique()->count());
            }
            // Everyone plays for their own college.
            $this->assertSame(0, User::whereIn('id', $team->pluck('user_id'))->where('department_id', '!=', $coach->department_id)->count());
        }

        $this->assertSame(70, User::where('role', 'athlete')->where('email', 'like', 'athlete%@g.batstate-u.edu.ph')->count());
        $this->assertSame(5, User::where('role', 'judge')->where('email', 'like', 'judge%@g.batstate-u.edu.ph')->count());
        $this->postJson('/api/login', ['email' => 'athlete70@g.batstate-u.edu.ph', 'password' => 'demo1234'])->assertOk();
    }
}
