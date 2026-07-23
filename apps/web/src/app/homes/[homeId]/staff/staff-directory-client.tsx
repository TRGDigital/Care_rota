'use client'

import { useState, useMemo, Fragment } from 'react'
import Link from 'next/link'
import { WeightingInput } from './weighting-input'
import { RoleSelect } from './role-select'
import { ShiftTypeSelect, ContractStatusSelect, LeaveField } from './inline-editors'
import { SpecialistRolesSelect } from './specialist-roles-select'
import { StaffActionMenu } from './staff-action-menu'

const STATUS_STYLES: Record<string, string> = {
  active:          'bg-green-50 text-green-700',
  inactive:        'bg-gray-100 text-gray-500',
  on_leave:        'bg-amber-50 text-amber-700',
  maternity:       'bg-purple-50 text-purple-700',
  paternity:       'bg-blue-50 text-blue-700',
  shared_parental: 'bg-indigo-50 text-indigo-700',
  adoption:        'bg-teal-50 text-teal-700',
  long_term_sick:  'bg-orange-50 text-orange-700',
  suspended:       'bg-red-50 text-red-600',
  left:            'bg-gray-100 text-gray-500',
}

const STATUS_LABELS: Record<string, string> = {
  active:          'Active',
  inactive:        'Inactive',
  on_leave:        'On leave',
  maternity:       'Maternity',
  paternity:       'Paternity',
  shared_parental: 'Shared parental',
  adoption:        'Adoption',
  long_term_sick:  'Long-term sick',
  suspended:       'Suspended',
  left:            'Left',
}

const STATUS_ORDER = ['active', 'on_leave', 'maternity', 'paternity', 'shared_parental', 'adoption', 'long_term_sick', 'suspended', 'inactive', 'left']

const CONTRACT_LABELS: Record<string, string> = {
  full_time:  'Full time',
  part_time:  'Part time',
  bank:       'Bank',
  zero_hours: 'Zero hours',
}

