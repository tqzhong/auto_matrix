import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { FILM_SETS, filmPosition, type ServerMessage, type WorldStateFull, type WorldStateDelta } from '@auto_matrix/shared';

async function server(t: test.TestContext, variant: 'walking'|'legacy'|'dead'|'persephone'|'persephone-stale') {
  const intimate=variant.startsWith('persephone'),root=fileURLToPath(new URL('../',import.meta.url)),directory=execFileSync(process.execPath,['--import','tsx','scripts/film-review-fixture.mts',intimate?'m2_persephone':'m2_library'],{cwd:root,encoding:'utf8'}).trim();
  const file=path.join(directory,'world.json'),checkpoint=JSON.parse(await readFile(file,'utf8')),j=checkpoint.sandbox.neoLife.journey,set='film_keymaker_workshop';
  if(intimate){
    j.step=2;j.persephone={phase:'enacting',elapsed:1.23,attempts:1,route:'memory'};delete j.started;checkpoint.tick=20;checkpoint.simulation={running:false,speed:1};
    for(const role of ['neo','persephone'] as const){
      const neo=role==='neo';Object.assign(checkpoint.agents[role],{position:filmPosition('film_le_vrai',neo?22.1:23.4,neo?21.8:22.5),rotation:neo?.9:-.9,currentLocation:'film_le_vrai',isInMatrix:true,health:neo?73:67,velocity:{x:0,y:0,z:0},targetPosition:null,currentPath:[],
        currentAction:{type:'idle',parameters:{resolved:true,player:neo,persephone:{...j.persephone,elapsed:variant==='persephone-stale'?1.1:1.23,role}},startedAt:19,duration:1,progress:neo?0:1}});
    }
    j.checkpoint={...checkpoint.agents.neo.position};
  }else{
  Object.assign(j,{step:4,keymaker:{x:-8,z:-20,phase:'following',separated:0,setbacks:1}});delete j.started;checkpoint.simulation={running:false,speed:1};
  Object.assign(checkpoint.agents.neo,{position:filmPosition(set,-8,-12),currentAction:null,health:73,velocity:{x:0,y:0,z:0},targetPosition:null,currentPath:[]});j.checkpoint={...checkpoint.agents.neo.position};
  Object.assign(checkpoint.agents.keymaker,{position:filmPosition(set,-8,-20),currentLocation:set,isInMatrix:true,health:variant==='dead'?0:23,status:variant==='dead'?'dead':'alive',velocity:variant==='walking'?{x:0,y:0,z:4.6}:{x:0,y:0,z:0},targetPosition:null,currentPath:[],
    currentAction:{type:variant==='walking'?'move_to':'idle',parameters:{resolved:true,keymakerEscort:'following'},startedAt:7,duration:1,progress:.4}});
  }
  await writeFile(file,JSON.stringify(checkpoint));const expected=structuredClone(checkpoint),child=spawn(process.execPath,['--import','tsx','tests/fixtures/server-startup.mts','normal'],{
    cwd:root,env:{...process.env,MATRIX_DATA_DIR:directory,MATRIX_CLOUD_SAVE:'',HOST:'127.0.0.1',PORT:'0',TICK_RATE_MS:'10000',STATE_SYNC_INTERVAL:'1',LLM_API_KEY:''},stdio:['ignore','pipe','pipe']});
  let output='';const sockets:ReturnType<typeof io>[]=[];child.stdout.on('data',data=>{output+=data;});child.stderr.on('data',data=>{output+=data;});const finished=new Promise(resolve=>child.once('close',resolve));
  t.after(async()=>{for(const socket of sockets)socket.disconnect();if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');const timer=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');},5000);try{await finished;}finally{clearTimeout(timer);await rm(directory,{recursive:true,force:true});}});
  const wait=async(ready:()=>boolean,label:string)=>{const end=Date.now()+15000;while(!ready()){assert(child.exitCode===null&&child.signalCode===null&&Date.now()<end,label+': '+output.slice(-1200));await new Promise(resolve=>setTimeout(resolve,20));}};
  await wait(()=>output.includes('STARTUP_LISTENING'),'startup');const address=JSON.parse(output.match(/STARTUP_LISTENING (\{[^\n]+\})/)![1]),url=`http://127.0.0.1:${address.port}`;
  const world=async()=>await(await fetch(url+'/api/world')).json() as WorldStateFull;
  const connect=async()=>{const socket=io(url,{autoConnect:false,transports:['websocket']}),messages:ServerMessage[]=[];sockets.push(socket);socket.on('message',message=>messages.push(message));socket.connect();await wait(()=>messages.some(m=>m.type==='world_state_full'),'initial state');socket.emit('message',{type:'play_as',data:{agentId:'neo'}});await wait(()=>messages.some(m=>m.type==='player_state'&&(m.data as{agentId?:string}).agentId==='neo'),'possession');return{socket,messages};};
  return{world,connect,expected,wait};
}

