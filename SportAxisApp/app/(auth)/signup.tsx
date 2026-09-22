import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING, TYPE } from '../../constants/theme';
import { useAuthStore } from '../../src/store/auth.store';
import type { UserRole } from '../../src/types';
import { Button } from '../../src/components/ui/Button';
import { Chip } from '../../src/components/ui/Chip';
import { Icon } from '../../src/components/ui/Icon';
import { Input } from '../../src/components/ui/Input';

// ─────────────────────────────────────────────────────────────────────────────
// Sign up — registration-code verified account creation. Matches the backend's
// AuthController::signup exactly: role picker, SR code only for athletes, and
// its four distinct error messages surfaced inline rather than as one toast.
// ─────────────────────────────────────────────────────────────────────────────

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'judge', label: 'Judge' },
  { value: 'coach', label: 'Coach' },
  { value: 'athlete', label: 'Athlete' },
  { value: 'admin', label: 'Admin' },
];

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  registrationCode?: string;
  srCode?: string;
  privacyNoticeAccepted?: string;
}

export default function SignupScreen() {
  const router = useRouter();
  const signup = useAuthStore((s) => s.signup);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [role, setRole] = useState<UserRole>('judge');
  const [registrationCode, setRegistrationCode] = useState('');
  const [srCode, setSrCode] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const clearError = (key: keyof FieldErrors) => setFieldErrors((e) => ({ ...e, [key]: undefined }));

  const validate = () => {
    const errors: FieldErrors = {};
    if (!name.trim()) errors.name = 'Name is required.';
    if (!email.trim()) errors.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(email)) errors.email = 'Enter a valid email.';
    if (!password || password.length < 8) errors.password = 'At least 8 characters.';
    if (!registrationCode.trim()) errors.registrationCode = 'Registration code is required.';
    if (role === 'athlete' && !srCode.trim()) errors.srCode = 'SR Code is required for athletes.';
    if (!privacyAccepted) errors.privacyNoticeAccepted = 'You must acknowledge the Data Privacy Notice to continue.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignup = async () => {
    setFormError(null);
    if (!validate()) return;
    try {
      await signup({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        registrationCode: registrationCode.trim(),
        ...(role === 'athlete' ? { srCode: srCode.trim() } : {}),
        privacyNoticeAccepted: privacyAccepted,
      });
      router.replace('/(app)/events');
    } catch (error: any) {
      const code = error?.code;
      setFormError(
        code === 'NETWORK_ERROR' || code === 'TIMEOUT'
          ? "Can't reach the server. Check your connection."
          : error?.message ?? 'Could not create your account. Try again.',
      );
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
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>You&apos;ll need a registration code from your Sports Office.</Text>

          {formError ? (
            <View style={styles.formError}>
              <Icon name="alert-circle" size={16} color={COLORS.destructive} strokeWidth={2.2} />
              <Text style={styles.formErrorText}>{formError}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>I am a</Text>
              <View style={styles.roleRow}>
                {ROLES.map((r) => (
                  <Chip key={r.value} label={r.label} selected={role === r.value} onPress={() => setRole(r.value)} />
                ))}
              </View>
            </View>

            <Input
              label="Full name"
              icon="users"
              value={name}
              onChangeText={(v) => { setName(v); clearError('name'); }}
              placeholder="Juan Dela Cruz"
              autoCapitalize="words"
              error={fieldErrors.name}
            />

            <Input
              label="Email"
              icon="mail"
              value={email}
              onChangeText={(v) => { setEmail(v); clearError('email'); }}
              placeholder="you@g.batstate-u.edu.ph"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={fieldErrors.email}
            />

            <Input
              label="Password"
              icon="lock"
              value={password}
              onChangeText={(v) => { setPassword(v); clearError('password'); }}
              placeholder="At least 8 characters"
              secureTextEntry={!showPass}
              error={fieldErrors.password}
              trailing={
                <Pressable onPress={() => setShowPass((p) => !p)} hitSlop={8} accessibilityRole="button" accessibilityLabel={showPass ? 'Hide password' : 'Show password'}>
                  <Icon name={showPass ? 'eye-off' : 'eye'} size={18} color={COLORS.textMuted} />
                </Pressable>
              }
            />

            <Input
              label="Registration code"
              icon="verified"
              value={registrationCode}
              onChangeText={(v) => { setRegistrationCode(v); clearError('registrationCode'); }}
              placeholder="Given by your Sports Office"
              autoCapitalize="characters"
              autoCorrect={false}
              error={fieldErrors.registrationCode}
            />

            {role === 'athlete' && (
              <Input
                label="SR Code"
                icon="verified"
                value={srCode}
                onChangeText={(v) => { setSrCode(v); clearError('srCode'); }}
                placeholder="e.g. 21-00000"
                autoCapitalize="characters"
                autoCorrect={false}
                error={fieldErrors.srCode}
              />
            )}

            <View style={styles.field}>
              <Pressable
                onPress={() => { setPrivacyAccepted((p) => !p); clearError('privacyNoticeAccepted'); }}
                style={styles.consentRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: privacyAccepted }}
              >
                <View style={[styles.checkbox, privacyAccepted && styles.checkboxOn]}>
                  {privacyAccepted && <Icon name="check" size={14} color={COLORS.textInverse} strokeWidth={3} />}
                </View>
                <Text style={styles.consentText}>
                  I have read and understand the{' '}
                  <Text style={styles.consentLink} onPress={() => router.push('/(auth)/privacy-notice')}>
                    Data Privacy Notice
                  </Text>
                  , including that medical clearance is required for athletes.
                </Text>
              </Pressable>
              {fieldErrors.privacyNoticeAccepted && (
                <Text style={styles.fieldError}>{fieldErrors.privacyNoticeAccepted}</Text>
              )}
            </View>

            <Button
              label={isLoading ? 'Creating account…' : 'Create account'}
              onPress={handleSignup}
              loading={isLoading}
              size="lg"
              fullWidth
              style={styles.submit}
            />
          </View>
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

  scroll: { flexGrow: 1, paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.xxl },
  title: { ...TYPE.title, color: COLORS.textPrimary, marginBottom: 4 },
  subtitle: { ...TYPE.body, color: COLORS.textSecondary, marginBottom: SPACING.lg },

  formError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.errorLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  formErrorText: { ...TYPE.bodySm, color: COLORS.destructive, flex: 1 },

  form: { gap: SPACING.lg },
  field: { gap: SPACING.sm },
  label: { ...TYPE.label, color: COLORS.textSecondary },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },

  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  consentText: { ...TYPE.bodySm, color: COLORS.textSecondary, flex: 1, lineHeight: 19 },
  consentLink: { color: COLORS.primary, fontWeight: '700' },
  fieldError: { ...TYPE.bodySm, color: COLORS.destructive, marginTop: SPACING.xs },

  submit: { marginTop: SPACING.xs },
});
