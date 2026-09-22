import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING, TYPE } from '../../../constants/theme';
import { authService } from '../../../src/services/auth.service';
import { useAuthStore } from '../../../src/store/auth.store';
import { Button } from '../../../src/components/ui/Button';
import { Icon } from '../../../src/components/ui/Icon';
import { Input } from '../../../src/components/ui/Input';
import { toast } from '../../../src/components/ui/Toast';

// ─────────────────────────────────────────────────────────────────────────────
// Edit profile — PUT /api/account/profile. Fields match exactly what the
// backend accepts (name, yearLevel, course, phone, emergencyContact); the
// emergency contact is kept to a name + phone pair, the common case.
// ─────────────────────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const isAthlete = user?.role === 'athlete';

  const [name, setName] = useState(user?.name ?? '');
  const [yearLevel, setYearLevel] = useState(user?.yearLevel ?? '');
  const [course, setCourse] = useState(user?.course ?? '');
  const [phone, setPhone] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    try {
      const updated = await authService.updateProfile({
        name: name.trim(),
        ...(isAthlete ? { yearLevel: yearLevel.trim() || null, course: course.trim() || null } : {}),
        phone: phone.trim() || null,
        ...(emergencyName.trim() || emergencyPhone.trim()
          ? { emergencyContact: { name: emergencyName.trim(), phone: emergencyPhone.trim() } }
          : {}),
      });
      setUser(updated);
      toast.success('Profile updated');
      router.back();
    } catch (err: any) {
      setError(err?.message ?? 'Could not save your changes.');
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
        <Text style={styles.headerTitle}>Edit profile</Text>
        <View style={styles.back} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {error ? (
            <View style={styles.formError}>
              <Icon name="alert-circle" size={16} color={COLORS.destructive} strokeWidth={2.2} />
              <Text style={styles.formErrorText}>{error}</Text>
            </View>
          ) : null}

          <Input label="Full name" icon="users" value={name} onChangeText={setName} autoCapitalize="words" />
          <Input label="Phone number" icon="phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

          {isAthlete && (
            <>
              <Input label="Year level" icon="calendar" value={yearLevel} onChangeText={setYearLevel} placeholder="e.g. 3rd Year" />
              <Input label="Program" icon="verified" value={course} onChangeText={setCourse} placeholder="e.g. BS Computer Science" />
            </>
          )}

          <Text style={styles.sectionLabel}>Emergency contact (optional)</Text>
          <Input label="Contact name" icon="users" value={emergencyName} onChangeText={setEmergencyName} autoCapitalize="words" />
          <Input label="Contact phone" icon="phone" value={emergencyPhone} onChangeText={setEmergencyPhone} keyboardType="phone-pad" />

          <Button label={saving ? 'Saving…' : 'Save changes'} onPress={handleSave} loading={saving} size="lg" fullWidth style={styles.submit} />
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
  sectionLabel: { ...TYPE.label, color: COLORS.textMuted, marginTop: SPACING.sm },

  formError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.errorLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  formErrorText: { ...TYPE.bodySm, color: COLORS.destructive, flex: 1 },

  submit: { marginTop: SPACING.md },
});
