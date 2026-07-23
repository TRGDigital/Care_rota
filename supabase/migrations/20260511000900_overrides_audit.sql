-- ============================================================
-- OVERRIDES & AUDIT
-- These tables are INSERT-only for the application role.
-- No UPDATE or DELETE grants are issued to 'authenticated'.
-- Retention pruning is superuser-only via a scheduled job.
-- ============================================================

-- Generic immutable audit log — every state change writes a row here.
-- No updated_at: this table is append-only by design.
CREATE TABLE audit_events (
  id             uuid    PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id      uuid    NOT NULL,   -- = home_id for home-level events, org_id for org-level
  home_id        uuid    REFERENCES homes(id) ON DELETE SET NULL,
  actor_user_id  uuid    REFERENCES users(id) ON DELETE SET NULL,
  action_code    text    NOT NULL,   -- e.g. 'shift.published', 'pay_run.approved'
  entity_type    text    NOT NULL,   -- e.g. 'shift', 'pay_run'
  entity_id      uuid    NOT NULL,
  before_state_json jsonb,
  after_state_json  jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_events_tenant ON audit_events(tenant_id, created_at DESC);
CREATE INDEX idx_audit_events_entity ON audit_events(entity_type, entity_id);
CREATE INDEX idx_audit_events_actor  ON audit_events(actor_user_id);

-- ============================================================
-- Every manager override of a hard rule is a row here.
-- No UPDATE or DELETE grants. Cannot be amended after insert.
-- ============================================================

CREATE TABLE rule_overrides (
  id                    uuid       PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id             uuid       NOT NULL,
  home_id               uuid       NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  rule_code             text       NOT NULL,   -- e.g. 'wtr_11hr_rest', 'training_expired_safeguarding'
  entity_type           text       NOT NULL,
  entity_id             uuid       NOT NULL,
  blocked_action        text       NOT NULL,   -- e.g. 'publish_shift'
  reason_category       text       NOT NULL,   -- from per-rule enum
  justification         text       NOT NULL CHECK (char_length(justification) >= 20),
  overridden_by_user_id uuid       NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  overridden_at         timestamptz NOT NULL DEFAULT now(),
  mfa_method            mfa_method NOT NULL,
  before_state_json     jsonb,
  after_state_json      jsonb,
  created_at            timestamptz NOT NULL DEFAULT now()
  -- No updated_at: immutable
);

CREATE INDEX idx_rule_overrides_home      ON rule_overrides(home_id, overridden_at DESC);
CREATE INDEX idx_rule_overrides_rule      ON rule_overrides(home_id, rule_code);
CREATE INDEX idx_rule_overrides_entity    ON rule_overrides(entity_type, entity_id);
CREATE INDEX idx_rule_overrides_manager   ON rule_overrides(overridden_by_user_id);

-- ============================================================
-- Weekly review acknowledgements by the registered manager.
-- ============================================================

CREATE TABLE rule_override_reviews (
  id                    uuid    PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id             uuid    NOT NULL,
  home_id               uuid    NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  reviewer_user_id      uuid    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  period_start          date    NOT NULL,
  period_end            date    NOT NULL,
  override_ids_reviewed uuid[]  NOT NULL DEFAULT '{}',
  reviewed_at           timestamptz NOT NULL DEFAULT now(),
  comments              text,
  created_at            timestamptz NOT NULL DEFAULT now()
  -- No updated_at: immutable
);

CREATE INDEX idx_override_reviews_home ON rule_override_reviews(home_id, reviewed_at DESC);

-- ============================================================
-- Enforce INSERT-only for the 'authenticated' role.
-- Supabase uses 'authenticated' for logged-in users.
-- The service_role bypasses RLS and retains full access
-- for support tooling and scheduled retention pruning.
-- ============================================================

REVOKE UPDATE, DELETE ON audit_events        FROM authenticated;
REVOKE UPDATE, DELETE ON rule_overrides      FROM authenticated;
REVOKE UPDATE, DELETE ON rule_override_reviews FROM authenticated;
