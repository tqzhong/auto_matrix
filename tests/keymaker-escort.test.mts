import assert from 'node:assert/strict';
import test from 'node:test';
import { EXILES, FILM_SCENE_BY_ID, FILM_SETS, filmPosition, filmStepPosition, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup(health?: number) {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (_event: Omit<WorldEvent, 'id'>) => undefined } as WorldDynamics;
  const sandbox = new SandboxSystem(world,dynamics,42), players = new PlayerController(world,
    { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine, { execute() {} } as unknown as ActionExecutor,dynamics,sandbox);
  const neo = world.agents.get('neo')!, captive = world.agents.get('keymaker')!, scene = FILM_SCENE_BY_ID.m2_library;
  players.possess('player','neo',0); sandbox.life.begin(neo,0); sandbox.state.neoLife!.chapter = 1;
  let tick = 0;
  const command = (target: string) => players.sandboxAction('player',{ kind: 'life',target: `film:${target}` },++tick);
  command('continue'); const state = sandbox.life.film.state!;
  Object.assign(state,{ scene: 'm2_persephone',step: FILM_SCENE_BY_ID.m2_persephone.steps.length,actor: 'neo' });
  if(health!==undefined)captive.health=health; command('next');
  const frame = (dt = .1) => sandbox.life.film.keymakerFrame(neo,dt,++tick);
  const follow = () => { state.step = 3; state.keymaker!.phase = 'revealed'; neo.position = filmStepPosition(scene,scene.steps[3]); command('act'); for(let i=0;i<7;i++)sandbox.tick(++tick); assert.equal(state.step,4); };
  return { world,sandbox,players,neo,captive,scene,state,command,frame,follow };
}

test('a moving Keymaker publishes his actual stride and returns to idle when he catches up', () => {
  const h = setup(); h.follow(); h.captive.health = 23; h.neo.position = filmPosition(h.scene.set,-8,-22);
  const before = { ...h.captive.position }; h.frame(); const dx = h.captive.position.x-before.x, dz = h.captive.position.z-before.z;
  assert.ok(Math.hypot(dx,dz)>.1);
  assert.ok(Math.abs(h.captive.velocity.x-dx/.1)<1e-8&&Math.abs(h.captive.velocity.z-dz/.1)<1e-8,'the delivered walk animation must receive the actual movement velocity');
  assert.equal(h.captive.currentAction?.type,'move_to');
  for(let i=0;i<90;i++)h.frame(); assert.equal(h.captive.currentAction?.type,'idle'); assert.equal(h.captive.velocity.x,0); assert.equal(h.captive.velocity.z,0); assert.equal(h.captive.health,23);
});

for (const reverse of [false,true]) test(`diagonal escort uses the actual bookcase opening ${reverse?'into':'out of'} the workshop`, () => {
  const h = setup(); h.follow(); const state = h.state.keymaker!, start = reverse ? { x:-8,z:-13 } : { x:0,z:-25 }, goal = reverse ? { x:0,z:-23 } : { x:2,z:-14 };
  Object.assign(state,start); h.captive.position = filmPosition(h.scene.set,start.x,start.z); h.neo.position = filmPosition(h.scene.set,goal.x,goal.z);
  const misses: unknown[] = [];
  for(let i=0;i<100;i++) { const before={...h.captive.position};h.frame();if(playerBlocked(h.captive.position,true,.8,h.sandbox.state.structures))misses.push({i,x:state.x,z:state.z});assert.ok(Math.hypot(h.captive.position.x-before.x,h.captive.position.z-before.z)<=EXILES.followSpeed*.1+1e-8); }
  assert.equal(misses.length,0,JSON.stringify(misses.slice(0,6)));
  assert.ok(Math.hypot(state.x-goal.x,state.z-goal.z)<=2.71,'Keymaker must reach the leader through the doorway'); assert.equal(state.phase,'following');
});

test('paused player frames and reconnect do not rewrite the saved Keymaker stride or action clock', () => {
  const h = setup(); h.follow(); h.neo.position=filmPosition(h.scene.set,-8,-22);h.frame();
  const before=JSON.stringify(h.captive), encounter=JSON.stringify(h.state.keymaker);h.frame(0);
  assert.ok(JSON.stringify(h.captive)===before,'zero-time reconciliation must retain the complete saved actor');assert.equal(JSON.stringify(h.state.keymaker),encounter);
  h.players.release('player',999);h.players.possess('player','neo',999);assert.ok(JSON.stringify(h.captive)===before,'reconnecting Neo must retain the companion pose, velocity and action');
});

test('entry and checkpoint retry preserve Keymaker wounds and the current escort instead of restaging the cast', () => {
  const h=setup(23);assert.equal(h.captive.health,23);h.follow();h.neo.position=filmPosition(h.scene.set,-8,-22);h.frame();
  h.world.agents.get('cain')!.status='dead';const before=JSON.stringify(h.captive), encounter=JSON.stringify(h.state.keymaker);h.command('retry');
  assert.ok(JSON.stringify(h.captive)===before,'retry must not move or heal the rescued companion');assert.equal(JSON.stringify(h.state.keymaker),encounter);assert.equal(h.world.agents.get('cain')!.status,'dead');
});

test('a dead, remote or player-controlled Keymaker stays unavailable without resurrection or false escape', () => {
  for(const unavailable of ['dead','remote','controller']) {
    const h=setup();h.follow();h.neo.position=filmPosition(h.scene.set,EXILES.escape.x,EXILES.escape.z);
    Object.assign(h.state.keymaker!,{x:EXILES.escape.x,z:EXILES.escape.z});h.captive.position={...h.neo.position};
    if(unavailable==='dead'){h.captive.status='dead';h.captive.health=0;}else if(unavailable==='remote'){h.captive.currentLocation='film_le_vrai';h.captive.position=filmPosition('film_le_vrai',0,0);}else h.captive.controller='another-player';
    const before=JSON.stringify(h.captive), encounter=JSON.stringify(h.state.keymaker);h.frame();h.sandbox.tick(999);
    assert.ok(JSON.stringify(h.captive)===before,unavailable+': do not replace the actual companion');assert.equal(JSON.stringify(h.state.keymaker),encounter);assert.equal(h.state.step,4);assert.equal(h.sandbox.state.neoLife!.choices.keymaker_rescued,undefined);
  }
});

test('the original escort position can be adopted from an older save without moving the captive on load', () => {
  const h=setup();h.follow();const center=FILM_SETS[h.scene.set].center;Object.assign(h.state.keymaker!,{x:-8,z:-20});h.captive.position={x:center.x-8,y:1,z:center.z-20};
  h.captive.health=23;h.captive.currentAction={type:'idle',parameters:{resolved:true,keymakerEscort:'following'},startedAt:7,duration:1,progress:.4};
  const before=JSON.stringify(h.captive);h.frame(0);assert.ok(JSON.stringify(h.captive)===before,'retain every field in an already positioned legacy actor');
  h.neo.position=filmPosition(h.scene.set,-8,-14);h.frame();assert.ok(h.captive.position.z>center.z-20);assert.equal(h.captive.health,23);
});

test('identification and departure wait for the actual available Keymaker', () => {
  const h=setup();h.follow();h.state.step=3;h.state.keymaker!.phase='revealed';h.captive.controller='another-player';h.neo.position=filmStepPosition(h.scene,h.scene.steps[3]);
  h.command('act');assert.equal(h.state.started,undefined);for(let i=0;i<9;i++)h.sandbox.tick(100+i);assert.equal(h.state.step,3);
  h.state.step=h.scene.steps.length;h.state.keymaker!.phase='escaped';h.command('next');assert.equal(h.state.scene,'m2_library');
});

test('a released player-controlled companion resumes from his actual position and retains wounds into the hall', () => {
  const h=setup(23);h.follow();h.captive.position=filmPosition(h.scene.set,-8,-20);h.captive.currentAction=null;h.neo.position=filmPosition(h.scene.set,-8,-14);h.frame();
  assert.ok(h.state.keymaker!.z>-20&&h.state.keymaker!.z<-19.5);assert.equal(h.state.keymaker!.x,-8);
  h.state.step=h.scene.steps.length;h.state.keymaker!.phase='escaped';h.command('next');assert.equal(h.state.scene,'m2_chateau');assert.equal(h.captive.health,23);
});
