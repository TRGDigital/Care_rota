-- ============================================================
-- ROTA — shifts and assignments
-- All tables home-scoped: tenant_id = home_id
-- ============================================================

CREATE TABLE rota_periods (
  id                  uuid             PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id           uuid             NOT NULL,
  home_id             uuid             NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  period_start_date   date             NOT NULL,
  period_end_date     date             NOT NULL,
  status              rota_period_state NOT NULL DEFAULT 'draft',
  published_at        timestamptz,
  published_by_user_id uuid            REFERENCES users(id),
  created_at          timestamptz      NOT NULL DEFAULT now(),
  updated_at          timestamptz      NOT NULL DEFAULT now(),
  created_by_user_id  uuid REFERENCES users(id),
  updated_by_user_id  uuid REFERENCES users(id),

  CONSTRAINT chk_rota_period_dates CHECK (period_end_date > period_start_date),
  CONSTRAINT uq_rota_period UNIQUE (home_id, period_start_date)
);

CREATE TRIGGER rota_periods_updated_at
  BEFORE UPDATE ON rota_periods FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_rota_periods_home   ON rota_periods(home_id, period_start_date DESC);
CREATE INDEX idx_rota_periods_status ON rota_periods(home_id, status);

-- ============================================================
-- Required shape of the rota for a day.
-- Headcount and dependency score drive auto-rebalancing.
-- ============================================================

CREATE TABLE shift_slots (
  id                        uuid     PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id                 uuid     NOT NULL,
  home_id                   uuid     NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  rota_period_id            uuid     NOT NULL REFERENCES rota_periods(id) ON DELETE CASCADE,
  date                      date     NOT NULL,
  shift_pattern_template_id uuid     NOT NULL REFERENCES shift_pattern_templates(id) ON DELETE RESTRICT,
  role_code                 text     NOT NULL,
  headcount_required        smallint NOT NULL DEFAULT 1 CHECK (headcount_required > 0),
  dependency_required_score smallint,
  notes                     text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  created_by_user_id        uuid REFERENCES users(id),
  updated_by_user_id        uuid REFERENCES users(id)
);

CREATE TRIGGER shift_slots_updated_at
  BEFORE UPDATE ON shift_slots FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_shift_slots_period ON shift_slots(rota_period_id);
CREATE INDEX idx_shift_slots_date   ON shift_slots(home_id, date);

-- ============================================================
-- Individual shift assignment.
-- Multiplier stored at publish time — does not change after publish.
-- ============================================================

CREATE TABLE shifts (
  id                    uuid        PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id             uuid        NOT NULL,
  home_id               uuid        NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  shift_slot_id         uuid        NOT NULL REFERENCES shift_slots(id) ON DELETE RESTRICT,
  staff_id              uuid        REFERENCES staff(id) ON DELETE SET NULL, -- NULL = unassigned
  state                 shift_state NOT NULL DEFAULT 'unassigned',
  planned_start_utc     timestamptz NOT NULL,
  planned_end_utc       timestamptz NOT NULL,
  planned_break_minutes smallint    NOT NULL DEFAULT 0 CHECK (planned_break_minutes >= 0),
  planned_paid_hours    numeric(5,2) NOT NULL CHECK (planned_paid_hours >= 0),
  is_responsible_nurse  boolean     NOT NULL DEFAULT false,
  is_medicine_manager   boolean     NOT NULL DEFAULT false,
  is_chef               boolean     NOT NULL DEFAULT false,
  is_fire_warden        boolean     NOT NULL DEFAULT false,
  agency_supplier_id    uuid,       -- no local FK; CareStream-side supplier record
  is_bank_holiday       boolean     NOT NULL DEFAULT false,
  is_christmas_period   boolean     NOT NULL DEFAULT false,
  premium_multiplier    numeric(4,2) NOT NULL DEFAULT 1.00 CHECK (premium_multiplier >= 1),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by_user_id    uuid REFERENCES users(id),
  updated_by_user_id    uuid REFERENCES users(id),

  CONSTRAINT chk_shift_times CHECK (planned_end_utc > planned_start_utc)
);

CREATE TRIGGER shifts_updated_at
  BEFORE UPDATE ON shifts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_shifts_home    ON shifts(home_id);
CREATE INDEX idx_shifts_staff   ON shifts(staff_id);
CREATE INDEX idx_shifts_slot    ON shifts(shift_slot_id);
CREATE INDEX idx_shifts_start   ON shifts(home_id, planned_start_utc);
CREATE INDEX idx_shifts_state   ON shifts(home_id, state);

-- Back-fill FK deferred from 20260511000400_staff_compliance.sql
ALTER TABLE staff_training_attendances
  ADD CONSTRAINT fk_training_attendance_shift
  FOREIGN KEY (overlap_shift_id) REFERENCES shifts(id) ON DELETE SET NULL;

-- ============================================================

CREATE TABLE shift_clockings (
  id             uuid                PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id      uuid                NOT NULL,
  home_id        uuid                NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  shift_id       uuid                NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  event_type     clocking_event_type NOT NULL,
  event_time_utc timestamptz         NOT NULL,
  capture_method capture_method      NOT NULL,
  photo_url      text,
  lat            numeric(9,6),
  lng            numeric(9,6),
  kiosk_id       uuid,               -- FK added in 20260511000600_ta_hardware.sql
  nfc_uid        text,
  pin_match      boolean,
  created_at     timestamptz         NOT NULL DEFAULT now(),
  updated_at     timestamptz         NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(id),
  updated_by_user_id uuid REFERENCES users(id)
);

