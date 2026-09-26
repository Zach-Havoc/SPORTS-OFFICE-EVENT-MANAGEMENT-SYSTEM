import { useMemo, useState } from "react";
import { useDepartments, useEvents, useSeasons } from "../../hooks/api";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { RefreshStatus } from "../../components/RefreshStatus";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Calendar, Search, Users, MapPin, Trophy, X } from "lucide-react";
import { TeamLogo } from "../../components/public/TeamLogo";
import Loading from "../../components/Loading";
import { useDeptAbbreviator } from "../../utils/departments";

interface Event {
  id: string;
  name: string;
  category: string;
  schedule: string;
  venueName?: string;
  venue?: string;
  status: "upcoming" | "ongoing" | "completed";
  departments: string[];
  /** Set by GET /events for completed events that have a recorded result. */
  result?: EventResult | null;
}

type EventResult =
  | {
      type: "match";
      winner: string | null;
      isDraw: boolean;
      homeTeam: string;
      awayTeam: string;
      homeScore: number | null;
      awayScore: number | null;
    }
  | { type: "ranked"; winner: string; score: number };

const fmtScore = (n: number | null) =>
  n === null ? "–" : Number.isInteger(n) ? String(n) : n.toFixed(2);

/** The winner line on a completed event: who won, and by what. */
function ResultLine({
  result,
  logoOf,
  abbr,
}: {
  result: EventResult | null | undefined;
  logoOf: (name: string) => string | null | undefined;
  abbr: (name: string) => string;
}) {
  if (!result) {
    return <p className="text-sm text-gray-400">No result recorded</p>;
  }

  if (result.type === "match" && result.isDraw) {
    return (
      <p className="text-sm font-medium text-gray-700">
        Draw · {abbr(result.homeTeam)} {fmtScore(result.homeScore)} – {fmtScore(result.awayScore)}{" "}
        {abbr(result.awayTeam)}
      </p>
    );
  }

  const winner = result.winner as string;
  let detail: string;
  if (result.type === "match") {
    const homeWon = winner === result.homeTeam;
    const loser = homeWon ? result.awayTeam : result.homeTeam;
    const [w, l] = homeWon
      ? [result.homeScore, result.awayScore]
      : [result.awayScore, result.homeScore];
    detail = `${fmtScore(w)} – ${fmtScore(l)} vs ${abbr(loser)}`;
  } else {
    detail = `1st place · ${result.score.toFixed(2)} pts`;
  }

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Trophy className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
      <TeamLogo name={winner} logoUrl={logoOf(winner)} label={abbr(winner)} size={28} />
      <span className="truncate text-sm">
        <span className="font-semibold text-gray-900" title={winner}>
          {abbr(winner)}
        </span>{" "}
        <span className="text-gray-500">won · {detail}</span>
      </span>
    </div>
  );
}

