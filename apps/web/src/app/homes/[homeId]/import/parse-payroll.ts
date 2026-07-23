import ExcelJS from 'exceljs'

// Server-side detection of staff, roles, fixed patterns, rates and the standard week from a
// care-home payroll workbook (weekly "Week N" sheets + a "Payroll" summary). This is the Node
// port of the pattern-detection we validated on the Crossways spreadsheets. It targets that shape
// by meaning (day columns, role-section headers, rate column); tenants whose layout differs get a
// manual-mapping step (a later iteration).

export type DetectedStaff = {
  key: string           // normalised name, used for matching
  firstName: string
  lastName: string
  roleGroup: string     // raw section header from the sheet
  roleCode: string      // mapped canonical position code
  roleName: string      // canonical position name (matches CareStream)
  eligible: boolean
  shift: 'day' | 'night'
  contractedHours: number
  fixed: { dow: number; hours: number }[]
  ratePence: number | null
}

export type DetectedConfig = {
  staff: DetectedStaff[]
  templateHours: number[]   // distinct shift lengths (hours) → templates
  weeksParsed: number
  warnings: string[]
}

// Column map (1-indexed): Mon..Sun plus the two night-spill columns.
const DAYCOL: Record<string, number> = { Mon: 3, Tue: 4, Wed: 5, Thu: 6, Fri: 7, Sat: 9, Sun: 10 }
const EARLY: Record<number, string> = { 8: 'Fri', 11: 'Sun' }
const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
const DOW_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Section headers → canonical CareStream position (code, name, eligible, day/night).
const ROLE_MAP: Record<string, { code: string; name: string; eligible: boolean }> = {
  'MANAGERS': { code: 'care_manager', name: 'Care Manager', eligible: false },
  'ADMIN': { code: 'administrator', name: 'Administrator', eligible: false },
  'S/CARE STAFF': { code: 'senior_care_assistant', name: 'Senior Care Assistant', eligible: true },
  'SENIOR CARE STAFF': { code: 'senior_care_assistant', name: 'Senior Care Assistant', eligible: true },
  'CARE STAFF': { code: 'care_assistant', name: 'Care Assistant', eligible: true },
  'NIGHT CARE STAFF': { code: 'care_assistant', name: 'Care Assistant', eligible: true },
  'NURSES': { code: 'nurse', name: 'Nurse', eligible: true },
  'KITCHEN': { code: 'chef', name: 'Chef', eligible: false },
  'COOK': { code: 'chef', name: 'Chef', eligible: false },
  'CLEANER': { code: 'cleaner_housekeeping', name: 'Cleaner / Housekeeping', eligible: false },
  'LAUNDRY': { code: 'laundry', name: 'Laundry', eligible: false },
  'ACTIVITIES': { code: 'activities_coordinator', name: 'Activities Coordinator', eligible: false },
}
const SECTION_WORDS = new Set([...Object.keys(ROLE_MAP), 'DAY STAFF', 'NIGHT STAFF', 'DAY', 'NIGHT'])

function isSection(v: string): boolean {
  const u = v.trim().toUpperCase()
  return SECTION_WORDS.has(u) || u.endsWith('STAFF')
}
function norm(n: string): string { return n.trim().replace(/\s+/g, ' ').toUpperCase() }
function cellNum(v: ExcelJS.CellValue): number | null {
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v)
  return null
}
function cellStr(v: ExcelJS.CellValue): string {
  if (v == null) return ''
  if (typeof v === 'object' && v !== null && 'text' in v) return String((v as { text: string }).text)
  return String(v)
}
const median = (a: number[]): number => {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2)
  return s.length % 2 ? (s[m] ?? 0) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2
}

const FALLBACK_ROLE = { code: 'care_assistant', name: 'Care Assistant', eligible: true }

