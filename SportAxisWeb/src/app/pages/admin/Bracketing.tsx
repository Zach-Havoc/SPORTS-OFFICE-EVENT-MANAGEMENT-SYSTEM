import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Trophy, RefreshCw, MapPin, Calendar, Users, ArrowRight, ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw, AlertTriangle, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { getDepartments, getVenues, getStandings, createBracket, publishBracket } from '../../services/api';
import { useBrackets } from '../../hooks/api';
import { Badge } from '../../components/ui/badge';
import { SingleEliminationBracket, Match as BracketMatch } from '@g-loot/react-tournament-brackets';
import { seededSlotOrder } from '../../utils/bracket';
import { makeAbbreviator, shortDeptLabel } from '../../utils/departments';

interface Venue {
  id: string;
  name: string;
  type: string;
  capacity: number;
  sports: string[];
  location: string;
  status: 'available' | 'maintenance' | 'unavailable';
}

interface Department {
  id: string;
  name: string;
  code: string;
}

interface Event {
  id: string;
  name: string;
  sport: string;
  category: string;
  date: string;
}

interface Match {
  id: string;
  round: number;
  position: number;
  team1: string;
  team2: string;
  venue?: Venue;
  date?: string;
  time?: string;
  winner?: string;
}

interface Bracket {
  sport: string;
  format: 'single-elimination' | 'round-robin';
  participants: string[];
  matches: Match[];
  startDate: string;
  rounds: number;
}

