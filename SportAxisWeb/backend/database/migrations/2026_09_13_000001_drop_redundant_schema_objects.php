<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Schema-evaluation cleanup — removes redundancy that has no product effect:
 *
 *   new_table_example                          scratch table, no migration, no
 *   users.new_setting                          scratch column, no code
 *
 *   attendance_records.session_id index        fully covered by the composite
 *                                              UNIQUE(session_id, athlete_id);
 *                                              the FK falls back to it
 *   discipline_entries (category, department)   fully covered by the composite
 *                                              UNIQUE(category, department, athlete_id)
 *
 * Deliberately KEPT (documented as intentional denormalisation, not a defect):
 * the label-cache columns that sit next to a real key and are synced in model
 * hooks — events.category / departments, scores.judge_name, *_name columns,
 * live_scores team fields, users.sport (legacy "primary sport" mirror of
 * users.sports[0]). Removing them is a query refactor + product call, not a
 * cleanup.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('new_table_example');

        if (Schema::hasColumn('users', 'new_setting')) {
            Schema::table('users', fn (Blueprint $t) => $t->dropColumn('new_setting'));
        }

        if (Schema::hasIndex('attendance_records', 'attendance_records_session_id_index')) {
            Schema::table('attendance_records', fn (Blueprint $t) => $t->dropIndex('attendance_records_session_id_index'));
        }

        if (Schema::hasIndex('discipline_entries', 'discipline_entries_category_department_index')) {
            Schema::table('discipline_entries', fn (Blueprint $t) => $t->dropIndex('discipline_entries_category_department_index'));
        }
    }

    public function down(): void
    {
        if (! Schema::hasIndex('attendance_records', 'attendance_records_session_id_index')) {
            Schema::table('attendance_records', fn (Blueprint $t) => $t->index('session_id'));
        }

        if (! Schema::hasIndex('discipline_entries', 'discipline_entries_category_department_index')) {
            Schema::table('discipline_entries', fn (Blueprint $t) => $t->index(['category', 'department']));
        }

        if (! Schema::hasColumn('users', 'new_setting')) {
            Schema::table('users', fn (Blueprint $t) => $t->string('new_setting', 100)->nullable());
        }
        // new_table_example is not recreated — it never had a migration.
    }
};
