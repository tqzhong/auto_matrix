import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, redDressAttention, trainingRoot, type TrainingPerformance } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { actor, bends } from './helpers/fighting-hand-fixture.mjs';
import { handSurface } from './helpers/hand-surface.mjs';
import { crossings } from './helpers/hand-self-contact.mjs';

async function setup(t: test.TestContext, role: 'smith' | 'citizen_2') {
  const source = await actor('smith');
  await source.models['load']('red-dress');
  t.mock.method(HeroModels.prototype, 'load', source.models['load'].bind(source.models));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const models = new CharacterModels(), rig = models.create(world.agents.get(role)!);
  await new Promise(resolve => setImmediate(resolve)); assert.ok(rig.hero);
  t.after(() => { models.dispose(); source.models.dispose(); globalThis.document = previous; });
  function pose(clock: number, phase: 'walking' | 'turning' | 'frozen' = 'frozen', elapsed = clock) {
    const attention = redDressAttention(6.2); Object.assign(attention, { clock, phase, noticed: phase !== 'walking' });
    const training: TrainingPerformance = { kind: 'red_dress', elapsed, started: true, attention }, root = trainingRoot(training, role);
    const center = FILM_SETS.film_red_dress_plaza.center;
    rig.root.position.set(center.x + root.x, center.y - 1, center.z + root.z); rig.root.rotation.y = root.yaw;
    models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, armed: role === 'smith' && phase !== 'walking',
      weaponStyle: 'hel_pistol', training: { ...training, role } }, 0);
    rig.root.updateMatrixWorld(true); return training;
  }
  return { models, rig, pose, agent: world.agents.get(role)! };
}

test('Smith aims his real training pistol at Neo and keeps the actual hand outside its solid parts', async t => {
  const h = await setup(t, 'smith'), surface = handSurface(h.rig.hero!, 'R');
  const training = h.pose(6.2), gun = h.rig.weapons![0], hero = h.rig.hero!, wrist = hero.bones.get('wrist_R')!;
  const inverse = wrist.matrixWorld.clone().invert(), draw = surface.draw();
  const faces: { face: number; ids: number[]; points: THREE.Vector3[]; box: THREE.Box3 }[] = [];
  gun.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const position = object.geometry.attributes.position, index = object.geometry.index!;
    const matrix = inverse.clone().multiply(object.matrixWorld);
    for (let i = 0; i < index.count; i += 3) {
      const ids = [0, 1, 2].map(k => index.getX(i + k)), points = ids.map(v => new THREE.Vector3().fromBufferAttribute(position, v).applyMatrix4(matrix));
      faces.push({ face: faces.length, ids, points, box: new THREE.Box3().setFromPoints(points) });
    }
  });
  const contact = crossings(draw.faces, faces, false), fingers = bends(hero, 'R', surface.group);
  const root = trainingRoot(training, 'neo'), center = FILM_SETS.film_red_dress_plaza.center;
  const target = new THREE.Vector3(center.x + root.x, 4.15, center.z + root.z);
  const muzzle = gun.localToWorld(new THREE.Vector3(0, .065, .475)), axis = new THREE.Vector3(0, 0, 1).transformDirection(gun.matrixWorld);
  const lineMiss = new THREE.Ray(muzzle, axis).distanceToPoint(target);
  t.diagnostic(JSON.stringify({ self: draw.self, prop: contact, fingers, lineMiss }));
  assert.ok(lineMiss < .3, `the muzzle misses Neo's head by ${lineMiss}`);
  assert.equal(contact.count, 0, 'the complete hand surface must not intersect the pistol');
  assert.equal(draw.self.count, 0, 'the thumb and fingers must not intersect one another');
  assert.ok(fingers.every(finger => finger.PIP < 100 && finger.DIP < 100 && finger.curvature >= 0), 'finger joints must not fold backwards');
});

test('the red-dress woman acknowledges Neo while passing and restores the same saved gaze', async t => {
  const h = await setup(t, 'citizen_2'), hero = h.rig.hero!;
  const training = h.pose(3.5, 'walking'), root = trainingRoot(training, 'neo'), center = FILM_SETS.film_red_dress_plaza.center;
  const head = hero.bones.get('head')!, eye = head.getWorldPosition(new THREE.Vector3());
  const target = new THREE.Vector3(center.x + root.x, eye.y, center.z + root.z).sub(eye).normalize();
  const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(facing.dot(target) > .65, `her gaze misses Neo while passing: ${facing.dot(target)}`);
  const saved = head.matrixWorld.toArray(); h.pose(4.7, 'walking'); h.pose(3.5, 'walking');
  assert.deepEqual(head.matrixWorld.toArray(), saved);
  h.pose(0, 'walking'); assert.ok(Math.abs(head.rotation.y) < .1, 'she starts by looking along her walking direction');
});

