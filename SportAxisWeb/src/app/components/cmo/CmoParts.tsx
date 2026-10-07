/** Pieces the coach's and the office's CMO views share. */
import { FileText } from 'lucide-react';
import type { CmoDocument, CmoEntry } from '../../services/api';
import { useCmoDocuments } from '../../hooks/api';

export type OfficeState = CmoEntry['status'] | 'not_submitted';

export const OFFICE_LABEL: Record<OfficeState, string> = {
  not_submitted: 'Not forwarded',
  submitted: 'With the office',
  accepted: 'Accepted',
  returned: 'Returned',
};

export const OFFICE_STYLE: Record<OfficeState, string> = {
  not_submitted: 'bg-gray-100 text-gray-600',
  submitted: 'bg-sky-100 text-sky-800',
  accepted: 'bg-emerald-100 text-emerald-700',
  returned: 'bg-red-100 text-red-700',
};

export function OfficeChip({ state }: { state: OfficeState }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold ${OFFICE_STYLE[state]}`}>
      {OFFICE_LABEL[state]}
    </span>
  );
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const DOC_STYLE: Record<CmoDocument['status'], string> = {
  approved: 'text-emerald-700',
  pending: 'text-amber-700',
  rejected: 'text-red-700',
};

/** An athlete's current documents, loaded when shown. */
export function AthleteDocuments({ athleteId, stacked = false }: { athleteId: string; stacked?: boolean }) {
  const docs = useCmoDocuments(athleteId);
  if (docs.isLoading) return <p className="py-2 text-xs text-gray-500">Loading documents…</p>;
  if (docs.isError) return <p className="py-2 text-xs text-red-600">Couldn&rsquo;t load the documents.</p>;
  const list = docs.data ?? [];
  if (list.length === 0) return <p className="py-2 text-xs text-gray-500">No documents uploaded.</p>;
  return (
    <ul className={`grid gap-1.5 py-1 ${stacked ? '' : 'sm:grid-cols-2'}`}>
      {list.map((d) => (
        <li key={d.id} className={`flex min-w-0 items-center justify-between gap-2 rounded-md border border-gray-200 bg-white ${stacked ? 'px-3 py-2.5' : 'px-2.5 py-1.5'}`}>
          <span className="min-w-0">
            <span className={`block truncate font-medium text-gray-900 ${stacked ? 'text-sm' : 'text-xs'}`}>{d.type}</span>
            <span className={`text-[11px] font-semibold ${d.status === 'approved' ? '' : 'capitalize'} ${DOC_STYLE[d.status]}`}>
              {d.status === 'approved' ? 'Approved by coach' : d.status}
            </span>
            {stacked && d.submittedAt && (
              <span className="text-[11px] text-gray-500"> · uploaded {fmtDate(d.submittedAt)}</span>
            )}
            {stacked && d.notes && <span className="block text-[11px] text-gray-600">{d.notes}</span>}
          </span>
          {d.fileUrl ? (
            <a
              href={d.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex shrink-0 items-center gap-1 font-medium text-gray-700 hover:text-gray-900 ${stacked ? 'rounded-md border border-gray-200 px-2.5 py-1 text-sm hover:bg-gray-50' : 'text-xs'}`}
            >
              <FileText className="h-3.5 w-3.5 text-red-600" />
              Open
            </a>
          ) : (
            <span className="text-[11px] text-gray-400">No file</span>
          )}
        </li>
      ))}
    </ul>
  );
}