export async function parsePayrollWorkbook(buffer: Buffer): Promise<DetectedConfig> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as never)
  const warnings: string[] = []

  const weekSheets = wb.worksheets.filter(w => /^week/i.test(w.name.trim()))
  const paySheet = wb.worksheets.find(w => /payroll/i.test(w.name.trim()))
  if (!weekSheets.length) return { staff: [], templateHours: [], weeksParsed: 0, warnings: ['No "Week" sheets found. Expected weekly rota sheets named "Week 1", "Week 2", …'] }

  // staffKey → { role group, shift, weeks: [ {dow -> hours} ] }
  const weeksByStaff = new Map<string, Array<Record<string, number>>>()
  const roleOf = new Map<string, string>()
  const shiftOf = new Map<string, 'day' | 'night'>()
  const nameOf = new Map<string, string>()
  const templateHours = new Set<number>()
  let weeksParsed = 0

  for (const ws of weekSheets) {
    let curRole = 'CARE STAFF'
    let curShift: 'day' | 'night' = 'day'
    let sheetHadStaff = false
    for (let r = 8; r <= ws.rowCount; r++) {
      const row = ws.getRow(r)
      const a = cellStr(row.getCell(1).value).trim()
      if (!a) continue
      if (isSection(a)) {
        const u = a.toUpperCase()
        if (u.includes('NIGHT')) curShift = 'night'
        if (u === 'DAY STAFF') curShift = 'day'
        if (u !== 'DAY STAFF' && u !== 'NIGHT STAFF') curRole = u
        continue
      }
      // staff row needs the TOTAL # SHIFTS column (11) present
      if (row.getCell(12).value == null) continue
      const key = norm(a)
      const dh: Record<string, number> = {}
      for (const [d, c] of Object.entries(DAYCOL)) {
        const v = cellNum(row.getCell(c).value)
        if (v && v > 0) { dh[d] = (dh[d] ?? 0) + v; templateHours.add(Math.round(v)) }
      }
      for (const [c, d] of Object.entries(EARLY)) {
        const v = cellNum(row.getCell(Number(c)).value)
        if (v && v > 0) dh[d] = (dh[d] ?? 0) + v
      }
      const arr = weeksByStaff.get(key) ?? []
      arr.push(dh); weeksByStaff.set(key, arr)
      if (!roleOf.has(key)) { roleOf.set(key, curRole); shiftOf.set(key, curShift); nameOf.set(key, a.trim()) }
      if (Object.keys(dh).length) sheetHadStaff = true
    }
    if (sheetHadStaff) weeksParsed++
  }

  // Rates from the Payroll sheet (col AE = 31, "Rate of Pay/Hour"), staff names in col A.
  const rateByStaff = new Map<string, number>()
  if (paySheet) {
    for (let r = 9; r <= paySheet.rowCount; r++) {
      const a = cellStr(paySheet.getCell(r, 1).value).trim()
      if (!a) continue
      const rate = cellNum(paySheet.getCell(r, 31).value)
      if (rate && rate > 0) rateByStaff.set(norm(a), rate)
    }
  } else {
    warnings.push('No "Payroll" sheet found — pay rates could not be detected.')
  }

  const staff: DetectedStaff[] = []
  for (const [key, weeks] of weeksByStaff) {
    const nz = weeks.filter(w => Object.keys(w).length)
    if (nz.length < 2) continue
    const rg = roleOf.get(key) ?? 'CARE STAFF'
    const mapped = ROLE_MAP[rg] ?? FALLBACK_ROLE
    const fixed: { dow: number; hours: number }[] = []
    for (const d of DOW_ORDER) {
      const worked = nz.filter(w => d in w).map(w => w[d] ?? 0)
      if (worked.length >= 0.7 * nz.length) fixed.push({ dow: DOW[d] ?? 0, hours: Math.round(median(worked) * 10) / 10 })
    }
    const weeklyTotals = nz.map(w => Object.values(w).reduce((s, x) => s + x, 0))
    let contracted = Math.round(median(weeklyTotals))
    for (const c of [40, 36, 24, 20, 16, 12, 8]) if (Math.abs(contracted - c) <= 3) { contracted = c; break }
    const raw = nameOf.get(key) ?? key
    const toks = raw.split(/\s+/)
    const firstName = toks[0] ?? raw
    const lastName = toks.slice(1).join(' ') || '.'
    const ratePounds = rateByStaff.get(key) ?? null
    staff.push({
      key, firstName, lastName,
      roleGroup: rg, roleCode: mapped.code, roleName: mapped.name, eligible: mapped.eligible,
      shift: shiftOf.get(key) ?? 'day',
      contractedHours: contracted,
      fixed,
      ratePence: ratePounds != null ? Math.round(ratePounds * 100) : null,
    })
  }
  staff.sort((a, b) => a.lastName.localeCompare(b.lastName))

  return { staff, templateHours: [...templateHours].sort((a, b) => a - b), weeksParsed, warnings }
}
