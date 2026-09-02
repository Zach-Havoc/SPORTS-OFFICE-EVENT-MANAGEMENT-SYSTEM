import { API_URL } from '../../config/api';

// ─────────────────────────────────────────────────────────────────────
// Core request helper
// ─────────────────────────────────────────────────────────────────────

const toCamelCase = (str: string) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

const keysToCamelCase = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(v => keysToCamelCase(v));
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
  requiresAuth = false
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (requiresAuth) {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('You are not logged in. Please sign in to continue.');
    }
    headers['Authorization'] = `Bearer ${token}`;
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
      errorMessage = errorJson.error || errorJson.message || errorJson.errors
        ? (typeof errorJson.errors === 'object'
            ? Object.values(errorJson.errors).flat().join(', ')
            : errorJson.error || errorJson.message)
        : errorText;
    } catch (_) {
      // not JSON
    }

    // Only treat 401/403 as "session expired" for authenticated routes.
    // For public routes (e.g. /login, /signup), fall through and surface
    // the server's real error message (e.g. "Access denied" or "Invalid credentials").
    if (requiresAuth && (response.status === 401 || response.status === 403)) {
      localStorage.removeItem('auth_token');
      throw new Error('Your session has expired. Please log in again.');
    }

    throw new Error(errorMessage || 'API request failed');
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
  role: 'admin' | 'coach' | 'athlete' | 'judge',
  registrationCode: string
) =>
  apiRequest('/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, name, role, registrationCode }),
  });

