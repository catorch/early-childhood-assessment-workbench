import type { ReactNode } from "react";

import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Copy, ExternalLink, GitCompareArrows, MoreHorizontal, Plus, Scale, Search, Upload, X } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { LineChart } from "@/components/ui/charts";
import { formatCount, formatDecimal } from "@/lib/format";
import { getCurrentPrompt, promptVersions, reliabilityTrend } from "@/lib/data";

export default function PromptsPage() {
  const currentPrompt = getCurrentPrompt();
  const candidate = promptVersions.find((prompt) => prompt.status === "CANDIDATE") ?? promptVersions[4];

  return (
    <main className="content wide">
      <PageHeader
        title="Prompts & Experiments"
        subtitle="Manage prompt versions, track experiments, and monitor performance over time."
      />

      <div className="page-header" style={{ marginBottom: 20 }}>
        <div className="split-actions">
          <Button variant="primary">
            <Plus size={18} /> Create New Version
          </Button>
          <Button>
            <Copy size={18} /> Duplicate
          </Button>
          <Button>
            <Scale size={18} /> Compare
          </Button>
          <Button>
            More <ChevronDown size={18} />
          </Button>
        </div>
        <div className="split-actions">
          <button className="button">
            All Models <ChevronDown size={18} />
          </button>
          <label className="input-like" style={{ width: 270 }}>
            <Search size={17} />
            <input style={{ border: 0, outline: 0, minWidth: 0 }} placeholder="Search versions..." aria-label="Search prompt versions" />
          </label>
        </div>
      </div>

      <div className="prompt-layout">
        <div className="grid">
          <Card padded={false}>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th />
                    <th>Version</th>
                    <th>Model</th>
                    <th>Temperature</th>
                    <th>Last Updated</th>
                    <th>Exact Agreement</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {promptVersions.map((prompt) => (
                    <tr key={prompt.id} className={prompt.id === currentPrompt.id ? "selected-row" : undefined}>
                      <td>
                        <span className={prompt.id === currentPrompt.id ? "badge blue" : "badge gray"}>●</span>
                      </td>
                      <td>
                        <strong>{prompt.version}</strong>
                        {prompt.status === "CURRENT" ? (
                          <div style={{ marginTop: 6 }}>
                            <Badge tone="green">Current</Badge>
                          </div>
                        ) : null}
                      </td>
                      <td>{prompt.modelName}</td>
                      <td>{prompt.temperature}</td>
                      <td>
                        {prompt.lastUpdated}
                        <p className="muted" style={{ margin: "5px 0 0" }}>
                          {prompt.author}
                        </p>
                      </td>
                      <td>
                        <strong>{formatDecimal(prompt.exactAgreement)}</strong>
                        {typeof prompt.agreementDelta === "number" ? (
                          <p className={prompt.agreementDelta >= 0 ? "trend-up" : "trend-down"} style={{ margin: "5px 0 0" }}>
                            {prompt.agreementDelta >= 0 ? "↑" : "↓"} {Math.abs(prompt.agreementDelta).toFixed(2)}
                          </p>
                        ) : (
                          <p className="muted" style={{ margin: "5px 0 0" }}>
                            -
                          </p>
                        )}
                      </td>
                      <td>
                        <Badge tone={prompt.status === "CURRENT" ? "green" : prompt.status === "CANDIDATE" ? "purple" : "gray"}>{titleCase(prompt.status)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card-pad" style={{ color: "var(--muted)" }}>
              Showing 1 to {promptVersions.length} of {promptVersions.length} versions
            </div>
          </Card>

          <div className="grid two">
            <Card>
              <SectionTitle title="Performance Trend by Version" action={<button className="button">Exact Agreement</button>} />
              <LineChart
                labels={reliabilityTrend.map((point) => point.version)}
                series={[{ label: "Exact Agreement", values: promptVersions.slice().reverse().map((prompt) => prompt.exactAgreement) }]}
                yAsPercent
                height={250}
              />
              <Link href="/reliability" className="link">
                View full reliability dashboard <ArrowRight size={16} />
              </Link>
            </Card>

            <Card>
              <SectionTitle title="Experiment Comparison" />
              <div className="panel-list">
                <div className="comparison-card current">
                  <Badge tone="green">Current</Badge>
                  <div>
                    <strong>{currentPrompt.version} (Current)</strong>
                    <p className="muted" style={{ margin: "5px 0 0" }}>
                      {currentPrompt.modelName} · Temp {currentPrompt.temperature}
                    </p>
                  </div>
                  <strong style={{ fontSize: 24 }}>{formatDecimal(currentPrompt.exactAgreement)}</strong>
                </div>
                <div className="comparison-card">
                  <Badge tone="purple">Candidate</Badge>
                  <div>
                    <strong>{candidate.version}</strong>
                    <p className="muted" style={{ margin: "5px 0 0" }}>
                      {candidate.modelName} · Temp {candidate.temperature}
                    </p>
                  </div>
                  <strong style={{ fontSize: 24 }}>{formatDecimal(candidate.exactAgreement)}</strong>
                </div>
                <div className="comparison-card" style={{ borderStyle: "dashed", justifyContent: "center", minHeight: 78 }}>
                  <GitCompareArrows size={24} color="#667085" />
                  <span className="muted">Select another version to compare</span>
                </div>
              </div>
              <Link href="/api/exports/prompt-log" className="link" style={{ marginTop: 14 }}>
                Compare multiple versions <ArrowRight size={16} />
              </Link>
            </Card>
          </div>
        </div>

        <Card>
          <div className="section-title">
            <h2>
              {currentPrompt.version} <Badge tone="green">Current</Badge>
            </h2>
            <div className="split-actions">
              <button className="button icon-only" aria-label="More prompt actions">
                <MoreHorizontal size={18} />
              </button>
              <button className="button ghost icon-only" aria-label="Close prompt details">
                <X size={19} />
              </button>
            </div>
          </div>
          <div className="grid two" style={{ marginBottom: 18 }}>
            <Button variant="primary">
              <Upload size={18} /> Promote to Current
            </Button>
            <Button>
              <Scale size={18} /> Compare
            </Button>
          </div>

          <PromptSection title="Prompt Summary">
            <p className="muted">{currentPrompt.promptSummary}</p>
            <Link href="/api/prompts/prompt_v15" className="link">
              View full prompt <ExternalLink size={16} />
            </Link>
          </PromptSection>

          <PromptSection title="Change Notes" badge="What's new in v1.5">
            <ul style={{ margin: "0 0 0 18px", padding: 0, color: "var(--muted-strong)" }}>
              {currentPrompt.changeNotes.map((note) => (
                <li key={note} style={{ marginBottom: 8 }}>
                  {note}
                </li>
              ))}
            </ul>
            <Link href="/api/exports/prompt-log" className="link">
              View all changes
            </Link>
          </PromptSection>

          <PromptSection title="Structured Output Settings" action={<Badge tone="green"><Check size={13} /> Enabled</Badge>}>
            <table className="table">
              <tbody>
                <ConfigRow label="Schema Version" value={currentPrompt.modelConfig.schemaVersion} />
                <ConfigRow label="Max Tokens" value={formatCount(currentPrompt.modelConfig.maxTokens)} />
                <ConfigRow label="Top P" value={currentPrompt.modelConfig.topP.toFixed(1)} />
              </tbody>
            </table>
          </PromptSection>

          <PromptSection title="Before / After (vs v1.4)">
            <div className="small-stat-grid">
              <SmallStat label="Exact Agreement" value={formatDecimal(currentPrompt.exactAgreement)} delta="↑ 0.07" />
              <SmallStat label="Cohen's Kappa" value={formatDecimal(currentPrompt.cohenKappa)} delta="↑ 0.06" />
              <SmallStat label="Needs Review" value={currentPrompt.needsReviewCount.toString()} delta="↓ 28 (14%)" negative />
            </div>
            <Link href="/reliability" className="link" style={{ marginTop: 14 }}>
              View detailed comparison <ArrowRight size={16} />
            </Link>
          </PromptSection>
        </Card>
      </div>
    </main>
  );
}

function PromptSection({
  title,
  children,
  badge,
  action
}: {
  title: string;
  children: ReactNode;
  badge?: string;
  action?: ReactNode;
}) {
  return (
    <section style={{ borderTop: "1px solid var(--border)", padding: "20px 0" }}>
      <div className="section-title">
        <h3>{title}</h3>
        {action ?? (badge ? <Badge tone="gray">{badge}</Badge> : <ChevronDown size={18} />)}
      </div>
      {children}
    </section>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="muted" style={{ paddingLeft: 0 }}>
        {label}
      </td>
      <td style={{ textAlign: "right", paddingRight: 0 }}>
        <strong>{value}</strong>
      </td>
    </tr>
  );
}

function SmallStat({ label, value, delta, negative }: { label: string; value: string; delta: string; negative?: boolean }) {
  return (
    <div className="small-stat">
      <p className="muted" style={{ margin: "0 0 8px" }}>
        {label}
      </p>
      <strong style={{ fontSize: 22 }}>{value}</strong>
      <p className={negative ? "trend-down" : "trend-up"} style={{ margin: "8px 0 0" }}>
        {delta}
      </p>
    </div>
  );
}

function titleCase(status: string) {
  return status[0] + status.slice(1).toLowerCase();
}
