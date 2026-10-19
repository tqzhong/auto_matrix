import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeModel, meshSurface } from '../morpheus-ambush-doff-2026-10-17/grip-fixture.mjs';
import { WithdrawalBody } from './WithdrawalBody.mjs';
import { WithdrawalBody as Before } from './WithdrawalBody-before-thumb.mjs';
for (const [label, Body] of [['before', Before], ['after', WithdrawalBody]] as const) {
  const h = await makeModel(), body = new Body(h.rig); body.pose(.8);
  const mesh = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const surface = meshSurface(mesh), inverse = h.rig.bones.get('wrist_R')!.matrixWorld.clone().invert();
  surface.vertices = surface.vertices.map(point => new THREE.Vector3().fromArray(point).applyMatrix4(inverse).toArray());
  surface.indices = surface.indices.filter((_, i) => {
    const ids = surface.indices.slice(Math.floor(i/3)*3, Math.floor(i/3)*3+3);
    return ids.every(id => Math.abs(surface.vertices[id][0]) < .4 && Math.abs(surface.vertices[id][2]) < .4 && surface.vertices[id][1] < .1);
  });
  surface.color = [.5,.3,.2]; surface.side = THREE.DoubleSide;
  for (const [view, eye] of [['palm', [1.3,-.25,.1]], ['thumb', [.1,-.25,1.3]]] as const) {
    const name = `thumb-${label}-${view}`;
    await writeFile(new URL(`runtime-meshes/${name}.json`, import.meta.url), JSON.stringify({ width: 720, height: 900, eye, target: [.05,-.26,.02], fov: 33,
      surfaces: [surface], renderSource: 'ACTUAL HAND IN WRIST FRAME / CONTACT DIAGNOSIS' }));
  }
  h.models.dispose();
}
