-- Sprint 4: Leave, auto-generator, reactive rebalancing additions

-- ============================================================
-- COLUMN ADDITIONS
-- ============================================================

-- Overtime weighting on staff (0=never, 100=prefer)
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS overtime_weighting smallint NOT NULL DEFAULT 50
    CHECK (overtime_weighting BETWEEN 0 AND 100);

-- Holiday accrual model on staff_contracts
ALTER TABLE staff_contracts
  ADD COLUMN IF NOT EXISTS holiday_accrual_model text NOT NULL DEFAULT 'fixed'
    CHECK (holiday_accrual_model IN ('fixed', '12_07_pct', 'enhanced'));

-- Bank holidays inside/outside the 5.6-week entitlement
ALTER TABLE homes
  ADD COLUMN IF NOT EXISTS bank_holidays_included boolean NOT NULL DEFAULT true;

-- Staff message on leave requests
ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS staff_message text;

-- ============================================================
-- ROTA GENERATION AUDIT
-- Stores the ranking explanation per auto-assigned shift.
-- ============================================================

CREATE TABLE rota_generation_audit (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid        NOT NULL,
  home_id              uuid        NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  rota_period_id       uuid        NOT NULL REFERENCES rota_periods(id) ON DELETE CASCADE,
  shift_id             uuid        NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  staff_id             uuid        REFERENCES staff(id) ON DELETE SET NULL,
  candidates_evaluated integer     NOT NULL DEFAULT 0,
  selected_reason      text,       -- e.g. 'Lowest period hours (32.0h); weighting 80'
  ranking_json         jsonb,      -- full ranked list snapshot
  generated_at         timestamptz NOT NULL DEFAULT now(),
  generated_by_user_id uuid        REFERENCES users(id)
);

CREATE INDEX idx_rota_gen_audit_period ON rota_generation_audit(rota_period_id);
CREATE INDEX idx_rota_gen_audit_shift  ON rota_generation_audit(shift_id);

-- ============================================================
-- REBALANCE SUGGESTIONS
-- ============================================================

CREATE TABLE rebalance_suggestions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL,
  home_id          uuid        NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  trigger_type     text        NOT NULL CHECK (trigger_type IN (
    'leave_approved', 'sickness_reported', 'training_expired',
    'occupancy_drop', 'occupancy_rise', 'no_show'
  )),
  trigger_entity_id uuid,      -- e.g. leave_request_id, sickness_episode_id
  status           text        NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'approved', 'dismissed', 'applied')),
  summary          text        NOT NULL,
  shift_ids_affected uuid[]    NOT NULL DEFAULT '{}',
  proposed_changes jsonb,      -- diff: [{shift_id, action, staff_id, reason}]
  cost_impact_pence integer    NOT NULL DEFAULT 0, -- negative = saving
  dismissed_reason  text,
  resolved_at      timestamptz,
  resolved_by_user_id uuid     REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid      REFERENCES users(id)
);

CREATE TRIGGER rebalance_suggestions_updated_at
  BEFORE UPDATE ON rebalance_suggestions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_rebalance_suggestions_home   ON rebalance_suggestions(home_id, status, created_at DESC);
CREATE INDEX idx_rebalance_suggestions_trigger ON rebalance_suggestions(home_id, trigger_type);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE rota_generation_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY rota_generation_audit_isolation ON rota_generation_audit
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);

CREATE POLICY rota_generation_audit_super_admin ON rota_generation_audit
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

CREATE POLICY rota_generation_audit_via_role ON rota_generation_audit
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = rota_generation_audit.home_id
        AND uhr.revoked_at IS NULL
    )
  );

ALTER TABLE rebalance_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY rebalance_suggestions_isolation ON rebalance_suggestions
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);

CREATE POLICY rebalance_suggestions_super_admin ON rebalance_suggestions
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

CREATE POLICY rebalance_suggestions_via_role ON rebalance_suggestions
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = rebalance_suggestions.home_id
        AND uhr.revoked_at IS NULL
    )
  );

-- Additional fallback policies for leave/sickness tables
CREATE POLICY leave_requests_via_role ON leave_requests
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = leave_requests.home_id
        AND uhr.revoked_at IS NULL
    )
  );

-- leave_balances_via_role already created in sprint2_additions migration

CREATE POLICY leave_year_month_summary_via_role ON leave_year_month_summary
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = leave_year_month_summary.home_id
        AND uhr.revoked_at IS NULL
    )
  );

CREATE POLICY sickness_episodes_via_role ON sickness_episodes
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = sickness_episodes.home_id
        AND uhr.revoked_at IS NULL
    )
  );
