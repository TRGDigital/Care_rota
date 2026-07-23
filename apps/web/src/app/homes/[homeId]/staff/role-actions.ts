'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Update a staff member's position/role. Overtime eligibility follows the role's default policy
// (hands-on roles eligible, ancillary approval-required) so changing role fixes their overtime pool.
export async function updateStaffRole(homeId: string, staffId: string, roleCode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }
  if (!roleCode) return { error: 'Pick a role' }

  const { data: role } = await supabase
    .from('staff_roles')
    .select('overtime_policy')
    .eq('home_id', homeId)
    .eq('code', roleCode)
    .maybeSingle()

  const { error } = await supabase
    .from('staff')
    .update({ role_code: roleCode, overtime_eligible: role?.overtime_policy === 'eligible', updated_by_user_id: user.id })
    .eq('id', staffId)
    .eq('home_id', homeId)

  if (error) return { error: error.message }
  revalidatePath(`/homes/${homeId}/staff`)
  return { ok: true }
}
