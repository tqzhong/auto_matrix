import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { awakeningPose, filmPosition, recoveryBodyPose, type FilmJourney } from '@auto_matrix/shared';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { NebDeckRenderer } from '../packages/client/src/engine/NebDeckRenderer.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function loadGeometry(id: string) {
  const glb = await readFile(new URL(`../packages/client/public/assets/characters/${id}.glb`, import.meta.url));
  const jsonLength = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = glb.subarray(20 + jsonLength), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

test('twenty therapy needles meet the shipped cheek, torso and arm skin while their hubs and leads stay outside it', async t => {
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture()), root = new THREE.Group(), renderer = new NebDeckRenderer(root);
  (models as unknown as { load: typeof loadGeometry }).load = loadGeometry;
  try {
    const rig = (await models.create('neo'))!, motion = newMotion();
    const body = rig.wardrobe.find(part => part.mesh.userData.patientBody)!.mesh as THREE.SkinnedMesh;
    const head = rig.wardrobe.find(part => (part.mesh.material as THREE.Material).name === 'Skin')!.mesh as THREE.SkinnedMesh;
    for (const elapsed of [3.8, 4.073, 5.8]) {
      t.diagnostic(`actual skin and lead clearance at ${elapsed}s`);
      const pose = awakeningPose({ kind: 'recovery', elapsed, started: true });
      rig.root.position.set(pose.x, pose.y, pose.z); rig.root.rotation.y = recoveryBodyPose(elapsed).yaw;
      const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, performance: 'recover' as const, recovery: elapsed };
      models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
      const journey = { scene: 'm1_recovery', awakening: { kind: 'recovery', elapsed, started: true } } as FilmJourney;
      renderer.update(journey, elapsed, rig.root); root.updateMatrixWorld(true);
      for (const surface of [body, head]) { surface.skeleton.update(); surface.computeBoundingBox(); surface.computeBoundingSphere(); }
      const eyeBone = rig.bones.get('head')!, localEye = eyeBone.userData.patientEye ?? eyeBone.userData.cameraEye;
      const eye = eyeBone.localToWorld(localEye.clone()), outward = new THREE.Vector3(0, 0, 1).transformDirection(eyeBone.matrixWorld);
      const eyeSkin = new THREE.Raycaster(eye.clone().addScaledVector(outward, .5), outward.clone().negate(), 0, 1).intersectObject(head)[0];
      assert.ok(eyeSkin && eye.clone().sub(eyeSkin.point).dot(outward) > .02, 'the exposed patient view must start outside the registered face skin');
      for (let i = 0; i < 20; i++) {
        const tip = root.getObjectByName(`neb-medical-needle-tip-${i}`)!.getWorldPosition(new THREE.Vector3());
        const surface = i >= 12 && i < 16 ? head : body;
        const hit = new THREE.Raycaster(new THREE.Vector3(tip.x, 10, tip.z), new THREE.Vector3(0, -1, 0)).intersectObject(surface)[0];
        assert.ok(hit, `needle ${i} misses its actual skin surface at ${elapsed}s`);
        assert.ok(Math.abs(hit.point.y - tip.y) < .035, `needle ${i} penetrates or floats by ${tip.y - hit.point.y} at ${elapsed}s`);
        const hub = root.getObjectByName(`neb-medical-needle-carriage-${i}`)!;
        assert.ok(new THREE.Box3().setFromObject(hub).min.y > hit.point.y + .17, `hub ${i} cuts into the skin`);
        const port = root.getObjectByName(`neb-medical-lead-port-${i}`)!.getWorldPosition(new THREE.Vector3());
        assert.equal(Math.sign(tip.x - pose.x), Math.sign(port.x - pose.x), `lead ${i} crosses to the opposite side of the body`);
        const leads = root.getObjectByName(`neb-medical-${i % 2 ? 'gray' : 'red'}-leads`) as THREE.InstancedMesh;
        for (const segment of [0, 8, 17]) {
          const matrix = new THREE.Matrix4(); leads.getMatrixAt(Math.floor(i / 2) * 18 + segment, matrix);
          const point = leads.localToWorld(new THREE.Vector3().applyMatrix4(matrix));
          const underneath = new THREE.Raycaster(new THREE.Vector3(point.x, 10, point.z), new THREE.Vector3(0, -1, 0)).intersectObjects([body, head])[0];
          if (underneath) assert.ok(point.y - underneath.point.y > .04, `lead ${i}/${segment} crosses the body at ${elapsed}s`);
        }
      }
      const coldRoot = new THREE.Group(), cold = new NebDeckRenderer(coldRoot);
      try {
        cold.update(journey, 1000, rig.root); coldRoot.updateMatrixWorld(true);
        for (let i = 0; i < 20; i++) {
          const warm = root.getObjectByName(`neb-medical-needle-tip-${i}`)!.getWorldPosition(new THREE.Vector3());
          const resumed = coldRoot.getObjectByName(`neb-medical-needle-tip-${i}`)!.getWorldPosition(new THREE.Vector3());
          assert.ok(warm.distanceTo(resumed) < .02, `cold load changes needle ${i}'s skin contact at ${elapsed}s`);
        }
      } finally { cold.dispose(); }
      const neckOrigin = eyeBone.localToWorld(new THREE.Vector3(0, -.4, .6));
      const neckRay = new THREE.Raycaster(neckOrigin, outward.clone().negate(), 0, 1.2);
      const fullNeck = neckRay.intersectObject(head)[0];
      assert.ok(fullNeck, 'the reference skin must contain the lower neck');
      models.animate(rig, advanceMotion(motion, input, 0), motion, { ...input, firstPerson: true }, 0);
      head.computeBoundingBox(); head.computeBoundingSphere();
      const visibleNeck = neckRay.intersectObject(head)[0];
      assert.ok(visibleNeck && visibleNeck.point.distanceTo(fullNeck.point) < .02, 'head culling cannot cut the lower neck out of the exposed body');
      const firstRoot = new THREE.Group(), first = new NebDeckRenderer(firstRoot);
      try {
        first.update(journey, 1000, rig.root); firstRoot.updateMatrixWorld(true);
        for (let i = 12; i < 16; i++) {
          const warm = root.getObjectByName(`neb-medical-needle-tip-${i}`)!.getWorldPosition(new THREE.Vector3());
          const resumed = firstRoot.getObjectByName(`neb-medical-needle-tip-${i}`)!.getWorldPosition(new THREE.Vector3());
          assert.ok(warm.distanceTo(resumed) < .02, `first-person cold load loses cheek needle ${i}`);
        }
      } finally { first.dispose(); }
    }
  } finally { renderer.dispose(); models.dispose(); }
});

