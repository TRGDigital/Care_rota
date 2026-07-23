import { redirect } from 'next/navigation'
import type { RoleCode, TenantContext } from '@carerota/types'

export function requireRole(
  ctx: TenantContext | null,
  ...roles: RoleCode[]
): asserts ctx is TenantContext {
  if (!ctx) redirect('/auth/login')
  if (!roles.some(r => ctx.roles.includes(r))) redirect('/homes')
}
