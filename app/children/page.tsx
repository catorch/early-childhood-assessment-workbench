"use client";

import { ArrowRight, CalendarDays, CircleCheck, Clock3, Plus, RefreshCw, Search, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PageState } from "@/components/page-state";
import { StatusBadge } from "@/components/status-badge";
import { Eyebrow, PageShell } from "@/components/ui/app-patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { handleProtectedResponse } from "@/lib/help-review/client-http";
import type { AssignedChildProjection } from "@/lib/help-review/models";
import { assessmentStatusPresentation, formatDate } from "@/lib/help-review/presentation";

export default function ChildrenPage() {
  const router = useRouter();
  const [children, setChildren] = useState<readonly AssignedChildProjection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setChildren(null);
    setError(null);
    try {
      const response = await fetch("/api/children", { cache: "no-store" });
      if (handleProtectedResponse(response, router, "/children")) return;
      if (!response.ok) {
        setError("A temporary problem prevented this list from loading. No access or assessment data was changed.");
        return;
      }
      setChildren((await response.json()).children as AssignedChildProjection[]);
    } catch {
      setError("A temporary problem prevented this list from loading. No access or assessment data was changed.");
    }
  }, [router]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const visibleChildren = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized
      ? children?.filter((child) => child.externalChildId.toLowerCase().includes(normalized)) ?? []
      : children ?? [];
  }, [children, query]);

  async function signOut() {
    try {
      await fetch("/api/session", { method: "DELETE" });
    } finally {
      router.replace("/sign-in");
      router.refresh();
    }
  }

  return (
    <PageShell>
      <header className="flex items-end justify-between gap-6 max-sm:items-start max-sm:flex-col">
        <div>
          <Eyebrow>Educator workspace</Eyebrow>
          <h1 className="mt-1 font-heading text-4xl font-normal leading-tight text-ink max-sm:text-[30px]">Assigned children</h1>
          <p className="mt-2.5 leading-relaxed text-muted-foreground">Only children currently assigned to you are shown.</p>
        </div>
        {children ? <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] font-bold text-muted-foreground max-sm:hidden">{children.length} assigned</span> : null}
      </header>

      {children && children.length > 0 ? (
        <label className="mt-7 flex w-full max-w-[420px] items-center gap-2 rounded-md border border-border-strong bg-surface px-3 focus-within:ring-3 focus-within:ring-ring/25" htmlFor="child-search">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">Search assigned children</span>
          <Input className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" id="child-search" onChange={(event) => setQuery(event.target.value)} placeholder="Search assigned children" type="search" value={query} />
        </label>
      ) : null}

      {error ? (
        <PageState description={error} kind="error" title="Children could not be loaded">
          <Button onClick={() => void load()} type="button"><RefreshCw aria-hidden="true" size={16} /> Try again</Button>
          <Button onClick={() => void signOut()} type="button" variant="secondary">Sign out</Button>
        </PageState>
      ) : null}
      {children === null && !error ? <PageState description="Checking your active child assignments." kind="loading" title="Loading assigned children" /> : null}
      {children?.length === 0 ? (
        <PageState description="Contact the pilot administrator to request an assignment, then refresh this page." kind="empty" title="No assigned children">
          <Button onClick={() => void load()} type="button" variant="secondary"><RefreshCw aria-hidden="true" size={16} /> Refresh assignments</Button>
        </PageState>
      ) : null}
      {children && children.length > 0 && visibleChildren.length === 0 ? (
        <PageState compact description="Try a different child identifier." kind="empty" title="No matching children" />
      ) : null}

      <section className="mt-9 grid border-t border-border" aria-label="Assigned children">
        {visibleChildren.map((child) => {
          const latest = child.assessments[0];
          const status = latest ? assessmentStatusPresentation[latest.status] : null;
          const emptyActionLabel = child.processingAllowed ? "Upload observation" : "View permission";
          return (
            <article className="grid min-h-[104px] grid-cols-[50px_minmax(180px,1fr)_minmax(170px,.8fr)_auto] items-center gap-4 border-b border-border px-2 py-[18px] max-md:grid-cols-[46px_1fr_auto] max-sm:grid-cols-[42px_minmax(0,1fr)_auto] max-sm:gap-2.5 max-sm:px-0 max-sm:py-4" key={child.id}>
              <div className="grid size-[46px] place-items-center rounded-full border border-[#b8d8d3] bg-accent text-[13px] font-extrabold text-primary-strong max-sm:size-10" aria-hidden="true">{child.externalChildId.split(" ").at(-1)?.slice(-2)}</div>
              <div>
                <h2 className="m-0 text-[17px] font-bold"><Link className="hover:text-primary hover:underline hover:underline-offset-4" href={`/children/${child.id}`}>{child.externalChildId}</Link></h2>
                <p className="mt-1.5 text-[13px] text-muted-foreground">{child.ageMonths} months{child.contextLabel ? ` · ${child.contextLabel}` : ""}</p>
              </div>
              <div className="grid justify-items-start gap-1.5 max-md:col-start-2 max-md:row-start-2 max-sm:flex max-sm:flex-wrap max-sm:items-center">
                {latest && status ? (
                  <>
                    <StatusBadge status={latest.status} label={status.label}>
                      {latest.status === "FINALIZED" ? <CircleCheck aria-hidden="true" size={14} /> : <Clock3 aria-hidden="true" size={14} />}
                    </StatusBadge>
                    <small className="flex items-center gap-1 text-muted-foreground"><CalendarDays aria-hidden="true" size={13} /> {formatDate(latest.observationDate)}</small>
                  </>
                ) : <span className="text-[13px] text-muted-foreground">No assessments yet</span>}
              </div>
              <div className="flex items-center gap-2 max-md:col-start-3 max-md:row-span-2 max-md:row-start-1">
                <Button asChild className="max-md:size-10 max-md:p-0" variant="secondary"><Link href={latest?.actionHref ?? `/assessments/new?childId=${child.id}`} title={latest?.actionLabel ?? emptyActionLabel}>{latest ? <ArrowRight aria-hidden="true" size={16} /> : child.processingAllowed ? <Plus aria-hidden="true" size={16} /> : <ShieldAlert aria-hidden="true" size={16} />}<span className="max-md:sr-only">{latest?.actionLabel ?? emptyActionLabel}</span></Link></Button>
                <Button asChild className="max-md:hidden" size="icon" variant="outline"><Link aria-label={`Open ${child.externalChildId}`} href={`/children/${child.id}`}><ArrowRight aria-hidden="true" size={19} /></Link></Button>
              </div>
            </article>
          );
        })}
      </section>
      {children && children.length > 0 ? <p className="mt-6 text-[13px] text-muted-foreground">Missing an assignment? <a className="font-bold text-primary-strong underline-offset-4 hover:underline" href="mailto:pilot-support@example.test">Contact your pilot administrator.</a></p> : null}
    </PageShell>
  );
}
