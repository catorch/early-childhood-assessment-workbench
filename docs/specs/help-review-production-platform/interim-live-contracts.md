# HELP Review Interim Live-Integration Contracts

Version: `2026-07-14-v1`  
Scope: sanitized implementation and synthetic model evaluation only  
Authority: July 10 requirements, July 14 working session, and the explicit instruction to complete the platform with currently available information

These contracts let engineering complete and verify the platform without turning an inference into a real-child-data approval. Every section has a production replacement gate. The application remains fail-closed until the replacement is accepted.

## 1. Scientist Scoring Contract

### Selected Interim Boundary

The application owns assessment and job state. A durable application worker claims one queued `ProcessingRun`, invokes exactly one selected `ScoringGateway`, validates the complete response, and commits all suggestions atomically. The browser polls only the application's persisted status. It never polls Gemini or a scientist package directly.

The scientist deliverable is treated as a replaceable package or service adapter. Gemini on Vertex AI is the selected development implementation of that contract, not an assertion that the scientist has accepted its prompt/model behavior.

### Request `help-scoring-v0`

| Field | Rule |
|---|---|
| `runId` | Unique application run identifier |
| `idempotencyKey` | Stable for one attempt; replay cannot create another attempt |
| `catalogVersion` | `help-2-provisional-2026-07` |
| `observationDate` | ISO date |
| `ageMonthsAtObservation` | Integer `0..216`, captured with the assessment |
| `supportContext` | `NONE_REPORTED`, `IFSP`, `DISABILITY`, `IFSP_AND_DISABILITY`, or `UNKNOWN` |
| `video` | Opaque asset ID, approved MIME type, byte size, optional verified duration and SHA-256 |
| `candidates` | Unique, ordered, allowlisted HELP skill records |

Names, email addresses, external child identifiers, assignments, notes, and prior educator decisions are excluded from the scoring request.

### Result

The result is either:

- `VALID` with one or more complete suggestions; or
- `NO_VALID_RESULTS` with zero suggestions.

Each suggestion contains an allowlisted source skill ID, canonical draft credit or `null`, optional confidence, uncertainty reason when unscored, ordered timestamped evidence, and source order. Unknown skills, credits, duplicate identifiers, invalid evidence, oversized payloads, or partial results reject the entire response.

### Processing And Recovery

- States: `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`.
- A run is claimed transactionally and serialized per assessment.
- Browser exit does not cancel work.
- A running attempt with no update for 15 minutes becomes `PROCESSING_STUCK`.
- Safe failures distinguish authentication, rate limiting, timeout, provider unavailable, invalid result, and unavailable video.
- Only failed or stuck attempts with an available source video and current permission can be retried.
- Retry creates a new attempt and retains the previous attempt.
- Model, prompt, contract, and catalogue versions are stored in `scoringConfigurationReference`.

### Sanitized Fixtures

The contract suite covers accepted, uncertain, invalid-credit, invalid-evidence, empty-result, slow, retryable-failure, and terminal-failure responses. Real provider fixtures replace them before the launch gate.

### Production Replacement Gate

The scientist owner must provide the promised design/package, supported runtime, exact model and prompt configuration, authentication, sanitized examples, timeout/retry expectations, and acceptance cases. Contract version `v0` is replaced or explicitly accepted before real child data.

## 2. Roster, Identifier, Assignment, And Context Contract

### Interim Source

The Admin surface is the controlled sanitized source. It provisions exact staff identities and creates or revokes one Educator-to-child assignment. Child fixtures are opaque and contain no real names.

### Stable Records

- `User.externalSubject` is the stable identity-provider key.
- `Child.externalChildId` is an opaque roster key, unique within the pilot.
- `ChildAssignment` has an effective start and revocation/end state.
- An Educator can access a child only while both staff access and the exact assignment are active.
- Admin has no implicit access to child, video, review, summary, or final records.

### Assessment Context Snapshot

The assessment captures:

- age in completed months at observation;
- `supportContext` as a typed state, including explicit `UNKNOWN`;
- the approved display label, if any;
- processing permission at creation;
- capture time and source.

Later roster changes do not silently rewrite an existing scoring request. Current assignment and processing permission are nevertheless rechecked before upload, processing, playback, review mutation, and finalization.

### Reconciliation

Missing, duplicate, inactive, revoked, or ambiguous records fail closed. No record is auto-merged by display name. Deactivation and unassignment immediately block subsequent direct requests.

### Production Replacement Gate

The organization must identify the authoritative roster/assignment system, update cadence, stable subject/child keys, deactivation semantics, and approved disability/IFSP vocabulary. The adapter contract remains unchanged.

## 3. Video Policy And Storage Contract

