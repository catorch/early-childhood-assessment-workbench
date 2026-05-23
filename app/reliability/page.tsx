import Link from "next/link";
import { ArrowRight, Calendar, CheckCircle2, Filter, Info, ShieldAlert, Target, XCircle } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, SectionTitle } from "@/components/ui/card";
import { HorizontalBars, IconCircle, LineChart, MiniTrend } from "@/components/ui/charts";
import { MetricCard } from "@/components/ui/metric-card";
import { formatCount, formatDecimal, formatPercent } from "@/lib/format";
import { reliabilityReport, reliabilityTrend } from "@/lib/data";

export default function ReliabilityPage() {
  return (
    <main className="content wide">
      <PageHeader
        title="Reliability"
        subtitle="Deep-dive into agreement quality and rater consistency across your assessment program."
      />

      <Card className="filters" style={{ marginBottom: 20 }}>
        <div className="field">
          <label>Dataset Split</label>
          <select defaultValue="overall" aria-label="Dataset split">
            <option value="overall">AI vs Human (Overall)</option>
            <option value="validation">Held-out validation</option>
            <option value="calibration">Calibration</option>
          </select>
        </div>
        <div className="field">
          <label>Date Range</label>
          <button className="input-like">
            <Calendar size={16} /> May 11 - May 17, 2025
          </button>
        </div>
        <div className="field">
          <label>Prompt Version</label>
          <select defaultValue="all" aria-label="Prompt version">
            <option value="all">All Versions (5)</option>
            <option value="v15">v1.5 Current</option>
          </select>
        </div>
        <button className="button">
          <Filter size={18} /> Filters
        </button>
        <Link href="/reliability" className="link">
          Clear all
        </Link>
      </Card>

      <div className="grid four-metrics" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, marginBottom: 20 }}>
        <MetricCard
          label="Exact Agreement"
          value={formatPercent(reliabilityReport.exactAgreement, 1)}
          icon={
            <IconCircle tone="blue">
              <Target size={24} />
            </IconCircle>
          }
          trend="↑ 9.4pp"
          comparison="vs May 4 - May 10"
          sparkline={[4, 5, 5, 8, 6, 7, 9]}
        />
        <MetricCard
          label="Cohen's Kappa"
          value={formatDecimal(reliabilityReport.cohenKappa)}
          icon={
            <IconCircle tone="green">
              <CheckCircle2 size={24} />
            </IconCircle>
          }
          trend="↑ 0.11"
          comparison="vs May 4 - May 10"
          sparkline={[5, 6, 7, 9, 7, 8, 10]}
          color="var(--green)"
        />
        <MetricCard
          label="False Positives"
          value={formatPercent(reliabilityReport.falsePositiveRate, 1)}
          icon={
            <IconCircle tone="amber">
              <ShieldAlert size={24} />
            </IconCircle>
          }
          trend="↓ 1.6pp"
          trendDirection="down"
          comparison="vs May 4 - May 10"
          sparkline={[10, 11, 9, 8, 8, 8, 7]}
          color="var(--amber)"
        />
        <MetricCard
          label="False Negatives"
          value={formatPercent(reliabilityReport.falseNegativeRate, 1)}
          icon={
            <IconCircle tone="purple">
              <XCircle size={24} />
            </IconCircle>
          }
          trend="↓ 1.2pp"
          comparison="vs May 4 - May 10"
          sparkline={[10, 9, 9, 8, 7, 8, 8]}
          color="var(--purple)"
        />
      </div>

      <div className="grid three" style={{ marginBottom: 20 }}>
        <Card className="chart-shell" style={{ gridColumn: "span 1 / span 1" }}>
          <SectionTitle
            title={
              <span>
                Agreement Across Prompt Versions <Info size={15} style={{ display: "inline", verticalAlign: "-2px" }} />
              </span>
            }
            action={<button className="button">Cohen&apos;s Kappa</button>}
          />
          <div className="chart-legend" style={{ marginBottom: 8 }}>
            <span className="legend-item">
              <span className="legend-line" /> Exact Agreement (%)
            </span>
            <span className="legend-item">
              <span className="legend-line dashed" /> Cohen&apos;s Kappa
            </span>
          </div>
          <LineChart
            labels={reliabilityTrend.map((point) => point.label)}
            series={[
              { label: "Exact Agreement", values: reliabilityTrend.map((point) => point.exactAgreement) },
              { label: "Cohen's Kappa", values: reliabilityTrend.map((point) => point.cohenKappa), dashed: true }
            ]}
            yAsPercent
          />
          <Link href="/prompts" className="link">
            View prompt version details <ArrowRight size={16} />
          </Link>
        </Card>

        <Card>
          <SectionTitle title={<span>Agreement by Domain <Info size={15} style={{ display: "inline", verticalAlign: "-2px" }} /></span>} />
          <HorizontalBars data={reliabilityReport.byDomain.map((domain) => ({ label: domain.domain, value: domain.exactAgreement }))} />
          <Link href="/api/reliability?groupBy=domain" className="link">
            View domain performance <ArrowRight size={16} />
          </Link>
        </Card>

        <Card>
          <SectionTitle title={<span>Confusion Matrix <span className="muted">(Overall)</span> <Info size={15} style={{ display: "inline", verticalAlign: "-2px" }} /></span>} />
          <div style={{ textAlign: "center", marginBottom: 10 }}>
            <strong>AI Primary Rating</strong>
          </div>
          <div className="matrix" aria-label="Confusion matrix">
            <MatrixCell tone="good" value={532} label="True Positive" />
            <MatrixCell tone="bad" value={48} label="False Negative" />
            <MatrixCell tone="warn" value={76} label="False Positive" />
            <MatrixCell tone="good" value={592} label="True Negative" />
          </div>
          <div className="progress-bar" style={{ margin: "22px auto 16px", width: 240 }}>
            <span style={{ width: "88%", background: "linear-gradient(90deg, #e2e8f0, var(--blue))" }} />
          </div>
          <Link href="/api/exports/reliability" className="link">
            View full confusion matrix <ArrowRight size={16} />
          </Link>
        </Card>
      </div>

      <div className="grid two-wide">
        <Card padded={false}>
          <div className="card-pad" style={{ paddingBottom: 0 }}>
            <SectionTitle title={<span>Top Disagreement Patterns <Info size={15} style={{ display: "inline", verticalAlign: "-2px" }} /></span>} />
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Pattern</th>
                  <th>Example</th>
                  <th>Count</th>
                  <th>% of Disagreements</th>
                  <th>Impact on Kappa</th>
                </tr>
              </thead>
              <tbody>
                {reliabilityReport.topDisagreementPatterns.map((pattern) => (
                  <tr key={pattern.pattern}>
                    <td>
                      <strong>{pattern.pattern}</strong>
                    </td>
                    <td className="muted">{pattern.example}</td>
                    <td>{pattern.count}</td>
                    <td>{pattern.percent.toFixed(1)}%</td>
                    <td style={{ color: "var(--red)", fontWeight: 800 }}>{pattern.impact.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-pad" style={{ paddingTop: 0 }}>
            <Link href="/api/exports/reliability" className="link">
              View all disagreement patterns <ArrowRight size={16} />
            </Link>
          </div>
        </Card>

        <Card padded={false}>
          <div className="card-pad" style={{ paddingBottom: 0 }}>
            <SectionTitle title={<span>Improvement Insights <Info size={15} style={{ display: "inline", verticalAlign: "-2px" }} /></span>} />
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Error Cause</th>
                  <th>Description</th>
                  <th>Frequency</th>
                  <th>% of Errors</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {reliabilityReport.improvementInsights.map((insight, index) => (
                  <tr key={insight.cause}>
                    <td>
                      <Badge tone={["purple", "teal", "blue", "amber", "red"][index] as never}>{insight.cause}</Badge>
                    </td>
                    <td className="muted">{insight.description}</td>
                    <td>{formatCount(insight.frequency)}</td>
                    <td>{insight.percentOfErrors.toFixed(1)}%</td>
                    <td>
                      <MiniTrend trend={insight.trend} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-pad" style={{ paddingTop: 0 }}>
            <Link href="/api/exports/reliability" className="link">
              View full insights report <ArrowRight size={16} />
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}

function MatrixCell({ value, label, tone }: { value: number; label: string; tone: "good" | "warn" | "bad" }) {
  return (
    <div className={`matrix-cell ${tone}`}>
      <span>
        <span className="matrix-value">{value}</span>
        <span className="muted">{label}</span>
      </span>
    </div>
  );
}
