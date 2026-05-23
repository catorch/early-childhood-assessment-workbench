import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "primary" | "success" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  iconOnly?: boolean;
};

export function Button({ children, className, variant = "default", iconOnly, ...props }: ButtonProps) {
  return (
    <button className={cn("button", variant !== "default" && variant, iconOnly && "icon-only", className)} {...props}>
      {children}
    </button>
  );
}
