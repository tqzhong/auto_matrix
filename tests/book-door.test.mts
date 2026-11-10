import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, FILM_SETS, filmPosition, filmStepPosition, playerBlocked, type FilmJourney, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

type Door = { phase: string; elapsed: number; door: number; book: number };
function setup() {
  const world=new WorldState();new AgentManager(world).initializeAllAgents();
  const dynamics={record:(_event:Omit<WorldEvent,'id'>)=>undefined}as WorldDynamics,sandbox=new SandboxSystem(world,dynamics,42);
  const players=new PlayerController(world,{interrupt(){},isAgentInConversation:()=>false}as unknown as ConversationEngine,{execute(){}}as unknown as ActionExecutor,dynamics,sandbox);
  const neo=world.agents.get('neo')!,persephone=world.agents.get('persephone')!,scene=FILM_SCENE_BY_ID.m2_library;
  players.possess('p','neo',0);sandbox.life.begin(neo,0);sandbox.state.neoLife!.chapter=1;let tick=0;
  const command=(target:string)=>players.sandboxAction('p',{kind:'life',target:`film:${target}`},++tick);
  command('continue');const state=sandbox.life.film.state! as FilmJourney&{bookDoor?:Door};
  Object.assign(state,{scene:'m2_persephone',step:FILM_SCENE_BY_ID.m2_persephone.steps.length,actor:'neo'});command('next');
  neo.position=filmPosition(scene.set,0,7);sandbox.tick(++tick);neo.position=filmPosition(scene.set,-6,-6);command('act');for(let i=0;i<7;i++)sandbox.tick(++tick);assert.equal(state.step,2);players.release('p',tick);players.possess('p','neo',tick);
  const frame=(dt=.1)=>{if(dt===0){(sandbox.life.film as unknown as{bookDoor?:{frame:(a:typeof neo,dt:number,tick:number)=>boolean}}).bookDoor?.frame(neo,0,++tick);return;}players.step(dt,true,++tick);if(tick%5===0)sandbox.tick(tick);};
  const start=()=>{neo.position=filmPosition(scene.set,-8,-14.8);return command('act');};
  const finish=()=>{for(let i=0;i<600&&state.step===2;i++)frame();assert.equal(state.step,3);};
  return{world,sandbox,players,neo,persephone,scene,state,command,frame,start,finish};
}

test('waiting on old world ticks cannot move the bookcase while Persephone is still across the room',()=>{
  const h=setup(),before={...h.persephone.position};h.start();for(let i=0;i<20;i++)h.sandbox.tick(100+i);
  assert.equal(h.state.step,2,'a timer alone cannot reveal the captive');assert.deepEqual(h.persephone.position,before);assert.equal(h.state.started,undefined);
});

test('Persephone walks to the actual book, releases it, pushes a continuous hinge and clears the doorway',()=>{
  const h=setup();h.persephone.health=Math.floor(h.persephone.maxHealth*.6);const health=h.persephone.health;h.start();
  const phases=new Set<string>(),misses:unknown[]=[];let previous={...h.persephone.position},door=0;
  for(let i=0;i<600&&h.state.step===2;i++){
    h.frame();const s=h.state.bookDoor;assert.ok(s,'the physical bookcase encounter must be saved');phases.add(s.phase);
    if(Math.hypot(h.persephone.position.x-previous.x,h.persephone.position.z-previous.z)>.43)misses.push({i,kind:'actor jump'});
    if(s.door-door>.06)misses.push({i,kind:'door jump',from:door,to:s.door});
    if(playerBlocked(h.persephone.position,true,.8,h.sandbox.state.structures))misses.push({i,kind:'actor intersects the shelf',phase:s.phase});
    previous={...h.persephone.position};door=s.door;
  }
  assert.equal(h.state.step,3);assert.equal(h.state.bookDoor?.phase,'done');assert.equal(h.state.bookDoor?.door,1);assert.equal(h.state.keymaker?.phase,'revealed');assert.equal(h.persephone.health,health);
  for(const phase of ['approaching','reaching','unlatching','grasping','opening','releasing','clearing'])assert.ok(phases.has(phase),phase);
  assert.equal(misses.length,0,JSON.stringify(misses.slice(0,8)));assert.equal(h.persephone.velocity.x,0);assert.equal(h.persephone.velocity.z,0);
  assert.ok(Math.abs(h.persephone.position.x-FILM_SETS[h.scene.set].center.x+8)>2.5,'she must leave room for the rescued party');
});

test('the physical leaf stays solid after opening while its actual passage admits Neo',()=>{
  const h=setup(),center=FILM_SETS[h.scene.set].center;
  assert.equal(playerBlocked(filmPosition(h.scene.set,-8,-18),true,.8,h.sandbox.state.structures),true);h.start();h.finish();
  assert.equal(playerBlocked(filmPosition(h.scene.set,-8,-18),true,.8,h.sandbox.state.structures),false);
  assert.equal(playerBlocked(filmPosition(h.scene.set,-10.5,-20.5),true,.2,h.sandbox.state.structures),true,'the opened leaf is still a real obstacle');
  h.neo.position=filmPosition(h.scene.set,-8,-15);h.players.receiveInput('p',{x:0,z:-1,yaw:Math.PI,jump:false,sprint:false,sequence:1});
  for(let i=0;i<25;i++)h.frame();assert.ok(h.neo.position.z<center.z-20,'walk through the opened passage using ordinary movement');
});

