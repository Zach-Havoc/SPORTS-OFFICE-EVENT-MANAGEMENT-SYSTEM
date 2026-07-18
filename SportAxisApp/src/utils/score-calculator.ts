import type { Criterion, ScoreEntry } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Score Calculator Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute total score from score entries and criteria.
 *
 * If any criterion has a weight, uses weighted average:
 *   total = Σ(value × weight) / Σ(weight)
 *
 * If no weights are defined, uses simple sum:
 *   total = Σ(value)
 */
export function computeTotalScore(
  scores: Record<string, number>, // { criteria_id: value }
  criteria: Criterion[],
): number {
  if (criteria.length === 0) return 0;

  const hasWeights = criteria.some((c) => c.weight != null && c.weight > 0);

  if (hasWeights) {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const criterion of criteria) {
      const value  = scores[criterion.criteria_id] ?? 0;
      const weight = criterion.weight ?? 1;
      weightedSum += value * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? parseFloat((weightedSum / totalWeight).toFixed(4)) : 0;
  }

  // Simple sum
  let total = 0;
  for (const criterion of criteria) {
    total += scores[criterion.criteria_id] ?? 0;
  }
  return parseFloat(total.toFixed(4));
}

/**
 * Convert a score map to the ScoreEntry array required by the API.
 */
export function scoreMapToEntries(
  scores: Record<string, number>,
): ScoreEntry[] {
  return Object.entries(scores).map(([criteria_id, value]) => ({
    criteria_id,
    value,
  }));
}

/**
 * Validate that all required scores are filled and within limits.
 * Returns an error map { criteria_id: errorMessage }.
 */
export function validateScores(
  scores: Record<string, number>,
  criteria: Criterion[],
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const criterion of criteria) {
    const value = scores[criterion.criteria_id];

    if (value === undefined || value === null || isNaN(value)) {
      errors[criterion.criteria_id] = `${criterion.name} is required.`;
      continue;
    }

    if (value < 0) {
      errors[criterion.criteria_id] = `${criterion.name} cannot be negative.`;
      continue;
    }

    if (value > criterion.max_score) {
      errors[criterion.criteria_id] =
        `${criterion.name} cannot exceed ${criterion.max_score}.`;
    }
  }

  return errors;
}
