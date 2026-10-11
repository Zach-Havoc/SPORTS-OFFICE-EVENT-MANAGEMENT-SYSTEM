/**
 * The dashboards' Chart.js panels: the admin's mixed games-and-results chart
 * and win-rate radar, and the coach's training attendance. Chart.js's own entrance animations run once when a
 * chart first draws (bars grow, the line draws in, the radar opens from the
 * centre); a resize redraws without animating, and reduced motion turns
 * animation off.
 */
import { useMemo } from 'react';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  RadarController,
  RadialLinearScale,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js';
import { Chart, Radar } from 'react-chartjs-2';
import { CalendarPlus, ClipboardList, Trophy } from 'lucide-react';
import { Panel, PanelEmpty, PanelLink } from './ConsoleKit';
import { sportOf } from '../../utils/sports';
import { ATTENDANCE_COLORS } from './DashboardKit';

ChartJS.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  RadarController,
  RadialLinearScale,
  Filler,
  Legend,
  Tooltip,
);
ChartJS.defaults.font.family = 'Archivo, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
ChartJS.defaults.color = '#6b7280';

/* Played (brand red), no result (amber), still to play (teal), as on the
   rest of the dashboard; the backlog line a darker amber. */
const RECORDED = '#D02525';
const NO_RESULT = '#C98A1C';
const TO_PLAY = '#0092A0';
const BACKLOG = '#8A5A0B';

/* One colour per college, the same in every chart: by its place in the
   alphabetical list of colleges. */
const COLLEGE_COLORS = ['#436590', '#0092A0', '#CB8B2E', '#834765', '#497F5D', '#D02525', '#6B7A8C'];

