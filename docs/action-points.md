# HELP AI Crediting Companion: Action Points

Last reviewed: 2026-07-21

This is the practical product and engineering backlog derived from:

- `docs/emails.md`
- `docs/educator-happy-path-guide_SNComments - feedback.pdf`
- `docs/HELP 0-3_2nd Ed_Strands and Skills List_Updated (1).xlsx`
- `docs/HELP In-Service Training Deck_07162026_vF (1) (1).pptx`
- `docs/meeting-transcripts/July-21-meeting-transcript.md`
- `docs/upwork_chat.md`

The source requests were also checked against the current repository so completed work is not presented as new work.

## 2026-07-21 Implementation Update

All work that can be completed without Yi's repository, the full licensed credit notes, or the two private videos/expert scores is now implemented in the working version. The updated sanitized demo is live at `https://earlychildhoodassessment.vercel.app`. Checked items below are complete in code and covered by the repository tests. The generated 810-row workbook artifact remains `REFERENCE`, and the public demo continues to use only sanitized fixtures.

## Confirmed Product Direction

- Product name: **HELP AI Crediting Companion**.
- Users: **Educator** and **Admin/Supervisor**. Educators see assigned children; Admin/Supervisors can see and manage educators and assignments.
- Core flow: sign in -> select child -> upload one observational video -> wait for analysis -> review the AI draft -> add anything the AI missed -> finalize -> view/download the record.
- Yi's staged model pipeline is the intended first integration, based only on the July 21 meeting discussion. Her repository and actual contract have not yet been reviewed because access is still pending. The built-in `evidence-first-v1` scorer remains a fallback, not a competing primary implementation.
- The AI provides draft crediting support, a primary evidence timestamp plus optional supporting timestamps, and a short observation-based rationale. It does not replace educator judgment.
- AI draft outputs are limited to Present (`+`), Emerging (`+/-`), Not observed (`-`), or Blank/unscored. Atypical, N/A, and family/environment concern flags are educator-owned additions.
- Uploaded video is the real educator workflow and must remain the primary input. A YouTube-link input is optional if it fits the schedule; arbitrary Google Drive links and audio-only files are not an MVP requirement.
- For the MVP, automated candidate selection stays within the child's age range at the observation. More nuanced downward expansion is deferred; the always-assess exception still needs one explicit answer.
- The same child may be assessed repeatedly, commonly about twice a month. Every assessment must remain a separate dated record.
- The application can remain standalone now. HELP Connect data exchange is a future integration, not a reason to delay the working product.
- Email/password is the selected first-party sign-in path. The sandbox profiles remain sanitized demo-only access.
- The GCP stack is the reference deployment. Future AWS or HELP Connect ownership should be supported through clean data/API boundaries rather than a platform migration now.

## Immediate Client Deliverable

- [x] **NOW-01 Publish the updated sanitized prototype at the existing Vercel URL by 10:00 AM ET on 2026-07-22**, matching the commitment in the Upwork thread. The deployment is healthy at `https://earlychildhoodassessment.vercel.app`; neither real child video nor the client source files were published.
- [x] **NOW-02 Apply the noncontroversial visible changes first:** product name, Upload observational video wording, Educator/Admin-Supervisor wording, the dependent missing-credit control layout, and the requested summary-count layout.
- [x] **NOW-03 Show the meeting-confirmed review grouping:** Present, Emerging, Not observed, then Leave Blank. Use High, Medium, or Not sure for confidence. Keep Atypical, N/A, and family/environment concern controls separate and human-only. Do not imply that the AI generated them.
- [ ] **NOW-04 Obtain the missing client access.** Sign/return the BAA if still outstanding, then obtain and verify the client email, GitHub repository, and Google AI Studio access before inspecting Yi's code, integrating her model, or handling model assets. **Current blocker: Yi's repository is not accessible yet.**
- [ ] **NOW-05 Confirm the revised delivery date after the client's 2026-07-22 manager conversation.** Keep 2026-07-31 as the working MVP target, use any approved August extension for model/real-video testing, and do not plan work beyond the stated 2026-08-30 hard deadline.

