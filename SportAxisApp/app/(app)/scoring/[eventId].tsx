import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
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
import { LivePublishPanel } from "../../../src/components/scoring/LivePublishPanel";
import { LiveScoreTracker } from "../../../src/components/scoring/LiveScoreTracker";
import { OCRScoreMapper } from "../../../src/components/scoring/OCRScoreMapper";
import { PrintableScoreSheetView } from "../../../src/components/scoring/PrintableScoreSheetView";
import { Badge } from "../../../src/components/ui/Badge";
import { Button } from "../../../src/components/ui/Button";
import { useDeptAbbreviator } from "../../../src/hooks/use-dept-abbr";
import { useNetwork } from "../../../src/hooks/use-network";
import api from "../../../src/services/api";
import { scoreService } from "../../../src/services/score.service";
import { useAuthStore } from "../../../src/store/auth.store";
import { useEventStore } from "../../../src/store/event.store";
import { useOfflineStore } from "../../../src/store/offline.store";
import { getSportConfigFromEvent } from "../../../src/utils/sport-config";

// ─────────────────────────────────────────────────────────────────────────────
// Scoring Screen — one overall score (0–100) per college, split into tabs:
//   Score  · pick a college, enter its score, submit
//   Sheet  · live digital score sheet for the sport
//   Tools  · OCR scan, printable form, complete event
// ─────────────────────────────────────────────────────────────────────────────

type ScoringMethod = "manual" | "ocr";
type Tab = "score" | "sheet" | "tools";

const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "score", label: "Score", icon: "create-outline" },
  { key: "sheet", label: "Sheet", icon: "grid-outline" },
  { key: "tools", label: "Tools", icon: "construct-outline" },
];

const clamp100 = (n: number) => Math.max(0, Math.min(100, n));
const isValidScore = (raw: string | undefined) => {
  const n = parseFloat(raw ?? "");
  return !isNaN(n) && n >= 0 && n <= 100;
};

