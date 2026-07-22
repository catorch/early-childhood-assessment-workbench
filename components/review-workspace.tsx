"use client";

import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Pencil,
  Plus,
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
    readonly ageMonthsAtObservation: number;
    readonly status: string;
    readonly finalizedAt: string | null;
    readonly revision: number;
  };
  readonly child: PilotChild;
  readonly video: { readonly id: string; readonly originalFilename: string; readonly playbackUrl: string } | null;
  readonly suggestions: SkillSuggestion[];
  readonly decisions: SavedReviewDecision[];
  readonly availableSkills: ReadonlyArray<{
    readonly sourceSkillId: string;
    readonly skillCode: string;
    readonly skillName: string;
    readonly domain: string;
    readonly domainCode: string | null;
    readonly isDevelopmentalDomain: boolean;
    readonly strand: string | null;
    readonly rawAgeRange: string | null;
    readonly sensoryCreditKeys: ReadonlyArray<"A_PLUS" | "A_MINUS" | "A_EMERGING">;
    readonly sourceOrder: number;
  }>;
  readonly skillCreditRules: ReadonlyArray<{
    readonly sourceSkillId: string;
    readonly sensoryCreditKeys: ReadonlyArray<"A_PLUS" | "A_MINUS" | "A_EMERGING">;
  }>;
  readonly summary: ReviewSummary;
  readonly features: { readonly addOnFlags: boolean };
}

interface DecisionIntent {
  readonly finalCredit: PrimaryCredit | null;
  readonly dismissed: boolean;
  readonly concernFlag: boolean;
  readonly note: string | null;
}

interface ConflictState {
  readonly suggestion: SkillSuggestion;
  readonly current: SavedReviewDecision | null;
  readonly attempted: DecisionIntent;
  readonly summary: ReviewSummary | null;
}

type ReviewGroup = "PRESENT" | "EMERGING" | "NOT_OBSERVED" | "LEAVE_BLANK" | "EDUCATOR_ADDED";

const groupOrder: Array<{ key: ReviewGroup; label: string }> = [
  { key: "PRESENT", label: "Present" },
  { key: "EMERGING", label: "Emerging" },
  { key: "NOT_OBSERVED", label: "Not observed" },
  { key: "LEAVE_BLANK", label: "Leave blank" },
  { key: "EDUCATOR_ADDED", label: "Added by educator" }
];

const standardCredits: PrimaryCredit[] = ["PRESENT", "EMERGING", "NOT_OBSERVED", "BLANK"];

