"use client";

import { ArrowRight, CheckCircle2, Filter, Plus, RefreshCw, Search, UserRoundCheck, UserRoundX, UsersRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageState } from "@/components/page-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eyebrow, PageShell } from "@/components/ui/app-patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { handleProtectedResponse, responseError } from "@/lib/help-review/client-http";
import type { AccessProvision, ChildAssignment, PilotChild, PilotUser, Role } from "@/lib/help-review/models";
import { cn } from "@/lib/utils";

interface AccessProjection {
  readonly staff: PilotUser[];
  readonly children: PilotChild[];
  readonly access: AccessProvision[];
  readonly assignments: ChildAssignment[];
  readonly actorId: string;
}

type Confirmation =
  | { readonly kind: "DEACTIVATE"; readonly staffMember: PilotUser }
  | { readonly kind: "UNASSIGN"; readonly staffMember: PilotUser; readonly child: PilotChild };

function AdminAccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("search") ?? "";
  const requestedStatus = searchParams.get("status");
  const statusFilter: "ALL" | "ACTIVE" | "INACTIVE" = requestedStatus === "ACTIVE" || requestedStatus === "INACTIVE" ? requestedStatus : "ALL";
  const [data, setData] = useState<AccessProjection | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [provisionName, setProvisionName] = useState("");
  const [provisionEmail, setProvisionEmail] = useState("");
  const [provisionRole, setProvisionRole] = useState<Role>("EDUCATOR");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const provisionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const headerProvisionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const confirmationTriggerRef = useRef<HTMLButtonElement | null>(null);

  const load = useCallback(async () => {
    setData(null);
    try {
      const response = await fetch("/api/admin/access", { cache: "no-store" });
      if (handleProtectedResponse(response, router, "/admin/access")) return;
      if (!response.ok) {
        setError("A temporary problem prevented pilot access records from loading. No access was changed.");
        return;
      }
      const projection = await response.json() as AccessProjection;
      setData(projection);
      setError(null);
      setSelectedUserId((current) => current && projection.staff.some((staffMember) => staffMember.id === current) ? current : projection.staff[0]?.id ?? null);
    } catch {
      setError("A temporary problem prevented pilot access records from loading. No access was changed.");
    }
  }, [router]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const visibleStaff = useMemo(() => data?.staff.filter((staffMember) => {
    const access = data.access.find((candidate) => candidate.userId === staffMember.id);
    const matchesStatus = statusFilter === "ALL" || (statusFilter === "ACTIVE" ? access?.active : !access?.active);
    const needle = query.trim().toLowerCase();
    return matchesStatus && (!needle || staffMember.displayName.toLowerCase().includes(needle) || staffMember.email.toLowerCase().includes(needle));
  }) ?? [], [data, query, statusFilter]);
  const selected = useMemo(() => visibleStaff.find((staffMember) => staffMember.id === selectedUserId) ?? null, [selectedUserId, visibleStaff]);
  const selectedAccess = data?.access.find((access) => access.userId === selected?.id);

  function updateFilters(nextQuery: string, nextStatus = statusFilter) {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("search", nextQuery.trim());
    if (nextStatus !== "ALL") params.set("status", nextStatus);
    router.replace(params.size > 0 ? `/admin/access?${params}` : "/admin/access", { scroll: false });
  }

  function searchStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFilters(String(new FormData(event.currentTarget).get("search") ?? ""));
  }

  function closeProvision() {
    setProvisionOpen(false);
    window.requestAnimationFrame(() => {
      const trigger = provisionTriggerRef.current?.isConnected
        ? provisionTriggerRef.current
        : headerProvisionTriggerRef.current;
      trigger?.focus();
    });
  }

  async function mutate(body: object, key: string): Promise<boolean> {
    setPendingKey(key);
    setError(null);
    try {
      const response = await fetch("/api/admin/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (handleProtectedResponse(response, router, "/admin/access")) return false;
      if (!response.ok) {
        setError(await responseError(response, "The access change could not be completed."));
        return false;
      }
      await load();
      return true;
    } catch {
      setError("The network interrupted this access change. Refresh before trying again.");
      return false;
    } finally {
      setPendingKey(null);
    }
  }

  async function provision(event: FormEvent) {
    event.preventDefault();
    setPendingKey("provision");
    try {
      const response = await fetch("/api/admin/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "PROVISION_STAFF", displayName: provisionName, email: provisionEmail, role: provisionRole }) });
      if (handleProtectedResponse(response, router, "/admin/access")) return;
      if (!response.ok) setError(await responseError(response, "Staff access could not be provisioned."));
      else {
        const payload = await response.json() as { educator: PilotUser };
        await load();
        setSelectedUserId(payload.educator.id);
        setProvisionName("");
        setProvisionEmail("");
        setProvisionRole("EDUCATOR");
        closeProvision();
      }
    } catch {
      setError("The network interrupted staff provisioning. No access is shown as changed.");
    } finally {
      setPendingKey(null);
    }
  }

  async function confirmMutation() {
    if (!confirmation) return;
    const succeeded = confirmation.kind === "DEACTIVATE"
      ? await mutate({ action: "SET_ACCESS", userId: confirmation.staffMember.id, active: false }, "access")
      : await mutate({ action: "SET_ASSIGNMENT", userId: confirmation.staffMember.id, childId: confirmation.child.id, active: false }, confirmation.child.id);
    if (succeeded) setConfirmation(null);
  }

  return (
    <PageShell>
      <header className="flex items-end justify-between gap-6 max-sm:items-start max-sm:flex-col"><div><Eyebrow>Pilot administration</Eyebrow><h1 className="mt-1 font-heading text-4xl font-normal leading-tight max-sm:text-[30px]">Pilot access</h1><p className="mt-2.5 leading-relaxed text-muted-foreground">Provision approved staff, then assign children to educators.</p></div><Button aria-controls="provision-staff-form" aria-expanded={provisionOpen} onClick={(event) => { provisionTriggerRef.current = event.currentTarget; setProvisionOpen(true); }} ref={headerProvisionTriggerRef} type="button"><Plus aria-hidden="true" size={17} /> Provision staff</Button></header>
      {error && data ? <Alert className="mt-7" variant="destructive"><AlertDescription className="flex items-center justify-between gap-4">{error}<button className="font-extrabold underline underline-offset-4" onClick={() => void load()} type="button">Try again</button></AlertDescription></Alert> : null}
      {provisionOpen ? (
        <form className="mt-7 grid grid-cols-[minmax(210px,1fr)_minmax(150px,.65fr)_minmax(200px,.8fr)_120px_auto] items-end gap-4 border-y border-border border-t-[3px] border-t-primary bg-surface p-5 max-lg:grid-cols-2 max-lg:[&>div:first-child]:col-span-full max-md:grid-cols-1 max-md:[&>div:first-child]:col-span-1 max-sm:p-4" id="provision-staff-form" onSubmit={provision}>
          <div><Eyebrow>Approved staff</Eyebrow><h2 className="mt-1 font-heading text-xl font-normal">Provision pilot access</h2><p className="mt-1 text-xs text-muted-foreground">The selected identity provider owns credential setup and recovery.</p></div>
          <label className="grid gap-1.5 text-[11px] font-extrabold uppercase text-muted-foreground">Display name<Input autoFocus maxLength={100} onChange={(event) => setProvisionName(event.target.value)} required value={provisionName} /></label>
          <label className="grid gap-1.5 text-[11px] font-extrabold uppercase text-muted-foreground">Exact email<Input maxLength={254} onChange={(event) => setProvisionEmail(event.target.value)} required type="email" value={provisionEmail} /></label>
          <label className="grid gap-1.5 text-[11px] font-extrabold uppercase text-muted-foreground">Role<select className="h-10 rounded-md border border-border-strong bg-surface px-2.5 text-sm text-ink" onChange={(event) => setProvisionRole(event.target.value as Role)} value={provisionRole}><option value="EDUCATOR">Educator</option><option value="ADMIN">Admin</option></select></label>
          <div className="flex gap-2 max-sm:flex-col-reverse"><Button className="max-sm:w-full" disabled={pendingKey === "provision"} onClick={closeProvision} type="button" variant="secondary">Cancel</Button><Button className="max-sm:w-full" disabled={pendingKey === "provision"} type="submit">{pendingKey === "provision" ? "Provisioning..." : "Provision access"}</Button></div>
        </form>
      ) : null}
      {!data && error ? <PageState description={error} kind="error" title="Pilot access could not be loaded"><Button onClick={() => void load()} type="button"><RefreshCw aria-hidden="true" size={16} /> Try again</Button></PageState> : null}
      {!data && !error ? <PageState description="Loading provisioned staff and active child assignments." kind="loading" title="Loading pilot access" /> : null}
      {data?.staff.length === 0 ? <PageState description="Add an approved staff member before assigning access." kind="empty" title="No pilot access has been provisioned"><Button aria-controls="provision-staff-form" aria-expanded={provisionOpen} onClick={(event) => { provisionTriggerRef.current = event.currentTarget; setProvisionOpen(true); }} type="button"><Plus aria-hidden="true" size={16} /> Provision first staff member</Button></PageState> : null}
      {data && data.staff.length > 0 ? <>
        <div className="mt-7 flex items-center gap-4 border-y border-border py-4 max-sm:items-stretch max-sm:flex-col"><form className="flex flex-1 items-center gap-2 rounded-md border border-border-strong bg-surface px-2.5 focus-within:ring-3 focus-within:ring-ring/25" onSubmit={searchStaff}><Search aria-hidden="true" size={16} /><label className="sr-only" htmlFor="staff-search">Search staff</label><Input className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" defaultValue={query} id="staff-search" key={query} name="search" placeholder="Search email or name" type="search" /><Button aria-label="Search" size="icon-xs" title="Search" type="submit" variant="ghost"><ArrowRight aria-hidden="true" size={15} /></Button></form><label className="flex items-center gap-2 rounded-md border border-border-strong bg-surface px-2.5"><Filter aria-hidden="true" size={16} /><span className="sr-only">Filter by status</span><select className="h-10 bg-transparent text-sm" onChange={(event) => updateFilters(query, event.target.value as typeof statusFilter)} value={statusFilter}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label></div>
        <div className="mt-7 grid grid-cols-[minmax(280px,.7fr)_minmax(0,1.3fr)] items-start gap-7 max-md:grid-cols-1">
          <section className="border-r border-border pr-7 max-md:border-r-0 max-md:border-b max-md:pr-0 max-md:pb-6" aria-labelledby="educator-list-title"><div className="mb-4 flex items-end justify-between"><div><Eyebrow>Pilot staff</Eyebrow><h2 className="mt-1 font-heading text-2xl font-normal" id="educator-list-title">Staff</h2></div><span className="text-[13px] text-muted-foreground">{visibleStaff.length}</span></div>{visibleStaff.length === 0 ? <p className="border-t border-border py-7 text-muted-foreground">No staff match these filters.</p> : visibleStaff.map((staffMember) => { const access = data.access.find((candidate) => candidate.userId === staffMember.id); return <button className={cn("grid w-full grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 border-t border-border px-2 py-3 text-left hover:bg-surface-soft", selectedUserId === staffMember.id && "bg-accent shadow-[inset_3px_0_0_var(--primary)]")} key={staffMember.id} onClick={() => setSelectedUserId(staffMember.id)} type="button"><span className="grid size-[42px] place-items-center rounded-full border border-[#b8d8d3] bg-accent text-xs font-extrabold text-primary-strong">{staffMember.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><span className="grid min-w-0 gap-1"><strong>{staffMember.displayName}</strong><small className="truncate text-xs text-muted-foreground">{staffMember.role === "ADMIN" ? "Admin" : "Educator"} · {staffMember.email}</small></span><span className={cn("rounded-full px-2 py-1 text-[10px] font-extrabold", access?.active ? "bg-success-soft text-success" : "bg-surface-soft text-muted-foreground")}>{access?.active ? "Active" : "Inactive"}</span></button>; })}</section>
          {selected ? <section className="border border-border bg-surface p-5" aria-labelledby="access-editor-title">
            <header className="flex items-center gap-3 border-b border-border pb-5">
              <span className="grid size-12 place-items-center rounded-full border border-[#b8d8d3] bg-accent text-sm font-extrabold text-primary-strong">{selected.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
              <div><Eyebrow>{selected.role === "ADMIN" ? "Admin access" : "Educator access"}</Eyebrow><h2 className="mt-1 font-heading text-2xl font-normal" id="access-editor-title">{selected.displayName}</h2><p className="mt-1 text-sm text-muted-foreground">{selected.email}</p></div>
            </header>
            <div className="flex items-center justify-between gap-4 border-b border-border py-5 max-sm:items-start max-sm:flex-col">
              <span className="flex items-center gap-3">{selectedAccess?.active ? <UserRoundCheck aria-hidden="true" className="text-success" /> : <UserRoundX aria-hidden="true" className="text-destructive" />}<span className="grid gap-1"><strong>Pilot access {selectedAccess?.active ? "active" : "inactive"}</strong><small className="text-xs text-muted-foreground">Credential lifecycle remains with the selected identity provider.</small></span></span>
              {selectedAccess?.active
                ? selected.id === data.actorId
                  ? <span className="whitespace-nowrap text-xs font-extrabold text-muted-foreground">Current session</span>
                  : <Button disabled={pendingKey === "access"} onClick={(event) => { setError(null); confirmationTriggerRef.current = event.currentTarget; setConfirmation({ kind: "DEACTIVATE", staffMember: selected }); }} type="button" variant="destructive-outline">Deactivate</Button>
                : <Button disabled={pendingKey === "access"} onClick={() => void mutate({ action: "SET_ACCESS", userId: selected.id, active: true }, "access")} type="button">Activate access</Button>}
            </div>
            {selected.role === "EDUCATOR" ? <>
              <div className="flex items-center justify-between gap-4 py-5"><div className="flex items-center gap-2.5"><UsersRound aria-hidden="true" className="text-primary" size={19} /><span className="grid gap-1"><strong>Child assignments</strong><small className="text-xs text-muted-foreground">Assignments are checked separately from role.</small></span></div><span className="text-xs text-muted-foreground">{data.assignments.filter((assignment) => assignment.educatorId === selected.id && assignment.active).length} active</span></div>
              <div className="border-t border-border">{data.children.map((child) => {
                const assignment = data.assignments.find((candidate) => candidate.educatorId === selected.id && candidate.childId === child.id);
                const active = assignment?.active ?? false;
                return <div className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-1 py-3 max-sm:grid-cols-[22px_minmax(0,1fr)]" key={child.id}>
                  <span className={cn("grid size-5 place-items-center rounded-full border border-border-strong text-white [&_svg]:size-3", active && "border-success bg-success")}>{active ? <CheckCircle2 aria-hidden="true" /> : null}</span>
                  <span className="grid gap-1"><strong>{child.externalChildId}</strong><small className="text-xs text-muted-foreground">{child.ageMonths} months{child.contextLabel ? ` · ${child.contextLabel}` : ""}</small></span>
                  {active
                    ? <Button className="max-sm:col-start-2 max-sm:justify-self-start" disabled={pendingKey === child.id} onClick={(event) => { setError(null); confirmationTriggerRef.current = event.currentTarget; setConfirmation({ kind: "UNASSIGN", staffMember: selected, child }); }} size="sm" type="button" variant="destructive-outline">Remove</Button>
                    : <Button className="max-sm:col-start-2 max-sm:justify-self-start" disabled={pendingKey === child.id || !selectedAccess?.active} onClick={() => void mutate({ action: "SET_ASSIGNMENT", userId: selected.id, childId: child.id, active: true }, child.id)} size="sm" type="button" variant="secondary">Assign</Button>}
                </div>;
              })}</div>
            </> : <div className="mt-6 flex items-center gap-3 border-y border-border py-5"><UsersRound aria-hidden="true" className="text-primary" size={19} /><span className="grid gap-1"><strong>No child assignments</strong><small className="text-xs text-muted-foreground">Admin accounts manage pilot operations but cannot open child, video, or review records.</small></span></div>}
          </section> : null}
        </div>
      </> : null}
      <ConfirmDialog confirmLabel={confirmation?.kind === "DEACTIVATE" ? "Deactivate access" : "Remove assignment"} description={confirmation?.kind === "DEACTIVATE" ? `${confirmation.staffMember.displayName} will no longer be able to sign in to the pilot.` : confirmation ? `${confirmation.staffMember.displayName} will immediately lose access to ${confirmation.child.externalChildId}.` : ""} details={confirmation?.kind === "DEACTIVATE" ? ["Active sessions will be rejected", "Existing assignments remain recorded", "Assessment records are retained"] : ["Direct child and assessment requests will be denied", "Saved assessment records are retained", "Only this assignment is removed"]} error={confirmation ? error : null} onCancel={() => { setError(null); setConfirmation(null); }} onConfirm={confirmMutation} open={confirmation !== null} pending={pendingKey !== null} returnFocusRef={confirmationTriggerRef} title={confirmation?.kind === "DEACTIVATE" ? "Deactivate pilot access?" : "Remove child assignment?"} />
    </PageShell>
  );
}

export default function AdminAccessPage() {
  return <Suspense fallback={<PageShell><PageState description="Loading provisioned staff and active child assignments." kind="loading" title="Loading pilot access" /></PageShell>}><AdminAccessContent /></Suspense>;
}
