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
        {/* ── Red header banner (mirrors web sidebar gradient) ──────── */}
        <View style={styles.banner}>
          {/* Trophy icon — matches web Lucide Trophy */}
          <View style={styles.logoBox}>
            <Ionicons name="trophy" size={36} color={COLORS.textInverse} />
          </View>
          <Text style={styles.appName}>BatStateU</Text>
          <Text style={styles.appSub}>Competition Scoring System</Text>
          <View style={styles.judgeChip}>
            <Ionicons name="scale" size={14} color={COLORS.textInverse} style={{ marginRight: 4 }} />
            <Text style={styles.judgeChipText}>Judge Portal</Text>
          </View>
        </View>

        {/* ── White form card ────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome Back</Text>
          <Text style={styles.cardSubtitle}>Sign in with your judge account</Text>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Email Address</Text>
            <View style={[styles.inputWrapper, fieldErrors.email ? styles.inputError : null]}>
              <Ionicons name="mail-outline" size={18} color={COLORS.textSecondary} style={{ marginRight: SPACING.sm }} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(v) => { setEmail(v); setFieldErrors((e) => ({ ...e, email: undefined })); }}
                placeholder="judge@batstateu.edu.ph"
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
            <Text style={styles.fieldLabel}>Password</Text>
            <View style={[styles.inputWrapper, fieldErrors.password ? styles.inputError : null]}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.textSecondary} style={{ marginRight: SPACING.sm }} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={(v) => { setPassword(v); setFieldErrors((e) => ({ ...e, password: undefined })); }}
                placeholder="••••••••"
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

          {/* Login Button — BatStateU red */}
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
          <Text style={styles.footerText}>
            Judge accounts are managed by the system administrator.
          </Text>
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

  // Red header banner
  banner: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
    alignItems:      'center',
    gap:             SPACING.xs,
  },
  logoBox: {
    width:           72,
    height:          72,
    borderRadius:    RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    SPACING.sm,
    borderWidth:     2,
    borderColor:     'rgba(255,255,255,0.40)',
  },
  appName: {
    fontSize:      FONT_SIZE.xxxl,
    fontWeight:    FONT_WEIGHT.extrabold,
    color:         COLORS.textInverse,
    letterSpacing: -0.5,
  },
  appSub: {
    fontSize:   FONT_SIZE.sm,
    color:      'rgba(255,255,255,0.80)',
    fontWeight: FONT_WEIGHT.medium,
  },
  judgeChip: {
    marginTop:         SPACING.sm,
    backgroundColor:   'rgba(255,255,255,0.15)',
    borderRadius:      RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.xs,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.30)',
    flexDirection:     'row',
    alignItems:        'center',
  },
  judgeChipText: {
    color:      COLORS.textInverse,
    fontSize:   FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
  },

  // White card
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
  cardSubtitle: {
    fontSize:  FONT_SIZE.md,
    color:     COLORS.textSecondary,
    marginTop: -SPACING.sm,
  },

  // Fields
  fieldGroup:  { gap: SPACING.xs },
  fieldLabel: {
    fontSize:      FONT_SIZE.sm,
    fontWeight:    FONT_WEIGHT.medium,
    color:         COLORS.textPrimary,
    letterSpacing: 0.2,
  },
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
    gap:        SPACING.xs,
  },
  footerText: {
    fontSize:  FONT_SIZE.sm,
    color:     COLORS.textMuted,
    textAlign: 'center',
  },
  footerCopy: {
    fontSize:  FONT_SIZE.xs,
    color:     COLORS.textMuted,
  },
});
