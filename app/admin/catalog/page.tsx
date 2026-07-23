"use client";

import { BadgeCheck, BookOpenText, Filter, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PageState } from "@/components/page-state";
import { Eyebrow, PageShell } from "@/components/ui/app-patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { handleProtectedResponse } from "@/lib/help-review/client-http";
import { cn } from "@/lib/utils";

interface CatalogSkill {
  readonly sourceSkillId: string;
  readonly skillCode: string;
  readonly skillName: string;
  readonly domain: string;
  readonly strand: string | null;
  readonly rawAgeRange: string | null;
  readonly minimumAgeMonths: number;
  readonly maximumAgeMonths: number;
  readonly alwaysAssess: boolean;
  readonly videoScoreability: string | null;
  readonly sourceOrder: number;
}

interface CatalogProjection {
  readonly catalogVersion: string;
  readonly status: "SANITIZED_FIXTURE" | "REFERENCE" | "AUTHORITATIVE";
  readonly sourceReference: string;
  readonly attribution: string | null;
  readonly disclaimer: string | null;
  readonly creditDefinitions: ReadonlyArray<{ readonly value: string; readonly symbol: string; readonly label: string; readonly description: string }>;
  readonly selectionPolicy: {
    readonly standardDownwardWindowMonths: number;
    readonly supportedDownwardWindowMonths: number;
    readonly maximumCandidateCount: number;
    readonly twoMinusRule: { readonly enabled: boolean; readonly consecutiveNotObserved: number };
  };
  readonly skills: readonly CatalogSkill[];
}

const STATUS_LABELS: Record<CatalogProjection["status"], string> = {
  SANITIZED_FIXTURE: "Sanitized fixture",
  REFERENCE: "Reference",
  AUTHORITATIVE: "Authoritative"
};

function formatAgeRange(skill: CatalogSkill): string {
  if (skill.rawAgeRange) return skill.rawAgeRange;
  return `${skill.minimumAgeMonths}–${skill.maximumAgeMonths} months`;
}

