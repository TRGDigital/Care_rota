import * as React from 'react'
import { cn } from '../utils'

export type CardProps = React.HTMLAttributes<HTMLDivElement>

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn('bg-surface rounded-xl border border-border shadow-sm overflow-hidden', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export type CardHeaderProps = {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function CardHeader({ title, description, action, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 py-4 border-b border-border', className)}>
      <div>
        <h3 className="text-base font-semibold text-ink leading-6">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export type CardBodyProps = React.HTMLAttributes<HTMLDivElement>

export function CardBody({ className, children, ...props }: CardBodyProps) {
  return (
    <div className={cn('p-5', className)} {...props}>
      {children}
    </div>
  )
}

export type CardFooterProps = React.HTMLAttributes<HTMLDivElement>

export function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div className={cn('flex items-center justify-end gap-3 px-5 py-3.5 border-t border-border bg-canvas/50', className)} {...props}>
      {children}
    </div>
  )
}
