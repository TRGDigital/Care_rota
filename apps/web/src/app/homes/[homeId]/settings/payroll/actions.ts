'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type PayDayRuleType = 'last_day_of_month' | 'last_friday' | 'last_thursday' | 'fixed_day' | 'offset'

type SavePayCycleInput = {
  homeId: string
  frequency: 'weekly' | 'bi_weekly' | 'four_weekly' | 'monthly'
  payDayRule: PayDayRuleType
  payDayRuleParam?: string  // day number or working_days offset
  periodStartOffsetDays: number
}

export async function savePayCycle(input: SavePayCycleInput): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: home } = await supabase
    .from('homes')
    .select('id, pay_cycle_id, tenant_id')
    .eq('id', input.homeId)
    .single()
  if (!home) return { error: 'Home not found' }

  const payDayRule = buildPayDayRule(input.payDayRule, input.payDayRuleParam)
  if (!payDayRule) return { error: 'Invalid pay day rule' }

  if (home.pay_cycle_id) {
    const { error } = await supabase.from('pay_cycles').update({
      frequency: input.frequency,
      pay_day_rule: payDayRule,
      period_start_offset_days: input.periodStartOffsetDays,
      updated_by_user_id: user.id,
    }).eq('id', home.pay_cycle_id)
    if (error) return { error: error.message }
  } else {
    const { data: cycle, error } = await supabase.from('pay_cycles').insert({
      home_id: input.homeId,
      tenant_id: home.tenant_id,
      frequency: input.frequency,
      pay_day_rule: payDayRule,
      period_start_offset_days: input.periodStartOffsetDays,
      created_by_user_id: user.id,
      updated_by_user_id: user.id,
    }).select('id').single()
    if (error || !cycle) return { error: error?.message ?? 'Failed to create pay cycle' }

    await supabase.from('homes').update({ pay_cycle_id: cycle.id }).eq('id', input.homeId)
  }

  return {}
}

function buildPayDayRule(type: PayDayRuleType, param?: string): string | null {
  if (type === 'last_day_of_month' || type === 'last_friday' || type === 'last_thursday') {
    return JSON.stringify({ type })
  }
  if (type === 'fixed_day') {
    const day = parseInt(param ?? '0')
    if (isNaN(day) || day < 1 || day > 31) return null
    return JSON.stringify({ type, day: String(day) })
  }
  if (type === 'offset') {
    const days = parseInt(param ?? '0')
    if (isNaN(days) || days < 1 || days > 20) return null
    return JSON.stringify({ type, working_days: String(days) })
  }
  return null
}
