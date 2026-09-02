<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Admin-managed public imagery:
 *   - type "carousel" : the photo slideshow on the public Live Events page
 *   - type "popup"    : the image that pops up when a visitor opens the site
 *
 * One table, one shape. The admin controls every row (upload, caption,
 * link, order, show/hide) from Admin › Site Content.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('site_slides', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->enum('type', ['carousel', 'popup'])->default('carousel');
            $table->string('title')->nullable();
            $table->text('caption')->nullable();
            $table->string('image_path');                 // relative path on the "public" disk
            $table->string('link_url')->nullable();        // optional click-through
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('active')->default(true);
            $table->string('created_by')->nullable();
            $table->timestamps();

            $table->index(['type', 'active', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_slides');
    }
};
