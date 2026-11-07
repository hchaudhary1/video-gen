# Kai take: research, stance and voice

A Kai explainer is an argued take, not a neutral summary. The narrator explains the subject
well enough to judge it, then judges it: skeptical, supportive, or a specific split verdict
(for example "the ternary build is a tool; the one-bit build is a headline"). A script that
only restates what a paper, launch post or idea says, or that ends on "time will tell", has
failed this treatment however clear it is.

The reference channel is Kai Explains (https://www.youtube.com/@kaiexplainsYT). Its strongest
single-topic videos run 7–9 minutes, about 1,200–1,550 spoken words. Section 3 distils its
method. A few of its transcripts on unrelated topics are kept in `references/kai-voice/` as voice
references for the writer and reviewer: read them for
rhythm, framing and how opinion is argued, never as sources. Do not cite, quote or reuse their
claims, and do not retrieve other video transcripts.

## 1. Research for a take (researcher)

Primary sources are necessary, not sufficient. Go beyond what the subject says about itself:

- **Primary claims.** Read the paper, release, docs or announcement itself, including the
  method, the evaluation setup, baselines, tables and stated limitations, not only the
  abstract or blog. Note who funds or ships it and what they gain if it is believed.
- **Independent research.** Look for replications, independent benchmarks, critiques,
  earlier work it builds on or quietly matches, competing approaches, and the numbers a
  practitioner would check (cost, memory, latency, licence, availability). Do your own
  arithmetic where the claim allows it and save the working.
- **Community reactions.** Find what practitioners actually say on Reddit (for AI, usually
  r/LocalLLaMA, r/MachineLearning, r/singularity, r/programming), Hacker News and X:
  `scripts/social.mjs reddit-search`, `reddit-thread` and `hn-search`. X has no public read
  API; use your web search tool (for example `site:x.com <topic>`) and retain what the
  results show with their URLs, marked as search snippets. Keep sharp questions, good
  corrections, hands-on reports and disagreement, not just applause. Save each thread you
  may quote under `sources/community/`.

A blocked platform is a limitation: record what you tried and what remains unknown, under an
`Unavailable:` line in the relevant dossier section. Do not substitute a confident paraphrase.

Write `sources/ANALYSIS.md`, the take dossier, with these sections:

- `## Claims and evidence`: each material claim, who makes it, the evidence behind it, and
  your assessment (supported, overstated, untested, contradicted), with source files.
- `## Independent research`: what the outside evidence and your own checks show.
- `## Community reactions`: the main camps of opinion, strongest comments quoted exactly with
  author handle, platform, date and file, and which reactions the evidence supports.
- `## Candidate takes`: two or three defensible positions, each with the evidence for it,
  the strongest objection, and the one you would recommend and why.

## 2. Form the take (writer)

Commit to one position before writing narration. Record it in `research.md` under `## Take`:

- **Thesis:** one sentence a viewer could disagree with.
- **Stance:** skeptical, supportive or split, and exactly where any split falls.
- **Why:** the three strongest pieces of evidence, with source files.
- **Steelman:** the best case against the thesis, stated fairly, and the answer to it.
- **What would change my mind:** the result or release that would overturn the verdict.
- **Gap:** what this video says that the usual coverage and community discussion miss.

The take must follow from the evidence, not from contrarianism or hype. Strong is not loud:
a verdict can be "it is real, and narrower than the headline". Opinion is the narrator's
judgment of evidence; it never becomes invented experience. Kai did not run a benchmark,
buy hardware or talk to anyone unless the retained evidence shows that this project did it.

## 3. Write in the house voice (writer)

A Kai script is a conversation, not a lecture: one person talking to one viewer about
something people are arguing about online. It sounds like a friend who has done the reading
and is walking you through it, warm, direct and a little opinionated. If a passage could sit
in a briefing document or on a slide, rewrite it as something you would say across a table.

### Walk in from the viewer's world

Do not open on the topic's facts. Open on something the viewer has seen, been told, tried or
assumed, a small piece of their world that the topic grows out of. Grant what is true in it,
then turn toward the question. The topic often arrives in the third to fifth sentence, and
the opening sentences need not be about the topic at all; their job is to build the story
and put the viewer in it.

> "Every time you use ChatGPT, Claude or Gemini, you are told the same thing. This model has a
> 128,000 token context window, or 200,000, or a million. And the assumption most people make
> is simple. That is how much it remembers. Bigger number, better memory. That is completely
> wrong."

The shape is: familiar scene → fair concession ("for some jobs, that is true") → "But…" pivot
to what this video is really about → the question people are asking (in their words) → the
short answer. Keep using small, relatable scenes through the script, not only at the start: a
situation the viewer has been in, a thing they would try, what they would see on their bill or
screen. Address these to "you" as possibilities ("if you have ever…", "you open the pricing
page and…"); they are scenarios, never claims about the narrator's own life.

### Tell facts the way a person tells them

Say who says it, then say it plainly, then react to it. Use the source as the subject and
an ordinary verb ("says", "reports", "lists", "shipped", "comes in"), give the fact in a whole
sentence, and follow it with what it means or how it lands.

> Robotic: "So what shipped? Bonsai 27B, from Prism ML. Two variants: 5.9 and 3.9 gigabytes.
> A first for phones."
>
> Kai: "The project is called Bonsai 27B. It shipped July 14th, built on top of Qwen 3.6 27B,
> and it comes in two variants, a 5.9 GB ternary build and a 3.9 GB one-bit build. Prism ML says
> the one-bit version is the first model in its class to run on a phone. That is the headline.
> Here's what the headline leaves out."

Patterns that make a script sound robotic, with what to do instead:

- **A rhetorical question answered in a clipped fragment** ("So what's the closest model? Right
  now, it's X."). Instead, state it: "The closest one you can actually download is X. Moonshot
  says it has…"
- **Paraphrasing a spec into vague shorthand** ("with only a slice of them working"). Instead,
  say the real figure plainly, then explain it in everyday words.
- **Label signposts** ("Step one:", "Now the one mechanism this verdict rests on"). Instead,
  give a reason: "Start with why decoding is slow in the first place, because that is the whole
  reason any of this exists."
- **Facts with no reaction.** Instead, follow a number with what it means: "That is definitely
  not enough." "Obviously, that destroys information on its own." "That sounds impossible."
- **One idea per line, every line the same length.** Instead, write a paragraph: a longer
  sentence that sets up, a shorter one that lands, a "because" that explains.

### Speak in flowing paragraphs

Draft the narration as continuous spoken prose before you divide it into scenes. Link
sentences the way people talk ("So", "But", "And", "Now we get to", "That is why", "Here's the
thing", "because"). Most sentences run 8–20 words. Use a short punch only after a longer setup,
and never stack fragments ("Now compare. 78 seats. 16 sessions."). Say the key idea twice in
different words, as people do out loud ("A context window is not memory. It has never been
memory."). Use natural intensifiers and honest reactions sparingly: honestly, obviously,
definitely, genuinely, remarkably, "and that matters more than you might think". Reach for an
everyday analogy when a mechanism is abstract (a desk, not a filing cabinet), and say where it
stops holding. No meta lines about the video's own files or research, and no stock phrase used
twice.

### Talk to the viewer

Address the viewer throughout: "you" for what they would do, pay or notice; "I" and "we" for
the narrator's choices and judgments ("here's what the headline leaves out", "honestly, I was
suspicious of this one", "so let's do the math"). Explain your own choices out loud, such as
why this example and not another, and what you are not claiming. Aim for about one "you" every
75 words and a first-person aside every 200 or so.

### Build the video on what people are asking

Find the question real people asked (an X post, a Reddit thread, an HN comment) and bring it in
right after the opening scene, in their words. Their guesses and disagreements become the
agenda: "One reply said it's just a smaller model. Another said the benchmarks are fake. A third
said it already runs on their phone. So that's what we test." Name the two or three questions
the video will answer, then give the short answer at once. That short answer is the thesis,
and it lands in the first 30–45 seconds. Later, call back to those voices as you answer them
("So what about the reply saying the benchmarks are fake?") and judge them out loud ("that's a
fair point", "that's the right instinct", "that one is wrong, and here's why"). A thread can also
supply colour, labelled for what it is ("not a benchmark, but it makes the scale clear"), and
practical advice the narrator endorses or rejects. Community voices frame and colour the
argument. The evidence settles it.

### Choose one mechanism the evidence can carry

Pick the single mechanism or calculation the verdict rests on, and choose the one the
retained evidence can carry cleanly. Before writing, list every number the walk-through needs
and check that they share one basis: the same unit, cost basis (rented or owned), model
version and date. Convert any that differ on a stated basis in the project arithmetic, or choose
a simpler mechanism. The simplest calculation that decides the verdict beats a richer one that
needs caveats in every sentence. Keep fragile or disputed economics to one clearly labelled
paragraph, not the spine of the video.

Explain the mechanism in your own words, with arithmetic simple enough to say aloud ("27
billion weights at two bytes each is about 54 gigabytes"). Then walk the candidates, guesses or
claims through it one at a time, so the viewer could redo it themselves, and react to each
result. Use a small worked example when a number is abstract ("a 200,000-token window sounds
like a novel, but one coding session with file reads and logs can fill it in under an hour").
Never hand the explanation to a quote.

### Spend numbers, quotes and cases sparingly

Use a number only when the viewer needs it to follow the argument. Kai runs about 40 numbers
per 1,000 words; stay at or below that, and round ("about 1.4 terabytes"). Use four to six
community voices, each doing a job (the question, a wrong guess, the right correction, colour,
advice), not a quote per claim. Tell two or three examples or case studies as small stories
(who, what they tried, what happened, what it means), rather than six mentioned in passing.
Attribute lightly and naturally ("Prism ML says", "the paper reports", "one person in that
thread"); keep source chains and file names in `research.md`, out of the narration.

### Keep the argument honest on air

- Receipts first, verdict second, with provenance named plainly ("that is the company's own
  launch post, not independent replication").
- When a key number is disputed or could be read two ways, say so and say which way the verdict
  depends on it.
- Only exact retained words go in quotation marks; a translated or reported version is said as
  a paraphrase.
- Say what the headline leaves out: the setup the benchmark used, the category that falls
  apart, the cost that is not on the slide.
- Give the other side its strongest evidence ("let me be fair to it"), and answer it with
  evidence, not with a commenter's opinion.
- Every audience in the verdict must have been argued in the body.

### Land it

Answer the questions you opened with, in order, in plain words ("Is it really lossless? On
these tests, yes. Is it faster for everyone? No."). Then give the verdict with who should act
and who should wait, and close with a line that compresses the take, a contrast pair the viewer
can repeat ("The one-bit build is a headline. The ternary build is a tool."). No generic
subscribe plea unless the brief asks for one. No hedge fog ("it remains to be seen", "only time
will tell"): when something is uncertain, say exactly what is unknown and what would settle it.

### Scenes and markers

Scenes follow the conversation, not the sentences. For an 8–9 minute script, use about 10–16
scenes, each a paragraph of several connected sentences that ends where the talk naturally
turns. Markers (`[#name]`) are optional; the director can also cue on spoken words. Add at most
two or three per scene, at real visual beats, between sentences. Never shorten or split a
sentence to fit a marker.

## 4. Review the take (reviewer)

In addition to `review.md` in this skill, these are material findings:

- **No stance (blocking).** The script explains without judging, hides the verdict until the
  last seconds, or balances itself into no position. The thesis should be audible within the
  first 30–45 seconds and the verdict explicit near the end.
- **Unearned stance (blocking).** The verdict does not follow from the retained evidence, a
  benchmark is treated as more than it measures, a disputed number is presented as settled,
  the steelman is a straw man, or an audience in the verdict was never argued.
- **Lecture, not conversation (blocking).** The script reads as a report or lecture, not one
  person talking to a viewer. Signs: it opens on facts instead of the viewer's world; facts
  arrive as clipped answers to rhetorical questions or vague paraphrase instead of "X says Y"
  sentences with a reaction; label signposts ("Step one"); stacked fragments or one sentence per
  marker; little "you"; no narrator asides; meta lines; no connective tissue. Quote the passages
  and compare them with the voice references side by side.
- **Community not woven in.** Voices are quoted as a collage or as proof instead of framing
  the question, setting the agenda and being answered on air; or they are absent.
- **No mechanism, or a fragile one (blocking when the verdict rests on it).** The script never
  explains the central mechanism in its own words, buries the viewer in numbers and quotes, or
  walks a calculation whose numbers do not share one basis (unit, rented or owned cost, model
  version, date).
- **Not beyond the source.** The take rests only on the subject's own claims, with no
  independent evidence, community reaction or comparison where the dossier had them.
- **Community misuse.** A quote is altered, misattributed, not retained, or a paraphrase is
  put in quotation marks.
- **Invented experience.** The narrator claims tests, purchases or conversations that the
  project's evidence does not show. Saying "I found a thread" is fine when the project
  retained it.
