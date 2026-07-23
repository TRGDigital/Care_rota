import { createClient } from 'jsr:@supabase/supabase-js@2'

// Nightly: for each active pay cycle, ensure the next open pay period exists.
Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: cycles } = await supabase
    .from('pay_cycles')
    .select('id, home_id, tenant_id, frequency, pay_day_rule, period_start_offset_days')

  if (!cycles?.length) return new Response('no cycles', { status: 200 })

  let created = 0
  for (const cycle of cycles) {
    // Find the latest period for this cycle
    const { data: latest } = await supabase
      .from('pay_periods')
      .select('period_end_date, pay_day')
      .eq('pay_cycle_id', cycle.id)
      .order('period_end_date', { ascending: false })
      .limit(1)
      .single()

    const nextStart = latest
      ? addDays(latest.period_end_date, 1)
      : todayIso()

    // Only create if next period starts within 7 days
    const nextStartDate = new Date(nextStart)
    const sevenDaysOut = new Date(); sevenDaysOut.setDate(sevenDaysOut.getDate() + 7)
    if (nextStartDate > sevenDaysOut) continue

    const { periodEnd, payDay, weeksInPeriod } = computePeriod(cycle.frequency, nextStart, cycle.pay_day_rule)

    // Check doesn't already exist
    const { data: existing } = await supabase
      .from('pay_periods')
      .select('id')
      .eq('pay_cycle_id', cycle.id)
      .eq('period_start_date', nextStart)
      .limit(1)
      .single()
    if (existing) continue

    await supabase.from('pay_periods').insert({
      home_id: cycle.home_id,
      tenant_id: cycle.tenant_id,
      pay_cycle_id: cycle.id,
      period_start_date: nextStart,
      period_end_date: periodEnd,
      pay_day: payDay,
      weeks_in_period: weeksInPeriod,
      status: 'open',
    })
    created++
  }

  return new Response(JSON.stringify({ created }), { status: 200 })
})

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function computePeriod(
  frequency: string,
  startDate: string,
  payDayRule: string
): { periodEnd: string; payDay: string; weeksInPeriod: number } {
  const start = new Date(startDate)
  let periodEnd: Date
  let weeksInPeriod: number

  if (frequency === 'weekly') {
    periodEnd = new Date(start); periodEnd.setDate(start.getDate() + 6); weeksInPeriod = 1
  } else if (frequency === 'bi_weekly') {
    periodEnd = new Date(start); periodEnd.setDate(start.getDate() + 13); weeksInPeriod = 2
  } else if (frequency === 'four_weekly') {
    periodEnd = new Date(start); periodEnd.setDate(start.getDate() + 27); weeksInPeriod = 4
  } else {
    // monthly: end of month
    periodEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0)
    weeksInPeriod = Math.round((periodEnd.getTime() - start.getTime()) / (7 * 86400000))
  }

  const payDay = resolvePayDay(periodEnd, payDayRule)

  return {
    periodEnd: periodEnd.toISOString().slice(0, 10),
    payDay: payDay.toISOString().slice(0, 10),
    weeksInPeriod,
  }
}

function resolvePayDay(periodEnd: Date, rule: string): Date {
  let parsed: Record<string, string> = {}
  try { parsed = JSON.parse(rule) } catch { return periodEnd }

  if (parsed.type === 'last_day_of_month') {
    const d = new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 0)
    return rollbackToPriorWorkingDay(d)
  }
  if (parsed.type === 'last_friday') return lastWeekdayOfMonth(periodEnd, 5)
  if (parsed.type === 'last_thursday') return lastWeekdayOfMonth(periodEnd, 4)
  if (parsed.type === 'fixed_day' && parsed.day) {
    const d = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), parseInt(parsed.day))
    return rollbackToPriorWorkingDay(d)
  }
  if (parsed.type === 'offset' && parsed.working_days) {
    let d = new Date(periodEnd); d.setDate(d.getDate() + 1)
    let remaining = parseInt(parsed.working_days)
    while (remaining > 0) {
      d.setDate(d.getDate() + 1)
      if (d.getDay() !== 0 && d.getDay() !== 6) remaining--
    }
    return d
  }
  return periodEnd
}

function rollbackToPriorWorkingDay(d: Date): Date {
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1)
  return d
}

function lastWeekdayOfMonth(ref: Date, targetDay: number): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth() + 1, 0)
  while (d.getDay() !== targetDay) d.setDate(d.getDate() - 1)
  return d
}
