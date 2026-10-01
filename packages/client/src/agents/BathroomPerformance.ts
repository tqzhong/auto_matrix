import * as THREE from 'three';
import { BATHROOM_FIGHT, newBathroomFight, type BathroomGesture, type SixthGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

const floorSamples = new WeakMap<CharacterRig, { mesh: THREE.Mesh; indices: number[] }[]>();
const directions = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1], [1, -1, 1], [-1, -1, 1], [1, -1, -1], [-1, -1, -1]];
function supports(rig: CharacterRig) {
  let samples = floorSamples.get(rig); if (samples) return samples;
  samples = rig.hero!.wardrobe.map(({ mesh }) => {
    const position = mesh.geometry.attributes.position, skinIndex = mesh.geometry.attributes.skinIndex, skinWeight = mesh.geometry.attributes.skinWeight;
    const groups = new Map<number, { scores: number[]; indices: number[] }>();
    for (let i = 0; i < position.count; i++) {
      let joint = 0;
      if (skinIndex && skinWeight) { let weight = -1; for (let j = 0; j < 4; j++) if (skinWeight.getComponent(i, j) > weight) { weight = skinWeight.getComponent(i, j); joint = skinIndex.getComponent(i, j); } }
      let group = groups.get(joint);
      if (!group) { group = { scores: directions.map(() => Infinity), indices: [] }; groups.set(joint, group); }
      for (const [index, direction] of directions.entries()) {
        const score = position.getX(i) * direction[0] + position.getY(i) * direction[1] + position.getZ(i) * direction[2];
        if (score < group.scores[index]) { group.scores[index] = score; group.indices[index] = i; }
      }
    }
    return { mesh, indices: [...new Set([...groups.values()].flatMap(group => group.indices))] };
  });
  floorSamples.set(rig, samples); return samples;
}

