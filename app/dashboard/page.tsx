import Link from "next/link";
import { ArrowUpRight, Calendar, CheckCircle2, Clock3, Group, Info, Target, UsersRound, Video } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, SectionTitle } from "@/components/ui/card";
import { IconCircle, LineChart } from "@/components/ui/charts";
import { MetricCard } from "@/components/ui/metric-card";
import { Photo } from "@/components/ui/photo";
import { formatCount, formatDecimal, priorityLabel, priorityTone } from "@/lib/format";
import { getCurrentPrompt, getDashboardStats, getReviewQueue, recentActivity, reliabilityTrend, videos } from "@/lib/data";

export default function DashboardPage() {
  const stats = getDashboardStats();
  const currentPrompt = getCurrentPrompt();
  const queue = getReviewQueue().slice(0, 3);

  return (
    <main className="content wide">
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your assessment reliability program"
        actions={
          <button className="button">
            <Calendar size={18} />
            May 11 - May 17, 2025
          </button>
        }
      />

      <div className="grid metrics" style={{ marginBottom: 20 }}>
        <MetricCard
          label="Total Videos"
          value={formatCount(stats.totalVideos)}
          icon={
            <IconCircle tone="blue">
              <Video size={24} />
            </IconCircle>
          }
          trend="↑ 12%"
          comparison="vs May 4 - May 10"
          sparkline={[3, 5, 4, 9, 12, 8, 13]}
        />
        <MetricCard
          label="Processed"
          value={formatCount(stats.processed)}
          icon={
            <IconCircle tone="green">
              <CheckCircle2 size={24} />
            </IconCircle>
          }
          trend="↑ 15%"
          comparison="vs May 4 - May 10"
          sparkline={[2, 3, 7, 8, 11, 9, 13]}
          color="var(--green)"
        />
        <MetricCard
          label="Needs Review"
          value={formatCount(stats.needsReview)}
          icon={
            <IconCircle tone="amber">
              <Clock3 size={24} />
            </IconCircle>
          }
          trend="↓ 8%"
          trendDirection="down"
          comparison="vs May 4 - May 10"
          sparkline={[9, 8, 8, 10, 12, 11, 14]}
          color="var(--amber)"
        />
        <MetricCard
          label="Current Agreement"
          value={formatDecimal(stats.currentAgreement)}
          icon={
            <IconCircle tone="purple">
              <UsersRound size={24} />
            </IconCircle>
          }
          comparison="Cohen's Kappa"
          sparkline={[6, 7, 8, 8, 9, 10, 11]}
          color="var(--purple)"
        />
        <MetricCard
          label="Target"
          value={formatDecimal(stats.target)}
          icon={
            <IconCircle tone="teal">
              <Target size={24} />
            </IconCircle>
          }
          comparison="Agreement Goal"
          sparkline={[8, 8, 9, 9, 9, 10, 10]}
          color="var(--teal)"
        />
      </div>

      <div className="grid two-wide" style={{ marginBottom: 20 }}>
        <Card className="chart-shell">
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
              <span className="legend-line" /> AI vs Human (Overall)
            </span>
            <span className="legend-item">
              <span className="legend-line dashed" /> AI vs Human (Primary Raters)
            </span>
          </div>
          <LineChart
            labels={reliabilityTrend.map((point) => point.label)}
            series={[
              {
                label: "AI vs Human (Overall)",
                values: reliabilityTrend.map((point) => point.aiHumanOverall ?? point.cohenKappa)
              },
              {
                label: "AI vs Human (Primary Raters)",
                values: reliabilityTrend.map((point) => point.aiHumanPrimary ?? point.cohenKappa),
                dashed: true
              }
            ]}
            target={0.9}
          />
          <Link href="/reliability" className="link">
            View reliability dashboard <ArrowUpRight size={16} />
          </Link>
        </Card>

        <Card>
          <SectionTitle title="Recent Processing Activity" action={<Link className="link" href="/videos">View all</Link>} />
          <div>
            {recentActivity.map((activity) => {
              const video = videos.find((item) => item.id === activity.videoId);
              return (
                <div className="activity-row" key={activity.videoId}>
                  {video ? <Photo className="thumb" src={video.thumbnailUrl} alt="" /> : <span className="thumb" />}
                  <div style={{ minWidth: 0 }}>
                    <strong>{video?.filename ?? activity.videoId}</strong>
                    <p className="muted" style={{ margin: "5px 0 0" }}>
                      Processed with v1.5 · GPT-4o
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <Badge tone={activity.status === "COMPLETED" ? "green" : activity.status === "PROCESSING" ? "blue" : "gray"}>{activity.label}</Badge>
                    <p className="muted" style={{ margin: "8px 0 0" }}>
                      {activity.timeAgo}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <Link href="/videos" className="link" style={{ marginTop: 12 }}>
            View all activity <ArrowUpRight size={16} />
          </Link>
        </Card>
      </div>

      <div className="grid two-wide">
        <Card>
          <SectionTitle title={<span>Review Queue <span className="muted">(Next Up)</span></span>} action={<Link className="link" href="/review">View full queue</Link>} />
          <div>
            {queue.map((video) => (
              <div className="queue-row" key={video.id}>
                <Photo className="thumb" src={video.thumbnailUrl} alt="" />
                <div style={{ minWidth: 0 }}>
                  <strong>{video.filename}</strong>
                  <p className="muted" style={{ margin: "5px 0 0" }}>
                    {video.ageBand} · {video.domainFocus}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <Badge tone={priorityTone(video.reviewPriority)}>{priorityLabel(video.reviewPriority)}</Badge>
                  <Link href={`/videos/${video.id}`} className="button">
                    Review
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <Link href="/review" className="link" style={{ marginTop: 12 }}>
            Go to review queue <ArrowUpRight size={16} />
          </Link>
        </Card>

        <Card>
          <SectionTitle title="Latest Prompt & Model Configuration" action={<Badge tone="green">Current</Badge>} />
          <div className="grid two" style={{ alignItems: "stretch" }}>
            <div className="card card-pad" style={{ background: "linear-gradient(135deg, var(--teal-soft), #fff)" }}>
              <IconCircle tone="teal">
                <Group size={22} />
              </IconCircle>
              <p className="muted" style={{ margin: "22px 0 6px" }}>
                Prompt Version
              </p>
              <h3 style={{ margin: 0, fontSize: 24 }}>{currentPrompt.version}</h3>
              <p className="muted">Updated {currentPrompt.lastUpdated}</p>
              <Link href="/prompts" className="link">
                View prompt <ArrowUpRight size={16} />
              </Link>
            </div>
            <div>
              <strong>Model Configuration</strong>
              <table className="table" style={{ marginTop: 8 }}>
                <tbody>
                  <ConfigRow label="Model" value={currentPrompt.modelName} />
                  <ConfigRow label="Temperature" value={currentPrompt.temperature.toString()} />
                  <ConfigRow label="Max Tokens" value={formatCount(currentPrompt.modelConfig.maxTokens)} />
                  <ConfigRow label="Top P" value={currentPrompt.modelConfig.topP.toFixed(1)} />
                  <ConfigRow label="Structured Output" value="Enabled" />
                </tbody>
              </table>
            </div>
          </div>
          <Link href="/prompts" className="link" style={{ marginTop: 14 }}>
            Manage prompts & models <ArrowUpRight size={16} />
          </Link>
        </Card>
      </div>
    </main>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="muted" style={{ paddingLeft: 0 }}>
        {label}
      </td>
      <td style={{ textAlign: "right", paddingRight: 0 }}>
        {value === "Enabled" ? <Badge tone="green">✓ {value}</Badge> : <strong>{value}</strong>}
      </td>
    </tr>
  );
}
