import Link from 'next/link'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'

const MESSAGES: Record<string, { icon: React.ReactNode; title: string; body: string }> = {
  invalid_token: {
    icon: <XCircle className="h-12 w-12 text-red-500" />,
    title: 'Invalid invitation link',
    body: 'This invitation link is invalid or has already been used. Please ask the care home to send a new invitation.',
  },
  revoked: {
    icon: <XCircle className="h-12 w-12 text-red-500" />,
    title: 'Invitation revoked',
    body: 'This invitation has been revoked. Please contact the care home to request a new one.',
  },
  already_used: {
    icon: <CheckCircle2 className="h-12 w-12 text-green-500" />,
    title: 'Already accepted',
    body: 'This invitation has already been used. You can log in directly using your email address.',
  },
  expired: {
    icon: <Clock className="h-12 w-12 text-amber-500" />,
    title: 'Invitation expired',
    body: 'This invitation link has expired (links are valid for 7 days). Please ask the care home to send a new invitation.',
  },
  setup_failed: {
    icon: <XCircle className="h-12 w-12 text-red-500" />,
    title: 'Account setup failed',
    body: 'There was a problem setting up your account. Please contact support or ask the care home to resend the invitation.',
  },
}

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  if (!error) {
    // No error means the GET handler in /api/accountant/accept-invite will redirect
    // This page only renders when there's an error query param
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="max-w-md w-full bg-card border rounded-xl p-8 text-center space-y-4">
          <div className="flex justify-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          </div>
          <h1 className="text-xl font-semibold">Setting up your account…</h1>
          <p className="text-sm text-muted-foreground">
            You are being redirected. If nothing happens,{' '}
            <Link href="/accountant/dashboard" className="underline">click here</Link>.
          </p>
        </div>
      </div>
    )
  }

  const msg = MESSAGES[error] ?? {
    icon: <XCircle className="h-12 w-12 text-red-500" />,
    title: 'Something went wrong',
    body: 'An unexpected error occurred. Please try again or contact support.',
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="max-w-md w-full bg-card border rounded-xl p-8 text-center space-y-4">
        <div className="flex justify-center">{msg.icon}</div>
        <h1 className="text-xl font-semibold">{msg.title}</h1>
        <p className="text-sm text-muted-foreground">{msg.body}</p>
        {error === 'already_used' && (
          <Link
            href="/auth/login"
            className="inline-block mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
          >
            Log in
          </Link>
        )}
      </div>
    </div>
  )
}
