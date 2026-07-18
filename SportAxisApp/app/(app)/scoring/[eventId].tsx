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
import { Badge } from "../../../src/components/ui/Badge";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { useNetwork } from "../../../src/hooks/use-network";
import { scoreService } from "../../../src/services/score.service";
import { useAuthStore } from "../../../src/store/auth.store";
import { useEventStore } from "../../../src/store/event.store";
import { useOfflineStore } from "../../../src/store/offline.store";
import {
    computeTotalScore,
    scoreMapToEntries,
    validateScores,
} from "../../../src/utils/score-calculator";

// ─────────────────────────────────────────────────────────────────────────────
// Scoring Screen — Dynamic form for a scanned event
// ─────────────────────────────────────────────────────────────────────────────

type ScoringMode = "manual" | "ocr";

export default function ScoringScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const { isConnected } = useNetwork();

  // Stores
  const event = useEventStore((s) => s.event);
  const criteria = useEventStore((s) => s.criteria);
  const user = useAuthStore((s) => s.user);
  const enqueue = useOfflineStore((s) => s.enqueue);

  // Local state
  const [departmentScores, setDepartmentScores] = useState<
    Record<string, Record<string, string>>
  >({});
  const [departmentErrors, setDepartmentErrors] = useState<
    Record<string, Record<string, string>>
  >({});
  const [mode, setMode] = useState<ScoringMode>("manual");
  const [department, setDepartment] = useState<string>("");
  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOCR, setShowOCR] = useState(false);
  const [ocrImageUri, setOcrImageUri] = useState<string | null>(null);

  const currentScores = department ? (departmentScores[department] ?? {}) : {};
  const currentErrors = department ? (departmentErrors[department] ?? {}) : {};

  // Pick first department by default or keep valid if the event changes
  useEffect(() => {
    if (!event?.departments?.length) return;

    setDepartment((current) => {
      if (current && event.departments.includes(current)) {
        return current;
      }
      return event.departments[0];
    });
  }, [event?.id, event?.departments]);

  // ── Score change handler ─────────────────────────────────────────────────
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
        return {
          ...prev,
          [department]: next,
        };
      });
    },
    [department],
  );

  // ── OCR confirm callback ─────────────────────────────────────────────────
  const handleOcrConfirm = useCallback(
    (ocrScores: Record<string, string>, imageUri: string) => {
      if (!department) return;
      setDepartmentScores((prev) => ({
        ...prev,
        [department]: ocrScores,
      }));
      setOcrImageUri(imageUri);
      setMode("ocr");
      setShowOCR(false);
    },
    [department],
  );

  // ── Validate + Submit ────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!event || !user) return;
    if (!department) {
      Alert.alert(
        "Select Department",
        "Please select a department before submitting.",
      );
      return;
    }

    const departmentScoreSet = departmentScores[department] ?? {};

    // Convert string scores to numbers for validation
    const numericScores: Record<string, number> = {};
    for (const [id, val] of Object.entries(departmentScoreSet)) {
      const n = parseFloat(val);
      if (!isNaN(n)) numericScores[id] = n;
    }

    const validationErrors = validateScores(numericScores, criteria);
    if (Object.keys(validationErrors).length > 0) {
      setDepartmentErrors((prev) => ({
        ...prev,
        [department]: validationErrors,
      }));
      Alert.alert(
        "Incomplete Scores",
        "Please fill in all required scoring fields.",
      );
      return;
    }

    const total = computeTotalScore(numericScores, criteria);

    const payload = {
      eventId: event.id,
      department,
      judgeId: user.id,
      judgeName: user.name,
      scores: scoreMapToEntries(numericScores),
      totalScore: total,
      method: mode,
      image_url: ocrImageUri ?? null,
      submittedViaQr: true,
    };

    setIsSubmitting(true);

    try {
      if (!isConnected) {
        throw new Error("NETWORK_ERROR");
      }
      await scoreService.submitScore(payload);
      router.push({
        pathname: "/(app)/scoring/confirm",
        params: {
          eventName: event.name,
          department,
          total: total.toFixed(2),
          mode,
          isOffline: "false",
        },
      });
    } catch (error: any) {
      // Offline or network failure → queue for later
      await enqueue(payload);
      router.push({
        pathname: "/(app)/scoring/confirm",
        params: {
          eventName: event.name,
          department,
          total: total.toFixed(2),
          mode,
          isOffline: "true",
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Missing event guard ───────────────────────────────────────────────────
  if (!event || !criteria.length) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="qr-code-outline" size={64} color={COLORS.primary} />
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

  // Compute numeric scores for totals panel
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

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Event Banner ─────────────────────────────────────────────── */}
          <Card variant="elevated" style={styles.eventBanner}>
            <Text style={styles.eventName} numberOfLines={2}>
              {event.name}
            </Text>
            <View style={styles.eventMeta}>
              <Badge label={event.category} variant="info" />
              <Badge
                label={event.status}
                variant={
                  event.status === "ongoing"
                    ? "success"
                    : event.status === "completed"
                      ? "default"
                      : "warning"
                }
              />
              {!isConnected && <Badge label="OFFLINE" variant="offline" />}
            </View>
            <View style={styles.eventDetails}>
              <Ionicons
                name="location-outline"
                size={14}
                color={COLORS.textSecondary}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.eventDetailsText}>
                {event.venueName ?? "No venue"}
              </Text>
              <Ionicons
                name="calendar-outline"
                size={14}
                color={COLORS.textSecondary}
                style={{ marginRight: 4, marginLeft: 8 }}
              />
              <Text style={styles.eventDetailsText}>{event.schedule}</Text>
            </View>
          </Card>

          {/* ── Department Selector ───────────────────────────────────────── */}
          <View>
            <Text style={styles.sectionLabel}>SCORING FOR DEPARTMENT</Text>
            <TouchableOpacity
              style={styles.deptSelector}
              onPress={() => setShowDeptPicker(true)}
              accessibilityLabel="Select department"
              accessibilityRole="button"
            >
              <Text style={styles.deptSelectorText}>
                {department || "Tap to select department"}
              </Text>
              <Text style={styles.deptChevron}>›</Text>
            </TouchableOpacity>
            <Text style={styles.selectorHelp}>
              Scores are stored separately for each participating department or
              college. Switch the selector to score another team.
            </Text>
          </View>

          {/* ── Mode Switcher ─────────────────────────────────────────────── */}
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[
                styles.modeBtn,
                mode === "manual" && styles.modeBtnActive,
              ]}
              onPress={() => {
                setMode("manual");
                setShowOCR(false);
              }}
              accessibilityLabel="Manual scoring mode"
            >
              <Ionicons
                name="pencil"
                size={18}
                color={
                  mode === "manual" ? COLORS.primary : COLORS.textSecondary
                }
              />
              <Text
                style={[
                  styles.modeBtnText,
                  mode === "manual" && styles.modeBtnTextActive,
                ]}
              >
                Manual
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeBtn,
                mode === "ocr" && styles.modeBtnActiveOcr,
              ]}
              onPress={() => setShowOCR(true)}
              accessibilityLabel="OCR scoring mode"
            >
              <Ionicons
                name="camera"
                size={18}
                color={mode === "ocr" ? COLORS.ocr : COLORS.textSecondary}
              />
              <Text
                style={[
                  styles.modeBtnText,
                  mode === "ocr" && styles.modeBtnTextOcr,
                ]}
              >
                OCR Capture
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Dynamic Scoring Form ──────────────────────────────────────── */}
          <ScoringForm
            criteria={criteria}
            scores={currentScores}
            errors={currentErrors}
            onScoreChange={handleScoreChange}
            disabled={isSubmitting}
          />

          {/* ── Live Total ────────────────────────────────────────────────── */}
          {Object.keys(currentScores).length > 0 && (
            <ScoreTotals
              criteria={criteria}
              scores={currentScores}
              isComplete={isComplete}
            />
          )}

          {/* ── Submit Button ─────────────────────────────────────────────── */}
          <Button
            label={
              isSubmitting
                ? "Submitting…"
                : !isConnected
                  ? "Save Offline"
                  : "Submit Score"
            }
            onPress={handleSubmit}
            variant="primary"
            size="lg"
            loading={isSubmitting}
            disabled={!department}
            fullWidth
            style={styles.submitBtn}
            icon={
              !isConnected ? (
                <Ionicons
                  name="cloud-offline-outline"
                  size={18}
                  color={COLORS.textInverse}
                />
              ) : undefined
            }
          />

          <View style={{ height: SPACING.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Department Picker Modal ───────────────────────────────────────── */}
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
            <Text style={styles.modalTitle}>Select Department</Text>
            {(event.departments ?? []).map((dept) => (
              <TouchableOpacity
                key={dept}
                style={[
                  styles.deptOption,
                  department === dept && styles.deptOptionSelected,
                ]}
                onPress={() => {
                  setDepartment(dept);
                  setShowDeptPicker(false);
                }}
                accessibilityLabel={`Select ${dept}`}
              >
                <Text
                  style={[
                    styles.deptOptionText,
                    department === dept && styles.deptOptionTextSelected,
                  ]}
                >
                  {dept}
                </Text>
                {department === dept && (
                  <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── OCR Modal ────────────────────────────────────────────────────── */}
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.md,
    gap: SPACING.md,
  },

  // Loading / empty state
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
    gap: SPACING.lg,
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

  // Event banner
  eventBanner: {
    gap: SPACING.sm,
  },
  eventName: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  eventMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  eventDetails: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  eventDetailsText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },

  // Department selector
  sectionLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textMuted,
    letterSpacing: 1.2,
    marginBottom: SPACING.xs,
  },
  deptSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    ...SHADOWS.sm,
  },
  deptSelectorText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.medium,
  },
  deptChevron: {
    fontSize: FONT_SIZE.xl,
    color: COLORS.textMuted,
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
    gap: SPACING.xs,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingVertical: SPACING.sm + 2,
  },
  modeBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySubtle,
  },
  modeBtnActiveOcr: {
    borderColor: COLORS.ocr,
    backgroundColor: "rgba(139,92,246,0.08)",
  },
  modeBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
  },
  modeBtnTextActive: { color: COLORS.primary },
  modeBtnTextOcr: { color: COLORS.ocr },

  // Submit
  submitBtn: {
    marginTop: SPACING.sm,
  },

  // Dept modal
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
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    alignSelf: "center",
    marginBottom: SPACING.sm,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  deptOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  deptOptionSelected: {
    backgroundColor: COLORS.primarySubtle,
    borderColor: COLORS.primary,
  },
  deptOptionText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.medium,
  },
  deptOptionTextSelected: { color: COLORS.primary },
});
