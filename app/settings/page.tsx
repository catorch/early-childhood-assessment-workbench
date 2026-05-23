import type { ReactNode } from "react";

import { Database, KeyRound, ShieldCheck, Users } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  return (
    <main className="content">
      <PageHeader title="Settings" subtitle="Manage prototype configuration, role checks, and integration readiness." />
      <div className="grid two">
        <Card>
          <SectionTitle title="Access Control" action={<Badge tone="green">Mocked</Badge>} />
          <div className="panel-list">
            <SettingRow icon={<Users size={20} />} label="Current user" value="Sarah Chen · Admin" />
            <SettingRow icon={<ShieldCheck size={20} />} label="Review actions" value="Reviewer/Admin roles" />
            <SettingRow icon={<KeyRound size={20} />} label="Prompt promotion" value="Admin only" />
          </div>
        </Card>
        <Card>
          <SectionTitle title="Environment" action={<Badge tone="amber">Prototype</Badge>} />
          <div className="panel-list">
            <SettingRow icon={<Database size={20} />} label="Database" value="Postgres via Prisma schema" />
            <SettingRow icon={<KeyRound size={20} />} label="AI provider" value="Mock provider, Gemini-ready adapter" />
            <SettingRow icon={<ShieldCheck size={20} />} label="Secrets" value="Server-side environment variables" />
          </div>
        </Card>
      </div>
    </main>
  );
}

function SettingRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="comparison-card">
      <span className="workspace-icon">{icon}</span>
      <strong>{label}</strong>
      <span className="muted">{value}</span>
    </div>
  );
}
