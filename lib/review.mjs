import {assertSpeechEvidence} from './speech.mjs';
import {buildUsable, listContinuations, continuationLimitations} from './acceptance.mjs';
import {readFile, writeFile, mkdir, readdir, lstat, realpath, rename, stat, open, unlink, copyFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';

export const MAX_REVIEW_ROUNDS = 1;
export const REVIEW_ROLES = ['visual-review'];
export const REVIEW_DEPTHS = ['fast', 'standard', 'deep'];
const DEPTH_POLICY = {
  fast: {maxRounds: 1, frameStep: 2},
  standard: {maxRounds: MAX_REVIEW_ROUNDS, frameStep: 1},
  deep: {maxRounds: 1, frameStep: 0.5},
};

export function parseReviewDepth(value) {
  const depth = value === undefined || value === null || value === '' ? 'standard' : String(value).trim();
  if (!REVIEW_DEPTHS.includes(depth)) throw new Error(`--review-depth is ${REVIEW_DEPTHS.join(', ')}.`);
  return depth;
}

/** Review density varies; every depth has one independent review and one revision. */
export function reviewPolicy(manifest = {}) {
  const depth = REVIEW_DEPTHS.includes(manifest.reviewDepth) ? manifest.reviewDepth : 'standard';
  return {depth, ...DEPTH_POLICY[depth]};
}

export const maxReviewRounds = manifest => reviewPolicy(manifest).maxRounds;
const stages = ['final'];
const sha = value => createHash('sha256').update(value).digest('hex');
const readJSON = async file => JSON.parse(await readFile(file, 'utf8'));
const present = value => typeof value === 'string' && value.trim().length > 0;
const hashPattern = /^[a-f0-9]{64}$/;
const inside = (root, target) => target.startsWith(root + path.sep);
const rangesCover = (ranges, start, end) => {
  let cursor = start;
  for (const range of [...ranges].filter(r => Number.isFinite(r.start) && Number.isFinite(r.end)).sort((a,b)=>a.start-b.start)) {
    if (range.start > cursor + 0.035) return false;
    cursor = Math.max(cursor, range.end);
    if (cursor >= end - 0.035) return true;
  }
  return cursor >= end - 0.035;
};
export async function writeReviewFile(job, relative, bytes) {
  const root = await realpath(job);
  if (!present(relative) || !relative.startsWith('review/') || relative.includes('\\') || relative.split('/').includes('..'))
    throw new Error(`Unsafe review output path: ${relative}`);
  const target = path.resolve(root,relative);
  let parent = root;
  for (const part of relative.split('/').slice(0,-1)) {
    parent = path.join(parent,part);
    try {await mkdir(parent);} catch (error) {if (error.code !== 'EEXIST') throw error;}
    if ((await lstat(parent)).isSymbolicLink() || await realpath(parent) !== parent) throw new Error('Symlinked review output is not allowed.');
  }
  try {if ((await lstat(target)).isSymbolicLink()) throw new Error('Symlinked review output is not allowed.');}
  catch (error) {if (error.code !== 'ENOENT') throw error;}
  const temporary = path.join(parent,`.review-${randomUUID()}.tmp`);
  await writeFile(temporary,bytes,{flag:'wx'});
  await rename(temporary,target);
}
const save = (job, relative, value) => writeReviewFile(job,relative,JSON.stringify(value,null,2) + '\n');

export async function fileHash(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export function reviewStage(stage) {
  if (!stages.includes(stage)) throw new Error('Review stage must be final.');
  return stage;
}

// Producer IDs are the runner-provided identity and role, recorded on the job
// before a producing role executes. The harness does not cryptographically
// authenticate these values; this records what the runner supplied.
export async function registerProducer(job, {agentId, role} = {}) {
  const file = path.join(job, 'job.json'), lock = path.join(job, '.producer-registry.lock');
  let handle;
  for (let attempt=0; attempt<500; attempt++) {
    try { handle = await open(lock, 'wx'); break; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        const owner = Number((await readFile(lock, 'utf8')).trim());
        if (Number.isInteger(owner) && owner > 0) {
          try { process.kill(owner, 0); }
          catch (probe) { if (probe.code === 'ESRCH') await unlink(lock); }
        } else if (Date.now() - (await stat(lock)).mtimeMs > 120000) await unlink(lock);
      } catch (cleanup) { if (cleanup.code !== 'ENOENT') throw cleanup; }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  if (!handle) throw new Error('Timed out recording producer identity; retry the production command.');
  try {
  await handle.writeFile(String(process.pid));
  const manifest = await readJSON(file);
  manifest.review ||= {};
  manifest.review.producerAgentIds ||= [];
  manifest.review.producerAgentRecords ||= [];
  if (!present(agentId) || !present(role) || role === 'reviewer' || role.endsWith('-reviewer')) {
    manifest.review.producerIdentityStatus = 'incomplete';
    manifest.review.producerIdentityIssue = 'A producing command ran without a runner-provided agent ID and role.';
  } else {
    if (!manifest.review.producerAgentIds.includes(agentId)) manifest.review.producerAgentIds.push(agentId);
    if (!manifest.review.producerAgentRecords.some(r => r.agentId === agentId && r.role === role))
      manifest.review.producerAgentRecords.push({agentId, role, recordedAt: new Date().toISOString(), source: 'VIDEO_AGENT_ID/VIDEO_AGENT_ROLE'});
    if (manifest.review.producerIdentityStatus !== 'incomplete') {
      manifest.review.producerIdentityStatus = 'recorded';
      delete manifest.review.producerIdentityIssue;
    }
  }
  await writeFile(file, JSON.stringify(manifest, null, 2) + '\n');
  } finally { await handle.close(); await unlink(lock).catch(() => {}); }
}

function producerIds(manifest) {
  const review = manifest.review || {};
  if (review.producerIdentityStatus === 'incomplete' || (review.producerIdentityStatus === 'unrecorded' && !review.producerAgentRecords?.length) || !Array.isArray(review.producerAgentIds) || !review.producerAgentIds.length ||
      (review.producerAgentIds.length === 1 && review.producerAgentIds[0] === '/root' && !review.producerAgentRecords?.length))
    throw new Error('Producer identities are incomplete for this existing job; independence cannot be established. Record the producing agents from reliable history before review.');
  return review.producerAgentIds;
}

// Review records and render caches are deliberately outside the source digest.
// Actual inputs, fonts, assets, code, cue files and project config are included.
export async function sourceFingerprint(job) {
  // Generated review, render, assignment and thumbnail artifacts do not change the film's sources.
  const excluded = new Set(['node_modules', '.git', '.hyperframes', '.cache', 'review', 'renders', 'library-candidates', 'briefs', 'thumbnail', 'index.cut.html']);
  const manifest=await readJSON(path.join(job,'job.json')).catch(error=>{if(error.code==='ENOENT')return {};throw error;});
  if(manifest.engine==='explainroo'){excluded.add('build');excluded.add('out');}
  const entries = [];
  async function walk(dir, prefix = '') {
    for (const entry of (await readdir(dir, {withFileTypes: true})).sort((a,b) => a.name.localeCompare(b.name))) {
      if (!prefix && excluded.has(entry.name)) continue;
      const rel = prefix + entry.name, file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Production sources must be frozen local files, not symlinks: ${rel}`);
      if (entry.isDirectory()) await walk(file, rel + '/');
      else if (entry.isFile()) {
        if (rel === 'job.json') {
          const {status, completedAt, delivery, reviewRounds, reviewRoundPacks, ...config} = await readJSON(file);
          entries.push([rel, sha(JSON.stringify(config))]);
        } else entries.push([rel, await fileHash(file)]);
      }
    }
  }
  await walk(job);
  return sha(JSON.stringify(entries));
}

export async function localFile(job, relative) {
  if (!present(relative) || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').includes('..'))
    throw new Error(`Unsafe review evidence path: ${relative}`);
  const root = await realpath(job), candidate = path.resolve(root, relative);
  if (!inside(root, candidate) || !inside(root, await realpath(candidate)) || !(await lstat(candidate)).isFile())
    throw new Error(`Review evidence must be a local file: ${relative}`);
  return candidate;
}

const validRange = (range, interval) => range && Number.isFinite(range.start) && Number.isFinite(range.end) &&
  range.start >= interval.start - 0.001 && range.end <= interval.end + 0.001 && range.end > range.start;

export function covers(ranges, interval) {
  let end = interval.start;
  for (const range of [...ranges].sort((a,b) => a.start - b.start)) {
    if (range.start > end + 0.05) return false;
    end = Math.max(end, range.end);
  }
  return end >= interval.end - 0.05;
}

export async function loadReviewPack(job, stage, {archivedPath, current = true} = {}) {
  reviewStage(stage);
  const relative = archivedPath || `review/${stage}/pack.json`;
  const file = await localFile(job, relative), bytes = await readFile(file);
  const pack = JSON.parse(bytes), manifest = await readJSON(path.join(job, 'job.json'));
  // An html pack is frozen from the built timeline before any render (videoSha256 null); older packs come from the MP4.
  const html = pack.source === 'html';
  if (pack.version !== 1 || pack.stage !== stage || !hashPattern.test(pack.sourceHash || '') ||
      (html ? pack.videoSha256 !== null : !hashPattern.test(pack.videoSha256 || '')) || !Number.isFinite(pack.duration) || pack.duration <= 0 ||
      Math.abs(pack.duration - manifest.duration) > 0.12 ||
      !validRange(pack.interval, {start:0, end:pack.duration})) throw new Error('Invalid review pack metadata.');
  if (pack.interval.start !== 0 || Math.abs(pack.interval.end - pack.duration) > 0.001)
    throw new Error('Final review must cover the entire recording.');
  if (!Array.isArray(pack.scenes) || !pack.scenes.length || pack.scenes.some(s => !present(s.id) || !validRange(s, pack.interval)) ||
      !covers(pack.scenes, pack.interval)) throw new Error('Review scene coverage is incomplete.');
  if (!Array.isArray(pack.evidence) || !pack.evidence.length) throw new Error('Review pack has no rendered evidence.');
  const paths = new Set();
  for (const item of pack.evidence) {
    if (!['frames','contact-sheet','clip','audio','verification','motion','checks','sound'].includes(item.kind) || paths.has(item.path) || !hashPattern.test(item.sha256 || '') ||
        !Number.isFinite(item.start) || !Number.isFinite(item.end) || item.start < 0 || item.end < item.start || item.end > pack.duration + 0.12)
      throw new Error('Invalid or duplicate rendered evidence.');
    paths.add(item.path);
    if (await fileHash(await localFile(job, item.path)) !== item.sha256) throw new Error(`Review evidence changed: ${item.path}`);
  }
  for (const kind of ['frames', 'contact-sheet', 'audio', ...(html ? [] : ['clip'])])
    if (!pack.evidence.some(e => e.kind === kind)) throw new Error(`Review pack missing ${kind} evidence.`);
  if (!html && !covers(pack.evidence.filter(e => e.kind === 'clip'), pack.interval)) throw new Error('Review clips do not cover the interval.');
  const revision = await readJSON(path.join(job, 'review/visual-revision.json')).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
  const revised = revision && revision.packSha256 === sha(bytes) &&
    revision.reviewedSourceHash === pack.sourceHash && revision.sourceHash === await sourceFingerprint(job) &&
    revision.reportHash === await fileHash(path.join(job, 'review/final/reviews/visual-review.json')) &&
    revision.notesHash === await fileHash(path.join(job, 'review/revision-notes.md'));
  if (current && revised && html) return {pack, packSha256:sha(bytes), relative};
  if (current && html) {
    if (pack.sourceHash !== await sourceFingerprint(job)) throw new Error('Review pack is stale: production sources changed. Build and review again.');
  } else if (current) {
    if (pack.sourceHash !== await sourceFingerprint(job)) throw new Error('Review pack is stale: production sources changed. Render and review again.');
    if (pack.videoSha256 !== await fileHash(await localFile(job, 'renders/video.mp4'))) throw new Error('Review pack is stale: render changed.');
    const receipt = await readJSON(await localFile(job, 'review/render-source.json'));
    if (receipt.version !== 1 || receipt.sourceHash !== pack.sourceHash || receipt.videoSha256 !== pack.videoSha256)
      throw new Error('Render provenance is missing or stale. Render through the pipeline again.');
  }
  return {pack, packSha256:sha(bytes), relative};
}

// Every problem in one pass, each with the field it concerns, so a reviewer fixes the report in one edit.
export function validateReview(report, context, producerIds = ['/root']) {
  const {pack, packSha256} = context;
  const errors = [];
  const fail = (field, message) => errors.push(`${field}: ${message}`);
  if (report.version !== 1 || report.stage !== pack.stage || !REVIEW_ROLES.includes(report.role))
    fail('version/stage/role', `Invalid reviewer role or stage (expected version 1, stage "${pack.stage}", role one of ${REVIEW_ROLES.join(', ')}).`);
  if (report.sourceHash !== pack.sourceHash || report.videoSha256 !== pack.videoSha256 || report.packSha256 !== packSha256)
    fail('sourceHash/videoSha256/packSha256', 'Reviewer report refers to a different source, render or evidence pack. Run review-template again for the current pack.');
  if (!present(report.reviewer?.agentId) || report.reviewer.independent !== true ||
      [...producerIds, 'root', '/root', 'orchestrator'].includes(report.reviewer.agentId))
    fail('reviewer', 'Review must come from an independent sub-agent, not the producer (set reviewer.agentId to your own id and reviewer.independent to true).');
  const inspection = report.inspection && typeof report.inspection === 'object' ? report.inspection : {};
  if (!['frame-sequence','playback','mixed'].includes(inspection.mode))
    fail('inspection.mode', 'Record the actual inspection mode and limitations: frame-sequence, playback or mixed.');
  const limitations = Array.isArray(inspection.limitations) ? inspection.limitations : null;
  if (!limitations || limitations.some(v => !present(v)))
    fail('inspection.limitations', 'Record the actual inspection mode and limitations as a list of non-empty strings.');
  else if (inspection.mode === 'frame-sequence' && !limitations.length)
    fail('inspection.limitations', 'Frame-sequence inspection must disclose the playback limitation.');
  if (report.role === 'visual-review' && !present(report.initialObservation))
    fail('initialObservation', 'Visual reviewer must record what the pictures explained before reading the narrative.');
  const coverage = Array.isArray(report.coverage) ? report.coverage : null;
  if (!coverage) fail('coverage', 'Invalid reviewer coverage: give a list of {start, end} ranges you inspected.');
  else coverage.forEach((r, i) => { if (!validRange(r, pack.interval)) fail(`coverage[${i}]`, `Invalid reviewer coverage: start/end must be numbers within ${pack.interval.start}–${pack.interval.end} s.`); });
  if (!['pass','revise','incomplete'].includes(report.verdict)) fail('verdict', 'Invalid review findings or verdict: verdict must be pass, revise or incomplete.');
  if (!['viewed', 'unavailable'].includes(inspection.visual))
    fail('inspection.visual', 'Record inspection.visual as viewed or unavailable; a motion transcript is not visual inspection.');
  const visualPaths = new Set(pack.evidence.filter(e => ['frames', 'clip', 'contact-sheet'].includes(e.kind)).map(e => e.path));
  if (report.verdict === 'pass' && (inspection.visual !== 'viewed' ||
      !Array.isArray(inspection.evidence) || !inspection.evidence.length ||
      inspection.evidence.some(p => !visualPaths.has(p))))
    fail('inspection.evidence', `A passing review requires viewed images/video and inspected evidence paths from this pack${Array.isArray(inspection.evidence) ? ` (not in the pack: ${inspection.evidence.filter(p => !visualPaths.has(p)).join(', ') || 'none'})` : ''}.`);
  const findings = Array.isArray(report.findings) ? report.findings : null;
  if (!findings) fail('findings', 'Invalid review findings or verdict: findings must be a list (empty when there are none).');
  const ids = new Set(), knownEvidence = new Set(pack.evidence.map(e => e.path));
  for (const [i, finding] of (findings || []).entries()) {
    const at = `findings[${i}]${present(finding?.id) ? ` (${finding.id})` : ''}`;
    if (!finding || typeof finding !== 'object') { fail(at, 'Each finding must be an object.'); continue; }
    if (finding.category != null && !['readability','truth','mechanism','style','evidence'].includes(finding.category)) fail(`${at}.category`, 'Finding category must be readability, truth, mechanism, style or evidence.');
    if (finding.scope != null && !['scene','plan','evidence'].includes(finding.scope)) fail(`${at}.scope`, 'Finding scope must be scene, plan or evidence.');
    if (finding.sceneIds != null && (!Array.isArray(finding.sceneIds) || finding.sceneIds.some(id=>typeof id!=='string'||!/^[a-z][a-z0-9-]*$/.test(id)))) fail(`${at}.sceneIds`, 'Finding sceneIds must be scene identifiers.');
    const problems = [];
    if (!present(finding.id)) problems.push('id is missing');
    else if (ids.has(finding.id)) problems.push(`id "${finding.id}" is used twice`);
    if (!['blocking','advisory'].includes(finding.severity)) problems.push('severity must be blocking or advisory');
    if (!Number.isFinite(finding.start) || !Number.isFinite(finding.end) || finding.start < pack.interval.start ||
        finding.end < finding.start || finding.end > pack.interval.end) problems.push(`start/end must be numbers within ${pack.interval.start}–${pack.interval.end} s`);
    const empty = ['subject','requirement','observed','repair'].filter(k => !present(finding[k]));
    if (empty.length) problems.push(`${empty.join(', ')} must be filled in`);
    if (!Array.isArray(finding.evidence) || !finding.evidence.length) problems.push('evidence must list pack paths');
    else { const unknown = finding.evidence.filter(p => !knownEvidence.has(p)); if (unknown.length) problems.push(`evidence not in the pack: ${unknown.join(', ')}`); }
    if (problems.length) fail(at, `Each finding needs a unique ID, timestamp, observed defect, evidence and repair direction (${problems.join('; ')}).`);
    if (present(finding.id)) ids.add(finding.id);
  }
  if (report.verdict === 'pass' && ((findings || []).some(f => f?.severity === 'blocking') || !coverage || !covers(coverage, pack.interval)))
    fail('verdict', 'A passing review needs full coverage, no blocking findings.');
  if (errors.length) throw new Error(errors.length === 1 ? errors[0] : `The report has ${errors.length} problems; fix them all, then submit again:\n- ${errors.join('\n- ')}`);
  return report;
}

export function isReadabilityBlocker(finding) {
  return finding.severity === 'blocking' && (finding.category === 'readability' ||
    /overlap|obscur|unreadab|illegib|occlud|collid|cut.off|cropp|hidden.{0,20}(text|label|number)/i.test(`${finding.subject || ''} ${finding.observed || ''}`));
}

async function evaluate(job, context, directory) {
  const manifest = await readJSON(path.join(job, 'job.json'));
  const reports = [], errors = [];
  let producers;
  try { producers = producerIds(manifest); }
  catch (error) { return {ok:false, independentPassed:false, continued:false, nonWaivableFindings:[], waiver:null,
    disposition:'pending', stage:context.pack.stage, sourceHash:context.pack.sourceHash,
    videoSha256:context.pack.videoSha256, packSha256:context.packSha256, errors:[error.message], reports}; }
  for (const role of REVIEW_ROLES) {
    try {
      const saved = await readJSON(await localFile(job, `${directory}/${role}.json`));
      const report = validateReview(saved, context, producers);
      if (report.role !== role) throw new Error('Reviewer role does not match its file.');
      reports.push(report);
      if (report.verdict !== 'pass') errors.push(`${role}: ${report.verdict}`);
    } catch (error) {errors.push(`${role}: ${error.message}`);}
  }
  if (new Set(reports.map(r => r.reviewer.agentId)).size !== reports.length) errors.push('Each role needs a different independent reviewer.');
  // The original inspection is retained after the single author revision.
  // A revised result is not a second independent pass. Missing or stale evidence still blocks.
  const independentPassed = !errors.length;
  const complete = reports.length === 1 && reports.every(r => r.verdict !== 'incomplete' &&
    r.inspection.visual === 'viewed' && r.inspection.evidence?.length && covers(r.coverage, context.pack.interval));
  // Policy: one review, one revision, then continue. When the reviewer could not produce a
  // complete inspection, the review-join node records that absence instead of stopping.
  const unavailable = complete ? null : await optionalJSON(path.join(job, 'review/visual-review-unavailable.json'));
  const inspected = complete || unavailable?.packSha256 === context.packSha256;
  const revision = await optionalJSON(path.join(job, 'review/visual-revision.json'));
  const currentSourceHash = await sourceFingerprint(job);
  // A technical repair after final verification may change sources once more without
  // another creative review; it chains from the revised sources.
  const technical = await optionalJSON(path.join(job, 'review/technical-revision.json'));
  const sourcesCurrent = revision?.sourceHash === currentSourceHash ||
    (technical?.fromSourceHash === revision?.sourceHash && technical?.sourceHash === currentSourceHash);
  const reportFile = path.join(job, 'review/final/reviews/visual-review.json');
  const reportHash = await fileHash(reportFile).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
  const revised = inspected && revision?.packSha256 === context.packSha256 &&
    revision.reviewedSourceHash === context.pack.sourceHash && sourcesCurrent &&
    revision.reportHash === reportHash &&
    revision.notesHash === await fileHash(path.join(job, 'review/revision-notes.md'));
  const limitations = !revised ? [] : [
    complete ? 'One independent visual review followed by one author revision; the revised film was not reviewed again. Original findings remain in the delivery record.'
      : `No complete independent visual inspection was available (${unavailable.reason}); the film was revised once without one and was not reviewed again.`,
    ...(technical?.sourceHash === currentSourceHash ? ['One technical repair after final verification changed sources without another creative review.'] : []),
  ];
  return {ok: Boolean(revised), independentPassed: independentPassed && currentSourceHash === context.pack.sourceHash, continued: Boolean(revised), nonWaivableFindings: [],
    disposition: revised ? (complete ? 'reviewed-and-revised' : 'revised-without-review') : 'pending-revision',
    stage:context.pack.stage, sourceHash:revised ? currentSourceHash : context.pack.sourceHash,
    reviewedSourceHash:context.pack.sourceHash, videoSha256:context.pack.videoSha256,
    packSha256:context.packSha256, errors:revised ? [] : errors, reports, limitations};
}
const optionalJSON = file => readJSON(file).catch(e => { if (e.code === 'ENOENT') return null; throw e; });

export async function submitReview(job, report) {
  reviewStage(report.stage);
  const context = await loadReviewPack(job, report.stage);
  const manifest = await readJSON(path.join(job, 'job.json'));
  validateReview(report, context, manifest.review?.producerAgentIds || ['/root']);
  const history = await reviewHistory(job, report.stage);
  const previous = history.filter(r => r.role === report.role && r.sourceHash !== report.sourceHash).at(-1);
  for (const finding of previous?.findings.filter(f => f.severity === 'blocking') || []) {
    const response = report.priorFindingResponses?.find(r => r.sourceHash === previous.sourceHash && r.findingId === finding.id);
    if (!response || !['resolved','unresolved','disputed'].includes(response.disposition) ||
        !present(response.reason) || response.reason.includes('FILL-IN'))
      throw new Error(`Respond to prior blocking finding ${finding.id} in priorFindingResponses with sourceHash, findingId, disposition and evidence-based reason.`);
  }
  const relative = `review/${report.stage}/reviews/${report.role}.json`;
  await save(job, relative, report);
  // Preserve failures and revisions, even when a newer role report replaces one.
  const reportHash = sha(JSON.stringify(report));
  await save(job, `review/${report.stage}/history/${reportHash}.json`, report);
  const status = await reviewStatus(job, report.stage);
  return {accepted:true, path:relative, qualified:status.ok, errors:status.errors};
}

export async function reviewStatus(job, stage) {
  reviewStage(stage);
  let context;
  try {context = await loadReviewPack(job, stage);}
  catch (error) {return {ok:false,stage,errors:[error.message],reports:[]};}
  return evaluate(job, context, `review/${stage}/reviews`);
}

// The same evaluation as reviewStatus, without any acceptance side effect. Used by `status`.
export async function reviewProgress(job, stage) {
  reviewStage(stage);
  let context;
  try {context = await loadReviewPack(job, stage);}
  catch (error) {return {ok:false, stage, pack:false, missing:error.code === 'ENOENT', errors:[error.message], reports:[]};}
  return {...await evaluate(job, context, `review/${stage}/reviews`), pack:true, interval:context.pack.interval};
}

export async function qualifyDelivery(job) {
  const final = await reviewStatus(job,'final');
  if (!final.ok) throw new Error(`Independent final review failed: ${final.errors.join('; ')}`);
  // Reviews of the built HTML qualify the render made from exactly those sources.
  let videoSha256 = final.videoSha256;
  if (videoSha256 === null) {
    const receipt = await localFile(job,'review/render-source.json').then(readJSON).catch(() => null);
    if (!receipt || receipt.version !== 1 || receipt.sourceHash !== final.sourceHash)
      throw new Error('The final render is missing or was not made from the reviewed sources. Render again.');
    videoSha256 = await fileHash(await localFile(job,'renders/video.mp4'));
    if (receipt.videoSha256 !== videoSha256) throw new Error('The final render changed after it was made. Render again.');
  }
  const technical = await readJSON(await localFile(job,'review/render-verification.json'));
  if ((technical.ok !== true && technical.accepted !== true) || technical.sha256 !== videoSha256) throw new Error('Final technical verification is missing or stale.');
  if (technical.narrationIntegrity?.ok !== true)
    throw new Error('The rendered narration does not match the reviewed recording (render-verification.json).');
  await assertSpeechEvidence(job);
  const report = await readFile(await localFile(job,'review/REPORT.md'),'utf8');
  if (!report.trim() || /pending creative build and validation/i.test(report)) throw new Error('Complete the production report before delivery.');
  return {version:1,ok:true,sourceHash:final.sourceHash, reviewedSourceHash:final.reviewedSourceHash, revisionNotes:"review/revision-notes.md", videoSha256,
    packSha256:final.packSha256,
    reviewerIds:final.reports.map(r => r.reviewer.agentId),
    automatedSpeech: await Promise.all(['narration','final-mix'].map(async stage => { const r = await readJSON(path.join(job,`review/speech-${stage}.json`)); return {stage,matchRate:r.matchRate,warnings:r.warnings,limitations:r.limitations}; })),
    limitations:[...final.reports.flatMap(r => r.inspection.limitations), ...(final.limitations || []),
      ...(technical.limitations || []), ...continuationLimitations(await listContinuations(job))],
    continuations: await listContinuations(job),
    independentReviewPassed:final.independentPassed,
    reviewDisposition:final.disposition,
    unresolvedFindings:final.reports.flatMap(r => r.findings.filter(f => f.severity === 'blocking').map(f => ({...f, stage:r.stage, role:r.role}))),
    advisoryFindings:final.reports.flatMap(r => r.findings.filter(f => f.severity === 'advisory'))};
}

// Carry prior decisions into fresh reviewers without replacing their inspection.
export async function reviewHistory(job, stage) {
  const directory = path.join(job, `review/${stage}/history`);
  const files = await readdir(directory).catch(() => []);
  const entries = await Promise.all(files.filter(f => f.endsWith('.json')).map(async file => {
    const report = await readJSON(path.join(directory, file));
    const {mtimeMs} = await stat(path.join(directory, file));
    return {report, mtimeMs};
  }));
  const latest = new Map();
  for (const {report} of entries.sort((a,b) => a.mtimeMs - b.mtimeMs)) {
    latest.set(`${report.sourceHash}:${report.role}`, report);
  }
  return [...latest.values()].map(r => ({sourceHash:r.sourceHash, role:r.role, verdict:r.verdict,
    findings:r.findings, priorFindingResponses:r.priorFindingResponses || []}));
}

// Human review: the person who asked for the film watches the built HTML and approves it or leaves notes at moments in
// it. A decision belongs to one review pack (the exact sources the reviewers saw); a newer build needs a new decision.
// Notes go to the scenes they point at as repair findings, word for word: nobody paraphrases them.

export const HUMAN_STAGES = ['final'];
const humanJson = async file => JSON.parse(await readFile(file, 'utf8'));

// "12.5: text", "12.5-14: text" or plain text (about the whole stretch).
export function parseNote(value) {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(?:[-–]\s*(\d+(?:\.\d+)?))?\s*s?\s*:\s*([\s\S]+)$/.exec(String(value));
  return m ? {start: Number(m[1]), end: m[2] ? Number(m[2]) : Number(m[1]), text: m[3].trim()} : {text: String(value).trim()};
}

/** Record the person's decision on the current review pack of a stage. */
export async function recordHumanReview(job, {stage, decision, notes = []}) {
  if (!HUMAN_STAGES.includes(stage)) throw new Error(`Stage must be ${HUMAN_STAGES.join(' or ')}.`);
  if (!['approve', 'revise'].includes(decision)) throw new Error('Decision must be approve or revise.');
  const {pack, packSha256} = await loadReviewPack(job, stage);
  const timing = await humanJson(path.join(job, 'timing.json')), missing = new Set(timing.missing || []), clean = [];
  for (const [i, note] of notes.entries()) {
    const text = String(note?.text ?? '').trim();
    if (!text) throw new Error(`Note ${i + 1} is empty.`);
    let start = note.start ?? null, end = note.end ?? note.start ?? null;
    if (start != null && (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || end > pack.duration + 0.05))
      throw new Error(`Note ${i + 1} has an invalid time (0–${pack.duration.toFixed(1)} s).`);
    // The player shows the whole film; a note keeps its own moment. Scenes that are not built yet have nothing to repair.
    const at = start == null ? [] : timing.scenes.filter(s => s.start <= end && s.end > start);
    const unbuilt = at.filter(s => missing.has(s.id));
    if (unbuilt.length && unbuilt.length === at.length) throw new Error(`Note ${i + 1} is about "${unbuilt[0].id}", which is not built yet.`);
    const sceneIds = Array.isArray(note.sceneIds) ? note.sceneIds.filter(id => typeof id === 'string' && /^[a-z][a-z0-9-]*$/.test(id)) : [];
    clean.push({start, end, sceneIds, text: text.slice(0, 4000)});
  }
  if (decision === 'revise' && !clean.length) throw new Error('Say what should change: give at least one note.');
  const record = {version: 1, stage, decision, sourceHash: pack.sourceHash, packSha256, notes: clean, decidedAt: new Date().toISOString()};
  await writeReviewFile(job, `review/human/${stage}.json`, JSON.stringify(record, null, 2) + '\n');
  return record;
}

/** The person's decision on the current pack, or null when none was made for it. */
export async function humanDecision(job, stage, packSha256) {
  const record = await humanJson(path.join(job, `review/human/${stage}.json`)).catch(() => null);
  return record && record.version === 1 && record.packSha256 === packSha256 ? record : null;
}

/** Notes as repair findings, each tied to its moment (or to every scene in the reviewed stretch). */

export async function archiveVisualEvidence(job) {
  const context = await loadReviewPack(job, 'final');
  const {pack, packSha256} = context;
  // Resuming after inspection/revision must not nest a new archive and change
  // the pack hash that the independent report and revision receipt bind.
  if (pack.evidence.every(item => /^review\/original-evidence\/[a-f0-9]{64}\//.test(item.path)))
    return context;
  const evidence = [];
  for (const [index, item] of pack.evidence.entries()) {
    const relative = `review/original-evidence/${packSha256}/${index}-${path.basename(item.path)}`;
    const target = path.join(job, relative);
    await mkdir(path.dirname(target), {recursive:true});
    await copyFile(await localFile(job, item.path), target);
    evidence.push({...item, path:relative});
  }
  await save(job, 'review/final/pack.json', {...pack, evidence});
  return loadReviewPack(job, 'final');
}
export async function recordVisualRevision(job) {
  const context = await loadReviewPack(job, 'final', {current:false});
  const manifest = await readJSON(path.join(job, 'job.json'));
  const reportFile = path.join(job, 'review/final/reviews/visual-review.json');
  const unavailable = await optionalJSON(path.join(job, 'review/visual-review-unavailable.json'));
  if (unavailable?.packSha256 !== context.packSha256) {
    const report = validateReview(await readJSON(reportFile), context, producerIds(manifest));
    if (report.verdict === 'incomplete' || report.inspection.visual !== 'viewed' || !report.inspection.evidence?.length || !covers(report.coverage, context.pack.interval))
      throw new Error('One complete independent visual inspection, or a recorded unavailable inspection, required before revision');
  }
  const sourceHash = await sourceFingerprint(job);
  const build = await readJSON(path.join(job, 'review/build.json'));
  if (!await buildUsable(job, build, sourceHash)) throw new Error('Current usable revision build required');
  const notesFile = path.join(job, 'review/revision-notes.md');
  const notes = await readFile(notesFile, 'utf8').catch(e => { if (e.code === 'ENOENT') return ''; throw e; });
  // The revision author owns these notes. A missing file is disclosed, not invented.
  if (!notes.trim()) await save(job, 'review/revision-notes.md',
    'Automatically recorded: the revision node left no revision notes. Any changes are visible only in the project sources.\n');
  const receipt = {version:1, packSha256:context.packSha256, reviewedSourceHash:context.pack.sourceHash,
    sourceHash, reportHash:await fileHash(reportFile).catch(e => { if (e.code === 'ENOENT') return null; throw e; }),
    notesHash:await fileHash(notesFile), revisedAt:new Date().toISOString()};
  await save(job, 'review/visual-revision.json', receipt);
  return receipt;
}

// Records that the review could not be completed for the current pack, so production can
// continue to its one revision instead of stopping. Never a pass.
export async function recordUnavailableVisualReview(job, reason) {
  const context = await loadReviewPack(job, 'final', {current:false});
  const receipt = {version:1, packSha256:context.packSha256, reason, recordedAt:new Date().toISOString()};
  await save(job, 'review/visual-review-unavailable.json', receipt);
  return receipt;
}

// Binds a post-verification technical repair to the sources the visual revision produced.
export async function recordTechnicalRevision(job) {
  const revision = await readJSON(path.join(job, 'review/visual-revision.json'));
  const sourceHash = await sourceFingerprint(job);
  const build = await readJSON(path.join(job, 'review/build.json'));
  if (!await buildUsable(job, build, sourceHash)) throw new Error('Current usable technical-repair build required');
  const receipt = {version:1, fromSourceHash:revision.sourceHash, sourceHash, revisedAt:new Date().toISOString()};
  await save(job, 'review/technical-revision.json', receipt);
  return receipt;
}
