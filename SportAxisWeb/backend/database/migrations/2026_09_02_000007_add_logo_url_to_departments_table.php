<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A college logo, shown on the big-screen standings board.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('departments', 'logo_url')) {
            Schema::table('departments', function (Blueprint $table) {
                $table->string('logo_url')->nullable()->after('abbreviation');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('departments', 'logo_url')) {
            Schema::table('departments', function (Blueprint $table) {
                $table->dropColumn('logo_url');
            });
        }
    }
};
