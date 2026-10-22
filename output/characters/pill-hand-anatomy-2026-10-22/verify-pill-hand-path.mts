import assert from 'node:assert/strict';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { selfIntersections } from './hand-self-sweep.mjs';
import { cupTriangleProof } from './prop-surface.mjs';
const release = new URL(process.argv.includes('--candidate') ? './candidate-release/' : '../../../', import.meta.url);
const { actor, bends, fingerGroups } = await import(new URL('tests/helpers/fighting-hand-fixture.mjs', release).href);
const { handSurface } = await import(new URL('tests/helpers/hand-surface.mjs', release).href);
const { capsuleTriangleGap } = await import(new URL('tests/helpers/pill-prop-contact.mjs', release).href);
const { advanceMotion, newMotion } = await import(new URL('packages/client/src/agents/CharacterMotion.js', release).href);
const { FILM_SETS, PILL_ROOM, pillRoot } = await import(new URL('packages/shared/src/index.js', release).href);
const sourceNames = ['packages/client/src/agents/FightingHands.ts', 'packages/client/src/agents/PillPerformance.ts'];
const sourceHashes = async () => Object.fromEntries(await Promise.all(sourceNames.map(async name => [name, createHash('sha256').update(await readFile(new URL(name, release))).digest('hex')])));
const hashes = await sourceHashes(), samples = new URL('pill-path-samples.ndjson', import.meta.url);
await writeFile(samples, '');
const summary = { complete: false, sourceHashes: hashes, actorFrames: 0, fullHandPoses: 0, originalFacesPerHand: 12472, originalVerticesPerHand: 6673,
  maximumPIP: 0, maximumDIP: 0, maximumSeamGap: 0, capsuleTriangles: 0, minimumCapsuleGap: Infinity,
  cupTriangles: 0, cupSubdivisions: 0, minimumCupLowerBound: Infinity, selfIntersectionThreshold: 1e-5, allFacesRetained: true,
  sampling: '100ms throughout; 50ms during grip transitions; explicit boundary samples; both actors and both hands', continuousMathematicalProof: false };
function times(from: number, to: number, step: number): number[] {
  return Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => Number((from + i * step).toFixed(5)));
}
const taking = [...new Set([...times(0, 9.2, .1), ...times(.35, 1.8, .05), ...times(3.75, 4.35, .05), ...times(4.1, 5.3, .05), ...times(8.6, 9.2, .05),
  .3499, .3501, 1.7999, 1.8001, 3.6499, 3.6501, 3.7499, 3.7501, 4.3499, 4.3501, 9.1999, 9.2001, 9.6, 10, 10.5, 10.9, 10.9999, 11, 11.0001, 13, 15.7, 17])].sort((a, b) => a - b);
