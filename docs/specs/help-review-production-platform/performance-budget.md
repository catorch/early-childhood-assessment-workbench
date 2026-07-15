# HELP Review Performance And Payload Budget

Updated: July 14, 2026  
Scope: deterministic local/CI and sanitized staging release gate

| Operation | Sanitized release threshold | Payload threshold |
|---|---:|---:|
| Readiness | less than 3 seconds | 8 KB |
| Assigned children | less than 3 seconds | 128 KB |
| Assessment index | less than 3 seconds | 128 KB |
| Processing status | less than 3 seconds | 128 KB |
| Review projection | less than 3 seconds | 256 KB |
| Review mutation/finalization | less than 3 seconds | 128 KB |
| Initial authorized media range | provider-dependent, progressive | requested range only |

`tests/e2e/performance-contracts.spec.ts` records status, elapsed time, and body bytes for representative sanitized operations and fails these budgets. `tests/e2e/workflow-contracts.spec.ts` additionally proves that review/list JSON excludes storage keys, checksums, and unrestricted provider payloads; playback returns a bounded `206`; and processing completes after the initiating page closes.

These are pilot regression budgets, not claims about real-data production capacity. Before real-data launch, repeat the measurements in organization-owned staging with the selected identity, database, storage, worker, and scientist adapter. Record p50/p95, expected pilot concurrency, region, provider quotas, and alert thresholds. A regression or unmeasured selected-provider path blocks acceptance.