## P0: Finalize The Scoring Rules

These decisions affect the database, model contract, review UI, summaries, and exports. Resolve them before expanding the authoritative catalog.

- [ ] **P0-01 Inspect and integrate Yi's staged model contract after access arrives.** Do not implement against assumptions from the meeting transcript. Once the repository is accessible, review its pipeline plan, Pydantic input/output schemas, and the stated stage 1, 2, 3, and 6 data boundaries; then map the verified contract to the TypeScript gateway, persisted result, and one model/configuration reference. Confirm whether Yi supplies categorical confidence or a numeric value requiring agreed thresholds; never present confidence as an accuracy score. Use `evidence-first-v1` only as an explicit fallback.
- [x] **P0-02 Implement the meeting-confirmed AI draft vocabulary.** Yi's model returns only Present (`+`), Emerging (`+/-`), Not observed (`-`), or Blank/unscored. It must not emit N/A, Atypical, or the family/environment concern flag because those require human context.
- [x] **P0-03 Keep AI drafts and educator-only decisions distinct in the schema and UI.** The educator can retain/edit the AI credit, intentionally leave an item blank, add N/A or Atypical where appropriate, and apply the `O` family/environment flag. The exact sensory variants remain covered by P0-16.
- [x] **P0-04 Make Leave Blank a real saved choice if it is allowed at finalization.** It is persisted separately from unactioned work and can be deliberately finalized.
- [x] **P0-05 Model `O` as an add-on flag, not a replacement credit.** It is stored on the underlying educator credit and cannot be attached to Blank or a dismissed item.
- [x] **P0-06 Enforce the confirmed sequential-credit rule.** Finalization now blocks an earlier `-` followed by a later `+` in the same strand, using workbook source order, and asks the educator to correct the pair. Other credit types do not trigger inference or automatic changes while the fuller stopping rule remains unresolved.
- [ ] **P0-07 Confirm the stopping/inference behavior.** The training deck describes highest full-plus logic, assumed competence after consecutive plusses, and stopping after two or three consecutive minuses. The current catalog leaves its two-minus rule disabled. Yi/content must provide the version used by this product.
- [x] **P0-08 Treat "not observed" as an opportunity-based decision.** The built-in scorer contracts and prompts require an observed opportunity for `-`; mere absence returns Blank/unscored. This rule still needs to be mapped to Yi's verified contract when access arrives.

**Meeting clarification:** use the HELP term **Not observed**, not **Not Present**. The transcript explicitly defines it as a negative credit only when there was an opportunity to observe the skill.

## P0: Build The Authoritative HELP Catalog

The supplied workbook is usable source data, but it cannot be dropped into the current schema unchanged.

- [x] **P0-09 Build a deterministic XLSX-to-catalog importer.** All 810 non-empty skill/strand rows import in workbook order.
- [x] **P0-10 Preserve the source hierarchy and order.** The 62 strands and nine source labels are preserved; `0.0` is reported separately, and Language/Fine Motor labels collapse only for developmental-domain coverage counts.
- [x] **P0-11 Stop treating the displayed skill code as unique.** Stable row/strand identifiers preserve all 810 rows and all 766 distinct displayed codes.
- [x] **P0-12 Relax the current catalog's unique-code validation.** Catalog validation now requires unique row identifiers and source order, not unique displayed codes.
- [x] **P0-13 Normalize age ranges without losing the source value.** Raw labels, half months, single values, and open-ended forms are preserved and tested.
- [x] **P0-14 Add an `alwaysAssess` field.** All 18 markers are imported and included as a conservative working exception to the within-age candidate rule; the scientist can change this policy without another data migration.
- [x] **P0-15 Preserve source order as the sequence authority.** Candidate selection, manual additions, and conflict checks retain workbook order.
- [x] **P0-16 Represent the `0.0` sensory exception.** Applicable A-variant keys are imported, standard `A` is rejected for `0.0`, and the UI/service restrict a skill to its defined `A+`, `A-`, or `A+/-` variants when that metadata is present.
- [ ] **P0-17 Obtain the licensed Inside HELP definitions/credit notes needed by the scorer.** The deck repeatedly states that titles and examples are not the full crediting criteria. The spreadsheet alone is not sufficient model guidance for every skill.
- [ ] **P0-18 Classify video scoreability.** Mark skills as directly scoreable, opportunity-dependent, context-dependent, longitudinal/caregiver-report dependent, or not reliably scoreable from one short video. Do not ask the model to invent evidence for non-video skills, and retain the HELP rule that valid disability or cultural-linguistic adaptations can still satisfy a skill.
- [ ] **P0-19 Produce and validate one versioned `AUTHORITATIVE` catalog artifact.** Keep `content/help-catalog.sanitized.json` as the demo fixture; do not relabel it as real HELP content.
- [x] **P0-20 Add catalog tests.** Tests assert 810 imported entries, 62 strands, 18 always-assess entries, duplicate display codes, source order, age parsing, and `0.0` behavior.
- [x] **P0-21 Replace the provisional downward-window selection for the MVP.** Automated candidates now use the observation-age snapshot, an inclusive age range, and the working always-assess exception with no downward fallback.

