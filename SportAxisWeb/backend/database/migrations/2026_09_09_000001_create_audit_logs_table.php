<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * An append-only trail of every meaningful write to the records a human edits:
 * scores, events, athletes, brackets, announcements, user accounts and
 * requirement reviews. Written by the `App\Models\Concerns\Auditable` trait on
 * every create / update / delete / restore.
 *
 *   auditable_type + auditable_id  — the row that changed (polymorphic, so no
 *                                    FK: it may point at a since-purged row)
 *   user_id                        — the acting account (nullOnDelete: keep the
 *                                    log even if the account is later removed)
 *   user_name / user_role         — snapshot of the actor at the time, so the
 *                                    trail still reads correctly after a rename
 *   old_values / new_values       — only the keys that changed; secrets such as
 *                                    `password` are recorded as `_redacted`
 *
 * Immutable by design: `created_at` only, no `updated_at`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->string('user_id')->nullable();
            $table->string('user_name')->nullable();
            $table->string('user_role', 20)->nullable();
            $table->string('event', 30);
            // Explicit shorter lengths, not the default 191: these two form
            // a composite index below — at utf8mb4's 4 bytes/char, 191+191
            // exceeds InfinityFree's MySQL 1000-byte index key limit
            // (confirmed empirically). 100 is generous for a fully-qualified
            // PHP class name; auditable_id only ever holds a 36-char UUID.
            $table->string('auditable_type', 100);
            $table->string('auditable_id', 36);
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->string('url', 512)->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['auditable_type', 'auditable_id']);
            $table->index('user_id');
            $table->index('event');
            $table->index('created_at');

            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
