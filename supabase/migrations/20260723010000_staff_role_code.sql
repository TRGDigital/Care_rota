-- First-class position/role on the staff record (was previously only inferred from the latest
-- pay rate). Backfilled from that pay rate so nothing is lost.
ALTER TABLE staff ADD COLUMN role_code text;

UPDATE staff s
SET role_code = pr.role_code
FROM (
  SELECT DISTINCT ON (staff_id) staff_id, role_code
  FROM staff_pay_rates
  ORDER BY staff_id, effective_from DESC
) pr
WHERE pr.staff_id = s.id AND s.role_code IS NULL;
