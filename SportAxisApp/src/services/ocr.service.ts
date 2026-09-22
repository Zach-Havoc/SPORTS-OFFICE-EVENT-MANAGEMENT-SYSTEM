import api from './api';
import type { OcrResult } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// OCR Service — Extract the overall score from a captured score-sheet image
// ─────────────────────────────────────────────────────────────────────────────

export const ocrService = {
  /**
   * POST /api/ocr/extract
   *
   * Send a base64-encoded image to the backend for OCR processing, along
   * with the list of colleges competing in this event. The backend returns
   * a score for every department it could actually read off the sheet — it
   * will NOT guess a score for one it couldn't find, so the returned list
   * may be shorter than `departments`.
   *
   * @param imageBase64 - Base64-encoded JPEG/PNG image
   * @param departments - Exact competing-college name strings for this event
   */
  async extractScore(imageBase64: string, departments: string[]): Promise<OcrResult> {
    // Strip data URI prefix if present (e.g., "data:image/jpeg;base64,...")
    const base64Data = imageBase64.startsWith('data:')
      ? imageBase64.split(',')[1]
      : imageBase64;

    // PaddleOCR runs on CPU with no hardware acceleration — a single real
    // score-sheet photo has measured well over 60s to process. The shared
    // client's default timeout (15s, see api.config.ts) is tuned for normal
    // JSON requests and would abort this one long before the model finishes,
    // which surfaces to the user as a misleading "can't reach the server"
    // instead of what's actually happening (still working, just slow).
    const response = await api.post<OcrResult>(
      '/ocr/extract',
      { image: base64Data, departments },
      { timeout: 120000 },
    );

    return response.data;
  },
};
