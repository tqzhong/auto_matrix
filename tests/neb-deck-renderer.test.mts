import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { CABIN, CABIN_ROUTE, cabinBodyPose, FILM_SETS, MEDICAL_OPERATOR, RECOVERY_BED, RECOVERY_FRAME, recoveryCrewPose, filmObstacles, filmPosition, playerBlocked, type FilmJourney } from '@auto_matrix/shared';
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

test('the recovery set has a solid medical bed, low bedside rails and an open route to the core', () => {
  const root = new THREE.Group(); const renderer = new NebDeckRenderer(root); root.updateMatrixWorld(true);
  try {
    const bed = root.getObjectByName('neb-medical-bed');
    const therapy = root.getObjectByName('neb-medical-therapy');
    assert.ok(bed, 'the recovery sequence needs a visible bed');
    assert.ok(therapy, 'treatment needs physical equipment instead of a text prompt');
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
    renderer.update(journey, 0);
    assert.equal(root.getObjectByName('neb-medical-needle-0')!.visible, false, 'waiting cannot start treatment');
    journey.awakening.elapsed = 4; renderer.update(journey, 4);
    assert.equal(root.getObjectByName('neb-medical-needle-0')!.visible, true);
    assert.equal(therapy!.position.y, 0, 'the apparatus stays beside the bed instead of hanging over Neo');
    const rail = root.getObjectByName('neb-medical-side-rail-1')!;
    assert.ok(Math.abs(new THREE.Box3().setFromObject(rail).max.y - RECOVERY_FRAME.height) < .001);
    const post = new THREE.Box3().setFromObject(root.getObjectByName('neb-medical-post-1-1')!);
    assert.ok(post.max.y <= new THREE.Box3().setFromObject(rail).min.y + .00001, 'post and painted rail cannot share a visible top face and flicker');
    journey.awakening.elapsed = 10; renderer.update(journey, 10); root.updateMatrixWorld(true);
    assert.equal(root.getObjectByName('neb-medical-needle-0')!.visible, false, 'the needles withdraw before the later scene');
    const obstacles = filmObstacles(FILM_SETS.film_neb_deck);
    assert.ok(obstacles.some(item => Math.abs(item.x - RECOVERY_BED.x) < .1 && Math.abs(item.z - RECOVERY_BED.z) < .1));
    const beside = filmPosition('film_neb_deck', RECOVERY_BED.x + RECOVERY_FRAME.halfWidth, RECOVERY_BED.z);
    assert.equal(playerBlocked(beside, false, .1), true, 'a player cannot pass through the visible bedside rail');
    beside.y += RECOVERY_FRAME.height + .1;
    assert.equal(playerBlocked(beside, false, .1), false, 'the removed overhead rack must not leave an invisible tall collider');
    assert.equal(playerBlocked(filmPosition('film_neb_deck', RECOVERY_BED.standingX, RECOVERY_BED.z), false), false, 'Neo can stand beside the bed');
    for (const z of [-15, -8, 0]) assert.equal(playerBlocked(filmPosition('film_neb_deck', 0, z), false), false, `the central aisle stays open at ${z}`);
  } finally { renderer.dispose(); }
});

test('the recovery needles and leads remain still when only the render clock advances', () => {
  const root = new THREE.Group(); const renderer = new NebDeckRenderer(root);
  const journey = { scene: 'm1_recovery', awakening: { kind: 'recovery', elapsed: 4, started: true } } as FilmJourney;
  const capture = () => {
    root.updateMatrixWorld(true);
    return { needles: Array.from({ length: 20 }, (_, i) => ['tip', 'carriage', 'signal'].map(part => root.getObjectByName(`neb-medical-needle-${part}-${i}`)!.matrixWorld.toArray())),
      leads: ['red', 'gray'].map(color => Array.from((root.getObjectByName(`neb-medical-${color}-leads`) as THREE.InstancedMesh).instanceMatrix.array)) };
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
    assert.ok(Math.abs(axis.dot(new THREE.Vector3(0, 1, 0))) > .96, `the short needle must stand out from the skin: ${axis.toArray()}`);
  } finally { renderer.dispose(); }
});

test('therapy uses short skin-mounted needles, blue hubs and flexible bedside leads rather than suspended rods', () => {
  const root = new THREE.Group(), renderer = new NebDeckRenderer(root), neo = new THREE.Group();
  const chest = new THREE.Bone(); chest.name = 'chest'; chest.position.set(RECOVERY_BED.x, 2.28, RECOVERY_BED.z - .72); neo.add(chest);
  const journey = { scene: 'm1_recovery', awakening: { kind: 'recovery', elapsed: 4, started: true } } as FilmJourney;
  try {
    renderer.update(journey, 4, neo); root.updateMatrixWorld(true);
    for (let i = 0; i < 20; i++) {
      const shaft = root.getObjectByName(`neb-medical-needle-${i}`) as THREE.Mesh;
      assert.ok(shaft, 'treatment also covers the cheeks and arms');
      const bounds = new THREE.Box3().setFromObject(shaft);
      assert.ok(bounds.max.y - bounds.min.y < .35, `needle ${i} is a long suspended rod`);
      const hub = root.getObjectByName(`neb-medical-needle-carriage-${i}`)!;
      const tip = root.getObjectByName(`neb-medical-needle-tip-${i}`)!;
      assert.ok(hub.getWorldPosition(new THREE.Vector3()).distanceTo(tip.getWorldPosition(new THREE.Vector3())) < .4);
      const signal = root.getObjectByName(`neb-medical-needle-signal-${i}`) as THREE.Mesh;
      assert.ok(signal?.visible, 'the skin-mounted connector needs a readable blue indicator');
      const color = (signal.material as THREE.MeshBasicMaterial).color;
      assert.ok(color.b > color.r * 2 && color.b > color.g, 'the indicators are blue, not green or amber');
    }
    const leads = root.getObjectByName('neb-medical-red-leads') as THREE.InstancedMesh;
    assert.ok(leads?.isInstancedMesh && leads.count > 20, 'curved insulated leads must connect the needles to bedside equipment');
    const matrix = new THREE.Matrix4(); leads.getMatrixAt(0, matrix);
    const start = leads.localToWorld(new THREE.Vector3(0, -.5, 0).applyMatrix4(matrix));
    const next = leads.localToWorld(new THREE.Vector3(0, .5, 0).applyMatrix4(matrix));
    const hub = root.getObjectByName('neb-medical-needle-carriage-0')!.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, .055, 0));
    assert.ok(start.distanceTo(hub) < .00001, 'the first lead segment must leave the actual black hub');
    assert.ok(next.y < start.y, 'a flexible wire must sag under gravity instead of arching like a rigid support');
    leads.getMatrixAt(17, matrix);
    const end = leads.localToWorld(new THREE.Vector3(0, .5, 0).applyMatrix4(matrix));
    const port = root.getObjectByName('neb-medical-lead-port-0')!.getWorldPosition(new THREE.Vector3());
    assert.ok(end.distanceTo(port) < .00001, 'the cable must finish at its bedside socket');
    journey.awakening!.elapsed = 8.2; renderer.update(journey, 100, neo);
    assert.equal(leads.visible, false, 'leads must leave with the needles before the later scene');
    assert.equal(root.getObjectByName('neb-medical-needle-0')!.visible, false);
  } finally { renderer.dispose(); }
});
