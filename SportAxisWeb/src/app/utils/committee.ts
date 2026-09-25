/**
 * Whether a user may score an event: the office (admin) always, a committee
 * member (judge) only if assigned to that game. Mirrors Event::isScorableBy
 * on the backend, which is the real guard — this only keeps the UI honest.
 */
export function isAssignedCommittee(
  event: { judges?: Array<{ id?: string | null } | string> | null } | null | undefined,
  user: { id?: string; role?: string } | null | undefined,
): boolean {
  if (!event || !user) return false;
  if (user.role === 'admin') return true;
  if (user.role !== 'judge') return false;
  return (event.judges ?? []).some(j => (typeof j === 'string' ? j : j?.id) === user.id);
}
