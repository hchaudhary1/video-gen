Fix the thumbnail variants of `$INPUTS.project` (job `jobs/$INPUTS.project`) that the independent review blocked.

`thumbnailStatus` lists each variant's findings and open feedback. Remake the blocked variants
so every finding is addressed and re-export them with `exportThumbnail`. A variant is selected
after this fix without another review.
