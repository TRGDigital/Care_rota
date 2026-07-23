# Sprint 3 — Rota Engine v1

**Duration:** Weeks 5–6
**Spec sections:** 3.3 (WTR), 3.9 (sponsorship), 3.10 (training gating), 4 (override pattern), 6.3 (rota schema), 9.1–9.2 (rota engine)
**Depends on:** Sprint 2

## Goal

Build the manual rota — drag-to-assign on a weekly grid — with all hard rules enforced **and** override paths in place. This is the first sprint where managers can actually publish a rota. The auto-generator and reactive rebalancing come in Sprint 4.

## What we're building

### 1. Rota period management

`rota_periods` rows representing a configurable window (default: one week, but the home can configure period length and the day of the week the rota starts).

Settings → Rota:

- Rota period length (1 / 2 / 4 weeks)
- Start day (Mon / Sun / other)
- Default rota status workflow (draft → published → locked)

UI:

- Periods list with status badges
- "Create next period" button — generates the period record and empty shift slots based on the home's standard pattern (filled in next sprint by the auto-generator; for now, an empty grid)

### 2. Shift slots — the "what the home needs"

Per `shift_slots` (Section 6.3). The home defines its standard daily shift requirements once:

| Day | Shift pattern | Role | Headcount required |
|---|---|---|---|
| Mon | Long Day | Care Assistant | 4 |
| Mon | Long Day | Senior Care | 1 |
| Mon | Long Night | Care Assistant | 2 |
| ... | ... | ... | ... |

For each new rota period, this template generates the shift_slots. The manager can adjust per period.

### 3. Manual rota builder — drag-to-assign

The headline screen of this sprint. A grid:

- Columns: each day in the period (e.g. 7 columns for a one-week period)
- Rows: grouped by role (Managers, Admin, Senior Care, Care Assistants, Nurses, Cleaners, Cooks, Night Staff)
- Cells: each is a shift slot that needs filling

To assign a staff member:

- Click a slot → opens a side panel with eligible staff (filtered by role, availability, contract, training, RTW)
- Or drag a staff name from the left-hand staff palette onto a slot
- Or open a staff member and shift-click their preferred day to assign

To unassign:

- Click an assigned shift → click "Remove staff"

### 4. Hard rule enforcement at assignment time

Every assignment runs through the **shift eligibility check** which evaluates all hard rules and returns either `eligible` or `blocked_with_override_path`.

Hard rules enforced in this sprint:

| Rule | What it checks | Override path |
|---|---|---|
| `wtr_11hr_rest` | Would this assignment leave less than 11 hours between this shift and any adjacent shift for this staff member? | Registered manager or deputy |
| `wtr_48hr_weekly` | Would this assignment push the staff member's 17-week rolling average above 48 hours? | Registered manager only |
| `training_expired_safeguarding` | Is the staff member's safeguarding cert valid on this shift date? | Registered manager only |
| `training_expired_moving_handling` | Same for M&H | Registered manager only |
| `training_expired_medication` | Same for medication, when slot role is senior_care or nurse | Registered manager only |
| `training_expired_bls` | Same for basic life support | Registered manager only |
| `rtw_expired` | Is the staff member's right to work valid on this shift date? | Registered manager + owner co-sign within 24h |
| `sponsorship_hours_floor` | After this assignment, would the staff member's total hours for the week be below their CoS minimum? | Registered manager only |
| `contract_inactive` | Does the staff member have an active contract covering this shift date? | **No override** — absolute |
| `staff_pattern_preference` | Does the assignment match the staff member's day_only / night_only / fixed preference? | Soft warn only — any manager can confirm |

When blocked, the UI shows the override modal (already built in Sprint 1). On confirmed override, the assignment proceeds and writes a `rule_overrides` row.

### 5. Nursing home RN cover check

When the home is registered as Nursing or Dual, on rota publication (not assignment) the system checks that every shift block in every 24-hour period has at least one registered nurse assigned. If a gap exists, the publish is blocked. Override path: registered manager only, with a 4-hour escalation to owner if the gap exceeds 4 hours.

### 6. Shift publication

Two states:

- **Draft** — editable, no notifications sent, staff don't see it on their portal
- **Published** — frozen except via explicit edits, staff receive notifications, available on the staff app

