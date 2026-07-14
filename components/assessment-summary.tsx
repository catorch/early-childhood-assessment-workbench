"use client";

import { ArrowLeft, CheckCircle2, ClipboardCheck, LockKeyhole, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageState } from "@/components/page-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eyebrow, PageShell } from "@/components/ui/app-patterns";
import { Button } from "@/components/ui/button";
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

  if (error && !data) return <PageShell><PageState description={error} kind="error" title="Summary could not be loaded"><Button onClick={() => void load()} type="button">Try again</Button></PageState></PageShell>;
  if (!data) return <PageShell><PageState description="Deriving totals from saved educator decisions." kind="loading" title="Loading summary" /></PageShell>;

  const remaining = data.suggestions.filter((suggestion) => !data.decisions.some((decision) => decision.suggestionId === suggestion.id));

  return (
    <main className="min-h-screen bg-canvas">
      <header className={finalView ? "border-b border-success-border bg-success-soft" : "border-b border-border bg-surface"}>
        <div className="mx-auto w-[min(calc(100%_-_40px),960px)] py-11 max-sm:w-[min(calc(100%_-_24px),960px)] max-sm:py-8">
          <span className={finalView ? "mb-4 grid size-12 place-items-center rounded-full bg-success text-white" : "mb-4 grid size-12 place-items-center rounded-full bg-accent text-primary"}>{finalView ? <LockKeyhole aria-hidden="true" /> : <ClipboardCheck aria-hidden="true" />}</span>
          <Eyebrow className={finalView ? "text-success before:bg-success" : undefined}>{finalView ? "Human-approved record" : "Pre-final review"}</Eyebrow>
          <h1 className="mt-1 font-heading text-4xl font-normal leading-tight text-ink max-sm:text-[31px]">{finalView ? "Assessment finalized" : "Review assessment summary"}</h1>
          <p className="mt-2.5 text-muted-foreground">{data.child.externalChildId} · {data.child.ageMonths} months · Observation {formatDate(data.assessment.observationDate)}</p>
          {finalView && data.assessment.finalizedAt ? <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-success-border bg-surface px-3 py-1.5 text-xs font-bold text-success"><CheckCircle2 aria-hidden="true" size={16} /> Confirmed {formatDateTime(data.assessment.finalizedAt)}{data.assessment.finalizedBy ? ` by ${data.assessment.finalizedBy}` : ""}</span> : null}
        </div>
      </header>

      <div className="mx-auto w-[min(calc(100%_-_40px),960px)] py-8 pb-[72px] max-sm:w-[min(calc(100%_-_24px),960px)] max-sm:pt-5">
        {!finalView && remaining.length > 0 ? (
          <section className="border border-warning-border bg-warning-soft p-5" aria-labelledby="remaining-title">
            <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-warning text-lg font-extrabold text-white">{remaining.length}</span><span><h2 className="text-lg font-bold" id="remaining-title">Items still need an action</h2><p className="mt-1 text-sm text-warning-strong">Final confirmation stays locked until each suggestion is scored or dismissed.</p></span></div>
            <ul className="my-4 grid border-t border-warning-border">{remaining.map((suggestion) => <li className="border-b border-warning-border py-2.5" key={suggestion.id}><Link className="font-bold underline decoration-warning underline-offset-4" href={`/assessments/${assessmentId}/review?skill=${encodeURIComponent(suggestion.id)}`}><span className="mr-2 text-xs text-warning-strong">{suggestion.skillCode}</span>{suggestion.skillName}</Link></li>)}</ul>
            <Button asChild><Link href={`/assessments/${assessmentId}/review`}><ArrowLeft aria-hidden="true" size={16} /> Return to review</Link></Button>
          </section>
        ) : (
          <section className="flex items-center gap-3 border-y border-success-border bg-success-soft px-1 py-4 text-success"><CheckCircle2 aria-hidden="true" className="shrink-0" /><div><h2 className="font-bold text-ink">{finalView ? "Final educator decisions" : "All items are actioned"}</h2><p className="mt-1 text-sm text-muted-foreground">{finalView ? "This record is read-only." : "Review the totals and included skills before confirming."}</p></div></section>
        )}

        <SummarySection eyebrow="Final scoring" id="credit-totals-title" meta={`${data.summary.included.length} included skills`} title="Credit totals">
          <div className="grid grid-cols-4 divide-x divide-border rounded-md border border-border bg-surface max-md:grid-cols-2 max-md:divide-x-0">
            {credits.map((credit, index) => <div className="grid min-h-[116px] place-items-center content-center gap-1 p-4 text-center max-md:border-b max-md:border-border max-md:odd:border-r max-md:[&:nth-child(n+3)]:border-b-0" key={credit.key}><span className={creditSymbolClass(credit.key)}>{credit.symbol}</span><strong className="text-2xl">{data.summary.credits[credit.key]}</strong><small className="text-xs text-muted-foreground">{credit.label}</small><span className="sr-only">Position {index + 1}</span></div>)}
          </div>
        </SummarySection>

        <SummarySection eyebrow="Human review" id="decision-path-title" title="Decision paths">
          <div className="grid grid-cols-4 divide-x divide-border rounded-md border border-border bg-surface max-md:grid-cols-2 max-md:divide-x-0">
            {Object.entries(originLabels).map(([origin, label]) => <div className="grid gap-1 p-4 text-center max-md:border-b max-md:border-border max-md:odd:border-r max-md:[&:nth-child(n+3)]:border-b-0" key={origin}><strong className="text-2xl">{data.summary.origins[origin as keyof typeof originLabels]}</strong><span className="text-xs text-muted-foreground">{label}</span></div>)}
          </div>
        </SummarySection>

        <SummarySection eyebrow="By domain" id="domain-summary-title" title="Domain summary">
          <div className="overflow-x-auto rounded-md border border-border" role="table" aria-label="Credits by HELP domain">
            <div className="grid min-w-[560px] grid-cols-[minmax(220px,1fr)_repeat(4,70px)] bg-surface-soft px-4 py-2.5 text-[10px] font-extrabold uppercase text-muted-foreground" role="row"><span role="columnheader">Domain</span>{credits.map((credit) => <span className="text-center" role="columnheader" key={credit.key}>{credit.symbol}</span>)}</div>
            {data.summary.domains.map((domain) => <div className="grid min-w-[560px] grid-cols-[minmax(220px,1fr)_repeat(4,70px)] border-t border-border bg-surface px-4 py-3 text-sm" role="row" key={domain.domain}><strong role="cell">{domain.domain}</strong>{credits.map((credit) => <span className="text-center" role="cell" key={credit.key}>{domain.credits[credit.key]}</span>)}</div>)}
          </div>
        </SummarySection>

        <SummarySection eyebrow="Included record" id="final-skills-title" title="Final skills">
          <div className="border-t border-border">
            {data.summary.included.map(({ suggestion, decision }) => <article className="grid grid-cols-[36px_minmax(0,1fr)_auto] gap-3 border-b border-border px-2 py-3.5 max-sm:grid-cols-[36px_1fr]" key={suggestion.id}><span className={creditSymbolClass(decision.finalCredit)}>{credits.find((credit) => credit.key === decision.finalCredit)?.symbol}</span><span className="grid gap-1"><strong><small className="mr-2 text-muted-foreground">{suggestion.skillCode}</small>{suggestion.skillName}</strong><small className="text-muted-foreground">{suggestion.domain}{suggestion.strand ? ` · ${suggestion.strand}` : ""}</small>{decision.note ? <p className="mt-1 text-sm italic text-muted-foreground">“{decision.note}”</p> : null}</span><span className="self-start rounded-full bg-surface-soft px-2 py-1 text-[11px] font-bold text-muted-foreground max-sm:col-start-2 max-sm:justify-self-start">{originLabels[decision.origin]}</span></article>)}
          </div>
        </SummarySection>

        {data.summary.dismissed.length > 0 ? <SummarySection eyebrow="Excluded from final record" id="dismissed-skills-title" meta={String(data.summary.dismissed.length)} title="Dismissed suggestions"><div className="border-t border-border">{data.summary.dismissed.map(({ suggestion, decision }) => <article className="grid grid-cols-[30px_minmax(0,1fr)] gap-2.5 border-b border-border px-2 py-3" key={suggestion.id}><X aria-hidden="true" className="mt-0.5 text-muted-foreground" size={16} /><span className="grid gap-1"><strong><small className="mr-2 text-muted-foreground">{suggestion.skillCode}</small>{suggestion.skillName}</strong><small className="text-xs text-muted-foreground">{suggestion.domain}</small>{decision.note ? <p className="text-xs text-muted-foreground">{decision.note}</p> : null}</span></article>)}</div></SummarySection> : null}

        <footer className="mt-10 flex justify-end gap-2.5 border-t border-border pt-5 max-sm:flex-col-reverse">
          {finalView ? <Button asChild className="max-sm:w-full" variant="secondary"><Link href={`/children/${data.child.id}`}><ArrowLeft aria-hidden="true" size={16} /> Return to child</Link></Button> : <>
            <Button asChild className="max-sm:w-full" variant="secondary"><Link href={`/assessments/${assessmentId}/review`}><RotateCcw aria-hidden="true" size={16} /> Return to review</Link></Button>
            <Button className="max-sm:w-full" disabled={remaining.length > 0 || finalizing} onClick={() => setConfirmOpen(true)} type="button"><LockKeyhole aria-hidden="true" size={16} /> {finalizing ? "Confirming..." : "Confirm final assessment"}</Button>
          </>}
        </footer>
        {error ? <Alert className="mt-6" variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      </div>
      <ConfirmDialog confirmLabel="Confirm final assessment" description="This creates the read-only human-approved record. Ordinary review edits will no longer be available." details={[`${data.summary.included.length} included skills`, `${data.summary.dismissed.length} dismissed suggestions`, "All educator decisions will be locked"]} onCancel={() => setConfirmOpen(false)} onConfirm={() => void finalize()} open={confirmOpen} pending={finalizing} title="Finalize this assessment?" tone="primary" />
    </main>
  );
}

function SummarySection({ eyebrow, title, id, meta, children }: { readonly eyebrow: string; readonly title: string; readonly id: string; readonly meta?: string; readonly children: ReactNode }) {
  return <section className="mt-10" aria-labelledby={id}><div className="mb-[18px] flex items-end justify-between gap-5"><div><Eyebrow>{eyebrow}</Eyebrow><h2 className="mt-1 font-heading text-2xl font-normal" id={id}>{title}</h2></div>{meta ? <span className="text-[13px] text-muted-foreground">{meta}</span> : null}</div>{children}</section>;
}

function creditSymbolClass(credit: PrimaryCredit | null): string {
  const base = "grid size-9 shrink-0 place-items-center rounded-full text-sm font-extrabold";
  if (credit === "PRESENT") return `${base} bg-success-soft text-success`;
  if (credit === "EMERGING") return `${base} bg-warning-soft text-warning`;
  if (credit === "NOT_OBSERVED") return `${base} bg-destructive-soft text-destructive`;
  return `${base} bg-surface-soft text-navy`;
}
