import assert from 'node:assert/strict';
import test from 'node:test';
import { BASEMENT, BASEMENT_ROLES, BASEMENT_BOILERS, BASEMENT_TUNNEL_LENGTH, TV_EXIT, TV_EXIT_STREET_ROLES, basementRouteLength, basementBlocked, basementTunnelRoot, tvExitEmergeRoot, tvExitStreetRoot, tvExitStreetRouteLength, wetwallPose, playerBlocked, filmEntry, filmGroundHeight, filmPosition, FILM_SETS, FILM_SCENE_BY_ID, WETWALL, WETWALL_ROLES, WETWALL_SHAFT, wetwallEntry,
  type PlayerInput, type WetwallEncounter, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  const neo = world.agents.get('neo')!;
  players.possess('escape-player', 'neo', 0); sandbox.life.begin(neo, 0); sandbox.state.neoLife!.chapter = 1;
  let tick = 0, sequence = 0;
  const command = (target: string) => players.sandboxAction('escape-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue');
  const starts = Object.fromEntries(WETWALL_ROLES.map(role => [role, { x: WETWALL.lanes[role], y: WETWALL_SHAFT.top, z: -26.9 }])) as WetwallEncounter['starts'];
  const wall = { phase: 'done', elapsed: 0, attempts: 0, freed: true, starts, progress: {} } as WetwallEncounter;
  for (const role of WETWALL_ROLES) wall.progress[role] = wetwallEntry(wall, role) + 29.6;
  wall.checkpoint = { progress: { ...wall.progress }, freed: true };
  const state = () => sandbox.life.film.state!;
  Object.assign(state(), { scene: 'm1_bathroom', actor: 'morpheus', step: 2, completed: ['m1_dejavu', 'm1_wetwall', 'm1_wall_exposed', 'm1_bathroom'],
    wetwall: wall, wallExposure: { phase: 'done', starts: Object.fromEntries(WETWALL_ROLES.map(role => [role, { ...starts[role], y: WETWALL_SHAFT.sixth, yaw: Math.PI }])) },
    betrayal: { kind: 'bathroom', phase: 'done', elapsed: 12, attempt: 0, sixth: true }, checkpoint: { ...neo.position } });
  for (const role of ['neo', 'apoc', 'switch', 'trinity', 'cypher'] as const) {
    const actor = world.agents.get(role)!, offset = role === 'neo' || role === 'trinity' ? 5.4 : role === 'cypher' ? 10.8 : 0;
    actor.position = { x: FILM_SETS.film_ambush_house.center.x + WETWALL.lanes[role], y: FILM_SETS.film_ambush_house.center.y + WETWALL_SHAFT.low + offset, z: FILM_SETS.film_ambush_house.center.z + WETWALL_SHAFT.bodyZ };
    actor.rotation = Math.PI; actor.currentLocation = 'film_ambush_house'; actor.isInMatrix = true;
  }
  neo.health = 71; world.agents.get('mouse')!.status = 'dead'; world.agents.get('mouse')!.health = 0;
  sandbox.state.neoLife!.choices.morpheus_captured = 'sacrifice';
  players.possess('escape-player', 'morpheus', tick);
  const frame = (input: Partial<PlayerInput> = {}, running = true) => {
    players.receiveInput('escape-player', { x: 0, z: 0, yaw: neo.rotation, pitch: 0, jump: false, sprint: false, sequence: ++sequence, ...input });
    players.step(.1, running, ++tick); sandbox.tick(tick);
  };
  const enter = () => { command('next'); assert.equal(state().scene, 'm1_basement'); };
  const descend = () => { command('act'); for (let i = 0; i < 400 && state().basement!.phase !== 'searching'; i++) frame({ climb: 1 }); assert.equal(state().basement!.phase, 'searching'); };
  const walk = (x: number, z: number, crouch = true) => {
    const set = FILM_SETS[FILM_SCENE_BY_ID[state().scene].set];
    for (let i = 0; i < 800; i++) {
      const dx = set.center.x + x - neo.position.x, dz = set.center.z + z - neo.position.z, gap = Math.hypot(dx, dz);
      if (gap < .35 || state().scene === 'm1_basement' && state().basement?.phase === 'done' && gap < .6) { frame({ crouch }); return; }
      frame({ x: dx / Math.max(.6, gap), z: dz / Math.max(.6, gap), yaw: Math.atan2(dx, dz), crouch });
      if (neo.status !== 'alive') break;
    }
    assert.fail(`could not walk to ${x}, ${z}; at ${neo.position.x - set.center.x}, ${neo.position.z - set.center.z}; ${state().lastText}; ${JSON.stringify(BASEMENT_ROLES.map(role => ({role, p:world.agents.get(role)!.position, progress:state().basement?.company[role]})))}`);
  };
  const findHatch = () => {
    for (const [x,z] of [[-18,-25],[-18,2],[0,2],[0,24],[9,22.5]]) walk(x,z);
    for (let i = 0; i < 200 && state().step !== 2; i++) frame({ crouch: true });
    assert.equal(state().step, 2);
  };
  return { world, sandbox, players, neo, command, frame, state, enter, descend, walk, findHatch, tick: () => tick };
}

