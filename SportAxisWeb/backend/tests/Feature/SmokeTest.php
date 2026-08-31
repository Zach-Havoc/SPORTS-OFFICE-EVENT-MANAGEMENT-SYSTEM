<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Sanity check that the test harness itself works:
 * migrations run on sqlite, factories build valid rows, Sanctum auth helper works.
 */
class SmokeTest extends TestCase
{
    use RefreshDatabase;

    public function test_migrations_and_user_factory_work(): void
    {
        $user = $this->users()->coach()->create();

        $this->assertDatabaseHas('users', ['id' => $user->id, 'role' => 'coach']);
        $this->assertNotNull($user->enrollment_code);
    }

    public function test_public_endpoint_responds(): void
    {
        $this->departments()->create(['name' => 'College of Testing', 'abbreviation' => 'CoT']);

        $this->getJson('/api/departments')
            ->assertOk()
            ->assertJsonFragment(['abbreviation' => 'CoT']);
    }

    public function test_sanctum_auth_helper_authenticates(): void
    {
        $this->actingAsRole('admin');

        $this->getJson('/api/user')->assertOk()->assertJsonFragment(['role' => 'admin']);
    }
}
