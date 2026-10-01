import type { ReactNode } from 'react';
import BracketTree, { type BracketTreeMatch } from './BracketTree';
import { splitDoubleElimination } from '../utils/bracket';

type DEMatch = BracketTreeMatch & { round: number; slot: number; section?: string | null };

/**
 * A double-elimination bracket in its three parts: the upper bracket as a
 * connected tree (it's a normal knockout tree), then the lower bracket and
 * the grand final as columns in order of play. The lower bracket isn't drawn
 * as a tree: byes leave it uneven, and half its teams drop in from above.
 */
export default function DoubleEliminationView<M extends DEMatch>({
  matches,
  renderMatch,
  onMatchClick,
}: {
  matches: M[];
  /** One lower-bracket / grand-final match card. */
  renderMatch: (m: M) => ReactNode;
  /** Clicking an upper-bracket match (admin: open its manager). */
  onMatchClick?: (matchId: string) => void;
}) {
  const { upper, lower, grandFinal } = splitDoubleElimination(matches);

  return (
    <div className="space-y-8">
      <section>
        <SectionHeading title="Upper bracket" hint="Unbeaten teams. A loss here drops a team to the lower bracket." />
        <BracketTree matches={upper} onMatchClick={onMatchClick} />
      </section>

      <section>
        <SectionHeading title="Lower bracket" hint="One loss so far. A second loss here and a team is out." />
        {lower.length === 0 ? (
          <p className="text-sm text-gray-500">No lower-bracket games.</p>
        ) : (
          <Columns rounds={lower} renderMatch={renderMatch} />
        )}
      </section>

      <section>
        <SectionHeading
          title="Grand final"
          hint="Upper-bracket champion vs lower-bracket champion. If the lower-bracket team wins, a reset game decides it."
        />
        <Columns rounds={grandFinal} renderMatch={renderMatch} />
      </section>
    </div>
  );
}

function SectionHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <p className="text-xs text-gray-500">{hint}</p>
    </div>
  );
}

function Columns<M>({
  rounds,
  renderMatch,
}: {
  rounds: Array<{ round: number; label: string; matches: M[] }>;
  renderMatch: (m: M) => ReactNode;
}) {
  return (
    <div className="flex gap-6 overflow-x-auto pb-4">
      {rounds.map((r) => (
        <div key={r.round} className="flex shrink-0 flex-col gap-3">
          <h3 className="text-sm font-semibold text-gray-700">{r.label}</h3>
          {r.matches.map((m) => renderMatch(m))}
        </div>
      ))}
    </div>
  );
}
