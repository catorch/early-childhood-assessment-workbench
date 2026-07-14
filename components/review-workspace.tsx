"use client";

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  MessageSquareText,
  Pencil,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  X
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PageState } from "@/components/page-state";
import { ReviewConflictDialog } from "@/components/review-conflict-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { backLinkClass, Eyebrow, PageShell } from "@/components/ui/app-patterns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { handleProtectedResponse } from "@/lib/help-review/client-http";
import type { PrimaryCredit, ReviewSummary, SavedReviewDecision, SkillSuggestion } from "@/lib/help-review/domain";
import type { PilotChild } from "@/lib/help-review/models";
import { creditPresentation, formatDate } from "@/lib/help-review/presentation";
import { cn } from "@/lib/utils";

interface ReviewProjection {
  readonly assessment: {
    readonly id: string;
    readonly observationDate: string;
    readonly status: string;
    readonly finalizedAt: string | null;
    readonly revision: number;
  };
  readonly child: PilotChild;
  readonly video: { readonly id: string; readonly originalFilename: string; readonly playbackUrl: string } | null;
  readonly suggestions: SkillSuggestion[];
  readonly decisions: SavedReviewDecision[];
  readonly summary: ReviewSummary;
  readonly features: { readonly addOnFlags: boolean };
}

interface DecisionIntent {
  readonly finalCredit: PrimaryCredit | null;
  readonly dismissed: boolean;
  readonly note: string | null;
}

interface ConflictState {
  readonly suggestion: SkillSuggestion;
  readonly current: SavedReviewDecision | null;
  readonly attempted: DecisionIntent;
  readonly summary: ReviewSummary | null;
}

const groupOrder: Array<{ key: PrimaryCredit | "NEEDS_REVIEW"; label: string }> = [
  { key: "NEEDS_REVIEW", label: "Needs your review" },
  { key: "PRESENT", label: "Present" },
  { key: "EMERGING", label: "Emerging" },
  { key: "NOT_OBSERVED", label: "Not observed" },
  { key: "NOT_APPLICABLE", label: "Not applicable" }
];

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function reviewValues(suggestion: SkillSuggestion, decision: SavedReviewDecision | undefined) {
  return {
    credit: decision?.dismissed ? null : decision?.finalCredit ?? suggestion.draftCredit,
    note: decision?.note ?? ""
  };
}

