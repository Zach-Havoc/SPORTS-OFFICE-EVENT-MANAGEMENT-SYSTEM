<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Update existing records where is_tryout is null to default to true
        DB::statement("UPDATE announcements SET is_tryout = 1 WHERE is_tryout IS NULL");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No need to reverse as this was a data fix
    }
};
