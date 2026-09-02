import api from './api';
import type { OcrResult } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// OCR Service — Extract the overall score from a captured score-sheet image
// ─────────────────────────────────────────────────────────────────────────────

export const ocrService = {
  /**
   * POST /api/ocr/extract
   *
   * Send a base64-encoded image to the backend for OCR processing.
   * The backend returns the single overall score read from the sheet.
   *
   * @param imageBase64 - Base64-encoded JPEG/PNG image
   */
  async extractScore(imageBase64: string): Promise<OcrResult> {
    // Strip data URI prefix if present (e.g., "data:image/jpeg;base64,...")
    const base64Data = imageBase64.startsWith('data:')
      ? imageBase64.split(',')[1]
      : imageBase64;

    const response = await api.post<OcrResult>('/ocr/extract', {
      image: base64Data,
    });

    return response.data;
  },
};
