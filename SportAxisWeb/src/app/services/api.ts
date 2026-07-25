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
export const getEvent = (id: string) => apiRequest(`/events/${id}`);
export const createEvent = (data: any) =>
  apiRequest('/events', { method: 'POST', body: JSON.stringify(data) }, true);
export const updateEvent = (id: string, data: any) =>
  apiRequest(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }, true);
export const deleteEvent = (id: string) =>
  apiRequest(`/events/${id}`, { method: 'DELETE' }, true);

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
export const updateCoachProfile = (data: { sport: string }) =>
  apiRequest('/coach/profile', { method: 'PUT', body: JSON.stringify(data) }, true);

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

export const submitRequirement = (data: any) =>
  apiRequest('/requirements', { method: 'POST', body: JSON.stringify(data) }, true);
export const getRequirements = () => apiRequest('/requirements', {}, true);
export const getMyRequirements = () => apiRequest('/requirements/my', {}, true);
export const updateRequirementStatus = (id: string, data: any) =>
  apiRequest(`/requirements/${id}/status`, { method: 'PUT', body: JSON.stringify(data) }, true);

// ─────────────────────────────────────────────────────────────────────
// Judges
// ─────────────────────────────────────────────────────────────────────

export const getJudges = () => apiRequest('/judges', {}, true);

// ─────────────────────────────────────────────────────────────────────
// Legacy no-op warmup (kept for compatibility)
// ─────────────────────────────────────────────────────────────────────

export const warmupServer = async (): Promise<boolean> => true;
export const startWarmup = (): Promise<boolean> => Promise.resolve(true);
export const exportReport = (eventId: string, format: 'pdf' | 'csv') =>
  apiRequest(`/reports/${eventId}/export?format=${format}`, {}, true);
