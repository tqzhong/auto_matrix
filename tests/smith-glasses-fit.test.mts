import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { actor } from './helpers/fighting-hand-fixture.mjs';
import { crossings } from './helpers/hand-self-contact.mjs';
import { advanceMotion, newMotion, type MotionInput } from '../packages/client/src/agents/CharacterMotion.js';

const tube = (mesh: THREE.Object3D): mesh is THREE.Mesh<THREE.TubeGeometry> =>
  mesh instanceof THREE.Mesh && mesh.geometry instanceof THREE.TubeGeometry;

function faces(mesh: THREE.Mesh, space: THREE.Matrix4, above = -Infinity) {
  if (mesh instanceof THREE.SkinnedMesh) mesh.skeleton.update();
  const points = Array.from({ length: mesh.geometry.attributes.position.count }, (_, id) =>
    mesh.getVertexPosition(id, new THREE.Vector3()).applyMatrix4(space));
  const index = mesh.geometry.index!, result = [];
  for (let face = 0; face < index.count / 3; face++) {
    const ids = [0, 1, 2].map(k => index.getX(face * 3 + k)), vertices = ids.map(id => points[id]);
    if (vertices.every(p => p.y < above)) continue;
    result.push({ face, ids, points: vertices, box: new THREE.Box3().setFromPoints(vertices) });
  }
  return result;
}

test('Smith’s bridge and both temples actually connect to the lens rims and reach the upper ears', async t => {
  const h = await actor('smith'); t.after(() => h.models.dispose()); h.draw(0);
  const head = h.rig.bones.get('head')!, inverse = head.matrixWorld.clone().invert();
  const tubes = h.rig.glasses.children.filter(tube), rims = tubes.filter(m => m.geometry.parameters.closed);
  const arms = tubes.filter(m => !m.geometry.parameters.closed && m.geometry.parameters.path.getLength() > .20);
  const bridge = tubes.find(m => !m.geometry.parameters.closed && m.geometry.parameters.path.getLength() < .10)!;
  assert.equal(rims.length, 2); assert.equal(arms.length, 2); assert.ok(bridge);
  const point = (m: THREE.Mesh<THREE.TubeGeometry>, t: number) =>
    m.geometry.parameters.path.getPoint(t).applyMatrix4(inverse.clone().multiply(m.matrixWorld));
  const rimFaces = rims.flatMap(m => faces(m, inverse.clone().multiply(m.matrixWorld)));
  const gap = (p: THREE.Vector3) => Math.min(...rimFaces.map(f =>
    new THREE.Triangle(...f.points as [THREE.Vector3, THREE.Vector3, THREE.Vector3]).closestPointToPoint(p, new THREE.Vector3()).distanceTo(p)));
  for (const end of [0, 1]) assert.ok(gap(point(bridge, end)) < .005, `bridge endpoint ${end} is disconnected by ${gap(point(bridge, end))}`);
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  skin.skeleton.update(); const space = inverse.clone().multiply(skin.matrixWorld);
  const vertices = Array.from({ length: skin.geometry.attributes.position.count }, (_, id) => skin.getVertexPosition(id, new THREE.Vector3()).applyMatrix4(space));
  for (const arm of arms) {
    const start = point(arm, 0), side = Math.sign(start.x);
    assert.ok(gap(start) < .006, `temple ${side} is disconnected from its rim by ${gap(start)}`);
    const ear = vertices.filter(p => p.x * side > .18 && p.y > -.12 && p.y < .17 && p.z < .10 && p.z > -.22);
    assert.ok(ear.length > 30, 'inspect the actual pinna rather than a guessed point');
    const top = Math.max(...ear.map(p => p.y)), helix = ear.filter(p => p.y > top - .008);
    const armPoints = Array.from({ length: 129 }, (_, i) => point(arm, i / 128));
    const clearance = Math.min(...helix.map(p => Math.min(...armPoints.map(q => p.distanceTo(q)))));
    assert.ok(clearance < .012, `temple ${side} floats away from the upper ear by ${clearance}`);
    assert.ok(armPoints.at(-1)!.z < Math.min(...helix.map(p => p.z)) - .02, 'temple must continue behind the upper ear');
  }
});

test('Smith’s complete glasses stay outside the actual face and ears during turns, running and interrogation', async t => {
  const h = await actor('smith'); t.after(() => h.models.dispose());
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const neutral = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  const poses: MotionInput[] = [neutral, { ...neutral, turn: .9 }, { ...neutral, speed: 6, turn: -.5 },
    { ...neutral, interrogation: { phase: 'coercion', elapsed: 15.5, role: 'smith' } },
    { ...neutral, interrogation: { phase: 'coercion', elapsed: 18.4, role: 'smith' } }];
  for (const [index, input] of poses.entries()) {
    const state = newMotion();
    for (let frame = 0; frame < 24; frame++) h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
    h.rig.root.updateMatrixWorld(true); const inverse = h.rig.bones.get('head')!.matrixWorld.clone().invert();
    const headFaces = faces(skin, inverse.clone().multiply(skin.matrixWorld), -.3);
    for (const part of h.rig.glasses.children) {
      if (!(part instanceof THREE.Mesh)) continue;
      const contact = crossings(faces(part, inverse.clone().multiply(part.matrixWorld)), headFaces, false);
      assert.equal(contact.count, 0, `${index}/${part.name || part.geometry.type}: glasses cut through the head: ${JSON.stringify(contact)}`);
    }
  }
});

test('Smith’s lenses have separate front and back surfaces when viewed edge-on', async t => {
  const h = await actor('smith'); t.after(() => h.models.dispose()); h.draw(0);
  const lenses = h.rig.glasses.children.filter((part): part is THREE.Mesh => part instanceof THREE.Mesh && part.material instanceof THREE.MeshPhysicalMaterial);
  assert.equal(lenses.length, 2);
  for (const lens of lenses) {
    lens.geometry.computeBoundingBox(); const center = lens.geometry.boundingBox!.getCenter(new THREE.Vector3());
    const material = lens.material as THREE.MeshPhysicalMaterial, original = material.side;
    material.side = THREE.DoubleSide;
    try {
      const origin = lens.localToWorld(center.clone().add(new THREE.Vector3(0, 0, .1)));
      const direction = new THREE.Vector3(0, 0, -1).transformDirection(lens.matrixWorld);
      const hits = new THREE.Raycaster(origin, direction, 0, .2).intersectObject(lens);
      assert.ok(hits.length >= 2, 'a flat two-sided polygon is not a solid curved lens');
      const depths = hits.map(hit => lens.worldToLocal(hit.point.clone()).z), thickness = Math.max(...depths) - Math.min(...depths);
      assert.ok(thickness > .002 && thickness < .004, `lens has no plausible physical thickness: ${thickness}`);
    } finally { material.side = original; }
  }
});
