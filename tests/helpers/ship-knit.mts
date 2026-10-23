import type { TestContext } from 'node:test';
import * as THREE from 'three';
import { actor } from './fighting-hand-fixture.mjs';
import { intersection } from './hand-self-contact.mjs';
import { advanceMotion, newMotion, type MotionInput } from '../../packages/client/src/agents/CharacterMotion.js';

export async function shipKnit(t?: TestContext) {
  const h = await actor('morpheus');
  const sweater = h.rig.root.getObjectByName('morpheus-hammer-sweater') as THREE.SkinnedMesh;
  const original = sweater.geometry;
  const input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, nebCrew: 'morpheus', nebCrewEarly: true };
  const pose = (extra: Partial<MotionInput> = {}, state = newMotion(), delta = 0) => {
    const next = { ...input, ...extra };
    h.models.animate(h.rig, advanceMotion(state, next, delta), state, next, delta);
    h.rig.root.updateMatrixWorld(true);
  };
  const faceSurface = (mesh: THREE.SkinnedMesh) => {
    mesh.skeleton.update();
    const a = mesh.geometry.attributes, index = mesh.geometry.index!;
    const points = Array.from({ length: a.position.count }, (_, id) => mesh.getVertexPosition(id, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
    const keys = new Map<string, number>();
    const welded = Array.from({ length: a.position.count }, (_, id) => {
      const key = [a.position.getX(id), a.position.getY(id), a.position.getZ(id)].map(v => v.toFixed(6)).join(',');
      if (!keys.has(key)) keys.set(key, keys.size); return keys.get(key)!;
    });
    const faces = Array.from({ length: index.count / 3 }, (_, face) => {
      const ids = [0, 1, 2].map(k => index.getX(face * 3 + k)), vertices = ids.map(id => points[id]);
      return { face, ids: ids.map(id => welded[id]), points: vertices, box: new THREE.Box3().setFromPoints(vertices) };
    });
    return { points, faces, box: new THREE.Box3().setFromPoints(points) };
  };
  const contacts = () => {
    const crossings = (first: ReturnType<typeof faceSurface>, second: ReturnType<typeof faceSurface>, sameMesh: boolean) => {
      const cells = (box: THREE.Box3) => {
        const keys: string[] = [];
        for (let x = Math.floor(box.min.x / .05); x <= Math.floor(box.max.x / .05); x++)
          for (let y = Math.floor(box.min.y / .05); y <= Math.floor(box.max.y / .05); y++)
            for (let z = Math.floor(box.min.z / .05); z <= Math.floor(box.max.z / .05); z++) keys.push(`${x},${y},${z}`);
        return keys;
      };
      const grid = new Map<string, number[]>(), pairs: { first: number; second: number; line: number }[] = [];
      for (const face of second.faces) for (const key of cells(face.box)) {
        let ids = grid.get(key); if (!ids) grid.set(key, ids = []); ids.push(face.face);
      }
      for (const face of first.faces) for (const id of new Set(cells(face.box).flatMap(key => grid.get(key) ?? []))) {
        const other = second.faces[id];
        if (!face.box.intersectsBox(other.box) || sameMesh && face.ids.filter(v => other.ids.includes(v)).length >= 2) continue;
        const line = intersection(face.points, other.points);
        if (line > 1e-5) pairs.push({ first: face.face, second: other.face, line });
      }
      return { count: pairs.length, pairs };
    };
    const cloth = faceSurface(sweater), self = crossings(cloth, cloth, true), bodies: { mesh: string; count: number; pairs: typeof self.pairs }[] = [];
    h.rig.root.traverseVisible(object => {
      if (!(object instanceof THREE.SkinnedMesh) || object === sweater) return;
      const other = faceSurface(object);
      if (!cloth.box.intersectsBox(other.box)) return;
      const result = crossings(cloth, other, false);
      if (result.count) bodies.push({ mesh: object.name, ...result });
    });
    return { self, bodies };
  };
  const dispose = () => h.models.dispose(); t?.after(dispose);
  return { ...h, sweater, original, pose, contacts, faceSurface, dispose };
}