for (const role of ['morpheus', 'neo'] as const) {
  const h = await actor(role), surfaces = Object.fromEntries(['R', 'L'].map(side => [side, handSurface(h.rig, side)]));
  const cases = role === 'neo' ? (['red', 'blue'] as const).flatMap(choice => taking.map(elapsed => ({ role, choice, phase: 'taking' as const, elapsed })))
    : [...times(0, 5, .1).map(elapsed => ({ role, choice: 'red' as const, phase: 'offering' as const, elapsed })),
      ...times(0, 4.4, .1).map(elapsed => ({ role, choice: 'red' as const, phase: 'taking' as const, elapsed })),
      ...times(0, 6, .5).map(elapsed => ({ role, choice: 'red' as const, phase: 'talking' as const, elapsed, conversation: { beat: 0 } })),
      { role, choice: 'red' as const, phase: 'choice' as const, elapsed: 5 }, { role, choice: 'red' as const, phase: 'done' as const, elapsed: 17 }];
  try {
    for (const pills of cases) {
      const at = role === 'neo' ? pillRoot({ ...pills, approach: { x: PILL_ROOM.seat, z: PILL_ROOM.z, yaw: -Math.PI / 2 } })
        : { x: -PILL_ROOM.seat, z: PILL_ROOM.z, yaw: Math.PI / 2 }, center = FILM_SETS.film_lafayette.center;
      h.rig.root.position.set(center.x + at.x, center.y - 1, center.z + at.z); h.rig.root.rotation.y = at.yaw;
      const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, mirror: 0, seated: role === 'morpheus', pills }, state = newMotion();
      h.models.animate(h.rig, advanceMotion(state, input, 0), state, input, 0); h.rig.root.updateMatrixWorld(true); summary.actorFrames++;
      for (const side of ['R', 'L']) {
        const surface = surfaces[side], skin = surface.group.skin, a = skin.geometry.attributes, points = surface.posePoints(), twins = new Map<number, THREE.Vector3>();
        assert.equal(surface.vertices.length, 6673); assert.equal(surface.triangles.length, 12472);
        for (const id of surface.vertices) {
          const p = points.get(id)!; assert.ok(p.toArray().every(Number.isFinite));
          const previous = twins.get(surface.weld[id]);
          if (previous) { const gap = previous.distanceTo(p); summary.maximumSeamGap = Math.max(summary.maximumSeamGap, gap); assert.ok(gap < 2e-6); }
          else twins.set(surface.weld[id], p);
          const normal = new THREE.Vector3().fromBufferAttribute(a.normal, id); assert.ok(normal.toArray().every(Number.isFinite) && normal.length() > .99 && normal.length() < 1.01);
          const weights = [0, 1, 2, 3].map(k => a.skinWeight.getComponent(id, k)); assert.ok(weights.every(w => w >= 0) && Math.abs(weights.reduce((s, w) => s + w, 0) - 1) < 1e-6);
          assert.ok(skin.boundingBox!.containsPoint(skin.getVertexPosition(id, new THREE.Vector3())), 'actual culling bound excludes hand skin');
        }
        const faces = surface.triangles.map(t => {
          const v = t.ids.map(id => points.get(id)!); return { face: t.face, ids: t.ids.map(id => surface.weld[id]), points: v, box: new THREE.Box3().setFromPoints(v) };
        });
        const self = selfIntersections(faces); assert.equal(self.count, 0, `${JSON.stringify(pills)}/${side}: ${JSON.stringify(self.examples.slice(0, 4))}`);
        const angles = bends(h.rig, side, fingerGroups(h.rig, side));
        for (const finger of angles) {
          summary.maximumPIP = Math.max(summary.maximumPIP, finger.PIP); summary.maximumDIP = Math.max(summary.maximumDIP, finger.DIP);
          assert.ok(finger.PIP <= (finger.digit === 1 ? 100 : 115) && finger.DIP <= 90, `${JSON.stringify(pills)}/${side}: digit ${finger.digit} ${finger.PIP}/${finger.DIP}`);
        }
        const wrist = h.rig.bones.get('wrist_' + side)!;
        for (const color of ['red', 'blue']) {
          const prop = h.rig.root.getObjectByName(`held-${color}-pill`) as THREE.Mesh<THREE.CapsuleGeometry>;
          if (!prop.visible) continue;
          const toProp = prop.matrixWorld.clone().invert().multiply(wrist.matrixWorld), { radius, length } = prop.geometry.parameters;
          const local = new Map(surface.vertices.map(id => [id, points.get(id)!.clone().applyMatrix4(toProp)]));
          const bounds = new THREE.Box3(new THREE.Vector3(-radius, -length / 2 - radius, -radius), new THREE.Vector3(radius, length / 2 + radius, radius));
          for (const face of surface.triangles) {
            const p = face.ids.map(id => local.get(id)!) as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
            if (!new THREE.Box3().setFromPoints(p).intersectsBox(bounds)) continue;
            const gap = capsuleTriangleGap(p, radius, length); summary.minimumCapsuleGap = Math.min(summary.minimumCapsuleGap, gap); summary.capsuleTriangles++;
            assert.ok(gap >= -.003, `${JSON.stringify(pills)}/${side}: face ${face.face} enters ${color} capsule by ${-gap}`);
          }
        }
        const cup = h.rig.root.getObjectByName('pill-water-glass')!;
        if (cup.visible) {
          let profile: THREE.Vector2[] | undefined;
          cup.traverseVisible(object => { const geometry = (object as THREE.Mesh<THREE.LatheGeometry>).geometry; if (!profile && geometry?.type === 'LatheGeometry') profile = geometry.parameters.points; });
          assert.ok(profile); const bottom = profile[1], top = profile[2], toCup = cup.matrixWorld.clone().invert().multiply(wrist.matrixWorld);
          const local = new Map(surface.vertices.map(id => [id, points.get(id)!.clone().applyMatrix4(toCup)]));
          const bounds = new THREE.Box3(new THREE.Vector3(-top.x, bottom.y, -top.x), new THREE.Vector3(top.x, top.y, top.x));
          for (const face of surface.triangles) {
            const p = face.ids.map(id => local.get(id)!) as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
            if (!new THREE.Box3().setFromPoints(p).intersectsBox(bounds)) continue;
            const result = cupTriangleProof(p, bottom, top); summary.cupTriangles++; summary.cupSubdivisions += result.subdivisions;
            summary.minimumCupLowerBound = Math.min(summary.minimumCupLowerBound, result.minimumLowerBound);
            assert.ok(result.safe && !result.unresolved, `${JSON.stringify(pills)}/${side}: face ${face.face} cup ${JSON.stringify(result)}`);
          }
        }
        summary.fullHandPoses++;
        const row = { role, choice: pills.choice, phase: pills.phase, elapsed: pills.elapsed, side, self: self.count, maximumPIP: Math.max(...angles.map(a => a.PIP)), maximumDIP: Math.max(...angles.map(a => a.DIP)) };
        await appendFile(samples, JSON.stringify(row) + '\n');
        if (summary.fullHandPoses % 10 === 0) { console.log(JSON.stringify({ checked: summary.fullHandPoses, ...row })); await writeFile(new URL('pill-path-progress.json', import.meta.url), JSON.stringify(summary, null, 2) + '\n'); }
      }
    }
  } finally { h.models.dispose(); }
}
assert.deepEqual(await sourceHashes(), hashes); summary.complete = true;
await writeFile(new URL('pill-path-verification.json', import.meta.url), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary));
