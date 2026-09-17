<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A coach-owned attendance session (a training, a meeting, a match call). The
 * coach creates as many as they like; each carries its own roster of
 * attendance_records. "Complete" is derived — every roster athlete marked.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('coach_id')->index();
            $table->string('title');
            $table->date('date');
            $table->string('created_by');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_sessions');
    }
};
