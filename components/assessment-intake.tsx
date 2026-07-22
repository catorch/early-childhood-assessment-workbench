"use client";

import { ArrowLeft, CalendarDays, CheckCircle2, FileVideo2, RefreshCw, ShieldAlert, ShieldCheck, Trash2, Upload } from "lucide-react";
import { upload as uploadBlob } from "@vercel/blob/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { PageState } from "@/components/page-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { backLinkClass, Eyebrow, PageShell } from "@/components/ui/app-patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { handleProtectedResponse, responseError } from "@/lib/help-review/client-http";
import type { AssessmentHistoryItem, ClientVideo, PilotChild } from "@/lib/help-review/models";
import { SUPPORT_CONTACT_HREF } from "@/lib/help-review/support-contact";
import {
  VIDEO_CONTENT_TYPES,
  VIDEO_MAX_BYTES,
  VIDEO_MAX_DURATION_SECONDS
} from "@/lib/help-review/video-policy";

const acceptedTypes: readonly string[] = VIDEO_CONTENT_TYPES;
const maxBytes = VIDEO_MAX_BYTES;
const maxDurationSeconds = VIDEO_MAX_DURATION_SECONDS;

interface VideoMetadata {
  readonly durationSeconds: number;
  readonly checksumSha256: string;
}

async function inspectVideo(file: File): Promise<VideoMetadata> {
  const checksum = await window.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const checksumSha256 = [...new Uint8Array(checksum)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const durationSeconds = await new Promise<number>((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = Math.ceil(video.duration);
      cleanup();
      if (!Number.isFinite(duration) || duration <= 0) reject(new Error("The video duration could not be verified."));
      else resolve(duration);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("The video metadata could not be read."));
    };
    video.src = url;
  });
  if (durationSeconds > maxDurationSeconds) {
    throw new Error("The observation video must be 5 minutes or shorter.");
  }
  return { durationSeconds, checksumSha256 };
}

function uploadVideoThroughServer(
  assessmentId: string,
  file: File,
  metadata: VideoMetadata,
  setProgress: (progress: number) => void
): Promise<ClientVideo> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `/api/assessments/${assessmentId}/upload`);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () => {
      let payload: { video?: ClientVideo; error?: string } = {};
      try { payload = JSON.parse(request.responseText) as typeof payload; } catch { /* safe fallback below */ }
      if (request.status >= 200 && request.status < 300 && payload.video) resolve(payload.video);
      else reject(new Error(payload.error ?? "The upload could not be completed."));
    });
    request.addEventListener("error", () => reject(new Error("The network interrupted the upload. Your assessment draft is still available.")));
    const formData = new FormData();
    formData.set("video", file);
    formData.set("durationSeconds", String(metadata.durationSeconds));
    formData.set("checksumSha256", metadata.checksumSha256);
    request.send(formData);
  });
}

function uploadExtension(file: File): string {
  const extension = file.name.toLowerCase().match(/\.(mp4|webm|mov)$/)?.[0];
  if (extension) return extension;
  if (file.type === "video/webm") return ".webm";
  if (file.type === "video/quicktime") return ".mov";
  return ".mp4";
}

async function waitForRecordedBlob(assessmentId: string, videoId: string): Promise<ClientVideo> {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const response = await fetch(`/api/assessments/${assessmentId}/upload`, { cache: "no-store" });
    const payload = await response.json() as { video?: ClientVideo | null; error?: string };
    if (!response.ok) throw new Error(payload.error ?? "The completed upload could not be verified.");
    if (payload.video?.id === videoId) return payload.video;
    await new Promise((resolve) => window.setTimeout(resolve, 500));
  }
  throw new Error("The video was uploaded, but its assessment record is still being verified. Refresh this draft shortly.");
}

function putGcsObject(
  uploadUrl: string,
  file: File,
  setProgress: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    request.setRequestHeader("Content-Type", file.type);
    request.setRequestHeader("Content-Range", `bytes 0-${file.size - 1}/${file.size}`);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 95));
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error("Google Cloud Storage could not finalize the video upload."));
    });
    request.addEventListener("error", () => reject(new Error(
      "The network interrupted the Google Cloud upload. You can retry from this draft."
    )));
    request.send(file);
  });
}

