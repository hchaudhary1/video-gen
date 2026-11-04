# Editorial profiles

Choose by treatment, not just topic. The user's explicit direction wins.

| Intent | Profile |
|---|---|
| Long-form first-person tech/AI explainer, a continuously moving story visualized through original drawings | [kai-explainer](kai-explainer/PROFILE.md) (vendored explainroo engine, not `project-new`) |
| Original uncanny fiction or survival rules (series horror; identities in `rules-story/identities/`) | [rules-story](rules-story/PROFILE.md) |
| CNBC clips of a famous market voice + original finance commentary (30–40% CNBC, 60–70% own), authored motion design with selective B-roll | [cnbc-commentary](cnbc-commentary/PROFILE.md) (ExplainRoo Midnight + `npm run video -- cnbc ...`) |

Load only the selected profile. Ask a routing question only when the treatment is genuinely ambiguous.
`project-new --profile rules-story` saves its instructions with the project; kai-explainer and cnbc-commentary follow
their own PROFILE.md with the vendored engine. Provider/model settings are separate.
Profiles establish purpose and evidentiary boundaries; agents choose the storytelling and implementation.

rules-story uses the full [Motion Explainer reference](../docs/motion-explainer.md) during visual planning,
for long videos and Shorts alike; editorial purpose determines its application.
