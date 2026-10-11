import * as THREE from 'three';
import { FILM_SETS, POD_BREATHER, podBreatherPose, podEmergencePose, podRescuePose, podRunoffHeight } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import { reach } from './SpoonPerformance.js';

const runoffContacts = new WeakMap<HeroRig, { elapsed: number; frame: THREE.Matrix4; meshes: THREE.SkinnedMesh[]; correction: number }>();

function placeRunoffBody(rig: HeroRig, elapsed: number): void {
  const weight = THREE.MathUtils.smoothstep(elapsed, 4.5, 5.1) * (1 - THREE.MathUtils.smoothstep(elapsed, 7, 8.4));
  if (!weight) return;
  rig.root.updateWorldMatrix(true, true);
  const meshes = rig.wardrobe.map(part => part.mesh).filter((mesh): mesh is THREE.SkinnedMesh => mesh instanceof THREE.SkinnedMesh && ((mesh.material as THREE.Material).name === 'Skin' || mesh.userData.patientBody));
  const previous = runoffContacts.get(rig), frame = rig.root.matrixWorld.clone();
  let correction = previous?.correction ?? 0;
  if (!previous || previous.elapsed !== elapsed || !previous.frame.equals(frame) || meshes.length !== previous.meshes.length || meshes.some((mesh, i) => mesh !== previous.meshes[i])) {
    const center = FILM_SETS.film_power_plant_pods.center, point = new THREE.Vector3(); let minimum = Infinity;
    for (const mesh of meshes) {
      mesh.updateMatrixWorld(true); mesh.skeleton.update();
      const positions = mesh.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        mesh.getVertexPosition(i, point); mesh.localToWorld(point);
        const height = podRunoffHeight(point.x - center.x, point.z - center.z);
        if (height !== undefined) minimum = Math.min(minimum, point.y - (center.y - 1 + height));
      }
    }
    correction = Number.isFinite(minimum) ? .02 - minimum : 0;
    runoffContacts.set(rig, { elapsed, frame, meshes, correction });
  }
  const pelvis = rig.bones.get('pelvis')!, target = pelvis.getWorldPosition(new THREE.Vector3());
  target.y += correction * weight; pelvis.position.copy(pelvis.parent!.worldToLocal(target));
  rig.root.updateWorldMatrix(true, true);
}

