# Kai take: research, stance and voice

A Kai explainer is an argued take, not a neutral summary. The narrator explains the subject
well enough to judge it, then judges it: skeptical, supportive, or a specific split verdict
(for example "the ternary build is a tool; the one-bit build is a headline"). A script that
only restates what a paper, launch post or idea says, or that ends on "time will tell", has
failed this treatment however clear it is.

The reference channel is Kai Explains (https://www.youtube.com/@kaiexplainsYT). Its strongest
single-topic videos run 7–9 minutes, about 1,200–1,550 spoken words. Learn the method from
transcripts (`node .agents/skills/script-writing/scripts/youtube.mjs channel <url>` and
`transcript`); never copy its wording, structure verbatim, jokes or claims.

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
- **Similar videos.** Search YouTube for the topic (`scripts/youtube.mjs search`), choose
  the 3–5 most relevant or most viewed, and retain transcripts and top comments under
  `sources/videos/` with `transcript`. Note each video's angle, what it got wrong or
  skipped, and what its commenters still asked. Our video must add something they did not.

A blocked platform is a limitation: record what you tried and what remains unknown, under an
`Unavailable:` line in the relevant dossier section. Do not substitute a confident paraphrase.

Write `sources/ANALYSIS.md`, the take dossier, with these sections:

- `## Claims and evidence`: each material claim, who makes it, the evidence behind it, and
  your assessment (supported, overstated, untested, contradicted), with source files.
- `## Independent research`: what the outside evidence and your own checks show.
- `## Community reactions`: the main camps of opinion, strongest comments quoted exactly with
  author handle, platform, date and file, and which reactions the evidence supports.
- `## Similar videos`: each video's angle, gaps and errors; the questions viewers keep asking.
- `## Candidate takes`: two or three defensible positions, each with the evidence for it,
  the strongest objection, and the one you would recommend and why.

## 2. Form the take (writer)

Commit to one position before writing narration. Record it in `research.md` under `## Take`:

- **Thesis:** one sentence a viewer could disagree with.
- **Stance:** skeptical, supportive or split, and exactly where any split falls.
- **Why:** the three strongest pieces of evidence, with source files.
- **Steelman:** the best case against the thesis, stated fairly, and the answer to it.
- **What would change my mind:** the result or release that would overturn the verdict.
- **Gap:** what this video says that the similar videos did not.

The take must follow from the evidence, not from contrarianism or hype. Strong is not loud:
a verdict can be "it is real, and narrower than the headline". Opinion is the narrator's
judgment of evidence; it never becomes invented experience. Kai did not run a benchmark,
buy hardware or talk to anyone unless the retained evidence shows that this project did it.

## 3. Write in the house voice (writer)

What the reference scripts do, as method rather than template:

- **Open on the claim or the belief, then question it at once.** State the headline number
  or the thing everyone assumes in the first sentence or two, then say why it deserves
  suspicion or why it is wrong. Reframe: "the real question is not X, it is Y".
- **Say the plan.** One or two sentences naming the questions the video will answer.
- **Put real people in the script.** Quote the X post that asked the question, the Reddit
  guesses, the commenter who made the right correction, and judge them on screen ("that is
  a fair warning", "that is exactly the right correction"). Attribute by platform and role
  ("one person in that thread", "a developer on X"); quote exactly from retained files. A
  comment is an opinion or a report, never proof of a fact.
- **Receipts first, verdict second.** Concrete numbers, simple arithmetic said out loud,
  each tied to who reported it. Name provenance plainly: "these come from the company's own
  launch post; they are not independent replication".
- **Say what the headline leaves out.** Find the point where the claim narrows: the setup
  the benchmark used, the category that falls apart, the cost that is not on the slide.
- **Be fair on purpose.** A "let me be fair to it" passage that gives the strongest real
  case for the side you are against makes the verdict credible.
- **Land an explicit verdict with audiences.** "Here is the honest verdict." Then who should
  act and who should wait: "if you run X, ...; if you run Y, wait for Z".
- **Close with a line that compresses the take**, a contrast pair the viewer can repeat,
  optionally a few numbers to walk away with. No generic subscribe plea in the narration
  unless the brief asks for one.

Sentences are short, declarative and spoken: "you" for the viewer, "I" for the narrator's
judgment, contrast pairs ("It is not a memory bank. It is a reading limit."), one idea per
sentence. Explain mechanisms with a plain analogy only as far as it holds. No hedge fog
("it remains to be seen", "only time will tell", "it's a complex picture"): if something is
uncertain, say exactly what is unknown and what would settle it.

## 4. Review the take (reviewer)

In addition to `review.md` in this skill, these are material findings:

- **No stance (blocking).** The script explains without judging, hides the verdict until the
  last seconds, or balances itself into no position. The thesis should be audible within the
  first 30–45 seconds and the verdict explicit near the end.
- **Unearned stance (blocking).** The verdict does not follow from the retained evidence, a
  benchmark is treated as more than it measures, or the steelman is a straw man.
- **Not beyond the source.** The take rests only on the subject's own claims, with no
  independent evidence, community reaction or comparison where the dossier had them.
- **Community misuse.** A quote is altered, misattributed, not retained, or used as proof.
- **Redundant with existing videos.** It repeats the similar videos' angle and adds nothing
  the dossier's gap says they missed.
- **Invented experience.** The narrator claims tests, purchases or conversations that the
  project's evidence does not show.
- **Voice.** Long written sentences, abstract summaries, filler, or hedge fog where the
  reference channel would say the concrete thing.
