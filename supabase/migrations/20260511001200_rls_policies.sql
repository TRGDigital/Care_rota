-- ============================================================
-- ROW-LEVEL SECURITY POLICIES
-- Pattern: auth.jwt() ->> 'active_home_id' for home-scoped tables
--          auth.jwt() ->> 'organisation_id' for org-scoped tables
-- Super-admin bypass on every table uses role claim from JWT.
-- ============================================================

-- Helper: extract active_home_id from JWT as uuid
-- Helper: extract organisation_id from JWT as uuid
-- (Inlined in each policy for clarity; Postgres optimises repeated expressions.)

-- ============================================================
-- ORGANISATIONS (org-scoped)
-- ============================================================

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

CREATE POLICY organisations_tenant_isolation ON organisations
  USING (id = (auth.jwt() ->> 'organisation_id')::uuid);

CREATE POLICY organisations_super_admin ON organisations
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

-- ============================================================
-- HOMES (org-scoped: a manager can see all homes in their org)
-- ============================================================

ALTER TABLE homes ENABLE ROW LEVEL SECURITY;

CREATE POLICY homes_tenant_isolation ON homes
  USING (organisation_id = (auth.jwt() ->> 'organisation_id')::uuid);

CREATE POLICY homes_super_admin ON homes
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

-- ============================================================
-- USERS / USER_HOME_ROLES (org-scoped)
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_own_profile ON users
  USING (id = auth.uid());

CREATE POLICY users_same_org ON users
  USING (organisation_id = (auth.jwt() ->> 'organisation_id')::uuid);

CREATE POLICY users_super_admin ON users
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE user_home_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_home_roles_tenant_isolation ON user_home_roles
  USING (organisation_id = (auth.jwt() ->> 'organisation_id')::uuid);

CREATE POLICY user_home_roles_super_admin ON user_home_roles
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

-- ============================================================
-- STAFF CORE (home-scoped)
-- ============================================================

ALTER TABLE staff_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_roles_isolation ON staff_roles
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY staff_roles_super_admin ON staff_roles
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE shift_pattern_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY shift_pattern_templates_isolation ON shift_pattern_templates
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY shift_pattern_templates_super_admin ON shift_pattern_templates
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_isolation ON staff
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY staff_super_admin ON staff
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE staff_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_contracts_isolation ON staff_contracts
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY staff_contracts_super_admin ON staff_contracts
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE staff_fixed_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_fixed_shifts_isolation ON staff_fixed_shifts
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY staff_fixed_shifts_super_admin ON staff_fixed_shifts
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE staff_pay_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_pay_rates_isolation ON staff_pay_rates
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY staff_pay_rates_super_admin ON staff_pay_rates
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

-- ============================================================
-- STAFF COMPLIANCE (home-scoped)
-- ============================================================

ALTER TABLE training_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY training_topics_isolation ON training_topics
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY training_topics_super_admin ON training_topics
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE staff_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_documents_isolation ON staff_documents
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY staff_documents_super_admin ON staff_documents
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE staff_sponsorship ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_sponsorship_isolation ON staff_sponsorship
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY staff_sponsorship_super_admin ON staff_sponsorship
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE staff_training_certs ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_training_certs_isolation ON staff_training_certs
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY staff_training_certs_super_admin ON staff_training_certs
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE staff_training_attendances ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_training_attendances_isolation ON staff_training_attendances
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY staff_training_attendances_super_admin ON staff_training_attendances
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

-- ============================================================
-- ROTA (home-scoped)
-- ============================================================

ALTER TABLE rota_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY rota_periods_isolation ON rota_periods
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY rota_periods_super_admin ON rota_periods
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE shift_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY shift_slots_isolation ON shift_slots
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY shift_slots_super_admin ON shift_slots
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY shifts_isolation ON shifts
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY shifts_super_admin ON shifts
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE shift_clockings ENABLE ROW LEVEL SECURITY;
CREATE POLICY shift_clockings_isolation ON shift_clockings
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY shift_clockings_super_admin ON shift_clockings
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE shifts_actual ENABLE ROW LEVEL SECURITY;
CREATE POLICY shifts_actual_isolation ON shifts_actual
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY shifts_actual_super_admin ON shifts_actual
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE shift_swaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY shift_swaps_isolation ON shift_swaps
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY shift_swaps_super_admin ON shift_swaps
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE shifts_payable ENABLE ROW LEVEL SECURITY;
CREATE POLICY shifts_payable_isolation ON shifts_payable
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY shifts_payable_super_admin ON shifts_payable
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE premium_pay_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY premium_pay_calendar_isolation ON premium_pay_calendar
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY premium_pay_calendar_super_admin ON premium_pay_calendar
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

