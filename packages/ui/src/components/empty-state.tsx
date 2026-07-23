import * as React from 'react'
import { cn } from '../utils'

export type EmptyStateProps = {
  icon?: React.ElementType
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-canvas border border-border">
          <Icon className="h-6 w-6 text-ink-subtle" aria-hidden />
        </div>
      )}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 text-sm text-ink-muted max-w-sm leading-[22px]">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
