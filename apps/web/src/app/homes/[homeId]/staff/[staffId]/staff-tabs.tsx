'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { Database } from '@carerota/types/src/database.types'
import { reportSickness, closeReturnToWork } from './sickness-actions'
import { updateStaff } from '../actions'
import {
  addContract, updateContract,
  addPayRate, updatePayRate,
  addDocument, updateDocument,
  addTrainingCert, updateTrainingCert,
  upsertSponsorship,
  addLeaveRequest, updateLeaveRequestStatus, upsertLeaveBalance,
  addSicknessEpisode,
  saveFixedSchedule,
} from './tab-actions'

type Staff = Database['public']['Tables']['staff']['Row']
type Contract = Database['public']['Tables']['staff_contracts']['Row']
type PayRate = Database['public']['Tables']['staff_pay_rates']['Row']
type Document = Database['public']['Tables']['staff_documents']['Row']
type TrainingCert = Database['public']['Tables']['staff_training_certs']['Row'] & {
  training_topics: { name: string } | null
}
type Sponsorship = Database['public']['Tables']['staff_sponsorship']['Row'] | null
type SicknessEpisode = Database['public']['Tables']['sickness_episodes']['Row']
type LeaveReq = { id: string; type: string; start_date: string; end_date: string; value_requested: number; status: string; submitted_at: string }
type LeaveBalance = Database['public']['Tables']['leave_balances']['Row'] | null
type TrainingTopic = { id: string; name: string }
type ShiftTemplate = { id: string; name: string; start_time_local: string; end_time_local: string; paid_hours_decimal: number }
type FixedShift = { id: string; day_of_week: number; shift_template_id: string; effective_from: string; effective_to: string | null }

const TABS = [
  { key: 'personal',    label: 'Personal' },
  { key: 'contracts',   label: 'Contracts' },
  { key: 'pay',         label: 'Pay rates' },
  { key: 'documents',   label: 'Documents' },
  { key: 'training',    label: 'Training' },
  { key: 'sponsorship', label: 'Sponsorship' },
  { key: 'leave',       label: 'Leave' },
  { key: 'sickness',    label: 'Sickness' },
] as const

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full time', part_time: 'Part time', bank: 'Bank', zero_hours: 'Zero hours',
}

const DOC_TYPE_OPTIONS = [
  { value: 'passport',                   label: 'Passport' },
  { value: 'biometric_residence_permit', label: 'BRP' },
  { value: 'share_code',                 label: 'Share code' },
  { value: 'dbs_certificate',            label: 'DBS certificate' },
  { value: 'proof_of_address',           label: 'Proof of address' },
  { value: 'training_certificate',       label: 'Training certificate' },
  { value: 'fit_note',                   label: 'Fit note' },
  { value: 'p45',                        label: 'P45' },
  { value: 'p60',                        label: 'P60' },
  { value: 'contract',                   label: 'Contract' },
  { value: 'nmc_pin',                    label: 'NMC PIN' },
  { value: 'driving_licence',            label: 'Driving licence' },
  { value: 'other',                      label: 'Other' },
]
const DOC_TYPE_LABELS = Object.fromEntries(DOC_TYPE_OPTIONS.map(o => [o.value, o.label]))

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: 'Annual', compassionate: 'Compassionate', maternity: 'Maternity',
  paternity: 'Paternity', shared_parental: 'Shared parental', adoption: 'Adoption',
  unpaid: 'Unpaid', toil: 'TOIL', other: 'Other',
}

function pence(v: number | bigint) { return `£${(Number(v) / 100).toFixed(2)}` }
function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Shared styles
const inputCls = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background'
const labelCls = 'mb-1.5 block text-sm font-medium text-foreground'
const btnPrimary = 'rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50'
const btnSecondary = 'rounded-lg border border-gray-300 bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors'
const btnOutline = 'inline-flex items-center gap-1.5 rounded-md border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 transition-colors'

