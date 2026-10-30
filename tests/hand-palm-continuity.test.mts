import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { actor } from './helpers/fighting-hand-fixture.mjs';
import { skinJoins } from './helpers/patient-skin.mjs';

for (const metacarpal of [false, true]) test(`Trinity: the proximal palm stays rounded through grip and wrist flexion (MCP ${metacarpal})`, async t => {
  const h = await actor('trinity', scene => {
    const skin = scene.getObjectByName('Anatomical_head_and_hands'); if (skin) skin.userData.articulatedMcp = metacarpal;
  });
  t.after(() => h.models.dispose());
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const position = skin.geometry.attributes.position, index = skin.geometry.index!;
  // Regression location picked on the actual proximal-palm spike. It lies
  // distal to the hand/forearm seam; the finger pads and thumb web are outside.
  const center = new THREE.Vector3(.462660, 2.106509, .019297);
  const key = (p: THREE.Vector3) => p.toArray().map(v => v.toFixed(6)).join(',');
  const faces: { ids: number[]; keys: string[] }[] = [], edges = new Map<string, number[]>();
  let nearest = Infinity;
  for (let at = 0; at < index.count; at += 3) {
    const ids = [0, 1, 2].map(k => index.getX(at + k));
    const points = ids.map(id => new THREE.Vector3().fromBufferAttribute(position, id));
    nearest = Math.min(nearest, ...points.map(p => p.distanceTo(center)));
    if (!points.some(p => p.distanceTo(center) < .03)) continue;
    const which = faces.length, keys = points.map(key); faces.push({ ids, keys });
    for (let k = 0; k < 3; k++) {
      const edge = [keys[k], keys[(k + 1) % 3]].sort().join('/'), neighbors = edges.get(edge) ?? [];
      neighbors.push(which); edges.set(edge, neighbors);
    }
  }
  assert.ok(nearest < .006 && faces.length > 30, 'cover the real palm region rather than an empty selection');
  let maximum = 0;
  for (const grip of [0, .5, 1]) for (const [roll, bend] of [[0, 0], [0, .7], [1.4, 0], [1.4, .7]]) {
    h.draw(grip);
    const wrist = h.rig.bones.get('wrist_L')!;
    wrist.quaternion.setFromAxisAngle(wrist.position.clone().normalize(), -roll);
    wrist.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), bend));
    h.rig.root.updateMatrixWorld(true); h.models['fightingHands'].get(h.rig)!.update(); skin.skeleton.update();
    const normals = faces.map(face => new THREE.Triangle(...face.ids.map(id => skin.getVertexPosition(id, new THREE.Vector3())) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]).getNormal(new THREE.Vector3()));
    for (const neighbors of edges.values()) if (neighbors.length === 2) maximum = Math.max(maximum, normals[neighbors[0]].angleTo(normals[neighbors[1]]));
  }
  t.diagnostic(JSON.stringify({ metacarpal, faces: faces.length, maximumPalmDihedralDegrees: maximum * 180 / Math.PI }));
  assert.ok(maximum < Math.PI / 3, `the smooth proximal palm develops an angular spike of ${maximum * 180 / Math.PI} degrees`);
});

test('Trinity: the cut hand seam stays attached through the corrected grip and wrist flexion', async t => {
  const h = await actor('trinity', scene => { const skin = scene.getObjectByName('Anatomical_head_and_hands'); if (skin) skin.userData.articulatedMcp = true; });
  t.after(() => h.models.dispose());
  const hand = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const body = h.rig.root.getObjectByName('Anatomical_wrist_skin') as THREE.SkinnedMesh;
  const joins = skinJoins(hand, body); assert.ok(joins.pairs.length >= 96);
  let maximum = 0;
  for (const grip of [0, .5, 1]) for (const [roll, bend] of [[0, 0], [0, .7], [1.4, 0], [1.4, .7]]) {
    h.draw(grip);
    for (const side of ['R', 'L']) {
      const wrist = h.rig.bones.get('wrist_' + side)!;
      wrist.quaternion.setFromAxisAngle(wrist.position.clone().normalize(), side === 'R' ? roll : -roll);
      wrist.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), bend));
    }
    h.rig.root.updateMatrixWorld(true); h.models['fightingHands'].get(h.rig)!.update(); hand.skeleton.update(); body.skeleton.update();
    for (const [a, b] of joins.pairs) maximum = Math.max(maximum, hand.getVertexPosition(a, new THREE.Vector3()).applyMatrix4(hand.matrixWorld)
      .distanceTo(body.getVertexPosition(b, new THREE.Vector3()).applyMatrix4(body.matrixWorld)));
  }
  t.diagnostic(JSON.stringify({ maximumSkinSeamGap: maximum }));
  assert.ok(maximum < 2e-5, `the palm correction opens the hand/forearm seam by ${maximum}`);
});