## P1: Update The Client-Facing Prototype

These are the most visible changes requested for the next prototype.

- [x] **P1-01 Rename every user-facing surface** from HELP Review/HELP Review Pilot to **HELP AI Crediting Companion**, including page metadata, sign-in, header, invite/reset emails, support subject, and the walkthrough.
- [x] **P1-02 Rename the intake action** to **Upload observational video** on the child list, child record, page heading, and related actions.
- [x] **P1-03 Remove the "Needs your review" section** because every AI draft requires educator review. The model groups now render as Present, Emerging, Not observed, then Leave Blank.
- [x] **P1-04 Use one consistent, clean action pattern across groups.** Pending items offer a direct Accept/Leave blank action plus one Edit/add-note path; reviewed items collapse to one Change decision action, and dismissal stays inside the decision editor. Confidence is shown only as AI confidence: High, Medium, or Not sure, with no raw percentage and an explicit note that confidence is not accuracy.
- [x] **P1-05 Replace the one-field missing-skill selector with dependent dropdowns:** Domain/section -> Strand -> Skill -> Credit. Each step constrains the next, preserves workbook order, handles duplicate displayed IDs, and excludes entries already present.
- [x] **P1-06 Keep educator-added skills traceable.** Added skills retain educator origin, selected credit/O flag, and optional note without model confidence or evidence.
- [ ] **P1-07 Show AI rationale and all supporting moments in plain observation language.** The UI now connects each draft credit to its observation explanation and distinguishes the primary video moment from supporting moments in both the item and decision editor. Final rationale quality remains blocked on Yi's real output and the licensed credit criteria.
- [x] **P1-08 Add summary coverage counts:** developmental domains, strands, included skills, and regulatory/sensory skills are derived from included final decisions.
- [x] **P1-09 Verify the Admin/Supervisor wording and view.** User-facing roles now use Admin / Supervisor while the existing access and assignment view remains direct.
- [x] **P1-10 Update the educator walkthrough and screenshots.** The HTML guide, all captured images, and the 15-page PDF now use the implemented terminology, controls, summary, and download behavior.

## P1: Repeated Assessments And Progress

- [x] **P1-11 Preserve every dated assessment for the same child.** New assessments remain separate and prior finalized records stay read-only.
- [x] **P1-12 Build the essential child progress view.** The child record now shows finalized observations chronologically and compares the latest two by domain, strand, skill, credit, and inclusion.
- [ ] **P1-13 Show useful progression, not only status history.** Dates, age snapshots, final credits, changed credits, and inclusion changes are complete. Highest-confirmed-skill logic remains deferred until P0-07 supplies the approved strand inference/stopping rule.
- [x] **P1-14 Do not hard-code an annual count.** The product has no assessment-count cap.
- [x] **P1-15 Test repeated use.** Unit and browser coverage includes two dated assessments in one month, multiple final records, in-progress history beside them, immutable age snapshots, changed credits, and removed skills.

