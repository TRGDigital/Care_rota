-- Sprint 5: Time & Attendance
-- Extends the Sprint-0 T&A stubs with columns needed for the reconciliation
-- worker, offline kiosk queue, geofenced mobile clock-in, and payroll handoff.

-- ── Extend existing ENUMs ──────────────────────────────────────────────────

-- clocking_event_type: add disturbed-sleep-in events
ALTER TYPE clocking_event_type ADD VALUE IF NOT EXISTS 'disturbed_start';
ALTER TYPE clocking_event_type ADD VALUE IF NOT EXISTS 'disturbed_end';

-- capture_method: add legacy import and ensure kiosk_nfc exists
-- (Sprint 0 has: kiosk_pin, nfc_badge, mobile_gps, manager_entry)
ALTER TYPE capture_method ADD VALUE IF NOT EXISTS 'imported_legacy';
ALTER TYPE capture_method ADD VALUE IF NOT EXISTS 'kiosk_nfc';

-- reconciliation_state: Sprint 0 has pending/matched/discrepancy/resolved.
-- Add granular T&A states required by Section 11.3.
ALTER TYPE reconciliation_state ADD VALUE IF NOT EXISTS 'over_planned';
ALTER TYPE reconciliation_state ADD VALUE IF NOT EXISTS 'under_planned';
ALTER TYPE reconciliation_state ADD VALUE IF NOT EXISTS 'no_show';
ALTER TYPE reconciliation_state ADD VALUE IF NOT EXISTS 'no_clock_out';
ALTER TYPE reconciliation_state ADD VALUE IF NOT EXISTS 'manual_override';

-- New enum for payable source rule
CREATE TYPE payable_source_rule AS ENUM (
  'auto_actual',
  'manager_override',
  'pay_zero_no_show',
  'pay_planned_override'
);

-- ── Extend kiosks ──────────────────────────────────────────────────────────

ALTER TABLE kiosks
  ADD COLUMN IF NOT EXISTS paired_at   timestamptz,
  ADD COLUMN IF NOT EXISTS is_active   boolean NOT NULL DEFAULT true;

-- ── Kiosk pairing tokens — hashed one-time tokens ─────────────────────────
-- Raw token shown once to admin; only the SHA-256 hash is stored here.

