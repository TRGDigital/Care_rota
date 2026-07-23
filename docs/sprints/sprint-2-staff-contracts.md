# Sprint 2 — Staff & Contracts

**Duration:** Weeks 3–4
**Spec sections:** 3.5 (premium pay), 3.9 (RTW/sponsorship), 3.10 (training matrix), 6.2 (staff schema), 7 (shift patterns)
**Depends on:** Sprint 1

## Goal

Make the system useful for HR. By the end of this sprint, an HR user can add staff, manage their contracts and rates, upload right-to-work documents, record training certificates, and the home admin has set up the shift pattern library and premium pay calendar that the rota engine will depend on next sprint.

## What we're building

### 1. Staff CRUD

Create, read, update, soft-delete (mark as leaver) for staff records.

Screens:

- **Staff directory** — table with filters (role, status, expiring documents within 30/60/90 days, expiring training)
- **Staff record detail** — tabs: Personal | Contracts | Pay Rates | Documents | Training | Leave Balance | Sponsorship | Shift History
- **Add staff** — wizard flow: personal details → first contract → first pay rate → required documents

Staff record fields per `staff` table (Section 6.2 of the spec).

### 2. Contracts with effective-dating and shift preferences

A staff member can have multiple `staff_contracts` rows, each with `effective_from` and `effective_to`. The system always uses the contract row whose date range contains the shift/payroll date in question.

Contract editor includes:

- Contract type (permanent / fixed_term / zero_hours / bank / apprentice)
- Contracted hours per week
- Contracted days per week
- **Holiday unit override** (nullable; if set, overrides the home-level setting for this staff member)
- **Holiday entitlement value** (in the applicable unit — days OR hours)
- **Shift pattern preference**: `day_only` / `night_only` / `fixed` / `any`
- Sick pay scheme
- Effective-from / effective-to dates

When the preference is `fixed`, a sub-form lets HR add `staff_fixed_shifts` rows: day-of-week × shift_pattern_template. These get pre-filled by the rota engine in Sprint 3.

### 3. Pay rates with effective-dating

`staff_pay_rates` rows with:

- Rate weekday (pence)
- Rate weekend (pence)
- Rate night (pence)
- Rate overtime (pence)
- Rate sleep-in flat (pence)
- **Rate training (pence)** — defaults to rate_weekday on creation
- Effective-from / effective-to

UI shows the current effective rate prominently; full history accessible via "Show rate history".

#### NMW floor warning

On save of a pay rate row, the system checks the rate against the applicable NMW/NLW floor for the staff member's age at the effective_from date. If below the floor, HR sees a blocking warning ("This rate is below the £12.71 floor effective 1 Apr 2026. Are you sure?") with manager override path per Section 4 — for rates explicitly agreed below the floor for reasons like accommodation offset.

#### Reference rate table

Seed `reference_wage_rates` with the 2026 values from Section 3.6 of the spec. Make the seed file the authoritative source so future rate changes are one PR.

### 4. Documents and expiry tracking

Per Section 3.9. Document types in v1:

- Right to Work — Passport / BRP / eVisa share code
- DBS certificate
- NMC PIN (for nurses)
- Driving licence (optional, for staff who drive residents)

Each document has issue_date, expiry_date, file upload to S3, verified-by-user and verified-at.

Background worker: nightly job that checks expiry windows and writes notifications:

- 60 days out: amber flag on staff record + dashboard tile
- 30 days out: email to registered manager
- 7 days out: email to registered manager + owner + the staff member
- Expired: red flag; the rota engine in Sprint 3 will refuse new assignments

### 5. Sponsorship records

For staff on Health and Care Worker visas. Fields per `staff_sponsorship` (Section 6.2):

- CoS reference
- Sponsor licence number
- Route (skilled_worker / health_care_worker)
- **Minimum hours per week** — the floor enforced by Rota Sprint 3
- CoS start and end dates

Same expiry warning cadence as documents (60/30/7 days).

### 6. Training topics and certificates

#### Training topics — per home (or org-wide)

A managed library in Settings → Training Matrix. The home configures the topics it tracks. Defaults seeded per Section 3.10 of the spec:

- Safeguarding adults (renewal: 12 months, enforcement: hard_gate)
- Moving and handling (renewal: 12 months, enforcement: hard_gate)
- Fire safety (renewal: 12 months, enforcement: hard_gate)
- Basic life support (renewal: 12 months, enforcement: hard_gate)
- Food hygiene Level 2 (renewal: 36 months, enforcement: soft_warn, applies_to: kitchen + carers)
- Medication administration (renewal: 12 months, enforcement: hard_gate, applies_to: senior_care + nurse)
- Infection prevention & control (renewal: 12 months, enforcement: hard_gate)
- Mental Capacity Act / DoLS (renewal: 24 months, enforcement: soft_warn)
- Equality & diversity (renewal: 36 months, enforcement: soft_warn)
- GDPR / data protection (renewal: 24 months, enforcement: soft_warn)

