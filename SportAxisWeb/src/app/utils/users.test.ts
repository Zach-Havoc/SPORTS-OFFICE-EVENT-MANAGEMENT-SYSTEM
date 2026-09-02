import { describe, it, expect } from 'vitest';
import {
  filterUsers,
  summarizeUsers,
  roleLabel,
  hasDependents,
  type ManagedUser,
} from './users';

const make = (over: Partial<ManagedUser> = {}): ManagedUser => ({
  id: Math.random().toString(36).slice(2),
  name: 'Jane Doe',
  email: 'jane@example.com',
  role: 'athlete',
  active: true,
  links: { athleteCount: 0, scoreCount: 0, assignedEventCount: 0 },
  ...over,
});

describe('roleLabel', () => {
  it('renders judge as Committee, passes others through', () => {
    expect(roleLabel('judge')).toBe('Committee');
    expect(roleLabel('coach')).toBe('Coach');
    expect(roleLabel('admin')).toBe('Admin');
    expect(roleLabel('weird')).toBe('weird');
  });
});

describe('filterUsers', () => {
  const users = [
    make({ name: 'Alice Admin', email: 'alice@x.com', role: 'admin', active: true }),
    make({ name: 'Bob Coach', email: 'bob@x.com', role: 'coach', active: true }),
    make({ name: 'Carla Committee', email: 'carla@x.com', role: 'judge', active: false }),
  ];

  it('matches on name or email, case-insensitively', () => {
    expect(filterUsers(users, { search: 'CARLA', role: 'all', status: 'all' })).toHaveLength(1);
    expect(filterUsers(users, { search: 'bob@x', role: 'all', status: 'all' })[0].name).toBe('Bob Coach');
  });

  it('filters by role and status independently', () => {
    expect(filterUsers(users, { search: '', role: 'coach', status: 'all' })).toHaveLength(1);
    expect(filterUsers(users, { search: '', role: 'all', status: 'inactive' })).toHaveLength(1);
    expect(filterUsers(users, { search: '', role: 'all', status: 'active' })).toHaveLength(2);
  });

  it('combines filters (AND)', () => {
    expect(filterUsers(users, { search: 'committee', role: 'admin', status: 'all' })).toHaveLength(0);
  });
});

describe('summarizeUsers', () => {
  it('counts by role and inactive', () => {
    const s = summarizeUsers([
      make({ role: 'admin' }),
      make({ role: 'coach' }),
      make({ role: 'judge' }),
      make({ role: 'judge', active: false }),
      make({ role: 'athlete' }),
    ]);
    expect(s).toEqual({ total: 5, admins: 1, coaches: 1, committees: 2, athletes: 1, inactive: 1 });
  });
});

describe('hasDependents', () => {
  it('is true when a coach has athletes or a committee member has scores', () => {
    expect(hasDependents(make({ links: { athleteCount: 2, scoreCount: 0, assignedEventCount: 0 } }))).toBe(true);
    expect(hasDependents(make({ links: { athleteCount: 0, scoreCount: 5, assignedEventCount: 0 } }))).toBe(true);
    expect(hasDependents(make())).toBe(false);
  });
});
