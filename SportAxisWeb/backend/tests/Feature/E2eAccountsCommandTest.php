<?php

namespace Tests\Feature;

use App\Console\Commands\E2eAccounts;
use App\Models\Athlete;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

/** The temporary accounts the Selenium suite signs in with. */
class E2eAccountsCommandTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        DB::table('departments')->insert([
            'id' => (string) Str::uuid(), 'name' => 'College of Arts and Sciences', 'abbreviation' => 'CAS',
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function accounts(string $action): array
    {
        Artisan::call('sportaxis:e2e-accounts', ['action' => $action]);
        $lines = array_filter(explode("\n", trim(Artisan::output())));

        return json_decode(end($lines), true);
    }

    public function test_create_makes_one_account_per_role_and_a_coach_roster(): void
    {
        $out = $this->accounts('create');

        $this->assertSame(['admin', 'coach', 'athlete', 'judge'], array_keys($out['accounts']));
        foreach ($out['accounts'] as $role => $acct) {
            $user = User::where('email', $acct['email'])->first();
            $this->assertSame($role, $user->role);
            $this->assertTrue(Hash::check($out['password'], $user->password));
            $this->assertStringEndsWith(E2eAccounts::DOMAIN, $user->email);
        }

        $coach = User::where('email', $out['accounts']['coach']['email'])->first();
        $this->assertSame(3, Athlete::where('coach_id', $coach->id)->count());
        $this->assertDatabaseMissing('audit_logs', ['auditable_id' => $coach->id]);
    }

    public function test_delete_removes_the_accounts_and_what_hangs_off_them(): void
    {
        $out = $this->accounts('create');
        User::where('email', $out['accounts']['admin']['email'])->first()->createToken('selenium');

        $deleted = $this->accounts('delete')['deleted'];

        $this->assertSame(6, $deleted['users']);
        $this->assertSame(3, $deleted['roster']);
        $this->assertSame(1, $deleted['tokens']);
        $this->assertSame(0, User::where('email', 'like', '%'.E2eAccounts::DOMAIN)->count());
        $this->assertSame(0, Athlete::withTrashed()->where('email', 'like', '%'.E2eAccounts::DOMAIN)->count());
    }

    public function test_create_twice_replaces_a_previous_run(): void
    {
        $this->accounts('create');
        $this->accounts('create');

        $this->assertSame(6, User::where('email', 'like', '%'.E2eAccounts::DOMAIN)->count());
    }

    public function test_it_refuses_to_run_in_production(): void
    {
        $this->app['env'] = 'production';

        $this->assertSame(1, Artisan::call('sportaxis:e2e-accounts', ['action' => 'create']));
        $this->assertSame(0, User::where('email', 'like', '%'.E2eAccounts::DOMAIN)->count());
    }
}
