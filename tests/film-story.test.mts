import { FREEWAY_HANDOFF, freewayHandoffReady } from '@auto_matrix/shared';
import { SOURCE_BRIEFING } from '@auto_matrix/shared';
import { HAMMER_BRIEFING } from '@auto_matrix/shared';
import { ZION_DEPLOYMENT } from '@auto_matrix/shared';
import { MAGGIE_DISCOVERY } from '@auto_matrix/shared';
import { PRIMARY_DEMOLITION } from '@auto_matrix/shared';
import { TRUCK_HOOD } from '@auto_matrix/shared';
import { DEUS_PACT, DIGGERS, diggerEye, diggerShield } from '@auto_matrix/shared';
import { DOCK_GATE, dockGateEye, DOCK_RELOAD, DOCK_LAST_STAND } from '@auto_matrix/shared';
import { TV_EXIT, basementRouteLength } from '@auto_matrix/shared';
import { CABIN, CABIN_ROUTE_LENGTH, cabinGuidePose, RELOADED, RELOADED_FINALE } from '@auto_matrix/shared';
import { dockGunneryTarget } from '@auto_matrix/shared';
import assert from 'node:assert/strict';
import { mirrorEntryPose, awakeningDuration } from '@auto_matrix/shared';
import { AMBUSH_STAIRS } from '@auto_matrix/shared';
import test from 'node:test';
import { FILM_SETS, FILM_SCENES, FILM_SCENE_BY_ID, FILM_CAST, NEO_CHAPTERS, CHARACTERS, RESCUE, RESCUE_LOADOUTS, GOVERNMENT_RESCUE, AIR_RESCUE, MATRIX_ESCAPE, THE_ONE, SMITH_FINALE, OPENING_HOTEL, OPENING_ESCAPE, PILL_ROOM, PILL_TIMING, MIRROR_TOUCH, MIRROR_SEAT, MIRROR_TRINITY, MIRROR_TIMING, DOCK_GUNNERY, awakeningPose, mirrorSilver, filmReflections, filmStepActionReady, filmStepPosition, filmEntry, filmPosition, groundHeight, playerBlocked, stepPlayer, newFreewayRide, stepFreeway, freewayTraffic, newGarageEscape, stepGarageEscape, ambushCat, neoSkillUnlocked, type AgentState, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import { musicForScene } from '../packages/client/src/engine/Soundtrack.js';
import { HOTEL_ROUTE, HOTEL_DOOR_PROGRESS } from '@auto_matrix/shared';
import { hammerCenter, LOGOS_DEFENSE, AMBUSH_CAT_STAIRS } from '@auto_matrix/shared';
import { TRUCKS, truckApproachPose, truckRescuePose, type TruckEncounter, type TruckRescueRole, type WorldStructure } from '@auto_matrix/shared';
import { freewayAvoidanceTarget, freewayDriveInput } from './helpers/freeway-driver.mjs';
import { NEB_CREW, NEB_ESCAPE } from '@auto_matrix/shared';
import { MOBIL_FAMILY_QUESTIONS, TRAINMAN_CHASE } from '@auto_matrix/shared';
import { HEL_ELEVATOR } from '@auto_matrix/shared';
import { ORACLE_LAST, oracleLastLines, distance } from '@auto_matrix/shared';
import { BANE_INQUIRY, baneInquiryLines } from '@auto_matrix/shared';
import { ORACLE_ABSORPTION } from '@auto_matrix/shared';

function setup() {
  const world = new WorldState(); const manager = new AgentManager(world); manager.initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false, startConversation: () => false } as unknown as ConversationEngine;
  const attacked: string[] = [];
  const actions = { execute: (_actor: AgentState, action: { target?: string }) => attacked.push(action.target ?? '') } as unknown as ActionExecutor;
  const players = new PlayerController(world, conversations, actions, dynamics, sandbox);
  players.possess('film-player', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0);
  sandbox.state.neoLife!.chapter = 1;
  let tick = 0;
  const command = (target: string) => players.sandboxAction('film-player', { kind: 'life', target: `film:${target}` }, ++tick);
  const advance = (amount = 1) => { for (let i = 0; i < amount; i++) sandbox.tick(++tick); };
  return { world, manager, sandbox, players, command, advance, attacked, actor: () => players.getAgent('film-player')!, tick: () => tick };
}

function completePrimary(h: ReturnType<typeof setup>, nextSequence: () => number) {
  const state = h.sandbox.life.film.state!, scene = FILM_SCENE_BY_ID.m2_power;
  const frames = (count: number, focus = false) => {
    for (let frame = 0; frame < count; frame++) {
      h.players.receiveInput('film-player', { x: 0, z: 0, yaw: h.actor().rotation, focus, location: scene.set, sequence: nextSequence() });
      h.players.step(.1, true, h.tick()); if (frame % 5 === 4) h.advance();
    }
  };
  for (const site of PRIMARY_DEMOLITION.sites) {
    h.actor().position = filmPosition(scene.set, site.x, site.z); h.command('act'); frames(23, true);
    assert.ok(state.primaryDemolition!.installed.includes(site.id));
  }
  frames(12); h.command('act'); assert.equal(state.primaryDemolition?.phase, 'retreat');
  frames(20); h.actor().position = filmStepPosition(scene, scene.steps[1], state); h.command('act'); assert.equal(state.primaryDemolition?.phase, 'done');
}

function completeTerminal(h: ReturnType<typeof setup>, nextSequence: () => number) {
  const state = h.sandbox.life.film.state!, scene = FILM_SCENE_BY_ID.m2_backup;
  h.actor().position = filmStepPosition(scene, scene.steps[1], state); h.command('act');
  for (let frame = 0; frame < 35; frame++) { h.players.step(.1, true, h.tick()); if (frame % 5 === 4) h.advance(); }
  assert.equal(state.trinityTerminal?.phase, 'selecting'); h.command('terminal:select:ssh');
  for (let frame = 0; frame < 42; frame++) {
    h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, focus: true, location: scene.set, sequence: nextSequence() });
    h.players.step(.1, true, h.tick()); if (frame % 5 === 4) h.advance();
  }
  h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, focus: false, location: scene.set, sequence: nextSequence() });
  assert.equal(state.trinityTerminal?.phase, 'armed'); h.command('act'); assert.equal(state.trinityTerminal?.phase, 'deployed');
}

function portalFrames(h: ReturnType<typeof setup>, count: number) {
  for (let frame = 0; frame < count; frame++) { h.players.step(.1, true, h.tick()); if (frame % 5 === 4) h.advance(); }
}
function completeTrainmanChase(h: ReturnType<typeof setup>, nextSequence: () => number) {
  const scene = FILM_SCENE_BY_ID.m3_trainman_chase, state = h.sandbox.life.film.state!;
  const walk = (x: number, z: number) => {
    const target = filmPosition(scene.set, x, z);
    for (let frame = 0; Math.hypot(h.actor().position.x - target.x, h.actor().position.z - target.z) > .4 && frame < 240; frame++) {
      const dx = target.x - h.actor().position.x, dz = target.z - h.actor().position.z, length = Math.hypot(dx, dz);
      h.players.receiveInput('film-player', { x: dx / Math.max(1.5, length), z: dz / Math.max(1.5, length), yaw: Math.atan2(dx, dz), sprint: true, sequence: nextSequence() });
      h.players.step(.1, true, h.tick()); if (frame % 5 === 4) h.advance();
    }
    assert.ok(Math.hypot(h.actor().position.x - target.x, h.actor().position.z - target.z) <= .4, `reachable Trainman route ${x}/${z}`);
    h.players.receiveInput('film-player', { x: 0, z: 0, yaw: h.actor().rotation, sequence: nextSequence() }); portalFrames(h, 2);
  };
  walk(TRAINMAN_CHASE.question.x, TRAINMAN_CHASE.question.z); h.command('act'); portalFrames(h, 100);
  assert.equal(state.step, 1);
  for (const [x, z] of [[-30, 20], [-20.5, 20], [-17, 12], [-17, -3], [-17, -19], [-3.2, -21.5]]) walk(x, z);
  h.command('act'); portalFrames(h, 14); assert.equal(state.helChase?.performance?.passedGate, true);
  for (const [x, z] of [[17, -21.5], [17, -3], [23, -3], [23, TRAINMAN_CHASE.cover.z], [TRAINMAN_CHASE.cover.x, TRAINMAN_CHASE.cover.z]]) walk(x, z);
  for (let frame = 0; frame < 300 && state.helChase?.performance?.phase === 'running'; frame++) portalFrames(h, 1);
  assert.equal(state.helChase?.performance?.phase, 'cover'); portalFrames(h, 190); assert.equal(state.helChase?.phase, 'escaped');
  walk(TRAINMAN_CHASE.exit.x, TRAINMAN_CHASE.exit.z); h.command('act'); assert.equal(state.step, scene.steps.length);
}
function completeHelGarage(h: ReturnType<typeof setup>, nextSequence: () => number) {
  const state = h.sandbox.life.film.state!, scene = FILM_SCENE_BY_ID.m3_hel_garage;
  const until = (phase: string) => {
    for (let f = 0; f < 160 && state.helGarage?.phase !== phase; f++) portalFrames(h, 1);
    assert.equal(state.helGarage?.phase, phase);
  };
  const walk = (x: number, z: number) => {
    const point = filmPosition(scene.set, x, z);
    for (let f = 0; f < 240 && Math.hypot(h.actor().position.x - point.x, h.actor().position.z - point.z) > .3; f++) {
      const dx = point.x - h.actor().position.x, dz = point.z - h.actor().position.z, length = Math.hypot(dx, dz);
      h.players.receiveInput('film-player', { x: dx / Math.max(1.5, length), z: dz / Math.max(1.5, length), yaw: Math.atan2(dx, dz), sequence: nextSequence() }); portalFrames(h, 1);
    }
    h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, sequence: nextSequence() }); portalFrames(h, 3);
    assert.ok(Math.hypot(h.actor().position.x - point.x, h.actor().position.z - point.z) <= .4);
  };
  walk(4.7, -12.4); h.command('act'); until('evade'); h.players.act('film-player', 'dodge', h.tick()); portalFrames(h, 3);
  h.players.act('film-player', 'attack', h.tick()); until('combo');
  for (let i = 0; i < 3; i++) { h.players.act('film-player', 'attack', h.tick()); until(i === 2 ? 'cleared' : 'combo'); }
  assert.equal(state.step, 1); walk(2.7, -28.55); h.command('act'); until('exit');
  walk(1.5, -28.3); walk(1.5, -33.2); until('done'); assert.equal(state.step, scene.steps.length);
}
function hearMobilFamily(h: ReturnType<typeof setup>) {
  for (const question of MOBIL_FAMILY_QUESTIONS) {
    h.command(`family:ask:${question.id}`);
    for (let frame = 0; frame < 150 && h.sandbox.life.film.state!.mobil!.family!.phase === 'hearing'; frame++) h.players.step(.1, true, h.tick());
    assert.ok(h.sandbox.life.film.state!.mobil!.family!.answered.includes(question.id));
  }
  assert.equal(h.sandbox.life.film.state!.mobil!.family!.phase, 'reflection');
}
function completeOracleLast(h: ReturnType<typeof setup>, nextSequence: () => number) {
  const scene = FILM_SCENE_BY_ID.m3_oracle_last, state = h.sandbox.life.film.state!;
  const walk = (x: number, z: number) => {
    const point = filmPosition(scene.set, x, z);
    for (let frame = 0; frame < 300 && distance(h.actor().position, point) > .3; frame++) {
      const dx = point.x - h.actor().position.x, dz = point.z - h.actor().position.z, gap = Math.hypot(dx, dz);
      h.players.receiveInput('film-player', { x: dx / Math.max(1, gap), z: dz / Math.max(1, gap), yaw: Math.atan2(dx, dz),
        jump: false, sprint: false, sequence: nextSequence() }); portalFrames(h, 1);
    }
    assert.ok(distance(h.actor().position, point) <= .3, `reachable final Oracle visit ${x}/${z}`);
    h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, sequence: nextSequence() }); portalFrames(h, 1);
  };
  walk(ORACLE_LAST.entrance.x, ORACLE_LAST.entrance.z);
  portalFrames(h, Math.ceil(ORACLE_LAST.welcomeSeconds / .1) + 1); assert.equal(state.step, 1);
  walk(0, ORACLE_LAST.question.z); walk(ORACLE_LAST.question.x, ORACLE_LAST.question.z);
  for (const step of [1, 2]) {
    h.command('act'); assert.equal(state.oracleLast?.phase, 'answering');
    portalFrames(h, Math.ceil(oracleLastLines(state.oracleLast!, step).length * ORACLE_LAST.lineSeconds / .1) + 1);
    assert.equal(state.step, step + 1);
  }
  h.command('reflect:care'); portalFrames(h, Math.ceil(ORACLE_LAST.lineSeconds / .1) + 1);
  assert.equal(state.step, 4); assert.equal(state.reflections['m3_oracle_last:3'], 'care');
  walk(0, ORACLE_LAST.question.z); walk(ORACLE_LAST.exit.x, ORACLE_LAST.exit.z);
  assert.equal(state.step, scene.steps.length); assert.equal(state.oracleLast?.phase, 'done');
}
function completeOracleAbsorption(h: ReturnType<typeof setup>, nextSequence: () => number) {
  const state = h.sandbox.life.film.state!, scene = FILM_SCENE_BY_ID.m3_oracle_absorbed;
  assert.equal(h.actor().id, 'oracle'); assert.equal(state.step, 0);
  assert.ok(distance(h.actor().position, filmPosition(scene.set, ORACLE_ABSORPTION.start.x, ORACLE_ABSORPTION.start.z)) <= 1.6);
  const frames = (count: number, focus = false) => {
    for (let frame = 0; frame < count; frame++) {
      h.players.receiveInput('film-player', { x: 0, z: 0, yaw: h.actor().rotation, focus, location: scene.set, sequence: nextSequence() });
      h.players.step(.1, true, h.tick()); if (frame % 5 === 4) h.advance();
    }
  };
  h.command('act'); frames(Math.ceil(ORACLE_ABSORPTION.farewellSeconds / .1) + 1); assert.equal(state.step, 1);
  h.command('act'); frames(Math.ceil(ORACLE_ABSORPTION.escapeSeconds / .1) + 1); assert.equal(state.step, 2);
  h.command('reflect:care'); assert.equal(state.step, 3); assert.equal(state.oracleAbsorption?.phase, 'waiting');
  h.command('act'); frames(Math.ceil((ORACLE_ABSORPTION.approachSeconds + ORACLE_ABSORPTION.confrontation.length * ORACLE_ABSORPTION.lineSeconds) / .1) + 1);
  assert.equal(state.oracleAbsorption?.phase, 'consent'); assert.equal(h.actor().status, 'alive');
  frames(Math.ceil(ORACLE_ABSORPTION.consentSeconds / .1) + 1, true);
  frames(Math.ceil((ORACLE_ABSORPTION.contactSeconds + ORACLE_ABSORPTION.coatingSeconds + ORACLE_ABSORPTION.laughSeconds) / .1) + 4);
  assert.equal(state.oracleAbsorption?.phase, 'done'); assert.equal(state.step, scene.steps.length);
  for (const id of ['oracle', 'sati', 'seraph']) assert.equal(h.world.agents.get(id)!.status, 'disconnected', id);
}
function completeBaneInquiry(h: ReturnType<typeof setup>, nextSequence: () => number) {
  const scene = FILM_SCENE_BY_ID.m3_bane_questions, state = h.sandbox.life.film.state!;
  const walk = (target: { x: number; z: number }) => {
    const point = filmPosition(scene.set, target.x, target.z);
    for (let frame = 0; frame < 400 && distance(h.actor().position, point) > .4; frame++) {
      if (state.step === 1 && state.baneInquiry?.phase === 'ready' || state.baneInquiry?.phase === 'done') break;
      const dx = point.x - h.actor().position.x, dz = point.z - h.actor().position.z, gap = Math.hypot(dx, dz);
      h.players.receiveInput('film-player', { x: dx / Math.max(1, gap), z: dz / Math.max(1, gap), yaw: Math.atan2(dx, dz), sequence: nextSequence() });
      portalFrames(h, 1);
    }
  };
  walk(BANE_INQUIRY.approach); assert.equal(state.step, 1);
  for (const step of [1, 2, 3]) {
    h.command('act'); portalFrames(h, Math.ceil((baneInquiryLines(step).length * BANE_INQUIRY.lineSeconds + (step === 1 ? BANE_INQUIRY.sitSeconds : 0)) / .1) + 2);
  }
  assert.equal(state.baneInquiry?.phase, 'reviewing'); h.command('review:negative'); h.command('review:abnormal');
  h.command('reflect:care'); portalFrames(h, Math.ceil((BANE_INQUIRY.lineSeconds + BANE_INQUIRY.riseSeconds) / .1) + 2);
  assert.equal(state.step, 5); walk(BANE_INQUIRY.exit); assert.equal(state.step, 6);
}
function completeHammerBriefing(h: ReturnType<typeof setup>, nextSequence: () => number) {
  const scene = FILM_SCENE_BY_ID.m3_logos_plan, state = h.sandbox.life.film.state!;
  const walk = (point: { x: number; z: number }) => {
    const target = filmPosition(scene.set, point.x, point.z);
    for (let frame = 0; frame < 500 && distance(h.actor().position, target) > .4 && state.hammerBriefing?.phase !== 'done'; frame++) {
      const dx = target.x - h.actor().position.x, dz = target.z - h.actor().position.z, gap = Math.hypot(dx, dz);
      h.players.receiveInput('film-player', { x: dx / Math.max(1, gap), z: dz / Math.max(1, gap), yaw: Math.atan2(dx, dz), sequence: nextSequence() }); portalFrames(h, 1);
    }
    h.players.receiveInput('film-player', { x: 0, z: 0, yaw: h.actor().rotation, sequence: nextSequence() });
  };
  walk(HAMMER_BRIEFING.approach); assert.equal(state.step, 1);
  for (const lines of [HAMMER_BRIEFING.proposal, HAMMER_BRIEFING.loan]) { h.command('act'); portalFrames(h, Math.ceil(lines.length * HAMMER_BRIEFING.lineSeconds / .1) + 2); }
  walk(HAMMER_BRIEFING.inspection); h.command('act'); portalFrames(h, Math.ceil(HAMMER_BRIEFING.planning.length * HAMMER_BRIEFING.lineSeconds / .1) + 2);
  h.command('route:hammer:zion'); h.command('route:logos:machine_city'); assert.equal(state.step, 3);
  walk(HAMMER_BRIEFING.approach); h.command('act'); portalFrames(h, Math.ceil(HAMMER_BRIEFING.belief.length * HAMMER_BRIEFING.lineSeconds / .1) + 2);
  h.command('reflect:trust'); portalFrames(h, Math.ceil(HAMMER_BRIEFING.lineSeconds / .1) + 2);
  walk(HAMMER_BRIEFING.exit); portalFrames(h, 25); assert.equal(state.step, scene.steps.length); assert.equal(state.hammerBriefing?.phase, 'done');
}
function completeZionDeployment(h: ReturnType<typeof setup>, nextSequence: () => number) {
  const scene = FILM_SCENE_BY_ID.m3_zion_prepare, state = h.sandbox.life.film.state!;
  const walk = (point: { x: number; z: number }) => {
    const target = filmPosition(scene.set, point.x, point.z);
    for (let frame = 0; frame < 500 && distance(h.actor().position, target) > .4 && state.zionDeployment?.phase !== 'done'; frame++) {
      const dx = target.x - h.actor().position.x, dz = target.z - h.actor().position.z, gap = Math.hypot(dx, dz);
      h.players.receiveInput('film-player', { x: dx / Math.max(1, gap), z: dz / Math.max(1, gap), yaw: Math.atan2(dx, dz), sequence: nextSequence() }); portalFrames(h, 1);
    }
    h.players.receiveInput('film-player', { x: 0, z: 0, yaw: h.actor().rotation, sequence: nextSequence() });
  };
  walk(ZION_DEPLOYMENT.report); assert.equal(state.step, 1);
  for (const lines of [ZION_DEPLOYMENT.reportLines, ZION_DEPLOYMENT.forceLines]) { h.command('act'); portalFrames(h, Math.ceil(lines.length * ZION_DEPLOYMENT.lineSeconds / .1) + 2); }
  walk(ZION_DEPLOYMENT.inspection); h.command('act');
  for (const item of ZION_DEPLOYMENT.allocations) h.command(`allocation:${item.id}:${item.correct}`);
  walk(ZION_DEPLOYMENT.report); h.command('act'); portalFrames(h, Math.ceil(ZION_DEPLOYMENT.hopeLines.length * ZION_DEPLOYMENT.lineSeconds / .1) + 2);
  h.command('reflect:trust'); portalFrames(h, Math.ceil(ZION_DEPLOYMENT.lineSeconds / .1) + 2);
  walk(ZION_DEPLOYMENT.exit); assert.equal(state.step, 5); assert.equal(state.zionDeployment?.phase, 'done');
}
function completeMaggieDiscovery(h: ReturnType<typeof setup>, nextSequence: () => number) {
  const scene = FILM_SCENE_BY_ID.m3_maggie_discovery, state = h.sandbox.life.film.state!;
  const walk = (point: { x: number; z: number }) => {
    const target = filmPosition(scene.set, point.x, point.z);
    for (let frame = 0; frame < 500 && distance(h.actor().position, target) > .35; frame++) {
      const dx = target.x - h.actor().position.x, dz = target.z - h.actor().position.z, gap = Math.hypot(dx, dz);
      h.players.receiveInput('film-player', { x: dx / Math.max(1, gap), z: dz / Math.max(1, gap), yaw: Math.atan2(dx, dz), sequence: nextSequence() }); portalFrames(h, 1);
    }
    h.players.receiveInput('film-player', { x: 0, z: 0, yaw: h.actor().rotation, sequence: nextSequence() });
    assert.ok(distance(h.actor().position, target) < .4);
  };
  h.command('act'); portalFrames(h, Math.ceil(MAGGIE_DISCOVERY.call.length * MAGGIE_DISCOVERY.lineSeconds / .1) + 2);
  walk(MAGGIE_DISCOVERY.approach); assert.equal(state.step, 2);
  for (const [point, lines] of [[MAGGIE_DISCOVERY.inspection, MAGGIE_DISCOVERY.bedside], [MAGGIE_DISCOVERY.emptyBed, MAGGIE_DISCOVERY.berthLines], [MAGGIE_DISCOVERY.report, MAGGIE_DISCOVERY.search]] as const) {
    walk(point); h.command('act'); portalFrames(h, Math.ceil((lines.length * MAGGIE_DISCOVERY.lineSeconds + (point === MAGGIE_DISCOVERY.report ? MAGGIE_DISCOVERY.arrivalSeconds : 0)) / .1) + 2);
  }
  h.command('act'); portalFrames(h, Math.ceil(MAGGIE_DISCOVERY.returnLines.length * MAGGIE_DISCOVERY.lineSeconds / .1) + 2);
  h.command('reflect:care'); portalFrames(h, Math.ceil(MAGGIE_DISCOVERY.lineSeconds / .1) + 2);
  walk(MAGGIE_DISCOVERY.exit); assert.equal(state.step, 7); assert.equal(state.maggieDiscovery?.phase, 'done');
}
function completePortalStep(h: ReturnType<typeof setup>, index: number) {
  h.command('act');
  if (index === 3) {
    portalFrames(h, 22); assert.equal(h.sandbox.life.film.state!.keyDoor?.performance?.phase, 'cover');
    h.players.act('film-player', 'attack', h.tick()); portalFrames(h, 50);
  } else if (index === 4) {
    portalFrames(h, 70); assert.equal(h.sandbox.life.film.state!.keyDoor?.performance?.phase, 'key_ready');
    h.command('act'); portalFrames(h, 17);
  } else portalFrames(h, 35);
}
function startCatch(h: ReturnType<typeof setup>, nextSequence: () => number) {
  for (let frame = 0; frame < 6; frame++) {
    h.players.receiveInput('film-player', { x: 0, z: -1, yaw: Math.PI, focus: false, sequence: nextSequence() }); h.players.step(.1, true, h.tick());
  }
  h.command('act'); assert.equal(h.sandbox.life.film.state!.catch?.phase, 'departing');
  for (let frame = 0; frame < 12; frame++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.life.film.state!.catch?.phase, 'flight');
}
function completeArchitectDoor(h: ReturnType<typeof setup>) {
  h.command('act'); portalFrames(h, 20);
  assert.equal(h.sandbox.life.film.state!.step, 5, 'opening the door alone must not complete the scene');
  h.actor().position = filmPosition('film_architect_room', -8, -28.5);
  h.players.step(.1, true, h.tick());
}

function stageNebCrew(h: ReturnType<typeof setup>) {
  const spots = { neo: [2, 22], morpheus: [-1.5, 24], trinity: [5, 24], link: [4, 1] };
  for (const id of NEB_CREW.filter(id => id !== h.actor().id)) {
    const member = h.world.agents.get(id)!, spot = spots[id];
    member.currentLocation = 'film_neb_deck'; member.isInMatrix = false;
    member.position = filmPosition('film_neb_deck', spot[0], spot[1]); member.velocity = { x: 0, y: 0, z: 0 };
  }
}
function completeNebExit(h: ReturnType<typeof setup>, nextSequence: () => number) {
  const state = h.sandbox.life.film.state!, center = FILM_SETS.film_neb_deck.center;
  for (let frame = 0; frame < 300 && state.shipLoss?.phase === 'evacuating'; frame++) {
    const actor = h.actor(), dz = NEB_ESCAPE.playerZ + .15 - (actor.position.z - center.z);
    h.players.receiveInput('film-player', { x: 0, z: Math.max(0, Math.min(1, dz / 1.5)), yaw: 0, jump: false, sprint: true, sequence: nextSequence() });
    h.players.step(.1, true, h.tick()); if (frame % 5 === 4) h.advance();
  }
  assert.equal(state.shipLoss?.phase, 'destroying', `physical evacuation stalled: ${JSON.stringify(NEB_CREW.map(id => [id, h.world.agents.get(id)!.position]))}`);
  assert.equal(state.step, 3, 'walking out alone must not credit ship destruction');
  h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, sequence: nextSequence() });
  for (let frame = 0; frame < 60; frame++) h.players.step(.1, true, h.tick());
  assert.equal(state.shipLoss?.phase, 'mourning'); assert.equal(state.step, 4);
}

test('all trilogy scenes have distinct stable IDs, existing cast, accessible objectives and authored locations', () => {
  assert.equal(new Set(FILM_SCENES.map(s => s.id)).size, FILM_SCENES.length);
  assert.equal(new Set(FILM_SCENES.map(s => s.set)).size, Object.keys(FILM_SETS).length);
  for (const id of FILM_CAST) assert.ok(CHARACTERS[id], `missing cast: ${id}`);
  for (const scene of FILM_SCENES) {
    const set = FILM_SETS[scene.set]; assert.ok(set, scene.id);
    assert.ok(set.film.includes(scene.film), scene.id);
    assert.ok(NEO_CHAPTERS.some(c => c.id === scene.chapter), scene.id);
    // The second apartment wake begins as a locked bed performance; its first
    // walkable position is the bedside route verified in wake-call.test.
    const stagedEntry = scene.id === 'm1_wake_again' || scene.id === 'm1_cabin';
    assert.equal(playerBlocked(filmEntry(scene), set.world === 'matrix'), stagedEntry, `${scene.id}: entry`);
    for (const step of scene.steps) {
      // These targets are occupied through boarding, recovery or lying down.
      // Their encounter tests verify entry; character-asset.test checks physical contact.
      const stagedInsideProp = scene.id === 'm1_bug' && scene.steps.indexOf(step) < 2 || ['m1_recovery', 'm1_cabin'].includes(scene.id) && scene.steps.indexOf(step) === 0
        || scene.id === 'm1_truth_return' || scene.id === 'm1_morning' && scene.steps.indexOf(step) === 1
        || scene.id === 'm3_dawn' && scene.steps.indexOf(step) >= 2;
      // Pit objectives use the persistent collapsed road, not the avenue's
      // original surface. Keep testing reachability against the real terrain.
      const terrain: WorldStructure[] = scene.set === 'film_smith_avenue' && step.z === SMITH_FINALE.crater.z
        ? [{ id: 'film:smith:crater', kind: 'crater', owner: 'matrix', matrix: true, health: 1,
          position: filmPosition(scene.set, SMITH_FINALE.crater.x, SMITH_FINALE.crater.z),
          film: { scene: scene.id, width: 38, depth: 38, height: SMITH_FINALE.crater.depth } }] : [];
      const target = filmStepPosition(scene, step);
      if (scene.id === 'm2_ship_lost' && step.z > 36) terrain.push({ id: 'film:neb-escape:route', kind: 'beacon', owner: 'matrix',
        position: { ...set.center }, matrix: false, health: 999 });
      assert.equal(playerBlocked(target, set.world === 'matrix', 1.1, terrain), stagedInsideProp, `${scene.id}: ${step.label}`);
      if (terrain.some(s => s.kind === 'crater')) assert.equal(target.y, groundHeight(target, true, terrain), `${scene.id}: the objective must lie on the collapsed floor`);
    }
    if (scene.steps.some(s => s.kind === 'reflect') && !['m1_pills', 'm1_ledge', 'm1_wake_up'].includes(scene.id)) assert.equal(filmReflections(scene.id).length, 3, `${scene.id}: dialogue must be playable`);
  }
  assert.equal(FILM_SCENE_BY_ID.m1_pills.set, 'film_lafayette');
  assert.equal(FILM_SCENE_BY_ID.m2_key_door.set, 'film_source_corridor');
  assert.notEqual(FILM_SCENE_BY_ID.m2_key_door.set, FILM_SCENE_BY_ID.m2_backdoors.set);
  assert.match(FILM_SETS.film_source_corridor.name, /工业|施工/);
  assert.equal(FILM_SCENE_BY_ID.m1_dejavu.set, 'film_ambush_house');
  assert.equal(FILM_SCENE_BY_ID.m3_bane.set, 'film_logos_deck');
  assert.equal(FILM_SCENE_BY_ID.m3_dock_battle.actor, 'mifune');
  assert.equal(FILM_SCENE_BY_ID.m3_deus.cast[0], 'deus_ex_machina');
});

test('distant bridge markers guide movement without offering a premature G action', () => {
  const bridge = FILM_SCENE_BY_ID.m1_bridge;
  const [walk, board] = bridge.steps;
  assert.equal(filmStepActionReady(bridge, walk, filmEntry(bridge), true), false);
  assert.equal(filmStepActionReady(bridge, walk, filmStepPosition(bridge, walk), true), false, 'arrival advances a walking step automatically');
  assert.equal(filmStepActionReady(bridge, board, filmEntry(bridge), true), false);
  assert.equal(filmStepActionReady(bridge, board, filmStepPosition(bridge, board), true), true);
  assert.equal(filmStepActionReady(bridge, board, filmStepPosition(bridge, board), false), false);
  const reflection = FILM_SCENE_BY_ID.m1_construct.steps.find(step => step.kind === 'reflect')!;
  assert.equal(filmStepActionReady(FILM_SCENE_BY_ID.m1_construct, reflection,
    filmStepPosition(FILM_SCENE_BY_ID.m1_construct, reflection), true), false, 'a reflection belongs in the journal, not the G button');
});

test('Neo must steer through the city and catch the falling Trinity before impact', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm2_catch', actor: 'neo', step: 0, catch: undefined });
  h.actor().currentLocation = 'film_trinity_roof'; h.actor().position = filmEntry(FILM_SCENE_BY_ID.m2_catch);
  h.sandbox.life.film.catch.frame(h.actor(), { x: 0, z: 0, focus: false }, 0, h.tick());
  assert.equal(state.catch?.phase, 'launch');
  let sequence = 0; startCatch(h, () => ++sequence);
  for (let i = 0; i < 90; i++) h.players.step(.1, true, h.tick());
  assert.equal(state.catch?.phase, 'failed'); assert.equal(state.step, 1);
  h.command('retry'); assert.equal(state.catch?.phase, 'launch');
  assert.equal(state.catch?.attempt, 1);
  startCatch(h, () => ++sequence);
  for (let i = 0; i < 70 && state.catch?.phase === 'flight'; i++) {
    const x = i < 10 ? -1 : i >= 42 && i < 46 ? 1 : 0;
    const z = i >= 10 && i < 42 ? -1 : 0;
    h.players.receiveInput('film-player', { x, z, yaw: Math.PI, jump: false, sprint: false, focus: false, sequence: ++sequence });
    h.players.step(.1, true, h.tick());
    if (i >= 52 && state.catch?.phase === 'flight') h.command('act');
  }
  assert.equal(state.catch?.phase, 'catching'); assert.equal(state.step, 2);
  for (let i = 0; i < 54; i++) h.players.step(.1, true, h.tick());
  assert.equal(state.catch?.phase, 'extract_ready');
});

test('Trinity revival needs deliberate code focus and three timed pulses, and survives a saved retry', () => {
  const h = setup(); h.command('continue'); let state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm2_catch', actor: 'neo', step: 2,
    catch: { phase: 'extract_ready', elapsed: 0, attempt: 0, x: 0, z: -15, focus: 0, beats: 0, misses: 0 } });
  h.actor().currentLocation = 'film_trinity_roof'; h.actor().position = filmPosition('film_trinity_roof', 0, -15);
  h.command('act'); assert.equal(state.catch?.phase, 'extracting');
  for (let i = 0; i < 11; i++) h.sandbox.life.film.catch.frame(h.actor(), { x: 0, z: 0, focus: true }, .1, ++state.enteredAt);
  assert.equal(state.catch?.phase, 'extracting'); assert.ok((state.catch?.focus ?? 0) > 1);
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved);
  state = h.sandbox.life.film.state!;
  for (let i = 0; i < 16; i++) h.sandbox.life.film.catch.frame(h.actor(), { x: 0, z: 0, focus: true }, .1, ++state.enteredAt);
  assert.equal(state.catch?.phase, 'pulse'); assert.equal(state.step, 3);
  for (let i = 0; i < 50; i++) h.sandbox.life.film.catch.frame(h.actor(), { x: 0, z: 0, focus: false }, .1, ++state.enteredAt);
  assert.equal(state.catch?.phase, 'pulse', 'the rhythm keeps looping while the player loads or observes it');
  for (let i = 0; i < 3; i++) h.players.act('film-player', 'attack', ++state.enteredAt);
  assert.equal(state.catch?.phase, 'failed');
  h.manager.updateAllAgents(state.enteredAt + 2); h.manager.updateAllAgents(state.enteredAt + 3);
  assert.equal(h.world.agents.get('trinity')?.currentAction?.parameters.catch?.role, 'trinity', 'Trinity stays on the roof while the pulse checkpoint waits');
  h.command('retry'); assert.equal(state.catch?.phase, 'pulse'); assert.equal(state.step, 3);
  for (let beat = 0; beat < 3; beat++) {
    for (let i = 0; i < 11; i++) h.sandbox.life.film.catch.frame(h.actor(), { x: 0, z: 0, focus: false }, .1, ++state.enteredAt);
    h.players.act('film-player', 'attack', ++state.enteredAt);
  }
  assert.equal(state.catch?.phase, 'reviving');
  for (let i = 0; i < 34; i++) h.sandbox.life.film.catch.frame(h.actor(), { x: 0, z: 0, focus: false }, .1, ++state.enteredAt);
  assert.equal(state.catch?.phase, 'done'); assert.ok(state.completed.includes('m2_catch'));
});

test('the bomb begins only after the evacuation warning, pauses without a player, and retries from the cargo checkpoint', () => {
  const h = setup(); h.command('continue'); let state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m2_ship_lost;
  Object.assign(state, { scene: scene.id, actor: 'morpheus', step: 2,
    shipLoss: { phase: 'briefing', remaining: RELOADED_FINALE.evacuationSeconds, lastTick: h.tick(), attempts: 0 } });
  h.players.possess('film-player', 'morpheus', h.tick()); h.actor().currentLocation = scene.set; h.actor().isInMatrix = false;
  h.actor().position = filmStepPosition(scene, scene.steps[2]);
  stageNebCrew(h);
  h.advance(15); assert.equal(state.shipLoss?.remaining, RELOADED_FINALE.evacuationSeconds);
  h.command('act'); assert.equal(state.step, 3); assert.equal(state.shipLoss?.phase, 'evacuating');
  state.completed.push('m1_lobby'); assert.match(h.command('visit:m1_lobby'), /先完成/);
  h.advance(5); const remaining = state.shipLoss!.remaining; assert.ok(remaining < RELOADED_FINALE.evacuationSeconds);
  h.players.release('film-player', h.tick()); h.advance(80); assert.equal(state.shipLoss?.remaining, remaining);
  h.players.possess('film-player', 'morpheus', h.tick());
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); state = h.sandbox.life.film.state!;
  assert.equal(state.shipLoss?.remaining, remaining); h.advance(65);
  assert.equal(state.shipLoss?.phase, 'failed'); assert.equal(state.step, 3);
  h.command('retry'); assert.equal(state.shipLoss?.phase, 'evacuating'); assert.equal(state.shipLoss?.attempts, 1);
  assert.deepEqual(h.actor().position, state.checkpoint);
  let sequence = 0; completeNebExit(h, () => ++sequence); h.command('act');
  assert.equal(state.shipLoss?.phase, 'escaped'); assert.ok(state.completed.includes(scene.id));
});

test('Neo walks through the same hatch as all three crew members before a saved and resumable destruction', () => {
  const h = setup(); h.command('continue'); let state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm2_ship_lost', actor: 'neo', step: 2,
    shipLoss: { phase: 'briefing', remaining: 32, lastTick: h.tick(), attempts: 0 } });
  h.actor().currentLocation = 'film_neb_deck'; h.actor().isInMatrix = false;
  h.actor().position = filmPosition('film_neb_deck', 0, 0); stageNebCrew(h);
  h.command('act'); assert.equal(state.step, 3);
  let sequence = 0;
  for (let frame = 0; frame < 290 && state.shipLoss?.phase === 'evacuating'; frame++) {
    const dz = NEB_ESCAPE.playerZ + .15 - (h.actor().position.z - FILM_SETS.film_neb_deck.center.z);
    h.players.receiveInput('film-player', { x: 0, z: Math.max(0, Math.min(1, dz / 1.5)), yaw: 0, jump: false, sprint: true, sequence: ++sequence });
    h.players.step(.1, true, h.tick()); if (frame % 5 === 4) h.advance();
    for (const id of NEB_CREW) assert.equal(playerBlocked(h.world.agents.get(id)!.position, false, 1.05,
      h.sandbox.state.structures.filter(s => s.owner !== id && s.id !== 'film:neb-escape:hatch')), false, `${id} crossed solid geometry`);
  }
  assert.equal(state.shipLoss?.phase, 'destroying'); assert.equal(state.step, 3);
  for (const id of ['morpheus', 'trinity', 'link']) assert.ok(h.world.agents.get(id)!.position.z - FILM_SETS.film_neb_deck.center.z >= NEB_ESCAPE.safeZ);
  h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, sequence: ++sequence });
  for (let frame = 0; frame < 11; frame++) h.players.step(.1, true, h.tick());
  assert.ok(Math.abs(h.actor().rotation - Math.PI) < .01, 'Neo can turn back while movement is locked during destruction');
  const before = JSON.parse(JSON.stringify(state.shipLoss)), bodies = NEB_CREW.map(id => structuredClone(h.world.agents.get(id)!.position));
  for (let frame = 0; frame < 20; frame++) h.players.step(.1, false, h.tick());
  assert.deepEqual(JSON.parse(JSON.stringify(state.shipLoss)), before); assert.deepEqual(NEB_CREW.map(id => h.world.agents.get(id)!.position), bodies);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); state = h.sandbox.life.film.state!;
  assert.deepEqual(JSON.parse(JSON.stringify(state.shipLoss)), before); assert.deepEqual(NEB_CREW.map(id => h.world.agents.get(id)!.position), bodies);
  for (let frame = 0; frame < 50; frame++) h.players.step(.1, true, h.tick());
  assert.equal(state.shipLoss?.phase, 'mourning'); assert.equal(state.step, 4); assert.equal(state.completed.includes('m2_ship_lost'), false);
  for (const id of ['morpheus', 'trinity', 'link']) assert.ok(Math.cos(h.world.agents.get(id)!.rotation) < -.98, `${id} must turn back toward the destroyed ship`);
  h.command('act'); assert.equal(state.shipLoss?.phase, 'escaped'); assert.ok(state.completed.includes('m2_ship_lost'));
  h.command('next'); assert.equal(state.scene, 'm2_stop_sentinels'); assert.equal(state.actor, 'neo');
  assert.equal(h.sandbox.state.structures.some(s => s.id.startsWith('film:neb-escape:')), false);
});

test('an occupied or dead escape companion freezes the encounter without moving or reviving them', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm2_ship_lost', actor: 'neo', step: 3,
    shipLoss: { phase: 'evacuating', remaining: 32, lastTick: h.tick(), attempts: 0, age: 0 } });
  h.actor().currentLocation = 'film_neb_deck'; h.actor().isInMatrix = false; h.actor().position = filmPosition('film_neb_deck', 0, 0); stageNebCrew(h);
  const trinity = h.world.agents.get('trinity')!, before = structuredClone(trinity.position);
  trinity.controller = 'other-player';
  for (let frame = 0; frame < 20; frame++) h.players.step(.1, true, h.tick()); h.advance(50);
  assert.equal(state.shipLoss?.remaining, 32); assert.equal(state.shipLoss?.age, 0); assert.deepEqual(trinity.position, before);
  trinity.controller = undefined; trinity.status = 'dead'; trinity.health = 0;
  for (let frame = 0; frame < 20; frame++) h.players.step(.1, true, h.tick()); h.advance(50);
  assert.equal(state.shipLoss?.remaining, 32); assert.equal(state.shipLoss?.age, 0); assert.equal(trinity.status, 'dead'); assert.equal(trinity.health, 0);
  assert.deepEqual(trinity.position, before); assert.ok(state.shipLoss?.unavailable);
});

test('a legacy Morpheus save can explicitly resume Neo without moving either body or losing the current step', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm2_ship_lost', actor: 'morpheus', step: 1,
    shipLoss: { phase: 'briefing', remaining: 32, lastTick: h.tick(), attempts: 0 } });
  h.players.possess('film-player', 'morpheus', h.tick());
  h.actor().currentLocation = 'film_neb_deck'; h.actor().isInMatrix = false; h.actor().position = filmPosition('film_neb_deck', 0, 20); stageNebCrew(h);
  const neo = h.world.agents.get('neo')!, prior = structuredClone(neo.position), morpheus = h.actor();
  const former = structuredClone(morpheus.position); neo.health = 51;
  neo.controller = 'other-player'; h.command('neo-view'); assert.equal(state.actor, 'morpheus'); assert.equal(h.actor().id, 'morpheus');
  neo.controller = undefined; h.command('neo-view'); assert.equal(state.actor, 'neo'); assert.equal(h.actor().id, 'neo');
  assert.equal(state.step, 1); assert.equal(neo.health, 51); assert.deepEqual(neo.position, prior); assert.deepEqual(morpheus.position, former);
});

test('the old interior cargo marker cannot complete evacuation before the player and crew leave the hull', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm2_ship_lost', actor: 'morpheus', step: 3,
    shipLoss: { phase: 'evacuating', remaining: 32, lastTick: h.tick(), attempts: 0 } });
  h.players.possess('film-player', 'morpheus', h.tick());
  h.actor().currentLocation = 'film_neb_deck'; h.actor().isInMatrix = false;
  h.actor().position = filmPosition('film_neb_deck', 0, 35); h.advance();
  assert.equal(state.shipLoss?.phase, 'evacuating');
  assert.equal(state.step, 3); assert.equal(state.completed.includes('m2_ship_lost'), false);
});

test('Neo must face the real Sentinels and hold focus; the signal and pursuit survive a save', () => {
  const h = setup(); h.command('continue'); let state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m2_stop_sentinels;
  Object.assign(state, { scene: scene.id, actor: 'neo', step: 0,
    tunnel: { phase: 'running', remaining: RELOADED_FINALE.sentinelSeconds, focus: 0, lastTick: h.tick(), attempts: 0 } });
  h.actor().currentLocation = scene.set; h.actor().isInMatrix = false; h.actor().position = filmStepPosition(scene, scene.steps[0]);
  h.advance(); assert.equal(state.step, 1); assert.equal(state.tunnel?.phase, 'sensing');
  let sequence = 0;
  const focus = (yaw: number, frames: number) => { for (let i = 0; i < frames; i++) {
    h.players.receiveInput('film-player', { x: 0, z: 0, yaw, jump: false, sprint: false, focus: true, sequence: ++sequence });
    h.players.step(.1, true, h.tick());
  } };
  focus(Math.PI, 10); assert.equal(state.tunnel?.focus, 0);
  focus(0, 10); assert.ok((state.tunnel?.focus ?? 0) > .9 && (state.tunnel?.focus ?? 0) < 1.1);
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved); state = h.sandbox.life.film.state!;
  const before = state.tunnel!.remaining; h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(state.tunnel?.remaining, before);
  h.players.possess('film-player', 'neo', h.tick()); focus(0, 15);
  assert.equal(state.tunnel?.phase, 'stopping', 'cutting the signal must not skip the physical fall and collapse');
  assert.equal(state.completed.includes(scene.id), false);
  assert.equal(h.actor().health, 100);
  assert.match(h.command('next'), /先完成/);
  const cut = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(cut); state = h.sandbox.life.film.state!;
  const held = state.tunnel!.elapsed;
  h.players.release('film-player', h.tick()); h.advance(12); assert.equal(state.tunnel?.elapsed, held);
  h.players.possess('film-player', 'neo', h.tick());
  h.players.possess('witness-player', 'trinity', h.tick()); focus(0, 10); assert.equal(state.tunnel?.elapsed, held);
  h.players.release('witness-player', h.tick());
  focus(0, 80);
  assert.equal(state.tunnel?.phase, 'collapsed'); assert.ok(state.completed.includes(scene.id));
  assert.equal(h.actor().health, 1);
});

test('a dead tunnel witness pauses the signal and is neither moved nor healed', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!, scene = FILM_SCENE_BY_ID.m2_stop_sentinels;
  Object.assign(state, { scene: scene.id, actor: 'neo', step: 1,
    tunnel: { phase: 'stopping', remaining: 10, focus: 2.2, elapsed: .6, lastTick: h.tick(), attempts: 0 } });
  h.actor().currentLocation = scene.set; h.actor().isInMatrix = false; h.actor().position = filmStepPosition(scene, scene.steps[1]);
  const witness = h.world.agents.get('link')!; witness.status = 'dead'; witness.health = 0;
  const position = { ...witness.position };
  for (let frame = 0; frame < 20; frame++) h.players.step(.1, true, h.tick());
  assert.equal(state.tunnel?.elapsed, .6); assert.equal(witness.status, 'dead'); assert.equal(witness.health, 0); assert.deepEqual(witness.position, position);
  assert.equal(state.completed.includes(scene.id), false);
});

test('paused signal reattachment restores the saved performance without advancing or moving Neo', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!, scene = FILM_SCENE_BY_ID.m2_stop_sentinels;
  for (const phase of ['stopping', 'collapsing', 'collapsed'] as const) {
    Object.assign(state, { scene: scene.id, actor: 'neo', step: phase === 'collapsed' ? scene.steps.length : 1,
      tunnel: { phase, remaining: 10, focus: 2.2, age: 5, elapsed: .7, lastTick: h.tick(), attempts: 0, paused: undefined, unavailable: undefined } });
    const neo = h.world.agents.get('neo')!; neo.currentLocation = scene.set; neo.isInMatrix = false; neo.position = filmStepPosition(scene, scene.steps[1]);
    const before = structuredClone(state.tunnel), position = { ...neo.position };
    h.players.release('film-player', h.tick()); h.players.possess('film-player', 'neo', h.tick());
    assert.deepEqual(neo.currentAction?.parameters.signal, before, 'the camera and visibility need the saved gesture immediately on paused reconnect');
    assert.deepEqual(state.tunnel, before); assert.deepEqual(neo.position, position);
    h.players.release('film-player', h.tick());
    assert.deepEqual(neo.currentAction?.parameters.signal, before, 'leaving a character must preserve its paused performance');
  }
});

test('a tunnel retry returns Neo to the signal point rather than the locked scene entrance', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!, scene = FILM_SCENE_BY_ID.m2_stop_sentinels;
  Object.assign(state, { scene: scene.id, actor: 'neo', step: 1, checkpoint: filmPosition(scene.set, 0, 46),
    tunnel: { phase: 'failed', remaining: 0, focus: 0, lastTick: h.tick(), attempts: 0 } });
  h.actor().currentLocation = scene.set; h.actor().isInMatrix = false; h.actor().position = filmStepPosition(scene, scene.steps[1]);
  h.command('retry');
  assert.deepEqual(h.actor().position, filmStepPosition(scene, scene.steps[1]));
  h.players.receiveInput('film-player', { x: 0, z: 0, yaw: 0, focus: true, sequence: 1 }); h.players.step(.1, true, h.tick());
  assert.ok(state.tunnel!.focus > 0, 'ordinary G must work after retry');
});

test('Hammer reveals Neo and Bane on adjacent beds and hands the completed scene to Mobil Ave', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm2_stop_sentinels', actor: 'neo', step: FILM_SCENE_BY_ID.m2_stop_sentinels.steps.length,
    tunnel: { phase: 'collapsed', remaining: 4, focus: RELOADED_FINALE.signalSeconds, lastTick: h.tick(), attempts: 0 } });
  h.world.agents.get('neo')!.health = 1;
  h.command('next'); const medical = FILM_SCENE_BY_ID.m2_medical;
  assert.equal(state.scene, medical.id); assert.equal(h.actor().id, 'trinity');
  assert.equal(h.world.agents.get('neo')?.currentAction?.parameters.finaleComa, true);
  assert.equal(h.world.agents.get('neo')?.health, 1, 'the bed transition must preserve the collapse cost');
  assert.equal(h.world.agents.get('bane')?.currentAction?.parameters.finaleComa, true);
  assert.equal(h.world.agents.get('neo')?.position.x - h.world.agents.get('bane')!.position.x, -20);
  assert.match(h.players.possess('other-player', 'bane', h.tick()).error ?? '', /昏迷/);
  h.actor().position = filmPosition(medical.set, -9, -22.5);
  assert.match(h.players.act('film-player', 'talk', h.tick()), /Maggie/);
  for (const step of medical.steps) { h.actor().position = filmStepPosition(medical, step); h.command('act'); h.advance(6); }
  assert.ok(state.completed.includes(medical.id));
  h.command('next'); assert.equal(state.scene, 'm3_mobil'); assert.equal(h.actor().id, 'neo');
});

test('story role handoffs never take a character away from another player', () => {
  const h = setup(); h.players.possess('other-player', 'trinity', 0);
  assert.match(h.command('start'), /另一位玩家/);
  assert.equal(h.sandbox.state.neoLife!.journey, undefined);
  assert.equal(h.actor().id, 'neo'); assert.equal(h.players.getAgent('other-player')!.id, 'trinity');
  h.players.release('other-player', 1);
  const changed: string[] = []; h.players.onStoryRole = (_socket, id) => changed.push(id);
  h.command('start'); assert.equal(h.actor().id, 'trinity'); assert.deepEqual(changed, ['trinity']);
  assert.equal(h.actor().currentLocation, FILM_SCENES[0].set);
});

test('Hammer patient beds block ordinary walking but leave all three clinical objectives accessible after restore', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!, scene = FILM_SCENE_BY_ID.m2_medical;
  Object.assign(state, { scene: scene.id, actor: 'trinity', step: 0 });
  h.sandbox.life.film.reconcileCast();
  for (const x of [-10, 10]) assert.equal(playerBlocked(filmPosition(scene.set, x, -23), false, 1.1, h.sandbox.state.structures), true);
  for (const x of [-19, 19]) assert.equal(playerBlocked(filmPosition(scene.set, x, -46), false, 1.1, h.sandbox.state.structures), true, 'the rendered supply cabinets must be solid');
  for (const step of scene.steps) assert.equal(playerBlocked(filmStepPosition(scene, step), false, 1.1, h.sandbox.state.structures), false, step.label);
  const bed = filmPosition(scene.set, -10, -23), above = { ...bed, y: bed.y + 2 };
  assert.equal(groundHeight(above, false, h.sandbox.state.structures), bed.y + 1.9, 'a patient mattress supports someone above it');
  assert.equal(groundHeight(bed, false, h.sandbox.state.structures), bed.y, 'the mattress must not lift someone approaching from the floor');
  const medicalStructures = () => h.sandbox.state.structures.filter(s => s.id.startsWith('film:hammer-medical:'));
  const before = structuredClone(medicalStructures()); h.sandbox.restore(structuredClone(h.sandbox.state));
  assert.deepEqual(medicalStructures(), before, 'restoring must not duplicate or reorder the beds');
});

test('remote interactions, premature next and unvisited scene jumps cannot advance the plot', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.state.neoLife!.journey!;
  assert.match(h.command('act'), /走近/); assert.equal(state.started, undefined);
  assert.match(h.command('next'), /先完成/); assert.equal(state.scene, FILM_SCENES[0].id);
  assert.match(h.command('visit:m3_dawn'), /完成这个场景/); assert.equal(state.visiting, undefined);
  h.actor().position = filmStepPosition(FILM_SCENES[0], FILM_SCENES[0].steps[0]);
  h.command('act'); assert.equal(state.openingHotel?.phase, 'breach');
  assert.equal(state.step, 1); h.advance(4);
  assert.equal(state.openingHotel?.phase, 'combat'); assert.equal(h.sandbox.state.threats.length, 4);
});

test('a fight persists through simulation cleanup and can be retried after death without skipping it', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.state.neoLife!.journey!;
  state.step = 1; h.actor().position = filmStepPosition(FILM_SCENES[0], FILM_SCENES[0].steps[1]); state.checkpoint = { ...h.actor().position };
  h.command('act'); h.advance(); assert.equal(h.sandbox.state.threats.length, 4);
  assert.match(h.command('next'), /先完成/);
  h.actor().health = 0; h.actor().status = 'dead';
  h.command('retry'); assert.equal(h.actor().status, 'alive'); assert.equal(state.step, 1); assert.equal(h.sandbox.state.threats.length, 4);
  assert.equal(state.openingHotel?.phase, 'combat'); assert.equal(state.openingHotel?.attempts, 1);
});

test('saved scene, active fight, role and completed history restore without restarting the route', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.state.neoLife!.journey!;
  state.step = 1; h.actor().position = filmStepPosition(FILM_SCENES[0], FILM_SCENES[0].steps[1]); h.command('act');
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved); h.advance();
  assert.equal(h.sandbox.life.film.state!.actor, 'trinity'); assert.equal(h.sandbox.life.film.state!.step, 1);
  assert.equal(h.sandbox.state.threats.length, 4);
  h.players.release('film-player', h.tick()); h.players.possess('film-player', 'trinity', h.tick());
  assert.equal(h.sandbox.life.film.state!.scene, 'm1_room303'); assert.equal(h.sandbox.state.threats.length, 4);
});

test('303 breach saves its timing, then Trinity disarms, shoots and reaches the fire escape in order', () => {
  const h = setup(); h.command('start'); let state = h.sandbox.life.film.state!;
  const actor = h.actor(); const hotel = h.sandbox.life.film.openingHotel;
  assert.equal(state.openingHotel?.phase, 'trace');
  assert.ok(h.sandbox.state.structures.some(structure => structure.id === 'film:hotel303:3'));
  actor.position = filmPosition('film_heart_hotel', OPENING_HOTEL.computer.x, OPENING_HOTEL.computer.z);
  h.command('act'); h.advance(); assert.equal(state.openingHotel?.phase, 'breach');
  assert.equal(state.openingHotel.elapsed, .5);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); state = h.sandbox.life.film.state!;
  h.advance(2); assert.equal(state.openingHotel?.phase, 'combat'); assert.equal(state.step, 1);
  assert.equal(h.sandbox.state.threats.length, 4);
  assert.deepEqual(h.sandbox.state.threats.map(threat => threat.character), ['citizen_4', 'citizen_14', 'citizen_10', 'citizen_13']);
  assert.ok(!h.sandbox.state.structures.some(structure => structure.id === 'film:hotel303:3'));
  const lead = h.sandbox.state.threats[0];
  for (let hit = 0; lead.health > 0 && hit < 6; hit++) {
    actor.position = { ...lead.position, z: lead.position.z + 2 }; actor.rotation = Math.PI;
    h.sandbox.attack(actor, h.tick(), hit % 3);
  }
  assert.equal(lead.health, 0); assert.ok(state.openingHotel?.fallen);
  actor.position = { ...state.openingHotel!.fallen! }; h.command('act');
  assert.equal(state.openingHotel?.disarmed, true); assert.equal(state.openingHotel.ammo, OPENING_HOTEL.magazine);
  actor.position = filmPosition('film_heart_hotel', 0, 0);
  for (const target of [...h.sandbox.state.threats]) {
    for (let shot = 0; target.health > 0 && shot < 3; shot++) {
      const yaw = Math.atan2(target.position.x - actor.position.x, target.position.z - actor.position.z);
      hotel.shoot(actor, yaw, 0, h.tick());
    }
    assert.equal(target.health, 0);
  }
  assert.equal(state.openingHotel!.shots, 6); assert.equal(state.openingHotel!.ammo, 2);
  h.advance(); assert.equal(state.openingHotel?.phase, 'phone'); assert.equal(state.step, 2);
  actor.position = filmPosition('film_heart_hotel', OPENING_HOTEL.phone.x, OPENING_HOTEL.phone.z);
  h.command('act'); assert.equal(state.step, 3); assert.match(state.lastText, /Wells/);
  actor.position = filmStepPosition(FILM_SCENES[0], FILM_SCENES[0].steps[3]); h.advance(); assert.equal(state.step, 4);
  actor.position = filmPosition('film_heart_hotel', OPENING_HOTEL.window.x, OPENING_HOTEL.window.z);
  h.command('act'); assert.equal(state.openingHotel?.phase, 'dive'); h.advance(4);
  assert.equal(state.openingHotel?.phase, 'ladder_ready'); assert.equal(state.step, 5);
  h.command('act'); assert.equal(state.openingHotel?.phase, 'climbing');
  let sequence = 0;
  for (let frame = 0; frame < 40 && state.openingHotel?.phase === 'climbing'; frame++) {
    h.players.receiveInput('film-player', { x: 0, z: 0, yaw: 0, jump: false, sprint: false, climb: 1, sequence: ++sequence });
    h.players.step(.1, true, h.tick());
  }
  assert.equal(state.openingHotel?.phase, 'done'); assert.ok(state.completed.includes('m1_room303'));
});

test('303 fire escape requires upward input and preserves climbing progress through a save and disconnect', t => {
  let now = 10000; t.mock.method(Date, 'now', () => now);
  const h = setup(); h.command('start'); let state = h.sandbox.life.film.state!;
  state.step = 5; state.openingHotel!.phase = 'ladder_ready';
  h.actor().position = filmPosition('film_heart_hotel', 0, -30);
  h.command('act'); assert.equal(state.openingHotel?.phase, 'climbing');
  h.advance(20); assert.equal(state.openingHotel?.climbed, 0, 'waiting cannot climb the fire escape');
  let sequence = 0;
  const climb = () => {
    now += 20;
    h.players.receiveInput('film-player', { x: 0, z: 0, yaw: 0, jump: false, sprint: false, climb: 1, sequence: ++sequence });
    h.players.step(.1, true, h.tick());
  };
  for (let frame = 0; frame < 10; frame++) climb();
  const progress = state.openingHotel!.climbed!; assert.ok(progress > 1);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); state = h.sandbox.life.film.state!;
  h.advance(20); assert.equal(state.openingHotel?.climbed, progress);
  h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(state.openingHotel?.climbed, progress);
  h.players.possess('film-player', 'trinity', h.tick());
  for (let frame = 0; frame < 50 && state.openingHotel?.phase === 'climbing'; frame++) climb();
  assert.ok(state.completed.includes('m1_room303'));
});

test('303 combat can fail and retry, while disconnect freezes the breached-door sequence', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!;
  h.actor().position = filmStepPosition(FILM_SCENES[0], FILM_SCENES[0].steps[0]);
  h.command('act'); h.advance(); const elapsed = state.openingHotel!.elapsed;
  h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(state.openingHotel!.elapsed, elapsed);
  h.players.possess('film-player', 'trinity', h.tick()); h.advance(2);
  assert.equal(state.openingHotel?.phase, 'combat');
  h.actor().position = filmPosition('film_heart_hotel', 0, -5);
  const before = h.actor().health; h.advance(30);
  assert.ok(h.actor().health < before, 'police fire must threaten a stationary player');
  h.actor().health = 0; h.actor().status = 'dead';
  h.command('retry'); assert.equal(state.openingHotel?.phase, 'combat'); assert.equal(state.openingHotel?.attempts, 1);
  assert.equal(h.actor().health, h.actor().maxHealth); assert.equal(h.sandbox.state.threats.length, 4);
});

test('303 door blocks movement before the breach and the same player controls can cross afterward', () => {
  const h = setup(); h.command('start'); const center = FILM_SETS.film_heart_hotel.center;
  const actor = h.actor(); let sequence = 0;
  const walk = (x: number, z: number, frames = 100) => {
    const target = filmPosition('film_heart_hotel', x, z);
    for (let frame = 0; frame < frames; frame++) {
      const dx = target.x - actor.position.x; const dz = target.z - actor.position.z; const length = Math.hypot(dx, dz);
      if (length < 1.1) break;
      h.players.receiveInput('film-player', { x: dx / length, z: dz / length, yaw: Math.atan2(dx, dz), jump: false, sprint: false, sequence: ++sequence });
      h.players.step(.1, true, h.tick());
    }
  };
  walk(0, -5); assert.ok(actor.position.z - center.z > OPENING_HOTEL.doorZ, 'closed door should stop the player');
  actor.position = filmPosition('film_heart_hotel', OPENING_HOTEL.computer.x, OPENING_HOTEL.computer.z);
  h.command('act'); h.advance(4); assert.equal(h.sandbox.life.film.state?.openingHotel?.phase, 'combat');
  walk(0, 6); walk(0, -5);
  assert.ok(Math.hypot(actor.position.x - center.x, actor.position.z - center.z + 5) < 1.1, 'the open door should be walkable');
  const glass = filmPosition('film_heart_hotel', 0, -26.5);
  assert.equal(playerBlocked(glass, true, 1, h.sandbox.state.structures), true, 'the intact window bars early exit');
  h.sandbox.life.film.state!.openingHotel!.phase = 'dive'; h.sandbox.life.film.openingHotel.sync();
  assert.equal(playerBlocked(glass, true, 1, h.sandbox.state.structures), false, 'the broken window opens the exterior platform');
});

test('Trinity must answer the Wells phone before the truck arrives; the countdown saves and retries', () => {
  const h = setup(); h.command('start'); let state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m1_phone_escape;
  Object.assign(state, { scene: scene.id, step: 0, checkpoint: filmEntry(scene) });
  h.actor().currentLocation = scene.set; h.actor().position = filmEntry(scene);
  h.advance(2);
  assert.equal(state.openingPhone?.phase, 'running');
  const before = state.openingPhone!.remaining;
  h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(state.openingPhone!.remaining, before, 'disconnect pauses the approaching truck');
  h.players.possess('film-player', 'trinity', h.tick());
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); state = h.sandbox.life.film.state!;
  assert.equal(state.openingPhone!.remaining, before);
  h.advance(35);
  assert.equal(state.openingPhone?.phase, 'failed');
  assert.equal(state.step, 0); assert.match(h.command('next'), /先完成/);
  h.command('retry');
  assert.equal(state.openingPhone?.phase, 'running'); assert.equal(state.openingPhone?.attempts, 1);
  assert.deepEqual(h.actor().position, filmEntry(scene));
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.advance();
  assert.equal(state.step, 1);
  h.command('act');
  assert.equal(state.openingPhone?.phase, 'connected');
  assert.equal(h.sandbox.life.film.performing(h.actor()), true, 'the disconnected caller cannot walk into the truck impact');
  const exitedAt = { ...h.actor().position };
  h.players.receiveInput('film-player', { x: 1, z: 0, yaw: 0, jump: false, sprint: true, focus: false, sequence: 1 });
  h.players.step(.1, true, h.tick());
  assert.deepEqual(h.actor().position, exitedAt, 'movement input cannot move the disconnected caller');
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); state = h.sandbox.life.film.state!;
  assert.equal(h.sandbox.life.film.performing(h.actor()), true, 'the exit lock survives a save');
  h.advance(4); assert.equal(state.openingPhone?.phase, 'done');
  assert.equal(h.sandbox.life.film.performing(h.actor()), true, 'movement remains locked until the next scene');
  assert.ok(state.completed.includes(scene.id), 'answering immediately connects without a two-second wait');
});

test('Brown pursues Trinity across a real rooftop gap and a fall or capture restores the route', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m1_roofs;
  Object.assign(state, { scene: scene.id, step: 0, checkpoint: filmEntry(scene) });
  h.actor().currentLocation = scene.set; h.actor().position = filmEntry(scene);
  const brown = h.world.agents.get('agent_brown')!;
  brown.currentLocation = scene.set; brown.position = filmPosition(scene.set, 0, 43);
  assert.ok(groundHeight(filmPosition(scene.set, 0, -4), true) < filmEntry(scene).y - 10);
  const startZ = brown.position.z;
  h.advance(10);
  assert.ok(brown.position.z < startZ - 1, 'Brown leaves his staging mark');
  assert.equal(state.openingRoof?.phase, 'failed', 'standing still lets Brown catch the player');
  h.command('retry'); assert.equal(state.openingRoof?.phase, 'running');
  assert.equal(state.openingRoof?.attempts, 1); assert.equal(state.step, 0);
  h.actor().position = { ...filmPosition(scene.set, 0, -4), y: FILM_SETS[scene.set].center.y - 8 };
  h.advance(); assert.equal(state.openingRoof?.phase, 'failed', 'falling between roofs can fail the chase');
});

test('Brown leaps across the roof gap instead of running through empty air, and the leap survives a save', () => {
  const h = setup(); h.command('start'); let state = h.sandbox.life.film.state!;
  const roofs = FILM_SCENE_BY_ID.m1_roofs; const center = FILM_SETS[roofs.set].center;
  Object.assign(state, { scene: roofs.id, step: 1, checkpoint: filmEntry(roofs), openingRoof: { phase: 'running', lastTick: h.tick(), attempts: 0 } });
  h.actor().currentLocation = roofs.set; h.actor().position = filmPosition(roofs.set, 0, -20);
  const brown = h.world.agents.get('agent_brown')!;
  brown.currentLocation = roofs.set; brown.position = filmPosition(roofs.set, 0, 0);
  h.advance();
  assert.ok(brown.position.z - center.z < OPENING_ESCAPE.roofGapNear && brown.position.z - center.z > OPENING_ESCAPE.roofGapFar);
  assert.ok(brown.position.y > center.y + 1, 'Brown must be visibly airborne over the void');
  assert.ok(state.openingRoof?.leap && brown.currentAction?.parameters.openingRoofLeap);
  const elapsed = state.openingRoof!.leap!.elapsed;
  h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(state.openingRoof?.leap?.elapsed, elapsed, 'disconnect pauses the crossing');
  h.players.possess('film-player', 'trinity', h.tick());
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); state = h.sandbox.life.film.state!;
  assert.equal(state.openingRoof?.leap?.elapsed, elapsed);
  h.advance(3);
  assert.equal(state.openingRoof?.crossed, true);
  assert.equal(state.openingRoof?.leap, undefined);
  assert.ok(brown.position.z - center.z < OPENING_ESCAPE.roofGapFar && Math.abs(brown.position.y - center.y) < .01);
  assert.equal(state.openingRoof?.phase, 'running');
});

test('Trinity can walk from 303 through the roof gap and answer the phone without a player-position shortcut', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!;
  const room = FILM_SCENE_BY_ID.m1_room303; const roofs = FILM_SCENE_BY_ID.m1_roofs; const phone = FILM_SCENE_BY_ID.m1_phone_escape;
  let sequence = 0; let jumped = false;
  const move = (x: number, z: number, jump = false) => {
    h.players.receiveInput('film-player', { x, z, yaw: Math.atan2(x, z), jump, sprint: true, sequence: ++sequence });
    h.players.step(.1, true, h.tick());
    if (sequence % 5 === 0) h.advance();
  };
  const walkTo = (set: string, x: number, z: number, frames = 100) => {
    const target = filmPosition(set, x, z);
    for (let frame = 0; frame < frames && Math.hypot(target.x - h.actor().position.x, target.z - h.actor().position.z) > 2.5; frame++) {
      const dx = target.x - h.actor().position.x; const dz = target.z - h.actor().position.z;
      const length = Math.hypot(dx, dz); move(dx / length, dz / length);
    }
    assert.ok(Math.hypot(target.x - h.actor().position.x, target.z - h.actor().position.z) <= 2.5, `cannot reach ${set}: ${x}, ${z}`);
  };
  walkTo(room.set, OPENING_HOTEL.computer.x, OPENING_HOTEL.computer.z);
  h.command('act'); h.advance(4); assert.equal(state.openingHotel?.phase, 'combat');
  const lead = h.sandbox.state.threats[0];
  for (let strike = 0; lead.health > 0 && strike < 6; strike++) {
    walkTo(room.set, lead.position.x - FILM_SETS[room.set].center.x, lead.position.z - FILM_SETS[room.set].center.z + 2);
    h.actor().rotation = Math.atan2(lead.position.x - h.actor().position.x, lead.position.z - h.actor().position.z);
    h.sandbox.attack(h.actor(), h.tick(), strike % 3);
  }
  assert.equal(lead.health, 0);
  const fallen = state.openingHotel!.fallen!;
  walkTo(room.set, fallen.x - FILM_SETS[room.set].center.x, fallen.z - FILM_SETS[room.set].center.z);
  h.command('act'); assert.equal(state.openingHotel?.disarmed, true);
  walkTo(room.set, 0, 0);
  for (const target of [...h.sandbox.state.threats]) for (let shot = 0; target.health > 0 && shot < 3; shot++) {
    h.sandbox.life.film.openingHotel.shoot(h.actor(), Math.atan2(target.position.x - h.actor().position.x, target.position.z - h.actor().position.z), 0, h.tick());
  }
  h.advance(); assert.equal(state.step, 2);
  walkTo(room.set, 0, 6); walkTo(room.set, -8, 18);
  h.command('act'); assert.equal(state.step, 3);
  walkTo(room.set, 0, 6); walkTo(room.set, 0, -18);
  h.advance(); assert.equal(state.step, 4);
  walkTo(room.set, OPENING_HOTEL.window.x, OPENING_HOTEL.window.z);
  h.command('act'); h.advance(4); assert.equal(state.openingHotel?.phase, 'ladder_ready');
  h.command('act');
  for (let frame = 0; frame < 50 && state.openingHotel?.phase === 'climbing'; frame++) {
    h.players.receiveInput('film-player', { x: 0, z: 0, yaw: 0, jump: false, sprint: false, climb: 1, sequence: ++sequence });
    h.players.step(.1, true, h.tick());
  }
  assert.ok(state.completed.includes(room.id));
  h.command('next'); assert.equal(state.scene, roofs.id);
  for (let frame = 0; frame < 150 && state.openingRoof?.phase === 'running' && state.step < 2; frame++) {
    const localX = h.actor().position.x - FILM_SETS[roofs.set].center.x;
    const localZ = h.actor().position.z - FILM_SETS[roofs.set].center.z;
    const target = state.step === 0 ? { x: -7, z: 12 } : localZ > 2 ? { x: 7, z: 2 } : { x: 7, z: -14 };
    const dx = target.x - localX; const dz = target.z - localZ; const length = Math.hypot(dx, dz);
    const jump = state.step === 1 && !jumped && localZ < -.4 && localZ > -2;
    if (jump) jumped = true;
    move(dx / Math.max(.01, length), dz / Math.max(.01, length), jump);
  }
  assert.equal(state.openingRoof?.phase, 'running', state.lastText);
  assert.equal(state.step, 2, `rooftop route stopped at step ${state.step}`);
  assert.ok(jumped);
  for (let frame = 0; frame < 60 && state.openingRoof?.phase === 'running'; frame++) {
    const target = filmStepPosition(roofs, roofs.steps[2]);
    const dx = target.x - h.actor().position.x; const dz = target.z - h.actor().position.z;
    const length = Math.hypot(dx, dz); move(dx / Math.max(.01, length), dz / Math.max(.01, length));
    if (length <= 3) break;
  }
  assert.equal(state.openingRoof?.phase, 'running', state.lastText);
  h.command('act'); h.advance(6);
  assert.ok(state.completed.includes(roofs.id), state.lastText);
  h.command('next'); assert.equal(state.scene, phone.id);
  for (let frame = 0; frame < 115 && state.openingPhone?.phase === 'running' && state.step === 0; frame++) move(0, -1);
  assert.equal(state.step, 1, state.lastText);
  h.command('act'); assert.equal(state.openingPhone?.phase, 'connected');
  h.advance(4); assert.equal(state.openingPhone?.phase, 'done');
  h.command('next'); assert.equal(state.scene, 'm1_wake_up');
});

test('reconnecting a defeated story actor rebuilds at the scene checkpoint instead of their daily home', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.state.neoLife!.journey!;
  state.step = 1; h.actor().position = filmStepPosition(FILM_SCENES[0], FILM_SCENES[0].steps[1]); state.checkpoint = { ...h.actor().position };
  h.command('act'); h.actor().health = 0; h.actor().status = 'dead';
  assert.equal(h.players.possess('film-player', 'trinity', h.tick(), true).agentId, 'trinity');
  assert.equal(h.actor().currentLocation, FILM_SCENES[0].set);
  assert.deepEqual(h.actor().position, state.checkpoint);
  assert.equal(h.actor().health, h.actor().maxHealth); assert.equal(state.step, 1);
  assert.equal(state.fighting, true); assert.equal(h.sandbox.state.threats.length, 4);
});

test('melee outside a scripted fight cannot kill the film cast', () => {
  const h = setup(); h.command('start');
  const actor = h.actor(); const cypher = h.world.agents.get('cypher')!;
  actor.rotation = Math.PI; cypher.position = { ...actor.position, z: actor.position.z - 1 }; cypher.isInMatrix = true;
  h.players.act('film-player', 'attack', h.tick());
  for (let i = 0; i < 10; i++) h.players.step(.1, true, h.tick());
  assert.deepEqual(h.attacked, []);
});

test('Neo sits for the demonstration, explicitly takes the spoon, focuses and stands before leaving', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m1_spoon; Object.assign(state, { scene: scene.id, actor: 'neo', step: 0, oracle: undefined });
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.actor().currentLocation = scene.set;
  const lesson = () => h.sandbox.life.film.state!.oracle!.spoonLesson!;
  h.command('act'); assert.equal(state.started, undefined); assert.equal(lesson()?.phase, 'sitting');
  assert.equal(h.actor().currentAction?.parameters.spoon, undefined, 'Neo cannot own the prop before accepting it');
  let sequence = 10;
  const focus = (seconds: number, held = true, running = true) => {
    for (let i = 0; i < seconds * 10; i++) {
      h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, focus: held, sequence: sequence++ });
      h.players.step(.1, running, h.tick());
    }
  };
  focus(20); assert.equal(lesson().phase, 'offered', 'waiting or a held key cannot accept the spoon automatically');
  assert.equal(state.oracle!.spoon, 0); assert.equal(state.step, 0);
  h.command('act'); assert.equal(lesson().phase, 'receiving');
  focus(.5, false); assert.equal(h.actor().currentAction?.parameters.spoon, undefined);
  focus(.8, false); assert.equal(h.world.agents.get('spoon_boy')!.currentAction?.parameters.spoon, undefined);
  assert.equal(h.actor().currentAction?.parameters.spoon, 0, 'only Neo holds the transferred spoon');
  focus(2, false); assert.equal(lesson().phase, 'focus');
  focus(2); const bent = h.sandbox.life.film.state!.oracle!.spoon!; assert.ok(bent > .3 && bent < 1);
  focus(1, false); assert.ok(h.sandbox.life.film.state!.oracle!.spoon! < bent, 'releasing attention visibly relaxes the metal');
  focus(1); const paused = state.oracle!.spoon; focus(1, true, false); assert.equal(state.oracle!.spoon, paused);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); assert.equal(h.sandbox.life.film.state!.oracle!.spoon, paused);
  focus(6); assert.equal(lesson().phase, 'understood'); assert.equal(h.sandbox.life.film.state!.step, 0);
  assert.equal(h.sandbox.life.state!.choices.spoon, 'bent');
  h.command('act'); assert.equal(lesson().phase, 'understood', 'Neo waits for the hostess invitation before rising');
  focus(12, false); assert.equal(h.sandbox.life.film.state!.oracle!.reception!.phase, 'inviting');
  h.command('act'); assert.equal(lesson().phase, 'rising');
  focus(3, false); assert.equal(lesson().phase, 'done'); assert.equal(h.sandbox.life.film.state!.step, 1);
  assert.equal(h.sandbox.life.film.performing(h.actor()), false, 'walking returns only after Neo stands');
});

test('walking from the waiting room into the Oracle kitchen preserves Neo position and heading', () => {
  const h = setup(); h.command('continue');
  const scene = FILM_SCENE_BY_ID.m1_spoon;
  Object.assign(h.sandbox.life.film.state!, { scene: scene.id, actor: 'neo', step: scene.steps.length, oracle: { spoon: 1 } });
  h.actor().position = filmPosition(scene.set, 0, -8); h.actor().currentLocation = scene.set; h.actor().rotation = -.3;
  const position = { ...h.actor().position };
  h.command('next');
  assert.equal(h.sandbox.life.film.state!.scene, 'm1_oracle');
  assert.deepEqual(h.actor().position, position, 'the next room in the same apartment must not move Neo back to a scene entrance');
  assert.equal(h.actor().rotation, -.3);
});

test('Oracle reception waits for Neo, preserves the invitation on pause and reconnect, and respects a controlled hostess', () => {
  const h = setup(); h.command('continue');
  Object.assign(h.sandbox.life.film.state!, { scene: 'm1_spoon', actor: 'neo', step: 0, oracle: { spoon: 1, spoonLesson: { phase: 'understood', elapsed: 0 } } });
  h.actor().position = filmPosition('film_oracle_home', -7.4, 9.6); h.actor().currentLocation = 'film_oracle_home';
  const oracle = () => h.sandbox.life.film.state!.oracle!;
  for (let i = 0; i < 30; i++) h.players.step(.1, true, h.tick());
  assert.equal(oracle().reception!.phase, 'approaching'); const progress = oracle().reception!.progress, clock = oracle().waitingTime;
  h.players.step(.1, false, h.tick()); assert.equal(oracle().reception!.progress, progress); assert.equal(oracle().waitingTime, clock);
  h.players.release('film-player', h.tick()); h.advance(20); assert.equal(oracle().reception!.progress, progress);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); h.players.possess('film-player', 'neo', h.tick());
  assert.equal(oracle().reception!.progress, progress);
  h.players.possess('host-player', 'oracle_priestess', h.tick());
  const hostess = h.world.agents.get('oracle_priestess')!, position = { ...hostess.position };
  for (let i = 0; i < 20; i++) h.players.step(.1, true, h.tick());
  assert.equal(oracle().reception!.progress, progress); assert.deepEqual(hostess.position, position);
  assert.match(h.command('act'), /另一位玩家/);
  h.players.release('host-player', h.tick());
  for (let i = 0; i < 90; i++) h.players.step(.1, true, h.tick());
  assert.equal(oracle().reception!.phase, 'inviting'); h.command('act');
  for (let i = 0; i < 60; i++) h.players.step(.1, true, h.tick());
  assert.equal(oracle().spoonLesson!.phase, 'done'); assert.equal(oracle().reception!.phase, 'guiding');
  const waiting = oracle().reception!.progress;
  for (let i = 0; i < 50; i++) h.players.step(.1, true, h.tick());
  assert.equal(oracle().reception!.progress, waiting, 'the hostess cannot leave a stationary Neo behind');
});

test('following the Oracle hostess uses ordinary player movement and enters the kitchen without a teleport', () => {
  const h = setup(); h.command('continue');
  Object.assign(h.sandbox.life.film.state!, { scene: 'm1_spoon', actor: 'neo', step: 0, oracle: { spoon: 1, spoonLesson: { phase: 'understood', elapsed: 0 } } });
  h.actor().position = filmPosition('film_oracle_home', -7.4, 9.6); h.actor().currentLocation = 'film_oracle_home';
  for (let i = 0; i < 125; i++) h.players.step(.1, true, h.tick());
  h.command('act'); for (let i = 0; i < 30; i++) h.players.step(.1, true, h.tick());
  let sequence = 0;
  for (let frame = 0; frame < 500 && h.sandbox.life.film.state!.scene === 'm1_spoon'; frame++) {
    const state = h.sandbox.life.film.state!, hostess = h.world.agents.get('oracle_priestess')!;
    const target = state.oracle!.reception!.phase === 'ready' ? filmPosition('film_oracle_home', -1.8, -8.7)
      : { ...hostess.position, z: hostess.position.z + 1.8 };
    const dx = target.x - h.actor().position.x, dz = target.z - h.actor().position.z, length = Math.hypot(dx, dz), before = { ...h.actor().position };
    h.players.receiveInput('film-player', { x: length > .5 ? dx / length : 0, z: length > .5 ? dz / length : 0, yaw: Math.atan2(dx, dz), jump: false, sprint: false, sequence: ++sequence });
    h.players.step(.1, true, h.tick());
    assert.ok(Math.hypot(h.actor().position.x - before.x, h.actor().position.z - before.z) < 1, 'walking over the kitchen threshold must remain continuous');
    assert.equal(playerBlocked(h.actor().position, true), false);
    if (frame === 100) h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  }
  assert.equal(h.sandbox.life.film.state!.scene, 'm1_oracle');
  assert.ok(h.actor().position.z <= FILM_SETS.film_oracle_home.center.z - 8);
  assert.equal(h.actor().currentLocation, 'film_oracle_home');
  const hostess = h.world.agents.get('oracle_priestess')!, walkingLine = filmPosition('film_oracle_home', -2, -9.6);
  assert.ok(Math.hypot(hostess.position.x - walkingLine.x, hostess.position.z - walkingLine.z) >= 1.45,
    'the hostess must step aside instead of occupying Neo walking line through the kitchen door');
  for (const id of ['potential_blocks', 'potential_1', 'potential_2', 'potential_3', 'potential_4', 'oracle_attendant'])
    assert.ok(h.world.agents.get(id)!.currentAction?.parameters.oracleWaiting, `${id} remains in the waiting room across the kitchen handoff`);
});

test('the spoon handoff pauses for disconnects and an occupied child, and survives retry without duplicating the prop', () => {
  const h = setup(); h.command('continue'); const scene = FILM_SCENE_BY_ID.m1_spoon;
  Object.assign(h.sandbox.life.film.state!, { scene: scene.id, actor: 'neo', step: 0, oracle: undefined });
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.actor().currentLocation = scene.set;
  const lesson = () => h.sandbox.life.film.state!.oracle!.spoonLesson!;
  h.players.possess('child-player', 'spoon_boy', h.tick());
  assert.match(h.command('act'), /另一位玩家/); assert.equal(lesson()?.phase, 'waiting');
  h.players.release('child-player', h.tick()); h.command('act');
  h.players.receiveInput('film-player', { x: 1, z: 1, yaw: 0, jump: true, sprint: true, sequence: 1 });
  assert.match(h.players.act('film-player', 'attack', h.tick())!, /演出/);
  for (let i = 0; i < 15; i++) h.players.step(.1, true, h.tick());
  const progress = lesson().elapsed, position = { ...h.actor().position };
  h.players.step(.1, false, h.tick()); assert.equal(lesson().elapsed, progress);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.players.release('film-player', h.tick()); h.advance(20); assert.equal(lesson().elapsed, progress);
  h.players.possess('film-player', 'neo', h.tick()); assert.deepEqual(h.actor().position, position);
  h.players.possess('child-player', 'spoon_boy', h.tick());
  const child = h.world.agents.get('spoon_boy')!, childPosition = { ...child.position };
  for (let i = 0; i < 20; i++) h.players.step(.1, true, h.tick());
  assert.equal(lesson().elapsed, progress); assert.deepEqual(child.position, childPosition);
  h.players.release('child-player', h.tick());
  for (let i = 0; i < 70; i++) h.players.step(.1, true, h.tick());
  h.command('act'); for (let i = 0; i < 13; i++) h.players.step(.1, true, h.tick());
  assert.equal(lesson().phase, 'receiving'); const receiving = lesson().elapsed;
  h.actor().health = 0; h.actor().status = 'dead'; h.command('retry');
  assert.equal(lesson().elapsed, receiving); assert.equal(lesson().phase, 'receiving');
  assert.equal(h.actor().currentAction?.parameters.spoon, 0);
  assert.equal(h.world.agents.get('spoon_boy')!.currentAction?.parameters.spoon, undefined);
});

test('old Oracle waiting-room saves move clear of new walls and furniture without losing spoon progress', () => {
  for (const [x, z] of [[18, 12], [-18, 12], [-11.5, 14], [10.8, 9], [3, -13.7], [3, -20.3], [-7, 10]]) {
    const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
    Object.assign(state, { scene: 'm1_spoon', actor: 'neo', step: 0, oracle: { spoon: .42 }, checkpoint: filmPosition('film_oracle_home', x, z) });
    h.actor().position = { ...state.checkpoint }; h.actor().currentLocation = 'film_oracle_home';
    h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
    const restored = h.sandbox.life.film.state!;
    assert.ok(Math.abs(h.actor().position.x - FILM_SETS.film_oracle_home.center.x) < 13, 'the actor cannot be stranded outside the new apartment walls');
    assert.equal(playerBlocked(h.actor().position, true), false, 'restoring inside a new solid seat must return the actor to the clear aisle');
    assert.equal(playerBlocked(restored.checkpoint, true), false);
    assert.ok(Math.abs(restored.checkpoint.x - FILM_SETS.film_oracle_home.center.x) < 13);
    assert.equal(restored.oracle?.spoon, .42); assert.equal(restored.step, 0);
    if (x === -7) assert.deepEqual(h.actor().position, filmPosition('film_oracle_home', x, z), 'an already safe saved position must not be reset');
  }
});

test('the Oracle vase falls once, pauses and restores mid-fall, then leaves a persistent result for the conversation', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m1_oracle; Object.assign(state, { scene: scene.id, actor: 'neo', step: 0 });
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.actor().currentLocation = scene.set;
  h.command('act'); assert.equal(state.started, undefined); assert.equal(state.oracle!.vase, 0);
  const position = { ...h.actor().position };
  h.players.receiveInput('film-player', { x: 1, z: 0, yaw: 0, jump: true, sprint: true, sequence: 10 });
  assert.match(h.players.act('film-player', 'attack', h.tick())!, /演出/);
  for (let i = 0; i < 15; i++) h.players.step(.1, true, h.tick());
  assert.deepEqual(h.actor().position, position, 'turning toward the vase cannot be interrupted by a run or jump');
  const time = state.oracle!.vase!; assert.ok(time >= 1.4 && time < 2);
  h.players.step(.1, false, h.tick()); assert.equal(state.oracle!.vase, time);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.players.release('film-player', h.tick()); h.advance(12); assert.equal(h.sandbox.life.film.state!.oracle!.vase, time);
  h.players.possess('film-player', 'neo', h.tick());
  for (let i = 0; i < 45; i++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.life.film.state!.step, 1); assert.equal(h.sandbox.life.state!.choices.oracle_vase, 'broken');
  h.actor().position = filmStepPosition(scene, scene.steps[1]);
  assert.match(h.command('reflect:agency'), /花瓶|检查/);
  assert.equal(h.sandbox.life.state!.choices['m1_oracle:1'], undefined, 'a reflection cannot bypass the in-person consultation');
});

test('the Oracle examines Neo and offers a cookie before waiting for his explicit answer', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m1_oracle; Object.assign(state, { scene: scene.id, actor: 'neo', step: 0 });
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.actor().currentLocation = scene.set;
  h.command('act');
  for (let frame = 0; frame < 46; frame++) h.players.step(.1, true, h.tick());
  const consultation = () => (h.sandbox.life.film.state!.oracle as { consultation?: { phase: string; elapsed: number; answer?: string } })?.consultation;
  assert.equal(state.step, 1); assert.equal(consultation()?.phase, 'waiting');
  for (let frame = 0; frame < 100; frame++) h.players.step(.1, true, h.tick());
  assert.equal(consultation()?.phase, 'waiting', 'time alone cannot start the consultation');

  h.actor().position = filmStepPosition(scene, scene.steps[1]);
  h.players.possess('oracle-player', 'oracle', h.tick());
  assert.match(h.command('act'), /另一位玩家/); assert.equal(consultation()?.phase, 'waiting');
  h.players.release('oracle-player', h.tick()); h.command('act');
  assert.equal(consultation()?.phase, 'examining');
  for (let frame = 0; frame < 34; frame++) h.players.step(.1, true, h.tick());
  const elapsed = consultation()!.elapsed; assert.ok(elapsed > 3 && elapsed < 3.5);
  h.players.step(.1, false, h.tick()); assert.equal(consultation()!.elapsed, elapsed);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); assert.equal(consultation()!.elapsed, elapsed);
  h.players.release('film-player', h.tick()); h.advance(20); assert.equal(consultation()!.elapsed, elapsed);
  h.players.possess('film-player', 'neo', h.tick());
  for (let frame = 0; frame < 90; frame++) h.players.step(.1, true, h.tick());
  assert.equal(consultation()?.phase, 'question'); assert.equal(h.sandbox.life.film.state!.step, 1);
  for (let frame = 0; frame < 100; frame++) h.players.step(.1, true, h.tick());
  assert.equal(consultation()?.phase, 'question', 'the Oracle cannot choose an answer for Neo');

  assert.match(h.command('reflect:care'), /具体的人/); assert.equal(consultation()?.phase, 'responding');
  assert.equal(h.sandbox.life.state!.choices.oracle_first, 'rescue');
  assert.ok(h.sandbox.life.state!.journal.some(entry => entry.title.includes('厨房里的预言') && entry.text.includes('具体的人')));
  for (let frame = 0; frame < 50; frame++) h.players.step(.1, true, h.tick());
  assert.equal(consultation()?.phase, 'done'); assert.equal(h.sandbox.life.film.state!.step, 2);
  assert.equal(h.sandbox.life.state!.choices['m1_oracle:1'], 'care');
});

test('the Oracle answer changes later rescue preparation exactly once', () => {
  const outcomes = [
    { answer: 'doubt', item: 'code', amount: 10 },
    { answer: 'rescue', item: 'medkit', amount: 3 },
    { answer: 'observe', item: 'beacon', amount: 1 },
  ] as const;
  for (const outcome of outcomes) {
    const h = setup(); h.command('continue'); const life = h.sandbox.life.state!; const state = h.sandbox.life.film.state!;
    life.choices.oracle_first = outcome.answer;
    Object.assign(state, { scene: 'm1_unplugged', actor: 'neo', step: FILM_SCENE_BY_ID.m1_unplugged.steps.length });
    const inventory = h.sandbox.state.profiles.neo.inventory; const before = inventory[outcome.item];
    h.command('next'); assert.equal(state.scene, 'm1_rescue_decision');
    assert.equal(inventory[outcome.item], before + outcome.amount); assert.equal(life.choices.oracle_prepared, outcome.answer);
    Object.assign(state, { scene: 'm1_unplugged', actor: 'neo', step: FILM_SCENE_BY_ID.m1_unplugged.steps.length });
    h.command('next'); assert.equal(inventory[outcome.item], before + outcome.amount, 're-entering cannot duplicate the preparation');
  }
});

test('Neo turns the rescue decision into a saved three-person briefing before entering the Construct', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m1_rescue_decision;
  Object.assign(state, { scene: scene.id, actor: 'neo', step: 0, rescue: undefined, checkpoint: filmEntry(scene) });
  h.actor().currentLocation = scene.set; h.actor().isInMatrix = false;
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.command('reflect:care');
  assert.equal(state.step, 1); assert.equal(state.rescue, undefined, 'the reflection does not silently start the physical briefing');

  h.actor().position = filmStepPosition(scene, scene.steps[1]);
  h.players.possess('other-player', 'tank', h.tick());
  assert.match(h.command('act'), /另一位玩家/); assert.equal(state.rescue?.phase, 'briefing_ready');
  h.players.release('other-player', h.tick()); h.command('act');
  assert.equal(state.rescue?.phase, 'briefing');
  assert.ok(h.world.agents.get('trinity')!.currentAction?.parameters.rescue);
  assert.ok(h.world.agents.get('tank')!.currentAction?.parameters.rescue);
  assert.match(h.players.possess('other-player', 'trinity', h.tick()).error!, /营救准备/);

  for (let frame = 0; frame < 31; frame++) h.players.step(.1, true, h.tick());
  const elapsed = state.rescue!.elapsed; h.players.step(.5, false, h.tick()); assert.equal(state.rescue!.elapsed, elapsed);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(h.sandbox.life.film.state!.rescue!.elapsed, elapsed);
  h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(h.sandbox.life.film.state!.rescue!.elapsed, elapsed, 'disconnecting cannot finish the briefing');
  h.players.possess('film-player', 'neo', h.tick());
  for (let frame = 0; frame < 70 && h.sandbox.life.film.state!.step === 1; frame++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.life.film.state!.rescue?.phase, 'briefing_done');
  assert.equal(h.sandbox.life.film.state!.step, scene.steps.length); assert.ok(h.sandbox.life.film.state!.completed.includes(scene.id));
});

test('the Construct waits for Neo to load racks, saves the selected physical loadout and carries its rules into the lobby', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m1_guns;
  Object.assign(state, { scene: scene.id, actor: 'neo', step: 0, rescue: undefined, checkpoint: filmEntry(scene) });
  h.actor().currentLocation = scene.set; h.actor().isInMatrix = true; h.actor().position = filmStepPosition(scene, scene.steps[0]);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(h.sandbox.life.film.state!.rescue?.phase, 'racks_ready');
  h.advance(20); assert.equal(h.sandbox.life.film.state!.rescue?.elapsed, 0, 'the racks do not arrive until Neo requests them');

  h.players.possess('other-player', 'trinity', h.tick()); assert.match(h.command('act'), /另一位玩家/);
  h.players.release('other-player', h.tick()); h.command('act');
  assert.equal(h.sandbox.life.film.state!.rescue?.phase, 'racks_arriving');
  for (let frame = 0; frame < 25; frame++) h.players.step(.1, true, h.tick());
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved);
  assert.ok(h.sandbox.life.film.state!.rescue!.elapsed > 2.4);
  for (let frame = 0; frame < 30; frame++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.life.film.state!.rescue?.phase, 'selecting');
  const nearestDistance = Math.min(...Object.values(RESCUE.loadoutRoots).map(root => {
    const position = filmPosition(scene.set, root.x, root.z); return Math.hypot(h.actor().position.x - position.x, h.actor().position.z - position.z);
  }));
  assert.ok(nearestDistance > 4, 'the rack reveal must return Neo to a neutral viewing point instead of preselecting the middle weapon');
  assert.match(h.command('act'), /走近/); assert.equal(h.sandbox.life.film.state!.rescue?.phase, 'selecting');
  h.advance(30); assert.equal(h.sandbox.life.film.state!.rescue?.phase, 'selecting', 'waiting cannot pick a weapon for the player');

  const compact = RESCUE.loadoutRoots.compact;
  h.actor().position = filmPosition(scene.set, compact.x, compact.z); h.command('act');
  assert.equal(h.sandbox.life.film.state!.rescue?.phase, 'equipping'); assert.equal(h.sandbox.life.film.state!.rescue?.loadout, 'compact');
  for (let frame = 0; frame < 60 && h.sandbox.life.film.state!.step === 0; frame++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.life.film.state!.rescue?.phase, 'equipped'); assert.equal(h.sandbox.life.state!.choices.rescue_loadout, 'compact');
  assert.equal(h.sandbox.life.film.state!.step, 1);

  h.actor().position = filmStepPosition(scene, scene.steps[1]); h.advance();
  assert.ok(h.sandbox.life.film.state!.completed.includes(scene.id)); h.command('next');
  assert.equal(h.sandbox.life.film.state!.scene, 'm1_lobby');
  assert.equal(h.sandbox.life.film.state!.lobby?.loadout, 'compact');
  assert.equal(h.sandbox.life.film.state!.lobby?.ammo, RESCUE_LOADOUTS.compact.magazine);
  assert.equal(h.world.agents.get('trinity')!.rotation, Math.PI, 'Trinity faces the checkpoint before the breach');
  assert.equal(h.world.agents.get('citizen_12')!.rotation, 0, 'the guard faces the approaching players');
});

test('legacy rescue checkpoints migrate to a non-replaying rifle loadout', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!; const scene = FILM_SCENE_BY_ID.m1_guns;
  Object.assign(state, { scene: scene.id, actor: 'neo', step: 1, rescue: undefined, checkpoint: filmStepPosition(scene, scene.steps[1]) });
  h.actor().currentLocation = scene.set; h.actor().isInMatrix = true; h.actor().position = { ...state.checkpoint };
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.deepEqual(h.sandbox.life.film.state!.rescue, { phase: 'equipped', elapsed: 0, loadout: 'rifle' });
  assert.equal(h.actor().currentAction?.parameters.rescue, undefined, 'a migrated save remains walkable instead of replaying the equip animation');
});

test('Morpheus must actively hold the bathroom line before choosing the sacrificial tackle', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m1_bathroom;
  Object.assign(state, { scene: scene.id, actor: 'morpheus', step: 0, betrayal: undefined });
  h.players.release('film-player', h.tick()); h.players.possess('film-player', 'morpheus', h.tick());
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.actor().currentLocation = scene.set; h.actor().isInMatrix = true;
  h.command('act');
  const encounter = () => h.sandbox.life.film.state!.betrayal!;
  assert.equal(encounter().kind, 'bathroom'); assert.equal(encounter().phase, 'defending');
  assert.match(h.players.possess('other-player', 'neo', h.tick()).error!, /背叛片段/, 'the escaping crew stays reserved once the holdout starts');
  const smith = () => h.sandbox.state.threats.find(threat => threat.scene === scene.id && threat.character === 'smith')!;
  assert.ok(smith()); smith().stunUntil = Number.MAX_SAFE_INTEGER;

  for (let frame = 0; frame < 130; frame++) h.players.step(.1, true, h.tick());
  assert.equal(encounter().elapsed, 12); assert.equal(state.step, 0, 'waiting out the timer cannot replace defending the crew');
  for (const combo of [0, 1, 2]) {
    smith().position = { ...h.actor().position, z: h.actor().position.z - 2 }; h.actor().rotation = Math.PI;
    h.sandbox.attack(h.actor(), h.tick(), combo);
  }
  h.players.step(.1, true, h.tick());
  assert.equal(encounter().repels, 3); assert.equal(encounter().phase, 'sacrifice_ready'); assert.equal(state.step, 1);

  assert.match(h.players.possess('other-player', 'smith', h.tick()).error!, /背叛片段/);
  h.command('act'); assert.equal(encounter().phase, 'sacrifice');
  for (let frame = 0; frame < 24; frame++) h.players.step(.1, true, h.tick());
  const elapsed = encounter().elapsed; h.players.step(.1, false, h.tick()); assert.equal(encounter().elapsed, elapsed);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.players.release('film-player', h.tick()); h.advance(20); assert.equal(encounter().elapsed, elapsed);
  h.players.possess('film-player', 'morpheus', h.tick());
  for (let frame = 0; frame < 70; frame++) h.players.step(.1, true, h.tick());
  assert.equal(encounter().phase, 'done'); assert.equal(h.sandbox.life.film.state!.step, 2); assert.ok(h.sandbox.life.film.state!.completed.includes(scene.id));
  assert.equal(h.sandbox.life.state!.choices.morpheus_captured, 'sacrifice');
});

test('legacy betrayal checkpoints migrate without replaying cleared or completed beats', () => {
  const bathroom = setup(); bathroom.command('continue');
  const bathroomState = bathroom.sandbox.life.film.state!; const bathroomScene = FILM_SCENE_BY_ID.m1_bathroom;
  Object.assign(bathroomState, { scene: bathroomScene.id, actor: 'morpheus', step: 1, betrayal: undefined,
    checkpoint: filmStepPosition(bathroomScene, bathroomScene.steps[1]) });
  bathroom.players.release('film-player', bathroom.tick()); bathroom.players.possess('film-player', 'morpheus', bathroom.tick());
  bathroom.actor().currentLocation = bathroomScene.set; bathroom.actor().isInMatrix = true;
  bathroom.sandbox.restore(JSON.parse(JSON.stringify(bathroom.sandbox.state)));
  assert.equal(bathroom.sandbox.life.film.state!.betrayal?.phase, 'sacrifice_ready', 'an old cleared fight resumes at the sacrificial choice');
  assert.equal(bathroom.sandbox.state.threats.length, 0);

  const unplugged = setup(); unplugged.command('continue');
  const unpluggedState = unplugged.sandbox.life.film.state!; const unpluggedScene = FILM_SCENE_BY_ID.m1_unplugged;
  Object.assign(unpluggedState, { scene: unpluggedScene.id, actor: 'tank', step: unpluggedScene.steps.length, betrayal: undefined,
    completed: [...new Set([...unpluggedState.completed, unpluggedScene.id])], checkpoint: filmStepPosition(unpluggedScene, unpluggedScene.steps[1]) });
  unplugged.players.release('film-player', unplugged.tick()); unplugged.players.possess('film-player', 'tank', unplugged.tick());
  unplugged.actor().currentLocation = unpluggedScene.set; unplugged.actor().isInMatrix = false;
  unplugged.sandbox.restore(JSON.parse(JSON.stringify(unplugged.sandbox.state)));
  assert.equal(unplugged.sandbox.life.film.state!.betrayal?.phase, 'done', 'a completed old checkpoint remains complete');
  assert.equal(unplugged.actor().currentAction?.parameters.betrayal, undefined, 'a completed checkpoint must not lock Tank in a finished pose');
  assert.match(unplugged.command('next'), /仍然选择去救他/);
});

test('Tank can fail and retry Cypher aim, then explicitly reconnect both surviving signals', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m1_unplugged;
  Object.assign(state, { scene: scene.id, actor: 'tank', step: 0, betrayal: undefined });
  h.players.release('film-player', h.tick()); h.players.possess('film-player', 'tank', h.tick());
  assert.equal(h.actor().currentAction?.parameters.betrayal, undefined, 'Tank must remain free to walk to the backup console');
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.actor().currentLocation = scene.set; h.actor().isInMatrix = false;
  h.advance(); assert.equal(state.step, 1);
  const encounter = () => h.sandbox.life.film.state!.betrayal!;
  h.players.possess('other-player', 'cypher', h.tick());
  assert.match(h.command('act'), /另一位玩家/);
  h.players.release('other-player', h.tick()); h.command('act');
  assert.equal(encounter().kind, 'unplugged'); assert.equal(encounter().phase, 'unplugging');
  for (let frame = 0; frame < 130 && h.actor().status === 'alive'; frame++) h.players.step(.1, true, h.tick());
  assert.equal(encounter().phase, 'failed'); assert.equal(h.actor().status, 'dead'); assert.equal(state.step, 1);

  h.command('retry'); assert.equal(h.actor().status, 'alive'); assert.equal(encounter().phase, 'ready');
  h.command('act');
  for (let frame = 0; frame < 100 && encounter().phase !== 'window'; frame++) h.players.step(.1, true, h.tick());
  assert.equal(encounter().phase, 'window');
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved);
  assert.equal(encounter().phase, 'window'); h.command('act'); assert.equal(encounter().phase, 'countering');
  for (let frame = 0; frame < 70 && encounter().phase !== 'reconnect'; frame++) h.players.step(.1, true, h.tick());
  assert.equal(encounter().phase, 'reconnect');
  h.command('act'); assert.equal(encounter().rescued, 1); assert.equal(state.step, 1);
  h.command('act'); assert.equal(encounter().rescued, 2); assert.equal(encounter().phase, 'done');
  assert.equal(h.sandbox.life.film.state!.step, 2); assert.ok(h.sandbox.life.film.state!.completed.includes(scene.id));
  for (const id of ['cypher', 'dozer', 'apoc', 'switch']) assert.equal(h.world.agents.get(id)!.status, 'dead', id);
  for (const id of ['neo', 'trinity', 'tank']) assert.equal(h.world.agents.get(id)!.status, 'alive', id);
});

test('the repeated cat seals the old exit, leaves the service passage open and preserves the changed space after reconnect', () => {
  for (const time of [.5, 1.5, 2, 3]) assert.deepEqual(ambushCat(time), ambushCat(time + 4.5), 'the second cat repeats the same path and movement');
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m1_dejavu; Object.assign(state, { scene: scene.id, actor: 'neo', step: 0 });
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.actor().currentLocation = scene.set;
  const door = { ...FILM_SETS[scene.set].center, z: FILM_SETS[scene.set].center.z - 21 };
  assert.equal(playerBlocked(door, true, 1.1, h.sandbox.state.structures), false);
  h.command('act'); assert.equal(state.started, undefined);
  for (let i = 0; i < 40; i++) h.players.step(.1, true, h.tick());
  const firstPass = state.ambush!.elapsed; assert.ok(firstPass > 3.9 && firstPass < 4.1);
  h.players.step(.1, false, h.tick()); assert.equal(state.ambush!.elapsed, firstPass);
  h.players.release('film-player', h.tick()); h.advance(20); assert.equal(state.ambush!.elapsed, firstPass);
  h.players.possess('film-player', 'neo', h.tick());
  for (let i = 0; i < 60; i++) h.players.step(.1, true, h.tick());
  assert.equal(state.step, 1);
  assert.equal(playerBlocked(door, true, 1.1, h.sandbox.state.structures), true, 'the visible brickwork must block the original door');
  const passage = { ...door, x: door.x - 17, z: door.z + 5 };
  assert.equal(playerBlocked(passage, true, 1.1, h.sandbox.state.structures), false);
  const barriers = h.sandbox.state.structures.filter(s => s.film?.scene === 'm1_dejavu'); assert.equal(barriers.length, 2);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.command('retry'); assert.equal(playerBlocked(door, true, 1.1, h.sandbox.state.structures), true);
  assert.equal(h.sandbox.state.structures.filter(s => s.film?.scene === 'm1_dejavu').length, 2, 'loading and retry cannot duplicate the sealed windows');
  h.sandbox.life.begin(h.world.agents.get('neo')!, h.tick(), true);
  assert.equal(h.sandbox.state.structures.filter(s => s.film?.scene === 'm1_dejavu').length, 0, 'a new cycle restores the original building');
});

test('ambush enemies can approach beside the sealed door without trying to dismantle the building', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!; const scene = FILM_SCENE_BY_ID.m1_dejavu;
  Object.assign(state, { scene: scene.id, actor: 'neo', step: 0 });
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.actor().currentLocation = scene.set;
  h.command('act'); for (let frame = 0; frame < 100; frame++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.state.structures.filter(s => s.film?.scene === 'm1_dejavu').length, 2);
  h.command('act'); h.advance();
  const center = FILM_SETS[scene.set].center;
  h.actor().position = { ...center, z: center.z - 18 };
  h.sandbox.state.threats.forEach((threat, i) => { threat.position = { ...center, x: center.x + i, z: center.z - 10 }; threat.stunUntil = 0; });
  h.advance(6);
  assert.ok(h.sandbox.state.threats.every(threat => Math.hypot(threat.position.x - h.actor().position.x, threat.position.z - h.actor().position.z) < 3.4), 'nearby film brickwork must not stop enemies several metres from the player');
  assert.ok(h.sandbox.state.structures.every(s => s.film?.scene !== 'm1_dejavu' || s.health === 1));
});

test('canonical losses persist across scene transitions, loading and character selection', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m1_unplugged;
  state.scene = scene.id; state.actor = scene.actor; state.step = 1;
  h.players.possess('film-player', scene.actor, h.tick());
  h.actor().isInMatrix = false; h.actor().currentLocation = scene.set;
  h.actor().position = filmStepPosition(scene, scene.steps[1]);
  h.command('act');
  for (let frame = 0; frame < 100 && state.betrayal?.phase !== 'window'; frame++) h.players.step(.1, true, h.tick());
  assert.equal(state.betrayal?.phase, 'window'); h.command('act');
  for (let frame = 0; frame < 70 && state.betrayal?.phase !== 'reconnect'; frame++) h.players.step(.1, true, h.tick());
  h.command('act'); h.command('act');
  for (const id of ['cypher', 'dozer', 'apoc', 'switch']) assert.equal(h.world.agents.get(id)!.status, 'dead', id);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); h.command('next');
  h.sandbox.life.film.releaseCast();
  for (const id of ['cypher', 'dozer', 'apoc', 'switch']) assert.equal(h.world.agents.get(id)!.status, 'dead', id);
  const owner = h.actor().id;
  assert.match(h.players.possess('film-player', 'switch', h.tick()).error!, /本轮/);
  assert.equal(h.actor().id, owner, 'a refused role must retain the current session');
  h.sandbox.life.begin(h.world.agents.get('neo')!, h.tick(), true);
  for (const id of ['cypher', 'dozer', 'apoc', 'switch']) assert.equal(h.world.agents.get(id)!.status, 'alive', id);
});

test('philosophical choices answer the current question and survive loading without duplicate rewards', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m2_hamann; state.scene = scene.id; state.actor = scene.actor; state.step = 3;
  h.players.possess('film-player', 'neo', h.tick()); h.actor().isInMatrix = false;
  h.actor().position = filmStepPosition(scene, scene.steps[3]);
  assert.match(h.command('reflect:care'), /生活|清水/);
  assert.equal(h.sandbox.life.state!.philosophy.care, 1);
  assert.equal(h.sandbox.life.state!.choices['m2_hamann:3'], 'care');
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.command('reflect:care'); assert.equal(h.sandbox.life.state!.philosophy.care, 1);
  assert.ok(h.sandbox.life.state!.journal.some(e => e.title.includes('维持谁的生活')));
  assert.notEqual(filmReflections('m1_oracle')[0].response, filmReflections('m2_architect')[0].response);
});

test('Mobil Ave plays Sati, her family, Trainman refusal and both tunnel loops in that order', () => {
  const h = setup(); h.command('continue'); let state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm2_medical', actor: 'trinity', step: FILM_SCENE_BY_ID.m2_medical.steps.length });
  h.players.possess('film-player', 'trinity', h.tick()); h.command('next');
  assert.equal(state.scene, 'm3_mobil'); assert.equal(h.actor().id, 'neo');
  assert.match(FILM_SCENE_BY_ID.m3_mobil.steps[0].label, /Sati/);
  assert.match(h.players.act('film-player', 'ability', h.tick()), /Trainman/);
  const center = FILM_SETS.film_mobil_station.center;
  h.actor().position = filmPosition('film_mobil_station', 0, -49); h.advance();
  assert.equal(state.step, 0, 'the loop cannot precede Trainman leaving');
  for (const id of ['m3_mobil', 'm3_family']) {
    const scene = FILM_SCENE_BY_ID[id];
    assert.equal(state.scene, id);
    for (const step of scene.steps) {
      h.actor().position = filmStepPosition(scene, step);
      if (step.kind === 'reach') h.advance();
      else if (step.kind === 'reflect') { if (id === 'm3_family') hearMobilFamily(h); h.command(`reflect:${filmReflections(id)[0].id}`); }
      else { h.command('act'); h.advance(8); }
    }
    h.command('next');
  }
  assert.equal(state.scene, 'm3_trainman');
  const train = FILM_SCENE_BY_ID.m3_trainman;
  h.actor().position = filmStepPosition(train, train.steps[0]); h.command('act');
  assert.equal(state.started, undefined, 'luggage cannot trigger the train arrival');
  portalFrames(h, 4);
  assert.equal(state.mobil?.phase, 'approaching');
  assert.match(h.players.possess('other-player', 'trainman', h.tick()).error ?? '', /列车片段/);
  const elapsed = state.mobil!.elapsed;
  h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(state.mobil?.elapsed, elapsed, 'the train must not arrive while its player is disconnected');
  h.players.possess('film-player', 'neo', h.tick());
  portalFrames(h, 55); assert.equal(state.mobil?.phase, 'stopped');
  assert.equal(state.step, 0, 'Neo must help the family himself after the train arrives');
  h.command('act'); portalFrames(h, 20); assert.equal(state.step, 1);
  h.actor().position = filmStepPosition(train, train.steps[1]); h.advance();
  assert.equal(state.step, 2);
  h.actor().position = filmStepPosition(train, train.steps[2]); h.command('act');
  assert.equal(state.mobil?.phase, 'refusing');
  const before = h.actor().health;
  for (let i = 0; i < 160 && state.mobil?.phase === 'refusing'; i++) h.players.step(.1, true, h.tick());
  assert.equal(state.mobil?.phase, 'departing'); assert.ok(h.actor().health < before);
  portalFrames(h, 35); assert.equal(state.mobil?.phase, 'gone');
  h.actor().position = filmStepPosition(train, train.steps[3]); h.advance();
  assert.equal(state.step, 4); assert.ok(h.actor().position.z > center.z + 35);
  assert.equal(h.sandbox.life.state?.choices.mobil_loop, 'one_end');
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); state = h.sandbox.life.film.state!;
  h.actor().position = filmStepPosition(train, train.steps[4]); h.advance();
  assert.equal(state.step, train.steps.length); assert.ok(h.actor().position.z < center.z - 35);
  assert.equal(h.sandbox.life.state?.choices.mobil_loop, 'both_ends');
});

test('Mobil Ave supports normal walking through an open train door and blocks a shut door', () => {
  const h = setup(); h.command('continue'); let state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm3_trainman', actor: 'neo', step: 2,
    mobil: { phase: 'stopped', elapsed: 0, lastTick: h.tick(), loops: 0 } });
  h.actor().position = filmPosition('film_mobil_station', 6, -20); h.actor().currentLocation = 'film_mobil_station';
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); state = h.sandbox.life.film.state!;
  h.sandbox.life.film.reconcileCast();
  const doorway = filmPosition('film_mobil_station', 7.83, -20);
  assert.equal(playerBlocked(doorway, true, 1.1, h.sandbox.state.structures), true, 'closed leaves occupy the visible threshold');
  state.mobil!.elapsed = 1; h.sandbox.life.film.reconcileCast();
  assert.equal(playerBlocked(doorway, true, 1.1, h.sandbox.state.structures), false);
  let position = filmPosition('film_mobil_station', 5.7, -20);
  for (let frame = 0; frame < 30; frame++) {
    position = stepPlayer(position, 0, { x: 1, z: 0, yaw: Math.PI / 2, sequence: frame }, .05, true, h.sandbox.state.structures).position;
    assert.equal(position.y, FILM_SETS.film_mobil_station.center.y, 'platform-to-car walking keeps feet on one level');
  }
  assert.ok(position.x > doorway.x + 1.3, 'the player genuinely crosses the threshold');
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved);
  assert.deepEqual(h.sandbox.state.structures, saved.structures, 'restoring a train does not move its colliders or change their order');
  state = h.sandbox.life.film.state!;
  Object.assign(state.mobil!, { phase: 'departing', elapsed: 1.5 }); h.advance();
  const floor = h.sandbox.state.structures.find(s => s.id === 'film:mobil:floor')!;
  for (const id of ['rama_kandra', 'kamala', 'sati']) {
    const passenger = h.world.agents.get(id)!;
    assert.equal(passenger.position.y, floor.position.y);
    assert.ok(Math.abs(passenger.position.z - floor.position.z) <= 2.1, `${id} must stay in the moving carriage`);
  }
});

test('Mobil Ave holds an approaching train when a family member is dead or controlled by another player', () => {
  for (const blocked of ['dead', 'owned']) {
    const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
    Object.assign(state, { scene: 'm3_trainman', actor: 'neo', step: 1,
      mobil: { phase: 'approaching', elapsed: 1, lastTick: h.tick(), loops: 0 } });
    h.actor().position = filmPosition('film_mobil_station', 6, -20); h.actor().currentLocation = 'film_mobil_station';
    const sati = h.world.agents.get('sati')!;
    if (blocked === 'dead') { sati.status = 'dead'; sati.health = 0; }
    else sati.controller = 'other-player';
    const position = { ...sati.position };
    portalFrames(h, 50);
    assert.equal(state.mobil!.elapsed, 1, `${blocked}: arrival must not silently proceed without Sati`);
    assert.deepEqual(sati.position, position);
    assert.equal(sati.status, blocked === 'dead' ? 'dead' : 'alive');
    assert.match(state.lastText, blocked === 'dead' ? /不能|无法|缺席/ : /玩家/);
  }
});

test('Neo cannot bypass Trainman by normally walking through the open Mobil doorway', () => {
  const h = setup(); h.command('continue'); let state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm3_trainman', actor: 'neo', step: 2,
    mobil: { phase: 'stopped', elapsed: 1, lastTick: h.tick(), loops: 0 } });
  h.actor().position = filmPosition('film_mobil_station', 5.7, -20); h.actor().currentLocation = 'film_mobil_station';
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); state = h.sandbox.life.film.state!;
  for (let frame = 0; frame < 30 && state.mobil!.phase === 'stopped'; frame++) {
    h.players.receiveInput('film-player', { x: 1, z: 0, yaw: Math.PI / 2, sequence: frame + 1, location: 'film_mobil_station' });
    h.players.step(.05, true, h.tick());
  }
  assert.equal(state.mobil!.phase, 'refusing', 'crossing the actual threshold must trigger Trainman without an extra G press');
  assert.ok(h.actor().position.x < FILM_SETS.film_mobil_station.center.x + 7, 'Neo must remain outside the carriage');
  assert.equal(state.step, 2);
});

test('Trainman launches Neo toward the tiled wall before he falls and recovers, and reconnecting preserves the beat', () => {
  const h = setup(); h.command('continue'); let state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm3_trainman', actor: 'neo', step: 2,
    mobil: { phase: 'stopped', elapsed: 1, lastTick: h.tick(), loops: 0 } });
  h.actor().position = filmPosition('film_mobil_station', 6, -20); h.actor().currentLocation = 'film_mobil_station';
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); state = h.sandbox.life.film.state!;
  h.command('act');
  for (let frame = 0; frame < 9; frame++) h.players.step(.1, true, h.tick());
  assert.ok(h.actor().position.y > FILM_SETS.film_mobil_station.center.y + .3, 'a strike throws his body above the platform rather than sliding an upright character');
  for (let frame = 0; frame < 6; frame++) h.players.step(.1, true, h.tick());
  assert.ok(h.actor().position.x < FILM_SETS.film_mobil_station.center.x - 12, 'Neo reaches the opposite tiled wall');
  const position = { ...h.actor().position }, beat = state.mobil!.elapsed, health = h.actor().health;
  h.players.release('film-player', h.tick()); h.advance(12);
  assert.equal(state.mobil!.elapsed, beat, 'disconnecting pauses the body motion');
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); state = h.sandbox.life.film.state!;
  h.players.possess('film-player', 'neo', h.tick());
  assert.deepEqual(h.actor().position, position, 'loading and reconnecting do not repeat the strike');
  assert.equal(state.mobil!.elapsed, beat);
  for (let frame = 0; frame < 65 && state.mobil!.phase === 'refusing'; frame++) h.players.step(.1, true, h.tick());
  assert.equal(state.mobil!.phase, 'departing'); assert.equal(state.step, 3);
  assert.equal(h.actor().health, Math.max(1, health - 10), 'the completed strike damages Neo only once');
});

test('Seraph loses the subway chase, Trinity crosses Hel garage and the rescue train returns for Neo', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const oracle = FILM_SCENE_BY_ID.m3_oracle_request;
  Object.assign(state, { scene: oracle.id, actor: oracle.actor, step: oracle.steps.length });
  h.players.possess('film-player', 'trinity', h.tick()); h.command('next');
  assert.equal(state.scene, 'm3_trainman_chase'); assert.equal(h.actor().id, 'seraph');
  const chase = FILM_SCENE_BY_ID.m3_trainman_chase; let sequence = 0;
  completeTrainmanChase(h, () => ++sequence);
  assert.ok(state.completed.includes(chase.id)); h.command('next');
  assert.equal(state.scene, 'm3_hel_garage'); assert.equal(h.actor().id, 'trinity');
  assert.equal(FILM_SCENE_BY_ID.m3_hel_garage.set, 'film_hel_garage');
  assert.match(FILM_SCENE_BY_ID.m3_hel_entry.steps[0].label, /电梯/);
  assert.match(FILM_SCENE_BY_ID.m3_hel_entry.steps[1].label, /衣帽间/);
  Object.assign(state, { scene: 'm3_hel_bargain', step: FILM_SCENE_BY_ID.m3_hel_bargain.steps.length, actor: 'trinity' });
  h.command('next'); assert.equal(state.scene, 'm3_mobil_release'); assert.equal(h.actor().id, 'neo');
  assert.equal(state.mobil?.phase, 'approaching');
  h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m3_mobil_release, FILM_SCENE_BY_ID.m3_mobil_release.steps[0]);
  h.advance(); assert.equal(state.step, 0, 'Neo cannot greet Trinity before the rescue train arrives');
  portalFrames(h, 90); assert.equal(state.mobil?.phase, 'stopped'); assert.equal(state.step, 1);
  assert.equal(state.mobil?.reunion?.phase, 'ready', 'the continuous train and doorway finish before greeting');
  assert.ok(h.world.agents.get('trinity')!.position.x < FILM_SETS.film_mobil_station.center.x + 8);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(h.sandbox.life.film.state!.mobil?.phase, 'stopped');
});

test('Club Hel elevator preserves a saved descent and waits for the player to pull the gate after arrival', () => {
  const h = setup(); h.command('continue'); let state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm3_hel_garage', actor: 'trinity', step: FILM_SCENE_BY_ID.m3_hel_garage.steps.length });
  h.players.possess('film-player', 'trinity', h.tick()); h.command('next');
  state = h.sandbox.life.film.state!;
  assert.equal(state.scene, 'm3_hel_entry');
  const door = filmPosition('film_club_hel', 0, 24.6);
  assert.equal(playerBlocked(door, true, 1.1, h.sandbox.state.structures), true);
  h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m3_hel_entry, FILM_SCENE_BY_ID.m3_hel_entry.steps[0]);
  h.command('act');
  assert.equal(state.step, 0, 'pressing the button starts the ride rather than completing it');
  assert.equal((state as typeof state & { helElevator?: { phase: string } }).helElevator?.phase, 'descending');
  assert.equal(h.sandbox.life.film.performing(h.actor()), true);
  h.advance(3);
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved);
  state = h.sandbox.life.film.state!;
  const elapsed = (state as typeof state & { helElevator?: { elapsed: number } }).helElevator!.elapsed;
  h.players.release('film-player', h.tick()); h.advance(8);
  assert.equal((state as typeof state & { helElevator?: { elapsed: number } }).helElevator!.elapsed, elapsed, 'the ride pauses without its player');
  h.players.possess('film-player', 'trinity', h.tick()); h.advance(Math.ceil(HEL_ELEVATOR.seconds * 2));
  assert.equal(state.step, 0); assert.equal(state.helElevator?.phase, 'arrived');
  assert.equal(playerBlocked(door, true, 1.1, h.sandbox.state.structures), true);
  h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m3_hel_entry, FILM_SCENE_BY_ID.m3_hel_entry.steps[0], state);
  h.command('act'); h.advance(Math.ceil(HEL_ELEVATOR.opening * 2));
  assert.equal(state.step, 1);
  assert.equal((state as typeof state & { helElevator?: { phase: string } }).helElevator?.phase, 'open');
  assert.equal(playerBlocked(door, true, 1.1, h.sandbox.state.structures), false);
  assert.equal(h.sandbox.life.film.performing(h.actor()), false);
  delete state.helElevator;
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.advance(1);
  assert.equal(h.sandbox.life.film.state!.helElevator?.phase, 'open', 'older saves after the elevator do not replay the descent');
  assert.equal(playerBlocked(door, true, 1.1, h.sandbox.state.structures), false);
});

function enterHelBargain(h: ReturnType<typeof setup>) {
  const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm3_hel_entry', actor: 'trinity', step: FILM_SCENE_BY_ID.m3_hel_entry.steps.length });
  h.players.possess('film-player', 'trinity', h.tick());
  for (const [id, x, z] of [['trinity', 0, -28], ['morpheus', -2.5, -24.8], ['seraph', 2.5, -24.8]] as const) {
    const member = h.world.agents.get(id)!; member.currentLocation = 'film_club_hel'; member.isInMatrix = true;
    member.position = filmPosition('film_club_hel', x, z); member.position.y = groundHeight(member.position, true); member.rotation = Math.PI;
  }
  h.command('next'); return h.sandbox.life.film.state!;
}

test('Club Hel bargain requires Trinity to disarm, refuse, dodge, counter, catch the gun and confront Merovingian', () => {
  const h = setup(); h.command('continue'); let state = h.sandbox.life.film.state!;
  state = enterHelBargain(h);
  const scene = FILM_SCENE_BY_ID.m3_hel_bargain;
  assert.equal(state.scene, scene.id);
  assert.equal(h.world.agents.get('merovingian')?.currentLocation, scene.set);
  assert.ok(Math.abs(h.world.agents.get('merovingian')!.position.z - filmPosition(scene.set, 0, -35).z) < .01);
  h.actor().position = filmStepPosition(scene, scene.steps[0]);
  h.command('act'); assert.equal(state.step, 0); assert.equal(state.helBargain?.phase, 'disarming');
  for (let frame = 0; frame < 36; frame++) h.players.step(.1, true, h.tick());
  assert.equal(state.step, 1); assert.equal(state.helBargain?.phase, 'disarmed');
  h.command('act'); assert.equal(state.step, 2); assert.equal(state.helBargain?.phase, 'offered');
  h.command(`reflect:${filmReflections(scene.id)[0].id}`); assert.equal(state.step, 3);
  assert.match(h.command('act'), /冲入人群/); assert.equal(state.helBargain?.phase, 'windup');
  assert.equal(h.command('act').includes('闪避'), true); assert.equal(state.step, 3, 'G cannot replace the dodge');
  h.advance(2); assert.equal(state.helBargain?.phase, 'evade');
  h.players.act('film-player', 'attack', h.tick()); assert.equal(state.step, 3, 'F before X cannot skip the dodge');
  h.players.act('film-player', 'dodge', h.tick()); assert.equal(state.helBargain?.phase, 'counter');
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved); state = h.sandbox.life.film.state!;
  h.advance(); assert.equal(state.helBargain?.phase, 'counter', 'reloading keeps the remaining counter window');
  h.actor().rotation = Math.PI;
  h.players.act('film-player', 'attack', h.tick()); assert.equal(state.step, 4); assert.equal(state.helBargain?.phase, 'airborne');
  h.command('act'); assert.equal(state.step, 4, 'G before the pistol is within reach cannot catch it');
  for (let frame = 0; frame < 31; frame++) h.players.step(.1, true, h.tick());
  h.command('act'); assert.equal(state.step, 4); assert.equal(state.helBargain?.phase, 'catching');
  for (let frame = 0; frame < 8; frame++) h.players.step(.1, true, h.tick());
  assert.equal(state.step, 5); assert.equal(state.helBargain?.phase, 'gunpoint');
  h.players.step(.1, true, h.tick());
  assert.equal(h.actor().currentAction?.parameters.weaponStyle, 'hel_pistol', 'the gun remains visible between movement frames');
  h.actor().position = filmStepPosition(scene, scene.steps[5]); h.actor().rotation = 0;
  h.command('act'); assert.equal(state.step, 5, 'the threat needs Trinity to face Merovingian');
  h.actor().rotation = Math.PI; h.command('act');
  assert.equal(state.step, scene.steps.length); assert.equal(state.helBargain?.phase, 'released');
  assert.equal(h.sandbox.life.state?.choices.neo_release, 'trinity_refused_trade');
});

test('Club Hel rush expires, retries from the confrontation and pauses when its player disconnects', () => {
  const h = setup(); h.command('continue'); let state = h.sandbox.life.film.state!;
  state = enterHelBargain(h);
  const scene = FILM_SCENE_BY_ID.m3_hel_bargain;
  h.actor().position = filmStepPosition(scene, scene.steps[0]);
  h.command('act'); for (let frame = 0; frame < 36; frame++) h.players.step(.1, true, h.tick());
  h.command('act'); h.command(`reflect:${filmReflections(scene.id)[0].id}`); h.command('act');
  h.advance(2); h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(state.helBargain?.phase, 'evade');
  h.players.possess('film-player', 'trinity', h.tick()); h.advance(10);
  assert.equal(state.helBargain?.phase, 'failed'); assert.equal(state.step, 3);
  assert.equal(h.command('act').includes('重试'), true);
  h.command('retry'); assert.equal(state.helBargain?.phase, 'ready'); assert.equal(state.helBargain?.attempts, 1);
  assert.equal(state.reflections[`${scene.id}:2`], filmReflections(scene.id)[0].id);
  assert.equal(h.sandbox.life.state?.choices.neo_release, undefined);
});

test('older Club Hel saves keep the refusal and resume at the new confrontation checkpoint', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm3_hel_bargain', actor: 'trinity', step: 2, helBargain: undefined, started: 4 });
  const choice = filmReflections('m3_hel_bargain')[0].id;
  state.reflections['m3_hel_bargain:1'] = choice;
  h.players.possess('film-player', 'trinity', h.tick());
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  const restored = h.sandbox.life.film.state!;
  assert.equal(restored.step, 3); assert.equal(restored.helBargain?.phase, 'ready');
  assert.equal(restored.reflections['m3_hel_bargain:2'], choice);
  assert.equal(restored.started, undefined);
});

test('another player holding Merovingian pauses Trinity’s Club Hel action window', () => {
  const h = setup(); h.command('continue'); const state = enterHelBargain(h);
  const scene = FILM_SCENE_BY_ID.m3_hel_bargain;
  h.actor().position = filmStepPosition(scene, scene.steps[0]);
  h.command('act'); for (let frame = 0; frame < 36; frame++) h.players.step(.1, true, h.tick());
  h.command('act'); h.command(`reflect:${filmReflections(scene.id)[0].id}`); h.command('act'); h.advance(2);
  assert.equal(state.helBargain?.phase, 'evade');
  h.players.possess('other', 'merovingian', h.tick()); h.advance(20);
  assert.equal(state.helBargain?.phase, 'evade'); assert.equal(state.helBargain?.elapsed, 0);
  assert.match(h.players.act('film-player', 'dodge', h.tick()), /暂停/);
  h.players.release('other', h.tick()); h.advance(10);
  assert.equal(state.helBargain?.phase, 'failed');
});

test('the tracking room has a walkable doorway and Neo sits before touching the mirror', () => {
  const set = FILM_SETS.film_lafayette;
  const target = filmStepPosition(FILM_SCENE_BY_ID.m1_mirror, FILM_SCENE_BY_ID.m1_mirror.steps[0]);
  assert.equal(playerBlocked(target, true), false, 'the approach marker must be reachable beside the chair');
  assert.equal(playerBlocked(filmPosition(set.id, -6, -11.5), true), false, 'the rear-room doorway stays open');
  assert.equal(playerBlocked(filmPosition(set.id, 2, -11.5), true), true, 'the tracking room is separated from the lounge');
  for (const [x, z] of [[-4.5, -9], [-6, -10], [-6, -11.5], [-6, -13], [-7.1, -14.6]])
    assert.equal(playerBlocked(filmPosition(set.id, x, z), true), false, `Neo can walk through the doorway at ${x}, ${z}`);
  const route = [PILL_ROOM.exit, { x: -5, z: -3.1 }, { x: -5, z: -9.8 }, { x: -6, z: -12.7 }, MIRROR_TOUCH];
  for (let segment = 1; segment < route.length; segment++) {
    const from = route[segment - 1], to = route[segment];
    for (let sample = 0; sample <= 20; sample++) {
      const t = sample / 20;
      const x = from.x + (to.x - from.x) * t, z = from.z + (to.z - from.z) * t;
      assert.equal(playerBlocked(filmPosition(set.id, x, z), true), false, `Neo can walk from the red-pill exit to the tracking chair at ${x}, ${z}`);
    }
  }
  const approach = { x: target.x - set.center.x, z: target.z - set.center.z };
  assert.deepEqual(awakeningPose({ kind: 'mirror', elapsed: 0, approach }), { ...awakeningPose({ kind: 'mirror', elapsed: 0 }), x: approach.x, z: approach.z });
  const seated = awakeningPose({ kind: 'mirror', elapsed: MIRROR_TIMING.wired, approach });
  assert.equal(seated.x, MIRROR_SEAT.x); assert.equal(seated.z, MIRROR_SEAT.z);
  assert.equal(mirrorSilver(MIRROR_TIMING.touch - .1), 0, 'silver appears after the hand touches the glass');
  assert.ok(mirrorSilver(MIRROR_TIMING.touch + .5) > 0);
});

test('an old standing-at-mirror save moves to the reachable chair approach', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm1_mirror', actor: 'neo', step: 0, awakening: undefined });
  h.actor().currentLocation = 'film_lafayette'; h.actor().position = filmPosition('film_lafayette', MIRROR_SEAT.x, MIRROR_SEAT.z);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.deepEqual(h.actor().position, filmStepPosition(FILM_SCENE_BY_ID.m1_mirror, FILM_SCENE_BY_ID.m1_mirror.steps[0]));
});

test('a saved wiring beat restores Trinity to the reachable side of the chair', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm1_pills', actor: 'neo', step: 2 }); h.command('next');
  state.awakening = { kind: 'mirror', elapsed: 2.1, started: false };
  const trinity = h.world.agents.get('trinity')!;
  trinity.position = filmPosition('film_lafayette', -6.4, -16.5);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.deepEqual(trinity.position, filmPosition('film_lafayette', MIRROR_TRINITY.x, MIRROR_TRINITY.z));
  assert.equal(trinity.rotation, MIRROR_TRINITY.yaw);
});

test('touching the mirror is a saved seated performance that freezes on pause and resumes after reconnect', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm1_pills', actor: 'neo', step: 2 }); h.command('next');
  const trinity = h.world.agents.get('trinity')!;
  const seat = filmPosition('film_lafayette', MIRROR_SEAT.x, MIRROR_SEAT.z);
  assert.ok(Math.hypot(trinity.position.x - seat.x, trinity.position.z - seat.z) < 2.05,
    'Trinity must stand close enough to connect the arm electrode instead of reaching from across the room');
  assert.equal(playerBlocked(trinity.position, true, .5), false, 'Trinity must stand beside, not inside, the tracking chair');
  const target = filmStepPosition(FILM_SCENE_BY_ID.m1_mirror, FILM_SCENE_BY_ID.m1_mirror.steps[0]);
  const touch = awakeningPose({ kind: 'mirror', elapsed: 0 });
  assert.deepEqual(target, filmPosition('film_lafayette', touch.x, touch.z), 'the chair interaction begins at the approach marker');
  h.actor().position = { ...target, x: target.x + 2.5 };
  h.command('act'); assert.equal(state.awakening, undefined, 'G cannot begin the touch from across the room');
  h.actor().position = target;
  h.command('act'); assert.equal(state.awakening?.kind, 'mirror');
  assert.deepEqual(h.actor().position, target, 'the performance starts at Neo’s actual position');
  assert.equal(state.awakening!.chairMotion, 'stepping');
  const entry = mirrorEntryPose(state.awakening!);
  for (let i = 0; i < Math.ceil((entry.duration + .55) * 10); i++) h.players.step(.1, true, h.tick());
  assert.deepEqual(h.actor().position, filmPosition('film_lafayette', MIRROR_SEAT.x, MIRROR_SEAT.z));
  assert.equal(h.actor().currentAction?.parameters.seated, true);
  assert.equal(h.actor().currentAction?.parameters.mirror, 0);
  const position = { ...h.actor().position }; const saved = JSON.parse(JSON.stringify(h.sandbox.state));
  h.players.step(.1, false, h.tick()); assert.equal(state.awakening!.elapsed, saved.neoLife.journey.awakening.elapsed);
  h.sandbox.restore(saved); h.players.release('film-player', h.tick()); h.advance(30);
  assert.equal(h.sandbox.life.film.state!.awakening!.elapsed, saved.neoLife.journey.awakening.elapsed);
  h.players.possess('film-player', 'neo', h.tick());
  h.players.receiveInput('film-player', { x: 1, z: 1, yaw: 0, sprint: true, jump: true, sequence: 1 });
  h.players.step(.1, true, h.tick()); assert.deepEqual(h.actor().position, position, 'the hand remains at the mirror while the camera can look around');
  assert.match(h.players.act('film-player', 'attack', h.tick()), /演出/);
  for (let i = 0; i < 70; i++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.life.film.state!.scene, 'm1_pod', 'the completed mirror touch enters the pod without another objective');
  assert.equal(h.sandbox.life.film.state!.step, 0);
  assert.equal(h.sandbox.life.film.state!.awakening, undefined);
  assert.ok(h.sandbox.life.film.state!.completed.includes('m1_mirror'));
  assert.equal(h.actor().currentLocation, 'film_power_plant_pods');
  assert.equal(h.actor().isAwakened, true);
  h.advance(30); assert.equal(h.sandbox.life.film.state!.scene, 'm1_pod', 'the pod waits for Neo to inspect the connections');
});

test('Trinity being player-controlled pauses the electrode beat without advancing the mirror', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm1_pills', actor: 'neo', step: 2 }); h.command('next');
  h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m1_mirror, FILM_SCENE_BY_ID.m1_mirror.steps[0]);
  h.players.possess('other', 'trinity', h.tick());
  assert.match(h.command('act'), /Trinity/);
  assert.equal(state.awakening, undefined);
  h.players.release('other', h.tick()); h.command('act');
  for (let i = 0; i < 17; i++) h.players.step(.1, true, h.tick());
  const elapsed = state.awakening!.elapsed;
  h.players.possess('other', 'trinity', h.tick());
  for (let i = 0; i < 17; i++) h.players.step(.1, true, h.tick());
  assert.equal(state.awakening!.elapsed, elapsed);
  h.players.release('other', h.tick()); h.players.step(.1, true, h.tick());
  assert.ok(state.awakening!.elapsed > elapsed);
});

test('a tracking-chair turn keeps its saved position, feet clock and heading through pause and reconnect', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm1_pills', actor: 'neo', step: 2 }); h.command('next');
  h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m1_mirror, FILM_SCENE_BY_ID.m1_mirror.steps[0]);
  h.actor().rotation = -2.6137389711102355; h.command('act');
  for (let i = 0; i < 45; i++) h.players.step(.1, true, h.tick());
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)), position = { ...h.actor().position }, yaw = h.actor().rotation;
  const beat = { ...state.awakening! }; const pose = mirrorEntryPose(beat);
  assert.deepEqual(position, filmPosition('film_lafayette', pose.x, pose.z));
  assert.equal(yaw, pose.yaw); assert.equal(h.actor().currentAction?.parameters.mirrorBeat, 0);
  assert.equal(h.actor().currentAction?.parameters.seated, false);
  h.players.step(.1, false, h.tick()); assert.deepEqual(state.awakening, beat);
  h.sandbox.restore(saved); h.players.release('film-player', h.tick()); h.advance(30);
  assert.deepEqual(h.sandbox.life.film.state!.awakening, beat);
  h.players.possess('film-player', 'neo', h.tick()); h.players.step(0, false, h.tick());
  assert.deepEqual(h.actor().position, position); assert.equal(h.actor().rotation, yaw);
  assert.deepEqual(h.actor().currentAction?.parameters.mirrorEntry, beat);
  for (let i = 0; i < 36; i++) h.players.step(.1, true, h.tick());
  const restored = h.sandbox.life.film.state!;
  assert.equal(restored.scene, 'm1_mirror', 'the old eight-second deadline cannot cut away during the new entry');
  const elapsed = restored.awakening!.elapsed;
  assert.match(h.command('act'), /演出/); assert.equal(restored.awakening!.elapsed, elapsed, 'G cannot restart an in-progress entry');
  const remaining = Math.ceil((awakeningDuration(restored.awakening!) - elapsed + .1) * 10);
  for (let i = 0; i < remaining; i++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.life.film.state!.scene, 'm1_pod');
});

test('old mirror saves after the touch resume in the pod instead of requiring the removed chair beat', () => {
  for (const legacy of [
    { step: 1, awakening: { kind: 'mirror', elapsed: 8 } },
    { step: 1, awakening: { kind: 'connect', elapsed: 2 } },
    { step: 2, awakening: { kind: 'connect', elapsed: 4 } },
  ]) {
    const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
    Object.assign(state, { scene: 'm1_mirror', actor: 'neo', ...legacy });
    if (legacy.step === 2) state.completed.push('m1_mirror');
    h.actor().currentLocation = 'film_lafayette';
    h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
    assert.equal(h.sandbox.life.film.state!.scene, 'm1_pod');
    assert.equal(h.sandbox.life.film.state!.completed.filter(id => id === 'm1_mirror').length, 1);
    assert.equal(h.actor().currentLocation, 'film_power_plant_pods');
  }
});

test('a paused pod save keeps its immersed, floating or lifted pose when released and possessed again', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm1_mirror', actor: 'neo', step: 1 }); h.command('next');
  const neo = h.actor();
  for (const beat of [undefined, { kind: 'disconnect' as const, elapsed: 2.4 },
    { kind: 'disconnect' as const, elapsed: 9 }, { kind: 'rescue' as const, elapsed: 1.25 }]) {
    state.awakening = beat; h.sandbox.life.film.awakeningFrame(h.actor(), 0, h.tick());
    const position = { ...h.actor().position }, pose = h.actor().currentAction?.parameters.filmPose;
    const saved = JSON.stringify(state.awakening);
    h.players.release('film-player', h.tick());
    assert.equal(neo.currentAction?.parameters.filmPose, pose, 'disconnecting cannot stand the immersed body up');
    h.players.possess('film-player', 'neo', h.tick()); h.players.step(5, false, h.tick());
    assert.equal(h.actor().currentAction?.parameters.filmPose, pose, 'reconnecting while paused restores the pose without waiting for the clock');
    assert.deepEqual(h.actor().position, position);
    assert.equal(JSON.stringify(state.awakening), saved, 'neither reconnect nor the paused step advances the performance');
  }
});

test('the rescue holds Neo at the waterline until the claw has descended and closed', () => {
  const water = awakeningPose({ kind: 'disconnect', elapsed: 9 });
  for (const elapsed of [0, .4, 1, 1.6]) {
    const rescue = awakeningPose({ kind: 'rescue', elapsed });
    assert.equal(rescue.y, water.y, `Neo cannot levitate before the claw supports him at ${elapsed}s`);
    assert.equal(rescue.z, water.z);
  }
  let previous = water.y;
  for (let frame = 17; frame <= 50; frame++) {
    const pose = awakeningPose({ kind: 'rescue', elapsed: frame / 10 });
    assert.ok(pose.y >= previous && pose.y - previous < .85, 'the winch lifts continuously without a jump');
    previous = pose.y;
  }
  assert.ok(previous > water.y + 13);
});

test('Neo removes the breathing tube before the player starts maintenance, preserving a paused grasp across reconnects', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm1_mirror', actor: 'neo', step: 1 }); h.command('next');
  h.players.step(.1, true, h.tick()); assert.equal(state.awakening, undefined, 'waking does not remove the tube without input');
  h.command('act'); assert.equal(state.awakening?.kind, 'breather');
  for (let i = 0; i < 24; i++) h.players.step(.1, true, h.tick());
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)), beat = JSON.stringify(state.awakening), position = { ...h.actor().position };
  h.players.step(.5, false, h.tick()); assert.equal(JSON.stringify(state.awakening), beat);
  assert.match(h.command('act'), /演出/); assert.equal(JSON.stringify(state.awakening), beat, 'G cannot restart a hand already grasping the tube');
  h.players.release('film-player', h.tick()); h.players.step(.1, true, h.tick());
  assert.equal(JSON.stringify(state.awakening), beat, 'an unpossessed Neo cannot finish this body action');
  h.sandbox.restore(saved); h.players.possess('film-player', 'neo', h.tick());
  const restored = h.sandbox.life.film.state!;
  assert.equal(JSON.stringify(restored.awakening), beat); assert.deepEqual(h.actor().position, position);
  assert.match(h.command('retry'), /呼吸管/); assert.equal(JSON.stringify(restored.awakening), beat, 'returning to the action retains the saved grasp');
  for (let i = 0; i < 100; i++) h.players.step(.1, true, h.tick());
  assert.equal(restored.step, 0); assert.equal(restored.awakening?.kind, 'breather');
  assert.equal(restored.awakening?.started, false); assert.equal(restored.completed.includes('m1_pod'), false);
  assert.deepEqual(h.actor().position, position, 'waiting after breathing cannot flush Neo automatically');
  assert.match(restored.lastText, /后颈/);
  h.command('act'); assert.equal(restored.awakening?.kind, 'disconnect');
  assert.equal(restored.awakening?.elapsed, 0); assert.equal(restored.awakening?.breatherRemoved, true);
});

test('old pod disconnection saves continue unplugging without inserting the new oral action', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm1_mirror', actor: 'neo', step: 1 }); h.command('next');
  state.awakening = { kind: 'disconnect', elapsed: 1.832 };
  h.sandbox.life.film.awakeningFrame(h.actor(), 0, h.tick());
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)), position = { ...h.actor().position };
  h.players.release('film-player', h.tick()); h.sandbox.restore(saved); h.players.possess('film-player', 'neo', h.tick());
  const restored = h.sandbox.life.film.state!;
  h.players.step(.1, false, h.tick());
  assert.deepEqual(restored.awakening, { kind: 'disconnect', elapsed: 1.832 });
  assert.deepEqual(h.actor().position, position);
  assert.match(h.command('act'), /演出/);
  for (let i = 0; i < 80; i++) h.players.step(.1, true, h.tick());
  assert.equal(restored.step, 1); assert.equal(restored.awakening!.kind, 'disconnect');
  assert.equal(restored.awakening!.elapsed, 9); assert.equal(restored.awakening!.breatherRemoved, undefined);
  h.command('act'); assert.equal(restored.awakening!.kind, 'rescue');
});

test('pod disconnection moves Neo down the drain; rescue must be started in the water and lifts the body', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm1_mirror', actor: 'neo', step: 1 }); h.command('next');
  const start = { ...h.actor().position };
  h.command('act'); assert.equal(state.awakening?.kind, 'breather');
  for (let i = 0; i < 60; i++) h.players.step(.1, true, h.tick());
  h.command('act'); assert.equal(state.awakening?.kind, 'disconnect');
  for (let i = 0; i < 100; i++) h.players.step(.1, true, h.tick());
  assert.equal(state.step, 1); assert.ok(h.actor().position.y < start.y - 16);
  assert.ok(h.actor().position.z > start.z + 20); assert.equal(h.actor().health, h.actor().maxHealth);
  const water = { ...h.actor().position }; h.advance(40); h.players.step(.1, true, h.tick());
  assert.deepEqual(h.actor().position, water); assert.equal(state.step, 1);
  h.command('act'); assert.equal(state.awakening?.kind, 'rescue');
  for (let i = 0; i < 60; i++) h.players.step(.1, true, h.tick());
  assert.ok(h.actor().position.y > water.y + 10); assert.equal(state.step, 1);
  for (let i = 0; i < 90 && state.scene === 'm1_pod'; i++) h.players.step(.1, true, h.tick());
  assert.equal(state.scene, 'm1_recovery'); assert.deepEqual(state.awakening, { kind: 'recovery', elapsed: 0, started: false });
});

test('pod rescue enters the ship before recovery and retains the boarding checkpoint across reconnect', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm1_mirror', actor: 'neo', step: 1 }); h.command('next');
  state.step = 1; state.awakening = { kind: 'rescue', elapsed: 5 };
  h.sandbox.life.film.awakeningFrame(h.actor(), 0, h.tick());
  for (let i = 0; i < 24; i++) h.players.step(.1, true, h.tick());
  assert.equal(state.scene, 'm1_pod'); assert.equal(state.step, 1, 'being above the water does not finish boarding');
  assert.ok(h.actor().position.y > FILM_SETS.film_power_plant_pods.center.y, 'the feet clear the hatch before it closes');
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); const position = { ...h.actor().position };
  h.sandbox.restore(saved); h.players.release('film-player', h.tick()); h.advance(30);
  h.players.possess('film-player', 'neo', h.tick()); h.players.step(.1, false, h.tick());
  assert.deepEqual(h.actor().position, position);
  const restored = h.sandbox.life.film.state!; const held = restored.awakening!.elapsed;
  h.players.possess('other', 'morpheus', h.tick());
  h.players.step(.1, true, h.tick()); assert.equal(restored.awakening!.elapsed, held, 'the receiving actor must not be stolen');
  h.players.release('other', h.tick());
  for (let i = 0; i < 90 && restored.scene === 'm1_pod'; i++) h.players.step(.1, true, h.tick());
  assert.equal(restored.scene, 'm1_recovery', 'boarding and blackout enter recovery without another scene-skip button');
  assert.deepEqual(restored.awakening, { kind: 'recovery', elapsed: 0, started: false });
  assert.equal(restored.completed.filter(id => id === 'm1_pod').length, 1);
});

test('an old completed five-second rescue resumes at the ship instead of skipping boarding', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm1_pod', actor: 'neo', step: 2, awakening: { kind: 'rescue', elapsed: 5 } });
  state.completed.push('m1_pod');
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  const restored = h.sandbox.life.film.state!;
  assert.equal(restored.step, 1); assert.equal(restored.awakening!.elapsed, 5);
  assert.ok(!restored.completed.includes('m1_pod'));
  h.command('next'); assert.equal(restored.scene, 'm1_pod', 'next cannot bypass the still-running boarding');
});

test('recovery begins on the medical bed, waits for Neo, and resumes its saved performance after pause and reconnect', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm1_pod', actor: 'neo', step: 2 }); h.command('next');
  assert.equal(state.scene, 'm1_recovery');
  assert.deepEqual(state.awakening, { kind: 'recovery', elapsed: 0, started: false });
  const bed = { ...h.actor().position };
  h.players.receiveInput('film-player', { x: 1, z: 1, yaw: 0, sprint: true, jump: true, sequence: 1 });
  for (let i = 0; i < 20; i++) h.players.step(.1, true, h.tick());
  assert.deepEqual(h.actor().position, bed, 'waiting for G cannot slide the weak body off the bed');
  assert.equal(state.awakening!.elapsed, 0, 'waiting does not make the choice for the player');
  assert.equal(h.players.possess('other-player', 'dozer', h.tick()).agentId, 'dozer');
  assert.match(h.command('act'), /Dozer/, 'a player-controlled medic pauses the recovery start');
  assert.equal(state.awakening!.started, false);
  h.players.release('other-player', h.tick());
  h.command('act'); assert.equal(state.awakening!.started, true);
  for (let i = 0; i < 100; i++) h.players.step(.1, true, h.tick());
  const morpheus = h.world.agents.get('morpheus')!, dozer = h.world.agents.get('dozer')!;
  assert.equal(dozer.currentAction?.parameters.medical, state.awakening!.elapsed);
  assert.ok(Math.hypot(morpheus.position.x - h.actor().position.x, morpheus.position.z - h.actor().position.z) < 4, 'Morpheus remains at Neo’s bedside');
  assert.ok(Math.hypot(dozer.position.x - h.actor().position.x, dozer.position.z - h.actor().position.z) < 5, 'Dozer operates the nearby equipment');
  assert.equal(h.players.possess('other-player', 'morpheus', h.tick()).agentId, 'morpheus');
  const held = state.awakening!.elapsed;
  for (let i = 0; i < 5; i++) h.players.step(.1, true, h.tick());
  assert.equal(state.awakening!.elapsed, held, 'taking over a supporting performer freezes both sides of the contact');
  h.players.release('other-player', h.tick());
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); const elapsed = state.awakening!.elapsed;
  h.players.step(.5, false, h.tick()); assert.equal(state.awakening!.elapsed, elapsed, 'pause freezes the needles and body pose');
  h.sandbox.restore(saved); h.players.release('film-player', h.tick()); h.advance(30);
  assert.equal(h.sandbox.life.film.state!.awakening!.elapsed, elapsed, 'disconnection cannot finish recovery');
  h.world.agents.get('neo')!.rotation = Math.PI; // A pre-turning-pose save may still contain the former bed orientation.
  h.players.possess('film-player', 'neo', h.tick());
  const resumedPose = awakeningPose(h.sandbox.life.film.state!.awakening);
  assert.equal(h.actor().rotation, Math.PI, 'reconnection restores the resting orientation');
  assert.equal(h.actor().position.y, FILM_SETS.film_neb_deck.center.y + resumedPose.y, 'the lowered recovery bed also restores the patient height');
  assert.match(h.players.act('film-player', 'attack', h.tick()), /演出/);
  for (let i = 0; i < 120 && h.sandbox.life.film.state!.scene === 'm1_recovery'; i++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.life.film.state!.scene, 'm1_cabin');
  assert.equal(h.sandbox.life.film.state!.awakening!.started, false);
  h.advance(30); assert.equal(h.sandbox.life.film.state!.step, 0, 'waking in the cabin waits for Neo');
});

test('a fresh Construct arrival keeps Neo standing and requires inspecting his image and walking to the leather chair', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm1_cabin', actor: 'neo', step: FILM_SCENE_BY_ID.m1_cabin.steps.length, awakening: undefined });
  h.command('next');
  assert.equal(h.actor().currentAction?.parameters.seated, false, 'Neo enters the loading space on his feet');
  assert.equal(state.constructArrival?.phase, 'ready');
  const start = { ...h.actor().position }; h.advance(30);
  assert.deepEqual(h.actor().position, start); assert.equal(state.awakening, undefined);
  h.command('act');
  for (let frame = 0; frame < 24; frame++) h.players.step(.1, true, h.tick());
  const elapsed = state.constructArrival!.elapsed;
  h.players.step(.5, false, h.tick()); assert.equal(state.constructArrival!.elapsed, elapsed);
  h.players.possess('other-player', 'morpheus', h.tick());
  for (let frame = 0; frame < 20; frame++) h.players.step(.1, true, h.tick());
  assert.equal(state.constructArrival!.elapsed, elapsed, 'an occupied guide must not be animated or advance the lesson');
  assert.match(h.command('act'), /另一位玩家/);
  h.players.release('other-player', h.tick());
  const saved = JSON.parse(JSON.stringify(h.sandbox.state));
  h.sandbox.restore(saved); h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(h.sandbox.life.film.state!.constructArrival!.elapsed, elapsed);
  h.players.possess('film-player', 'neo', h.tick());
  for (let frame = 0; frame < 90; frame++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.life.film.state!.constructArrival!.phase, 'approach');
  assert.match(h.command('act'), /椅背/, 'an interaction at the spawn point cannot skip the walk');
  assert.equal(h.sandbox.life.film.state!.awakening, undefined);
  const target = filmStepPosition(FILM_SCENE_BY_ID.m1_construct, FILM_SCENE_BY_ID.m1_construct.steps[0]);
  for (let frame = 0; frame < 250; frame++) {
    const dx = target.x - h.actor().position.x, dz = target.z - h.actor().position.z, gap = Math.hypot(dx, dz);
    if (gap < .2) break;
    h.players.receiveInput('film-player', { x: dx / Math.max(1, gap), z: dz / Math.max(1, gap), yaw: Math.atan2(dx, dz), sprint: false, jump: false, sequence: frame + 1 });
    h.players.step(.05, true, h.tick());
  }
  assert.ok(Math.hypot(target.x - h.actor().position.x, target.z - h.actor().position.z) < .8, `the furniture blocks the approach: ${JSON.stringify(h.actor().position)}, target ${JSON.stringify(target)}`);
  h.command('act');
  assert.equal(h.sandbox.life.film.state!.awakening?.kind, 'construct');
  assert.equal(h.sandbox.life.film.state!.awakening?.started, true);
  assert.equal(h.actor().currentAction?.parameters.seated, false, 'Neo examines the chair from behind while Morpheus sits');
  assert.equal(h.sandbox.state.structures.filter(item => item.id.startsWith('film:construct:')).length, 3);
});

test('the Construct television and ruined-world lesson wait for Neo and preserve both reveal performances', () => {
  assert.match(awakeningPose({ kind: 'construct', elapsed: 1 }).text, /雪花/);
  assert.match(awakeningPose({ kind: 'construct', elapsed: 10 }).text, /废墟/);
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm1_cabin', actor: 'neo', step: FILM_SCENE_BY_ID.m1_cabin.steps.length, awakening: undefined });
  h.command('next'); assert.equal(state.scene, 'm1_construct');
  // Exercise the legacy television checkpoint separately from the new arrival above.
  delete state.constructArrival; state.awakening = { kind: 'construct', elapsed: 0, started: false };
  h.sandbox.life.film.awakeningFrame(h.actor(), 0, h.tick());
  assert.deepEqual(state.awakening, { kind: 'construct', elapsed: 0, started: false });
  const chair = { ...h.actor().position }; h.advance(20);
  assert.equal(state.step, 0); assert.deepEqual(h.actor().position, chair, 'the television cannot start itself while Neo waits');
  h.command('act'); for (let frame = 0; frame < 43; frame++) h.players.step(.1, true, h.tick());
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); const constructElapsed = state.awakening!.elapsed;
  h.players.step(.8, false, h.tick()); assert.equal(state.awakening!.elapsed, constructElapsed);
  h.sandbox.restore(saved); h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(h.sandbox.life.film.state!.awakening!.elapsed, constructElapsed, 'disconnecting freezes the television lesson');
  h.players.possess('film-player', 'neo', h.tick());
  for (let frame = 0; frame < 120 && h.sandbox.life.film.state!.step === 0; frame++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.life.film.state!.step, 1);
  h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m1_construct, FILM_SCENE_BY_ID.m1_construct.steps[0]);
  h.players.receiveInput('film-player', { x: 1, z: 0, yaw: 0, sprint: true, jump: true, sequence: 1 });
  h.players.step(.1, true, h.tick());
  assert.deepEqual(h.actor().position, chair, 'Neo remains beside the chair for the on-screen choice after the reveal');
  assert.equal(h.actor().currentAction?.parameters.seated, false);
  h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m1_construct, FILM_SCENE_BY_ID.m1_construct.steps[0]);
  const agency = h.sandbox.state.neoLife!.philosophy.agency;
  h.command('reflect:agency');
  assert.equal(h.sandbox.life.film.state!.scene, 'm1_desert', 'choosing at the television immediately enters the ruined world');
  assert.equal(h.sandbox.life.film.state!.reflections['m1_construct:1'], 'agency');
  assert.equal(h.sandbox.state.neoLife!.philosophy.agency, agency + 1);
  assert.ok(h.sandbox.life.film.state!.completed.includes('m1_construct'));
  const chosen = JSON.parse(JSON.stringify(h.sandbox.state));
  h.sandbox.restore(chosen);
  assert.equal(h.sandbox.life.film.state!.scene, 'm1_desert', 'reload resumes after the committed choice');
  assert.equal(h.sandbox.state.neoLife!.philosophy.agency, agency + 1, 'reload does not duplicate the reflection');
  const desert = FILM_SCENE_BY_ID.m1_desert; h.actor().position = filmStepPosition(desert, desert.steps[0]); h.advance();
  assert.equal(h.sandbox.life.film.state!.step, 1);
  assert.deepEqual(h.sandbox.life.film.state!.awakening, { kind: 'desert', elapsed: 0, started: false });
  const overlook = { ...h.actor().position }; h.advance(20); assert.deepEqual(h.actor().position, overlook);
  h.command('act');
  for (let frame = 0; frame < 140 && h.sandbox.life.film.state!.step === 1; frame++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.life.film.state!.scene, 'm1_truth_exit');
  assert.equal(h.sandbox.life.film.state!.truthRecovery?.phase, 'ready');
  assert.ok(h.sandbox.life.film.state!.completed.includes('m1_desert'));
});

test('old saves at authored reveal checkpoints are upgraded into explicit player-started performances', () => {
  for (const [sceneId, step, kind] of [['m1_recovery', 0, 'recovery'], ['m1_construct', 0, 'construct'], ['m1_desert', 1, 'desert']] as const) {
    const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!; const scene = FILM_SCENE_BY_ID[sceneId];
    Object.assign(state, { scene: sceneId, actor: 'neo', step, checkpoint: filmEntry(scene), awakening: undefined });
    h.actor().currentLocation = scene.set; h.actor().isInMatrix = FILM_SETS[scene.set].world === 'matrix'; h.actor().position = filmEntry(scene);
    h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
    assert.deepEqual(h.sandbox.life.film.state!.awakening, { kind, elapsed: 0, started: false }, sceneId);
    const parameters = h.actor().currentAction?.parameters;
    assert.equal(parameters?.reveal?.kind ?? (parameters?.recovery !== undefined ? 'recovery' : undefined), kind, `${sceneId}: actor pose`);
  }
});

test('training download waits for Neo, pauses with the world, survives reconnect and finishes in the core chair', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const recovery = FILM_SCENE_BY_ID.m1_truth_return;
  Object.assign(state, { scene: recovery.id, actor: 'neo', step: recovery.steps.length, awakening: undefined });
  h.command('next');
  assert.equal(state.scene, 'm1_download');
  state.downloadSetup = { phase: 'ready', elapsed: 0, progress: CABIN_ROUTE_LENGTH };
  h.sandbox.life.film.trainingFrame(h.actor(), 0, h.tick());
  assert.deepEqual(state.training, { kind: 'download', elapsed: 0, started: false });
  const chair = { ...h.actor().position }; h.advance(20);
  assert.deepEqual(h.actor().position, chair, 'the program cannot load before Neo explicitly starts it');
  h.players.possess('other-player', 'tank', h.tick());
  assert.match(h.command('act'), /Tank|另一位玩家/); assert.equal(state.training!.started, false);
  h.players.release('other-player', h.tick()); h.command('act');
  assert.equal(state.training!.started, true);
  for (let i = 0; i < 34; i++) h.players.step(.1, true, h.tick());
  const elapsed = state.training!.elapsed; const saved = JSON.parse(JSON.stringify(h.sandbox.state));
  h.players.step(.8, false, h.tick()); assert.equal(state.training!.elapsed, elapsed);
  h.sandbox.restore(saved); h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(h.sandbox.life.film.state!.training!.elapsed, elapsed, 'disconnecting cannot finish a knowledge upload');
  h.players.possess('film-player', 'neo', h.tick());
  for (let i = 0; i < 120 && h.sandbox.life.film.state!.step === 0; i++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.life.film.state!.step, 1);
  assert.equal(h.sandbox.life.film.state!.training!.elapsed, 10);
});

test('the dojo requires reading Morpheus attack, dodging it and landing an ordered three-hit counter', t => {
  let now = 100_000; t.mock.method(Date, 'now', () => now);
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const download = FILM_SCENE_BY_ID.m1_download;
  Object.assign(state, { scene: download.id, actor: 'neo', step: download.steps.length, training: undefined });
  h.command('next'); assert.equal(state.scene, 'm1_dojo');
  h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m1_dojo, FILM_SCENE_BY_ID.m1_dojo.steps[0]);
  h.actor().rotation = Math.PI;
  h.command('act'); const threat = h.sandbox.state.threats[0];
  assert.equal(threat.character, 'morpheus'); assert.equal(threat.health, 999);
  const facing = { x: Math.sin(h.actor().rotation), z: Math.cos(h.actor().rotation) };
  assert.ok((threat.position.x - h.actor().position.x) * facing.x + (threat.position.z - h.actor().position.z) * facing.z > 0,
    'the duel opponent starts in front of the player camera');
  h.actor().position = { ...threat.position, z: threat.position.z + 2 }; h.actor().rotation = Math.PI;
  h.sandbox.attack(h.actor(), h.tick(), 2);
  assert.equal(state.dojo?.combo, 0, 'kicks before observing the lesson cannot skip its first stage');
  assert.equal(threat.health, 999, 'Morpheus blocks damage until Neo reads and dodges the lesson');
  threat.stunUntil = h.tick();
  threat.attackAt = h.tick() + 2; threat.lastStrike = h.tick();
  const health = h.actor().health; h.players.act('film-player', 'dodge', h.tick());
  assert.equal(state.dojo?.dodged, true);
  assert.equal(threat.attackAt, undefined, 'pressing dodge during the visible windup cancels the lesson strike immediately');
  h.players.step(.1, true, h.tick());
  const targetYaw = Math.atan2(threat.position.x - h.actor().position.x, threat.position.z - h.actor().position.z);
  assert.ok(Math.abs(Math.atan2(Math.sin(h.actor().rotation - targetYaw), Math.cos(h.actor().rotation - targetYaw))) < .01,
    'the lesson keeps Neo facing Morpheus after the dodge so the counter can connect');
  h.players.step(.1, true, h.tick()); h.players.step(.1, true, h.tick());
  h.advance(5); assert.equal(h.actor().health, health, 'Morpheus holds his guard during the counter opening');
  h.actor().position = { ...threat.position, z: threat.position.z + 2 }; h.actor().rotation = 0;
  h.players.receiveInput('film-player', { x: 0, z: 0, yaw: 0, jump: false, sprint: false, sequence: 1 });
  h.players.act('film-player', 'attack', h.tick());
  h.players.receiveInput('film-player', { x: 0, z: 0, yaw: 0, jump: false, sprint: false, sequence: 2 });
  h.players.step(.1, true, h.tick()); h.players.step(.1, true, h.tick());
  assert.equal(state.dojo?.combo, 1, 'the first real attack input locks back onto Morpheus and lands');
  h.advance(5); assert.equal(h.actor().health, health, 'landing a counter refreshes the guarded counter opening');
  now += 1_600;
  h.actor().position = { ...threat.position, z: threat.position.z + 2 }; h.actor().rotation = 0;
  h.players.receiveInput('film-player', { x: 0, z: 0, yaw: 0, jump: false, sprint: false, sequence: 3 });
  h.players.act('film-player', 'attack', h.tick()); h.players.step(.1, true, h.tick()); h.players.step(.1, true, h.tick());
  assert.equal(state.dojo?.combo, 2, 'the dojo leaves enough time to read the HUD and perform the straight punch');
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved);
  assert.equal(h.sandbox.life.film.state!.dojo?.combo, 2, 'counter sequence survives a reload');
  h.players.release('film-player', h.tick()); h.players.possess('film-player', 'neo', h.tick()); now += 5_000;
  const restored = h.sandbox.state.threats[0]; h.actor().position = { ...restored.position, z: restored.position.z + 2 }; h.actor().rotation = 0;
  h.players.receiveInput('film-player', { x: 0, z: 0, yaw: 0, jump: false, sprint: false, sequence: 1 });
  h.players.act('film-player', 'attack', h.tick()); h.players.step(.1, true, h.tick()); h.players.step(.1, true, h.tick()); h.players.step(.1, true, h.tick()); h.advance();
  assert.equal(h.sandbox.life.film.state!.step, 1); assert.equal(h.sandbox.state.threats.length, 0);
  assert.equal(h.world.agents.get('morpheus')!.status, 'alive');
  assert.equal(neoSkillUnlocked(h.sandbox.state.neoLife, 0), true, 'the authored dojo unlocks Neo bullet time too');
});

test('the dojo preserves a timed counter opening, then returns Morpheus to guard instead of freezing him forever', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const download = FILM_SCENE_BY_ID.m1_download;
  Object.assign(state, { scene: download.id, actor: 'neo', step: download.steps.length, training: undefined });
  h.command('next');
  h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m1_dojo, FILM_SCENE_BY_ID.m1_dojo.steps[0]);
  h.command('act'); const threat = h.sandbox.state.threats[0];
  h.actor().position = { ...threat.position, z: threat.position.z + 2 }; h.actor().rotation = Math.PI;
  threat.stunUntil = h.tick(); threat.attackAt = h.tick() + 2; threat.lastStrike = h.tick();
  h.players.act('film-player', 'dodge', h.tick());
  const opening = state.dojo as { counterUntil?: number };
  assert.equal(opening.counterUntil, h.tick() + 6, 'a successful dodge opens a three-second counter window');
  const saved = JSON.parse(JSON.stringify(h.sandbox.state));
  h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(h.sandbox.life.film.state!.dojo?.dodged, true, 'the opening does not expire while its player is disconnected');
  h.sandbox.restore(saved); h.players.possess('film-player', 'neo', h.tick()); h.advance(1);
  assert.equal(h.sandbox.life.film.state!.dojo?.dodged, false, 'missing the opening returns the lesson to Morpheus\' guard');
  assert.equal(h.sandbox.life.film.state!.dojo?.combo, 0);
  assert.equal(h.sandbox.state.threats[0].attackAt, undefined, 'Morpheus resets before giving the next readable windup');
});

test('older dojo saves migrate a frozen counter into a finite counter window', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const download = FILM_SCENE_BY_ID.m1_download;
  Object.assign(state, { scene: download.id, actor: 'neo', step: download.steps.length, training: undefined });
  h.command('next'); h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m1_dojo, FILM_SCENE_BY_ID.m1_dojo.steps[0]);
  h.command('act'); const threat = h.sandbox.state.threats[0];
  threat.stunUntil = h.tick(); threat.attackAt = h.tick() + 2; threat.lastStrike = h.tick();
  assert.equal(h.sandbox.life.film.trainingDodge(h.actor(), threat, h.tick()), true);
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); delete saved.neoLife.journey.dojo.counterUntil;
  h.sandbox.restore(saved);
  assert.equal(h.sandbox.life.film.state!.dojo?.counterUntil, h.world.simulationTick + 6, 'an old permanent guard save receives one finite counter window');
  h.advance(7);
  assert.equal(h.sandbox.life.film.state!.dojo?.dodged, false, 'the migrated counter returns to a readable retry instead of remaining frozen');
});

test('Morpheus demonstrates the rooftop jump before Neo can attempt the recoverable gap', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const dojo = FILM_SCENE_BY_ID.m1_dojo;
  Object.assign(state, { scene: dojo.id, actor: 'neo', step: dojo.steps.length, fighting: undefined, dojo: undefined });
  h.command('next'); const scene = FILM_SCENE_BY_ID.m1_jump; assert.equal(state.scene, scene.id);
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.advance(); assert.equal(state.step, 1);
  const morpheus = h.world.agents.get('morpheus')!; const before = { ...morpheus.position };
  h.command('act'); assert.deepEqual(state.training, { kind: 'jump', elapsed: 0, started: true });
  for (let i = 0; i < 18; i++) h.players.step(.1, true, h.tick());
  assert.ok(morpheus.position.y > FILM_SETS[scene.set].center.y + 3, 'Morpheus follows a visible arc over the alley');
  const elapsed = state.training!.elapsed; h.players.step(.5, false, h.tick()); assert.equal(state.training!.elapsed, elapsed);
  for (let i = 0; i < 50; i++) h.players.step(.1, true, h.tick());
  assert.equal(state.training!.elapsed, 4); assert.ok(morpheus.position.z < before.z - 18);
  assert.equal(state.step, 1, 'the demonstration does not perform Neo jump for the player');
});

test('the red-dress attention test is player-started, freezes the crowd and replaces a civilian with Smith', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const jump = FILM_SCENE_BY_ID.m1_jump;
  Object.assign(state, { scene: jump.id, actor: 'neo', step: jump.steps.length, training: undefined });
  h.command('next'); const scene = FILM_SCENE_BY_ID.m1_red_dress; assert.equal(state.scene, scene.id);
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.advance(); assert.equal(state.step, 1);
  assert.deepEqual(state.training, { kind: 'red_dress', elapsed: 0, started: false });
  const woman = h.world.agents.get('citizen_2')!; const civilian = h.world.agents.get('citizen_1')!; const smith = h.world.agents.get('smith')!;
  assert.equal(woman.status, 'alive'); assert.equal(civilian.status, 'alive'); assert.equal(smith.status, 'disconnected');
  h.advance(20); assert.equal(state.training!.elapsed, 0);
  h.command('act'); for (let i = 0; i < 70; i++) h.players.step(.1, true, h.tick());
  assert.equal(civilian.status, 'disconnected'); assert.equal(smith.status, 'alive');
  assert.ok(h.actor().rotation > -1 && h.actor().rotation < 1, 'Neo is turned back toward the agent reveal');
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); const elapsed = state.training!.elapsed;
  h.sandbox.restore(saved); h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(h.sandbox.life.film.state!.training!.elapsed, elapsed);
  h.players.possess('film-player', 'neo', h.tick());
  for (let i = 0; i < 80 && h.sandbox.life.film.state!.step === 1; i++) h.players.step(.1, true, h.tick());
  assert.equal(h.sandbox.life.film.state!.step, 2); assert.ok(h.sandbox.life.film.state!.completed.includes(scene.id));
});

test('the first rooftop jump uses gravity and a recoverable fall rather than a timer', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m1_jump; state.scene = scene.id; state.actor = scene.actor; state.step = 0;
  h.players.possess('film-player', 'neo', h.tick()); h.actor().isInMatrix = true; h.actor().currentLocation = scene.set;
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.advance();
  assert.equal(state.step, 1);
  h.command('act');
  for (let frame = 0; frame < 41; frame++) h.players.step(.1, true, h.tick());
  h.advance(30); assert.equal(state.step, 1, 'watching Morpheus must not complete Neo jump');
  let vy = 0; let falling = false;
  for (let frame = 0; frame < 180 && state.step === 1; frame++) {
    const move = stepPlayer(h.actor().position, vy, { x: 0, z: -1, yaw: Math.PI, sprint: true, jump: frame === 9, sequence: frame }, 1 / 60, true);
    h.actor().position = move.position; vy = move.verticalVelocity;
    falling ||= h.actor().position.y < FILM_SETS[scene.set].center.y - 3;
    if (frame % 30 === 0) h.advance();
  }
  assert.ok(falling, 'the space between roofs must have no invisible floor');
  assert.ok(state.completed.includes(scene.id)); assert.equal(h.actor().status, 'alive');
  assert.match(state.lastText, /第一次|失败/);
  assert.equal(h.actor().position.y, FILM_SETS[scene.set].center.y);
});

test('Morpheus and Seraph take part in their own nonlethal duels without cloning an occupied role', () => {
  for (const id of ['m1_dojo', 'm2_seraph']) {
    const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!; const scene = FILM_SCENE_BY_ID[id];
    state.scene = id; state.actor = 'neo'; state.step = 0; const opponent = id === 'm1_dojo' ? 'morpheus' : 'seraph';
    h.players.possess('film-player', 'neo', h.tick()); h.actor().isInMatrix = true; h.actor().currentLocation = scene.set;
    h.actor().position = filmStepPosition(scene, scene.steps[0]);
    h.players.possess('other-player', opponent, h.tick());
    assert.match(h.command('act'), /另一位玩家/); assert.equal(h.sandbox.state.threats.length, 0);
    h.players.release('other-player', h.tick()); h.command('act');
    assert.equal(h.sandbox.state.threats.length, 1); const threat = h.sandbox.state.threats[0];
    assert.equal(threat.character, opponent);
    if (id === 'm1_dojo') {
      threat.stunUntil = 0; threat.attackAt = h.tick() + 1;
      assert.equal(h.sandbox.life.film.trainingDodge(h.actor(), threat, h.tick()), true);
      for (const combo of [0, 1, 2]) {
        h.actor().position = { ...threat.position, z: threat.position.z + 2 }; h.actor().rotation = Math.PI;
        h.sandbox.attack(h.actor(), h.tick(), combo);
      }
    } else {
      for (let exchange = 0; exchange < 2; exchange++) {
        threat.attackAt = h.tick() + 1; threat.stunUntil = 0;
        assert.equal(h.sandbox.life.film.trainingDodge(h.actor(), threat, h.tick()), true);
        h.actor().position = { ...threat.position, z: threat.position.z + 2 }; h.actor().rotation = Math.PI;
        h.sandbox.attack(h.actor(), h.tick(), exchange);
      }
    }
    h.advance(); assert.equal(state.step, 1); assert.equal(h.world.agents.get(opponent)!.status, 'alive');
    assert.notEqual(h.world.agents.get(opponent)!.currentAction?.parameters.filmDuel, true);
  }
});

test('Seraph tests two separately read attacks, blocks reckless blows and resets a failed exchange without killing Neo', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!; const scene = FILM_SCENE_BY_ID.m2_seraph;
  state.scene = scene.id; state.actor = 'neo'; state.step = 0; h.players.possess('film-player', 'neo', h.tick());
  h.actor().isInMatrix = true; h.actor().currentLocation = scene.set; h.actor().position = filmStepPosition(scene, scene.steps[0]);
  h.command('act'); const threat = h.sandbox.state.threats[0]; assert.equal(threat.character, 'seraph');
  h.actor().position = { ...threat.position, z: threat.position.z + 2 }; h.actor().rotation = Math.PI;
  h.sandbox.attack(h.actor(), h.tick(), 2);
  assert.equal(threat.health, threat.maxHealth); assert.equal(state.step, 0); assert.equal(threat.stunUntil < 100, true);
  assert.equal(h.sandbox.life.film.trainingDodge(h.actor(), threat, h.tick()), false, 'a dodge outside a windup does not count');
  delete state.seraph; threat.attackAt = h.tick() + 1;
  h.sandbox.attack(h.actor(), h.tick(), 2);
  assert.equal(threat.attackAt, h.tick() + 1, 'an older save without duel progress must still preserve the windup');
  threat.attackAt = h.tick() + 1; h.sandbox.attack(h.actor(), h.tick(), 2);
  assert.equal(threat.attackAt, h.tick() + 1, 'a parried attack must not cancel Seraph’s windup');
  for (let exchange = 0; exchange < 2; exchange++) {
    threat.attackAt = h.tick() + 1; threat.stunUntil = 0;
    assert.equal(h.sandbox.life.film.trainingDodge(h.actor(), threat, h.tick()), true);
    h.actor().position = { ...threat.position, z: threat.position.z + 2 }; h.actor().rotation = Math.PI;
    h.sandbox.attack(h.actor(), h.tick(), exchange);
    assert.equal(state.seraph?.counters, exchange + 1);
  }
  h.advance(); assert.equal(state.step, 1); assert.equal(h.world.agents.get('seraph')!.status, 'alive');
  h.command('retry'); assert.equal(state.step, 1, 'retry keeps the completed trial');
});

test('Seraph calls off a losing spar and leaves a repeatable checkpoint', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!; const scene = FILM_SCENE_BY_ID.m2_seraph;
  state.scene = scene.id; state.actor = 'neo'; state.step = 0; h.players.possess('film-player', 'neo', h.tick());
  h.actor().isInMatrix = true; h.actor().currentLocation = scene.set; h.actor().position = filmStepPosition(scene, scene.steps[0]);
  h.command('act'); const threat = h.sandbox.state.threats[0];
  threat.position = { ...h.actor().position, z: h.actor().position.z - 2 }; threat.attackAt = h.tick(); threat.stunUntil = 0;
  h.actor().health = 3; h.advance();
  assert.equal(state.seraph?.attempts, 1); assert.equal(state.step, 0); assert.equal(h.actor().health, h.actor().maxHealth);
  assert.equal(h.sandbox.state.threats.length, 0); assert.equal(h.actor().status, 'alive');
  h.command('act'); assert.equal(h.sandbox.state.threats.length, 1);
});

test('the keyed doors must be reached, and the Oracle leaves a saved Keymaker lead with a later consequence', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!; const tea = FILM_SCENE_BY_ID.m2_seraph;
  state.scene = tea.id; state.actor = 'neo'; state.step = tea.steps.length; h.players.possess('film-player', 'neo', h.tick());
  h.actor().isInMatrix = true; h.actor().currentLocation = tea.set; h.actor().position = filmEntry(tea);
  assert.match(h.command('next'), /后门/); assert.equal(state.scene, tea.id);
  h.actor().position = filmStepPosition(tea, tea.steps.at(-1)!); h.command('next');
  assert.equal(state.scene, 'm2_backdoors'); assert.equal(h.actor().currentLocation, FILM_SCENE_BY_ID.m2_backdoors.set);
  const hall = FILM_SCENE_BY_ID.m2_backdoors;
  h.actor().position = filmStepPosition(hall, hall.steps[0]); h.advance();
  h.actor().position = filmStepPosition(hall, hall.steps[1]); h.command('act'); h.advance((hall.steps[1].seconds ?? 3) * 2 + 1);
  assert.equal(state.step, hall.steps.length);
  h.actor().position = filmEntry(hall); assert.match(h.command('next'), /庭院/); assert.equal(state.scene, hall.id);
  h.actor().position = filmStepPosition(hall, hall.steps.at(-1)!); h.command('next');
  assert.equal(state.scene, 'm2_bench');
  const bench = FILM_SCENE_BY_ID.m2_bench;
  h.actor().position = filmStepPosition(bench, bench.steps[0]); h.advance();
  h.actor().position = filmStepPosition(bench, bench.steps[1]); h.command('act'); h.advance((bench.steps[1].seconds ?? 3) * 2 + 1);
  h.actor().position = filmStepPosition(bench, bench.steps[2]); h.command('reflect:agency');
  assert.equal(state.step, 3); assert.equal(h.sandbox.state.neoLife!.choices.oracle_second_lead, undefined);
  h.actor().position = filmStepPosition(bench, bench.steps[3]); h.command('act'); h.advance((bench.steps[3].seconds ?? 3) * 2 + 1);
  assert.equal(h.sandbox.state.neoLife!.choices.oracle_second_lead, 'le_vrai');
  assert.equal(h.world.agents.get('oracle')!.currentAction?.parameters.seated, undefined, 'Oracle stands when she leaves the bench');
  assert.ok(h.world.agents.get('oracle')!.targetPosition, 'Oracle physically departs after giving Neo the address');
  assert.equal(state.reflections['m2_bench:2'], 'agency');
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved);
  const restored = h.sandbox.life.film.state!;
  assert.equal(restored.step, bench.steps.length); assert.equal(restored.reflections['m2_bench:2'], 'agency');
  assert.equal(h.sandbox.state.neoLife!.choices.oracle_second_lead, 'le_vrai');
  h.command('next'); assert.equal(restored.scene, 'm2_burly');
  assert.notEqual(h.world.agents.get('oracle')!.currentLocation, bench.set, 'the Oracle has left before Smith arrives');
  const oldCode = h.sandbox.state.profiles.neo.inventory.code;
  const burly = FILM_SCENE_BY_ID.m2_burly; restored.step = burly.steps.length; h.actor().currentLocation = burly.set;
  h.command('next'); assert.equal(restored.scene, 'm2_merovingian');
  assert.ok(h.sandbox.state.profiles.neo.inventory.code > oldCode, 'the choice changes real preparation');
  const prepared = h.sandbox.state.profiles.neo.inventory.code;
  h.command('retry'); assert.equal(h.sandbox.state.profiles.neo.inventory.code, prepared, 'loading the checkpoint cannot duplicate the benefit');
});

test('the château fight requires a chosen weapon, timed parry and a climb before the upper guard wave', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const library = FILM_SCENE_BY_ID.m2_library; const hall = FILM_SCENE_BY_ID.m2_chateau;
  Object.assign(state, { scene: library.id, actor: 'neo', step: library.steps.length });
  h.actor().currentLocation = library.set; h.actor().isInMatrix = true;
  h.command('next'); assert.equal(state.scene, hall.id);
  h.actor().position = filmStepPosition(hall, hall.steps[0]); h.command('act');
  assert.equal((state as any).chateau?.phase, 'duel');
  assert.equal(h.sandbox.state.threats.filter(t => t.scene === hall.id).length, 2);
  const guard = h.sandbox.state.threats.find(t => t.scene === hall.id)!;
  guard.position = { ...h.actor().position, z: h.actor().position.z - 2 };
  h.actor().rotation = Math.PI;
  const before = guard.health; h.sandbox.attack(h.actor(), h.tick(), 0);
  assert.equal(guard.health, before, 'an armed guard blocks an unprepared frontal strike');
  guard.attackAt = h.tick() + 2; guard.stunUntil = 0;
  assert.match(h.players.act('film-player', 'dodge', h.tick()), /格开/);
  assert.equal(guard.attackAt, undefined);
  h.actor().position = filmPosition(hall.set, -29, 17); h.command('act');
  assert.equal((state as any).chateau?.weapon, 'sword');
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal((h.sandbox.life.film.state as any).chateau?.weapon, 'sword', 'the selected wall weapon survives reload');
  assert.equal(h.sandbox.state.threats.filter(t => t.scene === hall.id).length, 2);
  const finishWave = () => {
    for (const target of [...h.sandbox.state.threats.filter(t => t.scene === hall.id)]) {
      h.actor().position = { ...target.position, z: target.position.z + 2 }; h.actor().rotation = Math.PI;
      target.attackAt = h.tick() + 2; target.stunUntil = 0;
      h.players.act('film-player', 'dodge', h.tick());
      for (let hit = 0; hit < 3 && target.health > 0; hit++) h.sandbox.attack(h.actor(), h.tick(), 0);
      assert.equal(target.health, 0, `${target.weapon ?? 'disarmed'} guard was not defeated at wave ${h.sandbox.life.film.state?.chateau?.wave}`);
    }
  };
  finishWave(); h.advance();
  assert.equal(h.sandbox.life.film.state?.chateau?.phase, 'landing'); assert.equal(h.sandbox.life.film.state?.step, 0);
  assert.equal(h.sandbox.state.threats.filter(t => t.scene === hall.id).length, 0);
  h.advance(10); assert.equal(h.sandbox.life.film.state?.chateau?.phase, 'landing', 'waiting on the ground does not summon the upper wave');
  h.actor().position = filmStepPosition(hall, hall.steps[1]); h.advance();
  assert.equal(h.sandbox.life.film.state?.chateau?.wave, 2);
  assert.equal(h.sandbox.state.threats.filter(t => t.scene === hall.id).length, 2);
  finishWave(); h.advance(); assert.equal(h.sandbox.life.film.state?.step, 1);
  assert.equal(h.sandbox.life.film.state?.chateau?.phase, 'cleared');
  h.command('retry');
  assert.equal(h.sandbox.life.film.state?.step, 1);
  assert.equal(h.sandbox.life.film.state?.chateau?.phase, 'cleared', 'retry at the exit cannot restart a cleared battle');
});

test('EMP can stagger château guards but cannot bypass their weapon defense', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const library = FILM_SCENE_BY_ID.m2_library; const hall = FILM_SCENE_BY_ID.m2_chateau;
  Object.assign(state, { scene: library.id, actor: 'neo', step: library.steps.length });
  h.actor().currentLocation = library.set; h.actor().isInMatrix = true; h.command('next');
  h.actor().position = filmStepPosition(hall, hall.steps[0]); h.command('act');
  h.sandbox.state.profiles.neo.inventory.emp = 2;
  const guard = h.sandbox.state.threats.find(t => t.scene === hall.id)!;
  const health = guard.health;
  h.sandbox.command(h.actor(), { kind: 'use', target: 'emp' }, h.tick());
  h.advance(3);
  h.sandbox.command(h.actor(), { kind: 'use', target: 'emp' }, h.tick());
  assert.equal(guard.health, health);
  assert.ok(guard.stunUntil > h.tick());
  assert.equal(state.chateau?.phase, 'duel');
});

test('an older château save restarts its unfinished fight without erasing a cleared exit', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const library = FILM_SCENE_BY_ID.m2_library; const hall = FILM_SCENE_BY_ID.m2_chateau;
  Object.assign(state, { scene: library.id, actor: 'neo', step: library.steps.length });
  h.actor().currentLocation = library.set; h.actor().isInMatrix = true; h.command('next');
  h.actor().position = filmStepPosition(hall, hall.steps[0]); h.command('act');
  delete state.chateau;
  for (const guard of h.sandbox.state.threats.filter(t => t.scene === hall.id)) delete guard.weapon;
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(h.sandbox.life.film.state?.chateau?.phase, 'ready');
  assert.equal(h.sandbox.state.threats.filter(t => t.scene === hall.id).length, 0);
  h.actor().position = filmStepPosition(hall, hall.steps[0]);
  h.command('act'); assert.equal(h.sandbox.state.threats.filter(t => t.scene === hall.id).length, 2);
  const resumed = h.sandbox.life.film.state!;
  resumed.step = 1; delete resumed.chateau;
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(h.sandbox.life.film.state?.chateau?.phase, 'cleared');
  assert.equal(h.sandbox.life.film.state?.step, 1);
});

test('upper château guards remain on their floor when Neo retreats below the landing', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const library = FILM_SCENE_BY_ID.m2_library; const hall = FILM_SCENE_BY_ID.m2_chateau;
  Object.assign(state, { scene: library.id, actor: 'neo', step: library.steps.length });
  h.actor().currentLocation = library.set; h.actor().isInMatrix = true; h.command('next');
  h.actor().position = filmStepPosition(hall, hall.steps[0]); h.command('act');
  h.sandbox.state.threats = h.sandbox.state.threats.filter(t => t.scene !== hall.id);
  h.advance(); h.actor().position = filmStepPosition(hall, hall.steps[1]); h.advance();
  h.actor().position = filmPosition(hall.set, -8, -25);
  h.advance(20);
  for (const guard of h.sandbox.state.threats.filter(t => t.scene === hall.id))
    assert.equal(guard.position.y, groundHeight(guard.position, true), 'guard cannot hover across the landing edge');
});

test('the château guard can wound Neo, and a failed attempt retries without losing the chosen weapon', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const library = FILM_SCENE_BY_ID.m2_library; const hall = FILM_SCENE_BY_ID.m2_chateau;
  Object.assign(state, { scene: library.id, actor: 'neo', step: library.steps.length });
  h.actor().currentLocation = library.set; h.actor().isInMatrix = true; h.command('next');
  h.actor().position = filmStepPosition(hall, hall.steps[0]); h.command('act');
  h.actor().position = filmPosition(hall.set, -29, 17); h.command('act');
  const guard = h.sandbox.state.threats.find(t => t.scene === hall.id)!;
  guard.position = { ...h.actor().position, z: h.actor().position.z - 2 };
  guard.stunUntil = 0; guard.attackAt = h.tick() + 1;
  h.actor().health = 1; h.advance();
  assert.equal(state.chateau?.phase, 'failed'); assert.equal(state.chateau?.wounded, true);
  assert.equal(state.chateau?.weapon, 'sword'); assert.equal(h.actor().status, 'alive');
  assert.equal(h.sandbox.state.threats.filter(t => t.scene === hall.id).length, 0);
  h.command('act'); assert.equal(state.chateau?.phase, 'ready');
  h.actor().position = filmStepPosition(hall, hall.steps[0]); h.command('act');
  assert.equal(state.chateau?.weapon, 'sword'); assert.equal(h.sandbox.state.threats.filter(t => t.scene === hall.id).length, 2);
});

test('Neo must inspect the mountain exit, call Link, then steer a saved flight south before the garage cut', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const hall = FILM_SCENE_BY_ID.m2_chateau; const mountain = FILM_SCENE_BY_ID.m2_mountain;
  Object.assign(state, { scene: hall.id, actor: 'neo', step: hall.steps.length });
  h.actor().currentLocation = hall.set; h.actor().isInMatrix = true;
  h.command('next'); assert.equal(state.scene, mountain.id);
  assert.equal(state.mountain?.phase, 'ground');
  h.actor().position = filmStepPosition(mountain, mountain.steps[0]); h.command('act'); h.advance(3);
  assert.equal(state.step, 1);
  h.actor().position = filmStepPosition(mountain, mountain.steps[1]); h.command('act'); h.advance(3);
  assert.equal(state.step, 2); assert.equal(state.mountain?.phase, 'ready');
  const flightInput = { x: 0, z: -1, yaw: Math.PI, jump: true, sprint: true, sequence: 1 };
  h.actor().position = filmStepPosition(mountain, mountain.steps[2]);
  h.players.receiveInput('film-player', flightInput); h.players.step(.1, true, h.tick());
  assert.equal(state.mountain?.phase, 'takeoff');
  for (let frame = 0; frame < 30; frame++) h.players.step(.1, true, h.tick());
  assert.ok(state.mountain!.altitude > 20);
  const before = state.mountain!.z;
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(h.sandbox.life.film.state?.mountain?.z, before);
  h.players.receiveInput('film-player', { ...flightInput, jump: false, sequence: 2 });
  for (let frame = 0; frame < 180 && h.sandbox.life.film.state?.step === 2; frame++) {
    h.players.receiveInput('film-player', { ...flightInput, jump: false, sequence: frame + 3 });
    h.players.step(.1, true, h.tick());
  }
  assert.equal(h.sandbox.life.film.state?.step, 3);
  assert.equal(h.sandbox.life.film.state?.mountain?.phase, 'arrived');
  h.command('next'); assert.equal(h.sandbox.life.film.state?.scene, 'm2_garage');
});

test('Neo can retry a missed mountain flight without replaying Link’s location call', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const hall = FILM_SCENE_BY_ID.m2_chateau; const mountain = FILM_SCENE_BY_ID.m2_mountain;
  Object.assign(state, { scene: hall.id, actor: 'neo', step: hall.steps.length });
  h.actor().currentLocation = hall.set; h.actor().isInMatrix = true; h.command('next');
  for (let index = 0; index < 2; index++) {
    h.actor().position = filmStepPosition(mountain, mountain.steps[index]); h.command('act'); h.advance(3);
  }
  h.actor().position = filmStepPosition(mountain, mountain.steps[2]);
  h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: true, sprint: false, sequence: 1 });
  for (let frame = 0; frame < 280; frame++) h.players.step(.1, true, h.tick());
  assert.equal(state.mountain?.phase, 'failed'); assert.equal(state.step, 2);
  h.command('retry'); assert.equal(state.mountain?.phase, 'ready');
  assert.equal(state.step, 2); assert.equal(state.mountain?.attempt, 1);
});

test('Smith assimilation is reversible at the ending, without reviving Trinity', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!;
  const playLast = (id: string) => {
    const scene = FILM_SCENE_BY_ID[id]; state.scene = id; state.actor = scene.actor; state.step = scene.steps.length - 1;
    if (id === 'm3_oracle_absorbed') state.step = 0;
    h.players.possess('film-player', scene.actor, h.tick());
    h.actor().isInMatrix = FILM_SETS[scene.set].world === 'matrix'; h.actor().currentLocation = scene.set;
    h.actor().position = filmStepPosition(scene, scene.steps[state.step]);
    if (id === 'm3_oracle_absorbed') { let sequence = 0; completeOracleAbsorption(h, () => ++sequence); }
    else if (id === 'm3_surrender') {
      h.sandbox.state.neoLife!.choices.machine_pact = 'peace'; h.sandbox.state.neoLife!.choices.machine_connection = 'active';
      h.command('act');
      const endingSeconds = SMITH_FINALE.surrender.consentSeconds + SMITH_FINALE.surrender.assimilationSeconds + SMITH_FINALE.surrender.purgeSeconds;
      for (let frame = 0; frame < Math.ceil(endingSeconds / .1) + 4 && state.step < scene.steps.length; frame++) {
        h.players.receiveInput('film-player', { x: 0, z: 0, yaw: 0, jump: false, sprint: false, focus: true, sequence: frame + 1 });
        h.players.step(.1, true, h.tick());
      }
      assert.equal(state.smithFinale?.phase, 'done', 'restoration follows the completed purge');
    } else { h.command(scene.steps[state.step].kind === 'reflect' ? 'reflect:care' : 'act'); h.advance(20); }
  };
  playLast('m3_oracle_absorbed'); h.command('next');
  assert.equal(h.world.agents.get('oracle')!.status, 'disconnected');
  playLast('m3_farewell');
  assert.equal(h.world.agents.get('trinity')!.status, 'dead');
  playLast('m3_surrender');
  for (const id of ['oracle', 'sati', 'seraph']) assert.equal(h.world.agents.get(id)!.status, 'alive', id);
  assert.equal(h.world.agents.get('trinity')!.status, 'dead');
});

function rideToExit(h: ReturnType<typeof setup>) {
  let target = 10;
  for (let frame = 0; h.sandbox.life.film.state!.ride?.phase === 'riding' && frame < 6000; frame++) {
    const ride = h.sandbox.life.film.state!.ride!;
    if (frame % 15 === 0) target = freewayAvoidanceTarget(ride);
    h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, sprint: false, jump: false, drive: freewayDriveInput(ride, target), sequence: frame + 100 });
    h.players.step(1 / 60, true, h.tick());
    if (frame % 30 === 0) h.advance();
  }
  assert.equal(h.sandbox.life.film.state!.ride?.phase, 'arrived'); h.advance();
}

test('highway traffic moves, braking reduces speed and a collision injures the vehicle and passenger once', () => {
  let ride = newFreewayRide();
  for (let i = 0; i < 60; i++) ride = stepFreeway(ride, { throttle: 1, steer: -1, brake: false }, 1 / 60);
  assert.ok(ride.speed > 12); assert.ok(ride.x < 14); assert.ok(ride.z < 660);
  const previous = ride.speed; ride = stepFreeway(ride, { throttle: 1, steer: 0, brake: true }, .1);
  assert.ok(ride.speed < previous);
  const car = freewayTraffic(0).find(c => c.x === 14)!;
  assert.ok(freewayTraffic(1).find(c => c.id === car.id)!.z > car.z);
  ride = { ...newFreewayRide(), x: car.x, z: car.z + 4, speed: 35 };
  ride = stepFreeway(ride, { throttle: 0, steer: 0, brake: false }, .05);
  assert.equal(ride.hits, 1); assert.ok(ride.hull < 100); assert.ok(ride.passenger < 100);
  const health = ride.hull; ride = stepFreeway(ride, { throttle: 0, steer: 0, brake: true }, .05);
  assert.equal(ride.hull, health, 'one collision cannot drain all health over successive frames');
  const parked = { ...newFreewayRide(), x: car.x, z: car.z + 6 };
  const struck = stepFreeway(parked, { throttle: 0, steer: 0, brake: true }, .05);
  assert.ok(struck.hull < 100, 'an oncoming car must damage a stationary motorcycle too');
});

test('garage twins phase through a fast car, while hesitation and wall impacts can defeat the escort', () => {
  let escape = newGarageEscape();
  for (let frame = 0; frame < 160 && escape.phase === 'riding'; frame++) escape = stepGarageEscape(escape, { throttle: 1, steer: 0, brake: false }, .05);
  assert.equal(escape.phase, 'arrived'); assert.equal(escape.twins, 3);
  assert.equal(escape.hits, 0); assert.equal(escape.passenger, 100);
  let slow = newGarageEscape();
  for (let frame = 0; frame < 300 && slow.phase === 'riding'; frame++) slow = stepGarageEscape(slow, { throttle: 0, steer: 0, brake: true }, .05);
  assert.equal(slow.phase, 'wrecked'); assert.ok(slow.elapsed <= 14);
  let barrier = { ...newGarageEscape(), x: 7.8, speed: 20 };
  barrier = stepGarageEscape(barrier, { throttle: 1, steer: 1, brake: false }, .1);
  assert.ok(barrier.hits > 0); assert.ok(barrier.hull < 100);
});

test('Trinity drives the garage escape with companions, saved progress, retry and a clean highway handoff', () => {
  const h = setup(); h.command('start'); let state = h.sandbox.life.film.state!; const scene = FILM_SCENE_BY_ID.m2_garage;
  Object.assign(state, { scene: scene.id, actor: scene.actor, step: 0 });
  h.players.possess('film-player', 'trinity', h.tick()); h.actor().currentLocation = scene.set; h.actor().isInMatrix = true;
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.advance(); assert.equal(state.step, 1);
  h.actor().position = filmStepPosition(scene, scene.steps[1]);
  h.players.possess('other', 'keymaker', h.tick()); assert.match(h.command('act'), /另一位玩家/); assert.equal(state.garage, undefined);
  h.players.release('other', h.tick()); h.command('act'); assert.equal(state.garage?.phase, 'riding');
  assert.match(h.players.possess('other', 'keymaker', h.tick()).error!, /车/);
  for (let frame = 0; frame < 18; frame++) h.sandbox.life.film.driveFrame(h.actor(), { throttle: 1, steer: 0, brake: false }, .05, h.tick());
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); const at = { ...h.actor().position };
  h.sandbox.restore(saved); state = h.sandbox.life.film.state!; h.players.release('film-player', h.tick()); h.advance();
  assert.deepEqual(h.sandbox.life.film.state?.garage, saved.neoLife.journey.garage);
  h.players.possess('film-player', 'trinity', h.tick()); assert.deepEqual(h.actor().position, at);
  for (let frame = 0; frame < 160 && h.sandbox.life.film.state?.garage?.phase === 'riding'; frame++)
    h.sandbox.life.film.driveFrame(h.actor(), { throttle: 1, steer: 0, brake: false }, .05, h.tick());
  h.advance(); assert.equal(state.step, 2); assert.equal(h.world.agents.get('keymaker')!.status, 'alive');
  h.command('next'); assert.equal(state.scene, 'm2_freeway'); assert.equal(state.garage, undefined);
  Object.assign(state, { scene: scene.id, actor: scene.actor, step: 1, garage: { ...newGarageEscape(), elapsed: 13.9 } });
  h.actor().currentLocation = scene.set; h.actor().position = filmStepPosition(scene, scene.steps[1]);
  h.sandbox.life.film.driveFrame(h.actor(), { throttle: 0, steer: 0, brake: true }, .1, h.tick());
  assert.equal(h.actor().status, 'dead'); h.command('retry');
  assert.equal(state.step, 1); assert.equal(state.garage, undefined); assert.equal(h.actor().status, 'alive');
});

test('the motorcycle escort requires driving, preserves its position on reconnect, and finishes with a living passenger', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!; const scene = FILM_SCENE_BY_ID.m2_freeway;
  Object.assign(state, { scene: scene.id, actor: scene.actor, step: 1 });
  h.players.possess('film-player', 'trinity', h.tick()); h.actor().currentLocation = scene.set; h.actor().isInMatrix = true;
  h.actor().position = filmStepPosition(scene, scene.steps[1]); state.checkpoint = { ...h.actor().position };
  h.command('act'); h.advance(30); assert.equal(state.step, 1, 'a timer cannot finish the ride');
  for (let i = 0; i < 20; i++) h.sandbox.life.film.driveFrame(h.actor(), { throttle: 1, steer: -1, brake: false }, .05, h.tick());
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); const position = { ...h.actor().position };
  h.sandbox.restore(saved); h.players.release('film-player', h.tick()); h.advance(20);
  assert.deepEqual(h.sandbox.life.film.state!.ride, saved.neoLife.journey.ride);
  h.players.possess('film-player', 'trinity', h.tick()); assert.deepEqual(h.actor().position, position);
  const beforePause = { ...h.sandbox.life.film.state!.ride };
  h.players.step(.1, false, h.tick()); assert.deepEqual(h.sandbox.life.film.state!.ride, beforePause);
  rideToExit(h); assert.equal(h.sandbox.life.film.state!.step, 2);
  assert.equal(h.world.agents.get('keymaker')!.status, 'alive');
  assert.ok(h.world.agents.get('keymaker')!.currentAction?.parameters.freewayHandoff);
});

test('a failed escort retries from the motorcycle and never takes another player as passenger', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!; const scene = FILM_SCENE_BY_ID.m2_freeway;
  Object.assign(state, { scene: scene.id, actor: scene.actor, step: 1 });
  h.players.possess('film-player', 'trinity', h.tick()); h.actor().currentLocation = scene.set; h.actor().isInMatrix = true;
  h.actor().position = filmStepPosition(scene, scene.steps[1]); state.checkpoint = { ...h.actor().position };
  h.players.possess('other', 'keymaker', h.tick()); assert.match(h.command('act'), /另一位玩家/); assert.equal(state.ride, undefined);
  h.players.release('other', h.tick()); h.command('act');
  assert.match(h.players.possess('other', 'keymaker', h.tick()).error!, /后座/);
  Object.assign(state.ride!, { hull: 1, speed: 30, x: 26.5 });
  h.sandbox.life.film.driveFrame(h.actor(), { throttle: 1, steer: 1, brake: false }, .1, h.tick());
  assert.equal(h.actor().status, 'dead'); assert.equal(state.step, 1);
  h.command('retry'); assert.equal(state.ride, undefined); assert.deepEqual(h.actor().position, state.checkpoint);
  h.command('act'); assert.equal(state.ride!.hull, 100); assert.equal(state.ride!.passenger, 100);
});

test('the truck duel takes place on a standable trailer and Johnson returns through the driver', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!; const scene = FILM_SCENE_BY_ID.m2_trucks;
  assert.equal(scene.set, 'film_freeway_trucks');
  assert.ok(scene.cast.includes('agent_johnson') && scene.cast.includes('keymaker') && scene.cast.includes('neo'));
  Object.assign(state, { scene: scene.id, actor: scene.actor, step: 0 });
  h.players.possess('film-player', 'morpheus', h.tick()); h.actor().currentLocation = scene.set; h.actor().isInMatrix = true;
  h.actor().position = filmEntry(scene); state.checkpoint = { ...h.actor().position };
  assert.equal(groundHeight(h.actor().position, true), h.actor().position.y);
  assert.equal(playerBlocked(h.actor().position, true), false);
  h.command('act');
  assert.equal(h.sandbox.state.threats.length, 1);
  assert.equal(h.sandbox.state.threats[0].character, 'agent_johnson');
  assert.equal(h.sandbox.state.threats[0].position.y, h.actor().position.y);
  const johnson = h.sandbox.state.threats[0];
  for (let hit = 0; johnson.health > 0 && hit < 12; hit++) {
    h.actor().position = { ...johnson.position, z: johnson.position.z + 2 }; h.actor().rotation = Math.PI;
    h.sandbox.attack(h.actor(), h.tick(), 2);
  }
  assert.equal(johnson.health, 0); h.advance();
  assert.equal(state.step, 1); assert.equal(state.trucks?.phase, 'collision');
  assert.equal(h.world.agents.get('agent_johnson')?.position.z, filmPosition(scene.set, 0, 14).z);
  assert.equal(h.world.agents.get('keymaker')?.status, 'alive');
});

test('truck collision is timed, preserves the rescue across saves and retries after failure', () => {
  const h = setup(); h.command('start'); let state = h.sandbox.life.film.state!; const scene = FILM_SCENE_BY_ID.m2_trucks;
  Object.assign(state, { scene: scene.id, actor: scene.actor, step: 1, trucks: { phase: 'collision', elapsed: 0, lastTick: h.tick(), attempt: 0 } });
  h.players.possess('film-player', 'morpheus', h.tick()); h.actor().currentLocation = scene.set; h.actor().isInMatrix = true;
  h.actor().position = filmEntry(scene); state.checkpoint = { ...h.actor().position };
  h.advance(5);
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved); state = h.sandbox.life.film.state!;
  assert.equal(state.trucks?.elapsed, saved.neoLife.journey.trucks.elapsed);
  const beforeDisconnect = state.trucks!.elapsed;
  h.actor().controller = undefined; h.advance(8); h.actor().controller = 'film-player'; h.advance();
  assert.ok(state.trucks!.elapsed <= beforeDisconnect + .5, 'disconnection must not consume the collision window');
  h.actor().position = filmStepPosition(scene, scene.steps[1]); h.advance(); assert.equal(state.step, 2);
  h.command('act'); h.actor().controller = undefined; h.advance(6); h.actor().controller = 'film-player';
  assert.ok(state.started !== undefined, 'the held rescue action survives disconnection');
  h.advance(2); assert.equal(state.step, 2);
  h.advance(4);
  assert.equal(state.step, 2, 'the grab must play out before the scene is marked complete');
  assert.equal(state.trucks?.phase, 'rescue');
  const rescueSave = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(rescueSave); state = h.sandbox.life.film.state!;
  assert.equal(state.trucks?.phase, 'rescue');
  for (let frame = 0; frame < 40 && state.trucks?.phase === 'rescue'; frame++) h.players.step(.1, true, h.tick());
  assert.equal(state.step, scene.steps.length); assert.equal(state.trucks?.phase, 'rescued');
  assert.equal(h.actor().position.y, FILM_SETS[scene.set].center.y, 'Morpheus lands on the safe shoulder');
  assert.equal(h.world.agents.get('keymaker')?.status, 'alive');
  h.command('next'); assert.equal(state.scene, FILM_SCENES[FILM_SCENES.indexOf(scene) + 1].id);
  Object.assign(state, { scene: scene.id, actor: scene.actor, step: 1, trucks: { phase: 'collision', elapsed: 9.8, lastTick: h.tick(), attempt: 0 } });
  h.players.possess('film-player', 'morpheus', h.tick());
  h.actor().currentLocation = scene.set; h.actor().position = filmEntry(scene); state.checkpoint = { ...h.actor().position };
  h.advance(3); assert.equal(h.actor().status, 'dead');
  h.command('retry'); assert.equal(h.actor().status, 'alive'); assert.equal(state.step, 1);
  assert.equal(state.trucks?.phase, 'collision'); assert.equal(state.trucks?.elapsed, 0);
  assert.equal(h.actor().position.y, filmEntry(scene).y);
});

test('an older truck checkpoint on the shared freeway moves onto the new trailer without losing progress', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!; const scene = FILM_SCENE_BY_ID.m2_trucks;
  Object.assign(state, { scene: scene.id, actor: scene.actor, step: 1, checkpoint: filmPosition('film_freeway_101', 14, 25) });
  h.players.possess('film-player', 'morpheus', h.tick());
  h.actor().currentLocation = 'film_freeway_101'; h.actor().position = filmPosition('film_freeway_101', 14, 25);
  h.advance();
  assert.equal(h.actor().currentLocation, scene.set);
  assert.deepEqual(h.actor().position, filmEntry(scene));
  assert.deepEqual(state.checkpoint, filmEntry(scene));
  assert.equal(state.step, 1); assert.equal(state.trucks?.phase, 'collision');
});

function truckRescueSetup() {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m2_trucks; const center = FILM_SETS[scene.set].center;
  Object.assign(state, { scene: scene.id, actor: scene.actor, step: 2,
    trucks: { phase: 'rescue', elapsed: 10, lastTick: h.tick(), attempt: 0, rescueElapsed: 0, origin: { x: 14.2, z: 32.5 } } });
  const poses = { morpheus: [14.2, 6.6, 32.5, .2], keymaker: [12.5, 6.6, 32.5, -.3], neo: [14, 18, -35, .5] };
  for (const [id, [x, y, z, yaw]] of Object.entries(poses)) Object.assign(h.world.agents.get(id)!, {
    position: { x: center.x + x, y: center.y + y, z: center.z + z }, rotation: yaw,
    currentLocation: scene.set, isInMatrix: true, status: 'alive', health: 100,
  });
  h.players.possess('film-player', 'morpheus', h.tick());
  state.checkpoint = { ...h.actor().position };
  return h;
}

test('truck rescue preserves all three actual positions and headings at the catch handoff', () => {
  const h = truckRescueSetup();
  const before = ['morpheus', 'keymaker', 'neo'].map(id => {
    const actor = h.world.agents.get(id)!; return { id, position: { ...actor.position }, rotation: actor.rotation };
  });
  h.sandbox.life.film.truckFrame(h.actor(), 0, h.tick());
  for (const actor of before) {
    assert.deepEqual(h.world.agents.get(actor.id)!.position, actor.position, `${actor.id} must not teleport when the rescue starts`);
    assert.equal(h.world.agents.get(actor.id)!.rotation, actor.rotation, `${actor.id} must not snap to a new heading`);
  }
});

test('truck rescue sends separated passengers clear of the roof before Neo catches them and never collapses the crew roots', () => {
  const h = truckRescueSetup(); const roof = h.actor().position.y;
  for (let frame = 0; frame < 300; frame++) {
    h.sandbox.life.film.truckFrame(h.actor(), .01, h.tick());
    const cast = ['morpheus', 'keymaker', 'neo'].map(id => h.world.agents.get(id)!);
    if (frame === 30) for (const passenger of cast.slice(0, 2)) assert.ok(passenger.position.y > roof + 1, 'the passengers jump clear before Neo catches their shoulders');
    for (let a = 0; a < cast.length; a++) for (let b = a + 1; b < cast.length; b++) {
      const delta = Math.hypot(cast[a].position.x - cast[b].position.x, cast[a].position.y - cast[b].position.y, cast[a].position.z - cast[b].position.z);
      assert.ok(delta >= 1.3, `${cast[a].id}/${cast[b].id} roots overlap at rescue frame ${frame}: ${delta}`);
    }
  }
});

test('truck rescue pauses without its player or while a passenger is occupied and cannot carry a dead passenger to success', () => {
  const h = truckRescueSetup(); const state = h.sandbox.life.film.state!;
  const before = ['morpheus', 'keymaker', 'neo'].map(id => ({ ...h.world.agents.get(id)!.position }));
  h.actor().controller = undefined; h.sandbox.life.film.truckFrame(h.actor(), .1, h.tick());
  assert.equal(state.trucks!.rescueElapsed, 0);
  h.actor().controller = 'film-player'; h.world.agents.get('keymaker')!.controller = 'other';
  h.sandbox.life.film.truckFrame(h.actor(), .1, h.tick()); assert.equal(state.trucks!.rescueElapsed, 0);
  ['morpheus', 'keymaker', 'neo'].forEach((id, i) => assert.deepEqual(h.world.agents.get(id)!.position, before[i]));
  h.world.agents.get('keymaker')!.controller = undefined; h.world.agents.get('keymaker')!.status = 'dead';
  h.sandbox.life.film.truckFrame(h.actor(), .1, h.tick());
  assert.equal(state.trucks!.phase, 'failed'); assert.equal(state.completed.includes('m2_trucks'), false);
});

test('truck rescue cold save reconstructs the same separated flight without replaying the pickup', () => {
  const h = truckRescueSetup();
  for (let i = 0; i < 17; i++) h.sandbox.life.film.truckFrame(h.actor(), .1, h.tick());
  const saved = JSON.parse(JSON.stringify(h.sandbox.state));
  const cast = ['morpheus', 'keymaker', 'neo'].map(id => JSON.parse(JSON.stringify(h.world.agents.get(id)!)));
  const loaded = setup(); loaded.command('start');
  for (const actor of cast) {
    const restored = loaded.world.agents.get(actor.id)!; Object.assign(restored, actor); delete restored.controller;
    if (restored.currentAction?.parameters.player) restored.currentAction = null;
  }
  loaded.sandbox.restore(saved);
  assert.ok(loaded.world.agents.get('morpheus')!.currentAction?.parameters.truckRescue, 'a paused cold load must restore the carried body before the player reconnects');
  loaded.players.possess('film-player', 'morpheus', loaded.tick());
  loaded.sandbox.life.film.truckFrame(loaded.actor(), 0, loaded.tick());
  for (const actor of cast) assert.deepEqual(loaded.world.agents.get(actor.id)!.position, actor.position);
  assert.equal(loaded.sandbox.life.film.state!.trucks!.rescueElapsed, saved.neoLife.journey.trucks.rescueElapsed);
  for (let frame = 0; frame < 16; frame++) {
    h.sandbox.life.film.truckFrame(h.actor(), .1, h.tick());
    loaded.sandbox.life.film.truckFrame(loaded.actor(), .1, loaded.tick());
    for (const id of ['morpheus', 'keymaker', 'neo']) assert.deepEqual(loaded.world.agents.get(id)!.position, h.world.agents.get(id)!.position);
  }
});

test('truck rescue resumes an older in-flight save from its saved roots without snapping or resetting time', () => {
  const h = truckRescueSetup(); const state = h.sandbox.life.film.state!;
  state.trucks!.rescueElapsed = 1.5; delete state.trucks!.starts; delete state.trucks!.startElapsed;
  const cast = ['morpheus', 'keymaker', 'neo'].map(id => ({ id, position: { ...h.world.agents.get(id)!.position } }));
  h.sandbox.life.film.truckFrame(h.actor(), 0, h.tick());
  for (const actor of cast) assert.deepEqual(h.world.agents.get(actor.id)!.position, actor.position);
  assert.equal(state.trucks!.rescueElapsed, 1.5);
  for (let frame = 0; frame < 16; frame++) h.sandbox.life.film.truckFrame(h.actor(), .1, h.tick());
  assert.equal(state.trucks!.phase, 'rescued');
});

test('older truck saves retain the carrying or landing phase without standing up or replaying the jump', () => {
  for (const savedClock of [1.5, 2.8, 2.99]) {
    const h = truckRescueSetup(), state = h.sandbox.life.film.state!, base = FILM_SETS.film_freeway_trucks.center;
    const origin = { x: 12.5, z: 32.5 }, t = savedClock / 3, progress = t * t * (3 - 2 * t);
    Object.assign(state.trucks!, { rescueElapsed: savedClock, origin }); delete state.trucks!.starts; delete state.trucks!.startElapsed;
    // Reconstruct the actual pre-fix flight, including its asymmetric spacing.
    const roles = ['morpheus', 'keymaker', 'neo'] as const;
    for (const [i, role] of roles.entries()) {
      const actor = h.world.agents.get(role)!;
      actor.position = { x: base.x + 12.5 + 7.5 * progress + [0, -1.5, 1.4][i] * progress,
        y: base.y + 6.6 * (1 - progress) + (11 + [0, 0, .8][i]) * Math.sin(Math.PI * progress),
        z: base.z + 32.5 + 13.5 * progress + [0, 1, -1][i] * progress };
      actor.rotation = Math.atan2(7.5, 13.5);
    }
    const before = roles.map(role => ({ ...h.world.agents.get(role)!.position }));
    h.sandbox.life.film.truckFrame(h.actor(), 0, h.tick());
    for (const [i, role] of roles.entries()) {
      assert.deepEqual(h.world.agents.get(role)!.position, before[i]);
      const pose = truckRescuePose(state.trucks!, role);
      assert.ok(pose.flight > 0 && pose.approach === 1, 'an old airborne save must stay after the pickup rather than approach again');
      assert.ok(Math.abs(pose.tumble) < .0001, 'the passengers must not replay their roof departure tumble');
      if (savedClock === 1.5) assert.equal(pose.hold, 1, 'the original carrying moment must still hold both shoulders');
      if (role !== 'neo' && savedClock === 1.5) assert.equal(pose.airborne, 1, 'a carried passenger cannot stand upright while restoring');
    }
    let previous = roles.map(role => truckRescuePose(state.trucks!, role));
    for (let frame = 0; frame < 151 && state.trucks!.phase === 'rescue'; frame++) {
      h.sandbox.life.film.truckFrame(h.actor(), .01, h.tick());
      const poses = roles.map(role => truckRescuePose(state.trucks!, role));
      for (let i = 0; i < poses.length; i++) {
        assert.ok(poses[i].airborne <= previous[i].airborne + .0001 && poses[i].hold <= previous[i].hold + .0001,
          'a resumed carrying/landing phase cannot stand up and then grab the shoulders again');
        assert.ok(Math.hypot(poses[i].x - previous[i].x, poses[i].y - previous[i].y, poses[i].z - previous[i].z) < .4,
          `legacy ${savedClock}s/${roles[i]} snaps during the remaining flight`);
      }
      previous = poses;
    }
    assert.equal(state.trucks!.phase, 'rescued');
    for (const role of roles) assert.equal(h.world.agents.get(role)!.position.y, base.y);
  }
});

test('truck rescue retry resumes a living saved flight and a failed passenger returns to a roof checkpoint', () => {
  const h = truckRescueSetup(); let state = h.sandbox.life.film.state!;
  for (let frame = 0; frame < 15; frame++) h.sandbox.life.film.truckFrame(h.actor(), .1, h.tick());
  const before = { ...h.actor().position }; const elapsed = state.trucks!.rescueElapsed;
  h.command('retry');
  assert.equal(state.trucks!.phase, 'rescue'); assert.equal(state.trucks!.rescueElapsed, elapsed);
  assert.deepEqual(h.actor().position, before);
  h.world.agents.get('keymaker')!.status = 'dead'; h.sandbox.life.film.truckFrame(h.actor(), .1, h.tick());
  h.command('retry'); state = h.sandbox.life.film.state!;
  assert.equal(state.trucks!.phase, 'collision'); assert.equal(h.world.agents.get('keymaker')!.status, 'alive');
  assert.equal(h.actor().position.y, FILM_SETS.film_freeway_trucks.center.y + 6.6);
});

test('truck pickup marker never asks Morpheus to stand inside the Keymaker', () => {
  const scene = FILM_SCENE_BY_ID.m2_trucks;
  const keymaker = { ...filmPosition(scene.set, 12.5, 32.5), y: FILM_SETS[scene.set].center.y + 6.6 };
  assert.equal(filmStepActionReady(scene, scene.steps[2], keymaker, true), false);
  assert.equal(filmStepActionReady(scene, scene.steps[2], filmStepPosition(scene, scene.steps[2]), true), true);
});

test('truck rescue stays continuous and separated across the full pickup area and early or late Neo arrivals', () => {
  const roles: TruckRescueRole[] = ['morpheus', 'keymaker', 'neo'];
  for (let angle = 0; angle < 16; angle++) for (const arrival of [3, 6, 9.5]) {
    const encounter: TruckEncounter = { phase: 'rescue', elapsed: arrival, lastTick: 0, attempt: 0, rescueElapsed: 0,
      starts: { morpheus: { x: TRUCKS.rescueApproach.x + .7 * Math.cos(angle * Math.PI / 8), y: 6.6,
        z: TRUCKS.rescueApproach.z + .7 * Math.sin(angle * Math.PI / 8), yaw: angle * Math.PI / 8 },
      keymaker: { ...TRUCKS.keymaker, y: 6.6, yaw: Math.PI }, neo: truckApproachPose(arrival) } };
    let previous = roles.map(role => truckRescuePose(encounter, role));
    for (let frame = 1; frame <= 300; frame++) {
      encounter.rescueElapsed = frame / 100;
      const poses = roles.map(role => truckRescuePose(encounter, role));
      for (let a = 0; a < roles.length; a++) {
        assert.ok(Math.hypot(poses[a].x - previous[a].x, poses[a].y - previous[a].y, poses[a].z - previous[a].z) < 1.7,
          `${roles[a]} teleports between adjacent saved frames: arrival ${arrival}, start ${angle}, frame ${frame}`);
        for (let b = a + 1; b < roles.length; b++) assert.ok(Math.hypot(poses[a].x - poses[b].x, poses[a].y - poses[b].y, poses[a].z - poses[b].z) > 1.3,
          `${roles[a]}/${roles[b]} roots collapse: arrival ${arrival}, start ${angle}, frame ${frame}`);
      }
      previous = poses;
    }
  }
});

test('truck rescue pauses the approach and held action while a pre-existing player owns a passenger', () => {
  const h = truckRescueSetup(); const state = h.sandbox.life.film.state!;
  state.trucks!.phase = 'collision'; state.trucks!.elapsed = 3; state.trucks!.lastTick = h.tick();
  h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m2_trucks, FILM_SCENE_BY_ID.m2_trucks.steps[2]);
  h.command('act'); const started = state.started!;
  h.world.agents.get('neo')!.controller = 'other'; const before = { ...h.world.agents.get('neo')!.position };
  h.advance(8); assert.equal(state.trucks!.elapsed, 3); assert.ok(state.started! > started);
  assert.deepEqual(h.world.agents.get('neo')!.position, before);
});

test('Niobe arms the main station, Vigilant loss requires Trinity, and only both cuts open the 314-second door window', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!;
  const power = FILM_SCENE_BY_ID.m2_power; Object.assign(state, { scene: power.id, actor: 'niobe', step: 1 });
  h.players.possess('film-player', 'niobe', h.tick()); h.actor().currentLocation = power.set; h.actor().isInMatrix = true;
  const ghost = h.world.agents.get('ghost')!; ghost.currentLocation = power.set; ghost.isInMatrix = true; ghost.position = filmPosition(power.set, 5, 15);
  let sequence = 0; completePrimary(h, () => ++sequence);
  assert.equal(state.step, 2); assert.equal(state.grid?.primary, 'armed');
  assert.equal(state.grid?.emergency, 'online'); assert.equal(state.grid?.phase, 'preparing');

  const vigilant = FILM_SCENE_BY_ID.m2_vigilant; Object.assign(state, { scene: vigilant.id, actor: 'trinity', step: 0 });
  h.players.possess('film-player', 'trinity', h.tick()); h.actor().currentLocation = vigilant.set; h.actor().isInMatrix = false;
  for (const index of [0, 1]) { h.actor().position = filmStepPosition(vigilant, vigilant.steps[index]); h.command('act'); h.advance(6); }
  assert.equal(state.grid?.vigilant, 'lost'); assert.equal(state.grid?.trinity, 'waiting');
  const relay = FILM_SCENE_BY_ID.m2_relay; Object.assign(state, { scene: relay.id, step: 0 });
  state.grid!.primary = 'off';
  h.actor().currentLocation = relay.set; h.actor().isInMatrix = false; h.actor().position = filmStepPosition(relay, relay.steps[0]);
  h.command('act'); for (let frame = 0; frame < 75; frame++) h.players.step(.1, true, h.tick());
  h.command('act'); h.actor().position = filmStepPosition(relay, relay.steps[1], state); h.command('act');
  for (let frame = 0; frame < 170; frame++) h.players.step(.1, true, h.tick());
  assert.equal(state.grid!.trinity, 'connected'); state.primaryDemolition!.blast = { phase: 'done', elapsed: 8 };

  const backup = FILM_SCENE_BY_ID.m2_backup; Object.assign(state, { scene: backup.id, step: 1 });
  h.actor().currentLocation = backup.set; h.actor().isInMatrix = true; h.actor().position = filmStepPosition(backup, backup.steps[1]);
  completeTerminal(h, () => ++sequence);
  assert.equal(state.step, 2); assert.equal(state.grid?.primary, 'off'); assert.equal(state.grid?.emergency, 'online');
  assert.equal(state.grid?.phase, 'emergency'); assert.equal(state.grid?.remaining, 314);

  const door = FILM_SCENE_BY_ID.m2_key_door; Object.assign(state, { scene: door.id, actor: 'neo', step: 5,
    keyDoor: { portalOpened: true, keyTaken: true } });
  h.players.possess('film-player', 'neo', h.tick()); h.actor().currentLocation = door.set; h.actor().isInMatrix = true;
  h.actor().position = filmStepPosition(door, door.steps[5]); h.advance(24);
  assert.equal(state.grid?.phase, 'window'); assert.equal(state.grid?.emergency, 'off');
  h.advance(10);
  assert.ok(state.grid!.remaining < 314); h.command('act'); portalFrames(h, 35);
  assert.equal(state.grid?.phase, 'opened'); assert.equal(state.step, door.steps.length);
});

test('a missed grid window blocks the key door and reroutes through the surviving crews; pause and save freeze the repair', () => {
  const h = setup(); h.command('start'); let state = h.sandbox.life.film.state!;
  const door = FILM_SCENE_BY_ID.m2_key_door;
  Object.assign(state, { scene: door.id, actor: 'neo', step: 5, keyDoor: { portalOpened: true, keyTaken: true },
    grid: { primary: 'off', emergency: 'off', vigilant: 'lost', trinity: 'connected', phase: 'window', remaining: 1, lastTick: h.tick(), reroute: 0, attempts: 0 } });
  h.players.possess('film-player', 'neo', h.tick());
  h.actor().currentLocation = door.set; h.actor().isInMatrix = true; h.actor().position = filmStepPosition(door, door.steps[5]);
  h.advance(3); assert.equal(state.grid?.phase, 'expired');
  assert.equal(state.step, 5); assert.match(h.command('act'), /改线|重连/); assert.equal(state.grid?.phase, 'rerouting');
  h.advance(4); const elapsed = state.grid!.reroute;
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); state = h.sandbox.life.film.state!;
  assert.equal(state.grid?.reroute, elapsed);
  h.players.release('film-player', h.tick()); h.advance(30); assert.equal(state.grid?.reroute, elapsed);
  h.players.possess('film-player', 'neo', h.tick()); h.advance(8);
  assert.equal(state.grid?.phase, 'window'); assert.equal(state.grid?.attempts, 1);
  h.actor().position = filmStepPosition(door, door.steps[5]); h.command('act'); portalFrames(h, 35);
  assert.equal(state.grid?.phase, 'opened'); assert.equal(state.step, door.steps.length);
});

test('an older key-door checkpoint reconstructs the cut grid without replaying Niobe or Vigilant', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!;
  const door = FILM_SCENE_BY_ID.m2_key_door;
  Object.assign(state, { scene: door.id, actor: 'neo', step: 1, grid: undefined });
  h.players.possess('film-player', 'neo', h.tick());
  h.actor().currentLocation = 'film_backdoor_hall'; h.actor().isInMatrix = true;
  h.actor().position = filmPosition('film_backdoor_hall', 0, -38); state.checkpoint = { ...h.actor().position };
  h.advance(); assert.equal(state.step, 3); h.command('act'); assert.equal(state.grid?.primary, 'off'); assert.equal(state.grid?.emergency, 'off');
  assert.equal(state.grid?.phase, 'window');
  assert.equal(h.actor().currentLocation, door.set); assert.deepEqual(h.actor().position, filmPosition(door.set, 1.65, -37.25));
  assert.deepEqual(state.checkpoint, filmPosition(door.set, 0, -38));
  h.actor().position = filmPosition('film_backdoor_hall', 0, -38); state.checkpoint = { ...h.actor().position };
  h.advance();
  assert.deepEqual(h.actor().position, filmPosition(door.set, 1.65, -37.25));
  assert.deepEqual(state.checkpoint, filmPosition(door.set, 0, -38));
});

test('entering the Architect room preserves Neo’s wounds, supplies and the Keymaker’s death', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm2_key_door', actor: 'neo', step: FILM_SCENE_BY_ID.m2_key_door.steps.length,
    keyDoor: { portalOpened: true, keyTaken: true, performance: { phase: 'done', elapsed: 0, attempts: 1 } } });
  h.actor().currentLocation = FILM_SCENE_BY_ID.m2_key_door.set;
  h.actor().position = filmPosition(h.actor().currentLocation, 0, -55.4); h.actor().health = 37;
  h.sandbox.state.profiles.neo.inventory.medkit = 0;
  const keymaker = h.world.agents.get('keymaker')!; keymaker.status = 'dead'; keymaker.health = 0;
  h.command('next');
  assert.equal(state.scene, 'm2_architect');
  assert.equal(h.actor().health, 37, 'a room transition is not a medical treatment');
  assert.equal(h.sandbox.state.profiles.neo.inventory.medkit, 0, 'walking through the Source cannot manufacture supplies');
  assert.equal(keymaker.status, 'dead'); assert.equal(keymaker.health, 0);
});

test('the Architect control room has a circular reachable floor rather than invisible rectangular corners', () => {
  assert.equal(playerBlocked(filmPosition('film_architect_room', 20, 20), true, .6, []), true);
  assert.equal(playerBlocked(filmPosition('film_architect_room', 0, -8), true, .6, []), false);
});

test('the Architect reveals both costs before Neo can take the film-left door', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m2_architect;
  Object.assign(state, { scene: scene.id, actor: 'neo', step: 0, architect: undefined });
  h.actor().currentLocation = scene.set; h.actor().position = filmEntry(scene);
  assert.ok(scene.steps[2].x > 0, 'Source reset is the right-hand door');
  assert.ok(scene.steps.at(-1)!.x < 0, 'Trinity is behind the left-hand door');
  h.advance();
  assert.equal(state.architect?.phase, 'cycles');
  assert.equal(playerBlocked(filmPosition(scene.set, 8, -28.2), true, 1.1, h.sandbox.state.structures), true);
  assert.equal(playerBlocked(filmPosition(scene.set, -8, -28.2), true, 1.1, h.sandbox.state.structures), true);
  for (let index = 0; index < scene.steps.length; index++) {
    h.actor().position = filmStepPosition(scene, scene.steps[index]);
    if (index === 0) h.advance();
    else if (scene.steps[index].kind === 'reflect') h.command('reflect:agency');
    else if (index === 5) completeArchitectDoor(h);
    else { h.command('act'); h.advance((scene.steps[index].seconds ?? 3) * 2 + 1); }
    assert.equal(state.step, index + 1, `Architect beat ${index}`);
    if (index === 2) assert.equal(state.architect?.sourceReviewed, true);
    if (index === 3) assert.equal(state.architect?.trinityReviewed, true);
  }
  assert.equal(state.architect?.door, 'matrix');
  assert.equal(h.sandbox.life.state!.choices.architect_door, 'matrix');
  assert.equal(playerBlocked(filmPosition(scene.set, 8, -28.2), true, 1.1, h.sandbox.state.structures), true);
  assert.equal(playerBlocked(filmPosition(scene.set, -8, -28.2), true, 1.1, h.sandbox.state.structures), false);
  assert.ok(state.completed.includes(scene.id));
});

test('an older Architect save replays the door costs while preserving its philosophical answer', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm2_architect', actor: 'neo', step: 2, architect: undefined });
  state.reflections['m2_architect:1'] = 'agency';
  h.sandbox.life.state!.choices['m2_architect:1'] = 'agency';
  h.actor().currentLocation = FILM_SCENE_BY_ID.m2_architect.set;
  h.advance();
  assert.equal(state.step, 1);
  assert.equal(state.reflections['m2_architect:1'], undefined);
  assert.equal(state.reflections['m2_architect:4'], 'agency');
  assert.equal(h.sandbox.life.state!.choices['m2_architect:4'], 'agency');
  assert.deepEqual(h.world.agents.get('architect')?.position, filmPosition('film_architect_room', 0, -14));
  state.step = 4; h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m2_architect, FILM_SCENE_BY_ID.m2_architect.steps[4]);
  assert.match(h.command('reflect:care'), /此前存档/); assert.equal(state.step, 4);
});

test('another player holding Architect or Trinity pauses the corresponding reveal', () => {
  const h = setup(); h.command('continue'); const state = h.sandbox.life.film.state!;
  const scene = FILM_SCENE_BY_ID.m2_architect;
  Object.assign(state, { scene: scene.id, actor: 'neo', step: 1,
    architect: { phase: 'cycles', sourceReviewed: false, trinityReviewed: false, remaining: 45, lastTick: h.tick(), attempts: 0 } });
  h.actor().currentLocation = scene.set; h.actor().position = filmStepPosition(scene, scene.steps[1]);
  h.players.possess('other-player', 'architect', h.tick());
  assert.match(h.command('act'), /另一位玩家/); assert.equal(state.started, undefined);
  h.players.release('other-player', h.tick());
  state.step = 3; h.actor().position = filmStepPosition(scene, scene.steps[3]);
  h.players.possess('other-player', 'trinity', h.tick());
  assert.match(h.command('act'), /另一位玩家/); assert.equal(state.started, undefined);
  state.step = 5; state.architect!.phase = 'decision'; state.architect!.remaining = 20;
  h.actor().position = filmStepPosition(scene, scene.steps[5]);
  h.advance(10); assert.equal(state.architect!.remaining, 20);
  assert.match(h.command('act'), /另一位玩家/); assert.equal(state.started, undefined);
});

test('the Architect door window pauses on disconnect, restores, fails, and retries without replaying the conversation', () => {
  const h = setup(); h.command('continue'); const scene = FILM_SCENE_BY_ID.m2_architect;
  const state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: scene.id, actor: 'neo', step: scene.steps.length - 1,
    architect: { phase: 'decision', sourceReviewed: true, trinityReviewed: true, remaining: 2, lastTick: h.tick(), attempts: 0 } });
  h.actor().currentLocation = scene.set; h.actor().position = filmStepPosition(scene, scene.steps.at(-1)!);
  h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(state.architect!.remaining, 2);
  h.players.possess('film-player', 'neo', h.tick());
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.advance(5); const restored = h.sandbox.life.film.state!;
  assert.equal(restored.architect?.phase, 'failed'); assert.equal(restored.step, scene.steps.length - 1);
  assert.match(h.command('act'), /重试/);
  assert.match(h.command('retry'), /重试/);
  assert.equal(restored.architect?.phase, 'decision'); assert.equal(restored.architect?.attempts, 1);
  assert.equal(restored.architect?.sourceReviewed, true); assert.equal(restored.architect?.trinityReviewed, true);
  h.actor().position = filmStepPosition(scene, scene.steps.at(-1)!);
  completeArchitectDoor(h);
  assert.equal(restored.architect?.door, 'matrix');
});

test('a completed two-step key-door save remains complete after the corridor moves', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!;
  const door = FILM_SCENE_BY_ID.m2_key_door;
  Object.assign(state, { scene: door.id, actor: 'neo', step: 2, grid: undefined, keyDoor: undefined,
    checkpoint: filmPosition('film_backdoor_hall', 0, -45) });
  h.players.possess('film-player', 'neo', h.tick());
  h.actor().position = filmPosition('film_backdoor_hall', 0, -45); h.actor().currentLocation = 'film_backdoor_hall';
  h.advance();
  assert.equal(state.step, door.steps.length); assert.equal(state.grid?.phase, 'opened');
  assert.equal(state.keyDoor?.portalOpened, true); assert.equal(state.keyDoor?.keyTaken, true);
  assert.deepEqual(state.checkpoint, filmPosition(door.set, 0, -45));
});

test('the backup console cannot open the route before Niobe and Vigilant handoff, and the window freezes without a player', () => {
  const h = setup(); h.command('start'); const state = h.sandbox.life.film.state!;
  const backup = FILM_SCENE_BY_ID.m2_backup;
  Object.assign(state, { scene: backup.id, actor: 'trinity', step: 1,
    grid: { primary: 'online', emergency: 'online', vigilant: 'active', trinity: 'waiting', phase: 'preparing', remaining: 314, lastTick: h.tick(), reroute: 0, attempts: 0 } });
  h.players.possess('film-player', 'trinity', h.tick()); h.actor().currentLocation = backup.set; h.actor().isInMatrix = true;
  h.actor().position = filmStepPosition(backup, backup.steps[1]); h.command('act'); h.advance(8);
  assert.equal(state.step, 1); assert.equal(state.grid?.phase, 'preparing');
  assert.match(state.lastText, /尚未全部完成/);
  Object.assign(state.grid!, { primary: 'armed', vigilant: 'lost', trinity: 'connected' });
  let sequence = 0; completeTerminal(h, () => ++sequence); assert.equal(state.grid?.phase, 'emergency');
  const remaining = state.grid!.hackRemaining;
  h.players.release('film-player', h.tick()); h.advance(40);
  assert.equal(state.grid!.hackRemaining, remaining);
  h.players.possess('film-player', 'neo', h.tick());
  const door = FILM_SCENE_BY_ID.m2_key_door; Object.assign(state, { scene: door.id, actor: 'neo', step: 1 });
  h.actor().currentLocation = door.set; h.actor().position = filmStepPosition(door, door.steps[1]);
  h.players.possess('other-player', 'trinity', h.tick()); h.advance(4);
  assert.equal(state.grid!.hackRemaining, remaining);
  h.players.release('other-player', h.tick()); h.advance(2);
  assert.equal(state.grid!.hackRemaining, remaining! - 1);
});

test('Neo holds Smith copies, opens the portal, receives the wounded Keymaker’s key, and alone opens the source door', () => {
  const h = setup(); h.command('start'); let state = h.sandbox.life.film.state!;
  Object.assign(state, { scene: 'm2_backup', actor: 'trinity', step: FILM_SCENE_BY_ID.m2_backup.steps.length,
    grid: { primary: 'off', emergency: 'online', vigilant: 'lost', trinity: 'connected', phase: 'emergency',
      remaining: 314, lastTick: h.tick(), reroute: 0, attempts: 0, hackRemaining: 12 } });
  h.players.possess('film-player', 'trinity', h.tick());
  h.command('next'); const door = FILM_SCENE_BY_ID.m2_key_door;
  assert.equal(state.scene, door.id); assert.equal(h.actor().id, 'neo'); assert.equal(door.steps.length, 6);
  assert.equal(state.grid?.phase, 'emergency'); assert.equal(state.grid?.emergency, 'online');
  const portal = filmPosition(door.set, 0, -39);
  assert.equal(playerBlocked(portal, true, 1.1, h.sandbox.state.structures), true, 'the first door blocks the hallway before it opens');
  h.advance(24); assert.equal(state.grid?.phase, 'window'); assert.ok(state.grid!.remaining > 313);

  h.actor().position = filmStepPosition(door, door.steps[0]); h.advance(); assert.equal(state.step, 1);
  h.actor().position = filmStepPosition(door, door.steps[1]); h.command('act'); h.advance();
  assert.equal(h.sandbox.state.threats.filter(threat => threat.scene === door.id).length, 3);
  for (const target of h.sandbox.state.threats.filter(threat => threat.scene === door.id)) {
    for (let hit = 0; target.health > 0 && hit < 30; hit++) {
      h.actor().position = { ...target.position, z: target.position.z + 2 }; h.actor().rotation = Math.PI;
      h.sandbox.attack(h.actor(), h.tick(), 2);
    }
    assert.equal(target.health, 0);
  }
  h.advance(); assert.equal(state.step, 2);
  for (const index of [2, 3, 4, 5]) {
    h.actor().position = filmStepPosition(door, door.steps[index]);
    if (index === 2) { h.command('act'); h.advance(4); } else completePortalStep(h, index);
    assert.equal(state.step, index + 1);
    if (index === 3) {
      assert.equal(state.keyDoor?.portalOpened, true);
      assert.equal(playerBlocked(portal, true, 1.1, h.sandbox.state.structures), true, 'the escape door is shut behind the wounded party');
      assert.equal(playerBlocked(filmPosition(door.set, 8.7, -39), true, 1.1, h.sandbox.state.structures), true, 'the wall beside it remains solid');
    }
    if (index === 4) {
      assert.equal(state.keyDoor?.keyTaken, true); assert.equal(h.world.agents.get('keymaker')?.status, 'dead');
      const remaining = state.grid!.remaining;
      h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); state = h.sandbox.life.film.state!;
      assert.equal(state.step, 5); assert.equal(state.keyDoor?.portalOpened, true); assert.equal(state.keyDoor?.keyTaken, true);
      assert.equal(state.grid?.remaining, remaining); assert.equal(playerBlocked(portal, true, 1.1, h.sandbox.state.structures), true);
    }
  }
  assert.equal(state.grid?.phase, 'opened'); assert.ok(state.completed.includes(door.id));
  assert.equal(h.world.agents.get('morpheus')?.status, 'alive');
});

test('the entire film route completes through interactions, driving and real combat, then starts a recorded new life', t => {
  const h = setup(); h.command('start'); const state = h.sandbox.state.neoLife!.journey!;
  let sequence = 0;
  for (const scene of FILM_SCENES) {
    assert.equal(state.scene, scene.id); assert.equal(h.actor().id, scene.actor);
    if (scene.id === 'm3_gate') assert.equal(h.world.agents.get('mifune')?.status, 'dead');
    assert.equal(h.actor().isInMatrix, scene.id === 'm2_meeting' ? false : FILM_SETS[scene.set].world === 'matrix');
    const entryMusic = scene.id === 'm2_meeting' ? 'night' : scene.id === 'm1_tv_exit' ? 'matrix' : scene.id === 'm1_unplugged' && state.tvExit?.crosscut ? 'anomaly' : scene.music;
    assert.equal(musicForScene({ player: h.actor(), sandbox: h.sandbox.state, time: h.world.timeOfDay, matrix: h.actor().isInMatrix, running: true }), entryMusic, `${scene.id}: music follows the active film entry at ${h.actor().currentLocation}`);
    if (scene.id === 'm3_trainman_chase') { completeTrainmanChase(h, () => ++sequence); h.command('next'); continue; }
    if (scene.id === 'm3_hel_garage') { completeHelGarage(h, () => ++sequence); h.command('next'); continue; }
    if (scene.id === 'm3_oracle_last') { completeOracleLast(h, () => ++sequence); h.command('next'); continue; }
    if (scene.id === 'm3_oracle_absorbed') { completeOracleAbsorption(h, () => ++sequence); h.command('next'); continue; }
    if (scene.id === 'm3_bane_questions') { completeBaneInquiry(h, () => ++sequence); h.command('next'); continue; }
    if (scene.id === 'm3_logos_plan') { completeHammerBriefing(h, () => ++sequence); h.command('next'); continue; }
    if (scene.id === 'm3_zion_prepare') { completeZionDeployment(h, () => ++sequence); h.command('next'); continue; }
    if (scene.id === 'm3_maggie_discovery') { completeMaggieDiscovery(h, () => ++sequence); h.command('next'); continue; }
    if (scene.id === 'm2_trucks' && state.trucks?.road) {
      h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, sequence: ++sequence });
      for (let frame = 0; frame < 110 && state.trucks.road.phase !== 'ready'; frame++) h.players.step(.05, true, h.tick());
      assert.equal(state.trucks.road.phase, 'ready', 'the route waits for Johnson to land on the same moving truck');
    }
    if (scene.id === 'm1_mirror' && state.mirrorGuide) {
      for (const [x, z] of [[-5, -3.1], [-5, -9.8], [-6, -12.7], [MIRROR_TOUCH.x, MIRROR_TOUCH.z]]) {
        const target = filmPosition(scene.set, x, z);
        for (let frame = 0; frame < 500; frame++) {
          const actor = h.actor(), dx = target.x - actor.position.x, dz = target.z - actor.position.z;
          const gap = Math.hypot(dx, dz);
          if (gap < .3) break;
          h.players.receiveInput('film-player', { x: dx / Math.max(1, gap), z: dz / Math.max(1, gap), yaw: Math.atan2(dx, dz), jump: false, sprint: false, sequence: ++sequence });
          h.players.step(.05, true, h.tick());
          if (frame % 10 === 0) h.advance();
          assert.ok(frame < 499, `Morpheus route blocked at ${x}, ${z}`);
        }
      }
      h.players.receiveInput('film-player', { x: 0, z: 0, yaw: h.actor().rotation, jump: false, sprint: false, sequence: ++sequence });
      for (let frame = 0; frame < 100 && !state.mirrorGuide.done; frame++) h.advance();
      assert.equal(state.mirrorGuide.done, true, JSON.stringify({ guide: state.mirrorGuide,
        neo: h.actor().position, morpheus: h.world.agents.get('morpheus')?.position }));
    }
    if (scene.id === 'm1_pills' && state.hotel) {
      // Enter the room by walking all stair flights and opening the actual door.
      for (const point of HOTEL_ROUTE.slice(4, -2)) {
        if (point.x === 18 && point.z === 0) {
          for (let frame = 0; frame < 120; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.hotel.progress, HOTEL_DOOR_PROGRESS); h.command('act');
          for (let frame = 0; frame < 25; frame++) h.players.step(.1, true, h.tick());
        }
        const center = FILM_SETS.film_lafayette.center;
        for (let frame = 0; frame < 800; frame++) {
          const actor = h.actor(); const dx = center.x + point.x - actor.position.x; const dz = center.z + point.z - actor.position.z;
          const length = Math.hypot(dx, dz);
          if (length < .3 && Math.abs(actor.position.y - 1 - point.y) < .6) break;
          h.players.receiveInput('film-player', { x: dx / Math.max(1, length), z: dz / Math.max(1, length), yaw: Math.atan2(dx, dz), jump: false, sprint: false, sequence: ++sequence });
          h.players.step(.05, true, h.tick());
          assert.ok(frame < 799, `hotel route blocked at ${JSON.stringify(point)}`);
        }
        h.players.receiveInput('film-player', { x: 0, z: 0, yaw: h.actor().rotation, jump: false, sprint: false, sequence: ++sequence });
      }
      h.players.step(.1, true, h.tick()); assert.equal(state.hotel.entered, true);
      for (let frame = 0; frame < 70; frame++) h.players.step(.1, true, h.tick());
      assert.equal(state.hotel.welcome?.phase, 'ready'); h.command('act');
      for (let frame = 0; frame < 90; frame++) h.players.step(.1, true, h.tick());
      assert.equal(state.hotel.welcome?.phase, 'done');
    }
    if (scene.id === 'm1_wake_again') {
      for (let frame = 0; frame < 61; frame++) h.players.step(.1, true, h.tick());
      assert.equal(state.wakeCall?.phase, 'ringing');
    }
    if (scene.id === 'm1_spoon' && state.oracle?.arrival) {
      const walk = (x: number, z: number) => {
        const target = filmPosition(scene.set, x, z);
        for (let frame = 0; frame < 400; frame++) {
          const actor = h.actor(), dx = target.x - actor.position.x, dz = target.z - actor.position.z, gap = Math.hypot(dx, dz);
          if (gap < .7) break;
          h.players.receiveInput('film-player', { x: dx / gap, z: dz / gap, yaw: Math.atan2(dx, dz), jump: false, sprint: false, sequence: ++sequence });
          h.players.step(.1, true, h.tick()); assert.ok(frame < 399, `Oracle arrival blocked at ${x}, ${z}`);
        }
        h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, sequence: ++sequence });
      };
      walk(-1.5, 34); for (let frame = 0; frame < 30 && state.oracle.arrival.phase === 'hallway'; frame++) h.players.step(.1, true, h.tick());
      assert.equal(state.oracle.arrival.phase, 'waiting'); walk(.5, 32.3); h.command('act');
      for (let frame = 0; frame < 50; frame++) h.players.step(.1, true, h.tick());
      walk(0, 23.5); walk(0, 18);
      for (let frame = 0; frame < 160 && state.oracle.arrival.phase !== 'done'; frame++) h.players.step(.1, true, h.tick());
      assert.equal(state.oracle.arrival.phase, 'done', 'the complete route enters through the door before the spoon lesson');
    }
    for (let index = 0; index < scene.steps.length; index++) {
      if (scene.id === 'm2_power' && index === 1) {
        completePrimary(h, () => ++sequence); assert.equal(state.step, 2); continue;
      }
      if (scene.id === 'm2_plan') {
        const walk = (x: number, z: number) => {
          const target = filmPosition(scene.set, x, z);
          for (let frame = 0; frame < 300; frame++) {
            const actor = h.actor(), dx = target.x - actor.position.x, dz = target.z - actor.position.z, gap = Math.hypot(dx, dz);
            if (gap < .2) break;
            h.players.receiveInput('film-player', { x: dx / Math.max(.6, gap), z: dz / Math.max(.6, gap), yaw: Math.atan2(dx, dz), jump: false, sprint: false, sequence: ++sequence });
            h.players.step(.1, true, h.tick()); assert.ok(frame < 299, `source briefing route blocked at ${x}, ${z}`);
          }
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: h.actor().rotation, jump: false, sprint: false, sequence: ++sequence });
        };
        if (index === 0) {
          for (const [i, route] of SOURCE_BRIEFING.routes.entries()) {
            if (i) { walk(i === 1 ? -5 : 5, 2); walk(route.x, 2); }
            walk(route.x, route.z); h.command('act');
            for (let frame = 0; frame < 60; frame++) h.players.step(.1, true, h.tick());
            assert.ok(state.sourceBriefing!.reviewed.includes(route.id));
          }
          walk(5, -5.8); walk(SOURCE_BRIEFING.question.x, SOURCE_BRIEFING.question.z); h.command('act');
          for (let frame = 0; frame < 125; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.sourceBriefing!.phase, 'reflection');
        } else h.command(`reflect:${filmReflections(scene.id)[0].id}`);
        assert.equal(state.step, index + 1, `${scene.id}: ${scene.steps[index].label}`); continue;
      }
      if (scene.id === 'm2_freeway' && index === 2 && state.freewayHandoff) {
        for (let frame = 0; frame < 700 && state.freewayHandoff.phase !== 'done'; frame++) {
          const handoff = state.freewayHandoff, bike = handoff.bike;
          assert.notEqual(handoff.phase, 'failed', JSON.stringify(handoff));
          if (freewayHandoffReady(handoff)) h.command('act');
          const steer = Math.max(-1, Math.min(1, (handoff.truck.x + FREEWAY_HANDOFF.side - bike.x) * .6 - bike.lateral * .2));
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, sprint: false, jump: false,
            drive: { throttle: 1, steer, brake: false }, sequence: ++sequence });
          h.players.step(.05, true, h.tick());
        }
        assert.equal(state.freewayHandoff.phase, 'done'); h.command('act'); continue;
      }

      if (scene.id === 'm2_freeway' && index === 0 && state.freewayPickup) {
        const frame = (input: Partial<import('@auto_matrix/shared').PlayerInput>, count: number) => {
          for (let i = 0; i < count; i++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: 0, jump: false, sprint: false, sequence: ++sequence, ...input });
            h.players.step(.05, true, h.tick());
          }
        };
        h.command('act'); frame({ z: 1 }, 20); frame({}, 37); frame({ jump: true }, 1); frame({}, 39);
        assert.equal(state.freewayPickup.phase, 'deck'); frame({ z: 1 }, 97);
        h.command('act'); assert.equal(state.freewayPickup.phase, 'key'); frame({}, 28); h.command('act'); frame({}, 83);
        h.players.act('film-player', 'attack', h.tick()); frame({}, 24); frame({ drive: { throttle: 1, steer: 0, brake: false } }, 1);
        frame({}, 41);
        let turning = false;
        for (let f = 0; f < 300 && state.freewayPickup.phase === 'merging'; f++) {
          const pickup = state.freewayPickup;
          if (pickup.chase?.phase === 'crossing') {
            turning ||= pickup.speed <= 20;
            frame({ drive: { throttle: turning ? 1 : 0, steer: turning ? -1 : 0, brake: !turning } }, 1);
          } else {
            const desired = Math.atan2(2.5 - pickup.x, 20);
            frame({ drive: { throttle: pickup.speed < 35 ? 1 : 0, steer: Math.max(-1, Math.min(1, (pickup.heading - desired) * 3)), brake: false } }, 1);
          }
        }
        assert.equal(state.freewayPickup.phase, 'done'); assert.equal(state.step, 1); continue;
      }
      if (scene.id === 'm1_unplugged' && state.tvExit?.crosscut) {
        if (index === 0) { assert.equal(state.step, 1); continue; }
        const frame = () => { h.players.receiveInput('film-player', { x: 0, z: 0, yaw: h.actor().rotation, jump: false, sprint: false, sequence: ++sequence }); h.players.step(.1, true, h.tick()); };
        const walk = (x: number, z: number) => {
          const target = filmPosition('film_tv_repair', x, z);
          for (let i = 0; i < 200; i++) {
            const actor = h.actor(), dx = target.x - actor.position.x, dz = target.z - actor.position.z, gap = Math.hypot(dx, dz);
            if (gap < .35) { frame(); return; }
            h.players.receiveInput('film-player', { x: dx / Math.max(.6, gap), z: dz / Math.max(.6, gap), yaw: Math.atan2(dx, dz), jump: false, sprint: false, sequence: ++sequence }); h.players.step(.1, true, h.tick());
          }
          assert.fail('Neo could not reach the actual restored hardline');
        };
        h.command('act'); for (let i = 0; i < 40 && state.betrayal!.phase !== 'window'; i++) frame();
        assert.equal(state.betrayal!.phase, 'window'); h.command('act');
        for (let i = 0; i < 60 && state.betrayal!.phase !== 'reconnect'; i++) frame();
        h.command('act'); assert.equal(h.actor().id, 'neo'); walk(-4, -17); h.command('act');
        for (let i = 0; i < 60 && !state.tvExit.crosscut.trinityOut; i++) frame();
        assert.equal(h.world.agents.get('trinity')!.isInMatrix, false); assert.equal(h.actor().isInMatrix, true);
        walk(TV_EXIT.approach.x, TV_EXIT.approach.z); h.command('act');
        for (let i = 0; i < 60 && !state.tvExit.crosscut.neoOut; i++) frame();
        assert.equal(h.actor().isInMatrix, false); assert.equal(state.step, index + 1); continue;
      }
      if (scene.id === 'm1_basement'  || scene.id === 'm1_tv_exit') {
        const frame = (input: Partial<import('@auto_matrix/shared').PlayerInput> = {}) => {
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: h.actor().rotation, jump: false, sprint: false, crouch: true, sequence: ++sequence, ...input });
          h.players.step(.1, true, h.tick());
        };
        const walk = (x: number, z: number) => {
          const target = filmPosition(scene.set, x, z);
          for (let i = 0; i < 800; i++) {
            const actor = h.actor(), dx = target.x - actor.position.x, dz = target.z - actor.position.z, gap = Math.hypot(dx, dz);
            if (gap < .35 || state.basement?.phase === 'done' && gap < .6) { frame(); return; }
            frame({ x: dx / Math.max(.6, gap), z: dz / Math.max(.6, gap), yaw: Math.atan2(dx, dz) });
            assert.ok(i < 799, `${scene.id} blocked at ${x}, ${z}: ${state.lastText}`);
          }
        };
        if (scene.id === 'm1_basement') {
          if (index === 0) { h.command('act'); for (let i = 0; i < 400 && state.basement!.phase !== 'searching'; i++) frame({ climb: 1 }); }
          else if (index === 1) { for (const [x,z] of [[-18,-25],[-18,2],[0,2],[0,24],[9,22.5]]) walk(x,z); for(let i=0;i<200&&state.step===index;i++)frame(); }
          else if (index === 2) { h.command('act'); for(let i=0;i<60&&state.step===index;i++)frame(); }
          else if (index === 3) {
            for(let i=0;i<180&&(['apoc','switch'] as const).some(role=>state.basement!.company[role]<basementRouteLength(role)-.05);i++)frame();
            h.command('act'); for(let i=0;i<450&&state.step===index;i++)frame();
          } else { walk(9,30);walk(0,30);walk(0,32.2); }
        } else {
          if (index === 0) { for(let i=0;i<800&&state.tvExit!.phase!=='ready';i++)frame({climb:1});walk(TV_EXIT.street.curb.x,TV_EXIT.street.curb.z);walk(TV_EXIT.street.door.x,TV_EXIT.street.door.z); }
          else if (index === 1) { walk(8.5,4);walk(8.5,-8);walk(TV_EXIT.approach.x,TV_EXIT.approach.z); }
          else { h.command('act');for(let i=0;i<260&&state.step===index;i++)frame(); }
        }
        assert.equal(state.step, index + 1, `${scene.id}: ${scene.steps[index].label}`); continue;
      }
      if (scene.id === 'm1_bathroom'  && state.betrayal?.fight && index === 0) {
        h.command('act');
        for (let frame = 0; frame < 400 && state.step === index; frame++) {
          const fight = state.betrayal.fight;
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: 0, crouch: fight.phase === 'pinning', jump: false, sprint: false, sequence: ++sequence });
          if (fight.phase === 'breakout' && fight.elapsed >= .7 && !fight.headbutt) h.players.act('film-player', 'attack', h.tick());
          if (fight.phase === 'windup' && fight.elapsed >= .6 && !fight.evaded) h.players.act('film-player', 'dodge', h.tick());
          if (fight.phase === 'opening' && fight.evaded) h.players.act('film-player', 'attack', h.tick());
          h.players.step(.1, true, h.tick());
        }
        assert.equal(state.betrayal.fight.counters, 4); assert.equal(state.step, index + 1); continue;
      }
      if (scene.id === 'm1_wall_exposed') {
        const frame = () => {
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: 0, pitch: 0, jump: false, sprint: false, sequence: ++sequence });
          h.players.step(.1, true, h.tick());
        };
        if (index === 0) {
          h.command('act'); for (let i = 0; i < 80 && state.wallExposure!.phase !== 'firing'; i++) frame();
          assert.equal(state.wallExposure!.phase, 'firing');
        } else if (index === 1) { frame(); h.players.act('film-player', 'shoot', h.tick()); }
        else { for (let i = 0; i < 120 && state.wallExposure!.phase !== 'done'; i++) frame(); assert.equal(state.wallExposure!.phase, 'done'); }
        assert.equal(state.step, index + 1); continue;
      }
      if (scene.id === 'm1_wetwall') {
        const frame = (climb = 0) => {
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, climb, jump: false, sprint: false, sequence: ++sequence });
          h.players.step(.1, true, h.tick());
        };
        if (index === 0) {
          const target = filmPosition(scene.set, -18, -28.4);
          for (let frame = 0; frame < 80; frame++) {
            const actor = h.actor(), dx = target.x - actor.position.x, dz = target.z - actor.position.z, gap = Math.hypot(dx, dz);
            if (gap < .3) break;
            h.players.receiveInput('film-player', { x: dx / gap, z: dz / gap, yaw: Math.atan2(dx, dz), jump: false, sprint: false, sequence: ++sequence });
            h.players.step(.05, true, h.tick()); assert.ok(frame < 79, 'the complete route must walk to the entry plaster');
          }
          frame(); h.command('act');
          for (let i = 0; i < 650 && state.wetwall!.phase !== 'climbing'; i++) frame();
          assert.equal(state.wetwall!.phase, 'climbing');
        } else if (index === 1) {
          for (let i = 0; i < 600 && state.wetwall!.phase !== 'jammed'; i++) frame(1);
          assert.equal(state.wetwall!.phase, 'jammed');
        } else if (index === 2) {
          h.command('act'); for (let i = 0; i < 80 && !state.wetwall!.freed; i++) frame(); assert.equal(state.wetwall!.freed, true);
        } else {
          for (let i = 0; i < 500 && state.wetwall!.phase !== 'done'; i++) frame(1);
          assert.equal(state.wetwall!.phase, 'done');
        }
        assert.equal(state.step, index + 1); continue;
      }
      if (scene.id === 'm1_dejavu' && index > 0 && state.ambushEscape) {
        const walk = (x: number, y: number, z: number) => {
          const target = filmPosition(scene.set, x, z); target.y += y;
          for (let frame = 0; frame < 650; frame++) {
            const actor = h.actor(), dx = target.x - actor.position.x, dz = target.z - actor.position.z, gap = Math.hypot(dx, dz);
            if (gap < .3 && Math.abs(actor.position.y - target.y) < .15) break;
            h.players.receiveInput('film-player', { x: dx / Math.max(.01, gap), z: dz / Math.max(.01, gap), yaw: Math.atan2(dx, dz), jump: false, sprint: true, sequence: ++sequence });
            h.players.step(.1, true, h.tick()); assert.ok(frame < 649, `ambush descent blocked at ${x}, ${y}, ${z}: ${state.lastText}`);
          }
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, sequence: ++sequence }); h.players.step(.1, true, h.tick());
        };
        if (index === 1) {
          for (let frame = 0; frame < 65 && state.ambushEscape.phase === 'alarm'; frame++) h.players.step(.1, true, h.tick());
          for (let floor = 0; floor < 5; floor++) {
            const y = -floor * AMBUSH_STAIRS.rise;
            for (const [x, height, z] of [[5.5, y, 31.8], [5.5, y - 3.7, 14.5], [-5.5, y - 3.7, 14.5], [-5.5, y - 7.4, 31.8]]) walk(x, height, z);
          }
          for (const [x, z] of [[-11, 31.8], [-11, 8], [0, 8], [0, -16], [-18, -16]]) walk(x, -37, z);
          for (let frame = 0; frame < 180 && state.ambushEscape.phase === 'descending'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.ambushEscape.phase, 'window'); h.command('act');
          walk(-18, -37, -13.2); walk(-5.4, -37, -13.2); h.command('act');
          for (let frame = 0; frame < 56; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.step, 2); assert.equal(state.ambushEscape.phase, 'forming');
          for (let frame = 0; frame < 180 && state.ambushEscape.phase === 'forming'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.ambushEscape.phase, 'wetwall');
        } else {
          for (const [x, z] of [[-18, -13.2], [-18, -27]]) walk(x, -37, z);
          for (let frame = 0; frame < 180 && state.ambushEscape.phase !== 'done'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.ambushEscape.phase, 'done'); assert.equal(state.step, scene.steps.length);
        }
        continue;
      }
      if (scene.id === 'm1_dejavu' && index === 0 && state.ambushApproach) {
        const companyRoute = [[-5.5, 30.8], [-5.5, 14.5], [5.5, 14.5], [5.5, 31.8], [11, 31.8]];
        if (!state.ambushApproach.stairCat) companyRoute.push([11, 8], [0, 8], [0, -8]);
        for (const [x, z] of companyRoute) {
          const target = filmPosition(scene.set, x, z);
          for (let frame = 0; frame < 600; frame++) {
            const actor = h.actor(), dx = target.x - actor.position.x, dz = target.z - actor.position.z, gap = Math.hypot(dx, dz);
            if (gap < .3) break;
            h.players.receiveInput('film-player', { x: dx / Math.max(1, gap), z: dz / Math.max(1, gap), yaw: Math.atan2(dx, dz), jump: false, sprint: false, sequence: ++sequence });
            h.players.step(.1, true, h.tick()); assert.ok(frame < 599, `company route blocked at ${x}, ${z}`);
          }
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, sequence: ++sequence });
          h.players.step(.1, true, h.tick());
        }
        for (let frame = 0; frame < 400 && !state.ambushApproach.ready; frame++) h.players.step(.1, true, h.tick());
        assert.equal(state.ambushApproach.ready, true, 'the full trilogy route waits for the same five physical companions');
      }
      const step = scene.steps[index]; const actor = h.actor();
      if ((scene.id !== 'm1_dejavu' || index !== 0 || !state.ambushApproach?.stairCat) && !(scene.id === 'm2_ship_lost' && index === 3)
        && !(scene.id === 'm3_hel_bargain' && index === 4) && !(scene.id === 'm3_hel_entry' && index === 4)) actor.position = filmStepPosition(scene, step, state);
      if (scene.id === 'm3_rain') {
        if (index === 0) h.advance();
        else if (index === 1) {
          for (let frame = 0; frame < 140 && state.smithFinale?.phase !== 'reply'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.smithFinale?.phase, 'reply'); h.command('act');
          for (let frame = 0; frame < 70 && state.smithFinale?.phase !== 'charge_ready'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.smithFinale?.phase, 'charge_ready');
          h.command('act');
          for (let frame = 0; frame < 40 && state.smithFinale?.phase !== 'ground_dodge'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.smithFinale?.phase, 'ground_dodge'); h.players.act('film-player', 'dodge', h.tick());
          h.players.act('film-player', 'attack', h.tick());
          for (let frame = 0; frame < 4; frame++) h.players.step(.1, true, h.tick());
          h.players.act('film-player', 'attack', h.tick());
          for (let frame = 0; frame < 30 && state.smithFinale?.phase !== 'air_dodge'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.smithFinale?.phase, 'air_dodge'); h.players.act('film-player', 'dodge', h.tick()); h.players.act('film-player', 'attack', h.tick());
          for (let frame = 0; frame < 45 && state.smithFinale?.phase !== 'interior_dodge'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.smithFinale?.phase, 'interior_dodge'); h.players.act('film-player', 'dodge', h.tick()); h.players.act('film-player', 'attack', h.tick());
          for (let frame = 0; frame < 80 && state.smithFinale?.phase !== 'sky_dodge'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.smithFinale?.phase, 'sky_dodge'); h.players.act('film-player', 'dodge', h.tick()); h.players.act('film-player', 'attack', h.tick());
          for (let frame = 0; frame < 20 && state.smithFinale?.phase !== 'descent'; frame++) h.players.step(.1, true, h.tick());
          for (let frame = 0; frame < 70 && state.step === index; frame++) {
            h.players.receiveInput('film-player', { x: .25, z: 0, yaw: Math.PI, jump: false, sprint: false, focus: true, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, focus: false, sequence: ++sequence });
        } else h.command('reflect:agency');
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm3_surrender') {
        if (index === 0) {
          h.command('act');
          for (let frame = 0; frame < 15 && state.smithFinale?.phase !== 'pit_dodge'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.smithFinale?.phase, 'pit_dodge'); h.players.act('film-player', 'dodge', h.tick());
          for (let frame = 0; frame < 10 && state.smithFinale?.phase !== 'pit_counter'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.smithFinale?.phase, 'pit_counter'); h.players.act('film-player', 'attack', h.tick());
          for (let frame = 0; frame < 65 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        } else if (index === 1) h.command('reflect:agency');
        else {
          for (let frame = 0; frame < 25 && state.smithFinale?.phase === 'pit_recovery'; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, focus: true, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
          assert.equal(state.smithFinale?.phase, 'understanding');
          h.command('act');
          for (let frame = 0; frame < Math.ceil((SMITH_FINALE.surrender.consentSeconds + SMITH_FINALE.surrender.assimilationSeconds + SMITH_FINALE.surrender.purgeSeconds) / .1) + 4 && state.step === index; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, focus: true, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, focus: false, sequence: ++sequence });
        }
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm3_deus') {
        const seconds = DEUS_PACT.seconds;
        if (index === 0) h.advance();
        else if (index === 1) {
          h.command('act');
          for (let frame = 0; frame < Math.ceil((DEUS_PACT.resolveSeconds + seconds.forming + seconds.warning + seconds.challenge + seconds.question) / .1) + 3 && state.step === index; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false,
              focus: true, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
        } else if (index === 2) h.command(`reflect:${filmReflections(scene.id)[0].id}`);
        else {
          h.command('act');
          for (let frame = 0; frame < Math.ceil((seconds.seating + seconds.cabling + seconds.assurance + DEUS_PACT.consentSeconds + seconds.connecting) / .1) + 3 && state.step === index; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false,
              focus: true, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false,
            focus: false, sequence: ++sequence });
        }
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (['m3_ceasefire', 'm3_neo_carried', 'm3_reset', 'm3_dawn'].includes(scene.id)) {
        if (step.kind === 'reach') h.advance();
        else if (step.kind === 'reflect') h.command(`reflect:${filmReflections(scene.id)[0].id}`);
        else {
          if (scene.id === 'm3_dawn' && state.epilogue?.phase === 'leaving')
            for (let frame = 0; frame < 50; frame++) h.players.step(.1, true, h.tick());
          h.command('act');
          for (let frame = 0; frame < 320 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        }
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm1_room303') {
        if (index === 0) { h.command('act'); h.advance(4); assert.equal(state.openingHotel?.phase, 'combat'); }
        else if (index === 1) {
          for (const target of [...h.sandbox.state.threats.filter(threat => threat.scene === scene.id)]) {
            for (let hit = 0; target.health > 0 && hit < 6; hit++) {
              actor.position = { ...target.position, z: target.position.z + 2 }; actor.rotation = Math.PI;
              h.sandbox.attack(actor, h.tick(), hit % 3);
            }
            assert.equal(target.health, 0);
          }
          actor.position = { ...state.openingHotel!.fallen! }; h.command('act'); h.advance();
          assert.equal(state.openingHotel?.disarmed, true);
        } else if (index === 2 || index === 4) { h.command('act'); if (index === 4) h.advance(4); }
        else if (index === 5) {
          h.command('act');
          for (let frame = 0; frame < 50 && state.openingHotel?.phase === 'climbing'; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: 0, jump: false, sprint: false, climb: 1, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
        }
        else h.advance();
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm3_mobil_release') {
        if (index === 0) portalFrames(h, 90);
        else {
          h.command('act'); assert.equal(state.mobil?.reunion?.phase, 'embracing');
          portalFrames(h, 65); assert.equal(state.mobil?.reunion?.phase, 'together');
          assert.equal(state.step, index, 'the reunion does not leave the station without Neo accepting');
          h.command('act');
        }
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm3_trainman') {
        if (index === 0) { portalFrames(h, 55); h.command('act'); portalFrames(h, 20); }
        else if (index === 1) h.advance(10);
        else if (index === 2) {
          h.command('act'); for (let frame = 0; frame < 160 && state.mobil?.phase === 'refusing'; frame++) h.players.step(.1, true, h.tick()); portalFrames(h, 35);
        } else h.advance();
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm2_relay') {
        actor.position = filmStepPosition(scene, step, state); h.command('act');
        for (let frame = 0; frame < (index === 0 ? 75 : 170); frame++) h.players.step(.1, true, h.tick());
        if (index === 0) h.command('act');
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm2_blackout') {
        // Wait for Ghost to walk onto the bridge, then acknowledge the saved midnight clock.
        for (let frame = 0; frame < 30; frame++) h.players.step(.1, true, h.tick());
        h.command('act');
        for (let frame = 0; frame < 150 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`);
        assert.equal(state.grid?.primary, 'off'); assert.equal(state.grid?.emergency, 'online'); continue;
      }
      if (scene.id === 'm2_backup' && index === 1) { completeTerminal(h, () => ++sequence); assert.equal(state.step, index + 1); continue; }
      if (scene.id === 'm2_key_door' && index === 3) for (let count = 0; state.grid?.phase !== 'window' && count < 30; count++) h.advance();
      if (scene.id === 'm2_key_door' && index >= 3) { completePortalStep(h, index); assert.equal(state.step, index + 1); continue; }
      if (scene.id === 'm2_architect' && index === 5) { completeArchitectDoor(h); assert.equal(state.step, index + 1); continue; }
      if (scene.id === 'm2_dream') {
        if (index === 0) h.players.step(.1, true, h.tick());
        else { h.command('act'); for (let frame = 0; frame < 110 && state.step === index; frame++) h.players.step(.1, true, h.tick()); }
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm2_catch') {
        if (index === 0) startCatch(h, () => ++sequence);
        else if (index === 1) {
          for (let frame = 0; frame < 54; frame++) {
            h.players.receiveInput('film-player', { x: frame < 10 ? -1 : frame >= 42 && frame < 46 ? 1 : 0, z: frame >= 10 && frame < 42 ? -1 : 0, yaw: Math.PI, jump: false, sprint: false, focus: false, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
          h.command('act');
        } else if (index === 2) {
          for (let frame = 0; frame < 54; frame++) h.players.step(.1, true, h.tick());
          h.command('act');
          for (let frame = 0; frame < 26 && state.step === 2; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, focus: true, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
        } else {
          for (let beat = 0; beat < 3; beat++) {
            for (let frame = 0; frame < 11; frame++) h.players.step(.1, true, h.tick());
            h.players.act('film-player', 'attack', h.tick());
          }
          for (let frame = 0; frame < 34; frame++) h.players.step(.1, true, h.tick());
        }
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm2_ship_lost' && index === 3) { completeNebExit(h, () => ++sequence); assert.equal(state.step, index + 1); continue; }
      if (scene.id === 'm2_stop_sentinels' && index === 1) {
        h.command('act');
        for (let frame = 0; frame < 85 && state.step === index; frame++) {
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: 0, jump: false, sprint: false, focus: true, sequence: ++sequence });
          h.players.step(.1, true, h.tick());
        }
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm2_meeting') {
        const frames = (seconds: number) => { for (let frame = 0; frame < Math.ceil(seconds * 10); frame++) h.players.step(.1, true, h.tick()); };
        if (index === 0) { frames(RELOADED.wake + .2); h.command('act'); frames(RELOADED.conversation + .2); h.command('act'); frames(RELOADED.connect + .2); }
        else if (index === 1) { h.command('act'); frames(RELOADED.report + .2); }
        else if (index === 2) { h.command('act'); frames(RELOADED.earpiece + .2); }
        else if (index === 3) {
          h.command('exit:west'); frames(RELOADED.breach + .2);
          for (let hit = 0; hit < 6; hit++) {
            const enemy = h.world.agents.get(RELOADED.agents[state.reloaded!.opponent])!;
            actor.position = { ...enemy.position, z: enemy.position.z + 2.2 }; actor.rotation = Math.PI;
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, sequence: ++sequence });
            for (let frame = 0; frame < 50 && state.reloaded!.cycle < RELOADED.strike - .3; frame++) frames(.1);
            h.players.act('film-player', 'dodge', h.tick()); frames(.4);
            h.players.act('film-player', 'attack', h.tick()); frames(.3);
            if (hit < 5) { const round = state.reloaded!.round; for (let frame = 0; frame < 40 && state.reloaded!.round === round; frame++) frames(.1); }
          }
          assert.equal(state.reloaded!.phase, 'departure_ready');
        } else { frames(1); h.command('act'); frames(RELOADED.departure + .2); }
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm1_death') {
        if (index === 0) h.players.step(.1, true, h.tick());
        else {
          h.command('act');
          for (let frame = 0; frame < 65 && state.theOne?.phase !== 'listening'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.theOne?.phase, 'listening');
          for (let frame = 0; frame < 40 && state.theOne?.phase === 'listening'; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: actor.rotation, jump: false, sprint: false, focus: true, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
          for (let frame = 0; frame < 70 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        }
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm1_return') {
        if (index === 0) {
          h.command('act');
          for (let frame = 0; frame < 30 && state.theOne?.phase !== 'bullet_window'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.theOne?.phase, 'bullet_window');
          while (state.theOne!.elapsed < THE_ONE.return.bulletBeat) h.players.step(.1, true, h.tick());
          h.players.act('film-player', 'dodge', h.tick());
          for (let frame = 0; frame < 35 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        } else if (index === 1) {
          const target = h.sandbox.state.threats.find(threat => threat.scene === scene.id && threat.character === 'smith')!;
          assert.ok(target); target.attackAt = h.tick() + 2; target.stunUntil = 0; h.players.act('film-player', 'dodge', h.tick());
          for (let hit = 0; hit < THE_ONE.return.requiredHits; hit++) {
            target.position = { ...actor.position, z: actor.position.z - 2.1 }; actor.rotation = Math.PI;
            h.sandbox.attack(actor, h.tick() + hit + 1, hit % 3);
          }
          for (let frame = 0; frame < 55 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        } else {
          h.players.step(.1, true, h.tick()); assert.equal(state.theOne?.phase, 'exit_ready'); h.command('act');
          for (let frame = 0; frame < 50 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        }
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm1_final_call') {
        if (index === 0) { h.command('reflect:agency'); h.players.step(.1, true, h.tick()); }
        else {
          h.command('act');
          for (let frame = 0; frame < 60 && state.theOne?.phase !== 'takeoff_ready'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.theOne?.phase, 'takeoff_ready');
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: actor.rotation, jump: true, sprint: false, focus: false, sequence: ++sequence });
          h.players.step(.1, true, h.tick());
          for (let frame = 0; frame < 80 && state.step === index; frame++) {
            h.players.receiveInput('film-player', { x: .35, z: -.5, yaw: actor.rotation, jump: false, sprint: true, focus: false, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
        }
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm1_subway') {
        if (index === 0) {
          h.command('act');
          for (let frame = 0; frame < 45 && state.matrixEscape?.phase !== 'duel'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.matrixEscape?.phase, 'duel');
          const target = h.sandbox.state.threats.find(threat => threat.scene === scene.id)!;
          target.attackAt = h.tick() + 2; target.stunUntil = 0; h.players.act('film-player', 'dodge', h.tick());
          for (let hit = 0; hit < MATRIX_ESCAPE.subway.requiredHits; hit++) {
            target.position = { ...actor.position, z: actor.position.z - 2.2 }; actor.rotation = Math.PI;
            h.sandbox.attack(actor, h.tick() + hit + 1, hit % 3);
          }
          for (let frame = 0; frame < 35 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        } else {
          for (let frame = 0; frame < 25 && state.matrixEscape?.phase !== 'train_window'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.matrixEscape?.phase, 'train_window');
          while (state.matrixEscape!.elapsed < MATRIX_ESCAPE.subway.trainBeat) h.players.step(.1, true, h.tick());
          h.players.act('film-player', 'dodge', h.tick());
          for (let frame = 0; frame < 65 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        }
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm1_city_chase') {
        const frame = () => {
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: actor.rotation, jump: false, sprint: true, sequence: ++sequence });
          h.players.step(.1, true, h.tick());
        };
        if (index === 0) {
          h.command('act'); for (let count = 0; count < 28 && state.matrixEscape?.phase !== 'running'; count++) frame();
          actor.position = filmStepPosition(scene, step); frame();
          for (let count = 0; count < 32 && state.step === index; count++) frame();
        } else if (index === 1) {
          frame(); for (let count = 0; count < 20 && state.matrixEscape?.phase !== 'truck_window'; count++) frame();
          assert.equal(state.matrixEscape?.phase, 'truck_window');
          while (state.matrixEscape!.elapsed < MATRIX_ESCAPE.city.truckBeat) frame();
          h.players.act('film-player', 'dodge', h.tick());
          for (let count = 0; count < 30 && state.step === index; count++) frame();
        } else {
          frame(); assert.equal(state.matrixEscape?.phase, 'door_ready'); h.command('act');
          for (let count = 0; count < 28 && state.step === index; count++) frame();
        }
        assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
      }
      if (scene.id === 'm2_library' && index === 4) {
        for (const [x, z] of [[-8, -17], [-8, -10], [-5, -3], [0, 4], [0, 11], [0, 18], [0, 23]]) {
          actor.position = filmPosition(scene.set, x, z);
          for (let frame = 0; frame < 27; frame++) h.players.step(.1, true, h.tick());
        }
        h.advance();
      }
      else if (scene.id === 'm1_cabin' && index === 1) {
        for (let frame = 0; frame < 250 && state.cabinEscort!.progress < CABIN_ROUTE_LENGTH; frame++) {
          const guide = cabinGuidePose(state.cabinEscort!.progress);
          actor.position = filmPosition(scene.set, guide.x, guide.z); h.players.step(.1, true, h.tick());
        }
        actor.position = filmStepPosition(scene, step); h.players.step(.1, true, h.tick());
      }
      else if (scene.id === 'm1_spoon' && index === 1) {
        for (let frame = 0; frame < 300 && state.oracle?.reception?.phase !== 'ready'; frame++) {
          const guide = h.world.agents.get('oracle_priestess')!;
          actor.position = { ...guide.position, z: guide.position.z + 2 }; h.players.step(.1, true, h.tick());
        }
        actor.position = filmStepPosition(scene, step); h.players.step(.1, true, h.tick());
      }
      else if (scene.id === 'm1_oracle' && index === 2) {
        actor.position = filmPosition(scene.set, -4.6, -10.2); h.command('act');
        for (let frame = 0; frame < 300 && state.oracle?.departure?.phase !== 'ready'; frame++) {
          const guide = h.world.agents.get('oracle_priestess')!;
          actor.position = { ...guide.position, z: guide.position.z - .5 }; h.players.step(.1, true, h.tick());
        }
        actor.position = filmPosition(scene.set, -6.8, 10.8); h.command('act');
        for (let frame = 0; frame < 70; frame++) h.players.step(.1, true, h.tick());
        h.command('act'); for (let frame = 0; frame < 30; frame++) h.players.step(.1, true, h.tick());
        actor.position = filmPosition(scene.set, 0, 27); h.command('act');
      }
      else if (scene.id === 'm3_emp' && index === 0) {
        h.command('act');
        for (let frame = 0; frame < 70 && state.step === index; frame++) {
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, focus: true, sprint: false, jump: false, sequence: ++sequence });
          h.players.step(.1, true, h.tick());
        }
      }
      else if (scene.id === 'm3_dock_reunion' && index === 0) {
        h.command('act');
        for (let frame = 0; frame < 205 && state.step === index; frame++) {
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: 0, focus: true, sprint: false, jump: false, sequence: ++sequence });
          h.players.step(.1, true, h.tick());
        }
      }
      else if (scene.id === 'm3_dock_reunion' && index === 2) {
        h.command('act');
        for (let frame = 0; frame < 112; frame++) h.players.step(.1, true, h.tick());
        assert.equal(state.dockReunion?.phase, 'promise'); h.command('act');
        for (let frame = 0; frame < 85 && state.step === index; frame++) h.players.step(.1, true, h.tick());
      }
      else if (scene.id === 'm3_dock_briefing') {
        if (index === 0) {
          h.command('act');
          for (let frame = 0; frame < 65 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        } else if (index === 1) {
          for (let frame = 0; frame < 60 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        } else if (index === 2) {
          h.command('act');
          for (let frame = 0; frame < 50; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.dockBriefing?.phase, 'reply'); h.command('act');
          for (let frame = 0; frame < 135 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        } else if (step.kind === 'reflect') h.command('reflect:care');
        else h.players.step(.1, true, h.tick());
      }
      else if (scene.id === 'm3_dock_evacuation') {
        if (index === 0 || index === 1) {
          h.command('act');
          for (let frame = 0; frame < 20 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        } else if (index === 2) {
          for (let frame = 0; frame < 75 && state.dockEvacuation?.phase !== 'running'; frame++) h.players.step(.1, true, h.tick());
          actor.position = filmStepPosition(scene, step, state); h.players.step(.1, true, h.tick());
          assert.equal(state.dockEvacuation?.phase, 'waiting');
        } else {
          for (let frame = 0; frame < 115; frame++) h.players.step(.1, true, h.tick());
          h.command('act');
          for (let frame = 0; frame < 75 && state.step === index; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.dockEvacuation?.phase, 'clear');
        }
      }
      else if (scene.id === 'm3_shaft_seal') {
        if (index === 0) h.players.step(.1, true, h.tick());
        else if (index === 1) {
          h.command('act');
          for (let frame = 0; frame < 110 && state.step === index; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, focus: true, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
          assert.equal(state.shaftSeal?.phase, 'done');
        } else h.command('reflect:care');
      }
      else if (scene.id === 'm3_temple_defense' || scene.id === 'm3_temple_breach') {
        if (step.kind === 'interact') h.command('act');
        const limit = scene.id === 'm3_temple_breach' ? 200 : 45;
        for (let frame = 0; frame < limit && state.step === index; frame++) {
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false,
            focus: scene.id === 'm3_temple_defense' && step.kind === 'interact', sequence: ++sequence });
          h.players.step(.1, true, h.tick());
        }
      }
      else if (step.kind === 'reach' && scene.id === 'm3_oracle_request') {
        actor.position = filmPosition(scene.set, 0, 23);
        for (let frame = 0; frame < 240 && state.step === index; frame++) {
          h.players.receiveInput('film-player', { x: 0, z: actor.position.z < FILM_SETS[scene.set].center.z + 31.8 ? 1 : 0,
            yaw: 0, jump: false, sprint: false, sequence: ++sequence });
          h.players.step(.1, true, h.tick());
        }
      }
      else if (scene.id === 'm3_hel_entry' && index === 4) {
        const target = filmStepPosition(scene, step, state);
        for (let frame = 0; frame < 300; frame++) {
          const dx = target.x - actor.position.x, dz = target.z - actor.position.z, gap = Math.hypot(dx, dz);
          if (gap < .3) break;
          h.players.receiveInput('film-player', { x: dx / Math.max(1, gap), z: dz / Math.max(1, gap), yaw: Math.atan2(dx, dz), jump: false, sprint: false, sequence: ++sequence });
          h.players.step(.1, true, h.tick());
          if (frame % 5 === 4) h.advance();
          assert.ok(frame < 299, 'the trio must walk through the club to the VIP stairs');
        }
        h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, sequence: ++sequence });
        h.players.step(.1, true, h.tick()); h.advance(8);
      }
      else if (step.kind === 'reach') h.advance();
      else if (step.kind === 'reflect') {
        if (scene.id === 'm3_family') hearMobilFamily(h);
        if (scene.id === 'm3_emp') {
          for (let frame = 0; frame < 125; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.emp?.elapsed, 9, 'the EMP must finish through the player frame loop before reflection');
          assert.equal(state.empOperator?.phase, 'done', 'Link must leave the chair before walking to reflect');
          actor.position = filmStepPosition(scene, step);
        }
        if (scene.id === 'm1_oracle') {
          h.command('act');
          for (let frame = 0; frame < 110; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.oracle?.consultation?.phase, 'question'); h.command('reflect:agency');
          for (let frame = 0; frame < 50; frame++) h.players.step(.1, true, h.tick());
        } else h.command(scene.id === 'm1_wake_up' ? 'contact:follow' : scene.id === 'm1_ledge' ? 'escape:retreat' : scene.id === 'm1_pills' ? 'pill:red'
          : ['m3_oracle_request', 'm3_hel_bargain'].includes(scene.id) ? `reflect:${filmReflections(scene.id)[0].id}` : 'reflect:agency');
        if (scene.id === 'm1_smith_question') for (let frame = 0; frame < 130 && state.step === index; frame++) {
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: h.actor().rotation, jump: false, sprint: false, focus: true, sequence: ++sequence });
          h.players.step(.1, true, h.tick());
        }
        if (scene.id === 'm1_pills') for (let frame = 0; frame < Math.ceil(PILL_TIMING.take / .1) + 1; frame++) h.players.step(.1, true, h.tick());
        if (scene.id === 'm1_club') for (let frame = 0; frame < 61; frame++) h.players.step(.1, true, h.tick());
        if (scene.id === 'm1_cypher_console') for (let frame = 0; frame < 48; frame++) h.players.step(.1, true, h.tick());
      }
      else if (step.kind === 'interact') {
        if (scene.id === 'm3_oracle_request') {
          h.command('act');
          for (let frame = 0; frame < 200 && state.step === index; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.step, index + 1); continue;
        }
        if (scene.id === 'm3_dock_battle' && index === 2) {
          h.command('act');
          for (let frame = 0; frame < 53; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.dockLastStand?.phase, 'wounded');
          h.actor().position = filmPosition(scene.set, DOCK_LAST_STAND.kid.x, DOCK_LAST_STAND.kid.z); h.command('act');
          for (let frame = 0; frame < 68; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.dockLastStand?.phase, 'response'); h.command('act');
          for (let frame = 0; frame < 73; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.dockLastStand?.phase, 'done'); assert.equal(state.step, index + 1); continue;
        }
        if (scene.id === 'm3_dock_battle' && index === 1) {
          h.command('act'); assert.equal(h.actor().id, 'kid');
          h.actor().position = filmPosition(scene.set, DOCK_RELOAD.entry.x, DOCK_RELOAD.entry.z); h.command('act');
          for (let frame = 0; frame < 350 && state.step === index; frame++) {
            const phase = state.dockReload!.phase;
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false,
              focus: phase === 'hoisting' || phase === 'jammed', climb: phase === 'climbing' ? 1 : phase === 'descending' ? -1 : 0, sequence: ++sequence });
            h.players.step(.05, true, h.tick());
            if (phase === 'jammed' && state.dockReload!.brace >= DOCK_RELOAD.braceSeconds) h.players.act('film-player', 'attack', h.tick());
          }
          assert.equal(state.dockReload?.phase, 'done'); assert.equal(state.step, index + 1); continue;
        }
        if (scene.id === 'm3_upper_digger') {
          actor.position = filmPosition(scene.set, -43, 28); h.command('act');
          for (let frame = 0; frame < 2000 && state.upperDigger?.phase !== 'done'; frame++) {
            const phase = state.upperDigger!.phase;
            if (phase === 'ready' || phase === 'hatch') h.command('act');
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: actor.rotation, jump: false, sprint: false,
              climb: 1, crouch: true, focus: true, sequence: ++sequence });
            h.players.step(.05, true, h.tick());
          }
          assert.equal(state.upperDigger?.phase, 'done'); assert.equal(state.step, index + 1);
          assert.equal(h.world.agents.get('charra')!.status, 'dead'); continue;
        }
        if (scene.id === 'm3_diggers') {
          for (const station of DIGGERS.stations) {
            actor.position = filmPosition(scene.set, station.x, station.z); h.command('act');
            for (let frame = 0; frame < 300; frame++) {
              const drill = state.diggers!, eye = diggerEye(drill), target = DIGGERS.knees[drill.station];
              const dx = target.x - eye.x, dz = target.z - eye.z;
              h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.atan2(dx, dz), pitch: -Math.atan2(target.y - eye.y, Math.hypot(dx, dz)),
                jump: false, sprint: false, focus: true, sequence: ++sequence });
              h.players.step(.05, true, h.tick());
              if (drill.phase === 'aiming' && Math.abs(diggerShield(drill).offset) > 5) h.players.act('film-player', 'shoot', h.tick());
              if (drill.phase === 'relocate' || drill.phase === 'done') break;
            }
          }
          assert.equal(state.diggers?.phase, 'done'); assert.equal(state.step, index + 1); continue;
        }
        if (scene.id === 'm3_farewell' && index === 1) {
          h.command('act');
          for (let frame = 0; frame < 500 && state.farewell?.phase !== 'still'; frame++) h.players.step(.05, true, h.tick());
          assert.equal(state.farewell?.phase, 'still');
          assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
        }
        if (scene.id === 'm3_bane' && index === 1) {
          const until = (predicate: () => boolean, focus = false) => {
            for (let frame = 0; frame < 400 && !predicate(); frame++) {
              h.players.receiveInput('film-player', { x: 0, z: 0, yaw: actor.rotation, jump: false, sprint: false, focus, sequence: ++sequence });
              h.players.step(.1, true, h.tick());
            }
            assert.ok(predicate(), `Logos stage ${state.bane?.phase}/${state.bane?.physical?.intro}`);
          };
          h.command('act');
          until(() => state.bane?.physical?.intro === 'lower_ready'); h.command('act');
          until(() => state.bane?.physical?.intro === 'recognition_ready'); h.command('act');
          until(() => state.bane?.phase === 'gun_window'); h.players.act('film-player', 'dodge', h.tick());
          until(() => state.bane?.phase === 'grapple');
          const grapplingBane = h.world.agents.get('bane')!;
          actor.position = { ...grapplingBane.position, x: grapplingBane.position.x - 2 };
          actor.rotation = Math.atan2(grapplingBane.position.x - actor.position.x, grapplingBane.position.z - actor.position.z);
          h.players.act('film-player', 'attack', h.tick());
          until(() => !state.bane?.physical?.strike);
          h.players.act('film-player', 'attack', h.tick());
          until(() => state.bane?.phase === 'blind');
          until(() => state.bane?.phase === 'pipe_window', true); h.players.act('film-player', 'dodge', h.tick());
          until(() => state.bane?.phase === 'counter');
          const bane = h.world.agents.get('bane')!;
          actor.position = { ...bane.position, x: bane.position.x - 2 };
          actor.rotation = Math.atan2(bane.position.x - actor.position.x, bane.position.z - actor.position.z);
          h.players.act('film-player', 'attack', h.tick());
          until(() => !state.bane?.physical?.strike);
          actor.rotation = Math.atan2(bane.position.x - actor.position.x, bane.position.z - actor.position.z);
          h.players.act('film-player', 'attack', h.tick());
          until(() => state.step === 2 && !state.bane?.physical?.strike);
          assert.equal(state.step, 2); continue;
        }
        if (scene.id === 'm3_bane' && index === 2) {
          h.command('act');
          for (let frame = 0; frame < 200 && state.bane?.physical?.rescue !== 'done'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.bane?.physical?.rescue, 'done'); assert.equal(state.step, 3); continue;
        }
        if (scene.id === 'm2_mountain' && index === 2) {
          h.players.receiveInput('film-player', { x: 0, z: -1, yaw: Math.PI, jump: true, sprint: true, sequence: ++sequence });
          h.players.step(.1, true, h.tick());
          h.players.receiveInput('film-player', { x: 0, z: -1, yaw: Math.PI, jump: false, sprint: true, sequence: ++sequence });
          for (let frame = 0; frame < 180 && state.step === index; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: -1, yaw: Math.PI, jump: false, sprint: true, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
          assert.equal(state.step, index + 1); continue;
        }
        if (scene.id === 'm2_persephone' && index === 2) {
          h.command('persephone:memory');
          for (let frame = 0; frame < 30; frame++) h.players.step(.1, true, h.tick());
          h.command('persephone:memory');
          for (let frame = 0; frame < 30; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.step, 3); continue;
        }
        if (scene.id === 'm1_bridge') for (let frame = 0; frame < 80 && state.bridgeArrival?.phase === 'approaching'; frame++) h.players.step(.1, true, h.tick());
        h.command('act');
        if (scene.id === 'm2_burly') {
          for (let frame = 0; frame < 28 && state.scene === scene.id; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.scene, 'm2_merovingian', `${scene.id}: ${step.label}`); continue;
        }
        if (scene.id === 'm1_wake_up') {
          for (let frame = 0; frame < 125; frame++) h.players.step(.1, true, h.tick());
          if (index === 0) { h.command('act'); for (let frame = 0; frame < 41; frame++) h.players.step(.1, true, h.tick()); }
        }
        else if (scene.id === 'm1_club') {
          for (let frame = 0; frame < 81; frame++) h.players.step(.1, true, h.tick());
          h.command('act'); for (let frame = 0; frame < 61; frame++) h.players.step(.1, true, h.tick());
          h.command('act'); for (let frame = 0; frame < 141; frame++) h.players.step(.1, true, h.tick());
        }
        else if (scene.id === 'm1_pills') for (let frame = 0; frame < 51; frame++) h.players.step(.1, true, h.tick());
        else if (scene.id === 'm3_hel_entry' && index === 0) {
          h.advance(Math.ceil(HEL_ELEVATOR.seconds * 2));
          assert.equal(state.helElevator?.phase, 'arrived');
          actor.position = filmStepPosition(scene, step, state); h.command('act'); h.advance(Math.ceil(HEL_ELEVATOR.opening * 2));
        }
        else if (scene.id === 'm3_hel_entry' && index === 3) {
          assert.equal(state.helDanceDoor?.physical, true);
          for (let frame = 0; frame < 40 && state.helDanceDoor?.phase === 'opening'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.helDanceDoor?.phase, 'open');
        }
        else if (scene.id === 'm3_hel_bargain' && index === 0) {
          assert.equal(state.helBargain?.phase, 'disarming');
          for (let frame = 0; frame < 36; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.helBargain?.phase, 'disarmed');
        }
        else if (scene.id === 'm3_hel_bargain' && index === 3) {
          h.advance(2); h.players.act('film-player', 'dodge', h.tick());
          actor.rotation = Math.PI; h.players.act('film-player', 'attack', h.tick());
          h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, sequence: ++sequence });
        }
        else if (scene.id === 'm3_gate' && index === 2) {
          for (let frame = 0; frame < 80; frame++) h.sandbox.life.film.dockGate.frame(actor, .1, h.tick(), undefined, undefined, true);
          const gate = state.dockGate!, eye = dockGateEye(gate), dx = DOCK_GATE.cable.x - eye.x, dz = DOCK_GATE.cable.z - eye.z;
          const yaw = Math.atan2(dx, dz), pitch = -Math.atan2(32 - eye.y, Math.hypot(dx, dz));
          for (let burst = 0; burst < DOCK_GATE.hits; burst++) {
            h.sandbox.life.film.dockGate.frame(actor, .1, h.tick());
            h.sandbox.life.film.dockGate.shoot(actor, yaw, pitch, h.tick());
          }
          for (let frame = 0; frame < 115; frame++) h.players.step(.1, true, h.tick());
        }
        else if (scene.id === 'm3_hel_bargain' && index === 4) {
          for (let frame = 0; frame < 31; frame++) h.players.step(.1, true, h.tick());
          h.command('act'); assert.equal(state.helBargain?.phase, 'catching');
          for (let frame = 0; frame < 8; frame++) h.players.step(.1, true, h.tick());
        }
        else if (scene.id === 'm3_hel_bargain' && index === 5) { actor.rotation = Math.PI; h.command('act'); }
        else if (scene.id === 'm1_download') {
          for (let frame = 0; frame < 121; frame++) h.players.step(.1, true, h.tick());
          for (let frame = 0; frame < 500 && state.downloadSetup!.progress < CABIN_ROUTE_LENGTH; frame++) {
            const guide = cabinGuidePose(state.downloadSetup!.progress);
            actor.position = filmPosition(scene.set, guide.x, guide.z); h.players.step(.1, true, h.tick());
          }
          actor.position = filmPosition(scene.set, CABIN.approach.x, CABIN.approach.z); h.command('act');
          for (let frame = 0; frame < 101; frame++) h.players.step(.1, true, h.tick());
          h.command('act');
          for (let frame = 0; frame < 101; frame++) h.players.step(.1, true, h.tick());
        }
        else if (scene.id === 'm1_red_dress') for (let frame = 0; frame < 121; frame++) h.players.step(.1, true, h.tick());
        else if (scene.id === 'm1_bridge') {
          for (let frame = 0; frame < 151; frame++) h.players.step(.1, true, h.tick());
          h.command('meeting:stay'); assert.equal(state.scene, 'm1_bug'); break;
        } else if (scene.id === 'm1_bug') {
          if (index === 0) {
            for (let frame = 0; frame < 200; frame++) {
              h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, focus: true, sequence: ++sequence });
              h.players.step(.1, true, h.tick());
            }
          } else {
            for (let frame = 0; frame < 600; frame++) h.players.step(.1, true, h.tick());
            assert.equal(state.meeting?.phase, 'parked'); h.command('act');
            for (let frame = 0; frame < 81; frame++) h.players.step(.1, true, h.tick());
            actor.position = filmStepPosition(scene, step); h.command('act');
            assert.equal(state.scene, 'm1_pills'); break;
          }
        }
        else if (scene.id === 'm1_interrogation') for (let frame = 0; frame < (index === 0 ? 61 : 241); frame++) h.players.step(.1, true, h.tick());
        else if (scene.id === 'm1_wake_again') {
          if (index === 0) {
            for (let frame = 0; frame < 120; frame++) h.players.step(.1, true, h.tick());
            assert.equal(state.wakeCall?.phase, 'decision');
            h.command('act');
            for (let frame = 0; frame < 51; frame++) h.players.step(.1, true, h.tick());
          } else for (let frame = 0; frame < 50 && state.scene === scene.id; frame++) h.players.step(.1, true, h.tick());
        }
        else if (scene.id === 'm1_sentinels') {
          const frames = index === 0 ? 210 : 36;
          for (let frame = 0; frame < frames; frame++) h.players.step(.1, true, h.tick());
        }
        else if (scene.id === 'm1_cypher_console') for (let frame = 0; frame < 86; frame++) h.players.step(.1, true, h.tick());
        else if (scene.id === 'm1_steak') for (let frame = 0; frame < 147; frame++) h.players.step(.1, true, h.tick());
        else if (scene.id === 'm1_meal') for (let frame = 0; frame < 134; frame++) h.players.step(.1, true, h.tick());
        else if (scene.id === 'm1_bathroom') for (let frame = 0; frame < 70 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        else if (scene.id === 'm1_unplugged') {
          for (let frame = 0; frame < 100 && state.betrayal?.phase !== 'window'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.betrayal?.phase, 'window'); h.command('act');
          for (let frame = 0; frame < 70 && state.betrayal?.phase !== 'reconnect'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.betrayal?.phase, 'reconnect'); h.command('act'); h.command('act');
        }
        else if (scene.id === 'm1_rescue_decision') {
          for (let frame = 0; frame < 90 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        }
        else if (scene.id === 'm1_guns') {
          for (let frame = 0; frame < 50 && state.rescue?.phase === 'racks_arriving'; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.rescue?.phase, 'selecting');
          const loadout = RESCUE.loadoutRoots.rifle;
          actor.position = filmPosition(scene.set, loadout.x, loadout.z); h.command('act');
          for (let frame = 0; frame < 55 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        }
        else if (scene.id === 'm1_smith_question') for (let frame = 0; frame < 75 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        else if (scene.id === 'm1_bullet_dodge') for (let frame = 0; frame < 55 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        else if (scene.id === 'm1_helicopter') {
          for (let frame = 0; frame < 90 && ['approach', 'firing'].includes(state.airRescue?.phase ?? ''); frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: h.actor().rotation, jump: false, sprint: false, focus: true, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
          assert.equal(state.airRescue?.phase, 'leap_window');
          while (state.airRescue!.elapsed < AIR_RESCUE.office.leapAt) h.players.step(.1, true, h.tick());
          h.players.act('film-player', 'dodge', h.tick());
          for (let frame = 0; frame < 60 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        }
        else if (scene.id === 'm1_rooftop_rescue') {
          for (let frame = 0; frame < 45 && state.airRescue?.phase === 'impact'; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: h.actor().rotation, jump: false, sprint: false, focus: true, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
          assert.equal(state.airRescue?.phase, 'bracing');
          for (const beat of AIR_RESCUE.roof.beats) {
            while (state.airRescue!.phase === 'bracing' && state.airRescue!.elapsed < beat) {
              h.players.receiveInput('film-player', { x: 0, z: 0, yaw: h.actor().rotation, jump: false, sprint: false, focus: true, sequence: ++sequence });
              h.players.step(.1, true, h.tick());
            }
            if (state.airRescue!.phase === 'bracing') h.players.act('film-player', 'dodge', h.tick());
          }
          for (let frame = 0; frame < 80 && state.step === index; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: h.actor().rotation, jump: false, sprint: false, focus: true, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
        }
        else if (scene.id === 'm1_commute' && index === 1) {
          for (let frame = 0; frame < 125; frame++) h.players.step(.1, true, h.tick());
          h.advance();
        }
        else if (scene.id === 'm1_morning') {
          for (let frame = 0; frame < 75 && state.step === index; frame++) h.players.step(.1, true, h.tick());
        }
        else if (scene.id === 'm1_boss' && index === 0) {
          for (let frame = 0; frame < 125; frame++) h.players.step(.1, true, h.tick());
          h.command('act');
        } else if (scene.id === 'm1_boss' && index === 1) {
          for (let frame = 0; frame < 111; frame++) h.players.step(.1, true, h.tick());
          h.command('act'); for (let frame = 0; frame < 41; frame++) h.players.step(.1, true, h.tick());
          h.command('act');
          for (let frame = 0; frame < 54; frame++) h.players.step(.1, true, h.tick());
          h.command('act'); for (let frame = 0; frame < 120; frame++) h.players.step(.1, true, h.tick());
        } else if (scene.id === 'm1_office_escape' && index === 2) for (let frame = 0; frame < 40; frame++) h.players.step(.1, true, h.tick());
        else if (state.constructArrival) {
          for (let frame = 0; frame < 111; frame++) h.players.step(.1, true, h.tick());
          actor.position = filmStepPosition(scene, step); h.command('act');
          for (let frame = 0; frame < 120; frame++) h.players.step(.1, true, h.tick());
        }
        else if (state.truthRecovery) for (let frame = 0; frame < 200 && state.scene === scene.id && state.step === index; frame++) h.players.step(.1, true, h.tick());
        else if (state.awakening && ['m1_mirror', 'm1_pod', 'm1_recovery', 'm1_cabin', 'm1_construct', 'm1_desert'].includes(scene.id)) for (let frame = 0; frame < 200 && state.scene === scene.id && state.step === index; frame++) {
          if (state.awakening?.kind === 'breather' && state.awakening.started === false) h.command('act');
          h.players.step(.1, true, h.tick());
        }
        else if (index === 0 && scene.id === 'm1_spoon') {
          for (let frame = 0; frame < 80; frame++) h.players.step(.1, true, h.tick());
          h.command('act');
          for (let frame = 0; frame < 90; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, focus: true, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
          for (let frame = 0; frame < 125; frame++) h.players.step(.1, true, h.tick());
          h.command('act'); for (let frame = 0; frame < 30; frame++) h.players.step(.1, true, h.tick());
        }
        else if (index === 0 && ['m1_oracle', 'm1_dejavu'].includes(scene.id)) {
          const frames = scene.id === 'm1_dejavu' && state.ambushApproach?.stairCat ? Math.ceil(AMBUSH_CAT_STAIRS.seconds / .1) + 2 : 110;
          for (let frame = 0; frame < frames && state.step === index; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, focus: true, sequence: ++sequence });
            h.players.step(.1, true, h.tick());
          }
        }
        else if (scene.id === 'm2_trucks' && index === 2) {
          h.advance((step.seconds ?? 3) * 2);
          for (let frame = 0; frame < 40 && state.trucks?.phase === 'rescue'; frame++) h.players.step(.1, true, h.tick());
        } else h.advance((step.seconds ?? 3) * 2);
      }
      else if (step.kind === 'drive') {
        h.command('act');
        if (scene.id === 'm2_garage') {
          for (let frame = 0; state.garage?.phase === 'riding' && frame < 200; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, sprint: false, jump: false,
              drive: { throttle: 1, steer: 0, brake: false }, sequence: ++sequence });
            h.players.step(.05, true, h.tick());
          }
          assert.equal(state.garage?.phase, 'arrived'); h.advance();
        } else if (scene.id === 'm3_hammer_tunnels') {
          for (let frame = 0; state.hammer?.phase === 'riding' && frame < 900; frame++) {
            const flight = state.hammer;
            const steer = Math.max(-1, Math.min(1, (hammerCenter(flight.z - 15) - flight.x) * .24 - flight.lateral * .12));
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, sprint: false, jump: false,
              drive: { throttle: 1, steer, brake: false }, sequence: ++sequence });
            h.players.step(.05, true, h.tick());
          }
          assert.equal(state.hammer?.phase, 'arrived'); h.advance();
        } else if (scene.id === 'm3_gate') {
          for (let frame = 0; state.apu?.phase === 'riding' && frame < 500; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, sprint: false, jump: false,
              drive: { throttle: 1, steer: state.apu.x < 6.6 ? 1 : 0, brake: false }, sequence: ++sequence });
            h.players.step(.05, true, h.tick());
          }
          assert.equal(state.apu?.phase, 'arrived'); h.advance();
        } else if (scene.id === 'm3_defense') {
          for (let frame = 0; state.logos?.phase === 'riding' && frame < 600; frame++) {
            const flight = state.logos;
            const next = LOGOS_DEFENSE.threats.find((threat, threatIndex) => !(flight.resolved & 1 << threatIndex) && threat.z < flight.z + 2);
            const focus = Boolean(next && next.z > flight.z - 22 && next.id % 2 === 0 && flight.neo >= LOGOS_DEFENSE.pulseCost);
            let targetX = 0, targetAltitude = flight.z < -31 ? 41 : 25;
            if (next && !focus && next.z > flight.z - 27) {
              targetX = next.x > 0 ? next.x - 13 : next.x + 13;
              targetAltitude = next.altitude > 27 ? next.altitude - 11 : next.altitude + 11;
            }
            const steer = Math.max(-1, Math.min(1, (targetX - flight.x) * .16 - flight.lateral * .1));
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, sprint: false, jump: false, focus,
              drive: { throttle: targetAltitude > flight.altitude + .8 ? 1 : 0, steer, brake: targetAltitude < flight.altitude - .8 }, sequence: ++sequence });
            h.players.step(.05, true, h.tick());
          }
          assert.equal(state.logos?.phase, 'arrived'); h.advance();
        } else if (scene.id === 'm3_sun') {
          for (let frame = 0; state.logos?.phase === 'riding' && frame < 600; frame++) {
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: Math.PI, sprint: false, jump: false,
              drive: { throttle: state.logos.stage === 'clouds' ? 1 : 0, steer: 0, brake: false }, sequence: ++sequence });
            h.players.step(.05, true, h.tick());
          }
          assert.equal(state.logos?.phase, 'arrived'); h.advance();
        } else rideToExit(h);
      }
      else {
        if (scene.id === 'm2_trucks' && state.trucks?.road && index === 0) {
          h.command('act');
          for (let frame = 0; frame < 400 && state.trucks.weapons?.phase !== 'unarmed'; frame++) {
            const opponent = h.world.agents.get('agent_johnson')!, w = state.trucks.weapons!;
            const yaw = Math.atan2(opponent.position.x - actor.position.x, opponent.position.z - actor.position.z);
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw, pitch: 0, jump: false, sprint: false, sequence: ++sequence });
            if (w.phase === 'gun') h.players.act('film-player', 'shoot', h.tick());
            if (w.phase === 'blade') h.players.act('film-player', 'attack', h.tick());
            if (['counter', 'gun_disarm'].includes(w.phase) && w.elapsed >= .25 && w.elapsed < .6) h.players.act('film-player', 'dodge', h.tick());
            h.players.step(.05, true, h.tick());
          }
          assert.equal(state.trucks.weapons?.phase, 'unarmed', 'the complete route performs the gun and blade stages');
          assert.ok(state.trucks.weapons!.parries >= 2 && state.trucks.weapons!.slashes >= 2);
          assert.equal(h.sandbox.state.threats.filter(t => t.scene === scene.id).length, 1);
        }
        if (scene.id === 'm3_dock_battle') {
          h.command('act');
          for (let frame = 0; frame < 90 && state.step === index; frame++) {
            h.advance(); const battle = state.dockGunnery!;
            for (const [targetIndex, target] of battle.targets.entries()) {
              if (target.health <= 0 || target.spawnAt > battle.elapsed) continue;
              const point = dockGunneryTarget(battle, targetIndex), eye = DOCK_GUNNERY.eye;
              const yaw = Math.atan2(point.x - eye.x, point.z - eye.z), pitch = -Math.atan2(point.y - eye.y, Math.hypot(point.x - eye.x, point.z - eye.z));
              for (let shot = 0; target.health > 0 && shot < 4; shot++) h.sandbox.life.film.dockShoot(actor, yaw, pitch, h.tick());
            }
          }
          assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
        }
        if (scene.id === 'm2_burly') {
          h.command('act');
          for (let frame = 0; frame < 25; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.burly?.phase, 'grapple');
          h.players.act('film-player', 'dodge', h.tick());
          for (const target of h.sandbox.state.threats.slice(0, 2)) {
            for (let hit = 0; target.health > 0 && hit < 10; hit++) {
              actor.position = { ...target.position, z: target.position.z + 2 }; actor.rotation = Math.PI;
              h.sandbox.attack(actor, h.tick(), 2);
            }
          }
          assert.equal(state.burly?.phase, 'staff_ready');
          actor.position = filmPosition(scene.set, 12, -13); h.command('act');
          actor.position = filmStepPosition(scene, step);
          for (let swing = 0; state.step === index && swing < 4; swing++) {
            if (!h.sandbox.state.threats.some(threat => threat.scene === scene.id)) h.advance(6);
            const target = h.sandbox.state.threats.find(threat => threat.scene === scene.id)!;
            target.position = { ...actor.position, z: actor.position.z - 2 }; actor.rotation = Math.PI;
            h.sandbox.attack(actor, h.tick(), 2);
          }
          assert.equal(state.step, 1); continue;
        }
        if (scene.id === 'm2_chateau') {
          h.command('act');
          actor.position = filmPosition(scene.set, -29, 17); h.command('act');
          const fightWave = () => {
            for (const target of [...h.sandbox.state.threats.filter(threat => threat.scene === scene.id)]) {
              actor.position = { ...target.position, z: target.position.z + 2 }; actor.rotation = Math.PI;
              target.attackAt = h.tick() + 2; target.stunUntil = 0;
              h.players.act('film-player', 'dodge', h.tick());
              for (let hit = 0; hit < 3 && target.health > 0; hit++) h.sandbox.attack(actor, h.tick(), 0);
              assert.equal(target.health, 0, scene.id);
            }
          };
          fightWave(); h.advance(); assert.equal(state.chateau?.phase, 'landing');
          actor.position = filmStepPosition(scene, scene.steps[1]); h.advance();
          fightWave(); h.advance(); assert.equal(state.step, 1); continue;
        }
        if (scene.id === 'm1_bullet_dodge') {
          h.command('act');
          for (let frame = 0; frame < 36; frame++) h.players.step(.1, true, h.tick());
          for (const beat of GOVERNMENT_RESCUE.rooftop.beats) {
            while (state.government!.phase === 'bullet_time' && state.government!.elapsed < beat) h.players.step(.1, true, h.tick());
            h.players.act('film-player', 'dodge', h.tick());
          }
          for (let frame = 0; frame < 110 && state.step === index; frame++) h.players.step(.1, true, h.tick());
          assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
        }
        h.command('act');
        if (scene.id === 'm1_lobby') for (let frame = 0; frame < 80 && !h.sandbox.state.threats.length; frame++) h.players.step(.1, true, h.tick());
        h.advance(); assert.ok(h.sandbox.state.threats.length > 0, JSON.stringify({ scene: scene.id, lastText: state.lastText,
          seraph: scene.id === 'm3_hel_entry' ? h.world.agents.get('seraph') : undefined }));
        if (scene.id === 'm1_bathroom') {
          const target = h.sandbox.state.threats[0]; target.stunUntil = Number.MAX_SAFE_INTEGER;
          for (let frame = 0; frame < 130; frame++) h.players.step(.1, true, h.tick());
          for (const combo of [0, 1, 2]) {
            target.position = { ...actor.position, z: actor.position.z - 2 }; actor.rotation = Math.PI;
            h.sandbox.attack(actor, h.tick(), combo);
          }
          h.players.step(.1, true, h.tick()); assert.equal(state.betrayal?.phase, 'sacrifice_ready');
          assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`); continue;
        }
        if (scene.id === 'm1_dojo') {
          const target = h.sandbox.state.threats[0];
          target.stunUntil = 0; target.attackAt = h.tick() + 1;
          assert.equal(h.sandbox.life.film.trainingDodge(actor, target, h.tick()), true);
          for (const combo of [0, 1, 2]) {
            actor.position = { ...target.position, z: target.position.z + 2 }; actor.rotation = Math.PI;
            h.sandbox.attack(actor, h.tick(), combo);
          }
          h.advance();
          assert.equal(target.health, 0, scene.id);
          assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`);
          continue;
        }
        if (scene.id === 'm2_seraph') {
          const target = h.sandbox.state.threats[0];
          for (let exchange = 0; exchange < 2; exchange++) {
            target.attackAt = h.tick() + 1; target.stunUntil = 0;
            assert.equal(h.sandbox.life.film.trainingDodge(actor, target, h.tick()), true);
            actor.position = { ...target.position, z: target.position.z + 2 }; actor.rotation = Math.PI;
            h.sandbox.attack(actor, h.tick(), exchange);
          }
          h.advance(); assert.equal(state.step, index + 1); continue;
        }
        // Exercise the same hit, death and reward path as player melee, not direct removal.
        for (let round = 0; state.step === index && round < 20; round++) {
          for (const target of [...h.sandbox.state.threats]) {
            for (let hits = 0; target.health > 0 && hits < 30; hits++) {
              actor.position = { ...target.position, z: target.position.z + 2 }; actor.rotation = Math.PI;
              h.sandbox.attack(actor, h.tick(), 2);
            }
            assert.equal(target.health, 0, scene.id);
          }
          h.advance();
        }
        if (scene.id === 'm2_trucks' && state.trucks?.hood && index === 0) {
          assert.equal(state.trucks.hood.phase, 'kick', 'winning the unarmed fight starts the car reception instead of skipping it');
          for (let frame = 0; state.step === index && frame < 320; frame++) {
            const hood = state.trucks.hood;
            h.players.receiveInput('film-player', { x: 0, z: 0, yaw: actor.rotation, pitch: 0,
              jump: hood.phase === 'ready', sprint: false, focus: hood.phase === 'hood',
              drive: { throttle: 0, brake: false, steer: hood.phase === 'hood' ? -hood.balance * .4 : 0 }, sequence: ++sequence });
            if (hood.phase === 'flight' && hood.elapsed >= TRUCK_HOOD.contactStart && hood.elapsed <= TRUCK_HOOD.contactEnd) h.players.act('film-player', 'attack', h.tick());
            h.players.step(.05, true, h.tick());
          }
          assert.equal(state.trucks.hood.phase, 'done', 'the full route must grip, pass the truck and perform the timed return kick');
          assert.equal(state.trucks.phase, 'collision');
        }
      }
      if (scene.id === 'm1_pills' && index === scene.steps.length - 1) {
        assert.equal(state.scene, 'm1_mirror', 'the red pill starts the mirror scene without an extra command');
        continue;
      }
      if (scene.id === 'm1_mirror') {
        assert.equal(state.scene, 'm1_pod', 'the mirror covering Neo starts the pod scene without another command');
        continue;
      }
      if (scene.id === 'm1_pod' && index === scene.steps.length - 1) {
        assert.equal(state.scene, 'm1_recovery', 'boarding and loss of consciousness lead directly into recovery');
        assert.equal(state.awakening?.started, false, 'Neo waits for the player before rehabilitation');
        continue;
      }
      if (scene.id === 'm1_recovery' || scene.id === 'm1_cabin' && index === scene.steps.length - 1) {
        assert.equal(state.scene, scene.id === 'm1_recovery' ? 'm1_cabin' : 'm1_construct');
        if (scene.id === 'm1_cabin') assert.equal(state.constructArrival?.phase, 'ready', 'the loading space waits for Neo to inspect his image');
        else assert.equal(state.awakening?.started, false, 'the next performance requires player consent');
        continue;
      }
      if (scene.id === 'm1_construct' && index === scene.steps.length - 1) {
        assert.equal(state.scene, 'm1_desert', 'the television choice starts the ruined world without another command');
        continue;
      }
      if (['m1_desert', 'm1_truth_exit', 'm1_truth_return'].includes(scene.id) && index === scene.steps.length - 1) {
        assert.equal(state.scene, scene.id === 'm1_desert' ? 'm1_truth_exit' : scene.id === 'm1_truth_exit' ? 'm1_truth_return' : 'm1_download');
        continue;
      }
      if (scene.id === 'm1_wake_again' && index === scene.steps.length - 1) {
        assert.equal(state.scene, 'm1_bridge', 'walking out of 101 starts the bridge scene without another command');
        continue;
      }
      if (scene.id === 'm1_spoon' && index === scene.steps.length - 1) {
        assert.equal(state.scene, 'm1_oracle', 'following the hostess across the kitchen door continues without another command');
        continue;
      }
      assert.equal(state.step, index + 1, `${scene.id}: ${step.label}`);
      if (scene.id === 'm1_jump' && index === 0) {
        h.command('act');
        for (let frame = 0; frame < 41; frame++) h.players.step(.1, true, h.tick());
      }
    }
    assert.ok(state.completed.includes(scene.id));
    if (scene.id === 'm1_phone_escape') h.advance(3); // Hold the connected booth shot through the truck impact.
    if (!['m1_bridge', 'm1_bug', 'm1_pills', 'm1_mirror', 'm1_pod', 'm1_recovery', 'm1_cabin', 'm1_construct', 'm1_desert', 'm1_truth_exit', 'm1_truth_return'].includes(scene.id)) h.command('next');
    if (scene.id === 'm1_office_escape' && state.office?.crossing !== undefined) for (let frame = 0; frame < 65; frame++) h.players.step(.1, true, h.tick());
  }
  assert.equal(state.finished, true); assert.equal(state.completed.length, FILM_SCENES.length);
  const reflections = { ...state.reflections };
  const last = { ...h.actor().position }; h.command('visit:m1_lobby'); assert.equal(h.actor().currentLocation, 'film_government_lobby');
  h.command('return'); assert.deepEqual(h.actor().position, last); assert.equal(state.finished, true);
  h.command('cycle'); assert.equal(h.actor().id, 'neo'); assert.equal(h.actor().currentLocation, 'neo_apartment');
  assert.equal(h.sandbox.state.neoLife!.cycle, 2); assert.equal(h.sandbox.state.neoLife!.cycles.length, 1); assert.equal(h.sandbox.state.neoLife!.journey, undefined);
  for (const [key, value] of Object.entries(reflections)) assert.equal(h.sandbox.state.neoLife!.cycles[0].choices[key], value);
  assert.equal(h.world.agents.get('niobe')!.currentLocation, CHARACTERS.niobe.initialLocation);
});
