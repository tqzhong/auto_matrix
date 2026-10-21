import { writeFile } from 'node:fs/promises';
import { model, faces, crossings } from './release/output/characters/morpheus-upper-coat-2026-10-18/mesh-fixture.mjs';
import { advanceMotion, newMotion } from './release/packages/client/src/agents/CharacterMotion.js';
import { PLAYER_RUN_SPEED } from './release/packages/shared/dist/index.js';
const h = await model(), state = newMotion();
const input = { speed: PLAYER_RUN_SPEED, grounded: true, verticalVelocity: 0, turn: 0, ambushWardrobe: 'coat' as const };
h.rig.root.position.set(4, 2, -3); h.rig.root.rotation.y = .43;
for (let frame = -59; frame <= 12; frame++) h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
h.rig.root.updateMatrixWorld(true);
const trousers = faces(h.rig.root.getObjectByName('Tailored_trousers') as any);
const coat = faces(h.rig.root.getObjectByName('morpheus-ambush-coat') as any);
const inverse = h.rig.bones.get('pelvis')!.matrixWorld.clone().invert();
const mesh = h.rig.panels[0].mesh, index = mesh.geometry.index!;
const vertices = Array.from({ length: mesh.geometry.attributes.position.count }, (_, id) => mesh.getVertexPosition(id, h.rig.root.position.clone()).applyMatrix4(mesh.matrixWorld));
const tail = Array.from({ length: index.count / 3 }, (_, face) => {
  const ids = [0,1,2].map(k => index.getX(face * 3 + k)), points = ids.map(id => vertices[id]);
  return { face, ids, points, box: trousers[0].box.clone().setFromPoints(points) };
});
const detail = (surface: typeof tail, id: number) => ({ id, vertices: surface[id].ids, pelvisPoints: surface[id].points.map(point => point.clone().applyMatrix4(inverse).toArray()) });
const result = { input, motion: state, coatTrousers: crossings(coat, trousers, false), tailTrousers: crossings(tail, trousers, false),
  tail: [0,1,5,6,7,80].map(id => detail(tail,id)), trousers: [2259,2258,2254,2073].map(id => detail(trousers,id)) };
await writeFile('hem-lower-run12-contact.json', JSON.stringify(result,null,2)); console.log(JSON.stringify(result,null,2)); h.models.dispose();