export function ReviewWorkspace() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mobileVideoRef = useRef<HTMLVideoElement>(null);
  const [data, setData] = useState<ReviewProjection | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [draftCredit, setDraftCredit] = useState<PrimaryCredit | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [noValidResults, setNoValidResults] = useState(false);
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const [videoVersion, setVideoVersion] = useState(0);
  const [lastVideoTime, setLastVideoTime] = useState(0);
  const [activeEvidence, setActiveEvidence] = useState<string | null>(null);
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);

  const initializeSelection = useCallback((projection: ReviewProjection) => {
    const requested = new URLSearchParams(window.location.search).get("skill");
    const first = projection.suggestions.find((suggestion) => suggestion.id === requested) ?? projection.suggestions[0];
    setSelectedId(first?.id ?? null);
    if (first) {
      const values = reviewValues(first, projection.decisions.find((candidate) => candidate.suggestionId === first.id));
      setDraftCredit(values.credit);
      setDraftNote(values.note);
    }
  }, []);

  const loadProjection = useCallback(async () => {
    setPageError(null);
    setNoValidResults(false);
    try {
      const response = await fetch(`/api/assessments/${assessmentId}/review`, { cache: "no-store" });
      if (handleProtectedResponse(response, router, `/assessments/${assessmentId}/review`)) return;
      if (response.status === 409) {
        router.replace(`/assessments/${assessmentId}/processing`);
        return;
      }
      if (response.status === 422) {
        setNoValidResults(true);
        return;
      }
      if (!response.ok) {
        setPageError("A temporary problem prevented the review from loading.");
        return;
      }
      const projection = await response.json() as ReviewProjection;
      if (projection.assessment.status === "FINALIZED") {
        router.replace(`/assessments/${assessmentId}/final`);
        return;
      }
      setData(projection);
      initializeSelection(projection);
    } catch {
      setPageError("A temporary problem prevented the review from loading.");
    }
  }, [assessmentId, initializeSelection, router]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadProjection(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadProjection]);

  const selected = data?.suggestions.find((suggestion) => suggestion.id === selectedId) ?? null;
  const selectedDecision = data?.decisions.find((decision) => decision.suggestionId === selectedId);
  const baseValues = selected ? reviewValues(selected, selectedDecision) : { credit: null, note: "" };
  const dirty = selected !== null && (draftCredit !== baseValues.credit || draftNote !== baseValues.note);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!mobileEditorOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [mobileEditorOpen]);

  const groups = useMemo(() => {
    if (!data) return [];
    return groupOrder.map((group) => ({
      ...group,
      suggestions: data.suggestions.filter((suggestion) => group.key === "NEEDS_REVIEW" ? suggestion.draftCredit === null : suggestion.draftCredit === group.key)
    })).filter((group) => group.suggestions.length > 0);
  }, [data]);

  function updateDecisionState(suggestion: SkillSuggestion, decision: SavedReviewDecision | null, summary: ReviewSummary | null) {
    if (!data) return;
    setData((current) => current ? {
      ...current,
      assessment: { ...current.assessment, status: "IN_REVIEW" },
      decisions: decision
        ? [...current.decisions.filter((candidate) => candidate.suggestionId !== suggestion.id), decision]
        : current.decisions.filter((candidate) => candidate.suggestionId !== suggestion.id),
      summary: summary ?? current.summary
    } : current);
    if (selectedId === suggestion.id) {
      const values = reviewValues(suggestion, decision ?? undefined);
      setDraftCredit(values.credit);
      setDraftNote(values.note);
    }
  }

  async function saveDecision(
    suggestion: SkillSuggestion,
    intent: DecisionIntent,
    expectedRevision = data?.decisions.find((decision) => decision.suggestionId === suggestion.id)?.revision ?? 0
  ) {
    if (!data) return;
    setSaving(true);
    setSaveError(null);
    let response: Response;
    try {
      response = await fetch(`/api/assessments/${assessmentId}/suggestions/${suggestion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedRevision, ...intent })
      });
    } catch {
      setSaveError("The network interrupted this save. Your changes are still here.");
      setSaving(false);
      return;
    }
    if (handleProtectedResponse(response, router, `/assessments/${assessmentId}/review?skill=${suggestion.id}`)) {
      setSaving(false);
      return;
    }
    const payload = await response.json() as {
      readonly code?: string;
      readonly decision?: SavedReviewDecision;
      readonly currentDecision?: SavedReviewDecision | null;
      readonly summary?: ReviewSummary | null;
      readonly error?: string;
    };
    if (response.status === 409 && payload.code === "REVISION_CONFLICT") {
      setConflict({ suggestion, current: payload.currentDecision ?? null, attempted: intent, summary: payload.summary ?? null });
      setSaving(false);
      return;
    }
    if (!response.ok || !payload.decision || !payload.summary) {
      setSaveError(payload.error ?? "This decision was not saved. Your changes are still here.");
      setSaving(false);
      return;
    }
    setData((current) => current ? {
      ...current,
      assessment: { ...current.assessment, status: "IN_REVIEW" },
      decisions: [...current.decisions.filter((decision) => decision.suggestionId !== suggestion.id), payload.decision!],
      summary: payload.summary!
    } : current);
    if (selectedId === suggestion.id) {
      setDraftCredit(payload.decision.finalCredit);
      setDraftNote(payload.decision.note ?? "");
    }
    setSaving(false);
  }

  function selectSuggestion(suggestion: SkillSuggestion, openEditor = false) {
    if (dirty && suggestion.id !== selectedId) {
      setSaveError("Save or discard your current changes before opening another skill.");
      return;
    }
    const values = reviewValues(suggestion, data?.decisions.find((candidate) => candidate.suggestionId === suggestion.id));
    setSelectedId(suggestion.id);
    setDraftCredit(values.credit);
    setDraftNote(values.note);
    setSaveError(null);
    if (openEditor) {
      if (videoRef.current) {
        setLastVideoTime(videoRef.current.currentTime);
        videoRef.current.pause();
      }
      setMobileEditorOpen(true);
    }
  }

  function closeMobileEditor() {
    if (dirty) {
      setSaveError("Save or discard changes before closing the editor.");
      return;
    }
    if (mobileVideoRef.current) {
      setLastVideoTime(mobileVideoRef.current.currentTime);
      mobileVideoRef.current.pause();
    }
    setMobileEditorOpen(false);
  }

  function discardDraft() {
    setDraftCredit(baseValues.credit);
    setDraftNote(baseValues.note);
    setSaveError(null);
  }

  function seek(evidenceKey: string, seconds: number) {
    const activeVideo = mobileEditorOpen ? mobileVideoRef.current : videoRef.current;
    if (!activeVideo || videoUnavailable) {
      setSaveError("Restore video access before opening evidence timestamps.");
      return;
    }
    setActiveEvidence(evidenceKey);
    activeVideo.currentTime = seconds;
    void activeVideo.play().catch(() => undefined);
  }

  function restoreVideo() {
    setVideoUnavailable(false);
    setVideoVersion((current) => current + 1);
  }

  if (noValidResults) {
    return (
      <PageShell className="max-w-[900px]">
        <Link className={backLinkClass} href="/children"><ArrowLeft aria-hidden="true" size={16} /> Back to children</Link>
        <PageState
          description="The analysis result did not pass validation, so no partial draft suggestions are displayed. Your assessment and private video remain available."
          kind="error"
          title="Review is not available"
        >
          <Button asChild variant="secondary"><Link href="/children">Return to children</Link></Button>
          <Button asChild><Link href={`/assessments/${assessmentId}/processing`}><RefreshCw aria-hidden="true" size={16} /> Review processing</Link></Button>
        </PageState>
        <p className="mt-[18px] flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck aria-hidden="true" size={15} /> No incomplete scoring result was shown or applied.</p>
      </PageShell>
    );
  }
  if (pageError) {
    return (
      <PageShell className="max-w-[900px]">
        <Link className={backLinkClass} href="/children"><ArrowLeft aria-hidden="true" size={16} /> Back to children</Link>
        <PageState description={pageError} kind="error" title="Review could not be loaded">
          <Button onClick={() => void loadProjection()} type="button"><RefreshCw aria-hidden="true" size={16} /> Try again</Button>
        </PageState>
      </PageShell>
    );
  }
  if (!data) {
    return (
      <main className="min-h-[calc(100vh-94px)] bg-canvas pb-[72px]" aria-busy="true">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto grid min-h-28 w-[min(calc(100%_-_40px),1180px)] grid-cols-[minmax(250px,1fr)_auto_minmax(260px,.8fr)] items-center gap-7 py-5 max-[1000px]:grid-cols-[minmax(240px,1fr)_auto] max-md:w-[min(calc(100%_-_24px),1180px)] max-md:grid-cols-1">
            <div className="flex items-center gap-2.5"><Skeleton className="size-10" /><span className="grid gap-2"><Skeleton className="h-3 w-[110px]" /><Skeleton className="h-3 w-[220px]" /></span></div>
            <div className="flex justify-center gap-2.5 max-[1000px]:col-span-full max-[1000px]:justify-start"><Skeleton className="h-3 w-[110px]" /><Skeleton className="h-3 w-[110px]" /><Skeleton className="h-3 w-[110px]" /></div>
            <div className="flex justify-end gap-2.5"><Skeleton className="h-3 w-[180px]" /><Skeleton className="h-10 w-[120px]" /></div>
          </div>
        </header>
        <div className="mx-auto mt-[18px] flex min-h-[42px] w-[min(calc(100%_-_40px),1180px)] items-center gap-2 rounded-md border border-info-border bg-info-soft px-3 py-2 text-xs font-bold text-info-strong max-md:w-[min(calc(100%_-_24px),1180px)]"><span className="size-[18px] animate-spin rounded-full border-2 border-[#9cc4d2] border-t-primary" /><span>Loading suggestions, saved decisions, and secure video access...</span></div>
        <div className="mx-auto mt-6 grid w-[min(calc(100%_-_40px),1180px)] grid-cols-[minmax(0,1fr)_370px] items-start gap-6 max-[1000px]:grid-cols-[minmax(300px,.82fr)_minmax(360px,1.18fr)] max-md:w-[min(calc(100%_-_24px),1180px)] max-md:grid-cols-1">
          <section className="overflow-hidden rounded-md border border-border bg-surface px-4 py-2" aria-label="Loading suggestions">
            {Array.from({ length: 7 }, (_, index) => <div className="grid gap-3 border-b border-border py-5 last:border-0" key={index}><Skeleton className="h-3 w-[62%]" /><Skeleton className="h-3 w-[38%]" /><Skeleton className="h-3 w-[78%]" /></div>)}
          </section>
          <aside className="sticky top-5 grid gap-3.5 max-md:static">
            <div className="grid aspect-video place-items-center rounded-md bg-navy text-[13px] text-[#d9e7eb] motion-safe:animate-pulse"><span>Preparing secure video</span></div>
            <div className="min-h-[310px] rounded-md border border-border bg-surface p-[18px]"><Skeleton className="h-3 w-[110px]" /><Skeleton className="mt-2 h-3 w-[220px]" /><Skeleton className="mt-[18px] h-[120px] w-full" /></div>
          </aside>
        </div>
        <span className="sr-only" role="status">Loading review workspace</span>
      </main>
    );
  }

  return (
    <main className={cn("min-h-[calc(100vh-94px)] bg-canvas pb-[72px] max-md:pb-[110px]", mobileEditorOpen && "max-md:fixed max-md:inset-0 max-md:z-[60] max-md:overflow-hidden max-md:bg-surface max-md:p-0")}>
      <header className={cn("border-b border-border bg-surface", mobileEditorOpen && "max-md:hidden")}>
        <div className="mx-auto grid min-h-28 w-[min(calc(100%_-_40px),1180px)] grid-cols-[minmax(250px,1fr)_auto_minmax(260px,.8fr)] items-center gap-7 py-5 max-[1000px]:grid-cols-[minmax(240px,1fr)_auto] max-[1000px]:gap-4 max-md:w-[min(calc(100%_-_24px),1180px)] max-md:grid-cols-1 max-md:gap-3.5 max-md:py-[18px]">
          <div className="flex min-w-0 items-center gap-3.5">
            <Button asChild aria-label="Back to child" size="icon" variant="outline"><Link href={`/children/${data.child.id}`}><ArrowLeft aria-hidden="true" size={18} /></Link></Button>
            <div className="min-w-0"><Eyebrow>Assessment review</Eyebrow><h1 className="mt-1 font-heading text-[25px] font-normal leading-tight max-md:text-[23px]">Review AI draft</h1><p className="mt-1 text-xs text-muted-foreground">{data.child.externalChildId} · {formatDate(data.assessment.observationDate)}</p></div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-muted-foreground max-[1000px]:col-span-full max-[1000px]:row-start-2 max-[1000px]:justify-start max-md:hidden" aria-label="Draft credit groups">
            <CreditCount className="text-success" count={data.suggestions.filter((item) => item.draftCredit === "PRESENT").length} label="Present" />
            <CreditCount className="text-warning" count={data.suggestions.filter((item) => item.draftCredit === "EMERGING").length} label="Emerging" />
            <CreditCount className="text-destructive" count={data.suggestions.filter((item) => item.draftCredit === "NOT_OBSERVED").length} label="Not observed" />
            <span className="inline-flex min-h-[30px] items-center gap-1 rounded-md border border-warning-border bg-warning-soft px-2 py-1 text-warning"><AlertTriangle aria-hidden="true" size={14} /><strong className="text-xs text-ink">{data.suggestions.filter((item) => item.draftCredit === null).length}</strong> Need review</span>
          </div>
          <div className="flex items-center justify-end gap-3.5 max-md:justify-between">
            <div className="grid w-[140px] gap-1.5 text-xs text-muted-foreground max-md:w-[min(48%,160px)]">
              <span><strong className="text-ink">{data.summary.progress.actioned}</strong> of {data.summary.progress.total} actioned</span>
              <Progress aria-label={`${data.summary.progress.actioned} of ${data.summary.progress.total} suggestions actioned`} max={data.summary.progress.total} value={(data.summary.progress.actioned / Math.max(1, data.summary.progress.total)) * 100} />
            </div>
            <Button
              className="whitespace-nowrap max-md:min-h-[38px] max-md:px-3 max-md:text-xs"
              onClick={() => {
                if (dirty) setSaveError("Save or discard the open decision before finishing review.");
                else router.push(`/assessments/${assessmentId}/summary`);
              }}
              type="button"
            >
              Finish &amp; review <ChevronRight aria-hidden="true" size={16} />
            </Button>
          </div>
        </div>
      </header>

      <div className={cn("mx-auto mt-6 grid w-[min(calc(100%_-_40px),1180px)] grid-cols-[minmax(0,1fr)_370px] items-start gap-6 max-[1000px]:grid-cols-[minmax(300px,.82fr)_minmax(360px,1.18fr)] max-[1000px]:gap-4 max-md:mt-3 max-md:flex max-md:w-[min(calc(100%_-_24px),1180px)] max-md:flex-col max-md:gap-3", mobileEditorOpen && "max-md:m-0 max-md:block max-md:h-full max-md:w-full max-md:p-0")}>
        <div className={cn("hidden w-full order-[-2] grid-cols-2 overflow-hidden rounded-md border border-border bg-surface-soft max-md:grid", mobileEditorOpen && "max-md:hidden")} role="tablist" aria-label="Review workspace">
          <button aria-selected="true" className="min-h-[46px] border-r border-border bg-surface font-extrabold text-navy shadow-[inset_0_-3px_0_var(--primary)]" role="tab" type="button">Items <span className="ml-1 inline-grid size-[22px] place-items-center rounded-full bg-surface-soft text-[10px]">{data.suggestions.length}</span></button>
          <button className="min-h-[46px] font-extrabold text-muted-foreground" disabled={!selected} onClick={() => selected && selectSuggestion(selected, true)} role="tab" type="button">Decision</button>
        </div>

        <section className={cn("overflow-hidden rounded-md border border-border bg-surface shadow-[0_6px_20px_rgba(24,59,86,.04)] max-md:order-[-1] max-md:w-full max-md:shadow-none", mobileEditorOpen && "max-md:hidden")} aria-label="AI skill suggestions">
          {groups.map((group) => (
            <section className="border-t-8 border-canvas first:border-t-0" key={group.key}>
              <header className={cn("flex min-h-[50px] items-center justify-between gap-4 border-b border-border bg-surface-soft px-4 py-2.5 text-navy max-[1000px]:items-start max-[1000px]:flex-col max-[1000px]:gap-1 max-md:px-3.5 max-md:py-3", group.key === "NEEDS_REVIEW" && "border-l-4 border-l-warning bg-warning-soft")}>
                <span className="flex items-center gap-2 text-sm">
                  {group.key === "NEEDS_REVIEW" ? <AlertTriangle aria-hidden="true" className="text-warning" size={17} /> : <span className={groupDotClass(group.key)} />}
                  <strong>{group.label}</strong>
                  <span className="inline-grid size-6 place-items-center rounded-full border border-border bg-surface text-[11px] font-extrabold text-muted-foreground">{group.suggestions.length}</span>
                </span>
                {group.key === "NEEDS_REVIEW" ? <small className="text-xs leading-relaxed text-muted-foreground">AI could not draft a credit. Score independently.</small> : null}
              </header>
              {group.suggestions.map((suggestion) => {
                const decision = data.decisions.find((candidate) => candidate.suggestionId === suggestion.id);
                const isExpanded = expanded.has(suggestion.id);
                return (
                  <article className={cn("relative border-b border-border p-4 last:border-b-0 max-md:px-3.5 max-md:py-4", selectedId === suggestion.id && "bg-[#f7fcfb] shadow-[inset_4px_0_0_var(--primary)]")} key={suggestion.id}>
                    <button className="block w-full bg-transparent p-0 text-left" onClick={() => selectSuggestion(suggestion)} type="button">
                      <span className="flex items-baseline gap-2.5 max-md:items-start"><span className="text-[13px] font-extrabold text-muted-foreground">{suggestion.skillCode}</span><strong className="font-heading text-[17px] leading-snug text-navy max-md:text-base">{suggestion.skillName}</strong></span>
                      <span className="mt-1 block text-xs text-muted-foreground">{suggestion.domain}{suggestion.strand ? ` · ${suggestion.strand}` : ""}</span>
                    </button>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {suggestion.uncertaintyReason ? (
                        <Badge variant="destructive"><AlertTriangle aria-hidden="true" size={13} /> Model uncertain</Badge>
                      ) : suggestion.confidence !== null ? (
                        <Badge variant="success"><Sparkles aria-hidden="true" size={13} /> {Math.round(suggestion.confidence * 100)}% confidence</Badge>
                      ) : null}
                      {suggestion.evidence.map((evidence, index) => {
                        const evidenceKey = `${suggestion.id}-${index}`;
                        return (
                          <button
                            aria-pressed={activeEvidence === evidenceKey}
                            className={cn("inline-flex min-h-[26px] items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-[11px] font-extrabold text-primary-strong", activeEvidence === evidenceKey && "ring-2 ring-ring ring-offset-2")}
                            key={evidenceKey}
                            onClick={() => seek(evidenceKey, evidence.timestampSeconds)}
                            type="button"
                          >
                            <Clock3 aria-hidden="true" size={13} /> {formatTime(evidence.timestampSeconds)}
                          </button>
                        );
                      })}
                      {decision ? (
                        <Badge className={decisionBadgeClass(decision.origin)} variant="outline"><Check aria-hidden="true" size={13} /> {decision.origin.replaceAll("_", " ").toLowerCase()}</Badge>
                      ) : <Badge variant="secondary">unactioned</Badge>}
                    </div>
                    {suggestion.draftCredit === null ? (
                      <div className="mt-3 grid grid-cols-4 overflow-hidden rounded-md border border-border-strong max-md:grid-cols-2" role="group" aria-label={`Score ${suggestion.skillName}`}>
                        {(Object.keys(creditPresentation) as PrimaryCredit[]).map((credit) => (
                          <button
                            aria-pressed={decision?.finalCredit === credit}
                            className={creditButtonClass(decision?.finalCredit === credit)}
                            disabled={saving}
                            key={credit}
                            onClick={() => void saveDecision(suggestion, { finalCredit: credit, dismissed: false, note: decision?.note ?? null })}
                            type="button"
                          >
                            <strong>{creditPresentation[credit].symbol}</strong>
                            <span>{creditPresentation[credit].shortLabel}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <Button disabled={saving} onClick={() => void saveDecision(suggestion, { finalCredit: suggestion.draftCredit, dismissed: false, note: decision?.note ?? null })} size="xs" type="button" variant="secondary"><Check aria-hidden="true" size={14} /> Accept draft</Button>
                        <Button onClick={() => selectSuggestion(suggestion, true)} size="xs" type="button" variant="secondary"><Pencil aria-hidden="true" size={14} /> Edit</Button>
                        <Button onClick={() => selectSuggestion(suggestion, true)} size="xs" type="button" variant="secondary"><MessageSquareText aria-hidden="true" size={14} /> Note</Button>
                        <Button disabled={saving} onClick={() => void saveDecision(suggestion, { finalCredit: null, dismissed: true, note: decision?.note ?? null })} size="xs" type="button" variant="secondary"><X aria-hidden="true" size={14} /> Dismiss</Button>
                      </div>
                    )}
                    <button
                      aria-expanded={isExpanded}
                      className="mt-2 flex min-h-8 items-center gap-1 bg-transparent p-0 text-xs font-extrabold text-navy"
                      onClick={() => setExpanded((current) => {
                        const next = new Set(current);
                        if (next.has(suggestion.id)) next.delete(suggestion.id);
                        else next.add(suggestion.id);
                        return next;
                      })}
                      type="button"
                    >
                      {isExpanded ? <ChevronDown aria-hidden="true" size={15} /> : <ChevronRight aria-hidden="true" size={15} />} What the AI noticed
                    </button>
                    {isExpanded ? (
                      <div className="mt-2 border-l-2 border-[#9fcac4] py-0.5 pl-3">
                        {suggestion.evidence.map((evidence, index) => {
                          const evidenceKey = `${suggestion.id}-${index}`;
                          return <p className="my-1.5 flex gap-2 text-xs leading-relaxed text-muted-foreground" key={evidenceKey}><button aria-pressed={activeEvidence === evidenceKey} className={cn("self-start bg-transparent p-0 font-extrabold text-primary-strong", activeEvidence === evidenceKey && "ring-2 ring-ring ring-offset-2")} onClick={() => seek(evidenceKey, evidence.timestampSeconds)} type="button">{formatTime(evidence.timestampSeconds)}</button>{evidence.explanation}</p>;
                        })}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </section>
          ))}
        </section>

        <aside className={cn("sticky top-5 grid gap-3.5 max-md:static max-md:contents", mobileEditorOpen && "max-md:block max-md:h-full max-md:w-full")}>
          <section className={cn("overflow-hidden rounded-md border border-border bg-surface shadow-[0_6px_20px_rgba(24,59,86,.04)] max-md:order-[-3] max-md:ml-[-12px] max-md:w-[calc(100%+24px)] max-md:rounded-none max-md:border-x-0", mobileEditorOpen && "max-md:hidden")}>
            {data.video && !videoUnavailable ? (
              <video
                className="block aspect-video w-full bg-navy object-contain"
                controls
                key={videoVersion}
                onError={() => setVideoUnavailable(true)}
                onLoadedMetadata={(event) => {
                  event.currentTarget.currentTime = Math.min(lastVideoTime, Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : lastVideoTime);
                }}
                onTimeUpdate={(event) => setLastVideoTime(event.currentTarget.currentTime)}
                preload="metadata"
                ref={videoRef}
                src={`${data.video.playbackUrl}?grant=${videoVersion}`}
              >
                Your browser does not support video playback.
              </video>
            ) : (
              <div className="grid aspect-video w-full place-items-center content-center gap-2 bg-navy p-5 text-center text-white">
                <CircleHelp aria-hidden="true" className="size-[34px] text-[#b9d5df]" />
                <strong className="text-base">Video access unavailable</strong>
                <span className="max-w-[290px] text-xs leading-relaxed text-[#d8e6eb]">Restore secure access to continue playback. Your review changes are still here.</span>
                {data.video ? <Button onClick={restoreVideo} size="sm" type="button"><RefreshCw aria-hidden="true" size={15} /> Restore video access</Button> : null}
              </div>
            )}
            <div className="flex min-w-0 items-center justify-between gap-2.5 px-3 py-2.5 text-xs text-navy max-md:hidden"><span className="min-w-0 truncate">{data.video?.originalFilename ?? "No video"}</span><small className="inline-flex items-center gap-1 whitespace-nowrap text-muted-foreground"><ShieldCheck aria-hidden="true" size={13} /> Private assessment video</small></div>
          </section>

          <section className={cn("overflow-hidden rounded-md border border-border bg-surface px-3.5 py-2 shadow-[0_6px_20px_rgba(24,59,86,.04)] max-[1000px]:hidden", mobileEditorOpen && "max-md:hidden")} aria-label="Assessment context">
            <dl className="m-0">
              {[['Child', data.child.externalChildId], ['Age', `${data.child.ageMonths} months`], ['Context', data.child.contextLabel ?? "None supplied"], ['Status', 'AI draft']].map(([term, value]) => <div className="flex justify-between gap-5 border-b border-border py-2 text-xs last:border-0" key={term}><dt className="text-muted-foreground">{term}</dt><dd className="m-0 text-right font-extrabold text-navy">{value}</dd></div>)}
            </dl>
          </section>

          {selected ? (
            <section className={cn("overflow-hidden rounded-md border border-border bg-surface p-[18px] shadow-[0_6px_20px_rgba(24,59,86,.04)] max-md:hidden", mobileEditorOpen && "max-md:block max-md:h-full max-md:w-full max-md:overflow-y-auto max-md:rounded-none max-md:border-0 max-md:px-4 max-md:pt-0 max-md:pb-6 max-md:shadow-none")} id="review-editor" aria-labelledby="editor-title">
              <div className="sticky top-0 z-[3] -mx-4 mb-5 hidden grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border bg-white/98 px-4 py-3.5 max-md:grid">
                <button className="inline-flex items-center gap-1 bg-transparent p-0 text-[11px] font-extrabold text-navy" onClick={closeMobileEditor} type="button"><ArrowLeft aria-hidden="true" className="size-[18px]" /> Back to items</button>
                <strong className="whitespace-nowrap text-center font-heading text-[17px] text-navy">Editing {selected.skillCode}</strong>
                <span className={cn("justify-self-end text-[11px] font-extrabold text-success", dirty && "text-warning")}>{dirty ? "Unsaved" : "Saved"}</span>
              </div>
              {mobileEditorOpen ? (
                <div className="mb-6 hidden grid-cols-[minmax(0,1.4fr)_.6fr] items-center gap-4 border-b border-border pb-5 max-md:grid">
                  {data.video && !videoUnavailable ? (
                    <video
                      className="block aspect-video w-full rounded-md bg-navy object-cover"
                      controls
                      key={`mobile-${videoVersion}`}
                      onError={() => setVideoUnavailable(true)}
                      onLoadedMetadata={(event) => {
                        event.currentTarget.currentTime = Math.min(lastVideoTime, Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : lastVideoTime);
                      }}
                      onTimeUpdate={(event) => setLastVideoTime(event.currentTarget.currentTime)}
                      preload="metadata"
                      ref={mobileVideoRef}
                      src={`${data.video.playbackUrl}?grant=${videoVersion}`}
                    />
                  ) : (
                    <div className="grid aspect-video w-full place-items-center gap-1 rounded-md bg-navy text-center text-[9px] text-white"><CircleHelp aria-hidden="true" /><span>Video access unavailable</span></div>
                  )}
                  <strong className="text-center font-heading text-2xl text-navy">{formatTime(Math.floor(lastVideoTime))}</strong>
                </div>
              ) : null}
              <Eyebrow>Editing {selected.skillCode}</Eyebrow>
              <h2 className="mt-1 mb-2 font-heading text-[19px] font-normal leading-snug max-md:mt-2 max-md:text-[27px]" id="editor-title">{selected.skillName}</h2>
              <div className="flex items-center gap-1 text-xs text-primary-strong max-md:text-sm"><span>{selected.domain}{selected.strand ? ` · ${selected.strand}` : ""}</span></div>
              <div className="mt-3 flex flex-wrap gap-1.5 max-md:mt-[18px]" aria-label="Evidence timestamps">
                {selected.evidence.map((evidence, index) => {
                  const evidenceKey = `${selected.id}-${index}`;
                  return <button aria-pressed={activeEvidence === evidenceKey} className={cn("inline-flex min-h-8 items-center gap-1 rounded-md border border-border-strong bg-surface px-2 py-1 text-xs font-extrabold text-navy max-md:min-h-11 max-md:px-3 max-md:text-sm", activeEvidence === evidenceKey && "border-primary bg-primary text-white")} key={evidenceKey} onClick={() => seek(evidenceKey, evidence.timestampSeconds)} type="button"><Clock3 aria-hidden="true" size={14} /> {formatTime(evidence.timestampSeconds)}</button>;
                })}
              </div>
              <fieldset className="mt-[18px] border-0 p-0 max-md:mt-6">
                <legend className="mb-2 block text-[11px] font-extrabold uppercase text-muted-foreground">Educator credit</legend>
                <div className="grid grid-cols-4 overflow-hidden rounded-md border border-border-strong max-md:grid-cols-2">
                  {(Object.keys(creditPresentation) as PrimaryCredit[]).map((credit) => (
                    <button aria-pressed={draftCredit === credit} className={cn(creditButtonClass(draftCredit === credit), "mt-0 max-md:min-h-[82px]")} key={credit} onClick={() => setDraftCredit(credit)} type="button">
                      <strong>{creditPresentation[credit].symbol}</strong>
                      <span>{creditPresentation[credit].shortLabel}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              {data.features.addOnFlags ? <fieldset className="mt-[18px]"><legend className="text-[11px] font-extrabold uppercase text-muted-foreground">Add-on credits</legend></fieldset> : null}
              <label className="mt-[18px] mb-2 block text-[11px] font-extrabold uppercase text-muted-foreground max-md:mt-6 max-md:text-xs" htmlFor="review-note">Educator note <span className="font-normal normal-case">optional</span></label>
              <Textarea className="min-h-[110px] resize-y text-[13px] leading-relaxed max-md:min-h-[150px] max-md:text-[15px]" id="review-note" maxLength={1000} onChange={(event) => setDraftNote(event.target.value)} placeholder="Add context for this decision" rows={4} value={draftNote} />
              {dirty ? <p className="mt-2 text-xs font-extrabold text-warning">Unsaved changes</p> : null}
              {saveError ? (
                <Alert className="mt-3.5" variant="destructive">
                  <AlertCircle aria-hidden="true" size={19} />
                  <AlertDescription><strong className="block">Decision needs attention</strong><span>{saveError}</span><div className="mt-1 flex gap-3"><button className="text-[11px] font-extrabold underline underline-offset-2" onClick={discardDraft} type="button">Discard changes</button>{draftCredit ? <button className="text-[11px] font-extrabold underline underline-offset-2" onClick={() => void saveDecision(selected, { finalCredit: draftCredit, dismissed: false, note: draftNote.trim() || null })} type="button">Retry save</button> : null}</div></AlertDescription>
                </Alert>
              ) : null}
              <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3.5 max-md:mx-[-16px] max-md:mt-6 max-md:grid max-md:grid-cols-2 max-md:px-4 max-md:py-3.5 max-md:pb-[calc(14px+env(safe-area-inset-bottom))]">
                <Button className="max-md:col-span-full max-md:justify-self-start" disabled={saving} onClick={() => void saveDecision(selected, { finalCredit: null, dismissed: true, note: draftNote.trim() || null })} size="sm" type="button" variant="destructive-outline"><X aria-hidden="true" size={15} /> Dismiss</Button>
                <Button disabled={!dirty || saving} onClick={discardDraft} size="sm" type="button" variant="secondary">Discard</Button>
                <Button disabled={draftCredit === null || saving || !dirty} onClick={() => void saveDecision(selected, { finalCredit: draftCredit, dismissed: false, note: draftNote.trim() || null })} size="sm" type="button"><Save aria-hidden="true" size={15} /> {saving ? "Saving..." : "Save decision"}</Button>
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      {selected ? (
        <div className={cn("fixed inset-x-0 bottom-0 z-25 hidden grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 border-t border-border bg-white/98 px-3 py-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(24,59,86,.08)] max-md:grid", mobileEditorOpen && "max-md:hidden")}>
          <div className="grid min-w-0 gap-1"><strong className="truncate text-xs text-navy">{selected.skillCode} · {selected.skillName}</strong><small className="text-[10px] text-muted-foreground">{selected.domain}</small></div>
          <Button className="min-h-[42px] px-3 text-[11px]" onClick={() => selectSuggestion(selected, true)} type="button">Open decision editor</Button>
        </div>
      ) : null}

      <ReviewConflictDialog
        attempted={conflict?.attempted ?? null}
        current={conflict?.current ?? null}
        onUseCurrent={() => {
          if (!conflict) return;
          updateDecisionState(conflict.suggestion, conflict.current, conflict.summary);
          setConflict(null);
          setSaveError(null);
        }}
        onReapply={() => {
          if (!conflict) return;
          const next = conflict;
          setConflict(null);
          void saveDecision(next.suggestion, next.attempted, next.current?.revision ?? 0);
        }}
      />
    </main>
  );
}

function CreditCount({ count, label, className }: { readonly count: number; readonly label: string; readonly className: string }) {
  return <span className={cn("inline-flex min-h-[30px] items-center gap-1 rounded-md border border-border bg-surface px-2 py-1", className)}><i aria-hidden="true" className="size-2 rounded-full bg-current" /><strong className="text-xs text-ink">{count}</strong>{label}</span>;
}

function groupDotClass(group: PrimaryCredit | "NEEDS_REVIEW"): string {
  const base = "size-[9px] rounded-full";
  if (group === "PRESENT") return `${base} bg-success`;
  if (group === "EMERGING") return `${base} bg-warning`;
  if (group === "NOT_OBSERVED") return `${base} bg-destructive`;
  return `${base} bg-muted-foreground`;
}

function decisionBadgeClass(origin: SavedReviewDecision["origin"]): string {
  if (origin === "ACCEPTED" || origin === "SCORED_INDEPENDENTLY") return "border-[#b8d8d3] bg-accent text-primary-strong";
  if (origin === "OVERRIDDEN") return "border-warning-border bg-warning-soft text-warning";
  return "border-border bg-surface-soft text-muted-foreground";
}

function creditButtonClass(selected: boolean): string {
  return cn(
    "grid min-h-[60px] place-items-center content-center gap-1 border-0 border-r border-border bg-surface text-navy last:border-r-0 hover:bg-accent [&_strong]:text-[17px] [&_span]:text-[11px] [&_span]:text-muted-foreground max-md:min-h-16 max-md:border-b max-md:[&:nth-child(2)]:border-r-0 max-md:[&:nth-child(n+3)]:border-b-0",
    selected && "bg-accent text-primary-strong shadow-[inset_0_-3px_0_var(--primary)]"
  );
}
