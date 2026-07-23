"use client";

import { ArrowLeft, ArrowRight, Check, CheckCircle2, Circle, Clock3, FileVideo2, RefreshCw, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Sparkle } from "@/components/brand";
import { PageState } from "@/components/page-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { backLinkClass, Eyebrow, PageShell } from "@/components/ui/app-patterns";
import { Button } from "@/components/ui/button";
import { handleProtectedResponse, responseError } from "@/lib/help-review/client-http";
import { formatDateTime } from "@/lib/help-review/presentation";
import { cn } from "@/lib/utils";

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
  readonly blankSuggestionCount: number;
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

  if (!assessment && error) return <PageShell><PageState description={error} kind="error" title="Status could not be loaded"><Button onClick={() => void loadStatus(true)} type="button"><RefreshCw aria-hidden="true" size={16} /> Try again</Button></PageState></PageShell>;
  if (!assessment) return <PageShell><PageState description="Checking the latest durable processing state." kind="loading" title="Loading processing status" /></PageShell>;

  const failed = assessment.status === "FAILED";
  const ready = assessment.ready;
  const analysisStarted = assessment.run?.status === "RUNNING" || assessment.run?.status === "COMPLETED" || assessment.run?.status === "FAILED";

  return (
    <main className="mx-auto w-[min(calc(100%_-_40px),900px)] px-0 py-8 pb-16 max-sm:w-full max-sm:px-3 max-sm:py-[18px] max-sm:pb-[50px]">
      <div className="flex items-start justify-between gap-4"><Link className={backLinkClass} href={`/children/${assessment.child.id}`}><ArrowLeft aria-hidden="true" size={16} /> {assessment.child.externalChildId}</Link><Button disabled={refreshing} onClick={() => void loadStatus(true)} size="sm" type="button" variant="secondary"><RefreshCw aria-hidden="true" className={cn(refreshing && "motion-safe:animate-spin")} size={15} /><span className="max-sm:sr-only">Refresh status</span></Button></div>
      <section className="mx-auto max-w-[600px] pt-7 text-center max-sm:pt-5" aria-live="polite">
        <span className="relative mx-auto mb-5 grid w-fit">
          <span className={cn("grid size-[70px] place-items-center rounded-full [&_svg]:size-8", failed ? "bg-destructive-soft text-destructive" : ready ? "bg-success-soft text-success" : "bg-accent text-primary [&_svg]:motion-safe:animate-spin")}>
            {failed ? <XCircle aria-hidden="true" /> : ready ? <CheckCircle2 aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
          </span>
          {ready ? <Sparkle className="absolute -top-1 -right-3 size-4 text-brand-yellow" /> : null}
        </span>
        <Eyebrow>{failed ? "Processing failed" : ready ? "Analysis complete" : "Analysis in progress"}</Eyebrow>
        <h1 className="mt-2 font-heading text-4xl font-bold leading-tight text-ink max-sm:text-[29px]">{failed ? assessment.error?.title ?? "We could not complete the analysis" : ready ? "Ready for review" : "Analyzing observation"}</h1>
        <p className="mx-auto mt-3 max-w-[560px] leading-relaxed text-muted-foreground">{failed ? assessment.error?.description : ready ? "The validated draft is ready for your professional review." : "You may leave this page. Processing continues without keeping the browser open."}</p>

        <ol className="mx-auto my-7 grid max-w-[440px] text-left" aria-label="Processing progress">
          <TimelineItem detail={assessment.video?.originalFilename} icon={<Check aria-hidden="true" />} state="complete" title="Video uploaded" />
          <TimelineItem detail="Private video access confirmed" icon={<ShieldCheck aria-hidden="true" />} state="complete" title="Security check complete" />
          <TimelineItem detail={`Attempt ${assessment.run?.attempt ?? 1}`} icon={failed ? <XCircle aria-hidden="true" /> : ready ? <Check aria-hidden="true" /> : <Clock3 aria-hidden="true" />} state={failed ? "failed" : ready ? "complete" : "current"} title={failed ? "Analysis failed" : ready ? "Analysis complete" : "Analysis in progress"} />
          <TimelineItem detail={ready ? `${assessment.suggestionCount} validated suggestions` : "Pending valid result"} icon={ready ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />} state={ready ? "complete" : "pending"} title="Review ready" />
        </ol>

        <div className="mx-auto flex max-w-[520px] items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 text-left shadow-card"><FileVideo2 aria-hidden="true" className="shrink-0 text-primary" /><span className="grid min-w-0 gap-1"><strong className="truncate">{assessment.video?.originalFilename ?? "Video unavailable"}</strong><small className="text-xs text-muted-foreground">{assessment.video ? `${(assessment.video.byteSize / 1024 / 1024).toFixed(1)} MB` : "No available asset"} · updated {formatDateTime(assessment.updatedAt)}</small></span></div>
        {ready ? <div className="mx-auto mt-4 grid max-w-[520px] grid-cols-2 divide-x divide-border rounded-2xl border border-border bg-surface shadow-card max-sm:divide-x-0 max-sm:divide-y"><span className="grid gap-1 p-3.5 text-xs text-muted-foreground"><strong className="text-2xl font-extrabold text-ink">{assessment.suggestionCount}</strong> skill suggestions</span><span className="grid gap-1 p-3.5 text-xs text-muted-foreground"><strong className="text-2xl font-extrabold text-ink">{assessment.blankSuggestionCount}</strong> left blank by AI</span></div> : null}
        {error ? <Alert className="mt-5 text-left" variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2.5 max-sm:flex-col">
          <Button asChild className="max-sm:w-full" variant="secondary"><Link href="/children">Return to children</Link></Button>
          {failed ? <><Button asChild className="max-sm:w-full" variant="secondary"><Link href={`/assessments/new?childId=${assessment.child.id}&assessmentId=${assessment.id}`}><RotateCcw aria-hidden="true" size={16} /> Replace video</Link></Button><Button className="max-sm:w-full" disabled={retrying || !assessment.error?.retryable} onClick={() => void retry()} type="button"><RefreshCw aria-hidden="true" size={17} /> {retrying ? "Retrying..." : "Retry processing"}</Button></> : ready ? <Button asChild className="max-sm:w-full"><Link href={`/assessments/${assessmentId}/review`}>Start review <ArrowRight aria-hidden="true" size={17} /></Link></Button> : null}
        </div>
        {!ready && !failed && !analysisStarted ? <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><Clock3 aria-hidden="true" size={14} /> Queued at {assessment.run ? formatDateTime(assessment.run.requestedAt) : "now"}</p> : null}
      </section>
    </main>
  );
}

function TimelineItem({ title, detail, icon, state }: { readonly title: string; readonly detail?: string | null; readonly icon: React.ReactNode; readonly state: "complete" | "current" | "failed" | "pending" }) {
  return (
    <li className="grid grid-cols-[32px_1fr] gap-3 pb-5 last:pb-0">
      <span className={cn("relative z-10 grid size-8 place-items-center rounded-full border bg-surface after:absolute after:top-8 after:left-1/2 after:h-5 after:w-px after:-translate-x-1/2 after:bg-border last:after:hidden [&_svg]:size-4", state === "complete" && "border-success bg-success text-white", state === "current" && "border-warning bg-warning-soft text-warning", state === "failed" && "border-destructive bg-destructive-soft text-destructive", state === "pending" && "border-border-strong text-muted-foreground")}>
        {icon}
      </span>
      <div className="grid content-start gap-1 pt-1"><strong className="text-sm text-ink">{title}</strong><small className="text-xs text-muted-foreground">{detail}</small></div>
    </li>
  );
}