test('the first-person patient keeps a visible torso and hands while the head cannot mask the treatment', async t => {
  const assets = new Map(await Promise.all(['neo', 'neo-office', 'neo-tracking'].map(async id => [id, await loadGeometry(id)] as const)));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => assets.get(url.split('/').pop()!.replace(/\.glb.*$/, ''))!);
  const originalDocument = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, pose = awakeningPose({ kind: 'recovery', elapsed: 4, started: true });
  neo.currentLocation = 'film_neb_deck'; neo.isInMatrix = false; neo.rotation = Math.PI;
  neo.position = filmPosition(neo.currentLocation, pose.x, pose.z); neo.position.y += pose.y;
  neo.currentAction = { type: 'idle', parameters: { filmPose: 'recover', recovery: 4 }, startedAt: 0, duration: 1, progress: 0 };
  const renderer = new AgentRenderer(new THREE.Scene());
  t.after(() => { renderer.dispose(); globalThis.document = originalDocument; });
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, performance: 'recover' as const, recovery: 4, firstPerson: true };
  const at = () => { renderer.updateAgent('neo', neo); renderer.setPlayer('neo', true); renderer.setPlayerMotion(input); renderer.setWorld(false); renderer.update(0, undefined, 0, 0); };
  at(); await new Promise(resolve => setImmediate(resolve)); at();
  const body = renderer.getAgentBody('neo')!;
  assert.equal(body.visible, true, 'the first-person patient must not disappear, leaving only the mattress and floating needles');
  let skin: THREE.SkinnedMesh | undefined, face: THREE.SkinnedMesh | undefined;
  body.traverse(object => { if (object instanceof THREE.SkinnedMesh) { if (object.userData.patientBody) skin = object; else if ((object.material as THREE.Material).name === 'Skin') face = object; } });
  assert.ok(skin?.visible, 'the actual anatomical torso and limbs must render');
  assert.ok(face!.geometry.index!.count < (face!.userData.contactSkinGeometry as THREE.BufferGeometry).index!.count, 'first-person head culling must retain the hands and original cheek contact geometry');
  const complete = face!.userData.contactSkinGeometry as THREE.BufferGeometry;
  const shown = new Set<string>(), index = face!.geometry.index!;
  for (let i = 0; i < index.count; i += 3) shown.add([index.getX(i), index.getX(i + 1), index.getX(i + 2)].join(','));
  const joints = complete.attributes.skinIndex, weights = complete.attributes.skinWeight;
  const influence = (vertex: number, name: string) => [0, 1, 2, 3].some(i => weights.getComponent(vertex, i) > .05 && face!.skeleton.bones[joints.getComponent(vertex, i)].name === name);
  let exposed = 0;
  for (let i = 0; i < complete.index!.count; i += 3) {
    const triangle = [complete.index!.getX(i), complete.index!.getX(i + 1), complete.index!.getX(i + 2)];
    if (triangle.some(vertex => influence(vertex, 'head'))) continue;
    exposed++;
    assert.ok(shown.has(triangle.join(',')), 'exposed wrist and arm skin cannot inherit a garment’s coverage mask');
  }
  assert.ok(exposed > 50, 'the check must sample actual exported arm and wrist skin');
  t.diagnostic(`retained ${exposed} actual exposed skin triangles`);
});
