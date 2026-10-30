import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';

const root=new URL('../',import.meta.url);
test('the published core cast contains every pinned model, editable master, runtime and review dependency',async()=>{
 const manifest=JSON.parse(await readFile(new URL('docs/core-cast-delivery-2026-10-30.json',root),'utf8'));
 assert.deepEqual(manifest.actors.map((actor:any)=>actor.id).sort(),['morpheus','neo','smith','trinity']);
 const files=new Map(manifest.files.map((file:any)=>[file.path,file]));
 for(const file of manifest.files){
  assert(!file.path.startsWith('/')&&!file.path.split('/').includes('..'),file.path);
  assert(file.bytes<100*1024*1024,'Retained file exceeds the delivery size limit: '+file.path);
  const url=new URL(file.path,root);assert.equal((await stat(url)).size,file.bytes,file.path);
  const hash=createHash('sha256');for await(const bytes of createReadStream(url))hash.update(bytes);
  assert.equal(hash.digest('hex'),file.sha256,file.path);
 }
 for(const actor of manifest.actors){
  for(const record of [actor.model,actor.native,...actor.runtime.sources]){
   const delivered=files.get(record.path)as any;assert(delivered,'Missing delivery dependency: '+record.path);assert.equal(delivered.sha256,record.sha256);
  }
  assert.equal(actor.likenessPercentage,null);assert.equal(actor.productionPromoted,false);
 }
 assert.equal(manifest.prior95PercentClaimed,false);assert.equal(manifest.fullTrilogyOrWholeGameAccepted,false);
});