test('the sixth-floor capture returns to Neo at his saved hanging height before the ship betrayal', () => {
  const h = setup(), before = ['neo', 'apoc', 'switch', 'trinity', 'cypher'].map(id => ({ ...h.world.agents.get(id)!.position }));
  h.command('next');
  assert.equal(h.state().scene, 'm1_basement', 'the mechanical-room escape cannot be replaced by a direct cut to Tank');
  assert.equal(h.players.getAgent('escape-player')!.id, 'neo');
  assert.equal(h.neo.health, 71, 'the return to Neo must retain his pipe injury');
  assert.deepEqual(['neo', 'apoc', 'switch', 'trinity', 'cypher'].map(id => h.world.agents.get(id)!.position), before);
  assert.equal(h.world.agents.get('mouse')!.status, 'dead');
  assert.equal(h.sandbox.state.neoLife!.choices.morpheus_captured, 'sacrifice');
});

test('the repaired escape route places the real hardline attempt before Cypher shipboard betrayal', () => {
  assert.ok(FILM_SCENE_BY_ID.m1_basement, 'the basement must have its own playable objectives');
  const scene = FILM_SCENE_BY_ID.m1_tv_exit;
  const set = FILM_SETS[scene.set];
  assert.ok(scene, 'Neo must attempt the television-shop hardline before the shipboard attack');
  assert.equal(scene.actor, 'neo');
  assert.notEqual(scene.set, 'film_neb_deck');
  assert.equal(scene.steps.length, 4, 'the street crossing and the shop aisle are separate playable objectives');
  assert.ok(filmEntry(scene).z > set.center.z + 32, 'the scene begins beside the street drain, outside the storefront');
  assert.equal(playerBlocked(filmPosition(scene.set, 0, 32), true), false, 'the visible shop doorway is a real opening');
  assert.equal(playerBlocked(filmPosition(scene.set, -11, 32), true), true, 'the display window cannot be walked through');
  for(const role of TV_EXIT_STREET_ROLES)for(let progress=0;progress<=tvExitStreetRouteLength(role);progress+=.2){const root=tvExitStreetRoot(role,progress);assert.equal(playerBlocked(filmPosition(scene.set,root.x,root.z),true),false,`${role} clips a facade or fixture at ${progress.toFixed(1)}`);}
});

test('the street mantle turns Neo toward his landing before he clears the manhole', () => {
  const middle=tvExitEmergeRoot('neo',.84),rim=tvExitEmergeRoot('neo',TV_EXIT.emerge.mantleEnd),landing=tvExitEmergeRoot('neo',.94);
  assert.ok(middle.y<TV_EXIT.emerge.mantleTop&&middle.y>TV_EXIT.emerge.climbTop,'the body rises while both palms remain in reach of the rim');
  assert.ok(middle.yaw>1.2&&middle.yaw<1.9,'the turn is visible halfway through the mantle instead of being deferred to the final step');
  assert.ok(Math.abs(rim.yaw-Math.PI)<.001&&Math.abs(landing.yaw-Math.PI)<.001,'the body faces the landing before translating across solid road');
  for(const progress of [.76,.8,.84,.88,.92]){const root=tvExitEmergeRoot('neo',progress);assert.ok(Math.hypot(root.x-TV_EXIT.street.drain.x,root.z-TV_EXIT.street.drain.z)<=TV_EXIT.emerge.mantleRadius+.01,`body leaves the aperture at ${progress}`);}
});

