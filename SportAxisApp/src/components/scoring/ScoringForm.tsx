import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useRef, useState } from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { COLORS, FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOWS, SPACING } from '../../../constants/theme';
import type { Criterion, EventSession } from '../../types';
import {
    getCriterionHint,
    getSportConfigFromEvent,
    type SportConfig,
    type CriterionHint,
} from '../../utils/sport-config';

// ─────────────────────────────────────────────────────────────────────────────
// ScoringForm — Score sheet table layout matching the printed official form
// ─────────────────────────────────────────────────────────────────────────────

interface ScoringFormProps {
  criteria:      Criterion[];
  scores:        Record<string, string>;
  errors:        Record<string, string>;
  onScoreChange: (criteriaId: string, value: string) => void;
  disabled?:     boolean;
  event?:        EventSession | null;
  department?:   string;
}

export function ScoringForm({
  criteria,
  scores,
  errors,
  onScoreChange,
  disabled = false,
  event,
  department,
}: ScoringFormProps) {

  const sportConfig = getSportConfigFromEvent(event?.category, event?.name);
  const accentColor = sportConfig.color;

  const handleChange = useCallback(
    (criteriaId: string, value: string) => {
      onScoreChange(criteriaId, value);
    },
    [onScoreChange],
  );

  if (criteria.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="clipboard-outline" size={44} color={COLORS.textMuted} />
        <Text style={styles.emptyTitle}>No Criteria Defined</Text>
        <Text style={styles.emptySubText}>
          The event administrator needs to add scoring criteria for this event.
        </Text>
      </View>
    );
  }

  const maxTotal  = criteria.reduce((s, c) => s + c.max_score, 0);
  const filledCount = criteria.filter(c => scores[c.criteria_id] !== undefined && scores[c.criteria_id] !== '').length;

  return (
    <View style={styles.container}>

      {/* ── Sport Header Banner ──────────────────────────────────────────── */}
      <View style={[styles.sportBanner, { backgroundColor: accentColor }]}>
        <View style={styles.sportBannerLeft}>
          <Text style={styles.sportEmoji}>{sportConfig.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.sportName}>{sportConfig.label.toUpperCase()} — JUDGE'S SCORE SHEET</Text>
            {department ? (
              <Text style={styles.sportDept}>Evaluating: {department}</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.maxTotalBadge}>
          <Text style={styles.maxTotalLabel}>TOTAL MAX</Text>
          <Text style={styles.maxTotalValue}>{maxTotal}</Text>
        </View>
      </View>

      {/* ── Scoring Guide ────────────────────────────────────────────────── */}
      <View style={[styles.guideBox, { borderColor: `${accentColor}40`, backgroundColor: `${accentColor}08` }]}>
        <Ionicons name="information-circle" size={15} color={accentColor} style={{ flexShrink: 0, marginTop: 1 }} />
        <Text style={[styles.guideText, { color: accentColor }]}>{sportConfig.scoringGuide}</Text>
      </View>

      {/* ── Score Sheet Table ─────────────────────────────────────────────── */}
      <View style={[styles.tableCard, { borderColor: `${accentColor}30` }]}>

        {/* Table Header — matches the printed form columns */}
        <View style={[styles.tableHeader, { backgroundColor: accentColor }]}>
          <Text style={[styles.thCriterion]}>CRITERION</Text>
          <Text style={[styles.thMax]}>MAX</Text>
          <Text style={[styles.thScore]}>SCORE</Text>
          <Text style={[styles.thPct]}>%</Text>
        </View>

        {/* Table Rows */}
        {criteria.map((criterion, index) => {
          const hint = getCriterionHint(criterion.name, sportConfig);
          return (
            <ScoreRow
              key={criterion.criteria_id}
              criterion={criterion}
              value={scores[criterion.criteria_id] ?? ''}
              onChange={handleChange}
              error={errors[criterion.criteria_id]}
              disabled={disabled}
              hint={hint}
              accentColor={accentColor}
              isLast={index === criteria.length - 1}
              isEven={index % 2 === 1}
            />
          );
        })}

        {/* Total Row — matches the TOTAL row on the printed form */}
        <TotalRow
          criteria={criteria}
          scores={scores}
          maxTotal={maxTotal}
          accentColor={accentColor}
        />
      </View>

      {/* ── Progress footer ───────────────────────────────────────────────── */}
      <View style={styles.progressFooter}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, {
            width: `${criteria.length > 0 ? (filledCount / criteria.length) * 100 : 0}%`,
            backgroundColor: filledCount === criteria.length ? COLORS.success : accentColor,
          }]} />
        </View>
        <Text style={[styles.progressLabel, { color: filledCount === criteria.length ? COLORS.success : COLORS.textSecondary }]}>
          {filledCount === criteria.length
            ? '✓ All criteria scored'
            : `${filledCount} of ${criteria.length} criteria filled`}
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ScoreRow — a single criterion row in the score table
// ─────────────────────────────────────────────────────────────────────────────

