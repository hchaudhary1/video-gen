#!/usr/bin/env node
import { readFile, writeFile, mkdir, copyFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { extractNarration, normalizeWords, reconcile } from '../../lib/timing.mjs';
import { fileHash, writeReviewFile, localFile, parseReviewDepth } from '../../lib/review.mjs';
import { verifySpeech, ASR_MODEL } from '../../lib/speech.mjs';
import { compareNarration } from '../../lib/audio.mjs';
import { findVisualPlan, VISUALS_FILE } from '../../lib/timing.mjs';
import { loadConfig, resolveSettings } from '../../lib/media.mjs';
import { preparationPersonality, freezePersonality, assertRenderReady } from '../../lib/personalities.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const HF = path.join(ROOT, 'node_modules/hyperframes/bin/hyperframes.mjs');
const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
const save = (file, data) => writeFile(file, JSON.stringify(data, null, 2) + '\n');
const exists = async (file) => {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
};
const digest = async (file) =>
  createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
function run(command, args, { cwd = ROOT, capture = false, env = {}, forwardSignals = false } = {}) {
  return new Promise((resolve, reject) => {
    // Some CLI naming uses PWD rather than process.cwd(). Keep both consistent
    // when npm invokes the job from the repository root.
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, PWD: cwd, ...env },
      stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    });
    const stop = (signal) => child.kill(signal);
    const term = () => stop('SIGTERM'),
      interrupt = () => stop('SIGINT');
    if (forwardSignals) {
      process.on('SIGTERM', term);
      process.on('SIGINT', interrupt);
      const cleanup = () => {
        process.off('SIGTERM', term);
        process.off('SIGINT', interrupt);
      };
      child.once('close', cleanup);
      child.once('error', cleanup);
    }
    let output = '';
    if (capture)
      child.stdout.on('data', (chunk) => {
        output += chunk;
      });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve(output) : reject(new Error(`${command} exited ${code}`)),
    );
  });
}
const hf = (args, opts) => run(process.execPath, [HF, ...args], opts);
const probe = async (file) =>
  JSON.parse(
    await run('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file], {
      capture: true,
    }),
  );

