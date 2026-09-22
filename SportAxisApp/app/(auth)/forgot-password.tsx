import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING, TYPE } from '../../constants/theme';
import { authService } from '../../src/services/auth.service';
import { Button } from '../../src/components/ui/Button';
import { Icon } from '../../src/components/ui/Icon';
import { Input } from '../../src/components/ui/Input';

// ─────────────────────────────────────────────────────────────────────────────
// Forgot password — email only. The backend never reveals whether an account
// exists; it always returns the same generic message and, if it does, mails a
// temporary password. The UI mirrors that: one confirmation state, no branching.
// ─────────────────────────────────────────────────────────────────────────────

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError('Enter a valid email.');
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {sent ? (
            <View style={styles.confirm}>
              <View style={styles.confirmIcon}>
                <Icon name="mail" size={30} color={COLORS.success} strokeWidth={2} />
              </View>
              <Text style={styles.title}>Check your email</Text>
              <Text style={styles.body}>
                If an account exists for {email.trim()}, we&apos;ve sent a temporary password. Sign in with it, then
                change your password from Profile.
              </Text>
              <Button label="Back to sign in" onPress={() => router.replace('/(auth)/login')} size="lg" fullWidth style={styles.confirmButton} />
            </View>
          ) : (
            <>
              <Text style={styles.title}>Reset your password</Text>
              <Text style={styles.body}>Enter the email on your account and we&apos;ll send a temporary password.</Text>

              {error ? (
                <View style={styles.formError}>
                  <Icon name="alert-circle" size={16} color={COLORS.destructive} strokeWidth={2.2} />
                  <Text style={styles.formErrorText}>{error}</Text>
                </View>
              ) : null}

              <Input
                label="Email"
                icon="mail"
                value={email}
                onChangeText={setEmail}
                placeholder="you@g.batstate-u.edu.ph"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />

              <Button
                label={loading ? 'Sending…' : 'Send reset email'}
                onPress={handleSubmit}
                loading={loading}
                size="lg"
                fullWidth
                style={styles.submit}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -SPACING.sm },

  scroll: { flexGrow: 1, paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, gap: SPACING.lg },
  title: { ...TYPE.title, color: COLORS.textPrimary },
  body: { ...TYPE.body, color: COLORS.textSecondary },

  formError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.errorLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  formErrorText: { ...TYPE.bodySm, color: COLORS.destructive, flex: 1 },

  submit: { marginTop: SPACING.xs },

  confirm: { alignItems: 'center', paddingTop: SPACING.xxl, gap: SPACING.sm },
  confirmIcon: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  confirmButton: { marginTop: SPACING.xl, alignSelf: 'stretch' },
});