interface ScoreRowProps {
  criterion:   Criterion;
  value:       string;
  onChange:    (criteriaId: string, value: string) => void;
  error?:      string;
  disabled?:   boolean;
  hint?:       CriterionHint | null;
  accentColor: string;
  isLast:      boolean;
  isEven:      boolean;
}

function ScoreRow({
  criterion, value, onChange, error, disabled, hint, accentColor, isLast, isEven,
}: ScoreRowProps) {
  const [isFocused,   setIsFocused]   = useState(false);
  const [showHint,    setShowHint]    = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const numericVal = parseFloat(value) || 0;
  const pct        = criterion.max_score > 0 ? (numericVal / criterion.max_score) * 100 : 0;

  const pctColor =
    pct >= 90 ? COLORS.success :
    pct >= 60 ? '#16a34a'      :
    pct >= 30 ? accentColor    :
    COLORS.textMuted;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 6,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 55, useNativeDriver: true }),
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

  const hasHint = !!(hint?.rubric?.length);

  return (
    <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
      {/* Main row */}
      <View style={[
        styles.tableRow,
        isEven && styles.tableRowEven,
        isFocused && [styles.tableRowFocused, { borderLeftColor: accentColor }],
        !!error && styles.tableRowError,
        isLast && !showHint && styles.tableRowLast,
      ]}>

        {/* ── CRITERION column ─────────────────────────────────── */}
        <View style={styles.tdCriterion}>
          <View style={styles.criterionNameRow}>
            {hint?.icon && (
              <Ionicons name={hint.icon as any} size={13} color={isFocused ? accentColor : COLORS.textMuted} style={{ flexShrink: 0 }} />
            )}
            <Text style={[styles.criterionName, isFocused && { color: accentColor }]} numberOfLines={2}>
              {criterion.name}
            </Text>
          </View>
          {criterion.weight != null && (
            <Text style={styles.weightTag}>Weight: {criterion.weight}%</Text>
          )}
        </View>

        {/* ── MAX column ───────────────────────────────────────── */}
        <View style={styles.tdMax}>
          <Text style={[styles.maxValue, { color: accentColor }]}>{criterion.max_score}</Text>
        </View>

        {/* ── SCORE INPUT column ───────────────────────────────── */}
        <View style={styles.tdScore}>
          <TextInput
            style={[
              styles.scoreInput,
              isFocused && [styles.scoreInputFocused, { borderColor: accentColor, color: accentColor }],
              !!error && styles.scoreInputError,
              disabled && styles.scoreInputDisabled,
            ]}
            value={value}
            onChangeText={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor={COLORS.textMuted}
            editable={!disabled}
            maxLength={6}
            accessibilityLabel={`Score for ${criterion.name}`}
          />
        </View>

        {/* ── % column ─────────────────────────────────────────── */}
        <View style={styles.tdPct}>
          {value !== '' && !error ? (
            <View style={styles.pctWrap}>
              {/* Mini arc/circle indicator */}
              <Text style={[styles.pctValue, { color: pctColor }]}>
                {Math.round(pct)}%
              </Text>
            </View>
          ) : error ? (
            <Ionicons name="alert-circle" size={18} color={COLORS.destructive} />
          ) : (
            <Text style={styles.pctEmpty}>—</Text>
          )}
          {hasHint && (
            <TouchableOpacity onPress={() => setShowHint(!showHint)} style={styles.hintToggle}>
              <Ionicons
                name={showHint ? 'chevron-up-circle' : 'chevron-down-circle-outline'}
                size={16}
                color={isFocused ? accentColor : COLORS.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Progress bar under the row */}
      {value !== '' && !error && (
        <View style={[styles.rowProgress, isLast && !showHint && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
          <View style={[styles.rowProgressFill, {
            width: `${Math.min(pct, 100)}%`,
            backgroundColor: pctColor,
          }]} />
        </View>
      )}

      {/* Expandable hint/rubric panel */}
      {showHint && hasHint && (
        <View style={[styles.hintPanel, { borderColor: `${accentColor}25`, backgroundColor: `${accentColor}06` }, isLast && styles.hintPanelLast]}>
          <Text style={[styles.hintGuide, { color: accentColor }]}>📋 Scoring Guide for "{criterion.name}"</Text>
          {hint!.hint && <Text style={styles.hintDesc}>{hint!.hint}</Text>}
          <View style={styles.rubricGrid}>
            {hint!.rubric!.map((item, i) => (
              <View key={i} style={styles.rubricItem}>
                <Ionicons name="checkmark-circle" size={11} color={accentColor} />
                <Text style={styles.rubricText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Error msg */}
      {!!error && (
        <View style={[styles.errorRow, isLast && styles.errorRowLast]}>
          <Ionicons name="alert-circle" size={13} color={COLORS.destructive} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TotalRow — weighted total at the bottom of the table
// ─────────────────────────────────────────────────────────────────────────────

function TotalRow({
  criteria, scores, maxTotal, accentColor,
}: {
  criteria: Criterion[];
  scores: Record<string, string>;
  maxTotal: number;
  accentColor: string;
}) {
  // Compute weighted total: sum of (score / max_score * weight) for each criterion
  let weightedTotal = 0;
  let rawTotal = 0;
  let allFilled = true;

  for (const c of criteria) {
    const val = parseFloat(scores[c.criteria_id] ?? '');
    if (isNaN(val) || scores[c.criteria_id] === '') {
      allFilled = false;
    } else {
      rawTotal += val;
      if (c.weight != null) {
        weightedTotal += (val / c.max_score) * c.weight;
      }
    }
  }

  const hasCriteriaWeights = criteria.some(c => c.weight != null);

  return (
    <View style={[styles.totalRow, { backgroundColor: accentColor }]}>
      <View style={styles.tdCriterion}>
        <Text style={styles.totalLabel}>TOTAL SCORE</Text>
        {hasCriteriaWeights && allFilled && (
          <Text style={styles.totalSub}>Weighted</Text>
        )}
      </View>
      <View style={styles.tdMax}>
        <Text style={styles.totalMax}>{maxTotal}</Text>
      </View>
      <View style={styles.tdScore}>
        <Text style={[styles.totalScore, !allFilled && styles.totalScoreIncomplete]}>
          {allFilled
            ? hasCriteriaWeights
              ? weightedTotal.toFixed(1)
              : rawTotal.toFixed(1)
            : '—'}
        </Text>
      </View>
      <View style={styles.tdPct}>
        <Text style={styles.totalPct}>
          {allFilled && maxTotal > 0
            ? `${Math.round((rawTotal / maxTotal) * 100)}%`
            : '—'}
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

// Column widths (must add up correctly)
const COL_CRITERION = '46%';
const COL_MAX       = '13%';
const COL_SCORE     = '25%';
const COL_PCT       = '16%';

const styles = StyleSheet.create({
  container: {
    gap: SPACING.sm,
  },

  // ── Sport Banner ─────────────────────────────────────────────────────────
  sportBanner: {
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOWS.md,
  },
  sportBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  sportEmoji: {
    fontSize: 26,
    flexShrink: 0,
  },
  sportName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.extrabold,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  sportDept: {
    fontSize: FONT_SIZE.xs,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 2,
  },
  maxTotalBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    flexShrink: 0,
  },
  maxTotalLabel: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.80)',
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  maxTotalValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.extrabold,
    color: '#fff',
    lineHeight: 24,
  },

  // ── Guide box ────────────────────────────────────────────────────────────
  guideBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs + 1,
  },
  guideText: {
    fontSize: FONT_SIZE.xs,
    lineHeight: 17,
    flex: 1,
    fontStyle: 'italic',
  },

  // ── Table card ───────────────────────────────────────────────────────────
  tableCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
    ...SHADOWS.card,
    backgroundColor: COLORS.surface,
  },

  // ── Table Header ─────────────────────────────────────────────────────────
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  thCriterion: {
    width: COL_CRITERION,
    fontSize: 9,
    fontWeight: FONT_WEIGHT.extrabold,
    color: '#fff',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  thMax: {
    width: COL_MAX,
    fontSize: 9,
    fontWeight: FONT_WEIGHT.extrabold,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  thScore: {
    width: COL_SCORE,
    fontSize: 9,
    fontWeight: FONT_WEIGHT.extrabold,
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  thPct: {
    width: COL_PCT,
    fontSize: 9,
    fontWeight: FONT_WEIGHT.extrabold,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // ── Table Row ────────────────────────────────────────────────────────────
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    backgroundColor: COLORS.surface,
  },
  tableRowEven: {
    backgroundColor: COLORS.background,
  },
  tableRowFocused: {
    backgroundColor: COLORS.surface,
  },
  tableRowError: {
    borderLeftColor: COLORS.destructive,
    backgroundColor: '#fff5f5',
  },
  tableRowLast: {},

  // ── Criterion column cell ─────────────────────────────────────────────
  tdCriterion: {
    width: COL_CRITERION,
    paddingRight: SPACING.xs,
  },
  criterionNameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  criterionName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    flex: 1,
    lineHeight: 18,
  },
  weightTag: {
    fontSize: 9,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // ── Max column cell ───────────────────────────────────────────────────
  tdMax: {
    width: COL_MAX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maxValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },

  // ── Score column cell ─────────────────────────────────────────────────
  tdScore: {
    width: COL_SCORE,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  scoreInput: {
    width: '100%',
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.extrabold,
    color: COLORS.textPrimary,
    textAlign: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
    minHeight: 52,
  },
  scoreInputFocused: {
    borderWidth: 2,
    backgroundColor: COLORS.surface,
    ...SHADOWS.sm,
  },
  scoreInputError: {
    borderColor: COLORS.destructive,
    backgroundColor: '#fff5f5',
  },
  scoreInputDisabled: {
    color: COLORS.textMuted,
    backgroundColor: COLORS.surfaceMuted,
  },

  // ── Pct column cell ───────────────────────────────────────────────────
  tdPct: {
    width: COL_PCT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pctWrap: {
    alignItems: 'center',
  },
  pctValue: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
  },
  pctEmpty: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  hintToggle: {
    padding: 2,
  },

  // ── Row progress ─────────────────────────────────────────────────────
  rowProgress: {
    height: 2,
    backgroundColor: COLORS.surfaceMuted,
  },
  rowProgressFill: {
    height: 2,
  },

  // ── Hint panel ───────────────────────────────────────────────────────
  hintPanel: {
    padding: SPACING.sm,
    borderTopWidth: 1,
    gap: SPACING.xs,
  },
  hintPanelLast: {
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
  },
  hintGuide: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
  },
  hintDesc: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  rubricGrid: {
    gap: 4,
    marginTop: 2,
  },
  rubricItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },
  rubricText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 15,
  },

  // ── Error row ────────────────────────────────────────────────────────
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    backgroundColor: '#fff5f5',
    borderTopWidth: 1,
    borderTopColor: '#fecaca',
  },
  errorRowLast: {
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
  },
  errorText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.destructive,
    fontWeight: FONT_WEIGHT.medium,
    flex: 1,
  },

  // ── Total Row ────────────────────────────────────────────────────────
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255,255,255,0.25)',
  },
  totalLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.extrabold,
    color: '#fff',
    letterSpacing: 0.3,
  },
  totalSub: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.70)',
    marginTop: 1,
  },
  totalMax: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: 'rgba(255,255,255,0.80)',
    textAlign: 'center',
  },
  totalScore: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.extrabold,
    color: '#fff',
    textAlign: 'center',
  },
  totalScoreIncomplete: {
    fontSize: FONT_SIZE.lg,
    color: 'rgba(255,255,255,0.55)',
  },
  totalPct: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },

  // ── Progress footer ──────────────────────────────────────────────────
  progressFooter: {
    gap: 5,
  },
  progressTrack: {
    height: 5,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: 5,
    borderRadius: RADIUS.full,
  },
  progressLabel: {
    fontSize: FONT_SIZE.xs,
    textAlign: 'center',
    fontWeight: FONT_WEIGHT.medium,
  },

  // ── Empty state ──────────────────────────────────────────────────────
  empty: {
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textSecondary,
  },
  emptySubText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
