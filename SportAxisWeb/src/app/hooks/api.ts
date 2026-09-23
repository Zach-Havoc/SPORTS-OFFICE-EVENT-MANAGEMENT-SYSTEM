/**
 * React Query hooks wrapping the raw `services/api` functions.
 *
 * Every list/detail screen uses these instead of `useEffect` + `useState`.
 * They give stale-while-revalidate for free: cached data shows instantly,
 * a background refetch runs on mount / tab-focus / reconnect, and a failed
 * background refetch keeps the last good data on screen.
 */
import { useEffect } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { STALE } from "../lib/queryClient";
import { getEcho } from "../lib/echo";
import * as api from "../services/api";

/** Per-call overrides a component may pass to a query hook. */
type QueryOpts<T> = Partial<
  Pick<
    UseQueryOptions<T, Error, T, readonly unknown[]>,
    "enabled" | "refetchInterval" | "staleTime" | "gcTime" | "select"
  >
>;

/**
 * Full-list screens (roster views, dashboards, cross-record conflict
 * checks) still need every row, not just one page. This walks a
 * paginated endpoint page by page and merges the results, while
 * tolerating endpoints that haven't migrated to the paginated shape yet
 * (a bare array short-circuits after the first request).
 */
async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<api.ListResponse<T>>,
): Promise<T[]> {
  const first = await fetchPage(1);
  if (Array.isArray(first)) return first;

  const meta = api.getPageMeta(first);
  let items = api.unwrapList<T>(first);
  if (!meta || meta.lastPage <= meta.currentPage) return items;

  const remaining = await Promise.all(
    Array.from({ length: meta.lastPage - meta.currentPage }, (_, i) =>
      fetchPage(meta.currentPage + i + 1),
    ),
  );
  for (const page of remaining) items = items.concat(api.unwrapList<T>(page));
  return items;
}

// ─────────────────────────────────────────────────────────────────────
// Query keys — the single source of truth for cache identity + invalidation
// ─────────────────────────────────────────────────────────────────────

export const qk = {
  authUser: ["auth", "user"] as const,
  departments: ["departments"] as const,
  categories: ["categories"] as const,
  venues: ["venues"] as const,
  registrationCodes: ["registration-codes"] as const,
  events: ["events"] as const,
  eventsByDate: (date: string) => ["events", "by-date", date] as const,
  event: (id: string) => ["events", id] as const,
  scores: (eventId: string) => ["scores", eventId] as const,
  rankings: (eventId: string) => ["rankings", eventId] as const,
  leaderboard: (category?: string, parentSport?: string, season?: string) =>
    [
      "leaderboard",
      category ?? "all",
      parentSport ?? "all",
      season ?? "current",
    ] as const,
  seasons: ["seasons"] as const,
  currentSeason: ["seasons", "current"] as const,
  eventReport: (eventId: string) => ["reports", eventId] as const,
  standings: (sport: string) => ["standings", sport] as const,
  matches: (sport?: string) => ["matches", sport ?? "all"] as const,
  liveScores: (activeOnly = false) =>
    ["live-scores", activeOnly ? "active" : "all"] as const,
  eventLiveScore: (eventId: string) =>
    ["live-scores", "event", eventId] as const,
  athletes: ["athletes"] as const,
  athlete: (id: string) => ["athletes", id] as const,
  campusStudents: (q?: string) => ["campus-students", q ?? ""] as const,
  athleteSchedule: ["athlete", "schedule"] as const,
  coachSchedule: ["coach", "schedule"] as const,
  coaches: ["coaches"] as const,
  users: (filters?: Record<string, string | undefined>) =>
    ["users", filters ?? {}] as const,
  user: (id: string) => ["users", "detail", id] as const,
  coachProfile: ["coach-profile"] as const,
  myCoach: ["my-coach"] as const,
  announcements: ["announcements"] as const,
  tryoutApplications: ["tryout-applications"] as const,
  attendance: ["attendance"] as const,
  attendanceSessions: ["attendance", "sessions"] as const,
  attendanceSession: (id: string) => ["attendance", "sessions", id] as const,
  performance: ["performance"] as const,
  myPerformance: ["performance", "mine"] as const,
  requirements: ["requirements"] as const,
  myRequirements: ["requirements", "mine"] as const,
  myClearance: ["requirements", "clearance"] as const,
  requirementTypes: (sport?: string) =>
    ["requirement-types", sport ?? "all"] as const,
  myTeam: ["my-team"] as const,
  judges: ["judges"] as const,
  siteSlides: (type: "carousel" | "popup") => ["site-slides", type] as const,
  adminSiteSlides: (type?: "carousel" | "popup") =>
    ["admin", "site-slides", type ?? "all"] as const,
  brackets: (sport?: string) => ["brackets", sport ?? "all"] as const,
  bracket: (id: string) => ["brackets", id] as const,
  disciplineEntries: (params: {
    category?: string;
    parentSport?: string;
    division?: string;
  }) =>
    [
      "discipline-entries",
      params.category ?? "",
      params.parentSport ?? "",
      params.division ?? "",
    ] as const,
  trash: ["admin", "trash"] as const,
  auditLogs: (filters?: Record<string, string | number | undefined>) =>
    ["admin", "audit-logs", filters ?? {}] as const,
  protests: (filters?: Record<string, string | undefined>) =>
    ["protests", filters ?? {}] as const,
  notifications: ["notifications"] as const,
};

