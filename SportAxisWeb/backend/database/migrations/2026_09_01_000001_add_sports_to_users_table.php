<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A coach can now handle more than one sport.
 *
 * `users.sports` holds the full list (JSON array). `users.sport` is kept as the
 * "primary" sport (= the first entry) so every existing string reader — the
 * enrollment cascade, athlete inheritance, the sidebar label, the admin coach
 * list — keeps working unchanged.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('users', 'sports')) {
            Schema::table('users', function (Blueprint $table) {
                $table->json('sports')->nullable()->after('sport');
            });
        }

        // Backfill: any coach that already has a single sport gets a 1-item list.
        DB::table('users')
            ->where('role', 'coach')
            ->whereNotNull('sport')
            ->where('sport', '!=', '')
            ->whereNull('sports')
            ->orderBy('id')
            ->each(function ($user) {
                DB::table('users')->where('id', $user->id)->update([
                    'sports' => json_encode([$user->sport]),
                ]);
            });
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'sports')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('sports');
            });
        }
    }
};