test('an old save already inside the repair shop resumes at the aisle instead of returning to the new street entrance', () => {
  const h=setup();h.enter();const state=h.state(),inside=filmPosition('film_tv_repair',8.5,26);
  state.scene='m1_tv_exit';state.actor='neo';state.step=0;state.checkpoint={...inside};state.tvExit={phase:'ready',elapsed:0,crosscut:{phase:'phone',elapsed:0,view:'matrix',attempts:0,tankHealth:100,tankHit:false,dozerDead:false,apocDead:false,switchDead:false,cypherDead:false,trinityOut:false,neoOut:false}};
  h.neo.position={...inside};h.neo.currentLocation='film_tv_repair';h.neo.isInMatrix=true;h.frame();
  assert.equal(state.step,1);assert.deepEqual(h.neo.position,inside,'migration must preserve the saved player position');
  for(const role of ['trinity','apoc','switch'] as const)assert.equal(state.tvExit!.street![role],tvExitStreetRouteLength(role));
});

test('a fresh repair-shop transition keeps all four survivors in the saved exit shaft until the player climbs them out', () => {
  const h=setup();h.enter();h.state().basement!.phase='done';h.state().step=5;h.command('next');
  const encounter=h.state().tvExit!;
  const center=FILM_SETS.film_tv_repair.center,roles=['neo','trinity','apoc','switch'] as const;
  assert.equal(encounter.phase,'emerging');
  assert.ok(roles.every(role=>h.world.agents.get(role)!.position.y<center.y-2),'the cut cannot place anyone on the road before they climb');
  const waiting=JSON.stringify({encounter,cast:roles.map(role=>h.world.agents.get(role)!.position)});
  for(let i=0;i<20;i++)h.frame();
  assert.equal(JSON.stringify({encounter,cast:roles.map(role=>h.world.agents.get(role)!.position)}),waiting,'waiting must grip the ladder at the saved rung');
  for(let i=0;i<20;i++)h.frame({climb:1});
  assert.ok((encounter.emerge?.neo??0)>0,'W advances Neo on the physical ladder');
  assert.equal(encounter.emerge?.trinity,0,'the queued survivor does not occupy Neo’s body');
  const snapshot=()=>JSON.stringify({phase:h.state().tvExit!.phase,elapsed:h.state().tvExit!.elapsed,emerge:h.state().tvExit!.emerge,cast:roles.map(role=>h.world.agents.get(role)!.position)});
  const held=snapshot();h.frame({climb:1},false);assert.equal(snapshot(),held);
  h.sandbox.restore(structuredClone(h.sandbox.state));assert.equal(snapshot(),held);
  h.players.release('escape-player',h.tick());for(let i=0;i<12;i++)h.players.step(.1,true,h.tick());assert.equal(snapshot(),held,'disconnecting cannot advance the climb');
  h.players.possess('escape-player','neo',h.tick());h.world.agents.get('trinity')!.controller='occupied';for(let i=0;i<12;i++)h.frame({climb:1});assert.equal(snapshot(),held,'an occupied companion freezes the shared shaft');delete h.world.agents.get('trinity')!.controller;
  for(let i=0;i<800&&h.state().tvExit!.phase!=='ready';i++)h.frame({climb:1});
  assert.equal(h.state().tvExit!.phase,'ready');
  assert.ok(roles.every(role=>h.state().tvExit!.emerge?.[role]===1));
  for(let a=0;a<roles.length;a++)for(let b=a+1;b<roles.length;b++){
    const p=h.world.agents.get(roles[a])!.position,q=h.world.agents.get(roles[b])!.position;
    assert.ok(Math.hypot(p.x-q.x,p.z-q.z)>2.2,`${roles[a]} and ${roles[b]} overlap after leaving the shaft`);
  }
});


