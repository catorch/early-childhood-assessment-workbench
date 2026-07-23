import { AlertCircle, EyeOff, Inbox, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

import { Sparkle } from "@/components/brand";
import { cn } from "@/lib/utils";

const presentations = {
  loading: { icon: LoaderCircle, iconClass: "bg-accent text-primary", spin: true },
  empty: { icon: Inbox, iconClass: "bg-accent text-primary", spin: false },
  error: { icon: AlertCircle, iconClass: "bg-destructive-soft text-destructive", spin: false },
  unavailable: { icon: EyeOff, iconClass: "bg-warning-soft text-warning", spin: false }
} as const;

export function PageState({
  kind,
  title,
  description,
  children,
  compact = false
}: {
  readonly kind: keyof typeof presentations;
  readonly title: string;
  readonly description: string;
  readonly children?: ReactNode;
  readonly compact?: boolean;
}) {
  const presentation = presentations[kind];
  const Icon = presentation.icon;
  return (
    <section
      aria-busy={kind === "loading" || undefined}
      aria-live={kind === "loading" ? "polite" : undefined}
      className={cn(
        "mt-10 grid min-h-[330px] place-items-center content-center rounded-3xl border border-border bg-surface px-5 py-12 text-center shadow-card",
        compact && "mt-6 min-h-[180px] py-8"
      )}
      role={kind === "error" ? "alert" : kind === "loading" ? "status" : undefined}
    >
      <span className="relative">
        <span className={cn("grid size-[52px] place-items-center rounded-full", presentation.iconClass)}>
          <Icon aria-hidden="true" className={cn("size-6", presentation.spin && "motion-safe:animate-spin")} />
        </span>
        {kind !== "loading" ? <Sparkle className="absolute -top-1.5 -right-3 size-3.5 text-brand-yellow" /> : null}
      </span>
      <h2 className="mt-4 text-2xl font-extrabold text-ink">{title}</h2>
      <p className="mt-2 max-w-[560px] leading-relaxed text-muted-foreground">{description}</p>
      {children ? <div className="mt-6 flex flex-wrap justify-center gap-2.5">{children}</div> : null}
    </section>
  );
}
