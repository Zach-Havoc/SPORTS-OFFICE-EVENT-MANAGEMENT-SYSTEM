import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth.store';
import {
  COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOWS,
} from '../../constants/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Login Screen — BatStateU Red-and-White identity
// ─────────────────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const router    = useRouter();
  const login     = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const errors: typeof fieldErrors = {};
    if (!email.trim())                     errors.email    = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(email)) errors.email    = 'Enter a valid email.';
    if (!password)                         errors.password = 'Password is required.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(app)/scanner');
    } catch (error: any) {
      const msg = error.message ?? error.error ?? 'Invalid email or password.';
      Alert.alert('Login Failed', msg);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header banner ──────── */}
        <View style={styles.banner}>
          <Ionicons name="trophy" size={48} color={COLORS.textInverse} />
          <Text style={styles.appName}>BatStateU</Text>
          <Text style={styles.appSub}>Committee Portal</Text>
        </View>

        {/* ── Form card ────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <View style={[styles.inputWrapper, fieldErrors.email ? styles.inputError : null]}>
              <Ionicons name="mail-outline" size={18} color={COLORS.textSecondary} style={{ marginRight: SPACING.sm }} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(v) => { setEmail(v); setFieldErrors((e) => ({ ...e, email: undefined })); }}
                placeholder="Email"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                accessibilityLabel="Email address"
              />
            </View>
            {fieldErrors.email && <Text style={styles.errorText}>{fieldErrors.email}</Text>}
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <View style={[styles.inputWrapper, fieldErrors.password ? styles.inputError : null]}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.textSecondary} style={{ marginRight: SPACING.sm }} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={(v) => { setPassword(v); setFieldErrors((e) => ({ ...e, password: undefined })); }}
                placeholder="Password"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry={!showPass}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                accessibilityLabel="Password"
              />
              <TouchableOpacity
                onPress={() => setShowPass((p) => !p)}
                style={styles.eyeBtn}
                accessibilityLabel={showPass ? 'Hide password' : 'Show password'}
              >
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            {fieldErrors.password && <Text style={styles.errorText}>{fieldErrors.password}</Text>}
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
            accessibilityLabel="Sign in"
            accessibilityRole="button"
          >
            <Text style={styles.loginBtnText}>
              {isLoading ? 'Signing In…' : 'Sign In'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerCopy}>© 2026 Batangas State University</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flexGrow:       1,
    justifyContent: 'center',
  },

  // Header banner
  banner: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
    alignItems:      'center',
    gap:             SPACING.sm,
  },
  appName: {
    fontSize:      FONT_SIZE.xxl,
    fontWeight:    FONT_WEIGHT.bold,
    color:         COLORS.textInverse,
  },
  appSub: {
    fontSize:   FONT_SIZE.md,
    color:      'rgba(255,255,255,0.85)',
    fontWeight: FONT_WEIGHT.medium,
  },

  // Card
  card: {
    backgroundColor: COLORS.surface,
    margin:          SPACING.lg,
    borderRadius:    RADIUS.xl,
    padding:         SPACING.xl,
    gap:             SPACING.lg,
    ...SHADOWS.card,
    borderWidth:     1,
    borderColor:     COLORS.border,
  },
  cardTitle: {
    fontSize:   FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color:      COLORS.textPrimary,
  },

  // Fields
  fieldGroup:  { gap: SPACING.xs },
  inputWrapper: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius:    RADIUS.md,
    borderWidth:     1.5,
    borderColor:     COLORS.border,
    paddingHorizontal: SPACING.md,
    minHeight:       52,
  },
  inputError: { borderColor: COLORS.error },
  input: {
    flex:     1,
    fontSize: FONT_SIZE.md,
    color:    COLORS.textPrimary,
    paddingVertical: SPACING.md,
  },
  eyeBtn: { padding: SPACING.xs },
  errorText: {
    fontSize:   FONT_SIZE.sm,
    color:      COLORS.error,
    fontWeight: FONT_WEIGHT.medium,
  },

  // Login button
  loginBtn: {
    backgroundColor: COLORS.primary,
    borderRadius:    RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems:      'center',
    marginTop:       SPACING.xs,
    ...SHADOWS.lg,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: {
    fontSize:   FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color:      COLORS.textInverse,
    letterSpacing: 0.3,
  },

  // Footer
  footer: {
    alignItems: 'center',
    padding:    SPACING.lg,
  },
  footerCopy: {
    fontSize:  FONT_SIZE.xs,
    color:     COLORS.textMuted,
  },
});
