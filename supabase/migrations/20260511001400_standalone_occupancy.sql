-- ============================================================
-- Pre-Sprint-8: Standalone-first occupancy model
--
-- The original dependency_assessments.resident_id was a bare
-- UUID pointing at a CareStream resident with no local FK.
-- This migration:
--   1. Creates the dependency_source provenance enum.
--   2. Migrates that UUID to external_resident_ref (text).
--   3. Creates the residents table (CareRota-owned, minimal PII).
--   4. Re-adds resident_id as a proper FK to residents(id).
-- ============================================================

-- 1. Provenance enum ──────────────────────────────────────────

CREATE TYPE dependency_source AS ENUM (
  'carerota_native',
  'imported_from_carestream',
  'manual_csv'
);

-- 2. Residents table ─────────────────────────────────────────
-- Minimal PII: first name + last-name initial + room number.
-- Full surname and clinical data are never stored in CareRota.
-- Discharged residents are soft-deleted via discharge_date so
-- audit history and historical assessments remain intact.

CREATE TABLE residents (
  id                    uuid              PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id             uuid              NOT NULL,                   -- = home_id; set on insert
  home_id               uuid              NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  first_name            text              NOT NULL,
  last_name_initial     text,                                         -- "S" not "Smith"
  room_number           text,
  admission_date        date,
  discharge_date        date,                                         -- null = still resident
  source                dependency_source NOT NULL DEFAULT 'carerota_native',
  external_resident_ref text,                                         -- CareStream resident_id when integrated
  notes                 text,
  created_at            timestamptz       NOT NULL DEFAULT now(),
  updated_at            timestamptz       NOT NULL DEFAULT now(),
  created_by_user_id    uuid              REFERENCES users(id),
  updated_by_user_id    uuid              REFERENCES users(id)
);

CREATE TRIGGER residents_updated_at
  BEFORE UPDATE ON residents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX residents_home_idx    ON residents(home_id);
CREATE INDEX residents_active_idx  ON residents(home_id) WHERE discharge_date IS NULL;
CREATE INDEX residents_ext_ref_idx ON residents(home_id, external_resident_ref)
  WHERE external_resident_ref IS NOT NULL;

ALTER TABLE residents ENABLE ROW LEVEL SECURITY;

CREATE POLICY residents_tenant_isolation ON residents
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);

CREATE POLICY residents_super_admin ON residents
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

-- 3. Rework dependency_assessments ───────────────────────────
-- Old resident_id: bare uuid pointing at CareStream, no local FK.
-- New design:
--   external_resident_ref text  — old value preserved as text
--   source                      — provenance
--   assessed_by_user_id         — who recorded the assessment
--   resident_id (new)           — nullable FK to residents(id)

-- 3a. Preserve old CareStream UUID in the new text column
ALTER TABLE dependency_assessments
  ADD COLUMN external_resident_ref text;

UPDATE dependency_assessments
  SET external_resident_ref = resident_id::text;

-- 3b. Drop old column (bare UUID, no FK — safe to remove)
DROP INDEX IF EXISTS idx_dependency_assessments_resident;
ALTER TABLE dependency_assessments DROP COLUMN resident_id;

-- 3c. Add new columns
ALTER TABLE dependency_assessments
  ADD COLUMN source               dependency_source NOT NULL DEFAULT 'carerota_native',
  ADD COLUMN assessed_by_user_id  uuid REFERENCES users(id),
  ADD COLUMN resident_id          uuid REFERENCES residents(id) ON DELETE RESTRICT;

-- 3d. Recreate resident lookup index on new FK
CREATE INDEX idx_dependency_assessments_resident
  ON dependency_assessments(resident_id)
  WHERE resident_id IS NOT NULL;
