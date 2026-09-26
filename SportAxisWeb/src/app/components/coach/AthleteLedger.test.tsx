import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AthleteLedger, type LedgerEntry } from './AthleteLedger';

const entries: LedgerEntry[] = [
  { id: 'a1', kind: 'attendance', date: '2026-09-02', title: 'Morning drills', status: 'present' },
  { id: 'p1', kind: 'performance', date: '2026-09-20T10:00:00Z', title: 'Semi-final review', detail: 'Rating 8/10', remark: 'Great defense' },
  { id: 'r1', kind: 'requirement', date: '2026-08-15T08:00:00Z', title: 'Parental Consent', status: 'approved' },
  { id: 'g1', kind: 'game', date: '2026-09-18', title: 'CICS vs CoE' },
];

describe('AthleteLedger', () => {
  it('lists everything newest first, grouped by month', () => {
    render(<AthleteLedger athleteName="Ana Reyes" entries={entries} />);
    const items = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(items[0]).toContain('Semi-final review');
    expect(items[0]).toContain('Great defense');
    expect(items.at(-1)).toContain('Parental Consent');
    expect(screen.getByText('September 2026')).toBeInTheDocument();
    expect(screen.getByText('August 2026')).toBeInTheDocument();
  });

  it('filters to one kind of record', async () => {
    render(<AthleteLedger athleteName="Ana Reyes" entries={entries} />);
    await userEvent.click(screen.getByRole('tab', { name: /Games/ }));
    const list = screen.getAllByRole('listitem');
    expect(list).toHaveLength(1);
    expect(within(list[0]).getByText('CICS vs CoE')).toBeInTheDocument();
  });

  it('says so when nothing is recorded', () => {
    render(<AthleteLedger athleteName="Ana Reyes" entries={[]} />);
    expect(screen.getByText('Nothing recorded for this athlete yet.')).toBeInTheDocument();
  });
});
