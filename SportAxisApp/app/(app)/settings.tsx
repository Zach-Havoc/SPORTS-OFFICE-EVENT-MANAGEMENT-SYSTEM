import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPE } from '../../constants/theme';
import { Card } from '../../src/components/ui/Card';
import { useAuthStore } from '../../src/store/auth.store';
import { Icon } from '../../src/components/ui/Icon';
import { ListItem } from '../../src/components/ui/ListItem';
import { Switch } from '../../src/components/ui/Switch';
import { toast } from '../../src/components/ui/Toast';

// ─────────────────────────────────────────────────────────────────────────────
// Settings — kept intentionally short: only sections backed by something real.
// No language/appearance/push-token toggles that would do nothing.
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  judge: 'Committee / Judge',
  admin: 'Administrator',
  coach: 'Coach',
  athlete: 'Athlete',
};

export default function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [markReadOnOpen, setMarkReadOnOpen] = useState(true);

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Sign out of SportsAxis?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          toast.show('Signed out');
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Settings</Text>

        <Section title="Account">
          <Card variant="default" noPadding>
            <ListItem title={user?.name ?? 'Account'} subtitle={user?.email} icon="users" style={styles.row} />
            <Divider />
            <ListItem title="Role" subtitle={user ? ROLE_LABEL[user.role] ?? user.role : undefined} icon="verified" style={styles.row} />
            <Divider />
            <ListItem title="Change password" icon="lock" chevron onPress={() => router.push('/(app)/profile/change-password')} style={styles.row} />
          </Card>
        </Section>

        <Section title="Notifications">
          <Card variant="default" noPadding>
            <ListItem title="Notification center" icon="bell" chevron onPress={() => router.push('/(app)/notifications')} style={styles.row} />
            <Divider />
            <ListItem
              title="Mark as read on open"
              subtitle="Notifications are marked read the moment you tap them"
              icon="sliders"
              right={<Switch value={markReadOnOpen} onValueChange={setMarkReadOnOpen} accessibilityLabel="Mark as read on open" />}
              style={styles.row}
            />
          </Card>
        </Section>

        <Section title="Privacy">
          <Card variant="default" noPadding>
            <ListItem
              title="Data Privacy Notice"
              subtitle="What we collect and why"
              icon="info"
              chevron
              onPress={() => router.push('/(app)/privacy-notice')}
              style={styles.row}
            />
          </Card>
        </Section>

        <Section title="Help & Support">
          <Card variant="default" noPadding>
            <ListItem
              title="Contact the Sports Office"
              icon="mail"
              chevron
              onPress={() => Linking.openURL('mailto:sportsoffice@g.batstate-u.edu.ph')}
              style={styles.row}
            />
          </Card>
        </Section>

        <Section title="About">
          <Card variant="default" noPadding>
            <ListItem title="Version" subtitle={Constants.expoConfig?.version ?? '1.0.0'} icon="info" style={styles.row} />
          </Card>
        </Section>

        <Text style={styles.signOut} onPress={handleSignOut}>Sign out</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { padding: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.xl },
  pageTitle: { ...TYPE.display, color: COLORS.textPrimary },

  section: { gap: SPACING.sm },
  sectionTitle: { ...TYPE.label, color: COLORS.textMuted, textTransform: 'uppercase', marginLeft: SPACING.xs },
  row: { paddingHorizontal: SPACING.md },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.hairline, marginLeft: SPACING.md + 40 + SPACING.md },

  signOut: { ...TYPE.subhead, color: COLORS.destructive, textAlign: 'center', paddingVertical: SPACING.md },
});
