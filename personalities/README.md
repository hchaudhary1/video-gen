# Editorial profiles

Choose by treatment, not just topic. The user's explicit direction wins.

| Intent | Profile |
|---|---|
| Long-form first-person tech/AI explainer, locked frame that builds up per scene | [kai-explainer](kai-explainer/PROFILE.md) (vendored explainroo engine, not `project-new`) |
| Original uncanny fiction or survival rules (series horror; identities in `rules-story/identities/`) | [rules-story](rules-story/PROFILE.md) |

Load only the selected profile. Ask a routing question only when the treatment is genuinely ambiguous.
`project-new --profile rules-story` saves its instructions with the project; kai-explainer follows its own
PROFILE.md with the vendored engine. Provider/model settings are separate.
Profiles establish purpose and evidentiary boundaries; agents choose the storytelling and implementation.

rules-story uses the full [Motion Explainer reference](../docs/motion-explainer.md) during visual planning,
for long videos and Shorts alike; editorial purpose determines its application.
