'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// England & Wales bank holidays for 2026
const BANK_HOLIDAYS_2026 = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-04-06', name: 'Easter Monday' },
  { date: '2026-05-04', name: 'Early May bank holiday' },
  { date: '2026-05-25', name: 'Spring bank holiday' },
  { date: '2026-08-31', name: 'Summer bank holiday' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2026-12-28', name: 'Boxing Day (substitute)' },
]

export async function loadBankHolidays(homeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const rows = BANK_HOLIDAYS_2026.map(h => ({
    home_id: homeId,
    tenant_id: homeId,
    calendar_date: h.date,
    name: h.name,
    multiplier: 1.50,
    source: 'auto_bank_holiday' as const,
    created_by_user_id: user.id,
  }))

  const { error } = await supabase
    .from('premium_pay_calendar')
    .upsert(rows, { onConflict: 'home_id,calendar_date', ignoreDuplicates: true })

  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/settings/premium-pay`)
  return { success: true }
}

const EntrySchema = z.object({
  calendar_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1).max(200),
  multiplier: z.coerce.number().min(1).max(5),
})

export async function addPremiumPayDate(homeId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const parsed = EntrySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input' }

  const { error } = await supabase.from('premium_pay_calendar').insert({
    home_id: homeId,
    tenant_id: homeId,
    calendar_date: parsed.data.calendar_date,
    name: parsed.data.name,
    multiplier: parsed.data.multiplier,
    source: 'manual',
    created_by_user_id: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/settings/premium-pay`)
  return { success: true }
}

export async function deletePremiumPayDate(homeId: string, entryId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { error } = await supabase
    .from('premium_pay_calendar')
    .delete()
    .eq('id', entryId)
    .eq('home_id', homeId)

  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/settings/premium-pay`)
  return { success: true }
}