function fmtRole(code: string) {
  return code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function fmtPence(p: number) {
  return `£${(p / 100).toFixed(2)}`
}

function fmtHours(h: number) {
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`
}

export type EnrichedStaff = {
  id: string
  first_name: string
  last_name: string
  employee_number: string | null
  status: string
  role_code: string | null
  shift_type: string
  specialisms: string[]
  overtime_weighting: number | null
  overtime_eligible: boolean | null
  contract: {
    contract_type: string
    contracted_hours_per_week: number
    holiday_entitlement_value: number
  } | null
  payRate: {
    role_code: string | null
    rate_weekday_pence: number
    rate_weekend_pence: number
  } | null
  leave: {
    entitlement_value: number
    taken_value: number
    balance_remaining: number | null
    allocation_unit: string
  } | null
}

type Stats = {
  activeCount: number
  totalHrsWk: number
  avgRatePence: number
}

type Props = {
  homeId: string
  homeUnit: string
  staff: EnrichedStaff[]
  roles: { code: string; name: string }[]
  stats: Stats
  statusCounts: Record<string, number>
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl bg-surface border border-border shadow-sm px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{sub}</p>
    </div>
  )
}

export function StaffDirectoryClient({ homeId, homeUnit, staff, roles, stats, statusCounts }: Props) {
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch]       = useState('')

  const tabs = useMemo(() => {
    const present = STATUS_ORDER.filter(s => (statusCounts[s] ?? 0) > 0)
    return [
      { key: 'all', label: 'All', count: staff.length },
      ...present.map(s => ({ key: s, label: STATUS_LABELS[s] ?? s, count: statusCounts[s] ?? 0 })),
    ]
  }, [staff.length, statusCounts])

  const filtered = useMemo(() => {
    let result = staff
    if (activeTab !== 'all') {
      result = result.filter(s => s.status === activeTab)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(s =>
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
        (s.employee_number ?? '').toLowerCase().includes(q)
      )
    }
    return result
  }, [staff, activeTab, search])

  const roleGroups = useMemo(() => {
    const groups = new Map<string, EnrichedStaff[]>()
    for (const s of filtered) {
      const key = s.role_code ?? '__unassigned__'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(s)
    }
    return [...groups.entries()].sort(([a], [b]) => {
      if (a === '__unassigned__') return 1
      if (b === '__unassigned__') return -1
      return fmtRole(a).localeCompare(fmtRole(b))
    })
  }, [filtered])

  return (
    <div>
      {/* Stat blocks */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active staff" value={stats.activeCount.toString()} sub="currently employed" />
        <StatCard label="Weekly contracted hours" value={fmtHours(stats.totalHrsWk)} sub="across active staff" />
        <StatCard label="Avg. hourly rate" value={stats.avgRatePence > 0 ? fmtPence(stats.avgRatePence) : '—'} sub="weekday rate, active staff" />
      </div>

      {/* Tabs + search row */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium transition-colors duration-[120ms] ${
                activeTab === t.key
                  ? 'bg-accent text-white'
                  : 'bg-canvas border border-border text-ink-muted hover:text-ink hover:border-border-strong'
              }`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 text-[11px] ${
                activeTab === t.key
                  ? 'bg-white/20 text-white'
                  : 'bg-surface text-ink-subtle'
              }`}>{t.count}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-subtle pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 w-full rounded-md border border-border bg-surface text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-light transition-[border-color,box-shadow] duration-[120ms] sm:w-64"
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl bg-surface border border-border shadow-sm px-6 py-12 text-center">
          <p className="text-sm text-ink-muted">
            {search.trim() ? `No staff match "${search}"` : 'No staff in this category.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-surface border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-strong text-left bg-canvas/60">
                  <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-subtle">Name</th>
                  <th className="px-6 py-3 text-xs font-medium text-muted-foreground">Role</th>
                  <th className="px-6 py-3 text-xs font-medium text-muted-foreground">Shift</th>
                  <th className="px-6 py-3 text-xs font-medium text-muted-foreground">Specialist roles</th>
                  <th className="px-6 py-3 text-xs font-medium text-muted-foreground">Contract</th>
                  <th className="px-6 py-3 text-xs font-medium text-muted-foreground text-center">Contracted hrs/wk</th>
                  <th className="px-6 py-3 text-xs font-medium text-muted-foreground text-right">Weekday rate</th>
                  <th className="px-6 py-3 text-xs font-medium text-muted-foreground text-right">Weekend rate</th>
                  <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-subtle text-center" title="Annual leave allocated (entitlement), hours. Editable.">AL allocated</th>
                  <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-subtle text-center" title="Annual leave taken so far, hours. Editable.">AL taken</th>
                  <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-subtle text-center" title="Allocated minus taken.">AL remaining</th>
                  <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-subtle text-center" title="Overtime auto-fill priority. Active eligible staff only.">Weighting</th>
                  <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-subtle">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {roleGroups.map(([roleKey, members]) => (
                  <Fragment key={roleKey}>
                    <tr className="border-b border-border bg-canvas/60">
                      <td colSpan={14} className="px-6 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">
                        {roleKey === '__unassigned__' ? 'No role assigned' : fmtRole(roleKey)}
                        <span className="ml-2 font-normal normal-case tracking-normal text-ink-subtle/70">({members.length})</span>
                      </td>
                    </tr>
                    {members.map(s => {
                      const unit     = s.leave ? (s.leave.allocation_unit === 'hours' ? 'h' : 'd') : homeUnit
                      const isActive = s.status === 'active'
                      return (
                        <tr key={s.id} className="border-b border-border last:border-0 hover:bg-canvas/60 transition-colors duration-[120ms]">
                          <td className="px-6 py-3">
                            <Link
                              href={`/homes/${homeId}/staff/${s.id}`}
                              className="font-medium text-ink hover:text-accent transition-colors duration-[120ms]"
                            >
                              {s.first_name} {s.last_name}
                            </Link>
                            {s.employee_number && (
                              <div className="text-xs text-ink-subtle font-mono">#{s.employee_number}</div>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            <RoleSelect homeId={homeId} staffId={s.id} value={s.role_code} roles={roles} />
                          </td>
                          <td className="px-6 py-3">
                            <ShiftTypeSelect homeId={homeId} staffId={s.id} value={s.shift_type} />
                          </td>
                          <td className="px-6 py-3">
                            <SpecialistRolesSelect homeId={homeId} staffId={s.id} value={s.specialisms} />
                          </td>
                          <td className="px-6 py-3">
                            <ContractStatusSelect homeId={homeId} staffId={s.id} contractType={s.contract?.contract_type ?? null} status={s.status} />
                          </td>
                          <td className="px-6 py-3 text-center tabular-nums text-sm text-ink-muted">
                            {s.contract ? fmtHours(s.contract.contracted_hours_per_week) : '—'}
                          </td>
                          <td className="px-6 py-3 text-right tabular-nums text-sm text-ink-muted">
                            {s.payRate ? fmtPence(s.payRate.rate_weekday_pence) : '—'}
                          </td>
                          <td className="px-6 py-3 text-right tabular-nums text-sm text-ink-muted">
                            {s.payRate ? fmtPence(s.payRate.rate_weekend_pence) : '—'}
                          </td>
                          {(() => {
                            const ent = s.leave?.entitlement_value ?? s.contract?.holiday_entitlement_value ?? 0
                            const taken = s.leave?.taken_value ?? 0
                            const remaining = Math.round((ent - taken) * 10) / 10
                            return (
                              <>
                                <td className="px-6 py-3">
                                  <LeaveField homeId={homeId} staffId={s.id} field="entitlement" value={ent} otherValue={taken} />
                                </td>
                                <td className="px-6 py-3">
                                  <LeaveField homeId={homeId} staffId={s.id} field="taken" value={taken} otherValue={ent} />
                                </td>
                                <td className="px-6 py-3 text-center tabular-nums font-medium text-sm">
                                  <span className={remaining < 3 ? 'text-amber-600' : 'text-green-700'}>{remaining}{s.leave ? unit : homeUnit}</span>
                                </td>
                              </>
                            )
                          })()}
                          <td className="px-6 py-3 text-center">
                            {!isActive
                              ? <span className="text-xs text-muted-foreground/50 italic">—</span>
                              : s.overtime_eligible === false
                                ? <span className="text-xs text-ink-subtle italic">ineligible</span>
                                : <WeightingInput homeId={homeId} staffId={s.id} value={Number(s.overtime_weighting ?? 0)} />
                            }
                          </td>
                          <td className="px-6 py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium ${STATUS_STYLES[s.status] ?? STATUS_STYLES.inactive}`}>
                              {STATUS_LABELS[s.status] ?? s.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <StaffActionMenu href={`/homes/${homeId}/staff/${s.id}`} />
                          </td>
                        </tr>
                      )
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-8 rounded-xl bg-surface border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-3.5 border-b border-border">
          <h2 className="text-sm font-semibold text-ink">Column guide</h2>
        </div>
        <div className="px-6 py-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { col: 'Name',           desc: 'Full name and employee number. Click to open the staff profile.' },
            { col: 'Role',           desc: 'Position (editable). Matches CareStream. Changing it resets overtime eligibility to the role default.' },
            { col: 'Shift',          desc: 'Whether they work Day, Night, or Both. Matches CareStream shift pattern.' },
            { col: 'Contract',       desc: 'Full time / Part time / Bank / Zero hours, or Long-term sick (removes them from the rota and the overtime pool).' },
            { col: 'Contracted hrs/wk', desc: 'Contracted hours per week under the current contract.' },
            { col: 'Weekday rate',   desc: 'Weekday hourly pay rate (most recent pay rate record).' },
            { col: 'Weekend rate',   desc: 'Weekend hourly pay rate. Often the same as weekday, but can differ.' },
            { col: 'AL allocated',   desc: 'Annual leave entitlement (hours). Editable — fill in anyone the holiday import missed.' },
            { col: 'AL taken',       desc: 'Annual leave taken so far this year (hours). Editable.' },
            { col: 'AL remaining',   desc: 'Allocated minus taken. Amber when under 3.' },
            { col: 'Specialist roles', desc: 'Any specialist/champion roles the person holds (Safeguarding lead, IPC lead, Fire safety, etc.). Multi-select.' },
            { col: 'Weighting',      desc: 'Overtime pool share — all active eligible staff share 100%. Adjusting one auto-redistributes the rest.' },
            { col: 'Status',         desc: 'Employment status. Weighting is only shown for active staff.' },
          ].map(({ col, desc }) => (
            <div key={col} className="flex gap-2 text-sm">
              <span className="font-medium text-ink shrink-0 w-28">{col}</span>
              <span className="text-ink-muted">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
