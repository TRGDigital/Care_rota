CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- UUID v7: time-ordered, sortable, uses millisecond unix timestamp in first 48 bits.
-- Requires pgcrypto for gen_random_bytes().
CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  ts_ms bigint  := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  r     bytea   := gen_random_bytes(10);
  hex   text    :=
    lpad(to_hex(ts_ms), 12, '0')
    || '7'
    || lpad(to_hex(get_byte(r, 0)), 2, '0')
    || to_hex(get_byte(r, 1) >> 4)
    || lpad(to_hex((get_byte(r, 2) & 63) | 128), 2, '0')
    || lpad(to_hex(get_byte(r, 3)), 2, '0')
    || lpad(to_hex(get_byte(r, 4)), 2, '0')
    || lpad(to_hex(get_byte(r, 5)), 2, '0')
    || lpad(to_hex(get_byte(r, 6)), 2, '0')
    || lpad(to_hex(get_byte(r, 7)), 2, '0')
    || lpad(to_hex(get_byte(r, 8)), 2, '0')
    || lpad(to_hex(get_byte(r, 9)), 2, '0');
BEGIN
  RETURN (
    substring(hex, 1, 8)  || '-' ||
    substring(hex, 9, 4)  || '-' ||
    substring(hex, 13, 4) || '-' ||
    substring(hex, 17, 4) || '-' ||
    substring(hex, 21, 12)
  )::uuid;
END;
$$;

-- Trigger helper: keep updated_at current on any UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
