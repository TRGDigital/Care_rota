-- ============================================================
-- ORGANISATIONS & TENANCY
-- tenant_id on org-level tables = organisation_id
-- tenant_id on home-level tables = home_id (set in each table)
-- ============================================================

CREATE TABLE organisations (
  id                   uuid        PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id            uuid        NOT NULL GENERATED ALWAYS AS (id) STORED,
  name                 text        NOT NULL,
  billing_customer_id  text,       -- Stripe customer ID, shared with CareStream
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  created_by_user_id   uuid,
  updated_by_user_id   uuid
);

CREATE TRIGGER organisations_updated_at
  BEFORE UPDATE ON organisations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================

CREATE TABLE homes (
  id                       uuid             PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id                uuid             NOT NULL GENERATED ALWAYS AS (id) STORED,
  organisation_id          uuid             NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
  name                     text             NOT NULL,
  address                  text             NOT NULL,
  cqc_registration_number  text,
  registration_type        registration_type NOT NULL,
  bed_capacity             smallint         NOT NULL CHECK (bed_capacity > 0),
  time_zone                text             NOT NULL DEFAULT 'Europe/London',
  -- pay_cycle_id added via ALTER TABLE in 20260511000800_payroll.sql (circular ref)
  holiday_allocation_unit  allocation_unit  NOT NULL DEFAULT 'hours',
  holiday_year_start_month smallint         NOT NULL DEFAULT 4 CHECK (holiday_year_start_month BETWEEN 1 AND 12),
  bank_holiday_region      bank_holiday_region NOT NULL DEFAULT 'eng_wales',
  created_at               timestamptz      NOT NULL DEFAULT now(),
  updated_at               timestamptz      NOT NULL DEFAULT now(),
  created_by_user_id       uuid,
  updated_by_user_id       uuid
);

CREATE TRIGGER homes_updated_at
  BEFORE UPDATE ON homes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Public user profile — 1:1 with auth.users.
-- Created automatically via trigger when auth.users row is inserted.
-- ============================================================

CREATE TABLE users (
  id                   uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id            uuid        NOT NULL, -- = organisation_id; set on profile creation
  organisation_id      uuid        NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
  email                text        NOT NULL,
  name                 text        NOT NULL DEFAULT '',
  status               user_status NOT NULL DEFAULT 'pending_invite',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  created_by_user_id   uuid,
  updated_by_user_id   uuid
);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-create profile row when Supabase Auth creates a user.
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, tenant_id, organisation_id, email, name, status)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data ->> 'organisation_id')::uuid, '00000000-0000-0000-0000-000000000000'),
    COALESCE((NEW.raw_user_meta_data ->> 'organisation_id')::uuid, '00000000-0000-0000-0000-000000000000'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
    'pending_invite'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- ============================================================

CREATE TABLE user_home_roles (
  id                   uuid      PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id            uuid      NOT NULL, -- = organisation_id
  organisation_id      uuid      NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id              uuid      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  home_id              uuid      REFERENCES homes(id) ON DELETE CASCADE, -- NULL = org-wide role
  role_code            role_code NOT NULL,
  granted_at           timestamptz NOT NULL DEFAULT now(),
  granted_by_user_id   uuid      REFERENCES users(id),
  revoked_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  created_by_user_id   uuid,
  updated_by_user_id   uuid,

  CONSTRAINT uq_user_home_role UNIQUE (user_id, home_id, role_code)
);

CREATE TRIGGER user_home_roles_updated_at
  BEFORE UPDATE ON user_home_roles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_user_home_roles_user    ON user_home_roles(user_id);
CREATE INDEX idx_user_home_roles_home    ON user_home_roles(home_id);
CREATE INDEX idx_user_home_roles_org     ON user_home_roles(organisation_id);
