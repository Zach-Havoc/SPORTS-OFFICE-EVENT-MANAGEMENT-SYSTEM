<?php

namespace App\Services;

/**
 * Turns the OCR service's text lines into one score per college.
 *
 * PaddleOCR only reads text; it has no idea which number belongs to which
 * college. The score sheets print a college's name in one table cell and its
 * result in another cell of the same row, under a column heading such as
 * FINAL, SETS WON or OVERALL SCORE, while the same row also carries set or
 * game scores, and the sheet's header repeats the college names ("SIDE A:
 * College of …", "DEPARTMENTS: … · …"). So, per college:
 *
 *  1. The page is straightened first: a phone photo is tilted a few degrees,
 *     and over a wide table that moves a row's far cells off its line.
 *  2. Lines that name the college are found, skipping header lines (a label
 *     such as "SIDE A:", both teams named, or "vs"). A long name wraps in its
 *     cell and comes back as two to four stacked lines; those are joined.
 *  3. On that row, the number under the best result column wins
 *     (RESULT_COLUMNS, in order). With no result column on the sheet, the
 *     first number right of the name is taken, as a plain "Team | 87" table
 *     reads.
 *  4. The college's short name (CICS) also counts, but only when it lines up
 *     with a result column; a short name alone is too common on a sheet.
 *
 * A college with no such number is left out, never guessed. Measured on 54
 * generated sheets by e2e/ocr-accuracy.
 */
class OcrScoreMatcher
{
    /** Column headings that hold a team's result, most specific first. */
    private const RESULT_COLUMNS = [
        '/\bfinal\s+score\b/i',
        '/\boverall\s+score\b/i',
        '/\btotal\s+score\b/i',
        '/\bsets?\s+won\b/i',
        '/\bgames?\s+won\b/i',
        '/^\W*final\W*$/i',
        '/\bmatch\s+result\b/i',
        '/^\W*total\W*$/i',
    ];

    /** A sheet header that names a team rather than scoring it. */
    private const LABEL = '/^\W*(departments?|teams?|side\s*[ab12]|team\s*[ab12]|team\s*(home|away)|home|away|event|competition|category|venue|date)\b/i';

    /**
     * @param  array<int, array{text: string, confidence?: float, poly?: mixed}>  $rawLines
     * @param  array<int, string>  $departments
     * @param  array<string, string>  $abbreviations  college name => short name
     * @return array{0: array<int, array{department: string, score: float, confidence: float}>, 1: string}
     */
    public function match(array $rawLines, array $departments, array $abbreviations = []): array
    {
        $lines = $this->normalise($rawLines);
        $headers = $this->resultHeaders($lines);
        $candidates = [...$lines, ...$this->stackedBlocks($lines)];

        $rows = [];
        foreach ($departments as $department) {
            $rows[$department] = trim($department) === ''
                ? []
                : $this->nameRows($lines, $candidates, $department, $departments, $abbreviations);
        }

        $scores = [];
        $unmatched = [];
        foreach ($departments as $department) {
            // The other colleges' rows: a number nearer one of them is theirs.
            $rivals = [];
            foreach ($rows as $other => $r) {
                if ($other !== $department) {
                    $rivals = [...$rivals, ...$r];
                }
            }
            $found = trim($department) === ''
                ? null
                : $this->scoreFor($lines, $headers, $department, $rows[$department], $rivals, $departments, $abbreviations);
            if ($found === null) {
                $unmatched[] = $department;

                continue;
            }
            $scores[] = ['department' => $department, 'score' => $found['value'], 'confidence' => $found['confidence']];
        }

        $notes = $unmatched === []
            ? ''
            : 'Could not find a score for: '.implode(', ', $unmatched).'.';

        return [$scores, $notes];
    }

    /**
     * The lines (or wrapped-line blocks) that name this college in a results
     * row rather than in the sheet's header.
     */
    private function nameRows(array $lines, array $candidates, string $department, array $departments, array $abbreviations): array
    {
        $others = array_values(array_filter($departments, fn ($d) => $d !== $department));
        $rows = [];
        foreach ($candidates as $line) {
            if (! $this->lineMatchesDepartment($line['text'], $department) || $this->isHeader($line, $departments, $abbreviations)) {
                continue;
            }
            if (count($line['parts']) > 1 && ! $this->isWrappedName($lines, $line, $department)) {
                continue;
            }
            // "College of IT" sits inside "College of Information Technology":
            // a line naming a longer competing college belongs to that one.
            if ($this->namesAnotherCollege($line['text'], $department, $others)) {
                continue;
            }
            $rows[] = $line;
        }

        return $rows;
    }

