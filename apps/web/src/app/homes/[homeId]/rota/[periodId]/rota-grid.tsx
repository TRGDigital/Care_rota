'use client'

import { Fragment, useState, useTransition } from 'react'
import { assignShift, assignShiftWithOverride, unassignShift, publishPeriodAction, getEligibleStaff, autoFillPeriodAction } from './actions'
import type { RuleBlock } from '@carerota/domain'

type Slot = {
  id: string
  date: string
  role_code: string
  headcount_required: number
  shift_pattern_template_id: string
  shift_pattern_templates: { name: string; start_time_local: string; end_time_local: string } | null
}

type Shift = {
  id: string
  shift_slot_id: string
  staff_id: string | null
  state: string
  planned_start_utc: string
  planned_end_utc: string
  planned_paid_hours: number
  is_bank_holiday: boolean
  is_christmas_period: boolean
  premium_multiplier: number
}

type StaffOption = {
  id: string
  first_name: string
  last_name: string
  employee_number: string | null
  eligible: boolean
  blocks: RuleBlock[]
  warnings: RuleBlock[]
}

const OVERRIDE_REASONS: Record<string, string[]> = {
  wtr_11hr_rest: ['Exceptional_circumstance', 'Staff_request', 'Emergency_cover'],
  wtr_48hr_weekly: ['Exceptional_circumstance', 'Staff_request', 'Emergency_cover'],
  training_expired_safeguarding: ['Training_booked', 'Staff_request', 'Emergency_cover'],
  training_expired_moving_handling: ['Training_booked', 'Staff_request', 'Emergency_cover'],
  training_expired_medication: ['Training_booked', 'Emergency_cover'],
  training_expired_bls: ['Training_booked', 'Emergency_cover'],
  rtw_expired: ['Document_pending', 'Emergency_cover'],
  sponsorship_hours_floor: ['Schedule_change', 'Staff_request'],
}

