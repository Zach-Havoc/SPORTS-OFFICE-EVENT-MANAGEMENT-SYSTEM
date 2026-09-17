import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/auth.store';
import { COLORS, RADIUS, SPACING, TYPE } from '../../constants/theme';
import { Icon } from '../../src/components/ui/Icon';
import { Button } from '../../src/components/ui/Button';

// ─────────────────────────────────────────────────────────────────────────────
// Login — white page, BatStateU-red lockup, inline errors.
// ─────────────────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [focus, setFocus] = useState<'email' | 'password' | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const validate = () => {
    const errors: typeof fieldErrors = {};
    if (!email.trim()) errors.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(email)) errors.email = 'Enter a valid email.';
    if (!password) errors.password = 'Password is required.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async () => {
    setFormError(null);
    if (!validate()) return;
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(app)/scanner');
    } catch (error: any) {
      const code = error?.code;
      setFormError(
        code === 'NETWORK_ERROR' || code === 'TIMEOUT'
          ? "Can't reach the server. Check your connection or the API address in .env."
          : code === 'RATE_LIMITED'
            ? error.message
            : error?.message ?? error?.error ?? 'Invalid email or password.',
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Lockup */}
          <View style={styles.lockup}>
            <View style={styles.crest}>
              <Icon name="trophy" size={34} color={COLORS.textInverse} strokeWidth={2.2} />
            </View>
            <Text style={styles.appName}>SportAxis</Text>
            <Text style={styles.appSub}>Committee Portal</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {formError ? (
              <View style={styles.formError}>
                <Icon name="alert-circle" size={16} color={COLORS.destructive} strokeWidth={2.2} />
                <Text style={styles.formErrorText}>{formError}</Text>
              </View>
            ) : null}

            <Field
              label="Email"
              icon="mail"
              value={email}
              onChangeText={(v) => { setEmail(v); setFieldErrors((e) => ({ ...e, email: undefined })); }}
              placeholder="you@g.batstate-u.edu.ph"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              focused={focus === 'email'}
              onFocus={() => setFocus('email')}
              onBlur={() => setFocus(null)}
              error={fieldErrors.email}
            />

            <Field
              label="Password"
              icon="lock"
              value={password}
              onChangeText={(v) => { setPassword(v); setFieldErrors((e) => ({ ...e, password: undefined })); }}
              placeholder="Your password"
              secureTextEntry={!showPass}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              focused={focus === 'password'}
              onFocus={() => setFocus('password')}
              onBlur={() => setFocus(null)}
              error={fieldErrors.password}
              trailing={
                <Pressable onPress={() => setShowPass((p) => !p)} hitSlop={8} style={styles.eye}>
                  <Icon name={showPass ? 'eye-off' : 'eye'} size={18} color={COLORS.textMuted} />
                </Pressable>
              }
            />

            <Button
              label={isLoading ? 'Signing in…' : 'Sign in'}
              onPress={handleLogin}
              loading={isLoading}
              size="lg"
              fullWidth
              icon={<Icon name="login" size={18} color={COLORS.textInverse} />}
              style={styles.submit}
            />
          </View>

          <Text style={styles.copy}>© 2026 Batangas State University</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Field ───────────────────────────────────────────────────────────────────

interface FieldProps extends React.ComponentProps<typeof TextInput> {
  label: string;
  icon: 'mail' | 'lock';
  focused: boolean;
  error?: string;
  trailing?: React.ReactNode;
}

function Field({ label, icon, focused, error, trailing, ...input }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          focused && styles.inputWrapFocused,
          error && styles.inputWrapError,
        ]}
      >
        <Icon name={icon} size={18} color={focused ? COLORS.primary : COLORS.textMuted} />
        <TextInput
          style={styles.input}
          placeholderTextColor={COLORS.textMuted}
          {...input}
        />
        {trailing}
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: SPACING.xl, paddingVertical: SPACING.xxl },

  lockup: { alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.xxl },
  crest: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.xxl,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  appName: { ...TYPE.display, color: COLORS.textPrimary },
  appSub: { ...TYPE.label, color: COLORS.textMuted, textAlign: 'center' },

  form: { gap: SPACING.lg },

  formError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.errorLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  formErrorText: { ...TYPE.bodySm, color: COLORS.destructive, flex: 1 },

  field: { gap: 6 },
  fieldLabel: { ...TYPE.label, color: COLORS.textSecondary },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: SPACING.md,
    minHeight: 54,
  },
  inputWrapFocused: { borderColor: COLORS.primary },
  inputWrapError: { borderColor: COLORS.destructive },
  input: { flex: 1, ...TYPE.body, color: COLORS.textPrimary, paddingVertical: SPACING.md },
  eye: { padding: 2 },
  fieldError: { ...TYPE.bodySm, color: COLORS.destructive },

  submit: { marginTop: SPACING.xs },
  copy: { ...TYPE.caption, textTransform: 'none', color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.xxl },
});