## P1: Model Integration And Real Examples

- [ ] **P1-16 Accept the offer of expert scores for the two authorized videos.** Keep the score files paired with the 22-month and 24-month observations of the same child.
- [ ] **P1-17 Use the two videos as end-to-end calibration fixtures.** Run private file upload, Yi-model processing, evidence generation, educator review, finalization, and export in the authorized environment. If the optional YouTube adapter is built, exercise that input separately without making it the educator default.
- [ ] **P1-18 Compare Yi's scorer with the expert credits.** Review exact credit matches, `+` versus `+/-` disagreements, missed skills, sequence conflicts, unsupported inferences, and rationale quality with Yi. Do not use a clip with masking background music as the primary speech/language accuracy case.
- [ ] **P1-19 Do not present two videos as proof of 90% reliability.** They are valuable integration and calibration cases; broader agreement claims need a larger expert-scored set.
- [ ] **P1-20 Verify the simplified age behavior.** The same child at 22 and 24 months must use the assessment's age snapshot and only the catalog entries whose approved range contains that age, plus the always-assess entries if P0-14 confirms that exception.

## P2: Download, Timing, Cost, And Interoperability

- [x] **P2-01 Add an explicit final-record download.** The authenticated final-only PDF includes the child identifier, observation date/age, coverage, credits, domain/section, strand, skills, notes, decision origin, O flags, and confirmation details.
- [ ] **P2-02 Defer a machine import format until HELP Connect's contract is known.** When available, add a stable CSV or JSON export/adapter rather than reverse-engineering the future system now.
- [ ] **P2-03 Measure real upload and processing time.** Benchmark both a 3-minute and a 5-minute authorized test video in the reference GCP path. Report upload time separately from queued/processing time and show educators a realistic expectation.
- [ ] **P2-04 Prepare a simple usage-cost model.** Break out model/video processing, Cloud Run, storage, playback/egress, database, and email. Report cost per assessment, per child/month, and per child/year at both 15 and 20 assessments, then multiply by the expected roster size.
- [x] **P2-05 Document the current stack and model handoff in one short page.** See `docs/implementation-handoff.md`; it records the current adapters and explicitly avoids inventing Yi's unavailable schema.
- [ ] **P2-06 Keep HELP Connect integration narrow when details arrive.** The likely boundaries are roster/assignment input, compatible sign-in, and finalized-result output. Do not delay the standalone workflow while its API/auth contract is unknown.
- [ ] **P2-07 Treat YouTube as an optional secondary adapter.** First verify that the selected Gemini/Vertex path accepts the intended URL form and that the link is authorized and reachable. Normalize it to the same model-media contract as an upload. Do not add arbitrary Drive-folder or MP3 inputs unless educators actually need them.

## Current Repository Snapshot

| Capability | Current state | Remaining work from this review |
| --- | --- | --- |
| Educator and Admin roles | Present | User-facing Admin / Supervisor wording is applied; configure real accounts when supplied |
| Email/password invites and resets | Present | Configure the client's sender/account when ready |
| Assigned-child roster and dated assessment history | Complete in the working version | Finalized chronology and latest-versus-previous skill comparison are implemented |
| Private video upload and background processing | Present | Primary-input wording is complete; authorized 3-5 minute timing remains external work |
| Optional YouTube input | Missing | Add only after the upload/Yi-model path works and the URL contract is verified |
| Timestamped AI evidence/rationale UI | Present | Map Yi's primary and supporting timestamps and verify rationale quality |
| Yi model integration | Blocked: repository access not received; only a verbal meeting description is available | Obtain access, inspect the actual code/contract, map the verified schemas, and run a live private test |
| Educator adds a missed skill | Complete in the working version | Dependent Domain/section, Strand, Skill, and Credit choices retain educator origin |
| Read-only final record | Complete in the working version | Coverage, PDF download, print, and repeated-assessment links are present |
| HELP catalog | Sanitized demo plus generated 810-row `REFERENCE` artifact | Obtain approval and licensed credit notes before promoting any artifact to `AUTHORITATIVE` |
| HELP credit key | Complete for the verified working vocabulary | Map the same boundary to Yi after repository access arrives |
| Candidate age selection | Within-age plus working always-assess exception | Scientist can confirm or change the exception policy without a schema change |
| Sequential strand enforcement | Exact confirmed `-` then later `+` pair blocks finalization | Full stopping/highest-skill inference remains pending |
| Product naming | Complete | HELP AI Crediting Companion is used on user-facing surfaces and the guide |

