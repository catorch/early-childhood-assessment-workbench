"use client";

import { ArrowRight, CalendarDays, ClipboardList, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { PageState } from "@/components/page-state";
import { StatusBadge } from "@/components/status-badge";
import { Eyebrow, PageShell } from "@/components/ui/app-patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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
    <PageShell>
      <header className="flex items-end justify-between gap-6 max-sm:items-start max-sm:flex-col">
        <div><Eyebrow>Educator workspace</Eyebrow><h1 className="mt-1 font-heading text-4xl font-bold leading-tight max-sm:text-[30px]">Assessments</h1><p className="mt-2.5 leading-relaxed text-muted-foreground">Continue active observations or reopen finalized records.</p></div>
        <Button asChild><Link href="/children">Start from a child</Link></Button>
      </header>
      <div className="mt-7 flex items-center justify-between gap-4 border-y border-border py-4 max-sm:items-stretch max-sm:flex-col">
        <div className="inline-flex overflow-hidden rounded-md border border-border bg-surface-soft max-sm:w-full" aria-label="Assessment status filter" role="group">
          {(["active", "finalized", "all"] as const).map((option) => <button aria-pressed={filter === option} className={cn("min-h-9 border-r border-border px-3 py-1.5 text-xs font-extrabold capitalize text-muted-foreground last:border-r-0 hover:bg-surface hover:text-navy max-sm:flex-1", filter === option && "bg-surface text-navy shadow-[inset_0_-3px_0_var(--primary)]")} key={option} onClick={() => selectFilter(option)} type="button">{option}</button>)}
        </div>
        <form className="flex w-[320px] items-center gap-2 rounded-md border border-border-strong bg-surface px-2.5 focus-within:ring-3 focus-within:ring-ring/25 max-sm:w-full" onSubmit={search}>
          <Search aria-hidden="true" size={17} /><label className="sr-only" htmlFor="assessment-search">Search assessments</label>
          <Input className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" defaultValue={query} id="assessment-search" key={query} name="search" placeholder="Search child ID" type="search" />
          <Button aria-label="Search" size="icon-xs" title="Search" type="submit" variant="ghost"><ArrowRight aria-hidden="true" size={17} /></Button>
        </form>
      </div>

      {error ? <PageState description={error} kind="error" title="Assessments could not be loaded"><Button onClick={() => void load()} type="button"><RefreshCw aria-hidden="true" size={16} /> Try again</Button></PageState> : null}
      {assessments === null && !error ? <PageState description="Loading your authorized assessment records." kind="loading" title="Loading assessments" /> : null}
      {assessments?.length === 0 ? <PageState description="No assessments match this filter. Start from an assigned child when you are ready." kind="empty" title="No matching assessments"><Button asChild variant="secondary"><Link href="/children">View assigned children</Link></Button></PageState> : null}
      {assessments && assessments.length > 0 ? (
        <section className="mt-6 overflow-hidden rounded-md border border-border bg-surface" aria-label="Assessments">
          <div className="grid grid-cols-[minmax(160px,1fr)_125px_130px_85px_minmax(140px,.8fr)_auto] gap-3 border-b border-border bg-surface-soft px-4 py-2.5 text-[10px] font-extrabold uppercase text-muted-foreground max-lg:grid-cols-[minmax(160px,1fr)_125px_130px_85px_minmax(140px,.8fr)] max-lg:[&>span:last-child]:hidden max-md:hidden" aria-hidden="true"><span>Child</span><span>Observation</span><span>Status</span><span>Progress</span><span>Updated</span><span>Action</span></div>
          {assessments.map((assessment) => {
            const status = assessmentStatusPresentation[assessment.status];
            return (
              <article className="grid min-h-[76px] grid-cols-[minmax(160px,1fr)_125px_130px_85px_minmax(140px,.8fr)_auto] items-center gap-3 border-b border-border px-4 py-3 text-[13px] last:border-b-0 hover:bg-surface-soft max-lg:grid-cols-[minmax(160px,1fr)_125px_130px_85px_minmax(140px,.8fr)] max-lg:[&>span:last-child]:col-span-full max-lg:[&>span:last-child]:justify-self-end max-md:grid-cols-2 max-md:gap-2.5 max-sm:grid-cols-1" key={assessment.id}>
                <span className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-full bg-accent text-primary"><ClipboardList aria-hidden="true" className="size-4" /></span><span className="grid gap-1"><strong>{assessment.childExternalId}</strong><small className="text-muted-foreground">{assessment.childAgeMonths} months</small></span></span>
                <span className="flex items-center gap-1.5 text-muted-foreground max-sm:before:min-w-[78px] max-sm:before:text-[10px] max-sm:before:font-extrabold max-sm:before:uppercase max-sm:before:content-['Observation']"><CalendarDays aria-hidden="true" size={14} /> {formatDate(assessment.observationDate)}</span>
                <span className="max-sm:flex max-sm:items-center max-sm:before:min-w-[78px] max-sm:before:text-[10px] max-sm:before:font-extrabold max-sm:before:text-muted-foreground max-sm:before:uppercase max-sm:before:content-['Status']"><StatusBadge status={assessment.status} label={status.label} /></span>
                <span className="text-muted-foreground max-sm:flex max-sm:before:min-w-[78px] max-sm:before:text-[10px] max-sm:before:font-extrabold max-sm:before:uppercase max-sm:before:content-['Progress']">{assessment.progress ? `${assessment.progress.actioned} of ${assessment.progress.total}` : "-"}</span>
                <span className="text-muted-foreground max-sm:flex max-sm:before:min-w-[78px] max-sm:before:text-[10px] max-sm:before:font-extrabold max-sm:before:uppercase max-sm:before:content-['Updated']">{formatDateTime(assessment.updatedAt)}</span>
                <span className="flex justify-end max-sm:justify-stretch"><Button asChild className="max-sm:w-full" size="sm" variant="secondary"><Link href={assessment.actionHref}>{assessment.actionLabel} <ArrowRight aria-hidden="true" size={15} /></Link></Button></span>
              </article>
            );
          })}
        </section>
      ) : null}
    </PageShell>
  );
}

export default function AssessmentsPage() {
  return <Suspense fallback={<PageShell><PageState description="Loading your authorized assessment records." kind="loading" title="Loading assessments" /></PageShell>}><AssessmentsContent /></Suspense>;
}
