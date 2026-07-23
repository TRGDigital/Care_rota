# Sprint 6 — Payroll Engine (Core)

**Duration:** Weeks 11–12
**Spec sections:** 3.5 (premium pay), 3.6 (NMW/NLW), 3.7 (SSP), 3.8 (pension), 6.6 (payroll schema), 8.1–8.6 (payroll engine)
**Depends on:** Sprint 5

## Goal

Turn the `shifts_payable` rows produced by Sprint 5 into approved payslips with line-by-line breakdown, ready for export. By the end of this sprint, a manager can close a pay period, review every payslip, override anomalies, and approve a pay run — but **not** yet export to CSV or share with an accountant (that's Sprint 7).

## What we're building

### 1. Pay cycle configuration

Per Section 8.2 of the spec. Settings → Payroll → Pay Cycle:

- Frequency: monthly / four-weekly / weekly
- Pay day rule:
  - Last calendar day of the month
  - Last Friday of the month
  - Last Thursday of the month
  - Fixed day of the month (e.g. 25th, with rollback to prior working day for weekends/bank holidays)
  - Fixed offset from period end (e.g. 5 working days after)
- Period start offset (e.g. period starts on the 1st, or on the day after the last pay day)

The pay cycle drives `pay_periods` row creation — a nightly job generates the next period automatically.

### 2. Pay period state machine

Per Section 8.7 of the spec:

| State | Editable? | Who can transition |
|---|---|---|
| `draft` | Yes — shifts, rates, allowances all open | Auto on period start |
| `in_review` | No — calculated, awaiting approval | Deputy or registered manager triggers |
| `approved` | No — payslips frozen | Registered manager or owner |
| `exported` | No | Set in Sprint 7 |
| `locked` | No | Auto after 90 days unless super admin re-opens |

Transitions are explicit user actions with confirmation prompts.

### 3. The calculation pipeline

Per Section 8.1 of the spec. Implemented in `packages/domain/src/payroll/calculate.ts` as a pure function:

```ts
function calculatePayrun(input: PayrunInput): PayrunResult
```

#### Step-by-step

1. Resolve period: `period_start`, `period_end`, `pay_day`, `weeks_in_period` (auto-derived from dates; admin override stored on the period if needed)
2. For each staff member:
   - Gather all `shifts_payable` rows with shift date in period
   - Apply premium multipliers (already on the shift row from Sprint 3)
   - Sum minutes per category: weekday, weekend, **bank_holiday**, **christmas**, night, training, holiday, sickness, sleep_in, disturbed_during_sleep_in
   - Process training attendances — see Step 4 below
3. Overtime allocation:
   - Threshold = `contracted_hours_per_week × weeks_in_period`
   - Subtract holiday and sickness minutes from working total before comparing
   - Default fill order: weekday hours first, then weekend, then bank_holiday, then christmas (configurable per home)
   - Excess flows into `gross_overtime_pence`
4. For each category, compute `gross_<category>_pence = minutes × rate_pence_per_minute × multiplier`
5. Sum to `gross_total_pence`
6. Add statutory payments (SSP — from `statutory_payment_records` overlapping the period; SMP/SPP/SAP/ShPP wired but only SSP fires in v1)
7. Pension contributions (qualifying earnings × employee % and × employer %)
8. PAYE tax — based on the staff member's tax code and cumulative position for the tax year
9. National Insurance — based on NI category and period earnings against the NI thresholds
10. Student loan if applicable
11. `net_pay_pence = gross_total + statutory − pension_employee − paye − ni_employee − student_loan`
12. Write the `payslips` row + per-line `payslip_lines` rows with source shift citations

#### Money handling

- All inputs and outputs in `bigint` pence
- No floats anywhere in the calculation
- Rounding rule: half-up to nearest pence at the line-item level (HMRC convention)

### 4. Training-vs-shift overlap rule

Per Section 8.5 of the spec — **critical**.

For each `staff_training_attendances` row with `attended = true` in the period:

1. Find any `shifts` rows for the staff member that overlap the training session time range
2. Compute `minutes_overlapping_shift` and `minutes_outside_shift_payable`
3. Update the attendance row's `paid_status`:
   - `no_top_up` if fully overlapping
   - `paid_top_up` if fully outside
   - Partial: split between the two
4. Add `minutes_outside_shift_payable` to `gross_training_pence` at the staff member's `rate_training_pence`

#### Edge cases

- If the staff member's shift was cancelled/released after the training was attended → recompute as if no shift
- If training spans midnight → split correctly across calendar days
- If multiple shifts overlap one training (rare) → use the union

### 5. Premium pay execution

Per Section 8.3 of the spec.

The shift carries `premium_multiplier` (set at publish time in Sprint 3). The payroll engine reads it from the shift, not from today's calendar value.

Worked example:

- Care assistant rate £12.71/hr weekday
- 12-hour Long Day on Christmas Day, with 60 min break = 11 paid hours
- `premium_multiplier = 2.0` (from when the shift was published)
- `gross_christmas_pence = 660 × (1271 / 60) × 2 = 27,962 pence = £279.62`
- Payslip line: "Christmas Day shift — 11.0 hrs @ £12.71 × 2.0 = £279.62" with source_shift_id cited

### 6. Effective-dated rate resolution

A shift on 28 March 2026 uses the rate effective on 28 March 2026. A shift on 5 April 2026 uses the rate effective 5 April 2026 (after the April uplift).

The `staff_pay_rates` table has `effective_from` and `effective_to`. The query that loads rates for a calculation:

```sql
SELECT * FROM staff_pay_rates
WHERE staff_id = $1
  AND effective_from <= $2
  AND (effective_to IS NULL OR effective_to >= $2)
ORDER BY effective_from DESC
LIMIT 1
```

### 7. NMW floor validation

Per Section 8.4 of the spec. Before any pay run is approved:

1. For each staff member, compute `effective_hourly_rate = total_gross_pence / total_worked_minutes × 60`
2. Compare against the applicable NMW/NLW floor for their age at the period end
3. If below, block the approval; show a remediation list

The block has a manager override path: **registered manager + owner co-sign** (per Section 4.2). The override requires an explicit justification (e.g. "accommodation offset applied" or "we're rectifying with back-pay in next period").

### 8. Pay run review screen

The headline UI of this sprint. Manager opens the in_review pay run and sees:

#### Summary panel (top)

- Period dates, pay day, weeks in period
- Total gross, total net, total employer cost (gross + NI employer + pension employer)
- Comparison to previous period (▲ £X, ▼ £Y)
- Count: payslips OK, payslips with warnings, payslips blocked

#### Payslips table

- One row per staff member
- Columns: name, role, gross, net, hours worked, overtime hours, status
- Filters: role, status (OK / warning / blocked), shows-overrides-applied
- Click row → opens the detailed payslip view

#### Payslip detail view

- Header: staff name, role, period, pay day
- Line-by-line breakdown with the `multiplier` column visible for premium-pay lines
- Each hours line cites the source shift IDs (clickable → opens the shift detail)
- Statutory payments section
- Deductions section
- Net pay highlighted
- "Override" actions:
  - Override calculation (registered manager + audit)
  - Mark as "do not pay this period" (e.g. paid in error in a prior run — recoverable in next)
  - Add a manual line (e.g. one-off bonus) — manager only, audit logged

### 9. Audit and override hooks

Every state transition writes an `audit_events` row.

Every payroll override writes a `rule_overrides` row with the appropriate `rule_code` (e.g. `nmw_floor_breach`, `manual_payslip_line_added`, `payslip_recalc_override`).

### 10. Pay slip PDF generation

A PDF generator (using `@react-pdf/renderer` or similar) produces a downloadable payslip per staff member. Staff portal shows their last 12 months' payslips for download (already wired in Sprint 1's portal shell — now actually populated).

