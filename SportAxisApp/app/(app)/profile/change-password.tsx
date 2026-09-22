import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPE } from '../../../constants/theme';
import { authService } from '../../../src/services/auth.service';
import { Button } from '../../../src/components/ui/Button';
import { Icon } from '../../../src/components/ui/Icon';
import { Input } from '../../../src/components/ui/Input';
import { toast } from '../../../src/components/ui/Toast';

// ─────────────────────────────────────────────────────────────────────────────
// Change password — PUT /api/account/password. Requires the current password;
// the backend's "Current password is incorrect" error is shown inline on the
// current-password field, not as a generic toast.
// ─────────────────────────────────────────────────────────────────────────────

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const next_: typeof errors = {};
    if (!current) next_.current = 'Enter your current password.';
    if (!next || next.length < 8) next_.next = 'At least 8 characters.';
    if (confirm !== next) next_.confirm = 'Passwords don’t match.';
    setErrors(next_);
    if (Object.keys(next_).length > 0) return;

    setSaving(true);
    try {
      await authService.updatePassword(current, next);
      toast.success('Password updated');
      router.back();
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes('current password')) {
        setErrors({ current: err.message });
      } else {
        setErrors({ current: err?.message ?? 'Could not update your password.' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Change password</Text>
        <View style={styles.back} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Input
            label="Current password"
            icon="lock"
            value={current}
            onChangeText={(v) => { setCurrent(v); setErrors((e) => ({ ...e, current: undefined })); }}
            secureTextEntry={!showCurrent}
            error={errors.current}
            trailing={
              <Pressable onPress={() => setShowCurrent((p) => !p)} hitSlop={8}>
                <Icon name={showCurrent ? 'eye-off' : 'eye'} size={18} color={COLORS.textMuted} />
              </Pressable>
            }
          />
          <Input
            label="New password"
            icon="lock"
            value={next}
            onChangeText={(v) => { setNext(v); setErrors((e) => ({ ...e, next: undefined })); }}
            placeholder="At least 8 characters"
            secureTextEntry={!showNext}
            error={errors.next}
            trailing={
              <Pressable onPress={() => setShowNext((p) => !p)} hitSlop={8}>
                <Icon name={showNext ? 'eye-off' : 'eye'} size={18} color={COLORS.textMuted} />
              </Pressable>
            }
          />
          <Input
            label="Confirm new password"
            icon="lock"
            value={confirm}
            onChangeText={(v) => { setConfirm(v); setErrors((e) => ({ ...e, confirm: undefined })); }}
            secureTextEntry={!showNext}
            error={errors.confirm}
          />

          <Button label={saving ? 'Updating…' : 'Update password'} onPress={handleSave} loading={saving} size="lg" fullWidth style={styles.submit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...TYPE.heading, color: COLORS.textPrimary },

  scroll: { padding: SPACING.xl, gap: SPACING.lg },
  submit: { marginTop: SPACING.md },
});
