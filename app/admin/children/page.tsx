"use client";

import { ArrowRight, Baby, CheckCircle2, FileUp, Filter, Pencil, Plus, RefreshCw, Search, UserRoundCheck, UserRoundX, UsersRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChangeEvent, FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageState } from "@/components/page-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eyebrow, PageShell } from "@/components/ui/app-patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { handleProtectedResponse, responseError } from "@/lib/help-review/client-http";
import type { AccessProvision, ChildAssignment, PilotChild, PilotUser } from "@/lib/help-review/models";
import type { RosterImportIssue, RosterImportSummary } from "@/lib/help-review/roster-import";
import { cn } from "@/lib/utils";

interface ChildrenProjection {
  readonly children: PilotChild[];
  readonly assignments: ChildAssignment[];
  readonly educators: PilotUser[];
  readonly access: AccessProvision[];
  readonly assessmentCounts: Record<string, number>;
  readonly actorId: string;
}

type SupportContextValue = NonNullable<PilotChild["supportContext"]>;

const SUPPORT_CONTEXT_LABELS: Record<SupportContextValue, string> = {
  NONE_REPORTED: "None reported",
  IFSP: "IFSP",
  DISABILITY: "Disability",
  IFSP_AND_DISABILITY: "IFSP and disability",
  UNKNOWN: "Unknown"
};

interface ChildFormValues {
  externalChildId: string;
  ageMonths: string;
  supportContext: SupportContextValue;
  contextLabel: string;
  processingAllowed: boolean;
}

const emptyForm: ChildFormValues = {
  externalChildId: "",
  ageMonths: "",
  supportContext: "NONE_REPORTED",
  contextLabel: "",
  processingAllowed: true
};

type Confirmation =
  | { readonly kind: "DEACTIVATE_CHILD"; readonly child: PilotChild }
  | { readonly kind: "UNASSIGN"; readonly child: PilotChild; readonly educator: PilotUser }
  | { readonly kind: "APPLY_ROSTER"; readonly summary: RosterImportSummary };

