"use client";

import { ArrowRight, CalendarDays, ClipboardList, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { PageState } from "@/components/page-state";
import { handleProtectedResponse } from "@/lib/help-review/client-http";
import type { EducatorAssessmentProjection } from "@/lib/help-review/models";
import { assessmentStatusPresentation, formatDate, formatDateTime } from "@/lib/help-review/presentation";

type AssessmentFilter = "active" | "finalized" | "all";

function AssessmentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedFilter = searchParams.get("filter");
  const filter: AssessmentFilter = requestedFilter === "finalized" || requestedFilter === "all" ? requestedFilter : "active";
  const query = searchParams.get("search") ?? "";
  const [assessments, setAssessments] = useState<readonly EducatorAssessmentProjection[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setAssessments(null);
    setError(null);
    const params = new URLSearchParams({ filter });
    if (query.trim()) params.set("search", query.trim());
    try {
      const response = await fetch(`/api/assessments?${params}`, { cache: "no-store" });
      if (handleProtectedResponse(response, router, `/assessments?${params}`)) return;
      if (!response.ok) {
        setError("A temporary problem prevented assessments from loading.");
        return;
      }
      setAssessments((await response.json()).assessments as EducatorAssessmentProjection[]);
    } catch {
      setError("A temporary problem prevented assessments from loading.");
    }
  }, [filter, query, router]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  function selectFilter(next: AssessmentFilter) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("filter", next);
    router.replace(`/assessments?${params}`, { scroll: false });
  }

  function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = String(new FormData(event.currentTarget).get("search") ?? "").trim();
    const params = new URLSearchParams(searchParams.toString());
    params.set("filter", filter);
    if (nextQuery) params.set("search", nextQuery);
    else params.delete("search");
    router.replace(`/assessments?${params}`, { scroll: false });
  }

  return (
    <main className="page-shell">
      <header className="page-heading page-heading-row">
        <div><span className="eyebrow">Educator workspace</span><h1>Assessments</h1><p>Continue active observations or reopen finalized records.</p></div>
        <Link className="button primary" href="/children">Start from a child</Link>
      </header>
      <div className="list-toolbar">
        <div className="segmented-control" aria-label="Assessment status filter" role="group">
          {(["active", "finalized", "all"] as const).map((option) => <button aria-pressed={filter === option} className={filter === option ? "selected" : ""} key={option} onClick={() => selectFilter(option)} type="button">{option[0].toUpperCase() + option.slice(1)}</button>)}
        </div>
        <form className="search-field" onSubmit={search}>
          <Search aria-hidden="true" size={17} /><label className="sr-only" htmlFor="assessment-search">Search assessments</label>
          <input defaultValue={query} id="assessment-search" key={query} name="search" placeholder="Search child ID" type="search" />
          <button className="icon-button" title="Search" type="submit"><ArrowRight aria-hidden="true" size={17} /><span className="sr-only">Search</span></button>
        </form>
      </div>

      {error ? <PageState description={error} kind="error" title="Assessments could not be loaded"><button className="button primary icon-text" onClick={() => void load()} type="button"><RefreshCw aria-hidden="true" size={16} /> Try again</button></PageState> : null}
      {assessments === null && !error ? <PageState description="Loading your authorized assessment records." kind="loading" title="Loading assessments" /> : null}
      {assessments?.length === 0 ? <PageState description="No assessments match this filter. Start from an assigned child when you are ready." kind="empty" title="No matching assessments"><Link className="button secondary" href="/children">View assigned children</Link></PageState> : null}
      {assessments && assessments.length > 0 ? (
        <section className="assessment-index" aria-label="Assessments">
          <div className="assessment-index-header" aria-hidden="true"><span>Child</span><span>Observation</span><span>Status</span><span>Progress</span><span>Updated</span><span>Action</span></div>
          {assessments.map((assessment) => {
            const status = assessmentStatusPresentation[assessment.status];
            return (
              <article className="assessment-index-row" key={assessment.id}>
                <span className="assessment-child"><span className="table-icon"><ClipboardList aria-hidden="true" /></span><span><strong>{assessment.childExternalId}</strong><small>{assessment.childAgeMonths} months</small></span></span>
                <span><CalendarDays aria-hidden="true" size={14} /> {formatDate(assessment.observationDate)}</span>
                <span><span className={`status-pill status-${assessment.status.toLowerCase()}`}>{status.label}</span></span>
                <span>{assessment.progress ? `${assessment.progress.actioned} of ${assessment.progress.total}` : "-"}</span>
                <span>{formatDateTime(assessment.updatedAt)}</span>
                <span><Link className="button secondary compact" href={assessment.actionHref}>{assessment.actionLabel} <ArrowRight aria-hidden="true" size={15} /></Link></span>
              </article>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}

export default function AssessmentsPage() {
  return <Suspense fallback={<main className="page-shell"><PageState description="Loading your authorized assessment records." kind="loading" title="Loading assessments" /></main>}><AssessmentsContent /></Suspense>;
}
