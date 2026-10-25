---
name: HelloKido Admin
description: The daily panel of a small kids' workshop, on the web and on the iPhone; calm, white, native-feeling, after the Vizion Menu panel.
colors:
  ground: "#ffffff"
  surface: "#ffffff"
  surface-2: "#fafafa"
  well: "#f5f5f5"
  hover: "#f4f4f5"
  track: "#f0f0f0"
  line: "#e5e5e5"
  line-strong: "#d4d4d4"
  ink: "#0a0a0a"
  ink-2: "#525252"
  ink-3: "#737373"
  ink-4: "#a3a3a3"
  accent: "#0086c6"
  accent-ink: "#00679b"
  accent-solid: "#0077b3"
  accent-line: "#b6d9ee"
  accent-wash: "#f0f7fb"
  accent-wash-2: "#e1eff8"
  on-accent: "#ffffff"
  action: "#f59e0b"
  action-ink: "#92400e"
  action-line: "#f3d58a"
  action-wash: "#fffbeb"
  positive: "#22a55a"
  positive-ink: "#15803d"
  positive-line: "#bbe5c8"
  positive-wash: "#f0fdf4"
  negative: "#dc2626"
  negative-ink: "#b91c1c"
  negative-line: "#f5c2c2"
  negative-wash: "#fef2f2"
  pink: "#db5a8a"
  pink-ink: "#a3305c"
  pink-line: "#f2c4d5"
  pink-wash: "#fdf2f6"
  type-duyusal: "#e0a100"
  type-ingilizce: "#0086c6"
  type-ozel: "#db5a8a"
  series-in: "#0086c6"
  series-out: "#e0752d"
  focus: "#0086c6"
  dark-ground: "#0a0a0a"
  dark-surface: "#111111"
  dark-surface-2: "#161616"
  dark-well: "#1c1c1c"
  dark-line: "#262626"
  dark-line-strong: "#3a3a3a"
  dark-ink: "#fafafa"
  dark-ink-2: "#d4d4d4"
  dark-ink-3: "#a3a3a3"
  dark-accent: "#38a8e0"
  dark-accent-ink: "#7cc6ec"
  dark-accent-wash: "#0b2231"
  phone-ground: "#f5f5f3"
  phone-surface-2: "#f6f5f2"
  phone-band: "#faf9f7"
  phone-line: "#e6e4df"
  phone-line-2: "#efede8"
  phone-line-strong: "#d3d0c8"
  phone-ink: "#1c1b18"
  phone-ink-2: "#5c5850"
  phone-ink-3: "#6f6a61"
  phone-accent-line: "#c0dcec"
  phone-accent-wash: "#edf5fa"
  phone-action: "#e3a300"
typography:
  headline:
    fontFamily: "Euclid Circular A, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  figure:
    fontFamily: "Euclid Circular A, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\""
  period:
    fontFamily: "Euclid Circular A, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
  title:
    fontFamily: "Euclid Circular A, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.96875rem"
    fontWeight: 600
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Euclid Circular A, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  meta:
    fontFamily: "Euclid Circular A, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
  label:
    fontFamily: "Euclid Circular A, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.78125rem"
    fontWeight: 500
  phone-title:
    fontFamily: "system-ui"
    fontSize: "25px"
    fontWeight: 600
    lineHeight: "30px"
    letterSpacing: "-0.5px"
  phone-section:
    fontFamily: "system-ui"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: "25px"
    letterSpacing: "-0.38px"
  phone-body:
    fontFamily: "system-ui"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: "22px"
  phone-foot:
    fontFamily: "system-ui"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
rounded:
  tablet: "8px"
  control: "10px"
  tile: "10px"
  panel: "16px"
  phone-card: "18px"
  sheet: "20px"
  full: "9999px"
spacing:
  row: "12px"
  gutter: "16px"
  gutter-md: "24px"
  gutter-lg: "40px"
  phone-section: "30px"
