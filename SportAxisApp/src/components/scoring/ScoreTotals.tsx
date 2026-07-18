import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOWS, SPACING } from '../../../constants/theme';
import type { Criterion } from '../../types';
import { computeTotalScore } from '../../utils/score-calculator';

// ─────────────────────────────────────────────────────────────────────────────
// ScoreTotals — Live total with BatStateU red brand accent
// ─────────────────────────────────────────────────────────────────────────────

interface ScoreTotalsProps {
  criteria:   Criterion[];
  scores:     Record<string, string>;
  isComplete: boolean;
}

export function ScoreTotals({ criteria, scores, isComplete }: ScoreTotalsProps) {
  const numericScores: Record<string, number> = {};
  for (const [id, val] of Object.entries(scores)) {
    const n = parseFloat(val);
    if (!isNaN(n)) numericScores[id] = n;
  }

  const total      = computeTotalScore(numericScores, criteria);
  const maxTotal   = criteria.reduce((s, c) => s + c.max_score, 0);
  const percentage = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
  const hasWeights = criteria.some((c) => c.weight != null);

  const scoreColor =
    percentage >= 85 ? COLORS.success :
    percentage >= 50 ? COLORS.primary :
    COLORS.textSecondary;

  return (
    <View style={styles.container}>
      {/* Red header stripe — mirrors web red gradient sidebar */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>
          {hasWeights ? 'WEIGHTED TOTAL' : 'TOTAL SCORE'}
        </Text>
        {isComplete && (
          <View style={styles.readyBadge}>
            <Ionicons name="checkmark" size={12} color={COLORS.textInverse} style={{ marginRight: 4 }} />
            <Text style={styles.readyText}>Ready</Text>
          </View>
        )}
      </View>

      {/* Score display */}
      <View style={styles.scoreRow}>
        <Text style={[styles.scoreValue, { color: scoreColor }]}>
          {total.toFixed(2)}
        </Text>
        {!hasWeights && (
          <Text style={styles.maxScore}>/ {maxTotal}</Text>
        )}
      </View>

      {/* Mini breakdown */}
      <View style={styles.breakdown}>
        {criteria.map((c) => {
          const val = numericScores[c.criteria_id] ?? null;
          return (
            <View key={c.criteria_id} style={styles.breakdownRow}>
              <Text style={styles.breakdownName} numberOfLines={1}>{c.name}</Text>
              <Text style={styles.breakdownValue}>
                {val !== null ? val : '–'} / {c.max_score}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     COLORS.border,
    overflow:        'hidden',
    ...SHADOWS.card,
  },
  // Red top stripe matching web sidebar
  header: {
    backgroundColor:  COLORS.primary,
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
  },
  headerLabel: {
    fontSize:      FONT_SIZE.xs,
    fontWeight:    FONT_WEIGHT.semibold,
    color:         'rgba(255,255,255,0.85)',
    letterSpacing: 1.2,
  },
  readyBadge: {
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderRadius:    RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   2,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.40)',
    flexDirection:     'row',
    alignItems:        'center',
  },
  readyText: {
    color:      '#fff',
    fontSize:   FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
  },

  // Score
  scoreRow: {
    alignItems:     'center',
    flexDirection:  'row',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    gap:            SPACING.sm,
  },
  scoreValue: {
    fontSize:   FONT_SIZE.hero,
    fontWeight: FONT_WEIGHT.extrabold,
  },
  maxScore: {
    fontSize:   FONT_SIZE.xl,
    color:      COLORS.textMuted,
    alignSelf:  'flex-end',
    marginBottom: 6,
  },

  // Breakdown
  breakdown: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding:        SPACING.md,
    gap:            SPACING.xs,
  },
  breakdownRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
  },
  breakdownName: {
    fontSize: FONT_SIZE.sm,
    color:    COLORS.textSecondary,
    flex:     1,
  },
  breakdownValue: {
    fontSize:   FONT_SIZE.sm,
    color:      COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.medium,
  },
});
