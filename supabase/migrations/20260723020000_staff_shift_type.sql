-- Whether a staff member works day shifts, night shifts, or both. Matches CareStream's shift
-- pattern. (shift_pattern_preference is kept for the 'fixed' pre-fill behaviour, which is separate.)
ALTER TABLE staff ADD COLUMN shift_type text NOT NULL DEFAULT 'both'
  CHECK (shift_type IN ('day', 'night', 'both'));

-- The Crossways import was derived from day-shift payroll data, so mark those staff as day.
UPDATE staff SET shift_type = 'day' WHERE home_id = '4ee5ce60-2a12-406a-9cba-9d6f4528a3b0';
