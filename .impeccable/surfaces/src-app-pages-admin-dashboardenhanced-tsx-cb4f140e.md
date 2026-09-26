---
version: 1
slug: "src-app-pages-admin-dashboardenhanced-tsx-cb4f140e"
primary_target: "SportAxisWeb/src/app/pages/admin/DashboardEnhanced.tsx"
related_targets: ["SportAxisWeb/src/app/components/layout/MainLayout.tsx"]
---

# Admin dashboard (Sports Office console home)

Scope: `/admin` dashboard page plus the signed-in app shell (sidebar, header) shared by every role. Mode: Operate.

Audience and job: the Sports Office administrator opening the console many times a day in season; within five seconds they must know what is live, what is next, and what is waiting on them, then act.

Constraints (user-confirmed 2026-09-26): dark charcoal sidebar, light content canvas; admin dashboard first (coach/athlete dashboards later with the same parts); sidebar links only to real pages. Brief pins: stat row, primary analytics with side cards, upcoming events as compact rows, recent activity, quick actions, narrow right information column; SportAxis red used strategically plus one complementary accent (teal #0092A0, validated against red for CVD). True numbers only; no trend where no timestamps exist.

## Direction contract

THESIS: A match-day operations board: the page reads like the office's running order (live, next, waiting) before it reads like analytics. Refuses the category default of a wall of equal KPI cards over decorative charts.

OWN-WORLD: Charcoal ink sidebar (ink-950) with white mark; paper canvas; white panels with 1px ink-200 hairlines and shadow-1; Archivo with wide-axis numerals for figures; SportAxis crimson only for live state, primary actions, active nav and the played series; teal for scheduled/future; status chips from the existing semantic ramps.

STORY: The admin sees a one-line status sentence, four figures (live now, this week, waiting on you, athletes), the weekly season rhythm with today marked, the next fixtures with committee gaps flagged, the queue of approvals, and who changed what; each figure links to where it is acted on.

FIRST VIEWPORT: Header bar: page title left, search (pages and events) centre-right, bell, avatar with name and role. Canvas: greeting and status sentence; 4 stat panels in one row; below, an 8-column season-activity column chart (played crimson, scheduled teal, today line) beside a 4-column college standings list; primary action "New event" sits in the sidebar top, red.

FORM: Operations running-order dashboard, list position 1; no concept roll (precisely specified brief, established world).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
