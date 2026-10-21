import { writeFile } from 'node:fs/promises';
import { model, faces, crossings } from './release/output/characters/morpheus-upper-coat-2026-10-18/mesh-fixture.mjs';
import { advanceMotion, newMotion } from './release/packages/client/src/agents/CharacterMotion.js';
const h = await model(), state = newMotion(), input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
  attack: 1, combo: 2, ambushWardrobe: 'coat' as const };
let frame = 0, error: string | undefined;
try { for (; frame < 54; frame++) h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60); }
catch (caught) { error = (caught as Error).message; }
h.rig.root.updateMatrixWorld(true);
const coat = h.rig.root.getObjectByName('morpheus-ambush-coat') as any, trousers = h.rig.root.getObjectByName('Tailored_trousers') as any;
const wardrobe = (h.models as any).ambushWardrobes.get(h.rig), tails = wardrobe.tails, seam = tails.seam;
const result = { frame, error, state, hips: ['L', 'R'].map(side => h.rig.bones.get('hip_' + side)!.rotation.toArray()),
  coatMorphs: coat.morphTargetInfluences, shirtMorphs: wardrobe.source.morphTargetInfluences,
  upperTrouserContacts: crossings(faces(coat), faces(trousers), false),
  anchors: tails.anchors.map((anchor: any) => ({ vertex: anchor.vertex, point: anchor.point.toArray(), ids: anchor.ids, weights: anchor.weights.toArray() })),
  profiles: seam.panels.map((panel: any) => Array.from(panel.profile)),
  obstacles: tails.inner.map((surface: any) => ({ name: surface.mesh.name, points: Array.from(surface.points), triangles: Array.from(surface.triangles) })) };
await writeFile('sewn-kick-boundary.json', JSON.stringify(result));
console.log(JSON.stringify({ frame, error, hips: result.hips, coatMorphs: result.coatMorphs, shirtMorphs: result.shirtMorphs,
  contacts: result.upperTrouserContacts }, null, 2)); h.models.dispose();
