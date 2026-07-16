# HELP Review Engineering Acceptance Evidence

Updated: July 15, 2026
Boundary: repository, CI, local two-process runtime, and sanitized GCP/Neon development deployment

Real-data production mode: not yet technically enabled or exact-build accepted; required permissions are treated as granted

This record explains why an implementation task is checked in `tasks.md`. A passing synthetic or local contract does not close a task whose wording explicitly requires a selected external provider, organization-owned environment, provider recovery exercise, or stakeholder acceptance.

## Automated Gates

| Gate | July 15 result | Command or artifact |
|---|---|---|
| TypeScript | Pass | `pnpm typecheck` |
| ESLint | Pass | `pnpm lint` |
| Unit/service/adapter contracts | 27 files, 165 tests pass | `pnpm test` |
| Behavioral browser contracts | 46 tests pass | `pnpm test:e2e` |
| Accessibility and reflow | 6 representative workflow tests pass | `pnpm test:a11y` |
| Visual acceptance | 52 tests pass: screens 01-45, 4 stress states, 3 smoke baselines | `pnpm test:visual` |
| HELP catalogue | `help-catalog-v1` fixture validates with exact version and SHA-256; real-data rejects non-authoritative status | `pnpm catalog:validate`, `help-catalog.test.ts` |
| Prisma | Schema valid; all 6 sanitized Neon migrations current; clean-schema, shared-counter concurrency, and logical backup/restore verified | `pnpm db:validate`, `pnpm db:migrate`, `pnpm db:status`, `pnpm db:rate-limit-drill`, `pnpm db:recovery-drill` |
| Roster ingestion | Versioned dry-run/apply contract and synthetic CLI preview pass | `pnpm roster:import`, `lib/help-review/roster-import.test.ts` |
| Production builds | Next standalone web and bundled processor pass | `pnpm build`, `pnpm build:processor`, Cloud Build web/processor images |
| GCP infrastructure | Terraform format/validate pass; digest-pinned QA1 GCS/Eventarc/Vertex and QA2 managed-identity smoke pass; rollback, session-secret rotation, and final no-change refresh pass | `infra/gcp/`, `deployment-evidence.md` |

## Completed Task Evidence

