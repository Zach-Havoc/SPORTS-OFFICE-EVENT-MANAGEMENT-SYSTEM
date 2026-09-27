import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CoachLineupGame, GameLineup } from '../../services/api';

const mutate = vi.fn();
const lineup: GameLineup = {
  event: { id: 'g1', name: 'CICS vs CABE', category: 'Basketball', schedule: '2026-10-02' },
  team: { id: 'd1', name: 'College of Informatics and Computing Sciences', abbreviation: 'CICS' },
  locked: false,
  players: [{ playerId: 'a1', name: 'Ana Reyes', jerseyNumber: '4', hasPlays: true }],
  candidates: [
    { playerId: 'a2', name: 'Ben Santos', jerseyNumber: '7' },
    { playerId: 'a3', name: 'Cy Cruz', jerseyNumber: null },
  ],
};

vi.mock('../../hooks/api', () => ({
  useGameLineup: () => ({ data: lineup, isLoading: false, error: null }),
  useSaveGameLineup: () => ({ mutate, isPending: false }),
}));
vi.mock('../../utils/departments', () => ({ useDeptAbbreviator: () => (s: string) => s }));

import { GameLineups } from './GameLineups';

const games: CoachLineupGame[] = [
  { id: 'g1', name: 'x', category: 'Basketball', schedule: '2026-10-02', startTime: '09:00', venueName: 'Gym', status: 'upcoming', opponent: 'CABE', lineupCount: 0, locked: false },
  { id: 'g2', name: 'y', category: 'Basketball', schedule: '2026-10-05', startTime: null, venueName: null, status: 'completed', opponent: 'CoE', lineupCount: 8, locked: true },
];

async function openDialog() {
  render(<GameLineups games={games} />);
  await userEvent.click(screen.getByRole('button', { name: 'Set lineup' }));
  return screen.getByRole('dialog');
}

describe('GameLineups', () => {
  beforeEach(() => mutate.mockReset());

  it('shows each game with its lineup status', () => {
    render(<GameLineups games={games} />);
    expect(screen.getByText('No lineup yet')).toBeInTheDocument();
    expect(screen.getByText('8 players')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Final/ })).toBeDisabled();
  });

  it('keeps a player with plays in, and prefills the profile jersey', async () => {
    const dialog = await openDialog();
    const reyes = within(dialog).getByRole('checkbox', { name: /Ana Reyes/ });
    expect(reyes).toBeChecked();
    expect(reyes).toBeDisabled();

    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Ben Santos/ }));
    expect(within(dialog).getByLabelText('Jersey number for Ben Santos')).toHaveValue('7');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save lineup' }));
    expect(mutate).toHaveBeenCalledWith(
      {
        eventId: 'g1',
        players: [
          { playerId: 'a1', jerseyNumber: '4' },
          { playerId: 'a2', jerseyNumber: '7' },
        ],
      },
      expect.anything(),
    );
  });

  it('asks for a jersey number and rejects duplicates before saving', async () => {
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Cy Cruz/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save lineup' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Cy Cruz needs a jersey number');

    await userEvent.type(within(dialog).getByLabelText('Jersey number for Cy Cruz'), '4');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save lineup' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Ana Reyes and Cy Cruz both have #4');
    expect(mutate).not.toHaveBeenCalled();
  });
});
