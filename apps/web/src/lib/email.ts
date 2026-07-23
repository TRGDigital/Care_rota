import { Resend } from 'resend'

// Lazily construct the Resend client so a missing key doesn't crash the build
// (module evaluation happens at build time; the key is only needed to actually send).
let _resend: Resend | null = null
function resend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY ?? '')
  return _resend
}

const FROM = process.env.EMAIL_FROM ?? 'CareRota <noreply@carerota.co.uk>'

export async function sendAccountantInvite(opts: {
  to: string
  name: string
  homeName: string
  inviteUrl: string
}): Promise<void> {
  await resend().emails.send({
    from: FROM,
    to: opts.to,
    subject: `You've been invited to access payroll for ${opts.homeName}`,
    html: `
      <p>Hi ${opts.name},</p>
      <p>You've been invited to access payroll data for <strong>${opts.homeName}</strong> on CareRota.</p>
      <p><a href="${opts.inviteUrl}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">
        Set up your account
      </a></p>
      <p>This link expires in 7 days and can only be used once.</p>
      <p>If you weren't expecting this invitation, you can ignore this email.</p>
    `,
  })
}

export async function sendAccountantRevoked(opts: {
  to: string
  name: string
  homeName: string
}): Promise<void> {
  await resend().emails.send({
    from: FROM,
    to: opts.to,
    subject: `Your CareRota access for ${opts.homeName} has been revoked`,
    html: `
      <p>Hi ${opts.name},</p>
      <p>Your access to payroll data for <strong>${opts.homeName}</strong> on CareRota has been revoked by the home's manager.</p>
      <p>If you believe this is an error, please contact the home's registered manager.</p>
    `,
  })
}

export async function sendCommentNotification(opts: {
  to: string
  recipientName: string
  authorName: string
  homeName: string
  comment: string
  payRunUrl: string
}): Promise<void> {
  await resend().emails.send({
    from: FROM,
    to: opts.to,
    subject: `New comment on payroll — ${opts.homeName}`,
    html: `
      <p>Hi ${opts.recipientName},</p>
      <p><strong>${opts.authorName}</strong> commented on a payslip for <strong>${opts.homeName}</strong>:</p>
      <blockquote style="border-left:3px solid #e5e7eb;padding:10px 16px;color:#374151;margin:16px 0">
        ${opts.comment}
      </blockquote>
      <p><a href="${opts.payRunUrl}">View pay run →</a></p>
    `,
  })
}
