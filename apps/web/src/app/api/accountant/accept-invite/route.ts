import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createHash } from 'crypto'

// GET — validate token and redirect to Supabase Auth magic-link / password setup
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.redirect(new URL('/auth/login?error=invalid_token', req.url))

  const tokenHash = createHash('sha256').update(token).digest('hex')
  const svc = createServiceClient()

  const { data: invite } = await svc
    .from('accountant_invitations')
    .select('id, email, name, home_id, tenant_id, accepted_at, revoked_at, expires_at')
    .eq('token_hash', tokenHash)
    .single()

  if (!invite) return NextResponse.redirect(new URL('/auth/login?error=invalid_token', req.url))
  if (invite.revoked_at) return NextResponse.redirect(new URL('/auth/login?error=revoked', req.url))
  if (invite.accepted_at) return NextResponse.redirect(new URL('/auth/login?error=already_used', req.url))
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.redirect(new URL('/auth/login?error=expired', req.url))
  }

  // Create or look up the accountant's Supabase auth user
  const { data: existingUser } = await svc.auth.admin.listUsers()
  const existing = existingUser.users.find(u => u.email === invite.email)

  let userId: string
  if (existing) {
    userId = existing.id
  } else {
    // Create the user — they'll receive a magic link / password invite email from Supabase Auth
    const { data: newUser, error } = await svc.auth.admin.createUser({
      email: invite.email,
      email_confirm: true,
      user_metadata: {
        full_name: invite.name,
        role: 'accountant_readonly',
        home_id: invite.home_id,
        tenant_id: invite.tenant_id,
      },
    })
    if (error || !newUser.user) {
      return NextResponse.redirect(new URL('/auth/login?error=setup_failed', req.url))
    }
    userId = newUser.user.id
  }

  // Mark invitation as accepted, link user_id
  await svc.from('accountant_invitations').update({
    accepted_at: new Date().toISOString(),
    user_id: userId,
    updated_by_user_id: userId,
  }).eq('id', invite.id)

  // Generate a magic link so they land logged in
  const { data: link } = await svc.auth.admin.generateLink({
    type: 'magiclink',
    email: invite.email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3002'}/accountant/dashboard`,
    },
  })

  const magicUrl = link?.properties?.action_link
  if (!magicUrl) return NextResponse.redirect(new URL('/auth/login', req.url))

  return NextResponse.redirect(new URL(magicUrl))
}
