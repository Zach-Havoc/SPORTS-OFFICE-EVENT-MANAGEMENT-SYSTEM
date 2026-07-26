import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React from 'react';
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { COLORS, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../../../constants/theme';
import type { Criterion, Event } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface PrintableScoreSheetViewProps {
  event: Event;
  criteria: Criterion[];
  onClose?: () => void;
}

export function PrintableScoreSheetView({ event, criteria, onClose }: PrintableScoreSheetViewProps) {
  const generateHtmlContent = () => {
    const formattedDate = event.schedule
      ? new Date(event.schedule).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'N/A';

    const criteriaRows = criteria
      .map(
        (c, idx) =>
          `<div style="border: 1px solid #d1d5db; padding: 6px; border-radius: 4px; background: #f9fafb;">
            <strong>${idx + 1}. ${c.name}</strong><br/>
            <span style="font-size: 11px; color: #4b5563;">Weight: ${c.weight}% | Max Score: ${c.max_score}</span>
          </div>`,
      )
      .join('');

    const deptHeaderCols = criteria
      .map(
        (c, idx) =>
          `<th style="border: 1px solid #1f2937; padding: 6px; text-align: center;">C${idx + 1}: ${c.name}<br/><span style="font-size:10px; font-weight:normal;">(Max ${c.max_score})</span></th>`,
      )
      .join('');

    const deptBodyRows = (event.departments || [])
      .map(
        (dept, dIdx) =>
          `<tr style="background: ${dIdx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
            <td style="border: 1px solid #1f2937; padding: 8px; font-weight: bold; text-align: center;">${dIdx + 1}</td>
            <td style="border: 1px solid #1f2937; padding: 8px; font-weight: bold;">${dept}</td>
            ${criteria
              .map(
                () =>
                  `<td style="border: 1px solid #1f2937; padding: 8px; text-align: center;">
                    <div style="width: 70px; height: 35px; border: 2px dashed #9ca3af; margin: 0 auto; border-radius: 4px; background: #fff;"></div>
                  </td>`,
              )
              .join('')}
            <td style="border: 1px solid #1f2937; padding: 8px; text-align: center;">
              <div style="width: 70px; height: 35px; border: 2px solid #4b5563; margin: 0 auto; border-radius: 4px; background: #f3f4f6;"></div>
            </td>
          </tr>`,
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #111827; }
            .header { text-align: center; border-bottom: 3px solid #b91c1c; padding-bottom: 12px; margin-bottom: 16px; }
            .header h1 { color: #991b1b; font-size: 20px; text-transform: uppercase; margin: 0; }
            .header p { color: #374151; font-size: 12px; margin: 4px 0 0 0; text-transform: uppercase; font-weight: bold; }
            .badge { display: inline-block; padding: 4px 10px; background: #fee2e2; color: #991b1b; font-weight: bold; font-size: 10px; border-radius: 4px; margin-top: 8px; text-transform: uppercase; border: 1px solid #fca5a5; }
            .meta-grid { display: flex; justify-content: space-between; background: #f9fafb; padding: 12px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 12px; margin-bottom: 16px; }
            .criteria-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 12px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
            th { background: #991b1b; color: #ffffff; }
            .instructions { background: #fffbeb; border: 1px solid #fef3c7; padding: 10px; border-radius: 6px; font-size: 11px; color: #92400e; margin-bottom: 20px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 30px; border-top: 2px solid #e5e7eb; padding-top: 16px; font-size: 11px; }
            .sig-box { width: 45%; }
            .line { border-bottom: 1px solid #000; margin-top: 30px; margin-bottom: 4px; width: 80%; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>BatStateU ARASOF Sports Office</h1>
            <p>SportAxis Event Management — Official Physical Scoring Sheet</p>
            <div class="badge">OCR Formatted Score Sheet</div>
          </div>

          <div class="meta-grid">
            <div>
              <p><strong>Event:</strong> ${event.name}</p>
              <p><strong>Category:</strong> ${event.category}</p>
              <p><strong>Venue:</strong> ${event.venueName || 'Sports Complex'}</p>
            </div>
            <div>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Time:</strong> ${event.startTime || '09:00'} - ${event.endTime || '12:00'}</p>
              <p><strong>Event ID:</strong> ${event.id}</p>
            </div>
          </div>

          <h3 style="color:#991b1b; margin-bottom:8px; font-size:14px;">Judging Criteria & Max Points</h3>
          <div class="criteria-grid">
            ${criteriaRows}
          </div>

          <h3 style="color:#991b1b; margin-bottom:8px; font-size:14px;">Scores Entry Grid (Write scores inside boxes)</h3>
          <table>
            <thead>
              <tr>
                <th style="border: 1px solid #1f2937; padding: 6px; width: 30px;">#</th>
                <th style="border: 1px solid #1f2937; padding: 6px; text-align: left;">Participating Department</th>
                ${deptHeaderCols}
                <th style="border: 1px solid #1f2937; padding: 6px; width: 80px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${deptBodyRows}
            </tbody>
          </table>

          <div class="instructions">
            <strong>📋 Instructions:</strong><br/>
            1. Write scores legibly inside each dashed box.<br/>
            2. When finished, scan this form using the <strong>OCR Score Capture</strong> in the SportsAxis app to automatically import the written scores.
          </div>

          <div class="signatures">
            <div class="sig-box">
              <p>Judge Name & Signature:</p>
              <div class="line"></div>
              <p><strong>Official Judge</strong></p>
            </div>
            <div class="sig-box">
              <p>Chief Scorer Verification:</p>
              <div class="line"></div>
              <p><strong>Sports Office Chief Facilitator</strong></p>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const handlePrint = async () => {
    try {
      const html = generateHtmlContent();
      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.print();
        }
      } else {
        await Print.printAsync({ html });
      }
    } catch (error: any) {
      Alert.alert('Print Error', error.message || 'Could not print score sheet');
    }
  };

  const handleSharePdf = async () => {
    try {
      const html = generateHtmlContent();
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      } else {
        Alert.alert('PDF Saved', `PDF file saved at: ${uri}`);
      }
    } catch (error: any) {
      Alert.alert('Share Error', error.message || 'Could not share PDF');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="document-text" size={24} color={COLORS.primary} />
          <Text style={styles.headerTitle}>Physical Score Sheet Form</Text>
        </View>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Banner */}
        <Card variant="elevated" style={styles.bannerCard}>
          <Text style={styles.agencyTitle}>BATSTATEU ARASOF SPORTS OFFICE</Text>
          <Text style={styles.formSubtitle}>OFFICIAL PHYSICAL SCORING SHEET (OCR ALIGNED)</Text>
          <Text style={styles.eventName}>{event.name}</Text>
          <Text style={styles.eventMetaText}>
            Sport: {event.category} | Venue: {event.venueName || 'Sports Complex'}
          </Text>
        </Card>

        {/* Criteria List Card */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="ribbon-outline" size={18} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Event Criteria & Maximum Scores</Text>
          </View>
          {criteria.map((c, i) => (
            <View key={c.criteria_id} style={styles.criterionRow}>
              <Text style={styles.criterionName}>{i + 1}. {c.name}</Text>
              <View style={styles.criterionBadges}>
                <Text style={styles.badgeText}>Weight: {c.weight}%</Text>
                <Text style={styles.maxBadgeText}>Max: {c.max_score}</Text>
              </View>
            </View>
          ))}
        </Card>

        {/* Scoring Grid Preview */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="grid-outline" size={18} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Department Handwriting Grid</Text>
          </View>
          {(event.departments || []).map((dept, dIdx) => (
            <View key={dept} style={styles.deptRow}>
              <Text style={styles.deptName}>{dIdx + 1}. {dept}</Text>
              <View style={styles.boxesRow}>
                {criteria.map((c) => (
                  <View key={c.criteria_id} style={styles.scoreBoxPlaceholder}>
                    <Text style={styles.boxLabel}>{c.name.slice(0, 3)}</Text>
                    <View style={styles.dashedBox} />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <Button
            label="Print Score Sheet"
            onPress={handlePrint}
            variant="primary"
            size="lg"
            fullWidth
            icon={<Ionicons name="print-outline" size={20} color={COLORS.textInverse} />}
          />
          <Button
            label="Share / Save PDF"
            onPress={handleSharePdf}
            variant="secondary"
            size="md"
            fullWidth
            icon={<Ionicons name="share-outline" size={18} color={COLORS.primary} />}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  closeBtn: {
    padding: SPACING.xs,
  },
  scrollContent: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  bannerCard: {
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.xs,
    backgroundColor: COLORS.primaryDark,
  },
  agencyTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primaryLighter,
    letterSpacing: 1,
  },
  formSubtitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textInverse,
    opacity: 0.9,
  },
  eventName: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textInverse,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  eventMetaText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textInverse,
    opacity: 0.8,
  },
  sectionCard: {
    gap: SPACING.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.xs,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  criterionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  criterionName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textPrimary,
    flex: 1,
  },
  criterionBadges: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  badgeText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
  },
  maxBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
    backgroundColor: 'rgba(185, 28, 28, 0.1)',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
  },
  deptRow: {
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: SPACING.xs,
  },
  deptName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  boxesRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  scoreBoxPlaceholder: {
    alignItems: 'center',
    gap: 2,
  },
  boxLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  dashedBox: {
    width: 50,
    height: 32,
    borderWidth: 1.5,
    borderColor: COLORS.ocr,
    borderStyle: 'dashed',
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.surface,
  },
  actionRow: {
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
});