async function savedProducerHistory() {
  const agentId = process.env.VIDEO_AGENT_ID,
    role = process.env.VIDEO_AGENT_ROLE;
  return agentId && role && role !== 'reviewer' && !role.endsWith('-reviewer')
    ? [{ agentId, role, source: 'VIDEO_AGENT_ID/VIDEO_AGENT_ROLE' }]
    : [];
}
export async function prepare(opts) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(opts.name || '')) throw new Error('--name must be a lowercase job slug.');
  if (!opts.audio || !opts.script) throw new Error('prepare requires --audio and --script.');
  const reviewDepth = parseReviewDepth(opts['review-depth']);
  const job = path.join(ROOT, 'jobs', opts.name);
  if (await exists(job))
    throw new Error(`Job exists: ${job}. Use a new --name; existing work is never overwritten.`);
  const audio = path.resolve(ROOT, opts.audio),
    script = path.resolve(ROOT, opts.script);
  const [metadata, sourceScript] = await Promise.all([probe(audio), readFile(script, 'utf8')]);
  const personality = preparationPersonality(path.dirname(script), sourceScript, opts.profile);
  assertRenderReady(personality);
  const config = await loadConfig(ROOT),
    settings = resolveSettings(opts, config, Number(metadata.format.duration));
  const { start, duration, format, fps } = settings;
  for (const w of settings.warnings) console.warn(`Warning: ${w}`);
  const language = opts.language || 'en',
    model = ASR_MODEL,
    engine = 'parakeet-v2';
  if (language !== 'en' || (opts.engine && opts.engine !== engine) || (opts.model && opts.model !== model))
    throw new Error('ASR requires English Parakeet v2; no fallback.');
  await mkdir(path.dirname(job), { recursive: true });
  await hf(['init', job, '--non-interactive', '--resolution', format === 'vertical' ? 'portrait' : format], {
    capture: true,
    env: { HYPERFRAMES_SKIP_SKILLS: '1' },
  });
  for (const f of ['AGENTS.md', 'CLAUDE.md'])
    await writeFile(
      path.join(job, f),
      'Production is scheduled by Archon. Follow the rules-story workflow; never run next.\n',
    );
  for (const dir of ['inputs', 'assets', 'compositions', 'review', 'renders', 'shots', 'components'])
    await mkdir(path.join(job, dir), { recursive: true });
  const productionProfile = await freezePersonality(job, personality);

  await writeFile(path.join(job, 'inputs/source-script.md'), sourceScript);
  const sourceBrief = opts['brief-file']
    ? path.resolve(ROOT, opts['brief-file'])
    : path.join(path.dirname(script), 'BRIEF.md');
  const hasBrief = await exists(sourceBrief);
  if (hasBrief) await copyFile(sourceBrief, path.join(job, 'inputs/brief.md'));
  // The writer's visual intent travels with the approved script.
  const visuals = opts.visuals ? path.resolve(ROOT, opts.visuals) : await findVisualPlan(script);
  if (visuals) await copyFile(visuals, path.join(job, VISUALS_FILE));
  const narration = extractNarration(sourceScript);
  await writeFile(path.join(job, 'inputs/narration.txt'), narration);
  await run('ffmpeg', [
    '-v',
    'error',
    '-i',
    audio,
    '-ss',
    String(start),
    '-t',
    String(duration),
    '-vn',
    '-ar',
    '48000',
    '-ac',
    '1',
    '-c:a',
    'pcm_s16le',
    path.join(job, 'assets/narration.wav'),
  ]);
  const actualDuration = Number((await probe(path.join(job, 'assets/narration.wav'))).format.duration);
  const producerHistory = await savedProducerHistory(script);
  const manifest = {
    version: 1,
    name: opts.name,
    createdAt: new Date().toISOString(),
    duration: actualDuration,
    format,
    width: settings.width,
    height: settings.height,
    fps,
    audio: {
      path: 'assets/narration.wav',
      source: path.relative(ROOT, audio),
      sourceStart: start,
      sourceSha256: await digest(audio),
      sha256: await digest(path.join(job, 'assets/narration.wav')),
    },
    ...(hasBrief ? { brief: { path: 'inputs/brief.md', source: path.relative(ROOT, sourceBrief) } } : {}),
    script: {
      path: 'inputs/source-script.md',
      source: path.relative(ROOT, script),
      sha256: await digest(script),
      fullScript: opts['full-script'] === 'true' || (await exists(audio + '.speech.json')),
    },
    ...(visuals
      ? {
          visuals: {
            path: VISUALS_FILE,
            source: path.relative(ROOT, visuals),
            sha256: await digest(visuals),
          },
        }
      : {}),
    transcription: { language, model, engine, suppliedWords: !!opts.words },
    productionProfile,
    reviewDepth,
    creativeMode: 'agent-discretion',
    workflow: personality.profile.workflow,
    status: 'awaiting-transcription',
    review: {
      producerAgentIds: [...new Set(producerHistory.map((r) => r.agentId))],
      producerAgentRecords: producerHistory,
      producerIdentityStatus: producerHistory.length ? 'recorded' : 'unrecorded',
      ...(producerHistory.length
        ? {}
        : { producerIdentityIssue: 'No runner-provided producer identity has been recorded yet.' }),
      requiredRoles: ['visual-mechanism', 'continuity-legibility'],
    },
    canvas: '#151915',
  };
  await save(path.join(job, 'job.json'), manifest);
  if (opts.words)
    await copyFile(path.resolve(ROOT, opts.words), path.join(job, 'inputs/supplied-words.json'));
}
export async function finishPreparation(job, manifest, narration, {} = {}) {
  const actualDuration = manifest.duration;
  const speech = await verifySpeech({
    audio: path.join(job, 'assets/narration.wav'),
    script: narration,
    duration: actualDuration,
    output: path.join(job, 'review/speech-narration.json'),
    fullScript: Boolean(manifest.script?.fullScript),
    language: manifest.transcription.language,
  });
  if (!speech.ok)
    throw new Error('Narration speech verification failed; inspect review/speech-narration.json.');
  await save(path.join(job, 'transcript.json'), speech.transcript);
  const words = normalizeWords(speech.transcript, actualDuration);
  const alignment = reconcile(words, narration, { fullScript: manifest.script?.fullScript });
  await save(path.join(job, 'alignment.json'), alignment);
  await writeFile(
    path.join(job, 'SCRIPT.md'),
    `# Recorded excerpt\n\n${words.map((w) => w.text).join(' ')}\n`,
  );
  await writeFile(
    path.join(job, 'review/REPORT.md'),
    '# Production review\n\nPending creative build and validation.\n',
  );
  manifest.status = 'prepared';
  await save(path.join(job, 'job.json'), manifest);

  console.log(
    `Prepared ${path.relative(ROOT, job)}: ${words.length} words, ${(alignment.matchRatio * 100).toFixed(1)}% exact ${alignment.fullScript ? 'full-script' : 'excerpt'} matches; ${(alignment.scriptCoverage * 100).toFixed(1)}% script coverage.`,
  );
}
export async function verify(job) {
  const manifest = await json(path.join(job, 'job.json')),
    file = await localFile(job, 'renders/video.mp4');
  const metadata = await probe(file),
    video = metadata.streams.find((s) => s.codec_type === 'video');
  const audio = metadata.streams.find((s) => s.codec_type === 'audio');
  if (!video || !audio || Number(metadata.format.size) < 1000)
    throw new Error('Output must contain video and audio streams.');
  if (
    Math.abs(Number(metadata.format.duration) - manifest.duration) > 0.12 ||
    video.width !== manifest.width ||
    video.height !== manifest.height ||
    Math.abs(Number(audio.duration) - manifest.duration) > 0.15 ||
    Math.abs(video.avg_frame_rate.split('/').reduce((a, b) => Number(a) / Number(b)) - manifest.fps) > 0.01
  )
    throw new Error('Rendered dimensions, duration, audio length, or fps differ from the job.');
  const levels = await new Promise((resolve, reject) => {
    const child = spawn(
      'ffmpeg',
      ['-hide_banner', '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-'],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    let log = '';
    child.stderr.on('data', (c) => {
      log += c;
    });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve(log) : reject(new Error('Audio volume verification failed.')),
    );
  });
  const mean = Number(levels.match(/mean_volume:\s*([-\d.]+) dB/)?.[1]);
  if (!Number.isFinite(mean) || mean < -60)
    throw new Error('Rendered narration is silent or effectively inaudible.');
  // A film's soundtrack is mixed by the pipeline (renders/mix.wav: narration unprocessed + sound effects + music, one
  // master gain). The render must carry exactly that mix; without one (older jobs) it must carry the narration alone.
  const narrationFile = await localFile(job, 'assets/narration.wav'),
    mixFile = path.join(job, 'renders/mix.wav');
  const mixReport = (await exists(mixFile))
    ? await json(path.join(job, 'review/mix.json')).catch(() => null)
    : null;
  const reference = mixReport ? mixFile : narrationFile;
  const soundtrack = mixReport
    ? {
        reference:
          'renders/mix.wav (narration unprocessed + declared sound effects + music, master gain ' +
          mixReport.gainDb +
          ' dB)',
        narrationOnlyCorrelation: (await compareNarration(file, narrationFile)).correlation,
        loudness: {
          integratedLufs: mixReport.integratedLufs,
          truePeakDb: mixReport.truePeakDb,
          samplePeakDb: mixReport.samplePeakDb,
          mono: mixReport.mono,
          peaksOk: mixReport.peaksOk,
          limitedBy: mixReport.limitedBy,
          ...(mixReport.limiter ? { limiter: mixReport.limiter } : {}),
        },
        soundEffects: mixReport.soundEffects,
        music: mixReport.music,
        voiceMasked: mixReport.voiceMasked,
        voiceClose: mixReport.voiceClose,
        soundsUnderMusic: mixReport.soundsUnderMusic,
      }
    : null;
  const narrationIntegrity = {
    ...(await compareNarration(file, reference)),
    ...(soundtrack ? { reference: soundtrack.reference } : {}),
  };
  const speech = await verifySpeech({
    audio: file,
    script: await readFile(path.join(job, 'inputs/narration.txt'), 'utf8'),
    duration: manifest.duration,
    output: path.join(job, 'review/speech-final-mix.json'),
    fullScript: Boolean(manifest.script?.fullScript),
    stage: 'final-mix',
  });
  const report = {
    ok: speech.ok && narrationIntegrity.ok,
    speech,
    output: path.relative(ROOT, file),
    duration: Number(metadata.format.duration),
    width: video.width,
    height: video.height,
    fps: video.avg_frame_rate,
    audioCodec: audio.codec_name,
    meanVolumeDb: mean,
    sha256: await fileHash(file),
    narrationIntegrity,
    ...(soundtrack ? { soundtrack } : {}),
  };
  await writeReviewFile(job, 'review/render-verification.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) throw new Error('Final audio verification failed; inspect speech and integrity reports.');
}

export { hf };
