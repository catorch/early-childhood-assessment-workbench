import type { ReactNode } from "react";

import { Sparkline } from "@/components/ui/charts";
import { Card } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
  icon,
  trend,
  trendDirection = "up",
  comparison,
  sparkline = [3, 4, 3, 7, 8, 6, 9],
  color = "var(--blue)"
}: {
  label: string;
  value: string;
  icon: ReactNode;
  trend?: string;
  trendDirection?: "up" | "down";
  comparison?: string;
  sparkline?: number[];
  color?: string;
}) {
  return (
    <Card className="metric-card">
      <div className="metric-top">
        {icon}
        <div>
          <p className="metric-label">{label}</p>
          <p className="metric-value">{value}</p>
        </div>
      </div>
      <div className="metric-footer">
        <span>
          {trend ? <span className={trendDirection === "up" ? "trend-up" : "trend-down"}>{trend}</span> : null}
          {comparison ? <span> {comparison}</span> : null}
        </span>
        <Sparkline values={sparkline} color={color} />
      </div>
    </Card>
  );
}
