# Refined Milestone Plan

## Project Objective

Build an AI-assisted video analysis MVP for the HELP early childhood assessment. It should process child observation videos in batches, produce skill detection and scoring outputs that match the HELP workflow, give reviewers a way to correct those outputs, and improve agreement with calibrated expert raters over the course of the project.

The plan below follows the RFP payment milestones. The dashboard and review workflow matter, but the early work needs to focus on reproducing the current baseline, understanding where scoring is going wrong, and iterating on the prompt and model configuration with numbers attached to each change.

## Planning Assumptions

- Target kickoff: June 13, 2026, or earlier if source materials are available.
- Final delivery deadline: July 31, 2026.
- The system is decision support for educators and expert scorers; it does not assign final scores on its own.
- Acelero will provide the current Gemini prompt, HELP rubric and scoring rules, source materials, prior AI outputs, expert benchmark scores, available videos, child metadata, and video permission status.
- The primary RFP target is >=90% exact agreement with calibrated expert raters on a held-out validation set.
- Supporting metrics will be tracked where appropriate: percent agreement, Cohen's kappa, Krippendorff's alpha, and error rates broken out by score type or skill category.
- HELP scoring involves professional judgment and the permissioned video set is small, so any reliability claim has to be tied to a specific validation protocol, dataset, and metric definition agreed with Acelero.

## Pre-Kickoff Readiness: May 28 to June 12

This is the short setup window before formal kickoff. The goal is to get inputs and decisions in place so Milestone 1 doesn't stall on basic data access.

### Contractor Actions

- Review the RFP, current prototype description, and available project materials.
- Request and organize the required inputs:
  - Current Gemini prompt or Gem configuration.
  - HELP scoring rubric and scoring rules.
  - Relevant manual excerpts and source materials.
  - Prior AI output CSV files.
  - Expert benchmark scoring files.
  - Video files approved for use and their permission status.
  - Child demographic records needed for age-gated scoring.
  - Existing reliability results from the IRR study.
  - Any integration requirements for the internal assessment platform.
- Draft the technical workplan, validation approach, and data inventory.
- Identify any missing materials that could affect the schedule or reliability target.

### Acelero Inputs Needed

- Confirm the designated content advisor and expert scorer availability.
- Confirm which videos can be used for tuning, testing, and final validation.
- Confirm the primary reliability metric and validation protocol before tuning begins.

### Output

- Confirmed project intake checklist.
- Proposed validation protocol.
- Initial risk register and dependency list.

## Milestone 1: Kickoff And Requirements Alignment

**Target date:** June 13, 2026  
**Payment:** $500

### Goal

Get aligned on scope, data access, success metrics, technical architecture, and review cadence before the build picks up speed.

### Deliverables

- Finalized implementation plan and milestone schedule.
- Confirmed MVP scope for:
  - Batch video processing.
  - Age-gated skill detection.
  - AI-assisted credit assignment.
  - Structured output generation.
  - Human review and correction logging.
  - Export/API-ready data structure.
- Confirmed reliability evaluation design:
  - Tuning set.
  - Held-out validation set.
  - Primary metric for >=90% agreement.
  - Supporting metrics.
  - Rules for handling partial credit, present vs emerging disagreements, atypical indicators, circled scores, and DAL calculations.
- Proposed system architecture and deployment path.
- Weekly review cadence with Acelero's content advisor.

### Acceptance Criteria

- Acelero approves the MVP scope, data flow, validation approach, and review cadence.
- Required source materials and permissioned data are available or tracked as open dependencies.
- The project has a clear definition of done for each RFP milestone.

## Milestone 2: Working Prototype / Proof Of Concept

**Target date:** June 30, 2026  
**Payment:** $2,500

### Goal

Replace the current one-video-at-a-time manual workflow with an end-to-end prototype that processes a small batch of videos and produces outputs in a format the existing HELP workflow can consume.

### Deliverables

- Batch processing pipeline for approved videos.
- Video-to-child metadata matching using available demographic records.
- Age-gated candidate skill scoping so the model only evaluates HELP skills that apply to the child's age.
- Initial multimodal scoring workflow grounded in the HELP rubric, using the current prompt as the baseline.
- Structured output generation for each processed video:
  - Video ID and child metadata reference.
  - Skill ID.
  - Domain and strand.
  - Suggested credit assignment.
  - AI confidence score.
  - Timestamped evidence notes where available.
  - Draft DAL calculation fields where applicable.
  - Review flag for low-confidence or ambiguous outputs.
- Basic storage of outputs in a retrievable format.
- CSV and/or JSON export for analysis.
- Prompt/configuration version `v1` captured in the prompt version log.

### Acceptance Criteria

- The system processes a small sample batch without anyone hand-copying the prompt for each video.
- Outputs match the RFP's raw data audit requirements closely enough to run reliability analysis on them.
- Logs, errors, and outputs can be traced back to a specific video and prompt version.
- Acelero can review example outputs and say whether the format is workable for expert review.

## Milestone 3: First Reliability Benchmark

**Target date:** July 10, 2026  
**Payment:** $1,500

### Goal

Get a clean reliability baseline on the books, find out where the model is failing systematically, and decide what to fix first.

### Deliverables

- Baseline comparison between AI outputs and expert scorer outputs.
- Reliability report with:
  - Exact agreement against expert raters.
  - Percent agreement.
  - Cohen's kappa where appropriate.
  - Krippendorff's alpha where appropriate.
  - Agreement by score type.
  - Agreement by HELP domain or skill category where sample size allows.
