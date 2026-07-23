'use client'

import * as React from 'react'
import { cn } from '../utils'

/* ── Field wrapper (label + input slot + helper/error) ── */

export type FieldProps = {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  htmlFor?: string
  className?: string
  children: React.ReactNode
}

export function Field({ label, hint, error, required, htmlFor, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink leading-[18px]">
          {label}
          {required && <span className="text-danger ml-0.5" aria-hidden>*</span>}
        </label>
      )}
      {children}
      {hint && !error && (
        <p className="text-xs text-ink-muted leading-4">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-danger leading-4 flex items-center gap-1" role="alert">
          <svg className="h-3.5 w-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}

/* ── Input ── */

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  error?: boolean
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'block w-full rounded-[6px] border border-border bg-surface px-3 py-2',
        'text-sm text-ink placeholder:text-ink-subtle',
        'transition-[border-color,box-shadow] duration-[120ms] ease-out',
        'focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-light',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        error && 'border-danger focus:ring-danger-light',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

/* ── Textarea ── */

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: boolean
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={3}
      className={cn(
        'block w-full rounded-[6px] border border-border bg-surface px-3 py-2',
        'text-sm text-ink placeholder:text-ink-subtle resize-y',
        'transition-[border-color,box-shadow] duration-[120ms] ease-out',
        'focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-light',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        error && 'border-danger focus:ring-danger-light',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'

/* ── Select ── */

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  error?: boolean
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'block w-full rounded-[6px] border border-border bg-surface px-3 py-2 pr-8',
        'text-sm text-ink',
        'appearance-none bg-no-repeat bg-[right_0.75rem_center]',
        'bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%238A95A3\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3E%3C/svg%3E")]',
        'bg-[length:1.25rem]',
        'transition-[border-color,box-shadow] duration-[120ms] ease-out',
        'focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-light',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        error && 'border-danger focus:ring-danger-light',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
)
Select.displayName = 'Select'
