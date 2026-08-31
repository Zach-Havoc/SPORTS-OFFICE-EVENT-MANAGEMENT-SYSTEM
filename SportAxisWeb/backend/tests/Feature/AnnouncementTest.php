<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Announcements:
 *   GET            /api/announcements   (public)
 *   POST/PUT/DELETE/api/announcements   (coach; author-only for mutations)
 */
class AnnouncementTest extends TestCase
{
    use RefreshDatabase;

    public function test_announcement_list_is_public(): void
    {
        $this->announcements()->create(['title' => 'Tryouts open']);

        $this->getJson('/api/announcements')
            ->assertOk()
            ->assertJsonFragment(['title' => 'Tryouts open']);
    }

    public function test_creating_an_announcement_requires_a_coach(): void
    {
        $this->postJson('/api/announcements', ['title' => 'x', 'content' => 'y'])->assertUnauthorized();

        $this->actingAsRole('athlete');
        $this->postJson('/api/announcements', ['title' => 'x', 'content' => 'y'])->assertForbidden();
    }

    public function test_coach_can_create_an_announcement_attributed_to_them(): void
    {
        $coach = $this->actingAsRole('coach', ['name' => 'Coach K']);

        $this->postJson('/api/announcements', [
            'title'    => 'Volleyball tryouts',
            'content'  => 'Come to the gym at 5pm',
            'isTryout' => true,
        ])->assertCreated();

        $this->assertDatabaseHas('announcements', [
            'title'      => 'Volleyball tryouts',
            'coach_id'   => $coach->id,
            'coach_name' => 'Coach K',
        ]);
    }

    public function test_title_and_content_are_required(): void
    {
        $this->actingAsRole('coach');

        $this->postJson('/api/announcements', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['title', 'content']);
    }

    public function test_a_coach_cannot_edit_another_coachs_announcement(): void
    {
        $coachA = $this->users()->coach()->create();
        $ann    = $this->announcements()->create(['coach_id' => $coachA->id, 'title' => 'Original']);

        $this->actingAsRole('coach'); // coach B
        $this->putJson("/api/announcements/{$ann->id}", ['title' => 'Hijacked'])
            ->assertForbidden();

        $this->assertSame('Original', $ann->fresh()->title);
    }

    public function test_a_coach_cannot_delete_another_coachs_announcement(): void
    {
        $coachA = $this->users()->coach()->create();
        $ann    = $this->announcements()->create(['coach_id' => $coachA->id]);

        $this->actingAsRole('coach'); // coach B
        $this->deleteJson("/api/announcements/{$ann->id}")->assertForbidden();

        $this->assertDatabaseHas('announcements', ['id' => $ann->id]);
    }

    public function test_a_coach_can_edit_and_delete_their_own_announcement(): void
    {
        $coach = $this->actingAsRole('coach');
        $ann   = $this->announcements()->create(['coach_id' => $coach->id]);

        $this->putJson("/api/announcements/{$ann->id}", ['title' => 'Updated'])->assertOk();
        $this->assertSame('Updated', $ann->fresh()->title);

        $this->deleteJson("/api/announcements/{$ann->id}")->assertOk();
        $this->assertDatabaseMissing('announcements', ['id' => $ann->id]);
    }
}
