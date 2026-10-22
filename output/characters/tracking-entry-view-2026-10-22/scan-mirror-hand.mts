import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MIRROR_SEAT, PILL_ROOM } from './candidate-release/packages/shared/dist/index.js';
import { newMotion, advanceMotion } from './candidate-release/packages/client/src/agents/CharacterMotion.js';
import { actor } from './candidate-release/tests/helpers/fighting-hand-fixture.mjs';
import { handSurface } from './candidate-release/tests/helpers/hand-surface.mjs';

// Offline acceptance only: complete surfaces, not just selected joints.
const h = await actor('neo');
h.rig.root.position.set(MIRROR_SEAT.x, -1, MIRROR_SEAT.z); h.rig.root.rotation.y = Math.PI;
const surfaces = Object.fromEntries(['R', 'L'].map(side => [side, handSurface(h.rig, side)]));
const ages = [...new Set([0, .65, 1.35, 2.203, 2.75, 3.45, 3.8, 4.65, 5.1, 5.8, 6.3, 7.2,
  ...Array.from({ length: 51 }, (_, i) => Number((2.6 + i * .05).toFixed(2)))])].sort((a, b) => a - b);
const frames: object[] = [];
try {
  for (const mirrorBeat of ages) {
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, seated: mirrorBeat >= 1.35, performance: 'touch' as const, mirrorBeat };
    const motion = newMotion(); h.models.animate(h.rig, advanceMotion(motion, input, 0), motion, input, 0); h.rig.root.updateMatrixWorld(true);
    for (const side of ['R', 'L']) {
      const result = surfaces[side].draw(); assert.equal(result.self.count, 0, `${side}/${mirrorBeat}: ${JSON.stringify(result.self)}`);
      const wrist = h.rig.bones.get(`wrist_${side}`)!;
      const digits = new Map<number, number>();
      for (const [id, point] of result.points) {
        point.applyMatrix4(wrist.matrixWorld);
        const digit = surfaces[side].group.digits[id]; digits.set(digit, Math.min(digits.get(digit) ?? Infinity, point.z - PILL_ROOM.mirror.z));
      }
      if (side === 'R' && mirrorBeat >= 2.75 && mirrorBeat <= 4.2)
        assert.ok(Math.min(...digits.values()) > -.015, `skin crosses glass at ${mirrorBeat}`);
      frames.push({ mirrorBeat, side, vertices: result.points.size, faces: surfaces[side].triangles.length, selfIntersections: result.self.count,
        worldMirrorGapByDigit: Object.fromEntries(digits) });
    }
  }
  console.log(JSON.stringify({ poses: ages.length, completeHandSurfaces: frames.length, frames }, null, 2));
} finally { h.models.dispose(); }