    /**
     * @return array{value: float, confidence: float}|null
     */
    private function scoreFor(array $lines, array $headers, string $department, array $nameRows, array $rivals, array $departments, array $abbreviations): ?array
    {
        $fallback = null;

        // The full name first. A row under a result column beats a bare row.
        foreach ($nameRows as $line) {
            $tokens = $this->rowTokens($lines, $line, $department, $rivals);
            $hit = $this->underResultColumn($tokens, $headers, $line);
            if ($hit !== null) {
                return $hit;
            }
            // A row under a result column whose cell came out blank: any
            // other number on it is a set or game score, so nothing is better
            // than a wrong score.
            if (! $this->hasResultColumn($headers, $line)) {
                $fallback ??= $tokens[0] ?? null;
            }
        }
        if ($fallback !== null) {
            return ['value' => $fallback['value'], 'confidence' => $fallback['confidence']];
        }

        // Then the short name, only where a result column vouches for it.
        $short = $abbreviations[$department] ?? null;
        if ($short && mb_strlen($short) >= 2) {
            $short = mb_strtolower($short);
            foreach ($lines as $line) {
                if (! in_array($short, $this->normalizedWords($line['text']), true) || $this->isHeader($line, $departments, $abbreviations)) {
                    continue;
                }
                $hit = $this->underResultColumn($this->rowTokens($lines, $line, $short, $rivals), $headers, $line);
                if ($hit !== null) {
                    return $hit;
                }
            }
        }

        return null;
    }

    /* ── Geometry ──────────────────────────────────────────────────────── */

    /**
     * Each line with its box in the straightened page: x1/x2 (left, right),
     * y1/y2 (top, bottom), cx/cy (centre) and h (height). A line without a
     * usable polygon keeps null geometry; it can still match by its text.
     */
    private function normalise(array $rawLines): array
    {
        $angle = $this->pageTilt($rawLines);
        $cos = cos($angle);
        $sin = sin($angle);

        $out = [];
        foreach ($rawLines as $l) {
            if (! is_array($l) || ! is_string($l['text'] ?? null)) {
                continue;
            }
            $line = [
                'text' => $l['text'],
                'confidence' => is_numeric($l['confidence'] ?? null) ? (float) $l['confidence'] : 0.5,
                'x1' => null, 'x2' => null, 'y1' => null, 'y2' => null, 'cx' => null, 'cy' => null, 'h' => null,
                'slope' => 0.0, 'parts' => [count($out)],
            ];
            $pts = $this->points($l['poly'] ?? null);
            if ($pts !== null) {
                // Rotate every corner back by the page's tilt, then box it.
                $us = $vs = [];
                foreach ($pts as [$x, $y]) {
                    $us[] = $x * $cos + $y * $sin;
                    $vs[] = -$x * $sin + $y * $cos;
                }
                $line['x1'] = min($us);
                $line['x2'] = max($us);
                $line['y1'] = min($vs);
                $line['y2'] = max($vs);
                $line['cx'] = ($line['x1'] + $line['x2']) / 2;
                $line['cy'] = ($line['y1'] + $line['y2']) / 2;
                // The text height, not the rotated box's (a long tilted line
                // has a tall box but short letters).
                $line['h'] = count($pts) === 4
                    ? max(1.0, hypot($pts[3][0] - $pts[0][0], $pts[3][1] - $pts[0][1]))
                    : max(1.0, $line['y2'] - $line['y1']);
                // A long line's own slope after straightening: perspective
                // tilts one part of a photo more than another, and a college
                // name is a good ruler for its own row.
                if (count($pts) === 4 && hypot($pts[1][0] - $pts[0][0], $pts[1][1] - $pts[0][1]) > 4 * $line['h']) {
                    $own = atan2($pts[1][1] - $pts[0][1], $pts[1][0] - $pts[0][0]) - $angle;
                    $line['slope'] = abs($own) <= 0.12 ? tan($own) : 0.0;
                }
            }
            $out[] = $line;
        }

        return $out;
    }

