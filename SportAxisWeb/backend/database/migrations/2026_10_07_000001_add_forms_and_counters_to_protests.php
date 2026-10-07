<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The real protest process: a protest comes with the formal protest form
 * (PDF); the office may ask the other team for a counter, which also comes
 * with a form; both windows are 12 hours. `awaiting_counter` is the status
 * while the other team's window is open.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('protests', function (Blueprint $table) {
            $table->enum('status', ['open', 'awaiting_counter', 'upheld', 'dismissed'])->default('open')->change();

            $table->string('form_url')->nullable()->after('reason');
            $table->string('counter_department')->nullable()->after('form_url');
            $table->string('counter_requested_by')->nullable()->after('counter_department');
            $table->timestamp('counter_requested_at')->nullable()->after('counter_requested_by');
            $table->timestamp('counter_due_at')->nullable()->after('counter_requested_at');
            $table->text('counter_reason')->nullable()->after('counter_due_at');
            $table->string('counter_form_url')->nullable()->after('counter_reason');
            $table->string('counter_filed_by')->nullable()->after('counter_form_url');
            $table->timestamp('counter_filed_at')->nullable()->after('counter_filed_by');
        });
    }

    public function down(): void
    {
        Schema::table('protests', function (Blueprint $table) {
            $table->dropColumn([
                'form_url', 'counter_department', 'counter_requested_by', 'counter_requested_at',
                'counter_due_at', 'counter_reason', 'counter_form_url', 'counter_filed_by', 'counter_filed_at',
            ]);
            $table->enum('status', ['open', 'upheld', 'dismissed'])->default('open')->change();
        });
    }
};
