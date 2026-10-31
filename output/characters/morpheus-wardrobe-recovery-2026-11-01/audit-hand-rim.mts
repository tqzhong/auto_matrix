import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeModel, worldPoints } from '../morpheus-ambush-doff-2026-10-17/grip-fixture.mjs';
import { WithdrawalBody } from '../morpheus-withdrawal-path-2026-10-20/WithdrawalBody.mjs';

const base = new URL('./', import.meta.url);
const input = process.env.MORPHEUS_BODY_INPUT ?? 'full-removal-input';
const folder = process.env.MORPHEUS_CAGE_RESULT ?? 'full-removal-physics';
const data = JSON.parse(await readFile(new URL(`${input}/manifest.json`, base), 'utf8'));
const controls = JSON.parse(await readFile(new URL('boundary-controls.json', base), 'utf8'));
if (!['full-removal-input', 'shoulder-release-input'].includes(input)) throw new Error('This audit covers the published body controls only.');
const h = await makeModel(), body = new WithdrawalBody(h.rig, input === 'shoulder-release-input');
const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
const { skinIndex, skinWeight } = skin.geometry.attributes;
const rows = [];
for (const frame of [1, 7, 13, 19, 28, 73]) {
  const time = data.frames[frame - 1].time; body.pose(time);
  const hand = worldPoints(skin);
  const bytes = await readFile(new URL(`${folder}/cloth-${frame}.bin`, base));
  const coat = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  for (const cuff of controls.cuffs) for (const digit of [1, 2]) {
    const bone = skin.skeleton.bones.findIndex(bone => bone.name === `finger${digit}-3_${cuff.side}`);
    let distance = Infinity, pair;
    for (let i = 0; i < hand.length; i++) {
      if (![0, 1, 2, 3].some(k => skinIndex.getComponent(i, k) === bone && skinWeight.getComponent(i, k) > .95)) continue;
      for (let j = 0; j < cuff.ring.length; j++) {
        const points = [cuff.ring[j], cuff.ring[(j + 1) % cuff.ring.length]].map(id => new THREE.Vector3(coat[id * 3] / .4, coat[id * 3 + 2] / .4, -coat[id * 3 + 1] / .4));
        const closest = new THREE.Line3(...points as [THREE.Vector3, THREE.Vector3]).closestPointToPoint(hand[i], true, new THREE.Vector3());
        const gap = hand[i].distanceTo(closest) * .4;
        if (gap < distance) { distance = gap; pair = { skinVertex: i, rimEdge: [cuff.ring[j], cuff.ring[(j + 1) % cuff.ring.length]], hand: hand[i].toArray(), rim: closest.toArray() }; }
      }
    }
    rows.push({ frame, time, side: cuff.side, digit, distanceMetres: distance, pair });
  }
}
await writeFile(new URL(input === 'full-removal-input' ? 'hand-rim-audit.json' : `${input}-hand-rim-audit.json`, base), JSON.stringify(rows, null, 2));
console.log(JSON.stringify(rows.map(({ pair, ...row }) => row)));
h.models.dispose();