// ─────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────

export const useAuthUser = (opts?: QueryOpts<any>) =>
  useQuery({
    queryKey: qk.authUser,
    queryFn: api.getAuthUser,
    staleTime: STALE.static,
    ...opts,
  });

export const useDepartments = (opts?: QueryOpts<any[]>) =>
  useQuery({
    queryKey: qk.departments,
    queryFn: api.getDepartments,
    staleTime: STALE.static,
    ...opts,
  });

export const useCategories = (opts?: QueryOpts<any[]>) =>
  useQuery({
    queryKey: qk.categories,
    queryFn: api.getCategories,
    staleTime: STALE.static,
    ...opts,
  });

export const useVenues = (opts?: QueryOpts<any[]>) =>
  useQuery({
    queryKey: qk.venues,
    queryFn: api.getVenues,
    staleTime: STALE.static,
    ...opts,
  });

// The registration-codes endpoint may return a bare array or a Laravel
// paginator; this always resolves the full list by walking all pages.
export const useRegistrationCodes = (opts?: QueryOpts<any[]>) =>
  useQuery({
    queryKey: qk.registrationCodes,
    queryFn: () =>
      fetchAllPages((page) => api.getRegistrationCodes({ page, perPage: 200 })),
    staleTime: STALE.static,
    ...opts,
  });

// `season` is optional: omit for the active edition (the backend default),
// pass an id to browse a past one. Zero-arg calls are unchanged.
//
// The events endpoint may return a bare array or a Laravel paginator; this
// always resolves every event for the season by walking all pages, so
// existing full-list consumers (dashboards, schedule/overlap checks) keep
// working regardless of which shape the backend sends.
export const useEvents = (season?: string, opts?: QueryOpts<any[]>) =>
  useQuery({
    queryKey: season ? (["events", "season", season] as const) : qk.events,
    queryFn: () =>
      fetchAllPages((page) => api.getEvents(season, { page, perPage: 200 })),
    staleTime: STALE.live,
    ...opts,
  });

export const useEventsByDate = (date: string, opts?: QueryOpts<any[]>) =>
  useQuery({
    queryKey: qk.eventsByDate(date),
    queryFn: () => api.getEventsByDate(date),
    enabled: !!date,
    staleTime: STALE.live,
    ...opts,
  });

export const useEvent = (id: string | undefined, opts?: QueryOpts<any>) =>
  useQuery({
    queryKey: qk.event(id ?? ""),
    queryFn: () => api.getEvent(id as string),
    enabled: !!id,
    staleTime: STALE.live,
    ...opts,
  });

export const useEventScores = (
  eventId: string | undefined,
  opts?: QueryOpts<any[]>,
) =>
  useQuery({
    queryKey: qk.scores(eventId ?? ""),
    queryFn: () => api.getEventScores(eventId as string),
    enabled: !!eventId,
    staleTime: STALE.live,
    ...opts,
  });

export const useEventRankings = (
  eventId: string | undefined,
  opts?: QueryOpts<any[]>,
) =>
  useQuery({
    queryKey: qk.rankings(eventId ?? ""),
    queryFn: () => api.getEventRankings(eventId as string),
    enabled: !!eventId,
    staleTime: STALE.live,
    ...opts,
  });

export const useLeaderboard = (
  category?: string,
  parentSport?: string,
  season?: string,
  opts?: QueryOpts<any[]>,
) =>
  useQuery({
    queryKey: qk.leaderboard(category, parentSport, season),
    queryFn: () => api.getLeaderboard(category, parentSport, season),
    staleTime: STALE.live,
    ...opts,
  });

export const useStandings = (
  sport: string | undefined,
  opts?: QueryOpts<any[]>,
) =>
  useQuery({
    queryKey: qk.standings(sport ?? ""),
    queryFn: () => api.getStandings(sport as string),
    enabled: !!sport,
    staleTime: STALE.live,
    ...opts,
  });

