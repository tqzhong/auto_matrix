import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { model, faces, crossings } from './mesh-fixture.mjs';
import { advanceMotion, newMotion, type MotionInput } from './release/packages/client/src/agents/CharacterMotion.js';

const h = await model(), results = [];
try {
  h.rig.root.position.set(-3, 2, 1); h.rig.root.rotation.y = .37;
  const coat = h.rig.root.getObjectByName('morpheus-ambush-coat') as THREE.SkinnedMesh;
  const shirt = h.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
  const elbows = [coat, shirt].map(mesh => {
    const a = mesh.geometry.attributes;
    return new Set(Array.from({ length: a.position.count }, (_, id) => id).filter(id => ['R', 'L'].some(side => {
      const weight = (joint: string) => [0, 1, 2, 3].reduce((sum, k) => sum + (mesh.skeleton.bones[a.skinIndex.getComponent(id, k)].name === joint + '_' + side ? a.skinWeight.getComponent(id, k) : 0), 0);
      return weight('shoulder') > .05 && weight('elbow') > .05;
    })));
  });
  for (const combo of [0, 1, 2]) {
    const state = newMotion(), input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, attack: 1, combo, ambushWardrobe: 'coat' };
    for (let frame = 0; frame < 90; frame++) {
      h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
      if (![0, 3, 6, 9, 12, 15, 19, 25, 37, 53, 71, 89].includes(frame)) continue;
      h.rig.root.updateMatrixWorld(true);
      const outer = faces(coat), inner = faces(shirt);
      const joint = [outer, inner].map((surface, i) => surface.filter(face => face.ids.some(id => elbows[i].has(id))));
      const entry = { combo, frame, coat: crossings(outer, outer), shirt: crossings(inner, inner), layers: crossings(outer, inner, false),
        elbowCoat: crossings(joint[0], outer), elbowShirt: crossings(joint[1], inner),
        elbowLayers: crossings(joint[0], inner, false) };
      results.push(entry); console.log(JSON.stringify(entry));
    }
  }
} finally { h.models.dispose(); }
await writeFile(new URL('elbow-sweep.json', import.meta.url), JSON.stringify(results, null, 2) + '\n');
if (results.some(pose => pose.coat.count || pose.shirt.count || pose.layers.count)) process.exitCode = 1;
