/**
 * React Query hooks wrapping the raw `services/api` functions.
 *
 * Every list/detail screen uses these instead of `useEffect` + `useState`.
 * They give stale-while-revalidate for free: cached data shows instantly,
 * a background refetch runs on mount / tab-focus / reconnect, and a failed
 * background refetch keeps the last good data on screen.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { STALE } from '../lib/queryClient';
import * as api from '../services/api';

/** Per-call overrides a component may pass to a query hook. */
type QueryOpts<T> = Partial<
  Pick<
    UseQueryOptions<T, Error, T, readonly unknown[]>,
    'enabled' | 'refetchInterval' | 'staleTime' | 'gcTime' | 'select'
  >
>;

// ─────────────────────────────────────────────────────────────────────
// Query keys — the single source of truth for cache identity + invalidation
// ─────────────────────────────────────────────────────────────────────

export const qk = {
  authUser: ['auth', 'user'] as const,
  departments: ['departments'] as const,
  categories: ['categories'] as const,
  venues: ['venues'] as const,
  registrationCodes: ['registration-codes'] as const,
  events: ['events'] as const,
  eventsByDate: (date: string) => ['events', 'by-date', date] as const,
  event: (id: string) => ['events', id] as const,
  scores: (eventId: string) => ['scores', eventId] as const,
  rankings: (eventId: string) => ['rankings', eventId] as const,
  leaderboard: (category?: string) => ['leaderboard', category ?? 'all'] as const,
  eventReport: (eventId: string) => ['reports', eventId] as const,
  standings: (sport: string) => ['standings', sport] as const,
  matches: (sport?: string) => ['matches', sport ?? 'all'] as const,
  liveScores: (activeOnly = false) => ['live-scores', activeOnly ? 'active' : 'all'] as const,
  eventLiveScore: (eventId: string) => ['live-scores', 'event', eventId] as const,
  athletes: ['athletes'] as const,
  athlete: (id: string) => ['athletes', id] as const,
  coaches: ['coaches'] as const,
  users: (filters?: Record<string, string | undefined>) =>
    ['users', filters ?? {}] as const,
  user: (id: string) => ['users', 'detail', id] as const,
  coachProfile: ['coach-profile'] as const,
  myCoach: ['my-coach'] as const,
  announcements: ['announcements'] as const,
  tryoutApplications: ['tryout-applications'] as const,
  attendance: ['attendance'] as const,
  performance: ['performance'] as const,
  myPerformance: ['performance', 'mine'] as const,
  requirements: ['requirements'] as const,
  myRequirements: ['requirements', 'mine'] as const,
  judges: ['judges'] as const,
  siteSlides: (type: 'carousel' | 'popup') => ['site-slides', type] as const,
  adminSiteSlides: (type?: 'carousel' | 'popup') => ['admin', 'site-slides', type ?? 'all'] as const,
  brackets: (sport?: string) => ['brackets', sport ?? 'all'] as const,
  bracket: (id: string) => ['brackets', id] as const,
};

// ─────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────

export const useAuthUser = (opts?: QueryOpts<any>) =>
  useQuery({ queryKey: qk.authUser, queryFn: api.getAuthUser, staleTime: STALE.static, ...opts });

export const useDepartments = (opts?: QueryOpts<any[]>) =>
  useQuery({ queryKey: qk.departments, queryFn: api.getDepartments, staleTime: STALE.static, ...opts });

export const useCategories = (opts?: QueryOpts<any[]>) =>
  useQuery({ queryKey: qk.categories, queryFn: api.getCategories, staleTime: STALE.static, ...opts });

export const useVenues = (opts?: QueryOpts<any[]>) =>
  useQuery({ queryKey: qk.venues, queryFn: api.getVenues, staleTime: STALE.static, ...opts });

export const useRegistrationCodes = (opts?: QueryOpts<any[]>) =>
  useQuery({ queryKey: qk.registrationCodes, queryFn: api.getRegistrationCodes, staleTime: STALE.static, ...opts });

export const useEvents = (opts?: QueryOpts<any[]>) =>
  useQuery({ queryKey: qk.events, queryFn: api.getEvents, staleTime: STALE.live, ...opts });

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
    queryKey: qk.event(id ?? ''),
    queryFn: () => api.getEvent(id as string),
    enabled: !!id,
    staleTime: STALE.live,
    ...opts,
  });

export const useEventScores = (eventId: string | undefined, opts?: QueryOpts<any[]>) =>
  useQuery({
    queryKey: qk.scores(eventId ?? ''),
    queryFn: () => api.getEventScores(eventId as string),
    enabled: !!eventId,
    staleTime: STALE.live,
    ...opts,
  });

export const useEventRankings = (eventId: string | undefined, opts?: QueryOpts<any[]>) =>
  useQuery({
    queryKey: qk.rankings(eventId ?? ''),
    queryFn: () => api.getEventRankings(eventId as string),
    enabled: !!eventId,
    staleTime: STALE.live,
    ...opts,
  });

