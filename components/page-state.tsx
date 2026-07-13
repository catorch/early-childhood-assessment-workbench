import { AlertCircle, EyeOff, Inbox, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

const icons = {
  loading: LoaderCircle,
  empty: Inbox,
  error: AlertCircle,
  unavailable: EyeOff
} as const;

export function PageState({
  kind,
  title,
  description,
  children,
  compact = false
}: {
  readonly kind: keyof typeof icons;
  readonly title: string;
  readonly description: string;
  readonly children?: ReactNode;
  readonly compact?: boolean;
}) {
  const Icon = icons[kind];
  return (
    <section
      aria-busy={kind === "loading" || undefined}
      aria-live={kind === "loading" ? "polite" : undefined}
      className={`page-state state-${kind}${compact ? " compact" : ""}`}
      role={kind === "error" ? "alert" : kind === "loading" ? "status" : undefined}
    >
      <span className="page-state-icon"><Icon aria-hidden="true" /></span>
      <h2>{title}</h2>
      <p>{description}</p>
      {children ? <div className="page-state-actions">{children}</div> : null}
    </section>
  );
}
