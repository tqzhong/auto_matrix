import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, FILM_SETS, ZION_CAST, ZION_HOMECOMING, ZION_OBSTACLES, filmEntry, filmPosition, filmStepPosition, playerBlocked, type AgentState, type WorldEvent } from '@auto_matrix/shared';
import { ZionHomecomingRenderer } from '../packages/client/src/engine/ZionHomecomingRenderer.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function game() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 81);
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const actions = { execute() {} } as unknown as ActionExecutor;
  const players = new PlayerController(world, conversations, actions, dynamics, sandbox);
  players.possess('p', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  players.sandboxAction('p', { kind: 'life', target: 'film:start' }, 1);
  let tick = 1;
  const command = (target: string) => players.sandboxAction('p', { kind: 'life', target: `film:${target}` }, ++tick);
  const advance = (count: number) => { for (let i = 0; i < count; i++) sandbox.tick(++tick); };
  return { world, sandbox, players, command, advance, actor: () => players.getAgent('p')!, state: () => sandbox.life.film.state! };
}

test('homecoming routes, named cast and visible prop footprints agree with collision', () => {
  for (const id of ZION_HOMECOMING) {
    const scene = FILM_SCENE_BY_ID[id]; const set = FILM_SETS[scene.set];
    assert.equal(playerBlocked(filmEntry(scene), false), false, `${id} entry`);
    for (const step of scene.steps) assert.equal(playerBlocked(filmStepPosition(scene, step), false), false, `${id}: ${step.label}`);
    for (const [role, pose] of Object.entries(ZION_CAST[id])) {
      assert.ok(scene.cast.includes(role));
      assert.equal(playerBlocked(filmPosition(scene.set, pose.x, pose.z), false), false, `${role} staging`);
    }
    for (const prop of ZION_OBSTACLES[set.id]) assert.equal(playerBlocked(filmPosition(set.id, prop.x, prop.z), false), true, `${id} tangible prop`);
  }
});

test('the temple walking floor has one stone surface instead of coincident dark and stone faces', () => {
  const root = new THREE.Group(), center = FILM_SETS.film_zion_temple.center;
  root.position.set(center.x, center.y - 1, center.z);
  const renderer = new ZionHomecomingRenderer(root, 'film_zion_temple');
  try {
    root.updateMatrixWorld(true);
    for (const x of [-12, 12]) for (const z of [-30, -10, 10, 30]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(center.x + x, center.y - 1 + .08, center.z + z), new THREE.Vector3(0, -1, 0), 0, .1);
      const surfaces = ray.intersectObject(root, true).filter(hit => Math.abs(hit.point.y - (center.y - 1)) < .015);
      assert.equal(new Set(surfaces.map(hit => hit.object.uuid)).size, 1, `${x}, ${z}: floor materials must not compete at the same depth`);
      const material = (surfaces[0].object as THREE.Mesh).material as THREE.MeshStandardMaterial;
      assert.equal(material.color.getHex(), 0xb39473, 'the textured stone floor remains visible at the unchanged walking height');
    }
  } finally { renderer.dispose(); }
});

test('dock and resident actions save concrete supplies and both requests through reload', () => {
  const h = game(); const state = h.state();
  assert.equal(h.players.possess('p', 'neo', 2).agentId, 'neo');
  state.scene = 'm2_meeting'; state.actor = 'neo'; state.step = FILM_SCENE_BY_ID.m2_meeting.steps.length;
  const transition = h.command('next'); assert.equal(state.scene, 'm2_dock', transition);
  const kid = h.world.agents.get('kid')!; const pose = ZION_CAST.m2_dock.kid;
  assert.deepEqual(kid.position, filmPosition('film_zion_hangar', pose.x, pose.z));
  state.step = 2; h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m2_dock, FILM_SCENE_BY_ID.m2_dock.steps[2]);
  h.command('act'); h.advance(11); assert.equal(state.step, 3);
  assert.equal(h.sandbox.state.neoLife!.choices.zion_ship_charged, 'yes');
  h.command('next'); h.state().step = FILM_SCENE_BY_ID.m2_lock.steps.length;
  h.command('next'); assert.equal(state.scene, 'm2_residents');
  for (const index of [1, 2, 3]) {
    state.step = index; h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m2_residents, FILM_SCENE_BY_ID.m2_residents.steps[index]);
    h.command('act'); h.advance(index === 3 ? 9 : 7);
  }
  assert.equal(h.sandbox.state.neoLife!.choices.zion_jacob_request, 'Gnosis');
  assert.equal(h.sandbox.state.neoLife!.choices.zion_icarus_request, 'Icarus');
  assert.equal(h.sandbox.state.neoLife!.choices.zion_residents_contacted, 'both');
  const saved = structuredClone(h.sandbox.state); h.sandbox.restore(saved);
  assert.equal(h.sandbox.state.neoLife!.choices.zion_residents_contacted, 'both');
});