/** The fall and restraint operate on the delivered skeleton, including its shoes and coat panels. */
export function poseBathroom(rig: CharacterRig, gesture?: BathroomGesture, sixth?: SixthGesture): void {
  const landing = sixth && ['morpheus', 'smith'].includes(sixth.role) && ['breach', 'done'].includes(sixth.phase);
  if ((!gesture && !landing) || !rig.hero) return;
  const input: BathroomGesture = gesture ?? { ...newBathroomFight(), role: sixth!.role as BathroomGesture['role'] };
  const role = input.role, hero = rig.hero, bone = (name: string) => hero.bones.get(name)!;
  const grounded = ['ready', 'pinning', 'failed'].includes(input.phase) ? 1 : input.phase === 'breakout' ? 1 - THREE.MathUtils.smoothstep(input.elapsed, 1.2, 2.6) : 0;
  const landed = landing ? sixth!.phase === 'done' ? 1 : THREE.MathUtils.smoothstep(sixth!.elapsed, .8, 1.8) : grounded;
  const pin = landing ? landed : grounded;
  const down = role === 'smith' ? pin : input.phase === 'done' ? 1 : input.phase === 'capturing' ? THREE.MathUtils.smoothstep(input.elapsed, 1.3, 2.8) : 0;
  const pelvis = bone('pelvis');
  pelvis.position.copy(hero.rest.get('pelvis')!);
  pelvis.position.y = THREE.MathUtils.lerp(pelvis.position.y, role === 'smith' ? .62 : pin ? 1.35 : .65, Math.max(pin, down));
  pelvis.rotation.set(-Math.PI / 2 * down, 0, 0);
  bone('spine').rotation.set(role === 'morpheus' ? .7 * pin : 0, 0, 0);
  bone('chest').rotation.set(role === 'morpheus' ? .6 * pin : 0, 0, 0);
  bone('head').rotation.set(role === 'morpheus' ? -.18 * pin : 0, 0, 0);
  if (landing && role === 'morpheus' && sixth!.phase === 'breach') {
    const dive = Math.sin(THREE.MathUtils.clamp(sixth!.elapsed / 1.8, 0, 1) * Math.PI) * (1 - landed);
    pelvis.rotation.x += dive * 1.05; bone('shoulder_R').rotation.x = bone('shoulder_L').rotation.x = -1.2 * dive;
  }
  if (input.phase === 'breakout' && role === 'morpheus' && input.headbutt) {
    const strike = Math.sin(THREE.MathUtils.clamp((input.elapsed - .55) / .8, 0, 1) * Math.PI);
    bone('chest').rotation.x += strike * .7; bone('spine').rotation.x += strike * .3;
  }
  if (input.evaded && role === 'morpheus' && ['windup', 'opening'].includes(input.phase)) {
    bone('spine').rotation.z = -.32; bone('chest').rotation.z = -.22; bone('head').rotation.z = .18;
  }
  if (role === 'morpheus' && input.phase === 'counter') {
    const strike = Math.sin(Math.min(1, input.elapsed / BATHROOM_FIGHT.counter) * Math.PI);
    bone('spine').rotation.x += strike * .18; bone('chest').rotation.x += strike * .12;
  }
  for (const side of ['R', 'L']) { bone(`hip_${side}`).rotation.set(0, 0, 0); bone(`knee_${side}`).rotation.set(0, 0, 0); bone(`ankle_${side}`).rotation.set(0, 0, 0); }
  rig.root.updateWorldMatrix(true, true);
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  if (role === 'smith' && input.phase === 'capturing') {
    const kick = Math.sin(THREE.MathUtils.clamp((input.elapsed - .7) / 1.3, 0, 1) * Math.PI);
    bone('hip_R').rotation.x = -1.45 * kick; bone('knee_R').rotation.x = .25 * kick;
    bone('chest').rotation.x = -.18 * kick;
  }
  if (pin > 0 && role === 'morpheus') for (const [i, side] of ['R', 'L'].entries()) {
    const sign = i ? -1 : 1, upper = bone(`hip_${side}`), lower = bone(`knee_${side}`), ankle = bone(`ankle_${side}`);
    const foot = new THREE.Vector3(sign * .85, hero.footHeight + .08, -.9);
    const target = ankle.getWorldPosition(new THREE.Vector3()).lerp(hero.root.localToWorld(foot), pin);
    reach(upper, lower, ankle.position, target, new THREE.Vector3(sign * .7, -.55, 1).applyQuaternion(rotation));
    const orientation = rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -.5 * pin));
    ankle.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation)); ankle.updateWorldMatrix(false, true);
  }
  // The upright guard, side step and punch all have explicit wrist targets.
  const hand = (side: 'R' | 'L', target: THREE.Vector3, grip = .9) => {
    const sign = side === 'R' ? 1 : -1, wrist = bone(`wrist_${side}`), elbow = bone(`elbow_${side}`), shoulder = bone(`shoulder_${side}`);
    const orientation = rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
    const palm = new THREE.Vector3(0, -.19, .035).multiply(wrist.getWorldScale(new THREE.Vector3())).applyQuaternion(orientation);
    reach(shoulder, elbow, wrist.position, target.sub(palm), new THREE.Vector3(sign, -.35, .25).applyQuaternion(rotation));
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    for (let f = 1; f <= 5; f++) for (let segment = 1; segment <= 3; segment++) bone(`finger${f}-${segment}_${side}`).rotation.z = sign * (f === 1 ? .2 : segment === 1 ? .6 : .75) * grip;
    wrist.updateWorldMatrix(false, true);
  };
  for (const side of ['R', 'L'] as const) {
    const sign = side === 'R' ? 1 : -1;
    if (pin > .01 && role === 'morpheus') {
      const fallback = new THREE.Vector3(BATHROOM_FIGHT.pinned.smith.x, .62, BATHROOM_FIGHT.pinned.smith.z - 1.7);
      const contact = input.contact ? new THREE.Vector3(input.contact.x, input.contact.y, input.contact.z) : fallback.add(rig.root.getWorldPosition(new THREE.Vector3()).sub(new THREE.Vector3(BATHROOM_FIGHT.pinned.morpheus.x, 0, BATHROOM_FIGHT.pinned.morpheus.z)));
      const target = contact.add(new THREE.Vector3(sign * .19, .02, .06));
      hand(side, bone(`wrist_${side}`).localToWorld(new THREE.Vector3(0, -.19, .035)).lerp(target, pin), .35);
    } else {
      let target = new THREE.Vector3(sign * .35, down ? .65 : 3.15, down ? .5 : .75);
      if (role === 'smith' && pin > 0) target = new THREE.Vector3(sign * .48, 1.15, -1.3);
      const punching = role === 'smith' ? input.phase === 'opening' ? 1 - THREE.MathUtils.smoothstep(input.elapsed, 0, .3) : 0
        : input.phase === 'counter' ? Math.sin(Math.min(1, input.elapsed / BATHROOM_FIGHT.counter) * Math.PI) : 0;
      if (side === (input.counters % 2 ? 'L' : 'R')) {
        target.z += punching * 1.2;
        if (role === 'morpheus' && input.contact && punching > 0) {
          const hit = new THREE.Vector3(input.contact.x, input.contact.y, input.contact.z);
          hand(side, rig.root.localToWorld(target).lerp(hit, punching)); continue;
        }
      }
      if (input.phase === 'windup' && role === 'smith' && side === 'R') { target.z -= .25; target.y += .12; }
      hand(side, rig.root.localToWorld(target), pin > 0 ? .35 : .95);
    }
  }
  // Bone extremities are cached from the actual geometry; full-vertex regression
  // samples verify the authored angles without scanning every face each frame.
  let lowest = Infinity; const vertex = new THREE.Vector3(), floor = rig.root.getWorldPosition(new THREE.Vector3()).y;
  if (pin > .01 || down > .01) {
    rig.root.updateWorldMatrix(true, true);
    rig.root.updateMatrixWorld(true);
    for (const { mesh, indices } of supports(rig)) if (mesh.visible) {
      for (const i of indices) {
        mesh.getVertexPosition(i, vertex); mesh.localToWorld(vertex); lowest = Math.min(lowest, vertex.y);
      }
    }
    if (lowest < floor + .07 || role === 'morpheus' && down > .65) {
      const correction = floor + .07 - lowest;
      pelvis.position.y += correction * (correction < 0 ? THREE.MathUtils.smoothstep(down, .65, 1) : 1);
      rig.root.updateWorldMatrix(true, true);
    }
  }
}
