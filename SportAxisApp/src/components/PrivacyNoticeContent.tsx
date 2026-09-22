import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, SPACING, TYPE } from '../../constants/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Shared Data Privacy Notice body — used by both app/(auth)/privacy-notice.tsx
// (shown at signup, before an account exists) and app/(app)/privacy-notice.tsx
// (reachable later from Settings), so the legal text lives in exactly one
// place. See app/(auth)/privacy-notice.tsx for the version-sync note with the
// backend and web app.
// ─────────────────────────────────────────────────────────────────────────────

export const PRIVACY_NOTICE_VERSION = '2026-09-21';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function PrivacyNoticeContent() {
  return (
    <>
      <Text style={styles.intro}>
        SportsAxis is used by the BatStateU-TNEU ARASOF Sports Office to manage sports
        events, scoring, and athlete eligibility. This notice explains what personal
        information we collect through this app, why, and what rights you have over it,
        in line with the Data Privacy Act of 2012 (RA 10173).
      </Text>

      <Section title="What we collect">
        <Text style={styles.body}>
          • Account information: name, email address, and role (athlete, coach, judge,
          or admin).{'\n'}
          • For athletes: SR Code, gender, college, program, and year level, verified
          against the university registrar.{'\n'}
          • Athlete eligibility documents, including medical clearance certificates,
          uploaded as part of the eligibility checklist.{'\n'}
          • Event participation records: scores, attendance, and protest history tied to
          your account.
        </Text>
      </Section>

      <Section title="Why we collect it">
        <Text style={styles.body}>
          Medical clearance is required for every athlete, regardless of individual
          preference, because the Sports Office must confirm you are fit to participate
          before you compete. Account and eligibility information is used to run events,
          verify eligibility, record scores and attendance, and resolve disputes.
        </Text>
      </Section>

      <Section title="Who can see it">
        <Text style={styles.body}>
          Your coach can view your own eligibility documents and records. Sports Office
          committee members can view records needed to run and officiate events. Your
          information is never sold or shared outside the university for marketing or
          any other unrelated purpose.
        </Text>
      </Section>

      <Section title="How long we keep it">
        <Text style={styles.body}>
          Athlete records, including medical clearance documents, are kept until you
          graduate, after which they are scheduled for deletion in line with university
          records policy.
        </Text>
      </Section>

      <Section title="Your rights">
        <Text style={styles.body}>
          You may request access to, correction of, or deletion of your personal
          information by contacting the Sports Office directly. You may also file a
          complaint with the university's data protection office, or with the National
          Privacy Commission, if you believe your information has been mishandled.
        </Text>
      </Section>

      <Section title="Questions or concerns">
        <Text style={styles.body}>
          Contact the BatStateU-TNEU ARASOF Sports Office for any question about this
          notice or how your information is handled.
        </Text>
      </Section>

      <Text style={styles.version}>Notice version: {PRIVACY_NOTICE_VERSION}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  intro: { ...TYPE.body, color: COLORS.textSecondary },
  section: { gap: SPACING.xs, marginTop: SPACING.lg },
  sectionTitle: { ...TYPE.subhead, color: COLORS.textPrimary },
  body: { ...TYPE.body, color: COLORS.textSecondary, lineHeight: 21 },
  version: { ...TYPE.caption, textTransform: 'none', color: COLORS.textMuted, marginTop: SPACING.xl },
});
