import api from './api';
import type { OcrResult, Criterion } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// OCR Service — Extract scores from captured images
// ─────────────────────────────────────────────────────────────────────────────

export const ocrService = {
  /**
   * POST /api/ocr/extract
   *
   * Send a base64-encoded image to the backend for OCR processing.
   * The backend returns extracted score labels and values.
   *
   * @param imageBase64 - Base64-encoded JPEG/PNG image
   * @param criteria    - Criteria array to help backend match labels
   */
  async extractScores(
    imageBase64: string,
    criteria: Criterion[] = [],
  ): Promise<OcrResult> {
    // Strip data URI prefix if present (e.g., "data:image/jpeg;base64,...")
    const base64Data = imageBase64.startsWith('data:')
      ? imageBase64.split(',')[1]
      : imageBase64;

    const response = await api.post<OcrResult>('/ocr/extract', {
      image:    base64Data,
      criteria: criteria.map((c) => ({
        criteria_id: c.criteria_id,
        name:        c.name,
        max_score:   c.max_score,
      })),
    });

    return response.data;
  },
};
