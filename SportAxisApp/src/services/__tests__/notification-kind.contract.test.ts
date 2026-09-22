import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Contract check: the "kind" string the backend actually sends on
// GET /notifications vs. the finite set of kinds the mobile notifications
// screen knows how to render.
//
// Backend kinds come straight from every App\Notifications\* class's
// toArray() (SportAxisWeb/backend/app/Notifications/*.php):
//   ProtestFiled          -> 'protest_filed'
//   ProtestResolved       -> 'protest_resolved'
//   RequirementReviewed   -> 'requirement_reviewed'
//   ScoreDisputed         -> 'score_disputed'
// These are copied through untouched by NotificationController::index()
// ('kind' => $n->data['kind'] ?? 'info').
//
// The mobile screen (SportAxisApp/app/(app)/notifications.tsx) renders:
//   const tone = KIND_COLOR[item.kind];
//   <Icon name={KIND_ICON[item.kind]} ... color={tone.fg} />
// KIND_ICON / KIND_COLOR are plain object literals typed
// Record<NotificationKind, ...> where NotificationKind is only
// 'info' | 'success' | 'warning' | 'error' (src/types/index.ts). There is no
// fallback/default case.
//
// This test reads the screen's own source (rather than duplicating a
// hand-copied literal that could drift) to pull out the keys KIND_ICON
// actually has, and checks every kind the backend can really send today is
// among them. KIND_ICON/KIND_COLOR are now Partial<Record<...>> with a
// DEFAULT_ICON/DEFAULT_TONE fallback at the lookup site, so even a kind not
// listed here (a future notification type) renders safely instead of
// crashing — this test just confirms today's known kinds are covered.
// ─────────────────────────────────────────────────────────────────────────────

const BACKEND_NOTIFICATION_KINDS = [
  'protest_filed',
  'protest_resolved',
  'requirement_reviewed',
  'score_disputed',
];

describe('notifications.tsx KIND_ICON/KIND_COLOR vs real backend kinds', () => {
  const screenSource = fs.readFileSync(
    path.join(__dirname, '../../../app/(app)/notifications.tsx'),
    'utf8',
  );

  const kindIconBlock = screenSource.match(/const KIND_ICON:[^{]*\{([^}]*)\}/)?.[1] ?? '';
  const mappedKinds = Array.from(kindIconBlock.matchAll(/(\w+):/g)).map((m) => m[1]);

  it('sanity check: the screen maps every known backend kind', () => {
    expect(mappedKinds).toEqual(BACKEND_NOTIFICATION_KINDS);
  });

  it.each(BACKEND_NOTIFICATION_KINDS)(
    'backend kind "%s" must be present in KIND_ICON so item lookup does not crash',
    (kind) => {
      expect(mappedKinds).toContain(kind);
    },
  );
});