test('Neo controls the continued descent, while the crew clears the basement ceiling in their saved order', () => {
  const h = setup(); h.enter(); h.command('act'); const before = h.neo.position.y;
  for (let i = 0; i < 10; i++) h.frame(); assert.equal(h.neo.position.y, before, 'waiting grips the pipe rather than descending automatically');
  for (let i = 0; i < 70; i++) h.frame({ climb: 1 });
  assert.ok(h.neo.position.y < before - 18); assert.ok(h.neo.position.y < WETWALL_SHAFT.low);
  const gesture = h.neo.currentAction!.parameters.wetwall as Parameters<typeof wetwallPose>[0] & { start: Parameters<typeof wetwallPose>[0]; role: 'neo'; progress: number; phase: 'done'; elapsed: number; continued: boolean };
  assert.ok(gesture.continued); assert.equal(wetwallPose(gesture.start, 'neo', gesture.progress, 'done', 0, undefined, true).y, h.neo.position.y - FILM_SETS.film_ambush_house.center.y);
  const held=h.neo.position.y;h.frame();assert.equal(h.neo.position.y,held,'releasing W preserves the exact pipe height while the client settles the grip');
  for (let i = 0; i < 350 && h.state().basement!.phase !== 'searching'; i++) h.frame({ climb: 1 });
  assert.equal(h.state().basement!.phase, 'searching'); assert.equal(h.state().step, 1);
  for (const role of BASEMENT_ROLES) { const actor = h.world.agents.get(role)!; assert.equal(actor.position.y, FILM_SETS.film_ambush_house.center.y + BASEMENT.floor); assert.equal(playerBlocked(actor.position, true), false); }
  assert.equal(h.neo.health, 71);
});

test('letting go fails by gravity and retries at the original pipe height without undoing deaths or capture', () => {
  const h = setup(); h.enter(); const before = { ...h.neo.position }; h.command('act'); h.frame({ climb: 1, jump: true });
  for (let i = 0; i < 40 && h.neo.status !== 'dead'; i++) h.frame();
  assert.equal(h.neo.status, 'dead'); assert.equal(h.state().basement!.failure, 'fall');
  h.command('retry'); assert.deepEqual(h.neo.position, before); assert.equal(h.state().basement!.phase, 'ready');
  assert.equal(h.state().basement!.attempts, 1); assert.equal(h.world.agents.get('mouse')!.status, 'dead');
  assert.equal(h.sandbox.state.neoLife!.choices.morpheus_captured, 'sacrifice');
});

test('smoke has a real exposure cost, crouching buys time, and failure resumes at the boiler-room checkpoint', () => {
  const h = setup(); h.enter(); h.descend();
  for (let i = 0; i < 100; i++) h.frame(); const standing = h.state().basement!.air;
  h.state().basement!.air = 100; h.state().basement!.gas = 0;
  for (let i = 0; i < 100; i++) h.frame({ crouch: true });
  assert.ok(h.state().basement!.air > standing + 5);
  for (let i = 0; i < 600 && h.neo.status !== 'dead'; i++) h.frame(); assert.equal(h.neo.status, 'dead');
  assert.equal(h.state().basement!.failure, 'gas'); h.command('retry');
  assert.equal(h.state().basement!.phase, 'searching'); assert.equal(h.state().step, 1); assert.equal(h.state().basement!.air, 100);
  assert.equal(h.neo.position.y, FILM_SETS.film_ambush_house.center.y + BASEMENT.floor); assert.equal(h.world.agents.get('mouse')!.status, 'dead');
});

test('basement smoke comes from saved launchers, which freeze with the company and cannot fire after being removed', () => {
  const h=setup();h.enter();h.descend();
  const launchers=()=>h.sandbox.state.threats.filter(threat=>threat.scene==='m1_basement');
  assert.equal(launchers().length,3,'three actual gas-masked attackers must precede the canisters');
  assert.ok(launchers().every(threat=>threat.patrol),'ordinary threat AI cannot advance the scripted smoke during a pause');
  const first=launchers()[0];h.sandbox.state.threats=h.sandbox.state.threats.filter(threat=>threat!==first);
  for(let i=0;i<60;i++)h.frame();
  assert.equal((h.state().basement as any).gasShots[0],false,'a removed attacker cannot launch an invisible canister');
  assert.equal(h.state().basement!.air,100,'an unfired canister cannot emit gas');
  assert.equal(launchers().length,2,'the staging pass cannot respawn a removed attacker');
  const snapshot=()=>JSON.stringify({basement:h.state().basement,launchers:launchers()});
  const held=snapshot();h.frame({},false);assert.equal(snapshot(),held);
  h.sandbox.restore(structuredClone(h.sandbox.state));assert.equal(snapshot(),held,'restoring must preserve the launch decisions and attack clock');
  h.players.release('escape-player',h.tick());for(let i=0;i<12;i++)h.players.step(.1,true,h.tick());assert.equal(snapshot(),held);
  h.players.possess('escape-player','neo',h.tick());h.world.agents.get('trinity')!.controller='occupied';h.frame();
  const occupied=snapshot();for(let i=0;i<12;i++)h.frame();assert.equal(snapshot(),occupied);delete h.world.agents.get('trinity')!.controller;
});