export const useMatches = (sport?: string, opts?: QueryOpts<any[]>) =>
  useQuery({
    queryKey: qk.matches(sport),
    queryFn: () => api.getMatches(sport),
    staleTime: STALE.live,
    ...opts,
  });

export const useEventReport = (
  eventId: string | undefined,
  opts?: QueryOpts<any>,
) =>
  useQuery({
    queryKey: qk.eventReport(eventId ?? ""),
    queryFn: () => api.getEventReport(eventId as string),
    enabled: !!eventId,
    staleTime: STALE.live,
    ...opts,
  });

// Coach roster consumers (roster page, lineup, attendance, performance,
// dashboard) all expect the full roster — walk every page and merge so
// they keep working whether /athletes is paginated yet or not.
export const useAthletes = (opts?: QueryOpts<any[]>) =>
  useQuery({
    queryKey: qk.athletes,
    queryFn: () => fetchAllPages((page) => api.getAthletes({ page, perPage: 200 })),
    staleTime: STALE.live,
    ...opts,
  });

export const useAthlete = (id: string | undefined, opts?: QueryOpts<any>) =>
  useQuery({
    queryKey: qk.athlete(id ?? ""),
    queryFn: () => api.getAthlete(id as string),
    enabled: !!id,
    staleTime: STALE.live,
    ...opts,
  });

export const useCoaches = (opts?: QueryOpts<any[]>) =>
  useQuery({
    queryKey: qk.coaches,
    queryFn: api.getCoaches,
    staleTime: STALE.live,
    ...opts,
  });

// User Management (admin) — the whole account directory. Both consumers
// (Users.tsx, DashboardEnhanced.tsx) filter/summarize over the complete
// list client-side, so this walks every page and merges the results,
// tolerating either the bare-array or the paginated response shape.
export const useUsers = (
  filters: api.UserListFilters = {},
  opts?: QueryOpts<any[]>,
) =>
  useQuery({
    queryKey: qk.users(filters as Record<string, string | undefined>),
    queryFn: () =>
      fetchAllPages((page) => api.getUsers({ ...filters, page, perPage: 200 })),
    staleTime: STALE.live,
    ...opts,
  });

export const useUser = (id: string | undefined, opts?: QueryOpts<any>) =>
  useQuery({
    queryKey: qk.user(id ?? ""),
    queryFn: () => api.getUser(id as string),
    enabled: !!id,
    staleTime: STALE.live,
    ...opts,
  });

export const useCoachProfile = (opts?: QueryOpts<any>) =>
  useQuery({
    queryKey: qk.coachProfile,
    queryFn: api.getCoachProfile,
    staleTime: STALE.static,
    ...opts,
  });

export const useMyCoach = (opts?: QueryOpts<any>) =>
  useQuery({
    queryKey: qk.myCoach,
    queryFn: api.getMyCoach,
    staleTime: STALE.static,
    ...opts,
  });

// The announcements endpoint may return a bare array or a Laravel
// paginator; this always resolves the full list by walking all pages.
export const useAnnouncements = (opts?: QueryOpts<any[]>) =>
  useQuery({
    queryKey: qk.announcements,
    queryFn: () =>
      fetchAllPages((page) => api.getAnnouncements({ page, perPage: 200 })),
    staleTime: STALE.live,
    ...opts,
  });

export const useTryoutApplications = (opts?: QueryOpts<any[]>) =>
  useQuery({
    queryKey: qk.tryoutApplications,
    queryFn: api.getTryoutApplications,
    staleTime: STALE.live,
    ...opts,
  });

export const useAttendanceRecords = (opts?: QueryOpts<any[]>) =>
  useQuery({
    queryKey: qk.attendance,
    queryFn: api.getAttendanceRecords,
    staleTime: STALE.live,
    ...opts,
  });

export const useAttendanceSessions = (
  opts?: QueryOpts<api.AttendanceSession[]>,
) =>
  useQuery({
    queryKey: qk.attendanceSessions,
    queryFn: api.getAttendanceSessions,
    staleTime: STALE.live,
    ...opts,
  });

export const useAttendanceSession = (
  id: string | undefined,
  opts?: QueryOpts<any>,
) =>
  useQuery({
    queryKey: qk.attendanceSession(id ?? ""),
    queryFn: () => api.getAttendanceSession(id as string),
    enabled: !!id,
    ...opts,
  });

export const usePerformanceRecords = (opts?: QueryOpts<any[]>) =>
  useQuery({
    queryKey: qk.performance,
    queryFn: api.getPerformanceRecords,
    staleTime: STALE.live,
    ...opts,
  });

export const useMyPerformance = (opts?: QueryOpts<any[]>) =>
  useQuery({
    queryKey: qk.myPerformance,
    queryFn: api.getMyPerformance,
    staleTime: STALE.live,
    ...opts,
  });

