import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full border border-transparent text-sm font-extrabold leading-tight transition-[color,background-color,border-color,box-shadow,transform] outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/35 active:scale-[.985] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_2px_10px_-3px_rgba(70,94,216,.55)] hover:bg-primary-hover",
        outline:
          "border-border-strong bg-surface text-navy hover:border-primary hover:bg-surface-soft hover:text-primary-strong aria-expanded:bg-surface-soft",
        secondary:
          "border-border-strong bg-surface text-navy hover:border-primary hover:bg-surface-soft aria-expanded:bg-surface-soft",
        ghost:
          "text-navy hover:bg-surface-soft hover:text-primary-strong aria-expanded:bg-surface-soft",
        destructive:
          "bg-destructive text-white hover:bg-destructive-strong focus-visible:ring-destructive/25",
        "destructive-outline":
          "border-destructive-border bg-surface text-destructive-strong hover:bg-destructive-soft",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-10 px-5 py-2",
        xs: "min-h-8 gap-1 px-3 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "min-h-9 gap-1.5 px-3.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        lg: "min-h-11 px-6 text-base",
        icon: "size-10 p-0",
        "icon-xs": "size-8 p-0 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-9 p-0",
        "icon-lg": "size-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
