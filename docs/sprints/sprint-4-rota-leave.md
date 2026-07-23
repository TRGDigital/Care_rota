# Sprint 4 — Rota Engine v2 & Leave

**Duration:** Weeks 7–8
**Spec sections:** 3.4 (statutory annual leave), 6.5 (leave/sickness schema), 9.3 (overtime allocation), 9.4 (reactive rebalancing), 10 (leave/sickness approval with live rota)
**Depends on:** Sprint 3

## Goal

Two big themes this sprint:

1. **The rota auto-generator** — the home opens a new period, clicks "Auto-fill", and gets a draft rota that respects every rule.
2. **The full leave and sickness flow** — staff request leave, manager approves with live rota context, sickness reports trigger one-click cover.

## What we're building

### 1. Rota auto-generator

Per Section 9.2 of the spec. A deliberately simple, explainable algorithm — not a black-box optimiser.

#### Algorithm

For each new period:

1. **Pre-fill fixed shifts** from `staff_fixed_shifts` (already done in Sprint 3; reuse).
2. **Iterate remaining shift slots in priority order**: nurses first, senior carers second, care assistants third, ancillary last.
3. For each slot:
   1. Filter candidates by role match
   2. Filter by `shift_pattern_preference` (day_only, night_only, any) — `fixed` staff are already pre-filled
   3. Remove anyone on approved leave overlapping the shift date
   4. Remove anyone on long-term sick (open `sickness_episodes` row covering the date)
   5. Remove anyone with expired hard-gate training (per the per-role applies_to list)
   6. Remove anyone with expired RTW
   7. Remove anyone whose existing period assignments would breach the 11-hour rest or 48-hour weekly average rule
   8. **Rank the remainder**:
      - Primary: staff whose period hours are below contracted, ascending (people under contracted hours get filled first)
      - Secondary: `overtime_weighting` descending (admin's preferred overtime recipients)
      - Tertiary: least-recent overtime allocation (tie-breaker to share evenly within a weighting band)
   9. Assign the top-ranked candidate
   10. If none qualify, leave slot open and flag

4. **Write a generation audit** — for each assignment, store the ranking comparison used. This powers the "why was Mary put on Tuesday night" question later.

#### UI

- "Auto-fill" button on a draft period
- Progress indicator showing slot-by-slot allocation
- Result view: every assignment shown, open slots highlighted in red, manager can adjust before publish

### 2. Overtime weighting per staff

In Sprint 2 we added the fields; now we expose the UI.

Settings → Staff → individual staff record → Overtime Weighting slider (0–100).

Per Section 9.3 of the spec. Tooltip: "Staff with higher weighting get offered overtime first. Set to 0 to never allocate overtime unless absolutely necessary; set to 100 to prefer this person above others."

Bulk-edit screen for setting weightings across the team in one go.

### 3. Statutory leave accrual — both unit conventions

Per Section 3.4 of the spec.

#### Fixed-hours staff

Already implemented in Sprint 2 — entitlement is `hours_per_week × 5.6` or `days_per_week × 5.6`, set at staff creation.

#### Irregular-hours / zero-hours / part-year staff

12.07% accrual per pay period. A worker on a zero-hours contract accumulates leave proportional to actual hours worked. On every pay run close (Sprint 6 — but we lay the infrastructure now), `leave_balances.accrued_value` increments by `hours_worked_in_period × 0.1207`.

For Sprint 4 we wire the accrual model into `staff_contracts.holiday_accrual_model` (fixed | 12_07_pct | enhanced) and write the accrual function in `packages/domain/src/leave/accrual.ts`. The function is exercised by Sprint 6's payroll close.

#### Bank holiday handling

The home setting `bank_holidays_included` (boolean) controls whether bank holidays are inside or outside the 5.6 weeks entitlement. Default: included. UI explains both options.

### 4. Leave request workflow

#### Staff side (mobile app + web portal)

A simple form:

- Type: Annual leave / Unpaid leave / Compassionate / Parental
- Start date
- End date
- Hours or days (auto-computed from the dates against the staff's working pattern, editable)
- Optional message

On submit:

- Validate against `leave_balances.balance_remaining`
- If exceeds, show "This request exceeds your remaining balance — submit anyway and manager will decide"
- Write `leave_requests` row with status `pending`
- Notify registered manager + deputy by email and in-app push

#### Manager side — the approval screen

Per Section 10.2 of the spec. Three panels:

##### Request panel (left)

- Staff name and role
- Dates and total value (hours or days, per home's unit)
- Type
- Balance summary: entitlement, taken, booked, **requested**, would-remain
- Staff member's message
- Their last 3 requests with outcomes

##### Rota context panel (middle)

- Calendar strip showing the requested dates
- For each date: who is rota'd (by role) and who is already off
- **Red banner** if approving would push dependency-based staffing below minimum
- **Amber banner** if approving would create a WTR issue for the covering staff
- **Green tick** if dates are well-covered already

##### Cover panel (right)

- Eligible staff for each affected shift, ranked by:
  - Not currently rota'd
  - Contracted hours remaining in the period
  - Overtime weighting
  - Recent overtime allocations
- One-click "Offer this shift to..." per candidate
- Option: "Leave shift open — auto-rebalancer will handle it"
- Option: "Mark for agency call-out"

Manager actions in one transaction:

- Approve + assign cover for each affected shift
- Approve + leave shifts open
- Approve with no rota impact (dates were outside published rota)
- Reject with reason

On approve:

- Update `leave_requests.status = approved`
- Update `leave_balances` (move requested from `pending` to `booked`)
- Update `leave_year_month_summary` for the affected months
- Release the affected shifts (set to open) or assign to cover staff
- Notify staff member by email and push
- Notify covering staff member if applicable
- If shifts left open, raise rebalance suggestion

### 5. Sickness reporting

Per Section 10.3 of the spec.

#### Reporting

- Staff: report sickness via mobile app — one tap "I'm off sick today"
- Manager: log on staff's behalf — admin portal → Staff record → "Report sickness"

Creates a `sickness_episodes` row with `first_day_of_sickness = today`.

#### Immediate effect

- Releases any shifts in the next 48 hours assigned to this staff member (set to open)
- Opens the same approval screen as for leave, pre-filtered to the released shifts
- Manager picks cover from the right-hand panel and dispatches
- Notifies covering staff

The whole sequence — report to dispatch — should take 60 seconds.

#### Returning to work

- Staff reports return via mobile, or manager logs it
- Updates `sickness_episodes.last_day_of_sickness`
- Computes qualifying days for SSP (4-day waiting period)
- Triggers a return-to-work meeting prompt to the manager
- If SSP applies, creates a `statutory_payment_records` row that flows into payroll in Sprint 6

### 6. Holiday calendar — year view

Per Section 10.4 of the spec. A read-mostly screen mirroring the reference holiday workbook structure:

- Rows: each staff member
- Columns: months Jan through Dec (12 columns)
- Cells: hours/days taken in that month (filled green), booked but not taken (faint blue), pending (yellow)
- Right-hand columns: Entitlement, Taken, Booked, Remaining, % Taken

This is the screen the manager opens for annual planning and year-end carry-over checks.

### 7. Reactive rebalancing — the suggestion worker

Per Section 9.4. A background worker raises `RebalanceSuggestion` rows on:

- Approved leave overlapping published shifts (this sprint)
- Sickness report on a day with published shifts (this sprint)
- Bed occupancy drop or rise > 5% within 14 days (Sprint 8 will wire the occupancy data; the rule is built here)
- No-show confirmed by manager (Sprint 5 wires no-show detection; the rule is built here)
- Training expiry that falls inside a published period (this sprint)

Each suggestion contains a proposed diff (shifts to change, who's removed, who's added, financial impact in pence, rules satisfied).

#### Manager UI

A "Suggestions" inbox on the rota board. Each suggestion shows:

- What triggered it
- The proposed change
- Cost impact (+£ or −£)
- One-tap "Approve" or "Edit before approving" or "Dismiss"

On approve: changes are applied, audit row written, notifications dispatched.

### 8. Open-shift visibility

A new lens on the rota board: "Open shifts in the next 14 days". The manager sees gaps at a glance and can:

- Click a gap → see eligible internal staff → offer
- Mark as "agency required"

This is the precursor to the agency cost pre-emption feature in v2.

## Acceptance tests

1. Run auto-fill on a new period — every fixed-shift staff member is pre-filled; remaining slots are filled per the ranking; staff under contracted hours are prioritised; the generation audit shows the ranking used.
2. Set staff A weighting to 80, staff B weighting to 20; auto-fill an overtime slot — staff A is selected.
3. Two staff with weighting 50 — auto-fill three overtime slots and verify they alternate (tie-breaker: least-recent allocation).
4. Submit a leave request that exceeds remaining balance — system warns but allows submission; manager sees the warning on the approval screen.
5. Approve a leave request that overlaps published shifts — affected shifts are released; covering staff option shown; pick one; both staff are notified.
6. Approve a leave request that would drop staffing below dependency minimum for one day — red banner on the approval screen.
7. Report a sickness for a staff member with a shift starting in 4 hours — shift is released; approval screen opens with cover candidates; assigning cover takes one click.
8. The holiday year-view calendar correctly shows taken vs booked vs pending across 12 months for all staff.
9. A staff member's safeguarding cert expires mid-period — a rebalance suggestion appears for any of their shifts after the expiry date.
10. A 12.07% accrual staff worked 30 hours this period — `leave_balances.accrued_value` increments by 3.62 hours.
11. After approving 5 leave requests across 5 staff, the rota board's "Open shifts in the next 14 days" lens shows the affected gaps in priority order.

## Out of scope

- Time-and-attendance / clock-in (Sprint 5)
- Payroll calculation (Sprint 6 — but accrual function is exercised by Sprint 6's pay run close)
- Occupancy-driven rebalancing (Sprint 8 — but the rule infrastructure is built now)
- Direct agency dispatch (v2)

## Definition of done

- Auto-generator produces sensible rotas in under 2 seconds for a 60-staff home
- Leave request lifecycle works end-to-end with live rota context
- Sickness reporting + one-click cover works
- Holiday year-view calendar shows correct data for all staff
- Reactive rebalancing produces suggestions for leave, sickness, training expiry
- All 11 acceptance tests pass
- Sprint demo: a manager opens a fresh period, auto-fills, approves three pending leave requests with one-click cover, reports one sickness, and ends with a fully covered rota — all in under 5 minutes
