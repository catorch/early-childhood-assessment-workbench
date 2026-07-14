# HELP Review Pilot

This repository is being rebuilt around the educator workflow confirmed in the July 10 meeting and later stakeholder follow-ups. The active product scope is an access-provisioned pilot where an educator selects an assigned child, uploads one observation video, reviews scientist-service suggestions, and confirms a final HELP summary.

The source of truth is:

1. `docs/meeting-transcripts/July-10-meeting-transcript.md`
2. `docs/specs/help-review-production-platform/requirements.md`
3. `docs/specs/help-review-production-platform/design.md`
4. `docs/specs/help-review-production-platform/tasks.md`

The Lovable review is a visual and interaction reference only. Its simulated video, preset summary values, and unwired controls are not production behavior.

## Current State

The legacy Assessment Reliability Workbench has been removed from the runtime. The repository now implements the complete educator journey and minimum Admin workflow against sanitized adapters:

- Test-only Educator and Admin identity profiles
- Assignment-scoped child records and access revocation
- One-video intake with private, byte-range playback
- Durable fake-scoring processing runs and validated suggestions
- Evidence seeking, accept/override/independent-score/dismiss/note actions, revision conflicts, and saved progress
- Server-derived summary totals, finalization locking, and read-only final records
- Educator/Admin role provisioning, child assignment, access revocation, and failed-job Admin surfaces
- Role-aware home routing plus URL-backed assessment and Admin filters

Local development defaults to ignored `.data/` state and uploads. An explicitly acknowledged shared demonstration can instead use the normalized Prisma schema on Neon and authenticated private Vercel Blob storage. The shared adapter seeds only the deterministic records from `lib/help-review/fixtures.ts` when `HELP_REVIEW_SEED_SANITIZED_DATA=true`.

Live authentication, real child data, production video storage, the scientist service, and AWS deployment remain intentionally unconnected until the decision gates in the production-platform spec are approved. The application must first evaluate reuse of HELP Connect's sign-in; the fallback is administrator-provisioned email/password through one approved managed identity service.

Production startup fails closed unless durable state/video adapters and `HELP_REVIEW_SANITIZED_PRODUCTION_ACK=true` are configured. That acknowledgement permits only a sanitized demonstration; it does not approve real data, sandbox identity, or fake scoring as live integrations.

Do not use real child data until the permission, storage, retention, deletion, and approved-vendor decisions in the requirements are resolved.

## Local Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm db:validate
pnpm build
```

Start the development server with `pnpm dev`. The root route resolves to sign-in or the current role's authorized workspace; there is intentionally no dashboard.

Open `/sign-in` and choose the Educator or Admin sandbox profile. Sandbox video validation accepts MP4, WebM, or MOV files up to 100 MB; those limits are local-adapter constraints, not an assertion about the unresolved production contract.

## Sanitized Vercel Deployment

Use a pooled Neon URL for runtime traffic and its direct URL for Prisma migrations. Never commit either value.

```bash
pnpm db:migrate
pnpm exec vercel env ls production
pnpm exec vercel --prod
```

The linked Vercel project requires `DATABASE_URL`, `DIRECT_URL`, `BLOB_READ_WRITE_TOKEN`, `HELP_REVIEW_STATE_ADAPTER=neon`, `HELP_REVIEW_VIDEO_ADAPTER=vercel-blob`, `HELP_REVIEW_SEED_SANITIZED_DATA=true`, and `HELP_REVIEW_SANITIZED_PRODUCTION_ACK=true`. The Blob store must be private. Client uploads go directly to Blob so videos up to the configured 100 MB demo limit do not cross the Vercel Function request boundary.

This deployment remains a sanitized product demonstration until the unresolved identity, scientist-service, permission, retention, incident, and organization-ownership gates in the production spec are approved.
