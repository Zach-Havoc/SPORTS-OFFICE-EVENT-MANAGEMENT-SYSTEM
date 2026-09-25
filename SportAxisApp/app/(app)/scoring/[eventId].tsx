import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
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
import { COLORS, RADIUS, SHADOWS, SPACING, TYPE } from "../../../constants/theme";
import { MatchScoreboard, type MatchScoreboardHandle } from "../../../src/components/scoring/MatchScoreboard";
import { OCRScoreMapper } from "../../../src/components/scoring/OCRScoreMapper";
import { PrintableScoreSheetView } from "../../../src/components/scoring/PrintableScoreSheetView";
import { Badge } from "../../../src/components/ui/Badge";
import { Button } from "../../../src/components/ui/Button";
import { Icon, type IconName } from "../../../src/components/ui/Icon";
import { TeamLogo } from "../../../src/components/ui/TeamLogo";
import { useDeptAbbreviator, useDeptLogos } from "../../../src/hooks/use-dept-abbr";
import { useNetwork } from "../../../src/hooks/use-network";
import api from "../../../src/services/api";
import { scoreService } from "../../../src/services/score.service";
import { useAuthStore } from "../../../src/store/auth.store";
import { useEventStore } from "../../../src/store/event.store";
import { useOfflineStore } from "../../../src/store/offline.store";
import { getSportConfigFromEvent } from "../../../src/utils/sport-config";

// ─────────────────────────────────────────────────────────────────────────────
// Scoring — one screen, shaped by the kind of event:
//
//   Two colleges (a game) · the scoreboard. Keep it live with +/−, or scan
//     the paper sheet to record the final. Finalizing completes the game.
//   Three or more (judged) · every college's 0–100 score in one list. Type
//     them, or scan the paper sheet to fill them, then submit.
//
// Both committee methods — app entry and paper + scan — are always there,
// as two actions under the scores, not as separate tabs.
// ─────────────────────────────────────────────────────────────────────────────

type ScoringMethod = "manual" | "ocr";

const isValidScore = (raw: string | undefined) => {
  const n = parseFloat(raw ?? "");
  return !isNaN(n) && n >= 0 && n <= 100;
};

