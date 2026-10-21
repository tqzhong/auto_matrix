import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import * as baseline from './baseline-fixture.mjs';
import * as current from './mesh-fixture.mjs';
import { newMotion, advanceMotion } from './release/packages/client/src/agents/CharacterMotion.js';
const results = [];
for (const [name, fixture] of [['before', baseline], ['after', current]] as const) {
  const h = await fixture.model(), state = newMotion(), input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, attack: 1, combo: 2, ambushWardrobe: 'coat' as const };
  try {
    for (let frame = 0; frame <= 15; frame++) h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
    h.rig.root.updateMatrixWorld(true);
    const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, surface = current.faces(skin);
    const report = { name, skinFaces: surface.length, garments: ['morpheus-ambush-shirt', 'morpheus-ambush-coat'].map(name => {
      const mesh = h.rig.root.getObjectByName(name) as THREE.SkinnedMesh;
      return { name, ...current.crossings(current.faces(mesh), surface, false) };
    }) };
    results.push(report); console.log(JSON.stringify(report));
  } finally { h.models.dispose(); }
}
await writeFile(new URL('elbow-skin-contact.json', import.meta.url), JSON.stringify(results, null, 2) + '\n');
