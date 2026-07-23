// Occupancy-aware staffing requirement.
//
// Model (v1, agreed with product): the rota is built for FULL occupancy. As occupied beds
// drop, the required headcount for a shift block is trimmed proportionally to occupancy, but
// never below the staffing matrix's minimum floor for that block (the home's CQC justification).
//
// A later refinement can replace the linear occupancy scale with a full dependency tool
// (residents-per-carer by band); the matrix floor stays as the hard safety limit either way.

export type StaffingFloor = {
  min_carers: number
  min_senior_carers: number
  min_nurses: number
  min_ancillary: number
}

/** Total minimum headcount across all roles for a shift block. */
export function matrixFloorTotal(f: StaffingFloor): number {
  return f.min_carers + f.min_senior_carers + f.min_nurses + f.min_ancillary
}

/**
 * Required headcount for a shift block given current occupancy.
 *
 * @param baseline   headcount the rota was built for at full occupancy (i.e. currently planned)
 * @param occupied   occupied beds right now
 * @param capacity   the home's bed capacity (full occupancy)
 * @param floor      the matrix minimum for the block — never go below this
 *
 * required = max(floor, ceil(baseline * occupied/capacity)), with the ratio clamped to [0, 1].
 */
export function requiredHeadcount(
  baseline: number,
  occupied: number,
  capacity: number,
  floor: number,
): number {
  const safeFloor = Math.max(0, floor)
  const safeBaseline = Math.max(0, baseline)
  // Guard against a missing/zero capacity: fall back to the baseline (no trim), never divide by zero.
  if (!Number.isFinite(capacity) || capacity <= 0) return Math.max(safeFloor, safeBaseline)
  const ratio = Math.min(1, Math.max(0, occupied / capacity))
  const scaled = Math.ceil(safeBaseline * ratio)
  return Math.max(safeFloor, scaled)
}

/**
 * How many shifts can be cut from a block: the excess of planned headcount over the
 * occupancy-scaled requirement (never negative). Zero when at/below requirement.
 */
export function cuttableCount(
  planned: number,
  occupied: number,
  capacity: number,
  floor: number,
): number {
  return Math.max(0, planned - requiredHeadcount(planned, occupied, capacity, floor))
}
