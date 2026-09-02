import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  login,
  getEvents,
  getAthletes,
} from './api'

/**
 * The shared apiRequest() wrapper (exercised through the exported helpers):
 *  - builds the right URL / method / JSON headers
 *  - attaches a bearer token for authed calls, and refuses without one
 *  - converts snake_case response keys to camelCase
 *  - surfaces Laravel-style error payloads as Error messages
 *  - on 401/403 for an authed call, clears the stored token
 */

const BASE = 'http://localhost:8000/api'

/** Build a minimal fake Response. */
function fakeResponse(body: unknown, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  localStorage.clear()
})

describe('apiRequest — request building', () => {
  it('GET helper hits the right URL with JSON headers and no auth header', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse([{ id: '1' }]))

    await getEvents()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe(`${BASE}/events`)
    expect(opts.method ?? 'GET').toBe('GET')
    expect(opts.headers['Content-Type']).toBe('application/json')
    expect(opts.headers['Accept']).toBe('application/json')
    expect(opts.headers.Authorization).toBeUndefined()
  })

  it('login helper POSTs the credentials as a JSON body', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ token: 't' }))

    await login('me@example.com', 'hunter2')

    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe(`${BASE}/login`)
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body)).toEqual({ email: 'me@example.com', password: 'hunter2' })
  })
})

describe('apiRequest — authentication', () => {
  it('throws before calling fetch when an authed helper has no token', async () => {
    await expect(getAthletes()).rejects.toThrow(/not logged in/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('attaches the stored bearer token for authed helpers', async () => {
    localStorage.setItem('auth_token', 'abc.def.ghi')
    fetchMock.mockResolvedValueOnce(fakeResponse([]))

    await getAthletes()

    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.headers.Authorization).toBe('Bearer abc.def.ghi')
  })

  it('clears the token and reports an expired session on a 401', async () => {
    localStorage.setItem('auth_token', 'abc')
    fetchMock.mockResolvedValueOnce(fakeResponse({ message: 'Unauthenticated.' }, { ok: false, status: 401 }))

    await expect(getAthletes()).rejects.toThrow(/session has expired/i)
    expect(localStorage.getItem('auth_token')).toBeNull()
  })
})

describe('apiRequest — response handling', () => {
  it('deep-converts snake_case keys to camelCase', async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse({
        coach_id: 'c1',
        nested_obj: { start_time: '09:00' },
        list: [{ a_b: 1 }],
      }),
    )

    const data: any = await getEvents()

    expect(data).toEqual({
      coachId: 'c1',
      nestedObj: { startTime: '09:00' },
      list: [{ aB: 1 }],
    })
  })

  it('returns {} for an empty response body', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(''))
    await expect(getEvents()).resolves.toEqual({})
  })

  it('surfaces a plain {error} payload as the thrown message', async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse({ error: 'Invalid enrollment code' }, { ok: false, status: 400 }),
    )
    await expect(getEvents()).rejects.toThrow('Invalid enrollment code')
  })

  it('flattens a Laravel validation error bag (422)', async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(
        { message: 'The given data was invalid.', errors: { email: ['required'], password: ['too short'] } },
        { ok: false, status: 422 },
      ),
    )
    await expect(getEvents()).rejects.toThrow('required, too short')
  })
})
