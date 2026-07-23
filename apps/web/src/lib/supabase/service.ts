import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@carerota/types'

// Service-role client — bypasses RLS. Only for background workers and
// machine-to-machine routes (kiosk, reconciliation worker). Never expose
// this client in user-facing handlers.
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
