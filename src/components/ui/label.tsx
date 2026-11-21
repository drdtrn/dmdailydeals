'use client'

import { cn } from '@/utilities/ui'
import * as LabelPrimitive from '@radix-ui/react-label'
import * as React from 'react'

const Label: React.FC<React.ComponentProps<typeof LabelPrimitive.Root>> = ({
  className,
  ...props
}) => (
  <LabelPrimitive.Root
    data-slot="label"
    className={cn('text-[13px] font-medium text-soft-foreground', className)}
    {...props}
  />
)

export { Label }