    /**
     * A name too long for its cell wraps, and OCR returns each wrapped line
     * on its own: two to four lines stacked straight down with the same left
     * edge, read here as one line (the text joined, the box around them all).
     */
    private function stackedBlocks(array $lines): array
    {
        $placed = array_filter($lines, fn ($l) => $l['cy'] !== null);
        $blocks = [];
        foreach ($placed as $i => $first) {
            $block = $first;
            for ($n = 1; $n < 4; $n++) {
                $next = null;
                foreach ($placed as $j => $l) {
                    $gap = $l['y1'] - $block['y2'];
                    if ($j === $i || in_array($j, $block['parts'], true)
                        || abs($l['x1'] - $first['x1']) > 1.5 * $first['h']
                        || $gap < -0.4 * $first['h'] || $gap > 0.9 * $first['h']) {
                        continue;
                    }
                    if ($next === null || $l['y1'] < $placed[$next]['y1']) {
                        $next = $j;
                    }
                }
                if ($next === null) {
                    break;
                }
                $l = $placed[$next];
                $block = [
                    'text' => $block['text'].' '.$l['text'],
                    'confidence' => min($block['confidence'], $l['confidence']),
                    'x1' => min($block['x1'], $l['x1']), 'x2' => max($block['x2'], $l['x2']),
                    'y1' => $block['y1'], 'y2' => max($block['y2'], $l['y2']),
                    'h' => $first['h'],
                    'slope' => $first['slope'],
                    'parts' => [...$block['parts'], $next],
                ];
                $block['cx'] = ($block['x1'] + $block['x2']) / 2;
                $block['cy'] = ($block['y1'] + $block['y2']) / 2;
                $blocks[] = $block;
            }
        }

        return $blocks;
    }

    /**
     * Stacked lines are this college's wrapped name only if the name starts
     * on the first of them (not a section title above it) and no one of them
     * holds the whole name already.
     */
    private function isWrappedName(array $lines, array $block, string $department): bool
    {
        foreach ($block['parts'] as $i) {
            if ($this->lineMatchesDepartment($lines[$i]['text'], $department)) {
                return false;
            }
        }
        $first = $this->normalizedWords($department)[0] ?? '';
        foreach ($this->normalizedWords($lines[$block['parts'][0]]['text']) as $i => $word) {
            if ($i < 2 && $this->wordsAreClose($first, $word)) {
                return true;
            }
        }

        return false;
    }

    /** @return array<int, array{0: float, 1: float}>|null */
    private function points($poly): ?array
    {
        if (! is_array($poly) || count($poly) < 2) {
            return null;
        }
        $pts = [];
        foreach ($poly as $p) {
            if (! is_array($p) || ! is_numeric($p[0] ?? null) || ! is_numeric($p[1] ?? null)) {
                return null;
            }
            $pts[] = [(float) $p[0], (float) $p[1]];
        }

        return $pts;
    }

    /**
     * The page's tilt in radians: the median slope of the top edge of the
     * long text lines (PaddleOCR gives corners clockwise from top-left).
     */
    private function pageTilt(array $rawLines): float
    {
        $angles = [];
        foreach ($rawLines as $l) {
            $pts = is_array($l) ? $this->points($l['poly'] ?? null) : null;
            if ($pts === null || count($pts) !== 4) {
                continue;
            }
            $w = hypot($pts[1][0] - $pts[0][0], $pts[1][1] - $pts[0][1]);
            $h = hypot($pts[3][0] - $pts[0][0], $pts[3][1] - $pts[0][1]);
            if ($w > 3 * $h && $w > 0) {
                $angles[] = atan2($pts[1][1] - $pts[0][1], $pts[1][0] - $pts[0][0]);
            }
        }
        if (count($angles) < 3) {
            return 0.0;
        }
        sort($angles);
        $mid = intdiv(count($angles), 2);
        $angle = count($angles) % 2 ? $angles[$mid] : ($angles[$mid - 1] + $angles[$mid]) / 2;

        // Beyond ~20° it is not a tilted photo of an upright sheet.
        return abs($angle) <= 0.35 ? $angle : 0.0;
    }

