import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * Athlete "My Schedule" — the date picker.
 *
 * The API hook is stubbed with a CICS Basketball athlete who has two games in
 * September 2026, on the 2nd and the 18th. We drive the calendar and assert
 * which games show.
 */

const game = (id: string, name: string, schedule: string, opponent: string) => ({
  id,
  name,
  category: 'Basketball',
  schedule,
  startTime: '09:00',
  endTime: '10:00',
  venueName: 'Joson Gym',
  status: 'upcoming' as const,
  departments: ['College of Informatics and Computing Sciences', opponent],
  opponents: [{ name: opponent, abbreviation: opponent === 'College of Engineering' ? 'CoE' : 'CTE' }],
})

vi.mock('../../hooks/api', () => ({
  useAthleteSchedule: () => ({
    data: {
      team: { college: 'College of Informatics and Computing Sciences', collegeAbbreviation: 'CICS', sports: ['Basketball'] },
      reason: null,
      events: [
        game('e1', 'Round 1', '2026-09-02', 'College of Engineering'),
        game('e2', 'Semi-Final', '2026-09-18', 'College of Teacher Education'),
      ],
    },
    isLoading: false,
    isFetching: false,
    isRefetchError: false,
    refetch: vi.fn(),
  }),
  useAthleteTraining: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
}))

vi.mock('../../utils/departments', () => ({ useDeptAbbreviator: () => (s: string) => s }))
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Angel Shane', role: 'athlete' } }),
}))
vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../../components/RefreshStatus', () => ({ RefreshStatus: () => null }))

import AthleteSchedule from './Schedule'

/**
 * A day in the visible month. react-day-picker gives each day button an
 * explicit `gridcell` role (which masks its button role), and renders the
 * neighbouring months' days too — so filter those out before matching.
 */
const dayCell = (n: string) =>
  screen
    .getAllByRole('gridcell')
    .filter(c => !c.className.includes('day-outside'))
    .find(c => c.textContent?.trim() === n)!

describe('Athlete schedule — date picker', () => {
  it('names the team and lists every game when no date is picked', () => {
    render(<AthleteSchedule />)

    expect(screen.getByText('CICS Basketball')).toBeInTheDocument()
    expect(screen.getByText('Round 1')).toBeInTheDocument()
    expect(screen.getByText('Semi-Final')).toBeInTheDocument()
    expect(screen.getByText('2 days with a game')).toBeInTheDocument()
  })

  it('marks the days that have a game, and only those', () => {
    render(<AthleteSchedule />)

    // The modifier class carries the dot; days without a game never get it.
    expect(dayCell('2').className).toMatch(/after:bg-\[#C8102E\]/)
    expect(dayCell('18').className).toMatch(/after:bg-\[#C8102E\]/)
    expect(dayCell('3').className).not.toMatch(/after:bg-\[#C8102E\]/)
  })

  it('shows only that day’s game once a date is picked', async () => {
    const user = userEvent.setup()
    render(<AthleteSchedule />)

    await user.click(dayCell('2'))

    expect(screen.getByText('Round 1')).toBeInTheDocument()
    expect(screen.queryByText('Semi-Final')).not.toBeInTheDocument()
  })

  it('says so when the picked day has no game, and can clear back to all', async () => {
    const user = userEvent.setup()
    render(<AthleteSchedule />)

    await user.click(dayCell('3'))
    expect(screen.getByText(/No games on 3 September 2026/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show all games/i }))
    expect(screen.getByText('Round 1')).toBeInTheDocument()
    expect(screen.getByText('Semi-Final')).toBeInTheDocument()
  })
})
