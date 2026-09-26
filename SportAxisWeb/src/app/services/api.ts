import { API_URL } from "../../config/api";

// ─────────────────────────────────────────────────────────────────────
// Pagination helpers — some list endpoints (athletes, events, users) are
// migrating to Laravel's standard paginate() response shape
// ({ data, current_page, last_page, per_page, total, ... }) instead of a
// bare array. These helpers let callers handle both shapes so the app
// keeps working whether or not the backend change has landed yet.
// ─────────────────────────────────────────────────────────────────────

export interface PageMeta {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

export interface PageParams {
  page?: number;
  perPage?: number;
}

/** The shape a paginated list endpoint returns once migrated to Laravel's
 * paginate(). Response bodies pass through `keysToCamelCase`, so the
 * standard `current_page` / `last_page` / `per_page` keys arrive camelCased. */
export interface Paginated<T> {
  data: T[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

/** A list endpoint mid-migration can send either a bare array (old shape)
 * or a Laravel paginator object (new shape). */
export type ListResponse<T> = T[] | Paginated<T>;

const pageParamsToQuery = (params: PageParams = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.perPage) qs.set("per_page", String(params.perPage));
  return qs;
};

/** Extracts the row array regardless of whether the response is a bare
 * array or a Laravel paginator object. */
export function unwrapList<T = unknown>(response: ListResponse<T>): T[] {
  if (Array.isArray(response)) return response;
  if (response && Array.isArray(response.data)) return response.data;
  return [];
}

/** Returns pagination metadata, or null if the response wasn't paginated
 * (e.g. the backend still returns a bare array for this endpoint). */
export function getPageMeta<T>(response: ListResponse<T>): PageMeta | null {
  if (
    response &&
    !Array.isArray(response) &&
    typeof response.currentPage === "number" &&
    typeof response.lastPage === "number"
  ) {
    return {
      currentPage: response.currentPage,
      lastPage: response.lastPage,
      perPage: response.perPage,
      total: response.total,
    };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────
// Core request helper
// ─────────────────────────────────────────────────────────────────────

const toCamelCase = (str: string) =>
  str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

const keysToCamelCase = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map((v) => keysToCamelCase(v));
  } else if (obj !== null && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      result[toCamelCase(key)] = keysToCamelCase(obj[key]);
      return result;
    }, {} as any);
  }
  return obj;
};

async function apiRequest(
  endpoint: string,
  options: RequestInit = {},
  requiresAuth = false,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (requiresAuth) {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      throw new Error("You are not logged in. Please sign in to continue.");
    }
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage =
        errorJson.error || errorJson.message || errorJson.errors
          ? typeof errorJson.errors === "object"
            ? Object.values(errorJson.errors).flat().join(", ")
            : errorJson.error || errorJson.message
          : errorText;
    } catch (_) {
      // not JSON
    }

    // Only treat 401/403 as "session expired" for authenticated routes.
    // For public routes (e.g. /login, /signup), fall through and surface
    // the server's real error message (e.g. "Access denied" or "Invalid credentials").
    if (requiresAuth && (response.status === 401 || response.status === 403)) {
      localStorage.removeItem("auth_token");
      throw new Error("Your session has expired. Please log in again.");
    }

    throw new Error(errorMessage || "API request failed");
  }

  // Handle empty responses (204 No Content)
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  return keysToCamelCase(data);
}

// ─────────────────────────────────────────────────────────────────────
// Authentication
// ─────────────────────────────────────────────────────────────────────

export const signup = (
  email: string,
  password: string,
  name: string,
  role: "admin" | "coach" | "athlete" | "judge",
  registrationCode: string,
  srCode: string | undefined,
  privacyNoticeAccepted: boolean,
) =>
  apiRequest("/signup", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      name,
      role,
      registrationCode,
      srCode: srCode || undefined,
      privacyNoticeAccepted,
    }),
  });

// ─────────────────────────────────────────────────────────────────────
// Campus student registry (admin) — the registrar roster used to verify
// that a signing-up athlete is a real enrolled student.
// ─────────────────────────────────────────────────────────────────────

export interface CampusStudent {
  srCode: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  gender?: string | null;
  college?: string | null;
  program?: string | null;
  yearLevel?: string | null;
  email?: string | null;
}