// The requirements endpoint may return a bare array or a Laravel
// paginator; this always resolves the full list by walking all pages.
export const useRequirements = (opts?: QueryOpts<any[]>) =>
  useQuery({
    queryKey: qk.requirements,
    queryFn: () =>
      fetchAllPages((page) => api.getRequirements({ page, perPage: 200 })),
    staleTime: STALE.live,
    ...opts,
  });

export const useMyRequirements = (opts?: QueryOpts<any[]>) =>
  useQuery({
    queryKey: qk.myRequirements,
    queryFn: api.getMyRequirements,
    staleTime: STALE.live,
    ...opts,
  });

export const useMyClearance = (opts?: QueryOpts<api.ClearanceStatus>) =>
  useQuery({
    queryKey: qk.myClearance,
    queryFn: api.getMyClearance,
    staleTime: STALE.live,
    ...opts,
  });

export const useRequirementTypes = (
  sport?: string,
  opts?: QueryOpts<api.RequirementTypeRow[]>,
) =>
  useQuery({
    queryKey: qk.requirementTypes(sport),
    queryFn: () => api.getRequirementTypes({ sport }),
    staleTime: STALE.static,
    ...opts,
  });

/** Admin/coach management view: includes inactive entries, unscoped by sport. */
export const useAllRequirementTypes = (
  opts?: QueryOpts<api.RequirementTypeRow[]>,
) =>
  useQuery({
    queryKey: ["requirement-types", "manage"],
    queryFn: () => api.getRequirementTypes({ includeInactive: true }),
    staleTime: STALE.live,
    ...opts,
  });

export const useMyTeam = (opts?: QueryOpts<api.MyTeam>) =>
  useQuery({
    queryKey: qk.myTeam,
    queryFn: api.getMyTeam,
    staleTime: STALE.live,
    ...opts,
  });

export const useJudges = (opts?: QueryOpts<any[]>) =>
  useQuery({
    queryKey: qk.judges,
    queryFn: api.getJudges,
    staleTime: STALE.live,
    ...opts,
  });

// ── Live game scores ─────────────────────────────────────────────────
// A committee member's score change is pushed over a WebSocket (Laravel
// Reverb) and applied to the cache within ~1s. The `refetchInterval` below is
// only a safety net for when the socket is unavailable or drops.

const LIVE_FALLBACK_POLL = 60_000;

/**
 * Merge one pushed live score into every cached live-scores list + its detail.
 *
 * Two committee-scoring PUTs can broadcast out of order relative to each
 * other (independent PHP-FPM workers, no shared lock — see
 * LiveScoreController::upsert), so a push can arrive after a newer one. Drop
 * any push whose version is behind what's already cached instead of letting
 * it regress the visible score until the next fallback poll.
 */
function applyLiveUpdate(qc: QueryClient, live: api.LiveScore): void {
  for (const activeOnly of [true, false]) {
    qc.setQueryData<api.LiveScore[]>(qk.liveScores(activeOnly), (prev) => {
      const list = Array.isArray(prev) ? [...prev] : [];
      const i = list.findIndex((l) => l.eventId === live.eventId);
      const keep = !activeOnly || live.status === "in_progress";
      if (!keep) return i >= 0 ? list.filter((_, x) => x !== i) : list;
      if (i >= 0) {
        if (live.version < list[i].version) return list;
        list[i] = live;
      } else list.unshift(live);
      return list;
    });
  }
  qc.setQueryData<{ live: api.LiveScore | null }>(
    qk.eventLiveScore(live.eventId),
    (prev) => (prev?.live && live.version < prev.live.version ? prev : { live }),
  );
}

function applyLiveClear(qc: QueryClient, eventId: string): void {
  for (const activeOnly of [true, false]) {
    qc.setQueryData<api.LiveScore[]>(qk.liveScores(activeOnly), (prev) =>
      Array.isArray(prev) ? prev.filter((l) => l.eventId !== eventId) : prev,
    );
  }
  qc.setQueryData(qk.eventLiveScore(eventId), { live: null });
}

// One shared subscription to the public `live-scores` channel for the whole
// session, regardless of how many components read live scores.
let liveChannelBound = false;

function useLiveScoreChannel(): void {
  const qc = useQueryClient();
  useEffect(() => {
    if (liveChannelBound) return;
    const echo = getEcho();
    if (!echo) return;
    liveChannelBound = true;

    const channel = echo.channel("live-scores");
    channel.listen(".updated", (e: { live: api.LiveScore }) =>
      applyLiveUpdate(qc, e.live),
    );
    channel.listen(".cleared", (e: { eventId: string }) =>
      applyLiveClear(qc, e.eventId),
    );
    // The channel intentionally lives for the whole session; no teardown.
  }, [qc]);
}

