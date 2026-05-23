import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  padded = true,
  style
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  style?: CSSProperties;
}) {
  return (
    <section className={cn("card", padded && "card-pad", className)} style={style}>
      {children}
    </section>
  );
}

export function SectionTitle({
  title,
  action,
  subtitle
}: {
  title: ReactNode;
  action?: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p className="muted" style={{ margin: "5px 0 0" }}>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
