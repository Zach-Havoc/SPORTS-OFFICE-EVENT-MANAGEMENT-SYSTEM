import { Image } from 'expo-image';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// TeamLogo — a college's uploaded logo, or a monogram disc when there is none
// (or it can't load, e.g. an APP_URL the phone can't reach). The disc colour
// comes from the name, so a college keeps the same colour everywhere — the
// same rule as the web's TeamLogo.
// ─────────────────────────────────────────────────────────────────────────────

export function TeamLogo({
  name,
  label,
  logoUrl,
  size = 44,
}: {
  name: string;
  /** Short text for the monogram (the college abbreviation). */
  label: string;
  logoUrl?: string | null;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);

  if (logoUrl && !broken) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="contain"
        onError={() => setBroken(true)}
        accessibilityIgnoresInvertColors
      />
    );
  }

  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360;
  const text = label.slice(0, 4);

  return (
    <View
      style={[
        styles.disc,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: `hsl(${hue}, 55%, 38%)` },
      ]}
    >
      <Text style={[styles.text, { fontSize: Math.max(9, Math.round(size / (text.length > 3 ? 3.6 : 2.8))) }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontWeight: '700' },
});
