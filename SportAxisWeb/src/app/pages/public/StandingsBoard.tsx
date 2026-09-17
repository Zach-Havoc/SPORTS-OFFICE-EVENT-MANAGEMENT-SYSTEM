import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useLeaderboard, useLiveScores, useDepartments } from '../../hooks/api';
import type { LiveScore } from '../../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// Standings Board — a full-screen, chrome-free display for a venue TV.
// Open /standings on the laptop, press F11, cast. Auto-refreshes, rotates
// between the medal table and the live games, and animates rank changes.
//   /standings?category=Basketball   → one sport
//   /standings?interval=25           → seconds per view (default 18)
// ─────────────────────────────────────────────────────────────────────────────

interface Row {
  department: string;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
  eventCount?: number;
}

const RANK_TINT = ['bg-amber-50', 'bg-slate-100', 'bg-orange-50'];

// ── small animation helpers ─────────────────────────────────────────────────

/** Tween a number toward its new value whenever it changes. */
function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const a = fromRef.current;
    const b = value;
    if (a === b) return;
    const start = performance.now();
    const dur = 550;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      setDisplay(Math.round(a + (b - a) * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span className={className}>{display}</span>;
}

/** FLIP: when the row order changes, glide each row to its new position. */
function useFlip(order: string[]) {
  const els = useRef(new Map<string, HTMLElement>());
  const prev = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const next = new Map<string, number>();
    els.current.forEach((el, key) => next.set(key, el.getBoundingClientRect().top));

    els.current.forEach((el, key) => {
      const p = prev.current.get(key);
      const n = next.get(key);
      if (p == null || n == null) return;
      const dy = p - n;
      if (Math.abs(dy) < 1) return;
      el.style.transition = 'none';
      el.style.transform = `translateY(${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = 'transform 640ms cubic-bezier(.2,.7,.2,1)';
        el.style.transform = '';
      });
    });

    prev.current = next;
  }, [order.join('|')]);

  return (key: string) => (el: HTMLElement | null) => {
    if (el) els.current.set(key, el);
    else els.current.delete(key);
  };
}

// ── clock ───────────────────────────────────────────────────────────────────

/** University seal — drop the file at SportAxisWeb/public/batstateu-seal.png.
 *  Falls back to a trophy tile if the file isn't there yet. */
function Crest() {
  const [ok, setOk] = useState(true);
  if (!ok) {
    return (
      <div className="flex h-[3vw] w-[3vw] items-center justify-center rounded-lg bg-white/15">
        <span className="text-[1.55vw]">🏆</span>
      </div>
    );
  }
  return (
    <img
      src="/batstateu-seal.png"
      alt="Batangas State University"
      onError={() => setOk(false)}
      className="h-[3.5vw] w-[3.5vw] rounded-full bg-white object-contain p-[0.25vw] ring-2 ring-white/30"
    />
  );
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-right leading-tight">
      <div className="text-[1.4vw] font-semibold tabular-nums">
        {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
      <div className="text-[0.85vw] uppercase tracking-widest opacity-80">
        {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
      </div>
    </div>
  );
}

function CollegeCell({ name, logo, abbr }: { name: string; logo?: string | null; abbr?: string | null }) {
  return (
    <div className="flex items-center gap-[1.2vw] min-w-0">
      {logo ? (
        <img src={logo} alt="" className="h-[2.7vw] w-[2.7vw] rounded-full object-cover ring-1 ring-black/10 bg-white" />
      ) : (
        <div className="flex h-[2.7vw] w-[2.7vw] items-center justify-center rounded-full bg-red-100 text-[0.9vw] font-bold text-red-700">
          {(abbr || name.slice(0, 2)).toUpperCase()}
        </div>
      )}
      <span className="truncate text-[1.45vw] font-semibold">{name}</span>
    </div>
  );
}

// ── standings view ──────────────────────────────────────────────────────────

function StandingsView({ rows, logoOf, abbrOf, title }: {
  rows: Row[];
  logoOf: (name: string) => string | null | undefined;
  abbrOf: (name: string) => string | null | undefined;
  title: string;
}) {
  const setRef = useFlip(rows.map((r) => r.department));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline gap-[1.5vw] px-[3vw] pt-[2vw] pb-[1vw]">
        <h1 className="text-[2.2vw] font-extrabold uppercase tracking-wide text-gray-900">{title}</h1>
      </div>

      <div className="grid grid-cols-[6vw_1fr_7vw_7vw_7vw_10vw] items-center gap-x-[1vw] px-[3vw] pb-[0.6vw] text-[0.85vw] font-bold uppercase tracking-widest text-gray-400">
        <span className="text-center">Rank</span>
        <span>College</span>
        <span className="text-center">Gold</span>
        <span className="text-center">Silver</span>
        <span className="text-center">Bronze</span>
        <span className="text-right">Points</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-[2vw] pb-[1.5vw]">
        {rows.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-[1.4vw] text-gray-400">
            No results recorded yet.
          </div>
        ) : (
          rows.map((r, i) => (
            <div
              key={r.department}
              ref={setRef(r.department)}
              style={{ animationDelay: `${i * 55}ms` }}
              className={`board-row grid min-h-0 flex-1 grid-cols-[6vw_1fr_7vw_7vw_7vw_10vw] items-center gap-x-[1vw] rounded-xl px-[1vw] ${
                i === 0 ? 'leader-row' : i < 3 ? RANK_TINT[i] : i % 2 ? 'bg-gray-50' : ''
              }`}
            >
              <span className="text-center text-[1.7vw] font-extrabold text-gray-700">{i + 1}</span>
              <CollegeCell name={r.department} logo={logoOf(r.department)} abbr={abbrOf(r.department)} />
              <AnimatedNumber value={r.gold} className="text-center text-[1.6vw] font-bold text-amber-600 tabular-nums" />
              <AnimatedNumber value={r.silver} className="text-center text-[1.6vw] font-bold text-slate-500 tabular-nums" />
              <AnimatedNumber value={r.bronze} className="text-center text-[1.6vw] font-bold text-orange-600 tabular-nums" />
              <AnimatedNumber value={Math.round(r.total)} className="text-right text-[1.9vw] font-extrabold text-gray-900 tabular-nums" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── live view ───────────────────────────────────────────────────────────────

function LiveView({ games, logoOf }: { games: LiveScore[]; logoOf: (name: string) => string | null | undefined }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-[1.5vw] px-[3vw] pt-[2vw] pb-[1vw]">
        <span className="relative flex h-[1.2vw] w-[1.2vw]">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-full w-full rounded-full bg-red-600" />
        </span>
        <h1 className="text-[2.2vw] font-extrabold uppercase tracking-wide text-gray-900">Live Scores</h1>
      </div>

      <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-[2vw] px-[3vw] pb-[2vw]">
        {games.slice(0, 6).map((g, i) => {
          const homeLead = g.homeScore > g.awayScore;
          const awayLead = g.awayScore > g.homeScore;
          return (
            <div
              key={g.eventId}
              style={{ animationDelay: `${i * 70}ms` }}
              className="board-row flex flex-col justify-center rounded-2xl border border-gray-200 bg-white p-[1.6vw] shadow-sm"
            >
              <div className="mb-[0.8vw] flex items-center justify-between text-[0.85vw] font-bold uppercase tracking-widest text-gray-400">
                <span>{g.sport}</span>
                {g.period && <span className="rounded bg-gray-100 px-[0.6vw] py-[0.2vw] text-gray-700">{g.period}</span>}
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-[1vw]">
                <div className="flex items-center justify-end gap-[0.8vw] min-w-0">
                  <span className={`truncate text-right text-[1.3vw] font-semibold ${homeLead ? 'text-gray-900' : 'text-gray-500'}`}>{g.homeTeam}</span>
                  {logoOf(g.homeTeam ?? '') && <img src={logoOf(g.homeTeam ?? '')!} alt="" className="h-[2.2vw] w-[2.2vw] rounded-full object-cover" />}
                </div>
                <div className="tabular-nums text-[2.9vw] font-extrabold">
                  <AnimatedNumber value={g.homeScore} className={homeLead ? 'text-red-600' : 'text-gray-800'} />
                  <span className="mx-[0.6vw] text-gray-300">–</span>
                  <AnimatedNumber value={g.awayScore} className={awayLead ? 'text-red-600' : 'text-gray-800'} />
                </div>
                <div className="flex items-center gap-[0.8vw] min-w-0">
                  {logoOf(g.awayTeam ?? '') && <img src={logoOf(g.awayTeam ?? '')!} alt="" className="h-[2.2vw] w-[2.2vw] rounded-full object-cover" />}
                  <span className={`truncate text-[1.3vw] font-semibold ${awayLead ? 'text-gray-900' : 'text-gray-500'}`}>{g.awayTeam}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── board ───────────────────────────────────────────────────────────────────

export default function StandingsBoard() {
  const [params] = useSearchParams();
  const category = params.get('category') || undefined;
  // ?sport=Badminton rolls up all of that racquet sport's line brackets.
  const sport = params.get('sport') || undefined;
  const intervalMs = Math.max(6, Number(params.get('interval')) || 18) * 1000;

  const lb = useLeaderboard(category, sport, undefined, { refetchInterval: 15_000 });
  const live = useLiveScores(true, { refetchInterval: 8_000 });
  const depts = useDepartments({ refetchInterval: 60_000 });

  const rows = useMemo<Row[]>(
    () => ((lb.data as Row[]) ?? []).filter((r) => r.total > 0 || r.gold || r.silver || r.bronze),
    [lb.data],
  );
  const games = useMemo<LiveScore[]>(() => (live.data as LiveScore[]) ?? [], [live.data]);

  const deptMap = useMemo(() => {
    const m = new Map<string, { logoUrl?: string | null; abbreviation?: string | null }>();
    for (const d of (depts.data as any[]) ?? []) m.set(d.name, d);
    return m;
  }, [depts.data]);
  const logoOf = (name: string) => deptMap.get(name)?.logoUrl;
  const abbrOf = (name: string) => deptMap.get(name)?.abbreviation;

  const views = useMemo<('standings' | 'live')[]>(
    () => (games.length > 0 ? ['standings', 'live'] : ['standings']),
    [games.length],
  );
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (views.length < 2) {
      setIdx(0);
      return;
    }
    const t = setInterval(() => setIdx((i) => (i + 1) % views.length), intervalMs);
    return () => clearInterval(t);
  }, [views.length, intervalMs]);
  const activeIdx = Math.min(idx, views.length - 1);
  const active = views[activeIdx];

  const title = category ? `${category} Standings` : sport ? `${sport} Standings` : 'Official Standings';

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-white font-sans text-gray-900">
      <style>{`
        @keyframes rowIn {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .board-row { animation: rowIn 620ms cubic-bezier(.2,.7,.2,1) both; }
        @keyframes leaderPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(217,119,6,0.0); background-color: rgb(255 251 235); }
          50%     { box-shadow: 0 0 0 3px rgba(217,119,6,0.25); background-color: rgb(254 243 199); }
        }
        .leader-row { animation: rowIn 620ms cubic-bezier(.2,.7,.2,1) both, leaderPulse 2.8s ease-in-out 700ms infinite; }
        @keyframes viewIn { from { opacity: 0; transform: translateY(24px) scale(.985); } to { opacity: 1; transform: none; } }
        .view-enter { animation: viewIn 650ms cubic-bezier(.2,.7,.2,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .board-row, .leader-row, .view-enter { animation: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-red-700 to-red-800 px-[3vw] py-[1.1vw] text-white">
        <div className="flex items-center gap-[1.5vw]">
          <Crest />
          <div className="leading-tight">
            <div className="text-[1.65vw] font-extrabold tracking-wide">BATANGAS STATE UNIVERSITY</div>
            <div className="text-[0.85vw] uppercase tracking-[0.3em] opacity-80">Intramurals · Competition Scoring System</div>
          </div>
        </div>
        <Clock />
      </div>

      {/* Rotating body — a fresh panel animates in each rotation */}
      <div className="relative flex-1 overflow-hidden">
        <img
          src="/batstateu-seal.png"
          alt=""
          aria-hidden
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
          className="pointer-events-none absolute left-1/2 top-1/2 w-[40vw] -translate-x-1/2 -translate-y-1/2 opacity-[0.035]"
        />
        <div key={active} className="view-enter absolute inset-0">
          {active === 'live'
            ? <LiveView games={games} logoOf={logoOf} />
            : <StandingsView rows={rows} logoOf={logoOf} abbrOf={abbrOf} title={title} />}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-[3vw] py-[0.8vw] text-[0.82vw] text-gray-500">
        <span className="inline-flex items-center gap-[0.6vw]">
          <span className="h-[0.6vw] w-[0.6vw] rounded-full bg-emerald-500" />
          Auto‑updating · standings every 15s{views.length > 1 ? ', view rotates' : ''}
        </span>
        <span className="flex items-center gap-[0.6vw]">
          {views.map((v, i) => (
            <span
              key={v}
              className={`h-[0.6vw] w-[0.6vw] rounded-full transition-colors duration-500 ${i === activeIdx ? 'bg-red-600' : 'bg-gray-300'}`}
            />
          ))}
        </span>
        <span>Last update {new Date(lb.dataUpdatedAt || Date.now()).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