test('new basement retries reset the launch sequence while old floor saves keep their original smoke clock',()=>{
  const h=setup();h.enter();h.descend();
  for(let i=0;i<30;i++)h.frame();assert.equal(h.state().basement!.gasShots?.[0],true);
  h.state().basement!.air=.01;for(let i=0;i<100&&h.neo.status!=='dead';i++)h.frame();assert.equal(h.neo.status,'dead');
  h.command('retry');assert.deepEqual(h.state().basement!.gasShots,[]);assert.equal(h.state().basement!.gas,0);
  assert.equal(h.sandbox.state.threats.filter(threat=>threat.scene==='m1_basement').length,3);
  const old=setup();old.enter();delete old.state().basement!.gasShots;old.descend();old.state().basement!.gas=9;
  const air=old.state().basement!.air;old.frame();assert.ok(old.state().basement!.air<air,'legacy smoke must retain its exposure instead of waiting for new launchers');
  assert.equal(old.sandbox.state.threats.filter(threat=>threat.scene==='m1_basement').length,0,'legacy saves cannot replay a new launch sequence');
});

test('ordinary movement must follow the company, open the real grate and traverse the low turning drain before the TV-shop cut', () => {
  const h = setup(); h.enter(); h.descend(); h.findHatch();
  const before = { ...h.neo.position }; h.command('next'); assert.equal(h.state().scene, 'm1_basement'); assert.deepEqual(h.neo.position, before);
  h.command('act'); for (let i = 0; i < 60; i++) h.frame({ crouch: true });
  assert.equal(h.state().basement!.phase, 'hatch_ready'); assert.equal(h.state().basement!.hatch, 1);
  for (let i = 0; i < 160 && ['apoc','switch'].some(role => h.state().basement!.company[role as 'apoc'|'switch'] < basementRouteLength(role as 'apoc'|'switch') - .05); i++) h.frame({ crouch: true });
  h.command('act'); assert.equal(h.state().basement!.phase, 'draining');
  for (let i = 0; i < 450 && h.state().basement!.phase !== 'tunnel'; i++) {
    h.frame();
    const crew=BASEMENT_ROLES.filter(role=>role!=='cypher');
    for(let a=0;a<crew.length;a++)for(let b=a+1;b<crew.length;b++){
      const p=h.world.agents.get(crew[a])!.position,q=h.world.agents.get(crew[b])!.position;
      assert.ok(Math.abs(p.y-q.y)>=3.6||Math.hypot(p.x-q.x,p.z-q.z)>=2.25,`drain queue overlaps ${crew[a]} and ${crew[b]} at ${h.state().basement!.elapsed.toFixed(1)}`);
    }
  }
  assert.equal(h.state().basement!.phase, 'tunnel'); assert.equal(h.state().step, 4); assert.equal(h.neo.position.y, FILM_SETS.film_ambush_house.center.y + BASEMENT.tunnelFloor);
  h.walk(9,30); h.walk(0,30); h.walk(0,32.2);
  assert.equal(h.state().basement!.phase, 'done'); assert.ok(h.state().basement!.tunnel > BASEMENT_TUNNEL_LENGTH - .6);
  h.command('next'); assert.equal(h.state().scene, 'm1_tv_exit'); assert.equal(h.state().actor, 'neo'); assert.equal(h.neo.health, 71);
  assert.equal(h.world.agents.get('cypher')!.isInMatrix,false,'Cypher has already taken a different exit before the TV-shop hardline fails');
  assert.equal(h.world.agents.get('cypher')!.currentLocation,'film_neb_deck');
  assert.match(h.players.possess('other-player','cypher',h.tick()).error!,/撤离/);
  const shop=FILM_SETS.film_tv_repair;
  assert.equal(h.state().tvExit!.phase,'emerging');assert.equal(h.state().step,0);
  for(let i=0;i<800&&h.state().tvExit!.phase!=='ready';i++)h.frame({climb:1});
  assert.equal(h.state().tvExit!.phase,'ready');
  for(const role of ['trinity','apoc','switch'] as const)assert.ok(h.world.agents.get(role)!.position.z>shop.center.z+32,'the surviving crew physically emerges on the street with Neo');
  const trinityStart={...h.world.agents.get('trinity')!.position};
  h.walk(TV_EXIT.street.curb.x,TV_EXIT.street.curb.z);h.walk(TV_EXIT.street.door.x,TV_EXIT.street.door.z);
  assert.equal(h.state().step,1);assert.ok(h.world.agents.get('trinity')!.position.z<trinityStart.z,'Trinity walks from the drain instead of teleporting into the shop');
  h.walk(8.5,4); h.walk(8.5,-8); h.walk(TV_EXIT.approach.x,TV_EXIT.approach.z);
  assert.equal(h.state().step,2); h.command('act'); assert.equal(h.state().tvExit!.phase,'pickup');
  for(const role of ['trinity','apoc','switch'] as const){const actor=h.world.agents.get(role)!,root=TV_EXIT.cast[role];assert.ok(Math.hypot(actor.position.x-shop.center.x-root.x,actor.position.z-shop.center.z-root.z)<.01);}
  h.world.agents.get('cypher')!.controller='occupied';
  for(let i=0;i<5;i++)h.frame();assert.equal(h.state().tvExit!.elapsed,0,'an occupied remote caller cannot be pulled into the phone performance');
  delete h.world.agents.get('cypher')!.controller;
  for(let i=0;i<120&&h.state().tvExit!.phase!=='line_dead';i++)h.frame(); assert.equal(h.state().tvExit!.phase,'line_dead'); assert.equal(h.neo.isInMatrix,true);
  h.command('next'); assert.equal(h.state().scene,'m1_tv_exit'); h.command('act'); for(let i=0;i<250&&h.state().tvExit!.phase!=='done';i++)h.frame();
  assert.equal(h.state().tvExit!.phase,'done'); h.command('next'); assert.equal(h.state().scene,'m1_unplugged'); assert.equal(h.players.getAgent('escape-player')!.id,'tank');
});

