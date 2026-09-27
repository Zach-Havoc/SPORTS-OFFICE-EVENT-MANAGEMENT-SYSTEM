<?php

namespace Database\Seeders\Demo;

use App\Services\DemoData\DemoContext;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The seven sports and their fourteen divisions. Basketball, Volleyball,
 * Beach Volleyball, Sepak Takraw and Chess get a Men's and a Women's
 * division sub-sport ("Basketball — Men"), each with its own standings and
 * medals. Badminton and Table Tennis are played per line instead — Singles
 * A, Singles B and Doubles, Men's and Women's ("Badminton — M Singles A").
 */
class SportSeeder extends Seeder
{
    public function run(DemoContext $ctx): void
    {
        $rows = [];
        $parents = [];
        foreach (DemoContext::SPORTS as $name => $description) {
            $parents[$name] = $id = (string) Str::uuid();
            $rows[] = $this->row($id, $name, $description);
        }

        foreach (DemoContext::DIVISION_SPORTS as $sport) {
            foreach (['Men', 'Women'] as $division) {
                $rows[] = $this->row((string) Str::uuid(), "{$sport} — {$division}", "{$division}'s {$sport}.", $sport, $parents[$sport], $division);
            }
        }

        foreach (DemoContext::RACQUET_SPORTS as $sport) {
            foreach (['M', 'W'] as $g) {
                foreach (DemoContext::LINES as $line) {
                    $rows[] = $this->row((string) Str::uuid(), "{$sport} — {$g} {$line}",
                        "{$sport} ".($g === 'M' ? "Men's" : "Women's")." {$line} — one bracket across all colleges.",
                        $sport, $parents[$sport], "{$g} {$line}");
                }
            }
        }

        DB::table('categories')->insert($rows);
        $ctx->load();
    }

    private function row(string $id, string $name, string $description, ?string $parent = null, ?string $parentId = null, ?string $division = null): array
    {
        return [
            'id' => $id, 'name' => $name, 'description' => $description, 'format' => 'versus',
            'parent_sport' => $parent, 'parent_id' => $parentId, 'division' => $division,
            'created_at' => now(), 'updated_at' => now(),
        ];
    }
}
