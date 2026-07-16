# Manual accessibility acceptance - July 15, 2026

## Scope and environment

- Build: current local worktree after the July 15 feature audit
- Data: sanitized local fixture data only
- Web adapter: `HELP_REVIEW_STATE_ADAPTER=local`
- Video adapter: `HELP_REVIEW_VIDEO_ADAPTER=local`
- Viewports: 1440 x 1000 desktop and 390 x 844 mobile
- Input method: keyboard only for every action listed below
- Semantic inspection: Chromium full accessibility tree through the DevTools protocol
- Visual inspection: full-page desktop and mobile screenshots plus horizontal-overflow measurement

This record proves the complete local keyboard journey and representative programmatic semantics. It does not claim an actual screen-reader session; that remains a separate release acceptance item.

## Keyboard journey

| Area | Actions executed without a pointer | Expected result | Result |
|---|---|---|---|
| Sign-in and shell | Traversed the branded entry, three sanitized profiles, support action, navigation, and sign-out; activated Alex Morgan and Casey Rivera with Enter | Focus follows the visual order, every action has a useful name, role-aware navigation appears, and support has a real configured recipient | Pass after `UX-005` fix |
| Children | Searched for Child 1024, cleared search, opened Child 1001, and reached assessment intake | Search is labelled, results update without focus loss, the child row is operable, and the detail page has one useful H1 | Pass |
| Intake and upload | Reached the labelled observation date, opened the native file chooser, selected the synthetic MP4, uploaded it, and started processing | Date and file controls are labelled; upload and processing status are conveyed; the next valid action becomes available | Pass |
| Processing | Followed the processing state into a ready review with eight suggestions | Status is programmatic and the review action is keyboard reachable after completion | Pass |
| Review | Expanded and collapsed AI evidence, selected an independent credit, entered a note, saved, accepted the remaining drafts, exercised the unsaved-navigation guard, discarded the temporary edit, and opened summary | Credit buttons expose pressed state, progress moves from 0 to 8, the unsaved guard blocks navigation honestly, and no action needs a pointer | Pass |
| Summary and finalization | Inspected totals and the domain table, opened the finalization alert dialog, verified initial focus and Escape restoration, confirmed with Enter, and inspected the read-only record | The alert dialog is named, Cancel receives initial focus, Escape returns focus to its trigger, finalization is deliberate, and the final record has no mutation controls | Pass |
| Admin access | Searched and filtered staff, selected detail rows, opened and escaped deactivation and assignment-removal dialogs, opened the provisioning form, triggered native validation, and cancelled | Filters and rows are operable; dialogs restore focus; form validation focuses the invalid field; cancelling returns to the opening trigger | Pass after `A11Y-004` fix |
| Admin jobs | Filtered Stuck and All, searched Child 1024, opened a job, inspected attempts, opened and escaped retry confirmation, closed details, and reopened the row | Filter state is exposed, job detail and retry controls are named, dialogs restore focus, and closing detail returns to the selected job row | Pass after `A11Y-005` fix |

## Programmatic semantics

Chromium accessibility-tree inspection confirmed:

- one H1 on representative child, review, summary, final, access, and jobs views;
- landmark exposure for main content, navigation, the jobs region, and job complementary detail;
- accessible names for support, sign-out, search, status filter, evidence toggles, credit choices, note input, finalization, provision, and retry controls;
- `aria-pressed` on review credit choices and job filters;
- `aria-expanded` on evidence toggles, the provision form trigger, and job-detail rows;
- a named `table` for credits by HELP domain;
- `alertdialog` semantics for finalization, access removal, deactivation, and retry confirmation;
- no review mutation controls in the finalized record.

These checks supplement axe and browser tests. They are not a substitute for VoiceOver, NVDA, JAWS, or another supported screen reader.

## Reflow and visual review

- Desktop Jobs at 1440 x 1000 showed the list and detail panel without clipping, overlap, or displaced controls.
- Mobile Jobs at 390 x 844 stacked filters, search, the job row, details, safe diagnostics, and retry action in a coherent order.
- Mobile `scrollWidth` equalled `clientWidth` at 390 pixels.
- The persistent sandbox banner, brand, role navigation, and page content remained distinct at both sizes.

## Defects and fixes

| ID | Error observed | Fix | Retest |
|---|---|---|---|
| `UX-005` | With no support recipient configured, the interface exposed a recipient-free `mailto:` action | Invalid or absent recipients now return no action; affected surfaces keep plain guidance and browser tests receive a valid synthetic address | Pass |
| `A11Y-004` | Cancelling the inline Provision staff form moved focus to the document body | The opening trigger is retained, exposes expanded/control state, and receives focus after cancel or successful closure | Pass, manual plus targeted Playwright |
| `A11Y-005` | Closing Processing job details moved focus to the document body | The selected job row exposes expanded/control state and receives focus after the panel closes | Pass, manual plus targeted Playwright |

## Verification record

- Targeted post-fix Playwright: 2 passed (`ADMIN-ACCESS-004`, `ADMIN-JOBS-003/005/007`)
- Manual retest: every row in the keyboard journey above passed after fixes
- Full post-fix regression: TypeScript and ESLint pass; 27 Vitest files with 165 tests pass; 46 behavioral, 6 accessibility/reflow, and 52 visual browser tests pass; managed-identity web and processor production builds pass; catalogue, Prisma schema/status, and Terraform validation pass

## Remaining accessibility acceptance

`QUALITY-001` is closed by this keyboard record and the automated keyboard/reflow suite. `QUALITY-002` remains partial until representative Educator and Admin journeys are performed with an agreed supported screen reader and the spoken names, state changes, validation messages, live announcements, and reading order are recorded.
