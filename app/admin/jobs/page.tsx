"use client";

import { AlertCircle, ArrowRight, CheckCircle2, Clock3, FileVideo2, RefreshCw, Search, ShieldAlert, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageState } from "@/components/page-state";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eyebrow, PageShell } from "@/components/ui/app-patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { handleProtectedResponse, responseError } from "@/lib/help-review/client-http";
import { formatDate, formatDateTime } from "@/lib/help-review/presentation";
import { cn } from "@/lib/utils";

interface AdminJob {
  readonly assessmentId: string;
  readonly observationDate: string;
  readonly childId: string;
  readonly childExternalId: string;
  readonly videoAvailable: boolean;
  readonly videoFilename: string | null;
  readonly retryEligible: boolean;
  readonly retryReason: string | null;
  readonly stuck: boolean;
  readonly error: { readonly title: string; readonly description: string; readonly retryable: boolean };
  readonly run: { readonly id: string; readonly attempt: number; readonly status: string; readonly requestedAt: string; readonly completedAt: string | null; readonly safeErrorCode: string | null };
  readonly attempts: ReadonlyArray<{ readonly id: string; readonly attempt: number; readonly status: string; readonly requestedAt: string; readonly completedAt: string | null; readonly safeErrorCode: string | null }>;
}

function AdminJobsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("search") ?? "";
  const filter = (["all", "failed", "stuck"] as const).find((candidate) => candidate === searchParams.get("filter")) ?? "all";
  const [jobs, setJobs] = useState<readonly AdminJob[] | null>(null);
  const [totalRelevant, setTotalRelevant] = useState(0);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const selectedJobTriggerRef = useRef<HTMLButtonElement | null>(null);
  const retryTriggerRef = useRef<HTMLButtonElement | null>(null);

  const load = useCallback(async () => {
    setJobs(null);
    try {
      const params = new URLSearchParams({ filter });
      if (query.trim()) params.set("search", query.trim());
      const response = await fetch(`/api/admin/jobs?${params}`, { cache: "no-store" });
      if (handleProtectedResponse(response, router, "/admin/jobs")) return;
      if (!response.ok) {
        setError("A temporary problem prevented processing jobs from loading. No job state was changed.");
        return;
      }
      const projection = await response.json() as {
        readonly jobs: AdminJob[];
        readonly totalRelevant: number;
        readonly lastRefreshedAt: string;
      };
      setJobs(projection.jobs);
      setTotalRelevant(projection.totalRelevant);
      setLastRefreshedAt(projection.lastRefreshedAt);
      setSelectedId((current) => current && projection.jobs.some((job) => job.run.id === current) ? current : projection.jobs[0]?.run.id ?? null);
      setError(null);
    } catch {
      setError("A temporary problem prevented processing jobs from loading. No job state was changed.");
    }
  }, [filter, query, router]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);
  const visibleJobs = jobs ?? [];
  const selected = visibleJobs.find((job) => job.run.id === selectedId) ?? null;

  function updateRoute(nextQuery: string, nextFilter: string) {
    const params = new URLSearchParams();
    if (nextQuery) params.set("search", nextQuery);
    if (nextFilter !== "all") params.set("filter", nextFilter);
    router.replace(params.size > 0 ? `/admin/jobs?${params}` : "/admin/jobs", { scroll: false });
  }

  function searchJobs(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = String(new FormData(event.currentTarget).get("search") ?? "").trim();
    updateRoute(nextQuery, filter);
  }

  function closeJobDetails() {
    const trigger = selectedJobTriggerRef.current;
    setSelectedId(null);
    window.requestAnimationFrame(() => {
      if (trigger?.isConnected) trigger.focus();
    });
  }

  async function retry() {
    if (!selected) return;
    setRetrying(true);
    setConfirmOpen(false);
    setError(null);
    try {
      const response = await fetch(`/api/admin/jobs/${selected.run.id}/retry`, { method: "POST" });
      if (handleProtectedResponse(response, router, "/admin/jobs")) return;
      if (!response.ok) setError(await responseError(response, "The processing run could not be retried."));
      else {
        setSuccess(`Retry started for ${selected.childExternalId}.`);
        await load();
      }
    } catch {
      setError("The network interrupted the retry request. Refresh jobs before trying again.");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <PageShell>
      <header className="flex items-end justify-between gap-6 max-sm:items-start max-sm:flex-col"><div><Eyebrow>Administration</Eyebrow><h1 className="mt-1 font-heading text-4xl font-bold leading-tight max-sm:text-[30px]">Processing jobs</h1><p className="mt-2.5 leading-relaxed text-muted-foreground">Review failed pilot processing and retry only when the source video is available.</p></div><Button onClick={() => void load()} size="sm" type="button" variant="secondary"><RefreshCw aria-hidden="true" size={15} /> Refresh jobs</Button></header>
      {success ? <Alert className="mt-7" variant="success"><CheckCircle2 aria-hidden="true" size={18} /><AlertDescription className="flex items-center justify-between gap-3">{success}<Button aria-label="Dismiss message" onClick={() => setSuccess(null)} size="icon-xs" type="button" variant="ghost"><X aria-hidden="true" size={15} /></Button></AlertDescription></Alert> : null}
      {error && jobs ? <Alert className="mt-7" variant="destructive"><AlertDescription className="flex items-center justify-between gap-3">{error}<button className="font-extrabold underline underline-offset-4" onClick={() => void load()} type="button">Try again</button></AlertDescription></Alert> : null}
      {!jobs && error ? <PageState description={error} kind="error" title="Processing jobs could not be loaded"><Button onClick={() => void load()} type="button"><RefreshCw aria-hidden="true" size={16} /> Try again</Button></PageState> : null}
      {!jobs && !error ? <PageState description="Checking failed and stuck processing attempts." kind="loading" title="Loading processing jobs" /> : null}
      {jobs?.length === 0 && totalRelevant === 0 ? <PageState description="There are no failed or stuck jobs requiring Admin follow-up." kind="empty" title="No failed or stuck jobs"><Button onClick={() => void load()} type="button" variant="secondary"><RefreshCw aria-hidden="true" size={16} /> Refresh jobs</Button>{lastRefreshedAt ? <p className="text-xs text-muted-foreground">Last refreshed {formatDateTime(lastRefreshedAt)}</p> : null}</PageState> : null}
      {jobs?.length === 0 && totalRelevant > 0 ? <PageState description="Change the status filter or search to see other failed and stuck attempts." kind="empty" title="No processing jobs match"><Button onClick={() => updateRoute("", "all")} type="button" variant="secondary">Clear filters</Button></PageState> : null}
      {jobs && jobs.length > 0 ? <>
        <div className="mt-7 flex items-center justify-between gap-4 border-y border-border py-4 max-sm:items-stretch max-sm:flex-col"><div className="inline-flex rounded-md border border-border-strong bg-surface p-1" aria-label="Filter processing jobs"><Button aria-pressed={filter === "all"} onClick={() => updateRoute(query, "all")} size="sm" type="button" variant={filter === "all" ? "default" : "ghost"}>All</Button><Button aria-pressed={filter === "failed"} onClick={() => updateRoute(query, "failed")} size="sm" type="button" variant={filter === "failed" ? "default" : "ghost"}>Failed</Button><Button aria-pressed={filter === "stuck"} onClick={() => updateRoute(query, "stuck")} size="sm" type="button" variant={filter === "stuck" ? "default" : "ghost"}>Stuck</Button></div><form className="flex w-[340px] items-center gap-2 rounded-md border border-border-strong bg-surface px-2.5 focus-within:ring-3 focus-within:ring-ring/25 max-sm:w-full" onSubmit={searchJobs}><Search aria-hidden="true" size={16} /><label className="sr-only" htmlFor="job-search">Search jobs</label><Input className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" defaultValue={query} id="job-search" key={query} name="search" placeholder="Search assessment or child" type="search" /><Button aria-label="Search" size="icon-xs" title="Search" type="submit" variant="ghost"><ArrowRight aria-hidden="true" size={15} /></Button></form></div>
        <div className="mt-[18px] grid grid-cols-[minmax(0,1fr)_360px] items-start gap-5 max-lg:grid-cols-[1fr_320px] max-md:grid-cols-1">
          <section className="overflow-hidden rounded-md border border-border bg-surface" aria-label="Failed processing jobs"><div className="grid grid-cols-[minmax(145px,1fr)_minmax(100px,.7fr)_100px_minmax(125px,.8fr)_minmax(150px,.9fr)] gap-2.5 border-b border-border bg-surface-soft px-3 py-2.5 text-[10px] font-extrabold uppercase text-muted-foreground max-lg:grid-cols-[minmax(135px,1fr)_95px_90px_minmax(120px,.8fr)] max-lg:[&>span:last-child]:hidden max-sm:hidden" aria-hidden="true"><span>Assessment</span><span>Child</span><span>Status</span><span>Safe category</span><span>Last changed</span></div>{visibleJobs.map((job) => { const stuck = job.stuck; return <button aria-controls="job-details-panel" aria-expanded={selectedId === job.run.id} className={cn("grid min-h-[70px] w-full grid-cols-[minmax(145px,1fr)_minmax(100px,.7fr)_100px_minmax(125px,.8fr)_minmax(150px,.9fr)] items-center gap-2.5 border-b border-border px-3 py-2.5 text-left text-[11px] text-muted-foreground last:border-b-0 hover:bg-surface-soft max-lg:grid-cols-[minmax(135px,1fr)_95px_90px_minmax(120px,.8fr)] max-lg:[&>span:last-child]:hidden max-sm:grid-cols-[1fr_auto] max-sm:[&>span:nth-child(2)]:grid max-sm:[&>span:nth-child(4)]:col-span-full max-sm:[&>span:nth-child(4)]:grid", selectedId === job.run.id && "bg-accent shadow-[inset_3px_0_0_var(--primary)]")} key={job.run.id} onClick={() => setSelectedId(job.run.id)} ref={selectedId === job.run.id ? selectedJobTriggerRef : undefined} type="button"><span className="grid gap-1"><strong className="text-ink">{job.assessmentId.slice(-8).toUpperCase()}</strong><small>{formatDate(job.observationDate)}</small></span><span>{job.childExternalId}</span><span><StatusBadge status={stuck ? "PROCESSING" : "FAILED"} label={stuck ? "Stuck" : "Failed"}><AlertCircle aria-hidden="true" size={13} /></StatusBadge></span><span>{job.run.safeErrorCode ?? "ANALYSIS_FAILED"}</span><span>{formatDateTime(job.run.completedAt ?? job.run.requestedAt)}</span></button>; })}</section>
          {selected ? <aside className="sticky top-[18px] border border-border bg-surface p-4 max-md:static" aria-labelledby="job-details-title" id="job-details-panel"><header className="flex items-start justify-between gap-3"><div><Eyebrow>Assessment {selected.assessmentId.slice(-8).toUpperCase()}</Eyebrow><h2 className="mt-1 font-heading text-xl font-bold" id="job-details-title">{selected.error.title}</h2></div><Button aria-label="Close job details" onClick={closeJobDetails} size="icon" type="button" variant="outline"><X aria-hidden="true" /></Button></header><p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{selected.error.description}</p><dl className="my-3 border-t border-border">{[["Child", selected.childExternalId], ["Observation", formatDate(selected.observationDate)], ["Safe category", selected.run.safeErrorCode ?? "ANALYSIS_FAILED"]].map(([term, value]) => <div className="flex justify-between gap-3 border-b border-border py-2 text-xs" key={term}><dt className="text-muted-foreground">{term}</dt><dd className="m-0 font-extrabold text-right">{value}</dd></div>)}<div className="flex justify-between gap-3 border-b border-border py-2 text-xs"><dt className="text-muted-foreground">Video</dt><dd className={cn("m-0 flex items-center gap-1 font-extrabold", selected.videoAvailable ? "text-success" : "text-destructive")}>{selected.videoAvailable ? <><FileVideo2 aria-hidden="true" size={14} /> Available</> : "Unavailable"}</dd></div></dl><section className="my-3"><h3 className="mb-2.5 text-[13px] font-bold">Attempt history</h3>{selected.attempts.map((attempt) => <div className="grid grid-cols-[12px_1fr] gap-2 py-1" key={attempt.id}><span className={cn("mt-1 size-[9px] rounded-full bg-primary", attempt.status === "FAILED" && "bg-destructive")} /><span className="grid gap-1 text-xs"><strong>Attempt {attempt.attempt} · {attempt.status.toLowerCase()}</strong><small className="flex items-center gap-1 text-muted-foreground"><Clock3 aria-hidden="true" size={12} /> {formatDateTime(attempt.completedAt ?? attempt.requestedAt)}</small></span></div>)}</section><Alert className="mt-3" variant={selected.retryEligible ? "info" : "warning"}><ShieldAlert aria-hidden="true" size={17} /><AlertDescription>{selected.retryReason ?? "Technical details remain in protected server logs."}</AlertDescription></Alert><Button className="mt-3 w-full" disabled={!selected.retryEligible || retrying} onClick={() => setConfirmOpen(true)} ref={retryTriggerRef} type="button"><RefreshCw aria-hidden="true" size={16} /> {retrying ? "Retrying..." : "Retry processing"}</Button></aside> : null}
        </div>
      </> : null}
      <ConfirmDialog
        confirmLabel="Retry processing"
        description={selected ? `Retry assessment ${selected.assessmentId.slice(-8).toUpperCase()} for ${selected.childExternalId} after attempt ${selected.run.attempt}?` : ""}
        details={selected ? [
          `Attempt ${selected.run.attempt} remains in history`,
          `Safe category: ${selected.run.safeErrorCode ?? "ANALYSIS_FAILED"}`,
          selected.videoAvailable ? "The existing private video is available" : "The private video is unavailable",
          "Educator review work is not overwritten"
        ] : []}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void retry()}
        open={confirmOpen}
        pending={retrying}
        returnFocusRef={retryTriggerRef}
        title="Retry processing?"
        tone="primary"
      />
    </PageShell>
  );
}

export default function AdminJobsPage() {
  return <Suspense fallback={<PageShell><PageState description="Checking failed and stuck processing attempts." kind="loading" title="Loading processing jobs" /></PageShell>}><AdminJobsContent /></Suspense>;
}
