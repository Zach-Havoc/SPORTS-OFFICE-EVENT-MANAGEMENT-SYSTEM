<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A blank/fillable template a coach can attach to a checklist entry (e.g. a
 * blank Parental Consent form) — the athlete downloads it, gets it signed,
 * scans it, and uploads the completed version back as their `Requirement`
 * submission against this type, same as any other checklist item.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('requirement_types', function (Blueprint $table) {
            $table->string('template_file_url')->nullable()->after('description');
        });
    }

    public function down(): void
    {
        Schema::table('requirement_types', function (Blueprint $table) {
            $table->dropColumn('template_file_url');
        });
    }
};
