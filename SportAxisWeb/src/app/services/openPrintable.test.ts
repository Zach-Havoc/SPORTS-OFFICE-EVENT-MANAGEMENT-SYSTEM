import { describe, it, expect, vi, afterEach } from 'vitest'
import { openPrintable } from './api'

/**
 * Printing a report: the tab must open inside the click, before the report
 * has downloaded — a tab opened after an await is blocked as a pop-up — and
 * be filled with the page itself, not pointed at a blob: link (which could
 * come up blank).
 */
describe('openPrintable', () => {
  afterEach(() => vi.restoreAllMocks())

  function fakeWindow() {
    return {
      document: { write: vi.fn(), open: vi.fn(), close: vi.fn() },
      focus: vi.fn(),
      close: vi.fn(),
    }
  }

  it('opens the tab before the report arrives, then writes the report into it', async () => {
    const win = fakeWindow()
    const open = vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window)
    let resolve!: (v: { blob: Blob; filename: string }) => void
    const load = () => new Promise<{ blob: Blob; filename: string }>((r) => (resolve = r))

    const done = openPrintable(load)
    expect(open).toHaveBeenCalledWith('', '_blank')

    // jsdom's Blob has no text(); every browser's does.
    resolve({ blob: { text: async () => '<h1>Result</h1>' } as unknown as Blob, filename: 'r.html' })
    await done
    expect(win.document.write).toHaveBeenLastCalledWith('<h1>Result</h1>')
    expect(win.document.close).toHaveBeenCalled()
  })

  it('says pop-ups are blocked instead of failing silently', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    await expect(openPrintable(vi.fn())).rejects.toThrow(/Allow pop-ups/)
  })

  it('closes the tab when the report fails to load', async () => {
    const win = fakeWindow()
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window)
    await expect(openPrintable(() => Promise.reject(new Error('Export failed')))).rejects.toThrow('Export failed')
    expect(win.close).toHaveBeenCalled()
  })
})
