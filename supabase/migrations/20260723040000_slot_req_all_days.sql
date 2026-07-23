-- Slot requirements: allow a single "every day" rule instead of seven per-day rows.
-- A NULL day_of_week means the requirement applies to every day of the period. This keeps
-- carer staffing (which rarely changes day to day) to one row, so overtime/weighting is easier
-- to reason about and admins do far less setup.

ALTER TABLE rota_slot_requirements
  ALTER COLUMN day_of_week DROP NOT NULL;

-- The original UNIQUE (home_id, day_of_week, template, role) does not catch duplicate all-day
-- rows because NULLs compare as distinct. Add a partial unique index for the all-day case.
CREATE UNIQUE INDEX IF NOT EXISTS uq_rota_slot_req_allday
  ON rota_slot_requirements (home_id, shift_pattern_template_id, role_code)
  WHERE day_of_week IS NULL;