export const useLiveScores = (
  activeOnly = false,
  opts?: QueryOpts<api.LiveScore[]>,
) => {
  useLiveScoreChannel();
  return useQuery({
    queryKey: qk.liveScores(activeOnly),
    queryFn: () => api.getLiveScores(activeOnly),
    staleTime: 0,
    refetchInterval: LIVE_FALLBACK_POLL,
    refetchIntervalInBackground: false,
    // Browsers routinely suspend the WebSocket on a backgrounded tab, so
    // "switched away and came back" can go stale even with Reverb running —
    // catch that moment on refocus instead of waiting out the fallback poll.
    refetchOnWindowFocus: true,
    ...opts,
  });
};

export const useEventLiveScore = (
  eventId: string | undefined,
  opts?: QueryOpts<{ live: api.LiveScore | null }>,
) => {
  useLiveScoreChannel();
  return useQuery({
    queryKey: qk.eventLiveScore(eventId ?? ""),
    queryFn: () => api.getEventLiveScore(eventId as string),
    enabled: !!eventId,
    staleTime: 0,
    refetchInterval: LIVE_FALLBACK_POLL,
    refetchOnWindowFocus: true,
    ...opts,
  });
};

// Site content — public photo slideshow ('carousel') + welcome popup ('popup').
export const useSiteSlides = (
  type: "carousel" | "popup",
  opts?: QueryOpts<any[]>,
) =>
  useQuery({
    queryKey: qk.siteSlides(type),
    queryFn: () => api.getSiteSlides(type),
    staleTime: STALE.static,
    ...opts,
  });

export const useAdminSiteSlides = (
  type?: "carousel" | "popup",
  opts?: QueryOpts<any[]>,
) =>
  useQuery({
    queryKey: qk.adminSiteSlides(type),
    queryFn: () => api.getAdminSiteSlides(type),
    staleTime: STALE.live,
    ...opts,
  });

// Brackets
export const useBrackets = (sport?: string, opts?: QueryOpts<any[]>) =>
  useQuery({
    queryKey: qk.brackets(sport),
    queryFn: () => api.getBrackets(sport),
    ...opts,
  });

export const useBracket = (id: string | undefined, opts?: QueryOpts<any>) =>
  useQuery({
    queryKey: qk.bracket(id ?? ""),
    queryFn: () => api.getBracket(id as string),
    enabled: !!id,
    ...opts,
  });

const invalidateBrackets = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["brackets"] });
  qc.invalidateQueries({ queryKey: ["events"] });
};

export const useCreateBracket = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createBracket,
    onSuccess: () => invalidateBrackets(qc),
  });
};
export const usePublishBracket = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.publishBracket,
    onSuccess: () => invalidateBrackets(qc),
  });
};
export const useAdvanceBracketMatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      bracketId,
      matchId,
      body,
    }: {
      bracketId: string;
      matchId: string;
      body?: { winner?: string; force?: boolean };
    }) => api.advanceBracketMatch(bracketId, matchId, body),
    onSuccess: () => invalidateBrackets(qc),
  });
};
export const useDeleteBracket = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, withEvents }: { id: string; withEvents?: boolean }) =>
      api.deleteBracket(id, withEvents),
    onSuccess: () => invalidateBrackets(qc),
  });
};

// Racquet line-up
export const useDisciplineEntries = (
  params: { category?: string; parentSport?: string; division?: string },
  opts?: QueryOpts<api.DisciplineEntry[]>,
) =>
  useQuery({
    queryKey: qk.disciplineEntries(params),
    queryFn: () => api.getDisciplineEntries(params),
    enabled: !!(params.category || params.parentSport),
    ...opts,
  });

export const useAssignDisciplineEntry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.assignDisciplineEntry,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discipline-entries"] });
      qc.invalidateQueries({ queryKey: ["brackets"] });
    },
  });
};

export const useRemoveDisciplineEntry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.removeDisciplineEntry,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discipline-entries"] });
      qc.invalidateQueries({ queryKey: ["brackets"] });
    },
  });
};

// ─────────────────────────────────────────────────────────────────────
// Mutations — each invalidates the caches its write can affect
// ─────────────────────────────────────────────────────────────────────

export function useInvalidate() {
  const qc = useQueryClient();
  return (keys: readonly unknown[][]) =>
    Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

export const useUpdateAccountProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateAccountProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.authUser }),
  });
};

export const useUpdateAccountPassword = () =>
  useMutation({ mutationFn: api.updateAccountPassword });