function baneLoft() {
  const h = game(); const scene = FILM_SCENE_BY_ID.m2_bane_copy;
  h.state().scene = 'm2_room'; h.state().step = FILM_SCENE_BY_ID.m2_room.steps.length;
  h.command('next');
  assert.equal(h.state().scene, scene.id);
  assert.equal(h.actor().id, 'bane');
  const at = (step: number) => { h.actor().position = filmStepPosition(scene, scene.steps[step]); };
  const use = (step: number) => {
    assert.equal(h.state().step, step); at(step); h.command('act');
    h.advance((scene.steps[step].seconds ?? 3) * 2);
    assert.equal(h.state().step, step + 1);
  };
  const malachi = h.world.agents.get('malachi')!;
  for (let tick = 0; tick < 100 && malachi.position.z > filmPosition(scene.set, -5, -28).z + .01; tick++) {
    h.actor().position = { ...malachi.position, x: malachi.position.x + 5, z: malachi.position.z - 2 }; h.advance(1);
  }
  assert.deepEqual(malachi.position, filmPosition(scene.set, -5, -28));
  at(0); h.advance(1); assert.equal(h.state().step, 1);
  return { ...h, scene, use, malachi: h.world.agents.get('malachi')! };
}

test('both loft phone exits return the correct bodies to Zion', () => {
  const h = baneLoft(); const life = h.sandbox.state.neoLife!; const bane = h.actor();
  h.malachi.health = 57;
  h.use(1);
  assert.equal(life.choices.oracle_disk_carrier, 'malachi');
  assert.equal(h.malachi.isInMatrix, false);
  assert.equal(h.malachi.currentLocation, 'film_zion_hangar');
  assert.equal(h.malachi.health, 57);
  assert.equal(bane.isInMatrix, true);
  h.use(2);
  assert.equal(bane.faction, 'machines'); assert.equal(bane.isInMatrix, true);
  h.use(3);
  assert.equal(bane.isInMatrix, true);
  assert.equal(life.choices.bane_returned, undefined);
  const handoff = h.sandbox.life.film.handoff;
  h.sandbox.life.film.handoff = () => false;
  assert.match(h.command('next'), /进度已保留/);
  assert.equal(bane.isInMatrix, true);
  assert.equal(life.choices.bane_returned, undefined);
  h.sandbox.life.film.handoff = handoff;
  h.command('next');
  assert.equal(h.state().scene, 'm2_hamann'); assert.equal(h.actor().id, 'neo');
  assert.equal(life.choices.bane_returned, 'yes');
  assert.equal(bane.isInMatrix, false);
  assert.equal(bane.currentLocation, 'film_zion_hangar');
  assert.equal(bane.faction, 'machines');
  assert(life.journal.some(item => item.title.startsWith('旁观片段') && item.text.includes('不是 Neo')));
});

test('old completed loft checkpoints repair the two stranded bodies without replaying the infection', () => {
  const h = baneLoft(); const life = h.sandbox.state.neoLife!; const bane = h.actor();
  Object.assign(life.choices, { oracle_disk_carrier: 'malachi', bane_infected: 'smith', bane_returned: 'yes' });
  h.state().step = h.scene.steps.length; h.state().completed.push(h.scene.id);
  h.players.release('p', 12);
  h.sandbox.restore(structuredClone(h.sandbox.state));
  assert.equal(h.malachi.isInMatrix, false);
  assert.equal(bane.isInMatrix, false); assert.equal(bane.faction, 'machines');
  assert.deepEqual(h.state().checkpoint, bane.position);
  assert.equal(h.state().completed.filter(id => id === h.scene.id).length, 1);
  const settled = structuredClone(bane.position);
  h.sandbox.restore(structuredClone(h.sandbox.state));
  assert.deepEqual(bane.position, settled);
});

