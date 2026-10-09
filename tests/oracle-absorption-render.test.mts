import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, ORACLE_LAST, newOracleAbsorption, oracleAbsorptionRoot, oracleAbsorptionCookie, type OracleAbsorptionGesture } from '@auto_matrix/shared';
import { RevolutionsPreludeRenderer } from '../packages/client/src/engine/RevolutionsPreludeRenderer.js';
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