export const login = (email: string, password: string) =>
  apiRequest('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const logout = () =>
  apiRequest('/logout', { method: 'POST' }, true);

export const getAuthUser = () => apiRequest('/user', {}, true);

export const resetPassword = (email: string) =>
  apiRequest('/reset-password', { method: 'POST', body: JSON.stringify({ email }) });

export const updateAccountProfile = (data: { name: string }) =>
  apiRequest('/account/profile', { method: 'PUT', body: JSON.stringify(data) }, true);

export const updateAccountPassword = (data: { currentPassword: string; newPassword: string }) =>
  apiRequest('/account/password', { method: 'PUT', body: JSON.stringify(data) }, true);

// ─────────────────────────────────────────────────────────────────────
// Departments
// ─────────────────────────────────────────────────────────────────────

export const getDepartments = () => apiRequest('/departments');
export const createDepartment = (data: any) =>
  apiRequest('/departments', { method: 'POST', body: JSON.stringify(data) }, true);
export const updateDepartment = (id: string, data: any) =>
  apiRequest(`/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) }, true);
export const deleteDepartment = (id: string) =>
  apiRequest(`/departments/${id}`, { method: 'DELETE' }, true);

// ─────────────────────────────────────────────────────────────────────
// Categories
// ─────────────────────────────────────────────────────────────────────

export const getCategories = () => apiRequest('/categories');
export const createCategory = (data: any) =>
  apiRequest('/categories', { method: 'POST', body: JSON.stringify(data) }, true);
export const updateCategory = (id: string, data: any) =>
  apiRequest(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }, true);
export const deleteCategory = (id: string) =>
  apiRequest(`/categories/${id}`, { method: 'DELETE' }, true);

// ─────────────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────────────

export const getEvents = () => apiRequest('/events');
export const getEventsByDate = (date: string) => apiRequest(`/events?date=${encodeURIComponent(date)}`);
export const getEvent = (id: string) => apiRequest(`/events/${id}`);
export const createEvent = (data: any) =>
  apiRequest('/events', { method: 'POST', body: JSON.stringify(data) }, true);
export const updateEvent = (id: string, data: any) =>
  apiRequest(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }, true);
export const deleteEvent = (id: string) =>
  apiRequest(`/events/${id}`, { method: 'DELETE' }, true);
export const bulkDeleteEvents = (ids: string[]) =>
  apiRequest('/events/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }, true);
export const bulkUpdateEventStatus = (ids: string[], status: string) =>
  apiRequest('/events/bulk-status', { method: 'POST', body: JSON.stringify({ ids, status }) }, true);

// ─────────────────────────────────────────────────────────────────────
// Brackets — persisted tournament trees with progression
// ─────────────────────────────────────────────────────────────────────

export const getBrackets = (sport?: string) =>
  apiRequest(`/brackets${sport ? `?sport=${encodeURIComponent(sport)}` : ''}`);
export const getBracket = (id: string) => apiRequest(`/brackets/${id}`);
export const createBracket = (data: any) =>
  apiRequest('/brackets', { method: 'POST', body: JSON.stringify(data) }, true);
export const publishBracket = (id: string) =>
  apiRequest(`/brackets/${id}/publish`, { method: 'POST' }, true);
export const advanceBracketMatch = (bracketId: string, matchId: string, body?: { winner?: string; force?: boolean }) =>
  apiRequest(`/brackets/${bracketId}/matches/${matchId}/advance`, { method: 'POST', body: JSON.stringify(body ?? {}) }, true);
export const deleteBracket = (id: string, withEvents = false) =>
  apiRequest(`/brackets/${id}${withEvents ? '?withEvents=1' : ''}`, { method: 'DELETE' }, true);

// ─────────────────────────────────────────────────────────────────────
// Scores & Rankings
// ─────────────────────────────────────────────────────────────────────

export const getEventScores = (eventId: string) => apiRequest(`/scores/${eventId}`);
export const submitScore = (data: any) =>
  apiRequest('/scores', { method: 'POST', body: JSON.stringify(data) }, true);

export const getEventRankings = (eventId: string) => apiRequest(`/rankings/${eventId}`);
export const getLeaderboard = (category?: string) => {
  const q = category ? `?category=${encodeURIComponent(category)}` : '';
  return apiRequest(`/leaderboard${q}`);
};
export const extractOcrScores = (data: { image?: string }) =>
  apiRequest('/ocr/extract', { method: 'POST', body: JSON.stringify(data) }, true);

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
  status: 'scheduled' | 'in_progress' | 'final';
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
  apiRequest(`/live-scores${activeOnly ? '?active=1' : ''}`);

export const getEventLiveScore = (eventId: string): Promise<{ live: LiveScore | null }> =>
  apiRequest(`/events/${eventId}/live`);

export const pushEventLiveScore = (
  eventId: string,
  data: Partial<Pick<LiveScore, 'homeTeam' | 'awayTeam' | 'homeScore' | 'awayScore' | 'period' | 'detail' | 'status' | 'version'>>,
): Promise<{ live: LiveScore }> =>
  apiRequest(`/events/${eventId}/live`, { method: 'PUT', body: JSON.stringify(data) }, true);

export const clearEventLiveScore = (eventId: string) =>
  apiRequest(`/events/${eventId}/live`, { method: 'DELETE' }, true);

// ─────────────────────────────────────────────────────────────────────
// Match records & standings (the bracket-seeding source)
// ─────────────────────────────────────────────────────────────────────

export const getStandings = (sport: string) =>
  apiRequest(`/standings/${encodeURIComponent(sport)}`);

export const getMatches = (sport?: string) => {
  const q = sport ? `?sport=${encodeURIComponent(sport)}` : '';
  return apiRequest(`/matches${q}`);
};
export const createMatch = (data: any) =>
  apiRequest('/matches', { method: 'POST', body: JSON.stringify(data) }, true);
export const updateMatch = (id: string, data: any) =>
  apiRequest(`/matches/${id}`, { method: 'PUT', body: JSON.stringify(data) }, true);
export const deleteMatch = (id: string) =>
  apiRequest(`/matches/${id}`, { method: 'DELETE' }, true);

// Reports (admin only)
export const getEventReport = (eventId: string) =>
  apiRequest(`/reports/${eventId}`, {}, true);

// ─────────────────────────────────────────────────────────────────────
// Venues
// ─────────────────────────────────────────────────────────────────────

export const getVenues = () => apiRequest('/venues');
export const createVenue = (data: any) =>
  apiRequest('/venues', { method: 'POST', body: JSON.stringify(data) }, true);
export const updateVenue = (id: string, data: any) =>
  apiRequest(`/venues/${id}`, { method: 'PUT', body: JSON.stringify(data) }, true);
export const deleteVenue = (id: string) =>
  apiRequest(`/venues/${id}`, { method: 'DELETE' }, true);

// ─────────────────────────────────────────────────────────────────────
// Registration Codes (admin only)
// ─────────────────────────────────────────────────────────────────────

export const getRegistrationCodes = () => apiRequest('/registration-codes', {}, true);
export const createRegistrationCode = (data: {
  role: 'admin' | 'coach' | 'athlete' | 'judge';
  expiresInDays?: number;
  label?: string;
}) =>
  apiRequest('/registration-codes', { method: 'POST', body: JSON.stringify(data) }, true);
export const revokeRegistrationCode = (code: string) =>
  apiRequest(`/registration-codes/${code}`, { method: 'DELETE' }, true);

// ─────────────────────────────────────────────────────────────────────
// Athletes (coach access)
// ─────────────────────────────────────────────────────────────────────

export const getAthletes = () => apiRequest('/athletes', {}, true);
export const getAthlete = (id: string) => apiRequest(`/athletes/${id}`, {}, true);
export const createAthlete = (data: any) =>
  apiRequest('/athletes', { method: 'POST', body: JSON.stringify(data) }, true);
export const updateAthlete = (id: string, data: any) =>
  apiRequest(`/athletes/${id}`, { method: 'PUT', body: JSON.stringify(data) }, true);
export const deleteAthlete = (id: string) =>
  apiRequest(`/athletes/${id}`, { method: 'DELETE' }, true);
export const removeAthleteFromRoster = (id: string) =>
  apiRequest(`/athletes/${id}/remove`, { method: 'DELETE' }, true);

// ─────────────────────────────────────────────────────────────────────
// Coach Profile
// ─────────────────────────────────────────────────────────────────────

export const getCoachProfile = () => apiRequest('/coach/profile', {}, true);
export const updateCoachProfile = (data: { sports: string[]; department: string; genderCategory?: string }) =>
  apiRequest('/coach/profile', { method: 'PUT', body: JSON.stringify(data) }, true);

// Admin Coach Management
export const getCoaches = () => apiRequest('/admin/coaches', {}, true);
export const updateCoachDepartment = (id: string, data: { department: string | null }) =>
  apiRequest(`/admin/coaches/${id}`, { method: 'PUT', body: JSON.stringify(data) }, true);

// ─────────────────────────────────────────────────────────────────────
// User Management (admin only) — every account, all roles
// ─────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'coach' | 'athlete' | 'judge';

export interface UserListFilters {
  role?: UserRole;
  status?: 'active' | 'inactive';
  search?: string;
}

export const getUsers = (filters: UserListFilters = {}) => {
  const qs = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v != null && v !== '') as [string, string][],
  ).toString();
  return apiRequest(`/admin/users${qs ? `?${qs}` : ''}`, {}, true);
};

export const getUser = (id: string) => apiRequest(`/admin/users/${id}`, {}, true);

export const updateUser = (
  id: string,
  data: Partial<{ name: string; email: string; role: UserRole; department: string | null; sport: string | null; genderCategory: string | null }>,
) => apiRequest(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }, true);

export const setUserActive = (id: string, active: boolean) =>
  apiRequest(`/admin/users/${id}/active`, { method: 'POST', body: JSON.stringify({ active }) }, true);

export const resetUserPassword = (id: string, password?: string) =>
  apiRequest(`/admin/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify(password ? { password } : {}),
  }, true);

