-- Role-level overtime policy default. New staff inherit their role's policy:
--   'eligible'          → hands-on roles (nurse / senior carer / carer) get overtime by default
--   'approval_required' → ancillary roles (admin, kitchen, cleaner, laundry, etc.) only with sign-off
-- The engine still reads the per-staff staff.overtime_eligible flag; this drives its default + UI.
ALTER TABLE staff_roles
  ADD COLUMN overtime_policy text NOT NULL DEFAULT 'approval_required'
  CHECK (overtime_policy IN ('eligible', 'approval_required'));
