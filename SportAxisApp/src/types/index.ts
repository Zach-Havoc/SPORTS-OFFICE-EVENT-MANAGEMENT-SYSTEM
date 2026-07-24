// ─────────────────────────────────────────────────────────────────────────────
// SportAxisApp — Shared TypeScript Types
// ─────────────────────────────────────────────────────────────────────────────

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'coach' | 'athlete' | 'judge';
}

export interface AuthState {
  user: User | null;
  token: string | null;
}

// ── Event & Criteria ─────────────────────────────────────────────────────────

/**
 * Matches the shape returned by GET /api/events and GET /api/events/{id}
 * (the EventController::toApiFormat() method).
 */
export interface EventSummary {
  id: string;
  name: string;
  category: string;
  schedule: string;
  startTime: string;
  endTime: string;
  venueId: string | null;
  venueName: string | null;
  departments: string[];
  judges: string[];
  criteria: Array<{ id: string; name: string; max_score: number; weight?: number | null }>;
  status: 'upcoming' | 'ongoing' | 'completed';
  qrToken: string;
  createdAt: string;
}

export interface Criterion {
  criteria_id: string;
  name: string;
  max_score: number;
  weight?: number | null;
}

export interface EventSession {
  id: string;
  name: string;
  category: string;
  schedule: string;
  startTime: string;
  endTime: string;
  venueName: string | null;
  departments: string[];
  judges: string[];
  status: 'upcoming' | 'ongoing' | 'completed';
  qrToken: string;
}

export interface EventSessionResponse {
  event: EventSession;
  criteria: Criterion[];
}

// ── Scores ───────────────────────────────────────────────────────────────────

export interface ScoreEntry {
  criteria_id: string;
  value: number;
}

export type ScoringMethod = 'manual' | 'ocr';

export interface ScorePayload {
  eventId: string;
  department: string;
  judgeId: string;
  judgeName: string;
  scores: ScoreEntry[];
  totalScore: number;
  method: ScoringMethod;
  image_url?: string | null;
  submittedViaQr: boolean;
}

export interface ScoreSubmissionResponse {
  score: {
    id: string;
    event_id: string;
    department: string;
    judge_id: string;
    total_score: number;
    method: ScoringMethod;
  };
  message: string;
}

// ── OCR ──────────────────────────────────────────────────────────────────────

export interface OcrExtractedScore {
  label: string;
  criteria_id?: string | null;
  value: number;
}

export interface OcrResult {
  extracted_scores: OcrExtractedScore[];
  confidence: number;
  raw_text?: string;
  is_mock?: boolean;
}

// ── Offline Queue ─────────────────────────────────────────────────────────────

export type OfflineQueueStatus = 'pending' | 'syncing' | 'failed';

export interface OfflineQueueItem {
  id: string;               // local UUID
  payload: ScorePayload;
  status: OfflineQueueStatus;
  created_at: string;       // ISO timestamp
  retry_count: number;
  error?: string | null;
}

// ── QR Payload ────────────────────────────────────────────────────────────────

export interface QrPayload {
  eventId?: string;
  token?: string;
  // Support both formats: raw token string or structured object
  qr_token?: string;
}

// ── API Error ─────────────────────────────────────────────────────────────────

export interface ApiError {
  code?: string;
  error?: string;
  message?: string;
  errors?: Record<string, string[]>;
}
