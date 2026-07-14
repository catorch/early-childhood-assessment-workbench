import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageShell({ className, ...props }: ComponentProps<"main">) {
  return <main className={cn("mx-auto w-[min(calc(100%_-_40px),1120px)] py-12 pb-[72px] max-sm:w-[min(calc(100%_-_24px),1120px)] max-sm:py-8 max-sm:pb-[54px]", className)} {...props} />;
}

export function Eyebrow({ className, children, ...props }: ComponentProps<"span">) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-[11px] font-extrabold tracking-[.09em] text-primary-strong uppercase before:h-0.5 before:w-4 before:rounded-full before:bg-primary", className)} {...props}>
      {children}
    </span>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
  className
}: {
  readonly eyebrow?: ReactNode;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
  readonly className?: string;
}) {
  return (
    <header className={cn("flex items-end justify-between gap-6 max-sm:items-start max-sm:flex-col", className)}>
      <div className="max-w-[720px]">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h1 className="mt-1 font-heading text-4xl font-normal leading-[1.15] text-ink max-sm:text-[30px]">{title}</h1>
        {description ? <p className="mt-2.5 leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </header>
  );
}

export const backLinkClass = "mb-[26px] inline-flex items-center gap-1.5 text-sm font-bold text-primary-strong no-underline hover:underline hover:underline-offset-4";

export const serifSectionHeadingClass = "font-heading text-2xl font-normal text-ink";