export default function AdminCatalogPage() {
  const router = useRouter();
  const [data, setData] = useState<CatalogProjection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState("ALL");

  const load = useCallback(async () => {
    setData(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/catalog", { cache: "no-store" });
      if (handleProtectedResponse(response, router, "/admin/catalog")) return;
      if (!response.ok) {
        setError("A temporary problem prevented the skills catalogue from loading.");
        return;
      }
      setData(await response.json() as CatalogProjection);
    } catch {
      setError("A temporary problem prevented the skills catalogue from loading.");
    }
  }, [router]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const domains = useMemo(() => data ? [...new Set(data.skills.map((skill) => skill.domain))] : [], [data]);
  const visibleSkills = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    return data.skills.filter((skill) =>
      (domainFilter === "ALL" || skill.domain === domainFilter)
      && (!needle
        || skill.skillName.toLowerCase().includes(needle)
        || skill.skillCode.toLowerCase().includes(needle)
        || (skill.strand ?? "").toLowerCase().includes(needle))
    );
  }, [data, domainFilter, query]);
  const groupedSkills = useMemo(() => {
    const groups = new Map<string, CatalogSkill[]>();
    for (const skill of visibleSkills) {
      const key = skill.strand ? `${skill.domain} · ${skill.strand}` : skill.domain;
      const group = groups.get(key);
      if (group) group.push(skill);
      else groups.set(key, [skill]);
    }
    return [...groups.entries()];
  }, [visibleSkills]);

  return (
    <PageShell>
      <header><Eyebrow>Administration</Eyebrow><h1 className="mt-2.5 font-heading text-4xl font-bold leading-tight max-sm:text-[30px]">Skills catalogue</h1><p className="mt-2.5 max-w-3xl leading-relaxed text-muted-foreground">The HELP® skills this deployment assesses against. The catalogue is a versioned artifact so every finalized assessment stays tied to the exact content it was scored with; installing a new version replaces the catalogue file rather than editing skills in place.</p></header>
      {!data && error ? <PageState description={error} kind="error" title="The catalogue could not be loaded"><Button onClick={() => void load()} type="button"><RefreshCw aria-hidden="true" size={16} /> Try again</Button></PageState> : null}
      {!data && !error ? <PageState description="Loading the configured HELP skills catalogue." kind="loading" title="Loading the skills catalogue" /> : null}
      {data ? <>
        <section aria-labelledby="catalog-version-title" className="mt-7 rounded-2xl border border-border bg-surface p-5 shadow-card max-sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3"><BookOpenText aria-hidden="true" className="text-primary" size={22} /><div><h2 className="text-xl font-extrabold" id="catalog-version-title">{data.catalogVersion}</h2><p className="mt-0.5 text-xs text-muted-foreground">{data.sourceReference}</p></div></div>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold", data.status === "AUTHORITATIVE" ? "bg-success-soft text-success" : "bg-accent text-primary-strong")}>{data.status === "AUTHORITATIVE" ? <BadgeCheck aria-hidden="true" size={14} /> : <ShieldAlert aria-hidden="true" size={14} />}{STATUS_LABELS[data.status]}</span>
          </div>
          <dl className="mt-5 grid grid-cols-4 gap-4 border-t border-border pt-5 max-md:grid-cols-2 max-sm:grid-cols-1">
            <div className="grid gap-1"><dt className="text-[11px] font-extrabold uppercase text-muted-foreground">Skills</dt><dd className="text-2xl font-extrabold">{data.skills.length}</dd></div>
            <div className="grid gap-1"><dt className="text-[11px] font-extrabold uppercase text-muted-foreground">Domains</dt><dd className="text-2xl font-extrabold">{domains.length}</dd></div>
            <div className="grid gap-1"><dt className="text-[11px] font-extrabold uppercase text-muted-foreground">Downward window</dt><dd className="text-2xl font-extrabold">{data.selectionPolicy.standardDownwardWindowMonths}<span className="text-sm font-bold text-muted-foreground"> / {data.selectionPolicy.supportedDownwardWindowMonths} mo supported</span></dd></div>
            <div className="grid gap-1"><dt className="text-[11px] font-extrabold uppercase text-muted-foreground">Two-minus rule</dt><dd className="text-2xl font-extrabold">{data.selectionPolicy.twoMinusRule.enabled ? `After ${data.selectionPolicy.twoMinusRule.consecutiveNotObserved} “−”` : "Off"}</dd></div>
          </dl>
          <div className="mt-5 grid gap-3 border-t border-border pt-5 sm:grid-cols-3">
            {data.creditDefinitions.map((credit) => <div className="rounded-xl border border-border bg-surface-soft p-3.5" key={credit.value}><strong className="text-sm">{credit.symbol} · {credit.label}</strong><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{credit.description}</p></div>)}
          </div>
          {data.attribution ? <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">{data.attribution}</p> : null}
          {data.disclaimer ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{data.disclaimer}</p> : null}
        </section>
        <div className="mt-7 flex items-center gap-4 py-1 max-sm:items-stretch max-sm:flex-col">
          <div className="flex flex-1 items-center gap-2 rounded-full border border-border-strong bg-surface px-3 focus-within:ring-3 focus-within:ring-ring/25"><Search aria-hidden="true" size={16} /><label className="sr-only" htmlFor="skill-search">Search skills</label><Input className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" id="skill-search" onChange={(event) => setQuery(event.target.value)} placeholder="Search skill name, code, or strand" type="search" value={query} /></div>
          <label className="flex items-center gap-2 rounded-full border border-border-strong bg-surface px-3.5"><Filter aria-hidden="true" size={16} /><span className="sr-only">Filter by domain</span><select className="h-10 max-w-64 bg-transparent text-sm" onChange={(event) => setDomainFilter(event.target.value)} value={domainFilter}><option value="ALL">All domains</option>{domains.map((domain) => <option key={domain} value={domain}>{domain}</option>)}</select></label>
        </div>
        <p className="mt-4 text-[13px] text-muted-foreground" role="status">{visibleSkills.length} of {data.skills.length} skills shown</p>
        {groupedSkills.length === 0 ? <p className="mt-4 border-t border-border py-7 text-muted-foreground">No skills match these filters.</p> : groupedSkills.map(([group, skills]) => (
          <section aria-label={group} className="mt-6" key={group}>
            <h2 className="border-b border-border pb-2 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">{group} <span className="font-bold normal-case tracking-normal">· {skills.length}</span></h2>
            <ul className="divide-y divide-border">
              {skills.map((skill) => <li className="grid grid-cols-[90px_minmax(0,1fr)_auto] items-baseline gap-3 py-2.5 max-sm:grid-cols-[minmax(0,1fr)_auto]" key={skill.sourceSkillId}>
                <code className="text-xs font-extrabold text-primary-strong max-sm:hidden">{skill.skillCode}</code>
                <span className="min-w-0 text-sm"><span className="font-bold">{skill.skillName}</span>{skill.alwaysAssess ? <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-extrabold text-primary-strong">Always assessed</span> : null}{skill.videoScoreability === "NOT_RELIABLY_SCOREABLE" ? <span className="ml-2 rounded-full bg-surface-soft px-2 py-0.5 text-[10px] font-extrabold text-muted-foreground">Not video-scoreable</span> : null}</span>
                <span className="whitespace-nowrap text-xs text-muted-foreground">{formatAgeRange(skill)}</span>
              </li>)}
            </ul>
          </section>
        ))}
      </> : null}
    </PageShell>
  );
}
