import type { QrPayload } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// QR Payload Parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a raw QR code string into a structured QrPayload.
 *
 * The QR code can be in any of these formats:
 *
 *   1. Web QR URL (from SportAxisWeb admin panel):
 *      https://sportaxis.example.com/judge-qr/{eventId}/{qrToken}
 *
 *   2. JSON object:
 *      {"eventId":"123","token":"abc..."} or {"qr_token":"abc..."}
 *
 *   3. Raw token string:
 *      Just the 32-character qr_token value (alphanumeric)
 *
 *   4. Query string URL:
 *      https://example.com/event?token=abc&eventId=123
 *
 * After parsing, use extractToken() to get the QR token for API lookups.
 */
export function parseQrCode(raw: string): QrPayload {
  if (!raw || typeof raw !== 'string') {
    throw new Error('QR code is empty or invalid.');
  }

  const trimmed = raw.trim();

  // ── Try JSON ──────────────────────────────────────────────────────────────
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, string>;
      const token =
        parsed.token ?? parsed.qr_token ?? parsed.qrToken ?? null;
      const eventId = parsed.eventId ?? parsed.event_id ?? null;

      if (!token && !eventId) {
        throw new Error('QR code JSON does not contain a valid token or event ID.');
      }

      return { token: token ?? undefined, eventId: eventId ?? undefined };
    } catch (e: any) {
      if (e.message.includes('QR code JSON')) throw e;
      throw new Error('QR code contains malformed JSON.');
    }
  }

  // ── Try URL ───────────────────────────────────────────────────────────────
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url    = new URL(trimmed);
      let token  = url.searchParams.get('token') ?? url.searchParams.get('qr_token');
      let eventId = url.searchParams.get('eventId') ?? url.searchParams.get('event_id');

      // Support path segments: /judge-qr/:eventId/:token (from web admin panel)
      if (!token && !eventId) {
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length >= 3 && parts[0] === 'judge-qr') {
          eventId = parts[1];
          token = parts[2];
        }
      }

      if (!token && !eventId) {
        throw new Error('QR code URL does not contain a token or event ID parameter.');
      }

      return { token: token ?? undefined, eventId: eventId ?? undefined };
    } catch (e: any) {
      if (e.message.includes('QR code URL')) throw e;
      throw new Error('Invalid QR code URL format.');
    }
  }

  // ── Treat as raw token string (32 alphanumeric chars) ────────────────────
  if (/^[a-zA-Z0-9]{10,64}$/.test(trimmed)) {
    return { token: trimmed };
  }

  throw new Error(
    'Unrecognised QR code format. Please use a valid SportAxis event QR code.',
  );
}

/**
 * Extract the QR token from a parsed payload.
 * Prefers the explicit "token" field; falls back to "qr_token".
 */
export function extractToken(payload: QrPayload): string {
  const token = payload.token ?? payload.qr_token;
  if (!token) {
    throw new Error('No QR token found in payload.');
  }
  return token;
}
