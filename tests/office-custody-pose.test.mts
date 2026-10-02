import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OFFICE_AGENT_ROLES, OFFICE_CUSTODY_CAR, METACORTEX, metacortexPosition, type OfficeCustody } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { OfficeCustodyPerformance } from '../packages/client/src/agents/OfficeCustodyPerformance.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { ARREST_CAR, ARREST_BIKE, arrestPose, arrestCarPoint, arrestBikePoint } from '@auto_matrix/shared';
import { CustodyStreetRenderer } from '../packages/client/src/engine/CustodyStreetRenderer.js';

async function loadGeometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const length = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

test('the shipped cuffed body keeps bone lengths, puts the palms behind the shirt and reaches the actual upper arm', async t => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking', 'smith', 'trinity', 'trinity-club'].map(async id => [id, await loadGeometry(id)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets.get(url.split('/').at(-1)!.replace('.glb', ''))!);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} }) }) } as unknown as Document;
  const models = new CharacterModels(), performance = new OfficeCustodyPerformance();
  try {
    const world = new WorldState(); new AgentManager(world).initializeAllAgents();
    const rigs = new Map(['neo', ...OFFICE_AGENT_ROLES].map(id => [id, models.create(world.agents.get(id)!)]));
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.ok([...rigs.values()].every(rig => rig.hero), 'use the actual four shipped skeletons');
    const neo = rigs.get('neo')!; neo.root.rotation.y = Math.PI;
    const custody: OfficeCustody = { phase: 'securing', elapsed: 0, catcher: 'smith', leader: 'agent_brown', bodies: {
      smith: { position: { x: 0, y: 0, z: -1.85 }, yaw: 0 }, agent_brown: { position: { x: 3, y: 0, z: -3 }, yaw: 0 }, agent_jones: { position: { x: -3, y: 0, z: -3 }, yaw: 0 } } };
    let vertices = 0, cuffVertices = 0;
    for (const catcher of OFFICE_AGENT_ROLES) for (const elapsed of [0, .25, .7, 1.4, 2.4, 2.8, 3.2]) {
      custody.catcher = catcher; custody.elapsed = elapsed;
      for (const [id, rig] of rigs) {
        rig.root.position.set(id === 'neo' ? 0 : id === catcher ? 1.9 : id === 'agent_brown' ? 4 : -4, -1, id === 'neo' || id === catcher ? 0 : -4);
        if (id !== 'neo') rig.root.rotation.y = id === catcher ? Math.PI : 0;
        models.animate(rig, .05, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, officeShirt: id === 'neo', officeCustody: { role: id as 'neo' | typeof catcher, phase: 'securing', elapsed } }, 0);
      }
      const bones = new Map([...rigs].map(([id, rig]) => [id, new Map([...rig.hero!.bones].map(([name, bone]) => [name, bone.position.clone()]))]));
      performance.update(neo.hero, rigs.get(catcher)!.hero, custody);
      const pelvis = neo.hero!.bones.get('pelvis')!;
      if (elapsed >= 2.8) {
        const cuffs = ['R', 'L'].map(side => neo.hero!.bones.get(`wrist_${side}`)!.getObjectByName(`office-cuff-${side}`)!.getWorldPosition(new THREE.Vector3()));
        assert.ok(cuffs[0].distanceTo(cuffs[1]) >= .235, 'the two wrist cuffs must not overlap each other behind Neo');
      }
      for (const side of ['R', 'L']) {
        const wrist = neo.hero!.bones.get(`wrist_${side}`)!, cuff = wrist.getObjectByName(`office-cuff-${side}`)!;
        assert.ok(cuff); assert.equal(cuff.visible, elapsed >= 2.4);
        if (elapsed >= 2.8) {
          const palm = wrist.localToWorld(new THREE.Vector3(side === 'R' ? .065 : -.065, -.17, .01));
          const target = pelvis.localToWorld(new THREE.Vector3(side === 'R' ? -.25 : .25, -.04, -.42));
          assert.ok(palm.distanceTo(target) < .04, `the cuffed hand must reach the rear target: ${side}, ${palm.distanceTo(target)}`);
          neo.hero!.root.traverse(mesh => {
            if (!(mesh instanceof THREE.SkinnedMesh) || !mesh.visible) return;
            mesh.skeleton.update();
            const indices = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight;
            for (let i = 0; i < indices.count; i++) {
              if (![0, 1, 2, 3].some(j => weights.getComponent(i, j) > .25 && mesh.skeleton.bones[indices.getComponent(i, j)].name === `wrist_${side}`)) continue;
              const point = cuff.worldToLocal(mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3()))); cuffVertices++;
              const tube = Math.hypot(Math.hypot(point.x, point.y) - .105, point.z);
              assert.ok(tube >= .01, `the cuff intersects the shipped wrist surface: ${side}, ${point.toArray()}, depth ${.012 - tube}`);
            }
          });
        }
      }
      for (const [id, rig] of rigs) {
        for (const [name, position] of bones.get(id)!) assert.ok(rig.hero!.bones.get(name)!.position.distanceTo(position) < 1e-7, 'grip animation cannot stretch a limb');
        rig.hero!.root.traverse(mesh => {
          if (!(mesh instanceof THREE.SkinnedMesh) || !mesh.visible) return;
          mesh.skeleton.update();
          for (let i = 0; i < mesh.geometry.attributes.position.count; i += 17) {
            const point = mesh.getVertexPosition(i, new THREE.Vector3()); vertices++;
            assert.ok(point.toArray().every(Number.isFinite), 'actual skin must remain finite through the IK transition');
          }
        });
      }
      if (elapsed >= 2.8) {
        const side = ['R', 'L'].sort((a, b) => neo.hero!.bones.get(`elbow_${a}`)!.getWorldPosition(new THREE.Vector3()).distanceToSquared(rigs.get(catcher)!.hero!.root.getWorldPosition(new THREE.Vector3()))
          - neo.hero!.bones.get(`elbow_${b}`)!.getWorldPosition(new THREE.Vector3()).distanceToSquared(rigs.get(catcher)!.hero!.root.getWorldPosition(new THREE.Vector3())))[0];
        const upper = neo.hero!.bones.get(`shoulder_${side}`)!.getWorldPosition(new THREE.Vector3()), elbow = neo.hero!.bones.get(`elbow_${side}`)!.getWorldPosition(new THREE.Vector3());
        const center = upper.clone().lerp(elbow, .65), axis = elbow.clone().sub(upper).normalize();
        const normal = rigs.get(catcher)!.hero!.root.getWorldPosition(new THREE.Vector3()).sub(center); normal.addScaledVector(axis, -normal.dot(axis)).normalize();
        const contact = center.addScaledVector(normal, .14);
        const gap = Math.min(...['R', 'L'].map(side => rigs.get(catcher)!.hero!.bones.get(`wrist_${side}`)!.localToWorld(new THREE.Vector3(side === 'R' ? .065 : -.065, -.17, .01)).distanceTo(contact)));
        assert.ok(gap < .15, `the nearest guard hand must actually reach Neo, rather than float: ${JSON.stringify({ catcher, gap, contact: contact.toArray(), side,
          hands: ['R', 'L'].map(hand => ({ hand, shoulder: rigs.get(catcher)!.hero!.bones.get(`shoulder_${hand}`)!.getWorldPosition(new THREE.Vector3()).toArray(),
            wrist: rigs.get(catcher)!.hero!.bones.get(`wrist_${hand}`)!.getWorldPosition(new THREE.Vector3()).toArray(),
            a: rigs.get(catcher)!.hero!.bones.get(`elbow_${hand}`)!.position.length(), b: rigs.get(catcher)!.hero!.bones.get(`wrist_${hand}`)!.position.length() })) })}`);
      }
    }
    assert.ok(vertices > 10000);
    assert.ok(cuffVertices > 1000, 'check actual wrist skin against both visible cuffs');
    custody.phase = 'selecting'; custody.elapsed = 3.2; custody.catcher = 'smith'; custody.leader = 'agent_brown';
    for (const age of [0, .15, .4, .65, .9, 1.1, 1.4, 1.6]) {
      custody.transportElapsed = age;
      for (const [id, rig] of rigs) {
        const slot = id === 'neo' ? OFFICE_CUSTODY_CAR.neo : id === custody.leader ? OFFICE_CUSTODY_CAR.leader : id === custody.catcher ? OFFICE_CUSTODY_CAR.catcher : OFFICE_CUSTODY_CAR.rear;
        const position = metacortexPosition(slot.x, slot.z, 1);
        rig.root.position.set(position.x, position.y - 1, position.z); rig.root.rotation.y = id === custody.leader ? Math.PI / 2 : Math.PI;
        if (id !== 'neo') custody.bodies[id as typeof custody.leader].position = position;
        models.animate(rig, .05, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, officeShirt: id === 'neo', officeCustody: { role: id as 'neo' | typeof custody.leader, phase: 'selecting', elapsed: 3.2 } }, 0);
      }
      performance.update(neo.hero, rigs.get(custody.catcher)!.hero, custody, rigs.get(custody.leader)!.hero);
      if (age >= .65 && age <= 1.1) {
        const palm = rigs.get(custody.leader)!.hero!.bones.get('finger2-3_R')!.getWorldPosition(new THREE.Vector3());
        const button = OFFICE_CUSTODY_CAR.button;
        const target = new THREE.Vector3(METACORTEX.center.x + button.x + .015, METACORTEX.upper + button.y, METACORTEX.center.z + button.z);
        const bones = rigs.get(custody.leader)!.hero!.bones;
        assert.ok(palm.distanceTo(target) < .04, `button contact: age ${age}, palm ${palm.toArray()}, target ${target.toArray()}, shoulder ${bones.get('shoulder_R')!.getWorldPosition(new THREE.Vector3()).toArray()}, lengths ${bones.get('elbow_R')!.position.length()}/${bones.get('wrist_R')!.position.length()}`);
      }
      for (const [id, rig] of rigs) { rig.root.updateMatrixWorld(true); rig.hero!.root.traverse(mesh => {
        if (!(mesh instanceof THREE.SkinnedMesh) || !mesh.visible) return;
        mesh.skeleton.update();
        for (let i = 0; i < mesh.geometry.attributes.position.count; i += 7) {
          const point = mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3()));
          assert.ok(point.x > METACORTEX.center.x - 2.91 && point.x < METACORTEX.center.x + 2.91, `car side intersection: ${id}/${mesh.name}/${age}: ${point.toArray()}`);
          assert.ok(point.z > METACORTEX.center.z - 31.96 && point.z < METACORTEX.center.z - 26.07, `car wall/closed door intersection: ${id}/${mesh.name}/${age}: ${point.toArray()}`);
          assert.ok(point.y >= METACORTEX.upper - .025, `car floor intersection: ${id}/${mesh.name}/${age}: ${point.toArray()}`);
        }
      }); }
    }
    const streetRoot = new THREE.Group(); streetRoot.position.set(METACORTEX.center.x, 0, METACORTEX.center.z);
    const streetRenderer = new CustodyStreetRenderer(streetRoot), car = streetRoot.getObjectByName('office-arrest-sedan')!;
    const trinity = models.create(world.agents.get('trinity')!); await new Promise<void>(resolve => setImmediate(resolve)); assert.ok(trinity.hero);
    const panels: { panel: THREE.Mesh; bounds: THREE.Box3 }[] = [];
    streetRoot.traverse(panel => {
      if (!(panel instanceof THREE.Mesh) || !panel.name.endsWith('-panel')) return;
      panel.geometry.computeBoundingBox(); (panel.material as THREE.Material).side = THREE.DoubleSide;
      panels.push({ panel, bounds: panel.geometry.boundingBox!.clone().expandByScalar(-.003) });
    });
    custody.phase = 'street'; custody.street = { phase: 'entering', elapsed: 0, from: {} }; custody.watcher = { position: arrestBikePoint(), yaw: ARREST_BIKE.yaw + Math.PI };
    const placements = { neo: ARREST_CAR.approach, smith: ARREST_CAR.catcher, agent_brown: ARREST_CAR.driver, agent_jones: ARREST_CAR.front };
    for (const [id, slot] of Object.entries(placements)) custody.street.from![id] = { position: arrestCarPoint(slot.x, slot.z), yaw: id === 'smith' ? Math.atan2(ARREST_CAR.approach.x - slot.x, ARREST_CAR.approach.z - slot.z) + ARREST_CAR.yaw : ARREST_CAR.yaw + Math.PI };
    let streetVertices = 0;
    try {
      for (const phase of ['entering', 'rear_entering'] as const) for (const age of [0, .5, 1, 1.4, 2, 2.5, 3, 3.5, 4, 4.6, 5, 5.5, 6, 7]) {
        custody.street.phase = phase; custody.street.elapsed = age;
        if (phase === 'rear_entering') custody.street.from!.smith = { position: arrestCarPoint(ARREST_CAR.rear.x, ARREST_CAR.rear.z), yaw: ARREST_CAR.yaw };
        for (const [id, rig] of rigs) {
          const pose = arrestPose(custody, id as 'neo' | typeof custody.leader), before = custody.street.from![id];
          const position = pose?.position ?? before.position;
          rig.root.position.set(position.x, position.y - 1, position.z); rig.root.rotation.y = pose?.yaw ?? before.yaw;
          if (id !== 'neo') custody.bodies[id as typeof custody.leader] = { position, yaw: rig.root.rotation.y };
          models.animate(rig, .05, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, officeShirt: id === 'neo', officeCustody: { role: id as 'neo' | typeof custody.leader, phase: 'street', elapsed: 3.2, street: custody.street } }, 0);
        }
        trinity.root.position.set(custody.watcher.position.x, 0, custody.watcher.position.z); trinity.root.rotation.y = custody.watcher.yaw;
        models.animate(trinity, .05, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }, 0);
        performance.update(neo.hero, rigs.get('smith')!.hero, custody, rigs.get('agent_brown')!.hero, rigs.get('agent_jones')!.hero, trinity.hero);
        streetRenderer.update(custody, neo.hero!.root); streetRoot.updateMatrixWorld(true);
        if (phase === 'entering' && age >= 2.5 && age <= 3.5) {
          const mirror = streetRoot.getObjectByName('office-arrest-rearview')!.getWorldPosition(new THREE.Vector3());
          const head = neo.hero!.bones.get('head')!.localToWorld(new THREE.Vector3(0, .2, .06)), direction = head.clone().sub(mirror);
          const ray = new THREE.Raycaster(mirror, direction.clone().normalize(), .01, direction.length());
          trinity.hero!.root.traverse(mesh => {
            if (!(mesh instanceof THREE.SkinnedMesh) || !mesh.visible) return;
            mesh.skeleton.update(); mesh.computeBoundingBox(); mesh.computeBoundingSphere();
            assert.equal(ray.intersectObject(mesh, false).length, 0, `the real lookout must not block Neo in the mirror: ${age}/${mesh.name}`);
          });
        }
        for (const [id, rig] of rigs) { rig.root.updateMatrixWorld(true); rig.hero!.root.traverse(mesh => {
          if (!(mesh instanceof THREE.SkinnedMesh) || !mesh.visible) return;
          mesh.skeleton.update();
          for (let i = 0; i < mesh.geometry.attributes.position.count; i += 7) {
            const worldPoint = mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3())), point = car.worldToLocal(worldPoint.clone()); streetVertices++;
            assert.ok(point.toArray().every(Number.isFinite));
            if (arrestPose(custody, id as 'neo' | typeof custody.leader)) {
              assert.ok(point.y >= -.025, `street ground: ${id}/${mesh.name}/${phase}/${age}: ${point.toArray()}`);
              if (Math.abs(point.x) < 2.74 && Math.abs(point.z) < 6.79) assert.ok(point.y >= .3 - .01, `sedan floor: ${id}/${mesh.name}/${phase}/${age}: ${point.toArray()}`);
              if (Math.abs(point.x) < 2.74 && point.z > -3.38 && point.z < 3.23) assert.ok(point.y <= 3.9 + .005, `sedan roof: ${id}/${mesh.name}/${phase}/${age}: ${point.toArray()}`);
            }
            for (const { panel, bounds } of panels) {
              const inPanel = panel.worldToLocal(worldPoint.clone());
              if (!bounds.containsPoint(inPanel)) continue;
              const hits = new THREE.Raycaster(worldPoint, new THREE.Vector3(.73, .61, .41).normalize(), .000001, 10).intersectObject(panel, false);
              const unique = hits.filter((hit, j) => !j || hit.distance - hits[j - 1].distance > .000001);
              assert.equal(unique.length % 2, 0, `moving rounded door: ${id}/${mesh.name}/${phase}/${age}/${panel.name}: ${JSON.stringify({ inPanel: inPanel.toArray(), point: point.toArray(), pelvis: rig.hero!.bones.get('pelvis')!.getWorldPosition(new THREE.Vector3()).toArray(), wrists: ['R', 'L'].map(side => rig.hero!.bones.get('wrist_' + side)!.getWorldPosition(new THREE.Vector3()).toArray()) })}`);
            }
          }
        }); }
        if (phase === 'entering' && age >= 1 && age <= 1.4) {
          const contact = neo.hero!.bones.get('head')!.localToWorld(new THREE.Vector3(0, .35, -.02));
          const gap = Math.min(...['R', 'L'].map(side => rigs.get('smith')!.hero!.bones.get(`wrist_${side}`)!.localToWorld(new THREE.Vector3(side === 'R' ? .065 : -.065, -.17, .01)).distanceTo(contact)));
          assert.ok(gap < .06, `pressing the real head needs a reachable palm: ${JSON.stringify({ age, gap, contact: contact.toArray(), shoulders: ['R', 'L'].map(side => rigs.get('smith')!.hero!.bones.get('shoulder_' + side)!.getWorldPosition(new THREE.Vector3()).toArray()), palms: ['R', 'L'].map(side => rigs.get('smith')!.hero!.bones.get('wrist_' + side)!.localToWorld(new THREE.Vector3(side === 'R' ? .065 : -.065, -.17, .01)).toArray()) })}`);
        }
        for (const side of ['R', 'L']) {
          const handle = arrestBikePoint(side === 'R' ? .93 : -.93, ARREST_BIKE.handleZ);
          const palm = trinity.hero!.bones.get(`wrist_${side}`)!.localToWorld(new THREE.Vector3(side === 'R' ? .065 : -.065, -.17, .01));
          assert.ok(palm.distanceTo(new THREE.Vector3(handle.x, 2.94, handle.z)) < .06, `motorcycle handle grip: ${side}/${palm.toArray()}`);
        }
      }
      assert.ok(streetVertices > 20000, 'sample the actual shipped skin through both door-entry motions');
    } finally { streetRenderer.dispose(); }
    performance.update(neo.hero, undefined, undefined);
    assert.equal(neo.hero!.bones.get('wrist_R')!.getObjectByName('office-cuff-R')!.visible, false);
    performance.dispose(); assert.equal(neo.hero!.root.getObjectByName('office-cuff-chain'), undefined);
  } finally { performance.dispose(); models.dispose(); globalThis.document = previous; }
});
