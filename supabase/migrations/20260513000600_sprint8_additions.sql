-- ── Sprint 8 additions ───────────────────────────────────────────────────────
-- Small additions; all main sprint-8 tables were created in sprint-0 preflight.

-- 1. Provenance on occupancy snapshots
--    Distinguishes manual entry, CareStream API pull, and CSV import.
ALTER TABLE bed_occupancy_snapshots
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'carestream_api', 'csv_import'));

-- 2. bed_capacity on snapshot for convenience (denormalised from homes.bed_capacity)
ALTER TABLE bed_occupancy_snapshots
  ADD COLUMN IF NOT EXISTS bed_capacity smallint;

-- 3. Indexes to support cost guard lookups
CREATE INDEX IF NOT EXISTS idx_dep_assessments_band_home
  ON dependency_assessments(home_id, overall_band, assessment_date DESC);

CREATE INDEX IF NOT EXISTS idx_cost_savings_source
  ON cost_savings_log(home_id, source, recorded_at DESC);

-- 4. Add 'generic' to export_format enum (DB side)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'export_format'::regtype AND enumlabel = 'generic'
  ) THEN
    ALTER TYPE export_format ADD VALUE 'generic';
  END IF;
END $$;

-- 5. Sponsorship: add current_week_hours for cost guard display
ALTER TABLE staff_sponsorship
  ADD COLUMN IF NOT EXISTS notes text;

-- 6. Override digest: track last digest sent per home
CREATE TABLE IF NOT EXISTS override_digest_log (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id   uuid        NOT NULL,
  home_id     uuid        NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  sent_at     timestamptz NOT NULL DEFAULT now(),
  period_start date       NOT NULL,
  period_end   date       NOT NULL,
  override_count integer  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_override_digest_log_home
  ON override_digest_log(home_id, sent_at DESC);
