<?php

namespace Database\Seeders;

use App\Models\AuditLog;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * The emptiest database the app can still be used from: the four test
 * accounts (default passwords), their registration codes, and the baseline
 * the app assumes exists (one active season, the racquet line categories,
 * the default eligibility checklist). No colleges, events, athletes, or
 * anything else — and, unlike DatabaseSeeder/ReferenceDataSeeder::run(),
 * never dev_snapshot.php.
 *
 * On the deployed site, with a full wipe first:
 *   /artisan-migrate?token=<TOKEN>&fresh=1&seed=1&class=CleanSlateSeeder
 */
class CleanSlateSeeder extends Seeder
{
    private const ACCOUNTS = [
        ['admin@university.edu', 'System Admin', 'admin', 'admin123', 'ADMIN001', 'Default Admin Code'],
        ['coach@university.edu', 'Head Coach', 'coach', 'coach123', 'COACH001', 'Default Coach Code'],
        ['athlete@university.edu', 'Star Athlete', 'athlete', 'athlete123', 'ATHL001', 'Default Athlete Code'],
        ['judge@university.edu', 'Expert Judge', 'judge', 'judge123', 'JUDGE001', 'Default Committee Code'],
    ];

    public function run(): void
    {
        AuditLog::withoutRecording(function () {
            $ref = new ReferenceDataSeeder;
            $ref->seedDefaultSeason();
            $ref->seedRacquetDisciplines();
            $ref->seedDefaultRequirementTypes();

            foreach (self::ACCOUNTS as [$email, $name, $role, $password, $code, $label]) {
                $id = DB::table('users')->where('email', $email)->value('id');
                if (! $id) {
                    $id = (string) Str::uuid();
                    DB::table('users')->insert([
                        'id' => $id, 'email' => $email, 'password' => Hash::make($password),
                        'name' => $name, 'role' => $role, 'active' => true,
                        'created_at' => now(), 'updated_at' => now(),
                    ]);
                }

                DB::table('registration_codes')->updateOrInsert(['code' => $code], [
                    'role' => $role, 'label' => $label, 'used' => true, 'used_by' => $id,
                    'used_at' => now(), 'created_at' => now(), 'updated_at' => now(),
                ]);
            }
        });
    }
}
