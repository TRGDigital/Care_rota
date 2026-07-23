'use server'

import { createHash, randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function generatePairingToken(
  homeId: string,
  kioskName: string,
): Promise<{ token?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthenticated' }

  // Fetch home to get tenant_id
  const { data: home } = await supabase
    .from('homes')
    .select('id, tenant_id')
    .eq('id', homeId)
    .single()

  if (!home) return { error: 'home_not_found' }

  const rawToken  = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

  const service = createServiceClient()
  const { error } = await service
    .from('kiosk_pairing_tokens')
    .insert({
      tenant_id:         home.tenant_id,
      home_id:           homeId,
      token_hash:        tokenHash,
      kiosk_name:        kioskName,
      expires_at:        expiresAt,
      created_by_user_id: user.id,
    })

  if (error) return { error: error.message }
  return { token: rawToken }
}
