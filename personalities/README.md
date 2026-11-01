# Editorial profiles

Choose by treatment, not just topic. The user's explicit direction wins.

| Intent | Profile |
|---|---|
| Teach a concept or mechanism | [explainer](explainer/PROFILE.md) |
| Long-form first-person tech/AI explainer, locked frame that builds up per scene | [kai-explainer](kai-explainer/PROFILE.md) (vendored explainroo engine, not `project-new`) |
| Original uncanny fiction or survival rules (series horror; identities in `rules-story/identities/`) | [rules-story](rules-story/PROFILE.md) |
| Markets, earnings or financial reporting | [news-financial](news-financial/PROFILE.md) |
| CNBC clips of a famous market voice + our commentary (>50% own), Finance Deep Dive style | [cnbc-commentary](cnbc-commentary/PROFILE.md) (explainroo engine + `npm run video -- cnbc ...`) |
| Elections, government or political reporting | [news-political](news-political/PROFILE.md) |
| Actually test or demonstrate software | [app-review](app-review/PROFILE.md) |

Load only the selected profile. Ask a routing question only when the treatment is genuinely ambiguous.
`project-new --profile <id>` saves its instructions with the project. Provider/model settings are separate.
Profiles establish purpose and evidentiary boundaries; agents choose the storytelling and implementation.

All profiles use the full [Motion Explainer reference](../docs/motion-explainer.md) during visual planning.
Techniques are shared across profiles and film lengths; editorial purpose determines their application.
