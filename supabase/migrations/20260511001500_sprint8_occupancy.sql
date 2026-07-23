-- ============================================================
-- Sprint 8: Savings tracking
-- cost_savings_log records every real saving realised by:
--   - occupancy-aware rebalancer approvals
--   - no-show/no-pay reconciliation
--   - training-overlap top-up suppression
--   - planned-vs-actual hour gaps
-- Drives the "Savings to date" tile on the owner dashboard.
-- INSERT-only for authenticated (same pattern as audit tables).
-- ============================================================

CREATE TABLE cost_savings_log (
  id                   uuid        PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id            uuid        NOT NULL,               -- = home_id
  home_id              uuid        NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  source               text        NOT NULL CHECK (source IN (
                                     'occupancy_rebalance',
                                     'no_show_no_pay',
                                     'training_overlap_no_top_up',
                                     'planned_vs_actual_gap'
                                   )),
  savings_pence        bigint      NOT NULL CHECK (savings_pence > 0),
  related_entity_type  text,
  related_entity_id    uuid,
  recorded_at          timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by_user_id   uuid        REFERENCES users(id)
);

CREATE INDEX cost_savings_log_home_idx ON cost_savings_log(home_id, recorded_at DESC);

ALTER TABLE cost_savings_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY cost_savings_log_tenant_isolation ON cost_savings_log
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);

CREATE POLICY cost_savings_log_super_admin ON cost_savings_log
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

-- INSERT-only for authenticated (mirrors audit_events / rule_overrides pattern)
REVOKE UPDATE, DELETE ON cost_savings_log FROM authenticated;
