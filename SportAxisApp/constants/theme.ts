/**
 * SportAxisApp — design system
 * ─────────────────────────────────────────────────────────────────────────────
 * The same system SportAxisWeb runs on, expressed for React Native. Colours
 * are the sRGB values of the web tokens, so a status chip in the app and the
 * same chip on the web are the same colour rather than two guesses at it.
 *
 * The structural decision carried over from the web: the primary action is
 * ink, not the brand red. This product's brand IS red, and when the primary
 * button, the selected tab and the delete button are all that red, none of
 * them means anything.
 *
 *   ink      primary actions and text hierarchy
 *   crimson  identity: selected tab, brand moments, live indicators
 *   danger   its own red, and since no primary button is red it now reads
 *            unambiguously as destructive
 */

// ── Ink: near-achromatic, blue arriving only at the dark end ────────────────
const INK = {
  50:   '#FAFAFB',
  100:  '#F5F5F7',
  150:  '#F0F0F3',
  200:  '#E7E7EC',
  300:  '#D6D6DE',
  400:  '#A3A3AF',
  500:  '#77778A',
  600:  '#5C5C70',
  700:  '#47475C',
  800:  '#32323F',
  900:  '#23232E',
  950:  '#191922',
  1000: '#111118',
} as const;

// ── Crimson: Batangas State University red, 700 holds the brand value ──────
const CRIMSON = {
  50:  '#FDF2F2',
  100: '#FADEDD',
  200: '#F6BDBA',
  300: '#EF938D',
  400: '#E3625B',
  500: '#D13D37',
  600: '#C02D28',
  700: '#B91C1C',
  800: '#9A2320',
  900: '#82241F',
  950: '#521715',
} as const;

export const COLORS = {
  // Brand — identity, selection, live state. Not primary actions.
  primary:        CRIMSON[700],
  primaryDark:    CRIMSON[800],
  primaryLight:   CRIMSON[600],
  primaryLighter: CRIMSON[500],
  primaryPale:    CRIMSON[100],
  primarySubtle:  CRIMSON[50],
  brand:          CRIMSON[700],
  brandSubtle:    CRIMSON[50],
  brandBorder:    CRIMSON[200],
  brandText:      CRIMSON[800],

  // Action — the primary button, ink not red.
  action:         INK[900],
  actionPressed:  INK[950],
  actionOn:       INK[50],

  // Destructive. Distinct from the brand because no primary control is red.
  destructive:    CRIMSON[600],

  // Surfaces. The page is paper, a card is white; elevation is luminance
  // before it is ever a shadow.
  background:     INK[50],
  surface:        '#FFFFFF',
  surfaceAlt:     INK[100],
  surfaceMuted:   INK[200],
  surfaceSunken:  INK[100],

  // Borders & feedback
  border:         INK[200],
  borderStrong:   INK[300],
  hairline:       INK[200],
  pressed:        'rgba(35,35,46,0.06)',
  primaryTint:    CRIMSON[50],

  // Text
  textPrimary:    INK[900],
  textSecondary:  INK[600],
  textMuted:      INK[500],
  textDisabled:   INK[400],
  textInverse:    INK[50],
  textRedAccent:  CRIMSON[800],

  // Status — matched in lightness so a row of chips reads as one family
  // differing by hue, not as four unrelated colours.
  success:        '#2F7A4F',
  successLight:   '#EDF7F1',
  warning:        '#B1721E',
  warningLight:   '#FBF3E7',
  error:          CRIMSON[600],
  errorLight:     CRIMSON[50],
  info:           '#3767A3',
  infoLight:      '#EDF2F9',

  offline:        '#B1721E',
  online:         '#2F7A4F',

  // OCR used a violet second accent. A sports office has one accent; OCR is
  // a process, and it reports through the status colours like everything else.
  ocr:            INK[600],
  ocrLight:       INK[100],

  overlay:        'rgba(35,35,46,0.45)',
} as const;

export const SPACING = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
  xxxl: 48,
} as const;

export const RADIUS = {
  xs:   4,
  sm:   6,
  md:   8,
  lg:   10,
  xl:   14,
  xxl:  18,
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

// ── Archivo faces ───────────────────────────────────────────────────────────
// Loaded in app/_layout.tsx; text-defaults.ts maps any `fontWeight` a style
// carries to the matching face (RN doesn't synthesize weights for custom fonts).
// Archivo matches the web client, so the two read as one product.
export const FONT = {
  regular:   'Archivo_400Regular',
  medium:    'Archivo_500Medium',
  semibold:  'Archivo_600SemiBold',
  bold:      'Archivo_700Bold',
  /** Kept as a key so existing styles resolve; it maps to Bold, not heavier. */
  extrabold: 'Archivo_700Bold',
} as const;

// ── Type scale ──────────────────────────────────────────────────────────────
// One source of truth for text — screens spread `...TYPE.body` instead of
// hand-pairing fontSize + fontWeight. `fontWeight` here is what text-defaults
// translates into an Archivo face.
export const TYPE = {
  display:  { fontSize: 28, lineHeight: 33, fontWeight: FONT_WEIGHT.bold,     letterSpacing: -0.6 },
  title:    { fontSize: 22, lineHeight: 27, fontWeight: FONT_WEIGHT.bold,     letterSpacing: -0.45 },
  heading:  { fontSize: 17, lineHeight: 23, fontWeight: FONT_WEIGHT.semibold, letterSpacing: -0.25 },
  subhead:  { fontSize: 15, lineHeight: 21, fontWeight: FONT_WEIGHT.semibold, letterSpacing: -0.12 },
  body:     { fontSize: 15, lineHeight: 23, fontWeight: FONT_WEIGHT.regular },
  bodySm:   { fontSize: 13, lineHeight: 19, fontWeight: FONT_WEIGHT.regular },
  label:    { fontSize: 13, lineHeight: 18, fontWeight: FONT_WEIGHT.medium },
  caption:  { fontSize: 11, lineHeight: 15, fontWeight: FONT_WEIGHT.regular },
  /** Small all-caps, for column headers only. Not a label above a heading. */
  overline: { fontSize: 11, lineHeight: 14, fontWeight: FONT_WEIGHT.semibold, letterSpacing: 0.6 },
  /** Scores, ranks, counts: the figure is the content. */
  numeral:  { fontSize: 22, lineHeight: 26, fontWeight: FONT_WEIGHT.bold,     letterSpacing: -0.4 },
} as const;

export const SHADOWS = {
  sm: {
    shadowColor:   '#23232E',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius:  2,
    elevation:     1,
  },
  md: {
    shadowColor:   '#23232E',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.09,
    shadowRadius:  4,
    elevation:     2,
  },
  lg: {
    shadowColor:   '#23232E',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius:  8,
    elevation:     4,
  },
  card: {
    shadowColor:   '#23232E',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius:  3,
    elevation:     2,
  },
} as const;

// ── Gradient helper values ─────────────────────────────────────────────────────
/** @deprecated The red gradient was retired with the web shell redesign.
 *  A flat brand surface reads as deliberate; a gradient reads as decoration. */
export const GRADIENTS = {
  sidebarStart:  CRIMSON[700],
  sidebarEnd:    CRIMSON[700],
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
