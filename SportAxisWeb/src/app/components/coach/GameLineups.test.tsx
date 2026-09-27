import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CoachLineupGame, GameLineup } from '../../services/api';

const mutate = vi.fn();
let lineup: GameLineup;
const basketballLineup: GameLineup = {
  event: { id: 'g1', name: 'CICS vs CABE', category: 'Basketball', schedule: '2026-10-02' },
  sport: 'basketball',
  team: { id: 'd1', name: 'College of Informatics and Computing Sciences', abbreviation: 'CICS' },
  locked: false,
  players: [{ playerId: 'a1', name: 'Ana Reyes', jerseyNumber: '4', rotationPosition: null, hasPlays: true }],
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
  { id: 'g1', name: 'x', category: 'Basketball', sport: 'basketball', schedule: '2026-10-02', startTime: '09:00', venueName: 'Gym', status: 'upcoming', opponent: 'CABE', lineupCount: 0, locked: false },
  { id: 'g2', name: 'y', category: 'Basketball', sport: 'basketball', schedule: '2026-10-05', startTime: null, venueName: null, status: 'completed', opponent: 'CoE', lineupCount: 8, locked: true },
];

async function openDialog() {
  render(<GameLineups games={games} />);
  await userEvent.click(screen.getByRole('button', { name: 'Set lineup' }));
  return screen.getByRole('dialog');
}

describe('GameLineups', () => {
  beforeEach(() => {
    mutate.mockReset();
    lineup = basketballLineup;
  });

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
          { playerId: 'a1', jerseyNumber: '4', rotationPosition: null },
          { playerId: 'a2', jerseyNumber: '7', rotationPosition: null },
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

  it('asks volleyball coaches for a full starting rotation or none', async () => {
    lineup = {
      ...basketballLineup,
      sport: 'volleyball',
      players: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'].map((id, i) => ({
        playerId: id, name: `Player ${i + 1}`, jerseyNumber: String(i + 1), rotationPosition: null, hasPlays: false,
      })),
      candidates: [],
    };
    const dialog = await openDialog();
    expect(within(dialog).getAllByRole('combobox')).toHaveLength(7);

    await userEvent.selectOptions(within(dialog).getByLabelText('Starting position for Player 1'), '1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save lineup' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('needs all six positions (I–VI) — 1 set');

    for (let i = 2; i <= 6; i++) {
      await userEvent.selectOptions(within(dialog).getByLabelText(`Starting position for Player ${i}`), String(i));
    }
    // Taking a position moves whoever had it to the bench.
    await userEvent.selectOptions(within(dialog).getByLabelText('Starting position for Player 7'), '1');
    expect(within(dialog).getByLabelText('Starting position for Player 1')).toHaveValue('');
    await userEvent.selectOptions(within(dialog).getByLabelText('Starting position for Player 1'), '');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save lineup' }));
    const saved = mutate.mock.calls[0][0].players;
    expect(saved.find((p: any) => p.playerId === 'a7').rotationPosition).toBe(1);
    expect(saved.find((p: any) => p.playerId === 'a1').rotationPosition).toBeNull();
  });
});
