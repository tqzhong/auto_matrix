import assert from 'node:assert/strict';
import test from 'node:test';
import { lafayetteWelcomeRoot } from '@auto_matrix/shared';
import { lafayetteWelcomeCamera } from '../packages/client/src/player/LafayetteWelcomeCamera.js';

test('the Trinity exit shot keeps foreground furniture out of the sightline', () => {
  const furniture = [
    { x: 8, z: 5, halfWidth: 1.35, halfDepth: 1.65 },
    { x: 13, z: 10, halfWidth: 4.5, halfDepth: 2.15 },
  ];
  for (let elapsed = 0; elapsed < 3.65; elapsed += .05) {
    const gesture = { phase: 'departing' as const, elapsed, role: 'neo' as const };
    const shot = lafayetteWelcomeCamera(gesture);
    const trinity = lafayetteWelcomeRoot(gesture, 'trinity');
    assert.equal(shot.name, 'trinity-exit');
    assert.ok(Math.hypot(shot.focus.x - trinity.x, shot.focus.z - trinity.z) < .01);
    for (let sample = 0; sample <= 100; sample++) {
      const amount = sample / 100;
      const x = shot.ideal.x + (shot.focus.x - shot.ideal.x) * amount;
      const z = shot.ideal.z + (shot.focus.z - shot.ideal.z) * amount;
      for (const obstacle of furniture) {
        assert.ok(Math.abs(x - obstacle.x) > obstacle.halfWidth || Math.abs(z - obstacle.z) > obstacle.halfDepth,
          `furniture blocks the exit shot at ${elapsed.toFixed(2)}s`);
      }
    }
  }
});
