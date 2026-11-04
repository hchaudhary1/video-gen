# Seekable animation

HyperFrames renders by seeking time. A frame depends on that time and fixed inputs, not on the
previous frame, wall-clock time, live network state or callbacks that only run during playback.
The root already loads local GSAP. Other runtimes are an implementation choice only when they satisfy
the same seek contract; importing this skill does not install them.

## GSAP

- Build one paused timeline per scene; register it in `window.__timelines[sceneId]` after all tweens
  and asynchronous setup, including font-dependent measurements, are ready.
- Place meaningful states at explicit scene-local times. Prefer `fromTo` with explicit initial and
  final states to `from` tweens that capture mutable state. Verify reused elements across backward seeks.
- Measure layout before constructing animation, not on every update.
- Only the scene's root timeline is paused; nested timelines inside it must remain seekable with it.
  Do not call `play()` or attach it to the pipeline's root timeline.
- Finite repeated animation must cover the required slot. Do not use `repeat:-1`.
- A property has one animation owner. Use an inner wrapper when separate transforms are needed.
- Transforming text spans requires an appropriate box, such as `display:inline-block`.

## Procedural drawings and Canvas

Use the repository's [Motion Explainer Canvas bridge](../../../docs/motion-explainer.md#canvas-bridge)
when drawing from timeline time. It redraws on time assignment, including seeks that suppress callbacks.
Use the actual scene duration and job fps; remove upstream preview loops.

`drawFrame(frame, seconds)` redraws the entire scene from supplied time. Clear the canvas, derive
positions and poses from keyed states or closed-form functions, then draw. Do not accumulate particles,
camera transforms or paint from the previous invocation. For texture or jitter, derive a seed from
stable object identity and frame index. A seeded generator that advances once per render call still
depends on seek order.

If a simulation is necessary, precompute states from a fixed seed and look them up by time.
Keep heavy preparation outside the frame drawing function. A timer or `requestAnimationFrame` loop
cannot be the renderer's clock. Canvas text needs manual readability inspection: DOM bounds checks
do not measure it.

## Additional runtime features

The repo pins HyperFrames in `package.json` and integrates with its installed assembler/player through
`lib/native.mjs`. Verify unfamiliar runtimes, event APIs and attributes against the installed version
before relying on them; an upstream feature list is not a compatibility guarantee. Keep required
runtime files local and follow [composition.md](../../../docs/composition.md) for build and seek checks.
Do not upgrade dependencies to make an example work during production.
