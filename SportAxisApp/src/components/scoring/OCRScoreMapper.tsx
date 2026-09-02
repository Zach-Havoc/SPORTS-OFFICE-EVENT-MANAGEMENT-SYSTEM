import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
    Alert,
    Image,
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
// OCRScoreMapper — Capture image → Extract overall score → Edit → Confirm
// ─────────────────────────────────────────────────────────────────────────────

interface OCRScoreMapperProps {
  onConfirm: (totalScore: number, imageUri: string) => void;
  onCancel:  () => void;
}

type OcrStep = 'capture' | 'processing' | 'review' | 'error';

export function OCRScoreMapper({ onConfirm, onCancel }: OCRScoreMapperProps) {
  const [step,         setStep]         = useState<OcrStep>('capture');
  const [imageUri,     setImageUri]     = useState<string | null>(null);
  const [ocrResult,    setOcrResult]    = useState<OcrResult | null>(null);
  const [editedScore,  setEditedScore]  = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const processImage = async (asset: ImagePicker.ImagePickerAsset) => {
    setImageUri(asset.uri);
    setStep('processing');

    try {
      const imagePayload = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;

      const ocrData = await ocrService.extractScore(imagePayload);
      setOcrResult(ocrData);

      const clamped = Math.max(0, Math.min(100, ocrData.total_score));
      setEditedScore(String(clamped));
      setStep('review');
    } catch (error: any) {
      console.error('OCR extraction error:', error);
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

  // ── Confirm and pass the score to the parent ────────────────────────────
  const handleConfirm = () => {
    if (!imageUri) return;
    const value = Number(editedScore);
    if (Number.isNaN(value) || value < 0 || value > 100) {
      Alert.alert('Invalid Score', 'Enter a number from 0 to 100.');
      return;
    }
    onConfirm(value, imageUri);
  };

  const confidenceColor =
    (ocrResult?.confidence ?? 0) >= 0.8
      ? COLORS.success
      : (ocrResult?.confidence ?? 0) >= 0.5
        ? COLORS.primaryLighter
        : COLORS.error;

  // ── Render ───────────────────────────────────────────────────────────────
  if (step === 'capture') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Ionicons name="camera" size={24} color={COLORS.ocr} style={{ marginRight: 8 }} />
            <Text style={styles.title}>OCR Score Capture</Text>
          </View>
          <Text style={styles.subtitle}>
            Photograph or upload the physical score sheet. The overall score will be read automatically.
          </Text>
        </View>

        <View style={styles.cameraPlaceholder}>
          <Ionicons name="aperture" size={64} color={COLORS.ocr} />
          <Text style={styles.cameraHint}>Position score sheet in frame</Text>
        </View>

        <View style={styles.actions}>
          <Button label="Capture with Camera" onPress={handleCapture} variant="ocr" size="lg" fullWidth />
          <Button label="Choose from Gallery" onPress={handlePickGallery} variant="secondary" size="md" fullWidth />
          <Button label="Cancel" onPress={onCancel} variant="ghost" size="md" fullWidth />
        </View>
      </View>
    );
  }

  if (step === 'processing') {
    return (
      <View style={styles.processingContainer}>
        <Ionicons name="search" size={64} color={COLORS.ocr} />
        <Text style={styles.processingTitle}>Extracting Score...</Text>
        <Text style={styles.processingSubtitle}>Analysing image with OCR</Text>
        {imageUri && (
          <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
        )}
      </View>
    );
  }

  if (step === 'error') {
    return (
      <View style={styles.container}>
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={40} color={COLORS.error} />
          <Text style={styles.errorTitle}>OCR Failed</Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
        </View>
        <View style={styles.actions}>
          <Button label="Try Again" onPress={() => setStep('capture')} variant="primary" size="lg" fullWidth />
          <Button label="Enter Manually" onPress={onCancel} variant="ghost" size="md" fullWidth />
        </View>
      </View>
    );
  }

  // review step
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.reviewContent}>
      <View style={styles.reviewHeader}>
        <Text style={styles.title}>Review Extracted Score</Text>
        <View style={styles.confidenceRow}>
          <Text style={styles.confidenceLabel}>Confidence:</Text>
          <Text style={[styles.confidenceValue, { color: confidenceColor }]}>
            {Math.round((ocrResult?.confidence ?? 0) * 100)}%
          </Text>
          {ocrResult?.is_mock && (
            <Badge label="MOCK OCR" variant="warning" />
          )}
        </View>
      </View>

      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.reviewImage} resizeMode="cover" />
      )}

      <View style={styles.editHint}>
        <Ionicons name="pencil" size={14} color={COLORS.ocr} style={{ marginRight: 4 }} />
        <Text style={styles.editHintText}>Tap the score box to adjust the extracted value</Text>
      </View>

      <View style={styles.scoreRow}>
        <Text style={styles.scoreRowLabel}>Overall Score</Text>
        <TextInput
          style={styles.scoreInput}
          value={editedScore}
          onChangeText={setEditedScore}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={COLORS.textMuted}
        />
        <Text style={styles.maxLabel}>/ 100</Text>
      </View>

      <View style={styles.actions}>
        <Button label="Confirm & Use This Score" onPress={handleConfirm} variant="primary" size="lg" fullWidth />
        <Button label="Recapture Image" onPress={() => setStep('capture')} variant="secondary" size="md" fullWidth />
        <Button label="Enter Manually Instead" onPress={onCancel} variant="ghost" size="md" fullWidth />
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
  confidenceRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.sm,
  },
  confidenceLabel: {
    fontSize: FONT_SIZE.sm,
    color:    COLORS.textSecondary,
  },
  confidenceValue: {
    fontSize:   FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
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
  },
  editHintText: {
    fontSize: FONT_SIZE.sm,
    color:    COLORS.ocr,
    fontWeight: FONT_WEIGHT.medium,
  },
  scoreRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            SPACING.sm,
  },
  scoreRowLabel: {
    fontSize:   FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color:      COLORS.textPrimary,
  },
  scoreInput: {
    borderWidth: 1,
    borderColor: COLORS.ocr,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    minWidth: 90,
    textAlign: 'center',
    backgroundColor: COLORS.surface,
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
