import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * Coach "My Schedule". Same view as the athlete's, but a coach can handle more
 * than one sport, so the team label lists them all and the calendar marks the
 * game days across every sport they run.
 */

const game = (id: string, name: string, category: string, schedule: string) => ({
  id,
  name,
  category,
  schedule,
  startTime: '09:00',
  endTime: '10:00',
  venueName: 'Joson Gym',
  status: 'upcoming' as const,
  departments: [],
  opponents: [{ name: 'College of Engineering', abbreviation: 'CoE' }],
})

vi.mock('../../hooks/api', () => ({
  useCoachSchedule: () => ({
    data: {
      team: {
        college: 'College of Informatics and Computing Sciences',
        collegeAbbreviation: 'CICS',
        sports: ['Basketball', 'Badminton'],
      },
      reason: null,
      events: [
        game('e1', 'Basketball R1', 'Basketball', '2026-09-02'),
        game('e2', 'Badminton QF', 'Badminton — M Singles A', '2026-09-18'),
      ],
    },
    isLoading: false,
    isFetching: false,
    isRefetchError: false,
    refetch: vi.fn(),
  }),
}))

vi.mock('../../utils/departments', () => ({ useDeptAbbreviator: () => (s: string) => s }))
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'c1', name: 'Head Coach Saipo', role: 'coach' } }),
}))
vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../../components/RefreshStatus', () => ({ RefreshStatus: () => null }))

import CoachSchedule from './Schedule'

const dayCell = (n: string) =>
  screen
    .getAllByRole('gridcell')
    .filter(c => !c.className.includes('day-outside'))
    .find(c => c.textContent?.trim() === n)!

describe('Coach schedule', () => {
  it('lists every sport the coach handles in the team label', () => {
    render(<CoachSchedule />)

    expect(screen.getByText('CICS Basketball, Badminton')).toBeInTheDocument()
    expect(screen.getByText('Basketball R1')).toBeInTheDocument()
    expect(screen.getByText('Badminton QF')).toBeInTheDocument()
    // the discipline is shown as the game's sport badge
    expect(screen.getByText('Badminton — M Singles A')).toBeInTheDocument()
  })

  it('marks a game day for each sport and filters to the picked one', async () => {
    const user = userEvent.setup()
    render(<CoachSchedule />)

    expect(dayCell('2').className).toMatch(/after:bg-\[#C8102E\]/)
    expect(dayCell('18').className).toMatch(/after:bg-\[#C8102E\]/)

    await user.click(dayCell('18'))

    expect(screen.getByText('Badminton QF')).toBeInTheDocument()
    expect(screen.queryByText('Basketball R1')).not.toBeInTheDocument()
  })
})
