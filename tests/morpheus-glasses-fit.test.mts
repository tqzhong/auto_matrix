import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { actor } from './helpers/fighting-hand-fixture.mjs';
import { crossings } from './helpers/hand-self-contact.mjs';
import { advanceMotion, newMotion, type MotionInput } from '../packages/client/src/agents/CharacterMotion.js';

function faces(mesh: THREE.Mesh, space: THREE.Matrix4) {
  if (mesh instanceof THREE.SkinnedMesh) mesh.skeleton.update();
  const points = Array.from({ length: mesh.geometry.attributes.position.count }, (_, id) =>
    mesh.getVertexPosition(id, new THREE.Vector3()).applyMatrix4(space));
  const index = mesh.geometry.index!;
  return Array.from({ length: index.count / 3 }, (_, face) => {
    const ids = [0, 1, 2].map(k => index.getX(face * 3 + k)), vertices = ids.map(id => points[id]);
    return { face, ids, points: vertices, box: new THREE.Box3().setFromPoints(vertices) };
  });
}

test('Morpheus wears solid horizontal oval pince-nez lenses without a surrounding rim or temples', async t => {
  const h = await actor('morpheus'); t.after(() => h.models.dispose()); h.draw(0);
  const lenses = h.rig.glasses.children.filter((part): part is THREE.Mesh => part instanceof THREE.Mesh && part.material instanceof THREE.MeshPhysicalMaterial);
  assert.equal(lenses.length, 2);
  for (const lens of lenses) {
    lens.geometry.computeBoundingBox(); const box = lens.geometry.boundingBox!, size = box.getSize(new THREE.Vector3());
    assert(size.x / size.y > 1.45 && size.x / size.y < 1.75, `film lenses are horizontal ovals rather than round disks: ${size.x / size.y}`);
    const edges = new Map<string, number>(), index = lens.geometry.index!;
    for (let i = 0; i < index.count; i += 3) for (let corner = 0; corner < 3; corner++) {
      const pair = [index.getX(i + corner), index.getX(i + (corner + 1) % 3)].sort((a, b) => a - b), key = pair.join(',');
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
    assert([...edges.values()].every(count => count === 2), 'the entire lens must be a closed manifold without an unjoined edge seam');
    const center = box.getCenter(new THREE.Vector3()), material = lens.material as THREE.MeshPhysicalMaterial, original = material.side;
    material.side = THREE.DoubleSide;
    try {
      const origin = lens.localToWorld(center.clone().add(new THREE.Vector3(0, 0, .1)));
      const direction = new THREE.Vector3(0, 0, -1).transformDirection(lens.matrixWorld);
      const hits = new THREE.Raycaster(origin, direction, 0, .2).intersectObject(lens);
      assert(hits.length >= 2, 'edge views need actual front and back surfaces');
      const depths = hits.map(hit => lens.worldToLocal(hit.point.clone()).z), thickness = Math.max(...depths) - Math.min(...depths);
      assert(thickness > .002 && thickness < .004, `a solid thin lens is required: ${thickness}`);
    } finally { material.side = original; }
  }
  const tubes = h.rig.glasses.children.filter((part): part is THREE.Mesh<THREE.TubeGeometry> => part instanceof THREE.Mesh && part.geometry instanceof THREE.TubeGeometry);
  assert(tubes.length > 0, 'the pince-nez must have an actual nose mounting');
  assert(tubes.every(part => !part.geometry.parameters.closed), 'the film pince-nez has no complete lens rims');
  assert(tubes.every(part => part.geometry.parameters.path.getLength() < .13), 'pince-nez cannot acquire arms reaching to the ears');
});

test('both Morpheus nose pads support the pince-nez close to the actual nose surface', async t => {
  const h = await actor('morpheus'); t.after(() => h.models.dispose()); h.draw(0);
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const outward = new THREE.Vector3(0, 0, 1).transformDirection(h.rig.bones.get('head')!.matrixWorld);
  const pads = h.rig.glasses.children.filter((part): part is THREE.Mesh => part instanceof THREE.Mesh && part.name.startsWith('morpheus-nose-pad-'));
  assert.equal(pads.length, 2, 'rimless lenses need the two nose contacts rather than an unsupported floating bar');
  for (const pad of pads) {
    let smallest = Infinity;
    for (let vertex = 0; vertex < pad.geometry.attributes.position.count; vertex++) {
      const point = pad.localToWorld(new THREE.Vector3().fromBufferAttribute(pad.geometry.attributes.position, vertex));
      const hit = new THREE.Raycaster(point.addScaledVector(outward, .3), outward.clone().negate(), 0, .35).intersectObject(skin)[0];
      assert(hit, 'each pad vertex must have actual nose skin behind it');
      const gap = hit.distance - .3; smallest = Math.min(smallest, gap);
      assert(gap > .0005 && gap < .0045, `the pad penetrates or floats in front of the nose: ${gap}`);
    }
    assert(smallest < .0025, 'the nose mounting must remain close to skin instead of floating with the lens');
  }
});

test('saved Morpheus action inputs restore every eyewear vertex after a different animation history and in a cold rig', async t => {
  const h = await actor('morpheus'), cold = await actor('morpheus'); t.after(() => { h.models.dispose(); cold.models.dispose(); });
  const input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
    pills: { phase: 'talking', elapsed: 4.3, role: 'morpheus', conversation: { beat: 1, belief: 'agency' } } };
  const capture = (target: typeof h) => {
    const state = newMotion(); target.rig.root.position.set(4734.25, 85, 4410);
    target.models.animate(target.rig, advanceMotion(state, input, 0), state, structuredClone(input), 0); target.rig.root.updateMatrixWorld(true);
    return target.rig.glasses.children.filter((part): part is THREE.Mesh => part instanceof THREE.Mesh).map(part => ({ name: part.name,
      points: Array.from({ length: part.geometry.attributes.position.count }, (_, vertex) =>
        part.localToWorld(new THREE.Vector3().fromBufferAttribute(part.geometry.attributes.position, vertex)).toArray()) }));
  };
  const before = capture(h), state = newMotion(), walking = { speed: 4, grounded: true, verticalVelocity: 0, turn: .7 };
  for (let frame = 0; frame < 60; frame++) h.models.animate(h.rig, advanceMotion(state, walking, 1 / 60), state, walking, 1 / 60);
  assert.deepEqual(capture(h), before); assert.deepEqual(capture(cold), before);
});

