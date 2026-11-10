import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { BOOK_DOOR, bookDoorAngle, bookDoorPoint, bookDoorStance, filmPosition, type BookDoorEncounter, type ServerMessage, type WorldStateFull, type WorldStateDelta } from '@auto_matrix/shared';

async function server(t:test.TestContext,phase:'approaching'|'unlatching'|'opening',hiddenIdle=false) {
  const root=fileURLToPath(new URL('../',import.meta.url)),directory=execFileSync(process.execPath,['--import','tsx','scripts/film-review-fixture.mts','m2_library'],{cwd:root,encoding:'utf8'}).trim();
  const file=path.join(directory,'world.json'),checkpoint=JSON.parse(await readFile(file,'utf8')),j=checkpoint.sandbox.neoLife.journey;
  const s:BookDoorEncounter={phase,elapsed:1.2,door:phase==='opening'?.4:0,book:phase==='unlatching'?.5:0,
    neo:{...BOOK_DOOR.anchor,yaw:Math.PI},persephone:phase==='approaching'?{x:-4,z:-9,yaw:Math.PI}:bookDoorStance(phase==='opening'?.4:0),route:[{x:-4,z:-12},bookDoorStance(0)],cursor:0};
  Object.assign(j,{step:2,bookDoor:s});delete j.started;checkpoint.tick=20;checkpoint.simulation={running:false,speed:1};
  for(const role of ['neo','persephone']as const){
    const b=s[role],neo=role==='neo';Object.assign(checkpoint.agents[role],{position:filmPosition(BOOK_DOOR.set,b.x,b.z),rotation:b.yaw,currentLocation:BOOK_DOOR.set,isInMatrix:true,health:neo?73:55,velocity:{x:neo?0:.2,y:0,z:neo?0:-.1},targetPosition:null,currentPath:[],
      currentAction:{type:neo?'idle':'move_to',parameters:{resolved:true,player:neo,bookDoor:{phase:s.phase,elapsed:s.elapsed,door:s.door,book:s.book,persephone:{...s.persephone},role}},startedAt:19,duration:1e9,progress:.4}});
  }
  j.checkpoint={...checkpoint.agents.neo.position};
  const point=bookDoorPoint(BOOK_DOOR.width/2,0,0,s.door),leaf={id:'film:library:bookdoor',kind:'barricade',owner:'persephone',position:filmPosition(BOOK_DOOR.set,point.x,point.z),matrix:true,health:999,
    film:{scene:'m2_library',width:BOOK_DOOR.width,depth:BOOK_DOOR.depth,height:BOOK_DOOR.height,yaw:bookDoorAngle(s.door)}};
  checkpoint.sandbox.structures=checkpoint.sandbox.structures.filter((a:{id:string})=>a.id!==leaf.id);checkpoint.sandbox.structures.push(leaf);
  if(hiddenIdle)Object.assign(checkpoint.agents.keymaker,{currentAction:null,velocity:{x:0,y:0,z:0},targetPosition:null,currentPath:[],health:23});
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

for(const phase of ['approaching','unlatching','opening']as const)test(`cold ${phase} preserves the complete book mechanism and both actor poses through reconnect`,{timeout:25000},async t=>{
  const h=await server(t,phase),check=(w:WorldStateFull)=>{
    assert.equal(w.simulation!.running,false);assert.deepEqual(w.sandbox!.neoLife!.journey!.bookDoor,h.expected.sandbox.neoLife.journey.bookDoor);
    for(const role of ['neo','persephone'])for(const key of ['position','rotation','velocity','health','currentAction','targetPosition','currentPath']as const)assert.deepEqual(w.agents[role][key],h.expected.agents[role][key],role+'/'+key);
    assert.deepEqual(w.sandbox!.structures.find(a=>a.id==='film:library:bookdoor'),h.expected.sandbox.structures.find((a:{id:string})=>a.id==='film:library:bookdoor'));
  };
  check(await h.world());const{socket}=await h.connect();const attached=await h.world();check(attached);socket.disconnect();
  const end=Date.now()+5000;while((await h.world()).agents.neo.controller){assert(Date.now()<end);await new Promise(resolve=>setTimeout(resolve,20));}check(await h.world());await h.connect();const after=await h.world();check(after);
  assert.ok(JSON.stringify(after)===JSON.stringify(attached),'retain every field of the complete paused world through reconnect');
});

test('cold book operation preserves the hidden wounded Keymaker when the last world tick left him without an action',{timeout:25000},async t=>{
  const h=await server(t,'unlatching',true),check=(w:WorldStateFull)=>assert.ok(JSON.stringify(w.agents.keymaker)===JSON.stringify(h.expected.agents.keymaker),'retain every field of the hidden captive, including his null action');
  check(await h.world());const{socket}=await h.connect();const attached=await h.world();check(attached);socket.disconnect();
  const end=Date.now()+5000;while((await h.world()).agents.neo.controller){assert(Date.now()<end);await new Promise(resolve=>setTimeout(resolve,20));}check(await h.world());await h.connect();const after=await h.world();check(after);
  assert.ok(JSON.stringify(after)===JSON.stringify(attached),'retain the complete paused world through reconnect');
});

test('fast bookcase packets carry both actors and the same saved hinge and gesture clocks',{timeout:25000},async t=>{
  const h=await server(t,'opening'),{socket,messages}=await h.connect();messages.length=0;socket.emit('message',{type:'resume'});
  const packets=()=>messages.filter(m=>m.type==='world_state_delta').map(m=>m.data as WorldStateDelta).filter(p=>(p.sandbox?.neoLife?.journey?.bookDoor?.elapsed??0)>1.2);
  await h.wait(()=>packets().length>=6,'fast bookcase packets');
  for(const packet of packets()){
    const s=packet.sandbox!.neoLife!.journey!.bookDoor!;
    for(const role of ['neo','persephone']as const){const actor=packet.agents[role];assert.ok(actor,role+' is present in the same packet');const g=actor.currentAction?.parameters.bookDoor as{phase:string;elapsed:number;door:number};assert.ok(g);assert.equal(g.phase,s.phase);assert.equal(g.elapsed,s.elapsed);assert.equal(g.door,s.door);assert.deepEqual(actor.position,filmPosition(BOOK_DOOR.set,s[role].x,s[role].z));}
    assert.equal(packet.sandbox!.structures.find(a=>a.id==='film:library:bookdoor')!.film!.yaw,bookDoorAngle(s.door));
  }
});
