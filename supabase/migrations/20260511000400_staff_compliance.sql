-- ============================================================
-- STAFF COMPLIANCE
-- All tables home-scoped: tenant_id = home_id
-- ============================================================

CREATE TABLE training_topics (
  id                      uuid    PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id               uuid    NOT NULL,
  home_id                 uuid    NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  code                    text    NOT NULL,
  name                    text    NOT NULL,
  renewal_interval_months smallint NOT NULL CHECK (renewal_interval_months > 0),
  -- hard = blocks shift assignment; soft = warning only
  enforcement_mode        text    NOT NULL DEFAULT 'hard' CHECK (enforcement_mode IN ('hard', 'soft')),
  applies_to_role_codes   text[]  NOT NULL DEFAULT '{}',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  created_by_user_id      uuid REFERENCES users(id),
  updated_by_user_id      uuid REFERENCES users(id),

  CONSTRAINT uq_training_topic_code UNIQUE (home_id, code)
);

CREATE TRIGGER training_topics_updated_at
  BEFORE UPDATE ON training_topics FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================

CREATE TABLE staff_documents (
  id                 uuid          PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id          uuid          NOT NULL,
  home_id            uuid          NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  staff_id           uuid          NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  doc_type           document_type NOT NULL,
  document_number    text,
  issue_date         date,
  expiry_date        date,
  file_url           text,
  verified_by_user_id uuid         REFERENCES users(id),
  verified_at        timestamptz,
  created_at         timestamptz   NOT NULL DEFAULT now(),
  updated_at         timestamptz   NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(id),
  updated_by_user_id uuid REFERENCES users(id)
);

CREATE TRIGGER staff_documents_updated_at
  BEFORE UPDATE ON staff_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_staff_documents_staff   ON staff_documents(staff_id);
CREATE INDEX idx_staff_documents_expiry  ON staff_documents(home_id, expiry_date) WHERE expiry_date IS NOT NULL;

-- ============================================================

CREATE TABLE staff_sponsorship (
  id                      uuid    PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id               uuid    NOT NULL,
  home_id                 uuid    NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  staff_id                uuid    NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  cos_reference           text    NOT NULL,
  sponsor_licence_number  text    NOT NULL,
  route                   text    NOT NULL, -- e.g. 'skilled_worker'
  minimum_hours_per_week  numeric(5,2) NOT NULL CHECK (minimum_hours_per_week > 0),
  cos_start_date          date    NOT NULL,
  cos_end_date            date    NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  created_by_user_id      uuid REFERENCES users(id),
  updated_by_user_id      uuid REFERENCES users(id),

  CONSTRAINT chk_cos_dates CHECK (cos_end_date > cos_start_date)
);

CREATE TRIGGER staff_sponsorship_updated_at
  BEFORE UPDATE ON staff_sponsorship FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_staff_sponsorship_staff   ON staff_sponsorship(staff_id);
CREATE INDEX idx_staff_sponsorship_expiry  ON staff_sponsorship(home_id, cos_end_date);

-- ============================================================

CREATE TABLE staff_training_certs (
  id               uuid    PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id        uuid    NOT NULL,
  home_id          uuid    NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  staff_id         uuid    NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  training_topic_id uuid   NOT NULL REFERENCES training_topics(id) ON DELETE RESTRICT,
  issue_date       date    NOT NULL,
  expiry_date      date,
  certificate_url  text,
  source           text    NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'imported', 'system')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(id),
  updated_by_user_id uuid REFERENCES users(id)
);

CREATE TRIGGER staff_training_certs_updated_at
  BEFORE UPDATE ON staff_training_certs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_training_certs_staff   ON staff_training_certs(staff_id);
CREATE INDEX idx_training_certs_expiry  ON staff_training_certs(home_id, expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX idx_training_certs_topic   ON staff_training_certs(training_topic_id);

-- ============================================================
-- Links a training session to its payroll consequence.
-- overlap_shift_id: if the session overlapped an existing shift,
-- no top-up is paid. See spec Section 8.5.
-- ============================================================

CREATE TABLE staff_training_attendances (
  id                uuid        PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id         uuid        NOT NULL,
  home_id           uuid        NOT NULL REFERENCES homes(id) ON DELETE RESTRICT,
  staff_id          uuid        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  training_topic_id uuid        NOT NULL REFERENCES training_topics(id) ON DELETE RESTRICT,
  session_start_utc timestamptz NOT NULL,
  session_end_utc   timestamptz NOT NULL,
  attended          boolean     NOT NULL DEFAULT true,
  paid_status       paid_status NOT NULL DEFAULT 'skipped',
  overlap_shift_id  uuid,       -- FK to shifts added in 20260511000500_rota.sql
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(id),
  updated_by_user_id uuid REFERENCES users(id),

  CONSTRAINT chk_training_session_times CHECK (session_end_utc > session_start_utc)
);

CREATE TRIGGER staff_training_attendances_updated_at
  BEFORE UPDATE ON staff_training_attendances FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_training_attendances_staff ON staff_training_attendances(staff_id);
CREATE INDEX idx_training_attendances_date  ON staff_training_attendances(home_id, session_start_utc);
