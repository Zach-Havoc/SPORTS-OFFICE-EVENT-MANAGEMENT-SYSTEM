<?php

namespace Database\Seeders;

use App\Services\DemoData\DemoContext;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Sets EVERY account's password (admin included) to the demo password,
 * demo123, and signs everyone out. For a demo database only. On the
 * deployed site:
 *
 *   /artisan-migrate?token=<TOKEN>&seed=1&class=DemoPasswordSeeder
 */
class DemoPasswordSeeder extends Seeder
{
    public function run(): void
    {
        $count = DB::table('users')->update(['password' => Hash::make(DemoContext::PASSWORD)]);
        DB::table('personal_access_tokens')->delete();

        $this->command?->info("{$count} accounts now use the password ".DemoContext::PASSWORD.'.');
    }
}
