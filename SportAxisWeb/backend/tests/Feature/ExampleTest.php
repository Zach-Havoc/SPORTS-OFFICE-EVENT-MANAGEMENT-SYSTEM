<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * The API's root address: a redirect to the website when that lives on
 * another host (Render), otherwise a small JSON note — never the framework's
 * welcome page.
 */
class ExampleTest extends TestCase
{
    public function test_the_root_says_what_this_is_when_the_site_shares_the_host(): void
    {
        config(['app.frontend_url' => 'http://localhost']);

        $this->get('/')->assertOk()->assertJson(['name' => config('app.name')]);
    }

    public function test_the_root_sends_people_to_the_website_when_it_lives_elsewhere(): void
    {
        config(['app.frontend_url' => 'https://sportsaxis-web.onrender.com']);

        $this->get('/')->assertRedirect('https://sportsaxis-web.onrender.com');
    }
}
