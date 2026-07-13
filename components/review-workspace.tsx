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
import { handleProtectedResponse } from "@/lib/help-review/client-http";
import type { PrimaryCredit, ReviewSummary, SavedReviewDecision, SkillSuggestion } from "@/lib/help-review/domain";
import type { PilotChild } from "@/lib/help-review/models";
import { creditPresentation, formatDate } from "@/lib/help-review/presentation";

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
      <main className="page-shell review-state-page">
        <Link className="back-link" href="/children"><ArrowLeft aria-hidden="true" size={16} /> Back to children</Link>
        <PageState
          description="The analysis result did not pass validation, so no partial draft suggestions are displayed. Your assessment and private video remain available."
          kind="error"
          title="Review is not available"
        >
          <Link className="button secondary" href="/children">Return to children</Link>
          <Link className="button primary icon-text" href={`/assessments/${assessmentId}/processing`}><RefreshCw aria-hidden="true" size={16} /> Review processing</Link>
        </PageState>
        <p className="review-state-note"><ShieldCheck aria-hidden="true" size={15} /> No incomplete scoring result was shown or applied.</p>
      </main>
    );
  }
  if (pageError) {
    return (
      <main className="page-shell review-state-page">
        <Link className="back-link" href="/children"><ArrowLeft aria-hidden="true" size={16} /> Back to children</Link>
        <PageState description={pageError} kind="error" title="Review could not be loaded">
          <button className="button primary icon-text" onClick={() => void loadProjection()} type="button"><RefreshCw aria-hidden="true" size={16} /> Try again</button>
        </PageState>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="review-page review-loading" aria-busy="true">
        <header className="review-toolbar">
          <div className="review-toolbar-inner">
            <div className="review-title-skeleton"><span className="skeleton-square" /><span><span className="skeleton-line" /><span className="skeleton-line wide" /></span></div>
            <div className="review-count-skeleton"><span className="skeleton-line" /><span className="skeleton-line" /><span className="skeleton-line" /></div>
            <div className="review-action-skeleton"><span className="skeleton-line wide" /><span className="skeleton-button" /></div>
          </div>
        </header>
        <div className="review-loading-notice"><span className="spin-dot" /><span>Loading suggestions, saved decisions, and secure video access...</span></div>
        <div className="review-layout">
          <section className="suggestion-groups skeleton-list" aria-label="Loading suggestions">
            {Array.from({ length: 7 }, (_, index) => <div className="skeleton-row" key={index}><span /><span /><span /></div>)}
          </section>
          <aside className="review-rail">
            <div className="video-panel skeleton-video"><span>Preparing secure video</span></div>
            <div className="editor-panel skeleton-editor"><span className="skeleton-line" /><span className="skeleton-line wide" /><span className="skeleton-block" /></div>
          </aside>
        </div>
        <span className="sr-only" role="status">Loading review workspace</span>
      </main>
    );
  }

  return (
    <main className={`review-page${mobileEditorOpen ? " mobile-editor-open" : ""}`}>
      <header className="review-toolbar">
        <div className="review-toolbar-inner">
          <div className="review-title">
            <Link className="icon-button" href={`/children/${data.child.id}`} title="Back to child">
              <ArrowLeft aria-hidden="true" size={18} />
              <span className="sr-only">Back to child</span>
            </Link>
            <div>
              <span className="eyebrow">Assessment review</span>
              <h1>Review AI draft</h1>
              <p>{data.child.externalChildId} · {formatDate(data.assessment.observationDate)}</p>
            </div>
          </div>
          <div className="credit-counts" aria-label="Draft credit groups">
            <span className="count-present"><i aria-hidden="true" /><strong>{data.suggestions.filter((item) => item.draftCredit === "PRESENT").length}</strong> Present</span>
            <span className="count-emerging"><i aria-hidden="true" /><strong>{data.suggestions.filter((item) => item.draftCredit === "EMERGING").length}</strong> Emerging</span>
            <span className="count-not-observed"><i aria-hidden="true" /><strong>{data.suggestions.filter((item) => item.draftCredit === "NOT_OBSERVED").length}</strong> Not observed</span>
            <span className="count-needs-review"><AlertTriangle aria-hidden="true" size={14} /><strong>{data.suggestions.filter((item) => item.draftCredit === null).length}</strong> Need review</span>
          </div>
          <div className="review-completion">
            <div>
              <span><strong>{data.summary.progress.actioned}</strong> of {data.summary.progress.total} actioned</span>
              <progress aria-label={`${data.summary.progress.actioned} of ${data.summary.progress.total} suggestions actioned`} max={data.summary.progress.total} value={data.summary.progress.actioned} />
            </div>
            <button
              className="button primary"
              onClick={() => {
                if (dirty) setSaveError("Save or discard the open decision before finishing review.");
                else router.push(`/assessments/${assessmentId}/summary`);
              }}
              type="button"
            >
              Finish &amp; review <ChevronRight aria-hidden="true" size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="review-layout">
        <div className="review-mobile-tabs" role="tablist" aria-label="Review workspace">
          <button aria-selected="true" role="tab" type="button">Items <span>{data.suggestions.length}</span></button>
          <button disabled={!selected} onClick={() => selected && selectSuggestion(selected, true)} role="tab" type="button">Decision</button>
        </div>

        <section className="suggestion-groups" aria-label="AI skill suggestions">
          {groups.map((group) => (
            <section className={`suggestion-group group-${group.key.toLowerCase()}`} key={group.key}>
              <header className="group-header">
                <span>
                  {group.key === "NEEDS_REVIEW" ? <AlertTriangle aria-hidden="true" size={17} /> : <span className="group-dot" />}
                  <strong>{group.label}</strong>
                  <span className="group-count">{group.suggestions.length}</span>
                </span>
                {group.key === "NEEDS_REVIEW" ? <small>AI could not draft a credit. Score independently.</small> : null}
              </header>
              {group.suggestions.map((suggestion) => {
                const decision = data.decisions.find((candidate) => candidate.suggestionId === suggestion.id);
                const isExpanded = expanded.has(suggestion.id);
                return (
                  <article className={`suggestion-row${selectedId === suggestion.id ? " selected" : ""}`} key={suggestion.id}>
                    <button className="suggestion-select" onClick={() => selectSuggestion(suggestion)} type="button">
                      <span className="skill-heading"><span className="skill-code">{suggestion.skillCode}</span><strong>{suggestion.skillName}</strong></span>
                      <span className="skill-domain">{suggestion.domain}{suggestion.strand ? ` · ${suggestion.strand}` : ""}</span>
                    </button>
                    <div className="evidence-meta">
                      {suggestion.uncertaintyReason ? (
                        <span className="uncertainty"><AlertTriangle aria-hidden="true" size={13} /> Model uncertain</span>
                      ) : suggestion.confidence !== null ? (
                        <span className="confidence"><Sparkles aria-hidden="true" size={13} /> {Math.round(suggestion.confidence * 100)}% confidence</span>
                      ) : null}
                      {suggestion.evidence.map((evidence, index) => {
                        const evidenceKey = `${suggestion.id}-${index}`;
                        return (
                          <button
                            aria-pressed={activeEvidence === evidenceKey}
                            className={`timestamp${activeEvidence === evidenceKey ? " selected" : ""}`}
                            key={evidenceKey}
                            onClick={() => seek(evidenceKey, evidence.timestampSeconds)}
                            type="button"
                          >
                            <Clock3 aria-hidden="true" size={13} /> {formatTime(evidence.timestampSeconds)}
                          </button>
                        );
                      })}
                      {decision ? (
                        <span className={`decision-badge origin-${decision.origin.toLowerCase()}`}><Check aria-hidden="true" size={13} /> {decision.origin.replaceAll("_", " ").toLowerCase()}</span>
                      ) : <span className="decision-badge pending">unactioned</span>}
                    </div>
                    {suggestion.draftCredit === null ? (
                      <div className="quick-credit" role="group" aria-label={`Score ${suggestion.skillName}`}>
                        {(Object.keys(creditPresentation) as PrimaryCredit[]).map((credit) => (
                          <button
                            aria-pressed={decision?.finalCredit === credit}
                            className={decision?.finalCredit === credit ? "selected" : ""}
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
                      <div className="item-actions">
                        <button disabled={saving} onClick={() => void saveDecision(suggestion, { finalCredit: suggestion.draftCredit, dismissed: false, note: decision?.note ?? null })} type="button"><Check aria-hidden="true" size={14} /> Accept draft</button>
                        <button onClick={() => selectSuggestion(suggestion, true)} type="button"><Pencil aria-hidden="true" size={14} /> Edit</button>
                        <button onClick={() => selectSuggestion(suggestion, true)} type="button"><MessageSquareText aria-hidden="true" size={14} /> Note</button>
                        <button disabled={saving} onClick={() => void saveDecision(suggestion, { finalCredit: null, dismissed: true, note: decision?.note ?? null })} type="button"><X aria-hidden="true" size={14} /> Dismiss</button>
                      </div>
                    )}
                    <button
                      aria-expanded={isExpanded}
                      className="evidence-toggle"
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
                      <div className="evidence-detail">
                        {suggestion.evidence.map((evidence, index) => {
                          const evidenceKey = `${suggestion.id}-${index}`;
                          return <p key={evidenceKey}><button aria-pressed={activeEvidence === evidenceKey} className={activeEvidence === evidenceKey ? "selected" : ""} onClick={() => seek(evidenceKey, evidence.timestampSeconds)} type="button">{formatTime(evidence.timestampSeconds)}</button>{evidence.explanation}</p>;
                        })}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </section>
          ))}
        </section>

        <aside className="review-rail">
          <section className="video-panel">
            {data.video && !videoUnavailable ? (
              <video
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
              <div className="video-unavailable">
                <CircleHelp aria-hidden="true" />
                <strong>Video access unavailable</strong>
                <span>Restore secure access to continue playback. Your review changes are still here.</span>
                {data.video ? <button className="button primary compact icon-text" onClick={restoreVideo} type="button"><RefreshCw aria-hidden="true" size={15} /> Restore video access</button> : null}
              </div>
            )}
            <div className="video-caption"><span>{data.video?.originalFilename ?? "No video"}</span><small><ShieldCheck aria-hidden="true" size={13} /> Private assessment video</small></div>
          </section>

          <section className="context-panel" aria-label="Assessment context">
            <dl>
              <div><dt>Child</dt><dd>{data.child.externalChildId}</dd></div>
              <div><dt>Age</dt><dd>{data.child.ageMonths} months</dd></div>
              <div><dt>Context</dt><dd>{data.child.contextLabel ?? "None supplied"}</dd></div>
              <div><dt>Status</dt><dd>AI draft</dd></div>
            </dl>
          </section>

          {selected ? (
            <section className="editor-panel" id="review-editor" aria-labelledby="editor-title">
              <div className="mobile-editor-header">
                <button className="mobile-back-button" onClick={closeMobileEditor} type="button"><ArrowLeft aria-hidden="true" /> Back to items</button>
                <strong>Editing {selected.skillCode}</strong>
                <span className={dirty ? "dirty" : ""}>{dirty ? "Unsaved" : "Saved"}</span>
              </div>
              {mobileEditorOpen ? (
                <div className="mobile-editor-media">
                  {data.video && !videoUnavailable ? (
                    <video
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
                    <div className="mobile-video-unavailable"><CircleHelp aria-hidden="true" /><span>Video access unavailable</span></div>
                  )}
                  <strong>{formatTime(Math.floor(lastVideoTime))}</strong>
                </div>
              ) : null}
              <span className="eyebrow">Editing {selected.skillCode}</span>
              <h2 id="editor-title">{selected.skillName}</h2>
              <div className="editor-evidence-summary"><span>{selected.domain}{selected.strand ? ` · ${selected.strand}` : ""}</span></div>
              <div className="editor-evidence-links" aria-label="Evidence timestamps">
                {selected.evidence.map((evidence, index) => {
                  const evidenceKey = `${selected.id}-${index}`;
                  return <button aria-pressed={activeEvidence === evidenceKey} className={activeEvidence === evidenceKey ? "selected" : ""} key={evidenceKey} onClick={() => seek(evidenceKey, evidence.timestampSeconds)} type="button"><Clock3 aria-hidden="true" size={14} /> {formatTime(evidence.timestampSeconds)}</button>;
                })}
              </div>
              <fieldset>
                <legend>Educator credit</legend>
                <div className="editor-credit">
                  {(Object.keys(creditPresentation) as PrimaryCredit[]).map((credit) => (
                    <button aria-pressed={draftCredit === credit} className={draftCredit === credit ? "selected" : ""} key={credit} onClick={() => setDraftCredit(credit)} type="button">
                      <strong>{creditPresentation[credit].symbol}</strong>
                      <span>{creditPresentation[credit].shortLabel}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              {data.features.addOnFlags ? <fieldset className="add-on-flags"><legend>Add-on credits</legend></fieldset> : null}
              <label htmlFor="review-note">Educator note <span>optional</span></label>
              <textarea id="review-note" maxLength={1000} onChange={(event) => setDraftNote(event.target.value)} placeholder="Add context for this decision" rows={4} value={draftNote} />
              {dirty ? <p className="unsaved-label">Unsaved changes</p> : null}
              {saveError ? (
                <div className="inline-error" role="alert">
                  <AlertCircle aria-hidden="true" size={19} />
                  <div><strong>Decision needs attention</strong><span>{saveError}</span><div className="inline-error-actions"><button onClick={discardDraft} type="button">Discard changes</button>{draftCredit ? <button onClick={() => void saveDecision(selected, { finalCredit: draftCredit, dismissed: false, note: draftNote.trim() || null })} type="button">Retry save</button> : null}</div></div>
                </div>
              ) : null}
              <div className="editor-actions">
                <button className="button danger-quiet" disabled={saving} onClick={() => void saveDecision(selected, { finalCredit: null, dismissed: true, note: draftNote.trim() || null })} type="button"><X aria-hidden="true" size={15} /> Dismiss</button>
                <button className="button secondary" disabled={!dirty || saving} onClick={discardDraft} type="button">Discard</button>
                <button className="button primary icon-text" disabled={draftCredit === null || saving || !dirty} onClick={() => void saveDecision(selected, { finalCredit: draftCredit, dismissed: false, note: draftNote.trim() || null })} type="button"><Save aria-hidden="true" size={15} /> {saving ? "Saving..." : "Save decision"}</button>
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      {selected ? (
        <div className="mobile-review-action">
          <div><strong>{selected.skillCode} · {selected.skillName}</strong><small>{selected.domain}</small></div>
          <button className="button primary" onClick={() => selectSuggestion(selected, true)} type="button">Open decision editor</button>
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
