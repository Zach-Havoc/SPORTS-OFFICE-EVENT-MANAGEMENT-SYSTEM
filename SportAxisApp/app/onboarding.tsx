import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING, TYPE } from '../constants/theme';
import { Button } from '../src/components/ui/Button';
import { Icon, type IconName } from '../src/components/ui/Icon';
import { storage, STORAGE_KEYS } from '../src/storage/async-storage';

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding — shown once, before the first login. Three slides that explain
// this app's actual value prop (scan → score → works offline), not a generic
// marketing carousel.
// ─────────────────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'scan',
    title: 'Scan any event in seconds',
    body: 'Point your camera at an event’s QR code to open its score sheet instantly — no searching through lists.',
  },
  {
    icon: 'target',
    title: 'Score with confidence',
    body: 'Enter scores by hand or capture a printed sheet with OCR. Live results publish to the scoreboard as you go.',
  },
  {
    icon: 'wifi-off',
    title: 'Works without a signal',
    body: 'Lost connection at the venue? Scores queue on your device and sync automatically the moment you’re back online.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const finish = async () => {
    await storage.set(STORAGE_KEYS.ONBOARDING_SEEN, '1');
    router.replace('/(auth)/login');
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (next !== index) setIndex(next);
  };

  const next = () => {
    if (index === SLIDES.length - 1) {
      finish();
      return;
    }
    scrollRef.current?.scrollTo({ x: (index + 1) * SCREEN_WIDTH, animated: true });
  };

  const isLast = index === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.skipRow}>
        <Pressable onPress={finish} hitSlop={8} accessibilityRole="button" accessibilityLabel="Skip onboarding">
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={styles.scroll}
      >
        {SLIDES.map((slide) => (
          <View key={slide.title} style={styles.slide}>
            <View style={styles.artwork}>
              <Icon name={slide.icon} size={56} color={COLORS.primary} strokeWidth={1.8} />
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((slide, i) => (
            <View key={slide.title} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Button
          label={isLast ? 'Get started' : 'Continue'}
          onPress={next}
          size="lg"
          fullWidth
          icon={<Icon name={isLast ? 'login' : 'chevron-right'} size={18} color={COLORS.textInverse} />}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  skipRow: { alignItems: 'flex-end', paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm },
  skipText: { ...TYPE.label, color: COLORS.textMuted },

  scroll: { flexGrow: 0 },
  slide: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xl,
  },
  artwork: {
    width: 140,
    height: 140,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xxl,
  },
  title: { ...TYPE.title, color: COLORS.textPrimary, textAlign: 'center', marginBottom: SPACING.sm },
  body: { ...TYPE.body, color: COLORS.textSecondary, textAlign: 'center' },

  footer: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl, paddingTop: SPACING.lg, gap: SPACING.xl },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.surfaceMuted },
  dotActive: { backgroundColor: COLORS.primary, width: 20 },
});
