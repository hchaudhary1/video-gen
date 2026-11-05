const assignments = text => JSON.parse(/^ASSIGNMENTS: (.+)$/m.exec(text)[1]);
const assignment = text => assignments(text)[0];
// N thumbnail variants: made from different angles, reviewed, picked (by the person or the reviewer's ranking),
// any one regenerated with feedback, and archived.
import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm, readdir} from 'node:fs/promises';
import path from 'node:path';
import {FORMATS} from '../lib/media.mjs';
import {PERSONALITIES, loadPersonality, freezePersonality} from '../lib/personalities.mjs';
const cache = path.resolve('.cache/thumbnail-tests');
await mkdir(cache, {recursive: true});
import sharp from 'sharp';

const library = await mkdtemp(path.join(cache, 'thumb-library-'));
process.env.VG_LIBRARY = library;
after(() => rm(library, {recursive: true, force: true}));
const {thumbnailDimensions, thumbnailStatus, recordVerdict, recordRanking, addThumbnailFeedback, chooseThumbnail, exportThumbnail} = await import('../lib/thumbnails.mjs');
const {chromePath} = await import('../lib/native.mjs');

async function fixture(t, manifest = {}) {
  const job = await mkdtemp(path.join(cache, 'thumbs-'));
  t.after(() => rm(job, {recursive: true, force: true}));
  await mkdir(path.join(job, 'inputs'), {recursive: true});
  await writeFile(path.join(job, 'job.json'), JSON.stringify({duration: 10, thumbnails: 2, width: 1280, height: 720, ...manifest}));
  await writeFile(path.join(job, 'inputs/visuals.md'), '# Plan\n\n## Thumbnail\n- Title: Why your Mac is slow\n- Headline: IT\'S NOT THE CHIP\n\n## Scenes\n');
  return job;
}
async function make(job, id, {headline = `HEADLINE ${id}`, colour = '#112233'} = {}) {
  const {width, height, previewWidth, previewHeight, previewFile} = await thumbnailDimensions(job);
  const dir = path.join(job, 'thumbnail/variants', id); await mkdir(dir, {recursive: true});
  await writeFile(path.join(dir, 'BRIEF.md'), `Title: Why your Mac is slow\nHeadline: ${headline}\n`);
  await writeFile(path.join(dir, 'thumbnail.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${colour}"/></svg>`);
  await sharp({create: {width, height, channels: 3, background: colour}}).png().toFile(path.join(dir, 'thumbnail.png'));
  await sharp({create: {width: previewWidth, height: previewHeight, channels: 3, background: colour}}).png().toFile(path.join(dir, previewFile));
}
const verdict = (job, variant, status, findings = []) => recordVerdict(job, {variant, status, findings, reviewer: 'reviewer-1',
  inspected: [`thumbnail/variants/${variant}/thumbnail.png`]});

test('independent verdicts and actual feedback govern selection and archive',async t=>{
 const job=await fixture(t);await make(job,'v1');await make(job,'v2');
 await verdict(job,'v1','pass');await verdict(job,'v2','blocked',['Unsupported number']);
 await assert.rejects(chooseThumbnail(job,{variant:'v2'}),/not passed/);
 await recordRanking(job,['v1']);await chooseThumbnail(job,{variant:'v1',by:'you'});
 assert.equal((await thumbnailStatus(job)).chosen.variant,'v1');
 await addThumbnailFeedback(job,{variant:'v1',text:'Larger headline'});
 assert.equal((await thumbnailStatus(job)).chosen,null);
 await assert.rejects(chooseThumbnail(job,{variant:'v1'}),/feedback/);
 await make(job,'v1',{colour:'#990000'});await verdict(job,'v1','pass');await chooseThumbnail(job,{variant:'v1',by:'you'});
 assert.ok((await readdir(path.join(library,'thumbnails',path.basename(job)))).includes('history'));
});
test('thumbnail-export renders the SVG to a 1280×720 PNG and a feed preview', async t => {
  const chrome = await chromePath().catch(() => null);
  if (!chrome) return t.skip('no Chrome');
  const job = await fixture(t);
  const dir = path.join(job, 'thumbnail/variants/v1'); await mkdir(dir, {recursive: true});
  await writeFile(path.join(dir, 'thumbnail.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#ff0000"/><text x="80" y="400" font-size="160" fill="#fff">DON\'T</text></svg>');
  const result = await exportThumbnail(job, 'v1');
  assert.deepEqual(result.size, {width: 1280, height: 720});
  const preview = await sharp(path.join(dir, 'preview-320x180.png')).metadata();
  assert.equal(preview.width, 320); assert.equal(preview.height, 180);
  const {data} = await sharp(path.join(dir, 'thumbnail.png')).extract({left: 5, top: 5, width: 1, height: 1}).raw().toBuffer({resolveWithObject: true});
  assert.ok(data[0] > 200 && data[1] < 50, 'the SVG itself was drawn');
});

for (const profile of PERSONALITIES) for (const [format, [width, height]] of Object.entries(FORMATS)) {
  test(`${profile}: ${format} dimensions survive briefs, review, selection and archive`, async t => {
    const job = await fixture(t, {width, height, format, thumbnails: 1});
    await freezePersonality(job, loadPersonality(profile));
    const dims = await thumbnailDimensions(job);
    // A landscape image on a differently sized video cannot be reviewed or chosen.
    await make(job, 'v1');
    const dir = path.join(job, 'thumbnail/variants/v1');
    await sharp({create: {width: 1280, height: 720, channels: 3, background: '#000'}}).png().toFile(path.join(dir, 'thumbnail.png'));
    assert.equal((await thumbnailStatus(job)).variants[0].made, false);
    await assert.rejects(verdict(job, 'v1', 'pass'), /expected/);
    await make(job, 'v1');
    await verdict(job, 'v1', 'pass');
    await chooseThumbnail(job, {variant: 'v1'});
    for (const file of [path.join(job, 'thumbnail/thumbnail.png'), path.join(library, 'thumbnails', path.basename(job), 'thumbnail.png')]) {
      const meta = await sharp(file).metadata();
      assert.equal(meta.width, width); assert.equal(meta.height, height);
    }
    // A previous passing review must not qualify an image after the saved frame changes.
    const manifest = JSON.parse(await readFile(path.join(job, 'job.json'), 'utf8'));
    await writeFile(path.join(job, 'job.json'), JSON.stringify({...manifest, width: width + 2}));
    assert.equal((await thumbnailStatus(job)).chosen, null);
    await assert.rejects(chooseThumbnail(job, {variant: 'v1'}), /not passed/);
  });
}

for (const format of ['vertical', 'square', 'landscape']) test(`browser export matches ${format} video and rejects a mismatched SVG`, async t => {
  if (!await chromePath().catch(() => null)) return t.skip('no Chrome');
  const [width, height] = FORMATS[format];
  const job = await fixture(t, {width, height});
  await make(job, 'v1');
  const dims = await thumbnailDimensions(job);
  await writeFile(path.join(job, 'thumbnail/variants/v1/preview-1x1.png'), 'stale preview');
  const result = await exportThumbnail(job, 'v1');
  assert.ok(!(await readdir(path.join(job, 'thumbnail/variants/v1'))).includes('preview-1x1.png'));
  assert.deepEqual(result.size, {width, height});
  const dir = path.join(job, 'thumbnail/variants/v1');
  const preview = await sharp(path.join(dir, dims.previewFile)).metadata();
  assert.equal(preview.width, dims.previewWidth); assert.equal(preview.height, dims.previewHeight);
  await writeFile(path.join(dir, 'thumbnail.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 300"/>');
  await assert.rejects(exportThumbnail(job, 'v1'), /aspect ratio must match/);
});
