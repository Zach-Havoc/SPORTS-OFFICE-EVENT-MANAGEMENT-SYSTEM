<?php

namespace Tests\Feature;

use App\Providers\AppServiceProvider;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

/**
 * `BROADCAST_CONNECTION=log` is a silent, functional-but-degraded fallback
 * (client-side polling instead of real-time push) rather than a crash, which
 * makes it easy to leave misconfigured in production without anyone
 * noticing. AppServiceProvider::boot() logs a loud warning for exactly that
 * combination — and only that combination.
 */
class AppServiceProviderBroadcastWarningTest extends TestCase
{
    public function test_it_warns_when_production_and_broadcast_connection_is_log(): void
    {
        $this->app['env'] = 'production';
        config()->set('broadcasting.default', 'log');

        Log::spy();

        (new AppServiceProvider($this->app))->boot();

        Log::shouldHaveReceived('warning')
            ->once()
            ->withArgs(fn (string $message) => str_contains($message, 'BROADCAST_CONNECTION')
                && str_contains($message, 'reverb:start'));
    }

    public function test_it_does_not_warn_outside_production(): void
    {
        // The test environment itself: testing, broadcast still "log".
        $this->assertSame('testing', $this->app['env']);
        config()->set('broadcasting.default', 'log');

        Log::spy();

        (new AppServiceProvider($this->app))->boot();

        Log::shouldNotHaveReceived('warning');
    }

    public function test_it_does_not_warn_in_production_when_broadcast_connection_is_reverb(): void
    {
        $this->app['env'] = 'production';
        config()->set('broadcasting.default', 'reverb');

        Log::spy();

        (new AppServiceProvider($this->app))->boot();

        Log::shouldNotHaveReceived('warning');
    }
}
