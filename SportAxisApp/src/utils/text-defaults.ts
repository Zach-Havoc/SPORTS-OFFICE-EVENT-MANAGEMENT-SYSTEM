import React from 'react';
import { Platform, StyleSheet, Text, TextInput } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Global text defaults — applied once, before the first render.
//   1. Archivo is the app font, the same face the web client uses. RN does
//      not synthesize weights for custom fonts, so a style's `fontWeight` is
//      translated to the matching Archivo *face*.
//   2. Every explicit `fontSize` is multiplied by FONT_SCALE (low-vision bump).
// Patches <Text>/<TextInput>.render. Fully defensive: any failure falls back to
// the untouched element so a stray text node can never crash the app.
// ─────────────────────────────────────────────────────────────────────────────

export const FONT_SCALE = 1.12;

// 800 and 900 resolve to Bold rather than a heavier face: the system carries
// hierarchy with size, colour and space, and the extra-bold weight was only
// ever used to shout.
const FACE: Record<string, string> = {
  '100': 'Archivo_400Regular',
  '200': 'Archivo_400Regular',
  '300': 'Archivo_400Regular',
  '400': 'Archivo_400Regular',
  '500': 'Archivo_500Medium',
  '600': 'Archivo_600SemiBold',
  '700': 'Archivo_700Bold',
  '800': 'Archivo_700Bold',
  '900': 'Archivo_700Bold',
  normal: 'Archivo_400Regular',
  bold: 'Archivo_700Bold',
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
