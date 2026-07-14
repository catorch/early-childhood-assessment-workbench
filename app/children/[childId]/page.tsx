"use client";

import { ArrowLeft, ArrowRight, CalendarDays, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { PageState } from "@/components/page-state";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { backLinkClass, Eyebrow, PageShell } from "@/components/ui/app-patterns";
import { Button } from "@/components/ui/button";
import { handleProtectedResponse } from "@/lib/help-review/client-http";
import type { PilotAssessment, PilotChild } from "@/lib/help-review/models";
import { assessmentActionLabel, assessmentDestination, assessmentStatusPresentation, formatDate, formatDateTime } from "@/lib/help-review/presentation";

export default function ChildPage() {
  const { childId } = useParams<{ childId: string }>();
  const router = useRouter();
  const [data, setData] = useState<{ child: PilotChild; assessments: PilotAssessment[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setData(null);
    setError(null);
    try {
      const response = await fetch(`/api/children/${childId}`, { cache: "no-store" });
      if (handleProtectedResponse(response, router, `/children/${childId}`)) return;
      if (!response.ok) return setError("A temporary problem prevented this child record from loading.");
      setData(await response.json());
    } catch {
      setError("A temporary problem prevented this child record from loading.");
    }
  }, [childId, router]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  if (error) return <PageShell><PageState description={error} kind="error" title="Child record could not be loaded"><Button onClick={() => void load()} type="button"><RefreshCw aria-hidden="true" size={16} /> Try again</Button></PageState></PageShell>;
  if (!data) return <PageShell><div className="mt-9 border-t border-border py-8 text-muted-foreground" role="status">Loading child record...</div></PageShell>;

  return (
    <PageShell>
      <Link className={backLinkClass} href="/children"><ArrowLeft aria-hidden="true" size={16} /> Assigned children</Link>
      <header className="flex items-center justify-between gap-6 border-b border-border pb-8 max-sm:items-start max-sm:flex-col">
        <div>
          <Eyebrow>Assigned child</Eyebrow>
          <h1 className="mt-1 font-heading text-4xl font-bold leading-tight text-ink max-sm:text-[30px]">{data.child.externalChildId}</h1>
          <div className="mt-3.5 flex gap-2"><span className="rounded border border-border bg-surface px-2 py-1 text-xs text-muted-foreground">{data.child.ageMonths} months</span>{data.child.contextLabel ? <span className="rounded border border-border bg-surface px-2 py-1 text-xs text-muted-foreground">{data.child.contextLabel}</span> : null}</div>
        </div>
        {data.child.processingAllowed ? <Button asChild><Link href={`/assessments/new?childId=${data.child.id}`}><Plus aria-hidden="true" size={17} /> Upload observation</Link></Button> : <Button aria-describedby="permission" disabled type="button"><Plus aria-hidden="true" size={17} /> Upload observation</Button>}
      </header>
      {!data.child.processingAllowed ? (
        <Alert className="mt-7" id="permission" variant="warning"><ShieldAlert aria-hidden="true" size={19} /><AlertDescription>Processing permission is not approved. Contact the pilot administrator before uploading.</AlertDescription></Alert>
      ) : null}
      <section className="mt-10" aria-labelledby="assessment-history-title">
        <div className="mb-4 flex items-end justify-between gap-5"><div><Eyebrow>History</Eyebrow><h2 className="mt-1 font-heading text-2xl font-bold" id="assessment-history-title">Assessments</h2></div><span className="text-[13px] text-muted-foreground">{data.assessments.length} total</span></div>
        {data.assessments.length === 0 ? <div className="border-t border-border py-7 text-muted-foreground">No observations have been started for this child.</div> : (
          <div className="border-t border-border">
            {data.assessments.map((assessment) => (
              <Link href={assessmentDestination(assessment)} className="grid min-h-[76px] grid-cols-[auto_1fr_auto_auto] items-center gap-3.5 border-b border-border px-2 py-3 no-underline hover:bg-surface max-sm:grid-cols-[auto_1fr_auto]" key={assessment.id}>
                <CalendarDays aria-hidden="true" className="text-primary" size={18} />
                <span className="grid gap-1"><strong>Observation {formatDate(assessment.observationDate)}</strong><small className="text-xs text-muted-foreground">Updated {formatDateTime(assessment.updatedAt)}</small></span>
                <StatusBadge status={assessment.status} label={assessmentStatusPresentation[assessment.status].label} />
                <span className="inline-flex items-center gap-1 text-sm font-bold text-primary-strong max-sm:sr-only">{assessmentActionLabel(assessment)} <ArrowRight aria-hidden="true" size={18} /></span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