export const deleteUser = (id: string) =>
  apiRequest(`/admin/users/${id}`, { method: 'DELETE' }, true);

// ─────────────────────────────────────────────────────────────────────
// Enrollment (athlete)
// ─────────────────────────────────────────────────────────────────────

export const enrollWithCode = (enrollmentCode: string) =>
  apiRequest('/enroll', { method: 'POST', body: JSON.stringify({ enrollmentCode }) }, true);
export const unenrollFromCoach = () =>
  apiRequest('/unenroll', { method: 'DELETE' }, true);
export const getMyCoach = () => apiRequest('/my-coach', {}, true);

// ─────────────────────────────────────────────────────────────────────
// Announcements
// ─────────────────────────────────────────────────────────────────────

export const getAnnouncements = () => apiRequest('/announcements');
export const createAnnouncement = (data: any) =>
  apiRequest('/announcements', { method: 'POST', body: JSON.stringify(data) }, true);
export const updateAnnouncement = (id: string, data: any) =>
  apiRequest(`/announcements/${id}`, { method: 'PUT', body: JSON.stringify(data) }, true);
export const deleteAnnouncement = (id: string) =>
  apiRequest(`/announcements/${id}`, { method: 'DELETE' }, true);

// ─────────────────────────────────────────────────────────────────────
// Tryout Applications
// ─────────────────────────────────────────────────────────────────────

export const verifyTryoutEmail = (email: string) =>
  apiRequest('/tryouts/verify-email', { method: 'POST', body: JSON.stringify({ email }) });
export const applyForTryout = (data: any) =>
  apiRequest('/tryouts/apply', { method: 'POST', body: JSON.stringify(data) });
export const getTryoutApplications = () => apiRequest('/tryouts', {}, true);

// ─────────────────────────────────────────────────────────────────────
// Attendance (coach)
// ─────────────────────────────────────────────────────────────────────

export const markAttendance = (records: any[]) =>
  apiRequest('/attendance', { method: 'POST', body: JSON.stringify({ records }) }, true);
export const getAttendanceRecords = () => apiRequest('/attendance', {}, true);

// ─────────────────────────────────────────────────────────────────────
// Performance
// ─────────────────────────────────────────────────────────────────────

