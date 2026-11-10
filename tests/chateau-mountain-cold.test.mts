import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { FILM_SCENES,FILM_SCENE_BY_ID,MOUNTAIN,filmEntry,filmPosition,type ServerMessage,type WorldStateFull }from '@auto_matrix/shared';

async function server(t:test.TestContext,variant:'idle'|'move_to'|'attack'|'takeoff'|'flying'|'arrived',stale=false,offstage=false){
  const root=fileURLToPath(new URL('../',import.meta.url)),directory=execFileSync(process.execPath,['--import','tsx','scripts/film-review-fixture.mts','m2_library'],{cwd:root,encoding:'utf8'}).trim(),file=path.join(directory,'world.json'),checkpoint=JSON.parse(await readFile(file,'utf8'));
  const castle=['idle','move_to','attack'].includes(variant),j=checkpoint.sandbox.neoLife.journey,neo=checkpoint.agents.neo,scene=castle?'m2_chateau':'m2_mountain',set=castle?'film_chateau_hall':'film_mountain_range';
  Object.assign(j,{scene,step:castle?0:variant==='arrived'?3:2,actor:'neo',completed:FILM_SCENES.slice(0,FILM_SCENES.findIndex(s=>s.id===scene)+(variant==='arrived'?1:0)).map(s=>s.id)});delete j.started;delete j.bookDoor;
  Object.assign(neo,{currentLocation:set,isInMatrix:true,status:'alive',health:73,position:filmPosition(set,castle?0:5,castle?10:variant==='arrived'?-310:180),rotation:2.95,velocity:castle?{x:0,y:0,z:0}:{x:5,y:0,z:-57},targetPosition:null,currentPath:[]});
  if(castle){j.chateau={phase:'duel',wave:1,weapon:'sword',parries:1,disarms:0,attempts:1,wounded:true};neo.currentAction={type:variant,parameters:{player:true,resolved:true,crouching:false,chateauWeapon:stale?'spear':'sword'},startedAt:19,duration:1,progress:.4};}
  else{const elapsed=variant==='takeoff'?.9:variant==='arrived'?7.8:.8,rise=elapsed/MOUNTAIN.ascent;
    j.mountain={phase:variant,elapsed,x:variant==='takeoff'?.5:5,z:variant==='takeoff'?245-elapsed*8:variant==='arrived'?-310:180,altitude:variant==='takeoff'?MOUNTAIN.altitude*rise*rise*(3-2*rise):MOUNTAIN.altitude+Math.sin(elapsed*2.6)*.45,attempt:1};
    neo.position={...filmPosition(set,j.mountain.x,j.mountain.z),y:filmPosition(set,0,0).y+j.mountain.altitude};neo.currentAction={type:'move_to',parameters:{player:true,resolved:true,mountainFlight:{...j.mountain,elapsed:stale?.7:j.mountain.elapsed}},startedAt:19,duration:1,progress:.4};}
  if(offstage){j.scene='m2_garage';j.actor='trinity';j.step=0;delete j.mountain;Object.assign(checkpoint.agents.trinity,{position:filmEntry(FILM_SCENE_BY_ID.m2_garage),currentLocation:'film_chateau_garage',isInMatrix:true,status:'alive',health:67,velocity:{x:0,y:0,z:0},currentAction:null,targetPosition:null,currentPath:[]});if(stale){neo.currentAction.parameters.mountainFlight.phase='flying';neo.currentAction.parameters.mountainFlight.elapsed=variant==='arrived'?7.8:.8;}}
  const controlled=offstage?'trinity':'neo';j.checkpoint={...checkpoint.agents[controlled].position};checkpoint.tick=20;checkpoint.simulation={running:false,speed:1};checkpoint.sandbox.threats=[];await writeFile(file,JSON.stringify(checkpoint));const expected=structuredClone(checkpoint);
  const child=spawn(process.execPath,['--import','tsx','tests/fixtures/server-startup.mts','normal'],{cwd:root,env:{...process.env,MATRIX_DATA_DIR:directory,MATRIX_CLOUD_SAVE:'',HOST:'127.0.0.1',PORT:'0',TICK_RATE_MS:'10000',STATE_SYNC_INTERVAL:'1',LLM_API_KEY:''},stdio:['ignore','pipe','pipe']});
  let output='';const sockets:ReturnType<typeof io>[]=[];child.stdout.on('data',data=>{output+=data;});child.stderr.on('data',data=>{output+=data;});const finished=new Promise(resolve=>child.once('close',resolve));
  t.after(async()=>{for(const s of sockets)s.disconnect();if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');const timer=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');},5000);try{await finished;}finally{clearTimeout(timer);await rm(directory,{recursive:true,force:true});}});
  const wait=async(ready:()=>boolean,label:string)=>{const end=Date.now()+15000;while(!ready()){assert(child.exitCode===null&&child.signalCode===null&&Date.now()<end,label+': '+output.slice(-1200));await new Promise(resolve=>setTimeout(resolve,20));}};
  await wait(()=>output.includes('STARTUP_LISTENING'),'startup');const address=JSON.parse(output.match(/STARTUP_LISTENING (\{[^\n]+\})/)![1]),url=`http://127.0.0.1:${address.port}`,world=async()=>await(await fetch(url+'/api/world')).json()as WorldStateFull;
  const connect=async()=>{const socket=io(url,{autoConnect:false,transports:['websocket']}),messages:ServerMessage[]=[];sockets.push(socket);socket.on('message',m=>messages.push(m));socket.connect();await wait(()=>messages.some(m=>m.type==='world_state_full'),'initial state');socket.emit('message',{type:'play_as',data:{agentId:controlled}});await wait(()=>messages.some(m=>m.type==='player_state'&&(m.data as{agentId?:string}).agentId===controlled),'possession');return socket;};
  return{world,connect,expected};
}

