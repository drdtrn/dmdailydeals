import { cn } from '@/utilities/ui'
import { Slot } from '@radix-ui/react-slot'
import { type VariantProps, cva } from 'class-variance-authority'
import * as React from 'react'

/**
 * shadcn Button (Radix flavour), restyled to the DMDailyDeals system: square 2px corners, ink
 * fill that flips to paper inside a dark scope (the hero band). No "use client": the variants
 * are called from server components (DealCard, HeroDeal).
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-sm text-[15px] font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/85',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border border-primary bg-transparent text-foreground hover:bg-primary hover:text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
        ghost: 'text-foreground hover:bg-accent hover:text-accent-foreground',
        link: 'text-foreground underline underline-offset-4 hover:no-underline',
      },
      size: {
        clear: '',
        default: 'h-12 px-6',
        sm: 'min-h-11 px-4 text-sm',
        lg: 'h-[52px] px-7 text-base',
        xl: 'h-14 px-7 text-base',
        icon: 'size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button: React.FC<ButtonProps> = ({ asChild = false, className, size, variant, ...props }) => {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
