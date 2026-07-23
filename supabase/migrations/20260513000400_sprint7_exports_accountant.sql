-- Sprint 7: Payroll Exports & Accountant Portal

-- ── Extend pay_cycles ────────────────────────────────────────────────────────
ALTER TABLE pay_cycles
  ADD COLUMN IF NOT EXISTS preferred_export_format
    export_format NOT NULL DEFAULT 'generic_csv';

-- ── Extend pay_runs ───────────────────────────────────────────────────────────
ALTER TABLE pay_runs
  ADD COLUMN IF NOT EXISTS marked_filed_at        timestamptz,
  ADD COLUMN IF NOT EXISTS marked_filed_by_user_id uuid REFERENCES users(id);

-- ── Extend accountant_invitations (table created in Sprint 0) ────────────────
ALTER TABLE accountant_invitations
  ADD COLUMN IF NOT EXISTS name                  text,
  ADD COLUMN IF NOT EXISTS firm_name             text,
  ADD COLUMN IF NOT EXISTS token_hash            text UNIQUE,
  ADD COLUMN IF NOT EXISTS expires_at            timestamptz,
  ADD COLUMN IF NOT EXISTS user_id               uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS organisation_id       uuid REFERENCES organisations(id),
  ADD COLUMN IF NOT EXISTS revoked_by_user_id    uuid REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_accountant_invitations_token ON accountant_invitations(token_hash) WHERE token_hash IS NOT NULL AND accepted_at IS NULL AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_accountant_invitations_home  ON accountant_invitations(home_id);
CREATE INDEX IF NOT EXISTS idx_accountant_invitations_email ON accountant_invitations(email);

-- ── Payroll comments ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_comments (
  id                uuid        PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id         uuid        NOT NULL,
  home_id           uuid        NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  pay_run_id        uuid        NOT NULL REFERENCES pay_runs(id) ON DELETE CASCADE,
  payslip_id        uuid        REFERENCES payslips(id),
  payslip_line_id   uuid        REFERENCES payslip_lines(id),
  parent_comment_id uuid        REFERENCES payroll_comments(id),
  author_user_id    uuid        NOT NULL REFERENCES users(id),
  body              text        NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid       REFERENCES users(id),
  updated_by_user_id uuid       REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_comments_run     ON payroll_comments(pay_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_comments_payslip ON payroll_comments(payslip_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE accountant_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_comments        ENABLE ROW LEVEL SECURITY;

-- accountant_invitations: tenant isolation by home or org
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'accountant_invitations' AND policyname = 'accountant_invitations_tenant'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY accountant_invitations_tenant ON accountant_invitations
        USING (
          home_id = (auth.jwt() ->> 'active_home_id')::uuid
          OR (role_scope = 'org' AND organisation_id IN (
            SELECT organisation_id FROM homes
            WHERE id = (auth.jwt() ->> 'active_home_id')::uuid
          ))
        )
    $policy$;
  END IF;
END $$;

-- payroll_comments: home isolation
CREATE POLICY payroll_comments_tenant ON payroll_comments
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);

-- payroll_comments INSERT
CREATE POLICY payroll_comments_insert ON payroll_comments
  FOR INSERT WITH CHECK (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