// User Management — a write here can move an account between the coach / judge
// directories and change an athlete's coach link, so refresh all of them.
const invalidateUserDirectory = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["users"] });
  qc.invalidateQueries({ queryKey: qk.coaches });
  qc.invalidateQueries({ queryKey: qk.judges });
  qc.invalidateQueries({ queryKey: qk.athletes });
  qc.invalidateQueries({ queryKey: qk.registrationCodes });
  qc.invalidateQueries({ queryKey: qk.authUser });
};

export const useUpdateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof api.updateUser>[1];
    }) => api.updateUser(id, data),
    onSuccess: () => invalidateUserDirectory(qc),
  });
};

export const useSetUserActive = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.setUserActive(id, active),
    onSuccess: () => invalidateUserDirectory(qc),
  });
};

export const useResetUserPassword = () =>
  useMutation({
    mutationFn: ({ id, password }: { id: string; password?: string }) =>
      api.resetUserPassword(id, password),
  });

export const useDeleteUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteUser,
    onSuccess: () => invalidateUserDirectory(qc),
  });
};

export const useAthleteSchedule = (opts?: QueryOpts<api.TeamSchedule>) =>
  useQuery({
    queryKey: qk.athleteSchedule,
    queryFn: api.getAthleteSchedule,
    staleTime: STALE.live,
    ...opts,
  });

export const useCoachSchedule = (opts?: QueryOpts<api.TeamSchedule>) =>
  useQuery({
    queryKey: qk.coachSchedule,
    queryFn: api.getCoachSchedule,
    staleTime: STALE.live,
    ...opts,
  });

export const useCampusStudents = (
  q?: string,
  opts?: QueryOpts<{ total: number; students: api.CampusStudent[] }>,
) =>
  useQuery({
    queryKey: qk.campusStudents(q),
    queryFn: () => api.getCampusStudents(q),
    staleTime: STALE.static,
    ...opts,
  });

export const useImportCampusStudents = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.importCampusStudents(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campus-students"] }),
  });
};

export const useCreateDepartment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createDepartment,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.departments }),
  });
};
export const useUpdateDepartment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.updateDepartment(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.departments }),
  });
};
export const useDeleteDepartment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteDepartment,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.departments }),
  });
};

export const useCreateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.categories }),
  });
};
export const useUpdateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.updateCategory(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.categories }),
  });
};
export const useDeleteCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.categories }),
  });
};

const invalidateEventDerived = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: qk.events });
  qc.invalidateQueries({ queryKey: ["leaderboard"] });
  qc.invalidateQueries({ queryKey: ["rankings"] });
};

export const useCreateEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createEvent,
    onSuccess: () => invalidateEventDerived(qc),
  });
};
export const useUpdateEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.updateEvent(id, data),
    onSuccess: () => invalidateEventDerived(qc),
  });
};
export const useDeleteEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteEvent,
    onSuccess: () => invalidateEventDerived(qc),
  });
};

export const useSubmitScore = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.submitScore,
    onSuccess: (_res, vars: any) => {
      const eventId = vars?.eventId;
      if (eventId) {
        qc.invalidateQueries({ queryKey: qk.scores(eventId) });
        qc.invalidateQueries({ queryKey: qk.rankings(eventId) });
      }
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      // Scoring a 2-team event also updates the derived match + standings.
      qc.invalidateQueries({ queryKey: ["standings"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
  });
};

export const useExtractOcrScores = () =>
  useMutation({ mutationFn: api.extractOcrScores });

const invalidateMatchDerived = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["matches"] });
  qc.invalidateQueries({ queryKey: ["standings"] });
};

export const useCreateMatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createMatch,
    onSuccess: () => invalidateMatchDerived(qc),
  });
};
export const useUpdateMatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.updateMatch(id, data),
    onSuccess: () => invalidateMatchDerived(qc),
  });
};
export const useDeleteMatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteMatch,
    onSuccess: () => invalidateMatchDerived(qc),
  });
};

export const useCreateVenue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createVenue,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.venues }),
  });
};
export const useUpdateVenue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.updateVenue(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.venues }),
  });
};
export const useDeleteVenue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteVenue,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.venues }),
  });
};

export const useCreateRegistrationCode = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createRegistrationCode,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.registrationCodes }),
  });
};
export const useRevokeRegistrationCode = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.revokeRegistrationCode,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.registrationCodes }),
  });
};

export const useCreateAthlete = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createAthlete,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.athletes }),
  });
};
export const useUpdateAthlete = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.updateAthlete(id, data),
    onSuccess: (_r, { id }) => {
      qc.invalidateQueries({ queryKey: qk.athletes });
      qc.invalidateQueries({ queryKey: qk.athlete(id) });
    },
  });
};
export const useDeleteAthlete = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteAthlete,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.athletes }),
  });
};
export const useRemoveAthleteFromRoster = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.removeAthleteFromRoster,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.athletes }),
  });
};

