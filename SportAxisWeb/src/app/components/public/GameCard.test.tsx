import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { EventLineups } from '../../services/api';

let lineups: EventLineups | undefined;
vi.mock('../../hooks/api', () => ({
  useEventLineups: () => ({ data: lineups, isLoading: false }),
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

  it('has no lineup section for a sport not scored play-by-play', () => {
    lineups = undefined;
    render(<MatchDetailModal event={game('Chess')} rankings={[]} teams={teams} onClose={() => {}} />);
    expect(screen.queryByText('Lineups')).not.toBeInTheDocument();
  });
});
