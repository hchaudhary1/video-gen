# Scene format

[docs/composition.md](../../../docs/composition.md) owns the manifest schema, measured cues,
generated root and build interface. This reference covers authoring details, not another project format.

## Scene template

The canvas and duration below are examples; use the prepared job and resolved scene slot.

```html
<!doctype html>
<html><body>
<template id="opening-template">
  <style>
    #opening-root { position:absolute; inset:0; overflow:hidden; background:#000; }
    #opening-door { position:absolute; left:35%; top:15%; width:30%; height:70%; }
  </style>
  <div id="opening-root" data-composition-id="opening"
       data-width="1920" data-height="1080" data-duration="6">
    <div id="opening-door"></div>
  </div>
  <script>
  {
    const tl = gsap.timeline({paused:true});
    tl.fromTo('#opening-door', {scale:1},
      {scale:1.15, duration:2, ease:'power2.inOut'}, 1);
    window.__timelines['opening'] = tl;
  }
  </script>
</template>
</body></html>
```

This is a technical skeleton; it does not include the required horror-series mount or finished artwork.

- Put scene styles, scripts and markup inside `<template>`; head styles/scripts are dropped by assembly.
- The inner `data-composition-id` and registered timeline key match `film.json`'s scene ID.
  Prefix DOM IDs across scenes. The pipeline chooses host IDs; do not rename generated hosts to
  follow an upstream example. Our generator uses `host-<scene-id>`.
- Style the scene root with its prefixed ID and `inset:0`. Use the prepared canvas dimensions.
- Keep script variables scoped to the scene, especially when files assemble into one page.
- Never add a scene timeline into the root timeline. The player drives them separately.

## Time, media and layout

| Field | Meaning here |
| --- | --- |
| `data-start`, `data-duration` | Seconds in the composition's time coordinate system |
| `data-composition-id` | Scene identity; matches its timeline registration key |
| `data-media-start` | Offset into a local source recording |
| `data-track-index` | Editor lane; CSS `z-index` controls paint order |

A clip's visible interval is `[start, start + duration)`. Land an end state before its final frame.
Scene timeline positions are local seconds; pipeline scene starts resolve against measured narration.
Nested clip timing is not automatically relative to the nearest timed wrapper. Avoid unnecessary timed
nesting and inspect both sides of each boundary.

Let the framework show/hide timed hosts and seek video. Animate an inner wrapper for camera moves,
masks or fades. Time video or its wrapper, not both. Use local `src`, unique IDs and `muted playsinline`
for picture-only footage. Do not manually play, pause or seek browser media.

Audio in authored HTML is not imported into our delivered mix. Put effects in `film.json` `sounds`
and the bed in `music`; [docs/audio.md](../../../docs/audio.md) defines routing and verification.
Keep supplied and approved narration unchanged.

Asset URLs resolve from the assembled job root, including in sub-compositions: use `assets/...`,
without a leading slash. Declare local fonts through `@font-face`, with the actual weight and style.
Do not rely on an upstream bundled-font list, a system fallback or network font fetch.

Keep CSS transforms off elements whose transforms GSAP animates. Prefer transform animation over
per-frame layout changes. Deliberate crops or overlaps need visual inspection; an audit opt-out does
not prove readability. Preserve the kit's HUD and caption space when staging the picture.

## Diagnosing a blank or drifting frame

Check the scene ID, template contents, local asset URLs and browser errors. Register the timeline only
after asynchronous setup completes. Use explicit states and test a repeated timestamp after a backward
seek. If the error is in generated root HTML, fix the generator during software work rather than patching
the generated job file. Follow the composition contract for infrastructure failures and stale evidence.
