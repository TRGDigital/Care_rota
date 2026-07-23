-- ============================================================
-- DEPENDENCY & OCCUPANCY
-- All tables home-scoped: tenant_id = home_id
-- ============================================================

CREATE TABLE beds (
  id          uuid       PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id   uuid       NOT NULL,
  home_id     uuid       NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  room_number text       NOT NULL,
  capacity    smallint   NOT NULL DEFAULT 1 CHECK (capacity > 0),
  status      bed_status NOT NULL DEFAULT 'vacant',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(id),
  updated_by_user_id uuid REFERENCES users(id),

  CONSTRAINT uq_bed_room UNIQUE (home_id, room_number)
);

CREATE TRIGGER beds_updated_at
  BEFORE UPDATE ON beds FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_beds_home   ON beds(home_id);
CREATE INDEX idx_beds_status ON beds(home_id, status);

-- ============================================================

CREATE TABLE bed_occupancy_snapshots (
  id                                uuid    PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id                         uuid    NOT NULL,
  home_id                           uuid    NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  snapshot_at                       timestamptz NOT NULL DEFAULT now(),
  occupied_beds                     smallint NOT NULL CHECK (occupied_beds >= 0),
  vacant_beds                       smallint NOT NULL CHECK (vacant_beds >= 0),
  expected_admissions_next_7_days   smallint NOT NULL DEFAULT 0 CHECK (expected_admissions_next_7_days >= 0),
  expected_discharges_next_7_days   smallint NOT NULL DEFAULT 0 CHECK (expected_discharges_next_7_days >= 0),
  created_at                        timestamptz NOT NULL DEFAULT now(),
  updated_at                        timestamptz NOT NULL DEFAULT now(),
  created_by_user_id                uuid REFERENCES users(id),
  updated_by_user_id                uuid REFERENCES users(id)
);

CREATE TRIGGER bed_occupancy_snapshots_updated_at
  BEFORE UPDATE ON bed_occupancy_snapshots FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_bed_occupancy_snapshots ON bed_occupancy_snapshots(home_id, snapshot_at DESC);

-- ============================================================
-- Dependency assessments reference a CareStream resident_id.
-- No local FK — resolved via CareStream internal API call.
-- ============================================================

CREATE TABLE dependency_assessments (
  id                      uuid    PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id               uuid    NOT NULL,
  home_id                 uuid    NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  resident_id             uuid    NOT NULL, -- CareStream resident; no local FK
  assessment_date         date    NOT NULL,
  mobility_score          smallint NOT NULL CHECK (mobility_score BETWEEN 0 AND 5),
  continence_score        smallint NOT NULL CHECK (continence_score BETWEEN 0 AND 5),
  cognition_score         smallint NOT NULL CHECK (cognition_score BETWEEN 0 AND 5),
  behaviour_score         smallint NOT NULL CHECK (behaviour_score BETWEEN 0 AND 5),
  clinical_complexity_score smallint NOT NULL CHECK (clinical_complexity_score BETWEEN 0 AND 5),
  overall_band            text    NOT NULL CHECK (overall_band IN ('low', 'medium', 'high', 'one_to_one')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  created_by_user_id      uuid REFERENCES users(id),
  updated_by_user_id      uuid REFERENCES users(id)
);

CREATE TRIGGER dependency_assessments_updated_at
  BEFORE UPDATE ON dependency_assessments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_dependency_assessments_home     ON dependency_assessments(home_id, assessment_date DESC);
CREATE INDEX idx_dependency_assessments_resident ON dependency_assessments(resident_id);

-- ============================================================
-- Staffing matrices: minimum headcount per dependency band.
-- Drives auto-rebalance when occupancy changes.
-- ============================================================

CREATE TABLE staffing_matrices (
  id                    uuid    PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id             uuid    NOT NULL,
  home_id               uuid    NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  name                  text    NOT NULL,
  shift_block           text    NOT NULL, -- e.g. 'long_day', 'long_night', 'short'
  low_dep_threshold     smallint NOT NULL DEFAULT 0,
  medium_dep_threshold  smallint NOT NULL DEFAULT 0,
  high_dep_threshold    smallint NOT NULL DEFAULT 0,
  one_to_one_factor     numeric(4,2) NOT NULL DEFAULT 1.00,
  min_carers            smallint NOT NULL DEFAULT 0,
  min_senior_carers     smallint NOT NULL DEFAULT 0,
  min_nurses            smallint NOT NULL DEFAULT 0,
  min_ancillary         smallint NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by_user_id    uuid REFERENCES users(id),
  updated_by_user_id    uuid REFERENCES users(id)
);

CREATE TRIGGER staffing_matrices_updated_at
  BEFORE UPDATE ON staffing_matrices FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_staffing_matrices_home ON staffing_matrices(home_id);
