---
version: 1
slug: "apps-web-src-admin-adminapp-tsx"
primary_target: "apps/web/src/admin/AdminApp.tsx"
related_targets: ["apps/web/src/styles/app.css"]
---

Scope: the whole HelloKido admin panel (Today, Calendar, Children, Finance, Waitlist, Notes, Settings, sign-in). Mode: Operate. The public calendar (/#/takvim) is out of scope and keeps its look.

Audience and job: two admins of a small Istanbul kids' workshop, daily, mostly on a phone between lessons, desktop for bookkeeping. They plan the week, take attendance, register and renew children, and record money. Money is entered late and card payments reach the bank about 30 days later, so the panel must show what is still on its way.

Constraints: TR, EN and UK interface; amounts always in Turkish format; light by default with dark available; no data loss; same rules as the database functions.

## Direction contract

THESIS: The day's work reads like Montessori sensorial material: a child's package is a bead string counted at a glance, a lesson is a six-socket board filled with pegs. It refuses the stat-card dashboard and the long status-pill table.

OWN-WORLD: Near-white cool ground, white surfaces, a sky-tinted rail; Rubik with tabular figures. Sky is the single accent, yellow means only "needs your action", pink is a small accent, green is settled, red is danger. Age groups are graded colour tablets from light to deep sky. Beads: used, scheduled, remaining, carried, extra, no-show. Sheets instead of modals; alignment instead of boxes; nothing labelled twice.

STORY: The admin opens the panel and knows what runs today, who must pay or renew, and which card money is still coming; a payment or expense is recorded in seconds from anywhere.

FIRST VIEWPORT: Today. Rail with the centred logo on desktop, bottom tab bar on phones. Date line and one-sentence summary; an action strip only when something needs action; today's lessons as fixed-column time rows, each with its age tablet and six-socket board; quick add top right (floating on phones). Signature interaction: tap a peg, mark attended or no-show, the peg fills and the child's bead string advances. Motion 150-250 ms ease-out; sheets slide from the right on desktop, from the bottom on phones.

FORM: Operate product shell (rail, work column, sheets), position 4 on the ordered list, seed key eda8a8c1.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Unresolved: staff roles with limited screens (later); automated reminder messages (later).
