import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, ORACLE_LAST, newOracleAbsorption, oracleAbsorptionRoot, oracleAbsorptionCookie, oracleAbsorptionPlate, type OracleAbsorptionGesture } from '@auto_matrix/shared';
import { RevolutionsPreludeRenderer } from '../packages/client/src/engine/RevolutionsPreludeRenderer.js';
import { OracleAbsorptionRenderer } from '../packages/client/src/engine/OracleAbsorptionRenderer.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('the blackout reaches actual building corridor lights one by one and stays fixed while the saved clock is paused', () => {
  const root = new THREE.Group(), renderer = new RevolutionsPreludeRenderer(root, 'm3_oracle_absorbed');
  const state = newOracleAbsorption(1, 47); state.phase = 'escaping'; state.escape = 19;
  const journey = { scene: 'm3_oracle_absorbed', actor: 'oracle', step: 1, oracleAbsorption: state } as never;
  try {
    renderer.update(journey, 1);
    const lights: THREE.PointLight[] = []; root.traverse(object => { if (object instanceof THREE.PointLight && object.name.startsWith('oracle-corridor-light-')) lights.push(object); });
    assert.equal(lights.length, 4); assert.ok(lights.every(light => light.position.z > 30), 'lights belong in the corridor outside the apartment');
    assert.ok(lights.some(light => light.intensity === 0) && lights.some(light => light.intensity > 0), 'blackout progresses spatially');
    const before = lights.map(light => light.intensity); renderer.update(journey, 200); assert.deepEqual(lights.map(light => light.intensity), before);
    assert.equal(root.getObjectByName('oracle-code-intrusion'), undefined, 'a surrounding particle cloud cannot replace bodily assimilation');
  } finally { renderer.dispose(); }
});

test('the child and guard exit along the clear aisle rather than crossing the table or side chair', () => {
  const state = newOracleAbsorption(1, 47);
  for (const role of ['sati', 'seraph'] as const) for (let escape = 0; escape <= 23; escape += .025) {
    state.escape = escape; const root = oracleAbsorptionRoot(state, role), radius = role === 'sati' ? .28 : .48;
    for (const obstacle of [ORACLE_LAST.table, { ...ORACLE_LAST.chairs[1], width: 1.7, depth: 1.7 }]) {
      assert.ok(Math.abs(root.x - obstacle.x) > obstacle.width / 2 + radius || Math.abs(root.z - obstacle.z) > obstacle.depth / 2 + radius,
        `${role} cannot walk through furniture at ${escape}`);
    }
  }
});

test('the actual spinning plate and cookies clear the table and break at the floor', t => {
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const root = new THREE.Group(), props = new OracleAbsorptionRenderer(root), state = newOracleAbsorption(3, 47), table = ORACLE_LAST.table;
  state.phase = 'confrontation';
  let lastClearance = Infinity, broken = false;
  try {
    for (let elapsed = 0; elapsed <= 2; elapsed += .005) {
      state.invasion = 21.2 + elapsed; props.update(state); root.updateMatrixWorld(true);
      if (!props.plate.visible) { broken = true; break; }
      lastClearance = Infinity;
      props.plate.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (let i = 0; i < object.geometry.attributes.position.count; i++) {
          const point = object.localToWorld(object.getVertexPosition(i, new THREE.Vector3()));
          const penetration = Math.min(table.width / 2 - Math.abs(point.x - table.x), table.depth / 2 - Math.abs(point.z - table.z), table.height - point.y, point.y);
          assert.ok(penetration < .02, `plate/cookie enters the table at ${elapsed}s by ${penetration}m`);
          lastClearance = Math.min(lastClearance, point.y);
        }
      });
      assert.ok(lastClearance >= -.005, `plate/cookie enters the floor at ${elapsed}s by ${-lastClearance}m`);
    }
    assert.ok(broken, 'the plate must eventually hit the floor');
    assert.ok(lastClearance < .05, `the plate cannot shatter ${lastClearance}m above the floor`);
  } finally { props.dispose(); }
});

test('the fragments stay around the actual impact and restore from the saved invasion clock', t => {
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const root = new THREE.Group(), props = new OracleAbsorptionRenderer(root), restored = new OracleAbsorptionRenderer(root), state = newOracleAbsorption(3, 47);
  state.phase = 'confrontation'; state.invasion = 24;
  try {
    props.update(state); root.updateMatrixWorld(true);
    const impact = oracleAbsorptionPlate(state), fragments = props.root.children.find(child => child.visible && child.children.length === 14)!;
    assert.ok(fragments, 'the landed plate exposes its fragments');
    const positions = fragments.children.map(child => child.getWorldPosition(new THREE.Vector3()).toArray());
    for (const [x, y, z] of positions) {
      assert.ok(Math.hypot(x - impact.x, z - impact.z) < 1.4, 'fragments cannot appear at an unrelated point under the table');
      assert.ok(y >= 0 && y < .12, 'fragments must rest on the kitchen floor');
      assert.ok(Math.abs(x - ORACLE_LAST.table.x) > ORACLE_LAST.table.width / 2 || Math.abs(z - ORACLE_LAST.table.z) > ORACLE_LAST.table.depth / 2);
    }
    restored.update(JSON.parse(JSON.stringify(state))); root.updateMatrixWorld(true);
    const cold = restored.root.children.find(child => child.visible && child.children.length === 14)!;
    assert.deepEqual(cold.children.map(child => child.getWorldPosition(new THREE.Vector3()).toArray()), positions);
    state.invasion = 44; props.update(state); root.updateMatrixWorld(true);
    assert.deepEqual(fragments.children.map(child => child.getWorldPosition(new THREE.Vector3()).toArray()), positions, 'landed fragments cannot slide with later dialogue');
  } finally { props.dispose(); restored.dispose(); }
});

test('Sati’s actual palm holds the departing cookie and the saved pose does not drift with render time', t => {
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  t.after(() => { globalThis.document = previous; });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const models = new CharacterModels(), rig = models.create(world.agents.get('sati')!), center = FILM_SETS.film_oracle_home.center;
  try {
    for (const escape of [0, 5, 17, 22]) {
      const gesture: OracleAbsorptionGesture = { ...newOracleAbsorption(1, 47), role: 'sati', phase: 'escaping', escape };
      const root = oracleAbsorptionRoot(gesture, 'sati'); rig.root.position.set(center.x + root.x, center.y - 1, center.z + root.z); rig.root.rotation.y = root.yaw;
      const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, oracleAbsorption: gesture };
      models.animate(rig, 0, input, 0); rig.root.updateWorldMatrix(true, true);
      const palm = rig.root.getObjectByName('sati-hand--1')!.localToWorld(new THREE.Vector3(0, -.07, .005));
      const cookie = oracleAbsorptionCookie(gesture), target = new THREE.Vector3(center.x + cookie.x, center.y - 1 + cookie.y, center.z + cookie.z);
      const gap = palm.distanceTo(target); t.diagnostic(JSON.stringify({ escape, gap })); assert.ok(gap < .10, 'food stays within the delivered hand’s reach');
      const before = [rig.torso, ...rig.shoulders, ...rig.elbows].map(joint => joint.matrixWorld.elements.slice());
      models.animate(rig, .05, input, 0); rig.root.updateWorldMatrix(true, true);
      assert.deepEqual([rig.torso, ...rig.shoulders, ...rig.elbows].map(joint => joint.matrixWorld.elements.slice()), before);
    }
  } finally { models.dispose(); }
});
