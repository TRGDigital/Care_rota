// Client-safe exports — no Node.js/server-only dependencies
export { OVERRIDE_AUTHORISATION } from './overrides/authorisation'
export type { OverrideAuthorisation } from './overrides/authorisation'
export { computeDependencyBand, SCORE_LABELS, BAND_LABEL } from './dependency/banding'
export type { DependencyBand, AssessmentScores } from './dependency/banding'
// Type-only re-exports safe for client components (erased at build time)
export type { Citation, ChatResponse, ToolResult } from './chat/types'
export type { RuleBlock, OverridePath, EligibilityResult } from './rota/eligibility-check'
// Reconciliation types (client-safe — no Supabase imports)
export type {
  ReconciliationState, PayableSourceRule, ClockingEvent, PlannedShift,
  ReconciliationResult, PayableMinutes,
} from './reconciliation/types'
export { reconcileShift } from './reconciliation/reconcile'
export { checkGeofence, haversineDistance } from './clocking/geofence'
export type { GeofenceCheckResult } from './clocking/geofence'
// Payroll engine (client-safe — pure functions, no Supabase imports)
export { calculatePayrun } from './payroll/calculate'
export { computeTrainingOverlap } from './payroll/training-overlap'
export { checkNmwFloors } from './payroll/nmw'
export { resolveRate, resolveNmwFloor } from './payroll/rates'
export type {
  PayrunInput, PayrunResult, PayslipResult, PayslipLine, PayslipLineType,
  PayRunState, PayFrequency, TrainingPaidStatus, NmwCheckResult,
  StaffPayRate, ShiftPayable, TrainingAttendance, StatutoryPaymentRecord,
  StaffMember, ReferenceWageRate, HomePayrollSettings,
} from './payroll/types'
export type { TrainingOverlapInput, TrainingOverlapResult } from './payroll/training-overlap'
export { exportPayRun } from './payroll/exports/index'
export type { CsvFile, PayRunExportInput, ExportFormat, PayRunExportRow } from './payroll/exports/index'
export { buildYearEndSummary } from './payroll/year-end'
export type { YearEndSummaryInput, YearEndSummaryResult, YearEndStaffRow } from './payroll/year-end'
