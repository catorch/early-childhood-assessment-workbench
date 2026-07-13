# May 27 Contract-Winning Action Points

Source: `May-27.md`

## Decision Context

- The client needs to choose a contractor by end of day May 28.
- They want a simple contract drafted and approved by May 29.
- Kickoff is expected around June 10 or June 11.
- Final delivery and handoff have a hard deadline of July 31.
- Budget appears capped, and the proposal is already slightly below the maximum, which is favorable.
- The project timeline is fast: roughly 6 to 7 weeks.

## What The Client Cares About Most

- Improve AI-human reliability for HELP video scoring.
- Treat the first priority as scoring quality, not the dashboard.
- Build an MVP that can process multiple videos in batches.
- Keep humans in the loop; the tool should support educator and expert judgment, not replace it.
- Make the backend easy to embed into their existing internal assessment system later.
- Use the existing HELP assessment structure correctly:
  - Skills are age-bound.
  - There are 700+ skills total, but only a subset applies to each child.
  - Scoring includes present, emerging, not present, atypical development, and circled items for family discussion.
- Be realistic about reliability:
  - Current AI-human agreement may be around 50%, depending on metric.
  - Anything above 75% would make the client happy.
  - 80% is ideal.
  - 90% is aspirational, but should not be promised.
- Respect video permissions and data privacy. They may only be able to provide 10 to 15 videos for model development.

## Immediate Actions To Win The Contract

1. Send a same-day follow-up message that mirrors the client's priorities.
2. Ask for the key materials needed to refine the plan:
   - HELP scoring rubric and scoring rules.
   - HELP manual or relevant excerpts.
   - Existing Gemini prompt or Gem configuration.
   - Prior AI output CSV files.
   - Expert benchmark scoring files.
   - List of available videos and permission status.
   - Any existing proposal, scope, or milestone expectations.
   - Notes on the existing internal assessment platform and future integration needs.
3. Send a refined milestone plan by midday May 28.
4. Position the approach as "reliability first, product second":
   - First reproduce the current baseline.
   - Then diagnose where scoring fails.
   - Then improve prompts, retrieval, scoring logic, and output validation.
   - Then build the batch-processing MVP and review workflow.
5. Emphasize structured experimentation:
   - Compare multiple prompting and scoring strategies.
   - Track reliability by metric and skill category.
   - Separate skill detection errors from score classification errors.
   - Pay special attention to present vs emerging misclassification.
6. Make the dashboard secondary and practical:
   - Admin/researcher view for experiments, reliability, and review.
   - Educator-facing output should be suggestions and evidence, not raw reliability analytics.
7. Frame the product as decision support:
   - "The system should surface likely observed skills and evidence from video, while final scoring remains under educator or expert control."
8. Show awareness of data limitations:
   - Do not overpromise custom model training from 10 to 15 videos.
   - Use the videos for evaluation, prompt/rubric tuning, and error analysis.
   - Explore synthetic or generated examples only as a supplement, not as a substitute for real validation.
9. Highlight relevant credibility:
   - AI education technology experience.
   - Ability to build quickly as an independent contractor.
   - Comfort working closely with subject matter experts.
   - Respect for assessment nuance in early childhood contexts.
10. Offer a low-friction pre-kickoff step:
   - Once materials are shared, review the prompt, rubric, and prior outputs.
   - Return a sharper technical plan and acceptance criteria before contract finalization.

## Proposed Follow-Up Message

Hi [Name],

Thank you again for walking me through the HELP assessment workflow and the MVP goals. Based on our conversation, I would structure the project around improving scoring reliability first, then building the batch-processing and review experience around that pipeline.

The first phase would reproduce the current baseline using the existing videos, expert scores, AI outputs, rubric, and Gemini prompt. From there I would run a structured error analysis to separate missed skill detection from scoring disagreements, especially cases where the model marks a skill as present but the expert considers it emerging. That should give us a practical path toward the 75-80% reliability range while keeping 90% as an aspirational target rather than a guarantee.

