// Synthetic receipts for delivery contract unit tests; not measured speech.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {ASR_MODEL,speechHash} from '../lib/speech.mjs';
export async function syntheticSpeechEvidence(job) {
  await mkdir(path.join(job,'inputs'),{recursive:true});
  const manifest = JSON.parse(await readFile(path.join(job,'job.json'),'utf8').catch(()=>'{}'));
  const script = await readFile(path.join(job,'inputs/narration.txt'),'utf8').catch(()=> 'Synthetic script');
  await writeFile(path.join(job,'inputs/narration.txt'),script);
  for (const [stage,file] of [['narration','assets/narration.wav'],['final-mix','renders/video.mp4']]) {
    await writeFile(path.join(job,`review/speech-${stage}.json`),JSON.stringify({version:1,model:ASR_MODEL,stage,ok:true,fullScript:Boolean(manifest.script?.fullScript),duration:manifest.duration,scriptSha256:speechHash(script),audioSha256:speechHash(await readFile(path.join(job,file)))}));
  }
}
export async function syntheticAsrEnv(job, text) {
  const bin = path.join(job,'review/asr-bin'); await mkdir(bin,{recursive:true});
  const words = text.split(' ').map((text,i)=>({text,start:i*.2,end:i*.2+.1}));
  await writeFile(path.join(bin,'uv'), `#!/usr/bin/env node\n// Synthetic model-free test adapter, not recognition.\nrequire('node:fs').writeFileSync(process.argv.at(-1), ${JSON.stringify(JSON.stringify({model:ASR_MODEL,words}))});\n`,{mode:0o755});
  return {...process.env,PATH:bin+path.delimiter+process.env.PATH};
}