Per topic: renewal interval, enforcement mode (hard_gate / soft_warn), applies_to role codes.

#### Certificates per staff

`staff_training_certs` rows. UI allows uploading a certificate, recording issue date, computing expiry date from the topic's renewal interval. Old rows retained for audit (never deleted, just superseded).

### 7. Shift pattern templates library — **set up by admin once**

Per Section 7 of the spec. Settings → Shift Patterns:

| Field | Purpose |
|---|---|
| Name | "Long Day", "Long Night", "Short Day", "Twilight", "Sleep-In", or custom |
| Default start time (local) | e.g. 07:00 |
| Default end time (local) | e.g. 19:00 |
| Break minutes | e.g. 60 |
| Paid hours decimal | Auto-computed from end-start-break (in hours), editable |
| Length type | `long_day_12h` / `short_half_6h` / `sleep_in` / `custom` |
| Is night shift | Boolean — determines whether `rate_night` applies |
| Is sleep-in | Boolean — uses flat rate instead of hourly |

Sane defaults seeded for new homes but every value editable.

### 8. Premium pay calendar — **set up by admin once, refreshed annually**

Per Section 3.5 of the spec. Settings → Premium Pay Calendar:

- Bank holiday auto-load — when the admin sets `homes.bank_holiday_region` (eng_wales / scotland / ni), the system populates `premium_pay_calendar` with that region's bank holidays for the current and next year, each at the default 1.5× multiplier.
- Christmas dates — Christmas Day, Boxing Day, New Year's Day default to 2.0×.
- Admin can:
  - Edit the multiplier on any auto-loaded date
  - Delete an auto-loaded date if the home doesn't pay premium on it
  - Add custom dates (e.g. religious observances) with their own multiplier

The screen also shows the impact: "Bank holidays in the next 12 months: 8 dates. Expected premium pay cost based on last year's rota: £X."

### 9. Holiday balances initial setup

When a staff member is created, the system creates a `leave_balances` row for the current leave year with:

- `allocation_unit` resolved from contract override or home default
- `entitlement_value` computed from contract:
  - If days: `contracted_days_per_week × 5.6`, capped at 28 for statutory
  - If hours: `contracted_hours_per_week × 5.6`
  - Pro-rated if the staff member started mid-year

The reference holiday workbook's structure (hours-based with pro-rating for joiners) confirms this is the right behaviour.

## Acceptance tests

1. Create a staff member with a permanent 40-hour contract; system auto-creates a leave_balance with 224 hours entitlement.
2. Create a staff member starting in month 6 with a 30-hour contract; system pro-rates entitlement (84 hours, not 168).
3. Set a pay rate of £10.00 weekday for an adult; system shows NMW floor warning with override path.
4. Upload a Right to Work document with expiry in 25 days; staff record shows amber flag; an email is queued to the registered manager.
5. Add a sponsored worker with min hours 38; record is created and visible on the staff record's Sponsorship tab.
6. Add a training certificate for safeguarding with issue date 11 months ago; staff record shows the cert is valid; on month 13 the cert shows as expired.
7. Configure a "Long Day" shift pattern: 07:00–19:00, 60 min break, paid hours auto-computes to 11.0.
8. Set the home's bank holiday region to England & Wales; premium_pay_calendar auto-populates with 8 bank holidays at 1.5× plus Christmas Day, Boxing Day, NYD at 2.0×.
9. Edit Boxing Day to 1.5×; the change is saved and only affects new shifts published from that point on (this assertion is tested fully in Sprint 6; here we just verify the calendar saves correctly).
10. Try to change the home's holiday allocation unit after creating one leave_request — system blocks it with the admin-support message from Sprint 1.

## Out of scope

- The rota itself (Sprint 3)
- Clock-in / T&A (Sprint 5)
- Holiday request workflow (Sprint 4)
- Payroll calculation (Sprint 6)
- Multi-tenant accountant access (Sprint 7)
- Resident dependency data (Sprint 8)

## Definition of done

- Staff directory and detail screens fully functional
- Contracts, pay rates, documents, training, sponsorship all CRUDable
- Shift pattern library set up with 5 default patterns + custom
- Premium pay calendar populated for the home's region
- All 10 acceptance tests pass
- Sprint demo: HR creates a new sponsored worker, uploads RTW + DBS + safeguarding cert, sets a custom pay rate (with NMW override), configures a fixed shift preference for Mon/Wed/Fri Long Days — all in under 5 minutes
