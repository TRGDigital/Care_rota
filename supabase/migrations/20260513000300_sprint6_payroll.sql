-- Sprint 6: Payroll Engine (Core)
-- Extends Sprint-0 payroll stubs with state-machine values, training-overlap
-- columns, and a nightly pay-period generation queue flag.

-- ── Extend ENUMs ─────────────────────────────────────────────────────────────

-- pay_run_state: add in_review (review stage) and locked (frozen after 90 days)
-- The Sprint-0 schema has pending_approval / void; these are semantically
-- different so we add the spec-required values rather than reuse.
ALTER TYPE pay_run_state ADD VALUE IF NOT EXISTS 'in_review';
ALTER TYPE pay_run_state ADD VALUE IF NOT EXISTS 'locked';

-- paid_status: add partial (training session partially overlaps a shift)
ALTER TYPE paid_status ADD VALUE IF NOT EXISTS 'partial';

-- ── Extend staff_training_attendances ────────────────────────────────────────
-- Store the computed overlap split so the payroll engine can use it without
-- re-joining shifts at calculation time.

ALTER TABLE staff_training_attendances
  ADD COLUMN IF NOT EXISTS minutes_overlapping_shift    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minutes_outside_shift_payable integer NOT NULL DEFAULT 0;

-- ── Extend pay_runs ───────────────────────────────────────────────────────────
-- submitted_for_review_at: timestamp when draft → in_review transition happened
-- locked_at: timestamp when approved → locked transition happened

ALTER TABLE pay_runs
  ADD COLUMN IF NOT EXISTS submitted_for_review_at  timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by_user_id     uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS locked_at               timestamptz;

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_shifts_payable_staff_period
  ON shifts_payable(staff_id, home_id);

CREATE INDEX IF NOT EXISTS idx_pay_runs_period
  ON pay_runs(pay_period_id, status);

CREATE INDEX IF NOT EXISTS idx_payslips_run
  ON payslips(pay_run_id, staff_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- pay_cycles / pay_periods / pay_runs / payslips / payslip_lines already have
-- RLS in the Sprint-0 policy migration; no new tables added here.
