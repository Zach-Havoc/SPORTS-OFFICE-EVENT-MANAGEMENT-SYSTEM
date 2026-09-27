import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, DatabaseZap, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { getDemoResetLink, runDemoReset, type DemoResetLink, type DemoResetResult } from '../../services/api';

/** What the server does, in order — shown while it runs, then with each step's time. */
const STEPS = [
  ['Backup', 'Back up the database'],
  ['Wipe', 'Clear everything but the admin accounts'],
  ['CollegeSeeder', 'Colleges'],
  ['SportSeeder', 'Sports and divisions'],
  ['AccountSeeder', 'Coach, judge and athlete accounts'],
  ['TeamLineupSeeder', 'Rosters and racquet lines'],
  ['EventSeeder', 'Season, venues and side events'],
  ['BracketSeeder', 'Brackets and schedule'],
  ['ResultSeeder', 'Results and live games'],
  ['RankingSeeder', 'Standings and medals'],
  ['MiscSeeder', 'Announcements, attendance, requirements, notifications'],
] as const;

const SHOWN_COUNTS = ['colleges', 'teams', 'coaches', 'judges', 'athletes', 'venues', 'brackets', 'games completed', 'games live', 'games scheduled'];

type Phase = 'idle' | 'running' | 'done' | 'failed';

/**
 * Settings → System: wipe the site (keeping the admin accounts) and load the
 * demo intramurals. The server has to allow it (ALLOW_DEMO_RESET); the admin
 * types the confirmation phrase, and the request goes to a signed link
 * fetched just before it's sent.
 */
export default function DemoResetCard() {
  const [status, setStatus] = useState<DemoResetLink | null>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<DemoResetResult | null>(null);
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    getDemoResetLink().then(setStatus).catch(() => setStatus({ enabled: false, message: 'Could not check whether demo reset is allowed.' }));
    return () => clearInterval(timer.current);
  }, []);

  const phrase = status?.confirmation ?? 'RESET SPORTAXIS';
  const matches = typed === phrase;

  const openDialog = () => {
    setTyped('');
    setPhase('idle');
    setResult(null);
    setError('');
    setOpen(true);
  };

  const run = async () => {
    setPhase('running');
    setElapsed(0);
    const started = Date.now();
    timer.current = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    try {
      // A fresh signed link each time: they expire after 15 minutes.
      const link = await getDemoResetLink();
      if (!link.enabled || !link.url) throw new Error(link.message || 'Demo reset is turned off on this server.');
      const r = await runDemoReset(link.url, typed);
      setResult(r);
      setPhase('done');
      toast.success(`Demo data loaded in ${r.seconds}s`);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'The reset failed.');
      setPhase('failed');
    } finally {
      clearInterval(timer.current);
    }
  };

  return (
    <Card className="border-danger-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DatabaseZap className="h-5 w-5 text-danger-text" />
          Demo data
        </CardTitle>
        <p className="text-sm text-text-secondary mt-1">
          Replace everything on the site with a fully played demo intramurals: the seven colleges, every sport's
          Men's and Women's teams with coaches, athletes and lineups, brackets with results and live games,
          rankings, announcements and more. Admin accounts are kept, and the database is backed up first.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {status && !status.enabled && (
          <p className="text-sm text-text-secondary">
            {status.message} To allow it on this server, set <code className="font-mono text-xs">ALLOW_DEMO_RESET=true</code> in the backend's <code className="font-mono text-xs">.env</code>.
          </p>
        )}
        <Button variant="destructive" onClick={openDialog} disabled={!status?.enabled}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset &amp; Load Demo Data
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={(v) => phase !== 'running' && setOpen(v)}>
        <DialogContent className="max-w-lg" onInteractOutside={(e) => phase === 'running' && e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {phase === 'done' ? <CheckCircle2 className="h-5 w-5 text-[var(--success-text)]" /> : <AlertTriangle className="h-5 w-5 text-danger-text" />}
              {phase === 'done' ? 'Demo data loaded' : 'Reset and load demo data?'}
            </DialogTitle>
            {phase === 'idle' && (
              <DialogDescription>
                This deletes every coach, athlete and judge account, every game, result and record on the site. Admin
                accounts and the colleges' logos stay. A backup is saved on the server before anything is deleted.
              </DialogDescription>
            )}
          </DialogHeader>

          {phase === 'idle' && (
            <div className="space-y-2">
              <Label htmlFor="demo-reset-phrase">
                Type <span className="font-mono font-semibold">{phrase}</span> to confirm
              </Label>
              <Input
                id="demo-reset-phrase"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                onKeyDown={(e) => e.key === 'Enter' && matches && run()}
              />
            </div>
          )}

          {phase !== 'idle' && (
            <ol className="space-y-1.5 text-sm" aria-live="polite">
              {STEPS.map(([key, label]) => {
                const seconds = result?.steps[key];
                return (
                  <li key={key} className="flex items-center justify-between gap-3">
                    <span className={seconds !== undefined ? 'text-text' : 'text-text-secondary'}>{label}</span>
                    <span className="tabular-nums text-xs text-text-secondary">{seconds !== undefined ? `${seconds}s` : ''}</span>
                  </li>
                );
              })}
            </ol>
          )}

          {phase === 'running' && (
            <p className="flex items-center gap-2 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Working… {elapsed}s. Usually under a minute. Keep this window open.
            </p>
          )}

          {phase === 'failed' && (
            <p className="rounded-md border border-danger-border bg-danger-subtle p-3 text-sm text-danger-text">{error}</p>
          )}

          {phase === 'done' && result && (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-md border border-border p-3">
                {SHOWN_COUNTS.map((k) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-text-secondary capitalize">{k}</span>
                    <span className="tabular-nums font-medium">{result.counts[k] ?? 0}</span>
                  </div>
                ))}
              </div>
              <p className="text-text-secondary">
                Done in {result.seconds}s. Backup: <span className="font-mono text-xs">{result.backup}</span>. Every demo
                account's password is <span className="font-mono">Sportaxis@2026</span>; the full list is in{' '}
                <span className="font-mono text-xs">storage/app/demo-credentials.csv</span> on the server.
              </p>
            </div>
          )}

          <DialogFooter>
            {phase === 'idle' && (
              <>
                <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                <Button variant="destructive" disabled={!matches} onClick={run}>Reset &amp; load</Button>
              </>
            )}
            {phase === 'failed' && <Button variant="secondary" onClick={() => setOpen(false)}>Close</Button>}
            {phase === 'done' && <Button onClick={() => window.location.reload()}>Reload the site</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
