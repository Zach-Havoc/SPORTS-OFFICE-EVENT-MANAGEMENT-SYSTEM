<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Cross-cutting middleware behaviour:
 *   - Sanctum guard rejects unauthenticated access to protected routes
 *   - CheckRole returns 403 (not 500) for the wrong role
 *   - SecurityHeaders adds the baseline hardening headers to every response
 */
class MiddlewareSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_protected_route_without_a_token_is_unauthorized(): void
    {
        $this->getJson('/api/user')->assertUnauthorized();
        $this->postJson('/api/scores', [])->assertUnauthorized();
        $this->getJson('/api/athletes')->assertUnauthorized();
    }

    public function test_wrong_role_gets_a_clean_403(): void
    {
        $this->actingAsRole('athlete');

        $res = $this->getJson('/api/registration-codes')->assertForbidden();
        $this->assertStringContainsString('Forbidden', (string) $res->json('error'));
    }

    public function test_correct_role_passes_the_role_gate(): void
    {
        $this->actingAsRole('admin');
        $this->getJson('/api/registration-codes')->assertOk();
    }

    public function test_security_headers_are_present_on_responses(): void
    {
        $res = $this->getJson('/api/departments')->assertOk();

        $res->assertHeader('X-Frame-Options', 'DENY');
        $res->assertHeader('X-Content-Type-Options', 'nosniff');
        $res->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        $this->assertNotNull($res->headers->get('Permissions-Policy'));
    }

    public function test_api_errors_are_returned_as_json(): void
    {
        // withExceptions() forces JSON for api/* — a 404 should be a JSON body,
        // not an HTML error page.
        $this->getJson('/api/events/nonexistent')
            ->assertNotFound()
            ->assertHeader('content-type', 'application/json');
    }
}
