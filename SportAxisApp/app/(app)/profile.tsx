import { useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPE } from '../../constants/theme';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Icon } from '../../src/components/ui/Icon';
import { ListItem } from '../../src/components/ui/ListItem';
import { toast } from '../../src/components/ui/Toast';
import { useAuthStore } from '../../src/store/auth.store';

// ─────────────────────────────────────────────────────────────────────────────
// Profile — who's signed in, and the one clearly-discoverable place to sign
// out. Sign-out used to live inside the Scanner screen, which nobody would
// think to check for it; account actions belong on an account screen.
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  judge: 'Committee / Judge',
  admin: 'Administrator',
  coach: 'Coach',
  athlete: 'Athlete',
};

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isAthlete = user?.role === 'athlete';

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

  const initial = user?.name?.trim()?.[0]?.toUpperCase() ?? '?';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.name}>{user?.name ?? 'Committee member'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {user?.role ? (
            <View style={styles.roleBadge}>
              <Icon name="verified" size={13} color={COLORS.primary} strokeWidth={2.2} />
              <Text style={styles.roleText}>{ROLE_LABEL[user.role] ?? user.role}</Text>
            </View>
          ) : null}
        </View>

        {isAthlete && (user?.department || user?.course || user?.yearLevel || user?.srCode) ? (
          <Card variant="default" style={styles.aboutCard}>
            {user?.srCode ? <InfoRow label="SR Code" value={user.srCode} /> : null}
            {user?.department ? <InfoRow label="College" value={user.department} /> : null}
            {user?.course ? <InfoRow label="Program" value={user.course} /> : null}
            {user?.yearLevel ? <InfoRow label="Year level" value={user.yearLevel} /> : null}
          </Card>
        ) : null}

        <Card variant="default" noPadding style={styles.menuCard}>
          <ListItem
            title="Edit profile"
            icon="pencil"
            chevron
            onPress={() => router.push('/(app)/profile/edit')}
            style={styles.menuRow}
          />
          <View style={styles.menuDivider} />
          <ListItem
            title="Change password"
            icon="lock"
            chevron
            onPress={() => router.push('/(app)/profile/change-password')}
            style={styles.menuRow}
          />
          <View style={styles.menuDivider} />
          <ListItem
            title="Settings"
            icon="settings"
            chevron
            onPress={() => router.push('/(app)/settings')}
            style={styles.menuRow}
          />
        </Card>

        <Button
          label="Sign out"
          onPress={handleSignOut}
          variant="danger"
          size="lg"
          fullWidth
          icon={<Icon name="logout" size={18} color={COLORS.textInverse} />}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.aboutRow}>
      <Text style={styles.aboutLabel}>{label}</Text>
      <Text style={styles.aboutValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.xl },

  identity: { alignItems: 'center', gap: SPACING.xs, paddingTop: SPACING.xl },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  avatarText: { ...TYPE.title, color: COLORS.primary },
  name: { ...TYPE.title, color: COLORS.textPrimary, textAlign: 'center' },
  email: { ...TYPE.bodySm, color: COLORS.textSecondary },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primaryTint,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    marginTop: SPACING.xs,
  },
  roleText: { ...TYPE.label, color: COLORS.primary },

  aboutCard: { gap: SPACING.sm },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.xs, gap: SPACING.md },
  aboutLabel: { ...TYPE.bodySm, color: COLORS.textSecondary },
  aboutValue: { ...TYPE.bodySm, color: COLORS.textPrimary, fontWeight: '600', flexShrink: 1, textAlign: 'right' },

  menuCard: { overflow: 'hidden' },
  menuRow: { paddingHorizontal: SPACING.md },
  menuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.hairline, marginLeft: SPACING.md + 40 + SPACING.md },
});
