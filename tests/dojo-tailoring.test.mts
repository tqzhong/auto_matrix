import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { actor } from './helpers/fighting-hand-fixture.mjs';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';

for (const id of ['neo', 'morpheus'] as const) {
  test(`${id}: the gi collar follows the shoulders instead of being pulled around by the head`, async t => {
    const h = await actor(id); t.after(() => h.models.dispose());
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, dojoOutfit: id }, state = newMotion();
    h.models.animate(h.rig, advanceMotion(state, input, 0), state, input, 0); h.rig.root.updateMatrixWorld(true);
    for (const part of ['jacket', 'lapel']) {
      const mesh = h.rig.root.getObjectByName(`${id}-dojo-${part}`) as THREE.SkinnedMesh;
      mesh.skeleton.update();
      const p = mesh.geometry.attributes.position;
      const collar = Array.from({ length: p.count }, (_, i) => i).filter(i => p.getY(i) > 3.5 && Math.abs(p.getX(i)) < .5);
      assert.ok(collar.length > 20, 'inspect the whole upper collar, not a single point');
      const before = collar.map(i => mesh.getVertexPosition(i, new THREE.Vector3()));
      h.rig.bones.get('head')!.rotation.y += .5; h.rig.root.updateMatrixWorld(true); mesh.skeleton.update();
      const drift = Math.max(...collar.map((i, k) => before[k].distanceTo(mesh.getVertexPosition(i, new THREE.Vector3()))));
      assert.ok(drift < 1e-5, `${part}: turning the head pulls the training cloth by ${drift}`);
      h.rig.bones.get('head')!.rotation.y -= .5; h.rig.root.updateMatrixWorld(true);
    }
  });

  test(`${id}: the collar has a continuous sewn surface without conflicting normals at each strip edge`, async t => {
    const h = await actor(id); t.after(() => h.models.dispose());
    const mesh = h.rig.root.getObjectByName(`${id}-dojo-lapel`) as THREE.SkinnedMesh;
    const p = mesh.geometry.attributes.position, n = mesh.geometry.attributes.normal, same = new Map<string, number[]>();
    for (let i = 0; i < p.count; i++) {
      const key = [p.getX(i), p.getY(i), p.getZ(i)].map(v => v.toFixed(5)).join(',');
      const ids = same.get(key) ?? []; ids.push(i); same.set(key, ids);
    }
    for (const ids of same.values()) for (const a of ids) for (const b of ids) {
      const dot = new THREE.Vector3().fromBufferAttribute(n, a).dot(new THREE.Vector3().fromBufferAttribute(n, b));
      assert.ok(dot > .99, `the same cloth point has disagreeing normals: ${dot}`);
    }
    assert.ok(Math.max(...Array.from({ length: p.count }, (_, i) => i).filter(i => Math.abs(p.getX(i)) < .2 && p.getZ(i) < 0).map(i => p.getY(i))) < 3.75,
      'the rear collar must sit at the base of the neck instead of extending towards the jaw');
    const jacket = h.rig.root.getObjectByName(`${id}-dojo-jacket`) as THREE.SkinnedMesh;
    const shoulder = jacket.geometry.attributes.position;
    assert.ok(Array.from({ length: shoulder.count }, (_, i) => i).some(i => Math.abs(shoulder.getX(i)) > .45 && shoulder.getY(i) > 3.75),
      'lowering the neck must not cut away the shoulder caps');
  });
}

test('Neo wears a cloth-colored sash with a contrasting collar, as in the film training scene', async t => {
  const h = await actor('neo'); t.after(() => h.models.dispose());
  const color = (part: string) => (h.rig.root.getObjectByName('neo-dojo-' + part) as THREE.Mesh).material as THREE.MeshStandardMaterial;
  assert.ok(color('belt').color.equals(color('jacket').color), 'the film sash matches the light gi; it is not a black belt');
  assert.ok(color('lapel').color.r < color('jacket').color.r * .15);
});

