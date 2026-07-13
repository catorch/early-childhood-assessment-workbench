"use client";

import { ArrowLeft, CheckCircle2, ClipboardCheck, LockKeyhole, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageState } from "@/components/page-state";
import { handleProtectedResponse, responseError } from "@/lib/help-review/client-http";
import type { PrimaryCredit, ReviewSummary, SavedReviewDecision, SkillSuggestion } from "@/lib/help-review/domain";
import type { PilotChild } from "@/lib/help-review/models";
import { formatDate, formatDateTime } from "@/lib/help-review/presentation";

interface SummaryProjection {
  readonly assessment: { readonly id: string; readonly observationDate: string; readonly status: string; readonly finalizedAt: string | null; readonly finalizedBy?: string | null; readonly revision: number };
  readonly child: PilotChild;
  readonly suggestions: SkillSuggestion[];
  readonly decisions: SavedReviewDecision[];
  readonly summary: ReviewSummary;
}

const credits: Array<{ key: PrimaryCredit; label: string; symbol: string }> = [
  { key: "PRESENT", label: "Present", symbol: "+" },
  { key: "EMERGING", label: "Emerging", symbol: "+/-" },
  { key: "NOT_OBSERVED", label: "Not observed", symbol: "-" },
  { key: "NOT_APPLICABLE", label: "Not applicable", symbol: "N/A" }
];

const originLabels = {
  ACCEPTED: "Accepted draft",
  OVERRIDDEN: "Overridden",
  SCORED_INDEPENDENTLY: "Scored independently",
  DISMISSED: "Dismissed"
} as const;

