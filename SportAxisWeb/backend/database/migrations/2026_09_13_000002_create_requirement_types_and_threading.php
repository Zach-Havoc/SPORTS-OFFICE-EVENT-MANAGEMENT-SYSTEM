<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Turns "requirements" from an ad-hoc upload box into a real eligibility
 * checklist.
 *
 *   requirement_types      the office/coach-defined catalog of documents a
 *                          college or sport needs on file ("Medical
 *                          Clearance", "Waiver Form" …). `sport` null means it
 *                          applies to every sport; `required` false is an
 *                          optional/informational entry that never blocks
 *                          clearance.
 *   requirements.requirement_type_id   links a submission to the catalog entry
 *                          it satisfies. Null means a freeform document outside
 *                          the catalog — still storable, just doesn't count
 *                          toward clearance.
 *   requirements.supersedes_id   a resubmission after a rejection points back
 *                          at the row it replaces, so the pair reads as one
 *                          thread instead of two unrelated submissions. The
 *                          old row is never deleted.
 *
 * Four default types are seeded once, matching the checklist that used to be
 * hardcoded into the athlete Requirements page.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('requirement_types', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('sport')->nullable();
            $table->boolean('required')->default(true);
            $table->boolean('active')->default(true);
            $table->string('created_by')->nullable();
            $table->timestamps();

            $table->unique(['name', 'sport']);
            $table->index(['active', 'required']);
        });

        Schema::table('requirement_types', function (Blueprint $table) {
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
        });

        Schema::table('requirements', function (Blueprint $table) {
            if (! Schema::hasColumn('requirements', 'requirement_type_id')) {
                $table->string('requirement_type_id')->nullable()->after('type');
            }
            if (! Schema::hasColumn('requirements', 'supersedes_id')) {
                $table->string('supersedes_id')->nullable()->after('requirement_type_id');
            }
        });

        Schema::table('requirements', function (Blueprint $table) {
            $table->foreign('requirement_type_id')->references('id')->on('requirement_types')->nullOnDelete();
            $table->foreign('supersedes_id')->references('id')->on('requirements')->nullOnDelete();
            $table->index('requirement_type_id');
        });

        $defaults = [
            ['name' => 'Waiver Form', 'description' => 'Signed liability waiver.'],
            ['name' => 'Certificate of Enrollment', 'description' => 'Current semester, from the registrar.'],
            ['name' => 'Medical Clearance', 'description' => 'Fit-to-play certificate from a physician.'],
            ['name' => 'Parental Consent', 'description' => 'Required for athletes under 18.'],
        ];

        if (DB::table('requirement_types')->count() === 0) {
            $now = now();
            DB::table('requirement_types')->insert(array_map(fn ($d) => [
                'id' => (string) Str::uuid(),
                'name' => $d['name'],
                'description' => $d['description'],
                'sport' => null,
                'required' => true,
                'active' => true,
                'created_by' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ], $defaults));
        }
    }

    public function down(): void
    {
        Schema::table('requirements', function (Blueprint $table) {
            $table->dropForeign(['requirement_type_id']);
            $table->dropForeign(['supersedes_id']);
            $table->dropColumn(['requirement_type_id', 'supersedes_id']);
        });

        Schema::dropIfExists('requirement_types');
    }
};
