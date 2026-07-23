import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/nav/page-shell'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default async function CompliancePage({
  params,
}: {
  params: Promise<{ homeId: string }>
}) {
  const { homeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const now = new Date()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const sixtyDaysOut  = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10)

  // Pending override reviews (last 7 days, not yet reviewed)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const { count: pendingReviews } = await supabase
    .from('rule_overrides')
    .select('*', { count: 'exact', head: true })
    .eq('home_id', homeId)
    .gte('overridden_at', sevenDaysAgo)

  // RTW documents expiring within 60 days
  const { count: rtwExpiryCount } = await supabase
    .from('staff_documents')
    .select('*', { count: 'exact', head: true })
    .eq('home_id', homeId)
    .in('doc_type', ['passport', 'biometric_residence_permit', 'share_code'])
    .lte('expiry_date', sixtyDaysOut)
    .not('expiry_date', 'is', null)

  // Expired training certs (mandatory topics)
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)
  const { count: expiredTrainingCount } = await supabase
    .from('staff_training_certs')
    .select('*', { count: 'exact', head: true })
    .eq('home_id', homeId)
    .lt('expiry_date', thirtyDaysFromNow)

  const rtwExpiries: unknown[] = []
  const expiredTraining = expiredTrainingCount ?? 0
  void thirtyDaysAgo
  void rtwExpiries

  // WTR overrides (last 90 days)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString()
  const { count: wtrOverrides } = await supabase
    .from('rule_overrides')
    .select('*', { count: 'exact', head: true })
    .eq('home_id', homeId)
    .like('rule_code', 'wtr_%')
    .gte('overridden_at', ninetyDaysAgo)

  const tiles = [
    {
      title: 'Override Log',
      description: 'All manager overrides with MFA and justification',
      href: `override-log`,
      badge: pendingReviews ? `${pendingReviews} pending review` : null,
      badgeColour: 'bg-amber-100 text-amber-800',
    },
    {
      title: 'Staffing Justification',
      description: 'Dependency + matrix + actual staffing for any date',
      href: `staffing-justification`,
      badge: null,
    },
    {
      title: 'RTW Pipeline',
      description: 'Right to work expiries in the next 60 days',
      href: `rtw`,
      badge: rtwExpiryCount ? `${rtwExpiryCount} expiring soon` : null,
      badgeColour: 'bg-red-100 text-red-800',
    },
    {
      title: 'Training Matrix',
      description: 'Staff × training heatmap',
      href: `training`,
      badge: expiredTraining ? `${expiredTraining} expiring/expired` : null,
      badgeColour: 'bg-red-100 text-red-800',
    },
    {
      title: 'Sponsorship Hours',
      description: 'Sponsored workers vs CoS minimum hours',
      href: `sponsorship`,
      badge: null,
    },
    {
      title: 'WTR Overrides (90d)',
      description: 'Working Time Regulations override history',
      href: `override-log?rule=wtr`,
      badge: wtrOverrides ? `${wtrOverrides} in 90 days` : null,
      badgeColour: 'bg-muted text-muted-foreground',
    },
    {
      title: 'Photo Review',
      description: 'Daily 5-photo spot check to catch buddy-punching',
      href: `photo-review`,
      badge: null,
    },
  ]

  return (
    <PageShell title="Compliance">
      <div className="space-y-6">
        {/* AT-9: Monday morning override review prompt */}
        {now.getDay() === 1 && pendingReviews && pendingReviews > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm flex items-center justify-between">
            <div>
              <span className="font-medium text-amber-800">Weekly review: </span>
              <span className="text-amber-700">You have {pendingReviews} override{pendingReviews !== 1 ? 's' : ''} from last week to review.</span>
            </div>
            <Link href={`/homes/${homeId}/compliance/override-log`} className="text-amber-800 underline font-medium text-xs">
              Review now →
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map(tile => (
            <Link
              key={tile.title}
              href={tile.href.startsWith('#') ? tile.href : `/homes/${homeId}/compliance/${tile.href}`}
              className="rounded-lg border bg-card p-4 hover:bg-muted/30 transition-colors flex items-center justify-between group"
            >
              <div className="space-y-1">
                <div className="font-medium text-sm">{tile.title}</div>
                <div className="text-xs text-muted-foreground">{tile.description}</div>
                {tile.badge && (
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tile.badgeColour}`}>
                    {tile.badge}
                  </span>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
            </Link>
          ))}
        </div>

      </div>
    </PageShell>
  )
}
