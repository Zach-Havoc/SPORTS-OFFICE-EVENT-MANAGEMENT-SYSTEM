<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The sports a coach handles, by key.
 *
 * `users.sports` is a JSON array of sport *names* and a coach can hold several
 * ("Basketball", "Badminton"), so unlike an athlete this cannot be a single
 * column. This junction keys each one to `categories.id`; the JSON array stays
 * as the label cache the rest of the app already reads.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('coach_category')) {
            Schema::create('coach_category', function (Blueprint $table) {
                // Explicit shorter lengths, not the default 191: these two
                // form the composite primary key below — at utf8mb4's 4
                // bytes/char, 191+191 exceeds InfinityFree's MySQL 1000-byte
                // index key limit (confirmed empirically). Both only ever
                // hold a 36-char UUID (users.id / categories.id).
                $table->string('coach_id', 36);
                $table->string('category_id', 36);
                $table->primary(['coach_id', 'category_id']);
                $table->index('category_id');
                $table->foreign('coach_id')->references('id')->on('users')->onDelete('cascade');
                $table->foreign('category_id')->references('id')->on('categories')->onDelete('cascade');
            });
        }

        $catBy = [];
        foreach (DB::table('categories')->get(['id', 'name']) as $c) {
            $catBy[mb_strtolower(trim($c->name))] = $c->id;
        }

        foreach (DB::table('users')->where('role', 'coach')->get(['id', 'sport', 'sports']) as $coach) {
            $names = json_decode($coach->sports ?? 'null', true);
            if (! is_array($names) || $names === []) {
                $names = array_filter([$coach->sport]);
            }

            foreach ($names as $name) {
                if ($categoryId = $catBy[mb_strtolower(trim((string) $name))] ?? null) {
                    DB::table('coach_category')->insertOrIgnore([
                        'coach_id' => $coach->id,
                        'category_id' => $categoryId,
                    ]);
                }
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('coach_category');
    }
};
