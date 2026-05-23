import Link from "next/link";
import { ArrowRight, CloudUpload, Filter, PlayCircle, RefreshCcw, Search } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Photo } from "@/components/ui/photo";
import { creditTone, priorityLabel, priorityTone, statusLabel } from "@/lib/format";
import { videos } from "@/lib/data";

export default function VideosPage() {
  return (
    <main className="content wide">
      <PageHeader
        title="Videos"
        subtitle="Register observation videos, track processing, and open review evidence."
        actions={
          <div className="split-actions">
            <Button>
              <CloudUpload size={18} /> Register Upload
            </Button>
            <Button variant="primary">
              <PlayCircle size={18} /> Start Processing
            </Button>
          </div>
        }
      />

      <Card className="filters" style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Status</label>
          <select defaultValue="all" aria-label="Status filter">
            <option value="all">All Statuses</option>
            <option value="needs-review">Needs Review</option>
            <option value="completed">Completed</option>
            <option value="processing">Processing</option>
          </select>
        </div>
        <div className="field">
          <label>Dataset Split</label>
          <select defaultValue="all" aria-label="Dataset split filter">
            <option value="all">All Splits</option>
            <option value="validation">Validation</option>
            <option value="calibration">Calibration</option>
            <option value="training">Training</option>
          </select>
        </div>
        <div className="field">
          <label>Review State</label>
          <select defaultValue="all" aria-label="Review state filter">
            <option value="all">All Videos</option>
            <option value="flagged">Needs Review</option>
            <option value="unmatched">Unmatched</option>
          </select>
        </div>
        <Button>
          <Filter size={18} /> Filters
        </Button>
        <Button variant="ghost">
          <RefreshCcw size={18} /> Reset
        </Button>
      </Card>

      <Card padded={false}>
        <div className="card-pad" style={{ paddingBottom: 0 }}>
          <SectionTitle
            title="Video Registry"
            subtitle="List endpoints avoid raw video payloads and show only operational metadata."
            action={
              <label className="input-like" style={{ width: 260 }}>
                <Search size={17} />
                <input style={{ border: 0, outline: 0, minWidth: 0 }} placeholder="Search videos..." aria-label="Search videos" />
              </label>
            }
          />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Video</th>
                <th>Child</th>
                <th>Age</th>
                <th>Domain</th>
                <th>Status</th>
                <th>AI Runs</th>
                <th>Review</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {videos.map((video) => (
                <tr key={video.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Photo className="thumb" src={video.thumbnailUrl} alt="" />
                      <div>
                        <strong>{video.filename}</strong>
                        <p className="muted" style={{ margin: "5px 0 0" }}>
                          {video.observedAtLabel}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>{video.externalChildId ?? <Badge tone="amber">Unmatched</Badge>}</td>
                  <td>{video.ageBand}</td>
                  <td>{video.domainFocus}</td>
                  <td>
                    <Badge tone={video.status === "COMPLETED" ? "green" : video.status === "PROCESSING" ? "blue" : video.status === "NEEDS_REVIEW" ? "amber" : "gray"}>
                      {statusLabel(video.status)}
                    </Badge>
                  </td>
                  <td>{video.aiRunCount}</td>
                  <td>
                    {video.reviewPriority ? (
                      <Badge tone={priorityTone(video.reviewPriority)}>{priorityLabel(video.reviewPriority)}</Badge>
                    ) : (
                      <Badge tone={creditTone("CREDIT")}>Clear</Badge>
                    )}
                  </td>
                  <td>
                    <Link href={`/videos/${video.id}`} className="button">
                      Open <ArrowRight size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
