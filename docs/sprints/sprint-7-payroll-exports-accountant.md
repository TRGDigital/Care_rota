# Sprint 7 — Payroll Exports & Accountant Portal

**Duration:** Weeks 13–14
**Spec sections:** 8.7 (CSV exports), 8.8 (accountant portal), 15.3 (UK GDPR), 15.4 (audit)
**Depends on:** Sprint 6

## Goal

Two themes:

1. **CSV export adapters** for the major UK payroll software (Tier 1 from the spec)
2. **Accountant portal** — read-only access for the home's accountant (Tier 2, brought forward into v1)

By the end of this sprint, the home's accountant can log in directly, see every approved pay run, download exports in their preferred format, comment on lines, and mark the run as filed.

## What we're building

### 1. CSV export adapters

Per Section 8.7 of the spec. Each adapter is a pure function in `packages/domain/src/payroll/exports/`:

```ts
function exportBrightPay(payRun: PayRun): CsvFile
function exportSage(payRun: PayRun): CsvFile
function exportXero(payRun: PayRun): CsvFile
function exportMoneysoft(payRun: PayRun): CsvFile
function exportIris(payRun: PayRun): CsvFile
function exportGeneric(payRun: PayRun): CsvFile
```

Each maps the canonical `payslips` + `payslip_lines` rows into the destination's column layout. Test against real CSV import templates from each vendor (samples held in `apps/api/test/fixtures/exports/`).

#### Adapter spec — generic

A wide-column CSV with every field. Used by accountants on other systems. Columns:

```
employee_number, first_name, last_name, ni_number, tax_code, ni_category,
period_start, period_end, pay_day, weeks_in_period,
hours_weekday, rate_weekday, gross_weekday,
hours_weekend, rate_weekend, gross_weekend,
hours_bank_holiday, rate_bank_holiday, multiplier_bank_holiday, gross_bank_holiday,
hours_christmas, rate_christmas, multiplier_christmas, gross_christmas,
hours_night, rate_night, gross_night,
hours_overtime, rate_overtime, gross_overtime,
hours_training, rate_training, gross_training,
hours_holiday, rate_holiday, gross_holiday,
hours_sickness, ssp_amount, contractual_sick_amount,
hours_sleep_in, sleep_in_flat_rate, hours_disturbed, gross_sleep_in_total,
gross_total,
pension_employee, pension_employer,
paye_tax, ni_employee, ni_employer, student_loan,
net_pay
```

#### Adapter spec — BrightPay / Sage / Xero / Moneysoft / IRIS

Each maps to the destination's import template (gathered from each vendor's published documentation). Tests verify a roundtrip: export a known pay run, parse the CSV back, verify field-by-field match.

#### Multi-format export

The export screen lets the user pick the format. Selected format is remembered per home (`pay_cycles.preferred_export_format`). One-click export afterwards.

#### Export audit

Every download writes a `payroll_exports` row with:

- `pay_run_id`
- `format`
- `file_url` (S3 — file is kept indefinitely for audit)
- `generated_at`
- `generated_by_user_id`

The same file URL is returned for re-download — no regeneration, so the bytes are deterministic.

### 2. Pay run state — exported transition

When a pay run is approved (Sprint 6) and the first CSV is downloaded, the state moves to `exported`. Further downloads of the same pay run still produce the same file URL. Re-export in a different format also keeps the state as `exported`.

To make corrections after `exported`, the manager creates a supplementary pay run (Sprint 6 already supported this concept).

### 3. Accountant portal — invitation

Per Section 8.8 of the spec. Settings → Payroll → Accountant Access:

- Owner or registered manager clicks "Invite accountant"
- Form: name, email, firm name, scope (this home only / all homes in org)
- System creates a `accountant_invitations` row with a one-time-use token
- Email sent: "You've been invited to access payroll for [Home Name]. Click to set up your account."

#### Acceptance flow

- Accountant clicks the link
- Sets a password (with strength requirements)
- Configures MFA (TOTP via Authy/Google Authenticator; WebAuthn if available)
- Lands on the accountant dashboard

#### Revocation

- Owner or registered manager can revoke access at any time
- Revocation is immediate (active sessions terminated)
- `accountant_invitations.revoked_at` is set
- An audit event is written
- An email confirms the revocation to the accountant

### 4. Accountant dashboard

