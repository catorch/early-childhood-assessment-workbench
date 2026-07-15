# HELP Review Deployment Evidence

Updated: July 14, 2026

## Sanitized Shared Environment

| Dependency | Current evidence | Boundary |
|---|---|---|
| Web | Linked Vercel project `early_childhood_assessment`; existing URL `https://earlychildhoodassessment.vercel.app` | Sanitized demo, not real-data production |
| Database | Neon PostgreSQL via pooled runtime and direct migration URLs | Sanitized records only |
| Storage | Authenticated private Vercel Blob adapter | Synthetic/sanitized videos only |
| Worker | Persisted queue plus Next.js `after()` and authenticated scheduled recovery endpoint | Fake or synthetic Gemini scoring only |
| Identity | Eight-hour HMAC-signed, HTTP-only sandbox sessions checked against active provision and assignment | No HELP Connect claim |
| Playback | Five-minute HMAC grant tied to assessment, video, viewer, and purpose; metadata-only access record | Current assignment/session required |

## July 14 Sanitized Release

| Field | Evidence |
|---|---|
| Deployment ID | `dpl_Bh3XzZLV2PiKNdpQYs67mBQZ5hvv` |
| Immutable deployment | `https://earlychildhoodassessment-pc58d3mqt-catorchs-projects-1a2d7c42.vercel.app` |
| Production alias | `https://earlychildhoodassessment.vercel.app` |
| Vercel state | `READY`, production target |
| Build region | Washington, D.C., USA (`iad1`) |
| Source upload | 144.1 KB after `.vercelignore` excluded local builds, dependencies, test artifacts, data, and documentation |
| Build | Dependency install, Prisma generation, Next.js compile, TypeScript, 18 static page generations, and output deployment passed |

## Migration Evidence

On July 14, 2026, `prisma migrate deploy` applied `20260714144000_contract_versions_and_security` to the sanitized Neon database. `prisma migrate status` then reported all three migrations current. The migration adds immutable assessment content/scoring contract versions and a non-empty constraint.

Provider backup/restore and organization-approved rollback evidence remain external gates; applying this forward, additive migration does not satisfy them.

## Verification Evidence

| Gate | Result |
|---|---|
| TypeScript | pass |
| ESLint | pass |
| Vitest | 17 files, 106 tests pass |
| Prisma schema/migrations | schema valid; three migrations current on sanitized Neon |
| Behavioral browser contracts | 18 tests pass: 14 workflow contracts, 3 route/UI smoke checks, and 1 performance/payload budget |
| Accessibility/reflow | 6 representative keyboard/focus/zoom checks pass; every accepted screen receives serious/critical axe audit |
| Accepted visual states | screens 01-45 pass deterministic baselines |
| Stress visual states | long skill, dense results, long email, localized label pass |
| Visual total | 52 tests pass |
| Security/privacy | forged session, unsafe return, cross-origin mutation, role/assignment substitution, grant tampering, payload exclusion, and health redaction pass |

## Production Smoke Evidence

The July 14 release was exercised with a new synthetic 64,256-byte MP4 through ordinary browser controls:

- `/api/health` returned `200` and `ready` with CSP, HSTS, frame, referrer, permissions, cross-origin, no-sniff, and no-store headers.
- Sandbox sign-in issued an HTTP-only, secure, same-site cookie and returned three assignment-scoped children.
- The browser created a new assessment, uploaded the synthetic video directly to private Blob, and received only the public video projection.
- Processing was started and the initiating page was closed. Persisted status reached `READY_FOR_REVIEW` with one completed attempt and eight validated suggestions.
- Vercel runtime logs then showed the authenticated scheduled `/api/internal/processing` recovery route returning `200` on successive one-minute invocations.
- A purpose-bound playback URL returned `206` for `bytes=0-31` with the correct bounded content range.
- A review decision and note saved, the selected skill remained in the allowlisted URL state, and both selection and note restored after reload.
- All eight items reconciled on the complete summary; browser confirmation created the final record. No edit controls remained and a direct post-finalization decision command returned `409`.
- After normal sign-out/Admin sign-in, direct review access returned the generic `404`; the job projection contained neither storage keys nor scoring-configuration/provider fields.
- Desktop Admin and 360x800 assigned-child views were inspected after settling. Both had coherent layout and no horizontal overflow, clipping, or overlapping controls.

## Release Candidate State

The latest repository candidate is deployed at the production alias with distinct session, playback, and cron secrets plus explicit fake-scoring, sandbox-identity, and real-data-disabled configuration. No secret value is recorded here. This is a verified sanitized product demonstration, not permissioned staging or real-data production.

Real-data production acceptance remains closed by `external-launch-gates.md`.
