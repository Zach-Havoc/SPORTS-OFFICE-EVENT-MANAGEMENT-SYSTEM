import { Link, useLocation } from 'react-router';
import { Button } from '../components/ui/button';

/**
 * A 404 is a dead end unless it offers a way on. The three links below are
 * the routes a lost visitor actually wants: where their college
 * stands, what is being played now, and what the office has posted.
 */
const WAYS_OUT = [
  { to: '/leaderboard', label: 'Standings', hint: 'Points by college' },
  { to: '/live', label: 'Live scores', hint: 'Matches in progress' },
  { to: '/announcements', label: 'Announcements', hint: 'Notices and tryouts' },
];

export default function NotFound() {
  const { pathname } = useLocation();

  return (
    <main className="flex min-h-[calc(100dvh-200px)] items-center px-4 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <p className="numeral text-5xl text-muted-foreground/40">404</p>
        <h1 className="t-page-title mt-3">
          That page is not here
        </h1>
        <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
          Nothing answers to{' '}
          <span className="rounded-sm bg-muted px-1.5 py-0.5 font-medium text-foreground">
            {pathname}
          </span>
          {'. '}
          The link may be old, or the event behind it may have been archived.
        </p>

        <ul className="mt-8 divide-y divide-border border-y border-border">
          {WAYS_OUT.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="group flex items-baseline justify-between gap-4 py-4 transition-colors hover:bg-muted/60"
              >
                <span className="font-medium text-foreground">{item.label}</span>
                <span className="text-sm text-muted-foreground">{item.hint}</span>
              </Link>
            </li>
          ))}
        </ul>

        <Button asChild variant="secondary" className="mt-8">
          <Link to="/">Back to home</Link>
        </Button>
      </div>
    </main>
  );
}
