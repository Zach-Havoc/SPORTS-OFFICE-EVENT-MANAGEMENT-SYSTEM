<?php

namespace Tests\Feature;

use App\Models\Event;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * QA verification pass for the judge-email redaction fix in
 * App\Models\Event::toApiFormat(). Deliberately independent of the
 * developer-authored test in EventTest.php: covers extra sensitive keys
 * beyond `email`, and confirms the write path still persists them raw.
 */
class EventJudgeLeakVerificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_endpoints_strip_every_extra_judge_key_not_just_email(): void
    {
        $event = $this->events()->create([
            'judges' => [
                [
                    'id' => 'j1',
                    'name' => 'Judge One',
                    'email' => 'judge-one@example.com',
                    'phone' => '09171234567',
                    'contact_number' => '09171234567',
                    'ssn' => 'should-never-appear',
                    'address' => '123 Secret St',
                    'notes' => 'internal notes about the judge',
                ],
            ],
        ]);

        $list = $this->getJson('/api/events')->assertOk();
        $show = $this->getJson("/api/events/{$event->id}")->assertOk();

        foreach ([$list, $show] as $res) {
            $judges = $res === $list ? $res->json('data.0.judges') : $res->json('judges');
            $this->assertNotEmpty($judges);
            foreach ($judges as $judge) {
                $this->assertSame(['id', 'name'], array_keys($judge));
            }
        }

        $raw = $list->getContent().$show->getContent();
        foreach (['judge-one@example.com', '09171234567', 'should-never-appear', '123 Secret St', 'internal notes'] as $secret) {
            $this->assertStringNotContainsString($secret, $raw);
        }
    }

    public function test_admin_write_path_still_persists_judge_email_to_the_database_raw(): void
    {
        $this->actingAsRole('admin');

        $res = $this->postJson('/api/events', [
            'name' => 'Finals',
            'category' => 'Basketball',
            'schedule' => now()->addDay()->toDateString(),
            'startTime' => '09:00',
            'endTime' => '11:00',
            'departments' => ['College of Engineering', 'College of Business'],
            'judges' => [
                ['id' => 'j1', 'name' => 'Judge One', 'email' => 'judge-one@example.com', 'phone' => '09171234567'],
            ],
        ])->assertCreated();

        // The response itself must not leak the email (same redaction as GET).
        $this->assertArrayNotHasKey('email', $res->json('judges.0'));

        // But the raw DB row must have stored it — the fix must not have
        // accidentally started filtering the write path too.
        $row = Event::withoutGlobalScopes()->findOrFail($res->json('id'));
        $this->assertSame('judge-one@example.com', $row->judges[0]['email'] ?? null);
        $this->assertSame('09171234567', $row->judges[0]['phone'] ?? null);
    }
}
