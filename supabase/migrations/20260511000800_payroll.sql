-- ============================================================
-- PAYROLL
-- All tables home-scoped: tenant_id = home_id
-- ============================================================

CREATE TABLE pay_cycles (
  id                      uuid          PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id               uuid          NOT NULL,
  home_id                 uuid          NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  frequency               pay_frequency NOT NULL,
  -- how the pay day is determined: 'last_calendar_day', 'last_friday', 'last_thursday',
  -- 'fixed_day_NN' (e.g. 'fixed_day_25'), 'offset_working_days_N' (e.g. 'offset_working_days_5')
  pay_day_rule            text          NOT NULL,
  period_start_offset_days smallint     NOT NULL DEFAULT 0,
  created_at              timestamptz   NOT NULL DEFAULT now(),
  updated_at              timestamptz   NOT NULL DEFAULT now(),
  created_by_user_id      uuid REFERENCES users(id),
  updated_by_user_id      uuid REFERENCES users(id)
);

CREATE TRIGGER pay_cycles_updated_at
  BEFORE UPDATE ON pay_cycles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Resolve circular reference: homes.pay_cycle_id → pay_cycles
ALTER TABLE homes
  ADD COLUMN pay_cycle_id uuid REFERENCES pay_cycles(id) ON DELETE SET NULL;

-- ============================================================

CREATE TABLE pay_periods (
  id                uuid              PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id         uuid              NOT NULL,
  home_id           uuid              NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  pay_cycle_id      uuid              NOT NULL REFERENCES pay_cycles(id) ON DELETE RESTRICT,
  period_start_date date              NOT NULL,
  period_end_date   date              NOT NULL,
  pay_day           date              NOT NULL,
  weeks_in_period   smallint          NOT NULL CHECK (weeks_in_period IN (4, 5)),
  status            pay_period_status NOT NULL DEFAULT 'open',
  created_at        timestamptz       NOT NULL DEFAULT now(),
  updated_at        timestamptz       NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(id),
  updated_by_user_id uuid REFERENCES users(id),

  CONSTRAINT chk_pay_period_dates CHECK (period_end_date > period_start_date),
  CONSTRAINT uq_pay_period UNIQUE (home_id, period_start_date)
);

CREATE TRIGGER pay_periods_updated_at
  BEFORE UPDATE ON pay_periods FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_pay_periods_home   ON pay_periods(home_id, period_start_date DESC);
CREATE INDEX idx_pay_periods_status ON pay_periods(home_id, status);

-- ============================================================

CREATE TABLE pay_runs (
  id                   uuid          PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id            uuid          NOT NULL,
  home_id              uuid          NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  pay_period_id        uuid          NOT NULL REFERENCES pay_periods(id) ON DELETE RESTRICT,
  status               pay_run_state NOT NULL DEFAULT 'draft',
  approved_by_user_id  uuid          REFERENCES users(id),
  approved_at          timestamptz,
  exported_csv_url     text,
  csv_format           export_format,
  created_at           timestamptz   NOT NULL DEFAULT now(),
  updated_at           timestamptz   NOT NULL DEFAULT now(),
  created_by_user_id   uuid REFERENCES users(id),
  updated_by_user_id   uuid REFERENCES users(id),

  CONSTRAINT uq_pay_run_period UNIQUE (pay_period_id)
);

CREATE TRIGGER pay_runs_updated_at
  BEFORE UPDATE ON pay_runs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_pay_runs_home   ON pay_runs(home_id);
CREATE INDEX idx_pay_runs_status ON pay_runs(home_id, status);

-- ============================================================

