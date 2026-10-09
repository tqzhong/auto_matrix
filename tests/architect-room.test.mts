import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, FILM_SETS, filmPosition, playerBlocked, architectDoorAngle, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
function setup() {
  const world=new WorldState();new AgentManager(world).initializeAllAgents();
  const dynamics={record:(e:Omit<WorldEvent,'id'>)=>world.addWorldEvent(e)} as WorldDynamics;
  const sandbox=new SandboxSystem(world,dynamics,42);
  const conversations={interrupt(){},isAgentInConversation:()=>false,startConversation:()=>false} as unknown as ConversationEngine;
  const players=new PlayerController(world,conversations,{execute(){}} as unknown as ActionExecutor,dynamics,sandbox);
  players.possess('architect-player','neo',0);sandbox.life.begin(world.agents.get('neo')!,0);sandbox.state.neoLife!.chapter=1;
  let tick=0,sequence=0,inputAt=Date.now();const command=(target:string)=>players.sandboxAction('architect-player',{kind:'life',target:'film:'+target},++tick);
  command('continue');const journey=sandbox.life.film.state!,neo=world.agents.get('neo')!,architect=world.agents.get('architect')!;
  Object.assign(journey,{scene:'m2_architect',actor:'neo',step:5,architect:{phase:'decision',sourceReviewed:true,trinityReviewed:true,remaining:45,lastTick:tick,attempts:0,room:{elapsed:3,chairYaw:.2}}});
  journey.reflections['m2_architect:4']='care';neo.currentLocation=FILM_SCENE_BY_ID.m2_architect.set;neo.position=filmPosition(neo.currentLocation,-8,-26);neo.health=37;
  journey.checkpoint=filmPosition(neo.currentLocation,0,-18);sandbox.state.profiles.neo.inventory.medkit=0;
  // Keep packet age deterministic while game time advances; CPU contention
  // must not turn a held movement test into the separate stale-input case.
  const frames=(seconds:number,running=true)=>{for(let f=0;f<Math.ceil(seconds/.1);f++){players.step(.1,running,tick,inputAt);if(running&&f%5===4)sandbox.tick(++tick);}};
  const input=(x:number,z:number)=>{const result=players.receiveInput('architect-player',{x,z,yaw:Math.PI,location:neo.currentLocation,sequence:++sequence});inputAt=Date.now();return result;};
  return{world,sandbox,players,journey,neo,architect,command,frames,input,tick:()=>tick};
}
test('opening the left door requires a real crossing and never skips the reveal, right door or supplies',()=>{
  const h=setup();h.command('act');h.input(0,-1);h.frames(1);
  assert.equal(h.journey.step,5);assert.equal(h.journey.architect!.door,undefined);
  assert.ok(playerBlocked(filmPosition(h.neo.currentLocation,-8,-27.5),true,.7,h.sandbox.state.structures));
  h.frames(1);assert.equal(h.journey.step,5);assert.ok(architectDoorAngle(h.journey.architect)>1.45);
  assert.equal(playerBlocked(filmPosition(h.neo.currentLocation,8,-27.5),true,.7,h.sandbox.state.structures),true);
  assert.equal(playerBlocked(filmPosition(h.neo.currentLocation,-8,-27.5),true,.7,h.sandbox.state.structures),false);
  h.neo.position=filmPosition(h.neo.currentLocation,-8,-26.35);h.input(0,-1);h.frames(1);
  assert.equal(h.journey.step,6);assert.equal(h.journey.architect!.door,'matrix');assert.equal(h.sandbox.life.state!.choices.architect_door,'matrix');
  assert.equal(h.neo.health,37);assert.equal(h.sandbox.state.profiles.neo.inventory.medkit,0);
});
test('partial door motion pauses, saves and resumes without advancing during release or an occupied Architect',()=>{
  const h=setup();h.command('act');h.frames(.6);const initial=structuredClone(h.journey.architect);
  h.frames(3,false);assert.deepEqual(h.journey.architect,initial);
  h.players.release('architect-player',h.tick());h.frames(3);assert.equal(h.journey.architect!.room!.exit!.elapsed,initial!.room!.exit!.elapsed);
  h.sandbox.restore(structuredClone(h.sandbox.state));h.players.possess('architect-player','neo',h.tick());
  const restored=h.sandbox.life.film.state!.architect!,age=restored.room!.exit!.elapsed;assert.equal(age,initial!.room!.exit!.elapsed);
  h.architect.controller='other-player';const position={...h.architect.position};h.frames(2);
  assert.equal(restored.room!.exit!.elapsed,age);assert.deepEqual(h.architect.position,position);assert.equal(h.architect.controller,'other-player');
  h.architect.controller=null;h.frames(1.5);assert.equal(restored.room!.exit!.elapsed,1.8);
  assert.equal(h.sandbox.life.film.state!.step,5);assert.equal(h.neo.health,37);
});
test('the signal deadline has an actual failure and local retry retains knowledge, philosophy and wounds',()=>{
  const h=setup();h.journey.architect!.remaining=1;h.sandbox.tick(h.tick()+3);
  assert.equal(h.journey.architect!.phase,'failed');assert.equal(h.journey.step,5);
  assert.match(h.command('act'),/重试/);assert.equal(h.journey.architect!.room!.exit,undefined);
  h.command('retry');assert.equal(h.journey.architect!.phase,'decision');assert.equal(h.journey.architect!.attempts,1);
  assert.equal(h.journey.architect!.sourceReviewed,true);assert.equal(h.journey.architect!.trinityReviewed,true);
  assert.equal(h.journey.reflections['m2_architect:4'],'care');assert.equal(h.neo.health,37);assert.equal(h.sandbox.state.profiles.neo.inventory.medkit,0);
});
test('an occupied or dead Architect is not moved, revived or bypassed by door interaction',()=>{
  const h=setup();h.architect.controller='other-player';h.architect.position=filmPosition(h.neo.currentLocation,6,-6);const position={...h.architect.position};
  assert.match(h.command('act'),/另一位玩家/);h.frames(2);assert.deepEqual(h.architect.position,position);assert.equal(h.journey.architect!.room!.exit,undefined);
  h.architect.controller=null;h.architect.status='dead';h.architect.health=0;h.frames(2);
  assert.match(h.command('act'),/无法继续/);assert.equal(h.architect.status,'dead');assert.equal(h.architect.health,0);assert.equal(h.journey.architect!.room!.exit,undefined);
});

