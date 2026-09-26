---
name: SportAxis
description: The BatStateU ARASOF Sports Office console, an ink-on-paper operations board with crimson reserved for identity and live state.
colors:
  ink-50: "oklch(0.988 0.001 250)"
  ink-100: "oklch(0.972 0.002 250)"
  ink-200: "oklch(0.929 0.004 252)"
  ink-300: "oklch(0.874 0.006 252)"
  ink-400: "oklch(0.716 0.009 254)"
  ink-500: "oklch(0.578 0.010 256)"
  ink-600: "oklch(0.472 0.011 258)"
  ink-800: "oklch(0.288 0.012 262)"
  ink-900: "oklch(0.214 0.011 264)"
  ink-950: "oklch(0.158 0.010 264)"
  surface: "#ffffff"
  crimson-50: "oklch(0.973 0.013 22)"
  crimson-400: "oklch(0.712 0.143 25)"
  crimson-600: "oklch(0.554 0.188 26.5)"
  crimson-700: "oklch(0.505 0.185 27)"
  crimson-800: "oklch(0.441 0.156 27)"
  teal: "oklch(0.603 0.103 206.7)"
  teal-subtle: "oklch(0.962 0.022 206.7)"
  teal-text: "oklch(0.450 0.080 206.7)"
  success: "oklch(0.516 0.095 158)"
  success-subtle: "oklch(0.970 0.015 158)"
  success-text: "oklch(0.368 0.065 158)"
  warning: "oklch(0.602 0.117 70)"
  warning-subtle: "oklch(0.975 0.018 82)"
  warning-text: "oklch(0.428 0.083 63)"
  info: "oklch(0.512 0.104 256)"
  info-subtle: "oklch(0.970 0.013 248)"
  info-text: "oklch(0.378 0.075 259)"
  chart-played: "#D02525"
  chart-scheduled: "#0092A0"
  chart-not-closed: "#C98A1C"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 640
    lineHeight: 1.12
    letterSpacing: "-0.028em"
  page-title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 640
    lineHeight: 1.2
    letterSpacing: "-0.022em"
  section:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.012em"
  panel-title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.375
    letterSpacing: "-0.004em"
  subsection:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.006em"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
  supporting:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
  nav:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "-0.004em"
  caption:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  overline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.06em"
  numeral:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 640
    lineHeight: 1
    letterSpacing: "-0.018em"
    fontFeature: "tnum"
    fontVariation: "'wdth' 110"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  2xl: "18px"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.25rem"
  "6": "1.5rem"
  "8": "2rem"
  "10": "2.5rem"
  "12": "3rem"
  "16": "4rem"
components:
  button-primary:
    backgroundColor: "{colors.ink-900}"
    textColor: "{colors.ink-50}"
    rounded: "{rounded.md}"
    padding: "0 0.875rem"
    height: "2.25rem"
  button-primary-hover:
    backgroundColor: "{colors.ink-800}"
    textColor: "{colors.ink-50}"
  button-brand:
    backgroundColor: "{colors.crimson-700}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "0 0.875rem"
    height: "2.25rem"
  button-brand-hover:
    backgroundColor: "{colors.crimson-800}"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-900}"
    rounded: "{rounded.md}"
    padding: "0 0.875rem"
    height: "2.25rem"
  button-ghost:
    textColor: "{colors.ink-600}"
    rounded: "{rounded.md}"
    padding: "0 0.875rem"
    height: "2.25rem"
  button-destructive:
    backgroundColor: "{colors.crimson-600}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "0 0.875rem"
    height: "2.25rem"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-900}"
    rounded: "{rounded.md}"
    padding: "0 0.75rem"
    height: "2.25rem"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-900}"
    rounded: "{rounded.lg}"
    padding: "1rem 1.25rem 1.25rem"
  stat-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-900}"
    typography: "{typography.numeral}"
    rounded: "{rounded.lg}"
    padding: "0.875rem 1rem 1rem"
  nav-sidebar:
    backgroundColor: "{colors.ink-950}"
    textColor: "{colors.ink-300}"
    width: "16rem"
  nav-item:
    textColor: "{colors.ink-300}"
    typography: "{typography.nav}"
    rounded: "{rounded.md}"
    padding: "0 0.625rem"
    height: "2.25rem"
  nav-item-active:
    textColor: "{colors.ink-50}"
    typography: "{typography.nav}"
    rounded: "{rounded.md}"
  badge-live:
    backgroundColor: "{colors.crimson-50}"
    textColor: "{colors.crimson-800}"
    rounded: "{rounded.sm}"
    padding: "0.125rem 0.375rem"
  badge-scheduled:
    backgroundColor: "{colors.teal-subtle}"
    textColor: "{colors.teal-text}"
    rounded: "{rounded.sm}"
    padding: "0.125rem 0.375rem"
  badge-final:
    backgroundColor: "{colors.ink-100}"
    textColor: "{colors.ink-600}"
    rounded: "{rounded.sm}"
    padding: "0.125rem 0.375rem"
