import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * useEventLiveScore / useLiveScores subscribe to the public `live-scores`
 * Reverb channel and merge every `.updated` push straight into the React
 * Query cache via `applyLiveUpdate` (SportAxisWeb/src/app/hooks/api.ts).
 *
 * `applyLiveUpdate` does an unconditional `list[i] = live` / cache overwrite
 * — it never compares the incoming payload's `version` against what's
 * already cached. Two committee-scoring PUTs can commit and broadcast out of
 * order relative to each other (they run on independent PHP-FPM workers with
 * no shared lock — see LiveScoreController::upsert, which also has no
 * DB::transaction/lockForUpdate around its read-check-write), and Reverb/
 * Pusher only guarantees *within-connection* delivery order, not the order
 * two different backend workers actually broadcast in. If the newer write's
 * broadcast reaches the client before the older write's, this hook will
 * apply the older payload last and the visible score regresses until the
 * next 60s fallback poll.
 *
 * This test drives the hook's `.updated` listener directly (bypassing the
 * network) with a newer-then-older pair sharing the same eventId, which is
 * exactly what `applyLiveUpdate` receives in that ordering. It fails today,
 * proving the missing version guard.
 */

vi.mock('../services/api', () => ({
  getEventLiveScore: vi.fn().mockResolvedValue({ live: null }),
  getLiveScores: vi.fn().mockResolvedValue([]),
}))

type Listener = (payload: { live: unknown }) => void
let updatedListener: Listener | null = null

vi.mock('../lib/echo', () => ({
  getEcho: () => ({
    channel: () => ({
      listen: (event: string, cb: Listener) => {
        if (event === '.updated') updatedListener = cb
        return { listen: vi.fn() }
      },
    }),
  }),
}))

import { useEventLiveScore } from './api'

const liveAt = (version: number, homeScore: number) => ({
  eventId: 'evt-1',
  sport: 'Basketball',
  homeTeam: 'College of Engineering',
  awayTeam: 'College of Business',
  homeScore,
  awayScore: 0,
  period: null,
  detail: [],
  status: 'in_progress' as const,
  version,
  updatedBy: 'judge-1',
  startedAt: null,
  finalizedAt: null,
  updatedAt: null,
})

describe('live score websocket cache merge — out-of-order delivery', () => {
  beforeEach(() => {
    updatedListener = null;
    // Reset the module-level "already subscribed" guard so each test gets
    // its own listener bound via the mocked echo client.
    vi.resetModules()
  })

  it('does not let a stale (lower-version) push overwrite a newer cached score', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children)

    const { result } = renderHook(() => useEventLiveScore('evt-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(updatedListener).not.toBeNull()

    // Newer write (version 5, home=40) is broadcast and received first...
    updatedListener!({ live: liveAt(5, 40) })
    // ...then a stale write (version 4, home=32) — issued earlier by another
    // committee device — arrives after it, because the two PUTs landed on
    // different backend workers with no ordering guarantee between them.
    updatedListener!({ live: liveAt(4, 32) })

    await waitFor(() => {
      const cached = qc.getQueryData<{ live: { version: number; homeScore: number } }>([
        'live-scores',
        'event',
        'evt-1',
      ])
      // BUG: applyLiveUpdate has no version check, so the stale version-4
      // push clobbers the already-cached version-5 state and the board
      // regresses to a 12-point-lower score until the next 60s poll.
      expect(cached?.live.version).toBe(5)
      expect(cached?.live.homeScore).toBe(40)
    })
  })
})