/** The saved disconnection clock drives the supported body, including paused loads. */
export function posePodWake(rig: HeroRig, elapsed: number | undefined, breather?: number, emergence?: number, disconnect?: number, rescue?: number): void {
  if (elapsed === undefined && rescue === undefined) return;
  const emerging = emergence === undefined ? undefined : podEmergencePose(emergence);
  const smooth = THREE.MathUtils.smoothstep, t = emerging ? 1.35 * emerging.rise : elapsed ?? 9;
  const sitting = smooth(t, .1, 1.35) * (1 - smooth(t, 3.8, 5.2));
  const support = smooth(t, .08, .45) * (1 - smooth(t, 3.6, 4.05));
  const inspect = smooth(t, 1.3, 1.75) * (1 - smooth(t, 2.25, 2.6));
  const scan = smooth(t, 2.35, 2.8) * (1 - smooth(t, 3.4, 3.8));
  const strain = disconnect === undefined ? 0 : smooth(disconnect, 2.75, 2.98) * (1 - smooth(disconnect, 3.35, 3.75));
  const bone = (name: string) => rig.bones.get(name)!;
  const pelvis = bone('pelvis'); pelvis.position.copy(rig.rest.get('pelvis')!);
  pelvis.rotation.set(1.2 * sitting, 0, 0);
  bone('spine').rotation.set((.04 + Math.sin(t * 7) * .012) * sitting, 0, 0);
  bone('chest').rotation.set(.05 * sitting - .04 * strain, 0, 0);
  bone('head').rotation.set((.15 + .18 * inspect) * sitting - .18 * strain, -.3 * scan, 0);
  for (const [i, side] of ['R', 'L'].entries()) {
    const sign = i ? 1 : -1;
    // Counter-rotate the hips so sitting up cannot lift the legs out of the basin.
    bone(`hip_${side}`).rotation.set(-.2 - pelvis.rotation.x, 0, 0);
    bone(`knee_${side}`).rotation.set(.45 + Math.sin(t * 8 + i) * .025 * sitting, 0, 0);
    bone(`ankle_${side}`).rotation.set(-.1, 0, 0);
    bone(`shoulder_${side}`).rotation.set(-.5, 0, sign * .25);
    bone(`elbow_${side}`).rotation.set(-.7, 0, 0);
    bone(`wrist_${side}`).rotation.set(0, 0, 0);
    for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++)
      bone(`finger${finger}-${segment}_${side}`).rotation.set(0, 0, -sign * (finger === 1 ? .15 : .25));
  }
  rig.root.updateWorldMatrix(true, true);
  if (disconnect !== undefined && disconnect >= 3.8 || rescue !== undefined) {
    const release = rescue === undefined ? smooth(disconnect!, 3.8, 4.5) : 1;
    const water = rescue === undefined ? smooth(disconnect!, 6.55, 8.6) : 1;
    const held = rescue === undefined ? 0 : podRescuePose(rescue).grip;
    const mix = THREE.MathUtils.lerp;
    pelvis.rotation.x = mix(pelvis.rotation.x, .35 * (1 - water), release);
    bone('spine').rotation.set(mix(bone('spine').rotation.x, .2 * (1 - water), release), 0, 0);
    bone('chest').rotation.set(mix(bone('chest').rotation.x, .18 * (1 - water), release), 0, 0);
    bone('head').rotation.set(mix(bone('head').rotation.x, .22 * (1 - water), release), 0, 0);
    for (const [i, side] of ['R', 'L'].entries()) {
      const sign = i ? 1 : -1;
      bone(`hip_${side}`).rotation.x = mix(bone(`hip_${side}`).rotation.x, mix(-1.05, mix(-.2, i ? -.08 : .12, held), water), release);
      bone(`knee_${side}`).rotation.x = mix(bone(`knee_${side}`).rotation.x, mix(1.85, mix(.45, i ? .3 : .18, held), water), release);
      bone(`ankle_${side}`).rotation.x = mix(bone(`ankle_${side}`).rotation.x, -.2 * (1 - water), release);
      bone(`shoulder_${side}`).rotation.set(mix(-.5, -1.6 + 1.1 * water, release), 0, sign * mix(.25, .25 + .182 * water, release));
      bone(`elbow_${side}`).rotation.x = mix(-.7, mix(-1.4, mix(-.7, -.18, held), water), release);
    }
    rig.root.updateWorldMatrix(true, true);
    if (disconnect !== undefined) placeRunoffBody(rig, disconnect);
  }
  if (!support && !emerging) return;
  const center = FILM_SETS.film_power_plant_pods.center;
  const z = -.6 / 3.4, rimX = 1.8 * Math.sqrt(1 - z * z) * (.84 - .16 * z);
  for (const [i, side] of ['R', 'L'].entries()) {
    const sign = i ? 1 : -1;
    const shoulder = bone(`shoulder_${side}`), elbow = bone(`elbow_${side}`), wrist = bone(`wrist_${side}`);
    const contact = new THREE.Vector3(center.x + sign * rimX, center.y - 1 + 2.16, center.z - 13.4);
    const orientation = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, Math.PI, 0)), support);
    // Calibrated to the shipped wrist/finger skin surface, rather than the bone center.
    const palm = new THREE.Vector3(-sign * .09, -.18, .15);
    const target = wrist.localToWorld(palm.clone()).lerp(contact, support).sub(palm.applyQuaternion(orientation));
    reach(shoulder, elbow, wrist.position, target, new THREE.Vector3(sign, .2, -.45));
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    wrist.updateWorldMatrix(false, true);
  }
  if (emerging) {
    for (const [i, side] of ['R', 'L'].entries()) {
      const sign = i ? 1 : -1, blend = 1 - smooth(emergence!, 3.65, 4.75);
      const shoulder = bone(`shoulder_${side}`), elbow = bone(`elbow_${side}`), wrist = bone(`wrist_${side}`);
      const contact = new THREE.Vector3(center.x + sign * (.42 + .78 * emerging.tear),
        center.y - 1 + 2.5 + .2 * emerging.press + .7 * emerging.rise - .95 * emerging.clear, center.z - 14.5 + .75 * emerging.rise);
      const orientation = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, Math.PI, 0)), blend);
      const palm = new THREE.Vector3(-sign * .09, -.18, .15);
      const target = wrist.localToWorld(palm.clone()).lerp(contact, blend).sub(palm.applyQuaternion(orientation));
      reach(shoulder, elbow, wrist.position, target, new THREE.Vector3(sign, -.25, .35));
      wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
      for (let finger = 2; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++)
        bone(`finger${finger}-${segment}_${side}`).rotation.z = -sign * (.04 + .21 * emerging.tear);
      wrist.updateWorldMatrix(false, true);
    }
    return;
  }
  if (breather === undefined) return;
  const pose = podBreatherPose(breather), head = bone('head');
  const orientation = head.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pose.tilt));
  const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(orientation), lateral = new THREE.Vector3(1, 0, 0).applyQuaternion(orientation);
  const end = head.localToWorld(new THREE.Vector3(pose.x, pose.y, pose.z));
  for (const [i, side] of ['R', 'L'].entries()) {
    const sign = i ? 1 : -1, blend = i ? pose.reachL : pose.reachR;
    if (!blend) continue;
    const shoulder = bone(`shoulder_${side}`), elbow = bone(`elbow_${side}`), wrist = bone(`wrist_${side}`);
    const rotation = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(orientation, blend);
    const palm = new THREE.Vector3(-sign * .2, -.18, .13);
    const contact = end.clone().addScaledVector(axis, i ? .44 : .15).addScaledVector(lateral, sign * POD_BREATHER.radius);
    const target = wrist.localToWorld(palm.clone()).lerp(contact, blend).sub(palm.applyQuaternion(rotation));
    reach(shoulder, elbow, wrist.position, target, lateral.clone().multiplyScalar(sign).add(new THREE.Vector3(0, -.7, 0)));
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
    for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++)
      bone(`finger${finger}-${segment}_${side}`).rotation.set(finger === 1 ? .1 * blend : 0, 0,
        -sign * THREE.MathUtils.lerp(finger === 1 ? .15 : .25, finger === 1 ? .15 : segment === 1 ? .3 : .42, blend));
    wrist.updateWorldMatrix(false, true);
    const thumb = [1, 2, 3].map(segment => bone(`finger1-${segment}_${side}`));
    const tip = new THREE.Vector3(-sign * .02, -.02, .012);
    const thumbContact = end.clone().addScaledVector(axis, i ? .44 : .15)
      .addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(orientation), -POD_BREATHER.radius - .055);
    const thumbTarget = thumb[2].localToWorld(tip.clone()).lerp(thumbContact, blend);
    for (let iteration = 0; iteration < 8; iteration++) for (const joint of [...thumb].reverse()) {
      const current = joint.worldToLocal(thumb[2].localToWorld(tip.clone())).normalize();
      const desired = joint.worldToLocal(thumbTarget.clone()).normalize();
      joint.quaternion.multiply(new THREE.Quaternion().setFromUnitVectors(current, desired));
      joint.updateWorldMatrix(false, true);
    }
  }
}
