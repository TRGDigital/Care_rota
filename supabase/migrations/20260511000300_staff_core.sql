-- ============================================================
-- STAFF CORE
-- All tables are home-scoped: tenant_id = home_id
-- ============================================================

CREATE TABLE staff_roles (
  id                 uuid    PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id          uuid    NOT NULL, -- = home_id
  home_id            uuid    NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  code               text    NOT NULL,
  name               text    NOT NULL,
  requires_nurse_pin boolean NOT NULL DEFAULT false,
  requires_dbs       boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,

  CONSTRAINT uq_staff_role_code UNIQUE (home_id, code)
);

CREATE TRIGGER staff_roles_updated_at
  BEFORE UPDATE ON staff_roles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================

CREATE TABLE staff (
  id                uuid         PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id         uuid         NOT NULL, -- = home_id
  home_id           uuid         NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  user_id           uuid         REFERENCES users(id) ON DELETE SET NULL, -- nullable: agency/bank staff may not have a login
  first_name        text         NOT NULL,
  last_name         text         NOT NULL,
  employee_number   text,
  date_of_birth     date,
  ni_number         text,
  address           text,
  emergency_contact jsonb,       -- { name, relationship, phone }
  photo_url         text,
  status            staff_status NOT NULL DEFAULT 'active',
  date_started      date,
  date_left         date,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(id),
  updated_by_user_id uuid REFERENCES users(id),

  CONSTRAINT uq_staff_employee_number UNIQUE (home_id, employee_number)
);

CREATE TRIGGER staff_updated_at
  BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_staff_home   ON staff(home_id);
CREATE INDEX idx_staff_user   ON staff(user_id);
CREATE INDEX idx_staff_status ON staff(home_id, status);

-- ============================================================
-- Named shift patterns: admin configures once at onboarding.
-- The bridge between display time ranges and paid hours.
-- ============================================================

CREATE TABLE shift_pattern_templates (
  id                 uuid             PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id          uuid             NOT NULL, -- = home_id
  home_id            uuid             NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  name               text             NOT NULL,
  start_time_local   time             NOT NULL,
  end_time_local     time             NOT NULL,
  break_minutes      smallint         NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
  paid_hours_decimal numeric(5,2)     NOT NULL CHECK (paid_hours_decimal > 0),
  length_type        shift_length_type NOT NULL DEFAULT 'custom',
  created_at         timestamptz      NOT NULL DEFAULT now(),
  updated_at         timestamptz      NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(id),
  updated_by_user_id uuid REFERENCES users(id),

  CONSTRAINT uq_shift_pattern_name UNIQUE (home_id, name)
);

CREATE TRIGGER shift_pattern_templates_updated_at
  BEFORE UPDATE ON shift_pattern_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================

CREATE TABLE staff_contracts (
  id                        uuid                     PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id                 uuid                     NOT NULL,
  home_id                   uuid                     NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  staff_id                  uuid                     NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  contract_type             contract_type            NOT NULL,
  contracted_hours_per_week numeric(5,2)             NOT NULL DEFAULT 0 CHECK (contracted_hours_per_week >= 0),
  contracted_days_per_week  smallint                 CHECK (contracted_days_per_week BETWEEN 0 AND 7),
  shift_pattern_preference  shift_pattern_preference NOT NULL DEFAULT 'any',
  holiday_unit_override     allocation_unit,         -- NULL = inherit from home setting
  holiday_entitlement_value numeric(8,2)             NOT NULL DEFAULT 0 CHECK (holiday_entitlement_value >= 0),
  sick_pay_scheme_id        uuid,                    -- FK added when sick pay schemes table exists (v2)
  effective_from            date                     NOT NULL,
  effective_to              date,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  created_by_user_id        uuid REFERENCES users(id),
  updated_by_user_id        uuid REFERENCES users(id),

  CONSTRAINT uq_staff_contract_period UNIQUE (staff_id, effective_from),
  CONSTRAINT chk_contract_dates CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE TRIGGER staff_contracts_updated_at
  BEFORE UPDATE ON staff_contracts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_staff_contracts_staff ON staff_contracts(staff_id);
CREATE INDEX idx_staff_contracts_active ON staff_contracts(home_id, effective_from, effective_to);

-- ============================================================
-- Fixed shifts for staff who always work the same pattern.
-- Used by the rota auto-generator to pre-fill before allocation.
-- ============================================================

CREATE TABLE staff_fixed_shifts (
  id                  uuid    PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id           uuid    NOT NULL,
  home_id             uuid    NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  staff_id            uuid    NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  day_of_week         smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun, 1=Mon … 6=Sat
  shift_template_id   uuid    NOT NULL REFERENCES shift_pattern_templates(id) ON DELETE RESTRICT,
  effective_from      date    NOT NULL,
  effective_to        date,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by_user_id  uuid REFERENCES users(id),
  updated_by_user_id  uuid REFERENCES users(id),

  CONSTRAINT chk_fixed_shift_dates CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE TRIGGER staff_fixed_shifts_updated_at
  BEFORE UPDATE ON staff_fixed_shifts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_staff_fixed_shifts_staff ON staff_fixed_shifts(staff_id);

-- ============================================================

CREATE TABLE staff_pay_rates (
  id                       uuid        PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id                uuid        NOT NULL,
  home_id                  uuid        NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  staff_id                 uuid        NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  role_code                text        NOT NULL,
  rate_weekday_pence       bigint      NOT NULL CHECK (rate_weekday_pence >= 0),
  rate_weekend_pence       bigint      NOT NULL CHECK (rate_weekend_pence >= 0),
  rate_night_pence         bigint      NOT NULL CHECK (rate_night_pence >= 0),
  rate_overtime_pence      bigint      NOT NULL CHECK (rate_overtime_pence >= 0),
  rate_sleep_in_flat_pence bigint      NOT NULL DEFAULT 0 CHECK (rate_sleep_in_flat_pence >= 0),
  rate_training_pence      bigint      NOT NULL CHECK (rate_training_pence >= 0), -- defaults to rate_weekday_pence at insert
  effective_from           date        NOT NULL,
  effective_to             date,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  created_by_user_id       uuid REFERENCES users(id),
  updated_by_user_id       uuid REFERENCES users(id),

  CONSTRAINT uq_staff_pay_rate_period UNIQUE (staff_id, role_code, effective_from),
  CONSTRAINT chk_pay_rate_dates CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE TRIGGER staff_pay_rates_updated_at
  BEFORE UPDATE ON staff_pay_rates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_staff_pay_rates_staff ON staff_pay_rates(staff_id);
