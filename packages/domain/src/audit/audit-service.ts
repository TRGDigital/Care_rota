import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@carerota/types'

export type RecordAuditParams = {
  homeId: string
  actorUserId: string
  actionCode: string   // e.g. 'shift.published', 'pay_run.approved'
  entityType: string
  entityId: string
  beforeState?: unknown
  afterState?: unknown
}

export async function recordAudit(
  supabase: SupabaseClient<Database>,
  params: RecordAuditParams,
): Promise<void> {
  const { error } = await supabase.from('audit_events').insert({
    home_id:          params.homeId,
    tenant_id:        params.homeId,
    actor_user_id:    params.actorUserId,
    action_code:      params.actionCode,
    entity_type:      params.entityType,
    entity_id:        params.entityId,
    before_state_json: (params.beforeState ?? null) as never,
    after_state_json:  (params.afterState ?? null) as never,
  })

  if (error) {
    // Audit failure is non-fatal but must be logged — never silently swallow
    console.error('[audit] failed to write audit_events row', {
      actionCode: params.actionCode,
      entityId:   params.entityId,
      error:      error.message,
    })
  }
}
