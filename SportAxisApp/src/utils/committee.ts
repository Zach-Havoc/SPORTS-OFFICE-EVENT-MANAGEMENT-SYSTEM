import type { CommitteeMember } from '../types';

/**
 * Whether a user may score an event: the office (admin) always, a committee
 * member (judge) only if assigned to that game. Mirrors Event::isScorableBy
 * on the backend, which is the real guard — this keeps the app from opening
 * a score sheet the server would refuse.
 */
export function isAssignedCommittee(
  event: { judges?: CommitteeMember[] | null } | null | undefined,
  user: { id?: string; role?: string } | null | undefined,
): boolean {
  if (!event || !user) return false;
  if (user.role === 'admin') return true;
  if (user.role !== 'judge') return false;
  return (event.judges ?? []).some((j) => j?.id === user.id);
}

export const NOT_ASSIGNED_MESSAGE = 'You are not assigned to score this game.';
