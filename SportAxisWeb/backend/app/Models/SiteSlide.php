<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

/**
 * An admin-managed public image.
 *
 *  - type "carousel" : a slide in the public Live Events photo slideshow
 *  - type "popup"    : the welcome image shown when a visitor opens the site
 */
class SiteSlide extends Model
{
    protected $table = 'site_slides';

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'type', 'title', 'caption', 'image_path',
        'link_url', 'sort_order', 'active', 'created_by',
    ];

    protected $casts = [
        'active'     => 'boolean',
        'sort_order' => 'integer',
    ];

    /** Absolute URL to the stored image. */
    public function imageUrl(): ?string
    {
        return $this->image_path ? Storage::disk('public')->url($this->image_path) : null;
    }

    public function toApiFormat(): array
    {
        return [
            'id'        => $this->id,
            'type'      => $this->type,
            'title'     => $this->title,
            'caption'   => $this->caption,
            'imageUrl'  => $this->imageUrl(),
            'linkUrl'   => $this->link_url,
            'sortOrder' => $this->sort_order,
            'active'    => $this->active,
            'createdAt' => $this->created_at,
        ];
    }
}
