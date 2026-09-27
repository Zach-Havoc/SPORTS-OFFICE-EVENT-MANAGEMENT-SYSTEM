import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * useGameScoreboard subscribes to `live-scores.{eventId}` and applies each
 * `.scoreboard` push (the full state) to the cache — unless a newer version
 * is already there — and refetches when the socket reconnects, since pushes
 * sent while it was down are lost.
 */

const getGameScoreboard = vi.fn()
vi.mock('../services/api', () => ({
  getGameScoreboard: (id: string) => getGameScoreboard(id),
}))

type Handler = (payload: unknown) => void
const listeners: Record<string, Handler> = {}
const stateHandlers: Handler[] = []

vi.mock('../lib/echo', () => ({
  getEcho: () => ({
    channel: () => ({
      listen: (event: string, cb: Handler) => {
        listeners[event] = cb
      },
      stopListening: () => {},
    }),
    leave: () => {},
    connector: {
      pusher: {
        connection: {
          bind: (_e: string, cb: Handler) => stateHandlers.push(cb),
          unbind: () => {},
        },
      },
    },
  }),
}))

import { useGameScoreboard } from './api'

const board = (version: number, home: number) => ({
  eventId: 'g1',
  version,
  teams: [{ id: 'h', score: home }],
})

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
  return renderHook(() => useGameScoreboard('g1'), { wrapper })
}

describe('useGameScoreboard', () => {
  beforeEach(() => {
    getGameScoreboard.mockReset()
    stateHandlers.length = 0
  })

  it('applies a newer push and ignores an older one', async () => {
    getGameScoreboard.mockResolvedValue(board(3, 10))
    const { result } = setup()
    await waitFor(() => expect(result.current.data?.version).toBe(3))

    act(() => listeners['.scoreboard']({ scoreboard: board(5, 14) }))
    await waitFor(() => expect(result.current.data?.version).toBe(5))

    act(() => listeners['.scoreboard']({ scoreboard: board(4, 12) }))
    expect(result.current.data?.teams[0].score).toBe(14)
  })

  it('refetches the scoreboard when the socket reconnects', async () => {
    getGameScoreboard.mockResolvedValue(board(1, 0))
    const { result } = setup()
    await waitFor(() => expect(result.current.data?.version).toBe(1))
    expect(getGameScoreboard).toHaveBeenCalledTimes(1)

    getGameScoreboard.mockResolvedValue(board(7, 21))
    act(() => stateHandlers.forEach((h) => h({ previous: 'unavailable', current: 'connected' })))

    await waitFor(() => expect(result.current.data?.version).toBe(7))
    expect(getGameScoreboard).toHaveBeenCalledTimes(2)
  })
})
