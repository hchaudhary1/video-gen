---
name: typography
description: Heavy-weight type rules for any text drawn into a video frame or thumbnail.
---

On-screen text uses heavy weights only: Inter or Poppins ExtraBold/Black, Space Grotesk 700,
Fira Code Bold, JetBrains Mono Bold/ExtraBold, or a similarly heavy face. Never thin, light
or regular weights.

Load the actual font file (local packages under `node_modules/@fontsource/`, or the files the
engine provisions), keep its natural proportions, and never stretch text or silently fall back
to a system font. If the font cannot load, report it rather than shipping a substitute.
