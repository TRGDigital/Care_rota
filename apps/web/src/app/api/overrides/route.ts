import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { tenantContextFromUser } from '@/lib/auth/context'
import { RuleOverrideService } from '@carerota/domain/server'

const OverrideRequestSchema = z.object({
  homeId:          z.string().uuid(),
  ruleCode:        z.string().min(1),
  entityType:      z.string().min(1),
  entityId:        z.string().uuid(),
  blockedAction:   z.string().min(1),
  reasonCategory:  z.string().min(1),
  justification:   z.string().min(20),
  mfaMethod:       z.enum(['password_reentry', 'totp', 'webauthn']),
  // For password_reentry: include the re-verified password in the request
  // The server verifies it by re-signing in before writing the override row
  mfaCredential:   z.string().min(1),
  beforeState:     z.unknown().optional(),
  afterState:      z.unknown().optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body: unknown = await request.json()
  const parsed = OverrideRequestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const params = parsed.data
  const ctx = tenantContextFromUser(user)

  if (!ctx || ctx.homeId !== params.homeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // MFA verification: re-authenticate the user before writing the override
  if (params.mfaMethod === 'password_reentry') {
    const { error: mfaError } = await supabase.auth.signInWithPassword({
      email:    user.email!,
      password: params.mfaCredential,
    })
    if (mfaError) {
      return NextResponse.json(
        { error: 'MFA verification failed: incorrect password' },
        { status: 401 },
      )
    }
  } else if (params.mfaMethod === 'totp') {
    // params.mfaCredential contains the 6-digit TOTP code
    const factors = await supabase.auth.mfa.listFactors()
    const totpFactor = factors.data?.totp[0]
    if (!totpFactor) {
      return NextResponse.json({ error: 'No TOTP factor enrolled' }, { status: 401 })
    }
    const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: totpFactor.id })
    if (!challenge) {
      return NextResponse.json({ error: 'MFA challenge failed' }, { status: 401 })
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId:    totpFactor.id,
      challengeId: challenge.id,
      code:        params.mfaCredential,
    })
    if (verifyError) {
      return NextResponse.json({ error: 'MFA verification failed: invalid code' }, { status: 401 })
    }
  }

  const service = new RuleOverrideService(supabase)

  try {
    const override = await service.recordOverride({
      homeId:               params.homeId,
      ruleCode:             params.ruleCode,
      entityType:           params.entityType,
      entityId:             params.entityId,
      blockedAction:        params.blockedAction,
      reasonCategory:       params.reasonCategory,
      justification:        params.justification,
      overriddenByUserId:   user.id,
      overriddenByRoles:    ctx.roles,
      mfaMethod:            params.mfaMethod,
      beforeState:          params.beforeState,
      afterState:           params.afterState,
    })
    return NextResponse.json({ override }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message.includes('role_not_permitted') ? 403
      : message.includes('justification_too_short') ? 422
      : 500
    return NextResponse.json({ error: message }, { status })
  }
}
