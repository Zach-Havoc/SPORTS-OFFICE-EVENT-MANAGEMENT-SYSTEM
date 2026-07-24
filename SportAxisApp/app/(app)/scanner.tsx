import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    COLORS,
    FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOWS,
    SPACING,
} from '../../constants/theme';
import { useNetwork } from '../../src/hooks/use-network';
import { useAuthStore } from '../../src/store/auth.store';
import { useEventStore } from '../../src/store/event.store';
import { extractToken, parseQrCode } from '../../src/utils/qr-parser';

// ─────────────────────────────────────────────────────────────────────────────
// Scanner Screen — BatStateU red-and-white QR scanner
// ─────────────────────────────────────────────────────────────────────────────

export default function ScannerScreen() {
  const router    = useRouter();
  const logout    = useAuthStore((s) => s.logout);
  const user      = useAuthStore((s) => s.user);
  const loadEvent = useEventStore((s) => s.loadByQrToken);
  const loadCache = useEventStore((s) => s.loadFromCache);
  const event     = useEventStore((s) => s.event);
  const isLoading = useEventStore((s) => s.isLoading);
  const { isConnected } = useNetwork();

  const [permission,   requestPermission] = useCameraPermissions();
  const [scanned,      setScanned]        = useState(false);
  const [scanError,    setScanError]      = useState<string | null>(null);
  const [cameraActive, setCameraActive]   = useState(true);

  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const scanLineY  = useRef(new Animated.Value(0)).current;

  // Pulse animation on scan frame corners
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  // Animated red scan line
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineY, { toValue: 220, duration: 1600, useNativeDriver: true }),
        Animated.timing(scanLineY, { toValue: 0,   duration: 1600, useNativeDriver: true }),
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
      const payload = parseQrCode(data);
      const token   = extractToken(payload);
      await loadEvent(token);
      const eventId = useEventStore.getState().event?.id;
      if (eventId) {
        router.push(`/(app)/scoring/${eventId}`);
      }
    } catch (error: any) {
      setScanError(error.message ?? 'Invalid QR code. Please try again.');
      setScanned(false);
      setCameraActive(true);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  // ── Permission not granted ────────────────────────────────────────────────
  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.permContainer}>
        <View style={styles.permIconBox}>
          <Ionicons name="camera-outline" size={36} color={COLORS.primary} />
        </View>
        <Text style={styles.permTitle}>Camera Access Required</Text>
        <Text style={styles.permBody}>
          SportAxis needs camera access to scan QR codes for event sessions.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Camera Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera */}
      {cameraActive && (
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarcodeScanned}
        />
      )}

      {/* Overlay */}
      <View style={styles.overlay}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={styles.brandPill}>
            <Ionicons name="trophy" size={16} color={COLORS.textInverse} style={{ marginRight: 4 }} />
            <Text style={styles.brandPillText}>BatStateU Judge</Text>
          </View>
          <View style={styles.statusRow}>
            {!isConnected && (
              <View style={styles.offlineBadge}>
                <Ionicons name="wifi-outline" size={14} color={COLORS.textInverse} style={{ marginRight: 4 }} />
                <Text style={styles.offlineBadgeText}>Offline</Text>
              </View>
            )}
            <View style={styles.userPill}>
              <Ionicons name="person" size={14} color={COLORS.textInverse} style={{ marginRight: 4 }} />
              <Text style={styles.userPillText}>{user?.name ?? 'Judge'}</Text>
            </View>
          </View>
        </View>

        {/* Scan frame area */}
        <View style={styles.frameSection}>
          <Text style={styles.scanInstructions}>
            Point camera at the event QR code
          </Text>

          <Animated.View
            style={[styles.scanFrame, { transform: [{ scale: pulseAnim }] }]}
          >
            {/* Red corner markers */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {/* Animated red scan line */}
            <Animated.View
              style={[styles.scanLine, { transform: [{ translateY: scanLineY }] }]}
            />
          </Animated.View>

          {isLoading && (
            <View style={styles.statusChip}>
              <Ionicons name="hourglass-outline" size={16} color={COLORS.textPrimary} style={{ marginRight: 6 }} />
              <Text style={styles.statusChipText}>Loading event…</Text>
            </View>
          )}
          {!!scanError && (
            <View style={[styles.statusChip, styles.errorChip]}>
              <Ionicons name="alert-circle" size={16} color={COLORS.primaryDark} style={{ marginRight: 6 }} />
              <Text style={styles.errorChipText}>{scanError}</Text>
            </View>
          )}
        </View>

        {/* Bottom panel */}
        <View style={styles.bottomPanel}>
          {/* Cached event shortcut */}
          {event && !isLoading && (
            <TouchableOpacity
              style={styles.resumeCard}
              onPress={() => router.push(`/(app)/scoring/${event.id}`)}
              activeOpacity={0.85}
            >
              <View style={styles.resumeLeft}>
                <Ionicons name="document-text" size={16} color={COLORS.primary} style={{ marginBottom: 2 }} />
                <Text style={styles.resumeLabel}>Cached Event</Text>
                <Text style={styles.resumeName} numberOfLines={1}>{event.name}</Text>
                <Text style={styles.resumeHint}>Tap to continue scoring</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          )}

          {/* Rescan */}
          {scanned && !isLoading && (
            <TouchableOpacity
              style={styles.rescanBtn}
              onPress={() => { setScanned(false); setScanError(null); setCameraActive(true); }}
            >
              <Ionicons name="refresh" size={18} color={COLORS.textPrimary} style={{ marginRight: 6 }} />
              <Text style={styles.rescanBtnText}>Scan Again</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const FRAME_SIZE = 250;

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },

  // Top bar
  topBar: {
    paddingTop:        SPACING.xl,
    paddingHorizontal: SPACING.md,
    gap:               SPACING.sm,
  },
  brandPill: {
    alignSelf:         'center',
    backgroundColor:   COLORS.primary,
    borderRadius:      RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.xs + 2,
    flexDirection:     'row',
    alignItems:        'center',
  },
  brandPillText: {
    color:      COLORS.textInverse,
    fontWeight: FONT_WEIGHT.bold,
    fontSize:   FONT_SIZE.md,
  },
  statusRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            SPACING.sm,
  },
  userPill: {
    backgroundColor:   'rgba(0,0,0,0.55)',
    borderRadius:      RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.xs,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.20)',
    flexDirection:     'row',
    alignItems:        'center',
  },
  userPillText: {
    color:      '#fff',
    fontSize:   FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
  },
  offlineBadge: {
    backgroundColor:   'rgba(217,119,6,0.85)',
    borderRadius:      RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.xs,
    flexDirection:     'row',
    alignItems:        'center',
  },
  offlineBadgeText: {
    color:      '#fff',
    fontSize:   FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
  },

  // Scan frame
  frameSection: {
    alignItems: 'center',
    gap:        SPACING.md,
  },
  scanInstructions: {
    color:      'rgba(255,255,255,0.85)',
    fontSize:   FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    textAlign:  'center',
    paddingHorizontal: SPACING.xl,
  },
  scanFrame: {
    width:    FRAME_SIZE,
    height:   FRAME_SIZE,
    position: 'relative',
    overflow: 'hidden',
  },
  corner: {
    position:    'absolute',
    width:       28,
    height:      28,
    borderColor: COLORS.primary,
    borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0,  borderBottomWidth: 0, borderRightWidth: 0 },
  cornerTR: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth:  0 },
  cornerBL: { bottom: 0, left: 0,  borderTopWidth: 0, borderRightWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth:  0 },
  scanLine: {
    position:        'absolute',
    left:            0,
    right:           0,
    height:          2,
    backgroundColor: COLORS.primary,
    shadowColor:     COLORS.primary,
    shadowRadius:    6,
    shadowOpacity:   0.8,
  },
  statusChip: {
    backgroundColor:   'rgba(255,255,255,0.90)',
    borderRadius:      RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.sm,
    flexDirection:     'row',
    alignItems:        'center',
  },
  statusChipText: {
    color:      COLORS.textPrimary,
    fontSize:   FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
  },
  errorChip: {
    backgroundColor: COLORS.primaryPale,
    borderWidth:     1,
    borderColor:     COLORS.primary,
  },
  errorChipText: {
    color:      COLORS.primaryDark,
    fontSize:   FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
  },

  // Bottom panel — white card
  bottomPanel: {
    backgroundColor:     COLORS.surface,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    padding:             SPACING.lg,
    gap:                 SPACING.sm,
    borderTopWidth:      3,
    borderTopColor:      COLORS.primary,
    ...SHADOWS.md,
  },
  resumeCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.primarySubtle,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     COLORS.primaryPale,
    padding:         SPACING.md,
  },
  resumeLeft:  { flex: 1, gap: 2 },
  resumeLabel: {
    fontSize:   FONT_SIZE.xs,
    color:      COLORS.primary,
    fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: 0.8,
    marginTop:    2,
  },
  resumeName: {
    fontSize:   FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color:      COLORS.textPrimary,
  },
  resumeHint: {
    fontSize: FONT_SIZE.sm,
    color:    COLORS.textSecondary,
  },
  rescanBtn: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius:    RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     COLORS.borderStrong,
    flexDirection:     'row',
    justifyContent:    'center',
  },
  rescanBtnText: {
    color:      COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.semibold,
    fontSize:   FONT_SIZE.md,
  },
  logoutBtn: {
    alignItems:      'center',
    paddingVertical: SPACING.sm,
  },
  logoutBtnText: {
    color:    COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
  },

  // Permission screen
  permContainer: {
    flex:            1,
    backgroundColor: COLORS.background,
    alignItems:      'center',
    justifyContent:  'center',
    padding:         SPACING.xl,
    gap:             SPACING.lg,
  },
  permIconBox: {
    width:           80,
    height:          80,
    borderRadius:    RADIUS.full,
    backgroundColor: COLORS.primaryPale,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     2,
    borderColor:     COLORS.primaryLighter,
  },
  permTitle: {
    fontSize:   FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color:      COLORS.textPrimary,
    textAlign:  'center',
  },
  permBody: {
    fontSize:  FONT_SIZE.md,
    color:     COLORS.textSecondary,
    textAlign: 'center',
  },
  permBtn: {
    backgroundColor: COLORS.primary,
    borderRadius:    RADIUS.md,
    paddingVertical:   SPACING.md,
    paddingHorizontal: SPACING.xl,
    ...SHADOWS.lg,
  },
  permBtnText: {
    color:      COLORS.textInverse,
    fontWeight: FONT_WEIGHT.bold,
    fontSize:   FONT_SIZE.md,
  },
});
