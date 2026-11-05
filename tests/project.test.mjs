import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,readFile} from 'node:fs/promises';
import path from 'node:path';
import {createProject,loadProject} from '../lib/project.mjs';
test('both profiles create Archon-only metadata with explicit decisions and immutable profile',async t=>{
 await mkdir('.cache/tests',{recursive:true});const root=await mkdtemp(path.resolve('.cache/tests/project-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 for(const profile of ['rules-story','kai-explainer']){
  const p=await createProject(root,{name:profile,profile,brief:'Fixture',review:'script,final',optOut:true});
  assert.equal(p.archon.optOut,true);assert.equal(p.productionProfile.id,profile);
  assert.deepEqual(p.review,['script','final']);assert.equal(p.tts,profile==='rules-story'?'ming':'kokoro');
  assert.equal('delegation' in p,false);assert.equal((await loadProject(root,profile)).productionProfile.sha256,p.productionProfile.sha256);
  await assert.rejects(createProject(root,{name:profile,profile,brief:'Changed'}),/exists/);
 }
});
