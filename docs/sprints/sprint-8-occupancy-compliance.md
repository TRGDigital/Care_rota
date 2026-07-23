# Sprint 8 — Dynamic Occupancy & Compliance

**Duration:** Weeks 15–16
**Spec sections:** 3.1 (CQC Reg 18), 4.4 (override review), 6.8 (dependency/occupancy schema), 9.5 (occupancy-aware cost guard), 14.1 (CareStream integration), 13.5 (owner dashboard)
**Depends on:** Sprint 4 (rebalancing infrastructure), Sprint 7 (payroll for cost calculations)

## Goal

Wire in the **occupancy-driven cost guard** — the headline feature that turns CareRota from "another rota tool" into "a system that saves money every month". Plus the compliance dashboards and the consolidated owner view.

## What we're building

### 1. CareStream integration — read-only occupancy and dependency

Per Section 14.1 of the spec. Two internal API endpoints (CareStream is in the same monorepo; we call its internal API directly):

#### GET /internal/occupancy

```json
{
  "home_id": "uuid",
  "snapshot_at": "2026-05-11T08:00:00Z",
  "occupied_beds": 38,
  "vacant_beds": 2,
  "bed_capacity": 40,
  "expected_admissions_next_7_days": 1,
  "expected_discharges_next_7_days": 0
}
```

#### GET /internal/dependency-totals

```json
{
  "home_id": "uuid",
  "as_at": "2026-05-11T08:00:00Z",
  "low": 8,
  "medium": 18,
  "high": 11,
  "one_to_one": 1
}
```

#### Snapshot ingestion

