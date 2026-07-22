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

Carlos Torres
2:26 PM
I read through the revised engineer scope. I'm aligned with the shift. If I got it right: the AI should surface potentially overlooked HELP skill credits for educator review, rather than try to replace human judgment.



This revised role fits what I can own well.



I'm available to connect today. Does 4pm EST work?

SN
Supraja Narayanaswamy
2:41 PM
Can you do 4:30 pm EST?

SN
Supraja Narayanaswamy
2:51 PM
axtually can we do tomorrow morning instead?

Carlos Torres
2:54 PM
yes, 4:30pm works for me too

Carlos Torres created a Zoom meeting

3:32 PM

The meeting ended (Duration: 02:40)

Share feedback about the call quality
ah sorry I missed this message

SN
Supraja Narayanaswamy
Jun 4, 2026 | 2:51 PM
axtually can we do tomorrow morning instead?

yes, tomorrow is perfect

Friday, Jun 05
Carlos Torres
9:59 AM
Morning Supraja! Ready whenever you are, just let me know what time works and I’ll send the Zoom invite.

Thursday, Jul 09
SN
Supraja Narayanaswamy
7:00 AM
Hi Carlos, how are you? I want to apologize for dropping the ball on this chat. We had found another contractor at the time and moved forward with them, but our situation has changed and we're now looking to bring someone on again. I really enjoyed our earlier conversation and wanted to check — are you still interested and available? The timelines may be slightly tighter and the scope has also slightly reduced. Happy to share more on where things stand if so. Sorry again for the radio silence, and hope you've been well.

Carlos Torres
2:32 PM
Hi Supraja, good to hear from you, and no worries at all, I appreciate the transparency.



Yes, I'm still interested and available.



Feel free to send over the revised scope, timeline, and budget whenever you have them. I still have full context from our call, so I can review and come back with questions and an updated plan within a day. That might be the fastest way to get moving given the tighter timeline, but happy to jump on a quick call too if that's easier on your end.



Looking forward to the details!

Friday, Jul 10
SN
Supraja Narayanaswamy
8:28 AM
Hi Carlos, so great to hear from you,

I'm working on the updated scope and will share in ~2 hours. Do you have time to touch base quickly tiday? I am free any time after 12 noon ET.

Carlos Torres
11:02 AM
Hi Supraja! Yes, today works. how about 2:30 PM ET?

SN
Supraja Narayanaswamy
12:01 PM
Perfect that works!

Let's block it and I will send an invite soon!

Carlos Torres
12:06 PM
Perfect, see you at 2:30!

SN
Supraja Narayanaswamy
1:02 PM
Can you do 3pm?

Actually

SN
Supraja Narayanaswamy
1:10 PM
I am not working today and just getting back home

SN
Supraja Narayanaswamy
1:20 PM
Actually can do 2:45

Carlos Torres
1:31 PM
yes, no problem

SN
Supraja Narayanaswamy wants to schedule a 30-minute meeting

1:40 PM
Schedule your meeting with Supraja

Pick a date and time
here you go

Let's talk at 2:45? I am back online

Supraja Narayanaswamy created a Zoom meeting

1:44 PM

The meeting ended (Duration: 18:13)

Share feedback about the call quality
Will join in 1 min

Did I already share this scope with you?

Acelero_AI Video Scoring_AI_ML Engineer_Scope_06042026 (1).pdf 
Acelero_AI Video Scoring_AI_ML Engineer_Scope_06042026 (1).pdf
109 kB
Carlos Torres
2:47 PM
Thanks again for the call, Supraja



I've already started adapting my prototype to the flow you walked me through (upload + child info → AI draft skills → teacher accept/edit/comment → finalize → report). Could you share the link to the sketch you showed on the call so I can match it exactly? I can send you a working demo Monday morning before any contract is signed.

Monday, Jul 13
SN
Supraja Narayanaswamy
9:21 AM
Here it is, Carlos! - https://draft-review-helper.lovable.app/

HELP Review – Draft
Web app prototype for early childhood educators scoring developmental video assessments.
SN
Supraja Narayanaswamy
9:26 AM
Thanks so much for speaking on Friday, Carlos. we're finalizing decisions shortly and I'll keep you update soon. One quick question: I noticed your Upwork profile shows an association with Softbot. Just want to confirm: would you be the only person working on this contract, or could others from Softbot be involved at any point?

