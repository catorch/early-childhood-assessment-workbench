
Supraja Narayanaswamy
5:38 PM (2 hours ago)
to Yi, me

Hi Yi and Carlos,

Thanks for a productive call today! I have some questions and thoughts below that I would love your eyes on and a response as soon as possible, ideally eod today or early tomorrow. Questions are bolded to make it easy for you.

I'm sharing again the two videos you can use for AI model testing. Sorry again that I totally forgot about these; I just received permission from my colleague to use them. 
Video 1: Child is 22 months old.
Video 2: The same child as above, but she is 24 months old in this video.
Yi, I was wondering if you'd like human expert scores on these videos to make the model more sound and robust. I can ask our expert scorer to spend some time this weekend scoring these 2 videos if you'd like.

Carlos, thanks for putting together the educator happy path walkthrough and a prototype — the structure is really clear. I went through it page by page and have some feedback below, organized by where it appears in the PDF flow.
Credit symbols (p.1, review workspace grouping): Let's remove the "Needs your review" section as all of them need human/educator review anyway. Instead, let's organize only by Present (+), Emerging (+/-), Not Present (-), and Leave Blank.
User roles (p.3, sign-in): We need two user types—Educator, and Admin/Supervisor who can sign in and see all of their educators.
Naming (p.4): Let's call this the "HELP AI Crediting Companion."
Assessment cadence (p.4, assigned children): This should account for the fact that kids may be assessed every 2 weeks, so an educator could be signing in and selecting the same child twice a month. Want to make sure the roster/history logic handles that.
Terminology (p.5, upload observation): I like that this accounts for multiple observations. Quick question: does "upload observation" mean the same as "upload video"? If so, can we make it explicit and call it "Upload observational video"?
Processing time (p.7): On average, how long will a 3-5 min video take to upload and process? Would help to know for setting expectations with educators.
Skill sequencing (p.9, review workspace): This is an important one. There's a hierarchy/sequential order to skills within a strand that needs to be enforced. We can't credit an earlier-age skill in a strand as (-) while crediting a much later skill in the same strand as (+). Yi, I know your model already accounts for this, but flagging it here too. The order is in the skill list I shared previously, but I'm sharing it again here.
Missing credits (p.11, save decisions): At the end of this page, let's add a way to add missing credits: educators should be able to upload domain, strand, skill, and credit, all via dropdowns.
Summary detail (p.15, final record): It would help to see counts here — # of domains covered, # of strands, # of skills — beyond just the credit totals.
Carlos, overall this is a strong first pass on the flow. Let me know if any of the above require discussion before you build against them. Can you share an updated mock-up ASAP to show my manager by 10 am EST tomorrow? If not, totally understand. Also, you should have your Google AI/Github access by tomorrow!

Finally, this question is for both of you, but it might be more relevant to Carlos, raised by my IT Team. I want your help understanding the cost of this work after it's built and while it's being used. Think 3-5 mins of videos per child 2x a month for 10 months in a year.
How much will this cost long-term, specifically the underlying tech services and data processing?
Tech stack review — what is the tech stack you will be using for your prototype? Think of a stack that is interoperable and can easily shift as we move to longer-term tech and project ownership. Does this help you narrow down your choice of technology? 
Thank you both for your time and dedication to this work!

Best,
Supraja

--
Supraja Narayanaswamy (She/Her/Hers) | Director of Impact, Scalable Solutions | C: 617-286-4061 | Email: snarayanaswamy@acelero.net

Supraja Narayanaswamy
Attachments
5:47 PM (2 hours ago)
to Yi, me

Oops, forgot to attach the version of the PDF and prototype/user flow here: https://earlychildhoodassessment.vercel.app/
 One attachment
  •  Scanned by Gmail

Supraja Narayanaswamy
5:50 PM (2 hours ago)
to Yi, me

Hi Yi,

I had one additional question for you. Is there a way the model can also provide more context for the observation and assessment, explaining why it credited a + vs +/-. for e.g., by saying "Child lifts but drops spoon," and therefore gets an +/- or emerging. Let me know if that might be harder to do in this time. I think it will be a teachable moment for the educator and adds context to the credit, which can help the teacher accept/edit/reject.

Thanks, and let me know.

I will also ask my leadership team for a timeline extension tomorrow and will update you both then.

Best,
Supraja
