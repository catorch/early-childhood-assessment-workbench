import { PageShell } from "@/components/ui/app-patterns";

export default function Loading() {
  return (
    <PageShell aria-busy="true">
      <p className="border-t border-border py-8 text-muted-foreground" role="status">
        Loading...
      </p>
    </PageShell>
  );
}
