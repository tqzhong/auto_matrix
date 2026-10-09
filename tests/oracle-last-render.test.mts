import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, ORACLE_LAST, newOracleLast, oracleLastBowl, oracleLastRoot, type OracleLastGesture } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

function setup(t: test.TestContext) {
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {}, ellipse() {}, fill() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const rigs = { oracle: models.create(world.agents.get('oracle')!), sati: models.create(world.agents.get('sati')!) };
  const center = FILM_SETS.film_oracle_home.center;
  const pose = (role: 'oracle' | 'sati', arrival: number, elapsed = 0, delta = 0) => {
    const gesture: OracleLastGesture = { ...newOracleLast(1, 61), phase: 'answering', role, step: 1, arrival, elapsed };
    const rig = rigs[role], root = oracleLastRoot(gesture, role);
    rig.root.position.set(center.x + root.x, center.y - 1, center.z + root.z); rig.root.rotation.y = root.yaw;
    models.animate(rig, delta, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, oracleLast: gesture }, 0);
    rig.root.updateWorldMatrix(true, true); return gesture;
  };
  t.after(() => { models.dispose(); globalThis.document = previous; });
  return { world, models, rigs, center, pose };
}

test('the rendered child palms actually reach both bowl handles throughout lifting and carrying', t => {
  const h = setup(t), rig = h.rigs.sati;
  for (const arrival of [3, 3.5, 4, 5, 7, 15, 24, 28]) {
    const state = h.pose('sati', arrival), bowl = oracleLastBowl(state);
    for (const side of [-1, 1]) {
      const hand = rig.root.getObjectByName(`sati-hand-${side}`)!;
      const palm = hand.localToWorld(new THREE.Vector3(0, -.07, .005));
      const target = new THREE.Vector3(h.center.x + bowl.x + Math.cos(bowl.yaw) * side * .455,
        h.center.y - 1 + bowl.y + .28, h.center.z + bowl.z - Math.sin(bowl.yaw) * side * .455);
      const gap = palm.distanceTo(target); t.diagnostic(JSON.stringify({ arrival, side, gap }));
      assert.ok(gap < .10, 'a carried bowl cannot float beyond a child’s actual arm reach');
    }
  }
});

test('the bowl stays above the tabletop until clear and does not jump when Sati turns away', t => {
  const h = setup(t), state = newOracleLast(0, 61), top = ORACLE_LAST.table;
  let previous: ReturnType<typeof oracleLastBowl> | undefined;
  for (let arrival = 0; arrival <= 28; arrival += .025) {
    state.arrival = arrival; const bowl = oracleLastBowl(state);
    const overTable = Math.abs(bowl.x - top.x) < top.width / 2 + .44 && Math.abs(bowl.z - top.z) < top.depth / 2 + .44;
    if (overTable) assert.ok(bowl.y + .02 >= top.height - .015, 'the carried bowl cannot be lowered through the tabletop');
    if (previous) assert.ok(Math.hypot(bowl.x - previous.x, bowl.y - previous.y, bowl.z - previous.z) < .09, 'bowl and body turn continuously');
    previous = bowl;
  }
});

test('the seated kitchen dress covers the actual knees and hangs in front of the chair with planted shoes', t => {
  const h = setup(t), rig = h.rigs.oracle;
  for (const elapsed of [0, 7, 20, 30]) {
    h.pose('oracle', 28, elapsed);
    const dress = rig.root.getObjectByName('oracle-last-dress') as THREE.Mesh;
    for (const ankle of rig.ankles) {
      const bounds = new THREE.Box3().setFromObject(ankle);
      assert.ok(bounds.min.y >= h.center.y - 1 - .02 && bounds.min.y < h.center.y - 1 + .09, 'both actual shoe soles stay on the kitchen floor');
    }
    for (const knee of rig.knees) {
      const point = knee.getWorldPosition(new THREE.Vector3());
      const hit = new THREE.Raycaster(point.clone().add(new THREE.Vector3(0, 0, 3)), new THREE.Vector3(0, 0, -1)).intersectObject(dress)[0];
      assert.ok(hit && hit.point.z > point.z + .10, 'the visible skirt must cover the bent knee surface');
    }
    const vertices = dress.geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const point = dress.localToWorld(new THREE.Vector3().fromBufferAttribute(vertices, i));
      assert.ok(point.y >= h.center.y - 1 + .04, 'the skirt remains above the floor');
      if (point.y < h.center.y - 1 + ORACLE_LAST.oracle.seat) assert.ok(point.z > h.center.z + ORACLE_LAST.oracle.z + .85, 'lower fabric cannot occupy the chair seat');
    }
  }
});

test('a saved kitchen pose does not drift with browser animation time and clears wrist/garment overrides on leaving', t => {
  const h = setup(t);
  for (const role of ['oracle', 'sati'] as const) {
    const rig = h.rigs[role]; h.pose(role, 11, 0, 0);
    const joints = [rig.torso, rig.head, ...rig.hips, ...rig.knees, ...rig.ankles, ...rig.shoulders, ...rig.elbows];
    const before = joints.map(joint => joint.matrixWorld.elements.slice()); h.pose(role, 11, 0, .05);
    assert.deepEqual(joints.map(joint => joint.matrixWorld.elements.slice()), before, 'paused or restored motion uses the saved clock');
  }
  h.pose('oracle', 28, 20); const rig = h.rigs.oracle;
  h.models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }, 0);
  assert.equal(rig.root.getObjectByName('oracle-last-dress')!.visible, false);
  for (const side of ['R', 'L']) assert.ok(rig.root.getObjectByName(`oracle-hand-${side}`)!.quaternion.angleTo(new THREE.Quaternion()) < 1e-7, 'a later scene cannot inherit the kitchen wrist pose');
});

test('the kitchen sink is visibly open rather than containing an uncut countertop plane', t => {
  const h = setup(t), renderer = new FilmSetRenderer(new THREE.Scene());
  const actor = h.world.agents.get('neo')!; actor.currentLocation = 'film_oracle_home';
  actor.position = { x: h.center.x, y: h.center.y, z: h.center.z - 10 };
  const state = newOracleLast(0, 61);
  const journey = { version: 1, scene: 'm3_oracle_last', actor: 'neo', step: 0, enteredAt: 0, completed: [], reflections: {}, checkpoint: actor.position, lastText: '', oracleLast: state };
  try {
    renderer.update(actor, { neoLife: { journey }, structures: [] } as never, 0); renderer.root.updateWorldMatrix(true, true);
    // Offset from the faucet: its arched spout correctly occupies the center ray.
    const origin = new THREE.Vector3(h.center.x + ORACLE_LAST.wash.x + .25, h.center.y - 1 + 4, h.center.z - 26.7);
    const hits = new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0), 0, 2).intersectObject(renderer.root, true)
      .filter(hit => { for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) if (!object.visible) return false; return true; });
    t.diagnostic(JSON.stringify(hits.map(hit => ({ name: hit.object.name, point: hit.point.toArray() }))));
    const basin = hits.find(hit => hit.object.name === 'oracle-handwash-basin'); assert.ok(basin, 'the actual sink floor must be visible');
    assert.ok(hits.every(hit => hit.object.name === 'oracle-handwash-basin' || hit.point.y <= basin.point.y + .001), 'marble cannot cover the basin interior');
  } finally { renderer.dispose(); }
});