export const useLeaderboard = (category?: string, opts?: QueryOpts<any[]>) =>
  useQuery({
    queryKey: qk.leaderboard(category),
    queryFn: () => api.getLeaderboard(category),
    staleTime: STALE.live,
    ...opts,
  });

export const useStandings = (sport: string | undefined, opts?: QueryOpts<any[]>) =>
  useQuery({
    queryKey: qk.standings(sport ?? ''),
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

export const useEventReport = (eventId: string | undefined, opts?: QueryOpts<any>) =>
  useQuery({
    queryKey: qk.eventReport(eventId ?? ''),
    queryFn: () => api.getEventReport(eventId as string),
    enabled: !!eventId,
    staleTime: STALE.live,
    ...opts,
  });

export const useAthletes = (opts?: QueryOpts<any[]>) =>
  useQuery({ queryKey: qk.athletes, queryFn: api.getAthletes, staleTime: STALE.live, ...opts });

export const useAthlete = (id: string | undefined, opts?: QueryOpts<any>) =>
  useQuery({
    queryKey: qk.athlete(id ?? ''),
    queryFn: () => api.getAthlete(id as string),
    enabled: !!id,
    staleTime: STALE.live,
    ...opts,
  });

export const useCoaches = (opts?: QueryOpts<any[]>) =>
  useQuery({ queryKey: qk.coaches, queryFn: api.getCoaches, staleTime: STALE.live, ...opts });

// User Management (admin) — the whole account directory
export const useUsers = (filters: api.UserListFilters = {}, opts?: QueryOpts<any[]>) =>
  useQuery({
    queryKey: qk.users(filters as Record<string, string | undefined>),
    queryFn: () => api.getUsers(filters),
    staleTime: STALE.live,
    ...opts,
  });

export const useUser = (id: string | undefined, opts?: QueryOpts<any>) =>
  useQuery({
    queryKey: qk.user(id ?? ''),
    queryFn: () => api.getUser(id as string),
    enabled: !!id,
    staleTime: STALE.live,
    ...opts,
  });

export const useCoachProfile = (opts?: QueryOpts<any>) =>
  useQuery({ queryKey: qk.coachProfile, queryFn: api.getCoachProfile, staleTime: STALE.static, ...opts });

export const useMyCoach = (opts?: QueryOpts<any>) =>
  useQuery({ queryKey: qk.myCoach, queryFn: api.getMyCoach, staleTime: STALE.static, ...opts });

export const useAnnouncements = (opts?: QueryOpts<any[]>) =>
  useQuery({ queryKey: qk.announcements, queryFn: api.getAnnouncements, staleTime: STALE.live, ...opts });

export const useTryoutApplications = (opts?: QueryOpts<any[]>) =>
  useQuery({ queryKey: qk.tryoutApplications, queryFn: api.getTryoutApplications, staleTime: STALE.live, ...opts });

export const useAttendanceRecords = (opts?: QueryOpts<any[]>) =>
  useQuery({ queryKey: qk.attendance, queryFn: api.getAttendanceRecords, staleTime: STALE.live, ...opts });

export const usePerformanceRecords = (opts?: QueryOpts<any[]>) =>
  useQuery({ queryKey: qk.performance, queryFn: api.getPerformanceRecords, staleTime: STALE.live, ...opts });

export const useMyPerformance = (opts?: QueryOpts<any[]>) =>
  useQuery({ queryKey: qk.myPerformance, queryFn: api.getMyPerformance, staleTime: STALE.live, ...opts });

export const useRequirements = (opts?: QueryOpts<any[]>) =>
  useQuery({ queryKey: qk.requirements, queryFn: api.getRequirements, staleTime: STALE.live, ...opts });

export const useMyRequirements = (opts?: QueryOpts<any[]>) =>
  useQuery({ queryKey: qk.myRequirements, queryFn: api.getMyRequirements, staleTime: STALE.live, ...opts });

export const useJudges = (opts?: QueryOpts<any[]>) =>
  useQuery({ queryKey: qk.judges, queryFn: api.getJudges, staleTime: STALE.live, ...opts });

// Live game scores — these DO poll (the running score of a game in progress is
// the one thing on the public site that must update on its own). 10s cadence.
export const useLiveScores = (activeOnly = false, opts?: QueryOpts<api.LiveScore[]>) =>
  useQuery({
    queryKey: qk.liveScores(activeOnly),
    queryFn: () => api.getLiveScores(activeOnly),
    staleTime: 0,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    ...opts,
  });

export const useEventLiveScore = (eventId: string | undefined, opts?: QueryOpts<{ live: api.LiveScore | null }>) =>
  useQuery({
    queryKey: qk.eventLiveScore(eventId ?? ''),
    queryFn: () => api.getEventLiveScore(eventId as string),
    enabled: !!eventId,
    staleTime: 0,
    refetchInterval: 10_000,
    ...opts,
  });

// Site content — public photo slideshow ('carousel') + welcome popup ('popup').
export const useSiteSlides = (type: 'carousel' | 'popup', opts?: QueryOpts<any[]>) =>
  useQuery({
    queryKey: qk.siteSlides(type),
    queryFn: () => api.getSiteSlides(type),
    staleTime: STALE.static,
    ...opts,
  });

export const useAdminSiteSlides = (type?: 'carousel' | 'popup', opts?: QueryOpts<any[]>) =>
  useQuery({
    queryKey: qk.adminSiteSlides(type),
    queryFn: () => api.getAdminSiteSlides(type),
    staleTime: STALE.live,
    ...opts,
  });

// Brackets
export const useBrackets = (sport?: string, opts?: QueryOpts<any[]>) =>
  useQuery({ queryKey: qk.brackets(sport), queryFn: () => api.getBrackets(sport), ...opts });

export const useBracket = (id: string | undefined, opts?: QueryOpts<any>) =>
  useQuery({ queryKey: qk.bracket(id ?? ''), queryFn: () => api.getBracket(id as string), enabled: !!id, ...opts });

const invalidateBrackets = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['brackets'] });
  qc.invalidateQueries({ queryKey: ['events'] });
};

