import assert from 'node:assert/strict';
import test from 'node:test';
import { ambushCat, ambushFloor, ambushRouteLength, ambushRouteRoot, filmPosition, newAmbushApproach, playerBlocked } from '@auto_matrix/shared';

test('new entries use the doorway cat without moving the saved company route', () => {
  const approach = newAmbushApproach();
  assert.equal(approach.doorwayCat, true);
  assert.equal(approach.stairCat, true);
  const end = ambushRouteRoot(ambushRouteLength(undefined, approach.stairCat), undefined, approach.stairCat);
  assert.ok(Math.abs(end.x - 11) < 1e-7 && Math.abs(end.z - 31.8) < 1e-7 && Math.abs(end.y) < 1e-7);
});

// The optional third argument separates this correction from already-started
// saves, whose descending cat and elapsed time must remain compatible.
test('the new cat crosses level ground behind the doorway and repeats the same walk', () => {
  let lastZ = Infinity;
  for (let frame = 3; frame < 63; frame++) {
    const time = frame / 10, first = ambushCat(time, true, true), repeat = ambushCat(time + 6.8, true, true);
    assert.equal(first.visible, true);
    assert.ok(Math.abs(first.y) < 1e-7, 'the film cat stays on the landing instead of descending the stairs');
    assert.ok(Math.abs(ambushFloor(first.x, first.z, first.y)! - first.y) < 1e-7);
    assert.ok(first.x > 13, 'the cat walks behind the door, across Neo’s line of sight');
    assert.ok(first.z < lastZ, 'the cat continues in one direction without turning or stretching');
    lastZ = first.z;
    assert.equal(first.yaw, Math.PI / 2);
    for (const key of ['x', 'y', 'z', 'phase', 'yaw'] as const) assert.ok(Math.abs(first[key] - repeat[key]) < 1e-7, key);
    assert.equal(first.visible, repeat.visible);
  }
  for (const time of [0, .2, 6.3, 6.7, 6.9, 13.1, 13.4, 14.8]) assert.equal(ambushCat(time, true, true).visible, false, String(time));
});

test('started stair and corridor saves retain their previous cat paths', () => {
  const oldStairs = ambushCat(5.7, true), oldCorridor = ambushCat(2.8);
  assert.ok(oldStairs.y < -2 && oldStairs.z < 20, 'an existing descent must not be moved to the new doorway');
  assert.equal(oldCorridor.y, 0); assert.equal(oldCorridor.z, -23);
  assert.deepEqual(ambushCat(5.7, true, false), oldStairs);
  assert.deepEqual(ambushCat(2.8, false, false), oldCorridor);
});

test('the doorway recess has physical side walls and a traversable opening', () => {
  for (const z of [24.9, 32.5]) assert.equal(playerBlocked(filmPosition('film_ambush_house', 15, z), true, 1.1), true,
    'the side wall that hides the cat must also stop the player');
  for (let x = 11; x <= 17; x += .1) assert.equal(playerBlocked(filmPosition('film_ambush_house', x, 29.8), true, 1.1), false,
    `the real opening must remain accessible at x=${x}`);
});
