# HELP Review Decision Register

Updated: July 14, 2026  
Current release boundary: sanitized or synthetic data only

`CONFIRMED` decisions may ship inside their stated boundary. `PROVISIONAL` decisions may ship only in the visibly sanitized environment. `OPEN` decisions remain disabled and server-rejected. Target dates below are release gates rather than calendar promises because the evidence is owned outside this repository.

| ID | Gate | Decision and status | Accountable owner | Decision date / acceptance target | Evidence | Affected requirement, design, and task IDs | Release behavior |
|---|---|---|---|---|---|---|---|
| D-001 | Scientist | **PROVISIONAL:** the application owns durable processing state and invokes one replaceable scoring gateway | Engineering; scientist owner for acceptance | Recorded 2026-07-14; accept before real-data release | July 14 handoff discussion; `interim-live-contracts.md` section 1 | R4, R7, NFR-2, NFR-4, NFR-6; Design `Scoring-Service Boundary`, `Production Runtime And Operations`; Tasks 1.1, 6.2, 6.8, 12.4, 12.5 | Enabled for fake local testing and Vertex synthetic development |
| D-002 | Scientist | **PROVISIONAL:** scoring uses `help-scoring-v0` and all-or-nothing result validation | Engineering; scientist owner for acceptance | Recorded 2026-07-14; accept or replace before real-data release | `scoring-contract-fixtures.json`; scoring schemas and contract tests | R4, R5, R7, NFR-2, NFR-4; Design `Scoring-Service Boundary`, `Decision Persistence`; Tasks 1.1, 6.1, 6.2, 6.8 | Unknown, partial, mismatched, or oversized results are rejected |
| D-003 | HELP content | **PROVISIONAL:** HELP 2 is the pilot working catalogue | HELP content owner | Recorded 2026-07-14; verify before content acceptance | July 14 edition discussion; provisional catalogue implementation | R4, R5, R6; Design `Domain Model`, `Scoring-Service Boundary`; Tasks 1.4, 6.2, 12.8 | Sanitized catalogue only; canonical import remains blocked |
| D-004 | HELP content | **PROVISIONAL:** preserve hierarchy; select the age band first, then bounded downward content | HELP content owner; scientist owner | Recorded 2026-07-14; verify before content/scientist acceptance | July 14 scoring discussion; candidate selection contract tests | R4, R5; Design `Domain Model`, `Scoring-Service Boundary`; Tasks 1.1, 1.4, 6.1, 6.8 | Implemented only against the provisional catalogue |
| D-005 | HELP content | **OPEN:** do not implement a two-consecutive-minus stopping rule without author clarification | HELP author/content owner | Open 2026-07-14; resolve before content acceptance | July 14 unresolved discussion | R4, R5; Design `Scoring-Service Boundary`, `Fail Closed On Conditional Content`; Tasks 1.4, 6.2, 12.8 | Rule is absent; inferred automation is rejected |
| D-006 | Roster/context | **PROVISIONAL:** age and disability/IFSP context are assessment-time scoring inputs | Roster/privacy owner | Recorded 2026-07-14; approve vocabulary/source before real-data release | July 14 states both inputs are required and context can change | R2, R3, R4, R8; Design `Domain Model`, `Authentication And Authorization`; Tasks 1.2, 5.1, 6.2, 10.1, 12.8 | Typed snapshot with sanitized values only |
| D-007 | Video/privacy | **CONFIRMED FOR SANDBOX:** synthetic videos are the only currently permitted model-development input | Privacy/content owner | Confirmed 2026-07-14; real-video approval required before real-data release | July 14 states research-video permission is unavailable | R3, R4, R8, NFR-6; Design `Upload And Video Access`, `Security And Privacy Baseline`; Tasks 1.3, 5.2, 12.3, 12.9 | Real child video and real-data mode remain disabled |
| D-008 | Video/privacy | **PROVISIONAL:** sandbox accepts MP4/WebM/MOV up to 100 MB and five minutes | Engineering; privacy/storage owner for acceptance | Recorded 2026-07-14; approve before real-data release | Current policy and the meeting's three-to-five-minute target | R3, R5, R8, NFR-3; Design `Intake And Upload`, `Upload And Video Access`; Tasks 1.3, 5.2, 5.8, 12.3 | Enforced only as a sanitized boundary |
| D-009 | HELP content | **PROVISIONAL:** canonical negative credit is `NOT_OBSERVED`, displayed as “Not observed” | HELP content owner | Recorded 2026-07-14; approve before content acceptance | Accepted screen set and centralized credit presentation | R5, R6, NFR-1; Design `Canonical Values`, `Review`; Tasks 1.4, 7.3, 8.4, 12.8 | Centralized label can be replaced without changing stored code |
| D-010 | Scope/content | **CONFIRMED FOR V1:** add-on flags, manual skills, exports, alternate outputs, and amendments are excluded | Product owner | Confirmed by July 10 scope; revise requirements before any change | Requirements `Explicitly Out Of Scope`; API/domain allowlists | R5, R6, R8, NFR-4; Design `Scope Boundary`, `Fail Closed On Conditional Content`; Tasks 1.4, 7.3, 8.4, 11.7 | Hidden and server-rejected |
| D-011 | Final output | **PROVISIONAL:** the on-screen read-only final record is the interim output | Product/content owner | Recorded 2026-07-14; accept or revise before staging acceptance | Accepted screens 06, 07, 27, 39, 41, 43 | R6, R8; Design `Summary And Finalization`, `Keep Finalization Simple`; Tasks 1.4, 9.1-9.7, 12.8 | No PDF, export, or alternate-output endpoint |
| D-012 | Identity | **PROVISIONAL:** signed, provisioned fixture identity is the only enabled identity until a live contract exists | Identity owner | Recorded 2026-07-14; replace before real-data release | No HELP Connect protocol, sandbox, or provider mapping supplied | R1, R8, NFR-4; Design `HELP Connect And Google Cloud Ownership Boundary`, `Authentication Selection`; Tasks 1.5, 3.1, 3.2, 12.5 | Visible sandbox banner; no public signup or real data |
| D-013 | Identity | **OPEN:** prefer HELP Connect reuse; otherwise select exactly one managed provider | HELP Connect technical owner; organization identity owner | Open; select before Tasks 3.1/3.2 can close | Stakeholder direction and requirements R1 | R1, R8, NFR-4, NFR-6; Design `Authentication Selection`, `Email/Password Fallback`; Tasks 1.5, 3.1, 3.2, 10.1, 11.1, 12.5 | No parallel live providers and no application password store |
| D-014 | Ownership | **CONFIRMED:** shared Vercel/Neon/Blob is a historical sanitized demo, not organization-owned production | Engineering; organization technical/budget owners for handoff | Confirmed 2026-07-14; select owned services before real-data release | Existing Vercel deployment record | R8, NFR-4, NFR-6; Design `Production Runtime And Operations`; Tasks 1.5, 12.1-12.9 | Not the selected forward deployment path |
| D-015 | Scientist | **CONFIRMED FOR DEVELOPMENT:** Gemini on Vertex AI implements the scoring contract for synthetic testing, not the accepted scientist model | Engineering; scientist owner for replacement/acceptance | Confirmed 2026-07-14; cannot self-issue scientist acceptance | Live Vertex synthetic call; gateway and contract tests | R4, R8, NFR-4, NFR-6; Design `Scoring-Service Boundary`; Tasks 1.1, 6.1, 6.2, 6.8, 12.5 | Server-only ADC; canonical GCS input; real-data guard remains closed |
| D-016 | Cross-cutting | **OPEN:** real child data requires accepted identity, permission, vendor, storage, retention, deletion, incident, and ownership evidence | Organization privacy/security, product, and technical owners | Open; all evidence required before real-data release | Requirements R8 and `external-launch-gates.md` | R1-R8, NFR-2-NFR-6; Design `Security And Privacy Baseline`, `Production Runtime And Operations`; Tasks 1.1-1.5, 11.1-11.6, 12.1-12.9 | `HELP_REVIEW_REAL_DATA_ENABLED=true` fails closed |
| D-017 | Runtime | **CONFIRMED FOR DEVELOPMENT:** use public Cloud Run web, private Cloud Run processor, private GCS, Eventarc, Vertex AI, Secret Manager, Artifact Registry/Cloud Build, and Neon through Prisma; do not add Cloud Tasks or duplicate video storage | Engineering; organization technical/budget owners for handoff | Implemented and deployed 2026-07-14; organization acceptance before real data | Terraform state/configuration, Cloud Run revisions, Eventarc trigger, GCS/Vertex synthetic smoke | R3-R5, R8, NFR-2-NFR-4, NFR-6; Design `System Architecture`, `Production Runtime And Operations`; Tasks 5.2, 6.2-6.4, 12.1-12.7 | Synthetic development enabled; organization ownership and real-data launch remain closed |

