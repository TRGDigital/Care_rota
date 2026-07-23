'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { parsePayrollWorkbook, type DetectedStaff } from './parse-payroll'
import { resetToEqualShares } from '@/lib/redistribute-weighting'

// Canonical CareStream positions seeded for every tenant on import.
const CANONICAL_ROLES: Array<{ code: string; name: string; policy: string }> = [
  { code: 'care_assistant', name: 'Care Assistant', policy: 'eligible' },
  { code: 'senior_care_assistant', name: 'Senior Care Assistant', policy: 'eligible' },
  { code: 'nurse', name: 'Nurse', policy: 'eligible' },
  { code: 'senior_nurse', name: 'Senior Nurse', policy: 'eligible' },
  { code: 'care_manager', name: 'Care Manager', policy: 'approval_required' },
  { code: 'activities_coordinator', name: 'Activities Coordinator', policy: 'approval_required' },
  { code: 'administrator', name: 'Administrator', policy: 'approval_required' },
  { code: 'hr', name: 'HR', policy: 'approval_required' },
  { code: 'marketing', name: 'Marketing', policy: 'approval_required' },
  { code: 'company_director', name: 'Company Director', policy: 'approval_required' },
  { code: 'chef', name: 'Chef', policy: 'approval_required' },
  { code: 'kitchen_porter', name: 'Kitchen Porter', policy: 'approval_required' },
  { code: 'laundry', name: 'Laundry', policy: 'approval_required' },
  { code: 'cleaner_housekeeping', name: 'Cleaner / Housekeeping', policy: 'approval_required' },
]

export type MatchedStaff = DetectedStaff & { matchStaffId: string | null; matchName: string | null }

function matchKey(first: string, last: string): string {
  return `${last.trim().toLowerCase()} ${(first.trim()[0] ?? '').toLowerCase()}`
}

export async function parseImport(homeId: string, formData: FormData): Promise<{
  error?: string
  staff?: MatchedStaff[]
  templateHours?: number[]
  weeksParsed?: number
  warnings?: string[]
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Choose a spreadsheet to upload.' }
  if (file.size > 15 * 1024 * 1024) return { error: 'File too large (max 15 MB).' }

  let detected
  try {
    const buf = Buffer.from(await file.arrayBuffer())
    detected = await parsePayrollWorkbook(buf)
  } catch (e) {
    return { error: `Could not read the spreadsheet: ${(e as Error).message}` }
  }
  if (!detected.staff.length) return { error: detected.warnings[0] ?? 'No staff detected in the file.' }

  // Match detected people against existing staff (exact normalised name → last name + first initial).
  const { data: existing } = await supabase.from('staff')
    .select('id, first_name, last_name').eq('home_id', homeId)
  const byExact = new Map<string, { id: string; name: string }>()
  const byKey = new Map<string, { id: string; name: string }>()
  for (const s of existing ?? []) {
    const full = `${s.first_name} ${s.last_name}`.trim().toUpperCase()
    byExact.set(full, { id: s.id, name: `${s.first_name} ${s.last_name}` })
    byKey.set(matchKey(s.first_name, s.last_name), { id: s.id, name: `${s.first_name} ${s.last_name}` })
  }

  const staff: MatchedStaff[] = detected.staff.map(d => {
    const m = byExact.get(d.key) ?? byKey.get(matchKey(d.firstName, d.lastName)) ?? null
    return { ...d, matchStaffId: m?.id ?? null, matchName: m?.name ?? null }
  })

  return { staff, templateHours: detected.templateHours, weeksParsed: detected.weeksParsed, warnings: detected.warnings }
}

const templateName = (h: number) => `Day ${h}h`
const lengthType = (h: number) => h === 12 ? 'long_day_12h' : h === 6 ? 'short_half_6h' : 'custom'

