<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * How a sport is contested decides how many colleges an event of that sport
 * may have:
 *
 *   versus — two teams per game (basketball, volleyball, football …). An event
 *            is a single game and must have exactly two colleges. A pool of
 *            many colleges is turned into games via Bracketing.
 *   ranked — many participants placed against each other at once (track,
 *            swimming, cultural). An event may have two or more colleges and
 *            produces a ranking.
 *
 * Defaults to `versus` (the common intramural case); known ranked sports are
 * flipped on the way in. Admins can change it per sport in Settings.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('categories', 'format')) {
            Schema::table('categories', function (Blueprint $table) {
                $table->enum('format', ['versus', 'ranked'])->default('versus')->after('description');
            });
        }

        $rankedKeywords = [
            'track', 'field', 'athletic', 'run', 'sprint', 'marathon', 'relay', 'hurdle',
            'jump', 'throw', 'javelin', 'discus', 'shot put',
            'swim', 'freestyle', 'backstroke', 'breaststroke', 'butterfly', 'medley',
            'cultural', 'dance', 'cheer', 'arts', 'performance', 'chorale', 'pageant',
        ];

        foreach (DB::table('categories')->get() as $cat) {
            $name = strtolower($cat->name);
            foreach ($rankedKeywords as $kw) {
                if (str_contains($name, $kw)) {
                    DB::table('categories')->where('id', $cat->id)->update(['format' => 'ranked']);
                    break;
                }
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('categories', 'format')) {
            Schema::table('categories', function (Blueprint $table) {
                $table->dropColumn('format');
            });
        }
    }
};
