import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SETS, TV_EXIT, crosscutLocked, type PlayerInput, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import { MemoryManager } from '../packages/server/src/memory/MemoryManager.js';
import { RelationshipGraph } from '../packages/server/src/agents/RelationshipGraph.js';

function setup() {
  const world=new WorldState();new AgentManager(world).initializeAllAgents();
  const dynamics={record:(event:Omit<WorldEvent,'id'>)=>world.addWorldEvent(event)} as WorldDynamics;
  const sandbox=new SandboxSystem(world,dynamics,42);
  const players=new PlayerController(world,{interrupt(){},isAgentInConversation:()=>false} as unknown as ConversationEngine,{execute(){}} as unknown as ActionExecutor,dynamics,sandbox);
  const neo=world.agents.get('neo')!;players.possess('crosscut-player','neo',0);sandbox.life.begin(neo,0);sandbox.state.neoLife!.chapter=1;
  let tick=0,sequence=0;
  const state=()=>sandbox.life.film.state!,command=(target:string)=>players.sandboxAction('crosscut-player',{kind:'life',target:`film:${target}`},++tick);
  command('continue');Object.assign(state(),{scene:'m1_basement',actor:'neo',step:5,completed:['m1_basement'],checkpoint:{...neo.position}});
  neo.health=71;world.agents.get('mouse')!.status='dead';world.agents.get('mouse')!.health=0;sandbox.state.neoLife!.choices.morpheus_captured='sacrifice';
  command('next');assert.equal(state().scene,'m1_tv_exit');
  const frame=(input:Partial<PlayerInput>={},running=true)=>{const actor=players.getAgent('crosscut-player')!;players.receiveInput('crosscut-player',{x:0,z:0,yaw:actor.rotation,jump:false,sprint:false,sequence:++sequence,...input});players.step(.1,running,++tick);sandbox.tick(tick);};
  const wait=(check:()=>boolean,max=600)=>{for(let i=0;i<max&&!check();i++)frame();assert.ok(check(),state().lastText);};
  const phone=()=>{const center=FILM_SETS.film_tv_repair.center;neo.position={x:center.x+TV_EXIT.street.door.x,y:center.y,z:center.z+TV_EXIT.street.door.z};frame();neo.position={x:center.x+TV_EXIT.approach.x,y:center.y,z:center.z+TV_EXIT.approach.z};frame();command('act');};
  return {world,sandbox,players,neo,state,command,frame,wait,phone};
}

test('the ship assault causes the hardline failure before the two Matrix unplugging deaths',()=>{
  const h=setup();h.phone();h.wait(()=>h.players.getAgent('crosscut-player')!.id==='tank');
  assert.equal(h.state().scene,'m1_tv_exit');assert.equal(h.neo.isInMatrix,true);assert.equal(h.neo.currentLocation,'film_tv_repair');
  assert.equal(h.world.agents.get('dozer')!.status,'alive','Dozer cannot be dead before the visible assault');
  h.wait(()=>h.world.agents.get('dozer')!.status==='dead');assert.ok(h.world.agents.get('tank')!.health<100);
  const dozerFloor={...h.world.agents.get('dozer')!.position};
  assert.equal(h.world.agents.get('apoc')!.status,'alive');assert.equal(h.world.agents.get('switch')!.status,'alive');
  h.wait(()=>h.state().tvExit!.phase==='line_dead');assert.equal(h.players.getAgent('crosscut-player')!.id,'neo');assert.equal(h.neo.health,71);
  assert.deepEqual(h.world.agents.get('dozer')!.position,dozerFloor,'the real corpse must stay at its visible landing when the camera returns to the Matrix');
  h.command('act');h.wait(()=>h.world.agents.get('apoc')!.status==='dead');
  assert.equal(h.players.getAgent('crosscut-player')!.id,'neo','the actual pull cuts back to the Matrix fall');
  assert.equal(h.world.agents.get('apoc')!.isInMatrix,true);assert.equal(h.world.agents.get('apoc')!.currentLocation,'film_tv_repair');
  assert.equal(h.world.agents.get('switch')!.status,'alive');
  h.wait(()=>h.world.agents.get('switch')!.status==='dead');assert.equal(h.players.getAgent('crosscut-player')!.id,'neo');
  h.wait(()=>h.state().tvExit!.phase==='done');assert.equal(h.neo.isInMatrix,true);assert.equal(h.world.agents.get('trinity')!.isInMatrix,true);
});

test('both-world positions, injury and the shared intercut clock survive pause, disconnection and restore',()=>{
  const h=setup();h.phone();h.wait(()=>h.players.getAgent('crosscut-player')!.id==='tank');for(let i=0;i<14;i++)h.frame();
  const snapshot=()=>JSON.stringify({journey:h.state(),actors:['neo','trinity','apoc','switch','tank','dozer','cypher'].map(id=>{const a=h.world.agents.get(id)!;return {id,position:a.position,yaw:a.rotation,health:a.health,status:a.status,matrix:a.isInMatrix};})});
  const before=snapshot();h.frame({},false);assert.equal(snapshot(),before);h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));assert.equal(snapshot(),before);
  h.players.release('crosscut-player',0);const disconnected=snapshot();for(let i=0;i<10;i++)h.players.step(.1,true,i);assert.equal(snapshot(),disconnected);
  h.players.possess('crosscut-player','tank',0);const held=JSON.stringify(h.state().tvExit);h.world.agents.get('switch')!.controller='occupied';for(let i=0;i<10;i++)h.frame();
  assert.equal(h.state().tvExit!.elapsed,JSON.parse(held).elapsed);delete h.world.agents.get('switch')!.controller;
  assert.match(h.players.possess('other-player','cypher',0).error!,/背叛|撤离/);h.frame();assert.notEqual(h.state().tvExit!.elapsed,JSON.parse(held).elapsed);
});

