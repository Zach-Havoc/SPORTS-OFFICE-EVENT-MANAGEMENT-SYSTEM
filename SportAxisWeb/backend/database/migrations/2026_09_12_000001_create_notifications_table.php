<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Laravel's `database` notification channel. Written with a STRING
 * `notifiable_id` because every account key in this app is a UUID string, not
 * an auto-increment integer (the stock `notifications:table` migration assumes
 * the latter).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            // Explicit shorter lengths, not the default 191: these two form
            // a composite index below — at utf8mb4's 4 bytes/char, 191+191
            // exceeds InfinityFree's MySQL 1000-byte index key limit
            // (confirmed empirically). 100 is generous for a fully-qualified
            // PHP class name; notifiable_id only ever holds a 36-char UUID.
            $table->string('notifiable_type', 100);
            $table->string('notifiable_id', 36);
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['notifiable_type', 'notifiable_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