async function uploadVideoToGcs(
  assessmentId: string,
  file: File,
  metadata: VideoMetadata,
  setProgress: (progress: number) => void
): Promise<ClientVideo> {
  const route = `/api/assessments/${assessmentId}/upload`;
  const videoId = `video-${window.crypto.randomUUID()}`;
  const initiationResponse = await fetch(route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "initiate",
      assessmentId,
      videoId,
      originalFilename: file.name,
      contentType: file.type,
      byteSize: file.size,
      durationSeconds: metadata.durationSeconds,
      checksumSha256: metadata.checksumSha256
    })
  });
  const initiation = await initiationResponse.json() as {
    readonly uploadUrl?: string;
    readonly completionToken?: string;
    readonly error?: string;
  };
  if (!initiationResponse.ok || !initiation.uploadUrl || !initiation.completionToken) {
    throw new Error(initiation.error ?? "The Google Cloud upload could not be authorized.");
  }
  await putGcsObject(initiation.uploadUrl, file, setProgress);
  setProgress(97);
  const completionResponse = await fetch(route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "complete", token: initiation.completionToken })
  });
  const completion = await completionResponse.json() as { readonly video?: ClientVideo; readonly error?: string };
  if (!completionResponse.ok || !completion.video) {
    throw new Error(completion.error ?? "The uploaded video could not be verified.");
  }
  setProgress(100);
  return completion.video;
}

