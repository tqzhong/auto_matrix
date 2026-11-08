import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { filmPosition, type FilmJourney, type SandboxState } from '@auto_matrix/shared';
import { AmbushSetRenderer } from '../packages/client/src/engine/AmbushSetRenderer.js';
import { NebDeckRenderer } from '../packages/client/src/engine/NebDeckRenderer.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

const journey = (scene: 'm1_bathroom' | 'm1_unplugged', phase: NonNullable<FilmJourney['betrayal']>['phase'], elapsed = 0): FilmJourney => ({
  version: 1, scene, actor: scene === 'm1_bathroom' ? 'morpheus' : 'tank', step: scene === 'm1_bathroom' ? 0 : 1,
  completed: [], enteredAt: 0, reflections: {}, lastText: '', checkpoint: filmPosition(scene === 'm1_bathroom' ? 'film_ambush_house' : 'film_neb_deck'),
  betrayal: { kind: scene === 'm1_bathroom' ? 'bathroom' : 'unplugged', phase, elapsed, attempt: 0, repels: 0, rescued: 0 },
});

test('the bathroom holdout owns fixtures, a breakable partition and saved crash debris', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const root = new THREE.Group(); const renderer = new AmbushSetRenderer(root);
  try {
    for (const name of ['ambush-bathroom-holdout', 'ambush-bathroom-tub', 'ambush-bathroom-sink', 'ambush-bathroom-partition-intact', 'ambush-bathroom-breach-debris']) {
      assert.ok(root.getObjectByName(name), `${name} must be rendered geometry`);
    }
    const intact = root.getObjectByName('ambush-bathroom-partition-intact')!;
    const debris = root.getObjectByName('ambush-bathroom-breach-debris')!;
    renderer.update(journey('m1_bathroom', 'defending', 8), [], 8);
    assert.equal(intact.visible, true); assert.equal(debris.visible, false);
    renderer.update(journey('m1_bathroom', 'sacrifice', 3.2), [], 12);
    assert.equal(intact.visible, false, 'the collision beat must open the partition');
    assert.equal(debris.visible, true, 'saved elapsed time must restore the breached wall state');
    assert.ok(debris.children.some(piece => piece.rotation.x !== 0 || piece.rotation.z !== 0), 'the breach needs scattered masonry rather than a hidden wall');
  } finally { renderer.dispose(); }
});

test('Cypher betrayal has physical jacks, per-person signals and a timed counter discharge', () => {
  const root = new THREE.Group(); const renderer = new NebDeckRenderer(root);
  try {
    for (const name of ['neb-betrayal-scene', 'neb-betrayal-console', 'neb-betrayal-jack-apoc', 'neb-betrayal-jack-switch',
      'neb-betrayal-signal-neo', 'neb-betrayal-signal-trinity', 'neb-betrayal-signal-apoc', 'neb-betrayal-signal-switch', 'neb-betrayal-counter-flash']) {
      assert.ok(root.getObjectByName(name), `${name} must be visible through physical scene geometry`);
    }
    const jack = root.getObjectByName('neb-betrayal-jack-apoc')!;
    const apoc = root.getObjectByName('neb-betrayal-signal-apoc') as THREE.Mesh;
    const neo = root.getObjectByName('neb-betrayal-signal-neo') as THREE.Mesh;
    const flash = root.getObjectByName('neb-betrayal-counter-flash')!;
    const scene = journey('m1_unplugged', 'unplugging', 1);
    renderer.update(scene, 1); assert.equal(jack.visible, true); assert.equal(flash.visible, false);
    const live = (apoc.material as THREE.MeshBasicMaterial).color.getHex();
    scene.betrayal!.elapsed = 3; renderer.update(scene, 3);
    assert.equal(jack.visible, false, 'Apoc jack is visibly removed after Cypher pulls it');
    assert.notEqual((apoc.material as THREE.MeshBasicMaterial).color.getHex(), live, 'Apoc signal goes dark when his cable is removed');
    assert.equal((neo.material as THREE.MeshBasicMaterial).color.getHex(), live, 'Neo signal remains alive before Tank reconnects it');
    scene.betrayal = { ...scene.betrayal!, phase: 'countering', elapsed: 2.32 };
    renderer.update(scene, 5.32); assert.equal(flash.visible, true, 'the saved firing beat restores the pulse discharge');
    scene.betrayal.elapsed = 3.1; renderer.update(scene, 6.1); assert.equal(flash.visible, false);
  } finally { renderer.dispose(); }
});