PDF layout:

- Header: home name + address, pay period, pay day, staff name + NI number (last 4 digits only on the PDF, full version available securely in the portal)
- Hours section: hours worked by category, rate, multiplier, line total
- Statutory payments section
- Gross pay
- Deductions section (PAYE, NI, pension, student loan)
- Net pay
- Year-to-date totals
- Footer: contact for queries

### 11. Reference wage rate management

The `reference_wage_rates` table (seeded in Sprint 2) holds the NMW/NLW floors with effective dates. Settings → Payroll → Statutory Rates shows the current table; super admin can add a new row when the regulator announces a change (e.g. the April 2027 uplift).

## Acceptance tests

1. A staff member with 220 actual weekday minutes + 60 weekend minutes at £12.71/hr produces gross £58.93 weekday + £12.71 weekend = £71.64; payslip line items cite the source shifts.
2. A 12-hour Christmas Day shift at £12.71 with multiplier 2.0 produces a christmas line of £279.62 (11 paid hours after break).
3. A bank holiday shift on Boxing Day at multiplier 1.5 produces 1.5× the standard rate on that day.
4. Training overlap: staff attended a 2-hour training session 09:00–11:00 on a day they were rota'd 07:00–19:00 → `paid_status = no_top_up`, `gross_training_pence = 0`.
5. Training overlap: same staff attended the training on a day they had no rota → `paid_status = paid_top_up`, `gross_training_pence = 2 × rate_training_pence`.
6. Training overlap: staff was rota'd 13:00–19:00, training was 11:00–13:00 → `paid_status = partial`; only the non-overlapping minutes are paid.
7. Overtime threshold: staff on 40hr contract, period is 5 weeks (threshold 200hr), worked 210hr → 10hr at overtime rate.
8. Effective-dated rates: shift on 31 March uses old rate; shift on 1 April uses new rate; verified on a real April-uplift scenario.
9. NMW floor: an adult staff at effective rate £12.50/hr blocks approval; override with co-sign succeeds and writes `rule_overrides` row.
10. SSP: a staff member with 3 sickness days in the period (after 4-day waiting period) receives SSP £123.25/week pro-rated correctly.
11. Pay slip PDF generates with all line items, source citations visible (interactive in the portal, listed at the foot of the PDF).
12. Pay run state transitions: draft → in_review → approved each work; once approved, payslip values are frozen.
13. Multi-pay-run: a corrective second pay run for the same period adds supplementary lines without overwriting the original; both PDFs available in the staff portal.

## Out of scope

- CSV export (Sprint 7)
- Accountant portal (Sprint 7)
- Direct HMRC RTI filing (v3)
- Direct pension provider integration (v2)
- Year-end (P60) generation (Sprint 7)

## Definition of done

- Pay run calculation pipeline produces correct results for all the acceptance tests
- Premium multipliers applied correctly from shift records
- Training overlap rule produces correct top-ups
- NMW floor validation blocks approval with override path
- Pay run review screen, payslip detail view, and PDF generation all work
- All 13 acceptance tests pass
- Sprint demo: a manager closes a pay period for a 30-staff home; reviews payslips (one with a training top-up, one with a Christmas premium, one flagged by NMW); overrides the NMW case; approves the pay run — all in under 5 minutes
