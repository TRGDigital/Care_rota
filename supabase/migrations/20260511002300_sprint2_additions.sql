-- Sprint 2 additions: reference wage rates, document type enum extensions,
-- and uid-based RLS fallbacks for all home-scoped staff tables.

-- ============================================================
-- REFERENCE WAGE RATES (NMW/NLW floor table, org-scoped read)
-- ============================================================

CREATE TABLE reference_wage_rates (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v7(),
  effective_from  date        NOT NULL,
  effective_to    date,
  age_band        text        NOT NULL, -- '23+', '21-22', '18-20', 'under_18', 'apprentice'
  rate_pence      integer     NOT NULL CHECK (rate_pence > 0),
  label           text        NOT NULL, -- e.g. 'NLW 2026'
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_reference_wage_rate UNIQUE (age_band, effective_from)
);

-- 2026 NMW/NLW rates (effective 1 Apr 2026)
-- Use gen_random_uuid() (native PG17) to avoid pgcrypto search_path issues in uuid_generate_v7()
INSERT INTO reference_wage_rates (id, effective_from, age_band, rate_pence, label) VALUES
  (gen_random_uuid(), '2026-04-01', '23+',        1270, 'NLW 2026'),
  (gen_random_uuid(), '2026-04-01', '21-22',      1210, 'NMW 21-22 2026'),
  (gen_random_uuid(), '2026-04-01', '18-20',       860, 'NMW 18-20 2026'),
  (gen_random_uuid(), '2026-04-01', 'under_18',    620, 'NMW under-18 2026'),
  (gen_random_uuid(), '2026-04-01', 'apprentice',  620, 'NMW apprentice 2026');

-- RLS: any authenticated user can read (rates are public data)
ALTER TABLE reference_wage_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY reference_wage_rates_read ON reference_wage_rates
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- DOCUMENT TYPE ENUM — add missing values
-- ============================================================

ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'nmc_pin';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'driving_licence';

-- ============================================================
-- RLS UID-BASED FALLBACK POLICIES FOR STAFF TABLES
-- These work without the custom_access_token JWT hook.
-- Pattern: user has a non-revoked role in the staff member's home.
-- ============================================================

-- Helper subquery used by all policies below:
-- EXISTS (SELECT 1 FROM user_home_roles WHERE user_id = auth.uid() AND home_id = <table>.home_id AND revoked_at IS NULL)

CREATE POLICY staff_via_role ON staff
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = staff.home_id
        AND uhr.revoked_at IS NULL
    )
  );

CREATE POLICY staff_roles_via_role ON staff_roles
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = staff_roles.home_id
        AND uhr.revoked_at IS NULL
    )
  );

CREATE POLICY staff_contracts_via_role ON staff_contracts
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = staff_contracts.home_id
        AND uhr.revoked_at IS NULL
    )
  );

CREATE POLICY staff_fixed_shifts_via_role ON staff_fixed_shifts
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = staff_fixed_shifts.home_id
        AND uhr.revoked_at IS NULL
    )
  );

CREATE POLICY staff_pay_rates_via_role ON staff_pay_rates
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = staff_pay_rates.home_id
        AND uhr.revoked_at IS NULL
    )
  );

CREATE POLICY staff_documents_via_role ON staff_documents
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = staff_documents.home_id
        AND uhr.revoked_at IS NULL
    )
  );

CREATE POLICY staff_sponsorship_via_role ON staff_sponsorship
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = staff_sponsorship.home_id
        AND uhr.revoked_at IS NULL
    )
  );

CREATE POLICY staff_training_certs_via_role ON staff_training_certs
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = staff_training_certs.home_id
        AND uhr.revoked_at IS NULL
    )
  );

CREATE POLICY staff_training_attendances_via_role ON staff_training_attendances
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = staff_training_attendances.home_id
        AND uhr.revoked_at IS NULL
    )
  );

CREATE POLICY training_topics_via_role ON training_topics
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = training_topics.home_id
        AND uhr.revoked_at IS NULL
    )
  );

CREATE POLICY shift_pattern_templates_via_role ON shift_pattern_templates
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = shift_pattern_templates.home_id
        AND uhr.revoked_at IS NULL
    )
  );

CREATE POLICY leave_balances_via_role ON leave_balances
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = leave_balances.home_id
        AND uhr.revoked_at IS NULL
    )
  );

CREATE POLICY premium_pay_calendar_via_role ON premium_pay_calendar
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = premium_pay_calendar.home_id
        AND uhr.revoked_at IS NULL
    )
  );

-- Rota tables (needed for dashboard and rota views)
CREATE POLICY rota_periods_via_role ON rota_periods
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = rota_periods.home_id
        AND uhr.revoked_at IS NULL
    )
  );

CREATE POLICY shift_slots_via_role ON shift_slots
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = shift_slots.home_id
        AND uhr.revoked_at IS NULL
    )
  );

CREATE POLICY shifts_via_role ON shifts
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = shifts.home_id
        AND uhr.revoked_at IS NULL
    )
  );

CREATE POLICY beds_via_role ON beds
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = beds.home_id
        AND uhr.revoked_at IS NULL
    )
  );

CREATE POLICY bed_occupancy_snapshots_via_role ON bed_occupancy_snapshots
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = bed_occupancy_snapshots.home_id
        AND uhr.revoked_at IS NULL
    )
  );

CREATE POLICY audit_events_via_role ON audit_events
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = audit_events.home_id
        AND uhr.revoked_at IS NULL
    )
  );

CREATE POLICY chat_sessions_via_role ON chat_sessions
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = chat_sessions.home_id
        AND uhr.revoked_at IS NULL
    )
  );

CREATE POLICY chat_messages_via_role ON chat_messages
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = chat_messages.home_id
        AND uhr.revoked_at IS NULL
    )
  );

CREATE POLICY rag_chunks_via_role ON rag_chunks
  USING (
    EXISTS (
      SELECT 1 FROM user_home_roles uhr
      WHERE uhr.user_id = auth.uid()
        AND uhr.home_id = rag_chunks.home_id
        AND uhr.revoked_at IS NULL
    )
  );
