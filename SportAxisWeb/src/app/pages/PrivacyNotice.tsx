import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

/**
 * Data Privacy Notice — required disclosure under the Data Privacy Act of
 * 2012 (RA 10173). Athlete medical clearance documents are collected as a
 * mandatory eligibility requirement (fitness to play), not on an opt-in
 * basis, so this is a disclosure the account holder acknowledges, not a
 * consent they can decline while still using the system.
 *
 * PRIVACY_NOTICE_VERSION must match AuthController::PRIVACY_NOTICE_VERSION
 * (SportAxisWeb/backend/app/Http/Controllers/Api/AuthController.php) and the
 * mobile app's equivalent screens. Bump all three together whenever this
 * text changes materially.
 *
 * This is a first draft covering the standard disclosure elements RA 10173
 * requires — it has not been reviewed by BatStateU's legal/data-protection
 * office and should be before this ships to real users.
 */
export const PRIVACY_NOTICE_VERSION = '2026-09-21';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      <div className="text-sm text-gray-600 leading-relaxed">{children}</div>
    </div>
  );
}

export default function PrivacyNotice() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link to="/login" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Data Privacy Notice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-gray-600">
            SportsAxis is used by the BatStateU-TNEU ARASOF Sports Office to manage
            sports events, scoring, and athlete eligibility. This notice explains what
            personal information we collect through this system, why, and what rights
            you have over it, in line with the Data Privacy Act of 2012 (RA 10173).
          </p>

          <Section title="What we collect">
            <ul className="list-disc pl-5 space-y-1">
              <li>Account information: name, email address, and role (athlete, coach, judge, or admin).</li>
              <li>For athletes: SR Code, gender, college, program, and year level, verified against the university registrar.</li>
              <li>Athlete eligibility documents, including medical clearance certificates, uploaded as part of the eligibility checklist.</li>
              <li>Event participation records: scores, attendance, and protest history tied to your account.</li>
            </ul>
          </Section>

          <Section title="Why we collect it">
            Medical clearance is required for every athlete, regardless of individual
            preference, because the Sports Office must confirm you are fit to
            participate before you compete. Account and eligibility information is used
            to run events, verify eligibility, record scores and attendance, and
            resolve disputes.
          </Section>

          <Section title="Who can see it">
            Your coach can view your own eligibility documents and records. Sports
            Office committee members can view records needed to run and officiate
            events. Your information is never sold or shared outside the university
            for marketing or any other unrelated purpose.
          </Section>

          <Section title="How long we keep it">
            Athlete records, including medical clearance documents, are kept until you
            graduate, after which they are scheduled for deletion in line with
            university records policy.
          </Section>

          <Section title="Your rights">
            You may request access to, correction of, or deletion of your personal
            information by contacting the Sports Office directly. You may also file a
            complaint with the university's data protection office, or with the
            National Privacy Commission, if you believe your information has been
            mishandled.
          </Section>

          <Section title="Questions or concerns">
            Contact the BatStateU-TNEU ARASOF Sports Office for any question about this
            notice or how your information is handled.
          </Section>

          <p className="text-xs text-gray-400 pt-2">Notice version: {PRIVACY_NOTICE_VERSION}</p>
        </CardContent>
      </Card>
    </div>
  );
}