Carlos Torres
9:30 AM
Thanks for the link, Supraja



Softbot is an old agency profile I set up a while back but I only used it once (I should probably delete it at this point). It would be only me on this contract, start to finish.

SN
Supraja Narayanaswamy
9:41 AM
Okay, because it seems like UpWork is getting a bit strict about international contractors these days, and I am just checking to ask if you've had any issues on this app recently or at all

Carlos Torres
9:50 AM
I've never had any issues with Upwork

Carlos Torres
10:20 AM
quick question, for the platform do you prefer invite-only magic links or email and password authentication

SN
Supraja Narayanaswamy
10:32 AM
Hmm, good question

What's the pros and cons of either option

Carlos Torres
10:39 AM
Invite-only magic links



Pros:
Fast educator onboarding; no passwords or reset support; avoids weak/reused passwords; admins can assign roles and children before access; appropriate for a temporary standalone pilot.



Cons:
Depends on email delivery and mailbox security; links can be forwarded or phished; corporate email scanners can interfere; requires carefully implemented single-use, expiring links.



Invite-only email/password



Pros:
Familiar login experience; repeat sign-in does not depend on receiving an email; better when organizational email delivery is unreliable.



Cons:
More development and support for password setup, resets, verification, lockouts, and rate limiting; password reuse and credential-stuffing risk; password-only authentication is not necessarily stronger.

SN
Supraja Narayanaswamy
11:48 AM
I will say one thing - the goal is that this tech stack can easily be integrated into AWS interface eventually and easily shift to longer-term tech and budget ownership

That makes me lean towards email/password OR whatever sign-in we currently use for HELP Connect, our larger system

Carlos Torres
12:37 PM
Understood! I'll send you some mockups in a few minutes to verify the flow is correct, and within a few hours, I'll show you the MVP of the functional platform.

Carlos Torres
12:50 PM
I'm sending you the screens for the primary happy-path journey:

7 files 
01-sign-in.png
02-assigned-children.png
03-upload-observation.png
04-processing.png
05-review-workspace.png
06-finish-review.png
07-final-assessment.png
2 files 
image.png
09-admin-processing-jobs.png
SN
Supraja Narayanaswamy
2:17 PM
Can you share your full name? Is it Carlos Torres?

Thank you. I am going to extend an offer to you!! I will review the mockups you shared after- thank you so much for it!

Carlos Torres
2:34 PM
Yes, Carlos Roberto Torres Ferguson that's my full name.



Great news, thank you Supraja! Send the contract and BAA whenever they're ready and I'll sign same day. MVP is still on track for today 👍

SN
Supraja Narayanaswamy
2:58 PM
Please can you share your email address and mailing address?

Carlos Torres
4:06 PM
Of course, only thing is Upwork doesn't let us share emails or addresses until a contract is active, so better to play it safe. If you send the offer over (even just the kickoff milestone), I'll accept right away and can share everything for the BAA immediately after.

SN
Supraja Narayanaswamy
4:57 PM
Ok!

Contract kicked off here

Can you send me your details so I can work on the BAA with my lawyer?

Supraja Narayanaswamy sent an offer

5:00 PM
Acelero, Inc. is seeking a contractor to build a scalable, automated version of an AI-powered video analysis tool for an early childhood, developmental and formative assessment. A working prototype of this tool was developed in 2025 as part of an IRB-approved inter-rater reliability (IRR) study. The goal of this engagement is twofold:
1) Automate the skill detection and scoring of child observation videos aligned to the assessment rubric and definitions at scale aligned to the assessment purpose, and
2) Iteratively improve the tool’s prompt engineering and configuration to reach ≥90% agreement between AI outputs and expert human raters to achieve AI-human reliability.



See attached scope of work for more details.



Proposals are due May 29, 2026. Questions may be submitted by May 26, 2026.

Est. Budget: $7,000.00

Milestone 1: Initial processing pipeline operational (batch processing, AWS/Google environment, API)

Due: Monday, Jul 20, 2026

Project funds: $2,000.00

View offer
2 files 
Request for Proposals_ Contract AI_ML Engineer (1).pdf
100 kB
Request for Proposals_ Contract AI_ML Engineer (1).pdf
100 kB
Carlos Torres accepted an offer

