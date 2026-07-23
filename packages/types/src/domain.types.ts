// ============================================================
// DOMAIN TYPES
// Hand-written types layered on top of the generated DB types.
// Import generated DB types from ./database.types (auto-generated
// by: supabase gen types typescript --local > packages/types/src/database.types.ts)
// ============================================================

// ------------------------------------
// Money
// ------------------------------------

export type Pence = bigint;

export function pence(value: number): Pence {
  return BigInt(Math.round(value));
}

export function penceToPounds(p: Pence): number {
  return Number(p) / 100;
}

// ------------------------------------
// Tenant context — carried on every API request
// ------------------------------------

export type RoleCode =
  | 'super_admin'
  | 'owner'
  | 'registered_manager'
  | 'deputy_manager'
  | 'hr'
  | 'accountant_readonly'
  | 'staff'
  | 'kiosk';

export type TenantContext = {
  organisationId: string;
  homeId: string | null; // null = org-wide query (owner/super_admin only)
  userId: string;
  roles: RoleCode[];
};

export type HomeContext = TenantContext & { homeId: string };

// ------------------------------------
// State machine unions
// ------------------------------------

export type RotaPeriodState = 'draft' | 'published' | 'closed' | 'archived';

export type ShiftState =
  | 'unassigned'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'no_show'
  | 'cancelled';

export type ReconciliationState = 'pending' | 'matched' | 'discrepancy' | 'resolved';

export type ShiftSwapStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type LeaveRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'withdrawn';

export type PayRunState = 'draft' | 'pending_approval' | 'approved' | 'exported' | 'void';

export type PayPeriodStatus = 'open' | 'processing' | 'closed';

export type ChatSessionStatus = 'active' | 'archived';

// ------------------------------------
// Override rule codes
// ------------------------------------

export type RuleCode =
  | 'wtr_11hr_rest'
  | 'wtr_48hr_weekly'
  | 'wtr_night_shift_limit'
  | 'training_expired_safeguarding'
  | 'training_expired_fire_safety'
  | 'training_expired_manual_handling'
  | 'training_expired_infection_control'
  | 'training_expired_medication'
  | 'training_expired_dementia'
  | 'training_expired_first_aid'
  | 'training_expired_dols'
  | 'rtw_expired'
  | 'sponsorship_hours_floor'
  | 'sponsorship_visa_expiry'
  | 'nmw_floor_breach'
  | 'pattern_preference_mismatch';

export type MfaMethod = 'password_reentry' | 'totp' | 'webauthn';

export type OverrideAuthorisation = {
  rolesPermitted: RoleCode[];
  coSignRequired: boolean;
  ownerDigest?: boolean;
  sevenDayRetrainPrompt?: boolean;
};

// ------------------------------------
// Payroll
// ------------------------------------

export type AllocationUnit = 'days' | 'hours';

export type PayFrequency = 'weekly' | 'bi_weekly' | 'four_weekly' | 'monthly';

export type ExportFormat = 'brightpay' | 'sage' | 'xero' | 'moneysoft' | 'iris' | 'generic_csv';

export type PayslipLineType =
  | 'basic_weekday'
  | 'basic_weekend'
  | 'bank_holiday'
  | 'christmas'
  | 'night'
  | 'overtime'
  | 'training'
  | 'holiday'
  | 'sickness'
  | 'sleep_in'
  | 'statutory_ssp'
  | 'statutory_smp'
  | 'statutory_spp'
  | 'statutory_sap'
  | 'statutory_shpp'
  | 'pension_employee'
  | 'pension_employer'
  | 'paye_tax'
  | 'ni_employee'
  | 'ni_employer'
  | 'student_loan';

// ------------------------------------
// Typed domain errors (never throw plain Error)
// ------------------------------------

export class RotaError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'RotaError';
    this.code = code;
  }
}

export class PayrollError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'PayrollError';
    this.code = code;
  }
}

export class OverrideError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'OverrideError';
    this.code = code;
  }
}

export class ComplianceError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ComplianceError';
    this.code = code;
  }
}
