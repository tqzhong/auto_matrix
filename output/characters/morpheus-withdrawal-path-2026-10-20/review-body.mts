import { mkdir, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeModel, meshSurface } from '../morpheus-ambush-doff-2026-10-17/grip-fixture.mjs';
import { WithdrawalBody } from './WithdrawalBody.mjs';
import { WithdrawalBody as Before } from '../morpheus-doff-2026-10-19/WithdrawalBody-v3.mjs';

const directory = new URL('./runtime-meshes/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const [label, Body, times] of [['before', Before, [3.2]], ['after', WithdrawalBody, [3.2, 3.8, 6.4, 8]]] as const) {
  const h = await makeModel(), body = new Body(h.rig);
  const outer = ['morpheus-ambush-coat', 'morpheus-ambush-lapels'].map(name => h.rig.root.getObjectByName(name));
  outer.push(...h.rig.panels.map(panel => panel.mesh));
  const meshes: THREE.Mesh[] = [];
  h.rig.root.traverseVisible(object => { if (object instanceof THREE.Mesh && !outer.includes(object)) meshes.push(object); });
  for (const time of times) {
    body.pose(time);
    const surfaces = meshes.map(mesh => ({ ...meshSurface(mesh), color: mesh.name.includes('ambush-shirt') ? [.09,.12,.15] : mesh.name.includes('Anatomical') || mesh.name.startsWith('anatomical-wrist') ? [.44,.32,.25] : [.15,.18,.2] }));
    for (const [view, eye] of [['front', [5,3,8]], ['rear', [-5,3,-8]]] as const) {
      const name = `${label}-${time.toString().replace('.', 'p')}-${view}`;
      await writeFile(new URL(`${name}.json`, directory), JSON.stringify({ width: 720, height: 900, eye, target: [0,2.4,0], fov: 36,
        surfaces, renderSource: 'BODY PATH ONLY / OUTER COAT OMITTED FOR CONTACT DIAGNOSIS' }));
    }
  }
  h.models.dispose();
}