export const useCreateBracket = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.createBracket, onSuccess: () => invalidateBrackets(qc) });
};
export const usePublishBracket = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.publishBracket, onSuccess: () => invalidateBrackets(qc) });
};
export const useAdvanceBracketMatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bracketId, matchId, body }: { bracketId: string; matchId: string; body?: { winner?: string; force?: boolean } }) =>
      api.advanceBracketMatch(bracketId, matchId, body),
    onSuccess: () => invalidateBrackets(qc),
  });
};
export const useDeleteBracket = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, withEvents }: { id: string; withEvents?: boolean }) => api.deleteBracket(id, withEvents),
    onSuccess: () => invalidateBrackets(qc),
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
  qc.invalidateQueries({ queryKey: ['users'] });
  qc.invalidateQueries({ queryKey: qk.coaches });
  qc.invalidateQueries({ queryKey: qk.judges });
  qc.invalidateQueries({ queryKey: qk.athletes });
  qc.invalidateQueries({ queryKey: qk.registrationCodes });
  qc.invalidateQueries({ queryKey: qk.authUser });
};

export const useUpdateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updateUser>[1] }) =>
      api.updateUser(id, data),
    onSuccess: () => invalidateUserDirectory(qc),
  });
};

export const useSetUserActive = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.setUserActive(id, active),
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
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateDepartment(id, data),
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
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateCategory(id, data),
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
  qc.invalidateQueries({ queryKey: ['leaderboard'] });
  qc.invalidateQueries({ queryKey: ['rankings'] });
};

export const useCreateEvent = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.createEvent, onSuccess: () => invalidateEventDerived(qc) });
};
export const useUpdateEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateEvent(id, data),
    onSuccess: () => invalidateEventDerived(qc),
  });
};
export const useDeleteEvent = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.deleteEvent, onSuccess: () => invalidateEventDerived(qc) });
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
      qc.invalidateQueries({ queryKey: ['leaderboard'] });
      // Scoring a 2-team event also updates the derived match + standings.
      qc.invalidateQueries({ queryKey: ['standings'] });
      qc.invalidateQueries({ queryKey: ['matches'] });
    },
  });
};

export const useExtractOcrScores = () =>
  useMutation({ mutationFn: api.extractOcrScores });

const invalidateMatchDerived = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['matches'] });
  qc.invalidateQueries({ queryKey: ['standings'] });
};

export const useCreateMatch = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.createMatch, onSuccess: () => invalidateMatchDerived(qc) });
};
export const useUpdateMatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateMatch(id, data),
    onSuccess: () => invalidateMatchDerived(qc),
  });
};
export const useDeleteMatch = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.deleteMatch, onSuccess: () => invalidateMatchDerived(qc) });
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
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateVenue(id, data),
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
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateAthlete(id, data),
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
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateCoachDepartment(id, data),
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
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateAnnouncement(id, data),
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
    },
  });
};
export const useUpdateRequirementStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateRequirementStatus(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.requirements });
      qc.invalidateQueries({ queryKey: qk.myRequirements });
    },
  });
};

// ── Site content mutations (admin) ───────────────────────────────────
// Every write can change what the public slideshow / popup shows, so we
// blow away both the admin lists and the public feeds.
const invalidateSiteSlides = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['site-slides'] });
  qc.invalidateQueries({ queryKey: ['admin', 'site-slides'] });
};

export const useCreateSiteSlide = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof api.createSiteSlide>[0]) => api.createSiteSlide(data),
    onSuccess: () => invalidateSiteSlides(qc),
  });
};
export const useUpdateSiteSlide = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updateSiteSlide>[1] }) =>
      api.updateSiteSlide(id, data),
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
    mutationFn: ({ type, order }: { type: 'carousel' | 'popup'; order: string[] }) =>
      api.reorderSiteSlides(type, order),
    onSuccess: () => invalidateSiteSlides(qc),
  });
};