components:
  button-primary:
    backgroundColor: "{colors.accent-solid}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "38px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "38px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-2}"
  button-quiet:
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.full}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "40px"
  search-pill:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-3}"
    rounded: "{rounded.full}"
    height: "38px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.full}"
    padding: "0 12px"
    height: "32px"
  chip-selected:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent-ink}"
  segmented:
    backgroundColor: "{colors.well}"
    rounded: "{rounded.full}"
    padding: "4px"
  segmented-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    height: "30px"
  mark:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.full}"
    padding: "0 10px"
    height: "24px"
    typography: "{typography.label}"
  avatar:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.tile}"
    size: "36px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
  band:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-3}"
    padding: "8px 20px"
    typography: "{typography.label}"
  rail-item-active:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tablet}"
    height: "36px"
  phone-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.phone-card}"
  phone-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.phone-ink}"
    rounded: "{rounded.full}"
    height: "44px"
    padding: "0 16px"
  phone-promo-pill:
    backgroundColor: "{colors.phone-accent-wash}"
    textColor: "{colors.accent-ink}"
    height: "46px"
    padding: "0 13px"
    rounded: "14px"
---

# Design System: HelloKido Admin

## Overview

**Creative North Star: "The Quiet Workbench"**

The panel is a working tool that steps out of the way. A white canvas, neutral greys, 1px hairlines and one HelloKido blue carry the whole interface; colour is spent only on meaning: a status dot, a lesson-type dot, the one filled button in an area. The look follows the Vizion Menu dashboard the owner approved: cards with a header, a ruled body and a footer link; grey bands for column heads and groups; pill controls; square initials tiles for people.

There are two surfaces with one vocabulary. The web panel (Vite, React, Tailwind 4) is pure white with neutral greys. The iPhone app (Expo, "Template 2") sits on a warm grey canvas with white cards of 18px radius, the system font, the phone's own large titles, tab bar, switches and action sheets. Marks, dots, share bars, tiles and the seat board look the same on both.

Density is a working tool's: readable between lessons, numbers in tabular figures, everything opens on the current day, week or month. Light is the default; both surfaces have a full dark theme with the same roles.

**Key Characteristics:**
- One blue voice; every other hue is a signal with one meaning, shown mostly as a dot.
- Hairlines before shadows; shadows only for the selected piece of a pill track and floating layers.
- Cards are the one container: header, border-t body, optional footer with an underlined link.
- Pills for controls, rounded squares for people, 16px (web) / 18px (phone) for containers.
- Native on the phone: system font, native tabs, native switches and pickers, haptics on selection.

## Colors

A neutral white-and-grey room with one HelloKido blue; status colours live in small dots, outlined chips and soft washes.