---

# Design System: SportAxis

## Overview

**Creative North Star: "The Match-Day Running Order"**

SportAxis is the Sports Office's console: a place an administrator opens many times a day in season to learn what is live, what is next and what is waiting on them, then act. The system is built like an operations board rather than an analytics showcase. Surfaces are near-achromatic ink on paper; a charcoal rail holds the navigation so the chrome recedes and the page carries the colour. Colour appears only where it carries meaning, so the one brand hue (BatStateU crimson) stays legible as a signal instead of wallpaper.

The load-bearing structural decision is that the primary action is ink, not red. The brand colour is red, and when the primary button, the active nav item and the delete button are all red, nothing reads as dangerous and nothing reads as important. So ink drives primary actions and text hierarchy, crimson carries identity (active navigation, live state, the sidebar's one primary action, the first chart series), danger is a distinct scarlet step, and a single complementary teal marks what is scheduled or still ahead.

Density is moderate and deliberate: white panels on 1px hairlines with a barely-there lit shadow, Archivo throughout, and figures set on Archivo's wide axis so scores and counts read as the content they are. The root font size is 18px (a low-vision accessibility decision), so every rem value in this file resolves against 18px.

**Key Characteristics:**
- Ink-on-paper neutrals with a whisper of blue at the dark end; no second neutral family.
- Crimson spent sparingly: active nav, live state, one primary action, the played series.
- Teal (#0092A0) as the one complementary accent, meaning scheduled / future.
- Archivo variable (width + weight); wide-axis tabular numerals for every figure.
- Charcoal sidebar, paper canvas, white hairline panels, 10px corners.
- True numbers only: deltas render only where timestamped history exists.

## Colors

A near-achromatic ink scale on paper, one institutional crimson used as a signal, one complementary teal, and lightness-matched status families.

### Primary
- **BatStateU Crimson** (crimson-700, the institutional #B91C1C anchor): identity. The sidebar's single solid primary action ("New event"), the 3px active-nav pip, the live pip, caret and accent colour, link underlines. Crimson-800 is its hover and its text-on-tint colour; crimson-50 is its tint for the Live badge, today's date tile and text selection. On the charcoal rail the active icon steps up to crimson-400 for contrast.
- **Scarlet Danger** (crimson-600): destructive buttons and error states. It is a distinct step from the brand anchor, and because no primary button is red, a red button unambiguously means destructive.

### Secondary
- **Scheduled Teal** (teal, `--chart-2` / `--accent-teal`, exposed as the `aqua` utilities): what is scheduled, upcoming or still ahead. Scheduled badges and stat icons use teal-subtle behind teal-text. Named `aqua` in utilities because Tailwind's own `teal-*` ramp is aliased to green.

### Tertiary
- **Status families** (success green, warning amber, info blue): each has a solid, a subtle tint and a text step, matched in lightness across hues so a row of status chips reads as one family differing by hue. Warning amber is the "waiting on you" / attention tone.
- **Season chart series** (chart-played, chart-scheduled, chart-not-closed): the admin season-activity chart's validated trio (played crimson, scheduled teal, not-closed amber), checked for colour-vision separation as a set.

### Neutral
- **Paper** (ink-50): the app canvas behind everything.
- **Panel White** (surface): panels, stat cards, inputs, popovers.
- **Tint** (ink-100): subtle fills, sunken wells, the Final badge, neutral stat icons.
- **Hairline** (ink-200): the default 1px border on every panel and field. Ink-300 is the stronger border on hover.
- **Muted / Secondary / Primary text** (ink-500 / ink-600 / ink-900): captions and placeholders, supporting text, body and headings.
- **Charcoal Rail** (ink-950): the sidebar and the avatar disc. Nav text sits at ink-300, going to ink-50 on hover and active.

### Named Rules
**The Ink Leads Rule.** The default primary button is ink (ink-900 on ink-50). Crimson is never the default "do the main thing" colour on a content page; the one solid crimson control per screen is the role's primary action in the sidebar.

**The Ramps Are the System Rule.** theme.css redefines Tailwind's own ramps: gray/slate/zinc resolve to ink; red/rose/pink to crimson; green/emerald (and teal-500..700) to one green; amber/yellow/orange to one amber; blue/sky/indigo/cyan to one blue; purple/violet/fuchsia to ink. Change colour in theme.css, never per page; new code should prefer the semantic tokens (`bg-surface`, `text-text-muted`, `bg-brand-subtle`, `bg-aqua-subtle`).

**The One Complement Rule.** Teal is the only accent beside crimson. Violet is not an accent in this system; purple utilities intentionally recede to ink.

## Typography

**Display Font:** Archivo (with ui-sans-serif, system-ui fallback)
**Body Font:** Archivo (same family)
**Label/Mono Font:** Archivo (the mono stack also leads with Archivo)

**Character:** One variable grotesque doing every job. Hierarchy comes from size, colour and space first, weight second; the width axis, not a second family, gives numerals their presence.

### Hierarchy
- **Display** (640, 2rem, 1.12): rare large moments.
- **Page Title** (640, 1.5rem, 1.2): the one h1 per page, e.g. the dashboard greeting.
- **Section** (600, 1rem, 1.35): section headings within a page.
- **Panel Title** (600, 0.9375rem, ~1.375): the title row of every console panel.
- **Subsection** (600, 0.875rem, 1.4): the header's current-page name, small headings.
- **Body** (400, 0.9375rem, 1.6, max 70ch): running text.
- **Supporting** (400, 0.875rem, 1.55, max 68ch, ink-600): ledes and the dashboard's status sentence.
- **Label** (500, 0.8125rem, 1.4, ink-600): stat labels, field labels, header breadcrumb.
- **Nav** (500, 0.875rem, 1.4): sidebar items.
- **Caption** (400, 0.75rem, 1.45, tabular, ink-500): timestamps, panel descriptions, stat details.
- **Overline** (600, 0.6875rem, 0.06em, uppercase, ink-500): list-group labels in the mobile navigation sheet only.
- **Numeral** (640, wdth 110, tabular, -0.018em): every headline figure; 2rem in stat cards, 1rem in date tiles.

### Named Rules
**The Wide Figure Rule.** Any score, count, rank or time that is the content gets `.numeral` (tabular, wdth 110). Tables, number inputs and `<time>` are tabular by default so columns never jitter.

**The Paper Exception Rule.** Print score sheets (src/app/utils/scoresheet.ts) stay in Arial on purpose: they are photocopied, hand-filled and OCR'd. Do not move them to Archivo.

## Layout

The signed-in shell is a two-pane frame: a 16rem charcoal sidebar (collapsible to 4.25rem) at lg (64rem) and above, and a content column with a sticky 3.5rem header (surface at 88% with backdrop blur, bottom hairline). Below lg the sidebar disappears; a fixed bottom tab bar (min 3.25rem, safe-area aware) and a sheet for the full menu take over, and main content pads 4.5rem at the bottom to clear the bar.

Console dashboards sit in a frame of max 96rem with 1rem / 1.5rem / 2rem side gutters (base / sm / lg) and 1.5rem top, 2.5rem bottom padding. Content pages use `.page-container` (max 80rem, same gutter steps). Dashboards compose on a 12-column grid with a uniform 1rem gap: an 8 + 4 split for primary analytics beside a side column, 7 + 5 for lists, and stat rows at 2 columns (sm) to 4 (xl), horizontally scrolling on the smallest widths. Everything must hold at 390px wide.

Spacing is a 4px-based rem scale. Vertical rhythm is tight inside a group (0.375rem), 1.25rem between form fields, 2.5rem between sections and 3rem above a section heading. Many groupings are not cards at all: `.section-divide` separates them with a subtle rule and 1.5rem of space.

## Elevation & Depth

A hybrid that leans flat. Depth is expressed first by luminance (paper canvas, white panels, ink-100 wells), then by a 1px hairline, and only then by shadow. Shadows are tinted with the ink hue and carry a real downward offset so a raised surface reads as lit from above rather than as a grey halo. In dark mode they switch to pure black at higher alpha.

### Shadow Vocabulary
- **Rest** (`--shadow-1`: `0 1px 2px -1px oklch(0.214 0.011 264 / 0.08)`): every panel and stat card at rest; buttons.
- **Lift** (`--shadow-2`: `0 1px 3px -1px oklch(0.214 0.011 264 / 0.10), 0 2px 8px -4px oklch(0.214 0.011 264 / 0.06)`): hover on linked stat cards and on buttons.
- **Float** (`--shadow-3`): dropdowns and popovers.
- **Overlay** (`--shadow-4`: `0 16px 40px -12px ... / 0.18, 0 4px 10px -6px ... / 0.08`): dialogs and sheets.

### Named Rules
**The Hairline First Rule.** A panel is defined by its 1px ink-200 border and the Rest shadow; shadow never replaces the border. Hover strengthens both together (border to ink-300, shadow to Lift), never shadow alone.

## Shapes

Restrained, concentric corners: a control sits one radius step tighter than the surface holding it. Panels and stat cards are 10px; buttons, inputs, nav rows and icon wells 8px; small buttons and badges 6px; the focus outline 4px. 14px and 18px exist for larger overlays. The only full circles are the avatar disc and the live pip. Borders are always 1px; the empty state is the one dashed border.

## Components

### Buttons
Quiet, firm, and ink-led.
- **Shape:** gently rounded (8px; 6px at the small size), 2.25rem tall by default (2rem small, 2.75rem large).
- **Primary:** ink-900 fill, ink-50 text, 500 weight, Rest shadow.
- **Hover / Focus:** fill steps to ink-800 with the Lift shadow over 140ms on ease-out-quart; pressed nudges down 1px. Focus is the global 2px ink-900 outline at 2px offset.
- **Brand:** crimson-700 fill, white text, hover crimson-800. Reserved for the role's one primary action.
- **Secondary:** white surface, 1px hairline, ink-900 text; hover firms the border.
- **Ghost:** no fill, ink-600 text, ink-100 fill on hover.
- **Destructive:** crimson-600 fill, white text; a subtle variant uses the danger tint and border.
- **Disabled:** 40% opacity, no shadow.

### Chips (status badges)
- **Style:** 6px corners, 0.6875rem at 600 weight, tint fill with its own text step, no border.
- **State:** Live = crimson-50 / crimson-800 with a 6px crimson dot; Scheduled = teal-subtle / teal-text; Final = ink-100 / ink-600. The office's own words, nothing else.

### Cards / Containers
- **Corner Style:** 10px.
- **Background:** white surface on the paper canvas.
- **Shadow Strategy:** Rest; Lift on hover when the whole panel is a link.
- **Border:** 1px ink-200.
- **Internal Padding:** panel title row 1rem top, 1.25rem sides, 0.75rem below; body 1.25rem sides and bottom. The title row may carry one right-aligned action, typically a "View all" link in ink-600 with a 3.5 arrow that nudges right on hover.

### Inputs / Fields
- **Style:** white surface, 1px hairline, 8px corners, 2.25rem tall, 0.75rem side padding, ink-500 placeholder.
- **Focus:** the border firms to ink-300 and the global ink outline appears; no per-field glow ring.
- **Error / Disabled:** error turns the border danger; disabled sinks to the ink-100 well with ink-400 text.

### Navigation
- **Sidebar:** ink-950 rail, white logomark with "SportAxis" at 0.9375rem/600 and the office name beneath at 0.6875rem. Groups carry quiet sentence-case labels (0.6875rem, 500, ink-500) and 1.25rem between groups. Rows are 2.25rem, Nav type, ink-300, icons at 80% opacity.
- **Hover:** white at 7% over the rail, text to ink-50.
- **Active:** a lifted row (white at 14%), ink-50 text, crimson-400 icon, and a 3px by 1rem crimson pip at the rail edge. Never a solid red pill.
- **Header:** group / page breadcrumb at left, a search trigger (hairline field with a Ctrl K key cap) opening a command palette of pages and, for the office, events; notification bell; account menu with an ink-950 initials disc.
- **Mobile:** fixed bottom bar at surface 92% with blur; tabs stack an 18px icon over a 0.6875rem label; the active tab is crimson-800 text. "More" opens a sheet listing every group.

### Stat Card (signature)
One headline figure that links to where it is acted on. A Label row (with an optional pulsing crimson live pip) beside a 2rem icon well tinted by tone: neutral (ink-100), live (crimson tint), scheduled (teal tint), attention (warning tint). The figure is a 2rem Numeral. A delta chip appears only when the figure has timestamped history; a caption line below gives the detail.

### Fixture Row (signature)
Upcoming events as compact rows on a 3rem date tile: an ink-100 tile with an uppercase short month over a Numeral day, turning crimson-tinted and reading "Today" on the day itself. Rows hover to the paper tint.

## Do's and Don'ts

### Do:
- **Do** make ink-900 the primary button and keep crimson for active nav, live state, the sidebar's one primary action and the first chart series.
- **Do** change colour in theme.css; the redefined Tailwind ramps carry ~1,700 existing utilities with it.
- **Do** use teal (the `aqua` utilities) for scheduled and future, never `teal-*`, which is aliased to green.
- **Do** set every headline figure with `.numeral` (tabular, wdth 110).
- **Do** build console panels as white surface, 1px ink-200 hairline, 10px corners, Rest shadow.
- **Do** show a delta or trend only when timestamped rows back it.
- **Do** keep the print score sheets in Arial.

### Don't:
- **Don't** make the primary button, active nav and delete button the same red.
- **Don't** mark the active nav item with a solid crimson pill; use the lifted row, crimson icon and 3px pip.
- **Don't** introduce violet or a second accent beside teal.
- **Don't** hard-code hex colours in pages for UI chrome; use the semantic tokens.
- **Don't** put an uppercase overline above a heading as an eyebrow; the overline role is for list-group labels.
- **Don't** let a shadow stand in for the hairline border.
