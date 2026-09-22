import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPE } from '../../constants/theme';
import { PrivacyNoticeContent } from '../../src/components/PrivacyNoticeContent';
import { Icon } from '../../src/components/ui/Icon';

// ─────────────────────────────────────────────────────────────────────────────
// Data Privacy Notice, reachable post-login from Settings. Same shared
// content as app/(auth)/privacy-notice.tsx (shown at signup) — see that file
// for the version-sync note with the backend and web app.
// ─────────────────────────────────────────────────────────────────────────────

export default function PrivacyNoticeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Data Privacy Notice</Text>
        <View style={styles.back} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <PrivacyNoticeContent />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...TYPE.heading, color: COLORS.textPrimary },

  scroll: { padding: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.xxl },
});
