import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPE } from '../../../constants/theme';
import { Icon, type IconName } from './Icon';

// ─────────────────────────────────────────────────────────────────────────────
// Toast — a brief, non-blocking confirmation ("Score saved", "Signed out").
// For anything the judge must actively confirm or that can go wrong in a way
// they need to act on (a destructive action, a permission prompt), keep using
// Alert.alert — that's still the right tool when a blocking decision is
// needed. This is only for "it worked, moving on" moments.
//
// Mount <ToastHost /> once, at the root layout, above everything else. Call
// `toast.success(...)` / `toast.error(...)` / `toast.show(...)` from
// anywhere — no provider/context wiring needed at each call site.
// ─────────────────────────────────────────────────────────────────────────────

type ToastKind = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  text: string;
  kind: ToastKind;
}

const KIND_ICON: Record<ToastKind, IconName> = {
  success: 'check-circle',
  error: 'alert-circle',
  info: 'info',
};
const KIND_COLOR: Record<ToastKind, string> = {
  success: COLORS.success,
  error: COLORS.destructive,
  info: COLORS.info,
};

let showFn: ((text: string, kind: ToastKind) => void) | null = null;

export const toast = {
  show: (text: string) => showFn?.(text, 'info'),
  success: (text: string) => showFn?.(text, 'success'),
  error: (text: string) => showFn?.(text, 'error'),
};

let nextId = 1;
const DURATION_MS = 2600;

export function ToastHost() {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    showFn = (text, kind) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setMessage({ id: nextId++, text, kind });
    };
    return () => { showFn = null; };
  }, []);

  useEffect(() => {
    if (!message) return;
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    hideTimer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setMessage(null));
    }, DURATION_MS);
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [message?.id]);

  if (!message) return null;

  return (
    <SafeAreaView pointerEvents="none" style={styles.safe}>
      <Animated.View style={[styles.toast, { opacity }]}>
        <Icon name={KIND_ICON[message.kind]} size={17} color={KIND_COLOR[message.kind]} strokeWidth={2.2} />
        <Text style={styles.text} numberOfLines={2}>{message.text}</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    maxWidth: '92%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.hairline,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    ...SHADOWS.lg,
  },
  text: { ...TYPE.bodySm, color: COLORS.textPrimary, flexShrink: 1 },
});