function educatorOnlyCreditsFor(
  domain: string,
  sensoryCreditKeys: readonly ("A_PLUS" | "A_MINUS" | "A_EMERGING")[] = []
): PrimaryCredit[] {
  if (!/^\s*0\.0\b/.test(domain) && !/regulatory|sensory/i.test(domain)) {
    return ["NOT_APPLICABLE", "ATYPICAL"];
  }
  const keyToCredit = {
    A_PLUS: "ATYPICAL_PLUS",
    A_MINUS: "ATYPICAL_MINUS",
    A_EMERGING: "ATYPICAL_EMERGING"
  } as const;
  const atypicalCredits = sensoryCreditKeys.length > 0
    ? sensoryCreditKeys.map((key) => keyToCredit[key])
    : ["ATYPICAL_PLUS", "ATYPICAL_MINUS", "ATYPICAL_EMERGING"] as const;
  return ["NOT_APPLICABLE", ...atypicalCredits];
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function reviewValues(suggestion: SkillSuggestion, decision: SavedReviewDecision | undefined) {
  return {
    credit: decision?.dismissed ? null : decision?.finalCredit ?? suggestion.draftCredit,
    concernFlag: decision?.concernFlag ?? false,
    note: decision?.note ?? ""
  };
}

function confidenceLabel(confidence: number | null): "High" | "Medium" | "Not sure" {
  if (confidence === null || confidence < 0.5) return "Not sure";
  return confidence >= 0.8 ? "High" : "Medium";
}

function decisionLabel(decision: SavedReviewDecision): string {
  if (decision.dismissed || decision.finalCredit === null) return "Dismissed";
  const credit = creditPresentation[decision.finalCredit].shortLabel;
  if (decision.origin === "ACCEPTED") return `Accepted: ${credit}`;
  if (decision.origin === "OVERRIDDEN") return `Changed to ${credit}`;
  if (decision.origin === "SCORED_INDEPENDENTLY") return `Educator chose ${credit}`;
  if (decision.origin === "MANUALLY_ADDED") return `Added: ${credit}`;
  return credit;
}

function aiReasonTitle(suggestion: SkillSuggestion): string {
  if (suggestion.draftCredit === null) return "Why the AI left this blank";
  const credit = creditPresentation[suggestion.draftCredit];
  return `Why the AI suggested ${credit.symbol} ${credit.label}`;
}

function evidenceMomentLabel(index: number): string {
  return index === 0 ? "Primary moment" : `Supporting moment ${index}`;
}

function reviewGroupFor(suggestion: SkillSuggestion): ReviewGroup {
  if (suggestion.source === "EDUCATOR") return "EDUCATOR_ADDED";
  return suggestion.draftCredit ?? "LEAVE_BLANK";
}

function firstSuggestionInReviewOrder(suggestions: readonly SkillSuggestion[]): SkillSuggestion | undefined {
  for (const group of groupOrder) {
    const suggestion = suggestions.find((candidate) => reviewGroupFor(candidate) === group.key);
    if (suggestion) return suggestion;
  }
  return undefined;
}

export function ReviewWorkspace() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const router = useRouter();
  const scrollStorageKey = `help-review:review-scroll:${assessmentId}`;
  const videoRef = useRef<HTMLVideoElement>(null);
  const mobileVideoRef = useRef<HTMLVideoElement>(null);
  const [data, setData] = useState<ReviewProjection | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [draftCredit, setDraftCredit] = useState<PrimaryCredit | null>(null);
  const [draftConcernFlag, setDraftConcernFlag] = useState(false);
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
  const [addOpen, setAddOpen] = useState(false);
  const [addDomain, setAddDomain] = useState("");
  const [addStrand, setAddStrand] = useState("");
  const [addSkillId, setAddSkillId] = useState("");
  const [addCredit, setAddCredit] = useState<PrimaryCredit | null>(null);
  const [addConcernFlag, setAddConcernFlag] = useState(false);
  const [addNote, setAddNote] = useState("");
  const [addPending, setAddPending] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const initializeSelection = useCallback((projection: ReviewProjection) => {
    const requested = new URLSearchParams(window.location.search).get("skill");
    const first = projection.suggestions.find((suggestion) => suggestion.id === requested)
      ?? firstSuggestionInReviewOrder(projection.suggestions);
    setSelectedId(first?.id ?? null);
    if (first) {
      const values = reviewValues(first, projection.decisions.find((candidate) => candidate.suggestionId === first.id));
      setDraftCredit(values.credit);
      setDraftConcernFlag(values.concernFlag);
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

  useEffect(() => {
    const savePosition = () => {
      window.sessionStorage.setItem(scrollStorageKey, String(Math.max(0, Math.round(window.scrollY))));
    };
    window.addEventListener("pagehide", savePosition);
    return () => {
      savePosition();
      window.removeEventListener("pagehide", savePosition);
    };
  }, [scrollStorageKey]);

  useEffect(() => {
    if (!data) return;
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navigation?.type !== "reload" && navigation?.type !== "back_forward") return;
    const stored = Number(window.sessionStorage.getItem(scrollStorageKey));
    if (!Number.isFinite(stored) || stored <= 0) return;
    const frame = window.requestAnimationFrame(() => {
      const maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo({ top: Math.min(stored, maximum) });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [data, scrollStorageKey]);

  const selected = data?.suggestions.find((suggestion) => suggestion.id === selectedId) ?? null;
  const selectedDecision = data?.decisions.find((decision) => decision.suggestionId === selectedId);
  const baseValues = selected ? reviewValues(selected, selectedDecision) : { credit: null, concernFlag: false, note: "" };
  const dirty = selected !== null && (
    draftCredit !== baseValues.credit
    || draftConcernFlag !== baseValues.concernFlag
    || draftNote !== baseValues.note
  );
  const canSaveDecision = selected !== null
    && draftCredit !== null
    && !saving
    && (!selectedDecision || dirty);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const guardInternalNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented
        || event.button !== 0
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey
      ) return;
      const element = event.target instanceof Element ? event.target : null;
      const anchor = element?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setSaveError("Save or discard your current changes before leaving this review.");
    };
    document.addEventListener("click", guardInternalNavigation, true);
    return () => document.removeEventListener("click", guardInternalNavigation, true);
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
      suggestions: data.suggestions.filter((suggestion) => reviewGroupFor(suggestion) === group.key)
    })).filter((group) => group.suggestions.length > 0);
  }, [data]);

  const addDomains = useMemo(() => {
    if (!data) return [];
    return [...new Map(data.availableSkills.map((skill) => [skill.domain, skill])).values()];
  }, [data]);

  const addStrands = useMemo(() => {
    if (!data || !addDomain) return [];
    return [...new Map(
      data.availableSkills
        .filter((skill) => skill.domain === addDomain)
        .map((skill) => [skill.strand ?? "Unassigned", skill])
    ).keys()];
  }, [addDomain, data]);

  const addSkillOptions = useMemo(() => {
    if (!data || !addDomain || !addStrand) return [];
    return data.availableSkills.filter(
      (skill) => skill.domain === addDomain && (skill.strand ?? "Unassigned") === addStrand
    );
  }, [addDomain, addStrand, data]);

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
      setDraftConcernFlag(values.concernFlag);
      setDraftNote(values.note);
    }
  }

  async function saveDecision(
    suggestion: SkillSuggestion,
    intent: DecisionIntent,
    expectedRevision = data?.decisions.find((decision) => decision.suggestionId === suggestion.id)?.revision ?? 0
  ) {
    if (!data) return;
    if (dirty && suggestion.id !== selectedId) {
      setSaveError("Save or discard your current changes before reviewing another skill.");
      return;
    }
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
      setDraftConcernFlag(payload.decision.concernFlag ?? false);
      setDraftNote(payload.decision.note ?? "");
    }
    setSaving(false);
  }

  async function addSkill() {
    if (!data || !addSkillId || !addCredit) return;
    setAddPending(true);
    setAddError(null);
    let response: Response;
    try {
      response = await fetch(`/api/assessments/${assessmentId}/suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceSkillId: addSkillId,
          finalCredit: addCredit,
          concernFlag: addConcernFlag,
          note: addNote.trim() ? addNote.trim() : null
        })
      });
    } catch {
      setAddError("The network interrupted this save. Your entry is still here.");
      setAddPending(false);
      return;
    }
    if (handleProtectedResponse(response, router, `/assessments/${assessmentId}/review`)) {
      setAddPending(false);
      return;
    }
    const payload = await response.json() as {
      readonly suggestion?: SkillSuggestion;
      readonly decision?: SavedReviewDecision;
      readonly summary?: ReviewSummary;
      readonly error?: string;
    };
    if (!response.ok || !payload.suggestion || !payload.decision || !payload.summary) {
      setAddError(payload.error ?? "The skill was not added. Your entry is still here.");
      setAddPending(false);
      return;
    }
    const added = payload.suggestion;
    setData((current) => current ? {
      ...current,
      assessment: { ...current.assessment, status: "IN_REVIEW" },
      suggestions: [...current.suggestions, added],
      decisions: [...current.decisions, payload.decision!],
      availableSkills: current.availableSkills.filter((skill) => skill.sourceSkillId !== added.sourceSkillId),
      summary: payload.summary!
    } : current);
    setSelectedId(added.id);
    setDraftCredit(payload.decision.finalCredit);
    setDraftConcernFlag(payload.decision.concernFlag ?? false);
    setDraftNote(payload.decision.note ?? "");
    setAddOpen(false);
    setAddDomain("");
    setAddStrand("");
    setAddSkillId("");
    setAddCredit(null);
    setAddConcernFlag(false);
    setAddNote("");
    setAddPending(false);
  }

  function selectSuggestion(suggestion: SkillSuggestion, openEditor = false) {
    if (dirty && suggestion.id !== selectedId) {
      setSaveError("Save or discard your current changes before opening another skill.");
      return;
    }
    const values = reviewValues(suggestion, data?.decisions.find((candidate) => candidate.suggestionId === suggestion.id));
    setSelectedId(suggestion.id);
    setDraftCredit(values.credit);
    setDraftConcernFlag(values.concernFlag);
    setDraftNote(values.note);
    setSaveError(null);
    const url = new URL(window.location.href);
    url.searchParams.set("skill", suggestion.id);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    if (openEditor && window.matchMedia("(max-width: 767px)").matches) {
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
    setDraftConcernFlag(baseValues.concernFlag);
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

  async function restoreVideo() {
    try {
      const response = await fetch(`/api/assessments/${assessmentId}/video/grant`, { method: "POST" });
      if (handleProtectedResponse(response, router, `/assessments/${assessmentId}/review`)) return;
      if (!response.ok) {
        setSaveError("Secure video access could not be restored. Your review changes are still here.");
        return;
      }
      const grant = await response.json() as { readonly playbackUrl: string };
      setData((current) => current?.video ? {
        ...current,
        video: { ...current.video, playbackUrl: grant.playbackUrl }
      } : current);
      setVideoUnavailable(false);
      setVideoVersion((current) => current + 1);
    } catch {
      setSaveError("Secure video access could not be restored. Your review changes are still here.");
    }
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
          <div className="mx-auto grid min-h-28 w-[min(calc(100%_-_40px),1180px)] grid-cols-[minmax(280px,1fr)_auto] items-center gap-7 py-5 max-md:w-[min(calc(100%_-_24px),1180px)] max-md:grid-cols-1">
            <div className="flex items-center gap-2.5"><Skeleton className="size-10" /><span className="grid gap-2"><Skeleton className="h-3 w-[110px]" /><Skeleton className="h-3 w-[220px]" /></span></div>
            <div className="flex justify-end gap-2.5"><Skeleton className="h-3 w-[180px]" /><Skeleton className="h-10 w-[120px]" /></div>
          </div>
        </header>
        <div className="mx-auto mt-[18px] flex min-h-[42px] w-[min(calc(100%_-_40px),1180px)] items-center gap-2 rounded-md border border-info-border bg-info-soft px-3 py-2 text-xs font-bold text-info-strong max-md:w-[min(calc(100%_-_24px),1180px)]"><span className="size-[18px] animate-spin rounded-full border-2 border-[#9cc4d2] border-t-primary" /><span>Loading suggestions, saved decisions, and secure video access...</span></div>
        <div className="mx-auto mt-6 grid w-[min(calc(100%_-_40px),1180px)] grid-cols-[minmax(0,1fr)_390px] items-start gap-6 max-[1000px]:grid-cols-[minmax(300px,.82fr)_minmax(360px,1.18fr)] max-md:w-[min(calc(100%_-_24px),1180px)] max-md:grid-cols-1">
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
    <main className={cn("min-h-[calc(100vh-94px)] bg-canvas pb-[72px]", mobileEditorOpen && "max-md:fixed max-md:inset-0 max-md:z-[60] max-md:overflow-hidden max-md:bg-surface max-md:p-0")}>
      <header className={cn("border-b border-border bg-surface", mobileEditorOpen && "max-md:hidden")}>
        <div className="mx-auto grid min-h-28 w-[min(calc(100%_-_40px),1180px)] grid-cols-[minmax(280px,1fr)_auto] items-center gap-7 py-5 max-md:w-[min(calc(100%_-_24px),1180px)] max-md:grid-cols-1 max-md:gap-3.5 max-md:py-[18px]">
          <div className="flex min-w-0 items-center gap-3.5">
            <Button asChild aria-label="Back to child" size="icon" variant="outline"><Link href={`/children/${data.child.id}`}><ArrowLeft aria-hidden="true" size={18} /></Link></Button>
            <div className="min-w-0">
              <Eyebrow>Assessment review</Eyebrow>
              <h1 className="mt-1 font-heading text-[25px] font-normal leading-tight max-md:text-[23px]">Review AI suggestions</h1>
              <p className="mt-1 text-xs text-muted-foreground">{data.child.externalChildId} · {data.assessment.ageMonthsAtObservation} months · {formatDate(data.assessment.observationDate)}</p>
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground" role="note"><CircleHelp aria-hidden="true" size={13} /> AI confidence is not an accuracy score.</p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3.5 max-md:justify-between">
            <div className="grid w-[140px] gap-1.5 text-xs text-muted-foreground max-md:w-[min(48%,160px)]">
              <span><strong className="text-ink">{data.summary.progress.actioned}</strong> of {data.summary.progress.total} reviewed</span>
              <Progress aria-label={`${data.summary.progress.actioned} of ${data.summary.progress.total} suggestions reviewed`} max={data.summary.progress.total} value={(data.summary.progress.actioned / Math.max(1, data.summary.progress.total)) * 100} />
            </div>
            <Button
              className="whitespace-nowrap max-md:min-h-[38px] max-md:px-3 max-md:text-xs"
              onClick={() => {
                if (dirty) setSaveError("Save or discard the open decision before finishing review.");
                else router.push(`/assessments/${assessmentId}/summary`);
              }}
              type="button"
            >
              Review summary <ChevronRight aria-hidden="true" size={16} />
            </Button>
          </div>
        </div>
      </header>

      <div className={cn("mx-auto mt-6 grid w-[min(calc(100%_-_40px),1180px)] grid-cols-[minmax(0,1fr)_390px] items-start gap-6 max-[1000px]:grid-cols-[minmax(300px,.82fr)_minmax(360px,1.18fr)] max-[1000px]:gap-4 max-md:mt-3 max-md:flex max-md:w-[min(calc(100%_-_24px),1180px)] max-md:flex-col max-md:gap-3", mobileEditorOpen && "max-md:m-0 max-md:block max-md:h-full max-md:w-full max-md:p-0")}>
        <section className={cn("overflow-hidden rounded-md border border-border bg-surface shadow-[0_6px_20px_rgba(24,59,86,.04)] max-md:order-[-1] max-md:w-full max-md:shadow-none", mobileEditorOpen && "max-md:hidden")} aria-label="AI skill suggestions">
          {groups.map((group) => (
            <section className="border-t-8 border-canvas first:border-t-0" key={group.key}>
              <header className={cn("flex min-h-[50px] items-center justify-between gap-4 border-b border-border bg-surface-soft px-4 py-2.5 text-navy max-[1000px]:items-start max-[1000px]:flex-col max-[1000px]:gap-1 max-md:px-3.5 max-md:py-3", group.key === "LEAVE_BLANK" && "border-l-4 border-l-warning bg-warning-soft")}>
                <span className="flex items-center gap-2 text-sm">
                  {group.key === "LEAVE_BLANK" ? <CircleHelp aria-hidden="true" className="text-warning" size={17} /> : <span className={groupDotClass(group.key)} />}
                  <strong>{group.label}</strong>
                  <span className="inline-grid size-6 place-items-center rounded-full border border-border bg-surface text-[11px] font-extrabold text-muted-foreground">{group.suggestions.length}</span>
                </span>
                {group.key === "LEAVE_BLANK" ? <small className="text-xs leading-relaxed text-muted-foreground">AI did not have enough evidence for a draft credit.</small> : null}
              </header>
              {group.suggestions.map((suggestion) => {
                const decision = data.decisions.find((candidate) => candidate.suggestionId === suggestion.id);
                const isExpanded = expanded.has(suggestion.id);
                const confidence = suggestion.source === "MODEL" ? confidenceLabel(suggestion.confidence) : null;
                return (
                  <article className={cn("relative border-b border-border p-4 last:border-b-0 max-md:px-3.5 max-md:py-4", selectedId === suggestion.id && "bg-[#f7fcfb] shadow-[inset_4px_0_0_var(--primary)]")} key={suggestion.id}>
                    <button className="block w-full bg-transparent p-0 text-left" onClick={() => selectSuggestion(suggestion)} type="button">
                      <span className="flex items-baseline gap-2.5 max-md:items-start"><span className="text-[13px] font-extrabold text-muted-foreground">{suggestion.skillCode}</span><strong className="font-heading text-[17px] leading-snug text-navy max-md:text-base">{suggestion.skillName}</strong></span>
                      <span className="mt-1 block text-xs text-muted-foreground">{suggestion.domain}{suggestion.strand ? ` · ${suggestion.strand}` : ""}</span>
                    </button>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {suggestion.source === "EDUCATOR" ? (
                        <Badge variant="outline"><Pencil aria-hidden="true" size={13} /> Added by you</Badge>
                      ) : null}
                      {decision?.concernFlag ? <Badge variant="warning">O concern flag</Badge> : null}
                      {confidence ? <ConfidenceIndicator label={confidence} /> : null}
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
                            <Clock3 aria-hidden="true" size={13} /> {index === 0 ? "Primary" : `Supporting ${index}`} · {formatTime(evidence.timestampSeconds)}
                          </button>
                        );
                      })}
                      {decision ? (
                        <Badge className={decisionBadgeClass(decision)} variant="outline">
                          {decision.dismissed ? <X aria-hidden="true" size={13} /> : <Check aria-hidden="true" size={13} />}
                          {decisionLabel(decision)}
                        </Badge>
                      ) : <Badge variant="secondary">Not reviewed</Badge>}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {!decision && suggestion.source === "MODEL" && suggestion.draftCredit !== null ? (
                        <Button disabled={saving} onClick={() => void saveDecision(suggestion, { finalCredit: suggestion.draftCredit, dismissed: false, concernFlag: false, note: null })} size="xs" type="button"><Check aria-hidden="true" size={14} /> Accept {creditPresentation[suggestion.draftCredit].shortLabel}</Button>
                      ) : !decision && suggestion.source === "MODEL" ? (
                        <Button disabled={saving} onClick={() => void saveDecision(suggestion, { finalCredit: "BLANK", dismissed: false, concernFlag: false, note: null })} size="xs" type="button"><Check aria-hidden="true" size={14} /> Leave blank</Button>
                      ) : null}
                      <Button disabled={saving} onClick={() => selectSuggestion(suggestion, true)} size="xs" type="button" variant="secondary"><Pencil aria-hidden="true" size={14} /> {decision ? "Change decision" : "Edit / add note"}</Button>
                    </div>
                    {suggestion.source === "EDUCATOR" ? null : <>
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
                        {isExpanded ? <ChevronDown aria-hidden="true" size={15} /> : <ChevronRight aria-hidden="true" size={15} />} {aiReasonTitle(suggestion)}
                      </button>
                      {isExpanded ? (
                        <div className="mt-2 border-l-2 border-[#9fcac4] py-0.5 pl-3">
                          {suggestion.uncertaintyReason ? <p className="my-1.5 text-xs leading-relaxed text-muted-foreground">{suggestion.uncertaintyReason}</p> : null}
                          {suggestion.evidence.map((evidence, index) => {
                            const evidenceKey = `${suggestion.id}-${index}`;
                            return <p className="my-1.5 grid grid-cols-[auto_1fr] gap-x-2 text-xs leading-relaxed text-muted-foreground max-md:grid-cols-1 max-md:gap-y-1" key={evidenceKey}><button aria-pressed={activeEvidence === evidenceKey} className={cn("self-start bg-transparent p-0 text-left font-extrabold text-primary-strong", activeEvidence === evidenceKey && "ring-2 ring-ring ring-offset-2")} onClick={() => seek(evidenceKey, evidence.timestampSeconds)} type="button">{evidenceMomentLabel(index)} · {formatTime(evidence.timestampSeconds)}</button><span>{evidence.explanation}</span></p>;
                          })}
                        </div>
                      ) : null}
                    </>}
                  </article>
                );
              })}
            </section>
          ))}
          {data.availableSkills.length > 0 && data.assessment.status !== "FINALIZED" ? (
            <section aria-label="Add a skill the AI missed" className="border-t-8 border-canvas first:border-t-0">
              {addOpen ? (
                <div className="grid gap-3 p-4 max-md:px-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="font-heading text-[17px] text-navy">Add a skill the AI missed</strong>
                    <Button disabled={addPending} onClick={() => { setAddOpen(false); setAddError(null); }} size="xs" type="button" variant="secondary"><X aria-hidden="true" size={14} /> Cancel</Button>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">Choose the section or domain, strand, skill, and your credit. The entry is recorded as added by you.</p>
                  <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                  <label className="grid gap-1.5 text-[11px] font-extrabold uppercase text-muted-foreground">Domain / section
                    <select
                      aria-label="Domain / section"
                      className="h-10 rounded-md border border-border-strong bg-surface px-2.5 text-sm font-normal normal-case text-ink"
                      disabled={addPending}
                      onChange={(event) => {
                        setAddDomain(event.target.value);
                        setAddStrand("");
                        setAddSkillId("");
                        setAddCredit(null);
                      }}
                      value={addDomain}
                    >
                      <option value="">Choose a domain or section...</option>
                      {addDomains.map((skill) => <option key={skill.domain} value={skill.domain}>{skill.domain}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-[11px] font-extrabold uppercase text-muted-foreground">Strand
                    <select aria-label="Strand" className="h-10 rounded-md border border-border-strong bg-surface px-2.5 text-sm font-normal normal-case text-ink" disabled={addPending || !addDomain} onChange={(event) => { setAddStrand(event.target.value); setAddSkillId(""); setAddCredit(null); }} value={addStrand}>
                      <option value="">Choose a strand...</option>
                      {addStrands.map((strand) => <option key={strand} value={strand}>{strand}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-[11px] font-extrabold uppercase text-muted-foreground">Skill
                    <select aria-label="Skill" className="h-10 rounded-md border border-border-strong bg-surface px-2.5 text-sm font-normal normal-case text-ink" disabled={addPending || !addStrand} onChange={(event) => { setAddSkillId(event.target.value); setAddCredit(null); }} value={addSkillId}>
                      <option value="">Choose a skill...</option>
                      {addSkillOptions.map((skill) => <option key={skill.sourceSkillId} value={skill.sourceSkillId}>{skill.skillCode} · {skill.skillName}{skill.rawAgeRange ? ` (${skill.rawAgeRange} mo.)` : ""}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-[11px] font-extrabold uppercase text-muted-foreground">Credit
                    <select aria-label="Credit" className="h-10 rounded-md border border-border-strong bg-surface px-2.5 text-sm font-normal normal-case text-ink" disabled={addPending || !addSkillId} onChange={(event) => { const credit = event.target.value ? event.target.value as PrimaryCredit : null; setAddCredit(credit); if (credit === "BLANK") setAddConcernFlag(false); }} value={addCredit ?? ""}>
                      <option value="">Choose a credit...</option>
                      {addSkillId ? [...standardCredits, ...educatorOnlyCreditsFor(
                        addSkillOptions.find((skill) => skill.sourceSkillId === addSkillId)?.domain ?? addDomain,
                        addSkillOptions.find((skill) => skill.sourceSkillId === addSkillId)?.sensoryCreditKeys
                      )].map((credit) => <option key={credit} value={credit}>{creditPresentation[credit].symbol} {creditPresentation[credit].label}</option>) : null}
                    </select>
                  </label>
                  </div>
                  <label className="flex items-start gap-2.5 text-sm text-ink">
                    <input checked={addConcernFlag} className="mt-0.5 size-4" disabled={addPending || addCredit === "BLANK"} onChange={(event) => setAddConcernFlag(event.target.checked)} type="checkbox" />
                    <span><strong>O concern flag</strong><small className="mt-0.5 block text-xs text-muted-foreground">Family, environment, or relationship concern; added to the selected credit.</small></span>
                  </label>
                  <label className="grid gap-1.5 text-[11px] font-extrabold uppercase text-muted-foreground">Note (optional)
                    <Textarea disabled={addPending} maxLength={1000} onChange={(event) => setAddNote(event.target.value)} rows={2} value={addNote} />
                  </label>
                  {addError ? <Alert variant="destructive"><AlertDescription>{addError}</AlertDescription></Alert> : null}
                  <Button className="justify-self-start" disabled={addPending || !addDomain || !addStrand || !addSkillId || !addCredit} onClick={() => void addSkill()} type="button">
                    {addPending ? "Adding..." : "Add and score skill"}
                  </Button>
                </div>
              ) : (
                <div className="p-4 max-md:px-3.5">
                  <Button onClick={() => setAddOpen(true)} type="button" variant="secondary"><Plus aria-hidden="true" size={15} /> Add a skill the AI missed</Button>
                </div>
              )}
            </section>
          ) : null}
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
                src={`${data.video.playbackUrl}&v=${videoVersion}`}
              >
                Your browser does not support video playback.
              </video>
            ) : (
              <div className="grid aspect-video w-full place-items-center content-center gap-2 bg-navy p-5 text-center text-white">
                <CircleHelp aria-hidden="true" className="size-[34px] text-[#b9d5df]" />
                <strong className="text-base">Video access unavailable</strong>
                <span className="max-w-[290px] text-xs leading-relaxed text-[#d8e6eb]">Restore secure access to continue playback. Your review changes are still here.</span>
                {data.video ? <Button onClick={() => void restoreVideo()} size="sm" type="button"><RefreshCw aria-hidden="true" size={15} /> Restore video access</Button> : null}
              </div>
            )}
            <div className="flex min-w-0 items-center justify-between gap-2.5 px-3 py-2.5 text-xs text-navy max-md:hidden"><span className="min-w-0 truncate">{data.video?.originalFilename ?? "No video"}</span><small className="inline-flex items-center gap-1 whitespace-nowrap text-muted-foreground"><ShieldCheck aria-hidden="true" size={13} /> Private assessment video</small></div>
          </section>

          {selected ? (
            <section className={cn("overflow-hidden rounded-md border border-border bg-surface p-[18px] shadow-[0_6px_20px_rgba(24,59,86,.04)] max-md:hidden", mobileEditorOpen && "max-md:block max-md:h-full max-md:w-full max-md:overflow-y-auto max-md:rounded-none max-md:border-0 max-md:px-4 max-md:pt-0 max-md:pb-6 max-md:shadow-none")} id="review-editor" aria-labelledby="editor-title">
              <div className="sticky top-0 z-[3] -mx-4 mb-5 hidden grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border bg-white/98 px-4 py-3.5 max-md:grid">
                <button className="inline-flex items-center gap-1 bg-transparent p-0 text-[11px] font-extrabold text-navy" onClick={closeMobileEditor} type="button"><ArrowLeft aria-hidden="true" className="size-[18px]" /> Back to items</button>
                <strong className="whitespace-nowrap text-center font-heading text-[17px] text-navy">Review {selected.skillCode}</strong>
                <span className={cn("justify-self-end text-[11px] font-extrabold text-muted-foreground", selectedDecision && "text-success", dirty && "text-warning")}>{dirty ? "Unsaved" : selectedDecision ? "Saved" : "Not reviewed"}</span>
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
                      src={`${data.video.playbackUrl}&v=${videoVersion}`}
                    />
                  ) : (
                    <div className="grid aspect-video w-full place-items-center gap-1 rounded-md bg-navy text-center text-[9px] text-white"><CircleHelp aria-hidden="true" /><span>Video access unavailable</span></div>
                  )}
                  <strong className="text-center font-heading text-2xl text-navy">{formatTime(Math.floor(lastVideoTime))}</strong>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <Eyebrow>Review {selected.skillCode}</Eyebrow>
                {selectedDecision ? <Badge className={decisionBadgeClass(selectedDecision)} variant="outline">{selectedDecision.dismissed ? <X aria-hidden="true" /> : <Check aria-hidden="true" />}{decisionLabel(selectedDecision)}</Badge> : <Badge variant="secondary">Not reviewed</Badge>}
              </div>
              <h2 className="mt-1 mb-2 font-heading text-[19px] font-normal leading-snug max-md:mt-2 max-md:text-[27px]" id="editor-title">{selected.skillName}</h2>
              <div className="flex items-center gap-1 text-xs text-primary-strong max-md:text-sm"><span>{selected.domain}{selected.strand ? ` · ${selected.strand}` : ""}</span></div>
              {selected.source === "MODEL" ? (
                <>
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-soft px-3 py-2.5">
                  <span className="text-[11px] font-extrabold uppercase text-muted-foreground">AI suggestion</span>
                  {selected.draftCredit ? <Badge variant="info">{creditPresentation[selected.draftCredit].symbol} {creditPresentation[selected.draftCredit].label}</Badge> : <Badge variant="warning">No draft credit</Badge>}
                  <ConfidenceIndicator label={confidenceLabel(selected.confidence)} />
                </div>
                <section aria-label={aiReasonTitle(selected)} className="mt-3 border-l-2 border-[#9fcac4] py-0.5 pl-3 max-md:mt-5">
                  <strong className="block text-xs text-navy">{aiReasonTitle(selected)}</strong>
                  {selected.uncertaintyReason ? <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{selected.uncertaintyReason}</p> : null}
                  <div className="mt-2 grid gap-2">
                    {selected.evidence.map((evidence, index) => {
                      const evidenceKey = `${selected.id}-${index}`;
                      return (
                        <div className="grid grid-cols-[auto_1fr] items-start gap-2 text-xs leading-relaxed text-muted-foreground max-md:grid-cols-1 max-md:gap-1.5" key={evidenceKey}>
                          <button
                            aria-pressed={activeEvidence === evidenceKey}
                            className={cn("inline-flex min-h-8 items-center gap-1 rounded-md border border-border-strong bg-surface px-2 py-1 text-left font-extrabold text-navy max-md:min-h-11 max-md:justify-self-start max-md:px-3 max-md:text-sm", activeEvidence === evidenceKey && "border-primary bg-primary text-white")}
                            onClick={() => seek(evidenceKey, evidence.timestampSeconds)}
                            type="button"
                          >
                            <Clock3 aria-hidden="true" size={14} /> {evidenceMomentLabel(index)} · {formatTime(evidence.timestampSeconds)}
                          </button>
                          <span className="pt-1.5 max-md:pt-0">{evidence.explanation}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
                </>
              ) : null}
              <fieldset className="mt-[18px] border-0 p-0 max-md:mt-6">
                <legend className="mb-2 block text-[11px] font-extrabold uppercase text-muted-foreground">Your decision</legend>
                <div className="grid grid-cols-4 overflow-hidden rounded-md border border-border-strong max-md:grid-cols-2">
                  {standardCredits.map((credit) => (
                    <button aria-pressed={draftCredit === credit} className={cn(creditButtonClass(draftCredit === credit), "mt-0 max-md:min-h-[82px]")} key={credit} onClick={() => { setDraftCredit(credit); if (credit === "BLANK") setDraftConcernFlag(false); }} type="button">
                      <strong>{creditPresentation[credit].symbol}</strong>
                      <span>{creditPresentation[credit].shortLabel}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <details className="group mt-[18px] rounded-md border border-border bg-surface">
                <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-extrabold text-navy focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35">
                  N/A, atypical, or concern options
                  <ChevronDown aria-hidden="true" className="transition-transform group-open:rotate-180" size={16} />
                </summary>
                <div className="border-t border-border p-3">
                  <fieldset className="border-0 p-0">
                    <legend className="mb-2 block text-[11px] font-extrabold uppercase text-muted-foreground">Educator-only credit</legend>
                    <div className="grid grid-cols-2 overflow-hidden rounded-md border border-border-strong">
                      {educatorOnlyCreditsFor(
                        selected.domain,
                        data.skillCreditRules.find((rule) => rule.sourceSkillId === selected.sourceSkillId)?.sensoryCreditKeys
                      ).map((credit) => (
                        <button aria-pressed={draftCredit === credit} className={cn(creditButtonClass(draftCredit === credit), "mt-0 min-h-[54px]")} key={credit} onClick={() => setDraftCredit(credit)} type="button">
                          <strong>{creditPresentation[credit].symbol}</strong>
                          <span>{creditPresentation[credit].shortLabel}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  {data.features.addOnFlags ? (
                    <label className="mt-4 flex items-start gap-2.5 text-sm text-ink">
                      <input checked={draftConcernFlag} className="mt-0.5 size-4" disabled={draftCredit === "BLANK"} onChange={(event) => setDraftConcernFlag(event.target.checked)} type="checkbox" />
                      <span><strong>O concern flag</strong><small className="mt-0.5 block text-xs text-muted-foreground">Family, environment, or relationship concern; added to the selected credit.</small></span>
                    </label>
                  ) : null}
                </div>
              </details>
              <label className="mt-[18px] mb-2 block text-[11px] font-extrabold uppercase text-muted-foreground max-md:mt-6 max-md:text-xs" htmlFor="review-note">Educator note <span className="font-normal normal-case">optional</span></label>
              <Textarea className="min-h-[84px] resize-y text-[13px] leading-relaxed max-md:min-h-[140px] max-md:text-[15px]" id="review-note" maxLength={1000} onChange={(event) => setDraftNote(event.target.value)} placeholder="Add context for this decision" rows={3} value={draftNote} />
              {dirty ? <p className="mt-2 text-xs font-extrabold text-warning">Unsaved changes</p> : null}
              {saveError ? (
                <Alert className="mt-3.5" variant="destructive">
                  <AlertCircle aria-hidden="true" size={19} />
                  <AlertDescription><strong className="block">Decision needs attention</strong><span>{saveError}</span><div className="mt-1 flex gap-3"><button className="text-[11px] font-extrabold underline underline-offset-2" onClick={discardDraft} type="button">Discard changes</button>{draftCredit ? <button className="text-[11px] font-extrabold underline underline-offset-2" onClick={() => void saveDecision(selected, { finalCredit: draftCredit, dismissed: false, concernFlag: draftConcernFlag, note: draftNote.trim() || null })} type="button">Retry save</button> : null}</div></AlertDescription>
                </Alert>
              ) : null}
              <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3.5 max-md:mx-[-16px] max-md:mt-6 max-md:grid max-md:grid-cols-2 max-md:px-4 max-md:py-3.5 max-md:pb-[calc(14px+env(safe-area-inset-bottom))]">
                <Button className="max-md:col-span-full max-md:justify-self-start" disabled={saving || Boolean(selectedDecision?.dismissed && !dirty)} onClick={() => void saveDecision(selected, { finalCredit: null, dismissed: true, concernFlag: false, note: draftNote.trim() || null })} size="sm" type="button" variant="destructive-outline"><X aria-hidden="true" size={15} /> {selectedDecision?.dismissed && !dirty ? "Suggestion dismissed" : "Dismiss suggestion"}</Button>
                <Button disabled={!dirty || saving} onClick={discardDraft} size="sm" type="button" variant="secondary">Discard</Button>
                <Button disabled={!canSaveDecision} onClick={() => void saveDecision(selected, { finalCredit: draftCredit, dismissed: false, concernFlag: draftConcernFlag, note: draftNote.trim() || null })} size="sm" type="button"><Save aria-hidden="true" size={15} /> {saving ? "Saving..." : selectedDecision ? "Save changes" : "Save decision"}</Button>
              </div>
            </section>
          ) : null}
        </aside>
      </div>

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

function groupDotClass(group: ReviewGroup): string {
  const base = "size-[9px] rounded-full";
  if (group === "PRESENT") return `${base} bg-success`;
  if (group === "EMERGING") return `${base} bg-warning`;
  if (group === "NOT_OBSERVED") return `${base} bg-destructive`;
  if (group === "EDUCATOR_ADDED") return `${base} bg-primary`;
  return `${base} bg-muted-foreground`;
}

function decisionBadgeClass(decision: SavedReviewDecision): string {
  if (decision.dismissed) return "border-border bg-surface-soft text-muted-foreground";
  if (decision.origin === "ACCEPTED" || decision.origin === "SCORED_INDEPENDENTLY" || decision.origin === "MANUALLY_ADDED") return "border-[#b8d8d3] bg-accent text-primary-strong";
  if (decision.origin === "OVERRIDDEN") return "border-warning-border bg-warning-soft text-warning-strong";
  return "border-border bg-surface-soft text-muted-foreground";
}

function ConfidenceIndicator({ label }: { readonly label: "High" | "Medium" | "Not sure" }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-extrabold",
        label === "High" && "border-success-border bg-success-soft text-success-strong",
        label === "Medium" && "border-info-border bg-info-soft text-info-strong",
        label === "Not sure" && "border-warning-border bg-warning-soft text-warning-strong"
      )}
    >
      {label === "Not sure" ? <CircleHelp aria-hidden="true" size={13} /> : <Sparkles aria-hidden="true" size={13} />}
      AI confidence: {label}
    </span>
  );
}

function creditButtonClass(selected: boolean): string {
  return cn(
    "grid min-h-[60px] place-items-center content-center gap-1 border-0 border-r border-border bg-surface text-navy last:border-r-0 hover:bg-accent [&_strong]:text-[17px] [&_span]:text-[11px] [&_span]:text-muted-foreground max-md:min-h-16 max-md:border-b max-md:[&:nth-child(2)]:border-r-0 max-md:[&:nth-child(n+3)]:border-b-0",
    selected && "bg-accent text-primary-strong shadow-[inset_0_-3px_0_var(--primary)]"
  );
}