export default function PublicHistory() {
  // Cached events show immediately; a background refetch runs on mount and
  // whenever the tab regains focus or the network reconnects.
  // '' = the active edition, 'all' = every edition, otherwise a season id.
  const [season, setSeason] = useState("");
  const { data: seasonsData } = useSeasons();
  const seasons = seasonsData ?? [];
  const { data, isLoading, isFetching, isRefetchError, refetch } = useEvents(
    season || undefined,
  );
  const abbr = useDeptAbbreviator();

  const events = useMemo<Event[]>(
    () =>
      (data ?? []).map((event: any) => ({
        ...event,
        departments: event.departments || [],
      })),
    [data],
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");

  // Events store a college by full name or abbreviation; match either.
  const { data: deptsData } = useDepartments();
  const depts = useMemo(() => (deptsData as any[] | undefined) ?? [], [deptsData]);
  const logoOf = useMemo(() => {
    const k = (v: string) => v.trim().toLowerCase();
    const m = new Map<string, string | null>();
    for (const d of depts) {
      m.set(k(d.name), d.logoUrl ?? null);
      if (d.abbreviation) m.set(k(d.abbreviation), d.logoUrl ?? null);
    }
    return (name: string) => m.get(k(name)) ?? null;
  }, [depts]);

  const playsIn = useMemo(() => {
    if (teamFilter === "all") return () => true;
    const k = (v: string) => v.trim().toLowerCase();
    const d = depts.find((x) => x.name === teamFilter);
    const keys = new Set([k(teamFilter), ...(d?.abbreviation ? [k(d.abbreviation)] : [])]);
    return (e: Event) => e.departments.some((x) => keys.has(k(x)));
  }, [teamFilter, depts]);
  const [statusFilter, setStatusFilter] = useState("all");

  const hasActiveFilters =
    searchTerm.trim() !== "" ||
    season !== "" ||
    teamFilter !== "all" ||
    categoryFilter !== "all" ||
    statusFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setSeason("");
    setTeamFilter("all");
    setCategoryFilter("all");
    setStatusFilter("all");
  };

  // A different season has different games; don't keep a game it never had.
  const pickSeason = (v: string) => {
    setSeason(v === "active" ? "" : v);
    setCategoryFilter("all");
  };
  const activeSeason = seasons.find((s) => s.isActive);

  const filteredEvents = useMemo(() => {
    let filtered = events;

    if (statusFilter !== "all") {
      filtered = filtered.filter((e) => e.status === statusFilter);
    }
    if (categoryFilter !== "all") {
      filtered = filtered.filter((e) => e.category === categoryFilter);
    }
    if (teamFilter !== "all") {
      filtered = filtered.filter(playsIn);
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q),
      );
    }

    return [...filtered].sort(
      (a, b) => new Date(b.schedule).getTime() - new Date(a.schedule).getTime(),
    );
  }, [events, searchTerm, categoryFilter, teamFilter, playsIn, statusFilter]);

  const categories = useMemo(
    () => Array.from(new Set(events.map((e) => e.category))).filter(Boolean).sort(),
    [events],
  );

  const getStatusClasses = (status: string) => {
    switch (status) {
      case "ongoing":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200";
      case "upcoming":
        return "bg-blue-50 text-blue-700 border border-blue-200";
      case "completed":
        return "bg-gray-100 text-gray-600 border border-gray-200";
      default:
        return "bg-gray-100 text-gray-600 border border-gray-200";
    }
  };

  if (isLoading) {
    return (
      <div className="page-container px-4 sm:px-6 lg:px-8 py-8">
        <Loading fullScreen={false} message="Loading history..." />
      </div>
    );
  }

  return (
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <header className="mb-8 pb-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
            Event History
          </h1>
          <RefreshStatus
            fetching={isFetching && !isLoading}
            error={isRefetchError}
            onRetry={() => refetch()}
          />
        </div>
        <p className="text-gray-500 text-sm mt-1.5">
          Browse completed, ongoing, and upcoming events by season, college and game.
        </p>
      </header>

      {/* Filters */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Search — primary, grows to fill */}
          <div role="search" className="relative flex-1 min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search events by name or sport"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 pl-9 pr-9"
              aria-label="Search events"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Season / game / status */}
          <div className="grid grid-cols-1 gap-3 sm:flex">
            <Select value={season || "active"} onValueChange={pickSeason}>
              <SelectTrigger className="h-10 w-full sm:w-52" aria-label="Season">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">
                  {activeSeason ? `${activeSeason.name} (current)` : "Current season"}
                </SelectItem>
                {seasons
                  .filter((s) => !s.isActive)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                <SelectItem value="all">All seasons</SelectItem>
              </SelectContent>
            </Select>

            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="h-10 w-full sm:w-40" aria-label="College">
                <SelectValue placeholder="All colleges" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All colleges</SelectItem>
                {depts.map((d) => (
                  <SelectItem key={d.id ?? d.name} value={d.name}>
                    {d.abbreviation || d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-10 w-full sm:w-44" aria-label="Game">
                <SelectValue placeholder="All games" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All games</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-full sm:w-40" aria-label="Status">
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="ongoing">Ongoing</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Result count + clear */}
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-500">
            Showing{" "}
            <span className="font-medium text-gray-700">
              {filteredEvents.length}
            </span>{" "}
            of {events.length} events
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Events List */}
      {filteredEvents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <Calendar className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-700">
            No events match your filters
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Try another season, college, game, status or search term.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <X className="h-4 w-4" />
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((event) => (
            <Card
              key={event.id}
              className="border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all"
            >
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getStatusClasses(event.status)}`}
                      >
                        {event.status}
                      </span>
                      <Badge
                        variant="neutral"
                        className="font-normal text-gray-600"
                      >
                        {event.category}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg font-semibold">
                      {abbr(event.name)}
                    </CardTitle>
                    <CardDescription className="mt-2 space-y-1">
                      <div className="flex items-center text-sm">
                        <Calendar className="h-4 w-4 mr-2" />
                        {new Date(event.schedule).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </div>
                      {(event.venueName || event.venue) && (
                        <div className="flex items-center text-sm font-medium text-gray-700">
                          <MapPin className="h-4 w-4 mr-2 text-red-500 flex-shrink-0" />
                          {event.venueName || event.venue}
                        </div>
                      )}
                    </CardDescription>
                    {event.status === "completed" && (
                      <div className="mt-3 border-t border-gray-100 pt-3">
                        <ResultLine result={event.result} logoOf={logoOf} abbr={abbr} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 shrink-0">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">
                      {(event.departments || []).length} departments
                    </span>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