CREATE TABLE payslips (
  id                       uuid    PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id                uuid    NOT NULL,
  home_id                  uuid    NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  pay_run_id               uuid    NOT NULL REFERENCES pay_runs(id) ON DELETE RESTRICT,
  staff_id                 uuid    NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  -- Gross by category (all in pence)
  gross_weekday_pence      bigint  NOT NULL DEFAULT 0 CHECK (gross_weekday_pence >= 0),
  gross_weekend_pence      bigint  NOT NULL DEFAULT 0 CHECK (gross_weekend_pence >= 0),
  gross_bank_holiday_pence bigint  NOT NULL DEFAULT 0 CHECK (gross_bank_holiday_pence >= 0),
  gross_christmas_pence    bigint  NOT NULL DEFAULT 0 CHECK (gross_christmas_pence >= 0),
  gross_night_pence        bigint  NOT NULL DEFAULT 0 CHECK (gross_night_pence >= 0),
  gross_overtime_pence     bigint  NOT NULL DEFAULT 0 CHECK (gross_overtime_pence >= 0),
  gross_training_pence     bigint  NOT NULL DEFAULT 0 CHECK (gross_training_pence >= 0),
  gross_holiday_pence      bigint  NOT NULL DEFAULT 0 CHECK (gross_holiday_pence >= 0),
  gross_sickness_pence     bigint  NOT NULL DEFAULT 0 CHECK (gross_sickness_pence >= 0),
  gross_sleep_in_pence     bigint  NOT NULL DEFAULT 0 CHECK (gross_sleep_in_pence >= 0),
  gross_total_pence        bigint  NOT NULL DEFAULT 0 CHECK (gross_total_pence >= 0),
  -- Statutory
  statutory_payments_pence bigint  NOT NULL DEFAULT 0,
  -- Pension
  pension_employee_pence   bigint  NOT NULL DEFAULT 0,
  pension_employer_pence   bigint  NOT NULL DEFAULT 0,
  -- Deductions
  tax_code                 text,
  ni_category              text,
  paye_tax_pence           bigint  NOT NULL DEFAULT 0,
  ni_employee_pence        bigint  NOT NULL DEFAULT 0,
  ni_employer_pence        bigint  NOT NULL DEFAULT 0,
  student_loan_pence       bigint  NOT NULL DEFAULT 0,
  net_pay_pence            bigint  NOT NULL DEFAULT 0,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  created_by_user_id       uuid REFERENCES users(id),
  updated_by_user_id       uuid REFERENCES users(id),

  CONSTRAINT uq_payslip UNIQUE (pay_run_id, staff_id)
);

CREATE TRIGGER payslips_updated_at
  BEFORE UPDATE ON payslips FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_payslips_run   ON payslips(pay_run_id);
CREATE INDEX idx_payslips_staff ON payslips(staff_id);

-- ============================================================

CREATE TABLE payslip_lines (
  id              uuid             PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id       uuid             NOT NULL,
  home_id         uuid             NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  payslip_id      uuid             NOT NULL REFERENCES payslips(id) ON DELETE CASCADE,
  line_type       payslip_line_type NOT NULL,
  description     text             NOT NULL,
  hours           numeric(7,2),
  rate_pence      bigint,
  multiplier      numeric(4,2)     NOT NULL DEFAULT 1.00,
  amount_pence    bigint           NOT NULL,
  source_shift_ids uuid[]          NOT NULL DEFAULT '{}',
  created_at      timestamptz      NOT NULL DEFAULT now(),
  updated_at      timestamptz      NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(id),
  updated_by_user_id uuid REFERENCES users(id)
);

CREATE TRIGGER payslip_lines_updated_at
  BEFORE UPDATE ON payslip_lines FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_payslip_lines_payslip ON payslip_lines(payslip_id);

-- ============================================================

CREATE TABLE payroll_exports (
  id                   uuid          PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id            uuid          NOT NULL,
  home_id              uuid          NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  pay_run_id           uuid          NOT NULL REFERENCES pay_runs(id) ON DELETE RESTRICT,
  format               export_format NOT NULL,
  file_url             text          NOT NULL,
  generated_at         timestamptz   NOT NULL DEFAULT now(),
  generated_by_user_id uuid          REFERENCES users(id),
  created_at           timestamptz   NOT NULL DEFAULT now(),
  updated_at           timestamptz   NOT NULL DEFAULT now(),
  created_by_user_id   uuid REFERENCES users(id),
  updated_by_user_id   uuid REFERENCES users(id)
);

CREATE TRIGGER payroll_exports_updated_at
  BEFORE UPDATE ON payroll_exports FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_payroll_exports_run ON payroll_exports(pay_run_id);

-- ============================================================
-- Accountant portal invitations (read-only payroll access).
-- ============================================================

CREATE TABLE accountant_invitations (
  id                  uuid    PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id           uuid    NOT NULL,
  home_id             uuid    NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  email               text    NOT NULL,
  role_scope          text    NOT NULL DEFAULT 'accountant_readonly',
  invited_by_user_id  uuid    NOT NULL REFERENCES users(id),
  accepted_at         timestamptz,
  last_login_at       timestamptz,
  revoked_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by_user_id  uuid REFERENCES users(id),
  updated_by_user_id  uuid REFERENCES users(id),

  CONSTRAINT uq_accountant_invitation UNIQUE (home_id, email)
);

CREATE TRIGGER accountant_invitations_updated_at
  BEFORE UPDATE ON accountant_invitations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