function fmtDay(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function fmtRole(code: string) {
  return code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// Section order on the rota: Care Manager at the top, then nursing/care, then ancillary with
// chefs bunched together; night staff are handled separately and always sit at the bottom.
const ROLE_ORDER = [
  'care_manager', 'senior_nurse', 'nurse', 'senior_care_assistant', 'care_assistant',
  'activities_coordinator', 'administrator', 'hr', 'marketing', 'company_director',
  'chef', 'kitchen_porter', 'laundry', 'cleaner_housekeeping',
]
function rolePriority(code: string): number {
  const i = ROLE_ORDER.indexOf(code)
  return i === -1 ? 50 : i
}

// Distinct band colour per role group so each section stands out on the rota.
function sectionTint(role: string, isNight: boolean): string {
  if (isNight) return 'bg-indigo-100 text-indigo-800 border-indigo-200'
  switch (role) {
    case 'care_manager': return 'bg-purple-100 text-purple-800 border-purple-200'
    case 'senior_nurse':
    case 'nurse': return 'bg-sky-100 text-sky-800 border-sky-200'
    case 'senior_care_assistant':
    case 'care_assistant': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    case 'activities_coordinator': return 'bg-teal-100 text-teal-800 border-teal-200'
    case 'chef':
    case 'kitchen_porter': return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'cleaner_housekeeping':
    case 'laundry': return 'bg-slate-100 text-slate-700 border-slate-200'
    default: return 'bg-muted/40 text-muted-foreground border-muted'
  }
}

export function RotaGrid({
  homeId, periodId, status, dates, slots, shiftsBySlot, staffMap, nightStaffIds, staffRoles, staffFinance, weeks,
}: {
  homeId: string
  periodId: string
  status: string
  dates: string[]
  slots: Slot[]
  shiftsBySlot: Record<string, Shift[]>
  staffMap: Record<string, string>
  nightStaffIds: string[]
  staffRoles: Record<string, string>
  staffFinance: Record<string, { contracted: number; weekdayPence: number; overtimePence: number }>
  weeks: number
}) {
  const [pending, startTransition] = useTransition()
  const [selectedShift, setSelectedShift] = useState<{ shiftId: string; slotId: string } | null>(null)
  const [eligibleStaff, setEligibleStaff] = useState<StaffOption[]>([])
  const [loadingPanel, setLoadingPanel] = useState(false)
  const [overrideTarget, setOverrideTarget] = useState<{ shiftId: string; staffId: string; blocks: RuleBlock[] } | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [publishBlocks, setPublishBlocks] = useState<{ shift_id: string; rule_code: string; message: string }[]>([])
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function openAssignPanel(shiftId: string, slotId: string) {
    setSelectedShift({ shiftId, slotId })
    setLoadingPanel(true)
    const result = await getEligibleStaff(homeId, shiftId)
    setEligibleStaff(result.staff ?? [])
    setLoadingPanel(false)
  }

  function handleAssign(staffId: string) {
    if (!selectedShift) return
    startTransition(async () => {
      const result = await assignShift(homeId, periodId, selectedShift.shiftId, staffId)
      if ('blocked' in result && result.blocked) {
        const absoluteBlock = result.blocks?.find((b: RuleBlock) => b.override_path === 'none')
        if (absoluteBlock) {
          showToast(`Blocked: ${absoluteBlock.message}`)
          return
        }
        setOverrideTarget({ shiftId: selectedShift.shiftId, staffId, blocks: result.blocks ?? [] })
        setSelectedShift(null)
        return
      }
      if ('error' in result && result.error) { showToast(result.error); return }
      if ('warnings' in result && result.warnings?.length) {
        showToast(`Assigned with warning: ${result.warnings[0]?.message}`)
      }
      setSelectedShift(null)
    })
  }

  function handleUnassign(shiftId: string) {
    startTransition(async () => {
      const result = await unassignShift(homeId, periodId, shiftId)
      if ('error' in result && result.error) showToast(result.error)
    })
  }

  function handlePublish() {
    setPublishError(null)
    setPublishBlocks([])
    startTransition(async () => {
      const result = await publishPeriodAction(homeId, periodId)
      if ('error' in result && result.error) {
        setPublishError(result.error)
        setPublishBlocks((result as { blocks?: typeof publishBlocks }).blocks ?? [])
      } else {
        showToast('Rota published!')
      }
    })
  }

  function handleAutoFill() {
    startTransition(async () => {
      const result = await autoFillPeriodAction(homeId, periodId)
      if ('error' in result && result.error) {
        showToast(`Auto-fill failed: ${result.error}`)
      } else if ('assigned' in result) {
        showToast(`Auto-fill complete: ${result.assigned} assigned, ${result.open} open.`)
      }
    })
  }

  // ── Build staff-centric data structures ──────────────────────────────────────

  // staffDateMap: staffId → date → [{shift, slot}]
  const staffDateMap = new Map<string, Map<string, Array<{ shift: Shift; slot: Slot }>>>()
  // Grouping uses each staff member's actual position (staffRoles), not the role of the slot
  // they happened to land in, so the rota matches the staff directory.
  for (const slot of slots) {
    for (const shift of shiftsBySlot[slot.id] ?? []) {
      if (!shift.staff_id) continue
      let dateMap = staffDateMap.get(shift.staff_id)
      if (!dateMap) { dateMap = new Map(); staffDateMap.set(shift.staff_id, dateMap) }
      let dayArr = dateMap.get(slot.date)
      if (!dayArr) { dayArr = []; dateMap.set(slot.date, dayArr) }
      dayArr.push({ shift, slot })
    }
  }

  // Sort by role then name, group into role sections
  const sortedStaff = [...staffDateMap.keys()].sort((a, b) => {
    const ra = staffRoles[a] ?? '', rb = staffRoles[b] ?? ''
    const pa = rolePriority(ra), pb = rolePriority(rb)
    if (pa !== pb) return pa - pb
    if (ra !== rb) return ra.localeCompare(rb)
    return (staffMap[a] ?? '').localeCompare(staffMap[b] ?? '')
  })

  // Day/both staff group by role; night staff are bunched into a single section at the bottom.
  const nightSet = new Set(nightStaffIds)
  const sections: { role: string; staffIds: string[]; isNight: boolean }[] = []
  for (const id of sortedStaff.filter(x => !nightSet.has(x))) {
    const role = staffRoles[id] ?? ''
    const last = sections.at(-1)
    if (last && last.role === role && !last.isNight) last.staffIds.push(id)
    else sections.push({ role, staffIds: [id], isNight: false })
  }
  const nightStaff = sortedStaff.filter(x => nightSet.has(x))
    .sort((a, b) => (staffMap[a] ?? '').localeCompare(staffMap[b] ?? ''))
  if (nightStaff.length) sections.push({ role: 'Night Staff', staffIds: nightStaff, isNight: true })

  // Per-staff finance for the summary column: hours worked this period, overtime beyond contracted,
  // cost (regular hours at weekday rate, overtime at the overtime rate), and what would be saved if
  // their hours were trimmed back to contracted.
  function financeFor(staffId: string) {
    const dateMap = staffDateMap.get(staffId)
    let hours = 0
    if (dateMap) for (const arr of dateMap.values()) for (const { shift } of arr) hours += Number(shift.planned_paid_hours)
    const fin = staffFinance[staffId] ?? { contracted: 0, weekdayPence: 0, overtimePence: 0 }
    const contractedTotal = fin.contracted * weeks
    const otHours = Math.max(0, Math.round((hours - contractedTotal) * 10) / 10)
    const regularHours = Math.max(0, hours - otHours)
    const costPence = regularHours * fin.weekdayPence + otHours * fin.overtimePence
    const savingsPence = otHours * fin.overtimePence
    return { hours: Math.round(hours * 10) / 10, otHours, costPence, savingsPence }
  }
  const tot = { hours: 0, otHours: 0, costPence: 0, savingsPence: 0 }
  for (const id of staffDateMap.keys()) {
    const f = financeFor(id)
    tot.hours += f.hours; tot.otHours += f.otHours; tot.costPence += f.costPence; tot.savingsPence += f.savingsPence
  }
  const gbp = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  // Unassigned shifts grouped by role_code → date
  const unassignedByRole = new Map<string, Map<string, Array<{ shift: Shift; slot: Slot }>>>()
  for (const slot of slots) {
    for (const shift of shiftsBySlot[slot.id] ?? []) {
      if (shift.staff_id) continue
      let roleMap = unassignedByRole.get(slot.role_code)
      if (!roleMap) { roleMap = new Map(); unassignedByRole.set(slot.role_code, roleMap) }
      let arr = roleMap.get(slot.date)
      if (!arr) { arr = []; roleMap.set(slot.date, arr) }
      arr.push({ shift, slot })
    }
  }

  const totalUnfilled = [...unassignedByRole.values()]
    .flatMap(m => [...m.values()])
    .reduce((n, v) => n + v.length, 0)

  const isDraft = status === 'draft'

  return (
    <div className="mt-4 relative">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-foreground text-background text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* Publish bar */}
      {isDraft && (
        <div className="mb-4 flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div>
            <span className="text-sm font-medium text-amber-800">Draft rota</span>
            <span className="text-xs text-amber-600 ml-2">Not visible to staff until published</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAutoFill}
              disabled={pending}
              className="text-sm font-medium bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {pending ? 'Working…' : 'Auto-fill'}
            </button>
            <button
              onClick={handlePublish}
              disabled={pending}
              className="text-sm font-medium bg-green-600 text-white px-4 py-1.5 rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              Publish rota
            </button>
          </div>
        </div>
      )}

      {publishError && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg space-y-1">
          <p className="text-sm font-medium text-destructive">{publishError}</p>
          {publishBlocks.map((b, i) => (
            <p key={i} className="text-xs text-destructive/80">{b.rule_code}: {b.message}</p>
          ))}
        </div>
      )}

      {/* Grid — breaks out of the centred page shell on wide screens so the full week + summary
          columns show with less horizontal scrolling. */}
      <div className="overflow-x-auto -mx-6 lg:-mx-8 xl:-mx-24 2xl:-mx-48 px-6 lg:px-8 xl:px-24 2xl:px-48">
        <table className="min-w-full text-xs border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground w-36 sticky left-0 z-10 bg-background border-b">
                Staff
              </th>
              {dates.map(d => (
                <th key={d} className="text-center py-2 px-2 font-medium text-muted-foreground border-b min-w-[120px]">
                  {fmtDay(d)}
                </th>
              ))}
              <th className="text-right py-2 px-3 font-semibold text-muted-foreground border-b border-l bg-muted/20 min-w-[70px]" title="Total paid hours this period">Hours</th>
              <th className="text-right py-2 px-3 font-semibold text-muted-foreground border-b bg-muted/20 min-w-[70px]" title="Hours beyond contracted">Overtime</th>
              <th className="text-right py-2 px-3 font-semibold text-muted-foreground border-b bg-muted/20 min-w-[80px]" title="Total staff cost this period">Cost</th>
              <th className="text-right py-2 px-3 font-semibold text-emerald-700 border-b bg-emerald-50 min-w-[80px]" title="Saving if hours matched contracted (overtime trimmed)">Savings</th>
            </tr>
          </thead>
          <tbody>
            {sections.map(({ role, staffIds, isNight }) => (
              <Fragment key={role}>
                {/* Role section header */}
                <tr>
                  <td
                    colSpan={dates.length + 5}
                    className={`py-1.5 px-3 text-xs font-semibold uppercase tracking-wider border-b border-t ${sectionTint(role, isNight)}`}
                  >
                    {isNight ? '🌙 Night Staff' : fmtRole(role)}
                  </td>
                </tr>

                {/* One row per staff member */}
                {staffIds.map(staffId => {
                  const dateMap = staffDateMap.get(staffId)!
                  const f = financeFor(staffId)
                  return (
                    <tr key={staffId} className="group hover:bg-muted/5">
                      <td className="py-2 px-3 font-medium sticky left-0 z-10 bg-background align-top border-b text-sm whitespace-nowrap">
                        {staffMap[staffId] ?? staffId}
                      </td>
                      {dates.map(date => {
                        const dayShifts = dateMap.get(date)
                        return (
                          <td key={date} className="py-1 px-1 align-top border-b min-w-[120px]">
                            {dayShifts ? (
                              <div className="space-y-0.5">
                                {dayShifts.map(({ shift, slot }) => (
                                  <ShiftChip
                                    key={shift.id}
                                    shift={shift}
                                    slot={slot}
                                    staffRole={staffRoles[staffId] ?? ''}
                                    isDraft={isDraft}
                                    onUnassign={() => handleUnassign(shift.id)}
                                    pending={pending}
                                  />
                                ))}
                              </div>
                            ) : (
                              <div className="h-9" />
                            )}
                          </td>
                        )
                      })}
                      {/* Summary: hours / overtime / cost / savings */}
                      <td className="py-2 px-3 text-right tabular-nums align-top border-b border-l bg-muted/10 text-sm font-medium">{f.hours}</td>
                      <td className={`py-2 px-3 text-right tabular-nums align-top border-b bg-muted/10 text-sm ${f.otHours > 0 ? 'text-amber-700 font-semibold' : 'text-muted-foreground'}`}>{f.otHours > 0 ? f.otHours : '—'}</td>
                      <td className="py-2 px-3 text-right tabular-nums align-top border-b bg-muted/10 text-sm">{f.costPence > 0 ? gbp(f.costPence) : '—'}</td>
                      <td className={`py-2 px-3 text-right tabular-nums align-top border-b bg-emerald-50/60 text-sm ${f.savingsPence > 0 ? 'text-emerald-700 font-semibold' : 'text-muted-foreground'}`}>{f.savingsPence > 0 ? gbp(f.savingsPence) : '—'}</td>
                    </tr>
                  )
                })}
              </Fragment>
            ))}

            {/* Totals row */}
            {staffDateMap.size > 0 && (
              <tr className="border-t-2 border-foreground/20">
                <td className="py-2.5 px-3 font-semibold sticky left-0 z-10 bg-background align-top border-b text-sm">Totals</td>
                <td colSpan={dates.length} className="border-b bg-background" />
                <td className="py-2.5 px-3 text-right tabular-nums align-top border-b border-l bg-muted/20 text-sm font-bold">{Math.round(tot.hours * 10) / 10}</td>
                <td className="py-2.5 px-3 text-right tabular-nums align-top border-b bg-muted/20 text-sm font-bold text-amber-700">{Math.round(tot.otHours * 10) / 10}</td>
                <td className="py-2.5 px-3 text-right tabular-nums align-top border-b bg-muted/20 text-sm font-bold">{gbp(tot.costPence)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums align-top border-b bg-emerald-100 text-sm font-bold text-emerald-800">{gbp(tot.savingsPence)}</td>
              </tr>
            )}

            {/* Unfilled shifts section */}
            {totalUnfilled > 0 && (
              <Fragment key="__unfilled">
                <tr>
                  <td
                    colSpan={dates.length + 5}
                    className="py-1.5 px-3 text-xs font-semibold text-amber-700 uppercase tracking-wider bg-amber-50 border-b border-t"
                  >
                    Unfilled shifts ({totalUnfilled})
                  </td>
                </tr>
                {[...unassignedByRole.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([role, dateMap]) => (
                  <tr key={`unfilled-${role}`} className="hover:bg-amber-50/40">
                    <td className="py-2 px-3 text-muted-foreground italic sticky left-0 z-10 bg-background align-top border-b text-xs whitespace-nowrap">
                      {fmtRole(role)}
                    </td>
                    {dates.map(date => {
                      const dayUnfilled = dateMap.get(date)
                      return (
                        <td key={date} className="py-1 px-1 align-top border-b">
                          {dayUnfilled ? (
                            <div className="space-y-0.5">
                              {dayUnfilled.map(({ shift, slot }) => (
                                <ShiftCell
                                  key={shift.id}
                                  shift={shift}
                                  staffName={undefined}
                                  templateName={slot.shift_pattern_templates?.name}
                                  isDraft={isDraft}
                                  onAssignClick={() => openAssignPanel(shift.id, slot.id)}
                                  onUnassign={() => handleUnassign(shift.id)}
                                  pending={pending}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="h-9" />
                          )}
                        </td>
                      )
                    })}
                    <td colSpan={4} className="border-b border-l bg-muted/5" />
                  </tr>
                ))}
              </Fragment>
            )}
          </tbody>
        </table>
      </div>

      {slots.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No slots in this period. Check Settings → Rota settings → Slot requirements.
        </div>
      )}

      {/* Assign panel */}
      {selectedShift && (
        <AssignPanel
          loadingPanel={loadingPanel}
          staff={eligibleStaff}
          onAssign={handleAssign}
          onClose={() => setSelectedShift(null)}
          pending={pending}
        />
      )}

      {/* Override modal */}
      {overrideTarget && (
        <OverrideModal
          blocks={overrideTarget.blocks}
          onConfirm={(formData) => {
            const { shiftId, staffId } = overrideTarget
            setOverrideTarget(null)
            startTransition(async () => {
              const result = await assignShiftWithOverride(homeId, periodId, shiftId, staffId, formData)
              if ('error' in result && result.error) showToast(result.error)
              else showToast('Override recorded — shift assigned.')
            })
          }}
          onClose={() => setOverrideTarget(null)}
          pending={pending}
        />
      )}
    </div>
  )
}

// ── ShiftChip — used in staff rows (shift is always assigned) ─────────────────

function ShiftChip({
  shift, slot, staffRole, isDraft, onUnassign, pending,
}: {
  shift: Shift
  slot: Slot
  staffRole: string
  isDraft: boolean
  onUnassign: () => void
  pending: boolean
}) {
  const isPremium = shift.is_bank_holiday || shift.is_christmas_period
  const tpl = slot.shift_pattern_templates
  const startHour = tpl ? parseInt(tpl.start_time_local.split(':')[0] ?? '8', 10) : 8
  const isNight = startHour >= 18 || startHour < 6

  // Colour the card so key roles stand out: night = indigo, Care Manager = purple, Chef = orange,
  // premium day = amber, everything else = green.
  const tint = isNight ? 'night'
    : staffRole === 'care_manager' ? 'manager'
    : staffRole === 'chef' ? 'chef'
    : isPremium ? 'premium' : 'day'
  const T = {
    night:   { card: 'bg-indigo-100 border-indigo-300', text: 'text-indigo-900', sub: 'text-indigo-700', mark: '🌙 ' },
    manager: { card: 'bg-purple-100 border-purple-300', text: 'text-purple-900', sub: 'text-purple-700', mark: '' },
    chef:    { card: 'bg-orange-100 border-orange-300', text: 'text-orange-900', sub: 'text-orange-700', mark: '' },
    premium: { card: 'bg-amber-100 border-amber-300',   text: 'text-foreground/80', sub: 'text-amber-700', mark: '' },
    day:     { card: 'bg-green-50 border-green-200',     text: 'text-foreground/80', sub: 'text-muted-foreground', mark: '' },
  }[tint]

  return (
    <div className={`rounded p-1.5 text-xs border ${T.card}`}>
      <div className="flex items-center justify-between gap-1 leading-tight">
        <span className={`font-medium ${T.text}`}>{tpl?.name ?? '—'}</span>
        <span className={`shrink-0 tabular-nums font-semibold ${T.sub}`}>{Number(shift.planned_paid_hours)}h</span>
      </div>
      {tpl && (
        <div className={`leading-tight ${T.sub}`}>
          {T.mark}{tpl.start_time_local}–{tpl.end_time_local}
        </div>
      )}
      <div className="flex items-center justify-between mt-0.5">
        {isPremium && <span className="text-amber-700">{shift.premium_multiplier}×</span>}
        {isDraft && (
          <button
            onClick={onUnassign}
            disabled={pending}
            className="text-destructive/50 hover:text-destructive text-xs disabled:opacity-40 ml-auto"
            title="Unassign"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}

// ── ShiftCell — used in the Unfilled section (unassigned draft slots) ─────────

function ShiftCell({
  shift, staffName, templateName, isDraft, onAssignClick, onUnassign, pending,
}: {
  shift: Shift
  staffName: string | undefined
  templateName: string | undefined
  isDraft: boolean
  onAssignClick: () => void
  onUnassign: () => void
  pending: boolean
}) {
  const isPremium = shift.is_bank_holiday || shift.is_christmas_period
  const assigned = !!shift.staff_id

  return (
    <div
      className={`rounded p-1.5 text-xs border transition-colors ${
        assigned
          ? isPremium
            ? 'bg-amber-100 border-amber-300'
            : 'bg-green-50 border-green-200'
          : isDraft
            ? 'bg-muted/30 border-dashed border-muted-foreground/30 cursor-pointer hover:bg-muted/50'
            : 'bg-muted/20 border-muted/30'
      }`}
      onClick={!assigned && isDraft ? onAssignClick : undefined}
    >
      <div className="text-muted-foreground font-medium">{templateName ?? '—'}</div>
      {assigned ? (
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <span className="font-medium truncate">{staffName ?? 'Assigned'}</span>
          {isDraft && (
            <button
              onClick={(e) => { e.stopPropagation(); onUnassign() }}
              disabled={pending}
              className="text-destructive/60 hover:text-destructive text-xs shrink-0 disabled:opacity-40"
              title="Unassign"
            >
              ×
            </button>
          )}
        </div>
      ) : (
        isDraft && <span className="text-muted-foreground/60 text-xs">+ assign</span>
      )}
      {isPremium && (
        <span className="text-amber-700 text-xs">{shift.premium_multiplier}×</span>
      )}
    </div>
  )
}

function AssignPanel({
  loadingPanel, staff, onAssign, onClose, pending,
}: {
  loadingPanel: boolean
  staff: StaffOption[]
  onAssign: (id: string) => void
  onClose: () => void
  pending: boolean
}) {
  const eligible = staff.filter(s => s.eligible)
  const blocked = staff.filter(s => !s.eligible)

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-background border-l shadow-xl z-40 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold text-sm">Assign staff</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {loadingPanel ? (
          <p className="text-sm text-muted-foreground text-center py-8">Checking eligibility…</p>
        ) : (
          <>
            {eligible.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Eligible ({eligible.length})
                </div>
                <div className="space-y-1">
                  {eligible.map(s => (
                    <button
                      key={s.id}
                      onClick={() => onAssign(s.id)}
                      disabled={pending}
                      className="w-full text-left px-3 py-2 text-sm rounded-md border bg-card hover:bg-muted/40 disabled:opacity-50 transition-colors"
                    >
                      {s.first_name} {s.last_name}
                      {s.warnings.length > 0 && (
                        <span className="ml-2 text-xs text-amber-600">⚠ {s.warnings[0]?.rule_code}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {blocked.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Blocked ({blocked.length})
                </div>
                <div className="space-y-1">
                  {blocked.map(s => (
                    <div key={s.id} className="px-3 py-2 text-sm rounded-md border bg-muted/20">
                      <div className="font-medium text-muted-foreground">{s.first_name} {s.last_name}</div>
                      <div className="text-xs text-destructive/80 mt-0.5">
                        {s.blocks[0]?.rule_code?.replace(/_/g, ' ')}
                        {s.blocks[0]?.override_path !== 'none' && (
                          <button
                            onClick={() => onAssign(s.id)}
                            disabled={pending}
                            className="ml-2 text-primary underline"
                          >
                            Override
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {staff.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No active staff found.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function OverrideModal({
  blocks, onConfirm, onClose, pending,
}: {
  blocks: RuleBlock[]
  onConfirm: (formData: FormData) => void
  onClose: () => void
  pending: boolean
}) {
  const primaryBlock = blocks[0]!
  const reasons = OVERRIDE_REASONS[primaryBlock.rule_code] ?? ['Exceptional_circumstance']

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('rule_code', primaryBlock.rule_code)
    onConfirm(fd)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
        <h2 className="text-base font-semibold">Override required</h2>

        <div className="space-y-2">
          {blocks.map((b, i) => (
            <div key={i} className="p-3 rounded bg-destructive/10 text-sm">
              <div className="font-medium text-destructive">{b.rule_code.replace(/_/g, ' ')}</div>
              <div className="text-destructive/80 text-xs mt-0.5">{b.message}</div>
              <div className="text-xs text-muted-foreground mt-1">Override path: {b.override_path.replace(/_/g, ' ')}</div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Reason *</label>
            <select name="reason_category" required className="w-full border rounded px-3 py-1.5 text-sm bg-background">
              {reasons.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Justification (min 20 chars) *</label>
            <textarea
              name="justification"
              required
              minLength={20}
              rows={3}
              placeholder="Explain why this override is necessary…"
              className="w-full border rounded px-3 py-1.5 text-sm resize-none"
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="text-sm px-3 py-1.5 rounded border">Cancel</button>
            <button
              type="submit"
              disabled={pending}
              className="text-sm px-3 py-1.5 rounded bg-destructive text-destructive-foreground disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Confirm override & assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
