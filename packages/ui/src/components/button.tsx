import * as React from 'react'
import { cn } from '../utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'default' | 'outline'
export type ButtonSize    = 'sm' | 'md' | 'lg' | 'icon'

const variantClass: Record<ButtonVariant, string> = {
  primary:     'bg-accent text-white hover:bg-accent-hover shadow-sm',
  default:     'bg-accent text-white hover:bg-accent-hover shadow-sm',   // alias
  secondary:   'bg-surface border border-border text-ink hover:bg-canvas',
  outline:     'bg-surface border border-border text-ink hover:bg-canvas',
  ghost:       'text-brand-primary hover:bg-brand-primary-light',
  destructive: 'bg-danger text-white hover:bg-danger/90 shadow-sm',
}

const sizeClass: Record<ButtonSize, string> = {
  sm:   'h-7 px-3 text-xs  rounded-md gap-1.5',
  md:   'h-9 px-4 text-[13px] rounded-md gap-2',
  lg:   'h-11 px-6 text-sm rounded-md gap-2',
  icon: 'h-9 w-9 rounded-md',
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, className = '', disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-colors duration-[120ms]',
          'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-light focus-visible:ring-offset-1',
          'disabled:pointer-events-none disabled:opacity-50',
          variantClass[variant],
          sizeClass[size],
          className,
        )}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : children}
      </button>
    )
  },
)
Button.displayName = 'Button'