For the MVP, I would keep the educator-facing output as decision support: likely observed skills, suggested scores, confidence, and evidence, with human judgment remaining central. The admin/research side can include reliability metrics, experiment tracking, batch processing, and expert review tools. I would also keep the backend integration-ready so it can later be embedded into your existing assessment system.

If you can share the scoring rubric, existing prompt, prior output CSVs, expert benchmark scores, and video permission status, I can send back a more specific milestone plan by tomorrow.

## Proposed Milestones

### Pre-Kickoff: May 27 to May 29

- Review rubric, manual excerpts, current prompt, prior AI outputs, and expert benchmark files.
- Confirm available videos and permission constraints.
- Define MVP acceptance criteria and reliability metrics.
- Finalize scope, deliverables, and milestone dates.

### Week 1: Baseline And Data Setup

- Organize video metadata, age information, disability or IFSP status, expert scores, and prior AI outputs.
- Reproduce or approximate the current Gemini workflow.
- Establish baseline reliability using agreed metrics:
  - Percent agreement.
  - Cohen's kappa where appropriate.
  - Krippendorff's alpha where appropriate.
- Identify the highest-impact error categories.

### Week 2: Rubric-Grounded Scoring Pipeline

- Convert the HELP rubric and scoring rules into a structured scoring pipeline.
- Filter candidate skills by child age and relevant metadata.
- Generate structured outputs for each video:
  - Detected skill.
  - Suggested score.
  - Evidence from observed behavior.
  - Confidence.
  - Rationale.
  - Review flag.
- Improve handling of present vs emerging vs not present.

### Week 3: Reliability Experiments

- Run iterative prompt and pipeline experiments.
- Compare results against expert benchmark scores.
- Track improvement by score type, skill area, and age range.
- Produce an error-analysis report with clear recommendations.

### Week 4: Batch MVP

- Build batch upload or batch processing workflow for multiple videos.
- Export clean CSV or JSON outputs for analysis.
- Add basic job status, processing history, and result review.
- Keep outputs compatible with future internal-system integration.

### Week 5: Human-In-The-Loop Review

- Add expert/admin review workflow.
- Allow reviewers to accept, reject, or revise AI suggestions.
- Capture feedback in a structured way so future iterations can improve.
- Separate educator-facing suggestions from internal reliability analytics.

### Week 6: Pilot Readiness And Handoff

- Prepare pilot-ready MVP.
- Document setup, workflow, limitations, and recommended next steps.
- Deliver final reliability summary and known error patterns.
- Handoff code, prompts, configuration, and output schemas.

### Final Buffer: Through July 31

- Stabilize the MVP.
- Address critical bugs.
- Support final demo and handoff.
- Package materials for internal approval or pilot use.

## Strong Questions To Ask

- Which HELP domains or skill categories matter most for the pilot?
- Should the MVP prioritize all applicable skills or only high-confidence suggested skills?
- What is the minimum acceptable reliability threshold for pilot use?
- Which metric should be treated as the primary success metric: percent agreement, Cohen's kappa, Krippendorff's alpha, or a custom rubric-based measure?
- Are disagreements between present and emerging less severe than disagreements between present and not present?
- Should the system produce evidence clips, timestamps, or text rationales?
- What video length, format, and upload volume should the MVP support?
- What data can be stored, and what must remain local or restricted?
- What would future integration into the internal assessment system require: API, CSV import, database schema, or another interface?

## Risks To Address Proactively

- Limited permissioned video data may constrain model training.
- Reliability can vary depending on the metric used.
- Early childhood assessment is subjective, especially around emerging skills.
- AI-generated or synthetic videos may help with experimentation, but real expert-scored videos must remain the validation source.
- Educators should not see the tool as replacing their judgment.
- The MVP scope must stay focused because the timeline is short.

## Points To Avoid

- Do not lead with dashboard polish.
- Do not promise 90% reliability.
- Do not claim that 10 to 15 videos are enough for robust custom model training.
- Do not frame the product as automated final scoring.
- Do not expose internal reliability metrics as the core educator experience.
- Do not make integration sound like a full rebuild of their existing platform.