## Inputs Needed From The Client/Scientist

- [ ] GitHub access to Yi's model repository. After access arrives, identify its actual staged input/output contract and the model/configuration reference to integrate; none of these have been verified from code yet.
- [ ] The approved full HELP definitions/credit notes and confirmation that the supplied workbook is the release source.
- [ ] Scientist confirmation of the working choices: educator-selected Blank can finalize, `0.0` uses its row-specific A variants, always-assess overrides normal age range, and only the exact earlier-`-`/later-`+` pair blocks finalization. The broader stopping/inference rule is still required before highest-skill calculations.
- [ ] Expert score files for the two authorized test videos.
- [ ] Final confidence labels for the UI and confirmation of whether the optional YouTube input belongs in the first pilot.
- [ ] Confirmation of the revised delivery date after the 2026-07-22 manager conversation.
- [ ] Expected educator/child roster size for a useful cost estimate.
- [ ] Brand guidelines and the client-owned email sender, hosting project/account, domain, and database details when they are ready.
- [ ] Any requested download format beyond the implemented readable PDF.
- [ ] HELP Connect sign-in/data/export documentation only when integration work is ready to begin.

## Completion Checks

- [x] The client workbook imports without dropping duplicate display codes or changing strand order.
- [x] Always-assess and sensory exceptions behave correctly under the working policy.
- [x] MVP model requests use the assessment age snapshot and do not apply the provisional downward expansion.
- [ ] Yi's staged request/response schemas validate at the web/processor boundary and retain one model/configuration reference.
- [x] AI drafts contain only Present, Emerging, Not observed, or Blank; educator-only credits/flags are never attributed to the model.
- [x] An intentional Blank is distinct from unactioned work.
- [x] The confirmed impossible earlier-`-`/later-`+` pattern cannot be finalized.
- [x] The built-in model contract requires a real opportunity before `-`; Yi's implementation still needs verification.
- [x] A suggestion can show its primary timestamp and all additional supporting timestamps without duplicating the skill.
- [x] Educators can add a missed credit through Domain/section, Strand, Skill, and Credit controls.
- [x] Final summaries show domain, strand, skill, and regulatory/sensory coverage and can be downloaded.
- [x] A child can accumulate and compare repeated finalized assessments.
- [ ] Both authorized videos complete the full flow with recorded upload/processing time and expert comparison.
- [ ] Uploaded video works as the primary input; optional YouTube support cannot block or weaken that path.
- [x] The sanitized Vercel demo continues to contain only sanitized fixtures; the client reference catalog and source-document paths return `404`.
- [x] Run the repository gates after implementation: `pnpm typecheck && pnpm lint && pnpm test`, then `pnpm test:e2e`, `pnpm test:a11y`, `pnpm test:visual`, and `pnpm build`.

## Remaining Work Order

1. Obtain Yi's repository access, inspect the actual implementation, and map only its verified schemas at the existing scoring gateway.
2. Obtain the full licensed credit notes and scientist confirmation of always-assess, stopping/inference, scoreability, and the current conservative finalization choices; then promote an approved artifact to `AUTHORITATIVE`.
3. Pair the two authorized videos with expert scores and run the private end-to-end model calibration.
4. Benchmark 3- and 5-minute upload/processing time and prepare the simple 15/20-assessment cost model.
5. Configure the client's real accounts, roster, email sender, hosting/domain, and database, then add YouTube or HELP Connect adapters only if their real contracts are supplied and still wanted.
