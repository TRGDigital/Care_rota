import * as React from 'react'
import { cn } from '../utils'

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'pending' | 'neutral'

const config: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  success: { bg: 'bg-success-light', text: 'text-success',  dot: 'bg-success'  },
  warning: { bg: 'bg-warning-light', text: 'text-warning',  dot: 'bg-warning'  },
  danger:  { bg: 'bg-danger-light',  text: 'text-danger',   dot: 'bg-danger'   },
  info:    { bg: 'bg-info-light',    text: 'text-info',     dot: 'bg-info'     },
  pending: { bg: 'bg-pending-light', text: 'text-pending',  dot: 'bg-pending'  },
  neutral: { bg: 'bg-canvas',        text: 'text-ink-muted',dot: 'bg-ink-subtle'},
}

export type BadgeProps = {
  variant?: BadgeVariant
  label: string
  dot?: boolean
  icon?: React.ReactNode
  className?: string
}

export function Badge({ variant = 'neutral', label, dot = true, icon, className }: BadgeProps) {
  const { bg, text, dot: dotColor } = config[variant]
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5',
      'text-[12px] font-medium leading-4',
      bg, text, className,
    )}>
      {icon ?? (dot && <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotColor)} aria-hidden />)}
      {label}
    </span>
  )
}
