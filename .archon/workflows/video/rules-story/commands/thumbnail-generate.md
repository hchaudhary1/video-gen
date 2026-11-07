Make the thumbnail variants for `$INPUTS.project` (job `jobs/$INPUTS.project`).

`thumbnailStatus` gives the number of variants to make and any feedback on existing ones.
Make every missing variant and remake those with open feedback; leave unchanged passing
variants alone. Export each with `exportThumbnail` and look at the PNG and feed preview you
produced. The film's title and story are in `jobs/scripts/$INPUTS.project/SCRIPT.md` and `jobs/scripts/$INPUTS.project/BRIEF.md`.