    /**
     * The numbers on the name line's row, left to right, each with where it
     * sits: those after the name on the line itself, then the other cells of
     * the row to its right.
     *
     * @return array<int, array{value: float, confidence: float, cx: ?float}>
     */
    private function rowTokens(array $lines, array $nameLine, string $name, array $rivals = []): array
    {
        $tokens = [];

        // "College of Engineering: 87" — a number written on the name line.
        foreach ($this->numbersIn($this->afterName($nameLine['text'], $name), false) as $value) {
            $tokens[] = ['value' => $value, 'confidence' => $nameLine['confidence'], 'cx' => $nameLine['x2']];
        }
        if ($nameLine['cy'] === null) {
            return $tokens;
        }

        $mates = [];
        foreach ($lines as $j => $l) {
            if (in_array($j, $nameLine['parts'], true) || $l['cy'] === null || $l['cx'] <= $nameLine['cx']) {
                continue;
            }
            // A wrapped name's cell is as tall as its lines together; the
            // score sits level with the middle of it. A skewed photo lifts or
            // drops the far cells, so the band is generous, and a number
            // nearer another college's row is left to that college.
            $dy = abs($l['cy'] - $this->rowLevel($nameLine, $l['cx']));
            if ($dy > max(0.5 * ($nameLine['y2'] - $nameLine['y1']), $nameLine['h'], $l['h'])) {
                continue;
            }
            foreach ($rivals as $r) {
                if ($r['cy'] !== null && $r['cx'] < $l['cx'] && abs($l['cy'] - $this->rowLevel($r, $l['cx'])) < $dy) {
                    continue 2;
                }
            }
            $values = $this->numbersIn($l['text'], true);
            // A cell read as one line holding several numbers ("23 12"): spread
            // them across its width.
            $n = count($values);
            foreach ($values as $k => $value) {
                $mates[] = [
                    'value' => $value,
                    'confidence' => $l['confidence'],
                    'cx' => $l['x1'] + ($k + 0.5) * ($l['x2'] - $l['x1']) / $n,
                ];
            }
        }
        usort($mates, fn ($a, $b) => $a['cx'] <=> $b['cx']);

        return array_merge($tokens, $mates);
    }

    /** Where a name line's row runs at horizontal position $x, following the line's own slope. */
    private function rowLevel(array $nameLine, float $x): float
    {
        return $nameLine['cy'] + ($x - $nameLine['cx']) * $nameLine['slope'];
    }

    /** The text after the department's name, so "Team 2: College of X 87" yields 87, not 2. */
    private function afterName(string $text, string $name): string
    {
        $pos = mb_stripos($text, $name);
        if ($pos !== false) {
            return mb_substr($text, $pos + mb_strlen($name));
        }
        // A fuzzy match: what follows the name's last word.
        $words = $this->normalizedWords($name);
        $last = end($words);
        if ($last && preg_match('/'.preg_quote($last, '/').'\w*(.*)$/iu', $text, $m)) {
            return $m[1];
        }

        return $text;
    }

    /**
     * Plausible scores (0–100) in a piece of text. In a cell of its own, the
     * letters OCR mistakes handwritten digits for are read as those digits:
     * "O" 0, "l" / "I" / "|" 1, "S" 5 ("5S" is 55).
     *
     * @return array<int, float>
     */
    private function numbersIn(string $text, bool $wholeCell): array
    {
        $t = trim($text);
        // A cell of digits and look-alike letters: with a digit in it, or a
        // lone O / l / I / |. A lone "S" stays a letter.
        if ($wholeCell && preg_match('/^[0-9OoIl|Ss]{1,3}$/', $t) && preg_match('/[0-9]|^[OoIl|]$/', $t)) {
            $t = strtr($t, ['O' => '0', 'o' => '0', 'I' => '1', 'l' => '1', '|' => '1', 'S' => '5', 's' => '5']);
        }
        if (! preg_match_all('/(?<![\d.])\d{1,3}(?:\.\d{1,2})?(?![\d])/', $t, $m)) {
            return [];
        }

        return array_values(array_filter(
            array_map('floatval', $m[0]),
            fn ($v) => $v >= 0 && $v <= 100,
        ));
    }

    /* ── Result columns ────────────────────────────────────────────────── */

    /**
     * Result column headings on the sheet, each with its priority and the
     * centres of the other headings on its header row (GAME 1, SET 2, RANK…),
     * so a number can be put in the column it is nearest to.
     */
    private function resultHeaders(array $lines): array
    {
        $headers = [];
        foreach ($lines as $l) {
            if ($l['cy'] === null) {
                continue;
            }
            foreach (self::RESULT_COLUMNS as $rank => $pattern) {
                if (preg_match($pattern, $l['text'])) {
                    $siblings = [];
                    foreach ($lines as $o) {
                        if ($o['cy'] !== null && abs($o['cy'] - $l['cy']) <= 0.8 * max($l['h'], $o['h'])) {
                            $siblings[] = $o['cx'];
                        }
                    }
                    $headers[] = $l + ['rank' => $rank, 'siblings' => $siblings];
                    break;
                }
            }
        }
        usort($headers, fn ($a, $b) => $a['rank'] <=> $b['rank']);

        return $headers;
    }

