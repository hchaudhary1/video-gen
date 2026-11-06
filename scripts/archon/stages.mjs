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
  covers,
} from '../../lib/review.mjs';
import { thumbnailStatus, chooseThumbnail, addThumbnailFeedback } from '../../lib/thumbnails.mjs';
import { scriptDisposition, saveProject } from '../../lib/project.mjs';
import { continueIdentity, identityForProject } from '../../lib/identities.mjs';
import { renderSoundKit } from '../../lib/series.mjs';
import { youtubeUpload } from '../../lib/youtube-upload.mjs';
import { validateScript, validateResearch } from './contracts.mjs';
import { buildUsable, recordContinuation } from '../../lib/acceptance.mjs';
import { recordUnavailableVisualReview, recordTechnicalRevision } from '../../lib/review.mjs';
import { acceptThumbnail } from '../../lib/thumbnails.mjs';
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
    ['BRIEF.md', 'PACKAGE.md', 'SCRIPT.md', 'VISUALS.md', 'production-profile.json', 'SOURCES.md', 'research.md'].map(async (f) => [
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
const reportHashOf = (dir) => fileHash(path.join(dir, 'review.md')).catch(e => {
  if (e.code === 'ENOENT') return null;
  throw e;
});
// A script is accepted when its current text passed independent review, or when it is the
// result of the one fix round after a non-passing review (or a later duration/audio fix).
// The fixed text is not reviewed again; archon/script-revision.json records why it continued.
export async function scriptAcceptance(dir, project) {
  const validation = await validateScript(dir, project);
  const binding = await scriptBinding(dir);
  const review = await optional(path.join(dir, 'archon/script-review.json'));
  const reportHash = await reportHashOf(dir);
  const reviewed = review?.binding === binding && review?.reportHash === reportHash;
  const passed = validation.valid && reviewed && review.pass === true && review.disposition === 'pass';
  const revision = await optional(path.join(dir, 'archon/script-revision.json'));
  const continued = validation.valid && revision?.binding === binding;
  return { done: Boolean(passed || continued), mode: passed ? 'passed' : continued ? revision.mode : null,
    validation, binding, review, reviewed: Boolean(reviewed), revision };
}
// Automated script fixes never rewrite a supplied script or one the operator must approve.
export const scriptFixAllowed = (project) => !project.inputScript && !project.review.includes('script');
export async function recordScriptRevision(ctx, { mode, reason, priorBinding = null }) {
  const validation = await validateScript(ctx.dir, ctx.project);
  if (!validation.valid)
    throw new Error(`Script is unusable after its fix round: ${validation.errors.join('; ')}`);
  const receipt = { version: 1, mode, reason, priorBinding, binding: await scriptBinding(ctx.dir),
    runId: process.env.WORKFLOW_ID || null, recordedAt: new Date().toISOString() };
  await saveJSON(path.join(ctx.dir, 'archon/script-revision.json'), receipt);
  return receipt;
}
const thumbnailReviewSet = (status) => digest(status.variants.map((v) => [v.id, v.review ? v.pngSha256 : null, v.review?.status ?? null]));
const thumbnailCurrentSet = (status) => digest(status.variants.map((v) => [v.id, v.pngSha256 ?? null]));
export function passingThumbnails(status) {
  return status.ranking.filter((id) =>
    status.variants.some(
      (v) => v.id === id && v.made && v.review?.status === 'pass' && !v.openFeedback.length,
    ),
  );
}
// Defects the copy author can fix; anything else is a real failure.
export class PublicationCopyError extends Error {}
export function publicationCopy(copy) {
  if (
    typeof copy?.title !== 'string' ||
    !copy.title.trim() ||
    typeof copy.description !== 'string' ||
    !copy.description.trim()
  )
    throw new PublicationCopyError('Publishing copy requires title and description');
  if (copy.privacy && copy.privacy !== 'unlisted') throw new PublicationCopyError('Rules-story publication is unlisted');
  if (copy.tags && (!Array.isArray(copy.tags) || copy.tags.some((t) => typeof t !== 'string')))
    throw new PublicationCopyError('tags must be strings');
  // Channel ID is obtained by the operator from Studio, never inferred from a display name.
  if (!/^UC[\w-]{22}$/.test(copy.channelId || ''))
    throw new PublicationCopyError('Approved publishing copy requires the exact abdupdates channelId');
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
    const fixed = await optional(path.join(job, 'review/thumbnail-fix.json'));
    const offered = passingThumbnails(s).length || !fixed ? passingThumbnails(s)
      : s.variants.filter((v) => v.made).map((v) => v.id);
    options = [
      ...offered.map((id) => ({ id, label: passingThumbnails(s).includes(id) ? id : `${id} (not passed review)` })),
      { id: 'revise', label: 'Revise thumbnails' },
      { id: 'reject', label: 'Stop' },
    ];
    binding = digest(s.variants.map((v) => [v.id, v.pngSha256, v.review, v.openFeedback]));
    artifact = path.join(job, 'thumbnail/variants');
  } else if (kind === 'publishing') {
    // Invalid copy goes back to the copy author (publishing-errors.json) on the next pass
    // instead of failing the workflow; nothing is asked of the operator until it is valid.
    let copy;
    try {
      copy = publicationCopy(await readJSON(path.join(dir, 'publishing.json')));
    } catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError) && !(error instanceof PublicationCopyError))
        throw error;
      await saveJSON(path.join(dir, 'archon/publishing-errors.json'), { version: 1, errors: [error.message] });
      return { kind, binding: 'invalid-copy', artifact: path.join(dir, 'publishing.json'), options: [],
        required: true, approved: false, needsAnswer: false, valid: false, errors: [error.message] };
    }
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
  const decision = answer?.decision;
  const allowed = current.options.length ? current.options.map(o => o.id) : ['approve', 'revise', 'reject', ...(kind === 'publishing' ? ['opt-out'] : [])];
  if (!allowed.includes(decision)) throw new Error('Invalid attention decision');
  if (answer.text != null && typeof answer.text !== 'string') throw new Error('Attention text must be a string');
  const text = answer.text || '';
  if (decision === 'revise' && !text.trim()) throw new Error('Revision requires the actual operator feedback');
  const record = {
    version: 1,
    source: 'archon-attention',
    kind,
    binding: current.binding,
    quote: text.trim() ? text : decision,
    quoteKind: text.trim() ? 'text' : 'decision',
    answerText: text,
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
    } else if (passingThumbnails(await thumbnailStatus(ctx.job)).includes(decision))
      await chooseThumbnail(ctx.job, { variant: decision, by: 'you' });
    else await acceptThumbnail(ctx.job, { variant: decision, by: 'you',
      reason: `Operator selected ${decision} after the one fix round without a passing review.` });
  }
  return { ...current, done: record.decision === 'approve' || record.decision === 'select', rejected: false };
}
export async function stageOperation(stage, ctx, opts) {
  const { dir, job, project, root } = ctx;
  if (stage === 'script-review-request') {
    const state = await stageOperation('script-status', ctx, opts);
    await saveJSON(path.join(dir, 'archon/script-review-request.json'), {
      binding: state.binding, runId: process.env.WORKFLOW_ID || null,
    });
    return state;
  }
  if (stage === 'research-status' || stage === 'research-check')
    return validateResearch(dir, project);
  if (stage === 'build-check') {
    const build = await optional(path.join(job, 'review/build.json'));
    if (!await buildUsable(job, build, await sourceFingerprint(job)))
      throw new Error('Build is unusable after its technical repair round; inspect review/build.json.');
    return { done: true, accepted: !build.ok };
  }
  if (stage === 'visual-review-status' || stage === 'visual-review-check') {
    const review = await reviewStatus(job, 'final');
    const { pack } = await loadReviewPack(job, 'final');
    return {
      done: review.reports.length === 1 && review.reports.every(report =>
        report.verdict !== 'incomplete' && report.inspection.visual === 'viewed' &&
        report.inspection.evidence?.length && covers(report.coverage, pack.interval)),
      errors: review.errors,
    };
  }
  if (stage === 'visual-evidence') return archiveVisualEvidence(job);
  if (stage === 'revision-complete') return recordVisualRevision(job);
  if (stage === 'audio-evidence') return audioEvidence(ctx);
  if (stage === 'audio-review') return reviewAudio(ctx, { final: opts.final === true });
  if (stage === 'technical-revision-complete') return recordTechnicalRevision(job);
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
  // A loop_group pass opens by recording the answer its previous pass paused for.
  // Archon resolves the previous pass's attention output to '' on the first pass
  // and whenever that pass did not need to ask, so there is nothing to record.
  if (stage === 'answer') {
    if (opts.answer == null) return { recorded: false, rejected: false };
    const result = await stageOperation('checkpoint', ctx, opts);
    return { ...result, recorded: true, rejected: Boolean(result.rejected) };
  }
  if (stage === 'script-status') {
    const a = await scriptAcceptance(dir, project);
    const { validation, binding, review, reviewed } = a;
    const feedback = await optional(path.join(dir, 'archon/script-decision.json'));
    const inputsExist = await hasAuthorOutputs(dir);
    const canRevise = !project.inputScript || feedback?.decision === 'revise';
    // Every flag is computed here so YAML gates on booleans instead of compound expressions.
    const needsContinuation = !a.done && reviewed && review.disposition !== 'pass';
    return {
      ready: a.done,
      mode: a.mode,
      ...validation,
      needsWrite: !inputsExist || (!validation.valid && !project.inputScript) ||
        Boolean(feedback?.binding === binding && feedback.decision === 'revise'),
      needsReview: !a.done && validation.valid && !reviewed,
      needsContinuation,
      needsFix: needsContinuation && canRevise,
      binding,
      supplied: !!project.inputScript,
      canRevise,
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
    const validation = await validateScript(dir, project);
    if (!validation.valid) {
      disposition = 'incomplete';
      findings = validation.errors.join('\n') + '\n' + findings;
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
    const a = await scriptAcceptance(dir, project);
    return { done: a.done, mode: a.mode, review: a.review, revision: a.revision };
  }
  // Runs after the review report. A non-passing review gets one fix (script-fix) and then
  // continues here without another review. Supplied or operator-approved scripts are
  // retained unchanged and continue with the findings disclosed.
  if (stage === 'script-continue') {
    const a = await scriptAcceptance(dir, project);
    if (a.done) return { done: true, mode: a.mode, recorded: false };
    if (!a.review || a.review.pass === true) return { done: false, recorded: false };
    const changed = a.review.binding !== a.binding;
    const receipt = await recordScriptRevision(ctx, {
      mode: changed ? 'revised-after-review' : 'retained-after-review',
      reason: `Independent script review returned ${a.review.disposition}; ${changed ? 'one fix round applied' : 'script retained'} without another review.`,
      priorBinding: a.review.binding,
    });
    return { done: true, mode: receipt.mode, recorded: true };
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
    const manifest = await readJSON(path.join(job, 'job.json'));
    if (manifest.reviewRoundPacks?.final !== review.packSha256) {
      manifest.reviewRounds = { ...manifest.reviewRounds, final: (manifest.reviewRounds?.final || 0) + 1 };
      manifest.reviewRoundPacks = { ...manifest.reviewRoundPacks, final: review.packSha256 };
      await saveJSON(path.join(job, 'job.json'), manifest);
    }
    const inspection = await stageOperation('visual-review-status', ctx, {});
    // No complete inspection after the review and its one retry: record the absence and
    // continue to the single revision instead of stopping the workflow.
    if (!inspection.done) {
      const reason = review.reports.length !== 1
        ? `no valid visual report was submitted (${(review.errors || []).join('; ') || 'missing report'})`
        : 'the submitted visual report was incomplete or did not cover the full interval';
      await recordUnavailableVisualReview(job, reason);
      await recordContinuation(job, { stage: 'visual-review', binding: review.packSha256, reason });
    }
    review = await reviewStatus(job, 'final');
    await saveJSON(path.join(job, 'review/archon-findings.json'), review);
    return { done: review.ok, inspected: inspection.done, review, budget: maxReviewRounds(manifest) };
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
    const fix = await optional(path.join(job, 'review/thumbnail-fix.json'));
    const reviewedSet = thumbnailReviewSet(status);
    const passing = passingThumbnails(status).length > 0;
    const fixApplied = fix?.reviewedSet === reviewedSet || fix?.afterSet === thumbnailCurrentSet(status);
    return {
      done:
        status.variants.every((v) => v.made && v.review && !v.openFeedback.length) && passing,
      // One fix round when no variant passed its review; afterwards selection continues.
      needsFix: !passing && status.variants.some((v) => v.made) && !fixApplied,
      // Fixed variants are not reviewed again.
      needsReview: !fixApplied && status.variants.some((v) => v.made && !v.review),
      fixApplied,
      reviewedSet,
      status,
    };
  }
  if (stage === 'thumbnail-fixed') {
    const before = await optional(path.join(job, 'review/thumbnail-fix-request.json'));
    const status = await thumbnailStatus(job);
    const receipt = { version: 1, reviewedSet: before?.reviewedSet ?? null, afterSet: thumbnailCurrentSet(status),
      recordedAt: new Date().toISOString() };
    await saveJSON(path.join(job, 'review/thumbnail-fix.json'), receipt);
    return receipt;
  }
  if (stage === 'thumbnail-fix-request') {
    const state = await stageOperation('thumbnail-status', ctx, {});
    await saveJSON(path.join(job, 'review/thumbnail-fix-request.json'), { version: 1, reviewedSet: state.reviewedSet });
    return state;
  }
  if (stage === 'thumbnail-select') {
    const state = await stageOperation('thumbnail-status', ctx, {});
    const g = await gate('thumbnail', ctx);
    const s = await thumbnailStatus(job);
    const pass = passingThumbnails(s);
    // Selectable once a variant passed, or once the one fix round has run.
    const selectable = pass.length > 0 || state.fixApplied;
    // Unmade variants and operator feedback start a new generate-review-fix pass.
    const needsGenerate = s.variants.some((v) => !v.made || v.openFeedback.some((f) => f.by === 'you'));
    if (!selectable || needsGenerate) return { done: false, selectable: selectable && !needsGenerate, needsGenerate, chosen: null };
    if (!s.chosen && !g.required) {
      if (pass.length) await chooseThumbnail(job, { variant: pass[0], by: 'reviewer' });
      else {
        // Continue after the fix round with the best finished variant, preferring the
        // reviewer's ranking and PNGs within YouTube's 2 MB limit.
        const made = s.variants.filter((v) => v.made);
        if (!made.length) throw new Error('No finished thumbnail variant exists after the fix round.');
        const order = [...s.ranking, ...made.map((v) => v.id)];
        const fits = made.filter((v) => !v.openFeedback.some((f) => f.by === 'technical'));
        const pick = order.find((id) => (fits.length ? fits : made).some((v) => v.id === id));
        const reason = 'No variant passed independent review after the one fix round.';
        await acceptThumbnail(job, { variant: pick, reason, by: 'archon' });
        await recordContinuation(job, { stage: 'thumbnail', binding: state.reviewedSet, reason, details: { variant: pick } });
      }
    }
    let chosen = (await thumbnailStatus(job)).chosen;
    if (
      chosen &&
      (await fileHash(path.join(job, 'thumbnail/thumbnail.png')).catch(() => null)) !== chosen.pngSha256
    ) {
      if (chosen.accepted) await acceptThumbnail(job, { variant: chosen.variant, reason: chosen.reason, by: chosen.by });
      else await chooseThumbnail(job, { variant: chosen.variant, by: chosen.by });
      chosen = (await thumbnailStatus(job)).chosen;
    }
    return { done: !!chosen && (!g.required || g.approved), selectable, needsGenerate: false, chosen };
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
      expectedChannelHandle: 'abdupdatesyt',
      journal: path.join(dir, 'archon/upload-session.json'),
    });
    const receipt = { id, url: `https://youtu.be/${id}`, binding: g.binding };
    await saveJSON(path.join(dir, 'archon/published.json'), receipt);
    return receipt;
  }
  return undefined;
}
