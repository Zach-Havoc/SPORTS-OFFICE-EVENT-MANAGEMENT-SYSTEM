import { isAssignedCommittee } from '../committee';

const event = { judges: [{ id: 'j1', name: 'A' }] };

describe('isAssignedCommittee', () => {
  it('lets an assigned judge score', () => {
    expect(isAssignedCommittee(event, { id: 'j1', role: 'judge' })).toBe(true);
  });
  it('blocks a judge who is not on the game', () => {
    expect(isAssignedCommittee(event, { id: 'j2', role: 'judge' })).toBe(false);
    expect(isAssignedCommittee({ judges: [] }, { id: 'j1', role: 'judge' })).toBe(false);
  });
  it('always lets the office score', () => {
    expect(isAssignedCommittee({ judges: [] }, { id: 'x', role: 'admin' })).toBe(true);
  });
});
