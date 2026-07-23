'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  CalendarDays, Clock, Users, Inbox, Calendar, CreditCard,
  ShieldCheck, BarChart3, Settings, MessageSquare, ChevronDown,
  BedDouble, ScanFace,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type NavItem  = { label: string; href: string; icon: React.ElementType }
type NavGroup = { label: string; items: NavItem[] }

function navGroups(homeId: string): NavGroup[] {
  const b = `/homes/${homeId}`
  return [
    {
      label: 'ROTA',
      items: [
        { label: 'Rota board',      href: `${b}/rota`,       icon: CalendarDays },
        { label: 'Today',           href: `${b}/today`,      icon: Clock        },
        { label: 'Attendance',      href: `${b}/attendance`, icon: ScanFace     },
      ],
    },
    {
      label: 'STAFF',
      items: [
        { label: 'Staff directory', href: `${b}/staff`,      icon: Users        },
        { label: 'Leave inbox',     href: `${b}/leave`,      icon: Inbox        },
        { label: 'Holiday calendar',href: `${b}/holidays`,   icon: Calendar     },
      ],
    },
    {
      label: 'PAYROLL',
      items: [
        { label: 'Pay runs',        href: `${b}/pay-runs`,   icon: CreditCard   },
      ],
    },
    {
      label: 'CARE',
      items: [
        { label: 'Residents',       href: `${b}/residents`,  icon: BedDouble    },
        { label: 'Compliance',      href: `${b}/compliance`, icon: ShieldCheck  },
        { label: 'Dashboards',      href: `${b}/dashboards`, icon: BarChart3    },
      ],
    },
    {
      label: 'ADMIN',
      items: [
        { label: 'Settings',        href: `${b}/settings`,   icon: Settings     },
      ],
    },
  ]
}

type Props = {
  homeId: string
  homeName: string
  allHomes: { id: string; name: string }[] | null
  userId: string
}

export function NavSidebar({ homeId, homeName, allHomes }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  async function handleSwitchHome(newHomeId: string) {
    await supabase.rpc('set_active_home', { p_home_id: newHomeId })
    await supabase.auth.refreshSession()
    router.push(`/homes/${newHomeId}/dashboard`)
    router.refresh()
  }

  function toggleChat() {
    window.dispatchEvent(new CustomEvent('toggle-chat'))
  }

  const groups = navGroups(homeId)

  return (
    <aside
      className={cn(
        'hidden sm:flex flex-col flex-shrink-0',
        'bg-surface border-r border-border',
        'transition-[width] duration-[200ms] ease-out',
        /* icon rail on sm/md, full sidebar on lg+ */
        'w-16 lg:w-64',
      )}
    >
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center border-b border-border px-3 lg:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-primary">
            <span className="text-[11px] font-bold text-white leading-none">CR</span>
          </div>
          <span className="hidden lg:block text-[15px] font-bold text-brand-primary tracking-tight">
            CareRota
          </span>
        </div>
      </div>

      {/* Home switcher */}
      <div className="shrink-0 px-2 pt-3 pb-2">
        {allHomes && allHomes.length > 1 ? (
          <details className="group">
            <summary
              className={cn(
                'flex items-center cursor-pointer list-none rounded-md px-2 py-2',
                'text-sm font-medium text-ink-muted',
                'hover:bg-canvas hover:text-ink transition-colors duration-[120ms]',
                /* collapsed: just the chevron, centred */
                'justify-center lg:justify-between lg:px-3',
              )}
            >
              <span className="hidden lg:block truncate max-w-[160px]">{homeName}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 group-open:rotate-180 transition-transform duration-[120ms]" />
            </summary>
            <div className="mt-1.5 rounded-lg border border-border bg-surface shadow-md overflow-hidden">
              {allHomes.map(h => (
                <button
                  key={h.id}
                  onClick={() => handleSwitchHome(h.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm transition-colors duration-[120ms]',
                    'hover:bg-canvas',
                    h.id === homeId
                      ? 'font-semibold text-brand-primary bg-brand-primary-light'
                      : 'text-ink',
                  )}
                >
                  {h.name}
                </button>
              ))}
            </div>
          </details>
        ) : (
          <div className="flex items-center gap-2.5 px-2 lg:px-3 py-2">
            <div className="h-5 w-5 shrink-0 flex items-center justify-center rounded bg-brand-primary-light">
              <span className="text-[10px] font-bold text-brand-primary leading-none">
                {homeName.slice(0, 1).toUpperCase()}
              </span>
            </div>
            <p className="hidden lg:block text-xs font-semibold text-ink-muted uppercase tracking-wider truncate">
              {homeName}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 lg:px-3 pb-3 space-y-5" aria-label="Main navigation">
        {groups.map((group, gi) => (
          <div key={group.label}>
            {/* Group label — desktop only */}
            <p className="hidden lg:block px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">
              {group.label}
            </p>
            {/* Divider between groups on icon-only */}
            {gi > 0 && <div className="lg:hidden border-t border-border mb-2" />}

            <div className="space-y-0.5">
              {group.items.map(({ label, href, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`)
                return (
                  <Link
                    key={href}
                    href={href}
                    title={label}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-[7px] text-[13px] font-medium',
                      'transition-colors duration-[120ms]',
                      /* icon-only: centre the icon */
                      'justify-center lg:justify-start',
                      active
                        ? 'bg-brand-primary-light text-brand-primary'
                        : 'text-ink-muted hover:bg-canvas hover:text-ink',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-5 w-5 shrink-0',
                        active ? 'text-brand-primary' : 'text-ink-subtle',
                      )}
                      aria-hidden
                    />
                    <span className="hidden lg:block leading-[18px]">{label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Chat */}
      <div className="shrink-0 px-2 lg:px-3 py-3 border-t border-border">
        <button
          onClick={toggleChat}
          title="AI Chat (⌘K)"
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-[7px]',
            'text-[13px] font-medium text-ink-muted',
            'hover:bg-canvas hover:text-ink transition-colors duration-[120ms]',
            'justify-center lg:justify-start',
          )}
        >
          <MessageSquare className="h-5 w-5 shrink-0 text-ink-subtle" aria-hidden />
          <span className="hidden lg:block">AI Chat</span>
          <span className="hidden lg:block ml-auto text-[10px] text-ink-subtle font-normal">⌘K</span>
        </button>
      </div>
    </aside>
  )
}
