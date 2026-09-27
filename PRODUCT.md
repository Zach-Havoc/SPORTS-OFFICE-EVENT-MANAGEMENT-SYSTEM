# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

A companion Expo (React Native) app, `SportAxisApp/`, serves the scoring committee on phones; it follows the web design system but is its own surface.

## Users

- **Sports Office administrator / secretary** (role `admin`): runs the university intramurals and the Sports Office at Batangas State University – ARASOF campus. Works at a desk on a laptop or desktop, many times a day during a season: scheduling events, assigning committees, publishing brackets, watching results come in, and clearing pending CMO requirements, tryouts and appeals.
- **Coach / trainer** (`coach`): manages one college's roster for a sport, training attendance, performance remarks, tryout decisions, CMO requirement review, and filing appeals against game results.
- **Scoring committee / judge** (`judge`): opens an assigned game by QR code, keeps the live scoreboard, submits scores, or photographs a paper score sheet for OCR.
- **Student-athlete** (`athlete`): checks schedules, training sessions, attendance, performance and their CMO requirements.
- **Public viewer** (not signed in): the university community following schedules, live scores, standings, brackets and history.

## Product Purpose

SportAxis centralises the Sports Office's records and the intramural competition in one web platform, replacing paper forms, spreadsheets and group-chat announcements. Success means the office can see the state of the season at a glance, act on what is pending, and publish accurate results without re-encoding data.

## Positioning

Built for one campus Sports Office's real workflow: college-vs-college intramurals with seasons, brackets and a medal tally; committee-only scoring by QR code with paper-sheet OCR as a permanent alternative to live entry; and the CMO requirement process for athletes. It is not a generic league or fitness app.

## Operating Context

- Deployed on InfinityFree shared hosting (no persistent processes). Live scores refresh by polling there; Laravel Reverb is used where the host allows it.
- Paper score sheets are printed, filled by hand and photographed for OCR; their print CSS (Arial) is deliberately plain.
- The academic capstone paper (Chapters 1–3) describes this system and must stay consistent with it.

## Capabilities and Constraints

- Stack: Laravel 13 API + React/Vite/TypeScript/Tailwind/shadcn web app with TanStack Query; Expo mobile app.
- Admin reaches users via `/admin/users`; `/athletes`, `/requirements`, `/performance` and `/attendance` API routes are coach-only, so admin figures about athletes come from user accounts.
- Real pages only in navigation: there are no standalone Teams, Sports or Notifications pages. Sports (categories) live in Settings; notifications live in the header bell.
- "CMO" in this product means the Requirements module (athlete documents reviewed by coaches, types defined by the office).
- One committee member is assigned per event.
- "Appeal" is the user-facing word for a formal objection to a game result ("protest" was retired on 2026-09-27). Code, routes and tables still say `protest`.
- Dashboard deltas and sparklines are computed only from timestamped rows; metrics with no history show no trend.

## Brand Commitments

- Name: **SportAxis**. Primary brand colour is SportAxis red (BatStateU red, anchored at #B91C1C). Logo marks: `SportAxisWeb/public/sportaxis-mark.png` and `sportaxis-mark-white.png`.
- Typeface: Archivo (variable width and weight).
- Confirmed 2026-09-26 for the console shell: a dark charcoal sidebar with light content pages; red used strategically, not everywhere.

## Evidence on Hand

Real seeded data: colleges (departments with logos), sports categories, seasons, events, brackets, users by role, leaderboard/medal tally, CMO requirements, tryout applications, appeals, audit logs. No testimonials, customers or usage statistics exist; none may be invented.

## Product Principles

1. The office should understand the season's state within five seconds of opening the dashboard: what is live, what is next, what is waiting on them.
2. Show only true numbers: no invented trends, no metrics the data cannot support.
3. Every element earns its place with an action or a decision it supports.
4. One system across roles: the shell and components are shared; each role sees only its own work.

## Accessibility & Inclusion

Used on campus lab and office machines and on phones; must work at 390px wide, keep WCAG AA contrast, and respect reduced motion.
