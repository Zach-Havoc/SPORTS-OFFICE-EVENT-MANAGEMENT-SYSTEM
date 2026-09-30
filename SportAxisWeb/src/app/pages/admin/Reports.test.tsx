import { describe, it, expect, vi } from 'vitest'
import { render, waitFor, screen, fireEvent } from '@testing-library/react'

/**
 * Admin Reports — the event-picker dropdown.
 *
 * /events is one of the six endpoints that migrated to Laravel's paginate()
 * shape. Every other full-list consumer (useEvents, useAthletes, useUsers,
 * useAnnouncements, useRegistrationCodes, useRequirements, and
 * EventsEnhanced's own fetchAllEvents) walks every page and merges the
 * results. This screen calls `getEvents` directly with a single generous
 * `perPage`, unwraps the first page, and never asks for page 2+ — so once a
 * season has more completed/ongoing events than one page holds, older
 * events silently disappear from the report picker.
 */

const getEventReport = vi.fn()
const getEventScores = vi.fn()
const getEvents = vi.fn()

vi.mock('../../services/api', async () => {
  const actual = await vi.importActual<typeof import('../../services/api')>(
    '../../services/api',
  )
  return {
    ...actual,
    getEvents: (...a: unknown[]) => getEvents(...a),
    getEventReport: (...a: unknown[]) => getEventReport(...a),
    getEventScores: (...a: unknown[]) => getEventScores(...a),
    exportEventReport: vi.fn(),
    exportLeaderboard: vi.fn(),
    exportCertificates: vi.fn(),
    deliverExport: vi.fn(),
    verifyScore: vi.fn(),
    disputeScore: vi.fn(),
    officializeEvent: vi.fn(),
  }
})

// AdminReports' events effect depends on [user, navigate]; a fresh object/fn
// per render would change that dependency's identity every render and
// refire the effect forever, so both are held stable across renders.
const user = { id: 'a1', name: 'Admin', role: 'admin' }
const navigate = vi.fn()
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user }),
}))
vi.mock('react-router', () => ({ useNavigate: () => navigate }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import AdminReports from './Reports'

describe('Admin Reports — event picker pagination', () => {
  it('fetches every page of /events, not just the first, once the backend paginates', async () => {
    // Two completed events, split across two pages of one each — the
    // shape /events returns once paginated (see services/api.ts Paginated<T>).
    getEvents.mockResolvedValueOnce({
      data: [{ id: 'e1', name: 'Basketball Finals', status: 'completed' }],
      currentPage: 1,
      lastPage: 2,
      perPage: 1,
      total: 2,
    })
    getEvents.mockResolvedValueOnce({
      data: [{ id: 'e2', name: 'Volleyball Finals', status: 'completed' }],
      currentPage: 2,
      lastPage: 2,
      perPage: 1,
      total: 2,
    })

    render(<AdminReports />)

    await waitFor(() => expect(getEvents).toHaveBeenCalled())
    // Give any (absent) follow-up page request a chance to fire.
    await new Promise((r) => setTimeout(r, 0))

    // This is the bug: Reports.tsx only ever requests page 1, so the second
    // completed event never reaches the dropdown's option list.
    expect(getEvents).toHaveBeenCalledTimes(2)
  })
})

describe('Admin Reports — a match event', () => {
  it('shows the recorded result instead of an empty report', async () => {
    getEvents.mockReset()
    getEvents.mockResolvedValueOnce([
      { id: 'm1', name: 'Volleyball — Men: CICS vs CET', status: 'completed', category: 'Volleyball — Men', schedule: '2026-09-10' },
    ])
    getEventScores.mockResolvedValueOnce([])
    getEventReport.mockResolvedValueOnce({
      event: {
        id: 'm1', name: 'Volleyball — Men: CICS vs CET', category: 'Volleyball — Men', format: 'versus',
        schedule: '2026-09-10', startTime: '09:00', endTime: null, venue: 'Gym', status: 'completed',
        season: 'Intramurals 2026', departments: ['CICS', 'CET'], officials: [],
      },
      match: {
        state: 'final', home: 'CICS', away: 'CET', homeScore: 3, awayScore: 1, winner: 'CICS', isDraw: false,
        stage: 'Semi-Finals', playedAt: null, recordedBy: 'Committee One', periodUnit: 'Set',
        periods: [
          { label: 'Set 1', home: 25, away: 18 }, { label: 'Set 2', home: 22, away: 25 },
          { label: 'Set 3', home: 25, away: 23 }, { label: 'Set 4', home: 25, away: 20 },
        ],
        scorers: [],
      },
      rankings: [], scores: [], protests: [], generatedAt: '2026-09-30 10:00:00',
    })

    render(<AdminReports />)
    fireEvent.click(await screen.findByRole('button', { name: /CICS vs CET/ }))

    expect(await screen.findByText('CICS won.')).toBeTruthy()
    expect(screen.getByText('Set 2')).toBeTruthy()
    expect(screen.getByText('Semi-Finals')).toBeTruthy()
    // A match has no judges, so the judge-score review stays out of the way.
    expect(screen.queryByText(/Judges/)).toBeNull()
  })
})