for(const variant of ['walking','legacy','dead'] as const)test(`cold ${variant} companion retains his full pose, wounds and escort through player reconnect`,{timeout:25000},async t=>{
  const h=await server(t,variant),check=(w:WorldStateFull)=>{
    assert.equal(w.simulation!.running,false);assert.ok(JSON.stringify(w.agents.keymaker)===JSON.stringify(h.expected.agents.keymaker),'retain the complete saved companion');assert.deepEqual(w.sandbox!.neoLife!.journey!.keymaker,h.expected.sandbox.neoLife.journey.keymaker);
  };
  check(await h.world());const{socket}=await h.connect();const attached=await h.world();check(attached);socket.disconnect();
  const end=Date.now()+5000;while((await h.world()).agents.neo.controller){assert(Date.now()<end);await new Promise(resolve=>setTimeout(resolve,20));}check(await h.world());await h.connect();const after=await h.world();check(after);
  assert.ok(JSON.stringify(after)===JSON.stringify(attached),'the complete paused world must survive reconnect without normalizing fields');
});

test('fast escort packets contain the moving Keymaker and the matching saved position between world ticks',{timeout:25000},async t=>{
  const h=await server(t,'walking'),{socket,messages}=await h.connect();messages.length=0;socket.emit('message',{type:'resume'});
  const packets=()=>messages.filter(m=>m.type==='world_state_delta').map(m=>m.data as WorldStateDelta).filter(p=>(p.sandbox?.neoLife?.journey?.keymaker?.z??-20)>-20);
  await h.wait(()=>packets().length>=6,'fast escort packets');const center=FILM_SETS.film_keymaker_workshop.center;
  for(const packet of packets()){
    const state=packet.sandbox!.neoLife!.journey!.keymaker!,captive=packet.agents.keymaker;
    assert.ok(captive&&packet.agents.neo,'both escort actors belong to the same packet');assert.ok(Math.abs(captive.position!.x-center.x-state.x)<1e-8&&Math.abs(captive.position!.z-center.z-state.z)<1e-8);
    assert.equal(captive.currentAction?.type,'move_to');assert.ok(Math.hypot(captive.velocity!.x,captive.velocity!.z)>0);assert.equal(captive.currentAction?.parameters.keymakerEscort,state.phase);
  }
});


test('Persephone cold re-entry preserves both action clocks and a companion progress advanced on the last world tick',{timeout:25000},async t=>{
  const h=await server(t,'persephone'),check=(w:WorldStateFull)=>{
    for(const role of ['neo','persephone'])for(const key of ['position','rotation','velocity','health','currentAction','targetPosition','currentPath'] as const)assert.deepEqual(w.agents[role][key],h.expected.agents[role][key],role+'/'+key);
    assert.deepEqual(w.sandbox!.neoLife!.journey!.persephone,h.expected.sandbox.neoLife.journey.persephone);
  };
  check(await h.world());const{socket}=await h.connect();const before=await h.world();check(before);socket.disconnect();
  const end=Date.now()+5000;while((await h.world()).agents.neo.controller){assert(Date.now()<end);await new Promise(resolve=>setTimeout(resolve,20));}check(await h.world());await h.connect();const after=await h.world();check(after);assert.ok(JSON.stringify(before)===JSON.stringify(after),'retain every field of the complete paused world through reconnect');
});

test('a stale Persephone gesture is rebuilt from the current encounter instead of preserved as a matching pose',{timeout:25000},async t=>{
  const h=await server(t,'persephone-stale');await h.connect();const w=await h.world();
  for(const role of ['neo','persephone']){assert.equal((w.agents[role].currentAction!.parameters.persephone as {elapsed:number}).elapsed,1.23);assert.equal(w.agents[role].currentAction!.startedAt,20);assert.equal(w.agents[role].currentAction!.progress,0);}
});
