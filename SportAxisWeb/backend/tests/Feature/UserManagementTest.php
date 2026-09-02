<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Admin User Management:
 *   GET    /api/admin/users                     (list, ?role= ?status= ?search=)
 *   GET    /api/admin/users/{id}                (one account + linked records)
 *   PUT    /api/admin/users/{id}                (edit name/email/role/dept/sport)
 *   POST   /api/admin/users/{id}/active         (enable / disable)
 *   POST   /api/admin/users/{id}/reset-password (temp password, shown once)
 *   DELETE /api/admin/users/{id}
 *
 * Accounts with dependent records (a coach's athletes, a committee member's
 * scores) can be disabled but never deleted or re-roled.
 */
class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_list_every_account_with_link_counts(): void
    {
        $this->actingAsRole('admin');

        $coach = $this->users()->coach()->create(['name' => 'Coach Cruz']);
        $this->athletes()->count(2)->create(['coach_id' => $coach->id]);
        $this->users()->judge()->create();

        $rows = $this->getJson('/api/admin/users')
            ->assertOk()
            ->assertJsonStructure(['*' => ['id', 'name', 'email', 'role', 'active', 'links' => ['athleteCount', 'scoreCount', 'assignedEventCount']]])
            ->json();

        $coachRow = collect($rows)->firstWhere('id', $coach->id);
        $this->assertSame(2, $coachRow['links']['athleteCount']);
    }

    public function test_the_list_can_be_filtered_by_role_status_and_search(): void
    {
        $this->actingAsRole('admin');

        $this->users()->judge()->create(['name' => 'Judith Judge', 'email' => 'judith@example.com']);
        $this->users()->coach()->create(['name' => 'Carl Coach', 'email' => 'carl@example.com']);
        $this->users()->judge()->inactive()->create(['name' => 'Benched Judge', 'email' => 'benched@example.com']);

        $this->getJson('/api/admin/users?role=judge')->assertOk()->assertJsonCount(2);
        $this->getJson('/api/admin/users?role=judge&status=active')->assertOk()->assertJsonCount(1)
            ->assertJsonFragment(['name' => 'Judith Judge']);
        $this->getJson('/api/admin/users?status=inactive')->assertOk()->assertJsonCount(1)
            ->assertJsonFragment(['name' => 'Benched Judge']);
        $this->getJson('/api/admin/users?search=carl@example')->assertOk()->assertJsonCount(1)
            ->assertJsonFragment(['name' => 'Carl Coach']);
    }

    public function test_a_non_admin_cannot_reach_user_management(): void
    {
        $this->actingAsRole('coach');

        $this->getJson('/api/admin/users')->assertForbidden();
        $victim = $this->users()->judge()->create();
        $this->putJson("/api/admin/users/{$victim->id}", ['name' => 'Hacked'])->assertForbidden();
        $this->deleteJson("/api/admin/users/{$victim->id}")->assertForbidden();
    }

    public function test_admin_can_edit_a_users_name_email_and_department(): void
    {
        $this->actingAsRole('admin');
        $user = $this->users()->judge()->create();

        $this->putJson("/api/admin/users/{$user->id}", [
            'name'       => 'Renamed Person',
            'email'      => 'renamed@example.com',
            'department' => 'College of Science',
        ])->assertOk()->assertJsonPath('name', 'Renamed Person');

        $this->assertDatabaseHas('users', [
            'id'         => $user->id,
            'name'       => 'Renamed Person',
            'email'      => 'renamed@example.com',
            'department' => 'College of Science',
        ]);
    }

    public function test_email_must_stay_unique_when_editing(): void
    {
        $this->actingAsRole('admin');
        $this->users()->create(['email' => 'taken@example.com']);
        $user = $this->users()->create(['email' => 'mine@example.com']);

        $this->putJson("/api/admin/users/{$user->id}", ['email' => 'taken@example.com'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_admin_cannot_change_their_own_role(): void
    {
        $admin = $this->actingAsRole('admin');

        $this->putJson("/api/admin/users/{$admin->id}", ['role' => 'coach'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('role');
    }

    public function test_a_coach_with_athletes_cannot_be_re_roled(): void
    {
        $this->actingAsRole('admin');
        $coach = $this->users()->coach()->create();
        $this->athletes()->create(['coach_id' => $coach->id]);

        $this->putJson("/api/admin/users/{$coach->id}", ['role' => 'judge'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('role');
    }

    public function test_deactivating_a_user_revokes_their_tokens_and_blocks_login(): void
    {
        $this->actingAsRole('admin');
        $user = $this->users()->create(['email' => 'active@example.com', 'password' => Hash::make('password')]);
        $user->createToken('phone');

        $this->postJson("/api/admin/users/{$user->id}/active", ['active' => false])
            ->assertOk()
            ->assertJsonPath('active', false);

        $this->assertCount(0, $user->fresh()->tokens()->get());
        $this->postJson('/api/login', ['email' => 'active@example.com', 'password' => 'password'])
            ->assertStatus(422);
    }

    public function test_reactivating_a_user_restores_login(): void
    {
        $this->actingAsRole('admin');
        $user = $this->users()->inactive()->create(['email' => 'back@example.com', 'password' => Hash::make('password')]);

        $this->postJson("/api/admin/users/{$user->id}/active", ['active' => true])->assertOk();

        $this->postJson('/api/login', ['email' => 'back@example.com', 'password' => 'password'])->assertOk();
    }

    public function test_admin_cannot_deactivate_their_own_account(): void
    {
        $admin = $this->actingAsRole('admin');

        $this->postJson("/api/admin/users/{$admin->id}/active", ['active' => false])
            ->assertStatus(422)
            ->assertJsonValidationErrors('active');
    }

    public function test_resetting_a_password_returns_a_temp_password_and_swaps_the_credential(): void
    {
        $this->actingAsRole('admin');
        $user = $this->users()->create(['email' => 'reset@example.com', 'password' => Hash::make('old-password')]);
        $user->createToken('phone');

        $temp = $this->postJson("/api/admin/users/{$user->id}/reset-password")
            ->assertOk()
            ->assertJsonStructure(['tempPassword'])
            ->json('tempPassword');

        $this->assertCount(0, $user->fresh()->tokens()->get());
        $this->assertTrue(Hash::check($temp, $user->fresh()->password));
        $this->postJson('/api/login', ['email' => 'reset@example.com', 'password' => 'old-password'])->assertStatus(422);
        $this->postJson('/api/login', ['email' => 'reset@example.com', 'password' => $temp])->assertOk();
    }

    public function test_reset_password_accepts_an_explicit_value(): void
    {
        $this->actingAsRole('admin');
        $user = $this->users()->create(['email' => 'explicit@example.com']);

        $this->postJson("/api/admin/users/{$user->id}/reset-password", ['password' => 'chosen-pw-123'])
            ->assertOk()
            ->assertJsonPath('tempPassword', 'chosen-pw-123');

        $this->postJson('/api/login', ['email' => 'explicit@example.com', 'password' => 'chosen-pw-123'])->assertOk();
    }

    public function test_admin_cannot_delete_their_own_account(): void
    {
        $admin = $this->actingAsRole('admin');

        $this->deleteJson("/api/admin/users/{$admin->id}")
            ->assertStatus(422)
            ->assertJsonValidationErrors('user');
    }

    public function test_a_coach_with_athletes_cannot_be_deleted(): void
    {
        $this->actingAsRole('admin');
        $coach = $this->users()->coach()->create();
        $this->athletes()->create(['coach_id' => $coach->id]);

        $this->deleteJson("/api/admin/users/{$coach->id}")
            ->assertStatus(422)
            ->assertJsonValidationErrors('user');
        $this->assertDatabaseHas('users', ['id' => $coach->id]);
    }

    public function test_a_committee_member_with_scores_cannot_be_deleted(): void
    {
        $this->actingAsRole('admin');
        $judge = $this->users()->judge()->create();
        $event = $this->events()->create();
        $this->scores()->create(['event_id' => $event->id, 'judge_id' => $judge->id]);

        $this->deleteJson("/api/admin/users/{$judge->id}")
            ->assertStatus(422)
            ->assertJsonValidationErrors('user');
    }

    public function test_admin_can_delete_an_unlinked_account(): void
    {
        $this->actingAsRole('admin');
        $user = $this->users()->judge()->create();
        $user->createToken('phone');

        $this->deleteJson("/api/admin/users/{$user->id}")->assertOk();

        $this->assertDatabaseMissing('users', ['id' => $user->id]);
        $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $user->id]);
    }

    public function test_show_returns_the_accounts_linked_records(): void
    {
        $this->actingAsRole('admin');
        $coach = $this->users()->coach()->create();
        $this->athletes()->count(3)->create(['coach_id' => $coach->id]);

        $this->getJson("/api/admin/users/{$coach->id}")
            ->assertOk()
            ->assertJsonStructure(['user' => ['id', 'links'], 'athletes', 'roster', 'scores', 'assignedEvents', 'registrationCode'])
            ->assertJsonCount(3, 'athletes');
    }
}
