import React from 'react';
import { Platform, StyleSheet, Text, TextInput } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Global text defaults — applied once, before the first render.
//   1. Inter is the app font. RN doesn't synthesize weights for custom fonts,
//      so a style's `fontWeight` is translated to the matching Inter *face*.
//   2. Every explicit `fontSize` is multiplied by FONT_SCALE (low-vision bump).
// Patches <Text>/<TextInput>.render. Fully defensive: any failure falls back to
// the untouched element so a stray text node can never crash the app.
// ─────────────────────────────────────────────────────────────────────────────

export const FONT_SCALE = 1.12;

const FACE: Record<string, string> = {
  '100': 'Inter_400Regular',
  '200': 'Inter_400Regular',
  '300': 'Inter_400Regular',
  '400': 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
  '900': 'Inter_800ExtraBold',
  normal: 'Inter_400Regular',
  bold: 'Inter_700Bold',
};

type Patchable = { render?: (...args: any[]) => unknown; __textPatched?: boolean };

/** Style overrides for one text node, or null if nothing needs changing. */
function overrides(style: unknown): Record<string, unknown> | null {
  const flat = StyleSheet.flatten(style as any) as
    | { fontSize?: unknown; fontWeight?: unknown; fontFamily?: unknown }
    | undefined;

  const out: Record<string, unknown> = {};

  if (flat && typeof flat.fontSize === 'number') {
    out.fontSize = Math.round(flat.fontSize * FONT_SCALE);
  }

  if (!flat?.fontFamily) {
    const w = flat?.fontWeight;
    const key = w == null ? '400' : typeof w === 'number' ? String(w) : String(w);
    out.fontFamily = FACE[key] ?? FACE['400'];
    // Weight is baked into the face — neutralise it so iOS doesn't double-bold.
    if (w != null) out.fontWeight = Platform.OS === 'ios' ? '400' : undefined;
  }

  return Object.keys(out).length ? out : null;
}

let installed = false;

export function applyTextDefaults(): void {
  if (installed) return;
  installed = true;

  for (const Comp of [Text, TextInput] as unknown as Patchable[]) {
    const original = Comp.render;
    if (typeof original !== 'function' || Comp.__textPatched) continue;

    Comp.render = function patched(this: unknown, ...args: any[]) {
      const element = original.apply(this, args);
      try {
        const extra = overrides(args[0]?.style);
        if (!extra || !React.isValidElement(element)) return element;
        const el = element as React.ReactElement<{ style?: unknown }>;
        return React.cloneElement(el, { style: [el.props.style, extra] });
      } catch {
        return element;
      }
    };
    Comp.__textPatched = true;
  }
}