| Task IDs | Implementation evidence | Focused acceptance evidence |
|---|---|---|
| 1.2, 1.6 | `help-roster-v1`, controlled merge importer, decision register, runtime feature/data guards | Seven roster validation/reconciliation/replay tests, CLI preview, decision register and runtime-config tests |
| 2.1-2.4 | Educator-first route tree; excluded workbench APIs/routes absent; lean schema and six forward migrations | CI route/build checks, scope audit, clean-schema deploy, shared-counter concurrency, and isolated logical backup/restore verification |
| 2.5-2.8 | Domain allowlists, injectable services/adapters, shared UI primitives, `screen-state-fixtures.ts` | Domain/bootstrap/runtime tests; all 45 named screen fixtures |
| 3.1-3.5 | Selected Identity Platform adapter, provider-owned recovery, exact provisioning/linking, signed sessions, safe return targets, generic unavailable state, centralized authorization | Managed-token/revocation and account-lifecycle unit tests; desktop/mobile E2E exchange; workflow tests for forged roles, expiry, deactivation, unassignment, direct access |
| 4.1-4.7 | `child-service.ts`, assessment projections, authoritative next actions, child/history/list pages | Workflow search/filter/history/stale-route/revocation checks; screens 02, 12-14, 16, 34 |
| 5.1-5.8 | Idempotent draft service, local/GCS adapters, resumable direct upload with signed completion and generation/CRC/container verification, responsive intake | Video policy/storage/upload-grant tests; live browser upload; workflow upload limits/replay/replacement/removal; screens 03, 17-20, 35 |
| 6.1-6.7 | Versioned schemas, fake and Vertex gateways, persisted coordinator, GCS/Eventarc dispatch, private processor, worker recovery, retry policy | Scoring/coordinator/dispatcher/processor tests; live Vertex synthetic call and browser-exit Eventarc outcome; screens 04, 21, 22, 36 |
| 7.1-7.6 | Minimal review projection, purpose-bound playback grants, revisioned decision commands and origins | Grant, service, workflow conflict/reload/finalized tests; real `206` playback and pixel/seek check |
| 8.1-8.10 | Desktop, mobile, and tablet review workspace plus loading/failure/conflict/no-result states | Keyboard/reflow checks and screens 05, 23-26, 37, 38, 42, 44 |
| 9.1-9.7 | Server-derived reconciliation, stale-safe idempotent finalization, immutable final projection | Workflow incomplete/stale/replay/final immutability checks; screens 06, 07, 27, 39, 41, 43 |
| 10.1-10.10 | Managed provider provisioning/lifecycle, Admin access/jobs views, confirmations, safe job projection and retry service | Identity lifecycle, service/API replay/revocation tests; QA2 live provider creation/deactivation/reactivation; screens 08, 09, 28-33, 45 |
| 11.1, 11.2, 11.4, 11.7 | Security baseline, public projections, redacted support/health output, 45-state harness, stress fixtures, fail-closed scope | QA2 live invalid/unverified/disabled/session/rate-limit checks; privacy-boundary workflows; 52 visual tests; conditional-feature and route audit |
| 12.4, 12.7 | Generation-protected processing markers, Eventarc, IAM-private Cloud Run processor, bounded scaling/concurrency/timeout, idempotent claims, release rollback, restore, rotation, and safe terminal follow-up | Live marker delivery, duplicate delivery no-op, browser-exit Vertex completion, logical restore, QA2 44-second rollback/forward, 14-second session-secret rotation and recovery sign-in |

## Partially Implemented But Correctly Open

| Task IDs | Repository/sanitized capability already present | Irreducible closing evidence |
|---|---|---|
| 1.1, 1.3-1.5 | Complete provisional contracts, live managed identity, and explicit fail-closed defaults | Named production artifacts/configuration for scientist, content, video lifecycle, and final infrastructure ownership paths |
| 11.3 | Automated axe, keyboard, focus, reflow, 360/768/1280, and 200% checks plus the complete local keyboard record in `docs/quality/accessibility-manual-acceptance-2026-07-15.md` | Recorded representative supported-screen-reader acceptance |
| 11.5 | Local payload/latency budgets, byte ranges, browser-exit durability, QA2 identity recovery, rollback, and secret rotation | Selected-provider measurements plus database point-in-time, storage-outage, and final scoring-contract drills |
| 11.6 | CI runs code, catalogue, six migrations, shared-counter, managed identity build, processor, browser, a11y, visual, Terraform, and diagnostic-artifact gates | Yi's exact contract job plus organization CI execution/artifact acceptance |
| 12.1-12.3, 12.5-12.6, 12.8-12.9 | Terraform-managed GCP/Neon development topology, QA1/QA2 rollout, GCS/Eventarc/Vertex and managed identity smoke, deployed redacted metrics/policies/dashboard, runbook, health, secrets, release procedure, logical recovery, rollback, and rotation | Organization project/service ownership, scientist/content acceptance, provider point-in-time/storage recovery, final alert receipt/owners, permissioned staging acceptance, and real-data launch evidence |

## Evidence Limits

- Automated accessibility checks do not replace a representative screen-reader review.
- The live Vertex adapter proves transport, authentication, structured validation, and orchestration behavior, not scientist-model validity or clinical reliability.
- QA2 is deployed with live managed identity and recovery evidence as recorded in `deployment-evidence.md`; that sanitized release still does not satisfy final organization permissioned staging or real-data acceptance.
- Permissions alone do not make the current build real-data ready; authoritative content/model configuration and exact-build operational acceptance remain required.
