-- Sprint 5 addendum: per-home T&A configuration fields on the homes table.
-- These drive the reconciliation worker's grace windows.

ALTER TABLE homes
  ADD COLUMN IF NOT EXISTS no_show_grace_minutes     integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS no_clock_out_hold_minutes integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS clock_in_early_window_minutes integer NOT NULL DEFAULT 60;
