import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { COLORS, FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOWS, SPACING } from '../../../constants/theme';
import type { Criterion } from '../../types';
import type { CriterionHint } from '../../utils/sport-config';

// ─────────────────────────────────────────────────────────────────────────────
// CriteriaInput — BatStateU red-and-white scoring input with sport hints
// ─────────────────────────────────────────────────────────────────────────────

interface CriteriaInputProps {
  criterion: Criterion;
  value:     string;
  onChange:  (criteriaId: string, value: string) => void;
  error?:    string;
  disabled?: boolean;
  /** Optional sport-specific hint for this criterion */
  hint?:     CriterionHint | null;
  /** Accent color for this sport */
  sportColor?: string;
}

export function CriteriaInput({
  criterion, value, onChange, error, disabled = false, hint, sportColor,
}: CriteriaInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showRubric, setShowRubric] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const accentColor = sportColor ?? COLORS.primary;
  const numericValue = parseFloat(value) || 0;
  const percentage   = criterion.max_score > 0
    ? (numericValue / criterion.max_score) * 100
    : 0;

  // Progress bar color tiers
  const progressColor =
    percentage >= 90 ? COLORS.success :
    percentage >= 60 ? COLORS.primaryLighter :
    percentage >= 30 ? accentColor :
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

  const hasRubric = hint?.rubric && hint.rubric.length > 0;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: shakeAnim }] }]}>
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.nameRow}>
          {hint?.icon && (
            <View style={[styles.iconBadge, { backgroundColor: `${accentColor}18` }]}>
              <Ionicons
                name={hint.icon as any}
                size={14}
                color={accentColor}
              />
            </View>
          )}
          <Text style={styles.name} numberOfLines={2}>{criterion.name}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.maxBadge, { borderColor: `${accentColor}40`, backgroundColor: `${accentColor}12` }]}>
            <Text style={[styles.maxText, { color: accentColor }]}>max {criterion.max_score}</Text>
          </View>
          {hasRubric && (
            <TouchableOpacity
              style={styles.infoBtn}
              onPress={() => setShowRubric(!showRubric)}
              accessibilityLabel="Show scoring rubric"
            >
              <Ionicons
                name={showRubric ? 'close-circle-outline' : 'information-circle-outline'}
                size={18}
                color={isFocused ? accentColor : COLORS.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Hint text */}
      {hint?.hint && (
        <Text style={styles.hintText}>{hint.hint}</Text>
      )}

      {/* Rubric dropdown */}
      {showRubric && hasRubric && (
        <View style={[styles.rubricBox, { borderColor: `${accentColor}30`, backgroundColor: `${accentColor}08` }]}>
          <Text style={[styles.rubricTitle, { color: accentColor }]}>Scoring Guide:</Text>
          {hint!.rubric!.map((item, i) => (
            <View key={i} style={styles.rubricRow}>
              <Ionicons name="checkmark-circle" size={12} color={accentColor} style={{ marginTop: 1 }} />
              <Text style={styles.rubricItem}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Score Input */}
      <View style={[
        styles.inputWrapper,
        isFocused && [styles.inputWrapperFocused, { borderColor: accentColor }],
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
            <Text style={styles.weightText}>×{criterion.weight}%</Text>
          </View>
        )}
        {/* Inline percentage */}
        {value !== '' && !error && (
          <View style={[styles.percentBadge, { backgroundColor: `${progressColor}22` }]}>
            <Text style={[styles.percentText, { color: progressColor }]}>
              {Math.round(percentage)}%
            </Text>
          </View>
        )}
      </View>

      {/* Progress bar */}
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

      {/* Error */}
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
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  header: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    marginBottom:   SPACING.xs,
    gap: SPACING.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.xs,
  },
  iconBadge: {
    width: 26,
    height: 26,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  name: {
    fontSize:   FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color:      COLORS.textPrimary,
    flex:       1,
    lineHeight: 20,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flexShrink: 0,
  },
  maxBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical:   3,
    borderRadius:      RADIUS.full,
    borderWidth:       1,
  },
  maxText: {
    fontSize:   FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
  },
  infoBtn: {
    padding: 2,
  },
  hintText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  rubricBox: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  rubricTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    marginBottom: 2,
  },
  rubricRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },
  rubricItem: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
  inputWrapper: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  COLORS.background,
    borderRadius:     RADIUS.md,
    borderWidth:      1.5,
    borderColor:      COLORS.borderStrong,
    paddingHorizontal: SPACING.md,
    ...SHADOWS.sm,
  },
  inputWrapperFocused: {
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
  percentBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    marginLeft: SPACING.xs,
  },
  percentText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
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
