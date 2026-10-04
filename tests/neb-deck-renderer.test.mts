import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { CABIN, CABIN_ROUTE, cabinBodyPose, FILM_SETS, MEDICAL_OPERATOR, RECOVERY_BED, recoveryCrewPose, filmObstacles, filmPosition, playerBlocked, type FilmJourney } from '@auto_matrix/shared';
import { NebDeckRenderer } from '../packages/client/src/engine/NebDeckRenderer.js';
import { LightingSystem } from '../packages/client/src/engine/LightingSystem.js';

test('recovery and cabin shadows follow the current room rather than the whole deck', () => {
  const scene = new THREE.Scene(), root = new THREE.Group(), actor = new THREE.Group();
  const center = FILM_SETS.film_neb_deck.center; root.position.set(center.x, center.y - 1, center.z); scene.add(root, actor);
  const renderer = new NebDeckRenderer(root); const lighting = new LightingSystem(scene);
  try {
    const names = ['neb-medical-key-light', 'neb-cabin-key-light', 'neb-core-key-light'];
    const rooms = [
      { scene: 'm1_recovery', step: 0, x: -7, z: -22, key: 0 },
      { scene: 'm1_cabin', step: 0, x: 12, z: -34, key: 1 },
      { scene: 'm1_cabin', step: 1, x: 0, z: -19, key: 0 },
      { scene: 'm1_cabin', step: 2, x: 6.5, z: -5, key: 2 },
    ];
    for (const room of rooms) {
      const journey = { scene: room.scene, step: room.step } as FilmJourney;
      actor.position.set(center.x + room.x, center.y - 1, center.z + room.z);
      renderer.update(journey, 0, actor); scene.updateMatrixWorld(true);
      const keys = names.map(name => root.getObjectByName(name) as THREE.SpotLight | undefined);
      assert.ok(keys.every(key => key instanceof THREE.SpotLight), 'each occupied ship space needs a bounded fixture shadow');
      assert.deepEqual(keys.map(key => key!.castShadow), names.map((_, i) => i === room.key), 'only the current room renders a shadow map');
      const key = keys[room.key]!; key.shadow.updateMatrices(key);
      const nearby = new THREE.Sphere(new THREE.Vector3(center.x + room.x, center.y + .5, center.z + room.z), 1.5);
      assert.ok(key.shadow.getFrustum().intersectsSphere(nearby), 'the light must retain the actor and furniture contact shadows');
      const distant = new THREE.Sphere(new THREE.Vector3(center.x, center.y + .5, center.z + 25), 2);
      assert.equal(key.shadow.getFrustum().intersectsSphere(distant), false, 'offscreen mess crew cannot enter the room shadow draw list');
    }
    renderer.update({ scene: 'm1_construct', step: 0 } as FilmJourney, 0, actor);
    for (const name of names) assert.equal(root.getObjectByName(name)!.visible, false, 'room keys leave with the recovery route');
  } finally { renderer.dispose(); lighting.dispose(); }
});

test('local interior shadows preserve fill light and restore outdoor sunlight after leaving the ship', () => {
  const scene = new THREE.Scene(), lighting = new LightingSystem(scene), camera = new THREE.PerspectiveCamera();
  try {
    lighting.setTime(12000); lighting.update(0, camera, true);
    assert.equal(lighting.directionalLight.castShadow, false, 'a sealed ship cannot redraw every actor into a sunlight shadow map');
    assert.ok(lighting.directionalLight.intensity > 0 && lighting.ambientLight.intensity > 0, 'the change must preserve existing fill rather than blacken the scene');
    lighting.update(0, camera);
    assert.equal(lighting.directionalLight.castShadow, true, 'returning to an outdoor scene restores sunlight shadows');
    lighting.update(0, undefined, true); lighting.update(0);
    assert.equal(lighting.directionalLight.castShadow, true, 'observer mode also restores the outdoor map');
  } finally { lighting.dispose(); }
});