test('descent and smoke freeze on pause, disconnection, occupied company and restored checkpoints', () => {
  const h = setup(); h.enter(); h.command('act'); for(let i=0;i<30;i++)h.frame({climb:1});
  const snapshot=()=>JSON.stringify({escape:h.state().basement,cast:BASEMENT_ROLES.map(role=>h.world.agents.get(role)!.position)});
  const before=snapshot(); h.frame({climb:1},false); assert.equal(snapshot(),before);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); assert.equal(snapshot(),before);
  h.players.release('escape-player',h.tick()); for(let i=0;i<12;i++)h.players.step(.1,true,h.tick()); assert.equal(snapshot(),before);
  h.players.possess('escape-player','neo',h.tick()); h.world.agents.get('trinity')!.controller='occupied'; h.frame({climb:1}); const held=snapshot();
  for(let i=0;i<12;i++)h.frame({climb:1}); assert.equal(snapshot(),held); delete h.world.agents.get('trinity')!.controller;
  assert.match(h.players.possess('other-player','apoc',h.tick()).error!,/旧楼撤离/); h.frame({climb:1}); assert.ok(h.neo.position.y<JSON.parse(held).cast[0].y);
});

test('the basement shares real boiler footprints, floor heights and drain corners with collision', () => {
  const set=FILM_SETS.film_ambush_house, point=(x:number,y:number,z:number)=>({x:set.center.x+x,y:set.center.y+y,z:set.center.z+z});
  for(const boiler of BASEMENT_BOILERS)assert.equal(playerBlocked(point(boiler.x,BASEMENT.floor,boiler.z),true),true);
  assert.equal(playerBlocked(point(BASEMENT.grate.x,BASEMENT.floor,BASEMENT.grate.z),true),true,'walking cannot fall into or pass through the grate');
  assert.equal(filmGroundHeight(point(0,BASEMENT.floor,2),set),set.center.y+BASEMENT.floor);
  for(let progress=0;progress<=BASEMENT_TUNNEL_LENGTH;progress+=.2){const root=basementTunnelRoot(progress);assert.equal(basementBlocked(root.x,root.y,root.z,.65),false);assert.equal(filmGroundHeight(point(root.x,root.y,root.z),set),set.center.y+BASEMENT.tunnelFloor);}
  assert.equal(basementBlocked(0,BASEMENT.tunnelFloor,20,.65),true);
});