export const useUpdateCoachProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateCoachProfile,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.coachProfile });
      qc.invalidateQueries({ queryKey: qk.athletes });
      qc.invalidateQueries({ queryKey: qk.coaches });
      qc.invalidateQueries({ queryKey: qk.authUser });
    },
  });
};
export const useUpdateCoachDepartment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.updateCoachDepartment(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.coaches }),
  });
};

export const useEnrollWithCode = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.enrollWithCode,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.myCoach });
      qc.invalidateQueries({ queryKey: qk.authUser });
    },
  });
};
export const useUnenrollFromCoach = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.unenrollFromCoach,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.myCoach });
      qc.invalidateQueries({ queryKey: qk.authUser });
    },
  });
};

export const useCreateAnnouncement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createAnnouncement,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.announcements }),
  });
};
export const useUpdateAnnouncement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.updateAnnouncement(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.announcements }),
  });
};
export const useDeleteAnnouncement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteAnnouncement,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.announcements }),
  });
};

export const useApplyForTryout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.applyForTryout,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.tryoutApplications }),
  });
};

export const useMarkAttendance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.markAttendance,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.attendance }),
  });
};

// Attendance sessions
export const useCreateAttendanceSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createAttendanceSession,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.attendanceSessions }),
  });
};
export const useUpdateAttendanceSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { title?: string; date?: string };
    }) => api.updateAttendanceSession(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance"] }),
  });
};
export const useDeleteAttendanceSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteAttendanceSession,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance"] }),
  });
};
export const useSaveSessionRecords = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      records,
    }: {
      id: string;
      records: { athleteId: string; status: string; notes?: string }[];
    }) => api.saveSessionRecords(id, records),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance"] }),
  });
};

export const useRecordPerformance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.recordPerformance,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.performance });
      qc.invalidateQueries({ queryKey: qk.myPerformance });
    },
  });
};

export const useSubmitRequirement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.submitRequirement,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.requirements });
      qc.invalidateQueries({ queryKey: qk.myRequirements });
      qc.invalidateQueries({ queryKey: qk.myClearance });
    },
  });
};
export const useUpdateRequirementStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.updateRequirementStatus(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.requirements });
      qc.invalidateQueries({ queryKey: qk.myRequirements });
      qc.invalidateQueries({ queryKey: qk.myClearance });
    },
  });
};

/** A checklist edit changes what every athlete of that sport is missing. */
const invalidateRequirementTypes = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["requirement-types"] });
  qc.invalidateQueries({ queryKey: qk.myClearance });
};

export const useCreateRequirementType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createRequirementType,
    onSuccess: () => invalidateRequirementTypes(qc),
  });
};
export const useUpdateRequirementType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<api.RequirementTypeInput>;
    }) => api.updateRequirementType(id, data),
    onSuccess: () => invalidateRequirementTypes(qc),
  });
};
export const useDeleteRequirementType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteRequirementType,
    onSuccess: () => invalidateRequirementTypes(qc),
  });
};

// ── Site content mutations (admin) ───────────────────────────────────
// Every write can change what the public slideshow / popup shows, so we
// blow away both the admin lists and the public feeds.
const invalidateSiteSlides = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["site-slides"] });
  qc.invalidateQueries({ queryKey: ["admin", "site-slides"] });
};

export const useCreateSiteSlide = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof api.createSiteSlide>[0]) =>
      api.createSiteSlide(data),
    onSuccess: () => invalidateSiteSlides(qc),
  });
};
export const useUpdateSiteSlide = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof api.updateSiteSlide>[1];
    }) => api.updateSiteSlide(id, data),
    onSuccess: () => invalidateSiteSlides(qc),
  });
};
export const useDeleteSiteSlide = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteSiteSlide,
    onSuccess: () => invalidateSiteSlides(qc),
  });
};
export const useReorderSiteSlides = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      type,
      order,
    }: {
      type: "carousel" | "popup";
      order: string[];
    }) => api.reorderSiteSlides(type, order),
    onSuccess: () => invalidateSiteSlides(qc),
  });
};

// ─────────────────────────────────────────────────────────────────────
// Recovery & audit (admin)
// ─────────────────────────────────────────────────────────────────────

export const useTrash = (opts?: QueryOpts<api.Trash>) =>
  useQuery({
    queryKey: qk.trash,
    queryFn: api.getTrash,
    staleTime: STALE.live,
    ...opts,
  });

export const useAuditLogs = (
  filters: api.AuditLogFilters = {},
  opts?: QueryOpts<{ logs: api.AuditLogEntry[]; nextCursor: number | null }>,
) =>
  useQuery({
    queryKey: qk.auditLogs(
      filters as Record<string, string | number | undefined>,
    ),
    queryFn: () => api.getAuditLogs(filters),
    staleTime: STALE.live,
    ...opts,
  });