CREATE TABLE IF NOT EXISTS kiosk_pairing_tokens (
  id                  uuid         PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id           uuid         NOT NULL,
  home_id             uuid         NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  token_hash          text         NOT NULL UNIQUE,
  kiosk_name          text         NOT NULL,
  expires_at          timestamptz  NOT NULL,
  used_at             timestamptz,
  kiosk_id            uuid         REFERENCES kiosks(id),
  created_at          timestamptz  NOT NULL DEFAULT now(),
  created_by_user_id  uuid         REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_kiosk_tokens_hash ON kiosk_pairing_tokens(token_hash) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_kiosk_tokens_home ON kiosk_pairing_tokens(home_id);

-- ── Extend shift_clockings ─────────────────────────────────────────────────
-- shift_id becomes nullable: unmatched punches (legacy, early arrivalsno rota)
-- have no corresponding shift row yet.

ALTER TABLE shift_clockings
  ALTER COLUMN shift_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS staff_id              uuid         REFERENCES staff(id),
  ADD COLUMN IF NOT EXISTS photo_expires_at      timestamptz,
  ADD COLUMN IF NOT EXISTS gps_accuracy_metres   numeric(6,2),
  ADD COLUMN IF NOT EXISTS offline_queued        boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS offline_synced_at     timestamptz,
  ADD COLUMN IF NOT EXISTS requires_review       boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_at           timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by_user_id   uuid         REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_clockings_staff_time ON shift_clockings(staff_id, event_time_utc);
CREATE INDEX IF NOT EXISTS idx_clockings_review     ON shift_clockings(home_id, requires_review) WHERE requires_review = true;
CREATE INDEX IF NOT EXISTS idx_clockings_offline    ON shift_clockings(home_id, offline_queued) WHERE offline_queued = true;

-- ── Extend shifts_actual ───────────────────────────────────────────────────

ALTER TABLE shifts_actual
  ADD COLUMN IF NOT EXISTS staff_id             uuid         REFERENCES staff(id),
  ADD COLUMN IF NOT EXISTS disturbed_minutes    integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clockings_count      integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reconciled_at   timestamptz;

CREATE INDEX IF NOT EXISTS idx_shifts_actual_state ON shifts_actual(home_id, reconciliation_status);

-- ── Extend shifts_payable ──────────────────────────────────────────────────
-- Sprint 0 has paid_minutes_* columns and source_rule (text).
-- Sprint 5 adds reconciliation context, disturbed minutes, and payroll handoff.

ALTER TABLE shifts_payable
  ADD COLUMN IF NOT EXISTS staff_id                  uuid         REFERENCES staff(id),
  ADD COLUMN IF NOT EXISTS shifts_actual_id          uuid         REFERENCES shifts_actual(id),
  ADD COLUMN IF NOT EXISTS reconciliation_state      reconciliation_state,
  ADD COLUMN IF NOT EXISTS paid_minutes_disturbed    integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS finalized_at              timestamptz,
  ADD COLUMN IF NOT EXISTS pay_run_id                uuid,
  ADD COLUMN IF NOT EXISTS manager_override_reason   text;

-- ── Extend staff_kiosk_pins — add lock column ─────────────────────────────

ALTER TABLE staff_kiosk_pins
  ADD COLUMN IF NOT EXISTS pin_locked_at timestamptz;

-- ── RLS — via-role fallback for T&A tables (JWT policies already exist) ────

DROP POLICY IF EXISTS kiosks_via_role          ON kiosks;
DROP POLICY IF EXISTS shift_clockings_via_role  ON shift_clockings;
DROP POLICY IF EXISTS shifts_actual_via_role    ON shifts_actual;
DROP POLICY IF EXISTS shifts_payable_via_role   ON shifts_payable;
DROP POLICY IF EXISTS nfc_badges_via_role       ON nfc_badges;
DROP POLICY IF EXISTS staff_kiosk_pins_via_role ON staff_kiosk_pins;
DROP POLICY IF EXISTS geofences_via_role        ON geofences;

CREATE POLICY kiosks_via_role ON kiosks AS PERMISSIVE
  USING (EXISTS (
    SELECT 1 FROM user_home_roles
    WHERE user_id = auth.uid() AND home_id = kiosks.home_id AND revoked_at IS NULL
  ));

CREATE POLICY shift_clockings_via_role ON shift_clockings AS PERMISSIVE
  USING (EXISTS (
    SELECT 1 FROM user_home_roles
    WHERE user_id = auth.uid() AND home_id = shift_clockings.home_id AND revoked_at IS NULL
  ));

CREATE POLICY shifts_actual_via_role ON shifts_actual AS PERMISSIVE
  USING (EXISTS (
    SELECT 1 FROM user_home_roles
    WHERE user_id = auth.uid() AND home_id = shifts_actual.home_id AND revoked_at IS NULL
  ));

CREATE POLICY shifts_payable_via_role ON shifts_payable AS PERMISSIVE
  USING (EXISTS (
    SELECT 1 FROM user_home_roles
    WHERE user_id = auth.uid() AND home_id = shifts_payable.home_id AND revoked_at IS NULL
  ));

CREATE POLICY nfc_badges_via_role ON nfc_badges AS PERMISSIVE
  USING (EXISTS (
    SELECT 1 FROM user_home_roles
    WHERE user_id = auth.uid() AND home_id = nfc_badges.home_id AND revoked_at IS NULL
  ));

CREATE POLICY staff_kiosk_pins_via_role ON staff_kiosk_pins AS PERMISSIVE
  USING (EXISTS (
    SELECT 1 FROM user_home_roles
    WHERE user_id = auth.uid() AND home_id = staff_kiosk_pins.home_id AND revoked_at IS NULL
  ));

CREATE POLICY geofences_via_role ON geofences AS PERMISSIVE
  USING (EXISTS (
    SELECT 1 FROM user_home_roles
    WHERE user_id = auth.uid() AND home_id = geofences.home_id AND revoked_at IS NULL
  ));

-- RLS for new kiosk_pairing_tokens table
ALTER TABLE kiosk_pairing_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY kiosk_tokens_jwt ON kiosk_pairing_tokens
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);

CREATE POLICY kiosk_tokens_via_role ON kiosk_pairing_tokens AS PERMISSIVE
  USING (EXISTS (
    SELECT 1 FROM user_home_roles
    WHERE user_id = auth.uid() AND home_id = kiosk_pairing_tokens.home_id AND revoked_at IS NULL
  ));
