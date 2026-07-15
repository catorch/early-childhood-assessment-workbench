const supportSubject = "HELP Review pilot support";
const reservedDomains = new Set([
  "example.com",
  "example.net",
  "example.org"
]);

export function isDeliverableSupportEmail(value: string | undefined): value is string {
  if (!value) return false;
  const email = value.trim().toLowerCase();
  const match = /^[^\s@]+@([^\s@]+)$/.exec(email);
  if (!match) return false;
  const domain = match[1];
  return !reservedDomains.has(domain)
    && !domain.endsWith(".example")
    && !domain.endsWith(".invalid")
    && !domain.endsWith(".localhost")
    && !domain.endsWith(".test");
}

export function supportContactHref(value = process.env.NEXT_PUBLIC_HELP_REVIEW_SUPPORT_EMAIL): string | null {
  if (!isDeliverableSupportEmail(value)) return null;
  return `mailto:${value.trim()}?subject=${encodeURIComponent(supportSubject)}`;
}

export const SUPPORT_CONTACT_HREF = supportContactHref();