- Error analysis separating:
  - Missed skill detection.
  - Incorrect skill detection.
  - Present vs emerging misclassification.
  - Emerging vs not present misclassification.
  - Age-gating or eligibility errors.
  - Evidence/timestamp weaknesses.
  - DAL calculation issues.
- Prompt/model iteration log with before/after metrics for each tested configuration.
- Prioritized improvement plan for the next reliability cycle.

### Acceptance Criteria

- Acelero gets a clear picture of where the AI is reliable today and where it isn't.
- Every prompt or model configuration we test has a versioned record and a measured result attached to it.
- The next round of improvements comes from observed errors, not guesses.

## Milestone 4: Human Review Interface Complete

**Target date:** July 15, 2026  
**Payment:** $1,500

### Goal

Give trained staff a working review interface where they can look at AI-generated skill detections and scores, accept them, change them, or throw them out.

### Deliverables

- Reviewer interface for processed videos.
- Review screen showing:
  - Video reference.
  - Suggested skill detections.
  - Suggested credit assignments.
  - Confidence score.
  - Evidence note and timestamp where available.
  - Low-confidence or ambiguous flags.
- Controls for trained reviewers to:
  - Accept AI suggestions.
  - Modify credit assignments.
  - Remove incorrect detections.
  - Add missing skills where needed.
  - Add reviewer notes.
- Structured logging of human overrides and corrections.
- Exportable review data that can feed back into later prompt iteration, model work, or fine-tuning.
- Reliability analytics kept in a separate internal/admin view, so the educator-facing workflow stays clean.

### Acceptance Criteria

- A trained reviewer can finish reviewing a processed video and export the result.
- Each human edit is linked back to the video, the skill, the reviewer action, a timestamp, and the prompt/model version.
- Low-confidence detections are visible without the reviewer having to dig for them.
- The interface makes it clear that AI outputs are there to support the reviewer's decision, not stand in for it.

## Milestone 5: Final Reliability Validation

**Target date:** July 27, 2026  
**Payment:** $1,500

### Goal

Run the final validation against the agreed held-out expert-scored set, with the prompt and model configuration locked, and report the AI-human agreement we actually achieved.

### Deliverables

- Final locked prompt/model configuration.
- Final validation run on the agreed held-out dataset.
- Reliability validation report including:
  - Exact agreement against calibrated expert raters.
  - Whether the >=90% RFP target was met.
  - Supporting reliability metrics.
  - Agreement by score category and domain where sample size allows.
  - Remaining mismatch analysis.
  - Recommendations for post-MVP data collection and improvement.
- Final prompt version log with every major iteration and before/after metric.
- Pilot readiness recommendation.

### Acceptance Criteria

- The validation set is held out from the tuning set, unless Acelero signs off on an alternative because the data won't support a clean split.
- The final reliability number can be reproduced from the stored inputs, outputs, prompt version, and metric script.
- The final report says plainly whether the >=90% exact agreement target was met under the agreed validation protocol.
- If the target isn't met because of data limits or unresolved scoring ambiguity, the report spells out what went wrong and what it would take to close the gap.

## Milestone 6: Final Delivery And Handoff

**Target date:** July 31, 2026  
**Payment:** $500

### Goal

Package the MVP, documentation, prompts, exports, and operating instructions so that Acelero's team can run it, review its outputs, and extend it after we're gone.

### Deliverables

- Final codebase or deployable project package.
- Technical documentation covering:
  - System architecture.
  - Data model.
  - Batch processing workflow.
  - AI provider configuration.
  - Prompt/versioning approach.
  - Reliability metric calculation.
  - Export/API-ready schemas.
  - Deployment recommendation.
- Operator guide covering:
  - Uploading or registering videos.
  - Matching child demographic records.
  - Running batch processing.
  - Reviewing outputs.
  - Exporting results.
  - Interpreting confidence and review flags.
- Final prompt version log.
- Final reliability report.
- Handoff session with Acelero's internal team.

### Acceptance Criteria

- Acelero can run or access the MVP by following the documented workflow.
- AI outputs and human review corrections can be exported in standard formats.
- The internal team has enough documentation to maintain the tool, evaluate it, and build on it.
- All final materials are delivered by July 31, 2026.

## Ongoing Communication Cadence

- One kickoff session at project start.
- A weekly working check-in with the content advisor, at minimum.
- Short async updates after each notable prompt or model experiment during the reliability phase.
- Review checkpoints before the July 10, July 15, July 27, and July 31 deliverables.
- Quick escalation when data access, permissions, or an unclear scoring rule is blocking the work.

## Key Dependencies

- Timely access to the current prompt, rubric, manual excerpts, prior outputs, and expert scores.
- Permissioned video access for both tuning and validation.
- A clean split between tuning data and held-out validation data.
- Content advisor and expert scorer availability when a scoring rule needs clarification.
- Agreement on how to count near-miss cases, especially present vs emerging disagreements.
- A decision on whether DAL calculation accuracy counts toward the final reliability target or is validated separately.

## Positioning Note For The Client

The plan is split roughly in half. The first half stands up a working batch pipeline and a defensible reliability baseline against expert scores. The second half is iteration: error analysis, prompt and model changes, and the reviewer interface, all aimed at closing the gap to the >=90% target. Final scoring decisions stay with trained staff; the AI feeds into their review.