CREATE TRIGGER shift_clockings_updated_at
  BEFORE UPDATE ON shift_clockings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_shift_clockings_shift ON shift_clockings(shift_id);
CREATE INDEX idx_shift_clockings_time  ON shift_clockings(home_id, event_time_utc);

-- ============================================================
-- Actual hours worked — reconciled against planned shift.
-- ============================================================

CREATE TABLE shifts_actual (
  id                              uuid                 PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id                       uuid                 NOT NULL,
  home_id                         uuid                 NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  shift_id                        uuid                 NOT NULL UNIQUE REFERENCES shifts(id) ON DELETE RESTRICT,
  actual_start_utc                timestamptz,
  actual_end_utc                  timestamptz,
  actual_worked_minutes           smallint             CHECK (actual_worked_minutes >= 0),
  actual_break_minutes            smallint             NOT NULL DEFAULT 0 CHECK (actual_break_minutes >= 0),
  reconciliation_status           reconciliation_state NOT NULL DEFAULT 'pending',
  reconciliation_resolved_by_user_id uuid             REFERENCES users(id),
  manager_note                    text,
  created_at                      timestamptz          NOT NULL DEFAULT now(),
  updated_at                      timestamptz          NOT NULL DEFAULT now(),
  created_by_user_id              uuid REFERENCES users(id),
  updated_by_user_id              uuid REFERENCES users(id)
);

CREATE TRIGGER shifts_actual_updated_at
  BEFORE UPDATE ON shifts_actual FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_shifts_actual_status ON shifts_actual(home_id, reconciliation_status);

-- ============================================================

CREATE TABLE shift_swaps (
  id                      uuid              PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id               uuid              NOT NULL,
  home_id                 uuid              NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  original_shift_id       uuid              NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  requested_with_staff_id uuid              NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  status                  shift_swap_status NOT NULL DEFAULT 'pending',
  approver_user_id        uuid              REFERENCES users(id),
  decided_at              timestamptz,
  created_at              timestamptz       NOT NULL DEFAULT now(),
  updated_at              timestamptz       NOT NULL DEFAULT now(),
  created_by_user_id      uuid REFERENCES users(id),
  updated_by_user_id      uuid REFERENCES users(id)
);

CREATE TRIGGER shift_swaps_updated_at
  BEFORE UPDATE ON shift_swaps FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_shift_swaps_shift ON shift_swaps(original_shift_id);

-- ============================================================
-- Payable hours by category — source of truth for payroll.
-- Written by the reconciliation worker after period close.
-- ============================================================

CREATE TABLE shifts_payable (
  id                        uuid    PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id                 uuid    NOT NULL,
  home_id                   uuid    NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  shift_id                  uuid    NOT NULL UNIQUE REFERENCES shifts(id) ON DELETE RESTRICT,
  paid_minutes_weekday      integer NOT NULL DEFAULT 0 CHECK (paid_minutes_weekday >= 0),
  paid_minutes_weekend      integer NOT NULL DEFAULT 0 CHECK (paid_minutes_weekend >= 0),
  paid_minutes_bank_holiday integer NOT NULL DEFAULT 0 CHECK (paid_minutes_bank_holiday >= 0),
  paid_minutes_christmas    integer NOT NULL DEFAULT 0 CHECK (paid_minutes_christmas >= 0),
  paid_minutes_night        integer NOT NULL DEFAULT 0 CHECK (paid_minutes_night >= 0),
  paid_minutes_overtime     integer NOT NULL DEFAULT 0 CHECK (paid_minutes_overtime >= 0),
  paid_minutes_training     integer NOT NULL DEFAULT 0 CHECK (paid_minutes_training >= 0),
  paid_minutes_holiday      integer NOT NULL DEFAULT 0 CHECK (paid_minutes_holiday >= 0),
  paid_minutes_sickness     integer NOT NULL DEFAULT 0 CHECK (paid_minutes_sickness >= 0),
  paid_minutes_sleep_in     integer NOT NULL DEFAULT 0 CHECK (paid_minutes_sleep_in >= 0),
  premium_multiplier_applied numeric(4,2) NOT NULL DEFAULT 1.00,
  source_rule               text    NOT NULL, -- e.g. 'reconciliation', 'manager_override', 'manual_entry'
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  created_by_user_id        uuid REFERENCES users(id),
  updated_by_user_id        uuid REFERENCES users(id)
);

CREATE TRIGGER shifts_payable_updated_at
  BEFORE UPDATE ON shifts_payable FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_shifts_payable_home  ON shifts_payable(home_id);

-- ============================================================
-- Per-home calendar of premium-pay dates (bank holidays + custom).
-- Multiplier stored here is the default; overridden per-shift at publish time.
-- ============================================================

CREATE TABLE premium_pay_calendar (
  id            uuid               PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid               NOT NULL,
  home_id       uuid               NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  calendar_date date               NOT NULL,
  name          text               NOT NULL,
  multiplier    numeric(4,2)       NOT NULL DEFAULT 1.50 CHECK (multiplier >= 1),
  source        premium_pay_source NOT NULL DEFAULT 'auto_bank_holiday',
  created_at    timestamptz        NOT NULL DEFAULT now(),
  updated_at    timestamptz        NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(id),
  updated_by_user_id uuid REFERENCES users(id),

  CONSTRAINT uq_premium_pay_date UNIQUE (home_id, calendar_date)
);

CREATE TRIGGER premium_pay_calendar_updated_at
  BEFORE UPDATE ON premium_pay_calendar FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_premium_pay_calendar ON premium_pay_calendar(home_id, calendar_date);