Publishing runs a final pass of all hard rules across the whole period — any unresolved blocks must be either fixed or overridden before publish can proceed.

### 7. Staff fixed-shift pre-fill

For staff with `shift_pattern_preference = 'fixed'` and rows in `staff_fixed_shifts`, when a new rota period is created the system pre-fills those slots automatically (still in draft, manager can override).

This is the first piece of "automation" — the auto-generator proper comes in Sprint 4.

### 8. Historical rota import — deterministic parser

Per Section 9.7 of the spec. The home can upload prior rotas as Excel or PDF. A parser extracts the staff-by-day grid into a read-only `rota_history` table. No LLM is involved — column mapping is done by the user via a confirmation UI.

For v1 of the import, support:

- The reference workbook format we already understand from the spec (Section 2.1)
- A generic CSV with columns: Staff Name, Date, Start Time, End Time
- A "I don't know" fallback that lets the user manually map columns

Imported rotas appear in the rota builder as a faint background hint (e.g. "Mary worked Mon/Tue/Wed Long Days for the last 8 weeks") which the manager can use to inform fixed-shift setup.

### 9. Shift display vs paid hours

When a shift is published, both values are stored on the `shifts` row:

- `planned_start_utc` and `planned_end_utc` — the display time range
- `planned_paid_hours` — derived from the shift_pattern_template (or manually set)
- `planned_break_minutes` — also from the template
- `is_bank_holiday` and `is_christmas_period` — computed from `premium_pay_calendar` at publish time
- `premium_multiplier` — looked up from the calendar at publish time, frozen on the shift

Per Section 7.3 of the spec: the multiplier is stored on the shift at publish time. If the admin changes the calendar later, already-published shifts keep their original multiplier. New shifts pick up the new value.

### 10. Staff portal — view-only rota

A minimal staff portal screen: "My Rota" showing the next 4 weeks of the staff member's published shifts. Mobile-responsive. No editing, no clock-in yet (Sprint 5).

## Acceptance tests

1. Create a new rota period; shift slots auto-generate from the home's daily template.
2. A staff member with a fixed-shift preference for Mon Long Day has their Mon slot pre-filled when the period is created.
3. Try to assign a staff member to back-to-back shifts with 9 hours between them — `wtr_11hr_rest` blocks the assignment; override modal appears; on confirmed override the assignment proceeds and a `rule_overrides` row is written.
4. Try to assign a staff member with expired safeguarding to a care assistant shift — blocks with `training_expired_safeguarding`.
5. Try to assign a sponsored worker (38 hr CoS minimum) such that their week total would be 35 hours — blocks with `sponsorship_hours_floor`.
6. Try to publish a Nursing home rota with a Saturday night that has no RN — blocks with `nursing_rn_cover_gap`.
7. Override the WTR 11-hour rest with a valid justification — `rule_overrides` row appears in the Override Log with the correct rule_code, reason_category, justification, MFA method.
8. Assign a staff member to a Christmas Day Long Day shift — the shift record carries `is_christmas_period = true` and `premium_multiplier = 2.0`.
9. Edit the Christmas multiplier in the calendar from 2.0 to 1.75 — the already-assigned Christmas Day shift still shows 2.0; a newly assigned shift on the next Christmas Day picks up 1.75.
10. Upload a historical rota in the reference workbook format; the imported data appears as background hints in the rota builder.
11. Publish a draft rota with all rules satisfied — state transitions to `published`; staff members receive a notification; their portal shows the shifts.

## Out of scope

- The auto-generator (Sprint 4)
- Holiday request workflow (Sprint 4)
- Sickness reporting (Sprint 4)
- Reactive rebalancing (Sprint 4)
- Clock-in / T&A (Sprint 5)
- Payroll calculation (Sprint 6)

## Definition of done

- Manual rota builder fully functional with drag-to-assign
- All 10 hard rules enforced with override paths
- Nursing home RN cover check enforced at publish
- Historical rota import works for the reference workbook format and generic CSV
- Staff portal shows their published rota
- All 11 acceptance tests pass
- Sprint demo: a manager builds a full week's rota for a 25-bed home, triggers and overrides a WTR conflict, triggers and resolves a training-expired block (by extending the cert), and publishes the rota — all in under 10 minutes