### Interim Sanitized Policy

- Synthetic or otherwise explicitly sanitized videos only.
- One primary observation video per assessment.
- Working observation target: 3 to 5 minutes.
- Hard sandbox limit: 100 MB and 5 minutes when duration is available.
- Accepted types: MP4, WebM, and MOV/QuickTime.
- One canonical private Cloud Storage object in the Google Cloud development environment; local private files in local development.
- Direct resumable browser upload through an expiring server-issued session; server completion verifies generation, CRC32C, content metadata, size, and container signature.
- Upload completion is accepted only after server-side object metadata verification.
- SHA-256 and duration are retained when the adapter can verify them.
- Replacement/removal invalidates the prior active object and deletes its bytes.
- Authorized playback supports byte ranges and is recorded without storing a temporary URL or token.
- Incomplete objects are never eligible for processing.
- Vertex AI reads the canonical `gs://` object through the processor service account; there is no Gemini Files upload or second provider copy.

The July 14 meeting states that research videos do not yet have parent permission for model development. They remain prohibited. Generated videos may test transport and behavior extraction, but they are not reliability ground truth.

### Production Replacement Gate

The privacy owner must approve allowed use, permission source, vendor, region, encryption, retention, deletion deadline, backup behavior, incident owner, provider logging, and cross-cloud transfer before real child video is enabled.

## 4. HELP Content And Final Output Contract

### Selected Interim Content

- Catalogue: HELP 2nd Edition working set, because pilot educators use that edition.
- The structured catalogue must preserve domain, strand, stable source skill ID, age band, and hierarchical source order.
- Candidate selection begins in the child's age band and expands downward in the same ordered content when needed.
- Skills above the child's upper age boundary are not forced into the candidate set.
- IFSP/disability context widens downward consideration but never assigns a lower credit by itself.
- The two-consecutive-minus rule is not implemented until the HELP author clarification is recorded.

### Canonical Credits

| Code | Interim label | Meaning |
|---|---|---|
| `PRESENT` | Present | Direct evidence supports the complete observed skill |
| `EMERGING` | Emerging | Direct evidence supports a partial or developing performance |
| `NOT_OBSERVED` | Not observed | The relevant opportunity exists but the behavior is not observed |
| `NOT_APPLICABLE` | N/A | The observation does not provide an applicable opportunity |

Insufficient or ambiguous evidence is not forced into a credit. It returns an unscored suggestion for independent Educator judgment.

Add-on flags, manual omitted-skill creation, PDF/export, amendments, and alternate final outputs remain absent and API-rejected. The on-screen read-only final record is the selected interim output.

### Production Replacement Gate

The content owner must verify the structured HELP 2 catalogue against the authoritative source, approve labels/descriptions and evidence behavior, resolve the two-minus rule, and accept or revise the final output.

## 5. Identity And Ownership Contract

### Selected Interim Identity

The sanitized deployment uses administrator-provisioned fixture identities. It has no public signup, password store, recovery flow, or claim of HELP Connect federation. Sessions are HTTP-only, same-site, secure in production, time-limited, and rechecked against active access on each request.

Exactly one production identity mode will replace it:

1. HELP Connect OIDC/OAuth-compatible reuse, if the provider contract is supplied; otherwise
2. one organization-approved managed email/password provider.

The application will not ship both production modes and will not store passwords.

### Interim Infrastructure Ownership

The sanitized deployment uses a public Next.js Cloud Run service, an IAM-private processor Cloud Run service, Neon PostgreSQL, a private Cloud Storage bucket, Eventarc, Vertex AI, Secret Manager, Artifact Registry, Cloud Build, and Cloud Logging. Terraform reproduces the topology. Local development keeps the same web/processor boundary through HTTP without requiring Google Cloud.

The development project proves deployment and synthetic workflows but is not represented as organization-approved real-data production. The scientist's package or replacement service remains behind the same `ScoringGateway` contract.

### Production Replacement Gate

Required: HELP Connect protocol/owner/sandbox, chosen identity provider, organization-controlled Google Cloud organization/project, Neon or approved PostgreSQL ownership, secret owner, technical owner, budget owner, region, cost visibility, and transfer acceptance.

## 6. Change Gate

1. `CONFIRMED` decisions may ship within their approved data boundary.
2. `PROVISIONAL` decisions may ship only in the visibly sanitized environment.
3. `OPEN` decisions remain hidden and server-rejected.
4. A production provider or real-data change requires an updated requirement, contract version, tests, owner, approval date, and release behavior.
5. No generated screen, prompt, inferred transcript phrase, or working demo is itself an approval.

The companion [decision register](decision-register.md) records current status and evidence.