for (const id of ['neo', 'morpheus'] as const) {
  test(`${id}: sewn collar stays joined and clear of the neck through actual combat and head turns`, async t => {
    const { skinJoins, patientNormal } = await import('./helpers/patient-skin.mjs');
    const { crossings } = await import('./helpers/hand-self-contact.mjs');
    const { MELEE_COMBO } = await import('@auto_matrix/shared');
    const h = await actor(id); t.after(() => h.models.dispose());
    const jacket = h.rig.root.getObjectByName(`${id}-dojo-jacket`) as THREE.SkinnedMesh;
    const lapel = h.rig.root.getObjectByName(`${id}-dojo-lapel`) as THREE.SkinnedMesh;
    const joins = skinJoins(jacket, lapel); assert.ok(joins.pairs.length > 200, 'check the complete sewn boundary, not floating separate strips');
    const faces = (mesh: THREE.SkinnedMesh, neckOnly: boolean) => {
      const p = mesh.geometry.attributes.position, index = mesh.geometry.index!, triangles: { face: number; ids: number[] }[] = [];
      for (let i = 0; i < index.count; i += 3) {
        const ids = [0, 1, 2].map(k => index.getX(i + k));
        if (!neckOnly || ids.every(v => p.getY(v) > 3.45 && Math.abs(p.getX(v)) < .5)) triangles.push({ face: i / 3, ids });
      }
      return { mesh, triangles, vertices: [...new Set(triangles.flatMap(f => f.ids))] };
    };
    const neck = ['Anatomical_head_and_hands', `${id}-dojo-neck`].map(name => faces(h.rig.root.getObjectByName(name) as THREE.SkinnedMesh, true));
    const cloth = [faces(lapel, false), faces(jacket, true)];
    const posed = ({ mesh, triangles, vertices }: ReturnType<typeof faces>) => {
      mesh.skeleton.update(); const inverse = h.rig.root.matrixWorld.clone().invert();
      const positions = new Map(vertices.map(i => [i, mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse)]));
      return triangles.map(face => { const points = face.ids.map(i => positions.get(i)!); return { ...face, points, box: new THREE.Box3().setFromPoints(points) }; });
    };
    let maximumGap = 0, maximumAngle = 0, checked = 0;
    const phases = [{ combo: 0, age: 10, dodge: false }, { combo: 0, age: 10, dodge: true },
      ...MELEE_COMBO.flatMap((strike, combo) => [0, strike.contact, strike.duration].map(age => ({ combo, age, dodge: false })))];
    for (const phase of phases) for (const turn of [-1, 0, 1]) {
      const state = newMotion(); state.combo = phase.combo; state.attackAge = phase.age; state.turn = turn;
      if (phase.dodge) { state.skill = 'dodge'; state.skillAge = .15; }
      const input = { speed: 0, grounded: true, verticalVelocity: 0, turn, dojoOutfit: id, dojoSparring: true };
      h.models.animate(h.rig, advanceMotion(state, input, 0), state, input, 0); h.rig.root.updateMatrixWorld(true);
      jacket.skeleton.update(); lapel.skeleton.update();
      for (const [a, b] of joins.pairs) {
        maximumGap = Math.max(maximumGap, jacket.localToWorld(jacket.getVertexPosition(a, new THREE.Vector3())).distanceTo(lapel.localToWorld(lapel.getVertexPosition(b, new THREE.Vector3()))));
        maximumAngle = Math.max(maximumAngle, patientNormal(jacket, a).angleTo(patientNormal(lapel, b)));
      }
      const skin = neck.flatMap(posed);
      for (const part of cloth) {
        const intersections = crossings(posed(part), skin, false);
        assert.equal(intersections.count, 0, `${id}/${phase.combo}/${phase.age}/turn${turn}: ${part.mesh.name} cuts into the neck: ${JSON.stringify(intersections)}`);
      }
      checked++;
    }
    assert.ok(maximumGap < 2e-5, `sewn collar opens by ${maximumGap}`);
    assert.ok(maximumAngle < .002, `sewn collar normals split by ${THREE.MathUtils.radToDeg(maximumAngle)} degrees`);
    t.diagnostic(JSON.stringify({ id, checked, seamPairs: joins.pairs.length, maximumGap, maximumAngle }));
  });
}

for (const id of ['neo', 'morpheus'] as const) {
  test(`${id}: the complete exposed hands stay outside the new collar during strikes`, async t => {
    const { handSurface } = await import('./helpers/hand-surface.mjs');
    const { crossings } = await import('./helpers/hand-self-contact.mjs');
    const { MELEE_COMBO } = await import('@auto_matrix/shared');
    const h = await actor(id); t.after(() => h.models.dispose());
    const lapel = h.rig.root.getObjectByName(`${id}-dojo-lapel`) as THREE.SkinnedMesh;
    const hands = ['R', 'L'].map(side => {
      const surface = handSurface(h.rig, side), mesh = surface.group.skin;
      const inverse = mesh.skeleton.boneInverses[mesh.skeleton.bones.indexOf(h.rig.bones.get('wrist_' + side)!)];
      const exposed = new Set(surface.vertices.filter(i => new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i).applyMatrix4(mesh.bindMatrix).applyMatrix4(inverse).y < -.14));
      const triangles = surface.triangles.filter(face => face.ids.every(i => exposed.has(i)));
      assert.ok(triangles.length > 9000); return { surface, triangles };
    });
    const phases = [{ combo: 0, age: 10 }, ...MELEE_COMBO.flatMap((strike, combo) =>
      [...Array.from({ length: Math.ceil((strike.duration + .2) * 30) + 1 }, (_, frame) => frame / 30), strike.contact].map(age => ({ combo, age })))];
    for (const { combo, age } of phases) {
      const state = newMotion(); state.combo = combo; state.attackAge = age;
      const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, dojoOutfit: id, dojoSparring: true };
      h.models.animate(h.rig, advanceMotion(state, input, 0), state, input, 0); h.rig.root.updateMatrixWorld(true); lapel.skeleton.update();
      const inverse = h.rig.root.matrixWorld.clone().invert(), index = lapel.geometry.index!;
      const positions = Array.from({ length: lapel.geometry.attributes.position.count }, (_, i) => lapel.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(lapel.matrixWorld).applyMatrix4(inverse));
      const cloth = Array.from({ length: index.count / 3 }, (_, face) => {
        const ids = [0, 1, 2].map(k => index.getX(face * 3 + k)), points = ids.map(i => positions[i]);
        return { face, ids, points, box: new THREE.Box3().setFromPoints(points) };
      });
      for (const { surface, triangles } of hands) {
        const mesh = surface.group.skin; mesh.skeleton.update();
        const points = new Map(surface.vertices.map(i => [i, mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse)]));
        const faces = triangles.map(face => { const vertices = face.ids.map(i => points.get(i)!); return { ...face, points: vertices, box: new THREE.Box3().setFromPoints(vertices) }; });
        const result = crossings(faces, cloth, false);
        assert.equal(result.count, 0, `${id}/${combo}/${age}: palm or finger enters the new collar: ${JSON.stringify(result)}`);
      }
    }
  });
}
