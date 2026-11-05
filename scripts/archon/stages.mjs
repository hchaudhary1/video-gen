import { archiveVisualEvidence, recordVisualRevision } from '../../lib/review.mjs';
import { audioEvidence, reviewAudio, assertAudioReview } from './audio-review.mjs';
// Domain gates for Archon nodes. Scheduling and retries belong exclusively to YAML.
import path from 'node:path';
import { readFile, writeFile, mkdir, rename, stat, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  fileHash,
  sourceFingerprint,
  loadReviewPack,
  reviewStatus,
  registerProducer,
  maxReviewRounds,
  recordHumanReview,
  parseNote,
  qualifyDelivery,
} from '../../lib/review.mjs';
import { thumbnailStatus, chooseThumbnail, addThumbnailFeedback } from '../../lib/thumbnails.mjs';
import { scriptDisposition, saveProject } from '../../lib/project.mjs';
import { continueIdentity, identityForProject } from '../../lib/identities.mjs';
import { renderSoundKit } from '../../lib/series.mjs';
import { youtubeUpload } from '../../lib/youtube-upload.mjs';
export const readJSON = async (f) => JSON.parse(await readFile(f, 'utf8'));
export async function saveJSON(f, v) {
  await mkdir(path.dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(v, null, 2) + '\n');
  await rename(tmp, f);
}
export const digest = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const optional = async (f) => {
  try {
    return await readJSON(f);
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
};
const optionalText = async (file) => readFile(file, 'utf8').catch(error => {
  if (error.code === 'ENOENT') return '';
  throw error;
});
const hasAuthorOutputs = async (dir) =>
  (await Promise.all(['SCRIPT.md', 'VISUALS.md'].map(f => optionalText(path.join(dir, f)))))
    .every(text => text.trim().length > 0);

export async function scriptBinding(dir) {
  const entries = await Promise.all(
    ['SCRIPT.md', 'VISUALS.md', 'production-profile.json', 'SOURCES.md', 'research.md'].map(async (f) => [
      f,
      await fileHash(path.join(dir, f)).catch((e) => {
        if (e.code === 'ENOENT') return null;
        throw e;
      }),
    ]),
  );
  async function sources(folder, prefix) {
    const list = await readdir(folder, { withFileTypes: true }).catch((e) => {
      if (e.code === 'ENOENT') return [];
      throw e;
    });
    for (const entry of list.sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = prefix + '/' + entry.name,
        file = path.join(folder, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Script evidence must be frozen local files');
      if (entry.isDirectory()) await sources(file, rel);
      else if (entry.isFile()) entries.push([rel, await fileHash(file)]);
    }
  }
  await sources(path.join(dir, 'sources'), 'sources');
  return digest(entries);
}
export function passingThumbnails(status) {
  return status.ranking.filter((id) =>
    status.variants.some(
      (v) => v.id === id && v.made && v.review?.status === 'pass' && !v.openFeedback.length,
    ),
  );
}
export function publicationCopy(copy) {
  if (
    typeof copy?.title !== 'string' ||
    !copy.title.trim() ||
    typeof copy.description !== 'string' ||
    !copy.description.trim()
  )
    throw new Error('Publishing copy requires title and description');
  if (copy.privacy && copy.privacy !== 'unlisted') throw new Error('Rules-story publication is unlisted');
  if (copy.tags && (!Array.isArray(copy.tags) || copy.tags.some((t) => typeof t !== 'string')))
    throw new Error('tags must be strings');
  // Channel ID is obtained by the operator from Studio, never inferred from a display name.
  if (!/^UC[\w-]{22}$/.test(copy.channelId || ''))
    throw new Error('Approved publishing copy requires the exact abdupdates channelId');
  return copy;
}
export async function gate(kind, { dir, job, project, engine }) {
  let view = '';
  let binding,
    artifact,
    options = [];
  if (kind === 'publishing' && project.archon?.optOut)
    return {
      kind,
      binding: 'opt-out',
      artifact: dir,
      options: [],
      required: false,
      approved: true,
      needsAnswer: false,
    };
  if (kind === 'script') {
    binding = await scriptBinding(dir);
    artifact = path.join(dir, 'SCRIPT.md');
  } else if (kind === 'film') {
    const p = await loadReviewPack(job, 'final');
    const previewHash = engine ? await fileHash(path.join(job, 'review/preview/video.mp4')) : null;
    binding = digest([p.packSha256, await sourceFingerprint(job), previewHash]);
    artifact = path.join(job, 'review/final/pack.json');
    view = engine ? path.join(job, 'review/preview/video.mp4') : path.join(job, 'index.html');
  } else if (kind === 'thumbnail') {
    const s = await thumbnailStatus(job);
    options = [
      ...passingThumbnails(s).map((id) => ({ id, label: id })),
      { id: 'revise', label: 'Revise thumbnails' },
      { id: 'reject', label: 'Stop' },
    ];
    binding = digest(s.variants.map((v) => [v.id, v.pngSha256, v.review, v.openFeedback]));
    artifact = path.join(job, 'thumbnail/variants');
  } else if (kind === 'publishing') {
    const copy = publicationCopy(await readJSON(path.join(dir, 'publishing.json')));
    binding = digest([
      copy,
      await fileHash(path.join(job, 'renders/video.mp4')),
      await fileHash(path.join(job, 'thumbnail/thumbnail.png')),
    ]);
    artifact = path.join(dir, 'publishing.json');
  } else throw new Error('Unknown checkpoint');
  const receipt = await optional(path.join(dir, `archon/${kind}-decision.json`));
  const required =
    kind === 'publishing'
      ? !project.archon?.optOut
      : project.review.includes(kind === 'film' ? 'final' : kind);
  const approved = receipt?.binding === binding && ['approve', 'select'].includes(receipt.decision);
  return {
    kind,
    binding,
    artifact,
    view,
    options,
    required,
    approved: Boolean(approved),
    needsAnswer: required && !approved,
    receipt,
  };
}
export async function checkpoint(ctx, { kind, answer, expected }) {
  const current = await gate(kind, ctx);
  if (!current.required || current.approved) return { ...current, done: true };
  if (expected !== current.binding)
    throw new Error('Artifact changed while attention was pending; ask again for current artifact');
  const text = answer?.text;
  if (typeof text !== 'string' || !text.trim())
    throw new Error('Attention answer requires the actual operator text');
  const decision = answer.decision;
  if (!['approve', 'revise', 'reject', 'opt-out', ...current.options.map((o) => o.id)].includes(decision))
    throw new Error('Invalid attention decision');
  const record = {
    version: 1,
    source: 'archon-attention',
    kind,
    binding: current.binding,
    quote: text,
    decision:
      current.options.some((o) => o.id === decision) && !['revise', 'reject'].includes(decision)
        ? 'select'
        : decision,
    variant: decision,
    runId: process.env.WORKFLOW_ID || null,
    recordedAt: new Date().toISOString(),
  };
  await saveJSON(path.join(ctx.dir, `archon/${kind}-decision.json`), record);
  if (decision === 'opt-out' && kind === 'publishing') {
    ctx.project.archon.optOut = true;
    await saveProject(ctx.root, ctx.project);
    return { ...current, done: true, optOut: true };
  }
  if (decision === 'reject') return { ...current, done: false, rejected: true };
  if (kind === 'film' && !ctx.engine)
    await recordHumanReview(ctx.job, {
      stage: 'final',
      decision: decision === 'approve' ? 'approve' : 'revise',
      notes: decision === 'revise' ? [parseNote(text)] : [],
    });
  if (kind === 'thumbnail') {
    if (decision === 'revise') {
      for (const v of (await thumbnailStatus(ctx.job)).variants.filter((v) => v.made))
        await addThumbnailFeedback(ctx.job, { variant: v.id, text, by: 'you' });
    } else await chooseThumbnail(ctx.job, { variant: decision, by: 'you' });
  }
  return { ...current, done: record.decision === 'approve' || record.decision === 'select', rejected: false };
}
export async function stageOperation(stage, ctx, opts) {
  const { dir, job, project, root } = ctx;
  if (stage === 'visual-evidence') return archiveVisualEvidence(job);
  if (stage === 'revision-complete') return recordVisualRevision(job);
  if (stage === 'audio-evidence') return audioEvidence(ctx);
  if (stage === 'audio-review') return reviewAudio(ctx);
  if (stage === 'audio-reviewed') return assertAudioReview(ctx);
  if (stage === 'gate') return gate(opts.kind, ctx);
  if (stage === 'script-loop-check' || stage === 'script-loop-result') {
    const review = await stageOperation('script-ready', ctx, {}),
      g = await gate('script', ctx);
    return { done: Boolean(review.done && (!g.required || g.approved)) };
  }
  if (stage === 'film-loop-result' || stage === 'film-loop-check') {
    const state = await stageOperation('film-status', ctx, {});
    return { done: state.ready, reviews: state.reviews };
  }
  if (stage === 'production-result' || stage === 'production-loop-check' || stage === 'production-loop-result') {
    const technical = await optional(path.join(job, 'review/archon-technical.json'));
    if (!technical) return { done: false };
    const g = await gate('film', ctx);
    return {
      done:
        technical?.status === 'complete' &&
        technical.sourceHash === (await sourceFingerprint(job)) &&
        technical.videoSha256 === (await fileHash(path.join(job, 'renders/video.mp4')).catch(() => null)) &&
        (!g.required || g.approved),
    };
  }
  if (stage === 'thumbnail-loop-check' || stage === 'thumbnail-loop-result')
    return stageOperation('thumbnail-select', ctx, {});
  if (stage === 'publishing-loop-check' || stage === 'publishing-loop-result') {
    if (project.archon?.optOut) return { done: true };
    if (!(await optional(path.join(dir, 'publishing.json')))) return { done: false };
    const g = await gate('publishing', ctx);
    return { done: g.approved };
  }

  if (stage === 'checkpoint') {
    if (opts.kind === 'script' && !(await stageOperation('script-ready', ctx, {})).done)
      return { done: false };
    return checkpoint(ctx, opts);
  }
  if (stage === 'script-status') {
    const binding = await scriptBinding(dir),
      review = await optional(path.join(dir, 'archon/script-review.json'));
    const reportHash = await fileHash(path.join(dir, 'review.md')).catch(error => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    const current = review?.binding === binding && review?.reportHash === reportHash;
    const ready = current && review.pass === true && review.disposition === 'pass';
    const feedback = await optional(path.join(dir, 'archon/script-decision.json'));
    const inputsExist = await hasAuthorOutputs(dir);
    return {
      ready: Boolean(ready),
      needsWrite: !inputsExist ||
        Boolean(current && review.disposition === 'revise') ||
        Boolean(feedback?.binding === binding && feedback.decision === 'revise'),
      binding,
      supplied: !!project.inputScript,
      canRevise: !project.inputScript || feedback?.decision === 'revise',
      feedback,
    };
  }
  if (stage === 'script-reviewed') {
    if (project.inputScript) {
      const actual = await fileHash(path.join(dir, 'SCRIPT.md'));
      if (!project.suppliedScriptSha256) throw new Error('Supplied script initial fingerprint required');
      const accepted = await optional(path.join(dir, 'archon/supplied-script.json'));
      if (actual !== project.suppliedScriptSha256 && actual !== accepted?.sha256) {
        const decision = await optional(path.join(dir, 'archon/script-decision.json'));
        if (decision?.decision !== 'revise' || !decision.quote?.trim())
          throw new Error('Supplied script changed without operator revision');
        await saveJSON(path.join(dir, 'archon/supplied-script.json'), {
          sha256: actual,
          authorization: decision,
        });
      }
    }
    const binding = await scriptBinding(dir);
    if (opts.expected !== binding) throw new Error('Script changed during independent review');
    const report = await optionalText(path.join(dir, 'review.md'));
    const taggedBinding = report?.match(/^[ \t]*Binding:[ \t]*([a-f0-9]{64})[ \t]*$/im)?.[1];
    let disposition = report ? scriptDisposition(report) : 'incomplete';
    let findings = report || 'Reviewer did not create review.md; no inspection is claimed.';
    if (!disposition || taggedBinding !== binding) {
      disposition = 'incomplete';
      findings = 'Review report is missing a current Binding line or valid disposition. ' + findings;
    }
    if (!(await hasAuthorOutputs(dir))) {
      disposition = 'incomplete';
      findings = 'Required SCRIPT.md or VISUALS.md is missing or empty. ' + findings;
    }
    const pass = disposition === 'pass';
    await saveJSON(path.join(dir, 'archon/script-review.json'), {
      pass, disposition, findings, binding,
      reviewer: `${process.env.WORKFLOW_ID || 'archon'}:script-review`,
      reportHash: !report ? null : await fileHash(path.join(dir, 'review.md')),
    });
    return { done: pass, disposition, findings };
  }
  if (stage === 'script-ready') {
    const review = await optional(path.join(dir, 'archon/script-review.json'));
    return {
      done: Boolean(
        review?.pass === true &&
          review.disposition === 'pass' &&
          review.binding === (await scriptBinding(dir)) &&
          review.reportHash === (await fileHash(path.join(dir, 'review.md')).catch(() => null)),
      ),
      review,
    };
  }
  if (stage === 'identity') {
    if (!(await identityForProject(project.slug))) {
      const spec = await readJSON(path.join(dir, 'identity.json'));
      await continueIdentity(spec.identity, {
        project: project.slug,
        parent: spec.parent || null,
        format: project.format,
      });
    }
    return identityForProject(project.slug);
  }
  if (stage === 'producer') {
    if (!opts.role || !opts.runId) throw new Error('Archon run and producing role required');
    await registerProducer(job, { agentId: `${opts.runId}:${opts.role}`, role: opts.role });
    return { registered: true, agentId: `${opts.runId}:${opts.role}`, role: opts.role };
  }
  if (stage === 'sound') {
    const found = await identityForProject(project.slug);
    if (!found) throw new Error('Series identity required');
    const receipt = path.join(job, 'review/archon-sound.json');
    const binding = digest([found.identity.sound, (await readJSON(path.join(job, 'job.json'))).duration]);
    const prior = await optional(receipt);
    if (
      prior?.binding === binding &&
      prior.files &&
      (
        await Promise.all(
          prior.files.map(
            async ([f, h]) => (await fileHash(path.join(job, 'assets', f)).catch(() => null)) === h,
          ),
        )
      ).every(Boolean)
    )
      return prior;
    const result = await renderSoundKit(job, found.identity.id);
    const data = {
      binding,
      result,
      files: await Promise.all(
        result.files.map(async (f) => [f, await fileHash(path.join(job, 'assets', f))]),
      ),
    };
    await saveJSON(receipt, data);
    return data;
  }
  if (stage === 'film-status') {
    const reviews = await reviewStatus(job, 'final');
    const h = reviews.ok ? await gate('film', ctx) : null;
    const technical = await optional(path.join(job, 'review/archon-technical.json'));
    return {
      ready:
        reviews.ok &&
        !(h?.receipt?.binding === h?.binding && h?.receipt?.decision === 'revise') &&
        !(technical?.status === 'repair' && technical.sourceHash === (await sourceFingerprint(job))),
      reviews,
      human: h,
      technical,
    };
  }
  if (stage === 'review-round') {
    let review = await reviewStatus(job, 'final');
    if (review.reports.length !== 1)
      throw new Error(
        'One valid independent visual report required; missing inspection cannot count as a review',
      );
    const manifest = await readJSON(path.join(job, 'job.json'));
    if (manifest.reviewRoundPacks?.final !== review.packSha256) {
      manifest.reviewRounds = { ...manifest.reviewRounds, final: (manifest.reviewRounds?.final || 0) + 1 };
      manifest.reviewRoundPacks = { ...manifest.reviewRoundPacks, final: review.packSha256 };
      await saveJSON(path.join(job, 'job.json'), manifest);
    }
    review = await reviewStatus(job, 'final');
    if (review.reports.some((r) => r.verdict === 'incomplete'))
      throw new Error('Independent inspection incomplete; obtain actual viewing capability');
    await saveJSON(path.join(job, 'review/archon-findings.json'), review);
    return { done: review.ok, review, budget: maxReviewRounds(manifest) };
  }
  if (stage === 'thumbnail-status') {
    let status = await thumbnailStatus(job);
    for (const v of status.variants.filter((v) => v.made)) {
      const size = (await stat(path.join(job, 'thumbnail/variants', v.id, 'thumbnail.png'))).size;
      if (
        size > 2 * 1024 * 1024 &&
        !v.openFeedback.some((f) => f.by === 'technical' && f.text.includes('2 MB'))
      ) {
        await addThumbnailFeedback(job, {
          variant: v.id,
          by: 'technical',
          text: 'PNG exceeds the YouTube 2 MB limit; simplify or optimize the PNG and re-export both sizes.',
        });
      }
    }
    status = await thumbnailStatus(job);
    return {
      done:
        status.variants.every((v) => v.made && v.review && !v.openFeedback.length) &&
        passingThumbnails(status).length > 0,
      status,
    };
  }
  if (stage === 'thumbnail-select') {
    if (!(await stageOperation('thumbnail-status', ctx, {})).done) return { done: false, chosen: null };
    const s = await thumbnailStatus(job),
      g = await gate('thumbnail', ctx);
    if (
      !s.chosen &&
      !g.required &&
      passingThumbnails(s).length &&
      s.variants.every((v) => v.made && v.review && !v.openFeedback.length)
    )
      await chooseThumbnail(job, { variant: passingThumbnails(s)[0], by: 'reviewer' });
    let chosen = (await thumbnailStatus(job)).chosen;
    if (
      chosen &&
      (await fileHash(path.join(job, 'thumbnail/thumbnail.png')).catch(() => null)) !== chosen.pngSha256
    ) {
      await chooseThumbnail(job, { variant: chosen.variant, by: chosen.by });
      chosen = (await thumbnailStatus(job)).chosen;
    }
    return { done: !!chosen && (!g.required || g.approved), chosen };
  }
  if (stage === 'publish') {
    if (project.archon?.optOut) return { optOut: true };
    if (!(await stageOperation('script-ready', ctx, {})).done)
      throw new Error('Current independently reviewed script required for publication');
    for (const kind of ['script', 'film', 'thumbnail']) {
      const approval = await gate(kind, ctx);
      if (approval.required && !approval.approved)
        throw new Error(`Current ${kind} approval required for publication`);
    }
    const g = await gate('publishing', ctx);
    if (!g.approved) throw new Error('Current publishing approval required');
    await (ctx.qualify ? ctx.qualify() : qualifyDelivery(job));
    const selection = (await thumbnailStatus(job)).chosen;
    if (!selection || selection.pngSha256 !== (await fileHash(path.join(job, 'thumbnail/thumbnail.png'))))
      throw new Error('Current reviewed thumbnail selection required');
    const copy = publicationCopy(await readJSON(path.join(dir, 'publishing.json')));
    const id = await youtubeUpload(root, {
      file: path.join(job, 'renders/video.mp4'),
      title: copy.title,
      description: copy.description,
      tag: copy.tags || [],
      privacy: 'unlisted',
      thumbnail: path.join(job, 'thumbnail/thumbnail.png'),
      expectedChannelId: copy.channelId,
      expectedChannelHandle: 'abdupdates',
      journal: path.join(dir, 'archon/upload-session.json'),
    });
    const receipt = { id, url: `https://youtu.be/${id}`, binding: g.binding };
    await saveJSON(path.join(dir, 'archon/published.json'), receipt);
    return receipt;
  }
  return undefined;
}
