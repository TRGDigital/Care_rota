-- Organisation / users
CREATE TYPE user_status       AS ENUM ('active', 'inactive', 'suspended', 'pending_invite');
CREATE TYPE role_code         AS ENUM ('super_admin', 'owner', 'registered_manager', 'deputy_manager', 'hr', 'accountant_readonly', 'staff', 'kiosk');
CREATE TYPE bank_holiday_region AS ENUM ('eng_wales', 'scotland', 'ni');
CREATE TYPE registration_type AS ENUM ('residential', 'nursing', 'domiciliary', 'supported_living');

-- Staff / contracts
CREATE TYPE staff_status             AS ENUM ('active', 'inactive', 'on_leave', 'suspended', 'left');
CREATE TYPE contract_type            AS ENUM ('full_time', 'part_time', 'bank', 'zero_hours');
CREATE TYPE shift_pattern_preference AS ENUM ('day_only', 'night_only', 'fixed', 'any');
CREATE TYPE document_type            AS ENUM ('passport', 'biometric_residence_permit', 'share_code', 'dbs_certificate', 'proof_of_address', 'training_certificate', 'fit_note', 'p45', 'p60', 'contract', 'other');
CREATE TYPE paid_status              AS ENUM ('paid_top_up', 'no_top_up', 'skipped');

-- Rota / shifts
CREATE TYPE rota_period_state   AS ENUM ('draft', 'published', 'closed', 'archived');
CREATE TYPE shift_state         AS ENUM ('unassigned', 'assigned', 'in_progress', 'completed', 'no_show', 'cancelled');
CREATE TYPE reconciliation_state AS ENUM ('pending', 'matched', 'discrepancy', 'resolved');
CREATE TYPE shift_swap_status   AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE clocking_event_type AS ENUM ('clock_in', 'clock_out');
CREATE TYPE capture_method      AS ENUM ('kiosk_pin', 'nfc_badge', 'mobile_gps', 'manager_entry');
CREATE TYPE premium_pay_source  AS ENUM ('auto_bank_holiday', 'manual');
CREATE TYPE shift_length_type   AS ENUM ('long_day_12h', 'short_half_6h', 'sleep_in', 'custom');

-- Leave / sickness
CREATE TYPE leave_type           AS ENUM ('annual', 'compassionate', 'maternity', 'paternity', 'shared_parental', 'adoption', 'unpaid', 'toil', 'other');
CREATE TYPE leave_request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'withdrawn');
CREATE TYPE allocation_unit      AS ENUM ('days', 'hours');
CREATE TYPE covering_strategy    AS ENUM ('rebalance', 'agency', 'manager_cover', 'none');
CREATE TYPE statutory_payment_type AS ENUM ('ssp', 'smp', 'spp', 'sap', 'shpp');

-- Payroll
CREATE TYPE pay_frequency      AS ENUM ('weekly', 'bi_weekly', 'four_weekly', 'monthly');
CREATE TYPE pay_run_state      AS ENUM ('draft', 'pending_approval', 'approved', 'exported', 'void');
CREATE TYPE pay_period_status  AS ENUM ('open', 'processing', 'closed');
CREATE TYPE export_format      AS ENUM ('brightpay', 'sage', 'xero', 'moneysoft', 'iris', 'generic_csv');
CREATE TYPE payslip_line_type  AS ENUM (
  'basic_weekday', 'basic_weekend', 'bank_holiday', 'christmas',
  'night', 'overtime', 'training', 'holiday', 'sickness', 'sleep_in',
  'statutory_ssp', 'statutory_smp', 'statutory_spp', 'statutory_sap', 'statutory_shpp',
  'pension_employee', 'pension_employer', 'paye_tax', 'ni_employee', 'ni_employer', 'student_loan'
);

-- Occupancy
CREATE TYPE bed_status AS ENUM ('occupied', 'vacant', 'reserved', 'maintenance');

-- Overrides / audit
CREATE TYPE mfa_method AS ENUM ('password_reentry', 'totp', 'webauthn');

-- Chat / AI
CREATE TYPE chat_role           AS ENUM ('user', 'assistant', 'tool');
CREATE TYPE chat_session_status AS ENUM ('active', 'archived');
