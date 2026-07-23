import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { runCostGuard } from '@carerota/domain/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const homeId = searchParams.get('homeId')
  if (!homeId) return NextResponse.json({ error: 'homeId required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const suggestion = await runCostGuard(supabase as never, homeId)
  return NextResponse.json(suggestion)
}

export async function POST(request: Request) {
  const body = await request.json() as { homeId: string; approvedShiftIds: string[] }
  const { homeId, approvedShiftIds } = body

  if (!homeId || !Array.isArray(approvedShiftIds)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Calculate savings for approved shifts
  const { data: shifts } = await supabase
    .from('shifts')
    .select('id, planned_paid_hours')
    .in('id', approvedShiftIds)
    .eq('home_id', homeId)

  const DEFAULT_HOURLY_PENCE = 1200
  let totalSavings = 0
  for (const shift of shifts ?? []) {
    totalSavings += Math.round(DEFAULT_HOURLY_PENCE * shift.planned_paid_hours)
  }

  // Write savings log row
  if (totalSavings > 0) {
    await supabase.from('cost_savings_log').insert({
      tenant_id:            homeId,
      home_id:              homeId,
      source:               'occupancy_rebalance',
      savings_pence:        totalSavings,
      related_entity_type:  'shift',
      created_by_user_id:   user.id,
    })
  }

  // Cancel approved shifts
  await supabase.from('shifts').update({ state: 'cancelled' }).in('id', approvedShiftIds).eq('home_id', homeId)

  return NextResponse.json({ ok: true, savedPence: totalSavings })
}