async function uploadVideo(
  assessmentId: string,
  file: File,
  metadata: VideoMetadata,
  setProgress: (progress: number) => void
): Promise<ClientVideo> {
  const route = `/api/assessments/${assessmentId}/upload`;
  const configResponse = await fetch(route, { cache: "no-store" });
  const config = await configResponse.json() as { uploadMode?: "blob" | "gcs" | "server"; error?: string };
  if (!configResponse.ok) throw new Error(config.error ?? "The upload could not be authorized.");
  if (config.uploadMode === "gcs") return uploadVideoToGcs(assessmentId, file, metadata, setProgress);
  if (config.uploadMode !== "blob") return uploadVideoThroughServer(assessmentId, file, metadata, setProgress);

  const videoId = `video-${window.crypto.randomUUID()}`;
  const pathname = `help-review/${videoId}/${window.crypto.randomUUID()}${uploadExtension(file)}`;
  await uploadBlob(pathname, file, {
    access: "private",
    contentType: file.type,
    handleUploadUrl: route,
    clientPayload: JSON.stringify({
      assessmentId,
      videoId,
      originalFilename: file.name,
      contentType: file.type,
      byteSize: file.size,
      durationSeconds: metadata.durationSeconds,
      checksumSha256: metadata.checksumSha256
    }),
    multipart: file.size > 10 * 1024 * 1024,
    onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage))
  });
  setProgress(100);
  return waitForRecordedBlob(assessmentId, videoId);
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
  const [uploadedVideo, setUploadedVideo] = useState<ClientVideo | null>(null);
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
      const payload = await response.json() as { child: PilotChild; assessments: AssessmentHistoryItem[] };
      setChild(payload.child);
      const existing = payload.assessments.find((assessment) => assessment.id === queryAssessmentId);
      if (queryAssessmentId && !existing) {
        router.replace("/unavailable");
        return;
      }
      if (existing) {
        if (!["DRAFT", "FAILED"].includes(existing.status)) {
          router.replace(existing.actionHref);
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
    const created = await createResponse.json() as { assessment?: { readonly id: string }; error?: string };
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
      const metadata = await inspectVideo(file);
      const currentAssessmentId = await ensureAssessment();
      const stored = await uploadVideo(currentAssessmentId, file, metadata, setProgress);
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

  if (loading) return <PageShell><PageState description="Loading the assigned child and assessment draft." kind="loading" title="Loading observation" /></PageShell>;
  if (!child) return <PageShell><PageState description={error ?? "Choose a child from your assigned list."} kind="unavailable" title="Observation unavailable"><Button asChild><Link href="/children">Return to assigned children</Link></Button></PageState></PageShell>;
  if (!child.processingAllowed) {
    return <PageShell><Link className={backLinkClass} href={`/children/${child.id}`}><ArrowLeft aria-hidden="true" size={16} /> Back to child</Link><PageState description="Processing permission is not approved for this child. No video can be submitted until the pilot administrator resolves it." kind="unavailable" title="Upload unavailable">{SUPPORT_CONTACT_HREF ? <Button asChild><a href={SUPPORT_CONTACT_HREF}>Contact administrator</a></Button> : null}<Button asChild variant="secondary"><Link href={`/children/${child.id}`}>Return to child</Link></Button></PageState></PageShell>;
  }

  return (
    <PageShell>
      <Link className={backLinkClass} href={`/children/${child.id}`}><ArrowLeft aria-hidden="true" size={16} /> Back to child</Link>
      <header className="max-w-[720px]"><Eyebrow>New observation</Eyebrow><h1 className="mt-1 font-heading text-4xl font-bold leading-tight max-sm:text-[30px]">Upload observational video</h1><p className="mt-2.5 leading-relaxed text-muted-foreground">Add one short observational video for this assessment.</p></header>
      {error ? <Alert className="mt-7" variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <div className="mt-8 grid grid-cols-[minmax(0,1fr)_310px] items-start gap-12 max-md:grid-cols-1">
        <section className="border-t border-border pt-7" aria-labelledby="observation-details-title">
          <div className="mb-[18px] flex items-center gap-2.5"><span className="grid size-[26px] place-items-center rounded-full bg-navy text-xs font-extrabold text-white">1</span><h2 className="text-lg font-normal" id="observation-details-title">Observation details</h2></div>
          <div className="mb-6 grid grid-cols-3 overflow-hidden rounded-md border border-border bg-surface max-sm:grid-cols-1">
            <span className="grid gap-1 border-r border-border p-3.5 last:border-0 max-sm:border-r-0 max-sm:border-b"><small className="text-[11px] uppercase text-muted-foreground">Child</small><strong>{child.externalChildId}</strong></span>
            <span className="grid gap-1 border-r border-border p-3.5 last:border-0 max-sm:border-r-0 max-sm:border-b"><small className="text-[11px] uppercase text-muted-foreground">Age</small><strong>{child.ageMonths} months</strong></span>
            <span className="grid gap-1 p-3.5"><small className="text-[11px] uppercase text-muted-foreground">Permission</small><strong className="flex items-center gap-1 text-success"><ShieldCheck aria-hidden="true" size={14} /> Approved</strong></span>
          </div>
          <label className="mb-2 flex items-center gap-1.5 text-[13px] font-extrabold" htmlFor="observation-date"><CalendarDays aria-hidden="true" size={16} /> Observation date</label>
          <Input className="w-full max-w-[260px]" id="observation-date" type="date" value={observationDate} onChange={(event) => setObservationDate(event.target.value)} disabled={Boolean(assessmentId)} />

          <div className="mt-8 mb-[18px] flex items-center gap-2.5"><span className="grid size-[26px] place-items-center rounded-full bg-navy text-xs font-extrabold text-white">2</span><h2 className="text-lg font-normal">Observation video</h2></div>
          <input aria-label="Choose observation video" accept="video/mp4,video/webm,video/quicktime" className="sr-only" onChange={chooseFile} ref={fileInputRef} type="file" />
          {file ? (
            <div className="overflow-hidden rounded-md border border-border bg-surface">
              <video className="block max-h-[360px] w-full bg-navy" controls preload="metadata" src={previewUrl ?? undefined} />
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3"><FileVideo2 aria-hidden="true" className="text-primary" size={20} /><span className="grid min-w-0 gap-1"><strong className="truncate">{file.name}</strong><small className="text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB · ready to upload</small></span><Button aria-label="Discard selected file" onClick={() => setFile(null)} size="icon" title="Discard selected file" type="button" variant="outline"><Trash2 aria-hidden="true" size={17} /></Button></div>
              <div className="flex justify-end gap-2 border-t border-border p-3 max-sm:flex-col-reverse"><Button className="max-sm:w-full" onClick={() => fileInputRef.current?.click()} type="button" variant="secondary">Choose another</Button><Button className="max-sm:w-full" disabled={step !== "IDLE"} onClick={() => void upload()} type="button"><Upload aria-hidden="true" size={16} /> Upload video</Button></div>
            </div>
          ) : uploadedVideo ? (
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-md border border-success-border bg-success-soft p-5 max-sm:grid-cols-[auto_minmax(0,1fr)]">
              <span className="grid size-11 place-items-center rounded-full bg-success text-white"><CheckCircle2 aria-hidden="true" /></span><div className="min-w-0"><Eyebrow className="text-success before:bg-success">Upload complete</Eyebrow><h3 className="mt-1 truncate text-lg font-bold">{uploadedVideo.originalFilename}</h3><p className="mt-1 text-[13px] text-muted-foreground">{(uploadedVideo.byteSize / 1024 / 1024).toFixed(1)} MB · private assessment video</p></div>
              <div className="flex gap-2 max-sm:col-span-full max-sm:justify-end"><Button disabled={step !== "IDLE"} onClick={() => fileInputRef.current?.click()} type="button" variant="secondary"><RefreshCw aria-hidden="true" size={15} /> Replace</Button><Button aria-label="Remove uploaded video" disabled={step !== "IDLE"} onClick={() => void removeUpload()} size="icon" title="Remove uploaded video" type="button" variant="destructive-outline"><Trash2 aria-hidden="true" size={17} /></Button></div>
            </div>
          ) : (
            <button className="grid min-h-[230px] w-full place-items-center content-center gap-2 rounded-md border border-dashed border-border-strong bg-canvas text-center text-muted-foreground transition-colors hover:border-primary hover:bg-accent/30" onClick={() => fileInputRef.current?.click()} type="button"><span className="grid size-[52px] place-items-center rounded-full bg-accent text-primary-strong"><Upload aria-hidden="true" /></span><strong className="text-primary-strong">Choose a video</strong><span className="text-[13px]">MP4, WebM, or MOV · maximum 100 MB</span></button>
          )}
          {step === "UPLOADING" ? <div className="mt-4" aria-live="polite"><div className="mb-2 flex justify-between text-[13px] font-bold text-muted-foreground"><span>Uploading video</span><span>{progress}%</span></div><Progress aria-label={`Uploading video, ${progress}%`} value={progress} /></div> : null}
          <div className="mt-6 flex justify-end gap-2.5 border-t border-border pt-5 max-sm:[&>*]:flex-1">
            <Button asChild variant="secondary"><Link href={`/children/${child.id}`}>Save and exit</Link></Button>
            <Button disabled={!uploadedVideo || Boolean(file) || step !== "IDLE"} onClick={() => void startProcessing()} type="button"><ShieldCheck aria-hidden="true" size={17} /> {step === "STARTING" ? "Starting..." : "Start processing"}</Button>
          </div>
        </section>
        <aside className="border-l-2 border-border py-2 pl-6 max-md:border-t max-md:border-l-0 max-md:pt-6 max-md:pl-0"><div className="flex gap-2.5"><ShieldAlert aria-hidden="true" className="shrink-0 text-primary" size={20} /><span className="grid gap-1"><strong>Private by default</strong><small className="text-[13px] leading-relaxed text-muted-foreground">The video is shared only with the authorized scoring service and assigned educator.</small></span></div><ol className="mt-5 grid list-none gap-6 pl-0 [counter-reset:step]">{[["Upload verified", "The file remains in this assessment draft."], ["Analysis runs", "You may leave while suggestions are prepared."], ["Human review", "You decide every final HELP credit."]].map(([title, detail]) => <li className="relative grid gap-1 pl-8 [counter-increment:step] before:absolute before:top-0 before:left-0 before:grid before:size-[22px] before:place-items-center before:rounded-full before:border before:border-border-strong before:bg-surface before:text-[11px] before:font-extrabold before:text-primary-strong before:content-[counter(step)]" key={title}><strong>{title}</strong><span className="text-[13px] leading-relaxed text-muted-foreground">{detail}</span></li>)}</ol></aside>
      </div>
    </PageShell>
  );
}
