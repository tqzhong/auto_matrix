import { writeFile } from 'node:fs/promises';
import { model, faces, crossings } from './release/output/characters/morpheus-upper-coat-2026-10-18/mesh-fixture.mjs';
import { advanceMotion, newMotion } from './release/packages/client/src/agents/CharacterMotion.js';
const h = await model(), wardrobe = (h.models as any).ambushWardrobes.get(h.rig);
wardrobe.poseTails = () => true;
const state = newMotion(), input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, attack: 1, combo: 2, ambushWardrobe: 'coat' as const };
for (let frame = 0; frame <= 15; frame++) h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
const coat = wardrobe.coat, index = coat.geometry.index, a = coat.geometry.attributes;
const bones = (face: number) => {
  const totals = new Map<string, number>();
  for (let k = 0; k < 3; k++) for (let slot = 0; slot < 4; slot++) {
    const id = index.getX(face * 3 + k), amount = a.skinWeight.getComponent(id, slot), name = coat.skeleton.bones[a.skinIndex.getComponent(id, slot)].name;
    if (amount > .01) totals.set(name, (totals.get(name) ?? 0) + amount);
  }
  return [...totals].sort((a, b) => b[1] - a[1]).slice(0, 3);
};
const results = [];
for (const offset of [0, .06, .12, .18, .24, .3]) {
  wardrobe.relaxedArmOffset = () => offset;
  h.models.animate(h.rig, advanceMotion(state, input, 0), state, input, 0); h.rig.root.updateMatrixWorld(true);
  const surface = faces(coat), result = crossings(surface, surface, true);
  results.push({ offset, count: result.count, examples: result.examples.map(pair => ({ ...pair, firstBones: bones(pair.first), secondBones: bones(pair.second) })) });
}
await writeFile('kick-armspace-probe.json', JSON.stringify(results, null, 2)); console.log(JSON.stringify(results, null, 2)); h.models.dispose();
