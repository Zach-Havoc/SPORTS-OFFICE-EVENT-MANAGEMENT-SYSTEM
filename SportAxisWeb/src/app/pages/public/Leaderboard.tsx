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

function RankBadge({ rank }: { rank: number }) {
  const styles: Record<number, string> = {
    1: "bg-amber-100 text-amber-800",
    2: "bg-gray-200 text-gray-700",
    3: "bg-orange-100 text-orange-800",
  };
  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
        styles[rank] ?? "bg-gray-100 text-gray-500"
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Loading fullScreen={false} message="Loading leaderboard..." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
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
            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700"
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
              className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700"
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
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Open TV board
            <span aria-hidden>↗</span>
          </a>
        </div>
        <p className="text-gray-500 text-sm mt-1.5">
          Cumulative standings across all scored events · Last updated{" "}
          {new Date(dataUpdatedAt).toLocaleTimeString()}
        </p>
      </header>

      {/* Leaderboard Table */}
      <Card className="border-gray-200 shadow-sm">
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
            <p className="text-center text-gray-500 py-10 text-sm">
              No results have been recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
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
                    <th className="text-right py-3 px-4 font-semibold">
                      Total Points
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry) => (
                    <tr
                      key={entry.department}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50/70 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <RankBadge rank={entry.rank} />
                      </td>
                      <td className="py-3.5 px-4 font-medium text-gray-900">
                        {entry.department}
                      </td>
                      <td className="py-3.5 px-4 text-center tabular-nums text-gray-600 hidden sm:table-cell">
                        {entry.gold}
                      </td>
                      <td className="py-3.5 px-4 text-center tabular-nums text-gray-600 hidden sm:table-cell">
                        {entry.silver}
                      </td>
                      <td className="py-3.5 px-4 text-center tabular-nums text-gray-600 hidden sm:table-cell">
                        {entry.bronze}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-gray-900 tabular-nums">
                        {Math.round(entry.totalPoints)}
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