export const recordPerformance = (data: any) =>
  apiRequest('/performance', { method: 'POST', body: JSON.stringify(data) }, true);
export const getPerformanceRecords = () => apiRequest('/performance', {}, true);
export const getMyPerformance = () => apiRequest('/performance/my', {}, true);

// ─────────────────────────────────────────────────────────────────────
// Requirements
// ─────────────────────────────────────────────────────────────────────

export const submitRequirement = (data: any) => {
  const formData = new FormData();
  formData.append('type', data.type);
  formData.append('name', data.name);
  if (data.description) formData.append('description', data.description);
  if (data.file) formData.append('file', data.file);

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  const token = localStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(`${API_URL}/requirements`, {
    method: 'POST',
    headers,
    body: formData,
  }).then(async (response) => {
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorText;
      } catch (_) {}
      throw new Error(errorMessage || 'Failed to submit requirement');
    }
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    return keysToCamelCase(data);
  });
};
export const getRequirements = () => apiRequest('/requirements', {}, true);
export const getMyRequirements = () => apiRequest('/requirements/my', {}, true);
export const updateRequirementStatus = (id: string, data: any) =>
  apiRequest(`/requirements/${id}/status`, { method: 'PUT', body: JSON.stringify(data) }, true);

// ─────────────────────────────────────────────────────────────────────
// Judges
// ─────────────────────────────────────────────────────────────────────

export const getJudges = () => apiRequest('/judges', {}, true);

// ─────────────────────────────────────────────────────────────────────
// Site content — the admin-managed public photo slideshow + welcome popup
// ─────────────────────────────────────────────────────────────────────

/** POST multipart/form-data with the auth token, sharing apiRequest's error handling. */
async function authMultipart(endpoint: string, formData: FormData) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = localStorage.getItem('auth_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${endpoint}`, { method: 'POST', headers, body: formData });
  const text = await response.text();
  if (!response.ok) {
    let msg = text;
    try {
      const j = JSON.parse(text);
      msg = j.errors ? Object.values(j.errors).flat().join(', ') : j.error || j.message || text;
    } catch (_) {}
    throw new Error(msg || 'Upload failed');
  }
  return keysToCamelCase(text ? JSON.parse(text) : {});
}

interface SiteSlideInput {
  type?: 'carousel' | 'popup';
  title?: string;
  caption?: string;
  linkUrl?: string;
  active?: boolean;
  sortOrder?: number;
  image?: File | null;
}

function siteSlideFormData(data: SiteSlideInput, method?: 'PUT'): FormData {
  const fd = new FormData();
  if (method) fd.append('_method', method);
  if (data.type) fd.append('type', data.type);
  if (data.title !== undefined) fd.append('title', data.title ?? '');
  if (data.caption !== undefined) fd.append('caption', data.caption ?? '');
  if (data.linkUrl !== undefined) fd.append('linkUrl', data.linkUrl ?? '');
  if (data.active !== undefined) fd.append('active', data.active ? '1' : '0');
  if (data.sortOrder !== undefined) fd.append('sortOrder', String(data.sortOrder));
  if (data.image) fd.append('image', data.image);
  return fd;
}

/** Public: active slides for the slideshow ('carousel') or the welcome popup ('popup'). */
export const getSiteSlides = (type: 'carousel' | 'popup') =>
  apiRequest(`/site-slides?type=${type}`);

/** Admin: every slide, including hidden ones. */
export const getAdminSiteSlides = (type?: 'carousel' | 'popup') =>
  apiRequest(`/admin/site-slides${type ? `?type=${type}` : ''}`, {}, true);

export const createSiteSlide = (data: SiteSlideInput) =>
  authMultipart('/admin/site-slides', siteSlideFormData(data));

export const updateSiteSlide = (id: string, data: SiteSlideInput) =>
  authMultipart(`/admin/site-slides/${id}`, siteSlideFormData(data, 'PUT'));

export const deleteSiteSlide = (id: string) =>
  apiRequest(`/admin/site-slides/${id}`, { method: 'DELETE' }, true);

export const reorderSiteSlides = (type: 'carousel' | 'popup', order: string[]) =>
  apiRequest('/admin/site-slides/reorder', { method: 'POST', body: JSON.stringify({ type, order }) }, true);

// ─────────────────────────────────────────────────────────────────────
// Legacy no-op warmup (kept for compatibility)
// ─────────────────────────────────────────────────────────────────────

export const warmupServer = async (): Promise<boolean> => true;
export const startWarmup = (): Promise<boolean> => Promise.resolve(true);
export const exportReport = (eventId: string, format: 'pdf' | 'csv') =>
  apiRequest(`/reports/${eventId}/export?format=${format}`, {}, true);