-- ============================================================
-- T&A HARDWARE (home-scoped)
-- ============================================================

ALTER TABLE kiosks ENABLE ROW LEVEL SECURITY;
CREATE POLICY kiosks_isolation ON kiosks
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY kiosks_super_admin ON kiosks
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE nfc_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY nfc_badges_isolation ON nfc_badges
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY nfc_badges_super_admin ON nfc_badges
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE staff_kiosk_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_kiosk_pins_isolation ON staff_kiosk_pins
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY staff_kiosk_pins_super_admin ON staff_kiosk_pins
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE geofences ENABLE ROW LEVEL SECURITY;
CREATE POLICY geofences_isolation ON geofences
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY geofences_super_admin ON geofences
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

-- ============================================================
-- LEAVE & SICKNESS (home-scoped)
-- Staff can see their own leave requests; managers see all.
-- ============================================================

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY leave_requests_isolation ON leave_requests
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY leave_requests_super_admin ON leave_requests
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY leave_balances_isolation ON leave_balances
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY leave_balances_super_admin ON leave_balances
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE leave_year_month_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY leave_year_month_summary_isolation ON leave_year_month_summary
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY leave_year_month_summary_super_admin ON leave_year_month_summary
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE sickness_episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY sickness_episodes_isolation ON sickness_episodes
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY sickness_episodes_super_admin ON sickness_episodes
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE statutory_payment_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY statutory_payment_records_isolation ON statutory_payment_records
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY statutory_payment_records_super_admin ON statutory_payment_records
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

-- ============================================================
-- PAYROLL (home-scoped)
-- Accountant role sees pay_runs, payslips, payslip_lines, payroll_exports
-- for their invited home only — enforced by the same home_id policy.
-- ============================================================

ALTER TABLE pay_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY pay_cycles_isolation ON pay_cycles
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY pay_cycles_super_admin ON pay_cycles
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE pay_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY pay_periods_isolation ON pay_periods
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY pay_periods_super_admin ON pay_periods
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE pay_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY pay_runs_isolation ON pay_runs
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY pay_runs_super_admin ON pay_runs
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
CREATE POLICY payslips_isolation ON payslips
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY payslips_super_admin ON payslips
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE payslip_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY payslip_lines_isolation ON payslip_lines
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY payslip_lines_super_admin ON payslip_lines
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE payroll_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY payroll_exports_isolation ON payroll_exports
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY payroll_exports_super_admin ON payroll_exports
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE accountant_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY accountant_invitations_isolation ON accountant_invitations
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY accountant_invitations_super_admin ON accountant_invitations
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

-- ============================================================
-- OVERRIDES & AUDIT (home-scoped; INSERT already revoked above)
-- ============================================================

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_events_isolation ON audit_events
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY audit_events_super_admin ON audit_events
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE rule_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY rule_overrides_isolation ON rule_overrides
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY rule_overrides_super_admin ON rule_overrides
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE rule_override_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY rule_override_reviews_isolation ON rule_override_reviews
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY rule_override_reviews_super_admin ON rule_override_reviews
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

-- ============================================================
-- OCCUPANCY (home-scoped)
-- ============================================================

ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
CREATE POLICY beds_isolation ON beds
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY beds_super_admin ON beds
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE bed_occupancy_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY bed_occupancy_snapshots_isolation ON bed_occupancy_snapshots
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY bed_occupancy_snapshots_super_admin ON bed_occupancy_snapshots
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE dependency_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY dependency_assessments_isolation ON dependency_assessments
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY dependency_assessments_super_admin ON dependency_assessments
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE staffing_matrices ENABLE ROW LEVEL SECURITY;
CREATE POLICY staffing_matrices_isolation ON staffing_matrices
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY staffing_matrices_super_admin ON staffing_matrices
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

-- ============================================================
-- AI / CHAT (home-scoped)
-- ============================================================

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_sessions_isolation ON chat_sessions
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY chat_sessions_super_admin ON chat_sessions
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_messages_isolation ON chat_messages
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY chat_messages_super_admin ON chat_messages
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

ALTER TABLE rag_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY rag_chunks_isolation ON rag_chunks
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
CREATE POLICY rag_chunks_super_admin ON rag_chunks
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');
