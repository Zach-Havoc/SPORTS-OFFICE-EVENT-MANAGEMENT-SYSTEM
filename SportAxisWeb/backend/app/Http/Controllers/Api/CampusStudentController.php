<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CampusStudent;
use Illuminate\Http\Request;

/**
 * Admin management of the registrar's enrolled-student roster.
 *   GET  /api/admin/campus-students          list + count (search with ?q=)
 *   POST /api/admin/campus-students/import    upsert from an uploaded CSV
 */
class CampusStudentController extends Controller
{
    private const HEADERS = [
        'srcode' => 'sr_code', 'sr' => 'sr_code', 'studentnumber' => 'sr_code',
        'studentno' => 'sr_code', 'studentid' => 'sr_code',
        'firstname' => 'first_name', 'fname' => 'first_name', 'givenname' => 'first_name',
        'lastname' => 'last_name', 'lname' => 'last_name', 'surname' => 'last_name', 'familyname' => 'last_name',
        'middlename' => 'middle_name', 'mname' => 'middle_name', 'middle' => 'middle_name',
        'gender' => 'gender', 'sex' => 'gender',
        'college' => 'college', 'department' => 'college', 'dept' => 'college',
        'program' => 'program', 'course' => 'program',
        'yearlevel' => 'year_level', 'year' => 'year_level', 'yr' => 'year_level',
        'email' => 'email', 'emailaddress' => 'email',
    ];

    public function index(Request $request)
    {
        $q = trim((string) $request->query('q', ''));

        $query = CampusStudent::query()->orderBy('last_name')->orderBy('first_name');
        if ($q !== '') {
            $query->where(function ($w) use ($q) {
                $w->where('sr_code', 'like', "%{$q}%")
                    ->orWhere('first_name', 'like', "%{$q}%")
                    ->orWhere('last_name', 'like', "%{$q}%");
            });
        }

        return response()->json([
            'total' => CampusStudent::count(),
            'students' => $query->limit(100)->get(),
        ]);
    }

    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt|max:5120',
        ]);

        $handle = fopen($request->file('file')->getRealPath(), 'r');
        if ($handle === false) {
            return response()->json(['error' => 'Could not read the file.'], 422);
        }

        $header = fgetcsv($handle);
        if (! $header) {
            fclose($handle);

            return response()->json(['error' => 'The file has no rows.'], 422);
        }

        $map = [];
        foreach ($header as $i => $col) {
            $key = preg_replace('/[^a-z0-9]/', '', strtolower(trim((string) $col)));
            if (isset(self::HEADERS[$key])) {
                $map[$i] = self::HEADERS[$key];
            }
        }

        if (! in_array('sr_code', $map, true) || ! in_array('last_name', $map, true)) {
            fclose($handle);

            return response()->json([
                'error' => 'The file needs at least an "SR Code" column and a "Last Name" column.',
            ], 422);
        }

        $blank = array_fill_keys([
            'sr_code', 'first_name', 'last_name', 'middle_name',
            'gender', 'college', 'program', 'year_level', 'email',
        ], null);

        $added = 0;
        $updated = 0;
        $skipped = 0;

        while (($row = fgetcsv($handle)) !== false) {
            $data = $blank;
            foreach ($map as $i => $field) {
                $data[$field] = isset($row[$i]) ? trim((string) $row[$i]) : null;
            }

            $sr = CampusStudent::normalizeCode($data['sr_code']);
            if ($sr === '' || empty($data['last_name'])) {
                $skipped++;

                continue;
            }

            $existed = CampusStudent::whereKey($sr)->exists();
            CampusStudent::updateOrCreate(['sr_code' => $sr], [
                'first_name' => $data['first_name'] ?? '',
                'last_name' => $data['last_name'] ?? '',
                'middle_name' => $data['middle_name'] ?: null,
                'gender' => $this->normalizeGender($data['gender']),
                'college' => $data['college'] ?: null,
                'program' => $data['program'] ?: null,
                'year_level' => $data['year_level'] ?: null,
                'email' => $data['email'] ?: null,
            ]);
            $existed ? $updated++ : $added++;
        }
        fclose($handle);

        return response()->json([
            'added' => $added,
            'updated' => $updated,
            'skipped' => $skipped,
            'total' => CampusStudent::count(),
        ]);
    }

    private function normalizeGender(?string $raw): ?string
    {
        $g = strtolower(trim((string) $raw));

        return match ($g) {
            'm', 'male' => 'Male',
            'f', 'female' => 'Female',
            '' => null,
            default => ucfirst($g),
        };
    }
}