export async function applyImport(homeId: string, staff: MatchedStaff[]): Promise<{ error?: string; created?: number; updated?: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }
  const uid = user.id

  // 1. Canonical positions.
  await supabase.from('staff_roles').upsert(
    CANONICAL_ROLES.map(r => ({ tenant_id: homeId, home_id: homeId, code: r.code, name: r.name, overtime_policy: r.policy })),
    { onConflict: 'home_id,code', ignoreDuplicates: true },
  )

  // 2. Shift templates for every distinct fixed-shift length.
  const hours = [...new Set(staff.flatMap(s => s.fixed.map(f => Math.round(f.hours))).filter(h => h > 0))]
  if (hours.length) {
    await supabase.from('shift_pattern_templates').upsert(
      hours.map(h => ({
        tenant_id: homeId, home_id: homeId, name: templateName(h),
        start_time_local: '08:00', end_time_local: `${String((8 + h) % 24).padStart(2, '0')}:00`,
        break_minutes: 0, paid_hours_decimal: h, length_type: lengthType(h),
      })),
      { onConflict: 'home_id,name', ignoreDuplicates: true },
    )
  }
  const { data: templates } = await supabase.from('shift_pattern_templates').select('id, name').eq('home_id', homeId)
  const tplId = new Map((templates ?? []).map(t => [t.name, t.id]))

  let created = 0, updated = 0
  for (const s of staff) {
    let staffId = s.matchStaffId
    if (staffId) {
      await supabase.from('staff').update({
        role_code: s.roleCode, shift_type: s.shift, overtime_eligible: s.eligible, updated_by_user_id: uid,
      }).eq('id', staffId).eq('home_id', homeId)
      updated++
    } else {
      const { data: ins, error } = await supabase.from('staff').insert({
        tenant_id: homeId, home_id: homeId, first_name: s.firstName, last_name: s.lastName,
        status: 'active', role_code: s.roleCode, shift_type: s.shift, overtime_eligible: s.eligible,
        overtime_weighting: 50, created_by_user_id: uid,
      }).select('id').single()
      if (error || !ins) continue
      staffId = ins.id
      created++
    }

    // Contract (latest) — set/refresh contracted hours + fixed pattern preference.
    const { data: contract } = await supabase.from('staff_contracts').select('id')
      .eq('staff_id', staffId).eq('home_id', homeId).order('effective_from', { ascending: false }).limit(1).maybeSingle()
    const contractRow = {
      contract_type: (s.contractedHours >= 35 ? 'full_time' : s.contractedHours <= 8 ? 'bank' : 'part_time') as never,
      contracted_hours_per_week: s.contractedHours, shift_pattern_preference: 'fixed' as never,
    }
    if (contract?.id) await supabase.from('staff_contracts').update({ ...contractRow, updated_by_user_id: uid }).eq('id', contract.id)
    else await supabase.from('staff_contracts').insert({ tenant_id: homeId, home_id: homeId, staff_id: staffId, ...contractRow, holiday_entitlement_value: Math.round(5.6 * s.contractedHours * 10) / 10, effective_from: '2026-01-01', created_by_user_id: uid })

    // Pay rate (only if we detected one and none exists yet).
    if (s.ratePence != null) {
      const { data: rate } = await supabase.from('staff_pay_rates').select('id').eq('staff_id', staffId).eq('home_id', homeId).limit(1).maybeSingle()
      if (!rate) {
        await supabase.from('staff_pay_rates').insert({
          tenant_id: homeId, home_id: homeId, staff_id: staffId, role_code: s.roleCode,
          rate_weekday_pence: s.ratePence, rate_weekend_pence: s.ratePence, rate_night_pence: s.ratePence,
          rate_overtime_pence: s.ratePence, rate_sleep_in_flat_pence: 0, rate_training_pence: s.ratePence,
          effective_from: '2025-04-01', created_by_user_id: uid,
        })
      }
    }

    // Fixed shifts — replace with the detected pattern.
    await supabase.from('staff_fixed_shifts').delete().eq('staff_id', staffId).eq('home_id', homeId)
    const sid = staffId
    const fx = s.fixed.flatMap(f => {
      const tid = tplId.get(templateName(Math.round(f.hours)))
      return tid ? [{ tenant_id: homeId, home_id: homeId, staff_id: sid, day_of_week: f.dow, shift_template_id: tid, effective_from: '2026-01-01', created_by_user_id: uid }] : []
    })
    if (fx.length) await supabase.from('staff_fixed_shifts').insert(fx)
  }

  // 3. Rebuild the standard week from the imported fixed patterns.
  const reqMap = new Map<string, { dow: number; tpl: string; role: string; n: number }>()
  for (const s of staff) {
    for (const f of s.fixed) {
      const tpl = templateName(Math.round(f.hours))
      const k = `${f.dow}|${tpl}|${s.roleCode}`
      const cur = reqMap.get(k)
      if (cur) cur.n++
      else reqMap.set(k, { dow: f.dow, tpl, role: s.roleCode, n: 1 })
    }
  }
  await supabase.from('rota_slot_requirements').delete().eq('home_id', homeId)
  const reqs = [...reqMap.values()].flatMap(v => {
    const tid = tplId.get(v.tpl)
    return tid ? [{ tenant_id: homeId, home_id: homeId, day_of_week: v.dow, shift_pattern_template_id: tid, role_code: v.role, headcount_required: v.n, created_by_user_id: uid }] : []
  })
  if (reqs.length) await supabase.from('rota_slot_requirements').insert(reqs)

  await resetToEqualShares(supabase, homeId, uid)
  revalidatePath(`/homes/${homeId}/staff`)
  return { created, updated }
}