    /**
     * A result column heading that heads this row: a little above it (not a
     * page away) and right of the name. A label beside the names ("FINAL
     * SCORE" printed down the left of a strip) is not a column.
     */
    private function columnsOver(array $headers, array $nameLine): array
    {
        if ($nameLine['cy'] === null) {
            return [];
        }
        $h = $nameLine['h'];

        return array_values(array_filter($headers, function ($head) use ($nameLine, $h) {
            $above = $nameLine['y1'] - $head['y2'];

            return $above >= -0.5 * $h && $above <= 12 * $h && $head['cx'] > $nameLine['x2'];
        }));
    }

    private function hasResultColumn(array $headers, array $nameLine): bool
    {
        return $this->columnsOver($headers, $nameLine) !== [];
    }

    /**
     * The number in the row that falls in the best result column: of all the
     * headings on that header row, the result heading is the one it is
     * nearest to (a handwritten number rarely sits right under the printed
     * heading, but it stays inside its column).
     *
     * @return array{value: float, confidence: float}|null
     */
    private function underResultColumn(array $tokens, array $headers, array $nameLine): ?array
    {
        $h = $nameLine['h'];
        foreach ($this->columnsOver($headers, $nameLine) as $head) {
            $best = null;
            foreach ($tokens as $t) {
                if ($t['cx'] === null) {
                    continue;
                }
                $d = abs($t['cx'] - $head['cx']);
                if ($d > max($head['x2'] - $head['x1'], 4 * $h)) {
                    continue;
                }
                foreach ($head['siblings'] as $sx) {
                    if (abs($t['cx'] - $sx) < $d - 1) {
                        continue 2; // nearer another column
                    }
                }
                if ($best === null || $d < $best[0]) {
                    $best = [$d, $t];
                }
            }
            if ($best !== null) {
                return ['value' => $best[1]['value'], 'confidence' => $best[1]['confidence']];
            }
        }

        return null;
    }

    /* ── Names ─────────────────────────────────────────────────────────── */

    /** A line that names a team in the sheet's header, not in a results row. */
    private function isHeader(array $line, array $departments, array $abbreviations): bool
    {
        $text = $line['text'];
        if (preg_match(self::LABEL, $text) || preg_match('/\bvs\.?\b/i', $text)) {
            return true;
        }
        $named = 0;
        $words = $this->normalizedWords($text);
        foreach ($departments as $d) {
            $short = isset($abbreviations[$d]) ? mb_strtolower($abbreviations[$d]) : null;
            if ($this->lineMatchesDepartment($text, $d) || ($short && in_array($short, $words, true))) {
                $named++;
            }
        }

        return $named >= 2;
    }

    private function namesAnotherCollege(string $text, string $department, array $others): bool
    {
        foreach ($others as $other) {
            if (mb_strlen($other) > mb_strlen($department) && $this->lineMatchesDepartment($text, $other)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Word-by-word fuzzy match, tolerant of the odd single-character OCR
     * misread ("Sclences" for "Sciences") that would defeat a plain
     * str_contains() check outright. Every word in the department name must
     * have a close match somewhere in the line; short (<=3 letter) words —
     * "of", "and" — must match exactly, since fuzzy matching those causes
     * false positives (nearly anything is "close" to a 2-3 letter word).
     */
    public function lineMatchesDepartment(string $lineText, string $department): bool
    {
        $deptWords = $this->normalizedWords($department);
        if ($deptWords === []) {
            return false;
        }

        $lineWords = $this->normalizedWords($lineText);

        foreach ($deptWords as $deptWord) {
            $hasMatch = false;
            foreach ($lineWords as $lineWord) {
                if ($this->wordsAreClose($deptWord, $lineWord)) {
                    $hasMatch = true;
                    break;
                }
            }
            if (! $hasMatch) {
                return false;
            }
        }

        return true;
    }

    /** @return array<int, string> */
    private function normalizedWords(string $text): array
    {
        $clean = (string) preg_replace('/[^a-z0-9\s]/', ' ', mb_strtolower($text));

        return array_values(array_filter(preg_split('/\s+/', trim($clean)) ?: []));
    }

    private function wordsAreClose(string $a, string $b): bool
    {
        if ($a === $b) {
            return true;
        }

        if (mb_strlen($a) <= 3 || mb_strlen($b) <= 3) {
            return false;
        }

        // Roughly 1 tolerated edit per 6 characters — enough to absorb a
        // single misread letter on a real college-name-length word without
        // starting to match genuinely different words.
        $maxLen = max(mb_strlen($a), mb_strlen($b));

        return levenshtein($a, $b) <= max(1, (int) floor($maxLen / 6));
    }
}
