import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
  kicker
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  kicker?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {kicker ? <div className="page-kicker">{kicker}</div> : null}
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  );
}
