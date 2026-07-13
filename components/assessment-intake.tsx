"use client";

import { ArrowLeft, CalendarDays, CheckCircle2, FileVideo2, RefreshCw, ShieldAlert, ShieldCheck, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { PageState } from "@/components/page-state";
import { handleProtectedResponse, responseError } from "@/lib/help-review/client-http";
import type { PilotAssessment, PilotChild, StoredVideo } from "@/lib/help-review/models";
import { assessmentDestination } from "@/lib/help-review/presentation";

const acceptedTypes = ["video/mp4", "video/webm", "video/quicktime"];
const maxBytes = 100 * 1024 * 1024;

function uploadVideo(
  assessmentId: string,
  file: File,
  setProgress: (progress: number) => void
): Promise<StoredVideo> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `/api/assessments/${assessmentId}/upload`);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () => {
      let payload: { video?: StoredVideo; error?: string } = {};
      try { payload = JSON.parse(request.responseText) as typeof payload; } catch { /* safe fallback below */ }
      if (request.status >= 200 && request.status < 300 && payload.video) resolve(payload.video);
      else reject(new Error(payload.error ?? "The upload could not be completed."));
    });
    request.addEventListener("error", () => reject(new Error("The network interrupted the upload. Your assessment draft is still available.")));
    const formData = new FormData();
    formData.set("video", file);
    request.send(formData);
  });
}

