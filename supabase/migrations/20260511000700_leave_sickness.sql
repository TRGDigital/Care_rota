-- ============================================================
-- LEAVE, SICKNESS & STATUTORY PAYMENTS
-- All tables home-scoped: tenant_id = home_id
-- ============================================================

CREATE TABLE leave_requests (
  id                  uuid                 PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id           uuid                 NOT NULL,
  home_id             uuid                 NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  staff_id            uuid                 NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  type                leave_type           NOT NULL,
  start_date          date                 NOT NULL,
  end_date            date                 NOT NULL,
  -- value in whatever unit the home uses (days or hours per homes.holiday_allocation_unit)
  value_requested     numeric(8,2)         NOT NULL CHECK (value_requested > 0),
  status              leave_request_status NOT NULL DEFAULT 'pending',
  submitted_at        timestamptz          NOT NULL DEFAULT now(),
  decided_by_user_id  uuid                 REFERENCES users(id),
  decided_at          timestamptz,
  manager_note        text,
  -- One-click cover: the staff member who was offered and accepted cover
  covering_staff_id   uuid                 REFERENCES staff(id),
  created_at          timestamptz          NOT NULL DEFAULT now(),
  updated_at          timestamptz          NOT NULL DEFAULT now(),
  created_by_user_id  uuid REFERENCES users(id),
  updated_by_user_id  uuid REFERENCES users(id),

  CONSTRAINT chk_leave_dates CHECK (end_date >= start_date)
);

CREATE TRIGGER leave_requests_updated_at
  BEFORE UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_leave_requests_staff  ON leave_requests(staff_id);
CREATE INDEX idx_leave_requests_home   ON leave_requests(home_id, status);
CREATE INDEX idx_leave_requests_dates  ON leave_requests(home_id, start_date, end_date);

-- ============================================================
-- Per-staff per-leave-year balance.
-- Mirrors the reference holiday workbook column structure.
-- ============================================================

CREATE TABLE leave_balances (
  id                uuid            PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id         uuid            NOT NULL,
  home_id           uuid            NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  staff_id          uuid            NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  leave_year_start  date            NOT NULL, -- first day of the leave year for this row
  allocation_unit   allocation_unit NOT NULL,
  entitlement_value numeric(8,2)    NOT NULL DEFAULT 0,
  accrued_value     numeric(8,2)    NOT NULL DEFAULT 0,
  booked_value      numeric(8,2)    NOT NULL DEFAULT 0,  -- approved, not yet taken
  taken_value       numeric(8,2)    NOT NULL DEFAULT 0,  -- confirmed taken
  scheduled_value   numeric(8,2)    NOT NULL DEFAULT 0,  -- pending approval
  carried_over_value numeric(8,2)   NOT NULL DEFAULT 0,
  balance_remaining numeric(8,2)    GENERATED ALWAYS AS (
    entitlement_value + carried_over_value - booked_value - taken_value - scheduled_value
  ) STORED,
  created_at        timestamptz     NOT NULL DEFAULT now(),
  updated_at        timestamptz     NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(id),
  updated_by_user_id uuid REFERENCES users(id),

  CONSTRAINT uq_leave_balance UNIQUE (staff_id, leave_year_start)
);

CREATE TRIGGER leave_balances_updated_at
  BEFORE UPDATE ON leave_balances FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_leave_balances_staff ON leave_balances(staff_id);

-- ============================================================
-- Monthly rollup — drives the holiday tracking calendar view.
-- ============================================================

CREATE TABLE leave_year_month_summary (
  id               uuid            PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id        uuid            NOT NULL,
  home_id          uuid            NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  staff_id         uuid            NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  leave_year_start date            NOT NULL,
  month            smallint        NOT NULL CHECK (month BETWEEN 1 AND 12),
  booked_value     numeric(8,2)    NOT NULL DEFAULT 0,
  taken_value      numeric(8,2)    NOT NULL DEFAULT 0,
  created_at       timestamptz     NOT NULL DEFAULT now(),
  updated_at       timestamptz     NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(id),
  updated_by_user_id uuid REFERENCES users(id),

  CONSTRAINT uq_leave_month_summary UNIQUE (staff_id, leave_year_start, month)
);

CREATE TRIGGER leave_year_month_summary_updated_at
  BEFORE UPDATE ON leave_year_month_summary FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================

CREATE TABLE sickness_episodes (
  id                          uuid              PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id                   uuid              NOT NULL,
  home_id                     uuid              NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  staff_id                    uuid              NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  first_day_of_sickness        date              NOT NULL,
  last_day_of_sickness         date,
  qualifying_days              smallint          CHECK (qualifying_days >= 0),
  ssp_eligible                 boolean           NOT NULL DEFAULT false,
  contractual_pay_applied      boolean           NOT NULL DEFAULT false,
  fit_note_url                 text,
  return_to_work_completed_at  timestamptz,
  covering_strategy            covering_strategy NOT NULL DEFAULT 'none',
  created_at                   timestamptz       NOT NULL DEFAULT now(),
  updated_at                   timestamptz       NOT NULL DEFAULT now(),
  created_by_user_id           uuid REFERENCES users(id),
  updated_by_user_id           uuid REFERENCES users(id)
);

CREATE TRIGGER sickness_episodes_updated_at
  BEFORE UPDATE ON sickness_episodes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_sickness_episodes_staff ON sickness_episodes(staff_id);
CREATE INDEX idx_sickness_episodes_dates ON sickness_episodes(home_id, first_day_of_sickness);

-- ============================================================

CREATE TABLE statutory_payment_records (
  id             uuid                    PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id      uuid                    NOT NULL,
  home_id        uuid                    NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  staff_id       uuid                    NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  payment_type   statutory_payment_type  NOT NULL,
  period_start   date                    NOT NULL,
  period_end     date                    NOT NULL,
  weekly_rate_pence bigint               NOT NULL CHECK (weekly_rate_pence >= 0),
  total_pence    bigint                  NOT NULL CHECK (total_pence >= 0),
  created_at     timestamptz             NOT NULL DEFAULT now(),
  updated_at     timestamptz             NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(id),
  updated_by_user_id uuid REFERENCES users(id),

  CONSTRAINT chk_statutory_dates CHECK (period_end >= period_start)
);

CREATE TRIGGER statutory_payment_records_updated_at
  BEFORE UPDATE ON statutory_payment_records FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_statutory_payments_staff ON statutory_payment_records(staff_id);
