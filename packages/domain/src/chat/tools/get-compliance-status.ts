import { z } from 'zod'
import type { ChatSupabase } from '../types'

export const name = 'get_compliance_status'

export const description =
  'Returns counts of expired or expiring training certificates, right-to-work documents, and other compliance issues.'

export const paramSchema = z.object({
  window_days: z.number().int().min(1).max(365).default(60),
})

export type Params = z.infer<typeof paramSchema>

export type Result = {
  training_expired:  number
  training_expiring: number
  expiring_staff: {
    staff_id:   string
    topic:      string
    expires_at: string
  }[]
  _rowIds: string[]
}

export async function run(params: Params, supabase: ChatSupabase, homeId: string): Promise<Result> {
  const today     = new Date().toISOString().slice(0, 10)
  const windowEnd = new Date(Date.now() + params.window_days * 86_400_000).toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('staff_training_certs')
    .select('id, staff_id, expiry_date, training_topics!inner(name)')
    .eq('home_id', homeId)
    .not('expiry_date', 'is', null)
    .lte('expiry_date', windowEnd)
    .order('expiry_date')

  if (error) throw new Error(error.message)

  const rows = data ?? []
  const expired  = rows.filter(r => (r.expiry_date ?? '') <= today).length
  const expiring = rows.filter(r => (r.expiry_date ?? '') > today).length

  const expiringStaff = rows
    .filter(r => (r.expiry_date ?? '') > today)
    .map(r => {
      const topic = r.training_topics as { name?: string } | { name?: string }[] | null
      const topicName = Array.isArray(topic) ? (topic[0]?.name ?? 'Training') : (topic?.name ?? 'Training')
      return {
        staff_id:   r.staff_id,
        topic:      topicName,
        expires_at: r.expiry_date!,
      }
    })

  return {
    training_expired:  expired,
    training_expiring: expiring,
    expiring_staff:    expiringStaff,
    _rowIds:           rows.map(r => `staff_training_certs:${r.id}`),
  }
}
