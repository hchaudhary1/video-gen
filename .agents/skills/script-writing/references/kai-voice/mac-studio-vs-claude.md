Source: https://www.youtube.com/watch?v=6UjDw-2s4ik
Channel: Kai Explains (@kaiexplainsYT) · 2026

# Can a $22K Mac Studio Replace Claude Subscription? (512GB M5 Ultra)

Automatic captions: names and numbers may be misheard. Style reference only: do not cite, quote or reuse its claims.

Okay, so you've probably hit that wall already. You're deep in a project. CL is on fire and giving
you exactly what you need and then the usage window closes on you. Or you're burning through API
credit so fast it feels like your bank account has a hole in it. Or maybe you just looked at your
Claude Ultra bill for the third month in a row and thought, "Wait, I'm paying $200 a month every
month forever for something I don't own." I've been there myself. And one night, I sat at my desk
late and tired with three browser tabs open and probably one too many energy drinks in my system.
And I did the math. At $200 a month, that is $2,400 a year. And over 9 years, it comes to $21,600.
And what do you have to show for it at the end? No hardware, no weights, and no model sitting on
your shelf. What you have instead is a subscription that can change its pricing or its limits at any
moment. And it already did. While I was writing this, Entropic actually renamed its $200 Max 20X
plan to Ultra and changed what the multiplier means. So, it is the same price with a different
number on the label and you just find out one day. So, when Apple announced the new 512 GB M5 Ultra
Max Studio and people started saying you can run Frontier AI locally forever for one upfront
payment, I was paying attention and not just out of curiosity because I was seriously considering
buying one. The case for it is real, which is what makes it compelling since it is the kind of
argument that sounds like financial genius until you dig past the surface. So, today we're going to
do that digging. I ran the numbers. I had some thoughts that turned out to be wrong. And I found out
that this question, can a $22,299 Mac Studio replace Claude? Actually got a completely different
answer the week after those YouTube videos went up. And it is a lot messier than the viral take
you've probably already seen. So stay with me. Let's start with the version of this story that feels
really good because it isn't wrong, it is just incomplete. The pitch goes like this. Apple's M5
Ultra Studio with 512 GB of unified memory is a machine unlike anything that has existed at this
price point with 1.2 TB per second of memory bandwidth. And that is what lets it run large language
models that would have needed enterprise server racks just 2 years ago. The memory is the key thing
here because when we're running a large model locally, the weights have to fit entirely in memory to
run at any reasonable speed. And 512 GB is a shelf big enough for some seriously capable models.
Now, this is where the pitch starts singing. Claude Ultra, the top plan is $200 a month and $22,299
divided by $200 comes out to about 9.3 years. So you buy the Mac once, you run AI locally and after
9ish years, the machine has essentially paid for itself. After that, it is free with no
subscription, no 5-hour windows, no weekly caps, and no anthropic changing the rules on you. And
that last part is not nothing. The same week that Mac went on sale, Anthropic renamed its top plan
and quietly changed how the usage multiplier is described. I'm not saying that is shady because
pricing evolves, but it is a reminder that when we use a cloud service, we are always passengers on
someone else's train. Then there's privacy. Because if you're a developer under an NDA, a lawyer
drafting sensitive documents, or a researcher working with proprietary data, nothing you type on a
local machine leaves the room. And for certain people, that is the whole ball game rather than a
minor benefit. The detail that actually surprised me is resale. Apple sold the older M3 Ultra Max
Studio with 512 GB for $9,499 new. And when it stopped selling that configuration earlier this year,
used ones were going for $16,000 to $20,000, which is more than they cost new. So the machine held
its value like a vintage Leica. So the case for buying is real, and the numbers in that argument are
correct. The vision of owning your AI, running it on your terms, keeping your data private, and
eventually coming out ahead is coherent, but it compares the Mac to the wrong thing. Now, let's get
specific because the sticker price is hiding some logic that matters a lot. What you're actually
buying is an M5 Ultra chip, which is Apple's most powerful silicon with a 36 core CPU, an 80 core
GPU, that 512 GB of unified memory, and a 1 TB SSD. The machine benchmarks well, and the 1.2 TB per
second of memory bandwidth is genuinely impressive and directly relevant to AI performance. But the
memory upgrade alone accounts for $15,500 of that $22,299. So $15,000 goes just to getting from the
base memory options up to $512 GB. To put it another way, going from 256 GB to 512 GB on the same
chip costs $11,500, which is roughly $45 per extra gigabyte. And for context, that $11,500 premium
is also $6,000 more than the entire M3 Ultra machine with 256 GB cost last year. So, you aren't
really buying a computer so much as a memory shelf that happens to come with one. Now, three numbers
decide what this machine can actually do with AI. Memory decides which models fit. Memory bandwidth
decides how fast it writes tokens. And raw compute decides how fast it processes your prompt before
the first word appears. That last step is called prefill. And it matters enormously for agentic work
because when cloud code sends 30,000 tokens of instructions, files, and tool lists with every single
request, your model has to read all of that before it can respond. And Macs have always been great
at writing since fast memory bandwidth means tokens flow smoothly. but they have less raw compute
than the big Nvidia data center cards which leaves them slower at reading and a coding agent mostly
reads. So keep that in mind because we'll come back to it. Now let's look at what we can actually
fit on this machine because that is the part that gets interesting. Mac OS doesn't hand you all 512
GB by default since the operating system reserves some for itself. So the GPU can typically access
about 384 GB. One terminal command raises that cap. And some power users push it to the point of
leaving just 6 gigs for the system, which I wouldn't recommend unless you enjoy living dangerously
with a $22,000 machine, but it is technically possible. So, what can we actually run? GLM 5.3 from
ZI, currently the highest scoring open model on the major Aentic coding leaderboard, weighs in at
418 GB at 4-bit precision, so it fits with a bit of room to spare. Deepseek v4.1 flash is 432 GB at
4 bits and it fits too. Meta's Muse Spark Open is 533 GB at 4bits which doesn't fit and Meta runs it
on two Mac Studios. And then there's one more model, the one that broke everything, but we'll get to
that in a minute. Now, there's something worth knowing about the two Mac alternative that gets
recommended online, where a lot of people say to skip the 512 and buy two 256 GB Mac Studios
instead. With the same top chip, two of them together cost 21,598, which is $71 less than one $512
GB machine. And you get twice the GPU and roughly 1.7 times the speed once they work together. The
catch is that neither GLM 5.3 nor DeepS v4.1 flash fits on a single 256 GB MAC at 4 bits. So the 512
GB machine does something the two machine setup can't, but only if the models you need require that
full shelf. And that brings us to the benchmark. There's a benchmark called Terminal Bench 4.0. And
the idea is elegant because you give an AI agent real jobs on a real command line and you count how
many it finishes. It isn't a multiplechoice test, so it is closer to what actually matters. On the
official leaderboard, with both models running inside Claude Code as the agent harness, Claude Oppus
5.5 finishes 64.85% of tasks. And GLM 5.3, the best open model that fits on the 512 GB Mac, finishes
41.82%. That is a 23 point gap. So out of every three tasks OPUS finishes, GLM finishes roughly two.
And that isn't close because it is the difference between a sharp junior developer and someone who
can actually own a complex project. The part I had to sit with is that those scores come from full
precision models running on powerful servers. So the 4-bit version on your Mac may or may not match
them depending on how well the compression preserved what the model can do. When I first started
researching this, I thought the gap might be smaller and that maybe the best open models were closer
than people say. Then I looked at the numbers properly and had one of those quiet moments where you
realize your optimism was doing some heavy lifting. So up until November 4th, the story was settled.
A $22,299 Mac gets you a model that is 23 points worse at the thing you bought it for. And even the
most committed open-source enthusiast would struggle to call that a replacement. But then Moonshot
posted the weights for Kim K3.1 Pro. And I really did stop what I was doing and stare at my screen.
It is a mixture of experts model with 2.8 trillion total parameters and 104 billion active on each
token. And it has a 1 million token context window. And critically, the weights are released at
roughly 4bit precision. But Moonshot actually trained the model to run at that precision. So 4bit
here is the native format rather than a compression artifact. On Moonshot's own benchmark table, Kim
K 3.1 Pro scores 65.7% on Terminal Bench 4.0 and Claude Opus 5.5 on that same table is listed at
66.4% which is a gap of 7/10 of a percentage point. Now I know what you're thinking. Isn't that the
vendor's own table where they're going to put their model in the best possible light? And that is
fair. So when we look at the independent measurements, artificial analysis ran terminal bench 4.0
itself and got 67.2% for Kimmy. That is the highest score it has recorded from any model it has
tested, sitting above clo 5.5's 63.6%. And on its overall intelligence index, the gap between the
best open model and the best closed model shrinks from 12 points down to three. So for the first
time, can I replace Claude with a local model is no longer a quality question, but a hardware
question, which means we need to build the hardware. The Kim K3.1 Pro weights are 1,561 GB and 512
GB. Mac Studio, even with every setting pushed to the limit, holds about 500 GB. So, one machine is
nowhere close. Three machines with the memory cap raised give us roughly 1,518 GB, which is still
short. And there's a second problem on top of that. The way we split a model across multiple
machines is called tensor parallelism. And it slices every layer into equal pieces. So, the machine
count has to be a power of two, meaning 1, 2, 4, or 8. And three isn't a valid configuration. So, it
has to be four. And 4 * $22,299 is $89,196. And we can't just stack four Mac Studios on a desk and
call it a cluster because every Mac has to be connected to every other Mac over Thunderbolt 5. That
is a full mesh where machine one connects to two, three, and four. Then two connects to three and
four, and three connects to four. That comes to six cables. And Apple sells Thunderbolt 5 cables for
$69 each. That puts the final total at $89,610 before tax and before a desk big enough to hold all
of them. Although I'm going to assume you already own a power strip. And before anyone comments, I
did consider whether eight 256 GB machines would work instead, which would be $2,84 cheaper. But a
full mesh of eight needs seven Thunderbolt ports on each machine. and the M5 Ultramax Studio has
six. So, that one is out. Now, the setup isn't impossible. You boot every Mac into recovery mode and
run one command to enable RDMA, which is the feature that lets one Mac write directly into another
Mac's memory. Then, you keep all four machines on exactly the same Mac OS build because if you miss
that last part, things get unstable fast. Connecting it to Cloud Code is actually the easy part. A
free server called OMLX speaks the same API format as Antropic. So you change one setting, the base
URL. And Cloud Code doesn't know it is talking to a room full of Mac Studios instead of Antropic
servers. And OMLX also caches your prompt on the SSD between sessions, which helps with the reading
bottleneck we talked about earlier. The software is moving fast, too, because on the day I was
writing this, the OMLX developer shipped a build claiming 44% faster prefill for Deepseek V4.1 Flash
on an M5 Ultra. But for Kim K3.1 Pro specifically, there's essentially no tuning done yet since the
first Mac compatible builds of the weights only appeared on HuggingFace the day after release. So,
nobody has properly benchmarked this combination. And what we have are estimates. Nobody has
measured Kimi K3.1 Pro and 4M5 Ultramax Studios yet, but Apple published a benchmark in October that
gets us close enough to estimate. Apple ran Meta's Mu Spark Open, which is a different model, across
4 M5 Ultra machines and recorded 36.73 tokens per second. That model works 42 billion parameters per
token. And Kimmy works 104 billion, roughly 2 and 1/2 times as many. So if we scale Apple's number
down proportionally, we land somewhere around 15 tokens per second. And that estimate actually lines
up with realworld data from a similar setup. A creator named Alex Ziskin ran the older Kimmy K3 from
the same model family on four 512 GB M3 Ultramax Studios and got 14.7 tokens per second. 15 tokens a
second sounds fine and it is actually readable, so it won't feel like watching paint dry. But the
writing speed is not where the time goes. That same cluster read incoming prompts at around 238
tokens per second. And Claude code as the agent harness sends roughly 30,000 tokens of instructions,
tool lists, and file contents with every single agent request. At 238 tokens per second, the first
word of a response waits about 2 minutes. And if the M5 Ultra's faster compute carries over to
cluster performance, which nobody has actually shown yet, maybe that becomes 50 seconds. That is 2
minutes of silence before an agent even starts responding. And you sit through it on every single
turn. Ziskin tested this directly by giving the same app building prompt to the format cluster and
to a cloud-based agent running Frontier models, and the cloud finished in 15 minutes, while the max
took 4 hours. To be fair, he disclosed up front that the video was sponsored by the cloud provider.
And he also said on camera that the app the local cluster produced came out looking good, but it is
still 4 hours against 15 minutes. There's one more thing, which is that this setup effectively
serves one user at a time. Spicy Neuron, who has been running a 512 GB M3 Ultra behind clawed code
for 6 months, wrote plainly that with larger models, the Mac Studio is effectively limited to one
concurrent user. And when Ziskin tested at 256 GB M5 Ultra with multiple simultaneous users, total
throughput peaked at four concurrent users and fell off at 8. That matters even when you're working
alone because when claude code spins up parallel helper agents on a complex task, each one sends its
own requests at the same time and your single-user machine becomes a multi-user machine the moment
the agent gets ambitious. So let's give this cluster its absolute best case and then run the
numbers. Say it outputs 15 tokens per second every second running continuously for an entire year
which comes to roughly $473 million tokens of output. Now price every one of those at Claude Opus
5.5's API rate of $20 per million output tokens. That is the most generous valuation we could
possibly put on this output since it treats every token as if it were the most expensive kind
available. That gives us $9,461 of value produced in a year. And the cluster costs $89,196. So at
that rate, it takes 9.4 years of non-stop generation to write its own cost back. If we evaluate at
Kimy's actual hosted price of $10 per million for the same model you could just rent, it is $18.9
years. Put another way, $89,196 buys roughly 8.9 billion tokens of Kim K3.1 Pro served from
Moonshot's own GPUs at many times the speed with no hardware to manage. Then comes the electricity.
Apple rates the 512 GB Max Studio at 385 W at maximum load. So, four of them running flat out all
year at a reasonable electricity rate come to about $2,400 a year, which isn't catastrophic, but it
is real. Against the subscription plan, $89,196 is 37 years of Claude Ultra. And the single $22,299
machine doesn't escape this math either. That money could buy you around 18.6 6 billion output
tokens of DeepSeek V4.1 Flash on a cloud provider. At the 53 tokens per second that model family
gets on an M5 Ultra, which this kind measured directly, that the Mac would need about 11 years of
non-stop generation to produce that many tokens. So, the sentence that stuck with me after all of
this is that the hardware is never the cheap way to get the model because the model itself is the
cheap way to get the model. Now, let's be fair to Kimmy K3.1 Pro because it deserves it. The 67.2%
from artificial analysis is real and independent, and it is the highest terminal bench score they've
recorded, so that isn't spin. But one coding benchmark is not your workday. A research group called
Zero Research scored Kim K3.1 Pro on its own experimental research test and placed it about 4.6
months behind the current frontier. that is roughly equivalent to Claude Opus 4.8 which Anthropic
shipped at the end of May and which is the generation before the one we're using now. They also
found that Kimmy gains less from a bigger compute budget than the newest Opus models do. So when we
throw more thinking time at a hard problem, Kimmy improves less than Opus does. And Spicy Neuron
after 6 months of running open models locally behind cloud code landed in a consistent place. The
best open models sit roughly where cloud models were 6 to 12 months earlier. And in their words,
local AI definitely isn't a drop-in replacement for cloud APIs. So the honest version is that on
aentic coding specifically, the open model has nearly caught Claude, which is genuinely impressive
and wasn't true even a few months ago. But across the full range of things, we'd actually hand an
agent. Kimmy is about one opus release behind and we'd be running it at a fraction of the speed.
Now, I want to be careful here because the economic case really does hold for some people. The first
group is anyone whose code legally cannot leave the building. And the top comment under one of these
Mac Studio videos said exactly this. It's useful when your contract demands the code stays private.
And a cloud plan can fix that at any price. So if your work involves government contracts, healthc
care data, financial records, or anything under strict NDA, the local option is a compliance
requirement rather than a luxury. The second group is anyone running long background jobs that
nobody is waiting on in real time. Federrico Vitici at Max Stories ran a team of research agents on
Deepseek V4 Flash on a 256 GB M5 Ultra 24 hours a day for 99 days straight. And the cost, in his
words, was $0. When nobody is sitting at a keyboard waiting for the first word, a slow first word
costs nothing, and the machine just quietly works while you sleep. The third group is anyone who
needs a model that can change under them. What you download is what you get, and the weights on your
drive are the same weights in 3 years with no model updates and no shifts in how it behaves. And for
certain regulated industries or long-running research workflows, that stability is genuinely
valuable. But Vitici also named the limit clearly, calling the setup fiddly and not something he'd
recommend to someone who just wants to pay $20 for a Claude subscription and get reliable results.
So, can a $22,299 Mac Studio replace Claude? Not a single box. The best model that fits GLM 5.3 is
about 23 points behind OPUS 5.5 on aentic coding which is the difference between a solid tool and a
sharp one and for a lot of workflows that gap is prohibitive and can the formac $89,610 cluster
replace claude. Technically, the quality is now within a point on one benchmark, but in practice, it
writes 15 tokens a second for one user at a time and makes you wait up to two minutes before the
first word on a complex agent task. And on top of that, it takes real effort to set up and maintain.
And it costs 37 years of Ultra subscriptions. So, what would I actually do? If you want to run
models locally, I'd buy the 256 GB M5 Ultra at $10,799 and run GLM5.3 Flash on it for routine work
since it fits and covers a lot of ground. Then I'd keep Claude Max at $100 a month for the hard
tasks where quality really matters. That hybrid gets you privacy for everyday work and full
capability when you need it at a total cost that is actually defensible. Buy the 512 GB machine only
if the specific model you need doesn't fit on 256 GB and your data genuinely can't leave your
building. And don't hold your breath for a cheaper Ultra chip either. Bloomberg's Mark German has
reported there's no M6 Ultra coming and the next one is likely the M7 sometime in 2028. As for Kim
K3.1 Pro, which is genuinely worth watching, rent it for a month before you buy anything to run it.
Moonshot charges $2 per million tokens in and $10 per million out, which is exactly half of Opus
pricing. And the weights will still be free to download when the hardware gets cheaper. So, the
dream of owning your AI isn't dead. It just isn't a $22,000 story yet. Right now, it is an $89,000
story that takes 2 minutes to say the first word, which for most of us is the wrong story. I started
this thinking I might end up recommending that someone buy four Mac Studios, and I really did. The
Kimik K 3.1 Pro benchmark numbers are real, and when I first saw them, I had one of those, wait, is
this actually the moment feelings you get when something seems too good. But then I did the math
properly, and the math kept landing in the same place where the hardware is never the cheap way to
get the model. If this helped you think through the decision, whether that is I'm buying local
hardware or I'm keeping my subscription and sleeping soundly, drop a like and let me know in the
comments where you landed. I'd especially love to hear from the people the local option genuinely
makes sense for and what your use case looks like. I'll put links to everything I referenced in the
description, including the terminal bench leaderboard, artificial analysis scores, ZISK cluster
video, and spicy neurons writeup. And if you want to keep thinking about AI tools and local
hardware, subscribe because this conversation is nowhere near over. The weights keep dropping and
the hardware keeps improving. So, the answer to can I replace the cloud is going to be different 6
months from now than it is today. Until then, keep shipping, keep experimenting, and try not to
spend $89,000 on a hunch. I'll see you in the next one.
