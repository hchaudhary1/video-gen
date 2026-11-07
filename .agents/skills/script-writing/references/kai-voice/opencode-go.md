Source: https://www.youtube.com/watch?v=oik3S_oDJc4
Channel: Kai Explains (@kaiexplainsYT) · 2026

# Is OpenCode Go a scam? (Stop Using)

Automatic captions: names and numbers may be misheard. Style reference only: do not cite, quote or reuse its claims.

Do you know that specific kind of frustration where we are right in the middle of something,
everything is going perfectly and then it just stops? Your coding agent is on a roll, it has been
going for 45 minutes and it is found the bug and knows exactly what to fix. And then the model just
starts going in circles, where it repeats itself, second guesses itself and forgets what it was
doing three turns ago. And you are sitting there wondering whether you just lost an entire afternoon
to this thing thinking out loud. That is what dozens of developers felt on Open Router Go. And the
most honest response I saw to it came from a YouTuber who had paid $40 a month, watched his
allowance disappear mid recording, switched to DeepSeek's direct API, and immediately said on camera
that it felt like a rug pull, which is why he canceled the subscription that same day. And I get it.
I really do. When we sign up for one of these AI subscriptions, we are not only buying tokens, but
also buying trust, which is the belief that when we're in the zone at 11:00 p.m. debugging something
critical, the tool is going to hold up its end of the deal. And when it does not, it doesn't just
cost money, it costs the momentum and the focus and sometimes the entire session. So when people
started asking whether Open Code Go is a scam, I did not want to give a quick hot take. I wanted to
actually understand what's happening here because the answer is messier and more interesting than a
simple yes or no, and I think it's a lot more useful too. So let's get into it. Before we can answer
whether something is a scam, we need to understand what it is actually promising. Open Code Go is a
model subscription from the team behind Open Code, the open source coding agent, and the Go plan is
$10 a month, with Go Plus at $40 and Go Teams at $20 per seat. And across those plans, there are
around 30 models, which are mostly open weight models from Chinese labs, but there are also a few
closed ones thrown in like Claude Haiku and GPT-6 Luna. Now, this is where it gets interesting
because the limits on this thing are not counted in the way we might expect. They are counted in
dollars per model, and each model gets its own monthly budget that gets spent at that model's token
price. For DeepSeek V4 that one flash on the $10 plan, that budget is $100. And that is not a typo,
it really is $100 of DeepSeek usage for $10 a month. And they charge against your budget at
DeepSeek's own price card, which is 15 cents per million input tokens and 60 cents out with 0.3
cents per million for cash hits in off peak hours. So OpenAI themselves have done the math, and at
those prices with a typical coding agent session, they say you can send 43,330 requests in any
5-hour window. That's the number people screenshot and post and argue about, and it sounds insane,
almost too good to be true, which of course is exactly what people started saying. Now, I want to
steel man the scam argument here because it is actually stronger than a feeling that something is
fishy. The people making this case are not being paranoid, they are responding to a real pattern.
The YouTuber I mentioned at the start is M Dash, and he codes with DeepSeek every single day. So
this is not a casual user who barely touched the product. This is someone who signed up for the $40
plan on launch day, hit his limit mid recording session, switched immediately to DeepSeek's direct
API, and watched the same model with the same model name and the same version fix a bug that had
been eating him all month. On camera, in real time, the difference was visible, and that experience
did not stay private. Under every video covering this topic, there is a comment section full of
developers saying the same thing in different words, which is that the model gets confused and goes
in circles, repeating reasoning steps it already completed. Someone said the undisclosed
quantization, meaning they secretly run a compressed and cheaper version of the model, should be
illegal. And on Hacker News, someone said they wouldn't trust Go with their lunch after what they
described as horrible V4 quants and zero transparency. Now, there is also the history, which really
is the part that makes the anger make sense. The DeepSeek budget on Go has changed at least four
times since mid-August. In August alone, one user posted that his five-hour request estimate dropped
from 31,650 requests down to 3,800, which is a 88% reduction. And in July, OpenAI quietly removed
the list of which provider actually serves each model from their website with no change log and no
announcement. So it just disappeared. And then in October, they disclosed a security breach, which
was unauthorized access to a legacy system. 1.4% of users were affected, specifically the ones who
had linked API keys from outside providers like OpenAI, Anthropic, and Google. And one user reported
$400 in Anthropic charges they never made. So we have a cheap plan that feels inconsistent, numbers
that keep moving, a company that removes information instead of adding it, and a data breach on top.
And from the outside, I won't pretend that does not look like a scam. But looking like a scam and
being a scam are two different things. And once we actually dig into the technical side of what's
happening here, the story completely changes shape. The first thing everyone assumes is the simplest
thing, which is that they are running a cheaper, compressed copy of the model. So they quantize it
by squishing the weights into fewer bits, pocket the savings, and what comes out is a dummer model
that just looks like DeepSeek. It's a reasonable theory, and lots of providers do exactly this. But
with DeepSeek V4.1 Flash specifically, there is a problem. This model has 763 billion parameters,
and it is a mixture of experts architecture, which means for any single token, it only activates
about 16 billion of those parameters, the relevant experts. And the key detail is that DeepSeek
itself already ships the expert weights in four-bit precision, which is the standard aggressive
compression step everyone accuses providers of doing secretly. But DeepSeek did it publicly before
the model even hit the market. The download is 510 gigabytes instead of 763 precisely because of
this. So the cheap compression trick is the one DeepSeek already took. Squeezing it further by going
from four bit down to something more aggressive is not a quiet optimization. It is the kind of
degradation that shows up in benchmarks, so it's detectable and the benchmarks don't catch anything.
A developer who posts on X says nothing to 12 ran DeepSeek v4.1 flash through all 300 tasks of SWE
bench verified on both services. And DeepSeek's own API solved 283 while Open Code Go solved 281
which puts them two tasks apart. And when Open Code's founder Dax Rad published a chart covering
seven different benchmarks across Go server configurations and DeepSeek's direct API, the overall
scores landed between 89.3 and 90.8 with DeepSeek's API sitting at 90.5 right in the middle. Now
even M Dash, who made the original video calling it out, came back and corrected himself. And the
follow-up video explicitly says that calling it quantized was wrong. So the weights are not the
story. Something else is going on and it starts to make sense when we look at the last column in
Dax's benchmark chart, the one almost nobody talked about. That last column is called traffic and it
shows something that reframes the entire conversation. When we pick DeepSeek v4.1 flash in Open Code
Go, we are not picking a server. We are picking a name. And a router behind the scenes sends each
request to one of eight different configurations with different hardware and different providers.
Some are third-party companies with bulk agreements and some are Open Code's own racks. Dax posted
in October that one of their racks handled 6.77 trillion tokens in a single day, which is an
absolutely wild number to even look at. Now when we look at the traffic split from Dax 's chart,
config one takes 58% of requests. Configs two through seven split most of the rest, and the raw
label DeepSeek, which is the actual official DeepSeek API, gets 0.1%. So one request in a thousand
goes to DeepSeek's own infrastructure, and every hit-to-hit comparison you've watched online is
comparing one specific server against a lottery of eight. And if we weigh all of DAX's benchmark
scores by that traffic distribution, Go averages 90.48 against DeepSeek's 90.5. And statistically,
those are the same number. So DAX's claim that the average request on Go is as good as the average
request on DeepSeek is true. But I want you to really sit with this next part because it is the crux
of everything that follows, and it is that nobody sends the average request. You send your request
on your session at that moment. And averages can look perfect while one specific bucket is
completely broken, which is how statistics can be technically accurate and deeply misleading at the
same time, in the same way that a river averaging 3 ft deep does not mean nobody drowns in it. The
problems are in the tail, and the tail is exactly where heavy coding sessions live. One test in
DAX's chart is different from all the others. It's called 100k context, and it checks whether the
model still functions correctly when a conversation reaches 100,000 tokens long. For five of the
eight configurations and for DeepSeek's direct API, the score is 100, which is perfect. But config
six scores 66.7 and config seven scores 73.3, which means those two configs were failing between a
quarter and a third of long context tasks. And together, they accounted for 12% of all Go traffic.
So one request in eight was going to a setup that struggles with long conversations. DAX
acknowledged this directly, calling them two specific issues and some low-traffic configs and saying
they'd be removed. But whether they are actually gone now, nobody outside OpenAI can verify because
there is no public audit. And this matters a lot more than the numbers suggest once we think about
who actually sends long requests on a coding agent. Open Code's own pricing documentation assumes a
typical DeepSeek request carries roughly 71,700 tokens of input, which is a coding agent re-reading
its entire session context on every single turn. And that is how these agents work, where the whole
conversation history gets sent with every message. A casual chat user almost never approaches
100,000 tokens. But someone running an agentic session for 2 hours is in and around that territory
constantly, on every turn. So when the 12% tail hits a heavy user, it doesn't hit them once. It hits
them on turn 47 of a 60-turn session. And it does not look like a configuration failure. It looks
like the model suddenly got dumb and forgot what it was doing, or like it is reasoning in circles,
which, by the way, is exactly what everyone in those comment sections was describing. And that is
why feels dumber for some people was never a vibe. It was the tail. Now, let's talk about the speed
issue because this one really shocked me when I looked at the numbers. Nothing to 12. The same
developer who ran the benchmark tests ran DeepSeek V4.1 Flash through both services with identical
prompts and identical testing harness and identical reasoning effort settings. And DeepSeek's API
finished in 45 minutes, while Open Code Go took 3 hours and 25 minutes, which is 4.5 times longer
for the same job. But before you lose your mind at that number, look at the output because DeepSeek
wrote 226,572 tokens and Go wrote 224,378. And that's within 1% of each other. The model did the
same amount of work in both places, so Go wasn't thinking worse or cutting corners. Go was waiting.
And where the waiting hides is interesting. The p95 wait time for the first token, meaning the
slowest one requested in 20, was 7.57 seconds on Go and 7.58 seconds DeepSeek, which is basically
identical. So, anyone who only looked at that number would say the service performed the same. But
Go's average weight was 8.08 seconds against DeepSeek's 4.24, which is double. And when he traced
it, the jump came from just two requests that sat for 195 seconds and 256 seconds before the first
token came back. That is over 3 minutes of staring at a frozen terminal, twice, in a single test run
with no error and no timeout, just nothing until it started working again. A P95 stat can't see two
outlier stalls in a run, and a benchmark average can't see them either, so we only see it when we're
the ones waiting. Dax even admitted something similar about their own hardware. In October, he
mentioned that one of their server trays was flaky and it was showing up in latency numbers. And the
honesty is actually appreciated, but it doesn't change the experience of being the person whose
request hit the flaky tray. All right, we've covered model quality and we've covered speed. So now
let's talk about where the money actually goes. And this one is counterintuitive, and it is probably
the single biggest gap between what Go promises and what we actually experience. When we go back to
that typical coding agent session with 71,700 tokens of input, almost all of those tokens, across
every turn, are the same conversation history sent on the last turn, and only a little bit is new.
If the server still has your conversation in memory, those repeated tokens bill as cache hits, and
if it does not, they bill as fresh input. On DeepSeek's price card, fresh input costs 50 times as
much as a cache hit. That is not a rounding difference, it's a 5,000% difference in cost per token.
An Open Codes estimate of 43,330 requests per 5 hours assumes that 99.4% of every request is a cache
hit, which is the assumption baked into every number on their pricing page. Nothing to 12 measured
the actual cache hit rate on Go at 96 % against 99.7 % on DeepSix direct API. That looks like a
small gap of 3.7 percentage points. But at those price ratios, dropping from 99.4 % to 96 % means
the same request costs 1.78 times as much against the allowance. So 43,330 requests become something
closer to 24,300. He priced out his actual run at peak rates. On DeepSix API, that job costs 58
cents, while against his Go allowance, the same job costs 89 cents, which is 55 % more of his budget
for the exact same work. M-Dash measured the same gap from a different angle. He got 97.9 % cash
hits on Go versus 99.1 % on DeepSix, and that 1.2 % difference translates to 2.3 times as many
tokens being billed at the expensive 50x rate. M-Dash said $50 of DeepSix through Go felt smaller
than $50 through the API, and it was because every session was quietly leaking tokens into the
expensive pricing tier, so the budget evaporated faster. And this next part makes me feel slightly
better and slightly worse at the same time because some of that gap might actually be your fault, or
more precisely, your client's fault. Open code's docs describe a specific header called
X-OpenCodeSession. The idea is simple, where a client sends a stable session ID with each request,
so Go's router knows the next request belongs to the same conversation as the last one and can try
to route it to a server that still has that context cached. Without that header, the router is
flying blind and can send the request anywhere. And if it lands on a different server than the last
request, that server has never seen the conversation before, so everything gets billed as fresh
input, cash hits drop, and your budget shrinks. Open code documents which clients do this correctly.
Those are Open Code itself, Cloud Code, Codex, Pi, and Hermes, which all send the session header
properly. There is also a list of known problematic clients where session information goes missing
on some paths, and DeepSeek harness, which is exactly what nothing to 12 used for his tests, is
first on that list. Now, he was running the same client on both services, so that explains the gap
he saw, but it also means the cache hit numbers he measured on Go reflect a real-world scenario
because plenty of developers are running their agents through clients or configurations that don't
handle this header correctly, and they have no idea that's why their budget is disappearing faster
than expected. So before you blame the model, check that your client is on the validated list
because that one setting change might make the experience completely different. Now, there is one
more leak, and it is the sneakiest one. M- runs a custom logging harness that tracks everything, and
at the same default high effort setting on both services, 51.2% of what DeepSeek wrote through Go
was reasoning tokens, which is the internal chain of thought the model works through before
answering. Through DeepSeek's direct API, it was 39.2%. If we work that out per useful word that
actually comes back, Go's DeepSeek writes 25% more output tokens for the same final answer, and 63%
more of those tokens are thinking. And thinking is billed as output at 60 cents per million tokens
off peak, which is 200 times the price of a cache hit. So when the model thinks more, the budget
gets hit from two directions at once with more tokens and the most expensive kind of token. Why does
it happen when it is the same model at the same effort setting? Nobody outside OpenAI knows for
certain, and the most charitable explanation is a different default effort setting on some
configurations. The more worrying explanation, and one that matches what people saw, is that a
session landing on one of the broken long context configs causes the model to lose its place and
reason in circles, and a model that is confused generates more thinking tokens trying to get
unconfused where you pay for every one of them. So a request that confuses the model costs you
twice, once in tokens and once in time. And neither one shows up in a benchmark average that is
testing clean, fresh, short prompts. Okay, let's stop here and do some actual math because this is
the part where the narrative flips. Take nothing to 12's worst case, the run that used 55% more
allowance than expected and took 4.5 times longer than DeepSeek API. Even in that degraded penalty
ridden scenario, $10 on DeepSeek direct API pays for that job 17 times, while $10 of Go gives $100
of allowance, which pays for it 112 times. So that's 6.5 times the work for the same $10 on Go's
worst measured day. Even after the cash penalty, the $100 of allowance is still worth about $65 of
real DeepSeek usage. So nobody is getting robbed here. It's a discount. And it is a smaller discount
than advertised, but still a substantial one. Heavy users confirm this. One developer posted about
running 1.2 billion tokens on a single job at peak hours, which is $11.62 at API rates, and called
the $10 plan negligibly cheap next to that number. And even M Dash on the $40 plan was expecting
about $120 worth of DeepSeek monthly out of it. A scam takes your money and gives you nothing,
whereas Go gives you more tokens per dollar than the company that invented the model. What it
doesn't give you is the same experience every time. Nobody is paying more dollars than they should.
They are paying in unpredictability, which shows up as the occasional stall or the session that
mysteriously falls apart at turn 50. So the extra cost gets counted in hours rather than in dollars.
Now, how does any of this make financial sense for Open Code when the plan hands out $10 of DeepSeek
for every dollar it takes in? In August, Open Code's founder shared a dashboard showing 301,018
active Go subscribers. At $10 each, that is roughly $3 million a month in revenue. If every single
one of those subscribers burned their entire $100 DeepSeek budget at list price, Open Code's bill
would be $30 million a month, which is a 10x loss. The plan works because the average subscriber
does not use all of it. And Open Code closes the gap with bulk discounts and reserved GPU capacity,
which is those seven or eight configurations in the back end. And that infrastructure lets them lock
in rates far below what individuals pay on the API. This is not fraud. It is the oldest and most
well-established business model in subscriptions, the one gyms and cloud storage and buffets all run
on. And it works as long as the average user doesn't max everything out every month. And the gym
comparison is actually a good one here because the money pays for access to the equipment rather
than guaranteed results. Now, this also explains why the numbers keep moving. The DeepSeek budget on
Go has gone from $30 to $60 to $80 to $100 since August. And right now, the page advertises 4x the
usage for a limited time. When DeepSeek raised its own prices back in August, Go's economics shifted
overnight, and at least one user saw their 5-hour estimate drop from 31,650 requests to 3,800. The
docs say it plainly that usage limits may change, and cheap tokens today are somebody's customer
acquisition budget, which is not a conspiracy. It's really just startups doing startup things with
razor-thin margins. And I think the most practically useful advice in everything I researched here
is to pay by the month in 2026 and never commit to an annual plan on any AI service because the
market is moving too fast and the budgets are too unstable. The second most common question I see
under every Open Code video is whether Go Plus at $40 a month is worth it. And the answer depends
entirely on which model you're actually there for. For DeepSeek, which is most people, the answer is
and the math is surprisingly clear. Go Plus costs four times as much as Go, and its deep seek V4.1
flash budget is $200 against Go's $100. So that is twice the deep seek for four times the price,
which is paying double per dollar of usage. For other models, it gets more interesting. Kimi K3 on
Plus gives $60 against Go's $15, which is exactly 4x usage for 4x price, so it is a wash. But for
GLM 5.3, it is $120 against Go's $15, which is eight times the usage for four times the price, and
the best deal on the page for anyone on that model. If someone lives and dies by deep seek and is
burning through the $100 allowance quickly, the logical move would be two $10 plans, which would get
$200 of deep seek for $20. But Open Court has apparently caught on to this and now refuses a second
Go subscription on the same account. And one quick warning before anyone gets excited about those
usage numbers is to check which model is actually running, because Kimi K3 bills $3 per million
input tokens and $15 per million output tokens. On Go's own estimates, one Kimi request can cost as
much as 66 deep seek flash requests, and the $15 Kimi budget on the base plan works out to roughly
490 requests for the entire month, and I do mean the month, not the day. That's not a hidden trap
because it's right there in the table on the pricing page. It is just buried in a table nobody
scrolls to, which is its own small way of using information architecture against you, although that
is true of nearly every software pricing page ever made. Now, I want to be careful here because I've
been defending Go throughout this video, and the criticism deserves its fair due. The service is not
a scam, but the company's communication record is not clean. Back in May, when users started asking
which of Go's models were running on third-party servers, Dax answered that they had custom
agreements with every provider and that people could decide whether to trust them. That was vague,
but it was at least an answer. In July, they removed the provider names from the go page and from
their models API entirely with no change log and no announcement. And that is really the kind of
thing that makes people feel like information is being hidden from them because it is. There was
also a privacy table that at some point listed DeepSeek as training on your data, no agreement. And
today it says not used, zero day retention under an agreement renewed monthly. That's a meaningful
change, but nobody would know it happened unless they happened to screenshot the old version. On
October 19th, a user noticed that Go's DeepSeek was still fingerprinting as the old model checkpoint
and Open Coder announced the update to the new checkpoint about 6 hours later. The model name in the
UI stayed the same the whole time while a different model ran underneath and the name never tells us
which checkpoint we are actually on. And then there is the breach in October where 1.4% of users
were affected. If you never linked outside API keys, you weren't in that group. And affected users
were emailed, but the disclosure came after the fact and the pattern of a company that documents
things only when pushed. I want to be clear that none of this is running a con, but it is also not
the transparent trust first communication style we want from a service that is routing our code and
our conversations through eight different server configurations we can't see. And a company that
documents things after it gets pushed is a real thing to factor in. After all of this, I think there
is a clear and honest answer to who this product is actually wrong for. And the answer comes from
the tail rather than from anyone's opinion. If you run agents unattended for hours and your context
regularly grows past 100,000 tokens, you are the one in eight. And when you hit one of the
struggling configurations, a 4-minute stall or a confused turn does not just cost that turn, it
compounds through every turn that follows because now the model is working from a degraded context,
which is how a 12% failure rate turns into an unusable afternoon. Nothing to 12 landed on the same
conclusion after four rounds of testing, saying that for work where mistakes pile up across many
turns, he'd use DeepSeek's direct API, and for a personal assistant, Go. The same calculus applies
if someone is paying you by the hour. If a bad run takes 4.5 times as long, you've wiped out the
savings on the subscription in a single afternoon of billable work, and the math stops making sense.
For those people, $10 to DeepSeek's own platform is the right answer, since it's actually the same
model on the same price card, and in his testing, it gave 99.7% cash hits and no mysterious stalls.
And for everyone else, meaning the hobby projects, the evening sessions, the short agentic tasks,
and the exploratory coding, Go is probably the cheapest good seat in AI coding right now by a
significant margin. So, after all of that, is open code Go a scam? No. And the reason is that it
sells DeepSeek at a tenth of DeepSeek's price, and on average, it is the same model. What it doesn't
sell is consistency, meaning the same server, the same latency, and the same cash behavior every
time. And the tale is real, and the tale is exactly where the angry YouTube comments come from. But
being inconsistent and being fraudulent are two different things. The service delivers more tokens
per dollar than the company that makes the model, and the problems are real and documented, but they
are the kind of problems that show up in engineering rather than in ethics. If you are on Go or
thinking about trying it, there is a two-number test that actually tells you what's going on. The
first number comes back on every response in a field called open code allowance, which is what that
specific request costs against your budget. And if you add it up over one normal day of work, you'll
know what your $10 is actually buying, which is your real usage rather than what the estimate page
says. The second number is your cash hit rate from the cash token count in that same response. If
you're at 99%, you are getting the deal they advertised, But if you're at 96% your budget is quietly
shrinking by almost half and your client is probably not sending the session header correctly. So
check both numbers, fix the header if it is wrong, and pay by the month because the average was
honest the whole time and the only problem is that nobody codes in the average. And if this helped
you make sense of the open code situation, subscribe because I'm going to keep doing this kind of
breakdown whenever something in the AI space needs an actual look under the hood rather than a hot
take. Drop a comment with what you are using for AI assisted coding right now because I'm genuinely
curious whether the go experience varies by the kind of work people are doing. See you in the next
one.
