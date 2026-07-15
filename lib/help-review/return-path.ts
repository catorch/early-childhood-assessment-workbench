/** Accepts only known application routes and their non-sensitive navigation state. */

const OPAQUE_ID = /^[A-Za-z0-9_-]{1,160}$/;

function singleValue(params: URLSearchParams, key: string): string | null {
  const values = params.getAll(key);
  return values.length === 1 ? values[0] ?? null : null;
}

function appendOpaque(source: URLSearchParams, target: URLSearchParams, key: string): void {
  const value = singleValue(source, key);
  if (value && OPAQUE_ID.test(value)) target.set(key, value);
}

function appendText(source: URLSearchParams, target: URLSearchParams, key: string): void {
  const value = singleValue(source, key)?.trim();
  if (value && value.length <= 100 && !/[\u0000-\u001f\u007f]/.test(value)) target.set(key, value);
}

function normalizedApplicationPath(parsed: URL): string | null {
  const pathname = parsed.pathname.length > 1 ? parsed.pathname.replace(/\/$/, "") : parsed.pathname;
  const safe = new URLSearchParams();

  if (pathname === "/" || pathname === "/children") {
    return pathname;
  }
  if (/^\/children\/[A-Za-z0-9_-]{1,160}$/.test(pathname)) {
    return pathname;
  }
  if (pathname === "/assessments") {
    const filter = singleValue(parsed.searchParams, "filter");
    if (filter && ["active", "finalized", "all"].includes(filter)) safe.set("filter", filter);
    appendText(parsed.searchParams, safe, "search");
  } else if (pathname === "/assessments/new") {
    appendOpaque(parsed.searchParams, safe, "childId");
    appendOpaque(parsed.searchParams, safe, "assessmentId");
  } else if (/^\/assessments\/[A-Za-z0-9_-]{1,160}\/review$/.test(pathname)) {
    appendOpaque(parsed.searchParams, safe, "skill");
  } else if (!/^\/assessments\/[A-Za-z0-9_-]{1,160}\/(processing|summary|final)$/.test(pathname)) {
    if (pathname === "/admin/access") {
      const status = singleValue(parsed.searchParams, "status");
      if (status && ["all", "active", "inactive"].includes(status)) safe.set("status", status);
      appendText(parsed.searchParams, safe, "search");
    } else if (pathname === "/admin/jobs") {
      const filter = singleValue(parsed.searchParams, "filter");
      if (filter && ["all", "failed", "stuck"].includes(filter)) safe.set("filter", filter);
      appendText(parsed.searchParams, safe, "search");
    } else {
      return null;
    }
  }

  const query = safe.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}

export function safeRelativeReturnPath(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const parsed = new URL(value, "https://help-review.invalid");
    if (parsed.origin !== "https://help-review.invalid") return fallback;
    return normalizedApplicationPath(parsed) ?? fallback;
  } catch {
    return fallback;
  }
}
