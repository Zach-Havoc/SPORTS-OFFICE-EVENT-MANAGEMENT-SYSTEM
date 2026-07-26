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
  | 'criteria'     // Cultural, Default — pure weighted criteria inputs
  ;

export interface CriterionHint {
  /** Keyword(s) matched against criterion name (case-insensitive) */
  keywords: string[];
  /** Short hint shown under the criterion input */
  hint: string;
  /** Ionicons icon name */
  icon: string;
  /** Suggested sub-labels / bullet points to guide the judge */
  rubric?: string[];
}

export interface SportConfig {
  type: SportType;
  /** Display label for the sport */
  label: string;
  /** Emoji for quick identification */
  emoji: string;
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
  /** Short guide shown at top of scoring form */
  scoringGuide: string;
  /** Quarter / set / period labels for scoreboard layout */
  periodLabels?: string[];
  /** Per-criterion hints keyed by matching keywords */
  criteriaHints: CriterionHint[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Sport Configs
// ─────────────────────────────────────────────────────────────────────────────

const BASKETBALL_CONFIG: SportConfig = {
  type: 'basketball',
  label: 'Basketball',
  emoji: '🏀',
  icon: 'basketball-outline',
  color: '#B91C1C',
  colorLight: '#FEE2E2',
  layout: 'scoreboard',
  teamBased: true,
  scoringGuide: 'Score each criterion based on overall team performance throughout the game. Evaluate execution, strategy, teamwork, and sportsmanship.',
  periodLabels: ['Q1', 'Q2', 'Q3', 'Q4', 'OT1', 'OT2'],
  criteriaHints: [
    {
      keywords: ['technical', 'shooting', 'execution'],
      hint: 'Evaluate shooting accuracy, ball handling, dribbling, and technical fundamentals.',
      icon: 'fitness-outline',
      rubric: ['Shot selection & accuracy', 'Ball handling & dribbling', 'Passing precision', 'Lay-ups & post moves'],
    },
    {
      keywords: ['offense', 'defense', 'strategy'],
      hint: 'Assess quality of offensive plays, defensive positioning, press, and transition.',
      icon: 'shield-outline',
      rubric: ['Offensive set plays', 'Defensive schemes', 'Fast-break execution', 'Transition defense'],
    },
    {
      keywords: ['teamwork', 'ball movement', 'coordination'],
      hint: 'Evaluate passing coordination, off-ball movement, screens, and team chemistry.',
      icon: 'people-outline',
      rubric: ['Ball sharing & assists', 'Off-ball cuts', 'Screen setting', 'Communication'],
    },
    {
      keywords: ['sportsmanship', 'discipline', 'conduct'],
      hint: 'Rate player behavior, respect for officials, and team conduct.',
      icon: 'ribbon-outline',
      rubric: ['Respect for officials', 'Fair play', 'Player conduct', 'Bench behavior'],
    },
  ],
};

const VOLLEYBALL_CONFIG: SportConfig = {
  type: 'volleyball',
  label: 'Volleyball',
  emoji: '🏐',
  icon: 'football-outline',
  color: '#1D4ED8',
  colorLight: '#DBEAFE',
  layout: 'set-game',
  teamBased: true,
  scoringGuide: 'Score each criterion based on overall set performance. Observe spiking accuracy, reception quality, team coordination, and serving.',
  periodLabels: ['Set 1', 'Set 2', 'Set 3', 'Set 4', 'Set 5'],
  criteriaHints: [
    {
      keywords: ['attacking', 'spiking', 'spike'],
      hint: 'Evaluate spike power, placement, tip shots, and back-row attacks.',
      icon: 'arrow-down-outline',
      rubric: ['Spike accuracy', 'Shot placement', 'Block avoidance', 'Back-row attacks'],
    },
    {
      keywords: ['defense', 'reception', 'dig'],
      hint: 'Assess digging, receive quality, libero performance, and floor coverage.',
      icon: 'shield-half-outline',
      rubric: ['Receive accuracy', 'Dig quality', 'Floor coverage', 'Emergency defense'],
    },
    {
      keywords: ['setting', 'coordination', 'team'],
      hint: 'Rate setter decision-making, play variation, and team synchronization.',
      icon: 'swap-horizontal-outline',
      rubric: ['Set consistency', 'Play variation', 'Communication', 'Rotation execution'],
    },
    {
      keywords: ['serving', 'court', 'movement'],
      hint: 'Evaluate serve accuracy, power, float serves, and court positioning.',
      icon: 'navigate-outline',
      rubric: ['Serve accuracy', 'Serve power', 'Float vs. topspin', 'Court movement'],
    },
  ],
};

const BADMINTON_CONFIG: SportConfig = {
  type: 'badminton',
  label: 'Badminton',
  emoji: '🏸',
  icon: 'git-network-outline',
  color: '#047857',
  colorLight: '#D1FAE5',
  layout: 'match-game',
  teamBased: false,
  scoringGuide: 'Score each criterion based on the player\'s performance across the entire match. Focus on stroke quality, footwork, and tactical play.',
  periodLabels: ['Game 1', 'Game 2', 'Game 3'],
  criteriaHints: [
    {
      keywords: ['stroke', 'shot', 'precision'],
      hint: 'Evaluate smash power, drop shots, clears, drives, and net play accuracy.',
      icon: 'radio-button-on-outline',
      rubric: ['Smash accuracy', 'Drop shot quality', 'Clear distance', 'Net play finesse'],
    },
    {
      keywords: ['footwork', 'court coverage', 'movement'],
      hint: 'Assess court movement speed, split-step timing, and recovery positioning.',
      icon: 'walk-outline',
      rubric: ['Speed to shuttle', 'Split-step timing', 'Recovery position', 'Corner coverage'],
    },
    {
      keywords: ['tactical', 'awareness', 'agility'],
      hint: 'Rate rally tactics, deception ability, pattern recognition, and adaptability.',
      icon: 'bulb-outline',
      rubric: ['Deception & disguise', 'Rally pattern', 'Adaptability', 'Mental toughness'],
    },
    {
      keywords: ['sportsmanship', 'conduct'],
      hint: 'Evaluate respect for opponents, acceptance of decisions, and professional behavior.',
      icon: 'ribbon-outline',
      rubric: ['Fair play', 'Shuttle handling', 'Respect for officials', 'Behavior between rallies'],
    },
  ],
};

const FOOTBALL_CONFIG: SportConfig = {
  type: 'football',
  label: 'Football (Soccer)',
  emoji: '⚽',
  icon: 'ellipse-outline',
  color: '#15803D',
  colorLight: '#DCFCE7',
  layout: 'scoreboard',
  teamBased: true,
  scoringGuide: 'Score each criterion based on overall team performance during the match. Evaluate ball control, tactical discipline, fitness, and teamwork.',
  periodLabels: ['1st Half', '2nd Half', 'ET1', 'ET2'],
  criteriaHints: [
    {
      keywords: ['ball control', 'passing', 'dribbling'],
      hint: 'Assess short/long passes, dribbling ability, first touch, and ball retention.',
      icon: 'sync-outline',
      rubric: ['Pass accuracy', 'Dribble success', 'Ball retention', 'First touch control'],
    },
    {
      keywords: ['offensive', 'defensive', 'execution'],
      hint: 'Evaluate attacking build-up, goal attempts, defensive organization, and transitions.',
      icon: 'shield-outline',
      rubric: ['Goal attempts', 'Defensive shape', 'Transition play', 'Set pieces'],
    },
    {
      keywords: ['physical', 'fitness', 'movement', 'endurance'],
      hint: 'Rate physical conditioning, stamina throughout the match, and movement quality.',
      icon: 'body-outline',
      rubric: ['Stamina & pressing', 'Speed & acceleration', 'Aerial duels', 'Physical duels'],
    },
    {
      keywords: ['tactical', 'discipline', 'teamwork'],
      hint: 'Evaluate tactical awareness, positional discipline, and team cohesion.',
      icon: 'git-merge-outline',
      rubric: ['Positional discipline', 'Pressing organization', 'Team shape', 'Communication'],
    },
  ],
};

const TRACK_FIELD_CONFIG: SportConfig = {
  type: 'track-field',
  label: 'Track & Field',
  emoji: '🏃',
  icon: 'timer-outline',
  color: '#9333EA',
  colorLight: '#F3E8FF',
  layout: 'timed',
  teamBased: false,
  scoringGuide: 'Record performance results and evaluate technical execution. For timed events, enter the official time. For field events, enter distance or height achieved.',
  criteriaHints: [
    {
      keywords: ['time', 'distance', 'performance'],
      hint: 'Enter the official recorded time (MM:SS.ms) or distance/height in meters.',
      icon: 'timer-outline',
      rubric: ['Personal record', 'Season best', 'Qualifying standard'],
    },
    {
      keywords: ['technique', 'form', 'style'],
      hint: 'Evaluate running form, starting technique, stride efficiency, and body posture.',
      icon: 'body-outline',
      rubric: ['Start technique', 'Stride mechanics', 'Arm action', 'Finish execution'],
    },
    {
      keywords: ['pacing', 'endurance', 'strategy'],
      hint: 'Rate race pacing strategy, tactical positioning, and mid-race decisions.',
      icon: 'pulse-outline',
      rubric: ['Even pacing', 'Kick timing', 'Race positioning', 'Tactical awareness'],
    },
  ],
};

const SWIMMING_CONFIG: SportConfig = {
  type: 'swimming',
  label: 'Swimming',
  emoji: '🏊',
  icon: 'water-outline',
  color: '#0284C7',
  colorLight: '#E0F2FE',
  layout: 'timed',
  teamBased: false,
  scoringGuide: 'Evaluate stroke technique, turn and start execution, and overall speed. Enter official times where applicable.',
  criteriaHints: [
    {
      keywords: ['stroke', 'technique', 'efficiency'],
      hint: 'Assess stroke mechanics, body position, underwater kicks, and breathing timing.',
      icon: 'water-outline',
      rubric: ['Stroke cycle efficiency', 'Body rotation', 'Underwater phase', 'Breathing technique'],
    },
    {
      keywords: ['turn', 'start', 'execution'],
      hint: 'Evaluate wall touch, flip turn speed, push-off distance, and reaction to start.',
      icon: 'refresh-outline',
      rubric: ['Start reaction time', 'Dive entry angle', 'Turn execution', 'Push-off streamline'],
    },
    {
      keywords: ['speed', 'endurance', 'time'],
      hint: 'Rate overall race speed, lap-by-lap consistency, and finishing strength.',
      icon: 'flash-outline',
      rubric: ['Split time consistency', 'Finishing acceleration', 'Endurance holding', 'Overall time'],
    },
  ],
};

const TENNIS_CONFIG: SportConfig = {
  type: 'tennis',
  label: 'Tennis',
  emoji: '🎾',
  icon: 'radio-outline',
  color: '#B45309',
  colorLight: '#FEF3C7',
  layout: 'set-game',
  teamBased: false,
  scoringGuide: 'Score each criterion based on overall match performance. Rate serve quality, groundstrokes, footwork, and tactical decision-making.',
  periodLabels: ['Set 1', 'Set 2', 'Set 3'],
  criteriaHints: [
    {
      keywords: ['serve', 'groundstroke', 'return'],
      hint: 'Evaluate first-serve percentage, serve power/placement, and return quality.',
      icon: 'radio-button-on-outline',
      rubric: ['1st serve %', 'Ace count', 'Return depth', 'Second serve quality'],
    },
    {
      keywords: ['footwork', 'positioning', 'movement'],
      hint: 'Assess court coverage, split-step timing, recovery after shots, and balance.',
      icon: 'walk-outline',
      rubric: ['Court coverage', 'Split-step timing', 'Shot recovery', 'Balance at contact'],
    },
    {
      keywords: ['shot selection', 'strategy', 'tactical'],
      hint: 'Rate tactical patterns, shot variety, net approaches, and pressure execution.',
      icon: 'analytics-outline',
      rubric: ['Point construction', 'Net play', 'Defensive conversion', 'Pressure handling'],
    },
    {
      keywords: ['sportsmanship', 'conduct'],
      hint: 'Evaluate behavior at changeovers, respect for opponents, and demeanor.',
      icon: 'ribbon-outline',
      rubric: ['Respectful demeanor', 'Handling bad calls', 'Between-point routine', 'Match conduct'],
    },
  ],
};

const TABLE_TENNIS_CONFIG: SportConfig = {
  type: 'table-tennis',
  label: 'Table Tennis',
  emoji: '🏓',
  icon: 'ellipse-outline',
  color: '#0F766E',
  colorLight: '#CCFBF1',
  layout: 'match-game',
  teamBased: false,
  scoringGuide: 'Evaluate serve accuracy, rally control, speed, and sportsmanship across the match.',
  periodLabels: ['Game 1', 'Game 2', 'Game 3', 'Game 4', 'Game 5'],
  criteriaHints: [
    {
      keywords: ['serve', 'return', 'accuracy'],
      hint: 'Assess serve variety (topspin, backspin, sidespin), placement, and return consistency.',
      icon: 'radio-button-on-outline',
      rubric: ['Serve variety', 'Serve placement', 'Return accuracy', 'Service deception'],
    },
    {
      keywords: ['rally', 'control', 'shot selection'],
      hint: 'Evaluate loop drive consistency, block, push, and attacking shot quality.',
      icon: 'swap-horizontal-outline',
      rubric: ['Loop consistency', 'Block quality', 'Push control', 'Attacking shots'],
    },
    {
      keywords: ['speed', 'reaction', 'time'],
      hint: 'Rate overall speed, quick reactions, and counter-attacking ability.',
      icon: 'flash-outline',
      rubric: ['Reaction time', 'Counter-attack speed', 'Quick recovery', 'Footwork speed'],
    },
    {
      keywords: ['sportsmanship', 'conduct'],
      hint: 'Evaluate fair play, net call honesty, and respectful conduct.',
      icon: 'ribbon-outline',
      rubric: ['Honest calls', 'Fair play', 'Respectful attitude', 'Positive demeanor'],
    },
  ],
};

const CULTURAL_CONFIG: SportConfig = {
  type: 'cultural',
  label: 'Cultural / Arts',
  emoji: '🎭',
  icon: 'musical-notes-outline',
  color: '#7C3AED',
  colorLight: '#EDE9FE',
  layout: 'criteria',
  teamBased: true,
  scoringGuide: 'Score each artistic criterion on a scale up to the maximum. Evaluate choreography, synchronization, showmanship, and overall impact.',
  criteriaHints: [
    {
      keywords: ['choreography', 'technique', 'dance'],
      hint: 'Evaluate difficulty of steps, execution quality, and choreographic creativity.',
      icon: 'musical-notes-outline',
      rubric: ['Step difficulty', 'Clean execution', 'Artistic creativity', 'Music interpretation'],
    },
    {
      keywords: ['synchronization', 'precision', 'unity'],
      hint: 'Rate how well performers move in unison, timing accuracy, and formation changes.',
      icon: 'people-circle-outline',
      rubric: ['Timing accuracy', 'Formation precision', 'Unison of movement', 'Transitions'],
    },
    {
      keywords: ['showmanship', 'expression', 'performance'],
      hint: 'Assess stage presence, facial expression, energy projection, and audience engagement.',
      icon: 'star-outline',
      rubric: ['Stage presence', 'Facial expressions', 'Energy level', 'Audience connection'],
    },
    {
      keywords: ['costume', 'musicality', 'props'],
      hint: 'Evaluate appropriateness and quality of costumes, props, and musical interpretation.',
      icon: 'shirt-outline',
      rubric: ['Costume design', 'Prop usage', 'Music match', 'Overall presentation'],
    },
  ],
};

const DEFAULT_CONFIG: SportConfig = {
  type: 'default',
  label: 'General Sport',
  emoji: '🏅',
  icon: 'trophy-outline',
  color: '#B91C1C',
  colorLight: '#FEE2E2',
  layout: 'criteria',
  teamBased: true,
  scoringGuide: 'Score each criterion based on the team or individual\'s overall performance. Enter a value between 0 and the maximum score shown.',
  criteriaHints: [
    {
      keywords: ['technical', 'execution', 'skill'],
      hint: 'Evaluate the technical skill level and execution quality of the performance.',
      icon: 'construct-outline',
      rubric: [],
    },
    {
      keywords: ['team', 'coordination', 'strategy', 'cooperation'],
      hint: 'Assess how well the team works together and executes their strategy.',
      icon: 'people-outline',
      rubric: [],
    },
    {
      keywords: ['performance', 'discipline', 'focus'],
      hint: 'Rate overall performance quality, discipline, and mental focus.',
      icon: 'medal-outline',
      rubric: [],
    },
    {
      keywords: ['sportsmanship', 'conduct', 'respect', 'fair'],
      hint: 'Evaluate sportsmanship, fair play, and overall conduct.',
      icon: 'ribbon-outline',
      rubric: [],
    },
  ],
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

/**
 * Find the best matching hint for a given criterion name.
 */
export function getCriterionHint(
  criterionName: string,
  config: SportConfig,
): CriterionHint | null {
  const lower = criterionName.toLowerCase();
  for (const hint of config.criteriaHints) {
    if (hint.keywords.some((kw) => lower.includes(kw))) {
      return hint;
    }
  }
  // Return first hint as fallback if nothing matched
  return config.criteriaHints[0] ?? null;
}