function ChildFields({ values, onChange, identifierDisabled = false }: {
  readonly values: ChildFormValues;
  readonly onChange: (next: ChildFormValues) => void;
  readonly identifierDisabled?: boolean;
}) {
  return (
    <>
      <label className="grid gap-1.5 text-[11px] font-extrabold uppercase text-muted-foreground">Child identifier<Input disabled={identifierDisabled} maxLength={100} onChange={(event) => onChange({ ...values, externalChildId: event.target.value })} required value={values.externalChildId} /></label>
      <label className="grid gap-1.5 text-[11px] font-extrabold uppercase text-muted-foreground">Age (months)<Input inputMode="numeric" max={72} min={0} onChange={(event) => onChange({ ...values, ageMonths: event.target.value })} required type="number" value={values.ageMonths} /></label>
      <label className="grid gap-1.5 text-[11px] font-extrabold uppercase text-muted-foreground">Support context<select className="h-10 rounded-md border border-border-strong bg-surface px-2.5 text-sm text-ink" onChange={(event) => onChange({ ...values, supportContext: event.target.value as SupportContextValue })} value={values.supportContext}>{Object.entries(SUPPORT_CONTEXT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="grid gap-1.5 text-[11px] font-extrabold uppercase text-muted-foreground">Context label (optional)<Input maxLength={160} onChange={(event) => onChange({ ...values, contextLabel: event.target.value })} value={values.contextLabel} /></label>
      <label className="flex min-h-10 items-center gap-2 text-sm font-bold"><input checked={values.processingAllowed} className="size-4 accent-primary" onChange={(event) => onChange({ ...values, processingAllowed: event.target.checked })} type="checkbox" />Video processing permitted</label>
    </>
  );
}

function AdminChildrenContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("search") ?? "";
  const requestedStatus = searchParams.get("status");
  const statusFilter: "ALL" | "ACTIVE" | "INACTIVE" = requestedStatus === "ACTIVE" || requestedStatus === "INACTIVE" ? requestedStatus : "ALL";
  const [data, setData] = useState<ChildrenProjection | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addValues, setAddValues] = useState<ChildFormValues>(emptyForm);
  const [editOpen, setEditOpen] = useState(false);
  const [editValues, setEditValues] = useState<ChildFormValues>(emptyForm);
  const [importOpen, setImportOpen] = useState(false);
  const [importCsv, setImportCsv] = useState<{ readonly fileName: string; readonly csv: string } | null>(null);
  const [importPreview, setImportPreview] = useState<RosterImportSummary | null>(null);
  const [importIssues, setImportIssues] = useState<readonly RosterImportIssue[] | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const addTriggerRef = useRef<HTMLButtonElement | null>(null);
  const confirmationTriggerRef = useRef<HTMLButtonElement | null>(null);

  const load = useCallback(async () => {
    setData(null);
    try {
      const response = await fetch("/api/admin/children", { cache: "no-store" });
      if (handleProtectedResponse(response, router, "/admin/children")) return;
      if (!response.ok) {
        setError("A temporary problem prevented child records from loading. No records were changed.");
        return;
      }
      const projection = await response.json() as ChildrenProjection;
      setData(projection);
      setError(null);
      setSelectedChildId((current) => current && projection.children.some((child) => child.id === current) ? current : projection.children[0]?.id ?? null);
    } catch {
      setError("A temporary problem prevented child records from loading. No records were changed.");
    }
  }, [router]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const visibleChildren = useMemo(() => data?.children.filter((child) => {
    const matchesStatus = statusFilter === "ALL" || (statusFilter === "ACTIVE" ? child.isActive : !child.isActive);
    const needle = query.trim().toLowerCase();
    return matchesStatus && (!needle || child.externalChildId.toLowerCase().includes(needle) || (child.contextLabel ?? "").toLowerCase().includes(needle));
  }) ?? [], [data, query, statusFilter]);
  const selected = useMemo(() => visibleChildren.find((child) => child.id === selectedChildId) ?? null, [selectedChildId, visibleChildren]);

  function updateFilters(nextQuery: string, nextStatus = statusFilter) {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("search", nextQuery.trim());
    if (nextStatus !== "ALL") params.set("status", nextStatus);
    router.replace(params.size > 0 ? `/admin/children?${params}` : "/admin/children", { scroll: false });
  }

  function searchChildren(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFilters(String(new FormData(event.currentTarget).get("search") ?? ""));
  }

  async function mutate(body: object, key: string, endpoint = "/api/admin/children"): Promise<boolean> {
    setPendingKey(key);
    setError(null);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (handleProtectedResponse(response, router, "/admin/children")) return false;
      if (!response.ok) {
        setError(await responseError(response, "The child record change could not be completed."));
        return false;
      }
      await load();
      return true;
    } catch {
      setError("The network interrupted this change. Refresh before trying again.");
      return false;
    } finally {
      setPendingKey(null);
    }
  }

  function formPayload(values: ChildFormValues) {
    return {
      externalChildId: values.externalChildId.trim(),
      ageMonths: Number(values.ageMonths),
      supportContext: values.supportContext,
      contextLabel: values.contextLabel.trim(),
      processingAllowed: values.processingAllowed
    };
  }

  async function addChild(event: FormEvent) {
    event.preventDefault();
    setPendingKey("add");
    setError(null);
    try {
      const response = await fetch("/api/admin/children", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "CREATE_CHILD", ...formPayload(addValues) }) });
      if (handleProtectedResponse(response, router, "/admin/children")) return;
      if (!response.ok) setError(await responseError(response, "The child record could not be created."));
      else {
        const payload = await response.json() as { child: PilotChild };
        await load();
        setSelectedChildId(payload.child.id);
        setNotice(`${payload.child.externalChildId} was added. Assign an educator so observations can begin.`);
        setAddValues(emptyForm);
        setAddOpen(false);
      }
    } catch {
      setError("The network interrupted this change. Refresh before trying again.");
    } finally {
      setPendingKey(null);
    }
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const succeeded = await mutate({ action: "EDIT_CHILD", childId: selected.id, ...formPayload(editValues) }, "edit");
    if (succeeded) setEditOpen(false);
  }

  async function chooseRosterFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImportPreview(null);
    setImportIssues(null);
    setNotice(null);
    setError(null);
    const csv = await file.text();
    setImportCsv({ fileName: file.name, csv });
    await previewRoster(csv);
  }

  async function previewRoster(csv: string) {
    setPendingKey("roster-preview");
    try {
      const response = await fetch("/api/admin/roster", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv, apply: false }) });
      if (handleProtectedResponse(response, router, "/admin/children")) return;
      const payload = await response.json() as RosterImportSummary & { issues?: RosterImportIssue[]; error?: string };
      if (!response.ok) {
        setImportIssues(payload.issues ?? []);
        setError(payload.error ?? "The roster CSV did not pass validation.");
        return;
      }
      setImportPreview(payload);
    } catch {
      setError("The network interrupted the roster preview. Choose the file again.");
    } finally {
      setPendingKey(null);
    }
  }

  async function applyRoster() {
    if (!importCsv) return;
    setPendingKey("roster-apply");
    setError(null);
    try {
      const response = await fetch("/api/admin/roster", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv: importCsv.csv, apply: true }) });
      if (handleProtectedResponse(response, router, "/admin/children")) return;
      if (!response.ok) {
        setError(await responseError(response, "The roster import could not be applied."));
        return;
      }
      const summary = await response.json() as RosterImportSummary;
      await load();
      setNotice(`Roster import applied: ${summary.childrenCreated} added, ${summary.childrenUpdated} updated, ${summary.assignmentsCreated + summary.assignmentsActivated} assignments activated.`);
      setImportCsv(null);
      setImportPreview(null);
      setImportIssues(null);
      setImportOpen(false);
      setConfirmation(null);
    } catch {
      setError("The network interrupted the roster import. Preview the file again before applying.");
    } finally {
      setPendingKey(null);
    }
  }

  async function confirmMutation() {
    if (!confirmation) return;
    if (confirmation.kind === "APPLY_ROSTER") {
      await applyRoster();
      return;
    }
    const succeeded = confirmation.kind === "DEACTIVATE_CHILD"
      ? await mutate({ action: "SET_CHILD_ACTIVE", childId: confirmation.child.id, active: false }, "active")
      : await mutate({ action: "SET_ASSIGNMENT", userId: confirmation.educator.id, childId: confirmation.child.id, active: false }, confirmation.educator.id, "/api/admin/access");
    if (succeeded) setConfirmation(null);
  }

  function beginEdit() {
    if (!selected) return;
    setEditValues({
      externalChildId: selected.externalChildId,
      ageMonths: String(selected.ageMonths),
      supportContext: selected.supportContext ?? "UNKNOWN",
      contextLabel: selected.contextLabel ?? "",
      processingAllowed: selected.processingAllowed
    });
    setEditOpen((open) => !open);
  }

  const selectedAssignments = data && selected
    ? data.assignments.filter((assignment) => assignment.childId === selected.id && assignment.active)
    : [];

  return (
    <PageShell>
      <header className="flex items-end justify-between gap-6 max-sm:items-start max-sm:flex-col"><div><Eyebrow>Administration</Eyebrow><h1 className="mt-2.5 font-heading text-4xl font-bold leading-tight max-sm:text-[30px]">Children</h1><p className="mt-2.5 leading-relaxed text-muted-foreground">Add children one at a time or import the full roster, then assign educators.</p></div><div className="flex shrink-0 gap-2 max-sm:flex-col"><Button aria-controls="roster-import-panel" aria-expanded={importOpen} onClick={() => setImportOpen((open) => !open)} type="button" variant="secondary"><FileUp aria-hidden="true" size={17} /> Import roster CSV</Button><Button aria-controls="add-child-form" aria-expanded={addOpen} onClick={(event) => { addTriggerRef.current = event.currentTarget; setAddOpen(true); }} type="button"><Plus aria-hidden="true" size={17} /> Add child</Button></div></header>
      {error && data ? <Alert className="mt-7" variant="destructive"><AlertDescription className="flex items-center justify-between gap-4">{error}<button className="font-extrabold underline underline-offset-4" onClick={() => setError(null)} type="button">Dismiss</button></AlertDescription></Alert> : null}
      {notice ? <Alert className="mt-7"><AlertDescription className="flex items-center justify-between gap-4">{notice}<button className="shrink-0 font-extrabold underline underline-offset-4" onClick={() => setNotice(null)} type="button">Dismiss</button></AlertDescription></Alert> : null}
      {importOpen ? (
        <section aria-labelledby="roster-import-title" className="mt-7 rounded-2xl border border-border bg-surface p-5 shadow-card max-sm:p-4" id="roster-import-panel">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><Eyebrow>Roster import</Eyebrow><h2 className="mt-2 text-xl font-extrabold" id="roster-import-title">Import children and assignments from CSV</h2><p className="mt-1 max-w-2xl text-xs text-muted-foreground">Expected columns: child_external_id, age_months, support_context, context_label, processing_allowed, child_active, educator_email, assignment_active. Every import is previewed before anything is written.</p></div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border-strong bg-surface px-3.5 py-2 text-sm font-bold hover:bg-surface-soft"><FileUp aria-hidden="true" size={16} />{importCsv ? "Choose a different file" : "Choose CSV file"}<input accept=".csv,text/csv" className="sr-only" onChange={(event) => void chooseRosterFile(event)} type="file" /></label>
          </div>
          {pendingKey === "roster-preview" ? <p className="mt-4 text-sm text-muted-foreground" role="status">Validating {importCsv?.fileName}...</p> : null}
          {importIssues && importIssues.length > 0 ? (
            <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4" role="alert">
              <strong className="text-sm">The CSV did not pass validation. Nothing was imported.</strong>
              <ul className="mt-2 grid gap-1 text-xs text-muted-foreground">{importIssues.slice(0, 10).map((issue, index) => <li key={index}>{issue.row ? `Row ${issue.row}: ` : ""}{issue.message}{issue.field ? ` (${issue.field})` : ""}</li>)}</ul>
              {importIssues.length > 10 ? <p className="mt-2 text-xs text-muted-foreground">{importIssues.length - 10} more issues are not shown. Fix these first and choose the file again.</p> : null}
            </div>
          ) : null}
          {importPreview && importCsv ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface-soft p-4">
              <div className="grid gap-1 text-sm">
                <strong>{importCsv.fileName} is valid — {importPreview.rows} rows.</strong>
                <span className="text-xs text-muted-foreground">Applying will add {importPreview.childrenCreated} children, update {importPreview.childrenUpdated}, deactivate {importPreview.childrenDeactivated}, and create {importPreview.assignmentsCreated} assignments.</span>
                {importPreview.replayed ? <span className="text-xs text-muted-foreground">This exact file was already imported; applying it again changes nothing new.</span> : null}
              </div>
              <Button disabled={pendingKey !== null} onClick={(event) => { confirmationTriggerRef.current = event.currentTarget; setConfirmation({ kind: "APPLY_ROSTER", summary: importPreview }); }} type="button">Apply import</Button>
            </div>
          ) : null}
        </section>
      ) : null}
      {addOpen ? (
        <form className="mt-7 grid grid-cols-[minmax(180px,1fr)_120px_minmax(160px,.8fr)_minmax(180px,1fr)_auto_auto] items-end gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card max-lg:grid-cols-2 max-md:grid-cols-1 max-sm:p-4" id="add-child-form" onSubmit={addChild}>
          <ChildFields onChange={setAddValues} values={addValues} />
          <div className="flex gap-2 max-sm:flex-col-reverse"><Button className="max-sm:w-full" disabled={pendingKey === "add"} onClick={() => { setAddOpen(false); window.requestAnimationFrame(() => addTriggerRef.current?.focus()); }} type="button" variant="secondary">Cancel</Button><Button className="max-sm:w-full" disabled={pendingKey === "add"} type="submit">{pendingKey === "add" ? "Adding..." : "Add child"}</Button></div>
        </form>
      ) : null}
      {!data && error ? <PageState description={error} kind="error" title="Child records could not be loaded"><Button onClick={() => void load()} type="button"><RefreshCw aria-hidden="true" size={16} /> Try again</Button></PageState> : null}
      {!data && !error ? <PageState description="Loading the pilot roster and educator assignments." kind="loading" title="Loading children" /> : null}
      {data?.children.length === 0 ? <PageState description="Add a child or import the roster CSV to begin." kind="empty" title="No children are on the roster yet"><Button aria-controls="add-child-form" aria-expanded={addOpen} onClick={(event) => { addTriggerRef.current = event.currentTarget; setAddOpen(true); }} type="button"><Plus aria-hidden="true" size={16} /> Add first child</Button></PageState> : null}
      {data && data.children.length > 0 ? <>
        <div className="mt-7 flex items-center gap-4 py-1 max-sm:items-stretch max-sm:flex-col"><form className="flex flex-1 items-center gap-2 rounded-full border border-border-strong bg-surface px-3 focus-within:ring-3 focus-within:ring-ring/25" onSubmit={searchChildren}><Search aria-hidden="true" size={16} /><label className="sr-only" htmlFor="child-search">Search children</label><Input className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" defaultValue={query} id="child-search" key={query} name="search" placeholder="Search identifier or context label" type="search" /><Button aria-label="Search" size="icon-xs" title="Search" type="submit" variant="ghost"><ArrowRight aria-hidden="true" size={15} /></Button></form><label className="flex items-center gap-2 rounded-full border border-border-strong bg-surface px-3.5"><Filter aria-hidden="true" size={16} /><span className="sr-only">Filter by status</span><select className="h-10 bg-transparent text-sm" onChange={(event) => updateFilters(query, event.target.value as typeof statusFilter)} value={statusFilter}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label></div>
        <div className="mt-7 grid grid-cols-[minmax(280px,.7fr)_minmax(0,1.3fr)] items-start gap-7 max-md:grid-cols-1">
          <section aria-labelledby="children-list-title" className="border-r border-border pr-7 max-md:border-r-0 max-md:border-b max-md:pr-0 max-md:pb-6"><div className="mb-4 flex items-end justify-between"><div><Eyebrow>Pilot roster</Eyebrow><h2 className="mt-2 text-2xl font-extrabold" id="children-list-title">Children</h2></div><span className="text-[13px] text-muted-foreground">{visibleChildren.length}</span></div>{visibleChildren.length === 0 ? <p className="border-t border-border py-7 text-muted-foreground">No children match these filters.</p> : visibleChildren.map((child) => <button className={cn("grid w-full grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-surface-soft", selectedChildId === child.id && "bg-accent hover:bg-accent")} key={child.id} onClick={() => setSelectedChildId(child.id)} type="button"><span className="grid size-[42px] place-items-center rounded-full border border-info-border bg-accent text-primary-strong"><Baby aria-hidden="true" size={20} /></span><span className="grid min-w-0 gap-1"><strong>{child.externalChildId}</strong><small className="truncate text-xs text-muted-foreground">{child.ageMonths} months{child.contextLabel ? ` · ${child.contextLabel}` : ""}</small></span><span className={cn("rounded-full px-2 py-1 text-[10px] font-extrabold", child.isActive ? "bg-success-soft text-success" : "bg-surface-soft text-muted-foreground")}>{child.isActive ? "Active" : "Inactive"}</span></button>)}</section>
          {selected ? <section aria-labelledby="child-editor-title" className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <header className="flex flex-wrap items-center gap-3 border-b border-border pb-5">
              <span className="grid size-12 shrink-0 place-items-center rounded-full border border-info-border bg-accent text-primary-strong"><Baby aria-hidden="true" size={22} /></span>
              <div className="min-w-0 flex-1 basis-52"><Eyebrow>Child record</Eyebrow><h2 className="mt-2 break-words text-2xl font-extrabold" id="child-editor-title">{selected.externalChildId}</h2><p className="mt-1 text-sm text-muted-foreground">{selected.ageMonths} months · {SUPPORT_CONTEXT_LABELS[selected.supportContext ?? "UNKNOWN"]}{selected.contextLabel ? ` · ${selected.contextLabel}` : ""}</p></div>
              <div className="flex shrink-0 gap-2">
                <Button aria-controls="edit-child-form" aria-expanded={editOpen} disabled={pendingKey !== null} onClick={beginEdit} size="sm" type="button" variant="secondary"><Pencil aria-hidden="true" size={15} /> Edit</Button>
              </div>
            </header>
            {editOpen ? (
              <form className="grid grid-cols-2 items-end gap-4 border-b border-border py-5 max-md:grid-cols-1" id="edit-child-form" onSubmit={saveEdit}>
                <ChildFields onChange={setEditValues} values={editValues} />
                <div className="flex gap-2 max-sm:flex-col-reverse"><Button disabled={pendingKey === "edit"} onClick={() => setEditOpen(false)} type="button" variant="secondary">Cancel</Button><Button disabled={pendingKey === "edit"} type="submit">{pendingKey === "edit" ? "Saving..." : "Save changes"}</Button></div>
              </form>
            ) : null}
            <div className="flex items-center justify-between gap-4 border-b border-border py-5 max-sm:items-start max-sm:flex-col">
              <span className="flex items-center gap-3">{selected.isActive ? <UserRoundCheck aria-hidden="true" className="text-success" /> : <UserRoundX aria-hidden="true" className="text-destructive" />}<span className="grid gap-1"><strong>Roster status: {selected.isActive ? "active" : "inactive"}</strong><small className="text-xs text-muted-foreground">Deactivating removes the child from every educator&apos;s list. {data.assessmentCounts[selected.id] ?? 0} recorded assessment{(data.assessmentCounts[selected.id] ?? 0) === 1 ? "" : "s"} are retained either way.</small></span></span>
              {selected.isActive
                ? <Button disabled={pendingKey === "active"} onClick={(event) => { setError(null); confirmationTriggerRef.current = event.currentTarget; setConfirmation({ kind: "DEACTIVATE_CHILD", child: selected }); }} type="button" variant="destructive-outline">Deactivate</Button>
                : <Button disabled={pendingKey === "active"} onClick={() => void mutate({ action: "SET_CHILD_ACTIVE", childId: selected.id, active: true }, "active")} type="button">Reactivate</Button>}
            </div>
            <div className="flex items-center justify-between gap-4 py-5"><div className="flex items-center gap-2.5"><UsersRound aria-hidden="true" className="text-primary" size={19} /><span className="grid gap-1"><strong>Educator assignments</strong><small className="text-xs text-muted-foreground">Only assigned educators can record observations for this child.</small></span></div><span className="text-xs text-muted-foreground">{selectedAssignments.length} active</span></div>
            {selected.isActive ? <div className="border-t border-border">{data.educators.length === 0 ? <p className="py-5 text-sm text-muted-foreground">No educators are provisioned yet. Provision educator access first, then assign this child.</p> : data.educators.map((educator) => {
              const assignment = data.assignments.find((candidate) => candidate.educatorId === educator.id && candidate.childId === selected.id);
              const active = assignment?.active ?? false;
              const educatorActive = data.access.some((provision) => provision.userId === educator.id && provision.active);
              return <div className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-1 py-3 max-sm:grid-cols-[22px_minmax(0,1fr)]" key={educator.id}>
                <span className={cn("grid size-5 place-items-center rounded-full border border-border-strong text-white [&_svg]:size-3", active && "border-success bg-success")}>{active ? <CheckCircle2 aria-hidden="true" /> : null}</span>
                <span className="grid gap-1"><strong>{educator.displayName}</strong><small className="truncate text-xs text-muted-foreground">{educator.email}{educatorActive ? "" : " · access inactive"}</small></span>
                {active
                  ? <Button className="max-sm:col-start-2 max-sm:justify-self-start" disabled={pendingKey === educator.id} onClick={(event) => { setError(null); confirmationTriggerRef.current = event.currentTarget; setConfirmation({ kind: "UNASSIGN", child: selected, educator }); }} size="sm" type="button" variant="destructive-outline">Remove</Button>
                  : <Button className="max-sm:col-start-2 max-sm:justify-self-start" disabled={pendingKey === educator.id || !educatorActive} onClick={() => void mutate({ action: "SET_ASSIGNMENT", userId: educator.id, childId: selected.id, active: true }, educator.id, "/api/admin/access")} size="sm" type="button" variant="secondary">Assign</Button>}
              </div>;
            })}</div> : <p className="border-t border-border py-5 text-sm text-muted-foreground">Reactivate this child before assigning educators.</p>}
          </section> : null}
        </div>
      </> : null}
      <ConfirmDialog confirmLabel={confirmation?.kind === "DEACTIVATE_CHILD" ? "Deactivate child" : confirmation?.kind === "UNASSIGN" ? "Remove assignment" : "Apply roster import"} description={confirmation?.kind === "DEACTIVATE_CHILD" ? `${confirmation.child.externalChildId} will be removed from every educator's list.` : confirmation?.kind === "UNASSIGN" ? `${confirmation.educator.displayName} will immediately lose access to ${confirmation.child.externalChildId}.` : confirmation ? `${confirmation.summary.rows} roster rows will be applied to the pilot.` : ""} details={confirmation?.kind === "DEACTIVATE_CHILD" ? ["Active educator assignments are removed", "Saved assessments are retained", "The child can be reactivated later"] : confirmation?.kind === "UNASSIGN" ? ["Direct child and assessment requests will be denied", "Saved assessment records are retained", "Only this assignment is removed"] : confirmation?.kind === "APPLY_ROSTER" ? [`${confirmation.summary.childrenCreated} children added, ${confirmation.summary.childrenUpdated} updated`, `${confirmation.summary.childrenDeactivated} children deactivated`, `${confirmation.summary.assignmentsCreated + confirmation.summary.assignmentsActivated} assignments activated, ${confirmation.summary.assignmentsDeactivated} removed`] : []} error={confirmation ? error : null} onCancel={() => { setError(null); setConfirmation(null); }} onConfirm={confirmMutation} open={confirmation !== null} pending={pendingKey !== null} returnFocusRef={confirmationTriggerRef} title={confirmation?.kind === "DEACTIVATE_CHILD" ? "Deactivate this child?" : confirmation?.kind === "UNASSIGN" ? "Remove child assignment?" : "Apply this roster import?"} tone={confirmation?.kind === "APPLY_ROSTER" ? "primary" : "danger"} />
    </PageShell>
  );
}

export default function AdminChildrenPage() {
  return <Suspense fallback={<PageShell><PageState description="Loading the pilot roster and educator assignments." kind="loading" title="Loading children" /></PageShell>}><AdminChildrenContent /></Suspense>;
}
