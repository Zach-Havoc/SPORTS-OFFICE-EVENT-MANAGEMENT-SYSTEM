import React, { useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { CriteriaInput } from './CriteriaInput';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../../../constants/theme';
import type { Criterion } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// ScoringForm — Dynamic form rendering all criteria inputs
// ─────────────────────────────────────────────────────────────────────────────

interface ScoringFormProps {
  criteria:      Criterion[];
  scores:        Record<string, string>;    // { criteria_id: raw string input }
  errors:        Record<string, string>;    // { criteria_id: error message }
  onScoreChange: (criteriaId: string, value: string) => void;
  disabled?:     boolean;
}

export function ScoringForm({
  criteria,
  scores,
  errors,
  onScoreChange,
  disabled = false,
}: ScoringFormProps) {
  const handleChange = useCallback(
    (criteriaId: string, value: string) => {
      onScoreChange(criteriaId, value);
    },
    [onScoreChange],
  );

  if (criteria.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No criteria defined for this event.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Scoring Criteria</Text>
        <Text style={styles.sectionSubtitle}>{criteria.length} criteria</Text>
      </View>

      {criteria.map((criterion) => (
        <CriteriaInput
          key={criterion.criteria_id}
          criterion={criterion}
          value={scores[criterion.criteria_id] ?? ''}
          onChange={handleChange}
          error={errors[criterion.criteria_id]}
          disabled={disabled}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   SPACING.md,
  },
  sectionTitle: {
    fontSize:   FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color:      COLORS.textPrimary,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZE.sm,
    color:    COLORS.textSecondary,
  },
  empty: {
    padding:        SPACING.xl,
    alignItems:     'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color:    COLORS.textMuted,
    textAlign: 'center',
  },
});