### Primary
- **HelloKido Blue** (#0086c6): bars, dots, focus rings, chart series "in", the share bar of lessons left, the selected tab icon on the phone.
- **Deep Blue** (#0077b3): the fill of primary buttons and switches (white on it is 4.9:1); the same value in dark.
- **Blue Ink** (#00679b): blue text: quiet buttons, selected chips, promo pills, the selected phone tab.
- **Blue Line / Washes** (#b6d9ee, #f0f7fb, #e1eff8): the outline and fill of selected chips, info notices and the phone's promo pills.

### Secondary
- **Action Amber** (#f59e0b web, #e3a300 phone): "needs your action" only: payment due, a lesson whose attendance was forgotten, a package running low. Ink #92400e, line #f3d58a, wash #fffbeb.

### Tertiary
- **Settled Green** (#22a55a): attended, paid, done. Ink #15803d.
- **Logo Pink** (#db5a8a): make-up lessons and the "özel" lesson type. Ink #a3305c.
- **Danger Red** (#dc2626): failure, destructive actions, a seat over the planned six. Ink #b91c1c.
- **Lesson-type dots**: duyusal (#e0a100), ingilizce (#0086c6), özel (#db5a8a). An 8px dot before the lesson name, never a fill.
- **Money out** (#e0752d): chart series for expenses, paired with blue for money in.

### Neutral
- **White Canvas** (#ffffff): web ground, rail and surface are all white; structure comes from lines.
- **Band Grey** (#fafafa): column heads, group bands, the search pill, the resting avatar tile.
- **Well** (#f5f5f5) and **Hover** (#f4f4f5): pill tracks, and the active / hovered nav item.
- **Hairline** (#e5e5e5) and **Strong Hairline** (#d4d4d4): every border; strong for hover and dashed "gave up the seat" tiles.
- **Inks**: ink (#0a0a0a), ink-2 (#525252) for secondary text, ink-3 (#737373, 4.7:1 on white) for meta, ink-4 (#a3a3a3) never for text that must be read (the empty part of "4/6").
- **Phone neutrals**: warm canvas (#f5f5f3), card edge (#e6e4df), inner row rules (#efede8, a step lighter, starting after the leading tile), outline of everyday buttons (#d3d0c8), inks #1c1b18 / #5c5850 / #6f6a61.

**Dark theme.** Web: ground #0a0a0a, surface #111111, bands #161616, well #1c1c1c, lines #262626 / #3a3a3a, inks #fafafa / #d4d4d4 / #a3a3a3, blue lifts to #38a8e0 with ink #7cc6ec; Deep Blue stays #0077b3 for fills. Phone dark matches, with surface #161616 and a lighter "raised" piece (#2e2e2e) for the selected segment, because white would sink into the dark well.

### Named Rules
**The One Blue Rule.** HelloKido blue is the only accent. Emphasis uses Deep Blue, Blue Ink or a blue wash, never a new hue.

**The Amber Means Act Rule.** Amber appears only where the admin has something to do. No decorative or category amber (the duyusal dot is the one type colour in that family).

**The Absence Is Grey Rule.** Attendance reads: attended green, absent grey, make-up pink, forgotten amber. An absence is counted, never shown as danger. Red is kept for failure and for a seat beyond the planned six.

**The Dot Carries the Hue Rule.** Status colour sits in a 5–6px dot, a tinted ink and a tinted outline on a white chip; filled colour blocks are reserved for the primary button.

## Typography

**Web Font:** Euclid Circular A (400, 500, 600 woff from fonts.cdnfonts.com, declared in `apps/web/src/styles/app.css`; the files are not kept in the public repository), fallback ui-sans-serif, system-ui, -apple-system, Segoe UI.
**Phone Font:** the system font (San Francisco), sizes close to the iPhone's own text styles.

**Character:** A round geometric sans with even, friendly figures on the web; native type on the phone so it reads like an Apple app. One family per surface.

### Hierarchy
- **Page title** (600, 26px desktop / 22px phone web, 1.25, -0.02em): one per page, left-aligned in the page header.
- **Figure** (600, 26px / 22px, tabular): the large number in a FigureGrid cell.
- **Period** (600, 17px): the month or week heading of Calendar and Finance; first letter capitalised.
- **Card title** (600, 15.5px, -0.01em): card and section headings; description under it at 13.5px ink-3.
- **Body** (400, 14px, 1.45): names, rows, buttons. Summaries under titles stop at 65–72ch.
- **Meta** (400, 13px, ink-3): sub-lines under names, footers, periods.
- **Label** (500, 12.5px): marks and band text.
- **Phone**: title 25/30 600, section 21/25 600, headline and body 17/22, sub 15/20, foot 13/18, caption 12/16. Inputs are 16–17px so iOS never zooms.

### Named Rules
**The Tabular Figures Rule.** Every time, count, date number and amount is set in tabular figures.

**The Turkish Money Rule.** Amounts are typed and shown the Turkish way in every interface language (13.850 or 13.850,50 followed by ₺).

**The Sentence Case Rule.** Headings and labels are sentence case; a localised month or weekday heading capitalises only its first letter. No uppercase tracked labels.

## Layout

**Web shell.** From 1024px: a fixed white rail (256px, collapsible to 64px) with the logo, nav items and the account block, divided by hairlines; each page has a sticky 64px top bar with the rail toggle, crumbs (root › section › page), a 320px search pill with a shortcut key, and a round account button. Below 1024px the rail becomes a bottom tab bar (68px, white, hairline on top, filled blue icon when active) with a "More" sheet.

**Page frame.** Content is centred at 80rem (90rem for wide pages: Children, Finance) with 16 / 24 / 40px side padding and 36px top padding on desktop. The header holds the title, an optional one-line summary in ink-3, the page toolbar and one primary "New" pill at the far right. Cards stack with 24px gaps; side-by-side cards use weighted flex (7:5 on Today) or two-column grids.

**Patterns as used.**
- *Today*: an overview card with a FigureGrid of clickable figures; a lessons card with a pill-track tab (Today / Past, counts inside), each lesson as a grey band (time, type dot, title, age group, seat count, mark) and child rows (tile, name, package, share bar, attendance track); then a work card and a tomorrow card side by side.
- *Children*: a list card (search pill, filter chips, divided rows) in a 22–30rem column beside the detail column.
- *Finance*: period navigation, then balance and chart as two halves of one bordered box divided by a vertical hairline, then movements beside a column of smaller cards.
- *Settings*: from 1280px a sticky 168px section index beside a 46rem column of boxed sections.

**Phone app.** Native tabs (Today, Calendar, Children, Finance, More), native large titles, pages that scroll under them on the warm canvas. Screen padding 16px, 30px between sections, section heads 21px with a count at the right. Rows are at least 56px with 14 × 12px padding and 12px gaps. Today opens with a summary line and a sideways strip of blue promo pills for what waits.

**Breakpoints.** 640px (phone layout ends, inputs leave 16px), 768px (sheets move from the bottom to the right), 1024px (rail and top bar replace the tab bar; buttons drop from 44 to 38px), 1280px (settings index).

### Named Rules
**The One Container Rule.** The card is the panel's container. Groups inside a card are grey bands and hairline-divided rows, never a card inside a card.

**The Current Period Rule.** Calendar and Finance open on the current week or month; time-based data is shown as a calendar before a list.

## Elevation & Depth

The system is flat and line-built. Depth comes from 1px hairlines and the grey band step; resting cards carry no shadow. Only two shadows exist, plus the sticky phone header that gains a hairline once content scrolls under it.

### Shadow Vocabulary
- **Piece** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.08), 0 0 0 1px rgb(0 0 0 / 0.05)`): the selected piece of a pill track (segmented control, card tabs, attendance track). The phone uses a matching 1px / 0.08 native shadow.
- **Lift** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), 0 12px 32px -8px rgb(0 0 0 / 0.16)`): sheets, popovers, menus, confirm dialogs, toasts.

### Named Rules
**The Hairline First Rule.** If a line can separate it, a line separates it. Shadows mark only a chosen piece or a layer above the page; never a coloured glow.

## Shapes

Three silhouettes: pills for controls (buttons, chips, segmented tracks, search, marks, share bars), rounded squares for people (initials tiles at 10px radius web, 11px on the phone), and soft rectangles for containers (16px cards and popovers on the web, 18px cards on the phone, 20px sheet tops and dialogs). Fields and notices are 10px on the web and 14px on the phone; menu items and rail items 8px. Borders are 1px everywhere; dashed only for a seat given up or an empty placeholder.

### Named Rules
**The Pill and Square Rule.** Things you press are pills; people are squares; containers are soft rectangles. A round avatar appears only for the signed-in account.

## Components

### Buttons
- **Shape:** full pill, 38px tall on desktop and 44px below 1024px (sm 32px, lg 48px); the phone uses 50 / 44 / 34px pills.
- **Primary:** Deep Blue fill and border, white text, 16px padding; hover darkens 14% toward black; press scales to 0.98. One per area.
- **Secondary:** white with a hairline border, ink text; hover strengthens the border and turns band grey. On the phone this is the default button, outlined in #d3d0c8.
- **Ghost / Quiet / Danger:** ghost is ink-2 on transparent with hover grey; quiet is Blue Ink with a blue-wash hover; danger is a red fill, danger-soft red ink.
- **Focus:** 2px blue ring with 2px offset. Small buttons get a 44px touch area through an invisible extension.

### Chips and Marks
- **Filter chips:** 32px pills, white with hairline, ink-2; selected turns blue wash with Blue Line and Blue Ink; a count rides inside in tabular figures. On phones they scroll sideways in one row.
- **Mark (status):** an outlined chip with a dot: 24px pill, white fill, tone-coloured 1px line and ink, 6px dot, 12.5px medium text. Tones: action, positive, negative, accent, pink, neutral. The phone version is 22px with a tinted wash.

### Segmented controls and tabs
A grey well pill with 4px padding; options are 30px pills in ink-3; the chosen one is white with the Piece shadow. Card tabs carry counts (amber when something waits). The attendance track has Attended / Absent / Other ▾, the chosen piece showing a dot of its meaning; Other opens a menu (web) or the phone's action sheet.

### Cards / Containers
- **Card:** white, 1px hairline, 16px radius, clipped. Header 16–20px side padding, 18px top, 14px bottom, title plus optional one-line description and right-aligned controls. Body starts with a border-t and runs edge to edge. Footer is a border-t line of 13px ink-3 text with a **CardLink** at the right: ink-2 text underlined in the strong hairline, with a small caret.
- **Band:** a band-grey strip with a bottom hairline, 8px × 16–20px padding, 12.5px ink-3; used for column heads (sticky when needed) and group heads such as one lesson.
- **FigureGrid:** figures side by side, divided by 1px gaps over the line colour; each cell is a label, a large tabular number and a hint; clickable cells show a caret and hover band grey.
- **Section boxed:** a small card with a ruled header and padded body, for side columns and settings.
- **Phone card:** white, 1px #e6e4df, 18px radius; rows divided by #efede8 rules that start after the leading tile.

### Inputs / Fields
- **Web:** 40px (44px below 1024px), 10px radius, hairline border, white, a 1px 0.04 shadow; hover strengthens the border; focus turns the border blue with a 3px blue ring at 20%; invalid turns red.
- **Search pill:** 38–40px full pill on band grey with a magnifier; turns white on focus.
- **Phone:** 50px boxes, 14px radius, label above in 13px semibold ink-2; focus turns the border blue. Search is a 46px pill. Dates use the native inline calendar; amounts end in ₺; switches are native with a Deep Blue track and white knob.

### Navigation
- **Rail:** 36px items, 8px radius, 14.5px ink with an 18px Phosphor icon; active and hover are the hover grey, active text medium. No coloured active marker.
- **Web tab bar:** five places plus More, 11px medium labels, ink-3 at rest, ink with a filled Deep Blue icon when active.
- **Phone tabs:** the native tab bar with SF Symbols; Blue Ink when selected, ink-3 at rest, blue-wash indicator on Android.

### Sheets and overlays
Every task opens in a sheet: from the bottom on phones (92dvh max, 20px top radius, grab handle), from the right at 768px and up (30rem or 42rem wide, square, hairline on the left). Short confirmations use a 26rem dialog; menus and popovers are 16px-radius white panels with Lift.

### Signature pieces
- **Initials tile (Avatar / Peg):** a rounded square with one or two initials ("AD" for Ada Demir), band grey with ink-2 at rest. As a seat it is tinted by attendance: attended green wash, make-up pink wash, absent well grey, forgotten amber wash, postponed or cancelled dashed and struck through.
- **Seat board:** the children holding a seat as tiles, a thin rule, those who gave it up, then "4/6". A child past six gets a red outline and the count turns red.
- **Share bar:** a 6px pill track (#f0f0f0) filled blue by the share of lessons left; amber when it runs low; free packages show none.
- **Lesson-type dot:** 8px dot before a lesson name.
- **Promo pills (phone):** 46px blue-wash pieces (14px radius, so softly squared rather than fully round) with Blue Line and Blue Ink, an icon and a count ("3 payments due"), scrolling sideways at the top of Today; each jumps to its list.

## Do's and Don'ts

### Do:
- **Do** use the semantic roles from `apps/web/src/styles/app.css` and `apps/mobile/src/theme/colors.ts`, never the raw sky/pink/yellow ramps.
- **Do** build every new page from Page, Card (header / body / footer with CardLink), Band, FigureGrid and Section boxed.
- **Do** show status as a Mark (outlined chip with a dot) and people as square initials tiles.
- **Do** keep amber for "needs your action", grey for absence and red for failure or over-capacity only.
- **Do** keep every control a pill and give it a 44px touch area on touch screens.
- **Do** set numbers in tabular figures and amounts in Turkish format in all three languages.
- **Do** open every task in a sheet: from the right at 768px and up, from the bottom on phones.
- **Do** use the phone's own pieces (large titles, tab bar, switches, date picker, action sheets, haptics) instead of drawing them.
- **Do** keep motion between 150 and 320ms, ease-out-expo for arrivals, and honour reduced motion.

### Don't:
- **Don't** use gradients, gradient text or coloured glow shadows (the loading shimmer is the only gradient).
- **Don't** nest a card inside a card; group with bands and hairlines.
- **Don't** add side-stripe accents (a coloured left border on rows, cards or notices).
- **Don't** use emoji or text glyphs as icons; icons are Phosphor on the web and SF Symbols on the phone.
- **Don't** introduce a second accent hue or a second type family on a surface.
- **Don't** colour an absence red or fill a status chip with solid colour.
- **Don't** use uppercase tracked kickers or eyebrows above headings.
- **Don't** "fix" the approved patterns: outlined dot chips, pill buttons, square initials tiles, grey band heads, cards with header and footer, blue promo pills, lesson-type dots.
- **Don't** restyle the public calendar (`#/takvim`) from this file; it keeps its own look.