test('room shadows cover the escort and chair approach continuously across both room boundaries', () => {
  const scene = new THREE.Scene(), root = new THREE.Group(), actor = new THREE.Group();
  const center = FILM_SETS.film_neb_deck.center; root.position.set(center.x, center.y - 1, center.z); scene.add(root, actor);
  const renderer = new NebDeckRenderer(root);
  const awake = cabinBodyPose(12);
  const routes = [CABIN_ROUTE, [{ x: awake.x, z: awake.z }, ...CABIN_ROUTE.slice(0, 7), { x: 0, z: -5 }, CABIN.approach]];
  // Feet and standing body points must lie inside the actual spot cone, not merely touch its bounding frustum.
  const offsets = [[0, .05, 0], [.4, .05, 0], [-.4, .05, 0], [0, .05, .4], [0, .05, -.4], [0, 2, 0], [0, 4.2, 0]];
  try {
    for (const route of routes) for (let segment = 1; segment < route.length; segment++) {
      const a = route[segment - 1], b = route[segment], frames = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .25);
      for (let frame = 0; frame <= frames; frame++) {
        const x = THREE.MathUtils.lerp(a.x, b.x, frame / frames), z = THREE.MathUtils.lerp(a.z, b.z, frame / frames);
        actor.position.set(center.x + x, center.y - 1, center.z + z);
        renderer.update({ scene: 'm1_cabin', step: 1 } as FilmJourney, 0, actor); scene.updateMatrixWorld(true);
        const keys = ['neb-medical-key-light', 'neb-cabin-key-light', 'neb-core-key-light']
          .map(name => root.getObjectByName(name) as THREE.SpotLight).filter(light => light.castShadow);
        assert.equal(keys.length, 1, 'walking must keep only one bounded shadow map active');
        const light = keys[0], origin = light.getWorldPosition(new THREE.Vector3()); light.shadow.updateMatrices(light);
        const direction = light.target.getWorldPosition(new THREE.Vector3()).sub(origin).normalize();
        for (const [dx, y, dz] of offsets) {
          const point = new THREE.Vector3(center.x + x + dx, center.y - 1 + y, center.z + z + dz);
          const ray = point.clone().sub(origin);
          assert.ok(light.shadow.getFrustum().containsPoint(point) && ray.length() < light.distance && direction.dot(ray.normalize()) > Math.cos(light.angle),
            `${light.name} misses the body or ground at ${x}, ${z} with offset ${dx}, ${y}, ${dz}`);
        }
        const mess = new THREE.Sphere(new THREE.Vector3(center.x, center.y + .5, center.z + 25), 2);
        assert.equal(light.shadow.getFrustum().intersectsSphere(mess), false, 'covering the route must not bring distant mess crew into the shadow map');
      }
    }
    renderer.update({ scene: 'm1_recovery', step: 0 } as FilmJourney, 0, actor); scene.updateMatrixWorld(true);
    const medical = root.getObjectByName('neb-medical-key-light') as THREE.SpotLight; medical.shadow.updateMatrices(medical);
    const origin = medical.getWorldPosition(new THREE.Vector3()), direction = medical.target.getWorldPosition(new THREE.Vector3()).sub(origin).normalize();
    for (const elapsed of [0, 8, 12]) for (const helper of [MEDICAL_OPERATOR, recoveryCrewPose({ role: 'morpheus', elapsed }), recoveryCrewPose({ role: 'trinity', elapsed })]) {
      for (const y of [.05, 4.2]) {
        const point = new THREE.Vector3(center.x + helper.x, center.y - 1 + y, center.z + helper.z), ray = point.clone().sub(origin);
        assert.ok(medical.shadow.getFrustum().containsPoint(point) && ray.length() < medical.distance && direction.dot(ray.normalize()) > Math.cos(medical.angle),
          'returning to treatment must restore the bed helpers’ shadows instead of retaining the escort aim');
      }
    }
  } finally { renderer.dispose(); }
});

