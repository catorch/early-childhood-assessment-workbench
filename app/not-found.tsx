import Link from "next/link";

export default function NotFound() {
  return (
    <main className="content">
      <section className="card card-pad">
        <h1 className="page-title">Page Not Found</h1>
        <p className="page-subtitle">The requested workbench view does not exist.</p>
        <Link href="/dashboard" className="button primary" style={{ marginTop: 18 }}>
          Back to dashboard
        </Link>
      </section>
    </main>
  );
}