test('ordinary player frames after opening retain the Keymaker identity dialogue timer in current and legacy saves',()=>{
  for(const legacy of [false,true]){
    const h=setup();h.start();h.finish();if(legacy)delete h.state.bookDoor;
    h.neo.position=filmStepPosition(h.scene,h.scene.steps[3]);h.command('act');const started=h.state.started;assert.equal(typeof started,'number');
    h.frame();assert.equal(h.state.started,started,'the completed mechanism cannot clear the next interaction clock');
    for(let i=0;i<100&&h.state.step===3;i++)h.frame();assert.equal(h.state.step,4);assert.equal(h.state.keymaker?.phase,'following');
  }
});

test('zero-time frames, disconnect and retry keep the book angle and both saved poses',()=>{
  const h=setup();h.start();for(let i=0;i<500&&h.state.bookDoor?.phase!=='opening';i++)h.frame();h.frame();assert.equal(h.state.bookDoor?.phase,'opening');
  const before=JSON.stringify({neo:h.neo,persephone:h.persephone,door:h.state.bookDoor});h.frame(0);h.players.release('p',999);h.players.possess('p','neo',999);
  assert.ok(JSON.stringify({neo:h.neo,persephone:h.persephone,door:h.state.bookDoor})===before,'keep every field in both scripted actors');
  const companion=JSON.stringify(h.persephone),state=JSON.stringify(h.state.bookDoor);h.neo.health=1;h.command('retry');assert.equal(h.neo.health,h.neo.maxHealth);assert.equal(JSON.stringify(h.persephone),companion);assert.equal(JSON.stringify(h.state.bookDoor),state);
});

test('an unavailable Persephone freezes the current opening without moving or healing her',()=>{
  for(const unavailable of ['controller','dead','remote']){
    const h=setup();h.start();for(let i=0;i<500&&h.state.bookDoor?.phase!=='unlatching';i++)h.frame();assert.equal(h.state.bookDoor?.phase,'unlatching');
    if(unavailable==='controller')h.persephone.controller='second-player';else if(unavailable==='dead'){h.persephone.status='dead';h.persephone.health=0;}else{h.persephone.currentLocation='film_le_vrai';h.persephone.position=filmPosition('film_le_vrai',0,0);}
    const before=JSON.stringify(h.persephone),state=JSON.stringify(h.state.bookDoor);for(let i=0;i<20;i++)h.frame();assert.equal(JSON.stringify(h.persephone),before);assert.equal(JSON.stringify(h.state.bookDoor),state);assert.equal(h.state.step,2);
  }
});

test('a saved old bookcase timer adopts actual actor positions before the physical operation',()=>{
  const h=setup();delete h.state.bookDoor;h.state.started=3;h.persephone.position=filmPosition(h.scene.set,-4,-9);h.persephone.health=Math.floor(h.persephone.maxHealth*.6);
  const a=JSON.stringify(h.neo),b=JSON.stringify(h.persephone);h.frame(0);assert.ok(h.state.bookDoor);assert.equal(h.state.started,undefined);assert.ok(JSON.stringify(h.neo)===a,'legacy Neo is unchanged');assert.ok(JSON.stringify(h.persephone)===b,'legacy Persephone is unchanged');
  h.finish();assert.equal(h.state.keymaker?.phase,'revealed');
});

test('a completed legacy door remains open without moving Persephone back to a scripted stance',()=>{
  const h=setup();delete h.state.bookDoor;h.state.step=3;h.state.keymaker!.phase='revealed';h.persephone.position=filmPosition(h.scene.set,-4,-4);const before=JSON.stringify(h.persephone);h.frame(0);
  assert.equal(h.state.bookDoor?.door,1);assert.equal(h.state.bookDoor?.phase,'done');assert.equal(JSON.stringify(h.persephone),before);assert.equal(playerBlocked(filmPosition(h.scene.set,-8,-18),true,.8,h.sandbox.state.structures),false);
});

test('rotated film barricades collide with their visible long axis and leave the outside stance clear',()=>{
  const set='film_keymaker_workshop',center=filmPosition(set,5,0),leaf={id:'test-door',kind:'barricade' as const,owner:'persephone',position:center,matrix:true,health:999,film:{scene:'m2_library',width:5,depth:.6,height:13,yaw:Math.PI/2}};
  assert.equal(playerBlocked({...center,z:center.z+2},true,.1,[leaf]),true,'the turned panel extends along Z');
  assert.equal(playerBlocked({...center,x:center.x+1.65},true,.8,[leaf]),false,'a stance outside its rotated face must remain free');
  leaf.film.yaw=0;assert.equal(playerBlocked({...center,x:center.x+2},true,.1,[leaf]),true);assert.equal(playerBlocked({...center,z:center.z+1.65},true,.8,[leaf]),false);
});

test('a valid old open-door position is moved only far enough to escape the new leaf on migration',()=>{
  const h=setup();delete h.state.bookDoor;h.state.step=3;h.state.keymaker!.phase='revealed';h.neo.position=filmPosition(h.scene.set,-10.5,-20.5);h.state.checkpoint={...h.neo.position};
  const before={...h.neo.position},companion=JSON.stringify(h.persephone),action=JSON.stringify(h.neo.currentAction),health=h.neo.health;h.frame(0);
  assert.equal(playerBlocked(h.neo.position,true,1.1,h.sandbox.state.structures),false,'an old legal save cannot become trapped inside the new turned shelf');
  assert.ok(Math.hypot(h.neo.position.x-before.x,h.neo.position.z-before.z)<=1.5);assert.equal(h.neo.health,health);assert.equal(JSON.stringify(h.neo.currentAction),action);assert.equal(JSON.stringify(h.persephone),companion);assert.equal(h.state.step,3);
});
