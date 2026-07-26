import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {
    COLORS,
    FONT_SIZE,
    FONT_WEIGHT,
    RADIUS,
    SHADOWS,
    SPACING,
} from "../../../constants/theme";
import { OCRScoreMapper } from "../../../src/components/scoring/OCRScoreMapper";
import { ScoreTotals } from "../../../src/components/scoring/ScoreTotals";
import { ScoringForm } from "../../../src/components/scoring/ScoringForm";
import { PrintableScoreSheetView } from "../../../src/components/scoring/PrintableScoreSheetView";
import { LiveScoreTracker } from "../../../src/components/scoring/LiveScoreTracker";
import { Badge } from "../../../src/components/ui/Badge";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { useNetwork } from "../../../src/hooks/use-network";
import { scoreService } from "../../../src/services/score.service";
import api from "../../../src/services/api";
import { useAuthStore } from "../../../src/store/auth.store";
import { useEventStore } from "../../../src/store/event.store";
import { useOfflineStore } from "../../../src/store/offline.store";
import {
    computeTotalScore,
    scoreMapToEntries,
    validateScores,
} from "../../../src/utils/score-calculator";
import { getSportConfigFromEvent } from "../../../src/utils/sport-config";

// ─────────────────────────────────────────────────────────────────────────────
// Scoring Screen — Sport-Aware Judge Scoring Application
// ─────────────────────────────────────────────────────────────────────────────

type ScoringMode = "manual" | "ocr";

