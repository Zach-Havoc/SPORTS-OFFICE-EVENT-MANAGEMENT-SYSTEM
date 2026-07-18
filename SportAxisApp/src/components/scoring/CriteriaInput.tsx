import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { COLORS, FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOWS, SPACING } from '../../../constants/theme';
import type { Criterion } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// CriteriaInput — BatStateU red-and-white scoring input
// ─────────────────────────────────────────────────────────────────────────────

interface CriteriaInputProps {
  criterion: Criterion;
  value:     string;
  onChange:  (criteriaId: string, value: string) => void;
  error?:    string;
  disabled?: boolean;
}

export function CriteriaInput({
  criterion, value, onChange, error, disabled = false,
}: CriteriaInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const numericValue = parseFloat(value) || 0;
  const percentage   = criterion.max_score > 0
    ? (numericValue / criterion.max_score) * 100
    : 0;

  // Progress bar: red gradient matching web chart colors
  const progressColor =
    percentage >= 90 ? COLORS.success :
    percentage >= 60 ? COLORS.primaryLighter :
    percentage >= 30 ? COLORS.primary :
    COLORS.surfaceMuted;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parsed  = parseFloat(cleaned);
    if (!isNaN(parsed) && parsed > criterion.max_score) {
      shake();
      onChange(criterion.criteria_id, criterion.max_score.toString());
      return;
    }
    onChange(criterion.criteria_id, cleaned);
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: shakeAnim }] }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.name}>{criterion.name}</Text>
        <View style={styles.maxBadge}>
          <Text style={styles.maxText}>max {criterion.max_score}</Text>
        </View>
      </View>

      {/* Input */}
      <View style={[
        styles.inputWrapper,
        isFocused && styles.inputWrapperFocused,
        !!error && styles.inputWrapperError,
      ]}>
        <TextInput
          style={[styles.input, disabled && styles.inputDisabled]}
          value={value}
          onChangeText={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={COLORS.textMuted}
          editable={!disabled}
          accessibilityLabel={`Score for ${criterion.name}`}
          accessibilityHint={`Enter a number between 0 and ${criterion.max_score}`}
          maxLength={7}
        />
        {criterion.weight != null && (
          <View style={styles.weightBadge}>
            <Text style={styles.weightText}>×{criterion.weight}w</Text>
          </View>
        )}
      </View>

      {/* Progress bar — red shading like web chart-1 → chart-5 */}
      {value !== '' && !error && (
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(percentage, 100)}%`, backgroundColor: progressColor },
            ]}
          />
        </View>
      )}

      {!!error && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={14} color={COLORS.destructive} style={{ marginRight: 4 }} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.sm,
  },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   SPACING.xs,
  },
  name: {
    fontSize:   FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color:      COLORS.textPrimary,
    flex:       1,
  },
  maxBadge: {
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   2,
    borderRadius:      RADIUS.full,
    borderWidth:       1,
    borderColor:       COLORS.borderStrong,
  },
  maxText: {
    fontSize:   FONT_SIZE.xs,
    color:      COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
  },
  inputWrapper: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  COLORS.surface,
    borderRadius:     RADIUS.md,
    borderWidth:      1.5,
    borderColor:      COLORS.borderStrong,
    paddingHorizontal: SPACING.md,
    ...SHADOWS.sm,
  },
  inputWrapperFocused: {
    borderColor: COLORS.primary,
    ...SHADOWS.lg,
  },
  inputWrapperError: {
    borderColor: COLORS.destructive,
  },
  input: {
    flex:            1,
    fontSize:        FONT_SIZE.xxxl,
    fontWeight:      FONT_WEIGHT.bold,
    color:           COLORS.textPrimary,
    paddingVertical: SPACING.md,
    textAlign:       'center',
    minHeight:       72,
  },
  inputDisabled: {
    color: COLORS.textMuted,
  },
  weightBadge: {
    backgroundColor: COLORS.ocrLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   SPACING.xs,
    borderRadius:      RADIUS.sm,
  },
  weightText: {
    fontSize:   FONT_SIZE.sm,
    color:      COLORS.ocr,
    fontWeight: FONT_WEIGHT.semibold,
  },
  progressBar: {
    height:          4,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius:    RADIUS.full,
    marginTop:       SPACING.xs,
    overflow:        'hidden',
  },
  progressFill: {
    height:       4,
    borderRadius: RADIUS.full,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginTop:     SPACING.xs,
  },
  errorText: {
    fontSize:   FONT_SIZE.sm,
    color:      COLORS.destructive,
    fontWeight: FONT_WEIGHT.medium,
  },
});
