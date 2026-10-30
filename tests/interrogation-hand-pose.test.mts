import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, interrogationRoot } from '@auto_matrix/shared';
import { actor, bends, fingerGroups } from './helpers/fighting-hand-fixture.mjs';
import { handSurface } from './helpers/hand-surface.mjs';
import { crossings } from './helpers/hand-self-contact.mjs';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import type { HeroModels, HeroRig } from '../packages/client/src/agents/HeroModel.js';

function draw(h: { models: HeroModels; rig: HeroRig }, elapsed: number) {
  const pose = interrogationRoot({ phase: 'coercion', elapsed, approach: { x: 0, z: 0, yaw: 0 } }, 'smith');
  const center = FILM_SETS.film_agent_interrogation.center;
  h.rig.root.position.set(center.x + pose.x, center.y - 1, center.z + pose.z); h.rig.root.rotation.y = pose.yaw;
  const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
    interrogation: { phase: 'coercion' as const, elapsed, role: 'smith' as const } }, motion = newMotion();
  h.models.animate(h.rig, advanceMotion(motion, input, 0), motion, input, 0); h.rig.root.updateMatrixWorld(true);
}

test('Smith grips and releases the tracker without crossing his actual hand skin', async t => {
  const h = await actor('smith'); t.after(() => h.models.dispose());
  const surface = handSurface(h.rig, 'R');
  for (const elapsed of [13.801, 14, 14.5, 15, 15.5, 16.3, 17, 17.599,
    ...Array.from({ length: 21 }, (_, i) => 17.6 + i * .05), 18.8]) {
    draw(h, elapsed);
    const fingers = bends(h.rig, 'R', fingerGroups(h.rig, 'R'));
    for (const finger of fingers) {
      assert.ok(finger.PIP <= (finger.digit === 1 ? 100 : 115) && finger.DIP <= 90,
        `${elapsed}/digit ${finger.digit}: PIP ${finger.PIP}, DIP ${finger.DIP}`);
      assert.ok(finger.curvature >= -.015, 'adjacent phalanges must bend in the same direction');
    }
    const tracker = h.rig.root.getObjectByName('interrogation-tracker')!;
    const transform = tracker.matrixWorld.clone().invert().multiply(h.rig.bones.get('wrist_R')!.matrixWorld);
    const pads = fingers.slice(0, 2).map(finger => new THREE.Vector3(...finger.points[3] as [number, number, number]).applyMatrix4(transform));
    if (elapsed < 17.6) {
      for (const pad of pads) assert.ok(Math.hypot(pad.x, pad.y) > .045 && Math.hypot(pad.x, pad.y) < .075,
        `a fingertip pad must touch outside the tracker shell: ${pad.toArray()}`);
      assert.ok(pads[0].x * pads[1].x + pads[0].y * pads[1].y < 0, 'thumb and index oppose one another across the tracker');
    }
    const skin = surface.draw(), intersections = skin.self;
    assert.equal(intersections.count, 0, `tracker hand skin intersects itself: ${JSON.stringify(intersections)}`);
    const inverse = h.rig.bones.get('wrist_R')!.matrixWorld.clone().invert();
    tracker.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const positions = object.geometry.attributes.position, indices = object.geometry.index!;
      const space = inverse.clone().multiply(object.matrixWorld);
      const points = Array.from({ length: positions.count }, (_, id) => new THREE.Vector3().fromBufferAttribute(positions, id).applyMatrix4(space));
      const faces = Array.from({ length: indices.count / 3 }, (_, face) => {
        const ids = [0, 1, 2].map(corner => indices.getX(face * 3 + corner)), vertices = ids.map(id => points[id]);
        return { face, ids, points: vertices, box: new THREE.Box3().setFromPoints(vertices) };
      });
      const contact = crossings(skin.faces, faces, false);
      assert.equal(contact.count, 0, `${elapsed}/${object.geometry.type}: tracker crosses the hand: ${JSON.stringify(contact)}`);
      if (elapsed === 15.5 && object === tracker.children[0]) for (const [digit, ids] of surface.group.tips.slice(0, 2).entries()) {
        let gap = Infinity;
        const triangle = new THREE.Triangle(), nearest = new THREE.Vector3();
        for (const face of faces) {
          triangle.set(face.points[0], face.points[1], face.points[2]);
          if (triangle.getArea() === 0) continue; // Lathe caps repeat the pole vertex.
          for (const id of ids) gap = Math.min(gap, triangle.closestPointToPoint(skin.points.get(id)!, nearest).distanceTo(skin.points.get(id)!));
        }
        assert.ok(gap < .01, `digit ${digit + 1} floats off the actual shell by ${gap}`);
      }
    });
  }
});

