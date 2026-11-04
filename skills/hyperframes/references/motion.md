# Motion for narrated horror

Use the full [Motion Explainer reference](../../../docs/motion-explainer.md) for technique selection
and implementation examples. This guide helps choose how a move serves a beat; it is not a required
effect list. The saved profile and approved direction govern the film's grammar.

## Narration is the clock

Anchor reveals and actions to measured words, then allow time for anticipation, contact, reaction and
consequence. A camera move does not substitute for the event being described. Keep the relevant door,
person, hand or clock legible when the narration refers to it.

Hard cuts at sentence boundaries are the rules-story default. A deliberate hold can build dread.
Use pushes, a rack of attention, a match cut or glitch when the moment earns it. Do not impose launch-film
averages, a minimum number of transition styles or a cap on hard cuts. Preserve fixed narration and scene
slots when changing animation speed; adjust the move within the measured beat.

## Direct the viewer's eye

- Choose the primary action, its direction and strength. Secondary movement supports it rather
  than competing. A head notices, the hand reaches, the body follows.
- Arrivals can decelerate (`power4.out`), camera moves can ease both ways (`power2.inOut`), and an exit
  can accelerate (`power3.in`). These are starting choices, not one curve for every action.
- Constant speed suits a running timecode or mechanical rotation. Procedural noise should not
  make a prop drift or a hand lose contact.
- A readable caption or rule settles while it is read. Move the subject or camera separately when useful.
  Avoid continuous scale or float loops on text as a substitute for staging.
- Character anticipation, overshoot and breathing can be acting. An unnatural snap or synchronized
  crowd can be intentional horror; establish that choice rather than accepting a rig defect.

## Mechanisms

| Intention | Implementation |
| --- | --- |
| Pan, push, zoom or reframe | Animate `x`, `y`, `scale` on a wrapper inside the timed host |
| Reveal a region | Animate a mask or `clip-path` on an inner wrapper |
| Hold or freeze | Hold an authored state; for a mid-video freeze, export and place a local still |
| Glitch, grain or shake | Use the series kit or deterministic states keyed to time |
| Line draw | Measure paths after layout; hide round caps fully before their entrance |
| Impact | Key the contact frame precisely, then animate reaction and settle |

Keep footage under framework playback control. New renderer features such as motion-blur attributes
need verification against the installed version; the downloaded skill does not establish support.

## Inspect the move

Snapshot before, during and after an important action or seam. Check that the subject stays recognizable,
contact holds and outgoing/incoming states match the intended cut. Use playback for speed, acceleration
and rhythm; stills cannot establish smoothness. Check the same timestamp after a backward seek.
Timers, accumulated state or conflicting owners require an implementation fix, not extra animation.
