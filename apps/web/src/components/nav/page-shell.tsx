import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export function PageShell({
  title,
  description,
  action,
  backHref,
  backLabel = 'Back',
  children,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  backHref?: string
  backLabel?: string
  children?: React.ReactNode
}) {
  return (
    <div className="px-6 py-8 lg:px-8 max-w-[1280px] mx-auto">
      {/* Back link */}
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-[13px] text-ink-muted hover:text-ink mb-4 transition-colors duration-[120ms]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {backLabel}
        </Link>
      )}

      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink leading-8">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-ink-muted leading-[22px]">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {children}
    </div>
  )
}