export function AssessmentIntake() {
  const search = useSearchParams();
  const router = useRouter();
  const childId = search.get("childId");
  const queryAssessmentId = search.get("assessmentId");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftRequestIdRef = useRef<string | null>(null);
  const [child, setChild] = useState<PilotChild | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(queryAssessmentId);
  const [observationDate, setObservationDate] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [uploadedVideo, setUploadedVideo] = useState<StoredVideo | null>(null);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<"IDLE" | "UPLOADING" | "REMOVING" | "STARTING">("IDLE");
  const [error, setError] = useState<string | null>(childId ? null : "Choose an assigned child before starting an observation.");
  const [loading, setLoading] = useState(Boolean(childId));
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => {
    if (!childId) return;
    void fetch(`/api/children/${childId}`, { cache: "no-store" }).then(async (response) => {
      if (handleProtectedResponse(response, router, `/assessments/new?childId=${encodeURIComponent(childId)}`)) return;
      if (!response.ok) {
        setError("This child record could not be loaded.");
        setLoading(false);
        return;
      }
      const payload = await response.json() as { child: PilotChild; assessments: PilotAssessment[] };
      setChild(payload.child);
      const existing = payload.assessments.find((assessment) => assessment.id === queryAssessmentId);
      if (queryAssessmentId && !existing) {
        router.replace("/unavailable");
        return;
      }
      if (existing) {
        if (!["DRAFT", "FAILED"].includes(existing.status)) {
          router.replace(assessmentDestination(existing));
          return;
        }
        setObservationDate(existing.observationDate);
        setUploadedVideo(existing.video);
      }
      setLoading(false);
    }).catch(() => {
      setError("A temporary problem prevented this child record from loading.");
      setLoading(false);
    });
  }, [childId, queryAssessmentId, router]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    setError(null);
    if (next && !acceptedTypes.includes(next.type)) {
      setError("Choose an MP4, WebM, or MOV video.");
      event.target.value = "";
      return;
    }
    if (next && (next.size === 0 || next.size > maxBytes)) {
      setError("The video must be larger than 0 bytes and no more than 100 MB.");
      event.target.value = "";
      return;
    }
    setFile(next);
    setProgress(0);
  }

  async function ensureAssessment(): Promise<string> {
    if (assessmentId) return assessmentId;
    if (!child) throw new Error("Choose an assigned child before creating an assessment.");
    const createResponse = await fetch("/api/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        childId: child.id,
        observationDate,
        requestId: (draftRequestIdRef.current ??= window.crypto.randomUUID())
      })
    });
    if (handleProtectedResponse(createResponse, router, `/assessments/new?childId=${encodeURIComponent(child.id)}`)) {
      throw new Error("Your session needs to be renewed.");
    }
    const created = await createResponse.json() as { assessment?: PilotAssessment; error?: string };
    if (!createResponse.ok || !created.assessment) throw new Error(created.error ?? "The assessment draft could not be created.");
    const nextId = created.assessment.id;
    setAssessmentId(nextId);
    router.replace(`/assessments/new?childId=${child.id}&assessmentId=${nextId}`, { scroll: false });
    return nextId;
  }

  async function upload() {
    if (!child || !file) return;
    setError(null);
    setStep("UPLOADING");
    try {
      const currentAssessmentId = await ensureAssessment();
      const stored = await uploadVideo(currentAssessmentId, file, setProgress);
      setUploadedVideo(stored);
      setFile(null);
      setProgress(100);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The observation could not be uploaded.");
    } finally {
      setStep("IDLE");
    }
  }

  async function removeUpload() {
    if (!assessmentId) return;
    setStep("REMOVING");
    setError(null);
    try {
      const response = await fetch(`/api/assessments/${assessmentId}/upload`, { method: "DELETE" });
      if (handleProtectedResponse(response, router, `/assessments/new?childId=${childId}&assessmentId=${assessmentId}`)) return;
      if (!response.ok) setError(await responseError(response, "The uploaded video could not be removed."));
      else {
        setUploadedVideo(null);
        setFile(null);
        setProgress(0);
      }
    } catch {
      setError("The network interrupted removal. Refresh the draft to confirm the current video.");
    } finally {
      setStep("IDLE");
    }
  }

  async function startProcessing() {
    if (!assessmentId || !uploadedVideo) return;
    setStep("STARTING");
    setError(null);
    try {
      const response = await fetch(`/api/assessments/${assessmentId}/process`, { method: "POST" });
      if (handleProtectedResponse(response, router, `/assessments/new?childId=${childId}&assessmentId=${assessmentId}`)) return;
      if (!response.ok) {
        setError(await responseError(response, "Analysis could not be started."));
        setStep("IDLE");
        return;
      }
      router.push(`/assessments/${assessmentId}/processing`);
    } catch {
      setError("The network interrupted submission. Your uploaded video is still available.");
      setStep("IDLE");
    }
  }

  if (loading) return <main className="page-shell"><PageState description="Loading the assigned child and assessment draft." kind="loading" title="Loading observation" /></main>;
  if (!child) return <main className="page-shell"><PageState description={error ?? "Choose a child from your assigned list."} kind="unavailable" title="Observation unavailable"><Link className="button primary" href="/children">Return to assigned children</Link></PageState></main>;
  if (!child.processingAllowed) {
    return <main className="page-shell"><Link className="back-link" href={`/children/${child.id}`}><ArrowLeft aria-hidden="true" size={16} /> Back to child</Link><PageState description="Processing permission is not approved for this child. No video can be submitted until the pilot administrator resolves it." kind="unavailable" title="Upload unavailable"><a className="button primary" href="mailto:pilot-support@example.test">Contact administrator</a><Link className="button secondary" href={`/children/${child.id}`}>Return to child</Link></PageState></main>;
  }

  return (
    <main className="page-shell intake-shell">
      <Link className="back-link" href={`/children/${child.id}`}><ArrowLeft aria-hidden="true" size={16} /> Back to child</Link>
      <header className="page-heading"><span className="eyebrow">New observation</span><h1>Upload an observation</h1><p>Add one short observation video for this assessment.</p></header>
      {error ? <div className="notice error" role="alert">{error}</div> : null}
      <div className="intake-layout">
        <section className="intake-form" aria-labelledby="observation-details-title">
          <div className="section-heading compact"><div><span className="step-number">1</span><h2 id="observation-details-title">Observation details</h2></div></div>
          <div className="context-strip">
            <span><small>Child</small><strong>{child.externalChildId}</strong></span>
            <span><small>Age</small><strong>{child.ageMonths} months</strong></span>
            <span><small>Permission</small><strong className="success-text"><ShieldCheck aria-hidden="true" size={14} /> Approved</strong></span>
          </div>
          <label className="field-label" htmlFor="observation-date"><CalendarDays aria-hidden="true" size={16} /> Observation date</label>
          <input id="observation-date" type="date" value={observationDate} onChange={(event) => setObservationDate(event.target.value)} disabled={Boolean(assessmentId)} />

          <div className="section-heading compact upload-heading"><div><span className="step-number">2</span><h2>Observation video</h2></div></div>
          <input accept="video/mp4,video/webm,video/quicktime" className="sr-only" onChange={chooseFile} ref={fileInputRef} type="file" />
          {file ? (
            <div className="selected-video pending-file">
              <video controls preload="metadata" src={previewUrl ?? undefined} />
              <div className="selected-file-meta"><FileVideo2 aria-hidden="true" size={20} /><span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} MB · ready to upload</small></span><button className="icon-button" onClick={() => setFile(null)} title="Discard selected file" type="button"><Trash2 aria-hidden="true" size={17} /><span className="sr-only">Discard selected file</span></button></div>
              <div className="upload-file-actions"><button className="button secondary" onClick={() => fileInputRef.current?.click()} type="button">Choose another</button><button className="button primary icon-text" disabled={step !== "IDLE"} onClick={() => void upload()} type="button"><Upload aria-hidden="true" size={16} /> Upload video</button></div>
            </div>
          ) : uploadedVideo ? (
            <div className="upload-ready-panel">
              <span className="upload-ready-mark"><CheckCircle2 aria-hidden="true" /></span><div><span className="eyebrow">Upload complete</span><h3>{uploadedVideo.originalFilename}</h3><p>{(uploadedVideo.byteSize / 1024 / 1024).toFixed(1)} MB · private assessment video</p></div>
              <div className="upload-ready-actions"><button className="button secondary" disabled={step !== "IDLE"} onClick={() => fileInputRef.current?.click()} type="button"><RefreshCw aria-hidden="true" size={15} /> Replace</button><button className="icon-button danger-icon" disabled={step !== "IDLE"} onClick={() => void removeUpload()} title="Remove uploaded video" type="button"><Trash2 aria-hidden="true" size={17} /><span className="sr-only">Remove uploaded video</span></button></div>
            </div>
          ) : (
            <button className="drop-zone" onClick={() => fileInputRef.current?.click()} type="button"><span className="upload-icon"><Upload aria-hidden="true" /></span><strong>Choose a video</strong><span>MP4, WebM, or MOV · maximum 100 MB</span></button>
          )}
          {step === "UPLOADING" ? <div className="upload-progress" aria-live="polite"><div><span>Uploading video</span><span>{progress}%</span></div><progress max="100" value={progress} /></div> : null}
          <div className="form-actions">
            <Link className="button secondary" href={`/children/${child.id}`}>Save and exit</Link>
            <button className="button primary icon-text" disabled={!uploadedVideo || Boolean(file) || step !== "IDLE"} onClick={() => void startProcessing()} type="button"><ShieldCheck aria-hidden="true" size={17} /> {step === "STARTING" ? "Starting..." : "Start processing"}</button>
          </div>
        </section>
        <aside className="workflow-aside"><ShieldAlert aria-hidden="true" size={20} /><span><strong>Private by default</strong><small>The video is shared only with the authorized scoring service and assigned educator.</small></span><ol><li><strong>Upload verified</strong><span>The file remains in this assessment draft.</span></li><li><strong>Analysis runs</strong><span>You may leave while suggestions are prepared.</span></li><li><strong>Human review</strong><span>You decide every final HELP credit.</span></li></ol></aside>
      </div>
    </main>
  );
}
