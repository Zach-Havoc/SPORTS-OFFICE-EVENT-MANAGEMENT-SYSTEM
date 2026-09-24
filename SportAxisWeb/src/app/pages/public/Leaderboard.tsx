import { useMemo, useState } from "react";
import { useLeaderboard, useCategories, useSeasons } from "../../hooks/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { RefreshStatus } from "../../components/RefreshStatus";
import Loading from "../../components/Loading";

/**
 * Three colored pills was the old rank column. A standing is a number, so
 * the number is the treatment: set in Archivo's wide axis, in the medal's
 * own hue for the podium and quiet neutral below it. No pill, no dot.
 */
const MEDAL_TEXT: Record<number, string> = {
  1: "text-amber-600",
  2: "text-gray-500",
  3: "text-amber-900",
};

function Rank({ rank }: { rank: number }) {
  const podium = rank <= 3;
  return (
    <span
      className={`numeral inline-block tabular-nums ${
        podium ? `text-xl ${MEDAL_TEXT[rank]}` : "text-base text-muted-foreground"
      }`}
    >
      {rank}
    </span>
  );
}

interface LeaderboardEntry {
  department: string;
  totalPoints: number;
  eventsParticipated: number;
  rank: number;
  gold: number;
  silver: number;
  bronze: number;
}

export default function PublicLeaderboard() {
  // '' = all · 'p:<sport>' = racquet parent rollup · 'c:<name>' = one category
  const [sel, setSel] = useState("");
  // '' = the active edition; otherwise a specific season id.
  const [season, setSeason] = useState("");
  const { data: seasonsData } = useSeasons();
  const seasons = seasonsData ?? [];
  const { data: categoriesData } = useCategories();
  const cats = (categoriesData ?? []) as Array<{
    name: string;
    parentSport?: string;
  }>;
  const parentSports = [
    ...new Set(cats.map((c) => c.parentSport).filter(Boolean) as string[]),
  ].sort();
  const plainCats = cats
    .filter((c) => !c.parentSport)
    .map((c) => c.name)
    .sort();

  const category = sel.startsWith("c:") ? sel.slice(2) : undefined;
  const parentSport = sel.startsWith("p:") ? sel.slice(2) : undefined;

  // Loads once when the page opens. Refresh the browser to pull the latest.
  const {
    data,
    isLoading,
    isFetching,
    isRefetchError,
    refetch,
    dataUpdatedAt,
  } = useLeaderboard(category, parentSport, season || undefined);

  const leaderboard = useMemo<LeaderboardEntry[]>(
    () =>
      (data ?? []).map((entry: any, idx: number) => ({
        department: entry.department,
        totalPoints: Number(entry.total ?? entry.totalPoints ?? 0),
        eventsParticipated: entry.event_count ?? entry.eventsParticipated ?? 0,
        rank: idx + 1,
        gold: entry.gold ?? 0,
        silver: entry.silver ?? 0,
        bronze: entry.bronze ?? 0,
      })),
    [data],
  );

  if (isLoading) {
    return (
      <div className="page-container px-4 sm:px-6 lg:px-8 py-8">
        <Loading fullScreen={false} message="Loading leaderboard..." />
      </div>
    );
  }

  return (
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Header */}
      <header className="mb-8 pb-6 border-b border-gray-200">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
            College Leaderboard
          </h1>
          <RefreshStatus
            fetching={isFetching && !isLoading}
            error={isRefetchError}
            onRetry={() => refetch()}
          />
          <select
            value={sel}
            onChange={(e) => setSel(e.target.value)}
            className="rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground transition-colors hover:border-ring/40"
            aria-label="Filter by sport"
          >
            <option value="">All sports</option>
            {parentSports.map((p) => (
              <option key={p} value={`p:${p}`}>
                {p} (all lines)
              </option>
            ))}
            {plainCats.map((c) => (
              <option key={c} value={`c:${c}`}>
                {c}
              </option>
            ))}
          </select>
          {seasons.length > 1 && (
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground transition-colors hover:border-ring/40"
              aria-label="Season"
            >
              <option value="">
                Active season
                {seasons.find((s) => s.isActive)
                  ? ` — ${seasons.find((s) => s.isActive)!.name}`
                  : ""}
              </option>
              {seasons
                .filter((s) => !s.isActive)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          )}
          <a
            href={
              parentSport
                ? `/standings?sport=${encodeURIComponent(parentSport)}`
                : category
                  ? `/standings?category=${encodeURIComponent(category)}`
                  : "/standings"
            }
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Open TV board
            <span aria-hidden>↗</span>
          </a>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Cumulative standings across all scored events · Last updated{" "}
          {new Date(dataUpdatedAt).toLocaleTimeString()}
        </p>
      </header>

      {/* Leaderboard Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Overall Rankings
          </CardTitle>
          <CardDescription>
            Ranked by total points, then gold, silver, and bronze finishes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-base font-medium text-foreground">
                Nothing scored yet
              </p>
              <p className="mx-auto mt-1.5 max-w-[42ch] text-sm leading-relaxed text-muted-foreground">
                Standings fill in as the Sports Office confirms results. Check the
                schedule to see what is being played today.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    <th className="text-left py-3 px-4 font-semibold">Rank</th>
                    <th className="text-left py-3 px-4 font-semibold">
                      College
                    </th>
                    <th className="text-center py-3 px-4 font-semibold hidden sm:table-cell">
                      Gold
                    </th>
                    <th className="text-center py-3 px-4 font-semibold hidden sm:table-cell">
                      Silver
                    </th>
                    <th className="text-center py-3 px-4 font-semibold hidden sm:table-cell">
                      Bronze
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Points
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry) => (
                    <tr
                      key={entry.department}
                      className={`border-b border-border/60 transition-colors last:border-0 hover:bg-muted/60 ${
                        entry.rank <= 3 ? "bg-muted/25" : ""
                      }`}
                    >
                      <td className="w-14 px-4 py-3.5 text-center">
                        <Rank rank={entry.rank} />
                      </td>
                      <td className="px-4 py-3.5 font-medium text-foreground">
                        {entry.department}
                      </td>
                      <td className="hidden px-4 py-3.5 text-center tabular-nums text-muted-foreground sm:table-cell">
                        {entry.gold}
                      </td>
                      <td className="hidden px-4 py-3.5 text-center tabular-nums text-muted-foreground sm:table-cell">
                        {entry.silver}
                      </td>
                      <td className="hidden px-4 py-3.5 text-center tabular-nums text-muted-foreground sm:table-cell">
                        {entry.bronze}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="numeral text-lg text-foreground">
                          {Math.round(entry.totalPoints)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
