import * as React from 'react'
import { cn } from '../utils'

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-border/70', className)}
      aria-hidden
      {...props}
    />
  )
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-4', i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full')}
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border bg-surface p-5 shadow-sm', className)}>
      <Skeleton className="h-5 w-2/5 mb-4" />
      <SkeletonText lines={3} />
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
      <div className="border-b border-border px-5 py-3">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-3.5 flex-1" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="border-b border-border last:border-0 px-5 py-3">
          <div className="flex gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1" style={{ opacity: 1 - r * 0.1 }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
