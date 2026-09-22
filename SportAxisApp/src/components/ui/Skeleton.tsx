import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../../../constants/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton — pulsing placeholder blocks for list loading states (Home,
// Notifications), used instead of a bare spinner so the eventual layout shape
// is visible while data loads.
// ─────────────────────────────────────────────────────────────────────────────

function Bone({ style }: { style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return <Animated.View style={[styles.bone, style, { opacity }]} />;
}

export function SkeletonRow() {
  return (
    <View style={styles.row}>
      <Bone style={styles.avatar} />
      <View style={styles.lines}>
        <Bone style={styles.lineWide} />
        <Bone style={styles.lineNarrow} />
      </View>
    </View>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bone: { backgroundColor: COLORS.surfaceMuted, borderRadius: RADIUS.sm },
  list: { gap: SPACING.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  avatar: { width: 40, height: 40, borderRadius: RADIUS.lg },
  lines: { flex: 1, gap: 8 },
  lineWide: { height: 12, width: '70%' },
  lineNarrow: { height: 10, width: '40%' },
});
