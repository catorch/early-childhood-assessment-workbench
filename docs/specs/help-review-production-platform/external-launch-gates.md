# HELP Review External Launch Gates

Updated: July 14, 2026

Repository implementation can fail closed around these gates, but it cannot approve them. Every item below must have an accountable owner, dated evidence, accepted contract version, and release decision before real child data.

| Gate | Required evidence | Current state | Blocking tasks |
|---|---|---|---|
| Scientist package/service | Promised design/package, supported production runtime, authentication, sanitized success/error fixtures, exact input/output, timeout/retry and owner acceptance | Awaiting scientist handoff | 1.1, real-provider part of 6.2/6.8, 12.5 |
| HELP content | Authoritative HELP 2 structured catalogue, labels/descriptions, hierarchy verification, two-minus clarification, final-output acceptance | Provisional catalogue only | 1.4, production part of 6.2, 12.8 |
| Roster and permission | Stable staff/child identifiers, assignment source/cadence, disability/IFSP vocabulary, permission authority, reconciliation/deactivation behavior | Sanitized Admin source only | 1.2, production part of 10.1, 12.8 |
| Video/privacy policy | Parent/data-use permission, allowed vendors/regions, transfer, encryption, retention, deletion, backup, incident owner | Research video permission explicitly unavailable | 1.3, 12.3, 12.8, 12.9 |
| Identity | HELP Connect protocol/sandbox/owner, or acceptance of one managed fallback with lifecycle/recovery and brute-force controls | Signed sandbox identities only | 1.5, 3.1, 3.2, 12.5 |
| Organization infrastructure | Organization-controlled account, web/database/storage/worker/secrets/telemetry mapping, region, technical and budget owners, transfer acceptance | Shared Vercel/Neon/Blob sanitized demo | 1.5, 12.1, 12.9 |
| Recovery and incident acceptance | Provider backup/restore, application rollback or forward recovery, secret rotation, alert/on-call, privacy incident exercise | Repository runbook only | rollback portion of 2.4, 12.2, 12.6, 12.7 |
| Permissioned acceptance | Educator, Admin, content, scientist, privacy/security, and technical-owner sign-off against selected providers and 45 states | Engineering deterministic acceptance only | 12.8, 12.9 |

Until these gates close:

- `HELP_REVIEW_REAL_DATA_ENABLED` remains false.
- Sandbox identity and fake/Gemini scoring are visibly labeled and accept sanitized/synthetic input only.
- Add-on flags, manual skill creation, PDF/export, alternate outputs, amendments, and parallel identity paths remain hidden and server-rejected.
- The shared deployment is not described as organization-owned production.