export default function ScoringScreen() {
  useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const { isConnected } = useNetwork();

  const event = useEventStore((s) => s.event);
  const user = useAuthStore((s) => s.user);
  const enqueue = useOfflineStore((s) => s.enqueue);

  const [departmentScores, setDepartmentScores] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<ScoringMethod>("manual");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOCR, setShowOCR] = useState(false);
  const [showPrintableForm, setShowPrintableForm] = useState(false);
  const [ocrImageUri, setOcrImageUri] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const scoreboard = useRef<MatchScoreboardHandle>(null);

  const sportConfig = getSportConfigFromEvent(event?.category, event?.name);
  const abbr = useDeptAbbreviator();
  const logoOf = useDeptLogos();

  const depts = useMemo(() => event?.departments ?? [], [event?.departments]);
  // Same rule as the web schedule: two colleges is a game, more is judged.
  const isMatch = depts.length <= 2;

  const setScore = useCallback((dept: string, value: string) => {
    setDepartmentScores((prev) => ({ ...prev, [dept]: value }));
    setMethod("manual");
  }, []);

  const handleOcrConfirm = useCallback(
    (scores: Record<string, number>, imageUri: string) => {
      setShowOCR(false);
      if (isMatch) {
        scoreboard.current?.recordFromSheet(scores[depts[0]] ?? 0, scores[depts[1]] ?? 0, imageUri);
        return;
      }
      setDepartmentScores((prev) => ({
        ...prev,
        ...Object.fromEntries(Object.entries(scores).map(([d, v]) => [d, String(v)])),
      }));
      setOcrImageUri(imageUri);
      setMethod("ocr");
    },
    [isMatch, depts],
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
        <View style={styles.guardIcon}>
          <Icon name="qr" size={28} color={COLORS.textSecondary} />
        </View>
        <Text style={styles.guardTitle}>No event loaded</Text>
        <Text style={styles.guardSub}>Scan the event QR code first.</Text>
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

  return (
    <>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable style={styles.back} onPress={() => router.back()} hitSlop={8} accessibilityLabel="Back">
              <Icon name="arrow-left" size={20} color={COLORS.textPrimary} strokeWidth={2.2} />
            </Pressable>
            <View style={styles.flex}>
              <Text style={styles.title} numberOfLines={1}>{abbr(event.name)}</Text>
              <View style={styles.metaRow}>
                <Icon name={sportConfig.icon as IconName} size={13} color={COLORS.textMuted} />
                <Text style={styles.meta} numberOfLines={1}>
                  {sportConfig.label}{event.venueName ? ` · ${event.venueName}` : ""}
                </Text>
              </View>
            </View>
            {!isConnected ? (
              <Badge label="Offline" variant="offline" dot />
            ) : (
              <Badge
                label={event.status}
                variant={event.status === "ongoing" ? "red" : event.status === "completed" ? "default" : "warning"}
                dot
              />
            )}
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {isMatch ? (
              <MatchScoreboard ref={scoreboard} event={event} />
            ) : (
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>Scores</Text>
                  <Text style={styles.cardMeta}>
                    {scoredCount} of {depts.length} scored · out of 100
                  </Text>
                </View>
                {depts.length === 0 ? (
                  <Text style={styles.muted}>No colleges are assigned to this event.</Text>
                ) : (
                  depts.map((d, i) => {
                    const raw = departmentScores[d] ?? "";
                    const bad = raw !== "" && !isValidScore(raw);
                    return (
                      <View key={d} style={[styles.row, i > 0 && styles.rowDivider]}>
                        <TeamLogo name={d} label={abbr(d)} logoUrl={logoOf(d)} size={36} />
                        <View style={styles.flex}>
                          <Text style={styles.rowName} numberOfLines={1}>{abbr(d)}</Text>
                          {abbr(d) !== d && <Text style={styles.rowSub} numberOfLines={1}>{d}</Text>}
                        </View>
                        <TextInput
                          style={[styles.rowInput, bad && styles.rowInputBad]}
                          value={raw}
                          onChangeText={(v) => setScore(d, v)}
                          keyboardType="decimal-pad"
                          placeholder="—"
                          placeholderTextColor={COLORS.textMuted}
                          editable={!isSubmitting}
                          maxLength={6}
                          accessibilityLabel={`Score for ${abbr(d)}`}
                        />
                      </View>
                    );
                  })
                )}
                {ocrImageUri && method === "ocr" && (
                  <Badge label="Filled from the scanned sheet" variant="ocr" style={styles.ocrBadge} />
                )}
              </View>
            )}

            {/* The paper side of scoring — same two actions for every event */}
            <View style={styles.actions}>
              <ActionTile
                icon="scan"
                title="Scan paper sheet"
                sub={isMatch ? "Record the final from the sheet" : "Fill the scores from the sheet"}
                onPress={() => setShowOCR(true)}
              />
              <ActionTile
                icon="print"
                title="Score sheet"
                sub="Preview, print or share"
                onPress={() => setShowPrintableForm(true)}
              />
            </View>

            {!isMatch && (
              <>
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
                  icon={<Icon name={isConnected ? "check-circle" : "cloud-off"} size={18} color={COLORS.textInverse} strokeWidth={2.2} />}
                />
                {scoredCount > 0 && scoredCount < depts.length && (
                  <Text style={styles.hint}>{depts.length - scoredCount} not scored yet — you can submit them later.</Text>
                )}

                {event.status === "ongoing" && (
                  <Pressable
                    onPress={handleCompleteEvent}
                    disabled={!isConnected || isCompleting}
                    style={({ pressed }) => [styles.complete, pressed && { opacity: 0.6 }]}
                  >
                    <Icon name="flag" size={15} color={isConnected ? COLORS.destructive : COLORS.textDisabled} />
                    <Text style={[styles.completeText, !isConnected && { color: COLORS.textDisabled }]}>
                      {isCompleting ? "Completing…" : isConnected ? "Mark event completed" : "Go online to complete the event"}
                    </Text>
                  </Pressable>
                )}
              </>
            )}

            <View style={{ height: SPACING.xxl }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal visible={showOCR} animationType="slide" onRequestClose={() => setShowOCR(false)}>
        <OCRScoreMapper
          departments={depts}
          maxScore={isMatch ? null : 100}
          onConfirm={handleOcrConfirm}
          onCancel={(imageUri) => {
            // A photo may already be stored even though the judge is backing
            // out to type the scores — keep it attached as evidence.
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

function ActionTile({ icon, title, sub, onPress }: { icon: IconName; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]} onPress={onPress}>
      <View style={styles.tileIcon}>
        <Icon name={icon} size={18} color={COLORS.textPrimary} />
      </View>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileSub} numberOfLines={2}>{sub}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },

  guard: { flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center", padding: SPACING.xl, gap: SPACING.xs },
  guardIcon: { width: 64, height: 64, borderRadius: RADIUS.full, alignItems: "center", justifyContent: "center", marginBottom: SPACING.sm, backgroundColor: COLORS.surfaceAlt },
  guardTitle: { ...TYPE.title, color: COLORS.textPrimary },
  guardSub: { ...TYPE.body, color: COLORS.textSecondary, textAlign: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  back: { width: 36, height: 36, borderRadius: RADIUS.full, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surfaceAlt },
  title: { ...TYPE.heading, color: COLORS.textPrimary },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 },
  meta: { ...TYPE.bodySm, color: COLORS.textMuted, flexShrink: 1 },

  body: { padding: SPACING.lg, gap: SPACING.md },
  muted: { ...TYPE.body, color: COLORS.textMuted, paddingVertical: SPACING.md },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    ...SHADOWS.card,
  },
  cardHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingBottom: SPACING.sm },
  cardTitle: { ...TYPE.heading, color: COLORS.textPrimary },
  cardMeta: { ...TYPE.bodySm, color: COLORS.textMuted },

  row: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingVertical: SPACING.md },
  rowDivider: { borderTopWidth: 1, borderTopColor: COLORS.hairline },
  rowName: { ...TYPE.subhead, color: COLORS.textPrimary },
  rowSub: { ...TYPE.caption, color: COLORS.textMuted, marginTop: 1 },
  rowInput: {
    width: 84,
    height: 46,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    textAlign: "center",
    ...TYPE.numeral,
    color: COLORS.textPrimary,
  },
  rowInputBad: { borderColor: COLORS.destructive, backgroundColor: COLORS.errorLight },
  ocrBadge: { alignSelf: "flex-start", marginBottom: SPACING.sm },

  actions: { flexDirection: "row", gap: SPACING.md },
  tile: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: 2,
  },
  tilePressed: { backgroundColor: COLORS.surfaceAlt },
  tileIcon: { width: 34, height: 34, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surfaceAlt, marginBottom: SPACING.xs },
  tileTitle: { ...TYPE.subhead, color: COLORS.textPrimary },
  tileSub: { ...TYPE.caption, color: COLORS.textMuted },

  hint: { ...TYPE.bodySm, color: COLORS.textMuted, textAlign: "center" },
  complete: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.xs, paddingVertical: SPACING.md, marginTop: SPACING.sm },
  completeText: { ...TYPE.label, color: COLORS.destructive },
});
