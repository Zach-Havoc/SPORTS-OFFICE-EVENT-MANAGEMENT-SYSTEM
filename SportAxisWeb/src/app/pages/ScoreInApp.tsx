import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Smartphone, ScanLine, Radio } from 'lucide-react';
import { API_URL } from '../../config/api';
import { Button } from '../components/ui/button';

/**
 * Where an event's QR code link lands when it's opened in a browser
 * (/judge-qr/{event}/{token}). Scoring happens only in the SportAxis mobile
 * app — its scanner reads this same link — so the web just names the game
 * and points the committee member to the app. The route stays so printed and
 * emailed QR codes keep working.
 */

interface EventInfo {
  name: string;
  category: string;
  schedule: string;
  departments: string[];
  venueName?: string | null;
}

export default function ScoreInApp() {
  const { token } = useParams<{ eventId: string; token: string }>();
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${API_URL}/event/session/${token}`, { headers: { Accept: 'application/json' } })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'This QR code is invalid or the event no longer exists.');
        if (alive) setEvent(data.event ?? data);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [token]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-(--bg) px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-center sm:p-8">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface-sunken">
          <Smartphone className="size-6 text-text-secondary" />
        </div>

        {error ? (
          <>
            <h1 className="mt-4 text-lg font-semibold text-text">QR code not recognised</h1>
            <p className="mt-2 text-sm text-text-secondary">{error}</p>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-lg font-semibold text-text">Score this game in the SportAxis app</h1>
            {event && (
              <div className="mt-3 rounded-lg bg-surface-sunken px-4 py-3 text-left">
                <p className="text-sm font-medium text-text">{event.name}</p>
                <p className="text-xs text-text-secondary">
                  {event.category} ·{' '}
                  {new Date(event.schedule).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  {event.venueName ? ` · ${event.venueName}` : ''}
                </p>
                {event.departments?.length > 0 && (
                  <p className="mt-1 text-xs text-text-secondary">{event.departments.join(' vs ')}</p>
                )}
              </div>
            )}
            <ol className="mt-4 space-y-2 text-left text-sm text-text-secondary">
              <li className="flex gap-2">
                <span className="numeral text-text">1.</span> Open the SportAxis app and sign in with your committee account.
              </li>
              <li className="flex gap-2">
                <span className="numeral text-text">2.</span>
                <span>
                  Tap <ScanLine className="inline size-4 align-text-bottom" /> <strong className="text-text">Scan</strong> and point it at this game's QR code.
                </span>
              </li>
            </ol>
          </>
        )}

        <Button asChild variant="secondary" className="mt-6 w-full">
          <Link to="/live">
            <Radio className="size-4" /> Watch live scores
          </Link>
        </Button>
      </div>
    </div>
  );
}