/** Saved (persisted) brackets for the chosen sport, with progression links. */
function SavedBrackets({ sport }: { sport: string }) {
  const { data } = useBrackets(sport || undefined);
  const list = (data ?? []) as Array<{ id: string; name: string; status: string; champion: string | null; matchCount: number }>;
  if (list.length === 0) return null;

  const dot: Record<string, string> = {
    draft: 'bg-gray-400', active: 'bg-blue-500', completed: 'bg-emerald-500',
  };

  return (
    <div className="rounded-md border border-gray-200">
      <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600">Saved brackets</div>
      <ul className="divide-y">
        {list.map((b) => (
          <li key={b.id}>
            <Link to={`/admin/bracketing/${b.id}`} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50">
              <span className={`h-2 w-2 shrink-0 rounded-full ${dot[b.status] ?? 'bg-gray-300'}`} />
              <span className="min-w-0 flex-1 truncate">
                {b.name}
                {b.champion && <span className="ml-1 text-xs text-emerald-600">· {b.champion} 🏆</span>}
              </span>
              <span className="text-xs text-gray-400">{b.matchCount}</span>
              <ChevronRight className="h-4 w-4 text-gray-300" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AdminBracketing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const abbr = useMemo(() => makeAbbreviator(departments), [departments]);
  // Compact label for tight bracket boxes — keeps 'TBD' / 'BYE' as-is.
  const shortTeam = (name?: string | null) =>
    !name || name === 'TBD' || name === 'BYE' ? (name ?? '') : shortDeptLabel(abbr, name);
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bracketZoom, setBracketZoom] = useState(1);
  const [bracketFullscreen, setBracketFullscreen] = useState(false);

  // While the bracket is in fullscreen: close on Escape and stop the page
  // behind it from scrolling.
  useEffect(() => {
    if (!bracketFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBracketFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [bracketFullscreen]);

  const [config, setConfig] = useState({
    sport: '',
    format: 'single-elimination' as 'single-elimination' | 'round-robin',
    participants: [] as string[],
    venueId: '' as string,   // '' = auto-assign a venue that matches the sport
    startDate: '',           // admin picks it — no default
    startTime: '',
    matchDuration: 60, // minutes
    breakDuration: 15, // minutes between matches
    drawMethod: 'random' as 'random' | 'standings' | 'manual',
  });

  // Standings for the selected sport (wins / point differential), used to seed.
  const [standings, setStandings] = useState<any[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(false);

  // One-line venue/time clash notice shown in the preview when a save is blocked.
  const [saveConflict, setSaveConflict] = useState<string | null>(null);

  const sportsList = [
    'Basketball', 'Volleyball', 'Badminton', 'Football',
    'Track & Field', 'Swimming', 'Tennis', 'Table Tennis'
  ];

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/login');
      return;
    }
    loadData();
  }, [user, navigate]);

  // Pull standings whenever the sport changes so we can seed / preview.
  useEffect(() => {
    if (!config.sport) { setStandings([]); return; }
    let cancelled = false;
    setStandingsLoading(true);
    getStandings(config.sport)
      .then((rows: any[]) => { if (!cancelled) setStandings(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (!cancelled) setStandings([]); })
      .finally(() => { if (!cancelled) setStandingsLoading(false); });
    return () => { cancelled = true; };
  }, [config.sport]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [depts, vens] = await Promise.all([
        getDepartments(),
        getVenues()
      ]);
      setDepartments(depts || []);
      const normalizedVenues = (vens || []).map((v: any) => ({
        ...v,
        sports: v.sports ?? [],
      }));
      setVenues(normalizedVenues.filter((v: Venue) => v.status === 'available'));
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const toggleParticipant = (deptName: string) => {
    setConfig(prev => ({
      ...prev,
      participants: prev.participants.includes(deptName)
        ? prev.participants.filter(p => p !== deptName)
        : [...prev.participants, deptName]
    }));
  };

  const selectAllParticipants = () => {
    setConfig(prev => ({
      ...prev,
      participants: departments.map(d => d.name)
    }));
  };

  const clearParticipants = () => {
    setConfig(prev => ({ ...prev, participants: [] }));
  };

  /** Venues whose `sports` list explicitly names this sport. */
  const venuesForSport = (sport: string): Venue[] =>
    venues.filter(v =>
      (v.sports || []).some(s => s && s.toLowerCase() === sport.toLowerCase()),
    );

  /**
   * Pick the venue for a match.
   *
   *  - If the admin chose a specific venue in the config, always use that.
   *  - Otherwise only auto-assign a venue that EXPLICITLY lists this sport.
   *    If none does, return `undefined` so the match stays "TBD" rather than
   *    being dumped somewhere wrong (e.g. Swimming in the Main Gymnasium).
   *    The admin is warned and can add/pick a venue.
   */
  const assignVenueForMatch = (sport: string): Venue | undefined => {
    if (config.venueId) {
      return venues.find(v => v.id === config.venueId);
    }

    const pool = venuesForSport(sport);
    if (pool.length === 0) return undefined;

    // Nudge toward the right kind of facility when the venue `type` is set.
    const sportLower = sport.toLowerCase();
    let preferred: string | null = null;
    if (['basketball', 'volleyball', 'badminton', 'table tennis', 'tennis'].includes(sportLower)) {
      preferred = 'court';
    } else if (sportLower === 'swimming') {
      preferred = 'pool';
    } else if (['football', 'track & field'].includes(sportLower)) {
      preferred = 'field';
    }

    if (preferred) {
      const match = pool.find(v => (v.type || '').toLowerCase().includes(preferred!));
      if (match) return match;
    }

    return pool[0];
  };

  const parseStartDateTime = (startDateStr: string, startTimeStr: string): Date => {
    try {
      const dateParts = (startDateStr || '').split('-').map(Number);
      const timeParts = (startTimeStr || '09:00').split(':').map(Number);
      if (dateParts.length === 3 && !isNaN(dateParts[0])) {
        const d = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], timeParts[0] || 9, timeParts[1] || 0);
        if (!isNaN(d.getTime())) return d;
      }
    } catch (e) {
      console.error('Error parsing datetime:', e);
    }
    return new Date();
  };

  const formatLocalDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatLocalTime = (d: Date): string => {
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const generateSingleEliminationBracket = (seededOrder?: (string | null)[]): Bracket => {
    const participants = [...config.participants];
    const numParticipants = participants.length;

    // Calculate number of rounds needed
    const rounds = Math.ceil(Math.log2(numParticipants));
    const totalSlots = Math.pow(2, rounds);

    // Slot the teams. Seeded = #1 vs lowest, #1/#2 in opposite halves, byes to
    // the top seeds. Otherwise fall back to a random draw.
    let slots: (string | null)[];
    if (seededOrder && seededOrder.length === totalSlots) {
      slots = [...seededOrder];
    } else {
      const shuffled = [...participants].sort(() => Math.random() - 0.5);
      slots = [];
      for (let i = 0; i < totalSlots; i++) {
        slots.push(i < shuffled.length ? shuffled[i] : null);
      }
    }

    // Generate matches for all rounds
    const matches: Match[] = [];
    let matchId = 0;
    let currentDate = parseStartDateTime(config.startDate, config.startTime);

    for (let round = 1; round <= rounds; round++) {
      const matchesInRound = Math.pow(2, rounds - round);

      for (let pos = 0; pos < matchesInRound; pos++) {
        const team1Index = pos * 2 * Math.pow(2, round - 1);
        const team2Index = team1Index + Math.pow(2, round - 1);

        const team1 = round === 1 ? slots[team1Index] : 'TBD';
        const team2 = round === 1 ? slots[team2Index] : 'TBD';

        // Skip if both teams are byes
        if (team1 === null && team2 === null) continue;

        // Auto-advance if one team is a bye
        let winner: string | undefined = undefined;
        if (team1 === null && team2) winner = team2;
        if (team2 === null && team1) winner = team1;

        const venue = assignVenueForMatch(config.sport);

        matches.push({
          id: `${round}_${pos}`,
          round,
          position: pos,
          team1: team1 || 'BYE',
          team2: team2 || 'BYE',
          venue,
          date: formatLocalDate(currentDate),
          time: formatLocalTime(currentDate),
          winner
        });

        // Add match duration + break for next match
        currentDate = new Date(currentDate.getTime() + (config.matchDuration + config.breakDuration) * 60000);
      }

      // Add extra break between rounds
      currentDate = new Date(currentDate.getTime() + 30 * 60000);
    }

    return {
      sport: config.sport,
      format: 'single-elimination',
      participants: config.participants,
      matches,
      startDate: config.startDate,
      rounds
    };
  };

  const generateRoundRobinBracket = (): Bracket => {
    const participants = [...config.participants];
    const numParticipants = participants.length;

    // Round robin: each team plays every other team once
    const matches: Match[] = [];
    let matchId = 0;
    let currentDate = parseStartDateTime(config.startDate, config.startTime);
    let round = 1;

    for (let i = 0; i < numParticipants; i++) {
      for (let j = i + 1; j < numParticipants; j++) {
        const venue = assignVenueForMatch(config.sport);

        matches.push({
          id: `match_${matchId++}`,
          round,
          position: matchId,
          team1: participants[i],
          team2: participants[j],
          venue,
          date: formatLocalDate(currentDate),
          time: formatLocalTime(currentDate)
        });

        // Add match duration + break
        currentDate = new Date(currentDate.getTime() + (config.matchDuration + config.breakDuration) * 60000);

        // If it's past 6 PM, move to next day at start time
        if (currentDate.getHours() >= 18) {
          currentDate.setDate(currentDate.getDate() + 1);
          const [startH, startM] = (config.startTime || '09:00').split(':').map(Number);
          currentDate.setHours(startH || 9);
          currentDate.setMinutes(startM || 0);
          round++;
        }
      }
    }

    const totalRounds = Math.max(...matches.map(m => m.round));

    return {
      sport: config.sport,
      format: 'round-robin',
      participants: config.participants,
      matches,
      startDate: config.startDate,
      rounds: totalRounds
    };
  };

  const handleGenerateBracket = () => {
    if (!config.sport) {
      toast.error('Please select a sport');
      return;
    }

    if (config.participants.length < 2) {
      toast.error('Please select at least 2 participants');
      return;
    }

    if (!config.startDate || !config.startTime) {
      toast.error('Set a start date and time.');
      return;
    }

    setSaveConflict(null);
    setGenerating(true);

    try {
      let seededOrder: (string | null)[] | undefined;

      if (config.format === 'single-elimination') {
        let ordered = [...config.participants];

        if (config.drawMethod === 'standings') {
          const rank = new Map<string, number>();
          standings.forEach((row: any, i: number) => rank.set(row.department, i));
          if (config.participants.every((p) => !rank.has(p))) {
            toast.error('No standings for this sport yet.');
            setGenerating(false);
            return;
          }
          ordered.sort((a, b) => (rank.get(a) ?? 9999) - (rank.get(b) ?? 9999));
        } else if (config.drawMethod === 'random') {
          ordered = ordered.sort(() => Math.random() - 0.5);
        }
        // 'manual' → keep the order the admin selected them in.

        seededOrder = seededSlotOrder(ordered);
      }

      const newBracket = config.format === 'single-elimination'
        ? generateSingleEliminationBracket(seededOrder)
        : generateRoundRobinBracket();

      setBracket(newBracket);
      const drawNote =
        config.format !== 'single-elimination' ? '' :
        config.drawMethod === 'standings' ? ' · seeded from standings' :
        config.drawMethod === 'random' ? ' · random draw' : ' · manual order';
      const seededNote = drawNote;
      toast.success(`Bracket generated — ${newBracket.matches.length} matches${seededNote}`);

      // Flag matches with no venue so the admin sets one before saving.
      const missingVenue = newBracket.matches.some(
        (m) => !m.venue && m.team1 !== 'BYE' && m.team2 !== 'BYE',
      );
      if (missingVenue) {
        toast.warning(`No venue for ${config.sport} — matches saved as “TBD”.`);
      }
    } catch (error: any) {
      console.error('Error generating bracket:', error);
      toast.error('Failed to generate bracket');
    } finally {
      setGenerating(false);
    }
  };

  // Persist the bracket server-side (authoritative generation), then publish
  // it into scheduled events. On a venue clash the bracket is kept as a draft
  // and we land on its detail page so the admin can adjust and re-publish.
  const handleSaveBracket = async () => {
    if (!bracket) return;

    try {
      setSaveConflict(null);
      setGenerating(true);

      const payload = {
        sport: config.sport,
        format: config.format === 'single-elimination' ? 'single_elimination' : 'round_robin',
        participants: config.participants,
        drawMethod: config.format === 'single-elimination' ? config.drawMethod : 'manual',
        startDate: config.startDate,
        startTime: config.startTime,
        matchDuration: config.matchDuration,
        breakDuration: config.breakDuration,
        venueId: config.venueId || null,
      };

      const created = await createBracket(payload);

      try {
        await publishBracket(created.id);
      } catch (e: any) {
        setSaveConflict(e?.message || 'Venue already scheduled for one or more matches.');
        toast.error('Saved as draft — resolve the venue clash, then publish.');
        navigate(`/admin/bracketing/${created.id}`);
        return;
      }

      toast.success('Bracket saved and events created.');
      setBracket(null);
      navigate(`/admin/bracketing/${created.id}`);
    } catch (error: any) {
      console.error('Error saving bracket:', error);
      toast.error(error.message || 'Failed to save bracket.');
    } finally {
      setGenerating(false);
    }
  };

  const getRoundName = (round: number, totalRounds: number, format: string) => {
    if (format === 'round-robin') {
      return `Round ${round}`;
    }

    const remaining = totalRounds - round + 1;
    if (remaining === 1) return 'Finals';
    if (remaining === 2) return 'Semi-Finals';
    if (remaining === 3) return 'Quarter-Finals';
    return `Round ${round}`;
  };

  if (!user) return null;

  const formatMatchesForBracketUI = (matches: Match[], rounds: number) => {
    return matches.map(match => {
      const nextRound = match.round + 1;
      const nextPosition = Math.floor(match.position / 2);
      const nextMatchId = match.round < rounds ? `${nextRound}_${nextPosition}` : null;
      
      return {
        id: match.id,
        nextMatchId,
        tournamentRoundText: getRoundName(match.round, rounds, 'single-elimination'),
        startTime: `${match.date} ${match.time}`,
        state: match.winner ? 'DONE' : 'SCHEDULED',
        participants: [
          {
            id: match.team1,
            isWinner: match.winner === match.team1,
            status: null,
            name: shortTeam(match.team1)
          },
          {
            id: match.team2,
            isWinner: match.winner === match.team2,
            status: null,
            name: shortTeam(match.team2)
          }
        ]
      };
    });
  };

  const renderSingleEliminationBracket = () => {
    if (!bracket) return null;

    const clampZoom = (z: number) => Math.min(3, Math.max(0.4, parseFloat(z.toFixed(2))));

    const toolbar = (
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-gray-50 shrink-0">
        <span className="text-xs text-gray-500 font-medium mr-auto">Bracket View</span>
        <button
          onClick={() => setBracketZoom(z => clampZoom(z - 0.15))}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-600" title="Zoom out"
        ><ZoomOut className="h-4 w-4" /></button>
        <span className="text-xs w-10 text-center font-mono">{Math.round(bracketZoom * 100)}%</span>
        <button
          onClick={() => setBracketZoom(z => clampZoom(z + 0.15))}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-600" title="Zoom in"
        ><ZoomIn className="h-4 w-4" /></button>
        <button
          onClick={() => setBracketZoom(1)}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-600" title="Reset zoom"
        ><RotateCcw className="h-3.5 w-3.5" /></button>
        <div className="w-px h-4 bg-gray-300" />
        <button
          onClick={() => setBracketFullscreen(f => !f)}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
          title={bracketFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
        >{bracketFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
      </div>
    );

    // Render the bracket at its natural SVG size and let the surrounding box
    // scroll. Zoom is applied with CSS `zoom` so scrollbars track the scaled
    // content (unlike `transform`, which doesn't affect layout).
    const bracketEl = (
      <div
        className="p-4"
        style={{ zoom: bracketZoom, width: 'max-content', minWidth: '100%' }}
      >
        <SingleEliminationBracket
          matches={formatMatchesForBracketUI(bracket.matches, bracket.rounds)}
          matchComponent={BracketMatch}
          options={{
            style: {
              roundHeader: {
                backgroundColor: '#B91C1C',
                fontColor: '#ffffff',
                // g-loot's default prints "Round <text>" for early columns and
                // hard-codes "Semi-final" / "Final" for the last two — supplying
                // a generator replaces all of that.
                roundTextGenerator: (current: number, total: number) => {
                  switch (total - current) {
                    case 0: return 'Finals';
                    case 1: return 'Semi-Finals';
                    case 2: return 'Quarter-Finals';
                    default: return `Round ${current}`;
                  }
                },
              },
              connectorColor: '#CBD5E1',
              connectorColorHighlight: '#B91C1C',
            },
          } as any}
        />
      </div>
    );

    if (bracketFullscreen) {
      return (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex p-3 sm:p-6"
          onClick={(e) => { if (e.target === e.currentTarget) setBracketFullscreen(false); }}
        >
          <div className="bg-white rounded-xl shadow-2xl border w-full h-full flex flex-col overflow-hidden">
            {toolbar}
            <div className="flex-1 min-h-0 overflow-auto bg-white">
              {bracketEl}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="border rounded-md overflow-hidden bg-white flex flex-col">
        {toolbar}
        <div className="overflow-auto" style={{ maxHeight: 520 }}>
          {bracketEl}
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Automatic Bracketing</h1>
        <p className="text-gray-600 mt-2">Generate tournament brackets with intelligent venue assignment</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Set up your tournament</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sport">Sport *</Label>
              <select
                id="sport"
                className="w-full rounded-md border border-gray-300 px-3 py-2"
                value={config.sport}
                onChange={(e) => setConfig({ ...config, sport: e.target.value })}
              >
                <option value="">Select sport</option>
                {sportsList.map(sport => (
                  <option key={sport} value={sport}>{sport}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="format">Format *</Label>
              <select
                id="format"
                className="w-full rounded-md border border-gray-300 px-3 py-2"
                value={config.format}
                onChange={(e) => setConfig({ ...config, format: e.target.value as any })}
              >
                <option value="single-elimination">Single Elimination</option>
                <option value="round-robin">Round Robin</option>
              </select>
            </div>

            {config.format === 'single-elimination' && (
              <div className="space-y-1.5 rounded-md border border-gray-200 bg-gray-50 p-3">
                <label className="block text-sm font-medium text-gray-900">Draw method</label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={config.drawMethod}
                  onChange={(e) => setConfig({ ...config, drawMethod: e.target.value as typeof config.drawMethod })}
                >
                  <option value="random">Random draw</option>
                  <option value="standings">Seed from standings</option>
                  <option value="manual">Manual order (as selected)</option>
                </select>
                <p className="text-xs text-gray-500">
                  {config.drawMethod === 'random' &&
                    'Teams are shuffled, then slotted so #1 and #2 sit in opposite halves.'}
                  {config.drawMethod === 'standings' &&
                    'Rank by wins, then point differential. #1 plays the lowest seed; byes go to the top seeds.'}
                  {config.drawMethod === 'manual' &&
                    'Uses the exact order you ticked the colleges — first = seed #1.'}
                </p>
              </div>
            )}

            {config.sport && (
              <div className="rounded-md border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600">
                  <span>Standings — {config.sport}</span>
                  {standingsLoading && <span className="font-normal text-gray-400">loading…</span>}
                </div>
                {standings.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-gray-400">
                    No completed matches recorded for this sport yet.
                  </p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="px-3 py-1.5 font-medium">#</th>
                        <th className="px-3 py-1.5 font-medium">Team</th>
                        <th className="px-2 py-1.5 font-medium text-center">W‑L</th>
                        <th className="px-2 py-1.5 font-medium text-right">Diff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((r: any) => (
                        <tr key={r.department} className="border-b border-gray-50 last:border-0">
                          <td className="px-3 py-1.5 tabular-nums text-gray-500">{r.seed}</td>
                          <td className="px-3 py-1.5 font-medium text-gray-800">{r.department}</td>
                          <td className="px-2 py-1.5 text-center tabular-nums">{r.wins}‑{r.losses}</td>
                          <td className={`px-2 py-1.5 text-right tabular-nums ${Number(r.point_diff) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {Number(r.point_diff) > 0 ? '+' : ''}{r.point_diff}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={config.startDate}
                onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time *</Label>
              <Input
                id="startTime"
                type="time"
                value={config.startTime}
                onChange={(e) => setConfig({ ...config, startTime: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="venue">Venue</Label>
              <select
                id="venue"
                className="w-full rounded-md border border-gray-300 px-3 py-2"
                value={config.venueId}
                onChange={(e) => setConfig({ ...config, venueId: e.target.value })}
              >
                <option value="">
                  {config.sport ? `Auto — match to ${config.sport}` : 'Auto — match to sport'}
                </option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}{v.type ? ` · ${v.type}` : ''}
                  </option>
                ))}
              </select>
              {config.venueId ? (
                <p className="text-xs text-gray-500">All matches use this venue.</p>
              ) : config.sport && venuesForSport(config.sport).length === 0 ? (
                <p className="text-xs text-amber-600">No venue for {config.sport} — matches will be “TBD”.</p>
              ) : (
                <p className="text-xs text-gray-500">Auto: a venue that lists {config.sport || 'the sport'}.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="matchDuration">Match Duration (min)</Label>
              <Input
                id="matchDuration"
                type="number"
                min="15"
                step="15"
                value={config.matchDuration}
                onChange={(e) => setConfig({ ...config, matchDuration: parseInt(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label>Participants ({config.participants.length} selected)</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAllParticipants}
                  className="flex-1"
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearParticipants}
                  className="flex-1"
                >
                  Clear
                </Button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2 border rounded-md p-3">
                {departments.map(dept => (
                  <label key={dept.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={config.participants.includes(dept.name)}
                      onChange={() => toggleParticipant(dept.name)}
                      className="rounded"
                    />
                    <span className="text-sm">{dept.name} ({dept.code})</span>
                  </label>
                ))}
              </div>
            </div>

            <Button
              onClick={handleGenerateBracket}
              disabled={generating || !config.sport || config.participants.length < 2 || !config.startDate || !config.startTime}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Generate Bracket
            </Button>

            <SavedBrackets sport={config.sport} />
          </CardContent>
        </Card>

        {/* Bracket Display */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Bracket Preview</CardTitle>
            <CardDescription>
              {bracket
                ? `${bracket.sport} - ${bracket.format === 'single-elimination' ? 'Single Elimination' : 'Round Robin'} (${bracket.matches.length} matches)`
                : 'Configure and generate a bracket to preview'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!bracket ? (
              <div className="text-center py-12 text-gray-500">
                <Trophy className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="mb-2">No bracket generated yet</p>
                <p className="text-sm">Select sport, format, and participants to generate a bracket</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Venue / time conflict — save blocked */}
                {saveConflict && (
                  <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Venue conflict — not saved. {saveConflict}
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <Users className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                        <div className="text-2xl font-bold">{bracket.participants.length}</div>
                        <div className="text-xs text-gray-600">Participants</div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <Trophy className="h-6 w-6 mx-auto mb-2 text-yellow-600" />
                        <div className="text-2xl font-bold">{bracket.matches.length}</div>
                        <div className="text-xs text-gray-600">Matches</div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <Calendar className="h-6 w-6 mx-auto mb-2 text-green-600" />
                        <div className="text-2xl font-bold">{bracket.rounds}</div>
                        <div className="text-xs text-gray-600">Rounds</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Matches by Round */}
                {bracket.format === 'single-elimination' ? renderSingleEliminationBracket() : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {Array.from({ length: bracket.rounds }, (_, i) => i + 1).map(round => {
                      const roundMatches = bracket.matches.filter(m => m.round === round);
                      if (roundMatches.length === 0) return null;

                      return (
                        <div key={round}>
                          <h3 className="font-semibold text-lg mb-3">
                            {getRoundName(round, bracket.rounds, bracket.format)}
                          </h3>
                          <div className="space-y-2">
                            {roundMatches.map(match => (
                              <Card key={match.id} className="border-l-4 border-l-blue-500">
                                <CardContent className="py-3 px-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 text-sm">
                                        <span className={match.team1 === 'BYE' ? 'text-gray-400' : 'font-medium'}>
                                          {match.team1}
                                        </span>
                                        <ArrowRight className="h-3 w-3 text-gray-400" />
                                        <span className={match.team2 === 'BYE' ? 'text-gray-400' : 'font-medium'}>
                                          {match.team2}
                                        </span>
                                      </div>
                                      {match.winner && (
                                        <Badge variant="secondary" className="mt-1 text-xs">
                                          Winner: {match.winner}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-right text-xs text-gray-600 space-y-1">
                                      <div className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {match.date} {match.time}
                                      </div>
                                      {match.venue ? (
                                        <div className="flex items-center gap-1">
                                          <MapPin className="h-3 w-3" />
                                          {match.venue.name}
                                          {match.venue.type && (
                                            <Badge variant="outline" className="ml-1 text-xs">
                                              {match.venue.type}
                                            </Badge>
                                          )}
                                        </div>
                                      ) : (
                                        match.team1 !== 'BYE' && match.team2 !== 'BYE' && (
                                          <div className="flex items-center gap-1 text-amber-600">
                                            <MapPin className="h-3 w-3" />
                                            Venue: TBD
                                          </div>
                                        )
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button onClick={() => { setBracket(null); setSaveConflict(null); }} variant="outline" className="flex-1">
                    Clear Bracket
                  </Button>
                  <Button onClick={handleSaveBracket} disabled={generating} className="flex-1">
                    {generating ? 'Saving…' : 'Save & Publish'}
                  </Button>
                </div>
                <p className="text-xs text-gray-400 text-center">
                  Saves the bracket and creates its events. Advance winners from the bracket page as results come in.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
