import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * Settings → System → "Reset & Load Demo Data": off unless the server allows
 * it, only runs once the phrase is typed exactly, and posts to a freshly
 * signed link.
 */

const api = vi.hoisted(() => ({
  getDemoResetLink: vi.fn(),
  runDemoReset: vi.fn(),
}))
vi.mock('../../services/api', () => api)
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import DemoResetCard from './DemoResetCard'

const enabled = { enabled: true, confirmation: 'RESET SPORTAXIS', url: '/api/admin/system/reset-demo?expires=1&signature=abc' }

describe('DemoResetCard', () => {
  beforeEach(() => {
    api.getDemoResetLink.mockReset()
    api.runDemoReset.mockReset()
  })

  it('is disabled, with the reason, when the server does not allow it', async () => {
    api.getDemoResetLink.mockResolvedValue({ enabled: false, message: 'Demo reset is turned off on this server (ALLOW_DEMO_RESET).' })
    render(<DemoResetCard />)

    expect(await screen.findByText(/turned off on this server/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reset & load demo data/i })).toBeDisabled()
  })

  it('runs only after the exact phrase is typed, then shows what was loaded', async () => {
    api.getDemoResetLink.mockResolvedValue(enabled)
    api.runDemoReset.mockResolvedValue({
      seconds: 6.4,
      backup: 'pre-reset-2026-09-27_134117.sql',
      counts: { colleges: 7, athletes: 630, 'games live': 7 },
      steps: { Backup: 0.2, Wipe: 0.4 },
      leaderboard: [],
    })
    const user = userEvent.setup()
    render(<DemoResetCard />)

    await user.click(await screen.findByRole('button', { name: /reset & load demo data/i }))
    const confirm = screen.getByRole('button', { name: /^reset & load$/i })
    await user.type(screen.getByLabelText(/to confirm/i), 'reset sportaxis')
    expect(confirm).toBeDisabled()

    await user.clear(screen.getByLabelText(/to confirm/i))
    await user.type(screen.getByLabelText(/to confirm/i), 'RESET SPORTAXIS')
    await user.click(confirm)

    await waitFor(() => expect(api.runDemoReset).toHaveBeenCalledWith(enabled.url, 'RESET SPORTAXIS'))
    expect(api.getDemoResetLink).toHaveBeenCalledTimes(2)   // a fresh signed link for the run
    expect(await screen.findByText('Demo data loaded')).toBeInTheDocument()
    expect(screen.getByText('630')).toBeInTheDocument()
    expect(screen.getByText('pre-reset-2026-09-27_134117.sql')).toBeInTheDocument()
  })

  it('shows the server error when the reset fails', async () => {
    api.getDemoResetLink.mockResolvedValue(enabled)
    api.runDemoReset.mockRejectedValue(new Error('Backup failed: mysqldump not found'))
    const user = userEvent.setup()
    render(<DemoResetCard />)

    await user.click(await screen.findByRole('button', { name: /reset & load demo data/i }))
    await user.type(screen.getByLabelText(/to confirm/i), 'RESET SPORTAXIS')
    await user.click(screen.getByRole('button', { name: /^reset & load$/i }))

    expect(await screen.findByText('Backup failed: mysqldump not found')).toBeInTheDocument()
  })
})
