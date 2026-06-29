import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        
        // Blueprint-grade ratings (90-98)
        exceptional: "border-transparent bg-purple-100 text-purple-900",
        veryStrong: "border-transparent bg-indigo-100 text-indigo-900",
        
        // Advanced critique ratings (80-89)
        strong: "border-transparent bg-blue-100 text-blue-800",
        moderate: "border-transparent bg-teal-100 text-teal-800",
        
        // Surface polish ratings (60-79)
        basic: "border-transparent bg-green-100 text-green-800",
        weak: "border-transparent bg-amber-100 text-amber-800",
        
        // Fluent but shallow ratings (40-59)
        veryWeak: "border-transparent bg-orange-100 text-orange-800",
        
        // Random noise ratings (0-39)
        criticallyDeficient: "border-transparent bg-red-100 text-red-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