5:06 PM
View contract
Carlos Torres
5:12 PM
Thanks! My details:
Carlos Roberto Torres Ferguson
catorch8@gmail.com
Matias Romero 1112 A102. Col. Del Valle. Benito Juarez. Ciudad de Mexico. Mexico

Carlos Torres
5:20 PM
Thank you again, Supraja, really glad we're doing this, excited to get building.
And if your lawyer needs anything else from me for the BAA just say the word and I'll send it right over.

SN
Supraja Narayanaswamy
8:15 PM
Thank you Carlos!!! Appreciate you for jumpimg in

I will get back to you as soon as I hear from my lawyer, and also wondering if you'd be free to join a call tomorrow from 2:15-3 pm ET

Carlos Torres
10:00 PM
Yes, 2:15–3 PM ET works me

Carlos Torres
10:14 PM
I've pushed the updates I have on the MVP here: https://earlychildhoodassessment.vercel.app/



It's basically a first working version of the educator flow and the platform admin flow.



Tomorrow I'll send over a few questions we should start pinning down about the inputs the AI model will need and the outputs it'll return. that'll let me build a mock system now and simply swap in the real model at the end.

HELP Review Pilot
Educator review of draft HELP assessment suggestions.
Carlos Torres
10:21 PM
These are the mockups I generated to use as a starting point. https://drive.google.com/drive/folders/1xY73B-uJNP45boekDsT0KDBjKk_LmbIN?usp=sharing

Tuesday, Jul 14
SN
Supraja Narayanaswamy
8:48 AM
I will add you to the call

Please share all this then, and Yi, the scientist will also be there!

Carlos Torres
10:15 AM
Got it! I'll be there

SN
Supraja Narayanaswamy
1:05 PM
Hi! Are you joining?

Carlos Torres
1:39 PM
Hi, apologies for the slight delay. I'm going to keep working on the platform and I'll send you some questions later today about a few screens, to clarify some of the flows. As for the integration with the model, the conversation was productive, and with the data contract Yi sent, over the course of the week it'll be easy to have a mock video for development, which we can easily swap out when we launch to production 👍

SN
Supraja Narayanaswamy
1:41 PM
Hi Carlos - sounds good!

Carlos Torres
1:41 PM
I think I had saved 2:15 in my calendar 😅

SN
Supraja Narayanaswamy
Jul 13, 2026 | 8:16 PM
I will get back to you as soon as I hear from my lawyer, and also wondering if you'd be free to join a call tomorrow from 2:15-3 pm ET

Show more
SN
Supraja Narayanaswamy
1:41 PM
Please send me questions - I've seen your prototypes and no big questions so far!

Carlos Torres
1:42 PM
Will do!

SN
Supraja Narayanaswamy
1:42 PM
Sorry- I moved it up to 2!!

Maybe that change didn;t show up

Carlos Torres
1:56 PM
😅 all good, questions coming later today!

Carlos Torres
11:23 PM
I'm still putting together all my questions. Today I made progress on the Google Cloud deployment side, so that once we have more details about the model, we can deploy the system more easily. I also made progress on several parts of the platform. I'll send you my questions tomorrow morning. For now, the most concrete one I have is: For the current pilot, should HELP Review operate as a completely standalone application, with HELP Connect considered only as a future integration? Or does this release need any HELP Connect integration, such as sign-in, roster data, or writing back final results?

Wednesday, Jul 15
Carlos Torres
10:39 PM
I’ve put together a PDF walkthrough of the educator happy path, covering sign-in, selecting a child, uploading an observation, processing, reviewing the AI draft, and finalizing the assessment.



Could you please review it and confirm that the sequence and explanations match the intended educator experience? I’d also appreciate any feedback on unclear steps, missing details, or changes you’d like before we finalize the flow.



Thank you!

educator-happy-path-guide.pdf 
educator-happy-path-guide.pdf
2 MB
Thursday, Jul 16
SN
Supraja Narayanaswamy
8:23 AM
What is an educator happy path?

Carlos Torres
10:23 AM
Hi Supraja, the “educator happy path” is the ideal step-by-step journey an educator follows when everything works as expected, without errors or unusual situations.

In this case, it covers signing in, selecting a child, uploading an observation video, waiting for processing, reviewing the AI suggestions, making the final decisions, and finalizing the assessment. The PDF is intended to confirm that this main workflow feels correct, clear, and complete.

