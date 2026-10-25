# Product

<!-- impeccable:product-schema 1 -->

Provenance: written 2026-10-24 from the owner's own statements in working sessions (2026-08 to 2026-10-24) and from the repository. The owner asked not to be interviewed ("bana sorma, tüm kontrol sende"); facts marked *(inferred)* come from the code or data, not from the owner.

## Platform

web

The iPhone app (Expo, TestFlight only) is a separate surface that will share the same data and rules; it records its own platform when it is built.

## Users

- Two admins run HelloKido day to day, on an iPhone during the day and on a computer for planning. The staff work in the English interface. Later, staff accounts may join that must not see every screen (for example the money pages); for now everyone who logs in is an admin.
- Parents never log in. They only see the public lesson calendar (`/#/takvim`), opened from the Instagram bio on phones and embedded on hellokido.com.

## Product Purpose

The admin panel runs the workshop: the weekly lesson schedule, children's registrations and packages, how many lessons each child has left, attendance, payments, expenses, the waitlist and notes. Success means the daily entries take seconds and the numbers are right: what the panel says about money matches the cash box and the bank.

## Positioning

Built around this workshop's own rules, not a generic CRM *(inferred)*: lesson packages with carry-over of unused lessons and extra lessons, 3-month packages paid in two instalments, a schedule closed on Mondays, weekly themes that stay secret until their week.

## Operating Context

- Lessons are small groups by age (12-18 months up to 3+ years) and type (English, sensory, special). The screens show a class of 6; the database allows 10.
- Packages: 1 to 4 lessons a week for a month, 3-month packages (paid in one or two payments), a single trial lesson, and free participation.
- Card payments reach the bank about one month after the child pays; this is the main reason the panel and the bank disagree. Expenses are often entered days or weeks after they happen.
- Entries happen between lessons, often on a phone, often by whoever is free; data entry currently feels like a burden ("hepsi bir yük").
- The workshop is closed on Mondays.

## Capabilities and Constraints

- Supabase backend; every table is readable and writable only by admins (`is_admin()`); package and payment writes go through database functions; an audit log records every change to money and attendance tables.
- Hosted on GitHub Pages under `/hellokido/` with hash routes. The public calendar link `/#/takvim` must keep working, including broken-link repair and the iframe embed.
- No staging: production data must never be lost or silently changed; database changes are additive.
- Amounts are typed in Turkish format (13.850 or 13.850,50).
- Dashboard languages: Turkish, English and Ukrainian. English labels must fit dropdowns and chips. The public calendar stays Turkish only.
- Hard rules from the owner: Copy Week never copies weekly themes; the public calendar shows the weekly theme only for the current week.
- Undecided: reminder messages to parents (wanted later, not now); staff roles (later).

## Brand Commitments

- Name: HelloKido. Logo files: `src/assets/hellokido-logo.svg` and `hellokido-logo-dark.svg`. In a header or sidebar the logo stands alone, centred, generously sized, with no caption beside it.
- Brand colours come from the logo: sky blue is the primary accent, pink for small accents, yellow in reserve. No violet (not in the logo). No black fills.
- The owner wants a calm, native-feeling, professional interface and rejects anything that looks like generic AI output: no gradient icon chips, no gradient text, no glowing shadows, no nested cards, no emoji in place of icons, no uppercase tracked labels as decoration, no loud hero cards.

## Evidence on Hand

Real operating data (2026-10-24): 332 registrations (47 active), 1,500 lessons, 5,675 lesson places, 886 payments, 977 expenses. The public calendar's design (2026-08) was approved after several rounds and stays as it is.

## Product Principles

1. One source for every number; what the panel shows about money must match the cash box and the bank.
2. Daily entry in the fewest steps: today's date, the last used method and the most used categories come preset, nothing is typed twice.
3. Open on now: every view starts at the current day, week or month ("bulunduğumuz zamanı göstermesi her zaman daha iyi bir UX'tir").
4. Work that has the shape of a calendar is shown as a calendar ("takvim görünümü daha sağlıklı olur").
5. The past never changes silently: changes that touch closed periods, lesson usage or money warn first and leave a trace.

## Accessibility & Inclusion

Three languages including Cyrillic script and Turkish casing rules (İ/ı). Light and dark themes. Every screen must work at phone width (390 px) and with a keyboard on a computer.