test('cold restore retains the real room barriers and city traffic in their saved order',()=>{
  const h=setup();h.players.step(.1,true,h.tick());h.players.release('architect-player',h.tick());
  const saved=structuredClone(h.sandbox.state), before=structuredClone(h.sandbox.state.structures);
  h.sandbox.restore(saved);assert.deepEqual(h.sandbox.state.structures,before);
});

test('entering from the Source never heals or revives the existing Architect to stage the meeting',()=>{
  for(const dead of [false,true]){
    const h=setup();h.journey.scene='m2_key_door';h.journey.step=FILM_SCENE_BY_ID.m2_key_door.steps.length;delete h.journey.architect;
    h.neo.currentLocation=FILM_SCENE_BY_ID.m2_key_door.set;
    h.architect.health=dead?0:43;h.architect.status=dead?'dead':'alive';const before=structuredClone(h.architect);
    h.command('next');assert.equal(h.journey.scene,'m2_architect');
    assert.equal(h.architect.health,before.health,'the existing performer cannot be healed on entry');assert.equal(h.architect.status,before.status);
    if(dead)assert.deepEqual(h.architect.position,before.position,'a corpse cannot be moved into the chair');
  }
});

test('initialising an older Architect save does not move a dead performer into the chair',()=>{
  const h=setup();delete h.journey.architect;h.journey.step=1;
  h.architect.status='dead';h.architect.health=0;const before=structuredClone(h.architect);
  h.frames(.5);assert.deepEqual(h.architect.position,before.position);assert.equal(h.architect.status,'dead');assert.equal(h.architect.health,0);
});

test('a stale movement packet cannot carry Neo through the already open threshold',()=>{
  const h=setup();h.journey.architect!.room!.exit={elapsed:1.8,x:-8,z:-26};
  h.input(0,-1);const position={...h.neo.position};h.players.step(.1,true,h.tick(),Date.now()+400);
  assert.deepEqual(h.neo.position,position);assert.equal(h.journey.step,5);
});
