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

    public function test_it_seeds_coaches_athletes_and_judges_and_can_run_again(): void
    {
        foreach (['College of Informatics and Computing Sciences' => 'CICS', 'College of Accountancy, Business, Economics, and International Hospitality Management' => 'CABEIHM', 'College of Arts and Sciences' => 'CAS'] as $name => $abbr) {
            $this->departments()->create(['name' => $name, 'abbreviation' => $abbr]);
        }

        $this->seed(TestAccountsSeeder::class);
        $this->seed(TestAccountsSeeder::class);

        $this->assertSame(5, User::where('role', 'coach')->where('email', 'like', 'coach%@g.batstate-u.edu.ph')->count());
        $this->assertSame(10, User::where('role', 'athlete')->where('email', 'like', 'athlete%@g.batstate-u.edu.ph')->count());
        $this->assertSame(5, User::where('role', 'judge')->where('email', 'like', 'judge%@g.batstate-u.edu.ph')->count());

        $coach1 = User::where('email', 'coach1@g.batstate-u.edu.ph')->first();
        $this->assertNotNull($coach1->department_id);
        $this->assertSame(5, Athlete::where('coach_id', $coach1->id)->whereNotNull('jersey_number')->count());

        $this->postJson('/api/login', ['email' => 'athlete1@g.batstate-u.edu.ph', 'password' => 'demo1234'])->assertOk();
    }
}
