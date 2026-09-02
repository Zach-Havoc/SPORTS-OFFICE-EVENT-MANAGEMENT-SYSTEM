/**
 * Pure helpers for the admin User Management screen — role labels, client-side
 * filtering, and the headline counts. Kept out of the component so they can be
 * unit-tested without React.
 */

export type UserRole = 'admin' | 'coach' | 'athlete' | 'judge';

export interface ManagedUserLinks {
  athleteCount: number;
  scoreCount: number;
  assignedEventCount: number;
  registrationCode?: string | null;
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  department?: string | null;
  sport?: string | null;
  sports?: string[] | null;
  genderCategory?: string | null;
  coachName?: string | null;
  createdAt?: string | null;
  links: ManagedUserLinks;
}

export interface UserFilters {
  search: string;
  role: UserRole | 'all';
  status: 'all' | 'active' | 'inactive';
}

export const EMPTY_FILTERS: UserFilters = { search: '', role: 'all', status: 'all' };

/** "judge" is surfaced as "Committee" everywhere in the UI. */
export const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  coach: 'Coach',
  athlete: 'Athlete',
  judge: 'Committee',
};

export const roleLabel = (role: string): string => ROLE_LABEL[role as UserRole] ?? role;

export function filterUsers(users: ManagedUser[], f: UserFilters): ManagedUser[] {
  const q = f.search.trim().toLowerCase();
  return users.filter((u) => {
    if (f.role !== 'all' && u.role !== f.role) return false;
    if (f.status === 'active' && !u.active) return false;
    if (f.status === 'inactive' && u.active) return false;
    if (q && !`${u.name} ${u.email}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function summarizeUsers(users: ManagedUser[]) {
  const by = (role: UserRole) => users.filter((u) => u.role === role).length;
  return {
    total: users.length,
    admins: by('admin'),
    coaches: by('coach'),
    committees: by('judge'),
    athletes: by('athlete'),
    inactive: users.filter((u) => !u.active).length,
  };
}

/** True when deleting this account would strand dependent records. */
export function hasDependents(u: ManagedUser): boolean {
  return u.links.athleteCount > 0 || u.links.scoreCount > 0;
}
