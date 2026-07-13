"use client";

import { ArrowLeft, ArrowRight, CalendarDays, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { PageState } from "@/components/page-state";
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

  if (error) return <main className="page-shell"><PageState description={error} kind="error" title="Child record could not be loaded"><button className="button primary icon-text" onClick={() => void load()} type="button"><RefreshCw aria-hidden="true" size={16} /> Try again</button></PageState></main>;
  if (!data) return <main className="page-shell"><div className="loading-block" role="status">Loading child record...</div></main>;

  return (
    <main className="page-shell">
      <Link className="back-link" href="/children"><ArrowLeft aria-hidden="true" size={16} /> Assigned children</Link>
      <header className="child-detail-header">
        <div>
          <span className="eyebrow">Assigned child</span>
          <h1>{data.child.externalChildId}</h1>
          <div className="detail-meta"><span>{data.child.ageMonths} months</span>{data.child.contextLabel ? <span>{data.child.contextLabel}</span> : null}</div>
        </div>
        {data.child.processingAllowed ? <Link className="button primary icon-text" href={`/assessments/new?childId=${data.child.id}`}><Plus aria-hidden="true" size={17} /> Upload observation</Link> : <button aria-describedby="permission" className="button primary icon-text" disabled type="button"><Plus aria-hidden="true" size={17} /> Upload observation</button>}
      </header>
      {!data.child.processingAllowed ? (
        <div className="notice warning" id="permission"><ShieldAlert aria-hidden="true" size={19} /><span>Processing permission is not approved. Contact the pilot administrator before uploading.</span></div>
      ) : null}
      <section className="section-block" aria-labelledby="assessment-history-title">
        <div className="section-heading"><div><span className="eyebrow">History</span><h2 id="assessment-history-title">Assessments</h2></div><span>{data.assessments.length} total</span></div>
        {data.assessments.length === 0 ? <div className="empty-line">No observations have been started for this child.</div> : (
          <div className="assessment-table">
            {data.assessments.map((assessment) => (
              <Link href={assessmentDestination(assessment)} className="assessment-row" key={assessment.id}>
                <CalendarDays aria-hidden="true" size={18} />
                <span><strong>Observation {formatDate(assessment.observationDate)}</strong><small>Updated {formatDateTime(assessment.updatedAt)}</small></span>
                <span className={`status-pill status-${assessment.status.toLowerCase()}`}>{assessmentStatusPresentation[assessment.status].label}</span>
                <span className="assessment-row-action">{assessmentActionLabel(assessment)} <ArrowRight aria-hidden="true" size={18} /></span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
