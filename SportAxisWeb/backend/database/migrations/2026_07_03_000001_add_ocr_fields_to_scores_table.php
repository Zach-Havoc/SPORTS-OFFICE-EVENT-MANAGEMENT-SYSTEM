<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('scores', function (Blueprint $table) {
            $table->string('method')->default('manual')->after('submitted_via_qr'); // 'manual' | 'ocr'
            $table->string('image_url')->nullable()->after('method');
        });
    }

    public function down(): void
    {
        Schema::table('scores', function (Blueprint $table) {
            $table->dropColumn(['method', 'image_url']);
        });
    }
};
