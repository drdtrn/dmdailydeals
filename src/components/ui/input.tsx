import { cn } from '@/utilities/ui'
import * as React from 'react'

const Input: React.FC<React.ComponentProps<'input'>> = ({ className, type, ...props }) => {
  return (
    <input
      data-slot="input"
      className={cn(
        'flex h-12 w-full min-w-0 rounded-sm border border-input bg-background px-3.5 text-[15px] text-foreground transition-colors placeholder:text-subtle-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive',
        className,
      )}
      type={type}
      {...props}
    />
  )
}

export { Input }