test('Tank retries his counter with the same wound and the already lost crew, then actually exits Trinity before Neo',()=>{
  const h=setup();h.phone();h.wait(()=>h.state().tvExit!.phase==='line_dead');h.command('act');h.wait(()=>h.state().tvExit!.phase==='done');h.command('next');
  assert.equal(h.state().scene,'m1_unplugged');assert.equal(h.players.getAgent('crosscut-player')!.id,'tank');const wound=h.world.agents.get('tank')!.health;
  h.command('act');h.wait(()=>h.players.getAgent('crosscut-player')!.status==='dead');h.command('retry');assert.equal(h.world.agents.get('tank')!.health,wound);
  for(const id of ['dozer','apoc','switch','mouse'])assert.equal(h.world.agents.get(id)!.status,'dead');
  assert.equal(h.neo.health,71);h.command('act');h.wait(()=>h.state().betrayal!.phase==='window');h.command('act');h.wait(()=>h.state().betrayal!.phase==='reconnect');
  assert.equal(h.world.agents.get('cypher')!.status,'dead');h.command('act');assert.equal(h.players.getAgent('crosscut-player')!.id,'neo');
  const center=FILM_SETS.film_tv_repair.center;h.neo.position={x:center.x-4,y:center.y,z:center.z-17};h.frame();h.command('act');
  h.wait(()=>!h.world.agents.get('trinity')!.isInMatrix);assert.equal(h.neo.isInMatrix,true);assert.equal(h.state().betrayal!.phase,'reconnect');
  h.neo.position={x:center.x+TV_EXIT.approach.x,y:center.y,z:center.z+TV_EXIT.approach.z};h.frame();h.command('act');h.wait(()=>!h.neo.isInMatrix);
  assert.equal(h.state().betrayal!.phase,'done');assert.equal(h.state().actor,'neo');assert.equal(h.neo.health,71);assert.ok(h.state().completed.includes('m1_unplugged'));
  assert.equal(h.state().tvExit!.crosscut!.view,'ship','Neo is now physically back on the ship');assert.equal(crosscutLocked(h.state()),true);
  const seat={...h.neo.position};h.frame({x:1});assert.deepEqual(h.neo.position,seat,'a still-seated body cannot walk the connection chair across the deck');
  h.command('next');assert.equal(h.state().scene,'m1_rescue_decision');assert.equal(h.world.agents.get('tank')!.health,wound,'rescue preparation cannot erase the shipboard shot');
  for(const id of ['dozer','apoc','switch','mouse','cypher'])assert.equal(h.world.agents.get(id)!.status,'dead');
});

test('ordinary world ticks cannot heal the interrupted assault while no player owns its clock',()=>{
  const h=setup();h.phone();h.wait(()=>h.state().tvExit!.crosscut!.dozerDead);h.players.release('crosscut-player',0);
  const tank=h.world.agents.get('tank')!,wound=tank.health,elapsed=h.state().tvExit!.crosscut!.elapsed;
  tank.mind!.stress=0;
  const ordinary=h.world.agents.get('citizen_1')!,ordinaryWound=ordinary.maxHealth-10;ordinary.health=ordinaryWound;ordinary.mind!.stress=0;
  ordinary.currentAction={type:'idle',parameters:{},startedAt:0,duration:1e9,progress:0};
  const dynamics=new WorldDynamics(h.world,new MemoryManager(),new RelationshipGraph(),()=>{});dynamics.neoStory=true;
  for(let tick=1;tick<=20;tick++)dynamics.tick(tick);
  assert.equal(tank.health,wound,'a ship assault is not a rest action, even with a disconnected controller');
  assert.equal(h.state().tvExit!.crosscut!.elapsed,elapsed);assert.ok(ordinary.health>ordinaryWound,'ordinary rest still heals');
  h.sandbox.restore(structuredClone(h.sandbox.state));assert.equal(tank.health,wound);
});

test('a saved assault repairs health inflated by old rest ticks without reviving the counter failure',()=>{
  const h=setup();h.phone();h.wait(()=>h.state().tvExit!.crosscut!.tankHit);
  const tank=h.world.agents.get('tank')!;tank.health=tank.maxHealth;
  h.sandbox.restore(structuredClone(h.sandbox.state));assert.equal(tank.health,h.state().tvExit!.crosscut!.tankHealth);
  h.wait(()=>h.state().tvExit!.phase==='line_dead');h.command('act');h.wait(()=>h.state().tvExit!.phase==='done');h.command('next');
  h.command('act');h.wait(()=>tank.status==='dead');h.players.release('crosscut-player',0);
  h.sandbox.restore(structuredClone(h.sandbox.state));assert.equal(tank.status,'dead');assert.equal(tank.health,0);
});