A nightly job (and triggered on-demand on admission/discharge events from CareStream's event bus) writes a `bed_occupancy_snapshots` row. This gives us:

- A historical trail of occupancy
- The basis for the occupancy-aware cost guard (compares current vs trend)

### 2. Dependency-based staffing matrix

Per Section 3.1 of the spec.

Settings → Staffing Matrix:

The manager configures, per shift block (day / twilight / night), the minimum staff required as a function of dependency totals. Example:

| Shift block | Dependency band threshold | Min carers | Min senior carers | Min nurses | Min ancillary |
|---|---|---|---|---|---|
| Day | low ≤ 10, medium ≤ 25, high ≤ 5 | 5 | 1 | 0 | 2 |
| Day | low ≤ 10, medium ≤ 25, high ≤ 10 | 6 | 1 | 0 | 2 |
| Day | medium ≤ 25, high ≤ 15 | 7 | 2 | 0 | 2 |
| Night | low ≤ 10, medium ≤ 25, high ≤ 5 | 3 | 1 | 0 | 0 |
| Night | medium ≤ 25, high ≤ 10 | 4 | 1 | 0 | 0 |
| ... | ... | ... | ... | ... | ... |

The matrix is the home's **justification** of staffing levels to a CQC inspector (Section 3.1 — the regulator looks for a dependency tool, not a fixed ratio).

The manager edits the matrix; every change is audit-logged.

### 3. The occupancy-aware cost guard

Per Section 9.5 of the spec — **this is the headline feature**.

A background worker runs every 4 hours and on every occupancy snapshot change:

1. Read current `bed_occupancy_snapshots` and current `dependency_assessments` for the home
2. Look up the relevant row(s) in `staffing_matrices` for each shift block over the next 14 days
3. For each upcoming shift, compute:
   - Required headcount (per the matrix, given current dependency)
   - Current rota'd headcount
   - Delta (positive = overstaffed, negative = understaffed)
4. If overstaffed for any shift, propose cuts:
   - Cuts ordered by: overtime shifts first (highest cost), lowest-weighting overtime recipients first, shifts that would leave the assigned staff member still at contracted hours
   - Compute cost saving in pence per proposed cut (uses the pay rate effective at the shift date)
5. Raise a `RebalanceSuggestion` (using the infrastructure built in Sprint 4) with the proposed change set and the total cost saving

#### UI

The manager sees the suggestion with a clear headline:

> **Bed occupancy dropped to 36/40 yesterday.**
> Your staffing matrix says you need 6 carers on the day shift, not 7.
> **Approve these 3 changes to save £642 this week.**
>
> ▸ Tue 14 May: Remove Sarah J from Long Day (overtime shift, saves £279)
> ▸ Wed 15 May: Remove Mark P from Long Day (overtime shift, saves £198)
> ▸ Thu 16 May: Remove Linda B from Twilight (overtime shift, saves £165)

One-tap approve or edit before approving. On approve, the affected staff are notified and the rota updates.

#### Conversely — occupancy rises

If occupancy rises and current staffing falls below matrix minimum, the suggestion is the inverse:

- Find candidate staff to add shifts to
- Compute additional cost
- Surface "Staffing gap detected — add these shifts to stay above CQC justification"

### 4. CQC Reg 18 justification audit

A new screen under Compliance: "Staffing Justification".

Shows, for any historical day or future date:

- The dependency snapshot
- The matrix row that applied
- The actual staffing for that day
- Any overrides used
- A printable PDF for CQC inspection

This is what the manager opens 10 minutes before the CQC inspector asks "how do you justify your staffing?"

### 5. Compliance dashboard

A single Compliance screen consolidating:

- **Training matrix** — heatmap of staff × training topic; expired = red, expiring 30 days = amber, valid = green
- **RTW expiry pipeline** — staff with documents expiring in the next 60 days, ordered by date
- **Sponsorship hours floor** — sponsored workers, their CoS minimum, their current week's rota hours, status (OK / at-risk / breach)
- **WTR breach log** — all WTR overrides in the last 90 days
- **Override Log** (from Sprint 1, now populated by real overrides) — filterable by rule type
- **Photo review queue** (from Sprint 5) — daily spot-check task

Each tile drills down to a detailed view. The compliance manager can produce a single PDF "Compliance pack" for the home's monthly governance meeting.

### 6. Override review workflow

Per Section 4.4 of the spec.

#### Weekly review by registered manager

A prompt in the manager's dashboard every Monday:

> You have 7 manager overrides from last week to review. [Review now]

Opens the Override Log filtered to the prior week. Manager clicks each override, reads the justification, ticks "Reviewed" (no comment required) or adds a comment. On submission, writes a `rule_override_reviews` row.

#### Monthly digest to owner

A monthly email to the owner summarising:

- Total overrides by rule type
- Top 5 overriding managers
- Repeat patterns (e.g. "WTR 11hr rest overridden 12 times — consider a rota review")

#### CareAssura ingestion

The Override Log emits events that CareAssura subscribes to (via the shared event bus). CareAssura's compliance pack automatically includes the override summary.

### 7. Owner consolidated dashboard

Per Section 13.5 of the spec. The owner's landing page when they log in. Tiles:

- **Total payroll cost MTD by home** — bar chart, current vs same period last month
- **Cost per occupied bed by home** — trend line, last 6 months
- **Overtime as % of payroll, by home** — bar chart
- **Agency spend MTD, by home** — bar chart (data populated as homes log agency call-outs; v2 will integrate agency portals)
- **Open shifts in next 7 days, by home** — count + click-through
- **Training expiring in next 30 days, by home** — count + click-through
- **Manager overrides in last 30 days, by home and rule type** — heatmap
- **Outstanding leave requests, by home** — count + click-through
- **Savings to date** (Section 18.3) — running total of cost reductions from approved rebalance suggestions; this is the ROI tile

Each tile clicks through to the home-level view.

### 8. Savings tracking — the "savings to date" tile

A `cost_savings_log` table (new, but small):

```
cost_savings_log
├── id
├── home_id
├── source ('occupancy_rebalance' | 'no_show_no_pay' | 'training_overlap' | 'planned_vs_actual')
├── savings_pence
├── related_entity_type
├── related_entity_id
├── recorded_at
└── created_at
```

Every approved rebalance suggestion that produces a saving writes a row. The reconciliation worker (Sprint 5) writes a row when a no-show produces zero pay where the rota would have paid. The payroll engine (Sprint 6) writes a row when pay-actual is less than pay-planned for any shift.

The owner dashboard shows the running total: "CareRota has saved this group £X this month, £Y this year." This is the renewal-and-referral number.

## Acceptance tests

1. CareStream emits a discharge event; within 5 minutes a new `bed_occupancy_snapshots` row exists and the occupancy-aware cost guard worker runs.
2. Occupancy drops from 38 to 35; matrix says day shift needs 6 carers not 7; a RebalanceSuggestion is raised proposing the removal of the lowest-weighting overtime shifts with total savings shown in pence.
3. Manager approves the suggestion; affected staff are notified; their shifts move to `cancelled` state; a `cost_savings_log` row is written; the owner dashboard "Savings to date" tile increments.
4. Occupancy rises from 35 to 39; matrix says day shift needs 7 not 6; a suggestion is raised proposing additional shifts.
5. The Staffing Justification screen shows a printable PDF for an arbitrary historical date with dependency + matrix + actual staffing.
6. The Compliance dashboard shows a heatmap of all staff × all training topics; clicking an expired cell opens the staff record's Training tab.
7. The Monday morning review prompt appears for the registered manager; clicking it opens the Override Log filtered to last week; completing the review writes a `rule_override_reviews` row.
8. The monthly owner digest email lists all override types with counts and identifies repeat patterns.
9. The owner dashboard shows all required tiles; clicking the "Cost per occupied bed" tile drills to a per-home trend chart.
10. The "Savings to date" tile correctly aggregates the four sources (occupancy rebalances, no-shows, training overlaps, planned-vs-actual gaps) over a month with mixed test data.
11. CareAssura's event subscriber receives an override event within 30 seconds of the override being recorded.

## Out of scope

- Agency portal integration (v2)
- Predictive occupancy forecasting beyond CareStream's known admissions (v2)
- Multi-home rota optimisation across an organisation (v2)
- Direct facial recognition matching (v2)

## Definition of done

- Occupancy-aware cost guard produces correct suggestions in test scenarios
- Approved suggestions reduce the rota and increment the savings tile
- Compliance dashboard shows accurate data for training, RTW, sponsorship, WTR overrides
- Override review workflow active for registered managers
- Owner dashboard renders fully for a multi-home org
- All 11 acceptance tests pass
- Sprint demo: an occupancy drop is simulated; the cost guard suggests cuts; the manager approves; the savings tile increments on the owner dashboard within 10 seconds
