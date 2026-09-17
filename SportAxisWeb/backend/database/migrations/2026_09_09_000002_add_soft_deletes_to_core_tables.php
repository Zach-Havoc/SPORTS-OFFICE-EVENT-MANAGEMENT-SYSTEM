<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Recoverable deletes for the five tables where an accidental removal during a
 * live event would be costly and hard to reconstruct.
 *
 * Semantics after this migration:
 *   - `$model->delete()` now sets `deleted_at`; the row stays in the database
 *     and is hidden from every ordinary query by the SoftDeletes global scope.
 *   - The existing `ON DELETE CASCADE` foreign keys (scores.event_id and
 *     rankings.event_id -> events.id) do NOT fire on a soft delete, because it
 *     is an UPDATE, not a DELETE. Child rows are therefore left intact so that
 *     `restore()` brings the parent back whole.
 *   - `$model->forceDelete()` performs a real DELETE and the cascades still
 *     apply, for a deliberate permanent purge.
 *
 * Caveat: `athletes.student_id` carries a UNIQUE index. A soft-deleted athlete
 * still occupies its `student_id`, so the supported recovery path is
 * `restore()`, not creating a fresh roster row with the same student id.
 */
return new class extends Migration
{
    private array $tables = ['events', 'scores', 'athletes', 'brackets', 'announcements'];

    public function up(): void
    {
        foreach ($this->tables as $name) {
            if (! Schema::hasColumn($name, 'deleted_at')) {
                Schema::table($name, fn (Blueprint $table) => $table->softDeletes());
            }
        }
    }

    public function down(): void
    {
        foreach ($this->tables as $name) {
            if (Schema::hasColumn($name, 'deleted_at')) {
                Schema::table($name, fn (Blueprint $table) => $table->dropSoftDeletes());
            }
        }
    }
};
