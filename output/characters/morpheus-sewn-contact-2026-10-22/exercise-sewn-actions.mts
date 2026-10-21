import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { model } from './release/output/characters/morpheus-upper-coat-2026-10-18/mesh-fixture.mjs';
import { advanceMotion, newMotion, type MotionInput } from './release/packages/client/src/agents/CharacterMotion.js';
import { PLAYER_JUMP_SPEED, PLAYER_GRAVITY } from './release/packages/shared/dist/index.js';

const h = await model(), results: unknown[] = [];
for (const profile of ['jab', 'cross', 'kick', 'palm', 'guard', 'hit', 'armed-run', 'jump'] as const) {
  const state = newMotion(); let frame = 0;
  try {
    for (; frame < 90; frame++) {
      const time = frame / 60, height = profile === 'jump' ? Math.max(0, PLAYER_JUMP_SPEED * time - PLAYER_GRAVITY * time * time / 2) : 0;
      h.rig.root.position.y = height;
      const input: MotionInput = { speed: profile === 'armed-run' ? 8.4 : 0, turn: 0, grounded: height === 0,
        verticalVelocity: height > 0 ? PLAYER_JUMP_SPEED - PLAYER_GRAVITY * time : 0, ambushWardrobe: 'coat',
        ...(['jab', 'cross', 'kick'].includes(profile) ? { attack: 1, combo: ['jab', 'cross', 'kick'].indexOf(profile) } : {}),
        ...(profile === 'palm' || profile === 'guard' ? { cast: 1, skill: profile === 'palm' ? 'crushing_palm' as const : 'iron_guard' as const } : {}),
        ...(profile === 'hit' ? { hit: 1, impact: 1 } : {}), armed: profile === 'armed-run' };
      h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
      for (const { mesh } of h.rig.panels) {
        assert.equal(mesh.geometry.index!.count / 3, 3120);
        assert.ok(Array.from(mesh.geometry.attributes.position.array).every(Number.isFinite));
      }
    }
    results.push({ profile, frames: frame, success: true });
  } catch (error) {
    results.push({ profile, frame, success: false, error: (error as Error).message, fixture: (error as any).fixture }); process.exitCode = 1;
  }
}
await writeFile('sewn-action-smoke.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.map(({ fixture, ...result }: any) => result), null, 2)); h.models.dispose();
