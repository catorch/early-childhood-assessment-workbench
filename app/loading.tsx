import { PageShell } from "@/components/ui/app-patterns";

export default function Loading() {
  return (
    <PageShell aria-busy="true">
      <p className="rounded-2xl border border-border bg-surface px-5 py-8 text-muted-foreground" role="status">
        Loading...
      </p>
    </PageShell>
  );
}
