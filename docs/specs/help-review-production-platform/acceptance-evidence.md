# HELP Review Engineering Acceptance Evidence

Updated: July 14, 2026  
Boundary: repository, CI, and sanitized/synthetic adapters  
Real-data production acceptance: not granted

This record explains why an implementation task is checked in `tasks.md`. A passing synthetic or local contract does not close a task whose wording explicitly requires a selected external provider, organization-owned environment, provider recovery exercise, or stakeholder acceptance.

## Automated Gates

| Gate | July 14 result | Command or artifact |
|---|---|---|
| TypeScript | Pass | `pnpm typecheck` |
| ESLint | Pass | `pnpm lint` |
| Unit/service/adapter contracts | 17 files, 106 tests pass | `pnpm test` |
| Behavioral browser contracts | 18 tests pass | `pnpm test:e2e` |
| Accessibility and reflow | 6 representative workflow tests pass | `pnpm test:a11y` |
| Visual acceptance | 52 tests pass: screens 01-45, 4 stress states, 3 smoke baselines | `pnpm test:visual` |
| Prisma | Schema valid; all 3 sanitized Neon migrations current | `pnpm db:validate`, `pnpm db:status` |
| Production build | Sanitized adapter configuration passes | `pnpm build` with the acknowledged CI environment |

## Completed Task Evidence

| Task IDs | Implementation evidence | Focused acceptance evidence |
|---|---|---|
| 1.6 | `decision-register.md`, `interim-live-contracts.md`, runtime feature/data guards | Decision register gate coverage and runtime-config tests |
| 2.1-2.3 | Educator-first route tree; excluded workbench APIs/routes absent | CI route/build checks and scope audit |
| 2.5-2.8 | Domain allowlists, injectable services/adapters, shared UI primitives, `screen-state-fixtures.ts` | Domain/bootstrap/runtime tests; all 45 named screen fixtures |
| 3.3-3.5 | Signed sessions, safe return targets, generic unavailable state, centralized authorization | Session/return-path tests and workflow tests for forged roles, expiry, deactivation, unassignment, direct access |
| 4.1-4.7 | `child-service.ts`, assessment projections, authoritative next actions, child/history/list pages | Workflow search/filter/history/stale-route/revocation checks; screens 02, 12-14, 16, 34 |
| 5.1-5.8 | Idempotent draft service, local/private Blob adapters, verified upload lifecycle, responsive intake | Video policy/storage and application-service tests; workflow upload limits/replay/replacement/removal; screens 03, 17-20, 35 |
| 6.1, 6.3-6.7 | Versioned schemas, fake/Gemini sandbox gateways, persisted coordinator, worker recovery, retry policy | Scoring/coordinator/service tests; browser-exit processing contract; screens 04, 21, 22, 36 |
| 7.1-7.6 | Minimal review projection, purpose-bound playback grants, revisioned decision commands and origins | Grant, service, workflow conflict/reload/finalized tests; real `206` playback and pixel/seek check |
| 8.1-8.10 | Desktop, mobile, and tablet review workspace plus loading/failure/conflict/no-result states | Keyboard/reflow checks and screens 05, 23-26, 37, 38, 42, 44 |
| 9.1-9.7 | Server-derived reconciliation, stale-safe idempotent finalization, immutable final projection | Workflow incomplete/stale/replay/final immutability checks; screens 06, 07, 27, 39, 41, 43 |
| 10.2-10.9 | Sanitized Admin access/jobs views, confirmations, safe job projection and retry service | Service/API replay/revocation tests; screens 08, 09, 28-33, 45 |
| 11.2, 11.4, 11.7 | Public projections, redacted support/health output, 45-state harness, stress fixtures, fail-closed scope | Privacy-boundary workflow checks; 52 visual tests; conditional-feature and route audit |

## Partially Implemented But Correctly Open

| Task IDs | Repository/sanitized capability already present | Irreducible closing evidence |
|---|---|---|
| 1.1-1.5 | Complete provisional contracts and explicit fail-closed defaults | Dated acceptance from scientist, content, roster/privacy, identity, and infrastructure owners |
| 2.4 | Lean constrained schema and three applied migrations | Approved provider backup/restore and rollback/forward-recovery exercise |
| 3.1-3.2 | Signed, provisioned, non-public sandbox session flow and safe failure UI | Selected HELP Connect or managed-provider contract, sandbox, recovery, and abuse controls |
| 6.2, 6.8 | Replaceable gateway, deterministic fixtures, and synthetic Gemini emulator | Scientist-selected production adapter and its contract/recovery suite |
| 10.1, 10.10 | Sanitized access/assignment commands and full current-adapter Admin workflow | Selected identity subject mapping/lifecycle and provider-backed end-to-end acceptance |
| 11.1 | Application security headers, cookies, origins, rate/body/file limits, replay and authorization tests | Selected identity callback and provider credential-abuse evidence |
| 11.3 | Automated axe, keyboard, focus, reflow, 360/768/1280, and 200% checks | Recorded representative screen-reader acceptance |
| 11.5 | Local payload/latency budgets, byte ranges, browser-exit durability, and current-adapter failures | Measurements and recovery drills in selected-provider staging |
| 11.6 | CI runs code, migration, browser, a11y, visual, build, and diagnostic-artifact gates | Selected identity/scientist provider contract jobs and organization CI acceptance |
| 12.1-12.9 | Transferable Vercel/Neon/Blob sanitized candidate, runbook, health, worker endpoint, and release procedure | Organization-owned services, provider sandboxes, backup/restore/rollback drills, manual acceptance, and real-data approvals |

## Evidence Limits

- Automated accessibility checks do not replace a representative screen-reader review.
- The synthetic Gemini adapter tests schema and orchestration behavior, not scientist-model validity or reliability.
- The July 14 repository candidate is deployed and live-smoke-verified as recorded in `deployment-evidence.md`; that sanitized release still does not satisfy selected-provider staging or real-data acceptance.
- No result in this document authorizes real child data.
