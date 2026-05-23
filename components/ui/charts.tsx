import type { ReactNode } from "react";

type ChartPoint = {
  label: string;
  value: number;
};

type LineSeries = {
  label: string;
  values: number[];
  color?: string;
  dashed?: boolean;
};

export function Sparkline({ values, color = "var(--blue)" }: { values: number[]; color?: string }) {
  const points = normalizePoints(values, 72, 28, 3);
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <svg width="74" height="32" viewBox="0 0 74 32" aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point, index) =>
        index === points.length - 1 ? <circle key={index} cx={point.x} cy={point.y} r="2.7" fill="#fff" stroke={color} strokeWidth="2" /> : null
      )}
    </svg>
  );
}

export function LineChart({
  labels,
  series,
  target,
  height = 230,
  yAsPercent = false
}: {
  labels: string[];
  series: LineSeries[];
  target?: number;
  height?: number;
  yAsPercent?: boolean;
}) {
  const width = 640;
  const padding = { top: 24, right: 28, bottom: 40, left: 44 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const allValues = series.flatMap((item) => item.values).concat(target ? [target] : []);
  const max = yAsPercent ? 1 : Math.max(1, Math.max(...allValues));
  const min = 0;
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Reliability trend line chart" style={{ width: "100%", height }}>
      {ticks.map((tick) => {
        const y = padding.top + plotHeight - ((tick - min) / (max - min)) * plotHeight;
        return (
          <g key={tick}>
            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e4e7ec" />
            <text x={padding.left - 12} y={y + 4} textAnchor="end" fill="#667085" fontSize="12">
              {yAsPercent ? `${Math.round(tick * 100)}%` : tick.toFixed(2)}
            </text>
          </g>
        );
      })}
      {target ? (
        <g>
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + plotHeight - ((target - min) / (max - min)) * plotHeight}
            y2={padding.top + plotHeight - ((target - min) / (max - min)) * plotHeight}
            stroke="#98a2b3"
            strokeDasharray="4 4"
          />
          <text x={width - padding.right} y={padding.top + plotHeight - ((target - min) / (max - min)) * plotHeight - 8} textAnchor="end" fill="#475467" fontSize="12">
            Target {(target * 100).toFixed(0)}%
          </text>
        </g>
      ) : null}
      {series.map((item) => {
        const points = item.values.map((value, index) => ({
          x: padding.left + (index / Math.max(item.values.length - 1, 1)) * plotWidth,
          y: padding.top + plotHeight - ((value - min) / (max - min)) * plotHeight
        }));
        const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
        const color = item.color ?? "var(--blue)";
        return (
          <g key={item.label}>
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={item.dashed ? "7 7" : undefined}
            />
            {points.map((point, index) => (
              <circle key={index} cx={point.x} cy={point.y} r="5" fill="#fff" stroke={color} strokeWidth="3" />
            ))}
          </g>
        );
      })}
      {labels.map((label, index) => {
        const x = padding.left + (index / Math.max(labels.length - 1, 1)) * plotWidth;
        return (
          <text key={label} x={x} y={height - 14} textAnchor="middle" fill="#667085" fontSize="12">
            {label}
          </text>
        );
      })}
    </svg>
  );
}

export function HorizontalBars({ data }: { data: ChartPoint[] }) {
  return (
    <div>
      {data.map((item) => (
        <div className="bar-row" key={item.label}>
          <span className="muted">{item.label}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${Math.round(item.value * 100)}%` }} />
          </span>
          <strong>{(item.value * 100).toFixed(1)}%</strong>
        </div>
      ))}
    </div>
  );
}

export function MiniTrend({ trend }: { trend: "up" | "down" | "flat" }) {
  const values =
    trend === "up" ? [14, 12, 15, 21, 19, 27, 25, 30] : trend === "down" ? [30, 26, 27, 21, 19, 17, 20, 16] : [20, 22, 20, 21, 19, 21, 20, 21];
  const color = trend === "up" ? "#fb923c" : trend === "down" ? "#16a34a" : "#667085";
  return <Sparkline values={values} color={color} />;
}

export function IconCircle({ children, tone }: { children: ReactNode; tone: "blue" | "green" | "amber" | "red" | "purple" | "teal" }) {
  const colorMap = {
    blue: ["var(--blue-soft)", "var(--blue)"],
    green: ["var(--green-soft)", "var(--green)"],
    amber: ["var(--amber-soft)", "var(--amber)"],
    red: ["var(--red-soft)", "var(--red)"],
    purple: ["var(--purple-soft)", "var(--purple)"],
    teal: ["var(--teal-soft)", "var(--teal)"]
  };
  return (
    <span className="metric-icon" style={{ background: colorMap[tone][0], color: colorMap[tone][1] }}>
      {children}
    </span>
  );
}

function normalizePoints(values: number[], width: number, height: number, pad: number) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values.map((value, index) => ({
    x: pad + (index / Math.max(values.length - 1, 1)) * (width - pad * 2),
    y: pad + (1 - (value - min) / range) * (height - pad * 2)
  }));
}
