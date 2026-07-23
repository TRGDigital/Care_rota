-- ============================================================
-- T&A HARDWARE
-- All tables home-scoped: tenant_id = home_id
-- ============================================================

CREATE TABLE kiosks (
  id                   uuid    PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id            uuid    NOT NULL,
  home_id              uuid    NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  name                 text    NOT NULL,
  location_description text,
  pairing_token        text    UNIQUE,    -- short-lived token used during iPad provisioning
  last_seen_at         timestamptz,
  lockdown_pin         text,              -- PIN to exit kiosk Guided Access mode
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  created_by_user_id   uuid REFERENCES users(id),
  updated_by_user_id   uuid REFERENCES users(id)
);

CREATE TRIGGER kiosks_updated_at
  BEFORE UPDATE ON kiosks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_kiosks_home ON kiosks(home_id);

-- Back-fill FK deferred from 20260511000500_rota.sql
ALTER TABLE shift_clockings
  ADD CONSTRAINT fk_clocking_kiosk
  FOREIGN KEY (kiosk_id) REFERENCES kiosks(id) ON DELETE SET NULL;

-- ============================================================

CREATE TABLE nfc_badges (
  id             uuid    PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id      uuid    NOT NULL,
  home_id        uuid    NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  staff_id       uuid    NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  nfc_uid        text    NOT NULL,
  issued_at      timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(id),
  updated_by_user_id uuid REFERENCES users(id),

  CONSTRAINT uq_nfc_uid UNIQUE (nfc_uid)
);

CREATE TRIGGER nfc_badges_updated_at
  BEFORE UPDATE ON nfc_badges FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_nfc_badges_staff ON nfc_badges(staff_id);
CREATE INDEX idx_nfc_badges_uid   ON nfc_badges(nfc_uid) WHERE deactivated_at IS NULL;

-- ============================================================

CREATE TABLE staff_kiosk_pins (
  staff_id         uuid    PRIMARY KEY REFERENCES staff(id) ON DELETE CASCADE,
  tenant_id        uuid    NOT NULL,
  home_id          uuid    NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  pin_hash         text    NOT NULL,
  attempts         smallint NOT NULL DEFAULT 0,
  last_reset_at    timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(id),
  updated_by_user_id uuid REFERENCES users(id)
);

CREATE TRIGGER staff_kiosk_pins_updated_at
  BEFORE UPDATE ON staff_kiosk_pins FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================

CREATE TABLE geofences (
  id             uuid    PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id      uuid    NOT NULL,
  home_id        uuid    NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  centre_lat     numeric(9,6) NOT NULL,
  centre_lng     numeric(9,6) NOT NULL,
  radius_metres  integer NOT NULL DEFAULT 100 CHECK (radius_metres > 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(id),
  updated_by_user_id uuid REFERENCES users(id)
);

CREATE TRIGGER geofences_updated_at
  BEFORE UPDATE ON geofences FOR EACH ROW EXECUTE FUNCTION set_updated_at();
