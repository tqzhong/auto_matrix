import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeModel, meshSurface } from '../morpheus-ambush-doff-2026-10-17/grip-fixture.mjs';
import { auditCage } from '../morpheus-ambush-doff-2026-10-17/cloth-rebuild/cage-contact.mjs';
import { FrontExitBody as WithdrawalBody } from './FrontExitBody.mjs';
import { AmbushSleeveBend } from '../../../packages/client/src/agents/AmbushSleeveBend.js';

const h = await makeModel(), body = new WithdrawalBody(h.rig, 'front-exit');
const shirt = h.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
const coat = h.rig.root.getObjectByName('morpheus-ambush-coat') as THREE.SkinnedMesh;
const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
const sleeves = new AmbushSleeveBend(h.rig, shirt, coat), rows = [];
const joints = (faces: number[]) => {
  const counts = new Map<string, number>(), { skinIndex, skinWeight } = shirt.geometry.attributes;
  for (const face of faces) for (let k = 0; k < 3; k++) {
    const id = shirt.geometry.index!.getX(face * 3 + k);
    for (let n = 0; n < 4; n++) if (skinWeight.getComponent(id, n) > .1) {
      const name = shirt.skeleton.bones[skinIndex.getComponent(id, n)].name;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1]);
};
for (const time of [1.6, 2, 2.4, 3.2, 3.5]) {
  sleeves.update(false); body.pose(time);
  const before = auditCage(meshSurface(shirt), [meshSurface(skin)]);
  sleeves.update(true);
  const after = auditCage(meshSurface(shirt), [meshSurface(skin)]);
  const row = { time, before: { self: before.selfCount, skin: before.bodyCount, joints: joints(before.self.flatMap(pair => [pair.face, pair.other])) },
    after: { self: after.selfCount, skin: after.bodyCount, joints: joints(after.self.flatMap(pair => [pair.face, pair.other])) } };
  rows.push(row); console.log(JSON.stringify(row));
}
await writeFile(new URL('front-sleeve-diagnosis.json', import.meta.url), JSON.stringify(rows, null, 2));
h.models.dispose();