export default function ScoringScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const { isConnected } = useNetwork();

  const event   = useEventStore((s) => s.event);
  const user    = useAuthStore((s) => s.user);
  const enqueue = useOfflineStore((s) => s.enqueue);

  const [tab,               setTab]               = useState<Tab>("score");
  const [departmentScores,  setDepartmentScores]  = useState<Record<string, string>>({});
  const [method,            setMethod]            = useState<ScoringMethod>("manual");
  const [department,        setDepartment]        = useState<string>("");
  const [isSubmitting,      setIsSubmitting]      = useState(false);
  const [showOCR,           setShowOCR]           = useState(false);
  const [showPrintableForm, setShowPrintableForm] = useState(false);
  const [ocrImageUri,       setOcrImageUri]       = useState<string | null>(null);
  const [isCompleting,      setIsCompleting]      = useState(false);

  const sportConfig = getSportConfigFromEvent(event?.category, event?.name);
  const accentColor = sportConfig.color;
  const abbr = useDeptAbbreviator();

  const depts = useMemo(() => event?.departments ?? [], [event?.departments]);
  const currentScore = department ? (departmentScores[department] ?? "") : "";

  // Auto-select the first college once the event loads.
  useEffect(() => {
    if (!depts.length) return;
    setDepartment((current) => (current && depts.includes(current) ? current : depts[0]));
  }, [event?.id, depts]);

  const setScore = useCallback(
    (value: string) => {
      if (!department) return;
      setDepartmentScores((prev) => ({ ...prev, [department]: value }));
      setMethod("manual");
    },
    [department],
  );

  const nudge = useCallback(
    (delta: number) => {
      if (!department) return;
      const base = parseFloat(currentScore);
      setScore(String(clamp100((isNaN(base) ? 0 : base) + delta)));
    },
    [department, currentScore, setScore],
  );

  const handleOcrConfirm = useCallback(
    (totalScore: number, imageUri: string) => {
      if (!department) return;
      setDepartmentScores((prev) => ({ ...prev, [department]: String(totalScore) }));
      setOcrImageUri(imageUri);
      setMethod("ocr");
      setShowOCR(false);
      setTab("score");
    },
    [department],
  );

  // ── Validate + submit ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!event || !user || !department) return;

    if (!isValidScore(departmentScores[department])) {
      Alert.alert("Invalid Score", "Enter an overall score from 0 to 100.");
      return;
    }
    const total = parseFloat(departmentScores[department]);

    const payload = {
      eventId:        event.id,
      department,
      judgeId:        user.id,
      judgeName:      user.name,
      totalScore:     total,
      method,
      image_url:      method === "ocr" ? ocrImageUri : null,
      submittedViaQr: true,
    };

    const goToConfirm = (offline: boolean) =>
      router.push({
        pathname: "/(app)/scoring/confirm",
        params: {
          eventName: event.name,
          department,
          total: total.toFixed(2),
          mode: method,
          isOffline: offline ? "true" : "false",
        },
      });

    setIsSubmitting(true);
    try {
      if (!isConnected) {
        await enqueue(payload);
        goToConfirm(true);
        return;
      }
      await scoreService.submitScore(payload);
      goToConfirm(false);
    } catch (error: any) {
      const isConnectionIssue =
        error?.code === "NETWORK_ERROR" ||
        error?.code === "TIMEOUT" ||
        error?.message === "NETWORK_ERROR";

      if (isConnectionIssue) {
        await enqueue(payload);
        goToConfirm(true);
      } else {
        Alert.alert(
          "Score not submitted",
          error?.message ||
            "The server rejected this score. Check the value and try again — it has NOT been saved.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteEvent = () => {
    if (!event) return;
    Alert.alert(
      "Complete Event",
      "Mark this event as completed? This cannot be undone.",
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
              Alert.alert("Event Completed", "The event has been marked as completed.");
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

  // ── Missing-event guard ────────────────────────────────────────────────────
  if (!event) {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIcon}>
          <Ionicons name="qr-code-outline" size={56} color={COLORS.primary} />
        </View>
        <Text style={styles.emptyTitle}>No Event Loaded</Text>
        <Text style={styles.emptySubtitle}>Scan a QR code to load an event before scoring.</Text>
        <Button label="Go to Scanner" onPress={() => router.replace("/(app)/scanner")} variant="primary" size="lg" />
      </View>
    );
  }

  const scoredCount = depts.filter((d) => isValidScore(departmentScores[d])).length;
  const overallPct  = depts.length ? scoredCount / depts.length : 0;
  const scoreReady  = isValidScore(currentScore);

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={[styles.header, { backgroundColor: accentColor }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Ionicons name={sportConfig.icon as any} size={22} color="#fff" />
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle} numberOfLines={1}>{event.name}</Text>
              <Text style={styles.headerSub} numberOfLines={1}>{sportConfig.label} · {event.category}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            {!isConnected && (
              <View style={styles.offlineDot}>
                <Ionicons name="cloud-offline-outline" size={14} color="#fff" />
              </View>
            )}
            <Badge
              label={event.status}
              variant={
                event.status === "ongoing" ? "success" :
                event.status === "completed" ? "default" : "warning"
              }
            />
          </View>
        </View>

        {/* ── Tab bar ─────────────────────────────────────────────────── */}
        <View style={styles.tabBar}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={styles.tabBtn}
                onPress={() => setTab(t.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Ionicons name={t.icon} size={17} color={active ? accentColor : COLORS.textSecondary} />
                <Text style={[styles.tabLabel, active && { color: accentColor, fontWeight: FONT_WEIGHT.bold }]}>
                  {t.label}
                </Text>
                <View style={[styles.tabIndicator, active && { backgroundColor: accentColor }]} />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ═══ SCORE TAB ═══════════════════════════════════════════════ */}
        {tab === "score" && (
          <>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${Math.round(overallPct * 100)}%`,
                    backgroundColor: overallPct === 1 ? COLORS.success : accentColor,
                  },
                ]}
              />
            </View>

            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.sectionHeadRow}>
                <Text style={styles.sectionLabel}>College</Text>
                <Text style={styles.sectionMeta}>{scoredCount} / {depts.length} scored</Text>
              </View>

              <View style={styles.deptList}>
                {depts.length === 0 ? (
                  <Text style={styles.mutedNote}>No colleges assigned to this event.</Text>
                ) : (
                  depts.map((d) => {
                    const selected = d === department;
                    const raw = departmentScores[d];
                    const scored = isValidScore(raw);
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[
                          styles.deptRow,
                          selected && { borderColor: accentColor, backgroundColor: `${accentColor}0D` },
                        ]}
                        onPress={() => setDepartment(d)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={d}
                      >
                        <Ionicons
                          name={selected ? "radio-button-on" : "radio-button-off"}
                          size={20}
                          color={selected ? accentColor : COLORS.textMuted}
                        />
                        <View style={styles.deptText}>
                          <Text style={[styles.deptName, selected && { color: accentColor }]} numberOfLines={1}>
                            {abbr(d)}
                          </Text>
                          {abbr(d) !== d && (
                            <Text style={styles.deptSub} numberOfLines={1}>{d}</Text>
                          )}
                        </View>
                        {scored && (
                          <View style={[styles.scoredPill, { backgroundColor: `${accentColor}18` }]}>
                            <Text style={[styles.scoredPillText, { color: accentColor }]}>
                              {parseFloat(raw).toFixed(0)}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>

              <Text style={[styles.sectionLabel, { marginTop: SPACING.lg }]}>Overall Score</Text>
              <View style={styles.scoreCard}>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={[styles.stepBtn, { borderColor: `${accentColor}40` }]}
                    onPress={() => nudge(-1)}
                    disabled={!department}
                    accessibilityLabel="Decrease score"
                  >
                    <Ionicons name="remove" size={22} color={accentColor} />
                  </TouchableOpacity>

                  <TextInput
                    style={[styles.scoreInput, { color: accentColor }]}
                    value={currentScore}
                    onChangeText={setScore}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textMuted}
                    editable={!isSubmitting && !!department}
                    maxLength={5}
                    accessibilityLabel="Overall score, 0 to 100"
                  />

                  <TouchableOpacity
                    style={[styles.stepBtn, { borderColor: `${accentColor}40` }]}
                    onPress={() => nudge(1)}
                    disabled={!department}
                    accessibilityLabel="Increase score"
                  >
                    <Ionicons name="add" size={22} color={accentColor} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.scoreScale}>out of 100</Text>

                {method === "ocr" && ocrImageUri && (
                  <View style={styles.methodChip}>
                    <Ionicons name="scan-outline" size={12} color={COLORS.ocr} />
                    <Text style={styles.methodChipText}>From scanned sheet</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  { backgroundColor: scoreReady && department ? accentColor : `${accentColor}70` },
                ]}
                onPress={handleSubmit}
                disabled={!department || !scoreReady || isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <Text style={styles.submitBtnText}>Submitting…</Text>
                ) : !isConnected ? (
                  <>
                    <Ionicons name="cloud-offline-outline" size={20} color="#fff" style={styles.submitIcon} />
                    <Text style={styles.submitBtnText}>Save Offline</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" style={styles.submitIcon} />
                    <Text style={styles.submitBtnText}>
                      Submit{department ? ` — ${abbr(department)}` : ""}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={{ height: SPACING.xxl }} />
            </ScrollView>
          </>
        )}

        {/* ═══ SHEET TAB ═══════════════════════════════════════════════ */}
        {tab === "sheet" && (
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.sheetHead}>
              <View style={[styles.sheetHeadIcon, { backgroundColor: `${accentColor}15` }]}>
                <Ionicons name={sportConfig.icon as any} size={20} color={accentColor} />
              </View>
              <View style={styles.sheetHeadText}>
                <Text style={styles.sheetHeadTitle}>{sportConfig.label} · Live Score</Text>
                <Text style={styles.sheetHeadSub}>
                  Publish the running score to the public board as the game plays.
                </Text>
              </View>
            </View>

            <LivePublishPanel event={event} />

            <View style={styles.detailDivider}>
              <View style={styles.detailLine} />
              <Text style={styles.detailLabel}>DETAILED TRACKER · LOCAL ONLY</Text>
              <View style={styles.detailLine} />
            </View>

            {sportConfig.type === "default" && (
              <View style={styles.noteRow}>
                <Ionicons name="information-circle-outline" size={14} color={COLORS.warning} />
                <Text style={styles.noteText}>
                  Sport not recognised — showing a generic points sheet.
                </Text>
              </View>
            )}

            <LiveScoreTracker event={event} embedded />
            <View style={{ height: SPACING.xxl }} />
          </ScrollView>
        )}

        {/* ═══ TOOLS TAB ═══════════════════════════════════════════════ */}
        {tab === "tools" && (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionLabel}>Tools</Text>

            <TouchableOpacity style={styles.toolCard} onPress={() => setShowOCR(true)} activeOpacity={0.8}>
              <View style={[styles.toolIcon, { backgroundColor: COLORS.ocrLight }]}>
                <Ionicons name="scan-outline" size={20} color={COLORS.ocr} />
              </View>
              <View style={styles.toolTextWrap}>
                <Text style={styles.toolTitle}>Scan Score Sheet</Text>
                <Text style={styles.toolDesc}>Photograph a paper sheet to read the total automatically.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolCard} onPress={() => setShowPrintableForm(true)} activeOpacity={0.8}>
              <View style={[styles.toolIcon, { backgroundColor: `${accentColor}15` }]}>
                <Ionicons name="document-text-outline" size={20} color={accentColor} />
              </View>
              <View style={styles.toolTextWrap}>
                <Text style={styles.toolTitle}>Official Score Sheet</Text>
                <Text style={styles.toolDesc}>Preview, print, or share the printed form.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>

            {event.status === "ongoing" && (
              <View style={styles.dangerCard}>
                <Text style={styles.dangerTitle}>Complete Event</Text>
                <Text style={styles.dangerDesc}>
                  Mark this event finished once every college has been scored. This cannot be undone.
                </Text>
                <Button
                  label={isCompleting ? "Completing…" : "Mark Event Complete"}
                  onPress={handleCompleteEvent}
                  variant="secondary"
                  size="md"
                  loading={isCompleting}
                  disabled={!isConnected}
                  fullWidth
                  icon={<Ionicons name="flag-outline" size={16} color={COLORS.primary} />}
                />
                {!isConnected && (
                  <Text style={styles.dangerHint}>Requires an internet connection.</Text>
                )}
              </View>
            )}

            <View style={{ height: SPACING.xxl }} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* ── OCR modal ───────────────────────────────────────────────── */}
      <Modal visible={showOCR} animationType="slide" onRequestClose={() => setShowOCR(false)}>
        <OCRScoreMapper onConfirm={handleOcrConfirm} onCancel={() => setShowOCR(false)} />
      </Modal>

      {/* ── Printable form modal ────────────────────────────────────── */}
      <Modal visible={showPrintableForm} animationType="slide" onRequestClose={() => setShowPrintableForm(false)}>
        <PrintableScoreSheetView event={event} onClose={() => setShowPrintableForm(false)} />
      </Modal>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Empty state
  emptyState: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryPale,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary },
  emptySubtitle: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, textAlign: "center" },

  // Header
  header: {
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
  },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flex: 1 },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: "#fff" },
  headerSub: { fontSize: FONT_SIZE.xs, color: "rgba(255,255,255,0.75)", marginTop: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  offlineDot: {
    width: 26,
    height: 26,
    borderRadius: RADIUS.full,
    backgroundColor: "rgba(255,255,255,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
  },
  tabLabel: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium, color: COLORS.textSecondary },
  tabIndicator: {
    position: "absolute",
    left: SPACING.lg,
    right: SPACING.lg,
    bottom: 0,
    height: 2.5,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: "transparent",
  },

  // Progress
  progressTrack: { height: 3, backgroundColor: COLORS.surfaceMuted },
  progressBar: { height: 3 },

  // Scroll body
  scroll: { padding: SPACING.md, gap: SPACING.sm },

  // Section headings
  sectionHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionMeta: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  mutedNote: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, padding: SPACING.md },

  // Sheet tab header
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  sheetHeadIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetHeadText: { flex: 1 },
  sheetHeadTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary },
  sheetHeadSub: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 1 },
  detailDivider: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginVertical: SPACING.sm },
  detailLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  detailLabel: { fontSize: 9, fontWeight: FONT_WEIGHT.bold, color: COLORS.textMuted, letterSpacing: 0.6 },
  noteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    backgroundColor: COLORS.warningLight,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  noteText: { flex: 1, fontSize: FONT_SIZE.xs, color: COLORS.warning },

  // College list
  deptList: { gap: SPACING.sm, marginTop: SPACING.xs },
  deptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    ...SHADOWS.sm,
  },
  deptText: { flex: 1 },
  deptName: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold, color: COLORS.textPrimary },
  deptSub: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 1 },
  scoredPill: {
    minWidth: 34,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    alignItems: "center",
  },
  scoredPillText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },

  // Score card
  scoreCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginTop: SPACING.xs,
    alignItems: "center",
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
  },
  scoreInput: {
    minWidth: 120,
    textAlign: "center",
    fontSize: FONT_SIZE.hero,
    fontWeight: FONT_WEIGHT.extrabold,
    paddingVertical: SPACING.xs,
  },
  scoreScale: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  methodChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    backgroundColor: COLORS.ocrLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  methodChipText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold, color: COLORS.ocr },

  // Submit
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    marginTop: SPACING.lg,
    ...SHADOWS.md,
  },
  submitIcon: { marginRight: SPACING.sm },
  submitBtnText: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: "#fff", letterSpacing: 0.3 },

  // Tools
  toolCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    ...SHADOWS.sm,
  },
  toolIcon: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  toolTextWrap: { flex: 1, gap: 2 },
  toolTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold, color: COLORS.textPrimary },
  toolDesc: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },

  dangerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.errorLight,
    padding: SPACING.md,
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  dangerTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary },
  dangerDesc: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  dangerHint: { fontSize: FONT_SIZE.xs, color: COLORS.warning, textAlign: "center" },
});
