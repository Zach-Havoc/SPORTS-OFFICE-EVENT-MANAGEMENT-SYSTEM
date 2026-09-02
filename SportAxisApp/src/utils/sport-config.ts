// ─────────────────────────────────────────────────────────────────────────────
// sport-config.ts — BatStateU ARASOF Sport-Specific Scoring Configuration
// Maps event.category / event.name → scoring UI metadata and form layout
// ─────────────────────────────────────────────────────────────────────────────

export type SportType =
  | 'basketball'
  | 'volleyball'
  | 'badminton'
  | 'football'
  | 'track-field'
  | 'swimming'
  | 'tennis'
  | 'table-tennis'
  | 'cultural'
  | 'default';

export type ScoringLayout =
  | 'scoreboard'   // Basketball, Football — quarter/period scores
  | 'set-game'     // Volleyball, Tennis, Table Tennis — set/game scores
  | 'match-game'   // Badminton — game scores + rally
  | 'timed'        // Swimming, Track & Field — time / distance
  | 'overall'      // Cultural, Default — single overall score
  ;

export interface SportConfig {
  type: SportType;
  /** Display label for the sport */
  label: string;
  /** Ionicons name for the sport icon */
  icon: string;
  /** Theme color (hex) for header */
  color: string;
  /** Light tint for background accents */
  colorLight: string;
  /** Which scoring layout to use */
  layout: ScoringLayout;
  /** Whether scores are per-team (true) or per-individual (false) */
  teamBased: boolean;
  /** Quarter / set / period labels for scoreboard layout */
  periodLabels?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Sport Configs
// ─────────────────────────────────────────────────────────────────────────────

const BASKETBALL_CONFIG: SportConfig = {
  type: 'basketball',
  label: 'Basketball',
  icon: 'basketball-outline',
  color: '#B91C1C',
  colorLight: '#FEE2E2',
  layout: 'scoreboard',
  teamBased: true,
  periodLabels: ['Q1', 'Q2', 'Q3', 'Q4', 'OT1', 'OT2'],
};

const VOLLEYBALL_CONFIG: SportConfig = {
  type: 'volleyball',
  label: 'Volleyball',
  icon: 'football-outline',
  color: '#1D4ED8',
  colorLight: '#DBEAFE',
  layout: 'set-game',
  teamBased: true,
  periodLabels: ['Set 1', 'Set 2', 'Set 3', 'Set 4', 'Set 5'],
};

const BADMINTON_CONFIG: SportConfig = {
  type: 'badminton',
  label: 'Badminton',
  icon: 'git-network-outline',
  color: '#047857',
  colorLight: '#D1FAE5',
  layout: 'match-game',
  teamBased: false,
  periodLabels: ['Game 1', 'Game 2', 'Game 3'],
};

const FOOTBALL_CONFIG: SportConfig = {
  type: 'football',
  label: 'Football (Soccer)',
  icon: 'ellipse-outline',
  color: '#15803D',
  colorLight: '#DCFCE7',
  layout: 'scoreboard',
  teamBased: true,
  periodLabels: ['1st Half', '2nd Half', 'ET1', 'ET2'],
};

const TRACK_FIELD_CONFIG: SportConfig = {
  type: 'track-field',
  label: 'Track & Field',
  icon: 'timer-outline',
  color: '#9333EA',
  colorLight: '#F3E8FF',
  layout: 'timed',
  teamBased: false,
};

const SWIMMING_CONFIG: SportConfig = {
  type: 'swimming',
  label: 'Swimming',
  icon: 'water-outline',
  color: '#0284C7',
  colorLight: '#E0F2FE',
  layout: 'timed',
  teamBased: false,
};

const TENNIS_CONFIG: SportConfig = {
  type: 'tennis',
  label: 'Tennis',
  icon: 'radio-outline',
  color: '#B45309',
  colorLight: '#FEF3C7',
  layout: 'set-game',
  teamBased: false,
  periodLabels: ['Set 1', 'Set 2', 'Set 3'],
};

const TABLE_TENNIS_CONFIG: SportConfig = {
  type: 'table-tennis',
  label: 'Table Tennis',
  icon: 'ellipse-outline',
  color: '#0F766E',
  colorLight: '#CCFBF1',
  layout: 'match-game',
  teamBased: false,
  periodLabels: ['Game 1', 'Game 2', 'Game 3', 'Game 4', 'Game 5'],
};

const CULTURAL_CONFIG: SportConfig = {
  type: 'cultural',
  label: 'Cultural / Arts',
  icon: 'musical-notes-outline',
  color: '#7C3AED',
  colorLight: '#EDE9FE',
  layout: 'overall',
  teamBased: true,
};

const DEFAULT_CONFIG: SportConfig = {
  type: 'default',
  label: 'General Sport',
  icon: 'trophy-outline',
  color: '#B91C1C',
  colorLight: '#FEE2E2',
  layout: 'overall',
  teamBased: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// Detection Logic
// ─────────────────────────────────────────────────────────────────────────────

const KEYWORD_MAP: [string[], SportType][] = [
  [['basketball', 'bball', '3x3'], 'basketball'],
  [['volleyball', 'vball', 'volley'], 'volleyball'],
  [['badminton', 'shuttle', 'shuttlecock'], 'badminton'],
  [['football', 'soccer', 'futsal', 'futbol'], 'football'],
  [['track', 'field', 'athletics', 'running', 'sprint', 'marathon', 'hurdle', 'relay', 'javelin', 'shot put', 'discus', 'long jump', 'high jump', 'triple jump'], 'track-field'],
  [['swimming', 'swim', 'freestyle', 'backstroke', 'breaststroke', 'butterfly', 'medley'], 'swimming'],
  [['tennis', 'lawn tennis'], 'tennis'],
  [['table tennis', 'ping pong', 'pingpong'], 'table-tennis'],
  [['cultural', 'dance', 'cheerdance', 'cheer', 'folk dance', 'modern dance', 'arts', 'performance', 'theater', 'theatre'], 'cultural'],
];

const CONFIG_MAP: Record<SportType, SportConfig> = {
  basketball: BASKETBALL_CONFIG,
  volleyball: VOLLEYBALL_CONFIG,
  badminton: BADMINTON_CONFIG,
  football: FOOTBALL_CONFIG,
  'track-field': TRACK_FIELD_CONFIG,
  swimming: SWIMMING_CONFIG,
  tennis: TENNIS_CONFIG,
  'table-tennis': TABLE_TENNIS_CONFIG,
  cultural: CULTURAL_CONFIG,
  default: DEFAULT_CONFIG,
};

/**
 * Detect sport type from event category and/or event name strings.
 */
export function detectSportType(category: string = '', name: string = ''): SportType {
  const haystack = `${category} ${name}`.toLowerCase().trim();
  for (const [keywords, type] of KEYWORD_MAP) {
    if (keywords.some((kw) => haystack.includes(kw))) {
      return type;
    }
  }
  return 'default';
}

/**
 * Get the full SportConfig for a given sport type.
 */
export function getSportConfig(type: SportType): SportConfig {
  return CONFIG_MAP[type] ?? DEFAULT_CONFIG;
}

/**
 * Get the SportConfig directly from event category + name.
 */
export function getSportConfigFromEvent(category: string = '', name: string = ''): SportConfig {
  return getSportConfig(detectSportType(category, name));
}
