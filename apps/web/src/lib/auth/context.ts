import type { TenantContext, HomeContext, RoleCode } from '@carerota/types'
import type { User } from '@supabase/supabase-js'

type JwtClaims = {
  organisation_id?: string
  home_ids?: string[]
  active_home_id?: string
  roles?: Record<string, string[]>
}

export function tenantContextFromUser(user: User): TenantContext | null {
  const claims = user.user_metadata as JwtClaims

  if (!claims.organisation_id) return null

  return {
    organisationId: claims.organisation_id,
    homeId: claims.active_home_id ?? null,
    userId: user.id,
    roles: rolesForHome(claims.roles, claims.active_home_id),
  }
}

export function homeContextFromUser(user: User, homeId: string): HomeContext | null {
  const ctx = tenantContextFromUser(user)
  if (!ctx) return null

  const homeIds = (user.user_metadata as JwtClaims).home_ids ?? []
  if (!homeIds.includes(homeId)) return null

  return { ...ctx, homeId }
}

function rolesForHome(
  rolesMap: Record<string, string[]> | undefined,
  homeId: string | undefined,
): RoleCode[] {
  if (!rolesMap || !homeId) return []
  const homeRoles = (rolesMap[homeId] ?? []) as RoleCode[]
  const orgRoles  = (rolesMap['org']    ?? []) as RoleCode[]
  return [...new Set([...homeRoles, ...orgRoles])]
}

export function hasRole(ctx: TenantContext, ...required: RoleCode[]): boolean {
  return required.some(r => ctx.roles.includes(r))
}
