-- Add author display fields to payroll_comments so queries don't need a join
ALTER TABLE payroll_comments
  ADD COLUMN IF NOT EXISTS author_name    text,
  ADD COLUMN IF NOT EXISTS is_accountant  boolean NOT NULL DEFAULT false;
