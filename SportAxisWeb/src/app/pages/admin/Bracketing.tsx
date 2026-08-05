import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Trophy, RefreshCw, MapPin, Calendar, Users, ArrowRight, ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { getEvents, getDepartments, getVenues, createEvent } from '../../services/api';
import { Badge } from '../../components/ui/badge';
import { SingleEliminationBracket, Match as BracketMatch, SVGViewer } from '@g-loot/react-tournament-brackets';

interface Venue {
  id: string;
  name: string;
  type: 'indoor' | 'outdoor' | 'open';
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

export default function AdminBracketing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bracketZoom, setBracketZoom] = useState(1);
  const [bracketFullscreen, setBracketFullscreen] = useState(false);

  const [config, setConfig] = useState({
    sport: '',
    format: 'single-elimination' as 'single-elimination' | 'round-robin',
    participants: [] as string[],
    startDate: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    matchDuration: 60, // minutes
    breakDuration: 15, // minutes between matches
  });

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

  const assignVenueForMatch = (sport: string): Venue | undefined => {
    // Filter venues that support this sport safely
    const suitableVenues = venues.filter(v => {
      const sports = v.sports || [];
      return sports.length === 0 || sports.some(s => s && s.toLowerCase() === sport.toLowerCase());
    });

    if (suitableVenues.length === 0) {
      return undefined;
    }

    // Prioritize venue types based on sport
    const sportLower = sport.toLowerCase();
    let preferredType: 'indoor' | 'outdoor' | 'open' | null = null;

    if (['basketball', 'volleyball', 'badminton', 'table tennis'].includes(sportLower)) {
      preferredType = 'open'; // Gymnasium for court sports
    } else if (['swimming'].includes(sportLower)) {
      preferredType = 'indoor'; // Pool
    } else if (['football', 'track & field'].includes(sportLower)) {
      preferredType = 'outdoor'; // Field sports
    }

    // Try to find preferred type first
    if (preferredType) {
      const preferred = suitableVenues.find(v => v.type === preferredType);
      if (preferred) return preferred;
    }

    // Otherwise return first suitable venue
    return suitableVenues[0];
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

  const generateSingleEliminationBracket = (): Bracket => {
    const participants = [...config.participants];
    const numParticipants = participants.length;

    // Calculate number of rounds needed
    const rounds = Math.ceil(Math.log2(numParticipants));
    const totalSlots = Math.pow(2, rounds);

    // Add byes if needed
    const shuffled = [...participants].sort(() => Math.random() - 0.5);

    // Fill bracket with participants and byes
    const slots: (string | null)[] = [];
    for (let i = 0; i < totalSlots; i++) {
      if (i < shuffled.length) {
        slots.push(shuffled[i]);
      } else {
        slots.push(null); // Bye
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

    setGenerating(true);

    try {
      const newBracket = config.format === 'single-elimination'
        ? generateSingleEliminationBracket()
        : generateRoundRobinBracket();

      setBracket(newBracket);
      toast.success(`${config.format === 'single-elimination' ? 'Single Elimination' : 'Round Robin'} bracket generated with ${newBracket.matches.length} matches`);
    } catch (error: any) {
      console.error('Error generating bracket:', error);
      toast.error('Failed to generate bracket');
    } finally {
      setGenerating(false);
    }
  };

  const calculateEndTime = (startTimeStr: string, durationMinutes: number): string => {
    if (!startTimeStr) return '10:00';
    const [hours, minutes] = startTimeStr.split(':').map(Number);
    const totalMinutes = (hours || 9) * 60 + (minutes || 0) + (durationMinutes || 60);
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMins = totalMinutes % 60;
    return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
  };

  const handleSaveBracket = async () => {
    if (!bracket) return;

    try {
      setGenerating(true);

      // Filter out matches that are BYE vs BYE or BYE vs single team auto-advances
      const playableMatches = bracket.matches.filter(
        match => match.team1 !== 'BYE' && match.team2 !== 'BYE'
      );

      if (playableMatches.length === 0) {
        toast.error('No playable matches to save.');
        return;
      }

      // Create events for each match
      const eventPromises = playableMatches.map(match => {
        const roundLabel = getRoundName(match.round, bracket.rounds, bracket.format);
        const eventName = `${bracket.sport} (${roundLabel}): ${match.team1} vs ${match.team2}`;
        
        const startTime = match.time || config.startTime || '09:00';
        const endTime = calculateEndTime(startTime, config.matchDuration || 60);

        const depts = [match.team1, match.team2].filter(t => t && t !== 'TBD' && t !== 'BYE');
        const departmentsList = depts.length > 0 ? depts : bracket.participants;

        return createEvent({
          name: eventName,
          category: bracket.sport,
          schedule: match.date || config.startDate,
          startTime: startTime,
          endTime: endTime,
          venueId: match.venue?.id,
          venueName: match.venue?.name || 'TBD',
          departments: departmentsList,
          criteria: [{ name: 'Overall Performance', weight: 100 }],
          status: 'upcoming',
        });
      });

      await Promise.all(eventPromises);

      toast.success(`Successfully created ${playableMatches.length} event(s) from bracket`);
      setBracket(null);
      setDialogOpen(false);
      navigate('/admin/events');
    } catch (error: any) {
      console.error('Error saving bracket:', error);
      toast.error(error.message || 'Failed to save bracket as events');
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
            name: match.team1
          },
          {
            id: match.team2,
            isWinner: match.winner === match.team2,
            status: null,
            name: match.team2
          }
        ]
      };
    });
  };

  const renderSingleEliminationBracket = () => {
    if (!bracket) return null;
    const firstRoundMatches = Math.pow(2, bracket.rounds - 1);
    const svgW = Math.max(900, bracket.rounds * 280);
    const svgH = Math.max(500, firstRoundMatches * 120);
    const scaledW = Math.round(svgW * bracketZoom);
    const scaledH = Math.round(svgH * bracketZoom);

    const toolbar = (
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-gray-50 rounded-t-md">
        <span className="text-xs text-gray-500 font-medium mr-auto">Bracket View</span>
        <button
          onClick={() => setBracketZoom(z => Math.max(0.3, parseFloat((z - 0.15).toFixed(2))))}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-600" title="Zoom out"
        ><ZoomOut className="h-4 w-4" /></button>
        <span className="text-xs w-10 text-center font-mono">{Math.round(bracketZoom * 100)}%</span>
        <button
          onClick={() => setBracketZoom(z => Math.min(2, parseFloat((z + 0.15).toFixed(2))))}
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
          title={bracketFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >{bracketFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
      </div>
    );

    const viewer = (
      <div className="overflow-auto" style={{ maxHeight: bracketFullscreen ? 'calc(90vh - 56px)' : '520px' }}>
        <div style={{ width: scaledW, height: scaledH }}>
          <SingleEliminationBracket
            matches={formatMatchesForBracketUI(bracket.matches, bracket.rounds)}
            matchComponent={BracketMatch}
            svgWrapper={({ children, ...props }: any) => (
              <SVGViewer width={scaledW} height={scaledH} {...props}>
                {children}
              </SVGViewer>
            )}
          />
        </div>
      </div>
    );

    if (bracketFullscreen) {
      return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl overflow-hidden border">
            {toolbar}
            {viewer}
          </div>
        </div>
      );
    }

    return (
      <div className="border rounded-md overflow-hidden bg-white">
        {toolbar}
        {viewer}
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
              disabled={generating || !config.sport || config.participants.length < 2}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Generate Bracket
            </Button>
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
                                      {match.venue && (
                                        <div className="flex items-center gap-1">
                                          <MapPin className="h-3 w-3" />
                                          {match.venue.name}
                                          <Badge variant="outline" className="ml-1 text-xs">
                                            {match.venue.type}
                                          </Badge>
                                        </div>
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
                  <Button onClick={() => setBracket(null)} variant="outline" className="flex-1">
                    Clear Bracket
                  </Button>
                  <Button onClick={handleSaveBracket} disabled={generating} className="flex-1">
                    Save as Events
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