A dedicated landing page (different from the home's admin portal) showing:

- The homes the accountant has access to
- For each home:
  - Latest pay run with status and pay day
  - Quick links: Open pay run | Download latest CSV | Year-end summary
  - Number of pay runs awaiting their attention (those approved but not yet marked as filed)

### 5. What the accountant CAN do

Per Section 8.8.1 of the spec:

- See the list of pay runs for the home (current and historical)
- Open any pay run and see the payslip-by-payslip breakdown
- See the line-by-line decomposition with source shift citations (the citation chips work the same way as in the admin portal)
- Download any CSV export in any supported format
- Comment on a payslip line or pay run (see below)
- Mark a pay run as "filed with HMRC" (sets a new field `pay_runs.marked_filed_at` and `marked_filed_by_user_id`)
- Download a year-end summary for any tax year (see below)

### 6. What the accountant CANNOT do

Per Section 8.8.2:

- Modify any rate, contract, or staff record
- Approve a pay run
- See the rota, T&A, leave requests, or any non-payroll data
- See any other home not in their scope
- Access the system outside the home's configured "accountant access hours" (default 24/7; the owner can restrict to weekday business hours)

All these are enforced by:

1. The `accountant_readonly` role's RLS policies on every non-payroll table
2. API route guards on every mutation endpoint
3. UI navigation simply hides what they can't see

### 7. Accountant comments

A new feature usable from the payslip detail screen. The accountant can:

- Click any line item and add a comment ("This overtime line — was this an approved exception?")
- Add a comment on the whole pay run ("HMRC RTI submitted on [date], reference [RTI-id]")

Comments appear:

- To the home's registered manager in the pay run review screen
- In the audit trail
- Threaded — manager can reply

Notification: when an accountant comments, the registered manager gets an email + in-app push.

### 8. Year-end summary

A separate screen and downloadable PDF/CSV:

- Per staff member: total gross, total tax, total NI, total pension, total net for the tax year
- Suitable for P60 generation by the accountant in their own software
- Includes all approved pay runs for the tax year (April 6 to April 5)

This is **not** an HMRC P60 — those come from the accountant's own software after they file. We provide the source data.

### 9. Audit additions

Every accountant action writes an `audit_events` row:

- Login
- View of any pay run
- CSV download (also recorded in `payroll_exports`)
- Comment posted
- Marked-as-filed action

The owner can review the audit trail for accountant activity in Settings → Payroll → Accountant Activity Log.

### 10. Security hardening for the accountant portal

- MFA mandatory (cannot be skipped)
- Session timeout: 30 minutes idle (shorter than the admin portal's 2 hours)
- IP allowlist (optional, set by owner in Settings)
- Force re-auth before any CSV download
- All CSV downloads watermarked in the PDF metadata with the user ID + timestamp

## Acceptance tests

1. Approve a pay run; export to BrightPay CSV; the file matches BrightPay's import template exactly.
2. Same pay run, export to Sage; file matches Sage's template.
3. Same pay run, export to Generic CSV; every field per the spec is present and correctly populated.
4. The Christmas-Day shift from Sprint 6's tests appears in the export with `multiplier_christmas = 2.0` in the generic format.
5. Re-export the same pay run a week later in BrightPay format; system returns the original cached file (same bytes).
6. Invite an accountant; they click the link, set a password, configure MFA, and land on the accountant dashboard.
7. The accountant sees only the home they were invited to; trying to navigate to `/api/homes/<other-home>/pay-runs` returns 403.
8. The accountant downloads a CSV; the audit log shows the download with their user ID.
9. The accountant adds a comment on a payslip line; the registered manager receives an email + push notification and can see the comment.
10. The accountant marks a pay run as filed; `pay_runs.marked_filed_at` is set; the home's manager sees the change.
11. The owner revokes the accountant's access; an active accountant session is terminated within 10 seconds; the accountant cannot log back in.
12. Year-end summary for tax year 2025/26 shows correct totals across all approved pay runs for all staff.
13. An accountant tries to view the rota — there is no UI link, and a direct URL returns 403.

## Out of scope

- Direct HMRC RTI filing (v3)
- Direct pension provider submission (v2)
- HMRC P60 generation (the accountant does this from their software)
- Bulk multi-home reporting for accountants (v2 — they get per-home views in v1)

## Definition of done

- All 6 export adapters produce CSVs that import cleanly into their target software (verified against real templates)
- Accountant portal fully functional: invite, login, view, download, comment, mark-filed
- Revocation is immediate and audit-logged
- Year-end summary generates correctly
- All 13 acceptance tests pass
- Sprint demo: the home's accountant logs in, opens last month's pay run, downloads it as Sage CSV, comments "Filed RTI today, reference XYZ", marks it as filed — all in under 90 seconds and the home's manager sees the comment in real time