export function collegeColorer(collegeNames: string[]) {
  const order = [...new Set(collegeNames.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return (name: string) => {
    const i = order.indexOf(name);
    return COLLEGE_COLORS[(i < 0 ? order.length : i) % COLLEGE_COLORS.length];
  };
}

const DAY = 86_400_000;
const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Chart.js entrance: ease-out, once; a resize redraws instantly. */
function motion(duration: number) {
  return reducedMotion()
    ? { animation: false as const }
    : { animation: { duration, easing: 'easeOutQuart' as const }, transitions: { resize: { animation: { duration: 0 } } } };
}

function hexA(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/* ═══════════════════════════════════════════════════════════════════════
   Mixed: games per day (stacked bars) and the unrecorded-results backlog.
   ═══════════════════════════════════════════════════════════════════════ */

export function ResultsMixedChart({ events, today, className }: { events: any[]; today: Date; className?: string }) {
  const todayIso = isoDay(today);

  const model = useMemo(() => {
    const dayOf = (e: any) => String(e.schedule ?? '').slice(0, 10);
    const dated = events.filter((e) => dayOf(e));
    if (dated.length === 0) return null;

    // Three weeks back to a week ahead, starting no earlier than the first game.
    const first = dated.map(dayOf).sort()[0];
    let start = new Date(today.getTime() - 20 * DAY);
    if (isoDay(start) < first) start = new Date(`${first}T00:00:00`);
    const days: string[] = [];
    for (let t = start.getTime(); t <= today.getTime() + 6 * DAY; t += DAY) days.push(isoDay(new Date(t)));

    const at = new Map(days.map((d) => [d, { recorded: 0, noResult: 0, toPlay: 0 }]));
    // Games without a result from before the window still count in the backlog.
    let backlog = 0;
    for (const e of dated) {
      const d = dayOf(e);
      const past = d < todayIso;
      const unrecorded = past && e.status !== 'completed';
      if (d < days[0]) {
        if (unrecorded) backlog++;
        continue;
      }
      const b = at.get(d);
      if (!b) continue;
      if (e.status === 'completed') b.recorded++;
      else if (past) b.noResult++;
      else b.toPlay++;
    }
    const running = days.map((d) => {
      if (d >= todayIso) return null; // the backlog is a past-days figure
      backlog += at.get(d)!.noResult;
      return backlog;
    });

    return {
      labels: days.map((d) =>
        d === todayIso ? 'Today' : new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      ),
      recorded: days.map((d) => at.get(d)!.recorded),
      noResult: days.map((d) => at.get(d)!.noResult),
      toPlay: days.map((d) => at.get(d)!.toPlay),
      running,
      backlogNow: [...running].reverse().find((x) => x !== null) ?? backlog,
    };
  }, [events, today, todayIso]);

  const data: ChartData<'bar' | 'line', (number | null)[], string> | null = model && {
    labels: model.labels,
    datasets: [
      {
        type: 'line' as const,
        label: 'Waiting for a result (running total)',
        data: model.running,
        borderColor: BACKLOG,
        backgroundColor: BACKLOG,
        borderWidth: 2,
        pointRadius: 2.5,
        pointHoverRadius: 5,
        tension: 0.3,
        yAxisID: 'backlog',
        order: 0,
      },
      { type: 'bar' as const, label: 'Result recorded', data: model.recorded, backgroundColor: RECORDED, stack: 'g', order: 1, borderRadius: 3 },
      { type: 'bar' as const, label: 'No result yet', data: model.noResult, backgroundColor: NO_RESULT, stack: 'g', order: 1, borderRadius: 3 },
      { type: 'bar' as const, label: 'To play', data: model.toPlay, backgroundColor: hexA(TO_PLAY, 0.55), stack: 'g', order: 1, borderRadius: 3 },
    ],
  };

  const options: ChartOptions<'bar' | 'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    ...motion(900),
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', align: 'start', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 12 } } },
      tooltip: { padding: 10, boxPadding: 4 },
    },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 12, font: { size: 11 } } },
      y: {
        stacked: true,
        beginAtZero: true,
        title: { display: true, text: 'Games per day', font: { size: 11 } },
        ticks: { precision: 0, font: { size: 11 } },
        grid: { color: '#eef0f3' },
      },
      backlog: {
        position: 'right',
        beginAtZero: true,
        title: { display: true, text: 'Waiting for a result', font: { size: 11 } },
        ticks: { precision: 0, font: { size: 11 } },
        grid: { display: false },
      },
    },
  };

  return (
    <Panel
      className={className}
      title="Games and results"
      description={
        model
          ? `${model.backlogNow} ${model.backlogNow === 1 ? 'game is' : 'games are'} waiting for a result`
          : 'Games per day, and results still to record'
      }
      action={<PanelLink to="/admin/events">Events</PanelLink>}
    >
      {data ? (
        <div className="h-72 w-full lg:h-[22rem]" role="img" aria-label="Games per day by result, and the running total of games waiting for a result">
          <Chart type="bar" data={data} options={options} />
        </div>
      ) : (
        <PanelEmpty icon={CalendarPlus} title="No games scheduled yet" action={<PanelLink to="/admin/events?new=1">Create the first event</PanelLink>}>
          Each day's games, and any still waiting for a result, show here.
        </PanelEmpty>
      )}
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Radar: each college's win rate in each sport, from recorded results.
   ═══════════════════════════════════════════════════════════════════════ */

export function WinRateRadar({
  matches,
  colleges,
  abbreviate,
  className,
}: {
  matches: any[];
  colleges: string[];
  abbreviate: (s: string) => string;
  className?: string;
}) {
  const colorOf = useMemo(() => collegeColorer(colleges), [colleges]);

  const model = useMemo(() => {
    const done = matches.filter((m) => (m.status === 'completed' || m.status === 'forfeit') && m.sport);
    const sports = [...new Set(done.map((m) => sportOf(m.sport)))].sort((a, b) => a.localeCompare(b));
    if (sports.length < 3) return null; // a radar needs at least three axes

    const tally = new Map<string, Map<string, { w: number; p: number }>>();
    const add = (college: string, sport: string, won: boolean) => {
      if (!college) return;
      if (!tally.has(college)) tally.set(college, new Map());
      const t = tally.get(college)!.get(sport) ?? { w: 0, p: 0 };
      t.p++;
      if (won) t.w++;
      tally.get(college)!.set(sport, t);
    };
    for (const m of done) {
      const sport = sportOf(m.sport);
      const home = m.homeTeam ?? m.home_team;
      const away = m.awayTeam ?? m.away_team;
      add(home, sport, m.winner === home);
      add(away, sport, m.winner === away);
    }

    const rows = [...tally.entries()].map(([college, bySport]) => {
      const wins = [...bySport.values()].reduce((n, t) => n + t.w, 0);
      return {
        college,
        wins,
        rates: sports.map((s) => {
          const t = bySport.get(s);
          return t && t.p ? Math.round((t.w / t.p) * 100) : null;
        }),
        records: sports.map((s) => bySport.get(s) ?? { w: 0, p: 0 }),
      };
    });
    rows.sort((a, b) => b.wins - a.wins || a.college.localeCompare(b.college));
    return { sports, rows };
  }, [matches]);

  const data: ChartData<'radar', (number | null)[], string> | null = model && {
    labels: model.sports,
    datasets: model.rows.map((r, i) => ({
      label: abbreviate(r.college),
      data: r.rates,
      borderColor: colorOf(r.college),
      backgroundColor: hexA(colorOf(r.college), 0.16),
      pointBackgroundColor: colorOf(r.college),
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
      spanGaps: true,
      // The three with the most wins show first; the legend toggles the rest.
      hidden: i >= 3,
    })),
  };

  const options: ChartOptions<'radar'> = {
    responsive: true,
    maintainAspectRatio: false,
    ...motion(1000),
    plugins: {
      legend: {
        position: 'right',
        labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 12 } },
      },
      tooltip: {
        padding: 10,
        callbacks: {
          label: (ctx) => {
            const r = model!.rows[ctx.datasetIndex];
            const rec = r.records[ctx.dataIndex];
            return rec.p ? ` ${ctx.dataset.label}: ${ctx.raw}% (${rec.w}–${rec.p - rec.w})` : ` ${ctx.dataset.label}: no games yet`;
          },
        },
      },
    },
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: { stepSize: 25, backdropColor: 'transparent', font: { size: 10 }, callback: (v) => `${v}%` },
        pointLabels: { font: { size: 12, weight: 600 }, color: '#374151' },
        grid: { color: '#e5e7eb' },
        angleLines: { color: '#e5e7eb' },
      },
    },
  };

  return (
    <Panel
      className={className}
      title="Win rate by sport"
      description="Each college's share of games won in each sport. Click a college to show or hide it."
      action={<PanelLink to="/leaderboard">Standings</PanelLink>}
    >
      {data ? (
        <div className="h-80 w-full lg:h-[34rem]" role="img" aria-label="Radar chart of each college's win rate in each sport">
          <Radar data={data} options={options} />
        </div>
      ) : (
        <PanelEmpty icon={Trophy} title="Not enough results yet">
          Once games in at least three sports have results, each college's win rate shows here.
        </PanelEmpty>
      )}
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Coach: each recent training session's attendance, stacked by mark.
   ═══════════════════════════════════════════════════════════════════════ */

type Mark = keyof typeof ATTENDANCE_COLORS;
const MARKS: Mark[] = ['present', 'late', 'excused', 'absent'];

export function TrainingAttendanceChart({
  sessions,
  records,
  className,
}: {
  sessions: { id: string; title: string; date: string }[];
  records: any[];
  className?: string;
}) {
  const model = useMemo(() => {
    const todayIso = isoDay(new Date());
    // The last eight sessions that have happened, oldest first.
    const recent = sessions
      .filter((s) => String(s.date).slice(0, 10) <= todayIso)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(-8);
    if (recent.length === 0) return null;

    const bySession = new Map<string, Record<Mark, number>>();
    for (const r of records) {
      const id = r.sessionId ?? r.session_id;
      const mark = r.status as Mark;
      if (!id || !MARKS.includes(mark)) continue;
      if (!bySession.has(id)) bySession.set(id, { present: 0, late: 0, excused: 0, absent: 0 });
      bySession.get(id)![mark]++;
    }
    const counts = recent.map((s) => bySession.get(s.id) ?? { present: 0, late: 0, excused: 0, absent: 0 });

    // Rate over the sessions shown: present or late, out of everyone marked.
    const marked = counts.reduce((n, c) => n + c.present + c.late + c.excused + c.absent, 0);
    const came = counts.reduce((n, c) => n + c.present + c.late, 0);
    return {
      labels: recent.map((s) =>
        new Date(`${String(s.date).slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      ),
      titles: recent.map((s) => s.title),
      counts,
      rate: marked ? Math.round((came / marked) * 100) : null,
    };
  }, [sessions, records]);

  const label = (m: Mark) => m[0].toUpperCase() + m.slice(1);
  const data: ChartData<'bar', number[], string> | null = model && {
    labels: model.labels,
    datasets: MARKS.map((m) => ({
      label: label(m),
      data: model.counts.map((c) => c[m]),
      backgroundColor: ATTENDANCE_COLORS[m],
      stack: 'a',
      borderRadius: 2,
    })),
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    ...motion(900),
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', align: 'start', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 12 } } },
      tooltip: {
        padding: 10,
        boxPadding: 4,
        callbacks: { title: (items) => (items[0] ? `${model!.titles[items[0].dataIndex]} · ${items[0].label}` : '') },
      },
    },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, font: { size: 11 } } },
      y: {
        stacked: true,
        beginAtZero: true,
        title: { display: true, text: 'Athletes marked', font: { size: 11 } },
        ticks: { precision: 0, font: { size: 11 } },
        grid: { color: '#eef0f3' },
      },
    },
  };

  return (
    <Panel
      className={className}
      title="Training attendance"
      description={
        model?.rate != null
          ? `${model.rate}% came (present or late) across the last ${model.labels.length} ${model.labels.length === 1 ? 'session' : 'sessions'}`
          : 'Who came to each training session'
      }
      action={<PanelLink to="/coach/attendance">Attendance</PanelLink>}
    >
      {data ? (
        <div className="h-64 w-full lg:h-72" role="img" aria-label="Attendance marks for each recent training session">
          <Chart type="bar" data={data} options={options} />
        </div>
      ) : (
        <PanelEmpty icon={ClipboardList} title="No training sessions yet" action={<PanelLink to="/coach/attendance">Start a session</PanelLink>}>
          Each session's present, late, excused and absent marks show here.
        </PanelEmpty>
      )}
    </Panel>
  );
}