for (const visit of [false, true]) test(`the intercut reuses both rooms and releases them when ${visit ? 'visiting a scene' : 'the rescue begins'}`, t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new FilmSetRenderer(new THREE.Scene()), direct = new FilmSetRenderer(new THREE.Scene());
  t.after(() => { renderer.dispose(); direct.dispose(); });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, tank = world.agents.get('tank')!;
  neo.position = filmPosition('film_tv_repair', -7, -18.5); neo.isInMatrix = true;
  tank.position = filmPosition('film_neb_deck', -3, 0); tank.isInMatrix = false;
  const state = { ...journey('m1_unplugged', 'ready'), scene: 'm1_tv_exit', actor: 'neo', step: 3,
    tvExit: { phase: 'calling', elapsed: 0, crosscut: { phase: 'call', elapsed: 3, view: 'matrix', attempts: 0,
      tankHealth: 40, tankHit: true, dozerDead: true, apocDead: false, switchDead: false,
      cypherDead: false, trinityOut: false, neoOut: false } } } as FilmJourney;
  const sandbox = { neoLife: { journey: state } } as SandboxState;
  renderer.update(neo, sandbox, 0);
  const shop = renderer.root.getObjectByName('franklin-erie-tv-repair')!;
  const shopMesh = shop.getObjectsByProperty('type', 'Mesh')[0] as THREE.Mesh;
  let shopDisposals = 0, deckDisposals = 0, shadowDisposals = 0, sunShadowDisposals = 0;
  shopMesh.geometry.addEventListener('dispose', () => shopDisposals++);
  const daylight = shop.getObjectsByProperty('type', 'SpotLight')[0] as THREE.SpotLight;
  daylight.shadow.map = new THREE.WebGLRenderTarget(1, 1);
  daylight.shadow.map.addEventListener('dispose', () => shadowDisposals++);
  const sun = shop.getObjectsByProperty('type', 'DirectionalLight')[0] as THREE.DirectionalLight;
  sun.shadow.map = new THREE.WebGLRenderTarget(1, 1);
  sun.shadow.map.addEventListener('dispose', () => sunShadowDisposals++);
  const cut = state.tvExit!.crosscut!;
  state.actor = tank.id; cut.view = 'ship'; cut.elapsed = 6;
  renderer.update(tank, sandbox, 1);
  const deck = renderer.root.getObjectByName('neb-interior-deck')!;
  const deckMesh = deck.getObjectsByProperty('type', 'Mesh')[0] as THREE.Mesh;
  deckMesh.geometry.addEventListener('dispose', () => deckDisposals++);
  assert.equal(renderer.root.getObjectByName(shop.name), undefined, 'offstage shop lights cannot enter the ship render');
  const snapshot = (root: THREE.Object3D) => {
    const values: unknown[] = [];
    root.traverse(object => values.push([object.name, object.type, object.visible, object.position.toArray(), object.rotation.toArray(),
      object instanceof THREE.Light ? [object.intensity, object.color.getHex(), object.castShadow] : undefined]));
    return values;
  };
  for (const elapsed of [9, 18]) {
    state.actor = neo.id; cut.view = 'matrix'; cut.elapsed = elapsed; cut.apocDead = true; cut.switchDead = elapsed >= 18;
    renderer.update(neo, sandbox, elapsed); direct.update(neo, sandbox, elapsed);
    assert.ok(renderer.root.getObjectByName(shop.name) === shop, 'the shop survives the return cut');
    assert.equal(renderer.root.getObjectByName(deck.name), undefined);
    assert.deepEqual(snapshot(shop), snapshot(direct.root.getObjectByName(shop.name)!));
    state.actor = tank.id; cut.view = 'ship'; cut.elapsed = elapsed + 5;
    renderer.update(tank, sandbox, elapsed); direct.update(tank, sandbox, elapsed);
    assert.ok(renderer.root.getObjectByName(deck.name) === deck, 'the deck survives the return cut');
    assert.deepEqual(snapshot(deck), snapshot(direct.root.getObjectByName(deck.name)!));
  }
  state.scene = 'm1_unplugged'; renderer.update(tank, sandbox, 24);
  assert.ok(renderer.root.getObjectByName(deck.name) === deck, 'Tank takes over on the retained ship');
  assert.equal(shopDisposals, 0); assert.equal(deckDisposals, 0); assert.equal(shadowDisposals, 0);
  assert.equal(sunShadowDisposals, 0, 'the retained daylight shadow must survive each intercut');
  if (visit) state.visiting = 'm1_unplugged';
  else { state.scene = 'm1_rescue_decision'; delete state.tvExit; }
  renderer.update(tank, sandbox, 25);
  assert.equal(shopDisposals, 1); assert.equal(deckDisposals, 1); assert.equal(shadowDisposals, 1);
  assert.equal(sunShadowDisposals, 1, 'leaving the intercut must release the retained daylight shadow once');
});
