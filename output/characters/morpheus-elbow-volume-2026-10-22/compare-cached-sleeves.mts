import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import * as before from './before-cache-fixture.mjs';
import * as after from './mesh-fixture.mjs';
import { advanceMotion, newMotion, type MotionInput } from './release/packages/client/src/agents/CharacterMotion.js';
const actors = [await before.model(), await after.model()], results = [];
const base: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, ambushWardrobe: 'coat' };
const profiles: [string, Partial<MotionInput>][] = [
  ['idle', {}], ['run', { speed: 8.4 }], ['crouch', { crouching: true }],
  ['jab', { attack: 1, combo: 0 }], ['cross', { attack: 1, combo: 1 }], ['kick', { attack: 1, combo: 2 }],
  ['phone-right', { ambushCall: { role: 'morpheus', elapsed: 2.2 } }],
  ['phone-left', { ambushCall: { role: 'morpheus', elapsed: 7 } }], ['exit', { realWorld: true, ambushWardrobe: undefined }],
];
const digest = (actor: typeof actors[number]) => {
  const hash = createHash('sha256');
  actor.rig.root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    hash.update(object.name); hash.update(JSON.stringify(object.matrixWorld.elements));
    for (const name of ['position', 'normal', 'skinIndex', 'skinWeight']) {
      const a = object.geometry.attributes[name]; if (a) hash.update(Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength));
    }
  });
  return hash.digest('hex');
};
try {
  for (const [profile, patch] of profiles) {
    const states = actors.map(() => newMotion()), input = { ...base, ...patch };
    for (let frame = 0; frame < 60; frame++) {
      for (const [i, actor] of actors.entries()) {
        actor.rig.root.position.set(-3, 2, 4); actor.rig.root.rotation.y = .37;
        actor.models.animate(actor.rig, advanceMotion(states[i], input, 1 / 60), states[i], input, 1 / 60);
      }
      const hashes = actors.map(digest); assert.equal(hashes[0], hashes[1], `${profile}/${frame}: caching changes actual geometry, normals, weights or mesh transforms`);
    }
    results.push({ profile, frames: 60, byteIdentical: true }); console.log(profile, '60/60 exact');
  }
} finally { actors.forEach(actor => actor.models.dispose()); }
await writeFile(new URL('elbow-cache-equivalence.json', import.meta.url), JSON.stringify({ scope: 'base geometry attributes, skin indices/weights and mesh transforms; hand bone matrices are checked separately in the cold-pose regression', frames: results.length * 60, results }, null, 2) + '\n');
