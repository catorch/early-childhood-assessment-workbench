"use client";

import { ArrowRight, CalendarDays, CircleCheck, Clock3, Plus, RefreshCw, Search, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PageState } from "@/components/page-state";
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
    <main className="page-shell">
      <header className="page-heading page-heading-row">
        <div>
          <span className="eyebrow">Educator workspace</span>
          <h1>Assigned children</h1>
          <p>Only children currently assigned to you are shown.</p>
        </div>
        {children ? <span className="quiet-count">{children.length} assigned</span> : null}
      </header>

      {children && children.length > 0 ? (
        <label className="search-field" htmlFor="child-search">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">Search assigned children</span>
          <input id="child-search" onChange={(event) => setQuery(event.target.value)} placeholder="Search assigned children" type="search" value={query} />
        </label>
      ) : null}

      {error ? (
        <PageState description={error} kind="error" title="Children could not be loaded">
          <button className="button primary icon-text" onClick={() => void load()} type="button"><RefreshCw aria-hidden="true" size={16} /> Try again</button>
          <button className="button secondary" onClick={() => void signOut()} type="button">Sign out</button>
        </PageState>
      ) : null}
      {children === null && !error ? <PageState description="Checking your active child assignments." kind="loading" title="Loading assigned children" /> : null}
      {children?.length === 0 ? (
        <PageState description="Contact the pilot administrator to request an assignment, then refresh this page." kind="empty" title="No assigned children">
          <button className="button secondary icon-text" onClick={() => void load()} type="button"><RefreshCw aria-hidden="true" size={16} /> Refresh assignments</button>
        </PageState>
      ) : null}
      {children && children.length > 0 && visibleChildren.length === 0 ? (
        <PageState compact description="Try a different child identifier." kind="empty" title="No matching children" />
      ) : null}

      <section className="child-list" aria-label="Assigned children">
        {visibleChildren.map((child) => {
          const latest = child.assessments[0];
          const status = latest ? assessmentStatusPresentation[latest.status] : null;
          const emptyActionLabel = child.processingAllowed ? "Upload observation" : "View permission";
          return (
            <article className="child-row" key={child.id}>
              <div className="child-avatar" aria-hidden="true">{child.externalChildId.split(" ").at(-1)?.slice(-2)}</div>
              <div className="child-identity">
                <h2><Link href={`/children/${child.id}`}>{child.externalChildId}</Link></h2>
                <p>{child.ageMonths} months{child.contextLabel ? ` · ${child.contextLabel}` : ""}</p>
              </div>
              <div className="child-status">
                {latest && status ? (
                  <>
                    <span className={`status-pill status-${latest.status.toLowerCase()}`}>
                      {latest.status === "FINALIZED" ? <CircleCheck aria-hidden="true" size={14} /> : <Clock3 aria-hidden="true" size={14} />}
                      {status.label}
                    </span>
                    <small><CalendarDays aria-hidden="true" size={13} /> {formatDate(latest.observationDate)}</small>
                  </>
                ) : <span className="muted-label">No assessments yet</span>}
              </div>
              <div className="row-actions">
                <Link className="button secondary icon-text" href={latest?.actionHref ?? `/assessments/new?childId=${child.id}`} title={latest?.actionLabel ?? emptyActionLabel}>
                  {latest ? <ArrowRight aria-hidden="true" size={16} /> : child.processingAllowed ? <Plus aria-hidden="true" size={16} /> : <ShieldAlert aria-hidden="true" size={16} />}
                  {latest?.actionLabel ?? emptyActionLabel}
                </Link>
                <Link className="icon-button" href={`/children/${child.id}`} title={`Open ${child.externalChildId}`}>
                  <ArrowRight aria-hidden="true" size={19} /><span className="sr-only">Open child</span>
                </Link>
              </div>
            </article>
          );
        })}
      </section>
      {children && children.length > 0 ? <p className="support-note">Missing an assignment? <a href="mailto:pilot-support@example.test">Contact your pilot administrator.</a></p> : null}
    </main>
  );
}
