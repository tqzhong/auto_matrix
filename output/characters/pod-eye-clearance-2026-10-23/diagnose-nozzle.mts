import { writeFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { podPatient } from './baseline-release/tests/helpers/pod-patient.mjs';
import { PlayerControls } from './baseline-release/packages/client/src/player/PlayerControls.js';

test('inspect the actual patient eye, close oral surfaces and camera view', async t => {
  const h = await podPatient(t);
  class InputTarget extends EventTarget { matches() { return false; } }
  const window = new InputTarget(), canvas = new InputTarget(), document = new InputTarget(), previous = globalThis.window;
  globalThis.window = window as unknown as Window & typeof globalThis;
  Object.assign(globalThis.document, { pointerLockElement: canvas, exitPointerLock() {}, hidden: false,
    addEventListener: document.addEventListener.bind(document), removeEventListener: document.removeEventListener.bind(document) });
  const camera = new THREE.PerspectiveCamera(68, 16 / 9, .5, 5000);
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  const rows: unknown[] = [];
  try {
    for (const elapsed of [0, 1.35, 1.8, 2.05, 2.648, 2.943, 3.2, 4, 4.8, 5.5]) {
      const beat = { kind: 'breather' as const, elapsed, emerged: true };
      h.at(elapsed, 100, false, beat);
      controls.possess(h.neo); controls.performing = true; controls.firstPerson = true;
      controls.update(1 / 60, h.neo, h.renderer.getAgent('neo')!, false);
      h.renderer.setPlayerMotion(controls.motion); const body = h.at(elapsed, 100, true, beat);
      const head = body.getObjectByName('head')!, original = camera.position.clone();
      const root = h.root.getObjectByName('pod-breather')!, meshes: THREE.Mesh[] = [];
      root.traverseVisible(object => { if (object instanceof THREE.Mesh) meshes.push(object); });
      const sample = () => {
        camera.updateMatrixWorld(true);
        let hits = 0, opaqueHits = 0, centralHits = 0, centralSamples = 0; const blockers: Record<string, number> = {};
        for (let y = 0; y < 11; y++) for (let x = 0; x < 17; x++) {
          const point = new THREE.Vector2(x / 8 - 1, y / 5 - 1), ray = new THREE.Raycaster(); ray.setFromCamera(point, camera); ray.near = camera.near; ray.far = 12;
          const intersections = ray.intersectObjects(meshes);
          if (intersections.length) hits++;
          const opaque = intersections.find(hit => !(hit.object as THREE.Mesh).material.transparent); if (opaque) { opaqueHits++; const name = opaque.object.name || opaque.object.parent!.name; blockers[name] = (blockers[name] ?? 0) + 1; }
          if (Math.abs(point.x) <= .5 && Math.abs(point.y) <= .4) { centralSamples++; if (intersections.length) centralHits++; }
        }
        let nearest = Infinity, nearestMesh = '';
        const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), triangle = new THREE.Triangle(), point = new THREE.Vector3();
        for (const mesh of meshes) {
          const position = mesh.geometry.attributes.position, index = mesh.geometry.index!;
          for (let i = 0; i < index.count; i += 3) {
            mesh.localToWorld(a.fromBufferAttribute(position, index.getX(i))); mesh.localToWorld(b.fromBufferAttribute(position, index.getX(i + 1))); mesh.localToWorld(c.fromBufferAttribute(position, index.getX(i + 2)));
            const distance = triangle.set(a, b, c).closestPointToPoint(camera.position, point).distanceTo(camera.position);
            if (distance < nearest) { nearest = distance; nearestMesh = mesh.name || mesh.parent!.name; }
          }
        }
        return { hits, opaqueHits, samples: 187, centralHits, centralSamples, nearest, nearestMesh, blockers };
      };
      const views: Record<string, unknown> = { current: sample() };
      const nozzle = root.getObjectByName('pod-oral-nozzle') as THREE.Mesh, originalGeometry = nozzle.geometry;
      nozzle.geometry = new THREE.LatheGeometry([[.068, -.11], [.083, .11], [.071, .11], [.056, -.11], [.068, -.11]].map(([x, y]) => new THREE.Vector2(x, y)), 32);
      views.hollowNozzle = sample(); nozzle.geometry.dispose(); nozzle.geometry = originalGeometry;
      for (const key of ['cameraEye', 'patientEye']) {
        const marker = head.userData[key] as THREE.Vector3 | undefined;
        if (!marker) continue;
        camera.position.copy(head.localToWorld(marker.clone())); views[key] = sample();
      }
      camera.position.copy(original);
      rows.push({ elapsed, eyeLocal: head.worldToLocal(original.clone()).toArray(), headScale: head.getWorldScale(new THREE.Vector3()).toArray(),
        cameraEye: (head.userData.cameraEye as THREE.Vector3 | undefined)?.toArray(), patientEye: (head.userData.patientEye as THREE.Vector3 | undefined)?.toArray(), views });
    }
  } finally { controls.dispose(); globalThis.window = previous; }
  await writeFile(new URL('./eye-nozzle-diagnostic.json', import.meta.url), JSON.stringify(rows, null, 2));
  t.diagnostic(JSON.stringify(rows));
});
