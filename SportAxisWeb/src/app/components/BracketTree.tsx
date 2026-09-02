import { useEffect, useState } from 'react';
import { SingleEliminationBracket, Match as GLootMatch } from '@g-loot/react-tournament-brackets';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';
import { useDeptAbbreviator, shortDeptLabel } from '../utils/departments';

export interface BracketTreeMatch {
  id: string;
  stageLabel: string;
  homeTeam: string | null;
  awayTeam: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  winner: string | null;
  isBye: boolean;
  status: string;
  nextMatchId: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
}

/**
 * A connected single-elimination bracket (rounds joined by lines) with zoom +
 * fullscreen. Read-only by default; pass `onMatchClick` to make each match
 * open a manager (admin).
 */
export default function BracketTree({
  matches,
  onMatchClick,
}: {
  matches: BracketTreeMatch[];
  onMatchClick?: (matchId: string) => void;
}) {
  const abbr = useDeptAbbreviator();
  // Bracket boxes are a fixed height — a full college name wraps to 4+ lines and
  // swallows the opponent. Always render a compact label here.
  const short = (name: string | null) => shortDeptLabel(abbr, name);
  const [zoom, setZoom] = useState(1);
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFull(false);
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [full]);

  const clamp = (z: number) => Math.min(3, Math.max(0.4, parseFloat(z.toFixed(2))));

  // g-loot's default header renderer prints `Round ${tournamentRoundText}` for
  // early columns (→ "Round Round 1", "Round Quarter-Finals") and hard-codes
  // "Semi-final" / "Final" for the last two. Supplying a generator replaces all
  // of that with one consistent scheme that matches the rest of the app.
  const roundText = (current: number, total: number): string => {
    switch (total - current) {
      case 0: return 'Finals';
      case 1: return 'Semi-Finals';
      case 2: return 'Quarter-Finals';
      default: return `Round ${current}`;
    }
  };

  const gmatches = matches.map((m) => ({
    id: m.id,
    nextMatchId: m.nextMatchId,
    tournamentRoundText: m.stageLabel,
    startTime: m.scheduledDate ? `${m.scheduledDate} ${m.scheduledTime ?? ''}`.trim() : '',
    state: m.status === 'completed' ? 'DONE' : 'SCHEDULED',
    participants: [
      {
        id: m.homeTeam ?? `tbd-h-${m.id}`,
        name: m.homeTeam ? short(m.homeTeam) : m.isBye ? 'BYE' : 'TBD',
        isWinner: !!m.winner && m.winner === m.homeTeam,
        status: null,
        resultText: m.homeScore != null ? String(m.homeScore) : '',
      },
      {
        id: m.awayTeam ?? `tbd-a-${m.id}`,
        name: m.awayTeam ? short(m.awayTeam) : m.isBye ? 'BYE' : 'TBD',
        isWinner: !!m.winner && m.winner === m.awayTeam,
        status: null,
        resultText: m.awayScore != null ? String(m.awayScore) : '',
      },
    ],
  }));

  const toolbar = (
    <div className="flex shrink-0 items-center gap-2 border-b bg-gray-50 px-3 py-2">
      <span className="mr-auto text-xs font-medium text-gray-500">Bracket</span>
      <button className="rounded p-1.5 text-gray-600 hover:bg-gray-200" title="Zoom out" onClick={() => setZoom((z) => clamp(z - 0.15))}>
        <ZoomOut className="h-4 w-4" />
      </button>
      <span className="w-10 text-center font-mono text-xs">{Math.round(zoom * 100)}%</span>
      <button className="rounded p-1.5 text-gray-600 hover:bg-gray-200" title="Zoom in" onClick={() => setZoom((z) => clamp(z + 0.15))}>
        <ZoomIn className="h-4 w-4" />
      </button>
      <button className="rounded p-1.5 text-gray-600 hover:bg-gray-200" title="Reset" onClick={() => setZoom(1)}>
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
      <div className="h-4 w-px bg-gray-300" />
      <button
        className="rounded p-1.5 text-gray-600 hover:bg-gray-200"
        title={full ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
        onClick={() => setFull((f) => !f)}
      >
        {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
    </div>
  );

  const tree = (
    <div className="p-4" style={{ zoom, width: 'max-content', minWidth: '100%' }}>
      <SingleEliminationBracket
        matches={gmatches as any}
        matchComponent={GLootMatch}
        options={{
          style: {
            roundHeader: {
              backgroundColor: '#B91C1C',
              fontColor: '#ffffff',
              roundTextGenerator: roundText,
            },
            connectorColor: '#CBD5E1',
            connectorColorHighlight: '#B91C1C',
          },
        } as any}
        onMatchClick={onMatchClick ? (args: any) => args?.match?.id && onMatchClick(args.match.id) : undefined}
      />
    </div>
  );

  if (full) {
    return (
      <div
        className="fixed inset-0 z-50 flex bg-black/60 p-3 sm:p-6"
        onClick={(e) => e.target === e.currentTarget && setFull(false)}
      >
        <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border bg-white shadow-2xl">
          {toolbar}
          <div className="min-h-0 flex-1 overflow-auto bg-white">{tree}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-md border bg-white">
      {toolbar}
      <div className="overflow-auto" style={{ maxHeight: 560 }}>
        {tree}
      </div>
    </div>
  );
}
