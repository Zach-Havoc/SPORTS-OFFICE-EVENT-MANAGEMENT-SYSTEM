<?php

namespace Tests\Feature;

use App\Models\CampusStudent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

/**
 * Admin-managed registrar roster.
 *   GET  /api/admin/campus-students
 *   POST /api/admin/campus-students/import
 */
class CampusStudentTest extends TestCase
{
    use RefreshDatabase;

    private function csv(string $body): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('students.csv', $body);
    }

    public function test_only_an_admin_can_reach_the_registry(): void
    {
        $this->getJson('/api/admin/campus-students')->assertUnauthorized();

        $this->actingAsRole('coach');
        $this->getJson('/api/admin/campus-students')->assertForbidden();
    }

    public function test_import_upserts_rows_keyed_by_sr_code(): void
    {
        $this->actingAsRole('admin');

        $res = $this->postJson('/api/admin/campus-students/import', [
            'file' => $this->csv(
                "SR Code,First Name,Last Name,Gender,College\n".
                "23-75760,Juan,Dela Cruz,M,College of Informatics and Computing Sciences\n".
                "24-11024,Maria,Santos,Female,College of Engineering\n"
            ),
        ]);

        $res->assertOk()->assertJsonFragment(['added' => 2, 'updated' => 0, 'skipped' => 0, 'total' => 2]);
        $this->assertDatabaseHas('campus_students', [
            'sr_code' => '23-75760', 'first_name' => 'Juan', 'last_name' => 'Dela Cruz', 'gender' => 'Male',
        ]);

        // Re-importing the same SR code updates in place, not duplicates.
        $this->postJson('/api/admin/campus-students/import', [
            'file' => $this->csv("srcode,firstname,lastname\n23-75760,Juan Miguel,Dela Cruz\n"),
        ])->assertOk()->assertJsonFragment(['added' => 0, 'updated' => 1, 'total' => 2]);

        $this->assertSame('Juan Miguel', CampusStudent::find('23-75760')->first_name);
    }

    public function test_import_skips_rows_without_an_sr_code_or_last_name(): void
    {
        $this->actingAsRole('admin');

        $this->postJson('/api/admin/campus-students/import', [
            'file' => $this->csv(
                "SR Code,First Name,Last Name\n".
                "23-00001,Ana,Lim\n".
                ",Bob,NoCode\n".
                "23-00003,Cara,\n"
            ),
        ])->assertOk()->assertJsonFragment(['added' => 1, 'skipped' => 2]);
    }

    public function test_import_rejects_a_file_missing_the_key_columns(): void
    {
        $this->actingAsRole('admin');

        $this->postJson('/api/admin/campus-students/import', [
            'file' => $this->csv("Name,Course\nJuan Dela Cruz,BSCS\n"),
        ])->assertStatus(422)->assertJsonFragment([
            'error' => 'The file needs at least an "SR Code" column and a "Last Name" column.',
        ]);
    }

    public function test_list_returns_a_total_and_supports_search(): void
    {
        $this->actingAsRole('admin');
        $this->campusStudents()->create(['sr_code' => '23-00001', 'first_name' => 'Ana', 'last_name' => 'Reyes']);
        $this->campusStudents()->create(['sr_code' => '23-00002', 'first_name' => 'Ben', 'last_name' => 'Cruz']);

        $this->getJson('/api/admin/campus-students')
            ->assertOk()
            ->assertJsonPath('total', 2);

        $this->getJson('/api/admin/campus-students?q=reyes')
            ->assertOk()
            ->assertJsonPath('total', 2)
            ->assertJsonCount(1, 'students')
            ->assertJsonPath('students.0.sr_code', '23-00001');
    }
}
