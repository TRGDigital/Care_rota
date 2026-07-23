import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

type RouteParams = { params: Promise<{ homeId: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { homeId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { occupiedBeds, vacantBeds, expectedAdmissionsNext7Days, expectedDischargesNext7Days } =
    await req.json() as {
      occupiedBeds: number
      vacantBeds: number
      expectedAdmissionsNext7Days?: number
      expectedDischargesNext7Days?: number
    }

  if (typeof occupiedBeds !== 'number' || occupiedBeds < 0) {
    return NextResponse.json({ error: 'occupiedBeds must be a non-negative number' }, { status: 400 })
  }

  const svc = createServiceClient()
  const { data: home } = await svc.from('homes').select('tenant_id, bed_capacity').eq('id', homeId).single()
  if (!home) return NextResponse.json({ error: 'Home not found' }, { status: 404 })

  const { data: snapshot, error } = await svc
    .from('bed_occupancy_snapshots')
    .insert({
      tenant_id:                       home.tenant_id,
      home_id:                         homeId,
      occupied_beds:                   occupiedBeds,
      vacant_beds:                     vacantBeds,
      bed_capacity:                    home.bed_capacity,
      expected_admissions_next_7_days: expectedAdmissionsNext7Days ?? 0,
      expected_discharges_next_7_days: expectedDischargesNext7Days ?? 0,
      source:                          'manual',
      created_by_user_id:              user.id,
      updated_by_user_id:              user.id,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await svc.from('audit_events').insert({
    home_id:            homeId,
    tenant_id:          home.tenant_id,
    actor_user_id:      user.id,
    action_code:        'occupancy_snapshot_recorded',
    entity_type:        'bed_occupancy_snapshot',
    entity_id:          snapshot?.id ?? homeId,
    after_state_json:   { occupied_beds: occupiedBeds, vacant_beds: vacantBeds },
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { homeId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data } = await supabase
    .from('bed_occupancy_snapshots')
    .select('id, snapshot_at, occupied_beds, vacant_beds, source')
    .eq('home_id', homeId)
    .order('snapshot_at', { ascending: false })
    .limit(90)

  return NextResponse.json(data ?? [])
}