export function StaffTabs({
  homeId, staff, contracts, payRates, documents, training, trainingTopics,
  shiftTemplates, fixedShifts, sponsorship, sickness, leaveRequests, leaveBalance, activeTab,
}: {
  homeId: string
  staff: Staff
  contracts: Contract[]
  payRates: PayRate[]
  documents: Document[]
  training: TrainingCert[]
  trainingTopics: TrainingTopic[]
  shiftTemplates: ShiftTemplate[]
  fixedShifts: FixedShift[]
  sponsorship: Sponsorship
  sickness: SicknessEpisode[]
  leaveRequests: LeaveReq[]
  leaveBalance: LeaveBalance
  activeTab: string
}) {
  const pathname = usePathname()

  return (
    <div className="mt-4">
      <nav className="flex flex-wrap gap-1 border-b mb-6">
        {TABS.map(t => (
          <Link
            key={t.key}
            href={`${pathname}?tab=${t.key}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {activeTab === 'personal'    && <PersonalTab homeId={homeId} staff={staff} />}
      {activeTab === 'contracts'   && <ContractsTab homeId={homeId} staffId={staff.id} contracts={contracts} shiftTemplates={shiftTemplates} fixedShifts={fixedShifts} />}
      {activeTab === 'pay'         && <PayTab homeId={homeId} staffId={staff.id} payRates={payRates} />}
      {activeTab === 'documents'   && <DocumentsTab homeId={homeId} staffId={staff.id} documents={documents} />}
      {activeTab === 'training'    && <TrainingTab homeId={homeId} staffId={staff.id} training={training} topics={trainingTopics} />}
      {activeTab === 'sponsorship' && <SponsorshipTab homeId={homeId} staffId={staff.id} sponsorship={sponsorship} />}
      {activeTab === 'leave'       && <LeaveTab homeId={homeId} staffId={staff.id} leaveRequests={leaveRequests} leaveBalance={leaveBalance} />}
      {activeTab === 'sickness'    && <SicknessTab homeId={homeId} staffId={staff.id} episodes={sickness} />}
    </div>
  )
}

// ── Shared components ─────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 min-h-[1.5rem]">
      <dt className="text-sm text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-sm font-medium text-foreground text-right">{value ?? <span className="text-muted-foreground/40">—</span>}</dd>
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value ?? '—'}</span>
    </div>
  )
}

function ErrorMsg({ msg }: { msg: string | null }) {
  if (!msg) return null
  return <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{msg}</p>
}

// ── Personal tab ──────────────────────────────────────────────────────────────

function PersonalTab({ homeId, staff }: { homeId: string; staff: Staff }) {
  const router = useRouter()
  const [editing,       setEditing]       = useState(false)
  const [pending,       startTransition]  = useTransition()
  const [weighting,     setWeighting]     = useState(Math.round(Number(staff.overtime_weighting ?? 0) * 10) / 10)
  const [eligible,      setEligible]      = useState(staff.overtime_eligible ?? true)
  const [overtimeSaved, setOvertimeSaved] = useState(false)
  const [editError,     setEditError]     = useState<string | null>(null)
  const [editSaved,     setEditSaved]     = useState(false)
  const [editOTEligible, setEditOTEligible] = useState(staff.overtime_eligible ?? true)

  const STATUS_BADGES: Record<string, string> = {
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

  async function saveOvertimeSettings() {
    const res = await fetch(`/api/homes/${homeId}/staff-weighting`, {
      method: 'POST',
      body: JSON.stringify({ staffId: staff.id, overtime_weighting: weighting, overtime_eligible: eligible }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.ok) {
      setOvertimeSaved(true)
      setTimeout(() => setOvertimeSaved(false), 2000)
      router.refresh()
    }
  }

  function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setEditError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateStaff(homeId, staff.id, fd)
      if (result && 'error' in result && result.error) {
        setEditError(result.error)
      } else {
        setEditing(false)
        setEditSaved(true)
        setTimeout(() => setEditSaved(false), 2000)
        router.refresh()
      }
    })
  }

  return (
    <div className="max-w-3xl space-y-4">
      {!editing && (
        <>
          <div className="rounded-xl bg-card shadow-[0_2px_8px_rgba(79,70,229,0.06),0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b">
              <h2 className="text-sm font-semibold text-foreground">Staff details</h2>
              <div className="flex items-center gap-3">
                {editSaved && <span className="text-xs text-green-700 font-medium">Saved ✓</span>}
                <button type="button" onClick={() => setEditing(true)} className={btnOutline}>Edit details</button>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x">
              <div className="px-5 py-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Personal</p>
                <dl className="space-y-2.5">
                  <InfoRow label="Date of birth" value={fmtDate(staff.date_of_birth)} />
                  <InfoRow label="NI number" value={staff.ni_number ? <span className="font-mono text-sm">{staff.ni_number}</span> : null} />
                  <InfoRow label="Address" value={staff.address} />
                </dl>
              </div>
              <div className="px-5 py-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employment</p>
                <dl className="space-y-2.5">
                  <InfoRow label="Employee no." value={staff.employee_number} />
                  <InfoRow label="Status" value={
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGES[staff.status] ?? STATUS_BADGES.inactive}`}>
                      {staff.status.replace('_', ' ')}
                    </span>
                  } />
                  <InfoRow label="Started" value={fmtDate(staff.date_started)} />
                  <InfoRow label="Left" value={staff.date_left ? fmtDate(staff.date_left) : null} />
                </dl>
              </div>
            </div>
          </div>
          <OvertimeCard
            eligible={eligible} weighting={weighting} saved={overtimeSaved} pending={pending}
            onToggle={() => setEligible(v => !v)} onWeightChange={setWeighting}
            onSave={() => startTransition(saveOvertimeSettings)}
          />
        </>
      )}

      {editing && (
        <div className="rounded-xl bg-card shadow-[0_2px_8px_rgba(79,70,229,0.06),0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b">
            <h2 className="text-sm font-semibold">Edit staff details</h2>
          </div>
          <form onSubmit={handleEditSubmit} className="px-5 py-5 space-y-5">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Personal</p>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>First name *</label><input name="first_name" required defaultValue={staff.first_name} className={inputCls} /></div>
                <div><label className={labelCls}>Last name *</label><input name="last_name" required defaultValue={staff.last_name} className={inputCls} /></div>
                <div><label className={labelCls}>Date of birth</label><input type="date" name="date_of_birth" defaultValue={staff.date_of_birth ?? ''} className={inputCls} /></div>
                <div><label className={labelCls}>NI number</label><input name="ni_number" defaultValue={staff.ni_number ?? ''} placeholder="AB123456C" className={`${inputCls} font-mono`} /></div>
                <div className="col-span-2"><label className={labelCls}>Address</label><textarea name="address" rows={2} defaultValue={staff.address ?? ''} className={`${inputCls} resize-none`} /></div>
              </div>
            </div>
            <div className="border-t pt-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employment</p>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Employee number</label><input name="employee_number" defaultValue={staff.employee_number ?? ''} className={inputCls} /></div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select name="status" defaultValue={staff.status} className={inputCls}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="on_leave">On leave</option>
                    <option value="maternity">Maternity leave</option>
                    <option value="paternity">Paternity leave</option>
                    <option value="shared_parental">Shared parental leave</option>
                    <option value="adoption">Adoption leave</option>
                    <option value="long_term_sick">Long term sick</option>
                    <option value="suspended">Suspended</option>
                    <option value="left">Left</option>
                  </select>
                </div>
                <div><label className={labelCls}>Date started</label><input type="date" name="date_started" defaultValue={staff.date_started ?? ''} className={inputCls} /></div>
                <div><label className={labelCls}>Date left</label><input type="date" name="date_left" defaultValue={staff.date_left ?? ''} className={inputCls} /></div>
              </div>
            </div>
            <div className="border-t pt-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overtime eligibility</p>
              <input type="hidden" name="overtime_eligible" value={editOTEligible ? 'on' : 'off'} />
              <button type="button" onClick={() => setEditOTEligible(v => !v)}
                className={`flex items-center gap-3 w-full rounded-lg border px-4 py-3 text-left transition-colors ${editOTEligible ? 'border-primary/30 bg-primary/5' : 'border-gray-200 bg-muted/20'}`}
              >
                <span className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${editOTEligible ? 'bg-primary' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${editOTEligible ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </span>
                <div>
                  <p className="text-sm font-medium">{editOTEligible ? 'Eligible for overtime' : 'Not eligible for overtime'}</p>
                  <p className="text-xs text-muted-foreground">{editOTEligible ? 'Can be offered overtime shifts' : 'Will never be offered overtime shifts'}</p>
                </div>
              </button>
            </div>
            <ErrorMsg msg={editError} />
            <div className="flex items-center justify-end gap-3 border-t pt-4">
              <button type="button" onClick={() => { setEditing(false); setEditError(null) }} className={btnSecondary}>Cancel</button>
              <button type="submit" disabled={pending} className={btnPrimary}>{pending ? 'Saving…' : 'Save changes'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function OvertimeCard({ eligible, weighting, saved, pending, onToggle, onWeightChange, onSave }: {
  eligible: boolean; weighting: number; saved: boolean; pending: boolean
  onToggle: () => void; onWeightChange: (v: number) => void; onSave: () => void
}) {
  return (
    <div className="rounded-xl bg-card shadow-[0_2px_8px_rgba(79,70,229,0.06),0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b">
        <h2 className="text-sm font-semibold">Overtime</h2>
        {saved && <span className="text-xs text-green-700 font-medium">Saved ✓</span>}
      </div>
      <div className="px-5 py-4 space-y-4">
        <button type="button" onClick={onToggle}
          className={`flex items-center gap-3 w-full rounded-lg border px-4 py-3 text-left transition-colors ${eligible ? 'border-primary/30 bg-primary/5' : 'border-gray-200 bg-muted/20'}`}
        >
          <span className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${eligible ? 'bg-primary' : 'bg-gray-300'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${eligible ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </span>
          <div>
            <p className="text-sm font-medium">{eligible ? 'Eligible for overtime' : 'Not eligible for overtime'}</p>
            <p className="text-xs text-muted-foreground">{eligible ? 'Can be offered overtime shifts' : 'Will never be offered overtime shifts'}</p>
          </div>
        </button>
        {eligible && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Share of role pool</label>
              <span className="text-sm font-semibold tabular-nums text-primary">{weighting.toFixed(1)}%</span>
            </div>
            <input type="range" min={0} max={100} step={0.1} value={weighting}
              onChange={e => onWeightChange(Math.round(Number(e.target.value) * 10) / 10)}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0% — last offered</span><span>100% — first offered</span>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Each role shares 100% between all eligible staff. Adjusting this person automatically redistributes the remainder equally to others in the same role.
            </p>
          </div>
        )}
        <div className="flex justify-end pt-1">
          <button onClick={onSave} disabled={pending} className={btnPrimary}>{pending ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Contracts tab ─────────────────────────────────────────────────────────────

function ContractsTab({ homeId, staffId, contracts, shiftTemplates, fixedShifts }: {
  homeId: string; staffId: string; contracts: Contract[]
  shiftTemplates: ShiftTemplate[]; fixedShifts: FixedShift[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [adding,  setAdding]  = useState(false)
  const [editId,  setEditId]  = useState<string | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [saved,   setSaved]   = useState(false)

  function handleSaved() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await addContract(homeId, staffId, fd)
      if ('error' in r) { setError(r.error) } else { setAdding(false); handleSaved() }
    })
  }

  function handleEdit(e: React.FormEvent<HTMLFormElement>, cId: string) {
    e.preventDefault(); setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await updateContract(homeId, staffId, cId, fd)
      if ('error' in r) { setError(r.error) } else { setEditId(null); handleSaved() }
    })
  }

  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Contracts ({contracts.length})</h3>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-green-700 font-medium">Saved ✓</span>}
          {!adding && <button type="button" onClick={() => { setAdding(true); setEditId(null); setError(null) }} className={btnOutline}>+ Add contract</button>}
        </div>
      </div>

      {adding && (
        <ContractForm
          onSubmit={handleAdd} onCancel={() => { setAdding(false); setError(null) }}
          pending={pending} error={error}
        />
      )}

      {contracts.length === 0 && !adding && <p className="text-sm text-muted-foreground">No contracts recorded.</p>}

      {contracts.map(c => (
        <div key={c.id} className="bg-card border rounded-lg overflow-hidden">
          {editId === c.id ? (
            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Edit contract</p>
              <ContractForm
                defaults={c} onSubmit={e => handleEdit(e, c.id)}
                onCancel={() => { setEditId(null); setError(null) }}
                pending={pending} error={error}
              />
            </div>
          ) : (
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{CONTRACT_TYPE_LABELS[c.contract_type] ?? c.contract_type}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {fmtDate(c.effective_from)} – {c.effective_to ? fmtDate(c.effective_to) : 'present'}
                  </span>
                  <button type="button" onClick={() => { setEditId(c.id); setAdding(false); setError(null) }} className="text-xs text-primary hover:underline">Edit</button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <span>{c.contracted_hours_per_week}h/wk</span>
                <span>{c.shift_pattern_preference.replace('_', ' ')}</span>
                <span>{c.holiday_entitlement_value} days holiday</span>
              </div>
            </div>
          )}
        </div>
      ))}

      <FixedScheduleSection homeId={homeId} staffId={staffId} shiftTemplates={shiftTemplates} fixedShifts={fixedShifts} />
    </div>
  )
}

function ContractForm({ defaults, onSubmit, onCancel, pending, error }: {
  defaults?: Contract; onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onCancel: () => void; pending: boolean; error: string | null
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Contract type *</label>
          <select name="contract_type" defaultValue={defaults?.contract_type ?? 'full_time'} className={inputCls}>
            <option value="full_time">Full time</option>
            <option value="part_time">Part time</option>
            <option value="bank">Bank</option>
            <option value="zero_hours">Zero hours</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Hours/week *</label>
          <input type="number" name="contracted_hours_per_week" min={0} max={168} step={0.5}
            defaultValue={defaults?.contracted_hours_per_week ?? ''} className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>Shift preference</label>
          <select name="shift_pattern_preference" defaultValue={defaults?.shift_pattern_preference ?? 'any'} className={inputCls}>
            <option value="any">Any</option>
            <option value="day_only">Days only</option>
            <option value="night_only">Nights only</option>
            <option value="days_and_nights">Days and nights</option>
            <option value="early_only">Early only</option>
            <option value="late_only">Late only</option>
            <option value="no_nights">No nights</option>
            <option value="no_weekends">No weekends</option>
            <option value="fixed">Fixed pattern</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Holiday entitlement</label>
          <input type="number" name="holiday_entitlement_value" min={0} max={9999} step={0.01}
            defaultValue={defaults?.holiday_entitlement_value ?? 28} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Effective from *</label>
          <input type="date" name="effective_from" defaultValue={defaults?.effective_from ?? ''} className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>Effective to</label>
          <input type="date" name="effective_to" defaultValue={defaults?.effective_to ?? ''} className={inputCls} />
        </div>
      </div>
      <ErrorMsg msg={error} />
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className={btnSecondary}>Cancel</button>
        <button type="submit" disabled={pending} className={btnPrimary}>{pending ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  )
}

// ── Fixed schedule section ────────────────────────────────────────────────────

const DAYS = [
  { dow: 1, label: 'Monday' },
  { dow: 2, label: 'Tuesday' },
  { dow: 3, label: 'Wednesday' },
  { dow: 4, label: 'Thursday' },
  { dow: 5, label: 'Friday' },
  { dow: 6, label: 'Saturday' },
  { dow: 0, label: 'Sunday' },
]

function fmtTime(t: string) {
  return t.slice(0, 5) // "HH:MM:SS" → "HH:MM"
}

function FixedScheduleSection({ homeId, staffId, shiftTemplates, fixedShifts }: {
  homeId: string; staffId: string
  shiftTemplates: ShiftTemplate[]; fixedShifts: FixedShift[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [saved,   setSaved]   = useState(false)

  // Build day → templateId map from existing fixed shifts
  const currentMap = Object.fromEntries(fixedShifts.map(fs => [fs.day_of_week, fs.shift_template_id]))
  const [selections, setSelections] = useState<Record<number, string>>(currentMap)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null)
    const fd = new FormData()
    for (const { dow } of DAYS) {
      const val = selections[dow] ?? ''
      if (val) fd.set(`day_${dow}`, val)
    }
    startTransition(async () => {
      const r = await saveFixedSchedule(homeId, staffId, fd)
      if ('error' in r) { setError(r.error) } else {
        setEditing(false); setSaved(true); setTimeout(() => setSaved(false), 2000); router.refresh()
      }
    })
  }

  const hasSchedule = fixedShifts.length > 0
  const templateById = Object.fromEntries(shiftTemplates.map(t => [t.id, t]))

  return (
    <div className="mt-6 rounded-xl bg-card shadow-[0_2px_8px_rgba(79,70,229,0.06),0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b">
        <div>
          <h3 className="text-sm font-semibold">Fixed shift schedule</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Applied automatically when a new rota period is created</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-green-700 font-medium">Saved ✓</span>}
          {!editing && (
            <button type="button" onClick={() => setEditing(true)} className={btnOutline}>
              {hasSchedule ? 'Edit schedule' : '+ Set schedule'}
            </button>
          )}
        </div>
      </div>

      {shiftTemplates.length === 0 && (
        <p className="px-5 py-4 text-sm text-amber-600">
          No shift templates configured for this home yet. Add templates in Settings → Shift templates before setting a fixed schedule.
        </p>
      )}

      {shiftTemplates.length > 0 && !editing && (
        <div className="divide-y">
          {DAYS.map(({ dow, label }) => {
            const tmpl = currentMap[dow] ? templateById[currentMap[dow]!] : null
            return (
              <div key={dow} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="text-muted-foreground w-24">{label}</span>
                {tmpl ? (
                  <span className="font-medium">
                    {tmpl.name}
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      {fmtTime(tmpl.start_time_local)}–{fmtTime(tmpl.end_time_local)} ({tmpl.paid_hours_decimal}h)
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground/40 italic text-xs">Off / not set</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {shiftTemplates.length > 0 && editing && (
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div className="space-y-2">
            {DAYS.map(({ dow, label }) => (
              <div key={dow} className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground w-24 shrink-0">{label}</span>
                <select
                  value={selections[dow] ?? ''}
                  onChange={e => setSelections(prev => ({ ...prev, [dow]: e.target.value }))}
                  className={`${inputCls} flex-1`}
                >
                  <option value="">Off</option>
                  {shiftTemplates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} — {fmtTime(t.start_time_local)}–{fmtTime(t.end_time_local)} ({t.paid_hours_decimal}h)
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <ErrorMsg msg={error} />
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={() => { setEditing(false); setSelections(currentMap); setError(null) }} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={pending} className={btnPrimary}>{pending ? 'Saving…' : 'Save schedule'}</button>
          </div>
        </form>
      )}
    </div>
  )
}

// ── Pay rates tab ─────────────────────────────────────────────────────────────

function PayTab({ homeId, staffId, payRates }: { homeId: string; staffId: string; payRates: PayRate[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [adding,  setAdding]  = useState(false)
  const [editId,  setEditId]  = useState<string | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [saved,   setSaved]   = useState(false)

  function handleSaved() { setSaved(true); setTimeout(() => setSaved(false), 2000); router.refresh() }

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await addPayRate(homeId, staffId, fd)
      if ('error' in r) { setError(r.error) } else { setAdding(false); handleSaved() }
    })
  }

  function handleEdit(e: React.FormEvent<HTMLFormElement>, rId: string) {
    e.preventDefault(); setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await updatePayRate(homeId, staffId, rId, fd)
      if ('error' in r) { setError(r.error) } else { setEditId(null); handleSaved() }
    })
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Pay rates</h3>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-green-700 font-medium">Saved ✓</span>}
          {!adding && <button type="button" onClick={() => { setAdding(true); setEditId(null); setError(null) }} className={btnOutline}>+ Add pay rate</button>}
        </div>
      </div>

      {adding && (
        <div className="border rounded-lg p-4 bg-card">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">New pay rate</p>
          <PayRateForm onSubmit={handleAdd} onCancel={() => { setAdding(false); setError(null) }} pending={pending} error={error} />
        </div>
      )}

      {payRates.length === 0 && !adding && <p className="text-sm text-muted-foreground">No pay rates recorded.</p>}

      {payRates.map(r => (
        <div key={r.id} className="border rounded-lg overflow-hidden bg-card">
          {editId === r.id ? (
            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Edit pay rate</p>
              <PayRateForm
                defaults={r}
                onSubmit={e => handleEdit(e, r.id)}
                onCancel={() => { setEditId(null); setError(null) }}
                pending={pending} error={error}
              />
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
                <span className="font-mono text-xs font-semibold">{r.role_code}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">From {fmtDate(r.effective_from)}</span>
                  <button type="button" onClick={() => { setEditId(r.id); setAdding(false); setError(null) }} className="text-xs text-primary hover:underline">Edit</button>
                </div>
              </div>
              <div className="grid grid-cols-5 divide-x text-center text-xs py-2">
                <div className="px-3"><div className="text-muted-foreground mb-0.5">Weekday</div><div className="font-medium">{pence(r.rate_weekday_pence)}</div></div>
                <div className="px-3"><div className="text-muted-foreground mb-0.5">Weekend</div><div className="font-medium">{pence(r.rate_weekend_pence)}</div></div>
                <div className="px-3"><div className="text-muted-foreground mb-0.5">Night</div><div className="font-medium">{pence(r.rate_night_pence)}</div></div>
                <div className="px-3"><div className="text-muted-foreground mb-0.5">Overtime</div><div className="font-medium">{pence(r.rate_overtime_pence)}</div></div>
                <div className="px-3"><div className="text-muted-foreground mb-0.5">Training</div><div className="font-medium">{pence(r.rate_training_pence)}</div></div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function PayRateForm({ defaults, onSubmit, onCancel, pending, error }: {
  defaults?: PayRate
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onCancel: () => void; pending: boolean; error: string | null
}) {
  function p2f(pence: number | bigint) { return (Number(pence) / 100).toFixed(2) }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>Role code *</label>
          <input name="role_code" placeholder="e.g. senior_carer" defaultValue={defaults?.role_code ?? ''} className={inputCls} required />
        </div>
        <div><label className={labelCls}>Weekday (£/hr) *</label><input type="number" name="rate_weekday" min={0} step={0.01} defaultValue={defaults ? p2f(defaults.rate_weekday_pence) : ''} className={inputCls} required /></div>
        <div><label className={labelCls}>Weekend (£/hr) *</label><input type="number" name="rate_weekend" min={0} step={0.01} defaultValue={defaults ? p2f(defaults.rate_weekend_pence) : ''} className={inputCls} required /></div>
        <div><label className={labelCls}>Night (£/hr) *</label><input type="number" name="rate_night" min={0} step={0.01} defaultValue={defaults ? p2f(defaults.rate_night_pence) : ''} className={inputCls} required /></div>
        <div><label className={labelCls}>Overtime (£/hr) *</label><input type="number" name="rate_overtime" min={0} step={0.01} defaultValue={defaults ? p2f(defaults.rate_overtime_pence) : ''} className={inputCls} required /></div>
        <div><label className={labelCls}>Training (£/hr) *</label><input type="number" name="rate_training" min={0} step={0.01} defaultValue={defaults ? p2f(defaults.rate_training_pence) : ''} className={inputCls} required /></div>
        <div><label className={labelCls}>Sleep-in flat (£)</label><input type="number" name="rate_sleep_in" min={0} step={0.01} defaultValue={defaults ? p2f(defaults.rate_sleep_in_flat_pence) : '0'} className={inputCls} /></div>
        <div className="col-span-2">
          <label className={labelCls}>Effective from *</label>
          <input type="date" name="effective_from" defaultValue={defaults?.effective_from ?? ''} className={inputCls} required />
        </div>
      </div>
      <ErrorMsg msg={error} />
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className={btnSecondary}>Cancel</button>
        <button type="submit" disabled={pending} className={btnPrimary}>{pending ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  )
}

// ── Documents tab ─────────────────────────────────────────────────────────────

function DocumentsTab({ homeId, staffId, documents }: { homeId: string; staffId: string; documents: Document[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [error,  setError]  = useState<string | null>(null)
  const [saved,  setSaved]  = useState(false)

  function handleSaved() { setSaved(true); setTimeout(() => setSaved(false), 2000); router.refresh() }

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await addDocument(homeId, staffId, fd)
      if ('error' in r) { setError(r.error) } else { setAdding(false); handleSaved() }
    })
  }

  function handleEdit(e: React.FormEvent<HTMLFormElement>, dId: string) {
    e.preventDefault(); setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await updateDocument(homeId, staffId, dId, fd)
      if ('error' in r) { setError(r.error) } else { setEditId(null); handleSaved() }
    })
  }

  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Documents ({documents.length})</h3>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-green-700 font-medium">Saved ✓</span>}
          {!adding && <button type="button" onClick={() => { setAdding(true); setEditId(null); setError(null) }} className={btnOutline}>+ Add document</button>}
        </div>
      </div>

      {adding && (
        <div className="border rounded-lg p-4 bg-card">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">New document</p>
          <DocForm onSubmit={handleAdd} onCancel={() => { setAdding(false); setError(null) }} pending={pending} error={error} />
        </div>
      )}

      {documents.length === 0 && !adding && <p className="text-sm text-muted-foreground">No documents uploaded.</p>}

      {documents.map(d => (
        <div key={d.id} className="bg-card border rounded-lg overflow-hidden">
          {editId === d.id ? (
            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Edit document</p>
              <DocForm defaults={d} onSubmit={e => handleEdit(e, d.id)} onCancel={() => { setEditId(null); setError(null) }} pending={pending} error={error} />
            </div>
          ) : (
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type}</div>
                <div className="text-xs text-muted-foreground space-x-3">
                  {d.document_number && <span>{d.document_number}</span>}
                  {d.issue_date  && <span>Issued {fmtDate(d.issue_date)}</span>}
                  {d.expiry_date && <span>Expires {fmtDate(d.expiry_date)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {d.verified_at ? <span className="text-green-700">Verified</span> : <span className="text-amber-600">Pending</span>}
                <button type="button" onClick={() => { setEditId(d.id); setAdding(false); setError(null) }} className="text-primary hover:underline">Edit</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function DocForm({ defaults, onSubmit, onCancel, pending, error }: {
  defaults?: Document; onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onCancel: () => void; pending: boolean; error: string | null
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>Document type *</label>
          <select name="doc_type" defaultValue={defaults?.doc_type ?? ''} className={inputCls} required>
            <option value="">Select type…</option>
            {DOC_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div><label className={labelCls}>Reference / number</label><input name="document_number" defaultValue={defaults?.document_number ?? ''} placeholder="e.g. 123456789" className={inputCls} /></div>
        <div><label className={labelCls}>Issue date</label><input type="date" name="issue_date" defaultValue={defaults?.issue_date ?? ''} className={inputCls} /></div>
        <div><label className={labelCls}>Expiry date</label><input type="date" name="expiry_date" defaultValue={defaults?.expiry_date ?? ''} className={inputCls} /></div>
      </div>
      <ErrorMsg msg={error} />
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className={btnSecondary}>Cancel</button>
        <button type="submit" disabled={pending} className={btnPrimary}>{pending ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  )
}

// ── Training tab ──────────────────────────────────────────────────────────────

function TrainingTab({ homeId, staffId, training, topics }: {
  homeId: string; staffId: string; training: TrainingCert[]; topics: TrainingTopic[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [adding,  setAdding]  = useState(false)
  const [editId,  setEditId]  = useState<string | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [saved,   setSaved]   = useState(false)
  const now = new Date()

  function handleSaved() { setSaved(true); setTimeout(() => setSaved(false), 2000); router.refresh() }

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await addTrainingCert(homeId, staffId, fd)
      if ('error' in r) { setError(r.error) } else { setAdding(false); handleSaved() }
    })
  }

  function handleEdit(e: React.FormEvent<HTMLFormElement>, tId: string) {
    e.preventDefault(); setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await updateTrainingCert(homeId, staffId, tId, fd)
      if ('error' in r) { setError(r.error) } else { setEditId(null); handleSaved() }
    })
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Training records ({training.length})</h3>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-green-700 font-medium">Saved ✓</span>}
          {!adding && <button type="button" onClick={() => { setAdding(true); setEditId(null); setError(null) }} className={btnOutline}>+ Add record</button>}
        </div>
      </div>

      {adding && (
        <div className="border rounded-lg p-4 bg-card">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">New training record</p>
          <TrainingForm topics={topics} onSubmit={handleAdd} onCancel={() => { setAdding(false); setError(null) }} pending={pending} error={error} />
        </div>
      )}

      {topics.length === 0 && !adding && (
        <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">No training topics configured for this home. Add topics in Settings first.</p>
      )}

      {training.length === 0 && !adding && <p className="text-sm text-muted-foreground">No training records.</p>}

      {training.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Topic</th>
                <th className="text-left px-4 py-2 font-medium">Issued</th>
                <th className="text-left px-4 py-2 font-medium">Expires</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {training.map(t => {
                const expired = t.expiry_date && new Date(t.expiry_date) < now
                const expiringSoon = t.expiry_date && !expired && new Date(t.expiry_date) < new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
                return (
                  <tr key={t.id} className="bg-card">
                    {editId === t.id ? (
                      <td colSpan={5} className="px-4 py-3">
                        <TrainingForm
                          topics={topics}
                          defaults={{ topic_id: t.training_topic_id, issue_date: t.issue_date, ...(t.expiry_date ? { expiry_date: t.expiry_date } : {}) }}
                          onSubmit={e => handleEdit(e, t.id)}
                          onCancel={() => { setEditId(null); setError(null) }}
                          pending={pending} error={error}
                        />
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium">{t.training_topics?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{fmtDate(t.issue_date)}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{fmtDate(t.expiry_date)}</td>
                        <td className="px-4 py-3">
                          {expired ? <span className="text-xs text-destructive font-medium">Expired</span>
                            : expiringSoon ? <span className="text-xs text-amber-600 font-medium">Due soon</span>
                            : <span className="text-xs text-green-700">Current</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => { setEditId(t.id); setAdding(false); setError(null) }} className="text-xs text-primary hover:underline">Edit</button>
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {error && editId && <div className="px-4 py-2"><ErrorMsg msg={error} /></div>}
        </div>
      )}
    </div>
  )
}

function TrainingForm({ topics, defaults, onSubmit, onCancel, pending, error }: {
  topics: TrainingTopic[]
  defaults?: { topic_id: string; issue_date: string; expiry_date?: string }
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onCancel: () => void; pending: boolean; error: string | null
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-3 sm:col-span-1">
          <label className={labelCls}>Topic *</label>
          <select name="training_topic_id" defaultValue={defaults?.topic_id ?? ''} className={inputCls} required>
            <option value="">Select topic…</option>
            {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Issue date *</label>
          <input type="date" name="issue_date" defaultValue={defaults?.issue_date ?? ''} className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>Expiry date</label>
          <input type="date" name="expiry_date" defaultValue={defaults?.expiry_date ?? ''} className={inputCls} />
        </div>
      </div>
      <ErrorMsg msg={error} />
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className={btnSecondary}>Cancel</button>
        <button type="submit" disabled={pending} className={btnPrimary}>{pending ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  )
}

// ── Sponsorship tab ───────────────────────────────────────────────────────────

function SponsorshipTab({ homeId, staffId, sponsorship }: { homeId: string; staffId: string; sponsorship: Sponsorship }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [saved,   setSaved]   = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await upsertSponsorship(homeId, staffId, sponsorship?.id ?? null, fd)
      if ('error' in r) { setError(r.error) } else {
        setEditing(false); setSaved(true); setTimeout(() => setSaved(false), 2000); router.refresh()
      }
    })
  }

  if (!sponsorship && !editing) {
    return (
      <div className="max-w-md space-y-3">
        <p className="text-sm text-muted-foreground">No sponsorship record. Staff member is not on a sponsored visa route.</p>
        <button type="button" onClick={() => setEditing(true)} className={btnOutline}>+ Add sponsorship record</button>
      </div>
    )
  }

  if (editing || !sponsorship) {
    return (
      <div className="max-w-md rounded-xl bg-card shadow-[0_2px_8px_rgba(79,70,229,0.06),0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b">
          <h2 className="text-sm font-semibold">{sponsorship ? 'Edit sponsorship' : 'Add sponsorship'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>CoS reference *</label><input name="cos_reference" defaultValue={sponsorship?.cos_reference ?? ''} className={inputCls} required /></div>
            <div><label className={labelCls}>Sponsor licence no. *</label><input name="sponsor_licence_number" defaultValue={sponsorship?.sponsor_licence_number ?? ''} className={inputCls} required /></div>
            <div><label className={labelCls}>Route *</label><input name="route" defaultValue={sponsorship?.route ?? ''} placeholder="skilled_worker" className={inputCls} required /></div>
            <div><label className={labelCls}>Min hrs/week *</label><input type="number" name="minimum_hours_per_week" min={0} max={168} step={0.5} defaultValue={Number(sponsorship?.minimum_hours_per_week ?? 37.5)} className={inputCls} required /></div>
            <div><label className={labelCls}>CoS start date *</label><input type="date" name="cos_start_date" defaultValue={sponsorship?.cos_start_date ?? ''} className={inputCls} required /></div>
            <div><label className={labelCls}>CoS end date *</label><input type="date" name="cos_end_date" defaultValue={sponsorship?.cos_end_date ?? ''} className={inputCls} required /></div>
          </div>
          <ErrorMsg msg={error} />
          <div className="flex justify-end gap-3">
            {sponsorship && <button type="button" onClick={() => { setEditing(false); setError(null) }} className={btnSecondary}>Cancel</button>}
            <button type="submit" disabled={pending} className={btnPrimary}>{pending ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="max-w-md space-y-3">
      <div className="rounded-xl bg-card shadow-[0_2px_8px_rgba(79,70,229,0.06),0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b">
          <h2 className="text-sm font-semibold">Sponsorship</h2>
          <div className="flex items-center gap-3">
            {saved && <span className="text-xs text-green-700 font-medium">Saved ✓</span>}
            <button type="button" onClick={() => setEditing(true)} className={btnOutline}>Edit</button>
          </div>
        </div>
        <div className="px-4 py-2">
          <Field label="CoS reference" value={<span className="font-mono text-xs">{sponsorship.cos_reference}</span>} />
          <Field label="Sponsor licence" value={<span className="font-mono text-xs">{sponsorship.sponsor_licence_number}</span>} />
          <Field label="Route" value={sponsorship.route} />
          <Field label="Min hrs/week" value={`${sponsorship.minimum_hours_per_week}h`} />
          <Field label="CoS start" value={fmtDate(sponsorship.cos_start_date)} />
          <Field label="CoS end" value={fmtDate(sponsorship.cos_end_date)} />
        </div>
      </div>
    </div>
  )
}

// ── Leave tab ─────────────────────────────────────────────────────────────────

function LeaveTab({ homeId, staffId, leaveRequests, leaveBalance }: {
  homeId: string; staffId: string; leaveRequests: LeaveReq[]; leaveBalance: LeaveBalance
}) {
  const router = useRouter()
  const [pending,      startTransition] = useTransition()
  const [addingReq,    setAddingReq]    = useState(false)
  const [editingBal,   setEditingBal]   = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [saved,        setSaved]        = useState(false)
  const unit = leaveBalance?.allocation_unit === 'days' ? 'days' : 'hours'

  function handleSaved() { setSaved(true); setTimeout(() => setSaved(false), 2000); router.refresh() }

  function handleAddReq(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await addLeaveRequest(homeId, staffId, fd)
      if ('error' in r) { setError(r.error) } else { setAddingReq(false); handleSaved() }
    })
  }

  function handleSaveBal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await upsertLeaveBalance(homeId, staffId, leaveBalance?.id ?? null, fd)
      if ('error' in r) { setError(r.error) } else { setEditingBal(false); handleSaved() }
    })
  }

  function handleStatus(reqId: string, status: 'approved' | 'rejected') {
    startTransition(async () => {
      await updateLeaveRequestStatus(homeId, staffId, reqId, status)
      handleSaved()
    })
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* Balance card */}
      {editingBal ? (
        <div className="bg-card border rounded-lg px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Edit leave balance</p>
          <form onSubmit={handleSaveBal} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Entitlement *</label>
                <input type="number" name="entitlement_value" min={0} step={0.01} defaultValue={Number(leaveBalance?.entitlement_value ?? 0)} className={inputCls} required />
              </div>
              <div>
                <label className={labelCls}>Unit</label>
                <select name="allocation_unit" defaultValue={leaveBalance?.allocation_unit ?? 'hours'} className={inputCls}>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Year start *</label>
                <input type="date" name="leave_year_start" defaultValue={leaveBalance?.leave_year_start ?? ''} className={inputCls} required />
              </div>
            </div>
            <ErrorMsg msg={error} />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => { setEditingBal(false); setError(null) }} className={btnSecondary}>Cancel</button>
              <button type="submit" disabled={pending} className={btnPrimary}>{pending ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      ) : leaveBalance ? (
        <div className="bg-card border rounded-lg px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">Current year balance</div>
            <div className="flex items-center gap-3">
              {saved && <span className="text-xs text-green-700 font-medium">Saved ✓</span>}
              <button type="button" onClick={() => setEditingBal(true)} className={btnOutline}>Edit balance</button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3 text-center text-xs">
            <div><div className="font-semibold text-base">{leaveBalance.entitlement_value}</div><div className="text-muted-foreground">Entitlement</div></div>
            <div><div className="font-semibold text-base">{leaveBalance.taken_value}</div><div className="text-muted-foreground">Taken</div></div>
            <div><div className="font-semibold text-base">{leaveBalance.booked_value}</div><div className="text-muted-foreground">Booked</div></div>
            <div><div className="font-semibold text-base text-primary">{leaveBalance.balance_remaining?.toFixed(1) ?? '—'}</div><div className="text-muted-foreground">Remaining</div></div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">All values in {unit}</p>
        </div>
      ) : (
        <div className="bg-muted/30 border rounded-lg px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">No leave balance set for this year.</p>
          <button type="button" onClick={() => setEditingBal(true)} className={btnOutline}>+ Set balance</button>
        </div>
      )}

      {/* Request history */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Request history</div>
          {!addingReq && <button type="button" onClick={() => { setAddingReq(true); setError(null) }} className={btnOutline}>+ Add request</button>}
        </div>

        {addingReq && (
          <div className="border rounded-lg p-4 bg-card mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">New leave request</p>
            <form onSubmit={handleAddReq} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Type *</label>
                  <select name="type" defaultValue="annual" className={inputCls}>
                    {Object.entries(LEAVE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select name="status" defaultValue="approved" className={inputCls}>
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div><label className={labelCls}>Start date *</label><input type="date" name="start_date" className={inputCls} required /></div>
                <div><label className={labelCls}>End date *</label><input type="date" name="end_date" className={inputCls} required /></div>
                <div className="col-span-2">
                  <label className={labelCls}>Value ({unit}) *</label>
                  <input type="number" name="value_requested" min={0} step={0.5} className={inputCls} required />
                </div>
              </div>
              <ErrorMsg msg={error} />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => { setAddingReq(false); setError(null) }} className={btnSecondary}>Cancel</button>
                <button type="submit" disabled={pending} className={btnPrimary}>{pending ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        )}

        {leaveRequests.length === 0 && !addingReq ? (
          <p className="text-sm text-muted-foreground">No leave requests on record.</p>
        ) : leaveRequests.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Dates</th>
                  <th className="text-right px-3 py-2">Hours</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {leaveRequests.map(r => (
                  <tr key={r.id} className="bg-card">
                    <td className="px-3 py-2 text-xs">{LEAVE_TYPE_LABELS[r.type] ?? r.type}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(r.start_date)} – {fmtDate(r.end_date)}</td>
                    <td className="px-3 py-2 text-right text-xs">{r.value_requested}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className={r.status === 'approved' ? 'text-green-700' : r.status === 'rejected' ? 'text-destructive' : 'text-amber-600'}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.status === 'pending' && (
                        <div className="flex items-center gap-2 justify-end">
                          <button type="button" disabled={pending} onClick={() => handleStatus(r.id, 'approved')} className="text-xs text-green-700 hover:underline">Approve</button>
                          <button type="button" disabled={pending} onClick={() => handleStatus(r.id, 'rejected')} className="text-xs text-destructive hover:underline">Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ── Sickness tab ──────────────────────────────────────────────────────────────

function SicknessTab({ homeId, staffId, episodes }: { homeId: string; staffId: string; episodes: SicknessEpisode[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [toast,   setToast]   = useState<string | null>(null)
  const [adding,  setAdding]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const openEpisode = episodes.find(e => !e.last_day_of_sickness)

  function handleReport() {
    startTransition(async () => {
      const result = await reportSickness(homeId, staffId)
      if ('error' in result && result.error) { showToast(`Error: ${result.error}`) }
      else if ('success' in result) { showToast(`Sickness reported. ${(result as { shiftsReleased?: number }).shiftsReleased ?? 0} shift(s) released.`) }
    })
  }

  function handleRTW(episodeId: string) {
    startTransition(async () => {
      const result = await closeReturnToWork(homeId, staffId, episodeId)
      if ('error' in result && result.error) { showToast(`Error: ${result.error}`) }
      else if ('success' in result) {
        const r = result as { qualifyingDays?: number; sspEligible?: boolean }
        showToast(`Return to work recorded. ${r.sspEligible ? `SSP: ${r.qualifyingDays} qualifying days.` : 'No SSP (under 4 days).'}`)
      }
    })
  }

  function handleAddEpisode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await addSicknessEpisode(homeId, staffId, fd)
      if ('error' in r) { setError(r.error) } else { setAdding(false); showToast('Episode recorded.'); router.refresh() }
    })
  }

  return (
    <div className="max-w-2xl space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-foreground text-background text-sm px-4 py-2 rounded-lg shadow-lg">{toast}</div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Sickness episodes</h3>
        <div className="flex items-center gap-2">
          {!openEpisode && !adding && (
            <>
              <button type="button" onClick={() => setAdding(true)} className={btnOutline}>+ Add past episode</button>
              <button onClick={handleReport} disabled={pending} className="text-sm px-3 py-1.5 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50">
                {pending ? '…' : 'Report sickness'}
              </button>
            </>
          )}
        </div>
      </div>

      {adding && (
        <div className="border rounded-lg p-4 bg-card">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Add past episode</p>
          <form onSubmit={handleAddEpisode} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>First day *</label><input type="date" name="first_day_of_sickness" className={inputCls} required /></div>
              <div><label className={labelCls}>Last day</label><input type="date" name="last_day_of_sickness" className={inputCls} /></div>
            </div>
            <p className="text-xs text-muted-foreground">Leave "last day" empty for an open (ongoing) episode. Qualifying days and SSP eligibility are calculated automatically (4+ calendar days).</p>
            <ErrorMsg msg={error} />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => { setAdding(false); setError(null) }} className={btnSecondary}>Cancel</button>
              <button type="submit" disabled={pending} className={btnPrimary}>{pending ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}

      {openEpisode && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-amber-800">Currently off sick</div>
              <div className="text-xs text-amber-700">Since {fmtDate(openEpisode.first_day_of_sickness)}</div>
            </div>
            <button onClick={() => handleRTW(openEpisode.id)} disabled={pending}
              className="text-sm px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
              {pending ? '…' : 'Mark returned to work'}
            </button>
          </div>
          {openEpisode.ssp_eligible && (
            <p className="text-xs text-amber-700 mt-2">SSP may apply — will be confirmed on return.</p>
          )}
        </div>
      )}

      {episodes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sickness episodes recorded.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs">
              <tr>
                <th className="text-left px-3 py-2">First day</th>
                <th className="text-left px-3 py-2">Last day</th>
                <th className="text-right px-3 py-2">Q. days</th>
                <th className="text-left px-3 py-2">SSP</th>
                <th className="text-left px-3 py-2">RTW</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {episodes.map(e => (
                <tr key={e.id} className={`bg-card ${!e.last_day_of_sickness ? 'bg-amber-50/50' : ''}`}>
                  <td className="px-3 py-2 text-xs">{fmtDate(e.first_day_of_sickness)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {e.last_day_of_sickness ? fmtDate(e.last_day_of_sickness) : <span className="text-amber-600 font-medium">Open</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-xs">{e.qualifying_days ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">{e.ssp_eligible ? <span className="text-amber-600">Yes</span> : 'No'}</td>
                  <td className="px-3 py-2 text-xs">{e.return_to_work_completed_at ? fmtDate(e.return_to_work_completed_at.split('T')[0]!) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
