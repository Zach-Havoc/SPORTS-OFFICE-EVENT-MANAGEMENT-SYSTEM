import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Without a realtime socket (Reverb not configured — as on shared hosting —
 * not running, or dropped), live scores must still be live: the list polls
 * every few seconds instead of every minute. And a game going final refreshes
 * the schedule and results, not just the score.
 */

const getLiveScores = vi.fn()
vi.mock('../services/api', () => ({
  getLiveScores: (active: boolean) => getLiveScores(active),
}))
vi.mock('../lib/echo', () => ({
  getEcho: async () => null,
  isRealtimeConnected: () => false,
  onRealtimeChange: () => () => {},
  useRealtimeConnected: () => false,
}))

import { useLiveScores } from './api'

const game = (status: 'in_progress' | 'final', version: number) => ({
  eventId: 'g1', homeScore: version, awayScore: 0, status, version,
})

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
  const hook = renderHook(() => useLiveScores(), { wrapper })
  return { qc, ...hook }
}

describe('live scores without a socket', () => {
  beforeEach(() => getLiveScores.mockReset())

  it('polls every few seconds', async () => {
    getLiveScores.mockResolvedValue([game('in_progress', 1)])
    setup()
    await waitFor(() => expect(getLiveScores).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(getLiveScores).toHaveBeenCalledTimes(2), { timeout: 6_000 })
  }, 10_000)

  it('refreshes the schedule and results when a game goes final', async () => {
    getLiveScores.mockResolvedValue([game('in_progress', 1)])
    const { qc, result } = setup()
    await waitFor(() => expect(result.current.data?.[0].status).toBe('in_progress'))

    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    getLiveScores.mockResolvedValue([game('final', 2)])
    await result.current.refetch()

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['events'] }))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['matches'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['standings'] })
  })
})