for(const variant of ['idle','move_to','attack','takeoff','flying','arrived']as const)test(`cold ${variant} retains the exact equipped or flying pose and action clock through reconnect`,{timeout:25000},async t=>{
  const h=await server(t,variant),check=(w:WorldStateFull)=>{
    assert.equal(w.simulation!.running,false);for(const k of ['position','rotation','velocity','health','currentAction','targetPosition','currentPath']as const)assert.deepEqual(w.agents.neo[k],h.expected.agents.neo[k],variant+'/'+k);
    const j=w.sandbox!.neoLife!.journey!;assert.deepEqual(j.chateau,h.expected.sandbox.neoLife.journey.chateau);assert.deepEqual(j.mountain,h.expected.sandbox.neoLife.journey.mountain);
  };
  check(await h.world());const socket=await h.connect(),before=await h.world();check(before);socket.disconnect();const end=Date.now()+5000;while((await h.world()).agents.neo.controller){assert(Date.now()<end);await new Promise(resolve=>setTimeout(resolve,20));}check(await h.world());await h.connect();const after=await h.world();check(after);assert.ok(JSON.stringify(before)===JSON.stringify(after),'retain every field of the complete paused world');
});

for(const variant of ['idle','flying']as const)test(`a stale ${variant} gesture is rebuilt from the current saved encounter`,{timeout:25000},async t=>{
  const h=await server(t,variant,true);await h.connect();const w=await h.world(),a=w.agents.neo.currentAction;assert.ok(a,'rebuild the saved encounter before acknowledging player control');assert.equal(a.startedAt,20);assert.equal(a.progress,0);assert.equal(w.agents.neo.health,73);
  if(variant==='idle')assert.equal(a.parameters.chateauWeapon,'sword');else assert.deepEqual(a.parameters.mountainFlight,w.sandbox!.neoLife!.journey!.mountain);
});

test('disconnecting during running ordinary movement stops Neo while retaining the selected sword',{timeout:25000},async t=>{
  const h=await server(t,'move_to'),socket=await h.connect();socket.emit('message',{type:'resume'});socket.emit('message',{type:'player_input',data:{x:1,z:0,yaw:Math.PI/2,jump:false,sprint:false,sequence:1}});
  const end=Date.now()+5000;while((await h.world()).agents.neo.velocity.x<2){assert(Date.now()<end,'moving input must reach the actual server');await new Promise(resolve=>setTimeout(resolve,20));}
  socket.disconnect();while((await h.world()).agents.neo.controller){assert(Date.now()<end);await new Promise(resolve=>setTimeout(resolve,20));}
  const neo=(await h.world()).agents.neo;assert.deepEqual(neo.velocity,{x:0,y:0,z:0});assert.equal(neo.currentAction?.type,'idle');assert.equal(neo.currentAction?.parameters.chateauWeapon,'sword');assert.equal(neo.health,73);
});

test('the garage cold load retains Neo’s completed offstage flight while Trinity takes control',{timeout:25000},async t=>{
  const h=await server(t,'arrived',false,true),check=(w:WorldStateFull)=>{for(const k of ['position','rotation','velocity','health','currentAction']as const)assert.deepEqual(w.agents.neo[k],h.expected.agents.neo[k],'offstage Neo/'+k);};
  check(await h.world());const socket=await h.connect(),before=await h.world();check(before);socket.disconnect();const end=Date.now()+5000;while((await h.world()).agents.trinity.controller){assert(Date.now()<end);await new Promise(resolve=>setTimeout(resolve,20));}await h.connect();const after=await h.world();check(after);assert.ok(JSON.stringify(before)===JSON.stringify(after),'retain the complete paused garage world');
});

test('an unfinished offstage flight tag cannot masquerade as the completed route after the handoff',{timeout:25000},async t=>{
  const h=await server(t,'arrived',true,true);assert.equal((await h.world()).agents.neo.currentAction,null);await h.connect();assert.equal((await h.world()).agents.neo.currentAction,null);
});
