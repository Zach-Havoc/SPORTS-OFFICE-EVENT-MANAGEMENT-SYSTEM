import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * Public "Apply for Tryout" form — client-side validation.
 *
 * We stub the data hooks + api calls so the component renders one tryout
 * announcement with a known department list, then drive the form.
 */

const verifyTryoutEmail = vi.fn()
const applyForTryout = vi.fn()

vi.mock('../../services/api', () => ({
  verifyTryoutEmail: (...a: unknown[]) => verifyTryoutEmail(...a),
  applyForTryout: (...a: unknown[]) => applyForTryout(...a),
}))

vi.mock('../../hooks/api', () => ({
  useAnnouncements: () => ({
    data: [
      {
        id: 'a1',
        title: 'Basketball Tryouts',
        content: 'Join us',
        sport: 'Basketball',
        coachId: 'c1',
        coachName: 'Coach K',
        isTryout: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    isLoading: false,
    isFetching: false,
    isRefetchError: false,
    refetch: vi.fn(),
  }),
  useDepartments: () => ({
    data: [
      { id: 'd1', name: 'College of Engineering', abbreviation: 'CoE' },
      { id: 'd2', name: 'College of Information Technology', abbreviation: 'CIT' },
    ],
  }),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

import PublicAnnouncements from './Announcements'

async function openForm() {
  const user = userEvent.setup()
  render(<PublicAnnouncements />)
  await user.click(screen.getByRole('button', { name: /apply for tryout/i }))
  const dialog = await screen.findByRole('dialog')
  return { user, dialog }
}

beforeEach(() => {
  verifyTryoutEmail.mockReset()
  applyForTryout.mockReset()
})

describe('Apply for Tryout — validation', () => {
  it('rejects a bad student ID, short phone, non-BatStateU email, and missing department', async () => {
    const { user, dialog } = await openForm()
    const form = within(dialog)

    await user.type(form.getByLabelText(/first name/i), 'Sam')
    await user.type(form.getByLabelText(/last name/i), 'Cruz')
    await user.type(form.getByLabelText(/student id/i), '123')        // not ##-#####
    await user.type(form.getByLabelText(/phone number/i), '0912')     // < 11 digits
    await user.type(form.getByLabelText(/university email/i), 'sam@gmail.com') // wrong domain

    await user.click(form.getByRole('button', { name: /send verification code/i }))

    expect(await form.findByText(/format ##-#####/i)).toBeInTheDocument()
    expect(form.getByText(/exactly 11 digits/i)).toBeInTheDocument()
    expect(form.getByText(/must end in @batstate-u\.edu\.ph/i)).toBeInTheDocument()
    expect(form.getByText(/select your department/i)).toBeInTheDocument()

    // Nothing was submitted.
    expect(verifyTryoutEmail).not.toHaveBeenCalled()
  })

  it('clears the field errors once valid values are entered', async () => {
    const { user, dialog } = await openForm()
    const form = within(dialog)

    // Fill every field but with invalid formats, then submit to surface errors.
    await user.type(form.getByLabelText(/first name/i), 'Sam')
    await user.type(form.getByLabelText(/last name/i), 'Cruz')
    await user.type(form.getByLabelText(/student id/i), '123')
    await user.type(form.getByLabelText(/phone number/i), '0912')
    await user.type(form.getByLabelText(/university email/i), 'sam@gmail.com')
    await user.click(form.getByRole('button', { name: /send verification code/i }))
    expect(await form.findByText(/format ##-#####/i)).toBeInTheDocument()

    // Correcting a field clears its error as you type.
    await user.type(form.getByLabelText(/student id/i), '2400001')
    await user.type(form.getByLabelText(/phone number/i), '09123456789')
    await user.clear(form.getByLabelText(/university email/i))
    await user.type(form.getByLabelText(/university email/i), 'sam@g.batstate-u.edu.ph')

    expect(form.queryByText(/format ##-#####/i)).not.toBeInTheDocument()
    expect(form.queryByText(/exactly 11 digits/i)).not.toBeInTheDocument()
    expect(form.queryByText(/must end in @batstate-u\.edu\.ph/i)).not.toBeInTheDocument()
  })

  it('auto-formats the student ID as ##-##### and strips non-digits from the phone', async () => {
    const { user, dialog } = await openForm()
    const form = within(dialog)

    const studentId = form.getByLabelText(/student id/i) as HTMLInputElement
    await user.type(studentId, '2375760')
    expect(studentId.value).toBe('23-75760')

    const phone = form.getByLabelText(/phone number/i) as HTMLInputElement
    await user.type(phone, '0912-345 6789')
    expect(phone.value).toBe('09123456789')
  })
})