test('the Nebuchadnezzar recovery set has a solid medical bed, moving needle gantry and open route to the core', () => {
  const root = new THREE.Group(); const renderer = new NebDeckRenderer(root); root.updateMatrixWorld(true);
  try {
    const bed = root.getObjectByName('neb-medical-bed');
    const gantry = root.getObjectByName('neb-recovery-gantry');
    assert.ok(bed, 'the recovery sequence needs a visible bed');
    assert.ok(gantry, 'the needles need a physical support instead of a text prompt');
    assert.ok(root.getObjectByName('neb-core-chair-neo'));
    assert.ok(root.getObjectByName('neb-core-chair-morpheus'));
    const medicalLight = root.getObjectByName('neb-medical-task-light') as THREE.PointLight | undefined;
    assert.ok(medicalLight, 'the recovery bed needs dedicated task lighting');
    assert.ok(medicalLight.intensity >= 200, 'physical lighting must keep Neo and the needles readable');
    const ray = new THREE.Raycaster(new THREE.Vector3(RECOVERY_BED.x, 7, RECOVERY_BED.z), new THREE.Vector3(0, -1, 0), 0, 8);
    assert.ok(ray.intersectObject(bed!, true).length > 0, 'the body must lie on rendered geometry');
    const journey = { version: 1, scene: 'm1_recovery', step: 0, actor: 'neo', completed: [], enteredAt: 0,
      checkpoint: filmPosition('film_neb_deck', RECOVERY_BED.x, RECOVERY_BED.z), reflections: {}, lastText: '',
      awakening: { kind: 'recovery', elapsed: 0, started: true } } satisfies FilmJourney;
    renderer.update(journey, 0); const raised = gantry!.position.y;
    journey.awakening.elapsed = 4; renderer.update(journey, 4);
    assert.ok(gantry!.position.y < raised - .5, 'the saved recovery clock lowers the needle rack toward Neo');
    journey.awakening.elapsed = 10; renderer.update(journey, 10); root.updateMatrixWorld(true);
    assert.ok(gantry!.position.y > raised + 5, 'the frame retracts before Neo stands');
    const obstacles = filmObstacles(FILM_SETS.film_neb_deck);
    assert.ok(obstacles.some(item => Math.abs(item.x - RECOVERY_BED.x) < .1 && Math.abs(item.z - RECOVERY_BED.z) < .1));
    assert.equal(playerBlocked(filmPosition('film_neb_deck', RECOVERY_BED.standingX, RECOVERY_BED.z), false), false, 'Neo can stand beside the bed');
    for (const z of [-15, -8, 0]) assert.equal(playerBlocked(filmPosition('film_neb_deck', 0, z), false), false, `the central aisle stays open at ${z}`);
  } finally { renderer.dispose(); }
});

test('the recovery frame and needles remain still when only the render clock advances', () => {
  const root = new THREE.Group(); const renderer = new NebDeckRenderer(root);
  const journey = { scene: 'm1_recovery', awakening: { kind: 'recovery', elapsed: 4, started: true } } as FilmJourney;
  const capture = () => {
    root.updateMatrixWorld(true);
    return ['neb-recovery-gantry', ...Array.from({ length: 12 }, (_, i) => `neb-medical-needle-tip-${i}`)]
      .map(name => root.getObjectByName(name)!.matrixWorld.toArray());
  };
  try {
    renderer.update(journey, 4); const paused = capture(); renderer.update(journey, 85);
    assert.deepEqual(capture(), paused, 'a paused or restored treatment must retain exactly the same contacts');
  } finally { renderer.dispose(); }
});

test('both recovery helpers go around the bed before supporting Neo from the aisle', () => {
  for (const role of ['morpheus', 'trinity'] as const) for (let frame = 0; frame <= 120; frame++) {
    const pose = recoveryCrewPose({ role, elapsed: frame / 10 });
    assert.equal(playerBlocked(filmPosition('film_neb_deck', pose.x, pose.z), false, .55), false,
      `${role} enters a solid prop at ${frame / 10}s`);
  }
});

test('the recovery needle tips follow Neo’s posed body instead of stopping above the mattress', () => {
  const root = new THREE.Group(); const renderer = new NebDeckRenderer(root);
  const neo = new THREE.Group();
  const chest = new THREE.Bone(); chest.name = 'chest'; chest.position.set(RECOVERY_BED.x, 2.28, RECOVERY_BED.z - .72); neo.add(chest);
  const journey = { version: 1, scene: 'm1_recovery', step: 0, actor: 'neo', completed: [], enteredAt: 0,
    checkpoint: filmPosition('film_neb_deck', RECOVERY_BED.x, RECOVERY_BED.z), reflections: {}, lastText: '',
    awakening: { kind: 'recovery', elapsed: 4, started: true } } satisfies FilmJourney;
  try {
    neo.updateMatrixWorld(true); renderer.update(journey, 4, neo); root.updateMatrixWorld(true);
    const tip = root.getObjectByName('neb-medical-needle-tip-0');
    assert.ok(tip, 'the first medical needle needs a separately animated contact tip');
    const expected = chest.localToWorld(new THREE.Vector3(-.24, .08, .06));
    const contact = tip!.getWorldPosition(new THREE.Vector3());
    assert.ok(contact.distanceTo(expected) < .035, `needle tip must meet the posed chest: ${contact.toArray()} vs ${expected.toArray()}`);
    const shaft = root.getObjectByName('neb-medical-needle-0')!;
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(shaft.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(Math.abs(axis.dot(new THREE.Vector3(0, 1, 0))) > .96, `the sliding carriage must keep the needle nearly vertical, not crossed over the body: ${axis.toArray()}`);
  } finally { renderer.dispose(); }
});
