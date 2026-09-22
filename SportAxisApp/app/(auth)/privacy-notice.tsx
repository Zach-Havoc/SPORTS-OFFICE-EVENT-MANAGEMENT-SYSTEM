import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPE } from '../../constants/theme';
import { PrivacyNoticeContent } from '../../src/components/PrivacyNoticeContent';
import { Icon } from '../../src/components/ui/Icon';

// ─────────────────────────────────────────────────────────────────────────────
// Data Privacy Notice — required disclosure under the Data Privacy Act of
// 2012 (RA 10173). Athlete medical clearance documents are collected as a
// mandatory eligibility requirement (fitness to play), not on an opt-in
// basis, so this is a disclosure the account holder acknowledges, not a
// consent they can decline while still using the app.
//
// The notice text lives in one place (src/components/PrivacyNoticeContent.tsx)
// shared with app/(app)/privacy-notice.tsx (reachable later from Settings).
// PRIVACY_NOTICE_VERSION there must match AuthController::PRIVACY_NOTICE_VERSION
// (SportAxisWeb/backend/app/Http/Controllers/Api/AuthController.php) and the
// web app's equivalent page — bump all three together when the text changes.
//
// This is a first draft covering the standard disclosure elements RA 10173
// requires — it has not been reviewed by BatStateU's legal/data-protection
// office and should be before this ships to real users.
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
