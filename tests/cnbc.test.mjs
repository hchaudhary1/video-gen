import test from 'node:test';
import assert from 'node:assert/strict';
import {financeRatioPass, thumbWords, publishCheck} from '../lib/cnbc.mjs';

test('finance ratio keeps both boundaries and rejects too little or too much source', () => {
  for(const pair of [[60,40],[70,30]]) assert.equal(financeRatioPass(...pair),true);
  for(const pair of [[50,50],[59,41],[71,29],[0,0],[-1,4],[Infinity,4],[NaN,4]]) assert.equal(financeRatioPass(...pair),false);
});
test('thumbnail word rule counts text across lines', () => {
  assert.deepEqual(thumbWords('WHO|PAYS?'), ['WHO','PAYS?']);
  assert.deepEqual(thumbWords('AI BILL|DUE'), ['AI BILL','DUE']);
  assert.throws(()=>thumbWords('ONE'));
  assert.throws(()=>thumbWords('THIS IS FOUR WORDS'));
});

import {mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {narrationEvidence, ratio} from '../lib/cnbc.mjs';

test('ratio binds narration, script and render and rejects silence padding', async () => {
  const slug = `test-cnbc-${process.pid}`;
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../engines/explainroo/videos', slug);
  const hash = async f => createHash('sha256').update(await readFile(f)).digest('hex');
  const ff = args => execFileSync('ffmpeg',['-v','error','-y',...args],{stdio:'pipe'});
  try {
    for(const d of ['build/voice','out','cnbc/clips']) await mkdir(path.join(root,d),{recursive:true});
    await writeFile(path.join(root,'script.md'),'Original analysis fixture.');
    await writeFile(path.join(root,'build/timeline.json'),JSON.stringify({scenes:[{id:'analysis',voice:{url:'build/voice/analysis.wav'}}]}));
    const audio=path.join(root,'build/voice/analysis.wav');
    ff(['-f','lavfi','-i','sine=frequency=440:duration=4',audio]);
    const own=path.join(root,'out/video.mp4');
    ff(['-f','lavfi','-i','color=c=blue:s=160x90:r=10:d=4','-f','lavfi','-i','sine=duration=4','-shortest','-c:v','libx264','-preset','ultrafast',own]);
    const src=path.join(root,'cnbc/clips/source.mp4');
    ff(['-i',own,'-t','2','-c','copy',src]);
    const commentary=path.join(root,'cnbc/commentary.mp4');
    await writeFile(commentary,await readFile(own));
    const final=path.join(root,'cnbc/final.mp4');
    ff(['-i',src,'-i',commentary,'-filter_complex','[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]','-map','[v]','-map','[a]','-c:v','libx264','-preset','ultrafast',final]);
    const manifest={output:'final.mp4',sha256:await hash(final),commentarySourceSha256:await hash(own),parts:[{kind:'cnbc',file:'clips/source.mp4',sha256:await hash(src)},{kind:'own',file:'commentary.mp4',sha256:await hash(commentary)}]};
    await writeFile(path.join(root,'cnbc/assembly.json'),JSON.stringify(manifest));
    await narrationEvidence({project:slug});
    assert.equal((await ratio({project:slug})).pass,true);
    await writeFile(path.join(root,'script.md'),'Changed script.');
    await assert.rejects(ratio({project:slug}),/stale/);
    // Same length WAV, but most is silence: the commentary video duration cannot hide it.
    ff(['-f','lavfi','-i','sine=duration=1','-af','apad=whole_dur=4',audio]);
    await narrationEvidence({project:slug});
    await assert.rejects(ratio({project:slug}),/exceed half/);
  } finally {await rm(root,{recursive:true,force:true});}
});

test('publishing rejects middle-of-title name drops and long titles before touching media', async () => {
  await assert.rejects(publishCheck({project:'unused',title:'A warning from Jim Cramer',person:'Jim Cramer'}),/must start with/);
  await assert.rejects(publishCheck({project:'unused',title:'Jim Cramer '+ 'x'.repeat(70),person:'Jim Cramer'}),/70 characters/);
});
