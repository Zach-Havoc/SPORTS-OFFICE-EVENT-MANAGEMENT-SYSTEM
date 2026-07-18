<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use App\Models\User;
use App\Models\RegistrationCode;
use App\Models\Department;
use App\Models\Category;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // ── Registration Codes ─────────────────────
        $codes = [
            ['code' => 'ADMIN001', 'role' => 'admin',   'label' => 'Default Admin Code'],
            ['code' => 'COACH001', 'role' => 'coach',   'label' => 'Default Coach Code'],
            ['code' => 'ATHL001',  'role' => 'athlete', 'label' => 'Default Athlete Code'],
            ['code' => 'JUDGE001', 'role' => 'judge',   'label' => 'Default Judge Code'],
        ];

        foreach ($codes as $code) {
            RegistrationCode::firstOrCreate(['code' => $code['code']], $code);
        }

        // ── Default Users ─────────────────────
        $demoUsers = [
            ['email' => 'admin@university.edu', 'name' => 'System Admin', 'role' => 'admin', 'password' => 'admin123', 'code' => 'ADMIN001'],
            ['email' => 'coach@university.edu', 'name' => 'Head Coach', 'role' => 'coach', 'password' => 'coach123', 'code' => 'COACH001'],
            ['email' => 'athlete@university.edu', 'name' => 'Star Athlete', 'role' => 'athlete', 'password' => 'athlete123', 'code' => 'ATHL001'],
            ['email' => 'judge@university.edu', 'name' => 'Expert Judge', 'role' => 'judge', 'password' => 'judge123', 'code' => 'JUDGE001'],
        ];

        foreach ($demoUsers as $demoUser) {
            if (!User::where('email', $demoUser['email'])->exists()) {
                $user = User::create([
                    'id'       => Str::uuid(),
                    'email'    => $demoUser['email'],
                    'password' => Hash::make($demoUser['password']),
                    'name'     => $demoUser['name'],
                    'role'     => $demoUser['role'],
                ]);

                // Mark the code as used
                RegistrationCode::where('code', $demoUser['code'])->update([
                    'used'    => true,
                    'used_by' => $user->id,
                    'used_at' => now(),
                ]);
            }
        }

        // ── Sample Departments ─────────────────────
        $departments = [
            ['name' => 'College of Engineering', 'abbreviation' => 'CoE'],
            ['name' => 'College of Information Technology', 'abbreviation' => 'CIT'],
            ['name' => 'College of Arts and Sciences', 'abbreviation' => 'CAS'],
            ['name' => 'College of Business', 'abbreviation' => 'CoB'],
            ['name' => 'College of Education', 'abbreviation' => 'CoEd'],
        ];

        foreach ($departments as $dept) {
            Department::firstOrCreate(['name' => $dept['name']], [
                'id'           => Str::uuid(),
                'name'         => $dept['name'],
                'abbreviation' => $dept['abbreviation'],
            ]);
        }

        // ── Sample Categories ──────────────────────
        $categories = [
            ['name' => 'Basketball',  'description' => 'Basketball competitions'],
            ['name' => 'Volleyball',  'description' => 'Volleyball competitions'],
            ['name' => 'Swimming',    'description' => 'Swimming events'],
            ['name' => 'Athletics',   'description' => 'Track and field events'],
            ['name' => 'Badminton',   'description' => 'Badminton competitions'],
        ];

        foreach ($categories as $cat) {
            Category::firstOrCreate(['name' => $cat['name']], [
                'id'          => Str::uuid(),
                'name'        => $cat['name'],
                'description' => $cat['description'],
            ]);
        }
    }
}
