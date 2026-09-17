import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { COLORS, RADIUS, SHADOWS, SPACING, TYPE } from "../../../constants/theme";
import { LivePublishPanel } from "../../../src/components/scoring/LivePublishPanel";
import { LiveScoreTracker } from "../../../src/components/scoring/LiveScoreTracker";
import { OCRScoreMapper } from "../../../src/components/scoring/OCRScoreMapper";
import { PrintableScoreSheetView } from "../../../src/components/scoring/PrintableScoreSheetView";
import { Badge } from "../../../src/components/ui/Badge";
import { Button } from "../../../src/components/ui/Button";
import { Icon, type IconName } from "../../../src/components/ui/Icon";
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

const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: "score", label: "Score", icon: "pencil" },
  { key: "sheet", label: "Sheet", icon: "list" },
  { key: "tools", label: "Tools", icon: "settings" },
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

  const event = useEventStore((s) => s.event);
  const user = useAuthStore((s) => s.user);
  const enqueue = useOfflineStore((s) => s.enqueue);

  const [tab, setTab] = useState<Tab>("score");
  const [departmentScores, setDepartmentScores] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<ScoringMethod>("manual");
  const [department, setDepartment] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOCR, setShowOCR] = useState(false);
  const [showPrintableForm, setShowPrintableForm] = useState(false);
  const [ocrImageUri, setOcrImageUri] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  const sportConfig = getSportConfigFromEvent(event?.category, event?.name);
  const accent = sportConfig.color;
  const abbr = useDeptAbbreviator();

  const depts = useMemo(() => event?.departments ?? [], [event?.departments]);
  const currentScore = department ? (departmentScores[department] ?? "") : "";

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
      Haptics.selectionAsync().catch(() => {});
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

  // ── Submit every scored college in one go ────────────────────────────────
  const handleSubmitAll = async () => {
    if (!event || !user) return;

    const toSubmit = depts.filter((d) => isValidScore(departmentScores[d]));
    if (toSubmit.length === 0) {
      Alert.alert("Nothing to submit", "Enter a score from 0 to 100 for at least one college.");
      return;
    }

    const isConnIssue = (e: any) =>
      e?.code === "NETWORK_ERROR" || e?.code === "TIMEOUT" || e?.message === "NETWORK_ERROR";

    setIsSubmitting(true);
    try {
      const done: { dept: string; score: number }[] = [];
      const rejected: string[] = [];
      let anyQueued = false;

      for (const dept of toSubmit) {
        const score = parseFloat(departmentScores[dept]);
        const payload = {
          eventId: event.id,
          department: dept,
          judgeId: user.id,
          judgeName: user.name,
          totalScore: score,
          method,
          // A photo can be attached even when the judge ended up typing the
          // final number themselves (OCR misread it, or they overrode it) —
          // `method` describes how the number was derived, `image_url` just
          // says whether a photo of the sheet exists, so don't couple them.
          image_url: ocrImageUri,
          submittedViaQr: true,
        };

        if (!isConnected) {
          await enqueue(payload);
          anyQueued = true;
          done.push({ dept, score });
          continue;
        }
        try {
          await scoreService.submitScore(payload);
          done.push({ dept, score });
        } catch (error: any) {
          if (isConnIssue(error)) {
            await enqueue(payload);
            anyQueued = true;
            done.push({ dept, score });
          } else {
            rejected.push(`${abbr(dept)} — ${error?.message || "rejected"}`);
          }
        }
      }

      if (rejected.length) {
        Alert.alert(
          done.length ? "Some scores not submitted" : "Score not submitted",
          `The server rejected:\n${rejected.join("\n")}` +
            (done.length ? `\n\n${done.length} other score(s) were saved.` : ""),
        );
      }

      if (done.length) {
        router.push({
          pathname: "/(app)/scoring/confirm",
          params: {
            eventName: event.name,
            summary: JSON.stringify(done.map((d) => ({ d: abbr(d.dept), v: d.score }))),
            department: done[0].dept,
            total: done[0].score.toFixed(2),
            mode: method,
            isOffline: anyQueued ? "true" : "false",
          },
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteEvent = () => {
    if (!event) return;
    Alert.alert("Complete event", "Mark this event as completed? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Complete",
        style: "destructive",
        onPress: async () => {
          if (!isConnected) {
            Alert.alert("No connection", "You need an internet connection to complete an event.");
            return;
          }
          setIsCompleting(true);
          try {
            await api.put(`/events/${event.id}`, { status: "completed" });
            Alert.alert("Event completed", "The event has been marked as completed.");
            router.back();
          } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to complete event. Please try again.");
          } finally {
            setIsCompleting(false);
          }
        },
      },
    ]);
  };

  // ── Missing-event guard ────────────────────────────────────────────────────
  if (!event) {
    return (
      <SafeAreaView style={styles.guard}>
        <View style={[styles.guardIcon, { backgroundColor: COLORS.primaryTint }]}>
          <Icon name="qr" size={28} color={COLORS.primary} />
        </View>
        <Text style={styles.guardTitle}>No event loaded</Text>
        <Text style={styles.guardSub}>Scan a QR code first.</Text>
        <Button
          label="Go to scanner"
          onPress={() => router.replace("/(app)/scanner")}
          size="lg"
          icon={<Icon name="scan" size={18} color={COLORS.textInverse} />}
          style={{ marginTop: SPACING.sm }}
        />
      </SafeAreaView>
    );
  }

  const scoredCount = depts.filter((d) => isValidScore(departmentScores[d])).length;
  const overallPct = depts.length ? scoredCount / depts.length : 0;

  return (
    <>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          {/* Header — sport colour band */}
          <View style={[styles.header, { backgroundColor: accent }]}>
            <Pressable style={styles.iconBtn} onPress={() => router.back()} hitSlop={8}>
              <Icon name="arrow-left" size={20} color="#fff" strokeWidth={2.2} />
            </Pressable>
            <View style={styles.headerCenter}>
              <Icon name={sportConfig.icon as IconName} size={18} color="#fff" strokeWidth={2.2} />
              <View style={styles.headerText}>
                <Text style={styles.headerTitle} numberOfLines={1}>{event.name}</Text>
                <Text style={styles.headerSub} numberOfLines={1}>
                  {sportConfig.label}{event.venueName ? ` · ${event.venueName}` : ""}
                </Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              {!isConnected && (
                <View style={styles.offChip}>
                  <Icon name="cloud-off" size={13} color="#fff" strokeWidth={2.4} />
                </View>
              )}
              <Badge
                label={event.status}
                variant={event.status === "ongoing" ? "success" : event.status === "completed" ? "default" : "warning"}
                dot
              />
            </View>
          </View>

          {/* Segmented tabs */}
          <View style={styles.tabWrap}>
            <View style={styles.tabTrack}>
              {TABS.map((t) => {
                const active = tab === t.key;
                return (
                  <Pressable
                    key={t.key}
                    style={[styles.tab, active && [styles.tabActive, { shadowColor: accent }]]}
                    onPress={() => setTab(t.key)}
                  >
                    <Icon name={t.icon} size={15} color={active ? accent : COLORS.textMuted} strokeWidth={active ? 2.4 : 2} />
                    <Text style={[styles.tabLabel, active && { color: accent }]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ═══ SCORE ═══ */}
          {tab === "score" && (
            <>
              <View style={styles.progressTrack}>
                <View style={[styles.progressBar, { width: `${Math.round(overallPct * 100)}%`, backgroundColor: overallPct === 1 ? COLORS.success : accent }]} />
              </View>

              <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.sectionRow}>
                  <Text style={styles.section}>College</Text>
                  <Text style={styles.sectionMeta}>{scoredCount} / {depts.length} scored</Text>
                </View>

                <View style={styles.deptList}>
                  {depts.length === 0 ? (
                    <Text style={styles.muted}>No colleges assigned to this event.</Text>
                  ) : (
                    depts.map((d) => {
                      const selected = d === department;
                      const raw = departmentScores[d];
                      const scored = isValidScore(raw);
                      return (
                        <Pressable
                          key={d}
                          style={({ pressed }) => [
                            styles.deptRow,
                            selected && { borderColor: accent, backgroundColor: `${accent}0D` },
                            pressed && !selected && styles.deptPressed,
                          ]}
                          onPress={() => setDepartment(d)}
                        >
                          <Icon
                            name={scored ? "check-circle" : selected ? "target" : "circle-dot"}
                            size={19}
                            color={scored ? COLORS.success : selected ? accent : COLORS.textMuted}
                            strokeWidth={2.2}
                          />
                          <View style={styles.deptText}>
                            <Text style={[styles.deptName, selected && { color: accent }]} numberOfLines={1}>{abbr(d)}</Text>
                            {abbr(d) !== d && <Text style={styles.deptSub} numberOfLines={1}>{d}</Text>}
                          </View>
                          {scored && (
                            <View style={[styles.scorePill, { backgroundColor: `${accent}18` }]}>
                              <Text style={[styles.scorePillText, { color: accent }]}>{parseFloat(raw).toFixed(0)}</Text>
                            </View>
                          )}
                        </Pressable>
                      );
                    })
                  )}
                </View>

                <View style={styles.sectionRow}>
                  <Text style={styles.section}>Overall score</Text>
                  <View style={styles.methodSeg}>
                    <Pressable style={[styles.methodBtn, method === "manual" && styles.methodBtnOn]} onPress={() => setMethod("manual")}>
                      <Text style={[styles.methodBtnText, method === "manual" && styles.methodBtnTextOn]}>Manual</Text>
                    </Pressable>
                    <Pressable style={[styles.methodBtn, method === "ocr" && styles.methodBtnOn]} onPress={() => setShowOCR(true)}>
                      <Icon name="scan" size={12} color={method === "ocr" ? COLORS.primary : COLORS.textMuted} />
                      <Text style={[styles.methodBtnText, method === "ocr" && styles.methodBtnTextOn]}>Scan</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.scoreCard}>
                  <View style={styles.stepperRow}>
                    <Pressable style={({ pressed }) => [styles.stepBtn, { borderColor: `${accent}40` }, pressed && { backgroundColor: `${accent}10` }]} onPress={() => nudge(-1)} disabled={!department}>
                      <Icon name="minus" size={22} color={accent} strokeWidth={2.6} />
                    </Pressable>
                    <TextInput
                      style={[styles.scoreInput, { color: accent }]}
                      value={currentScore}
                      onChangeText={setScore}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={COLORS.textMuted}
                      editable={!isSubmitting && !!department}
                      maxLength={5}
                    />
                    <Pressable style={({ pressed }) => [styles.stepBtn, { borderColor: `${accent}40` }, pressed && { backgroundColor: `${accent}10` }]} onPress={() => nudge(1)} disabled={!department}>
                      <Icon name="plus" size={22} color={accent} strokeWidth={2.6} />
                    </Pressable>
                  </View>
                  <Text style={styles.scoreScale}>out of 100</Text>
                  {ocrImageUri && (
                    <View style={styles.ocrChip}>
                      <Icon name="scan" size={12} color={COLORS.ocr} />
                      <Text style={styles.ocrChipText}>From scanned sheet</Text>
                    </View>
                  )}
                </View>

                <Button
                  label={
                    isSubmitting
                      ? "Submitting…"
                      : !isConnected
                        ? `Save ${scoredCount} score${scoredCount === 1 ? "" : "s"} offline`
                        : `Submit ${scoredCount} score${scoredCount === 1 ? "" : "s"}`
                  }
                  onPress={handleSubmitAll}
                  loading={isSubmitting}
                  disabled={scoredCount === 0}
                  size="lg"
                  fullWidth
                  style={[styles.submit, { backgroundColor: scoredCount > 0 ? accent : `${accent}70` }]}
                  icon={<Icon name={isConnected ? "check-circle" : "cloud-off"} size={18} color="#fff" strokeWidth={2.2} />}
                />
                {scoredCount < depts.length && scoredCount > 0 && (
                  <Text style={styles.submitHint}>
                    {depts.length - scoredCount} not scored — submit later.
                  </Text>
                )}
                <View style={{ height: SPACING.xxl }} />
              </ScrollView>
            </>
          )}

          {/* ═══ SHEET ═══ */}
          {tab === "sheet" && (
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.sheetHead}>
                <View style={[styles.sheetHeadIcon, { backgroundColor: `${accent}15` }]}>
                  <Icon name={sportConfig.icon as IconName} size={18} color={accent} strokeWidth={2.2} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.sheetHeadTitle}>{sportConfig.label} · Live score</Text>
                  <Text style={styles.sheetHeadSub}>Publish live to the public board.</Text>
                </View>
              </View>

              <LivePublishPanel event={event} />

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerLabel}>DETAILED TRACKER · LOCAL ONLY</Text>
                <View style={styles.dividerLine} />
              </View>

              {sportConfig.type === "default" && (
                <View style={styles.note}>
                  <Icon name="info" size={14} color={COLORS.warning} />
                  <Text style={styles.noteText}>Generic points sheet.</Text>
                </View>
              )}

              <LiveScoreTracker event={event} embedded />
              <View style={{ height: SPACING.xxl }} />
            </ScrollView>
          )}

          {/* ═══ TOOLS ═══ */}
          {tab === "tools" && (
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              <Text style={styles.section}>Tools</Text>

              <Pressable style={({ pressed }) => [styles.toolCard, pressed && styles.deptPressed]} onPress={() => setShowOCR(true)}>
                <View style={[styles.toolIcon, { backgroundColor: COLORS.ocrLight }]}>
                  <Icon name="scan" size={18} color={COLORS.ocr} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.toolTitle}>Scan score sheet</Text>
                  <Text style={styles.toolDesc}>Read the total from a photo.</Text>
                </View>
                <Icon name="chevron-right" size={18} color={COLORS.textMuted} />
              </Pressable>

              <Pressable style={({ pressed }) => [styles.toolCard, pressed && styles.deptPressed]} onPress={() => setShowPrintableForm(true)}>
                <View style={[styles.toolIcon, { backgroundColor: `${accent}15` }]}>
                  <Icon name="file-text" size={18} color={accent} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.toolTitle}>Official score sheet</Text>
                  <Text style={styles.toolDesc}>Preview, print or share.</Text>
                </View>
                <Icon name="chevron-right" size={18} color={COLORS.textMuted} />
              </Pressable>

              {event.status === "ongoing" && (
                <View style={styles.dangerCard}>
                  <View style={styles.dangerHead}>
                    <Icon name="alert-triangle" size={16} color={COLORS.destructive} strokeWidth={2.2} />
                    <Text style={styles.dangerTitle}>Complete event</Text>
                  </View>
                  <Text style={styles.dangerDesc}>
                    Marks the event finished. Cannot be undone.
                  </Text>
                  <Button
                    label={isCompleting ? "Completing…" : "Mark event complete"}
                    onPress={handleCompleteEvent}
                    variant="danger"
                    loading={isCompleting}
                    disabled={!isConnected}
                    fullWidth
                    icon={<Icon name="flag" size={16} color={COLORS.textInverse} />}
                  />
                  {!isConnected && <Text style={styles.dangerHint}>Requires an internet connection.</Text>}
                </View>
              )}

              <View style={{ height: SPACING.xxl }} />
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal visible={showOCR} animationType="slide" onRequestClose={() => setShowOCR(false)}>
        <OCRScoreMapper
          onConfirm={handleOcrConfirm}
          onCancel={(imageUri) => {
            // A photo may already be captured/stored even though the judge
            // is backing out to type the number themselves — keep it
            // attached rather than losing that evidence.
            if (imageUri) setOcrImageUri(imageUri);
            setShowOCR(false);
          }}
        />
      </Modal>
      <Modal visible={showPrintableForm} animationType="slide" onRequestClose={() => setShowPrintableForm(false)}>
        <PrintableScoreSheetView event={event} onClose={() => setShowPrintableForm(false)} />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },

  // Guard
  guard: { flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center", padding: SPACING.xl, gap: SPACING.xs },
  guardIcon: { width: 64, height: 64, borderRadius: RADIUS.full, alignItems: "center", justifyContent: "center", marginBottom: SPACING.sm },
  guardTitle: { ...TYPE.title, color: COLORS.textPrimary },
  guardSub: { ...TYPE.body, color: COLORS.textSecondary, textAlign: "center" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  iconBtn: { width: 34, height: 34, borderRadius: RADIUS.full, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flex: 1 },
  headerText: { flex: 1 },
  headerTitle: { ...TYPE.subhead, color: "#fff" },
  headerSub: { ...TYPE.caption, textTransform: "none", color: "rgba(255,255,255,0.8)", marginTop: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  offChip: { width: 24, height: 24, borderRadius: RADIUS.full, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },

  // Segmented tabs
  tabWrap: { backgroundColor: COLORS.surface, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  tabTrack: { flexDirection: "row", backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.lg, padding: 4, gap: 4 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: SPACING.sm, borderRadius: RADIUS.md },
  tabActive: { backgroundColor: COLORS.surface, ...SHADOWS.sm },
  tabLabel: { ...TYPE.label, color: COLORS.textMuted },

  progressTrack: { height: 3, backgroundColor: COLORS.surfaceMuted },
  progressBar: { height: 3 },

  body: { padding: SPACING.lg, gap: SPACING.sm },

  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: SPACING.sm },
  section: { ...TYPE.caption, textTransform: "uppercase", color: COLORS.textSecondary },
  sectionMeta: { ...TYPE.bodySm, color: COLORS.textMuted },
  muted: { ...TYPE.body, color: COLORS.textMuted, padding: SPACING.md },

  deptList: { gap: SPACING.sm, marginTop: SPACING.xs },
  deptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: "transparent",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  deptPressed: { backgroundColor: COLORS.pressed },
  deptText: { flex: 1 },
  deptName: { ...TYPE.subhead, color: COLORS.textPrimary },
  deptSub: { ...TYPE.caption, textTransform: "none", color: COLORS.textMuted, marginTop: 1 },
  scorePill: { minWidth: 32, paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full, alignItems: "center" },
  scorePillText: { ...TYPE.label },

  methodSeg: { flexDirection: "row", backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.sm, padding: 2, gap: 2 },
  methodBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.sm - 2 },
  methodBtnOn: { backgroundColor: COLORS.surface, ...SHADOWS.sm },
  methodBtnText: { ...TYPE.caption, textTransform: "none", color: COLORS.textMuted },
  methodBtnTextOn: { color: COLORS.primary },

  scoreCard: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginTop: SPACING.xs,
    alignItems: "center",
    gap: SPACING.sm,
  },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  stepBtn: { width: 46, height: 46, borderRadius: RADIUS.md, borderWidth: 1.5, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surface },
  scoreInput: { minWidth: 120, textAlign: "center", fontSize: 44, fontWeight: "800", paddingVertical: SPACING.xs },
  scoreScale: { ...TYPE.bodySm, color: COLORS.textMuted },
  ocrChip: { flexDirection: "row", alignItems: "center", gap: SPACING.xs, backgroundColor: COLORS.ocrLight, paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full },
  ocrChipText: { ...TYPE.caption, textTransform: "none", color: COLORS.ocr },

  submit: { marginTop: SPACING.lg },
  submitHint: { ...TYPE.bodySm, color: COLORS.textMuted, textAlign: "center", marginTop: SPACING.xs },

  sheetHead: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.xs },
  sheetHeadIcon: { width: 38, height: 38, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  sheetHeadTitle: { ...TYPE.subhead, color: COLORS.textPrimary },
  sheetHeadSub: { ...TYPE.bodySm, color: COLORS.textSecondary, marginTop: 1 },
  divider: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginVertical: SPACING.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.hairline },
  dividerLabel: { ...TYPE.caption, color: COLORS.textMuted },
  note: { flexDirection: "row", alignItems: "center", gap: SPACING.xs, backgroundColor: COLORS.warningLight, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  noteText: { flex: 1, ...TYPE.bodySm, color: COLORS.warning },

  toolCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  toolIcon: { width: 40, height: 40, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center" },
  toolTitle: { ...TYPE.subhead, color: COLORS.textPrimary },
  toolDesc: { ...TYPE.bodySm, color: COLORS.textSecondary },

  dangerCard: {
    backgroundColor: COLORS.errorLight,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  dangerHead: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  dangerTitle: { ...TYPE.subhead, color: COLORS.textPrimary },
  dangerDesc: { ...TYPE.bodySm, color: COLORS.textSecondary },
  dangerHint: { ...TYPE.bodySm, color: COLORS.warning, textAlign: "center" },
});