export function AssessmentSummary({ finalView }: { readonly finalView: boolean }) {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const router = useRouter();
  const [data, setData] = useState<SummaryProjection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const finalizationRequestId = useRef<string | null>(null);

  const load = useCallback(async () => {
    const endpoint = finalView ? "final" : "review";
    setError(null);
    try {
      const response = await fetch(`/api/assessments/${assessmentId}/${endpoint}`, { cache: "no-store" });
      if (handleProtectedResponse(response, router, `/assessments/${assessmentId}/${finalView ? "final" : "summary"}`)) return;
      if (response.status === 409) {
        return router.replace(finalView ? `/assessments/${assessmentId}/summary` : `/assessments/${assessmentId}/processing`);
      }
      if (!response.ok) return setError("A temporary problem prevented this assessment summary from loading.");
      const projection = await response.json() as SummaryProjection;
      if (finalView && projection.assessment.status !== "FINALIZED") return router.replace(`/assessments/${assessmentId}/summary`);
      if (!finalView && projection.assessment.status === "FINALIZED") return router.replace(`/assessments/${assessmentId}/final`);
      setData(projection);
    } catch {
      setError("A temporary problem prevented this assessment summary from loading.");
    }
  }, [assessmentId, finalView, router]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  async function finalize() {
    setFinalizing(true);
    setConfirmOpen(false);
    setError(null);
    let response: Response;
    try {
      response = await fetch(`/api/assessments/${assessmentId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedRevision: data?.assessment.revision ?? 0,
          requestId: (finalizationRequestId.current ??= window.crypto.randomUUID())
        })
      });
    } catch {
      setError("The network interrupted final confirmation. Refresh to check the current record before trying again.");
      setFinalizing(false);
      return;
    }
    if (handleProtectedResponse(response, router, `/assessments/${assessmentId}/summary`)) {
      setFinalizing(false);
      return;
    }
    if (!response.ok) {
      setError(await responseError(response, "The assessment could not be finalized."));
      setFinalizing(false);
      return;
    }
    router.push(`/assessments/${assessmentId}/final`);
    router.refresh();
  }

  if (error && !data) return <main className="page-shell"><PageState description={error} kind="error" title="Summary could not be loaded"><button className="button primary" onClick={() => void load()} type="button">Try again</button></PageState></main>;
  if (!data) return <main className="page-shell"><PageState description="Deriving totals from saved educator decisions." kind="loading" title="Loading summary" /></main>;

  const remaining = data.suggestions.filter((suggestion) => !data.decisions.some((decision) => decision.suggestionId === suggestion.id));

  return (
    <main className="summary-page">
      <header className={`summary-hero${finalView ? " final" : ""}`}>
        <div className="summary-hero-inner">
          <span className="summary-mark">{finalView ? <LockKeyhole aria-hidden="true" /> : <ClipboardCheck aria-hidden="true" />}</span>
          <span className="eyebrow">{finalView ? "Human-approved record" : "Pre-final review"}</span>
          <h1>{finalView ? "Assessment finalized" : "Review assessment summary"}</h1>
          <p>{data.child.externalChildId} · {data.child.ageMonths} months · Observation {formatDate(data.assessment.observationDate)}</p>
          {finalView && data.assessment.finalizedAt ? <span className="finalized-stamp"><CheckCircle2 aria-hidden="true" size={16} /> Confirmed {formatDateTime(data.assessment.finalizedAt)}{data.assessment.finalizedBy ? ` by ${data.assessment.finalizedBy}` : ""}</span> : null}
        </div>
      </header>

      <div className="summary-layout">
        {!finalView && remaining.length > 0 ? (
          <section className="remaining-panel" aria-labelledby="remaining-title">
            <div><span className="remaining-count">{remaining.length}</span><span><h2 id="remaining-title">Items still need an action</h2><p>Final confirmation stays locked until each suggestion is scored or dismissed.</p></span></div>
            <ul>{remaining.map((suggestion) => <li key={suggestion.id}><Link href={`/assessments/${assessmentId}/review?skill=${encodeURIComponent(suggestion.id)}`}><span>{suggestion.skillCode}</span>{suggestion.skillName}</Link></li>)}</ul>
            <Link className="button primary icon-text" href={`/assessments/${assessmentId}/review`}><ArrowLeft aria-hidden="true" size={16} /> Return to review</Link>
          </section>
        ) : (
          <section className="ready-panel"><CheckCircle2 aria-hidden="true" /><div><h2>{finalView ? "Final educator decisions" : "All items are actioned"}</h2><p>{finalView ? "This record is read-only." : "Review the totals and included skills before confirming."}</p></div></section>
        )}

        <section className="summary-section" aria-labelledby="credit-totals-title">
          <div className="section-heading"><div><span className="eyebrow">Final scoring</span><h2 id="credit-totals-title">Credit totals</h2></div><span>{data.summary.included.length} included skills</span></div>
          <div className="summary-metrics">
            {credits.map((credit) => <div className={`summary-metric credit-${credit.key.toLowerCase()}`} key={credit.key}><span>{credit.symbol}</span><strong>{data.summary.credits[credit.key]}</strong><small>{credit.label}</small></div>)}
          </div>
        </section>

        <section className="summary-section" aria-labelledby="decision-path-title">
          <div className="section-heading"><div><span className="eyebrow">Human review</span><h2 id="decision-path-title">Decision paths</h2></div></div>
          <div className="origin-grid">
            {Object.entries(originLabels).map(([origin, label]) => <div key={origin}><strong>{data.summary.origins[origin as keyof typeof originLabels]}</strong><span>{label}</span></div>)}
          </div>
        </section>

        <section className="summary-section" aria-labelledby="domain-summary-title">
          <div className="section-heading"><div><span className="eyebrow">By domain</span><h2 id="domain-summary-title">Domain summary</h2></div></div>
          <div className="domain-table" role="table" aria-label="Credits by HELP domain">
            <div className="domain-table-row header" role="row"><span role="columnheader">Domain</span>{credits.map((credit) => <span role="columnheader" key={credit.key}>{credit.symbol}</span>)}</div>
            {data.summary.domains.map((domain) => <div className="domain-table-row" role="row" key={domain.domain}><strong role="cell">{domain.domain}</strong>{credits.map((credit) => <span role="cell" key={credit.key}>{domain.credits[credit.key]}</span>)}</div>)}
          </div>
        </section>

        <section className="summary-section" aria-labelledby="final-skills-title">
          <div className="section-heading"><div><span className="eyebrow">Included record</span><h2 id="final-skills-title">Final skills</h2></div></div>
          <div className="final-skill-list">
            {data.summary.included.map(({ suggestion, decision }) => <article key={suggestion.id}><span className={`final-credit credit-${decision.finalCredit?.toLowerCase()}`}>{credits.find((credit) => credit.key === decision.finalCredit)?.symbol}</span><span><strong><small>{suggestion.skillCode}</small>{suggestion.skillName}</strong><small>{suggestion.domain}{suggestion.strand ? ` · ${suggestion.strand}` : ""}</small>{decision.note ? <p>“{decision.note}”</p> : null}</span><span className="origin-label">{originLabels[decision.origin]}</span></article>)}
          </div>
        </section>

        {data.summary.dismissed.length > 0 ? <section className="summary-section" aria-labelledby="dismissed-skills-title"><div className="section-heading"><div><span className="eyebrow">Excluded from final record</span><h2 id="dismissed-skills-title">Dismissed suggestions</h2></div><span>{data.summary.dismissed.length}</span></div><div className="dismissed-skill-list">{data.summary.dismissed.map(({ suggestion, decision }) => <article key={suggestion.id}><X aria-hidden="true" size={16} /><span><strong><small>{suggestion.skillCode}</small>{suggestion.skillName}</strong><small>{suggestion.domain}</small>{decision.note ? <p>{decision.note}</p> : null}</span></article>)}</div></section> : null}

        <footer className="summary-actions">
          {finalView ? <Link className="button secondary icon-text" href={`/children/${data.child.id}`}><ArrowLeft aria-hidden="true" size={16} /> Return to child</Link> : <>
            <Link className="button secondary icon-text" href={`/assessments/${assessmentId}/review`}><RotateCcw aria-hidden="true" size={16} /> Return to review</Link>
            <button className="button primary icon-text" disabled={remaining.length > 0 || finalizing} onClick={() => setConfirmOpen(true)} type="button"><LockKeyhole aria-hidden="true" size={16} /> {finalizing ? "Confirming..." : "Confirm final assessment"}</button>
          </>}
        </footer>
        {error ? <div className="notice error" role="alert">{error}</div> : null}
      </div>
      <ConfirmDialog confirmLabel="Confirm final assessment" description="This creates the read-only human-approved record. Ordinary review edits will no longer be available." details={[`${data.summary.included.length} included skills`, `${data.summary.dismissed.length} dismissed suggestions`, "All educator decisions will be locked"]} onCancel={() => setConfirmOpen(false)} onConfirm={() => void finalize()} open={confirmOpen} pending={finalizing} title="Finalize this assessment?" tone="primary" />
    </main>
  );
}
