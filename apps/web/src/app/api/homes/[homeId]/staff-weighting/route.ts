import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { setWeightingWithRedistribution, resetRoleToEqualShares } from '@/lib/redistribute-weighting'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ homeId: string }> }
) {
  const { homeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json() as {
    staffId: string
    overtime_weighting?: number
    overtime_eligible?: boolean
  }
  const { staffId, overtime_weighting, overtime_eligible } = body

  if (overtime_weighting !== undefined) {
    if (typeof overtime_weighting !== 'number' || overtime_weighting < 0 || overtime_weighting > 100) {
      return NextResponse.json({ error: 'overtime_weighting must be 0–100' }, { status: 400 })
    }
    await setWeightingWithRedistribution(supabase, homeId, staffId, overtime_weighting, user.id)
  }

  if (overtime_eligible !== undefined) {
    const patch = {
      overtime_eligible,
      updated_by_user_id: user.id,
      ...(overtime_eligible === false && { overtime_weighting: 0 }),
    }
    const { error } = await supabase
      .from('staff')
      .update(patch)
      .eq('id', staffId)
      .eq('home_id', homeId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await resetRoleToEqualShares(supabase, homeId, staffId, user.id)
  }

  return NextResponse.json({ success: true })
}
