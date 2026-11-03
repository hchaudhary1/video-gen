import {syntheticAsrEnv} from './speech-fixture.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadPersonality, freezePersonality} from '../lib/personalities.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const exec=promisify(execFile);

test('CLI producer commands register runner producer identity before their handlers run',async t=>{
  const base=path.join(ROOT,'.cache'); await mkdir(base,{recursive:true});
  const job=await mkdtemp(path.join(base,'producer-cli-')); t.after(()=>rm(job,{recursive:true,force:true}));
  await writeFile(path.join(job,'job.json'),JSON.stringify({review:{producerAgentIds:[],producerAgentRecords:[]}}));
  for(const [command,args,role,id] of [
    ['plan-check',[],'director','runner-plan-check'],
    ['check',[],'builder','runner-check'],
  ]){
    await assert.rejects(exec(process.execPath,['scripts/video.mjs',command,'--job',job,...args],{cwd:ROOT,env:{...process.env,VIDEO_AGENT_ROLE:role,VIDEO_AGENT_ID:id}}));
    const manifest=JSON.parse(await readFile(path.join(job,'job.json'),'utf8'));
    assert.ok(manifest.review.producerAgentIds.includes(id),`${command} did not register producer ID`);
    assert.ok(manifest.review.producerAgentRecords.some(r=>r.agentId===id&&r.role===role));
  }
});

test('prepare carries the frozen profile, the brief and script-stage producer provenance into the job',async t=>{
  const base=path.join(ROOT,'.cache'); await mkdir(base,{recursive:true});
  const project=await mkdtemp(path.join(base,'prepare-e2e-'));
  const slug=`prepare-e2e-${randomUUID().replaceAll('-','').slice(0,8)}`;
  const scriptDir=path.join(project,'script'); await mkdir(scriptDir,{recursive:true});
  const job=path.join(ROOT,'jobs',slug);
  t.after(async()=>{
    await rm(job,{recursive:true,force:true});
    await rm(project,{recursive:true,force:true});
  });
  const script=path.join(scriptDir,'SCRIPT.md'), audio=path.join(project,'narration.wav');
  await writeFile(script,'# Demo\n\nThe setting is visible.');
  await writeFile(path.join(scriptDir,'BRIEF.md'),'A short rule story told in a restrained visual treatment.');
  const productionProfile=await freezePersonality(scriptDir,loadPersonality('rules-story'));
  await writeFile(path.join(scriptDir,'project.json'),JSON.stringify({slug:'fixture',productionProfile,
    history:[{state:'write',tasks:[{agentId:'runner-writer',role:'script-writer'},{agentId:'runner-script-reviewer',role:'script-reviewer'}]}]}));
  const words=path.join(project,'words.json');
  await writeFile(words,JSON.stringify([{text:'The',start:0.1,end:0.3},{text:'setting',start:0.35,end:0.7},{text:'is',start:0.75,end:0.85},{text:'visible.',start:0.9,end:1.2}]));
  await exec('ffmpeg',['-nostdin','-v','error','-y','-f','lavfi','-i','sine=frequency=440:duration=4','-c:a','pcm_s16le',audio],{cwd:ROOT});
  await exec(process.execPath,['scripts/video.mjs','prepare','--name',slug,'--audio',audio,'--script',script,'--profile','rules-story','--words',words,'--no-latest'],{cwd:ROOT,env:await syntheticAsrEnv(project,'The setting is visible.')})
    .catch(error=>{error.message+=`\nstdout:\n${error.stdout||''}\nstderr:\n${error.stderr||''}`;throw error;});
  const manifest=JSON.parse(await readFile(path.join(job,'job.json'),'utf8'));
  assert.equal(manifest.productionProfile.id,'rules-story');
  assert.equal(manifest.workflow,'rules-story');
  assert.equal(manifest.status,'prepared');
  assert.equal(await readFile(path.join(job,'inputs/brief.md'),'utf8'),'A short rule story told in a restrained visual treatment.');
  assert.deepEqual(manifest.review.producerAgentIds,['runner-writer'],'script reviewers are not producers');
  assert.equal(manifest.review.producerIdentityStatus,'recorded');
});
