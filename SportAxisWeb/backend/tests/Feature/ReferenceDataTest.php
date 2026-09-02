<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Reference data: departments, categories, venues.
 *
 * Reads are public; every write requires an authenticated ADMIN.
 */
class ReferenceDataTest extends TestCase
{
    use RefreshDatabase;

    // ── Departments ─────────────────────────────────────────────────────

    public function test_departments_list_is_public_and_alphabetical(): void
    {
        $this->departments()->create(['name' => 'Zeta College', 'abbreviation' => 'ZC']);
        $this->departments()->create(['name' => 'Alpha College', 'abbreviation' => 'AC']);

        $names = $this->getJson('/api/departments')->assertOk()->json('*.name');

        $this->assertSame(['Alpha College', 'Zeta College'], $names);
    }

    public function test_creating_a_department_requires_authentication(): void
    {
        $this->postJson('/api/departments', ['name' => 'New Dept'])->assertUnauthorized();
    }

    public function test_non_admin_cannot_create_a_department(): void
    {
        $this->actingAsRole('coach');

        $this->postJson('/api/departments', ['name' => 'New Dept'])->assertForbidden();
    }

    public function test_admin_can_create_a_department(): void
    {
        $this->actingAsRole('admin');

        $this->postJson('/api/departments', ['name' => 'College of QA', 'abbreviation' => 'CoQA'])
            ->assertCreated()
            ->assertJsonFragment(['abbreviation' => 'CoQA']);

        $this->assertDatabaseHas('departments', ['name' => 'College of QA']);
    }

    public function test_department_name_must_be_unique(): void
    {
        $this->actingAsRole('admin');
        $this->departments()->create(['name' => 'College of QA', 'abbreviation' => 'CoQA']);

        $this->postJson('/api/departments', ['name' => 'College of QA'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('name');
    }

    public function test_admin_can_update_and_delete_a_department(): void
    {
        $this->actingAsRole('admin');
        $dept = $this->departments()->create(['name' => 'Temp', 'abbreviation' => 'T']);

        $this->putJson("/api/departments/{$dept->id}", ['name' => 'Renamed', 'abbreviation' => 'RN'])
            ->assertOk();
        $this->assertDatabaseHas('departments', ['id' => $dept->id, 'name' => 'Renamed']);

        $this->deleteJson("/api/departments/{$dept->id}")->assertOk();
        $this->assertDatabaseMissing('departments', ['id' => $dept->id]);
    }

    // ── Categories ──────────────────────────────────────────────────────

    public function test_categories_read_is_public_write_is_admin_only(): void
    {
        $this->categories()->create(['name' => 'Chess']);
        $this->getJson('/api/categories')->assertOk()->assertJsonFragment(['name' => 'Chess']);

        $this->postJson('/api/categories', ['name' => 'Esports'])->assertUnauthorized();

        $this->actingAsRole('admin');
        $this->postJson('/api/categories', ['name' => 'Esports'])->assertCreated();
        $this->assertDatabaseHas('categories', ['name' => 'Esports']);
    }

    public function test_a_sport_carries_a_format_that_defaults_to_versus(): void
    {
        $this->actingAsRole('admin');

        $this->postJson('/api/categories', ['name' => 'Basketball'])->assertCreated();
        $this->assertDatabaseHas('categories', ['name' => 'Basketball', 'format' => 'versus']);

        $ranked = $this->postJson('/api/categories', ['name' => 'Cheerdance', 'format' => 'ranked'])
            ->assertCreated()->json();
        $this->assertDatabaseHas('categories', ['name' => 'Cheerdance', 'format' => 'ranked']);

        $this->putJson("/api/categories/{$ranked['id']}", ['name' => 'Cheerdance', 'format' => 'versus'])
            ->assertOk();
        $this->assertDatabaseHas('categories', ['id' => $ranked['id'], 'format' => 'versus']);
    }

    // ── Venues ──────────────────────────────────────────────────────────

    public function test_admin_can_create_a_venue(): void
    {
        $this->actingAsRole('admin');

        $this->postJson('/api/venues', [
            'name'     => 'Main Gym',
            'type'     => 'indoor',
            'capacity' => 500,
            'location' => 'Building A',
        ])->assertCreated();

        $this->assertDatabaseHas('venues', ['name' => 'Main Gym', 'capacity' => 500]);
    }

    public function test_venue_capacity_must_be_a_positive_integer(): void
    {
        $this->actingAsRole('admin');

        $this->postJson('/api/venues', [
            'name'     => 'Bad Venue',
            'type'     => 'indoor',
            'capacity' => 0,
            'location' => 'Nowhere',
        ])->assertStatus(422)->assertJsonValidationErrors('capacity');
    }

    public function test_venue_missing_required_fields_is_rejected(): void
    {
        $this->actingAsRole('admin');

        $this->postJson('/api/venues', ['name' => 'Only a name'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['type', 'capacity', 'location']);
    }

    public function test_non_admin_cannot_create_a_venue(): void
    {
        $this->actingAsRole('judge');

        $this->postJson('/api/venues', [
            'name' => 'X', 'type' => 'indoor', 'capacity' => 10, 'location' => 'Y',
        ])->assertForbidden();
    }
}