test('Zion handoffs adopt the detached set and discard an abandoned preparation', t => {
  const h = game(), scene = new THREE.Scene(), sets = new FilmSetRenderer(scene);
  t.after(() => sets.dispose());
  const neo = h.actor(), morpheus = h.world.agents.get('morpheus')!, journey = h.state();
  Object.assign(journey, { scene: 'm2_lock', step: 1, actor: 'morpheus' });
  morpheus.position = filmEntry(FILM_SCENE_BY_ID.m2_lock); morpheus.isInMatrix = false;
  sets.update(morpheus, h.sandbox.state, 0);
  const camera = new THREE.PerspectiveCamera();
  const lightSlots = (root: THREE.Scene) => {
    let count = 0; root.traverseVisible(object => { if (object instanceof THREE.PointLight) count++; }); return count;
  };
  let preview: THREE.Scene | undefined;
  const graphics = { extensions: { has: () => true }, info: { programs: [] }, getRenderTarget: () => null,
    setRenderTarget() {}, properties: { get: () => ({}) }, compile(_subject: THREE.Group, _camera: THREE.Camera, target: THREE.Scene) { preview = target; } } as unknown as THREE.WebGLRenderer;
  const prepare = () => sets.prepareZionHomecoming(graphics, camera, journey, () => undefined);
  for (let frame = 0; frame < 10; frame++) prepare();
  const residences = preview?.getObjectByName('zion-homecoming-set');
  assert.ok(residences && residences !== scene.getObjectByName(residences.name));
  const preparedSlots = lightSlots(preview!);
  Object.assign(journey, { scene: 'm2_residents', step: 0, actor: 'neo' });
  neo.position = filmEntry(FILM_SCENE_BY_ID.m2_residents); neo.isInMatrix = false;
  sets.update(neo, h.sandbox.state, 1);
  assert.ok(scene.getObjectByName(residences.name) === residences);
  assert.equal(sets.stablePointSlots, true); assert.equal(lightSlots(scene), preparedSlots);

  Object.assign(journey, { scene: 'm2_hamann', step: 2 });
  neo.position = filmEntry(FILM_SCENE_BY_ID.m2_hamann); sets.update(neo, h.sandbox.state, 2);
  preview = undefined;
  for (let frame = 0; frame < 10; frame++) prepare();
  const door = preview?.getObjectByName('zion-bedroom-door');
  assert.ok(door instanceof THREE.Mesh);
  let disposed = 0; door.geometry.addEventListener('dispose', () => disposed++);
  sets.update(undefined, h.sandbox.state, 3);
  assert.equal(disposed, 1);
  assert.equal(scene.getObjectByName('zion-bedroom-door'), undefined);
});

test('Zion supplies reach Mifune at the later dock defense only once', () => {
  const h = game(); assert.equal(h.players.possess('p', 'niobe', 2).agentId, 'niobe');
  const state = h.state(); state.scene = 'm3_hammer_tunnels'; state.actor = 'niobe'; state.step = FILM_SCENE_BY_ID.m3_hammer_tunnels.steps.length;
  h.sandbox.state.neoLife!.choices.zion_ship_charged = 'yes'; h.sandbox.state.neoLife!.choices.zion_lock_reported = '72h';
  h.command('next'); assert.equal(state.scene, 'm3_diggers');
  state.step = FILM_SCENE_BY_ID.m3_diggers.steps.length; state.completed.push('m3_diggers');
  h.command('next'); assert.equal(state.scene, 'm3_upper_digger');
  state.step = FILM_SCENE_BY_ID.m3_upper_digger.steps.length; state.completed.push('m3_upper_digger');
  assert.match(h.command('next'), /船坞的弹药与钢铁/);
  assert.equal(state.scene, 'm3_dock_battle'); assert.equal(h.actor().id, 'mifune');
  assert.equal(h.sandbox.state.profiles.mifune.inventory.medkit, 4);
  assert.equal(h.sandbox.state.neoLife!.choices.zion_dock_supplies_used, '2');
  const saved = structuredClone(h.sandbox.state); h.sandbox.restore(saved);
  assert.equal(h.sandbox.state.profiles.mifune.inventory.medkit, 4);
});

test('all six authored Zion sets have their own geometry and release it after leaving', () => {
  const names: Record<string, string> = {
    film_zion_hangar: 'zion-docked-nebuchadnezzar', film_zion_council: 'zion-homecoming-set',
    film_zion_residences: 'zion-homecoming-set', film_zion_temple: 'zion-assembly-rostrum',
    film_zion_bedroom: 'zion-homecoming-set', film_zion_engineering: 'zion-recycler-flywheel',
  };
  for (const [set, name] of Object.entries(names)) {
    const root = new THREE.Group(); root.position.set(5000, -100, 5000);
    const renderer = new ZionHomecomingRenderer(root, set); renderer.update(undefined, 2.5);
    assert.ok(renderer.group.getObjectByName(name), `${set} missing signature feature`);
    const bounds = new THREE.Box3().setFromObject(root);
    const extent = set === 'film_zion_temple' ? 120 : 100; // The temple now includes the residential shaft beyond its entrance.
    assert.ok(bounds.min.x > 5000 - extent && bounds.max.x < 5000 + extent, `${set} geometry escaped origin`);
    const disposed: string[] = []; renderer.group.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.addEventListener('dispose', () => disposed.push(object.uuid)); });
    renderer.dispose(); assert.equal(root.children.length, 0); assert.ok(disposed.length > 0);
  }
});