/** After a restore/purge, refresh the bin, the trail, and every list a row could reappear in. */
const invalidateRecovery = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: qk.trash });
  qc.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
  qc.invalidateQueries({ queryKey: qk.events });
  qc.invalidateQueries({ queryKey: qk.athletes });
  qc.invalidateQueries({ queryKey: qk.announcements });
  qc.invalidateQueries({ queryKey: ["brackets"] });
  qc.invalidateQueries({ queryKey: ["scores"] });
  qc.invalidateQueries({ queryKey: ["rankings"] });
  qc.invalidateQueries({ queryKey: ["leaderboard"] });
};

export const useRestoreTrashItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, id }: { kind: api.TrashKind; id: string }) => {
      switch (kind) {
        case "events":
          return api.restoreEvent(id);
        case "athletes":
          return api.restoreAthlete(id);
        case "announcements":
          return api.restoreAnnouncement(id);
        case "scores":
          return api.restoreScore(id);
        case "brackets":
          return api.restoreBracket(id, true);
      }
    },
    onSuccess: () => invalidateRecovery(qc),
  });
};

// ─────────────────────────────────────────────────────────────────────
// Seasons (tournament editions)
// ─────────────────────────────────────────────────────────────────────

export const useSeasons = (opts?: QueryOpts<api.Season[]>) =>
  useQuery({
    queryKey: qk.seasons,
    queryFn: api.getSeasons,
    staleTime: STALE.static,
    ...opts,
  });

export const useCurrentSeason = (opts?: QueryOpts<api.Season | null>) =>
  useQuery({
    queryKey: qk.currentSeason,
    queryFn: api.getCurrentSeason,
    staleTime: STALE.static,
    ...opts,
  });

/** A season change reshapes the leaderboard, schedule and brackets. */
const invalidateSeasons = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: qk.seasons });
  qc.invalidateQueries({ queryKey: qk.currentSeason });
  qc.invalidateQueries({ queryKey: qk.events });
  qc.invalidateQueries({ queryKey: ["leaderboard"] });
  qc.invalidateQueries({ queryKey: ["brackets"] });
};

export const useCreateSeason = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createSeason,
    onSuccess: () => invalidateSeasons(qc),
  });
};

export const useUpdateSeason = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<api.SeasonInput>;
    }) => api.updateSeason(id, data),
    onSuccess: () => invalidateSeasons(qc),
  });
};

export const useActivateSeason = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.activateSeason,
    onSuccess: () => invalidateSeasons(qc),
  });
};

export const useDeleteSeason = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteSeason,
    onSuccess: () => invalidateSeasons(qc),
  });
};

// ─────────────────────────────────────────────────────────────────────
// Result lifecycle & protests
// ─────────────────────────────────────────────────────────────────────

const invalidateResults = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["scores"] });
  qc.invalidateQueries({ queryKey: ["rankings"] });
  qc.invalidateQueries({ queryKey: ["leaderboard"] });
  qc.invalidateQueries({ queryKey: ["reports"] });
};

export const useVerifyScore = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.verifyScore,
    onSuccess: () => invalidateResults(qc),
  });
};

export const useDisputeScore = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.disputeScore(id, reason),
    onSuccess: () => invalidateResults(qc),
  });
};

export const useAmendScore = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof api.amendScore>[1];
    }) => api.amendScore(id, data),
    onSuccess: () => invalidateResults(qc),
  });
};

export const useOfficializeEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.officializeEvent,
    onSuccess: () => invalidateResults(qc),
  });
};

export const useProtests = (
  filters: { status?: string; season?: string } = {},
  opts?: QueryOpts<api.Protest[]>,
) =>
  useQuery({
    queryKey: qk.protests(filters as Record<string, string | undefined>),
    queryFn: () => api.getProtests(filters),
    staleTime: STALE.live,
    ...opts,
  });

export const useFileProtest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.fileProtest,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["protests"] }),
  });
};

export const useResolveProtest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof api.resolveProtest>[1];
    }) => api.resolveProtest(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["protests"] }),
  });
};

// ─────────────────────────────────────────────────────────────────────
// In-app notifications — a light 60s poll for the header bell
// ─────────────────────────────────────────────────────────────────────

export const useNotifications = (
  opts?: QueryOpts<{ items: api.AppNotification[]; unreadCount: number }>,
) =>
  useQuery({
    queryKey: qk.notifications,
    queryFn: () => api.getNotifications({ limit: 30 }),
    staleTime: 0,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    ...opts,
  });

export const useMarkNotificationRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications }),
  });
};

export const useMarkAllNotificationsRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications }),
  });
};
