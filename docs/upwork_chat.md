Supraja Narayanaswamy, Acelero Program Team
AI/ML Engineer: LLM Pipeline & Video Analysis Tool for Early Childhood Assessment
Tuesday, May 26
Carlos Torres
11:50 AM
Hi Acelero team,



To show how I would approach this, I already built a lightweight prototype of an Assessment Reliability Workbench based on your scope. It includes a dashboard, video review flow, AI skill detections with confidence and timestamped evidence, DAL summary, reliability analytics, prompt/version tracking, structured exports, and API surfaces.



Prototype: https://earlychildhoodassessment.vercel.app
Code: https://github.com/catorch/early-childhood-assessment-workbench



For the full engagement, I would build the production pipeline in stages: batch video ingestion and child matching, Gemini/multimodal processing with strict schema validation, human-in-the-loop review, exportable override logs, and a reliability workstream that tracks exact agreement, Cohen’s kappa, confusion matrices, and error patterns by prompt version and dataset split.



I’m comfortable working quickly with frequent review cycles, and I would treat the ≥90% target as an engineering and measurement problem, not just a prompting task. Every prompt/configuration change would be versioned with before/after metrics and reviewed against the assessment framework.



I’d be glad to discuss questions before May 26 and can align to your July 31 delivery timeline.

View details
Assessment Reliability Workbench
Prototype workflow for early childhood assessment reliability review.
GitHub - catorch/early-childhood-assessment-workbench: Assessment reliability workbench prototype
Assessment reliability workbench prototype. Contribute to catorch/early-childhood-assessment-workbench development by creating an account on GitHub.
GitHub
SN
Supraja Narayanaswamy
11:50 AM
Hi Carlos,



Thanks for your proposal and your draft prototype!



I'd like to connect tomorrow for 30 minutes to walk through the project and discuss fit. Are you available between 8-9 am EST tomorrow?

Carlos Torres
1:08 PM
Hi,



Thanks for the quick turnaround. 9:00 AM EST tomorrow works for me.

Carlos Torres wants to schedule a 30-minute meeting

1:09 PM
Waiting for Supraja to pick a date and time. Preview what your booking page looks like.

Preview booking page
SN
Supraja Narayanaswamy scheduled a meeting

4:50 PM
Date: May 27, 2026

Time: 12:30 PM - 01:00 PM CDT (UTC-05:00)

Cancel | Reschedule | Add to calendar
Carlos Torres
5:10 PM
Sounds good, see you tomorrow at 12:30 PM CDT 👍

Wednesday, May 27
Zoom meeting starts in 30 minutes

APP
12:00 PM
Date: May 27, 2026

Time: 12:30 PM - 01:00 PM CDT (UTC-05:00)

Join meeting
Zoom meeting starts in 1 minute

APP
12:29 PM
Date: May 27, 2026

Time: 12:30 PM - 01:00 PM CDT (UTC-05:00)

Join meeting
Carlos Torres created a Zoom meeting

12:30 PM

The meeting ended (Duration: 25:55)

Share feedback about the call quality
Hey, I'm here whenever you're ready

SN
Supraja Narayanaswamy
12:32 PM
Joining!

Carlos Torres
7:25 PM
Hi Supraja,



I structured the plan around a reliability-first approach: first reproducing the current baseline, then identifying where the AI is failing, especially around present vs emerging scoring, and then using structured prompt/model iterations with versioned before/after metrics. The batch processing and human review interface are built around that pipeline rather than treated as separate dashboard work.



I also kept the RFP milestone structure and dates, but added clearer deliverables, acceptance criteria, dependencies, and validation assumptions for each phase

A few key inputs that would help me move quickly if selected are:



- current Gemini prompt / Gem configuration
- HELP scoring rubric and scoring rules
- prior AI output CSVs
- expert benchmark scoring files
- available videos and permission status
- child metadata needed for age-gated scoring
- existing reliability results from the IRR study



I’m attaching the milestone plan here. Happy to adjust the details if there are internal constraints I should account for before the contract is finalized.

refined-milestones-plan.docx 
refined-milestones-plan.docx
16 kB
Thursday, May 28
SN
Supraja Narayanaswamy
10:12 AM
Thank you, Carlos!

Especially for sending this plan even without me sending you the rubric- appreciate it

I will get back to you by this afternoon

Carlos Torres
5:00 PM
Hey Supraja,



Thanks, and great talking yesterday. No rush on your end, take the time you need.

Friday, May 29
SN
Supraja Narayanaswamy
11:02 AM
Carlos

I will have to get back to you either by eod today or Monday morning! Just finalizing the budgets for this role 🙂

Thanks again!

Carlos Torres
11:08 AM
Hey Supraja, sounds good, whenever works on your end. Thanks for keeping me in the loop, looking forward to hearing where things land.

Wednesday, Jun 03
SN
Supraja Narayanaswamy
12:26 PM
Hi Carlos, thanks for your patience

Carlos Torres
1:32 PM
Hi, all good, Supraja! Excited to hear where it landed.

Thursday, Jun 04
SN
Supraja Narayanaswamy
1:26 PM
Hi! I have been going back and forth with my team and a potential Applied AI Scientist to join the project, and this has resulted in a revised scope for the engineer role

I am attaching it below and would like you to take a look at it and pose any questions

And happy to get on a video call too!

Thanks once again for your patience!

Acelero_AI Video Scoring_Engineer_Scope_06042026 (1).pdf 
Acelero_AI Video Scoring_Engineer_Scope_06042026 (1).pdf
109 kB
This was one of the reasons for the week-long delay.

Carlos Torres
1:30 PM
Hi Supraja, thanks for this, and glad the role is moving forward.



Reading through the revised scope now, I'll come back shortly with questions and would be glad to hop on a call.

SN
Supraja Narayanaswamy
1:38 PM
Great. I am online until 5pm EST today, if you'd like to connect today. Keep me posted