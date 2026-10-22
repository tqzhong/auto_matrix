import * as THREE from 'three';
import { FILM_SETS, filmPosition, mirrorEntryPose, mirrorTime } from '@auto_matrix/shared';
import { actor } from './candidate-release/tests/helpers/fighting-hand-fixture.mjs';
import { newMotion, advanceMotion } from './candidate-release/packages/client/src/agents/CharacterMotion.js';
import { PlayerControls as Candidate } from './candidate-release/packages/client/src/player/PlayerControls.js';
import { PlayerControls as Baseline } from './baseline-release/packages/client/src/player/PlayerControls.js';
import { FilmSetRenderer } from './candidate-release/packages/client/src/engine/FilmSetRenderer.js';
import { WorldState } from './candidate-release/packages/server/src/world/WorldState.js';
import { AgentManager } from './candidate-release/packages/server/src/agents/AgentManager.js';

const h = await actor('neo');
class InputTarget extends EventTarget { matches() { return false; } }
const window = new InputTarget(), canvas = new InputTarget();
const context = { fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {} };
Object.assign(globalThis, { window, document: Object.assign(new InputTarget(), { pointerLockElement: canvas, hidden: false, exitPointerLock() {}, createElement: () => ({ getContext: () => context }) }) });
THREE.TextureLoader.prototype.load = () => new THREE.Texture();
const world = new WorldState(); new AgentManager(world).initializeAllAgents();
const neo = world.agents.get('neo')!; neo.currentLocation = 'film_lafayette'; neo.isInMatrix = true;
neo.position = filmPosition('film_lafayette', -7.1, -14.6);
const renderer = new FilmSetRenderer(new THREE.Scene()); renderer.update(neo, undefined, 0); renderer.root.updateMatrixWorld(true);
const group = new THREE.Group(); h.rig.root.position.set(0, -1, 0); group.add(h.rig.root);
const records: { variant: string; approach: number; aspect: number; elapsed: number; eyeError: number; rays: THREE.Line3[] }[] = [];
try {
  for (const [variant, Controller] of [['baseline', Baseline], ['candidate', Candidate]] as const) {
    const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
    const controls = new Controller(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
    try { for (const aspect of [16 / 9, .65]) for (const [index, approach] of [
      { x: -7.1, z: -14.6, yaw: .45 }, { x: -7.0594900428505, z: -14.53079340651, yaw: -2.6137389711102355 },
    ].entries()) {
      const beat = { kind: 'mirror' as const, elapsed: 0, chairMotion: 'stepping' as const, approach }, entry = mirrorEntryPose(beat);
      neo.position = filmPosition('film_lafayette', approach.x, approach.z); neo.rotation = approach.yaw;
      controls.possess(neo); controls.firstPerson = true; camera.aspect = aspect;
      const times = Array.from({ length: Math.ceil(entry.duration / .22) + 1 }, (_, i) => Math.min(entry.duration, i * .22));
      times.push(entry.duration + .853, entry.duration + 2.1, entry.duration + 4.4);
      const motion = newMotion();
      for (const elapsed of times) {
        const saved = { ...beat, elapsed }, pose = mirrorEntryPose(saved);
        neo.position = filmPosition('film_lafayette', pose.x, pose.z); neo.rotation = pose.yaw;
        neo.currentAction = { type: 'idle', parameters: { filmPose: 'touch', mirrorBeat: mirrorTime(saved), mirrorEntry: saved }, startedAt: 0, duration: 1, progress: 0 };
        controls.performing = true; controls.update(.05, neo, group, false);
        h.models.animate(h.rig, advanceMotion(motion, controls.motion, 0), motion, controls.motion, 0); group.updateMatrixWorld(true);
        (controls as Candidate).syncTrackingCamera?.(group); camera.updateMatrixWorld(true);
        const head = h.rig.bones.get('head')!, marker = head.userData.cameraEye;
        const eye = head.localToWorld(marker.clone()), rays = [new THREE.Line3(eye, camera.position.clone())];
        for (const x of [-1, 1]) for (const y of [-1, 1]) rays.push(new THREE.Line3(camera.position.clone(), new THREE.Vector3(x, y, -1).unproject(camera)));
        records.push({ variant, aspect, approach: index, elapsed, eyeError: eye.distanceTo(camera.position), rays });
      }
    } } finally { controls.dispose(); }
  }
  const region = new THREE.Box3().setFromPoints(records.flatMap(record => record.rays.flatMap(ray => [ray.start, ray.end]))).expandByScalar(.05);
  const positions: number[] = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), box = new THREE.Box3(); let allTriangles = 0;
  renderer.root.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh) || !object.castShadow || Array.isArray(object.material) || object.material.transparent) return;
    const p = object.geometry.attributes.position, index = object.geometry.index, count = index?.count ?? p.count;
    for (let face = 0; face < count; face += 3) {
      allTriangles++;
      [a, b, c].forEach((point, k) => point.fromBufferAttribute(p, index ? index.getX(face + k) : face + k).applyMatrix4(object.matrixWorld));
      box.setFromPoints([a, b, c]); if (!box.intersectsBox(region)) continue;
      positions.push(...a.toArray(), ...b.toArray(), ...c.toArray());
    }
  });
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), solids = new THREE.Mesh(geometry, material); solids.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), direction = new THREE.Vector3(), failures: object[] = [];
  for (const record of records) for (const [corner, line] of record.rays.entries()) {
    const length = line.distance(); if (length < 1e-7) continue;
    ray.set(line.start, line.delta(direction).normalize()); ray.near = .0001; ray.far = length + .001;
    const hit = ray.intersectObject(solids)[0];
    if (hit) failures.push({ variant: record.variant, approach: record.approach, aspect: record.aspect, elapsed: record.elapsed, corner, point: hit.point.toArray() });
  }
  console.log(JSON.stringify({ eyeMarker: 'metadata.cameraEye', frames: records.length, allTriangles, exactTrianglesInRayRegion: positions.length / 9,
    variants: ['baseline', 'candidate'].map(variant => ({ variant, frames: records.filter(r => r.variant === variant).length, maximumEyeError: Math.max(...records.filter(r => r.variant === variant).map(r => r.eyeError)), failures: failures.filter((f: any) => f.variant === variant) })),
    scope: 'Exact visible opaque scenery triangles intersecting the union AABB of sampled lens segments; current posed head to lens and four near-plane corners, two approaches, two aspects, 0.22-second sampling. No NPC meshes or arbitrary mouse directions.' }, null, 2));
  geometry.dispose(); material.dispose();
} finally { renderer.dispose(); h.models.dispose(); }
