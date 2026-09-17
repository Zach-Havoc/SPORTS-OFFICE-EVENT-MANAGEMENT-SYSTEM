<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Groups a "discipline" category (e.g. "Badminton — M Singles A") under its
 * parent sport so the three line brackets of a racquet event — Singles A,
 * Singles B, Doubles — can be found, generated, and rolled up together.
 *
 *   parent_sport — "Badminton" / "Table Tennis"; null for ordinary sports
 *   division     — "M Singles A" / "W Doubles" …; null for ordinary sports
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            if (! Schema::hasColumn('categories', 'parent_sport')) {
                $table->string('parent_sport')->nullable()->after('format');
            }
            if (! Schema::hasColumn('categories', 'division')) {
                $table->string('division')->nullable()->after('parent_sport');
            }
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            foreach (['parent_sport', 'division'] as $col) {
                if (Schema::hasColumn('categories', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
