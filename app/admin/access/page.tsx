"use client";

import { ArrowRight, CheckCircle2, Filter, Plus, RefreshCw, Search, UserRoundCheck, UserRoundX, UsersRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageState } from "@/components/page-state";
import { handleProtectedResponse, responseError } from "@/lib/help-review/client-http";
import type { AccessProvision, ChildAssignment, PilotChild, PilotUser, Role } from "@/lib/help-review/models";

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

  async function mutate(body: object, key: string) {
    setPendingKey(key);
    setError(null);
    try {
      const response = await fetch("/api/admin/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (handleProtectedResponse(response, router, "/admin/access")) return;
      if (!response.ok) setError(await responseError(response, "The access change could not be completed."));
      else await load();
    } catch {
      setError("The network interrupted this access change. Refresh before trying again.");
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
        setProvisionOpen(false);
      }
    } catch {
      setError("The network interrupted staff provisioning. No access is shown as changed.");
    } finally {
      setPendingKey(null);
    }
  }

  function confirmMutation() {
    if (!confirmation) return;
    if (confirmation.kind === "DEACTIVATE") {
      void mutate({ action: "SET_ACCESS", userId: confirmation.staffMember.id, active: false }, "access");
    } else {
      void mutate({ action: "SET_ASSIGNMENT", userId: confirmation.staffMember.id, childId: confirmation.child.id, active: false }, confirmation.child.id);
    }
    setConfirmation(null);
  }

  return (
    <main className="page-shell admin-shell">
      <header className="page-heading page-heading-row"><div><span className="eyebrow">Pilot administration</span><h1>Pilot access</h1><p>Provision approved staff, then assign children to educators.</p></div><button className="button primary icon-text" onClick={() => setProvisionOpen(true)} type="button"><Plus aria-hidden="true" size={17} /> Provision staff</button></header>
      {error && data ? <div className="notice error" role="alert">{error}<button className="text-button" onClick={() => void load()} type="button">Try again</button></div> : null}
      {provisionOpen ? <form className="provision-form" onSubmit={provision}><div><span className="eyebrow">Approved staff</span><h2>Provision pilot access</h2><p>The selected identity provider owns credential setup and recovery.</p></div><label>Display name<input autoFocus maxLength={100} onChange={(event) => setProvisionName(event.target.value)} required value={provisionName} /></label><label>Exact email<input maxLength={254} onChange={(event) => setProvisionEmail(event.target.value)} required type="email" value={provisionEmail} /></label><label>Role<select onChange={(event) => setProvisionRole(event.target.value as Role)} value={provisionRole}><option value="EDUCATOR">Educator</option><option value="ADMIN">Admin</option></select></label><div className="provision-actions"><button className="button secondary" disabled={pendingKey === "provision"} onClick={() => setProvisionOpen(false)} type="button">Cancel</button><button className="button primary" disabled={pendingKey === "provision"} type="submit">{pendingKey === "provision" ? "Provisioning..." : "Provision access"}</button></div></form> : null}
      {!data && error ? <PageState description={error} kind="error" title="Pilot access could not be loaded"><button className="button primary icon-text" onClick={() => void load()} type="button"><RefreshCw aria-hidden="true" size={16} /> Try again</button></PageState> : null}
      {!data && !error ? <PageState description="Loading provisioned staff and active child assignments." kind="loading" title="Loading pilot access" /> : null}
      {data?.staff.length === 0 ? <PageState description="Add an approved staff member before assigning access." kind="empty" title="No pilot access has been provisioned"><button className="button primary icon-text" onClick={() => setProvisionOpen(true)} type="button"><Plus aria-hidden="true" size={16} /> Provision first staff member</button></PageState> : null}
      {data && data.staff.length > 0 ? <>
        <div className="list-toolbar admin-toolbar"><form className="search-field" onSubmit={searchStaff}><Search aria-hidden="true" size={16} /><label className="sr-only" htmlFor="staff-search">Search staff</label><input defaultValue={query} id="staff-search" key={query} name="search" placeholder="Search email or name" type="search" /><button className="icon-button" title="Search" type="submit"><ArrowRight aria-hidden="true" size={15} /><span className="sr-only">Search</span></button></form><label className="select-field"><Filter aria-hidden="true" size={16} /><span className="sr-only">Filter by status</span><select onChange={(event) => updateFilters(query, event.target.value as typeof statusFilter)} value={statusFilter}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label></div>
        <div className="admin-layout">
          <section className="educator-list" aria-labelledby="educator-list-title"><div className="section-heading"><div><span className="eyebrow">Pilot staff</span><h2 id="educator-list-title">Staff</h2></div><span>{visibleStaff.length}</span></div>{visibleStaff.length === 0 ? <p className="empty-line">No staff match these filters.</p> : visibleStaff.map((staffMember) => { const access = data.access.find((candidate) => candidate.userId === staffMember.id); return <button className={selectedUserId === staffMember.id ? "selected" : ""} key={staffMember.id} onClick={() => setSelectedUserId(staffMember.id)} type="button"><span className="person-avatar">{staffMember.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><span><strong>{staffMember.displayName}</strong><small>{staffMember.role === "ADMIN" ? "Admin" : "Educator"} · {staffMember.email}</small></span><span className={`access-dot ${access?.active ? "active" : "inactive"}`}>{access?.active ? "Active" : "Inactive"}</span></button>; })}</section>
          {selected ? <section className="access-editor" aria-labelledby="access-editor-title">
            <header>
              <span className="person-avatar large">{selected.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
              <div><span className="eyebrow">{selected.role === "ADMIN" ? "Admin access" : "Educator access"}</span><h2 id="access-editor-title">{selected.displayName}</h2><p>{selected.email}</p></div>
            </header>
            <div className="access-status-row">
              <span>{selectedAccess?.active ? <UserRoundCheck aria-hidden="true" /> : <UserRoundX aria-hidden="true" />}<span><strong>Pilot access {selectedAccess?.active ? "active" : "inactive"}</strong><small>Credential lifecycle remains with the selected identity provider.</small></span></span>
              {selectedAccess?.active
                ? selected.id === data.actorId
                  ? <span className="self-access-note">Current session</span>
                  : <button className="button danger-quiet" disabled={pendingKey === "access"} onClick={() => setConfirmation({ kind: "DEACTIVATE", staffMember: selected })} type="button">Deactivate</button>
                : <button className="button primary" disabled={pendingKey === "access"} onClick={() => void mutate({ action: "SET_ACCESS", userId: selected.id, active: true }, "access")} type="button">Activate access</button>}
            </div>
            {selected.role === "EDUCATOR" ? <>
              <div className="assignment-heading"><div><UsersRound aria-hidden="true" size={19} /><span><strong>Child assignments</strong><small>Assignments are checked separately from role.</small></span></div><span>{data.assignments.filter((assignment) => assignment.educatorId === selected.id && assignment.active).length} active</span></div>
              <div className="assignment-list">{data.children.map((child) => {
                const assignment = data.assignments.find((candidate) => candidate.educatorId === selected.id && candidate.childId === child.id);
                const active = assignment?.active ?? false;
                return <div className="assignment-row" key={child.id}>
                  <span className={`assignment-state ${active ? "active" : ""}`}>{active ? <CheckCircle2 aria-hidden="true" /> : null}</span>
                  <span><strong>{child.externalChildId}</strong><small>{child.ageMonths} months{child.contextLabel ? ` · ${child.contextLabel}` : ""}</small></span>
                  {active
                    ? <button className="button danger-quiet compact" disabled={pendingKey === child.id} onClick={() => setConfirmation({ kind: "UNASSIGN", staffMember: selected, child })} type="button">Remove</button>
                    : <button className="button secondary compact" disabled={pendingKey === child.id || !selectedAccess?.active} onClick={() => void mutate({ action: "SET_ASSIGNMENT", userId: selected.id, childId: child.id, active: true }, child.id)} type="button">Assign</button>}
                </div>;
              })}</div>
            </> : <div className="admin-role-note"><UsersRound aria-hidden="true" size={19} /><span><strong>No child assignments</strong><small>Admin accounts manage pilot operations but cannot open child, video, or review records.</small></span></div>}
          </section> : null}
        </div>
      </> : null}
      <ConfirmDialog confirmLabel={confirmation?.kind === "DEACTIVATE" ? "Deactivate access" : "Remove assignment"} description={confirmation?.kind === "DEACTIVATE" ? `${confirmation.staffMember.displayName} will no longer be able to sign in to the pilot.` : confirmation ? `${confirmation.staffMember.displayName} will immediately lose access to ${confirmation.child.externalChildId}.` : ""} details={confirmation?.kind === "DEACTIVATE" ? ["Active sessions will be rejected", "Existing assignments remain recorded", "Assessment records are retained"] : ["Direct child and assessment requests will be denied", "Saved assessment records are retained", "Only this assignment is removed"]} onCancel={() => setConfirmation(null)} onConfirm={confirmMutation} open={confirmation !== null} pending={pendingKey !== null} title={confirmation?.kind === "DEACTIVATE" ? "Deactivate pilot access?" : "Remove child assignment?"} />
    </main>
  );
}

export default function AdminAccessPage() {
  return <Suspense fallback={<main className="page-shell"><PageState description="Loading provisioned staff and active child assignments." kind="loading" title="Loading pilot access" /></main>}><AdminAccessContent /></Suspense>;
}
