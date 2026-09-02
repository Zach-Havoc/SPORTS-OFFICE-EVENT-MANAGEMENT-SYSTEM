<?php

namespace Database\Factories;

use App\Models\SiteSlide;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<SiteSlide> */
class SiteSlideFactory extends Factory
{
    protected $model = SiteSlide::class;

    public function definition(): array
    {
        return [
            'id'         => (string) Str::uuid(),
            'type'       => 'carousel',
            'title'      => fake()->sentence(3),
            'caption'    => fake()->sentence(8),
            'image_path' => 'site_slides/' . Str::uuid() . '.jpg',
            'link_url'   => null,
            'sort_order' => 0,
            'active'     => true,
            'created_by' => null,
        ];
    }

    public function popup(): static
    {
        return $this->state(fn () => ['type' => 'popup']);
    }

    public function hidden(): static
    {
        return $this->state(fn () => ['active' => false]);
    }
}
