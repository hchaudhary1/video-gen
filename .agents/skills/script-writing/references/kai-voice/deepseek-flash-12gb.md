Source: https://www.youtube.com/watch?v=nkb4mfa3S0A
Channel: Kai Explains (@kaiexplainsYT) · 2026

# I Run Full DeepSeek v4.1 Flash on a 12GB GPU

Automatic captions: names and numbers may be misheard. Style reference only: do not cite, quote or reuse its claims.

Okay, I think you've been here before. You saw the Reddit post where someone ran Deepseek, the
actual 500 GB monster on a regular gaming GPU, which was a 5-year-old card with 12 gigs of VRAM, and
you got excited, stayed up too late, followed the guide, and downloaded the files. Then you read the
fine print where somebody in the comments said, "Oh, this isn't the real model. It's the two-bit
version. It's basically a lobotomy." and you sat there at 2:00 a.m. staring at a progress bar asking
yourself whether this thing is even thinking or whether it's just doing a really confident
impression of thinking. I've been there more than once and I want to talk about that feeling today
because I think it's the wrong question. But we have to understand why it's the wrong question
before we can get to what's actually happening here. And something genuinely new happened this week
where a developer named Ryan FLVL released an engine called Promethes that claims to run the full
DeepSseek V4.1 Flash, all 510 GB of it on a 12 GB graphics card. And the moment I saw that headline,
I had two thoughts in rapid succession where the first was no way and the second was wait what does
full even mean? And it turns out that second question is the one that changes everything. So what's
up everyone? And this video is going to go a little differently from the usual model speed and
benchmark format. And I think there's a much more interesting conversation underneath all of that.
And it gets skipped in almost every video about running DeepSync locally. That conversation is about
what a word costs. And I don't mean in money, though we'll get to that too, and the numbers will
surprise you. But what it costs your PC in gigabytes every single time the model writes one token.
Once you understand that number, everything else clicks into place from the speeds and the trade-
offs to the debates about full versus fake and the recommendations at the end. So, let's build up to
it properly and at the very end, we'll also look at whether this is even worth the bother or whether
11 bucks a month does the job instead. Let me start with my own specific failure because I think
you've had a version of it too. A few weeks back, I saw the launch post from Daz Lab, which is a
research lab in Austria, saying you could run a 763 billion parameter model on a 12 GB GPU. That
post got seen about 186,000 times, and I was not immune to the hype. So, I followed the Strata
installer, which was one line of terminal and incredibly smooth, and it worked. And then I actually
used it for something, and that's where the cracks started showing. The speed was fine for casual
use and the answers felt good mostly, but there was something in the back of my head that wouldn't
let it go because every couple of responses, something would feel slightly off, like the model was
just barely missing the punchline of a joke it was trying to tell. It was coherent and it was
responsive, but it had this subtle quality of a person recounting a movie they saw once 6 months ago
where the vibe is right and the details are wrong. And then the comments started saying, "This isn't
a real model. It's a lobotomized copy and the two-bit compression throws away half the information."
Now, I know internet comments aren't a peer-reviewed journal, but they planted a seed. So, when Ryan
dropped Promethes with the words full model, no shortcuts, I genuinely stopped what I was doing. And
what took me a bit to work out is that the debate everyone was having was using the wrong unit. It
was never really about full or fake. It was about bytes per word. And to understand why, we have to
look at what DeepSseek actually shipped. Okay, this next part made me go back and stare at a wall
for a minute. Everyone in the two-bit debates talks about the full model like it's some pristine
uncompressed 16bit floatingpoint behemoth sitting on a server farm. And the compressed version is a
pale shadow of that, which is the implied story. But if we go open DeepSseek's own config file on
hugging face, the quantization section says the dense weights ship as FP8 and the expert weights
which are the most important part ship as FP4 which is 4 bits. That's the release meaning it's what
DeepS itself ships and what their API serves. So the full model is already 4bit. Let me put some
numbers on this to make it land. Now, 763 billion parameters at 16 bits would be 1,526 GB, which is
not a file you're downloading on any internet connection that exists in a residential building. And
DeepSeek ships the experts at 4 bits, which brings the expert weights alone to about 288.8 GB from
15,360 experts at about 18.8 mgabytes each. Then we add another 196 gigs for a lookup structure
called Engram. and there are 25 or so gigs for everything else like the attention layers, the draft
head, and the vision components. So, we end up at 510 gigs. So, the real gap isn't 16 bits versus
two. It's four bits versus two on the part that makes up most of the file. In other words, the
compressed models keep half the bits itself chose for its experts. That's a real difference, but
it's not the difference the debate implies, and this reframing matters enormously for what comes
next. Now the number that runs everything starts with the shape of the model. Deepseek has 40 layers
and each layer has 384 experts. And when the model writes a word, any word at all, whether it's the
or mitochondria, each layer picks six of those experts to handle it. So 240 experts touch every
single token the model produces. At 18.8 8 megabytes per expert times 240 experts. Every word costs
about 4.5 GB of expert weights. And that's for one single word. And your graphics card, the 12 gig
one, is the fastest storage in your system. But we're asking it to serve 4.5 GB of expert weights
for every single token. While it only holds 12 gigs of anything at all, so you can probably already
feel the math starting to strain. Now, Promethes stores a 2-bit copy of each expert at about 11.5
megabytes instead of 18.8. So, a word on Promethes costs about 2.8 GB and Strata's 2-bit files are
even smaller at about 9 megabytes per expert, which puts a word at around 2.1 GB and 1.8 when it
drops the sixth expert. The other structure, engram, barely factors in because each word only reads
a few rows of it. So, it can sit happily on your SSD without causing any trouble. Now, this is where
the hardware setup gets humbling. Ryan's reference machine is a Ryzen 93950X with 64 gigs of RAM,
the RTX 3060, and two crucial NVME drives. And on that machine, the graphics card holds about 78 of
the most used exports at any time out of 15,360, which is 0.9 GB on the card and half a% of the
model. Engineers call this memory bound. But the more useful name for what we're doing here is bytes
per word because that's the bill your PC pays for every token the model writes. And while the
graphics card is the fastest shelf in the building, it only holds half a percent of the inventory.
So, how fast is fast enough? That question is a personal one, so let's put real numbers on it. Ryan
measured the actual full weights, meaning the original FP4 experts with no compression and no tricks
on the reference machine and got 2.14 tokens per second on a 12 gig card. And that lines up with the
math. The two NVME drives read together at up to 9.9 GB per second. And at 4.5 gigs of weight per
word, that comes out to about 0.45 45 seconds per word or 2.2 words per second. So, the measured
number lands almost exactly where it should. One person in the comments went further and ran the
native FP4 checkpoint on an RTX 5060 with 8 GB and 31 gigs of RAM. And they got about 1.6 tokens per
second straight from a PCIe 5 drive and 2.4 tokens per second with a RAM cache. Now, that's one
comment and not a full benchmark, but the numbers line up with everything else. So, let's be real.
about 2.14 tokens per second, which is one word roughly every half second. For a 300word paragraph,
that's about 2 1/2 minutes of watching the cursor blink. And for anything that involves a chain of
reasoning, which is the kind of thinking where deepseek is actually impressive, you might be
watching that cursor for a very, very long time. Now, compare that to strata, where the two-bit file
with fewer bytes per word runs at about 4.7 tokens per second on a 570 with 64 gigs of RAM and a
decent drive. And if we divide that by 2.14, we get 2.2 times faster on roughly half the bytes per
word. So the math checks out and speed really does track bytes. The weird outlier in Strata's docs
is a 3060 with only 46 gigs of RAM showing 8 to 10 tokens per second, which the docs don't explain,
and I'm not going to explain either. So please don't go buy a 360 based on that line. When we look
at real world results from people who aren't the developers, the picture is a lot slower. AI
receipts got 1.84 tokens per second on a 570 with 32 gigs and no place like local host got 2.8 8 on
a 470 with 128 gigs, then added a 24 gig card and got to 4.7. And on that setup, a single coding
question took 11 minutes and 30 seconds. And I want you to hold that number in your head for later.
Okay, so if the full weights do 2.14 tokens per second, how does Promethes claim seven? This part is
genuinely clever, and it's where I went from skeptical to actually impressed. Ryan calls the method
compress then correct. Every word is computed first on the two-bit copy of the experts which is the
fast pass on the cheap bites. Then the engine looks at how confident the model was by measuring the
gap between the top two candidate words. And if that gap is small, closer than a threshold of 0.45,
the model wasn't sure and that word gets flagged. For a flagged word, the engine does something
interesting because it has stored correction data alongside the two-bit copy, which is enough to
reconstruct the full precision FP4 experts from the compressed version. So, it rebuilds those
experts, recomputes the word, and keeps whatever the full weights actually pick. And an overturned
word costs 2.6 to 3.2 extra seconds, which is the correction tax. Now, at this point, you're
probably thinking that this handles accuracy, but corrections are slow. So, how do we get from two
tokens per second to seven? And the second half of the trick is the part I think is actually
beautiful. Deepseek ships a small draft head inside the model itself, which is a component Deepseek
put in the box and not something Ryan invented. It guesses the next four words and the engine checks
all four of them in one single pass over the experts. So, you get four words for the price of one
pass. In one code run that Ryan logged, 122 out of 129 guesses were accepted, which is a 94.6%
acceptance rate with each round committing an average of 4.13 words at once. So instead of paying
4.5 GB of expert reads per word, we're paying 4.5 GB per four words. The effective cost per word
drops to about 1.1 GB, which is what gets you to 7 tokens per second. And so the 12 gig card was
never really the lever here because the lever was the draft head the whole time. This is the part of
the video where I'm going to be honest with you even when the numbers get a little uncomfortable.
Promethes published its accuracy audit and across 960 words on three different prompts. The two bit
copy alone before any corrections picked the same word as the full model 97.4% of the time. That's
25 words different out of 960. And after corrections, it climbed to 98.33%. Now, those numbers sound
impressive, and they kind of are, but I want us to slow down for a second here, because there's a
subtlety that matters. That 97.4% is per word, measured against the full model's output, one word at
a time, and assuming everything before it matched. But real generation doesn't work that way. Once
one word comes out differently, every word after it is computed on a different sentence. So the
divergence compounds and the second person to install Promeths checked exactly this with the same
engine, the same prompts and greedy decoding. So nothing random. On an agent prompt, their answer
matched word for word only up to word four out of 56. And on a code prompt, it matched up to word 15
on one pass and word two on another. And on that one machine, the stream dancer and the non-stream
dancer came out different from each other. But none of that means the answers were worse. It just
means nobody can confirm they got the full model's answer by comparing the text because this engine
doesn't write the same text twice. The two-bit copy and the full model mostly agree on the next
word, but they'll still write two different essays. Now compare that to Strata's measurement where
its two-bit file picks the same top word as the original 83.7% of the time and the 2.25 bit version
gets to 87.2%. And perplexity, which measures how surprised the model is by real text, rises 15.5%
on the 2-bit file. And the rise is worse on regular text and somewhat better on code and agent
tasks. There was one real side by side where AI receipts gave the local two-bit copy the same cart
racing prompt they'd given Deepseek's API. Two blind reviewers scored the cloud response 10 out of
12 and the local response 2 out of 12. That's one test with thinking off and faster mode on. So take
it with salt, but it points in the same direction as everything else. Now this is my favorite part
of the whole story and I think it says something important about how we should actually evaluate
this stuff. Since Ryan dropped Promethes, two people outside the original build have reported real
installs. The first one on November 3rd had a Ryzen 7950X3D with 192 gigs of DDR5 RAM and two
RTX3090s, which is three times the RAM and four times the graphics memory of the reference build.
The result was 3.10 tokens per second on code and 0.49 on reasoning. But the engine used just one of
the two cards and RAM usage stayed at 67 gigs. So all of that extra hardware got the same speed. The
second install on November 5th was more interesting with an RTX 4090, an i9, 64 gigs of DDR5, and a
PCIe 5. And at stock settings, it got 2.66 tokens per second on code and 1.20 on reasoning. And the
install verification check failed. So they dug into it and it turned out the engine fills the
graphics card with hot experts and by default leaves only 384 MGB free while that same card is also
driving the desktop. So the display was fighting the model for VRAM and the model was losing bytes
of cache on every frame. They reserved 3,000 megabytes of graphics memory instead which is a oneline
setting and pinned the engine to the performance course and code went from 2.66 66 to 9.75 tokens
per second. Reasoning went from 1.20 to 5.23. And corrections dropped from 5 to 7 seconds each to
about 1 second. So that's 3.7 times faster from changing one number, which means the hardware was
fine the whole time and the default was the bug. If your graphics card is also your display driver,
which it is on most gaming PCs, that setting is aimed directly at you. The second install found it
by filing issue number seven on the GitHub. So, one stranger and one GitHub issue got that whole
gain. This is why I always say to wait 2 weeks before making a verdict on any new local AI tool. And
the bugs that matter are rarely in the model and they're usually sitting in the defaults. There's
one more number I want to put in front of you because it doesn't come up enough in the speed
comparisons. Everything we've talked about so far is writing speed, meaning tokens per second once
the model is rolling. But before the first word, the model has to read your prompt. And on a 1,163
token prompt, Promma Theft's first word arrives after about 126 seconds of prefill, which is two
full minutes of your life before the cursor starts moving. Follow-up messages in the same
conversation start in about 2 seconds because the engine keeps what it already read, and that part
is genuinely good. But now think about agentic work for a second. No place like local hosts one open
code question used about 9,100 tokens of context. And at 9.2 tokens per second of prefill, we're
looking at approximately 16 minutes before the first word if that rate holds. But Strata reads much
faster at up to 231 tokens per second at an 8K context on the 570. So the same prompt takes about 39
seconds with Strata. And this is also where those 100 tokens per second on a 12 gig card posts came
from. But that was the reading speed and the writing speed was 4.7 which is a very different thing.
So watch the context window too. Stratus DeepS defaults to 8,192 tokens and that one open code
question needed 9,100. So the default wouldn't have held it. Let me put the full price of promise on
the table because it's part of the conversation too. Promise needs about 1,09 GB of storage, roughly
1.08 tab, which covers Deep Seeks raw weights, the 2-bit copies, the correction layers, the FP4
copies, and mirrors, so both drives can read in parallel. Strata needs 257 gigs. So, Promethes needs
4.2 times more disk. It's Windows only and it supports one Nvidia RTX 30 or 40 series card, which
means no RTX 57D, no AMD, and no Mac. And it answers one request at a time. The build on Ryan's PC
took about 4 hours and a two TBTE NVME drive was running around $300 as of November 1st. And all of
that, the terabyte, the Windows lockin, the 4hour build, and the 300 bucks, moves you from 83.7% to
97.4% top word agreement before corrections and to 98.33% after. Nine words corrected out of 960 is
what the full setup buys over the best two-bit alternative. Whether that trade is worth it genuinely
depends on who you are. Okay, I've been building to this, so I'll deliver it straight. Deepseek's
own API serves v4.1 flash, the same model version at 60 cents per million output tokens off peak and
$120 at peak. Now take Promeths at its best case of 7.4 tokens per second and run it every second of
every hour of a full 30-day month. And that gets you 19.2 million tokens, which at the off peak API
price is $11.51 for the whole month or $23 at peak. And that's the price of running that PC.
absolutely flat out at peak performance for a whole month priced in API calls before we even count
electricity. And Open Code Go, which is a $10 monthly subscription, includes $100 worth of Deepseek
V4.1 Flash at DeepSk's own prices. And $100 at 60 per million is 166.7 million output tokens, which
is 8.7 months of that PC running non-stop at its best. The card racing game that AI receipts ran
locally took 2 hours and 7 minutes for 13,316 tokens. And on the API, that's less than 1 cent, which
goes to show the full model is cheapest when someone else's PC is the one moving the bites. I'm not
saying that to dismiss local inference because I genuinely love local inference and I think it
matters, but I'm saying it because the cost framing changes the conversation from whether we can do
it to why we'd want to. Now, there's one buyer for whom all of that API math is completely
irrelevant, and I want to talk about them specifically. If your prompts can't leave the building
because you're in finance, healthcare, legal, defense, or any space with real data privacy
constraints, the API was never an option because DeepS API runs on DeepS servers. And as AI receipts
put it in a reply, nobody can change the rules on a model sitting on your own drive. So for that
buyer, a slow model on a local drive beats a fast model they're not legally allowed to use, which
makes the calculus different. And the slowness is a feature rather than a bug because the
alternative is not at all. Then there's the other end with a 4,090 64 gigs of DDR5 and a PCIe5
drive. With that one setting changed, 9.75 tokens per second on code is not a stunt. And that's
genuinely usable and it's faster than I read when I'm tired. And with 128 gigs of RAM or more,
there's another option in Unsloth's lossless 508 gig build which runs in plain lama CPP and got
merged on October 25th. So there's no new engine to install, no Windows lockin, and no terabyte of
correction data. All right, so to wrap this up with something you can actually act on, the starting
point is your RAM and not your GPU or your CPU. with 32 gigs. Don't because AI receipts measured
1.84 tokens per second in a real benchmark and a 64 gig DDR4 kit is about $500 right now, which is
50 months of Open Code Go. So spend the $10 on the subscription with a 12 gig card and 64 gigs of
RAM. Run Stratus 2-bit file. When you set it up, switch on full quality mode so it uses all six
experts instead of five. Push the context window above 8K and turn thinking mode off for quick jobs.
That setup is fast and it's proven. It's been tested by a lot of people and it's honest about what
it is. On Windows with an RTX 30 or 40 card and a free terabyte and a real wish to contribute to
something, run promise. But set the graphics memory reserve before benchmarking anything. And if the
card drives the display, reserve at least 3 gigs and then file the results on the GitHub because
I've had two external installs report and a third genuinely helps. On a Mac with 64 gigs of unified
memory, Strata has a deep seat build, too. And if you get paid for your output, use the API where
it's full weights on someone else's power bill for under a dollar on most tasks. And the thing I
keep coming back to after going through all of this is that the conversation about fool or fake was
never really about accuracy. It was about trust. When we're waiting 2 minutes for the first word and
then 11 minutes for the first answer, we want to know the weight was worth it and that the model was
actually thinking and not doing a compressed approximation of thinking. So, is the compression
question real? It is, but the gap is narrower than the debate implies because Deep Seek shipped a
4-bit model. The two-bit copies keep half of that and Prometh tries to recover most of the
difference with corrections. How much of the difference it actually recovers in practice, on your
prompts, and on your hardware is something you'd have to test yourself. What I can say for sure is
that bytes per word is the number that runs everything. And speed, accuracy, storage, and every
trade-off flows downstream from how many gigabytes the PC has to move every time the model writes a
word. Once we see the problem that way, we stop asking whether this is the real model and start
asking what the right bytes per word is for our use case. And that's a question we can actually
answer. If you try any of these setups, I really want to hear how they go. Drop your hardware in the
comments with the card, the RAM, and the drive speed, and what you actually got because the more
data points we have, the better the picture gets for everyone. And if this helped you cut through
the noise, subscribe because that's the whole goal of this channel. and I'll see you in the next