export const getCampusStudents = (q?: string) =>
  apiRequest(
    `/admin/campus-students${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    {},
    true,
  ) as Promise<{
    total: number;
    students: CampusStudent[];
  }>;

export const importCampusStudents = (file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return authMultipart("/admin/campus-students/import", fd) as Promise<{
    added: number;
    updated: number;
    skipped: number;
    total: number;
  }>;
};

export const login = (email: string, password: string) =>
  apiRequest("/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const logout = () => apiRequest("/logout", { method: "POST" }, true);

export const getAuthUser = () => apiRequest("/user", {}, true);

export const resetPassword = (email: string) =>
  apiRequest("/reset-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

export const updateAccountProfile = (data: {
  name?: string;
  yearLevel?: string | null;
  course?: string | null;
  phone?: string | null;
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phone?: string;
  } | null;
}) =>
  apiRequest(
    "/account/profile",
    { method: "PUT", body: JSON.stringify(data) },
    true,
  );

export const updateAccountPassword = (data: {
  currentPassword: string;
  newPassword: string;
}) =>
  apiRequest(
    "/account/password",
    { method: "PUT", body: JSON.stringify(data) },
    true,
  );

// ─────────────────────────────────────────────────────────────────────
// Team schedule — only the games the caller's college plays in their sport.
// Resolved server-side by key, not by matching college/sport names. An
// athlete has one rostered sport; a coach can handle several.
// ─────────────────────────────────────────────────────────────────────

export interface TeamScheduleEvent {
  id: string;
  name: string;
  category: string;
  schedule: string;
  startTime: string;
  endTime: string;
  venueName?: string | null;
  status: "upcoming" | "ongoing" | "completed";
  departments: string[];
  opponents: { name: string; abbreviation: string | null }[];
}

export interface TeamSchedule {
  team: {
    college: string | null;
    collegeAbbreviation: string | null;
    sports: string[];
  } | null;
  /** Why the list is empty, when it is: no_college | no_sport | no_games */
  reason: "no_college" | "no_sport" | "no_games" | null;
  events: TeamScheduleEvent[];
}

export const getAthleteSchedule = () =>
  apiRequest("/athlete/schedule", {}, true) as Promise<TeamSchedule>;

export const getCoachSchedule = () =>
  apiRequest("/coach/schedule", {}, true) as Promise<TeamSchedule>;

// ─────────────────────────────────────────────────────────────────────
// Departments
// ─────────────────────────────────────────────────────────────────────

export const getDepartments = () => apiRequest("/departments");
export const createDepartment = (data: any) =>
  apiRequest(
    "/departments",
    { method: "POST", body: JSON.stringify(data) },
    true,
  );
export const updateDepartment = (id: string, data: any) =>
  apiRequest(
    `/departments/${id}`,
    { method: "PUT", body: JSON.stringify(data) },
    true,
  );
export const uploadDepartmentLogo = (id: string, logo: File) => {
  const fd = new FormData();
  fd.append("logo", logo);
  return authMultipart(`/departments/${id}/logo`, fd);
};
export const deleteDepartmentLogo = (id: string) =>
  apiRequest(`/departments/${id}/logo`, { method: "DELETE" }, true);
export const deleteDepartment = (id: string) =>
  apiRequest(`/departments/${id}`, { method: "DELETE" }, true);

// ─────────────────────────────────────────────────────────────────────
// Categories
// ─────────────────────────────────────────────────────────────────────

export const getCategories = () => apiRequest("/categories");
export const createCategory = (data: any) =>
  apiRequest(
    "/categories",
    { method: "POST", body: JSON.stringify(data) },
    true,
  );
export const updateCategory = (id: string, data: any) =>
  apiRequest(
    `/categories/${id}`,
    { method: "PUT", body: JSON.stringify(data) },
    true,
  );
export const deleteCategory = (id: string) =>
  apiRequest(`/categories/${id}`, { method: "DELETE" }, true);

// ─────────────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────────────

export const getEvents = (season?: string, pageParams: PageParams = {}) => {
  const qs = pageParamsToQuery(pageParams);
  if (season) qs.set("season", season);
  const s = qs.toString();
  return apiRequest(`/events${s ? `?${s}` : ""}`);
};
export const getEventsByDate = (date: string) =>
  apiRequest(`/events?date=${encodeURIComponent(date)}`);
export const getEvent = (id: string) => apiRequest(`/events/${id}`);
export const createEvent = (data: any) =>
  apiRequest("/events", { method: "POST", body: JSON.stringify(data) }, true);
export const updateEvent = (id: string, data: any) =>
  apiRequest(
    `/events/${id}`,
    { method: "PUT", body: JSON.stringify(data) },
    true,
  );
export const deleteEvent = (id: string) =>
  apiRequest(`/events/${id}`, { method: "DELETE" }, true);
export const bulkDeleteEvents = (ids: string[]) =>
  apiRequest(
    "/events/bulk-delete",
    { method: "POST", body: JSON.stringify({ ids }) },
    true,
  );
export const bulkUpdateEventStatus = (ids: string[], status: string) =>
  apiRequest(
    "/events/bulk-status",
    { method: "POST", body: JSON.stringify({ ids, status }) },
    true,
  );

// ─────────────────────────────────────────────────────────────────────
// Brackets — persisted tournament trees with progression
// ─────────────────────────────────────────────────────────────────────

export const getBrackets = (sport?: string) =>
  apiRequest(`/brackets${sport ? `?sport=${encodeURIComponent(sport)}` : ""}`);
export const getBracket = (id: string) => apiRequest(`/brackets/${id}`);
export const createBracket = (data: any) =>
  apiRequest("/brackets", { method: "POST", body: JSON.stringify(data) }, true);
export const publishBracket = (id: string) =>
  apiRequest(`/brackets/${id}/publish`, { method: "POST" }, true);
export const advanceBracketMatch = (
  bracketId: string,
  matchId: string,
  body?: { winner?: string; force?: boolean },
) =>
  apiRequest(
    `/brackets/${bracketId}/matches/${matchId}/advance`,
    { method: "POST", body: JSON.stringify(body ?? {}) },
    true,
  );
export const deleteBracket = (id: string, withEvents = false) =>
  apiRequest(
    `/brackets/${id}${withEvents ? "?withEvents=1" : ""}`,
    { method: "DELETE" },
    true,
  );

// ─────────────────────────────────────────────────────────────────────
// Racquet line-up — which athlete plays a college's Singles A / B / Doubles
// ─────────────────────────────────────────────────────────────────────

export interface DisciplineEntry {
  id: string;
  category: string;
  department: string;
  athleteId: string;
  athleteName: string;
  pairSlot: "C" | "D" | null;
}

export const getDisciplineEntries = (params: {
  category?: string;
  parentSport?: string;
  division?: string;
}) => {
  const q = new URLSearchParams();
  if (params.category) q.set("category", params.category);
  if (params.parentSport) q.set("parentSport", params.parentSport);
  if (params.division) q.set("division", params.division);
  const qs = q.toString();
  return apiRequest(`/discipline-entries${qs ? `?${qs}` : ""}`) as Promise<
    DisciplineEntry[]
  >;
};

export const assignDisciplineEntry = (data: {
  category: string;
  athleteId: string;
  pairSlot?: "C" | "D";
}) =>
  apiRequest(
    "/discipline-entries",
    { method: "POST", body: JSON.stringify(data) },
    true,
  ) as Promise<DisciplineEntry>;

export const removeDisciplineEntry = (id: string) =>
  apiRequest(`/discipline-entries/${id}`, { method: "DELETE" }, true);

// ─────────────────────────────────────────────────────────────────────
// Scores & Rankings
// ─────────────────────────────────────────────────────────────────────

export const getEventScores = (eventId: string) =>
  apiRequest(`/scores/${eventId}`);
export const submitScore = (data: any) =>
  apiRequest("/scores", { method: "POST", body: JSON.stringify(data) }, true);

// Result lifecycle — only `verified` / `official` scores count on the table.
export const verifyScore = (id: string) =>
  apiRequest(`/scores/${id}/verify`, { method: "POST" }, true);
export const disputeScore = (id: string, reason: string) =>
  apiRequest(
    `/scores/${id}/dispute`,
    { method: "POST", body: JSON.stringify({ reason }) },
    true,
  );
export const amendScore = (
  id: string,
  data: {
    scores?: Record<string, number> | null;
    totalScore: number;
    reason: string;
  },
) =>
  apiRequest(
    `/scores/${id}/amend`,
    { method: "POST", body: JSON.stringify(data) },
    true,
  );
export const officializeEvent = (eventId: string) =>
  apiRequest(`/events/${eventId}/officialize`, { method: "POST" }, true);

// ─────────────────────────────────────────────────────────────────────
// Protests — a college's formal complaint about an event outcome
// ─────────────────────────────────────────────────────────────────────

export interface Protest {
  id: string;
  eventId: string;
  eventName: string | null;
  eventCategory: string | null;
  seasonId: string | null;
  filedBy: string;
  filerName: string | null;
  department: string;
  reason: string;
  status: "open" | "upheld" | "dismissed";
  resolution: string | null;
  resolvedBy: string | null;
  resolverName: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export const getProtests = (
  filters: { status?: string; season?: string } = {},
) => {
  const qs = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v != null && v !== "") as [
      string,
      string,
    ][],
  ).toString();
  return apiRequest(`/protests${qs ? `?${qs}` : ""}`, {}, true) as Promise<
    Protest[]
  >;
};
export const fileProtest = (data: { eventId: string; reason: string }) =>
  apiRequest(
    "/protests",
    { method: "POST", body: JSON.stringify(data) },
    true,
  ) as Promise<Protest>;
export const resolveProtest = (
  id: string,
  data: { status: "upheld" | "dismissed"; resolution: string },
) =>
  apiRequest(
    `/protests/${id}/resolve`,
    { method: "POST", body: JSON.stringify(data) },
    true,
  ) as Promise<Protest>;

export const getEventRankings = (eventId: string) =>
  apiRequest(`/rankings/${eventId}`);
export const getLeaderboard = (
  category?: string,
  parentSport?: string,
  season?: string,
) => {
  const p = new URLSearchParams();
  if (category) p.set("category", category);
  if (parentSport) p.set("parentSport", parentSport);
  if (season) p.set("season", season);
  const q = p.toString();
  return apiRequest(`/leaderboard${q ? `?${q}` : ""}`);
};
export const extractOcrScores = (data: { image?: string }) =>
  apiRequest(
    "/ocr/extract",
    { method: "POST", body: JSON.stringify(data) },
    true,
  );

// ─────────────────────────────────────────────────────────────────────
// Live game scores — the running score of a game in progress
// ─────────────────────────────────────────────────────────────────────

export interface LiveScore {
  eventId: string;
  sport: string;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number;
  awayScore: number;
  period: string | null;
  detail: any;
  status: "scheduled" | "in_progress" | "final";
  version: number;
  updatedBy: string | null;
  startedAt: string | null;
  finalizedAt: string | null;
  updatedAt: string | null;
  eventName?: string | null;
  venueName?: string | null;
  category?: string | null;
}

export const getLiveScores = (activeOnly = false): Promise<LiveScore[]> =>
  apiRequest(`/live-scores${activeOnly ? "?active=1" : ""}`);

export const getEventLiveScore = (
  eventId: string,
): Promise<{ live: LiveScore | null }> => apiRequest(`/events/${eventId}/live`);

export const pushEventLiveScore = (
  eventId: string,
  data: Partial<
    Pick<
      LiveScore,
      | "homeTeam"
      | "awayTeam"
      | "homeScore"
      | "awayScore"
      | "period"
      | "detail"
      | "status"
      | "version"
    >
  >,
): Promise<{ live: LiveScore }> =>
  apiRequest(
    `/events/${eventId}/live`,
    { method: "PUT", body: JSON.stringify(data) },
    true,
  );

export const clearEventLiveScore = (eventId: string) =>
  apiRequest(`/events/${eventId}/live`, { method: "DELETE" }, true);

// ─────────────────────────────────────────────────────────────────────
// Match records & standings (the bracket-seeding source)
// ─────────────────────────────────────────────────────────────────────

export const getStandings = (sport: string) =>
  apiRequest(`/standings/${encodeURIComponent(sport)}`);

export const getMatches = (sport?: string) => {
  const q = sport ? `?sport=${encodeURIComponent(sport)}` : "";
  return apiRequest(`/matches${q}`);
};
export const createMatch = (data: any) =>
  apiRequest("/matches", { method: "POST", body: JSON.stringify(data) }, true);
export const updateMatch = (id: string, data: any) =>
  apiRequest(
    `/matches/${id}`,
    { method: "PUT", body: JSON.stringify(data) },
    true,
  );
export const deleteMatch = (id: string) =>
  apiRequest(`/matches/${id}`, { method: "DELETE" }, true);

// Reports & exports (admin only)
export const getEventReport = (eventId: string) =>
  apiRequest(`/reports/events/${eventId}`, {}, true);

/** Fetch a CSV/HTML export with the auth token; returns the blob + filename. */
async function fetchExport(
  path: string,
): Promise<{ blob: Blob; filename: string }> {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error((await res.text()) || "Export failed");
  const cd = res.headers.get("content-disposition") ?? "";
  const filename = cd.match(/filename="?([^"]+)"?/)?.[1] ?? "export";
  return { blob: await res.blob(), filename };
}

/** Download a CSV, or open a printable HTML page in a new tab. */
export function deliverExport({
  blob,
  filename,
}: {
  blob: Blob;
  filename: string;
}) {
  const url = URL.createObjectURL(blob);
  if (blob.type.includes("text/html")) {
    window.open(url, "_blank", "noopener");
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 15_000);
}

export const exportEventReport = (eventId: string, format: "csv" | "html") =>
  fetchExport(`/reports/events/${eventId}/export?format=${format}`);
export const exportLeaderboard = (format: "csv" | "html", season?: string) =>
  fetchExport(
    `/reports/leaderboard/export?format=${format}${season ? `&season=${encodeURIComponent(season)}` : ""}`,
  );
export const exportCertificates = (season?: string) =>
  fetchExport(
    `/reports/certificates${season ? `?season=${encodeURIComponent(season)}` : ""}`,
  );

// ─────────────────────────────────────────────────────────────────────
// Venues
// ─────────────────────────────────────────────────────────────────────

export const getVenues = () => apiRequest("/venues");
export const createVenue = (data: any) =>
  apiRequest("/venues", { method: "POST", body: JSON.stringify(data) }, true);
export const updateVenue = (id: string, data: any) =>
  apiRequest(
    `/venues/${id}`,
    { method: "PUT", body: JSON.stringify(data) },
    true,
  );
export const deleteVenue = (id: string) =>
  apiRequest(`/venues/${id}`, { method: "DELETE" }, true);

// ─────────────────────────────────────────────────────────────────────
// Registration Codes (admin only)
// ─────────────────────────────────────────────────────────────────────

export const getRegistrationCodes = (pageParams: PageParams = {}) => {
  const s = pageParamsToQuery(pageParams).toString();
  return apiRequest(`/registration-codes${s ? `?${s}` : ""}`, {}, true);
};
export const createRegistrationCode = (data: {
  role: "admin" | "coach" | "athlete" | "judge";
  expiresInDays?: number;
  label?: string;
}) =>
  apiRequest(
    "/registration-codes",
    { method: "POST", body: JSON.stringify(data) },
    true,
  );
export const revokeRegistrationCode = (code: string) =>
  apiRequest(`/registration-codes/${code}`, { method: "DELETE" }, true);

// ─────────────────────────────────────────────────────────────────────
// Athletes (coach access)
// ─────────────────────────────────────────────────────────────────────

export const getAthletes = (pageParams: PageParams = {}) => {
  const s = pageParamsToQuery(pageParams).toString();
  return apiRequest(`/athletes${s ? `?${s}` : ""}`, {}, true);
};
export const getAthlete = (id: string) =>
  apiRequest(`/athletes/${id}`, {}, true);
export const createAthlete = (data: any) =>
  apiRequest("/athletes", { method: "POST", body: JSON.stringify(data) }, true);
export const updateAthlete = (id: string, data: any) =>
  apiRequest(
    `/athletes/${id}`,
    { method: "PUT", body: JSON.stringify(data) },
    true,
  );
export const deleteAthlete = (id: string) =>
  apiRequest(`/athletes/${id}`, { method: "DELETE" }, true);
export const removeAthleteFromRoster = (id: string) =>
  apiRequest(`/athletes/${id}/remove`, { method: "DELETE" }, true);

// ─────────────────────────────────────────────────────────────────────
// Coach Profile
// ─────────────────────────────────────────────────────────────────────

export const getCoachProfile = () => apiRequest("/coach/profile", {}, true);
export const updateCoachProfile = (data: {
  sports: string[];
  department: string;
  genderCategory?: string;
}) =>
  apiRequest(
    "/coach/profile",
    { method: "PUT", body: JSON.stringify(data) },
    true,
  );

// Admin Coach Management
export const getCoaches = () => apiRequest("/admin/coaches", {}, true);
export const updateCoachDepartment = (
  id: string,
  data: { department: string | null },
) =>
  apiRequest(
    `/admin/coaches/${id}`,
    { method: "PUT", body: JSON.stringify(data) },
    true,
  );

// ─────────────────────────────────────────────────────────────────────
// User Management (admin only) — every account, all roles
// ─────────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "coach" | "athlete" | "judge";

export interface UserListFilters {
  role?: UserRole;
  status?: "active" | "inactive";
  search?: string;
  page?: number;
  perPage?: number;
}

export const getUsers = (filters: UserListFilters = {}) => {
  const { page, perPage, ...rest } = filters;
  const qs = new URLSearchParams(
    Object.entries(rest).filter(([, v]) => v != null && v !== "") as [
      string,
      string,
    ][],
  );
  const pageQs = pageParamsToQuery({ page, perPage });
  pageQs.forEach((value, key) => qs.set(key, value));
  const s = qs.toString();
  return apiRequest(`/admin/users${s ? `?${s}` : ""}`, {}, true);
};

export const getUser = (id: string) =>
  apiRequest(`/admin/users/${id}`, {}, true);

export const updateUser = (
  id: string,
  data: Partial<{
    name: string;
    email: string;
    role: UserRole;
    department: string | null;
    sport: string | null;
    sports: string[];
    genderCategory: string | null;
  }>,
) =>
  apiRequest(
    `/admin/users/${id}`,
    { method: "PUT", body: JSON.stringify(data) },
    true,
  );

export const setUserActive = (id: string, active: boolean) =>
  apiRequest(
    `/admin/users/${id}/active`,
    { method: "POST", body: JSON.stringify({ active }) },
    true,
  );

export const resetUserPassword = (id: string, password?: string) =>
  apiRequest(
    `/admin/users/${id}/reset-password`,
    {
      method: "POST",
      body: JSON.stringify(password ? { password } : {}),
    },
    true,
  );

export const deleteUser = (id: string) =>
  apiRequest(`/admin/users/${id}`, { method: "DELETE" }, true);

// ─────────────────────────────────────────────────────────────────────
// Enrollment (athlete)
// ─────────────────────────────────────────────────────────────────────

export const enrollWithCode = (enrollmentCode: string) =>
  apiRequest(
    "/enroll",
    { method: "POST", body: JSON.stringify({ enrollmentCode }) },
    true,
  );
export const unenrollFromCoach = () =>
  apiRequest("/unenroll", { method: "DELETE" }, true);
export const getMyCoach = () => apiRequest("/my-coach", {}, true);

// ─────────────────────────────────────────────────────────────────────
// Announcements
// ─────────────────────────────────────────────────────────────────────

export const getAnnouncements = (pageParams: PageParams = {}) => {
  const s = pageParamsToQuery(pageParams).toString();
  return apiRequest(`/announcements${s ? `?${s}` : ""}`);
};
export const createAnnouncement = (data: any) =>
  apiRequest(
    "/announcements",
    { method: "POST", body: JSON.stringify(data) },
    true,
  );
export const updateAnnouncement = (id: string, data: any) =>
  apiRequest(
    `/announcements/${id}`,
    { method: "PUT", body: JSON.stringify(data) },
    true,
  );
export const deleteAnnouncement = (id: string) =>
  apiRequest(`/announcements/${id}`, { method: "DELETE" }, true);

// ─────────────────────────────────────────────────────────────────────
// Tryout Applications
// ─────────────────────────────────────────────────────────────────────

/** Checks the SR Code + email against the campus roster, then emails a code. */
export const verifyTryoutEmail = (applicant: {
  email: string;
  studentId: string;
  firstName: string;
  lastName: string;
}) =>
  apiRequest("/tryouts/verify-email", {
    method: "POST",
    body: JSON.stringify(applicant),
  });
export const applyForTryout = (data: any) =>
  apiRequest("/tryouts/apply", { method: "POST", body: JSON.stringify(data) });
/**
 * Who the committee QR email reached. `noEmail` members only got the in-app
 * notice (their account has no email address).
 */
export interface CommitteeEmailResult {
  sent: { name: string; email: string }[];
  failed: { name: string; email: string }[];
  noEmail: { name: string }[];
}
/** Email the event's QR code to its committee again. */
export const sendEventQr = (eventId: string) =>
  apiRequest(`/events/${eventId}/send-qr`, { method: "POST" }, true) as Promise<CommitteeEmailResult>;

export const getTryoutApplications = () => apiRequest("/tryouts", {}, true);
/** Accept (adds them to the roster) or reject a tryout applicant. */
export const updateTryoutStatus = (
  id: string,
  data: { status: "accepted" | "rejected"; note?: string },
) =>
  apiRequest(
    `/tryouts/${id}/status`,
    { method: "PUT", body: JSON.stringify(data) },
    true,
  );

// ─────────────────────────────────────────────────────────────────────
// Attendance (coach)
// ─────────────────────────────────────────────────────────────────────

export const markAttendance = (records: any[]) =>
  apiRequest(
    "/attendance",
    { method: "POST", body: JSON.stringify({ records }) },
    true,
  );
export const getAttendanceRecords = () => apiRequest("/attendance", {}, true);

// Attendance sessions — the coach creates many, marks a roster in each.
export interface AttendanceSession {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  venueName: string | null;
  markedCount: number;
  rosterCount: number;
  complete: boolean;
  createdAt: string;
}
export const getAttendanceSessions = () =>
  apiRequest("/attendance/sessions", {}, true) as Promise<AttendanceSession[]>;
/** Optional when/where of a training session (times as "HH:mm"). */
export interface SessionTiming {
  startTime?: string | null;
  endTime?: string | null;
  venueName?: string | null;
}
export const createAttendanceSession = (data: {
  title: string;
  date: string;
} & SessionTiming) =>
  apiRequest(
    "/attendance/sessions",
    { method: "POST", body: JSON.stringify(data) },
    true,
  ) as Promise<AttendanceSession>;
export const updateAttendanceSession = (
  id: string,
  patch: { title?: string; date?: string } & SessionTiming,
) =>
  apiRequest(
    `/attendance/sessions/${id}`,
    { method: "PUT", body: JSON.stringify(patch) },
    true,
  ) as Promise<AttendanceSession>;
/** Automated training scheduling: one session per chosen weekday (0 = Sun) in a date range. */
export const createRecurringSessions = (data: {
  title: string;
  from: string;
  to: string;
  weekdays: number[];
} & SessionTiming) =>
  apiRequest(
    "/attendance/sessions/recurring",
    { method: "POST", body: JSON.stringify(data) },
    true,
  ) as Promise<{ created: AttendanceSession[]; skipped: { date: string; reason: string }[] }>;

/** The signed-in athlete's upcoming training (their coach's sessions). */
export interface TrainingSession {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  venueName: string | null;
  coachName: string | null;
}
/** One Sports Office transaction: a CMO requirement, tryout application or protest. */
export interface OfficeTransaction {
  id: string;
  type: "cmo_requirement" | "tryout_application" | "protest";
  reference: string;
  party: string;
  subject: string;
  status: string;
  open: boolean;
  filedAt: string | null;
  decidedAt: string | null;
  link: string;
}
export interface TransactionPage {
  data: OfficeTransaction[];
  total: number;
  page: number;
  perPage: number;
  counts: { open: number; closed: number };
}
export const getTransactions = (params: { type?: string; status?: string; q?: string; page?: number }) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "" && v !== "all") qs.set(k, String(v)); });
  return apiRequest(`/admin/transactions?${qs}`, {}, true) as Promise<TransactionPage>;
};

export const getAthleteTraining = () =>
  apiRequest("/athlete/training", {}, true) as Promise<TrainingSession[]>;

export const deleteAttendanceSession = (id: string) =>
  apiRequest(`/attendance/sessions/${id}`, { method: "DELETE" }, true);
export const getAttendanceSession = (id: string) =>
  apiRequest(`/attendance/sessions/${id}`, {}, true) as Promise<{
    session: AttendanceSession;
    records: any[];
  }>;
export const saveSessionRecords = (
  id: string,
  records: { athleteId: string; status: string; notes?: string }[],
) =>
  apiRequest(
    `/attendance/sessions/${id}/records`,
    { method: "POST", body: JSON.stringify({ records }) },
    true,
  ) as Promise<{
    saved: number;
    skipped: number;
    markedCount: number;
    rosterCount: number;
  }>;

// ─────────────────────────────────────────────────────────────────────
// Performance
// ─────────────────────────────────────────────────────────────────────

export const recordPerformance = (data: any) =>
  apiRequest(
    "/performance",
    { method: "POST", body: JSON.stringify(data) },
    true,
  );
export const getPerformanceRecords = () => apiRequest("/performance", {}, true);
export const getMyPerformance = () => apiRequest("/performance/my", {}, true);

// ─────────────────────────────────────────────────────────────────────
// Requirements
// ─────────────────────────────────────────────────────────────────────

export const submitRequirement = (data: any) => {
  const formData = new FormData();
  formData.append("type", data.type);
  formData.append("name", data.name);
  if (data.description) formData.append("description", data.description);
  if (data.file) formData.append("file", data.file);
  if (data.requirementTypeId)
    formData.append("requirementTypeId", data.requirementTypeId);
  if (data.supersedesId) formData.append("supersedesId", data.supersedesId);

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const token = localStorage.getItem("auth_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(`${API_URL}/requirements`, {
    method: "POST",
    headers,
    body: formData,
  }).then(async (response) => {
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorText;
      } catch { /* not JSON — fall back to the raw error text */ }
      throw new Error(errorMessage || "Failed to submit requirement");
    }
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    return keysToCamelCase(data);
  });
};
export const getRequirements = (pageParams: PageParams = {}) => {
  const s = pageParamsToQuery(pageParams).toString();
  return apiRequest(`/requirements${s ? `?${s}` : ""}`, {}, true);
};
export const getMyRequirements = () => apiRequest("/requirements/my", {}, true);
export const updateRequirementStatus = (id: string, data: any) =>
  apiRequest(
    `/requirements/${id}/status`,
    { method: "PUT", body: JSON.stringify(data) },
    true,
  );

// ─────────────────────────────────────────────────────────────────────
// Requirement types — the eligibility checklist catalog
// ─────────────────────────────────────────────────────────────────────

export interface RequirementTypeRow {
  id: string;
  name: string;
  description: string | null;
  templateFileUrl: string | null;
  sport: string | null;
  required: boolean;
  active: boolean;
  createdAt: string;
}

export interface RequirementTypeInput {
  name: string;
  description?: string | null;
  sport?: string | null;
  required?: boolean;
  active?: boolean;
}

export const getRequirementTypes = (
  opts: { sport?: string; includeInactive?: boolean } = {},
) => {
  const p = new URLSearchParams();
  if (opts.sport) p.set("sport", opts.sport);
  if (opts.includeInactive) p.set("includeInactive", "1");
  const q = p.toString();
  return apiRequest(
    `/requirement-types${q ? `?${q}` : ""}`,
    {},
    true,
  ) as Promise<RequirementTypeRow[]>;
};
export const createRequirementType = (data: RequirementTypeInput) =>
  apiRequest(
    "/requirement-types",
    { method: "POST", body: JSON.stringify(data) },
    true,
  ) as Promise<RequirementTypeRow>;
export const updateRequirementType = (
  id: string,
  data: Partial<RequirementTypeInput>,
) =>
  apiRequest(
    `/requirement-types/${id}`,
    { method: "PUT", body: JSON.stringify(data) },
    true,
  ) as Promise<RequirementTypeRow>;
export const deleteRequirementType = (id: string) =>
  apiRequest(`/requirement-types/${id}`, { method: "DELETE" }, true);

export const uploadRequirementTypeTemplate = (id: string, file: File) => {
  const formData = new FormData();
  formData.append("template", file);

  const headers: Record<string, string> = { Accept: "application/json" };
  const token = localStorage.getItem("auth_token");
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return fetch(`${API_URL}/requirement-types/${id}/template`, {
    method: "POST",
    headers,
    body: formData,
  }).then(async (response) => {
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorText;
      } catch { /* not JSON — fall back to the raw error text */ }
      throw new Error(errorMessage || "Failed to upload template");
    }
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    return keysToCamelCase(data) as RequirementTypeRow;
  });
};
export const deleteRequirementTypeTemplate = (id: string) =>
  apiRequest(
    `/requirement-types/${id}/template`,
    { method: "DELETE" },
    true,
  ) as Promise<RequirementTypeRow>;

export interface ClearanceStatus {
  cleared: boolean;
  requiredCount: number;
  approvedCount: number;
  missing: RequirementTypeRow[];
}

export const getMyClearance = () =>
  apiRequest(
    "/requirements/my/clearance",
    {},
    true,
  ) as Promise<ClearanceStatus>;

// ─────────────────────────────────────────────────────────────────────
// My team — teammates + the coach's announcements
// ─────────────────────────────────────────────────────────────────────

export interface Teammate {
  id: string;
  name: string;
  department: string | null;
  yearLevel: string | null;
}

export interface MyTeam {
  coach: { id: string; name: string; email: string; sport: string } | null;
  teammates: Teammate[];
  announcements: {
    id: string;
    title: string;
    content: string;
    sport: string | null;
    isTryout: boolean;
    createdAt: string;
  }[];
}

export const getMyTeam = () =>
  apiRequest("/my-team", {}, true) as Promise<MyTeam>;

// ─────────────────────────────────────────────────────────────────────
// Judges
// ─────────────────────────────────────────────────────────────────────

export const getJudges = () => apiRequest("/judges", {}, true);

// ─────────────────────────────────────────────────────────────────────
// Site content — the admin-managed public photo slideshow + welcome popup
// ─────────────────────────────────────────────────────────────────────

/** POST multipart/form-data with the auth token, sharing apiRequest's error handling. */
async function authMultipart(endpoint: string, formData: FormData) {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = localStorage.getItem("auth_token");
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers,
    body: formData,
  });
  const text = await response.text();
  if (!response.ok) {
    let msg = text;
    try {
      const j = JSON.parse(text);
      msg = j.errors
        ? Object.values(j.errors).flat().join(", ")
        : j.error || j.message || text;
    } catch { /* not JSON — fall back to the raw text */ }
    throw new Error(msg || "Upload failed");
  }
  return keysToCamelCase(text ? JSON.parse(text) : {});
}

interface SiteSlideInput {
  type?: "carousel" | "popup";
  title?: string;
  caption?: string;
  linkUrl?: string;
  active?: boolean;
  sortOrder?: number;
  image?: File | null;
}

function siteSlideFormData(data: SiteSlideInput, method?: "PUT"): FormData {
  const fd = new FormData();
  if (method) fd.append("_method", method);
  if (data.type) fd.append("type", data.type);
  if (data.title !== undefined) fd.append("title", data.title ?? "");
  if (data.caption !== undefined) fd.append("caption", data.caption ?? "");
  if (data.linkUrl !== undefined) fd.append("linkUrl", data.linkUrl ?? "");
  if (data.active !== undefined) fd.append("active", data.active ? "1" : "0");
  if (data.sortOrder !== undefined)
    fd.append("sortOrder", String(data.sortOrder));
  if (data.image) fd.append("image", data.image);
  return fd;
}

/** Public: active slides for the slideshow ('carousel') or the welcome popup ('popup'). */
export const getSiteSlides = (type: "carousel" | "popup") =>
  apiRequest(`/site-slides?type=${type}`);

/** Admin: every slide, including hidden ones. */
export const getAdminSiteSlides = (type?: "carousel" | "popup") =>
  apiRequest(`/admin/site-slides${type ? `?type=${type}` : ""}`, {}, true);

export const createSiteSlide = (data: SiteSlideInput) =>
  authMultipart("/admin/site-slides", siteSlideFormData(data));

export const updateSiteSlide = (id: string, data: SiteSlideInput) =>
  authMultipart(`/admin/site-slides/${id}`, siteSlideFormData(data, "PUT"));

export const deleteSiteSlide = (id: string) =>
  apiRequest(`/admin/site-slides/${id}`, { method: "DELETE" }, true);

export const reorderSiteSlides = (
  type: "carousel" | "popup",
  order: string[],
) =>
  apiRequest(
    "/admin/site-slides/reorder",
    { method: "POST", body: JSON.stringify({ type, order }) },
    true,
  );

// ─────────────────────────────────────────────────────────────────────
// In-app notifications
// ─────────────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string | null;
  readAt: string | null;
  createdAt: string;
}

export const getNotifications = (
  opts: { unread?: boolean; limit?: number } = {},
) => {
  const p = new URLSearchParams();
  if (opts.unread) p.set("unread", "1");
  if (opts.limit) p.set("limit", String(opts.limit));
  const q = p.toString();
  return apiRequest(`/notifications${q ? `?${q}` : ""}`, {}, true) as Promise<{
    items: AppNotification[];
    unreadCount: number;
  }>;
};
export const markNotificationRead = (id: string) =>
  apiRequest(`/notifications/${id}/read`, { method: "POST" }, true);
export const markAllNotificationsRead = () =>
  apiRequest("/notifications/read-all", { method: "POST" }, true);

// ─────────────────────────────────────────────────────────────────────
// Seasons — tournament editions. Exactly one is active; it is the default
// scope for the public leaderboard, schedule and brackets.
// ─────────────────────────────────────────────────────────────────────

export interface Season {
  id: string;
  name: string;
  startsOn: string | null;
  endsOn: string | null;
  isActive: boolean;
  eventCount: number;
  createdAt: string;
}

export interface SeasonInput {
  name: string;
  startsOn?: string | null;
  endsOn?: string | null;
  activate?: boolean;
}

export const getSeasons = () => apiRequest("/seasons") as Promise<Season[]>;
export const getCurrentSeason = () =>
  apiRequest("/seasons/current") as Promise<Season | null>;
export const createSeason = (data: SeasonInput) =>
  apiRequest(
    "/seasons",
    { method: "POST", body: JSON.stringify(data) },
    true,
  ) as Promise<Season>;
export const updateSeason = (id: string, data: Partial<SeasonInput>) =>
  apiRequest(
    `/seasons/${id}`,
    { method: "PUT", body: JSON.stringify(data) },
    true,
  ) as Promise<Season>;
export const activateSeason = (id: string) =>
  apiRequest(
    `/seasons/${id}/activate`,
    { method: "POST" },
    true,
  ) as Promise<Season>;
export const deleteSeason = (id: string) =>
  apiRequest(`/seasons/${id}`, { method: "DELETE" }, true);

// ─────────────────────────────────────────────────────────────────────
// Recovery & audit (admin) — soft-deleted rows and the change trail
// ─────────────────────────────────────────────────────────────────────

export interface TrashItem {
  id: string;
  label: string;
  detail: string;
  deletedAt: string;
  eventId?: string;
}

export interface Trash {
  events: TrashItem[];
  scores: TrashItem[];
  athletes: TrashItem[];
  brackets: TrashItem[];
  announcements: TrashItem[];
}

export type TrashKind = keyof Trash;

export interface AuditLogEntry {
  id: number;
  event: string;
  auditableType: string;
  auditableId: string;
  userId: string | null;
  userName: string | null;
  userRole: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  url: string | null;
  createdAt: string;
}

export interface AuditLogFilters {
  type?:
    | "Score"
    | "Event"
    | "Athlete"
    | "Bracket"
    | "Announcement"
    | "User"
    | "Requirement";
  id?: string;
  userId?: string;
  event?: string;
  limit?: number;
  before?: number;
}

export const getTrash = () =>
  apiRequest("/admin/trash", {}, true) as Promise<Trash>;

export const getAuditLogs = (filters: AuditLogFilters = {}) => {
  const qs = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v != null && v !== "") as [
      string,
      string,
    ][],
  ).toString();
  return apiRequest(
    `/admin/audit-logs${qs ? `?${qs}` : ""}`,
    {},
    true,
  ) as Promise<{
    logs: AuditLogEntry[];
    nextCursor: number | null;
  }>;
};

const restore = (path: string) => apiRequest(path, { method: "POST" }, true);

export const restoreEvent = (id: string) => restore(`/events/${id}/restore`);
export const restoreAthlete = (id: string) =>
  restore(`/athletes/${id}/restore`);
export const restoreAnnouncement = (id: string) =>
  restore(`/announcements/${id}/restore`);
export const restoreScore = (id: string) => restore(`/scores/${id}/restore`);
export const restoreBracket = (id: string, withEvents = false) =>
  restore(`/brackets/${id}/restore${withEvents ? "?withEvents=1" : ""}`);
export const deleteScore = (id: string) =>
  apiRequest(`/scores/${id}`, { method: "DELETE" }, true);

// ─────────────────────────────────────────────────────────────────────
// Legacy no-op warmup (kept for compatibility)
// ─────────────────────────────────────────────────────────────────────

export const warmupServer = async (): Promise<boolean> => true;
export const startWarmup = (): Promise<boolean> => Promise.resolve(true);
