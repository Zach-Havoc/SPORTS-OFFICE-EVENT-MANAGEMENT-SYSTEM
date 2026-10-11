<?php

namespace Tests\Unit;

use App\Services\OcrScoreMatcher;
use PHPUnit\Framework\TestCase;

/**
 * The score-matching rules, on hand-built OCR output shaped like what
 * PaddleOCR returns for the printed score sheets. No database needed.
 */
class OcrScoreMatcherTest extends TestCase
{
    private const CAS = 'College of Arts and Sciences';

    private const CTE = 'College of Teacher Education';

    /** An OCR line: text at a box (x, y, width, height), optionally tilted. */
    private function line(string $text, float $x, float $y, float $w = 60, float $h = 30, float $tilt = 0): array
    {
        $dy = $w * $tilt;

        return ['text' => $text, 'confidence' => 0.9, 'poly' => [[$x, $y], [$x + $w, $y + $dy], [$x + $w, $y + $dy + $h], [$x, $y + $h]]];
    }

    private function scores(array $lines, array $departments, array $abbreviations = []): array
    {
        [$scores] = (new OcrScoreMatcher)->match($lines, $departments, $abbreviations);

        return collect($scores)->mapWithKeys(fn ($s) => [$s['department'] => $s['score']])->all();
    }

    /** A volleyball-style table: TEAM | SET 1 | SET 2 | SET 3 | SETS WON | FINAL. */
    private function setTable(array $rows): array
    {
        $lines = [
            $this->line('TEAM A: '.self::CAS, 0, 0, 500),
            $this->line('TEAM B: '.self::CTE, 600, 0, 500),
            $this->line('TEAM', 0, 100, 80),
            $this->line('SET 1', 500, 100),
            $this->line('SET 2', 650, 100),
            $this->line('SET 3', 800, 100),
            $this->line('SETS WON', 950, 100, 110),
            $this->line('FINAL', 1150, 100),
        ];
        foreach ($rows as $i => [$name, $cells]) {
            $y = 160 + $i * 50;
            $lines[] = $this->line($name, 0, $y, 400);
            foreach ($cells as $x => $text) {
                $lines[] = $this->line($text, $x, $y, 30);
            }
        }

        return $lines;
    }

    public function test_the_header_line_naming_a_team_is_not_its_results_row(): void
    {
        $lines = [
            $this->line('DEPARTMENTS: '.self::CAS.' · '.self::CTE, 0, 0, 900),
            $this->line('DATE: October 28, 2026', 1000, 0, 300),
            $this->line('TEAM / DEPARTMENT', 0, 80, 300),
            $this->line('OVERALL SCORE (0-100)', 500, 80, 250),
            $this->line('RANK', 900, 80),
            $this->line(self::CAS, 0, 140, 400),
            $this->line('71', 600, 140, 40),
            $this->line('1', 910, 140, 20),
            $this->line(self::CTE, 0, 200, 400),
            $this->line('46', 600, 200, 40),
            $this->line('2', 910, 200, 20),
        ];

        $this->assertSame([self::CAS => 71.0, self::CTE => 46.0], $this->scores($lines, [self::CAS, self::CTE]));
    }

    public function test_the_result_column_wins_over_the_set_scores_before_it(): void
    {
        $lines = $this->setTable([
            [self::CAS, [520 => '25', 670 => '18', 820 => '25', 990 => '2', 1160 => '2']],
            [self::CTE, [520 => '20', 670 => '25', 820 => '21', 990 => '1', 1160 => '1']],
        ]);

        $this->assertSame([self::CAS => 2.0, self::CTE => 1.0], $this->scores($lines, [self::CAS, self::CTE]));
    }

    public function test_a_number_off_centre_in_the_result_cell_still_belongs_to_that_column(): void
    {
        // Handwriting sits wherever it sits in the cell: here nearer SET 3's
        // edge than the SETS WON text, but still nearest that heading.
        $lines = $this->setTable([
            [self::CAS, [520 => '25', 670 => '18', 820 => '25', 905 => '2']],
        ]);

        $this->assertSame([self::CAS => 2.0], $this->scores($lines, [self::CAS]));
    }

    public function test_a_blank_result_cell_gives_no_score_rather_than_a_set_score(): void
    {
        $lines = $this->setTable([
            [self::CAS, [520 => '25', 670 => '18', 820 => '25']],
        ]);

        $this->assertSame([], $this->scores($lines, [self::CAS]));
    }

    public function test_a_long_college_name_wrapped_over_three_lines_is_still_found(): void
    {
        $long = 'College of Accountancy, Business, Economics, and International Hospitality Management';
        $lines = [
            $this->line('GAMES WON', 900, 100, 110),
            $this->line('College of Accountancy, Business,', 0, 150, 380),
            $this->line('Economics, and International Hospitality', 0, 182, 400),
            $this->line('Management', 0, 214, 150),
            $this->line('2', 940, 182, 25),
        ];

        $this->assertSame([$long => 2.0], $this->scores($lines, [$long]));
    }

    public function test_a_section_title_above_the_name_is_not_read_as_part_of_it(): void
    {
        $lines = $this->setTable([
            [self::CAS, [520 => '12', 670 => '21', 820 => '12']],
        ]);
        $lines[] = $this->line('SET SCORES', 0, 128, 150);

        $this->assertSame([], $this->scores($lines, [self::CAS]));
    }

    public function test_a_handwritten_zero_read_as_the_letter_o_counts_as_zero(): void
    {
        $lines = $this->setTable([
            [self::CTE, [520 => '20', 670 => '15', 990 => 'O']],
        ]);

        $this->assertSame([self::CTE => 0.0], $this->scores($lines, [self::CTE]));
    }

    public function test_a_tilted_photo_keeps_each_score_on_its_own_row(): void
    {
        // Each row slopes up by 6% (about 3.4°): its score at x=1000 sits 60
        // px higher than the name's middle, level with the row above.
        $lines = [$this->line('FINAL SCORE', 950, 0, 150)];
        foreach ([[self::CAS, 100, '53'], [self::CTE, 160, '62']] as [$name, $y, $score]) {
            $lines[] = $this->line($name, 0, $y, 400, 30, -0.06);
            $lines[] = $this->line($score, 1000, $y - 48, 40);
        }

        $this->assertSame([self::CAS => 53.0, self::CTE => 62.0], $this->scores($lines, [self::CAS, self::CTE]));
    }

    public function test_a_short_name_counts_only_under_a_result_column(): void
    {
        $lines = $this->setTable([['CAS', [520 => '25', 670 => '18', 990 => '2']]]);
        $this->assertSame([self::CAS => 2.0], $this->scores($lines, [self::CAS], [self::CAS => 'CAS']));

        // No result column: "CAS 14" could be anything (a jersey, a time).
        $bare = [$this->line('CAS', 0, 100, 60), $this->line('14', 200, 100, 30)];
        $this->assertSame([], $this->scores($bare, [self::CAS], [self::CAS => 'CAS']));
    }

    public function test_a_plain_name_and_score_table_still_reads_the_first_number(): void
    {
        $lines = [$this->line(self::CAS, 0, 100, 400), $this->line('87', 500, 100, 40)];

        $this->assertSame([self::CAS => 87.0], $this->scores($lines, [self::CAS]));
    }
}
