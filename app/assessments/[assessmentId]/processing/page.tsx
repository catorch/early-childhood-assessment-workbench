"use client";

import { ArrowLeft, ArrowRight, Check, CheckCircle2, Circle, Clock3, FileVideo2, RefreshCw, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { PageState } from "@/components/page-state";
import { handleProtectedResponse, responseError } from "@/lib/help-review/client-http";
import { formatDateTime } from "@/lib/help-review/presentation";

interface StatusProjection {
  readonly id: string;
  readonly observationDate: string;
  readonly status: string;
  readonly updatedAt: string;
  readonly ready: boolean;
  readonly child: { readonly id: string; readonly externalChildId: string };
  readonly video: { readonly originalFilename: string; readonly byteSize: number } | null;
  readonly run: { readonly attempt: number; readonly status: string; readonly safeErrorCode: string | null; readonly requestedAt: string; readonly completedAt: string | null } | null;
  readonly error: { readonly title: string; readonly description: string; readonly retryable: boolean } | null;
  readonly suggestionCount: number;
  readonly needsReviewCount: number;
}

export default function ProcessingPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const router = useRouter();
  const [assessment, setAssessment] = useState<StatusProjection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadStatus = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const response = await fetch(`/api/assessments/${assessmentId}/status`, { cache: "no-store" });
      if (handleProtectedResponse(response, router, `/assessments/${assessmentId}/processing`)) return;
      if (!response.ok) setError("A temporary problem prevented the latest processing status from loading.");
      else {
        setAssessment((await response.json()).assessment as StatusProjection);
        setError(null);
      }
    } catch {
      setError("A temporary problem prevented the latest processing status from loading.");
    } finally {
      setRefreshing(false);
    }
  }, [assessmentId, router]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadStatus(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadStatus]);
  useEffect(() => {
    if (!assessment || assessment.ready || assessment.status === "FAILED") return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadStatus();
    }, 1_500);
    return () => window.clearInterval(interval);
  }, [assessment, loadStatus]);

  async function retry() {
    setRetrying(true);
    setError(null);
    try {
      const response = await fetch(`/api/assessments/${assessmentId}/process`, { method: "POST" });
      if (handleProtectedResponse(response, router, `/assessments/${assessmentId}/processing`)) return;
      if (!response.ok) setError(await responseError(response, "Analysis could not be retried."));
      await loadStatus();
    } catch {
      setError("The network interrupted the retry request. Check the current status before trying again.");
    } finally {
      setRetrying(false);
    }
  }

  if (!assessment && error) return <main className="page-shell"><PageState description={error} kind="error" title="Status could not be loaded"><button className="button primary icon-text" onClick={() => void loadStatus(true)} type="button"><RefreshCw aria-hidden="true" size={16} /> Try again</button></PageState></main>;
  if (!assessment) return <main className="page-shell"><PageState description="Checking the latest durable processing state." kind="loading" title="Loading processing status" /></main>;

  const failed = assessment.status === "FAILED";
  const ready = assessment.ready;
  const analysisStarted = assessment.run?.status === "RUNNING" || assessment.run?.status === "COMPLETED" || assessment.run?.status === "FAILED";

  return (
    <main className="processing-page">
      <div className="processing-topbar"><Link className="back-link" href={`/children/${assessment.child.id}`}><ArrowLeft aria-hidden="true" size={16} /> {assessment.child.externalChildId}</Link><button className="button secondary compact icon-text" disabled={refreshing} onClick={() => void loadStatus(true)} type="button"><RefreshCw aria-hidden="true" className={refreshing ? "spin" : ""} size={15} /> Refresh status</button></div>
      <section className={`processing-panel${failed ? " failed" : ready ? " ready" : ""}`} aria-live="polite">
        <span className={`processing-mark ${failed ? "failed" : ready ? "ready" : "working"}`}>{failed ? <XCircle aria-hidden="true" /> : ready ? <CheckCircle2 aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}</span>
        <span className="eyebrow">{failed ? "Processing failed" : ready ? "Analysis complete" : "Analysis in progress"}</span>
        <h1>{failed ? assessment.error?.title ?? "We could not complete the analysis" : ready ? "Ready for review" : "Analyzing observation"}</h1>
        <p>{failed ? assessment.error?.description : ready ? "The validated draft is ready for your professional review." : "You may leave this page. Processing continues without keeping the browser open."}</p>

        <ol className="processing-timeline" aria-label="Processing progress">
          <li className="complete"><span><Check aria-hidden="true" /></span><div><strong>Video uploaded</strong><small>{assessment.video?.originalFilename}</small></div></li>
          <li className="complete"><span><ShieldCheck aria-hidden="true" /></span><div><strong>Security check complete</strong><small>Private video access confirmed</small></div></li>
          <li className={failed ? "failed" : ready ? "complete" : "current"}><span>{failed ? <XCircle aria-hidden="true" /> : ready ? <Check aria-hidden="true" /> : <Clock3 aria-hidden="true" />}</span><div><strong>{failed ? "Analysis failed" : ready ? "Analysis complete" : "Analysis in progress"}</strong><small>Attempt {assessment.run?.attempt ?? 1}</small></div></li>
          <li className={ready ? "complete" : "pending"}><span>{ready ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}</span><div><strong>Review ready</strong><small>{ready ? `${assessment.suggestionCount} validated suggestions` : "Pending valid result"}</small></div></li>
        </ol>

        <div className="processing-file"><FileVideo2 aria-hidden="true" /><span><strong>{assessment.video?.originalFilename ?? "Video unavailable"}</strong><small>{assessment.video ? `${(assessment.video.byteSize / 1024 / 1024).toFixed(1)} MB` : "No available asset"} · updated {formatDateTime(assessment.updatedAt)}</small></span></div>
        {ready ? <div className="ready-counts"><span><strong>{assessment.suggestionCount}</strong> skill suggestions</span><span><strong>{assessment.needsReviewCount}</strong> need independent review</span></div> : null}
        {error ? <div className="notice error" role="alert">{error}</div> : null}
        <div className="processing-actions">
          <Link className="button secondary" href="/children">Return to children</Link>
          {failed ? <><Link className="button secondary icon-text" href={`/assessments/new?childId=${assessment.child.id}&assessmentId=${assessment.id}`}><RotateCcw aria-hidden="true" size={16} /> Replace video</Link><button className="button primary icon-text" disabled={retrying || !assessment.error?.retryable} onClick={() => void retry()} type="button"><RefreshCw aria-hidden="true" size={17} /> {retrying ? "Retrying..." : "Retry processing"}</button></> : ready ? <Link className="button primary icon-text" href={`/assessments/${assessmentId}/review`}>Start review <ArrowRight aria-hidden="true" size={17} /></Link> : null}
        </div>
        {!ready && !failed && !analysisStarted ? <p className="quiet-status"><Clock3 aria-hidden="true" size={14} /> Queued at {assessment.run ? formatDateTime(assessment.run.requestedAt) : "now"}</p> : null}
      </section>
    </main>
  );
}
