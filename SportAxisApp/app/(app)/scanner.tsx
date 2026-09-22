import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPE } from '../../constants/theme';
import { Button } from '../../src/components/ui/Button';
import { Icon } from '../../src/components/ui/Icon';
import { EmptyState } from '../../src/components/ui/States';
import { useNetwork } from '../../src/hooks/use-network';
import { useEventStore } from '../../src/store/event.store';
import { extractToken, parseQrCode } from '../../src/utils/qr-parser';

const FRAME = 248;

export default function ScannerScreen() {
  const router = useRouter();
  const loadEvent = useEventStore((s) => s.loadByQrToken);
  const loadCache = useEventStore((s) => s.loadFromCache);
  const event = useEventStore((s) => s.event);
  const isLoading = useEventStore((s) => s.isLoading);
  const { isConnected } = useNetwork();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(true);

  const scanLineY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineY, { toValue: FRAME - 8, duration: 1600, useNativeDriver: true }),
        Animated.timing(scanLineY, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  useEffect(() => { loadCache(); }, []);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned || isLoading) return;
    setScanned(true);
    setCameraActive(false);
    setScanError(null);
    try {
      const token = extractToken(parseQrCode(data));
      await loadEvent(token);
      const id = useEventStore.getState().event?.id;
      if (id) router.push(`/(app)/scoring/${id}`);
    } catch (error: any) {
      setScanError(error.message ?? 'Invalid QR code. Try again.');
      setScanned(false);
      setCameraActive(true);
    }
  };

  if (!permission) return <View style={styles.black} />;

  if (!permission.granted) {
    return (
      <View style={styles.permWrap}>
        <EmptyState
          icon="camera-off"
          title="Camera access needed"
          hint="SportsAxis scans the event QR code to open its score sheet."
          actionLabel="Allow camera"
          onAction={requestPermission}
        />
      </View>
    );
  }

  return (
    <View style={styles.black}>
      {cameraActive && (
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarcodeScanned}
        />
      )}

      <View style={styles.overlay}>
        <View style={styles.top}>
          <View style={styles.brandPill}>
            <View style={styles.brandDot} />
            <Text style={styles.brandText}>SportsAxis · Committee</Text>
          </View>
          {!isConnected && (
            <View style={styles.offlinePill}>
              <Icon name="wifi-off" size={13} color="#fff" strokeWidth={2.4} />
              <Text style={styles.offlineText}>Offline</Text>
            </View>
          )}
        </View>

        <View style={styles.frameSection}>
          <Text style={styles.hint}>Scan the event QR</Text>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
            <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLineY }] }]} />
          </View>
          {isLoading && (
            <View style={styles.statusChip}>
              <Text style={styles.statusText}>Loading event…</Text>
            </View>
          )}
          {!!scanError && (
            <View style={[styles.statusChip, styles.errChip]}>
              <Icon name="alert-circle" size={14} color={COLORS.destructive} strokeWidth={2.2} />
              <Text style={styles.errText}>{scanError}</Text>
            </View>
          )}
        </View>

        <View style={styles.sheet}>
          {event && !isLoading && (
            <Pressable style={styles.resume} onPress={() => router.push(`/(app)/scoring/${event.id}`)}>
              <View style={styles.resumeTile}>
                <Icon name="file-text" size={18} color={COLORS.primary} />
              </View>
              <View style={styles.resumeText}>
                <Text style={styles.resumeName} numberOfLines={1}>{event.name}</Text>
                <Text style={styles.resumeHint}>Resume scoring</Text>
              </View>
              <Icon name="chevron-right" size={18} color={COLORS.primary} />
            </Pressable>
          )}

          {scanned && !isLoading && (
            <Button
              label="Scan again"
              variant="secondary"
              fullWidth
              onPress={() => { setScanned(false); setScanError(null); setCameraActive(true); }}
              icon={<Icon name="scan" size={16} color={COLORS.textPrimary} />}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000' },
  permWrap: { flex: 1, backgroundColor: COLORS.background },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'space-between' },

  top: { paddingTop: SPACING.xxl, paddingHorizontal: SPACING.lg, alignItems: 'center', gap: SPACING.sm },
  brandPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999,
    paddingHorizontal: SPACING.md, paddingVertical: 6,
  },
  brandDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.primaryLighter },
  brandText: { ...TYPE.label, color: '#fff' },
  offlinePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(217,119,6,0.9)', borderRadius: 999,
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
  },
  offlineText: { ...TYPE.caption, textTransform: 'none', color: '#fff' },

  frameSection: { alignItems: 'center', gap: SPACING.lg },
  hint: { ...TYPE.body, color: 'rgba(255,255,255,0.92)', textAlign: 'center', paddingHorizontal: SPACING.xl },
  frame: { width: FRAME, height: FRAME, overflow: 'hidden' },
  corner: { position: 'absolute', width: 26, height: 26, borderColor: COLORS.primaryLighter, borderWidth: 3, borderRadius: 3 },
  tl: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0 },
  tr: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
  bl: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0 },
  br: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0 },
  scanLine: {
    position: 'absolute', left: 6, right: 6, height: 2, borderRadius: 2,
    backgroundColor: COLORS.primaryLighter, shadowColor: COLORS.primary, shadowRadius: 8, shadowOpacity: 0.9,
  },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  statusText: { ...TYPE.bodySm, color: COLORS.textPrimary },
  errChip: { backgroundColor: COLORS.errorLight },
  errText: { ...TYPE.bodySm, color: COLORS.destructive, flexShrink: 1 },

  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    gap: SPACING.sm,
    ...SHADOWS.lg,
  },
  resume: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.primaryTint, borderRadius: RADIUS.xl, padding: SPACING.md,
  },
  resumeTile: { width: 40, height: 40, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  resumeText: { flex: 1, gap: 2 },
  resumeName: { ...TYPE.subhead, color: COLORS.textPrimary },
  resumeHint: { ...TYPE.bodySm, color: COLORS.textSecondary },
});
