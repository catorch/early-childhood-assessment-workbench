"use client";

import { AlertCircle, ArrowRight, CheckCircle2, Clock3, FileVideo2, RefreshCw, Search, ShieldAlert, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageState } from "@/components/page-state";
import { handleProtectedResponse, responseError } from "@/lib/help-review/client-http";
import { formatDate, formatDateTime } from "@/lib/help-review/presentation";

interface AdminJob {
  readonly assessmentId: string;
  readonly observationDate: string;
  readonly childId: string;
  readonly childExternalId: string;
  readonly videoAvailable: boolean;
  readonly videoFilename: string | null;
  readonly retryEligible: boolean;
  readonly error: { readonly title: string; readonly description: string; readonly retryable: boolean };
  readonly run: { readonly id: string; readonly attempt: number; readonly status: string; readonly requestedAt: string; readonly completedAt: string | null; readonly safeErrorCode: string | null };
  readonly attempts: ReadonlyArray<{ readonly id: string; readonly attempt: number; readonly status: string; readonly requestedAt: string; readonly completedAt: string | null; readonly safeErrorCode: string | null }>;
}

function AdminJobsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("search") ?? "";
  const [jobs, setJobs] = useState<readonly AdminJob[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setJobs(null);
    try {
      const response = await fetch("/api/admin/jobs", { cache: "no-store" });
      if (handleProtectedResponse(response, router, "/admin/jobs")) return;
      if (!response.ok) {
        setError("A temporary problem prevented processing jobs from loading. No job state was changed.");
        return;
      }
      const projection = (await response.json()).jobs as AdminJob[];
      setJobs(projection);
      setSelectedId((current) => current && projection.some((job) => job.run.id === current) ? current : projection[0]?.run.id ?? null);
      setError(null);
    } catch {
      setError("A temporary problem prevented processing jobs from loading. No job state was changed.");
    }
  }, [router]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);
  const visibleJobs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? jobs?.filter((job) => job.childExternalId.toLowerCase().includes(needle) || job.assessmentId.toLowerCase().includes(needle)) ?? [] : jobs ?? [];
  }, [jobs, query]);
  const selected = visibleJobs.find((job) => job.run.id === selectedId) ?? null;

  function searchJobs(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = String(new FormData(event.currentTarget).get("search") ?? "").trim();
    const params = new URLSearchParams();
    if (nextQuery) params.set("search", nextQuery);
    router.replace(params.size > 0 ? `/admin/jobs?${params}` : "/admin/jobs", { scroll: false });
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
    <main className="page-shell admin-jobs-shell">
      <header className="page-heading page-heading-row"><div><span className="eyebrow">Pilot administration</span><h1>Processing jobs</h1><p>Review failed pilot processing and retry only when the source video is available.</p></div><button className="button secondary compact icon-text" onClick={() => void load()} type="button"><RefreshCw aria-hidden="true" size={15} /> Refresh jobs</button></header>
      {success ? <div className="notice success" role="status"><CheckCircle2 aria-hidden="true" size={18} /> {success}<button aria-label="Dismiss message" className="icon-button" onClick={() => setSuccess(null)} type="button"><X aria-hidden="true" size={15} /></button></div> : null}
      {error && jobs ? <div className="notice error" role="alert">{error}<button className="text-button" onClick={() => void load()} type="button">Try again</button></div> : null}
      {!jobs && error ? <PageState description={error} kind="error" title="Processing jobs could not be loaded"><button className="button primary icon-text" onClick={() => void load()} type="button"><RefreshCw aria-hidden="true" size={16} /> Try again</button></PageState> : null}
      {!jobs && !error ? <PageState description="Checking failed and stuck processing attempts." kind="loading" title="Loading processing jobs" /> : null}
      {jobs?.length === 0 ? <PageState description="There are no failed or stuck jobs requiring Admin follow-up." kind="empty" title="No failed or stuck jobs"><button className="button secondary icon-text" onClick={() => void load()} type="button"><RefreshCw aria-hidden="true" size={16} /> Refresh jobs</button></PageState> : null}
      {jobs && jobs.length > 0 ? <>
        <div className="list-toolbar"><div className="filter-chip"><AlertCircle aria-hidden="true" size={15} /> Failed and stuck</div><form className="search-field" onSubmit={searchJobs}><Search aria-hidden="true" size={16} /><label className="sr-only" htmlFor="job-search">Search jobs</label><input defaultValue={query} id="job-search" key={query} name="search" placeholder="Search assessment or child" type="search" /><button className="icon-button" title="Search" type="submit"><ArrowRight aria-hidden="true" size={15} /><span className="sr-only">Search</span></button></form></div>
        <div className="jobs-layout">
          <section className="jobs-table" aria-label="Failed processing jobs"><div className="jobs-table-header" aria-hidden="true"><span>Assessment</span><span>Child</span><span>Status</span><span>Safe category</span><span>Last changed</span></div>{visibleJobs.length === 0 ? <p className="empty-line">No processing jobs match this search.</p> : visibleJobs.map((job) => { const stuck = job.run.safeErrorCode === "PROCESSING_STUCK"; return <button className={selectedId === job.run.id ? "selected" : ""} key={job.run.id} onClick={() => setSelectedId(job.run.id)} type="button"><span><strong>{job.assessmentId.slice(-8).toUpperCase()}</strong><small>{formatDate(job.observationDate)}</small></span><span>{job.childExternalId}</span><span><span className={`status-pill ${stuck ? "status-processing" : "status-failed"}`}><AlertCircle aria-hidden="true" size={13} /> {stuck ? "Stuck" : "Failed"}</span></span><span>{job.run.safeErrorCode ?? "ANALYSIS_FAILED"}</span><span>{formatDateTime(job.run.completedAt ?? job.run.requestedAt)}</span></button>; })}</section>
          {selected ? <aside className="job-details" aria-labelledby="job-details-title"><header><div><span className="eyebrow">Assessment {selected.assessmentId.slice(-8).toUpperCase()}</span><h2 id="job-details-title">{selected.error.title}</h2></div><button aria-label="Close job details" className="icon-button" onClick={() => setSelectedId(null)} type="button"><X aria-hidden="true" /></button></header><p>{selected.error.description}</p><dl><div><dt>Child</dt><dd>{selected.childExternalId}</dd></div><div><dt>Observation</dt><dd>{formatDate(selected.observationDate)}</dd></div><div><dt>Safe category</dt><dd>{selected.run.safeErrorCode ?? "ANALYSIS_FAILED"}</dd></div><div><dt>Video</dt><dd className={selected.videoAvailable ? "success-text" : "danger-text"}>{selected.videoAvailable ? <><FileVideo2 aria-hidden="true" size={14} /> Available</> : "Unavailable"}</dd></div></dl><section className="attempt-history"><h3>Attempt history</h3>{selected.attempts.map((attempt) => <div key={attempt.id}><span className={attempt.status === "FAILED" ? "attempt-dot failed" : "attempt-dot"} /><span><strong>Attempt {attempt.attempt} · {attempt.status.toLowerCase()}</strong><small><Clock3 aria-hidden="true" size={12} /> {formatDateTime(attempt.completedAt ?? attempt.requestedAt)}</small></span></div>)}</section><div className="notice info"><ShieldAlert aria-hidden="true" size={17} /> Technical details remain in protected server logs.</div><button className="button primary icon-text" disabled={!selected.retryEligible || retrying} onClick={() => setConfirmOpen(true)} type="button"><RefreshCw aria-hidden="true" size={16} /> {retrying ? "Retrying..." : "Retry processing"}</button></aside> : null}
        </div>
      </> : null}
      <ConfirmDialog confirmLabel="Retry processing" description={selected ? `Create a new processing attempt for ${selected.childExternalId} using the existing private video?` : ""} details={["The previous attempt remains in history", "A new attempt number will be created", "Educator review work is not overwritten"]} onCancel={() => setConfirmOpen(false)} onConfirm={() => void retry()} open={confirmOpen} pending={retrying} title="Retry processing?" tone="primary" />
    </main>
  );
}

export default function AdminJobsPage() {
  return <Suspense fallback={<main className="page-shell"><PageState description="Checking failed and stuck processing attempts." kind="loading" title="Loading processing jobs" /></main>}><AdminJobsContent /></Suspense>;
}
