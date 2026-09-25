import { Icon } from '../ui/Icon';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { COLORS, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../../../constants/theme';
import { ocrService } from '../../services/ocr.service';
import type { OcrResult } from '../../types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

// ─────────────────────────────────────────────────────────────────────────────
// OCRScoreMapper — Capture image → Extract every competing college's score →
// Edit → Confirm
// ─────────────────────────────────────────────────────────────────────────────

interface OCRScoreMapperProps {
  // The exact competing-college name strings for this event. Drives both the
  // request to the backend and the per-department rows in the review step.
  departments: string[];
  onConfirm: (scores: Record<string, number>, imageUri: string) => void;
  // A photo may already be captured and stored server-side even when the
  // judge backs out to manual entry (OCR misread it, or they just prefer to
  // type it themselves) — pass it along so that evidence isn't discarded.
  onCancel:  (imageUri?: string | null) => void;
  /**
   * Highest valid score. Judged events are marked out of 100; a head-to-head
   * game's sheet carries its real points (a basketball final can be 114), so
   * it passes null for no ceiling.
   */
  maxScore?: number | null;
}

type OcrStep = 'capture' | 'processing' | 'review' | 'error';

// A modern phone camera easily captures 12MP+ (4000x3000) photos — base64
// that and it can exceed PHP's default post_max_size (commonly 8MB), which
// makes the dev server drop the request with no response at all (surfaces
// as a plain "can't reach the server" network error, not a real API error).
// PaddleOCR doesn't need more than this to read printed/handwritten text, so
// downscale before sending regardless of what the server happens to allow.
const OCR_MAX_DIMENSION = 1600;

const confidenceColor = (confidence: number | undefined) => {
  if (confidence === undefined) return COLORS.textMuted;
  if (confidence >= 0.8) return COLORS.success;
  if (confidence >= 0.5) return COLORS.primaryLighter;
  return COLORS.error;
};

export function OCRScoreMapper({ departments, onConfirm, onCancel, maxScore = 100 }: OCRScoreMapperProps) {
  const isRowValid = (raw: string | undefined) => {
    if (raw === undefined || raw.trim() === '') return false;
    const value = Number(raw);
    return !Number.isNaN(value) && value >= 0 && (maxScore === null || value <= maxScore);
  };
  const rangeText = maxScore === null ? 'a score of 0 or more' : `a number from 0 to ${maxScore}`;

  const [step,           setStep]           = useState<OcrStep>('capture');
  const [imageUri,       setImageUri]       = useState<string | null>(null);
  const [serverImageUrl, setServerImageUrl] = useState<string | null>(null);
  const [ocrResult,      setOcrResult]      = useState<OcrResult | null>(null);
  const [editedScores,   setEditedScores]   = useState<Record<string, string>>({});
  const [errorMessage,   setErrorMessage]   = useState<string | null>(null);

  const processImage = async (asset: ImagePicker.ImagePickerAsset) => {
    setImageUri(asset.uri);
    setStep('processing');

    try {
      const longEdge = Math.max(asset.width, asset.height);
      const resized = await ImageManipulator.manipulateAsync(
        asset.uri,
        longEdge > OCR_MAX_DIMENSION
          ? [{
              resize: asset.width >= asset.height
                ? { width: OCR_MAX_DIMENSION }
                : { height: OCR_MAX_DIMENSION },
            }]
          : [],
        { base64: true, compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );

      const imagePayload = resized.base64
        ? `data:image/jpeg;base64,${resized.base64}`
        : resized.uri;

      const ocrData = await ocrService.extractScore(imagePayload, departments);
      setOcrResult(ocrData);
      setServerImageUrl(ocrData.image_url ?? null);

      // Build the initial editable state from the event's departments, not
      // from whatever the model returned. Any department the model couldn't
      // read is left blank rather than defaulted to 0 — the judge must type
      // it in themselves.
      const initialScores: Record<string, string> = {};
      for (const dept of departments) {
        const match = ocrData.scores.find((s) => s.department === dept);
        initialScores[dept] = match ? String(Math.max(0, maxScore === null ? match.score : Math.min(maxScore, match.score))) : '';
      }
      setEditedScores(initialScores);
      setStep('review');
    } catch (error: any) {
      console.error('OCR extraction error:', error);
      // The photo is still stored server-side even when OCR can't read a
      // score from it (see OcrController) — keep that reference so it isn't
      // orphaned if the judge falls back to entering the score manually.
      setServerImageUrl(error.response?.data?.image_url ?? null);
      setErrorMessage(error.response?.data?.error ?? error.message ?? 'OCR extraction failed. Please try again.');
      setStep('error');
    }
  };

  // ── Capture via camera ──────────────────────────────────────────────────
  const handleCapture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera Permission', 'Camera access is required for OCR scoring.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality:    0.9,
      base64:     true,
    });

    if (result.canceled || !result.assets?.[0]) return;
    await processImage(result.assets[0]);
  };

  // ── Pick from gallery ───────────────────────────────────────────────────
  const handlePickGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Gallery Permission', 'Gallery access is required to select a score sheet image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality:    0.9,
      base64:     true,
    });

    if (result.canceled || !result.assets?.[0]) return;
    await processImage(result.assets[0]);
  };

  // ── Confirm and pass every department's score to the parent ────────────
  const handleConfirm = () => {
    if (!imageUri) return;

    const scores: Record<string, number> = {};
    for (const dept of departments) {
      const raw = editedScores[dept];
      if (!isRowValid(raw)) {
        Alert.alert('Invalid Score', `Enter ${rangeText} for ${dept}.`);
        return;
      }
      scores[dept] = Number(raw);
    }
    onConfirm(scores, serverImageUrl ?? imageUri);
  };

  const allRowsValid = departments.length > 0 && departments.every((d) => isRowValid(editedScores[d]));

  // ── Render ───────────────────────────────────────────────────────────────
  if (step === 'capture') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Icon name="camera" size={22} color={COLORS.ocr} />
            <Text style={styles.title}>OCR Score Capture</Text>
          </View>
          <Text style={styles.subtitle}>
            Photograph or upload the physical score sheet. Every competing college&apos;s score will be read automatically.
          </Text>
        </View>

        <View style={styles.cameraPlaceholder}>
          <Icon name="camera" size={56} color={COLORS.ocr} strokeWidth={1.6} />
          <Text style={styles.cameraHint}>Position score sheet in frame</Text>
        </View>

        <View style={styles.actions}>
          <Button label="Capture with Camera" onPress={handleCapture} variant="ocr" size="lg" fullWidth />
          <Button label="Choose from Gallery" onPress={handlePickGallery} variant="secondary" size="md" fullWidth />
          <Button label="Cancel" onPress={() => onCancel()} variant="ghost" size="md" fullWidth />
        </View>
      </View>
    );
  }

  if (step === 'processing') {
    return (
      <View style={styles.processingContainer}>
        <Icon name="search" size={56} color={COLORS.ocr} strokeWidth={1.6} />
        <Text style={styles.processingTitle}>Extracting Scores...</Text>
        <Text style={styles.processingSubtitle}>This can take up to a minute — please don't close the app.</Text>
        {imageUri && (
          <Image source={{ uri: imageUri }} style={styles.previewImage} contentFit="cover" />
        )}
      </View>
    );
  }

  if (step === 'error') {
    return (
      <View style={styles.container}>
        <View style={styles.errorBox}>
          <Icon name="alert-circle" size={36} color={COLORS.error} strokeWidth={2} />
          <Text style={styles.errorTitle}>OCR Failed</Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
        </View>
        <View style={styles.actions}>
          <Button label="Try Again" onPress={() => setStep('capture')} variant="primary" size="lg" fullWidth />
          <Button label="Enter Manually" onPress={() => onCancel(serverImageUrl)} variant="ghost" size="md" fullWidth />
        </View>
      </View>
    );
  }

  // review step
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.reviewContent}>
      <View style={styles.reviewHeader}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Review Extracted Scores</Text>
          {ocrResult?.is_mock && <Badge label="MOCK OCR" variant="warning" />}
        </View>
        {!!ocrResult?.notes && (
          <Text style={styles.notesText}>{ocrResult.notes}</Text>
        )}
      </View>

      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.reviewImage} contentFit="cover" />
      )}

      <View style={styles.editHint}>
        <Icon name="pencil" size={13} color={COLORS.ocr} />
        <Text style={styles.editHintText}>Tap a score box to adjust the extracted value</Text>
      </View>

      {departments.map((dept) => {
        const match = ocrResult?.scores.find((s) => s.department === dept);
        const notRead = !match;
        return (
          <View key={dept} style={styles.scoreRow}>
            <View style={styles.scoreRowHeader}>
              <Text style={styles.scoreRowLabel} numberOfLines={2}>{dept}</Text>
              {notRead ? (
                <Text style={styles.notReadLabel}>Not read — enter manually</Text>
              ) : (
                <Text style={[styles.confidenceValue, { color: confidenceColor(match.confidence) }]}>
                  {Math.round(match.confidence * 100)}% confidence
                </Text>
              )}
            </View>
            <View style={styles.scoreInputRow}>
              <TextInput
                style={[styles.scoreInput, notRead && styles.scoreInputEmpty]}
                value={editedScores[dept] ?? ''}
                onChangeText={(value) => setEditedScores((prev) => ({ ...prev, [dept]: value }))}
                keyboardType="numeric"
                placeholder={notRead ? 'Enter score' : '0'}
                placeholderTextColor={COLORS.textMuted}
              />
              {maxScore !== null && <Text style={styles.maxLabel}>/ {maxScore}</Text>}
            </View>
          </View>
        );
      })}

      <View style={styles.actions}>
        <Button
          label="Confirm & Use These Scores"
          onPress={handleConfirm}
          variant="primary"
          size="lg"
          fullWidth
          disabled={!allRowsValid}
        />
        <Button label="Recapture Image" onPress={() => setStep('capture')} variant="secondary" size="md" fullWidth />
        <Button label="Enter Manually Instead" onPress={() => onCancel(serverImageUrl)} variant="ghost" size="md" fullWidth />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  reviewContent: {
    padding: SPACING.md,
    gap:     SPACING.md,
  },
  header: {
    padding: SPACING.lg,
    gap:     SPACING.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.sm,
  },
  title: {
    fontSize:   FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color:      COLORS.textPrimary,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color:    COLORS.textSecondary,
  },
  cameraPlaceholder: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    margin:         SPACING.lg,
    borderRadius:   RADIUS.xl,
    borderWidth:    2,
    borderColor:    COLORS.ocr,
    borderStyle:    'dashed',
    minHeight:      200,
    gap:            SPACING.sm,
  },
  cameraHint: {
    fontSize: FONT_SIZE.md,
    color:    COLORS.textSecondary,
  },
  processingContainer: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        SPACING.xl,
    gap:            SPACING.md,
    backgroundColor: COLORS.background,
  },
  processingTitle: {
    fontSize:   FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color:      COLORS.textPrimary,
  },
  processingSubtitle: {
    fontSize: FONT_SIZE.md,
    color:    COLORS.textSecondary,
  },
  previewImage: {
    width:        200,
    height:       150,
    borderRadius: RADIUS.md,
    marginTop:    SPACING.md,
    opacity:      0.6,
  },
  errorBox: {
    margin:         SPACING.lg,
    padding:        SPACING.lg,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius:   RADIUS.lg,
    borderWidth:    1,
    borderColor:    COLORS.error,
    alignItems:     'center',
    gap:            SPACING.sm,
  },
  errorTitle: {
    fontSize:   FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color:      COLORS.error,
  },
  errorMessage: {
    fontSize:  FONT_SIZE.md,
    color:     COLORS.textSecondary,
    textAlign: 'center',
  },
  reviewHeader: {
    gap: SPACING.sm,
  },
  notesText: {
    fontSize:  FONT_SIZE.sm,
    color:     COLORS.textSecondary,
    fontStyle: 'italic',
  },
  reviewImage: {
    width:        '100%',
    height:       160,
    borderRadius: RADIUS.md,
  },
  editHint: {
    flexDirection: 'row',
    alignItems:    'center',
    justifyContent: 'center',
    gap:            SPACING.xs,
  },
  editHintText: {
    fontSize: FONT_SIZE.sm,
    color:    COLORS.ocr,
    fontWeight: FONT_WEIGHT.medium,
  },
  scoreRow: {
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     COLORS.ocr,
    padding:         SPACING.sm,
    gap:             SPACING.xs,
  },
  scoreRowHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            SPACING.sm,
  },
  scoreRowLabel: {
    flex:       1,
    fontSize:   FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color:      COLORS.textPrimary,
  },
  notReadLabel: {
    fontSize:   FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color:      COLORS.error,
  },
  confidenceValue: {
    fontSize:   FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
  },
  scoreInputRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.sm,
  },
  scoreInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.ocr,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    textAlign: 'center',
    backgroundColor: COLORS.surface,
  },
  scoreInputEmpty: {
    borderColor: COLORS.error,
    borderStyle: 'dashed',
  },
  maxLabel: {
    fontSize: FONT_SIZE.sm,
    color:    COLORS.textMuted,
  },
  actions: {
    padding: SPACING.md,
    gap:     SPACING.sm,
  },
});
