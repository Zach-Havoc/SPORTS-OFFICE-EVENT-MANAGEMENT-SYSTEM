import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { DisciplineEntry, EventLineups } from '../../services/api';

let lineups: EventLineups | undefined;
let entries: DisciplineEntry[] = [];
vi.mock('../../hooks/api', () => ({
  useEventLineups: () => ({ data: lineups, isLoading: false }),
  useDisciplineEntries: () => ({ data: entries, isLoading: false }),
}));
vi.mock('../../utils/departments', () => ({ useDeptAbbreviator: () => (s: string) => s }));

import { MatchDetailModal, type ScheduleEvent, type TeamLookup } from './GameCard';

const teams = {
  info: (name: string) => ({ label: name, logoUrl: null }),
  record: () => null,
} as unknown as TeamLookup;

const game = (category: string): ScheduleEvent => ({
  id: 'g1', name: 'Finals', category, schedule: '2026-09-27', status: 'upcoming', departments: ['CICS', 'CABEIHM'],
});

describe('game details — lineups', () => {
  it("lists each team's players by jersey, and says when one hasn't submitted", () => {
    lineups = {
      sport: 'basketball',
      positionName: null,
      positions: [],
      teams: [
        { id: 'd1', side: 'home', name: 'CICS', label: 'CICS', abbreviation: 'CICS', players: [
          { jersey: '4', name: 'Ana Reyes', rotationPosition: null },
          { jersey: '7', name: 'Ben Santos', rotationPosition: null },
        ] },
        { id: 'd2', side: 'away', name: 'CABEIHM', label: 'CABEIHM', abbreviation: 'CABEIHM', players: [] },
      ],
    };
    render(<MatchDetailModal event={game('Basketball')} rankings={[]} teams={teams} onClose={() => {}} />);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Lineups')).toBeInTheDocument();
    expect(within(dialog).getByText('Ana Reyes')).toBeInTheDocument();
    expect(within(dialog).getByText('#7')).toBeInTheDocument();
    expect(within(dialog).getByText('Not submitted yet')).toBeInTheDocument();
  });

  it('marks the volleyball starting rotation', () => {
    lineups = {
      sport: 'volleyball',
      positionName: 'Starting rotation',
      positions: ['I', 'II', 'III', 'IV', 'V', 'VI'],
      teams: [
        { id: 'd1', side: 'home', name: 'CICS', label: 'CICS', abbreviation: 'CICS', players: [
          { jersey: '4', name: 'Ana Reyes', rotationPosition: 1 },
          { jersey: '9', name: 'Cy Cruz', rotationPosition: null },
        ] },
      ],
    };
    render(<MatchDetailModal event={game('Volleyball')} rankings={[]} teams={teams} onClose={() => {}} />);

    expect(screen.getByText('I')).toBeInTheDocument();
    expect(screen.getByText(/the starting rotation/)).toBeInTheDocument();
  });

  it("shows a sepak takraw regu's positions", () => {
    lineups = {
      sport: 'sepak takraw',
      positionName: 'Position',
      positions: ['Tekong', 'Feeder', 'Striker'],
      teams: [
        { id: 'd1', side: 'home', name: 'CICS', label: 'CICS', abbreviation: 'CICS', players: [
          { jersey: '1', name: 'Ana Reyes', rotationPosition: 1 },
        ] },
      ],
    };
    render(<MatchDetailModal event={game('Sepak Takraw')} rankings={[]} teams={teams} onClose={() => {}} />);
    expect(screen.getByText('Tekong')).toBeInTheDocument();
    expect(screen.queryByText(/the starting rotation/)).not.toBeInTheDocument();
  });

  it("shows a racquet line's players from the coaches' racquet lines", () => {
    lineups = undefined;
    entries = [
      { id: 'e1', category: 'Badminton — W Doubles', department: 'CICS', athleteId: 'a1', athleteName: 'Dee Ramos', pairSlot: 'D' },
      { id: 'e2', category: 'Badminton — W Doubles', department: 'CICS', athleteId: 'a2', athleteName: 'Cai Lim', pairSlot: 'C' },
      { id: 'e3', category: 'Badminton — W Doubles', department: 'CTE', athleteId: 'a3', athleteName: 'Not Playing', pairSlot: 'C' },
    ];
    render(<MatchDetailModal event={game('Badminton — W Doubles')} rankings={[]} teams={teams} onClose={() => {}} />);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText('Lineups')).not.toBeInTheDocument();
    expect(within(dialog).getByText('Players')).toBeInTheDocument();
    const names = within(dialog).getAllByRole('listitem').map((li) => li.textContent);
    expect(names).toEqual(['Cai Lim', 'Dee Ramos']); // pair C before D
    expect(within(dialog).queryByText('Not Playing')).not.toBeInTheDocument();
    expect(within(dialog).getByText('Not submitted yet')).toBeInTheDocument(); // CABEIHM
  });
});
