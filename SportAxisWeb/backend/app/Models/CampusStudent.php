<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * One row of the registrar's enrolled-student roster, keyed by SR Code.
 * Used to verify that an athlete signing up is a real campus student.
 */
class CampusStudent extends Model
{
    protected $primaryKey = 'sr_code';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'sr_code', 'first_name', 'last_name', 'middle_name',
        'gender', 'college', 'program', 'year_level', 'email',
    ];

    /** Canonicalise an SR Code for storage / lookup: upper-case, single hyphen, no spaces. */
    public static function normalizeCode(?string $raw): string
    {
        $s = strtoupper(trim((string) $raw));
        $s = preg_replace('/\s*-\s*/', '-', $s);   // "23 - 75760" -> "23-75760"

        return preg_replace('/\s+/', '', $s);
    }

    public function fullName(): string
    {
        return trim("{$this->first_name} {$this->last_name}");
    }

    /**
     * True when every token of this student's first + last name also appears in
     * the supplied name. Order-insensitive and lenient about extra tokens (a
     * middle name, a suffix) so "Cruz, Juan Dela" still matches "Juan Dela Cruz".
     */
    public function nameMatches(?string $input): bool
    {
        $tokenise = fn (string $v) => collect(preg_split('/\s+/', Str::of($v)->lower()->replaceMatches('/[^\p{L}\p{N}\s]/u', ' ')->squish()))
            ->filter()
            ->values();

        $need = $tokenise("{$this->first_name} {$this->last_name}");
        $have = $tokenise((string) $input)->flip();

        if ($need->isEmpty()) {
            return false;
        }

        return $need->every(fn ($t) => $have->has($t));
    }
}
