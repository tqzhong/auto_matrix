import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, filmPosition, gardenPose, groundHeight, newTrilogyEpilogue, playerBlocked, stepPlayer, stepTrilogyEpilogue, type TrilogyEpilogueEncounter } from '@auto_matrix/shared';
import { SunriseGardenRenderer } from '../packages/client/src/engine/SunriseGardenRenderer.js';

test('the park approach is a rendered rolling lawn with the same support height as walking physics', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const park = new SunriseGardenRenderer(new THREE.Group()); t.after(() => park.dispose());
  park.group.updateMatrixWorld(true);
  const lawn = park.group.getObjectByName('park-mown-lawn')!, center = FILM_SETS.film_sunrise_garden.center;
  const peak = filmPosition('film_sunrise_garden', 0, 20);
  assert.ok(peak.y > center.y + 1.5, 'the arrival needs a real low hill, rather than another perfectly flat plane');
  for (const [x, z] of [[0, 20], [11, 9], [14, 14], [4, -2], [-9, 36], [20, 49]]) {
    const position = filmPosition('film_sunrise_garden', x, z);
    const support = new THREE.Raycaster(new THREE.Vector3(x, 15, z), new THREE.Vector3(0, -1, 0)).intersectObject(lawn)[0];
    assert.ok(support && Math.abs(support.point.y - (groundHeight(position, true) - center.y)) < .025,
      `${x}/${z}: the rendered lawn and shared character support disagree`);
  }
  assert.equal(filmPosition('film_sunrise_garden', 0, 35.2).y, center.y, 'an old ready save must not be buried by the new hill');
  assert.equal(filmPosition('film_sunrise_garden', -7, -20).y, center.y, 'the seated ending keeps its original bench height');
  for (let z = 35.2; z > -25; z -= .4)
    assert.equal(playerBlocked(filmPosition('film_sunrise_garden', 0, z), true, 1.2), false, 'the grove must preserve the playable route from an old ready spawn');
});

test('walking uphill and downhill remains planted at the next position, while an intentional jump still leaves the hill', () => {
  const center = FILM_SETS.film_sunrise_garden.center;
  assert.ok(filmPosition('film_sunrise_garden', 0, 20).y > center.y + 1.5, 'exercise an actual hill');
  for (const direction of [-1, 1]) {
    let position = filmPosition('film_sunrise_garden', 0, direction === 1 ? 2 : 27), vertical = 0;
    for (let i = 0; i < 100; i++) {
      const next = stepPlayer(position, vertical, { x: 0, z: direction, yaw: 0, sprint: false, jump: false, sequence: i }, .05, true);
      position = next.position; vertical = next.verticalVelocity;
      assert.ok(Math.abs(position.y - groundHeight(position, true)) < .00001, `walk ${direction}/${i}: floating or penetrating the slope`);
      assert.equal(vertical, 0, 'walking down the park hill must not alternate falling and landing');
    }
  }
  const start = filmPosition('film_sunrise_garden', 0, 20);
  let next = stepPlayer(start, 0, { x: 0, z: 0, yaw: 0, sprint: false, jump: true, sequence: 1 }, .05, true);
  assert.ok(next.position.y > groundHeight(next.position, true) + .4, 'ground support cannot cancel a deliberate jump');
  for (let i = 0; i < 40; i++) next = stepPlayer(next.position, next.verticalVelocity, { x: 0, z: 0, yaw: 0, sprint: false, jump: false, sequence: i + 2 }, .05, true);
  assert.equal(next.position.y, start.y); assert.equal(next.verticalVelocity, 0);
});

test('new Sati and Seraph arrivals approach from the hill, while unversioned saves retain their route and clock', () => {
  const encounter = { ...newTrilogyEpilogue('dawn'), phase: 'sati' as const };
  for (const role of ['sati', 'seraph'] as const) {
    assert.ok(gardenPose(encounter, role).z > 5, `${role} should emerge from the park behind the bench`);
    for (let elapsed = 0; elapsed <= 12; elapsed += .2) {
      const pose = gardenPose({ ...encounter, elapsed }, role), position = filmPosition('film_sunrise_garden', pose.x, pose.z);
      assert.equal(playerBlocked(position, true, 1.2), false, `${role}/${elapsed}: the new walking route intersects scenery`);
      assert.ok(Math.abs(position.y - groundHeight(position, true)) < 1e-9, `${role}/${elapsed}: simulation must use the rendered hill`);
      assert.deepEqual(gardenPose(JSON.parse(JSON.stringify({ ...encounter, elapsed })), role), pose, 'loading cannot change the saved approach');
    }
  }
  let playing: TrilogyEpilogueEncounter = encounter;
  for (let i = 0; i < 119; i++) playing = stepTrilogyEpilogue(playing, .1);
  assert.equal(playing.phase, 'sati'); playing = stepTrilogyEpilogue(playing, .1); assert.equal(playing.phase, 'sunrise');
  const old: TrilogyEpilogueEncounter = { kind: 'dawn', phase: 'sati', elapsed: 2.4, total: 15.1 };
  for (const [role, x, z, yaw] of [['sati', 3.7, -25.5, -1.2], ['seraph', 6.15, -23.2, Math.atan2(-15.7, 9.6)]] as const) {
    const pose = gardenPose(old, role);
    assert.ok(Math.abs(pose.x - x) < 1e-9 && Math.abs(pose.z - z) < 1e-9 && Math.abs(pose.yaw - yaw) < 1e-9);
    assert.equal(pose.walk, 1); assert.equal(pose.seated, 0);
  }
  assert.equal(stepTrilogyEpilogue({ ...old, elapsed: 9.1 }, .1).phase, 'sunrise', 'legacy saves retain the 9.2-second arrival');
});
