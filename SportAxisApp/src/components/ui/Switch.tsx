import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '../../../constants/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Switch — one animated on/off track. RN ships a native <Switch>, but its look
// can't be themed to match this design system's tokens on both platforms.
// ─────────────────────────────────────────────────────────────────────────────

const TRACK_WIDTH = 46;
const TRACK_HEIGHT = 27;
const THUMB_SIZE = 23;
const PADDING = 2;

interface SwitchProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export function Switch({ value, onValueChange, disabled, accessibilityLabel }: SwitchProps) {
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, { toValue: value ? 1 : 0, duration: 160, useNativeDriver: false }).start();
  }, [value]);

  const trackColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.surfaceMuted, COLORS.primary],
  });
  const thumbX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [PADDING, TRACK_WIDTH - THUMB_SIZE - PADDING],
  });

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={disabled && styles.disabled}
    >
      <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View style={[styles.thumb, { transform: [{ translateX: thumbX }] }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  disabled: { opacity: 0.5 },
});
