/**
 * SportAxisApp — BatStateU Design System
 * ─────────────────────────────────────────────────────────────────────────────
 * Inherits the Batangas State University red-and-white identity from
 * SportAxisWeb. Primary = #B91C1C (BatStateU Red), backgrounds are clean
 * white/light-gray, text is dark charcoal. Matches the web sidebar gradient.
 */

// ── Brand colors (from web theme.css) ────────────────────────────────────────
export const COLORS = {
  // Primary — BatStateU Red (#B91C1C)
  primary:        '#B91C1C',
  primaryDark:    '#991B1B',   // red-800
  primaryLight:   '#DC2626',   // red-600
  primaryLighter: '#EF4444',   // red-500
  primaryPale:    '#FEE2E2',   // red-100 / accent
  primarySubtle:  '#FEF2F2',   // red-50

  // Destructive (matches web --destructive: #DC2626)
  destructive:    '#DC2626',

  // Sidebar gradient (matches web: from-red-700 to-red-800)
  sidebarFrom:    '#B91C1C',
  sidebarTo:      '#991B1B',

  // Neutral backgrounds — white-first
  background:     '#FFFFFF',   // pure white app background
  surface:        '#FFFFFF',   // white card
  surfaceAlt:     '#F5F6F8',   // faint gray zone (chips, insets)
  surfaceMuted:   '#EDEEF1',   // gray-200-ish

  // Borders & dividers
  border:         'rgba(17,24,39,0.10)',
  borderStrong:   '#D1D5DB',            // gray-300
  hairline:       'rgba(17,24,39,0.08)', // 1px dividers / card outlines
  pressed:        'rgba(17,24,39,0.05)', // Pressable feedback wash
  primaryTint:    'rgba(185,28,28,0.08)', // BatStateU-red wash for active/selected

  // Text (dark on white, matching web)
  textPrimary:    '#111827',   // gray-900
  textSecondary:  '#6B7280',   // gray-500 / web --muted-foreground: #717182
  textMuted:      '#9CA3AF',   // gray-400
  textInverse:    '#FFFFFF',   // white (on red backgrounds)
  textRedAccent:  '#7F1D1D',   // red-900 (web --accent-foreground)

  // Status colours
  success:        '#16A34A',   // green-600
  successLight:   '#DCFCE7',   // green-100
  warning:        '#D97706',   // amber-600
  warningLight:   '#FEF3C7',   // amber-100
  error:          '#DC2626',   // same as destructive
  errorLight:     '#FEE2E2',   // red-100
  info:           '#2563EB',   // blue-600
  infoLight:      '#DBEAFE',   // blue-100

  // Offline indicator
  offline:        '#D97706',
  online:         '#16A34A',

  // OCR secondary (purple accent — kept for OCR only, doesn't clash)
  ocr:            '#7C3AED',
  ocrLight:       '#EDE9FE',

  // Overlay/glass
  overlay:        'rgba(0,0,0,0.50)',
} as const;

export const SPACING = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
} as const;

export const RADIUS = {
  sm:   6,
  md:   10,   // matches web --radius: 0.625rem
  lg:   14,
  xl:   20,
  xxl:  28,
  full: 9999,
} as const;

export const FONT_SIZE = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   20,
  xxl:  24,
  xxxl: 30,
  hero: 40,
} as const;

export const FONT_WEIGHT = {
  regular:   '400' as const,
  medium:    '500' as const,   // web --font-weight-medium: 500
  semibold:  '600' as const,
  bold:      '700' as const,
  extrabold: '800' as const,
} as const;

// ── Inter faces ─────────────────────────────────────────────────────────────
// Loaded in app/_layout.tsx; text-defaults.ts maps any `fontWeight` a style
// carries to the matching face (RN doesn't synthesize weights for custom fonts).
export const FONT = {
  regular:   'Inter_400Regular',
  medium:    'Inter_500Medium',
  semibold:  'Inter_600SemiBold',
  bold:      'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

// ── Type scale ──────────────────────────────────────────────────────────────
// One source of truth for text — screens spread `...TYPE.body` instead of
// hand-pairing fontSize + fontWeight. `fontWeight` here is what text-defaults
// translates into an Inter face.
export const TYPE = {
  display:  { fontSize: 28, lineHeight: 34, fontWeight: FONT_WEIGHT.extrabold, letterSpacing: -0.4 },
  title:    { fontSize: 22, lineHeight: 28, fontWeight: FONT_WEIGHT.bold,      letterSpacing: -0.3 },
  heading:  { fontSize: 17, lineHeight: 24, fontWeight: FONT_WEIGHT.bold,      letterSpacing: -0.2 },
  subhead:  { fontSize: 15, lineHeight: 22, fontWeight: FONT_WEIGHT.semibold,  letterSpacing: -0.1 },
  body:     { fontSize: 15, lineHeight: 22, fontWeight: FONT_WEIGHT.regular },
  bodySm:   { fontSize: 13, lineHeight: 19, fontWeight: FONT_WEIGHT.regular },
  label:    { fontSize: 13, lineHeight: 18, fontWeight: FONT_WEIGHT.semibold,  letterSpacing: 0.1 },
  caption:  { fontSize: 11, lineHeight: 14, fontWeight: FONT_WEIGHT.bold,      letterSpacing: 0.5 },
} as const;

export const SHADOWS = {
  sm: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius:  2,
    elevation:     1,
  },
  md: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius:  4,
    elevation:     2,
  },
  lg: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius:  8,
    elevation:     4,
  },
  card: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius:  3,
    elevation:     2,
  },
} as const;

// ── Gradient helper values ─────────────────────────────────────────────────────
export const GRADIENTS = {
  sidebarStart:  '#B91C1C',
  sidebarEnd:    '#991B1B',
} as const;

// Legacy Colors export (keeps existing @/constants/theme imports working)
export const Colors = {
  light: {
    text:            COLORS.textPrimary,
    background:      COLORS.background,
    tint:            COLORS.primary,
    icon:            COLORS.textSecondary,
    tabIconDefault:  COLORS.textSecondary,
    tabIconSelected: COLORS.primary,
  },
  dark: {
    text:            COLORS.textPrimary,
    background:      COLORS.background,
    tint:            COLORS.primary,
    icon:            COLORS.textSecondary,
    tabIconDefault:  COLORS.textSecondary,
    tabIconSelected: COLORS.primary,
  },
};

export const Fonts = {
  sans:    FONT.regular,
  rounded: FONT.semibold,
  mono:    'monospace',
};

// Re-export Platform for legacy imports
export { Platform } from 'react-native';