test('the halter follows the actual neck and collar through the passing glance', async t => {
  const h = await setup(t, 'citizen_2'), hero = h.rig.hero!;
  const body = hero.root.getObjectByName('Red_dress_anatomy') as THREE.SkinnedMesh;
  const geometry = body.geometry.clone(), material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const skin = new THREE.Mesh(geometry, material), point = new THREE.Vector3(), misses: string[] = [];
  t.after(() => { geometry.dispose(); material.dispose(); });
  let hits = 0, total = 0, minimum = Infinity, maximum = -Infinity;
  for (const time of [0, 1.5, 2.8, 3.5, 4.4, 5.3]) {
    h.pose(time, 'walking'); body.skeleton.update();
    const toRoot = h.rig.root.matrixWorld.clone().invert().multiply(body.matrixWorld);
    for (let i = 0; i < geometry.attributes.position.count; i++) {
      body.getVertexPosition(i, point).applyMatrix4(toRoot);
      geometry.attributes.position.setXYZ(i, point.x, point.y, point.z);
    }
    const sourceIndex = body.geometry.index!, band: number[] = [];
    for (let face = 0; face < sourceIndex.count; face += 3) {
      const ids = [0, 1, 2].map(k => sourceIndex.getX(face + k)), heights = ids.map(id => geometry.attributes.position.getY(id));
      if (Math.max(...heights) >= 3.05 && Math.min(...heights) <= 3.85) band.push(...ids);
    }
    geometry.setIndex(band); geometry.computeBoundingSphere(); geometry.computeBoundingBox();
    for (const side of ['-1', '1', 'cowl']) {
      const strap = hero.root.getObjectByName(side === 'cowl' ? 'Red_dress_cowl' : `Red_dress_halter_${side}`) as THREE.SkinnedMesh;
      strap.skeleton.update();
      const transform = h.rig.root.matrixWorld.clone().invert().multiply(strap.matrixWorld);
      const samples = Array.from({ length: strap.geometry.attributes.position.count }, (_, i) => strap.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(transform));
      const index = strap.geometry.index!;
      for (let face = 0; face < index.count; face += 3) {
        const corners = [0, 1, 2].map(i => samples[index.getX(face + i)]);
        samples.push(corners[0].clone().add(corners[1]).add(corners[2]).divideScalar(3));
        for (let edge = 0; edge < 3; edge++) samples.push(corners[edge].clone().lerp(corners[(edge + 1) % 3], .5));
      }
      for (let i = 0; i < samples.length; i++) {
        point.copy(samples[i]);
        const radius = Math.hypot(point.x, point.z), direction = new THREE.Vector3(point.x, 0, point.z).normalize();
        const hit = new THREE.Raycaster(new THREE.Vector3(0, point.y, 0), direction, 0, 1).intersectObject(skin).at(-1);
        total++; if (hit) { hits++; minimum = Math.min(minimum, radius-hit.distance); maximum = Math.max(maximum, radius-hit.distance); }
        if (hit && (radius - hit.distance < -.012 || side !== 'cowl' && radius - hit.distance > .09)) misses.push(`${time}/${side}/${i}: ${radius - hit.distance}`);
      }
    }
  }
  t.diagnostic(JSON.stringify({hits,total,minimum,maximum,box:geometry.boundingBox, scale:hero.root.scale.toArray()}));
  assert.ok(hits > total * .95, 'the actual collar must be sampled');
  assert.deepEqual(misses, [], `the moving strap crosses the collar: ${misses.slice(0, 8).join('; ')}`);
});

test('the frozen Smith grip restores after leaving training and after a cold character load', async t => {
  const h = await setup(t, 'smith'), hero = h.rig.hero!, surface = handSurface(hero, 'R');
  const training = h.pose(6.2), reference = surface.posePoints();
  const compare = (actual: Map<number, THREE.Vector3>) => {
    assert.equal(actual.size, reference.size);
    assert.ok(Math.max(...[...reference].map(([id, point]) => point.distanceTo(actual.get(id)!))) < 1e-5, 'the complete hand must restore, including its skin');
  };
  for (const elapsed of [6.2, 8, 10, 12]) { h.pose(6.2, 'frozen', elapsed); compare(surface.posePoints()); }
  for (const armed of [false, true]) {
    h.models.animate(h.rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, armed, weaponStyle: 'hel_pistol' }, 0);
    h.pose(6.2); compare(surface.posePoints());
  }
  const cold = h.models.create(h.agent);
  await new Promise(resolve => setImmediate(resolve)); assert.ok(cold.hero);
  const coldSurface = handSurface(cold.hero, 'R');
  cold.root.position.copy(h.rig.root.position); cold.root.quaternion.copy(h.rig.root.quaternion);
  h.models.animate(cold, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, armed: true, weaponStyle: 'hel_pistol', training: { ...training, role: 'smith' } }, 0);
  cold.root.updateMatrixWorld(true); compare(coldSurface.posePoints());
  assert.equal(coldSurface.draw().self.count, 0);
  for (const [name, rest] of hero.rest) if (/^finger\d-\d_R$/.test(name))
    assert.ok(hero.bones.get(name)!.position.distanceTo(rest) < 1e-7, 'the new grip cannot stretch the original finger bones');
});
