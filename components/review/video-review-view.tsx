import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowRight, Captions, Check, ChevronDown, Copy, ExternalLink, Flag, Maximize, Pause, Play, Save, Settings, Volume2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Photo } from "@/components/ui/photo";
import { creditLabel, creditTone, formatDecimal, formatDuration } from "@/lib/format";
import { getChildForVideo, getDalSummary, getDetectionsForVideo, getSkillById, getVideoById } from "@/lib/data";

export function VideoReviewView({ videoId }: { videoId: string }) {
  const video = getVideoById(videoId);

  if (!video) {
    return (
      <main className="content">
        <Card>
          <h1 className="page-title">Video not found</h1>
          <Link href="/videos" className="button primary">
            Back to videos
          </Link>
        </Card>
      </main>
    );
  }

  const child = getChildForVideo(video);
  const detections = getDetectionsForVideo(video.id);
  const selected = detections.find((detection) => detection.needsReview) ?? detections[0];
  const selectedSkill = selected ? getSkillById(selected.skillId) : undefined;
  const dal = getDalSummary(video.id);

  return (
    <>
      <main className="content wide">
        <div style={{ marginBottom: 18 }}>
          <Link href="/review#queue" className="link" style={{ color: "#475467" }}>
            <ArrowLeft size={16} /> Back to Review Queue
          </Link>
        </div>
        <div className="page-header">
          <div>
            <h1 className="page-title" style={{ marginBottom: 8 }}>
              Video Review
            </h1>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center" }}>
              <strong style={{ fontSize: 17 }}>{video.filename}</strong>
              <Copy size={16} color="#667085" />
              <MetaBlock label="Age Band" value={video.ageBand} />
              <MetaBlock label="Domain Focus" value={video.domainFocus} />
              <MetaBlock label="Observed On" value={video.observedAtLabel} />
              {child ? <MetaBlock label="Child ID" value={child.externalChildId} /> : null}
            </div>
          </div>
          <div className="split-actions">
            <Button>
              <ArrowLeft size={16} /> Previous
            </Button>
            <span className="muted" style={{ alignSelf: "center" }}>
              4 of 32
            </span>
            <Button>
              Next <ArrowRight size={16} />
            </Button>
          </div>
        </div>

        <div className="grid review-layout" style={{ marginBottom: 18 }}>
          <div className="grid">
            <div className="video-still video-shell">
              <Photo src={video.thumbnailUrl} alt="" />
              <div className="progress">
                <span />
              </div>
              <div className="video-controls">
                <Play size={21} fill="currentColor" />
                <Volume2 size={20} />
                <strong>01:23 / {formatDuration(video.durationSeconds)}</strong>
                <span style={{ marginLeft: "auto" }}>1.0x</span>
                <Captions size={20} />
                <Settings size={20} />
                <Maximize size={20} />
              </div>
            </div>

            <div className="alert">
              <AlertTriangle size={20} />
              <div>
                <strong>Low confidence detection</strong>
                <p style={{ margin: "5px 0 0", color: "#7f1d1d" }}>
                  One or more skills have low AI confidence. Please review carefully.
                </p>
              </div>
            </div>

            {selected ? (
              <Card>
                <SectionTitle
                  title="Selected Skill for Review"
                  action={<Badge tone="red">Disagreement</Badge>}
                  subtitle={selected.skillName}
                />
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                  <h3 style={{ margin: 0 }}>{selected.skillName}</h3>
                  <div>
                    <span className="muted">AI Confidence</span>
                    <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 800 }}>
                      {formatDecimal(selected.confidence)} <Badge tone="red">Low</Badge>
                    </p>
                  </div>
                </div>
                {selectedSkill ? (
                  <p className="muted" style={{ marginTop: 0 }}>
                    {selectedSkill.definition}
                  </p>
                ) : null}
                <div className="comparison">
                  <div>
                    <strong>AI Assessment</strong>
                    <Badge tone={creditTone(selected.credit)}>Credit: {creditLabel(selected.credit)}</Badge>
                    <p className="muted">{selected.rationale}</p>
                  </div>
                  <div>
                    <strong>Human Assessment</strong>
                    <Badge tone={creditTone(selected.humanCredit ?? "UNCERTAIN")}>Credit: {creditLabel(selected.humanCredit ?? "UNCERTAIN")}</Badge>
                    <p className="muted">The child independently looked up at the teacher and requested help.</p>
                  </div>
                </div>
                <Link href="#note" className="link" style={{ marginTop: 14 }}>
                  Add reviewer note (optional)
                </Link>
              </Card>
            ) : null}
          </div>

          <div className="grid">
            <Card padded={false}>
              <div className="card-pad" style={{ paddingBottom: 0 }}>
                <SectionTitle title="AI Skill Detections" action={<Badge tone="gray">{detections.length} detected</Badge>} />
              </div>
              <div className="table-wrap">
                <table className="table detection-table">
                  <thead>
                    <tr>
                      <th>Skill</th>
                      <th>Domain</th>
                      <th>Confidence</th>
                      <th>Credit</th>
                      <th>Evidence</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detections.map((detection) => (
                      <tr key={detection.id} className={detection.id === selected?.id ? "focused" : undefined}>
                        <td>
                          <strong>{detection.skillName}</strong>
                        </td>
                        <td>{detection.domain}</td>
                        <td>
                          {formatDecimal(detection.confidence)}
                          <Badge tone={detection.confidence >= 0.75 ? "green" : detection.confidence >= 0.4 ? "amber" : "red"}>
                            {detection.confidence >= 0.75 ? "High" : detection.confidence >= 0.4 ? "Medium" : "Low"}
                          </Badge>
                        </td>
                        <td>
                          <Badge tone={creditTone(detection.credit)}>{creditLabel(detection.credit)}</Badge>
                        </td>
                        <td className="muted">{detection.evidenceSummary}</td>
                        <td>{detection.timestamp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card-pad" style={{ paddingTop: 0 }}>
                <div className="alert" style={{ margin: "0 0 10px", padding: 10 }}>
                  <AlertTriangle size={17} />
                  <span>Disagreement detected: AI and human do not agree on credit for this skill.</span>
                  <Link href="#details" className="link" style={{ marginLeft: "auto" }}>
                    Show details <ChevronDown size={16} />
                  </Link>
                </div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <span className="legend-item">
                    <Badge tone="green">●</Badge> High (≥0.75)
                  </span>
                  <span className="legend-item">
                    <Badge tone="amber">●</Badge> Medium (0.40-0.74)
                  </span>
                  <span className="legend-item">
                    <Badge tone="red">●</Badge> Low (&lt;0.40)
                  </span>
                  <Link href="/api/exports/ai-outputs" className="link" style={{ marginLeft: "auto" }}>
                    View AI detection summary <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </Card>

            <div className="review-actions">
              <Button variant="success">
                <Check size={18} /> Accept AI (None)
              </Button>
              <Button>
                <ExternalLink size={18} /> Override
              </Button>
              <Button>
                <Flag size={18} /> Flag for discussion
              </Button>
              <Button variant="primary">
                <Save size={18} /> Save Review
              </Button>
            </div>
          </div>
        </div>

        <div className="grid two-wide">
          <Card>
            <SectionTitle title="Evidence Segments" action={<Badge tone="gray">{selected?.evidenceSegments.length ?? 0}</Badge>} subtitle="Key moments where evidence for this skill was detected." />
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th />
                    <th>Start</th>
                    <th>End</th>
                    <th>Duration</th>
                    <th>Description</th>
                    <th>Source</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(selected?.evidenceSegments ?? []).map((segment) => (
                    <tr key={segment.id}>
                      <td>
                        <Pause size={15} />
                      </td>
                      <td>{segment.start}</td>
                      <td>{segment.end}</td>
                      <td>{segment.duration}</td>
                      <td>{segment.description}</td>
                      <td>{segment.source}</td>
                      <td>{segment.flag ? <Badge tone={segment.flag === "Low" ? "red" : "amber"}>{segment.flag}</Badge> : <Badge tone="gray">-</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Link href="#add-evidence" className="link" style={{ marginTop: 12 }}>
              Add evidence segment +
            </Link>
          </Card>

          <Card>
            <SectionTitle title={<span>DAL Summary <span className="muted">({video.domainFocus})</span></span>} action={<Link href="/reliability" className="link">View full DAL <ArrowRight size={16} /></Link>} />
            <div className="donut-layout">
              <div className="donut">
                <div className="donut-inner">
                  <span>
                    <span style={{ display: "block", fontSize: 26 }}>{dal.totalSkills}</span>
                    <span className="muted" style={{ fontSize: 11 }}>
                      Total Skills
                    </span>
                  </span>
                </div>
              </div>
              <div>
                <DalRow tone="green" label="Full Credit" value={dal.fullCredit} percent={0.33} />
                <DalRow tone="amber" label="Partial Credit" value={dal.partialCredit} percent={0.33} />
                <DalRow tone="red" label="No Credit" value={dal.noCredit} percent={0.17} />
                <DalRow tone="gray" label="Not Observed" value={dal.notObserved} percent={0.17} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", gap: 14, marginTop: 22 }}>
              <strong>Overall DAL Score</strong>
              <div className="progress-bar" style={{ width: 220 }}>
                <span style={{ width: `${dal.score * 100}%` }} />
              </div>
              <strong style={{ fontSize: 18 }}>{formatDecimal(dal.score)}</strong>
              <span />
              <span />
              <Badge tone="amber">Moderate</Badge>
            </div>
          </Card>
        </div>
      </main>
      <footer className="footer-bar">
        <span>Video ID: {video.id}</span>
        <span>Prompt Version: v1.5</span>
        <span>Reviewed by: Sarah Chen</span>
        <span>Last saved: 2 min ago</span>
      </footer>
    </>
  );
}

function MetaBlock({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ borderLeft: "1px solid var(--border)", paddingLeft: 18 }}>
      <span className="muted" style={{ display: "block", fontSize: 12, fontWeight: 700 }}>
        {label}
      </span>
      <span>{value}</span>
    </span>
  );
}

function DalRow({ tone, label, value, percent }: { tone: "green" | "amber" | "red" | "gray"; label: string; value: number; percent: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <span>
        <Badge tone={tone}>■</Badge> {label}
      </span>
      <strong>
        {value} ({Math.round(percent * 100)}%)
      </strong>
    </div>
  );
}
