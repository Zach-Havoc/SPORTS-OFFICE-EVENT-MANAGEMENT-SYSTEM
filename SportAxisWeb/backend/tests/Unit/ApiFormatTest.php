<?php

namespace Tests\Unit;

use App\Models\Event;
use App\Models\User;
use PHPUnit\Framework\TestCase;

/**
 * Model serialisation guards. No database needed — these run against plain
 * in-memory model instances.
 */
class ApiFormatTest extends TestCase
{
    public function test_user_to_api_format_never_exposes_the_password(): void
    {
        $user = new User([
            'email' => 'x@example.com',
            'name'  => 'Test',
            'role'  => 'coach',
        ]);
        $user->password = 'super-secret-hash';

        $payload = $user->toApiFormat();

        $this->assertArrayNotHasKey('password', $payload);
        $this->assertSame(
            ['id', 'email', 'name', 'role', 'sport', 'sports', 'department', 'genderCategory', 'enrollmentCode', 'coachId', 'coachName', 'enrolledAt'],
            array_keys($payload),
        );
    }

    public function test_user_hidden_attribute_keeps_password_out_of_toArray(): void
    {
        $user = new User(['email' => 'x@example.com', 'name' => 'T', 'role' => 'athlete']);
        $user->password = 'hash';

        $this->assertArrayNotHasKey('password', $user->toArray());
    }

    public function test_event_to_api_format_has_the_expected_shape(): void
    {
        $event = new Event([
            'id'          => 'evt-1',
            'name'        => 'Finals',
            'category'    => 'Basketball',
            'schedule'    => '2026-09-01',
            'start_time'  => '09:00',
            'end_time'    => '11:00',
            'departments' => ['A', 'B'],
            'criteria'    => [['name' => 'X', 'weight' => 100]],
            'status'      => 'upcoming',
            'qr_token'    => 'tok',
        ]);

        $payload = $event->toApiFormat();

        $this->assertSame('Finals', $payload['name']);
        $this->assertSame('09:00', $payload['startTime']);   // snake -> camel
        $this->assertSame('tok', $payload['qrToken']);
        $this->assertSame(['A', 'B'], $payload['departments']);
    }
}