SN
Supraja Narayanaswamy
10:32 AM
This is very well done. Thank you, Carlos!!

I will review and leave any thoughts/comments by eod today and working to get you the BAA contract asap so you can access backend

What questions do you have now apart from my review/feedback of this?

Carlos Torres
2:20 PM
Hi, here are some of the questions that would help me most right now



While you're reviewing the PDF: are "Present, Emerging, Not observed, N/A" the right scoring terms for your educators, or should any of them be worded differently?



Once the model is ready, will you also include the list of HELP skills so it can be uploaded to this platform?



Is viewing the finished assessment on screen enough, or will you need to print or export it to another system/platform?



If the AI misses a skill an educator clearly observed in the video, should the educator be able to add it manually? correct?



Do educators assess each child once, or several times a year? If repeatedly, would a progress view across a child's assessments be useful?



For the backend the BAA covers, should it exchange any data with this platform (for example, pulling child profiles from it, or sending finished assessments back), or does the platform stay standalone?



Do you have a name, domain, or branding you'd like on the app?

Monday, Jul 20
SN
Supraja Narayanaswamy
8:37 AM
Hi Carlos, thanks for your questions.

SN
Supraja Narayanaswamy
10:40 AM
Replying now (as I was out on Friday):
While you're reviewing the PDF: are "Present, Emerging, Not observed, N/A" the right scoring terms for your educators, or should any of them be worded differently? See attached deck, slide 13.



Once the model is ready, will you also include the list of HELP skills so it can be uploaded to this platform? - Yes, I can share right away (attached).



Is viewing the finished assessment on screen enough, or will you need to print or export it to another system/platform? - Can we export/download for now?



If the AI misses a skill an educator clearly observed in the video, should the educator be able to add it manually? correct? - yes!!



Do educators assess each child once, or several times a year? If repeatedly, would a progress view across a child's assessments be useful? - Several times a year, 2x a month, which means ~15 times a year. A progress view is essential.



For the backend the BAA covers, should it exchange any data with this platform (for example, pulling child profiles from it, or sending finished assessments back), or does the platform stay standalone? - This is a good question because eventually we want this to live inside HELP Connect, so pull and exchange data ideally, but not sure we're there yet?



Do you have a name, domain, or branding you'd like on the app? - Yes! I have brand guidelines I can share, but name I haven't decided. I can think it over and share today.

2 files 
HELP In-Service Training Deck_07162026_vF (1).pptx
12 MB
HELP 0-3_2nd Ed_Strands and Skills List_Updated.xlsx
104 kB
Carlos Torres
11:00 AM
Thank you, Supraja, this is exactly what I needed to move forward. I'll fold these into the platform and keep pushing forward

SN
Supraja Narayanaswamy
12:15 PM
great

Can you make it to the call tomorrow?

Carlos Torres
12:16 PM
Yes, I'll be there!

Tuesday, Jul 21
SN
Supraja Narayanaswamy
11:41 AM
great, just a reminder to accommodate Yi's availability we will meet at 2:15 ET

emailing you your contract right now

Carlos Torres
12:37 PM
Sounds good, 2:15 ET works for me.

Got the contract, thanks! I'll review, sign, and send it back shortly.

SN
Supraja Narayanaswamy
5:11 PM
Hi Carlos, thanks for connecting today. Here is the PDF step-by-step you made and my comments on it attached.

educator-happy-path-guide_SNComments.pdf 
educator-happy-path-guide_SNComments.pdf
2 MB
Will also share this as an email to you and Yi so everyone knows

Additionally, I have submitted request for you to get an email, Github and Google AI studio account -- should be processed by tomorrow!

A separate ask, if possible: is there any way to get an updated version of the web prototype sent over by 10am ET tomorrow? I'd like to share progress with my manager. Totally understand if that timeline doesn't work, just let me know either way.

Carlos Torres
5:39 PM
Thanks, Supraja! I'll go through your comments on the PDF and factor them into the flow.



Appreciate you setting up the email, GitHub, and Google AI Studio account. I'll keep an eye out for those tomorrow.



And yes, I can get an updated version of the web prototype over to you by 10am ET tomorrow, no problem. The link will be the same one. I'll just deploy the updates when they are ready: https://earlychildhoodassessment.vercel.app/



See you at 2:15 ET!