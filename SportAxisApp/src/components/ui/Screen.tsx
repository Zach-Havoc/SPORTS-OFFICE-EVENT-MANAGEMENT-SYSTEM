import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type RefreshControlProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPE } from '../../../constants/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Screen — the white page shell every screen sits in. Standard side padding,
// optional scroll + pull-to-refresh.
// ─────────────────────────────────────────────────────────────────────────────

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  edges?: readonly Edge[];
  padded?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

export function Screen({
  children,
  scroll = false,
  refreshControl,
  edges = ['top', 'left', 'right'],
  padded = true,
  style,
  contentStyle,
}: ScreenProps) {
  const pad = padded && { paddingHorizontal: SPACING.lg };

  return (
    <SafeAreaView style={[styles.safe, style]} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollBody, pad, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.body, pad, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

// ── ScreenHeader ────────────────────────────────────────────────────────────

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, right }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  body: { flex: 1 },
  scrollBody: { paddingBottom: SPACING.xxl, flexGrow: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  headerText: { flex: 1 },
  headerTitle: { ...TYPE.display, color: COLORS.textPrimary },
  headerSubtitle: { ...TYPE.bodySm, color: COLORS.textMuted, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
});