test('the entire Morpheus pince-nez stays clear of the actual face while turning, speaking and walking', async t => {
  const h = await actor('morpheus'); t.after(() => h.models.dispose());
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const neutral = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  const poses: MotionInput[] = [neutral, { ...neutral, turn: .9 }, { ...neutral, turn: -.9 }, { ...neutral, speed: 4, turn: -.5 },
    { ...neutral, pills: { phase: 'talking', elapsed: 4.3, role: 'morpheus', conversation: { beat: 1, belief: 'agency' } } },
    { ...neutral, pills: { phase: 'offering', elapsed: 1.1, role: 'morpheus' } }];
  for (const [index, input] of poses.entries()) {
    const state = newMotion();
    for (let frame = 0; frame < 24; frame++) h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
    h.rig.root.updateMatrixWorld(true); const inverse = h.rig.bones.get('head')!.matrixWorld.clone().invert();
    const headFaces = faces(skin, inverse.clone().multiply(skin.matrixWorld));
    for (const part of h.rig.glasses.children) if (part instanceof THREE.Mesh) {
      const contact = crossings(faces(part, inverse.clone().multiply(part.matrixWorld)), headFaces, false);
      assert.equal(contact.count, 0, `${index}/${part.name || part.geometry.type}: the actual glasses penetrate the face: ${JSON.stringify(contact)}`);
    }
  }
});
