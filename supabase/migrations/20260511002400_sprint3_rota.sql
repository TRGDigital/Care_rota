-- Sprint 3: Rota engine — new tables and home config columns

-- ============================================================
-- ROTA CONFIG ON HOMES
-- ============================================================

ALTER TABLE homes
  ADD COLUMN IF NOT EXISTS rota_period_weeks smallint NOT NULL DEFAULT 1
    CHECK (rota_period_weeks IN (1, 2, 4)),
  ADD COLUMN IF NOT EXISTS rota_start_day smallint NOT NULL DEFAULT 1
    CHECK (rota_start_day BETWEEN 0 AND 6); -- 0=Sun, 1=Mon

-- ============================================================
-- ROTA SLOT REQUIREMENTS
-- Per-home standard week template: what slots to create per period.
-- ============================================================

CREATE TABLE rota_slot_requirements (
  id                        uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 uuid     NOT NULL,
  home_id                   uuid     NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  day_of_week               smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  shift_pattern_template_id uuid     NOT NULL REFERENCES shift_pattern_templates(id) ON DELETE RESTRICT,
  role_code                 text     NOT NULL,
  headcount_required        smallint NOT NULL DEFAULT 1 CHECK (headcount_required > 0),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  created_by_user_id        uuid REFERENCES users(id),
  updated_by_user_id        uuid REFERENCES users(id),
  CONSTRAINT uq_rota_slot_req UNIQUE (home_id, day_of_week, shift_pattern_template_id, role_code)
);

CREATE TRIGGER rota_slot_requirements_updated_at
  BEFORE UPDATE ON rota_slot_requirements FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_rota_slot_req_home ON rota_slot_requirements(home_id, day_of_week);

-- ============================================================
-- ROTA HISTORY (imported historical rotas)
-- ============================================================

CREATE TABLE rota_history (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL,
  home_id          uuid        NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  import_batch_id  uuid        NOT NULL,
  staff_name       text        NOT NULL,
  staff_id         uuid        REFERENCES staff(id) ON DELETE SET NULL,
  shift_date       date        NOT NULL,
  start_time_local text        NOT NULL,
  end_time_local   text        NOT NULL,
  role_code        text,
  source_file      text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(id)
);

CREATE INDEX idx_rota_history_home  ON rota_history(home_id, shift_date);
CREATE INDEX idx_rota_history_batch ON rota_history(import_batch_id);
CREATE INDEX idx_rota_history_staff ON rota_history(home_id, staff_name);

-- ============================================================
-- RLS — JWT-based policies
-- ============================================================

ALTER TABLE rota_slot_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY rota_slot_requirements_isolation ON rota_slot_requirements
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);

CREATE POLICY rota_slot_requirements_super_admin ON rota_slot_requirements
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

CREATE POLICY rota_slot_requirements_via_role ON rota_slot_requirements
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = rota_slot_requirements.home_id
        AND uhr.revoked_at IS NULL
    )
  );

ALTER TABLE rota_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY rota_history_isolation ON rota_history
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);

CREATE POLICY rota_history_super_admin ON rota_history
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

CREATE POLICY rota_history_via_role ON rota_history
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = rota_history.home_id
        AND uhr.revoked_at IS NULL
    )
  );