export default function ScoringScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const { isConnected } = useNetwork();

  // Stores
  const event     = useEventStore((s) => s.event);
  const criteria  = useEventStore((s) => s.criteria);
  const user      = useAuthStore((s) => s.user);
  const enqueue   = useOfflineStore((s) => s.enqueue);

  // Local state
  const [departmentScores, setDepartmentScores] = useState<
    Record<string, Record<string, string>>
  >({});
  const [departmentErrors, setDepartmentErrors] = useState<
    Record<string, Record<string, string>>
  >({});
  const [mode,              setMode]             = useState<ScoringMode>("manual");
  const [department,        setDepartment]       = useState<string>("");
  const [showDeptPicker,    setShowDeptPicker]   = useState(false);
  const [isSubmitting,      setIsSubmitting]     = useState(false);
  const [showOCR,           setShowOCR]          = useState(false);
  const [showPrintableForm, setShowPrintableForm] = useState(false);
  const [ocrImageUri,       setOcrImageUri]      = useState<string | null>(null);
  const [isCompleting,      setIsCompleting]     = useState(false);

  // Sport config
  const sportConfig = getSportConfigFromEvent(event?.category, event?.name);

  const currentScores = department ? (departmentScores[department] ?? {}) : {};
  const currentErrors = department ? (departmentErrors[department] ?? {}) : {};

  // Auto-select first department
  useEffect(() => {
    if (!event?.departments?.length) return;
    setDepartment((current) => {
      if (current && event.departments.includes(current)) return current;
      return event.departments[0];
    });
  }, [event?.id, event?.departments]);

  // ── Score change handler ───────────────────────────────────────────────────
  const handleScoreChange = useCallback(
    (criteriaId: string, value: string) => {
      if (!department) return;
      setDepartmentScores((prev) => ({
        ...prev,
        [department]: {
          ...(prev[department] ?? {}),
          [criteriaId]: value,
        },
      }));
      setDepartmentErrors((prev) => {
        const next = { ...(prev[department] ?? {}) };
        delete next[criteriaId];
        return { ...prev, [department]: next };
      });
    },
    [department],
  );

  // ── OCR confirm callback ───────────────────────────────────────────────────
  const handleOcrConfirm = useCallback(
    (ocrScores: Record<string, string>, imageUri: string) => {
      if (!department) return;
      setDepartmentScores((prev) => ({ ...prev, [department]: ocrScores }));
      setOcrImageUri(imageUri);
      setMode("ocr");
      setShowOCR(false);
    },
    [department],
  );

  // ── Validate + Submit ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!event || !user) return;
    if (!department) {
      Alert.alert("Select Department", "Please select a department before submitting.");
      return;
    }

    const departmentScoreSet = departmentScores[department] ?? {};
    const numericScores: Record<string, number> = {};
    for (const [id, val] of Object.entries(departmentScoreSet)) {
      const n = parseFloat(val);
      if (!isNaN(n)) numericScores[id] = n;
    }

    const validationErrors = validateScores(numericScores, criteria);
    if (Object.keys(validationErrors).length > 0) {
      setDepartmentErrors((prev) => ({ ...prev, [department]: validationErrors }));
      Alert.alert("Incomplete Scores", "Please fill in all required scoring fields.");
      return;
    }

    const total = computeTotalScore(numericScores, criteria);
    const payload = {
      eventId:        event.id,
      department,
      judgeId:        user.id,
      judgeName:      user.name,
      scores:         scoreMapToEntries(numericScores),
      totalScore:     total,
      method:         mode,
      image_url:      ocrImageUri ?? null,
      submittedViaQr: true,
    };

    setIsSubmitting(true);
    try {
      if (!isConnected) throw new Error("NETWORK_ERROR");
      await scoreService.submitScore(payload);
      router.push({
        pathname: "/(app)/scoring/confirm",
        params: {
          eventName:  event.name,
          department,
          total:      total.toFixed(2),
          mode,
          isOffline:  "false",
        },
      });
    } catch (error: any) {
      await enqueue(payload);
      router.push({
        pathname: "/(app)/scoring/confirm",
        params: {
          eventName:  event.name,
          department,
          total:      total.toFixed(2),
          mode,
          isOffline:  "true",
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Complete Event Handler ─────────────────────────────────────────────────
  const handleCompleteEvent = async () => {
    if (!event) return;
    Alert.alert(
      "Complete Event",
      "Are you sure you want to mark this event as completed? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete",
          style: "destructive",
          onPress: async () => {
            if (!isConnected) {
              Alert.alert("No Connection", "You need an internet connection to complete an event.");
              return;
            }
            setIsCompleting(true);
            try {
              await api.put(`/events/${event.id}`, { status: "completed" });
              Alert.alert("Event Completed", "The event has been marked as completed successfully.");
              router.back();
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to complete event. Please try again.");
            } finally {
              setIsCompleting(false);
            }
          },
        },
      ],
    );
  };

  // ── Missing event guard ────────────────────────────────────────────────────
  if (!event || !criteria.length) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIconWrap}>
          <Ionicons name="qr-code-outline" size={64} color={COLORS.primary} />
        </View>
        <Text style={styles.loadingTitle}>No Event Loaded</Text>
        <Text style={styles.loadingSubtitle}>
          Scan a QR code to load an event before scoring.
        </Text>
        <Button
          label="Go to Scanner"
          onPress={() => router.replace("/(app)/scanner")}
          variant="primary"
          size="lg"
        />
      </View>
    );
  }

  // Derived state
  const numericScores: Record<string, number> = {};
  for (const [id, val] of Object.entries(currentScores)) {
    const n = parseFloat(val);
    if (!isNaN(n)) numericScores[id] = n;
  }

  const isComplete = criteria.every(
    (c) =>
      currentScores[c.criteria_id] !== undefined &&
      currentScores[c.criteria_id] !== "" &&
      !isNaN(parseFloat(currentScores[c.criteria_id])),
  );

  const totalScore   = computeTotalScore(numericScores, criteria);
  const maxTotal     = criteria.reduce((s, c) => s + c.max_score, 0);
  const pctFilled    = criteria.length > 0
    ? Object.keys(currentScores).filter((k) => currentScores[k] !== "").length / criteria.length
    : 0;

  const accentColor  = sportConfig.color;

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* ── Top Sport Header Bar ─────────────────────────────────────── */}
        <View style={[styles.topBar, { backgroundColor: accentColor }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.topBarCenter}>
            <Text style={styles.topBarEmoji}>{sportConfig.emoji}</Text>
            <View>
              <Text style={styles.topBarTitle} numberOfLines={1}>{event.name}</Text>
              <Text style={styles.topBarSub}>{sportConfig.label} · {event.category}</Text>
            </View>
          </View>
          <View style={styles.topBarRight}>
            {!isConnected && (
              <View style={styles.offlineDot}>
                <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
              </View>
            )}
            <Badge
              label={event.status}
              variant={
                event.status === "ongoing"   ? "success"  :
                event.status === "completed" ? "default"  : "warning"
              }
            />
          </View>
        </View>

        {/* ── Progress Bar ─────────────────────────────────────────────── */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressBar, {
            width: `${Math.round(pctFilled * 100)}%`,
            backgroundColor: isComplete ? COLORS.success : accentColor,
          }]} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Department + Mode Row ──────────────────────────────────── */}
          <View style={styles.controlRow}>
            {/* Department Selector */}
            <TouchableOpacity
              style={[styles.deptSelector, { borderColor: `${accentColor}50` }]}
              onPress={() => setShowDeptPicker(true)}
              accessibilityLabel="Select department"
            >
              <Ionicons name="school-outline" size={16} color={accentColor} />
              <Text style={[styles.deptSelectorText, !department && styles.deptPlaceholder]} numberOfLines={1}>
                {department || "Select Team"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={accentColor} />
            </TouchableOpacity>
          </View>

          {/* ── Mode Switcher ─────────────────────────────────────────── */}
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === "manual" && [styles.modeBtnActive, { borderColor: accentColor, backgroundColor: `${accentColor}12` }]]}
              onPress={() => { setMode("manual"); setShowOCR(false); }}
              accessibilityLabel="Manual scoring mode"
            >
              <Ionicons name="create-outline" size={16} color={mode === "manual" ? accentColor : COLORS.textSecondary} />
              <Text style={[styles.modeBtnText, mode === "manual" && { color: accentColor, fontWeight: FONT_WEIGHT.bold }]}>
                Manual
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === "ocr" && styles.modeBtnActiveOcr]}
              onPress={() => setShowOCR(true)}
              accessibilityLabel="OCR scoring mode"
            >
              <Ionicons name="scan-outline" size={16} color={mode === "ocr" ? COLORS.ocr : COLORS.textSecondary} />
              <Text style={[styles.modeBtnText, mode === "ocr" && styles.modeBtnTextOcr]}>
                Scan OCR
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modeBtn}
              onPress={() => setShowPrintableForm(true)}
              accessibilityLabel="View official score sheet form"
            >
              <Ionicons name="document-text-outline" size={16} color={accentColor} />
              <Text style={[styles.modeBtnText, { color: accentColor }]}>Form</Text>
            </TouchableOpacity>
          </View>

          {/* ── Live Score Tracker (Digital Score Sheet) ─────────────────── */}
          {mode === "manual" && (
            <LiveScoreTracker event={event} />
          )}

          {/* ── Live Score Summary Strip ────────────────────────────────── */}
          {Object.keys(currentScores).length > 0 && (
            <View style={[styles.liveStrip, { borderColor: `${accentColor}30`, backgroundColor: `${accentColor}08` }]}>
              <View style={styles.liveStripLeft}>
                <View style={[styles.liveDot, { backgroundColor: isComplete ? COLORS.success : accentColor }]} />
                <Text style={[styles.liveLabel, { color: accentColor }]}>
                  {isComplete ? "All Criteria Scored" : `${Object.keys(currentScores).filter(k => currentScores[k] !== "").length} / ${criteria.length} criteria filled`}
                </Text>
              </View>
              <Text style={[styles.liveScore, { color: accentColor }]}>
                {totalScore.toFixed(1)} <Text style={styles.liveMax}>/ {maxTotal}</Text>
              </Text>
            </View>
          )}

          {/* ── Sport-Aware Scoring Form ────────────────────────────────── */}
          <ScoringForm
            criteria={criteria}
            scores={currentScores}
            errors={currentErrors}
            onScoreChange={handleScoreChange}
            disabled={isSubmitting}
            event={event}
            department={department}
          />

          {/* ── Full Score Breakdown ─────────────────────────────────────── */}
          {Object.keys(currentScores).length > 0 && (
            <ScoreTotals
              criteria={criteria}
              scores={currentScores}
              isComplete={isComplete}
            />
          )}

          {/* ── Submit Button ────────────────────────────────────────────── */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              { backgroundColor: isComplete ? accentColor : `${accentColor}70` },
            ]}
            onPress={handleSubmit}
            disabled={!department || isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <Text style={styles.submitBtnText}>Submitting…</Text>
            ) : !isConnected ? (
              <>
                <Ionicons name="cloud-offline-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.submitBtnText}>Save Offline</Text>
              </>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.submitBtnText}>Submit Score</Text>
              </>
            )}
          </TouchableOpacity>

          {/* ── Complete Event Button ─────────────────────────────────────── */}
          {event.status === "ongoing" && (
            <Button
              label={isCompleting ? "Completing…" : "Mark Event Complete"}
              onPress={handleCompleteEvent}
              variant="secondary"
              size="lg"
              loading={isCompleting}
              disabled={!isConnected}
              fullWidth
              icon={<Ionicons name="flag-outline" size={18} color={COLORS.primary} />}
            />
          )}

          <View style={{ height: SPACING.xxl * 2 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Department Picker Modal ────────────────────────────────────── */}
      <Modal
        visible={showDeptPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDeptPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowDeptPicker(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={[styles.modalTitleRow, { borderBottomColor: `${accentColor}30` }]}>
              <Text style={styles.sportEmoji}>{sportConfig.emoji}</Text>
              <Text style={styles.modalTitle}>Select Team / Department</Text>
            </View>
            {(event.departments ?? []).map((dept) => (
              <TouchableOpacity
                key={dept}
                style={[
                  styles.deptOption,
                  department === dept && [styles.deptOptionSelected, { borderColor: accentColor, backgroundColor: `${accentColor}10` }],
                ]}
                onPress={() => { setDepartment(dept); setShowDeptPicker(false); }}
                accessibilityLabel={`Select ${dept}`}
              >
                <View style={styles.deptOptionLeft}>
                  <Ionicons
                    name={department === dept ? "checkmark-circle" : "ellipse-outline"}
                    size={20}
                    color={department === dept ? accentColor : COLORS.textMuted}
                  />
                  <Text style={[styles.deptOptionText, department === dept && { color: accentColor, fontWeight: FONT_WEIGHT.bold }]}>
                    {dept}
                  </Text>
                </View>
                {departmentScores[dept] && Object.keys(departmentScores[dept]).length > 0 && (
                  <View style={[styles.scoredBadge, { backgroundColor: `${accentColor}18` }]}>
                    <Text style={[styles.scoredBadgeText, { color: accentColor }]}>Scored</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── OCR Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={showOCR}
        animationType="slide"
        onRequestClose={() => setShowOCR(false)}
      >
        <OCRScoreMapper
          criteria={criteria}
          onConfirm={handleOcrConfirm}
          onCancel={() => setShowOCR(false)}
        />
      </Modal>

      {/* ── Physical Form Modal ───────────────────────────────────────── */}
      <Modal
        visible={showPrintableForm}
        animationType="slide"
        onRequestClose={() => setShowPrintableForm(false)}
      >
        <PrintableScoreSheetView
          event={event}
          criteria={criteria}
          onClose={() => setShowPrintableForm(false)}
        />
      </Modal>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Loading state
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  loadingIconWrap: {
    width: 100,
    height: 100,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryPale,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  loadingSubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: "center",
  },

  // Top sport bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingTop: Platform.OS === "ios" ? 52 : SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
    ...SHADOWS.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: "rgba(255,255,255,0.20)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  topBarCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },
  topBarEmoji: {
    fontSize: 24,
    flexShrink: 0,
  },
  topBarTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: "#fff",
    maxWidth: 200,
  },
  topBarSub: {
    fontSize: FONT_SIZE.xs,
    color: "rgba(255,255,255,0.75)",
    marginTop: 1,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    flexShrink: 0,
  },
  offlineDot: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    backgroundColor: "rgba(255,255,255,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Progress
  progressTrack: {
    height: 3,
    backgroundColor: COLORS.surfaceMuted,
  },
  progressBar: {
    height: 3,
  },

  // Scroll
  scrollContent: {
    padding: SPACING.md,
    gap: SPACING.md,
  },

  // Control row
  controlRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  deptSelector: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    ...SHADOWS.sm,
  },
  deptSelectorText: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  deptPlaceholder: {
    color: COLORS.textMuted,
    fontWeight: FONT_WEIGHT.regular,
  },

  // Mode switcher
  modeRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingVertical: SPACING.sm + 2,
    ...SHADOWS.sm,
  },
  modeBtnActive: {
    borderWidth: 2,
  },
  modeBtnActiveOcr: {
    borderColor: COLORS.ocr,
    backgroundColor: "rgba(124,58,237,0.06)",
  },
  modeBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textSecondary,
  },
  modeBtnTextOcr: {
    color: COLORS.ocr,
    fontWeight: FONT_WEIGHT.bold,
  },

  // Live strip
  liveStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  liveStripLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    flex: 1,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.full,
  },
  liveLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
  },
  liveScore: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.extrabold,
  },
  liveMax: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.regular,
    color: COLORS.textMuted,
  },

  // Submit button
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    ...SHADOWS.lg,
  },
  submitBtnText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: "#fff",
    letterSpacing: 0.3,
  },

  // Modal backdrop
  modalBackdrop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
    gap: SPACING.sm,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.lg,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    alignSelf: "center",
    marginBottom: SPACING.sm,
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderBottomWidth: 1,
    paddingBottom: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  sportEmoji: {
    fontSize: 22,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  deptOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  deptOptionSelected: {},
  deptOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },
  deptOptionText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.medium,
    flex: 1,
  },
  scoredBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  scoredBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
  },
});