## Gate Coverage

| Task gate | Register decisions | Remaining evidence |
|---|---|---|
| 1.1 Scientist scoring | D-001, D-002, D-004, D-015 | Scientist-owned package/service contract and accepted fixtures |
| 1.2 Roster and context | D-006 | Authoritative roster, assignment, permission, identifiers, vocabulary, and cadence |
| 1.3 Video and storage | D-007, D-008, D-014, D-016 | Privacy permission, vendor/region, retention/deletion, backup, and incident owner |
| 1.4 HELP content and output | D-003, D-004, D-005, D-009, D-010, D-011 | Authoritative catalogue/labels, two-minus answer, and final-output acceptance |
| 1.5 Identity and ownership | D-012, D-013, D-014, D-016, D-017 | HELP Connect or one managed provider plus organization acceptance of the GCP project and dependency ownership |

## Change Control

1. A change to an `OPEN` or `PROVISIONAL` decision requires a dated owner approval, evidence link, affected requirement/design/task IDs, contract or catalogue version, migration impact, tests, and release behavior.
2. Any new role, flag, label, output, identity mode, provider, real-data use, or previously excluded surface requires an explicit revision to `requirements.md` before design or implementation changes begin.
3. Engineering may implement a replaceable adapter against sanitized fixtures, but that adapter does not convert inferred transcript content into approval.
4. Runtime configuration must reject unavailable providers, unapproved conditional features, and real-data enablement without `HELP_REVIEW_REAL_DATA_APPROVAL_ID` and approved non-sandbox adapters.
5. The release record must link the accepted decision IDs. Missing or contradictory evidence blocks the release; it is never resolved by silently changing a default.

## Required Follow-Up Evidence

- Scientist design/package and sanitized accepted/error fixtures.
- Synthetic-video criteria promised in the July 14 meeting.
- HELP author clarification on the two-minus rule.
- Content-owner verification of the structured HELP 2 catalogue and labels.
- Authoritative roster, assignment, permission, and context contract.
- HELP Connect identity interface and sandbox, or approval of one managed fallback.
- Organization-owned infrastructure, secrets, cost, privacy, recovery, and incident ownership record.