test('saved tracker hands restore after combat and match a fresh model', async t => {
  const h = await actor('smith'); t.after(() => h.models.dispose());
  const surface = handSurface(h.rig, 'R');
  for (const elapsed of [13.9, 15.5, 17.599, 18.4]) {
    draw(h, elapsed); const expected = surface.posePoints();
    h.draw(.8); draw(h, JSON.parse(JSON.stringify({ elapsed })).elapsed);
    const fresh = { models: h.models, rig: (await h.models.create('smith'))! }; draw(fresh, elapsed);
    for (const actual of [surface.posePoints(), handSurface(fresh.rig, 'R').posePoints()])
      for (const [id, point] of expected) assert.ok(point.distanceTo(actual.get(id)!) < 2e-6, `restored tracker skin differs at vertex ${id}`);
  }
  const cold = await actor('smith'); t.after(() => cold.models.dispose());
  cold.rig.root.position.copy(h.rig.root.position); cold.rig.root.quaternion.copy(h.rig.root.quaternion);
  h.draw(.8); cold.draw(.8);
  const expected = handSurface(cold.rig, 'R').posePoints();
  for (const [id, point] of surface.posePoints()) assert.ok(point.distanceTo(expected.get(id)!) < 2e-6, `leaving the tracker pose changes ordinary combat skin at ${id}`);
});

test('releasing the tracker preserves its actual held position and orientation', async t => {
  const h = await actor('smith'); t.after(() => h.models.dispose()); draw(h, 17.599999);
  const tracker = h.rig.root.getObjectByName('interrogation-tracker')!;
  const position = tracker.getWorldPosition(new THREE.Vector3()), rotation = tracker.getWorldQuaternion(new THREE.Quaternion());
  draw(h, 17.6);
  assert.ok(position.distanceTo(tracker.getWorldPosition(new THREE.Vector3())) < 1e-5, 'the tracker jumps from an unreachable hand target to its release path');
  assert.ok(rotation.angleTo(tracker.getWorldQuaternion(new THREE.Quaternion())) < 1e-5, 'the tracker rotates discontinuously when it leaves the wrist');
});

test('the tracker shell and moving legs stay outside Smith’s actual head while he presents it', async t => {
  const h = await actor('smith'); t.after(() => h.models.dispose());
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const a = skin.geometry.attributes, ix = skin.geometry.index!, head = skin.skeleton.bones.indexOf(h.rig.bones.get('head')!);
  const ids = Array.from({ length: a.position.count }, (_, id) => id).filter(id => [0, 1, 2, 3].some(k => a.skinIndex.getComponent(id, k) === head && a.skinWeight.getComponent(id, k) > .5));
  const members = new Set(ids), triangles: { face: number; ids: number[] }[] = [];
  for (let face = 0; face < ix.count / 3; face++) {
    const vertices = [0, 1, 2].map(k => ix.getX(face * 3 + k));
    if (vertices.every(id => members.has(id))) triangles.push({ face, ids: vertices });
  }
  for (const elapsed of [14.5, 15.5, 16.3, 17, 17.599]) {
    draw(h, elapsed); skin.skeleton.update();
    const inverse = h.rig.bones.get('head')!.matrixWorld.clone().invert(), skinSpace = inverse.clone().multiply(skin.matrixWorld);
    const points = new Map(ids.map(id => [id, skin.getVertexPosition(id, new THREE.Vector3()).applyMatrix4(skinSpace)]));
    const headFaces = triangles.map(t => { const vertices = t.ids.map(id => points.get(id)!); return { ...t, points: vertices, box: new THREE.Box3().setFromPoints(vertices) }; });
    h.rig.root.getObjectByName('interrogation-tracker')!.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const p = object.geometry.attributes.position, index = object.geometry.index!, space = inverse.clone().multiply(object.matrixWorld);
      const vertices = Array.from({ length: p.count }, (_, id) => new THREE.Vector3().fromBufferAttribute(p, id).applyMatrix4(space));
      const faces = Array.from({ length: index.count / 3 }, (_, face) => {
        const ids = [0, 1, 2].map(k => index.getX(face * 3 + k)), points = ids.map(id => vertices[id]);
        return { face, ids, points, box: new THREE.Box3().setFromPoints(points) };
      });
      const contact = crossings(headFaces, faces, false);
      assert.equal(contact.count, 0, `${elapsed}/${object.geometry.type}: tracker enters Smith's head: ${JSON.stringify(contact)}`);
    });
  }
});
