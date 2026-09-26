import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/page/PageHeader';
import { StatStrip } from '../../components/page/StatStrip';
import { EmptyState } from '../../components/page/EmptyState';
import { RefreshStatus } from '../../components/RefreshStatus';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ArrowRight, Inbox, Search } from 'lucide-react';
import { useTransactions } from '../../hooks/api';
import type { OfficeTransaction } from '../../services/api';

const TYPE_LABEL: Record<OfficeTransaction['type'], string> = {
  cmo_requirement: 'CMO requirement',
  tryout_application: 'Tryout application',
  protest: 'Protest',
};

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Decided' },
];

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const variantOf = (t: OfficeTransaction): 'warning' | 'success' | 'danger' | 'neutral' => {
  if (t.open) return 'warning';
  return ['approved', 'accepted', 'upheld'].includes(t.status) ? 'success'
    : ['rejected', 'dismissed'].includes(t.status) ? 'danger' : 'neutral';
};

/**
 * The Sports Office transaction log: every request the office processes —
 * CMO requirement submissions, tryout applications and game protests — in
 * one list with its reference, who filed it, status, and when it was filed
 * and decided. Each row opens the module where it is acted on.
 */
export default function AdminTransactions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!user || user.role !== 'admin') navigate('/login');
  }, [user, navigate]);

  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Debounce the search box so typing doesn't fire a request per key.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(q.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const query = useTransactions({ type, status, q: search, page });
  const rows = query.data?.data ?? [];
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / (query.data?.perPage ?? 25)));

  if (!user) return null;

  return (
    <div className="page-container px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Transactions"
        description="Every request the Sports Office processes — CMO requirements, tryout applications and protests — in one log."
        actions={<RefreshStatus fetching={query.isFetching && !query.isLoading} error={query.isRefetchError} onRetry={() => query.refetch()} />}
      />

      <StatStrip
        stats={[
          { label: 'Open', value: query.data?.counts.open ?? 0, tone: (query.data?.counts.open ?? 0) ? 'warning' : 'default' },
          { label: 'Decided', value: query.data?.counts.closed ?? 0 },
          { label: 'Showing', value: total },
        ]}
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex w-fit rounded-lg border bg-white p-1" role="tablist">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={status === t.value}
              onClick={() => { setStatus(t.value); setPage(1); }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                status === t.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
            <SelectTrigger className="h-10 sm:w-52" aria-label="Type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="cmo_requirement">CMO requirements</SelectItem>
              <SelectItem value="tryout_application">Tryout applications</SelectItem>
              <SelectItem value="protest">Protests</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative sm:w-72">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Search name, subject, reference…" value={q} onChange={(e) => setQ(e.target.value)} className="h-10 pl-9" />
          </div>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {query.isLoading ? (
          <div className="py-12 text-center text-sm text-slate-500">Loading transactions…</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Inbox} title="No transactions match" description="Try another type, status or search." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50 text-left text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Reference</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Filed by</th>
                  <th className="px-4 py-2.5">Subject</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Filed</th>
                  <th className="px-4 py-2.5">Decided</th>
                  <th className="px-4 py-2.5"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((t) => (
                  <tr key={`${t.type}-${t.id}`} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{t.reference}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-700">{TYPE_LABEL[t.type]}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{t.party}</td>
                    <td className="max-w-[18rem] truncate px-4 py-2.5 text-slate-700" title={t.subject}>{t.subject}</td>
                    <td className="px-4 py-2.5"><Badge variant={variantOf(t)} className="capitalize">{t.status}</Badge></td>
                    <td className="px-4 py-2.5 whitespace-nowrap tabular-nums text-slate-600">{fmt(t.filedAt)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap tabular-nums text-slate-600">{fmt(t.decidedAt)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Link to={t.link} className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:underline">
                        Open <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm text-slate-600">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="tabular-nums">Page {page} of {pages}</span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
