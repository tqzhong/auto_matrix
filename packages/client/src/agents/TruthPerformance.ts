import * as THREE from 'three';
import { FILM_SETS, truthKneel, truthRest, type TruthGesture } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import { reach } from './SpoonPerformance.js';

/** The aftermath of the first truth lesson, using the current character skeleton. */
export class TruthPerformance {
  private battery = new THREE.Group();
  private soles?: { bone: THREE.Bone; points: THREE.Vector3[] }[];
  private flatHands = new Map<string, THREE.Quaternion[]>();
  constructor(private rig: HeroRig) {
    this.battery.name = 'truth-held-battery'; this.battery.position.set(.08, -.18, .025);
    const shell = new THREE.MeshStandardMaterial({ color: 0x1b1c1a, roughness: .42, metalness: .7 });
    const cap = new THREE.MeshStandardMaterial({ color: 0x937655, roughness: .35, metalness: .8 });
    for (const [radius, height, y, material] of [[.12, .38, 0, shell], [.125, .12, .23, cap], [.045, .025, .3, cap]] as const) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 20), material);
      mesh.position.y = y; mesh.castShadow = true; this.battery.add(mesh);
    }
    rig.bones.get('wrist_R')!.add(this.battery); this.battery.visible = false;
  }

  pose(gesture: TruthGesture | undefined): void {
    this.battery.visible = Boolean(gesture?.role === 'morpheus' && ['ready', 'exit'].includes(gesture.phase));
    if (!gesture) return;
    const bone = (name: string) => this.rig.bones.get(name)!, t = gesture.elapsed;
    if (this.battery.visible) {
      const hold = gesture.phase === 'ready' ? 1 : 1 - THREE.MathUtils.smoothstep(t, 1.5, 3);
      bone('shoulder_R').rotation.x = THREE.MathUtils.lerp(bone('shoulder_R').rotation.x, -.15, hold);
      bone('elbow_R').rotation.x = THREE.MathUtils.lerp(bone('elbow_R').rotation.x, -1.2, hold);
      for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++)
        bone(`finger${finger}-${segment}_R`).rotation.z = finger === 1 ? .15 : .65;
    }
    if (gesture.role === 'neo' && gesture.phase === 'exit') {
      const refuse = THREE.MathUtils.smoothstep(t, .2, 1) * (1 - THREE.MathUtils.smoothstep(t, 4.2, 5.4));
      bone('head').rotation.y += Math.sin(t * 3) * .1 * refuse;
      for (const side of ['L', 'R']) { bone(`shoulder_${side}`).rotation.x -= .6 * refuse; bone(`elbow_${side}`).rotation.x -= .65 * refuse; }
    }
    if (gesture.role === 'neo' && gesture.phase === 'unplug') {
      const strain = 1 - THREE.MathUtils.smoothstep(t, 2.7, 3.3), kneel = truthKneel(t);
      bone('head').rotation.x += .12 * strain;
      bone('pelvis').rotation.x += kneel;
      const away = THREE.MathUtils.smoothstep(t, 4, 5.5) * (1 - THREE.MathUtils.smoothstep(t, 7.2, 8.4));
      for (const side of ['L', 'R']) {
        bone(`shoulder_${side}`).rotation.x -= .75 * away; bone(`elbow_${side}`).rotation.x -= .25 * away;
        bone(`hip_${side}`).rotation.x = THREE.MathUtils.lerp(bone(`hip_${side}`).rotation.x, -1.15, kneel);
        bone(`knee_${side}`).rotation.x = THREE.MathUtils.lerp(bone(`knee_${side}`).rotation.x, 2.0, kneel);
        bone(`ankle_${side}`).rotation.x = THREE.MathUtils.lerp(bone(`ankle_${side}`).rotation.x, -.6, kneel);
      }
      bone('spine').rotation.x += .65 * kneel; bone('chest').rotation.x += .45 * kneel; bone('head').rotation.x -= .4 * kneel;
      if (kneel > 0) {
        this.rig.root.updateWorldMatrix(true, true);
        const knee = this.rig.root.worldToLocal(bone('knee_R').getWorldPosition(new THREE.Vector3()));
        bone('pelvis').position.y -= (knee.y - .15) * kneel;
        this.rig.root.updateWorldMatrix(true, true);
        this.placeShoes();
      }
    }
    if (gesture.role === 'dozer' && gesture.phase === 'unplug') {
      const steady = THREE.MathUtils.smoothstep(t, 0, .7) * (1 - THREE.MathUtils.smoothstep(t, 3.2, 4));
      bone('spine').rotation.x += .3 * steady; bone('chest').rotation.x += .15 * steady;
    }
    if (gesture.role === 'morpheus' && truthRest(gesture)) {
      const explain = gesture.phase === 'rest' ? THREE.MathUtils.smoothstep(t, 5.5, 7) * (1 - THREE.MathUtils.smoothstep(t, 13, 15)) : 0;
      bone('elbow_L').rotation.x -= explain * .55; bone('head').rotation.x += .1;
    }
    if (gesture.role === 'neo' && truthRest(gesture)) {
      for (const [index, side] of ['R', 'L'].entries()) {
        bone(`shoulder_${side}`).rotation.set(.02, 0, (index ? 1 : -1) * .12);
        bone(`elbow_${side}`).rotation.x = -.03;
      }
    }
  }

  private placeShoes(): void {
    if (!this.soles) {
      const shoes = this.rig.root.getObjectByName('shoes01') as THREE.SkinnedMesh;
      const { position, skinIndex, skinWeight } = shoes.geometry.attributes;
      this.soles = ['R', 'L'].map(side => {
        const bone = this.rig.bones.get(`ankle_${side}`)!, joint = shoes.skeleton.bones.indexOf(bone), points: THREE.Vector3[] = [];
        for (let index = 0; index < position.count; index++) {
          if (![0, 1, 2, 3].some(part => skinIndex.getComponent(index, part) === joint && skinWeight.getComponent(index, part) > .5)) continue;
          points.push(new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(shoes.bindMatrix).applyMatrix4(shoes.skeleton.boneInverses[joint]));
        }
        return { bone, points };
      });
    }
    const inverse = this.rig.root.matrixWorld.clone().invert(), point = new THREE.Vector3(); let lowest = 0;
    for (const sole of this.soles) {
      const matrix = new THREE.Matrix4().multiplyMatrices(inverse, sole.bone.matrixWorld);
      for (const vertex of sole.points) lowest = Math.min(lowest, point.copy(vertex).applyMatrix4(matrix).y);
    }
    this.rig.bones.get('pelvis')!.position.y -= lowest;
  }

  contact(gesture: TruthGesture | undefined): void {
    if (gesture?.role !== 'neo' || gesture.phase !== 'unplug') return;
    if (gesture.elapsed < 8) return;
    // The general standing pose grounds the ankle, not the shipped boot sole.
    const blend = truthKneel(gesture.elapsed);
    if (!blend) { this.placeShoes(); return; }
    const bones = this.rig.bones; this.rig.root.updateWorldMatrix(true, true);
    for (const side of ['R', 'L']) {
      const shoulder = bones.get(`shoulder_${side}`)!, elbow = bones.get(`elbow_${side}`)!, wrist = bones.get(`wrist_${side}`)!;
      const root = this.rig.root.getWorldQuaternion(new THREE.Quaternion()), sign = side === 'R' ? 1 : -1;
      const normal = new THREE.Vector3(0, -sign, 0), fingers = new THREE.Vector3(0, 0, -1);
      const orientation = root.clone().multiply(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(normal, fingers, normal.clone().cross(fingers))));
      // This is the actual palmar skin centroid in the shipped wrist's bind space.
      const palm = new THREE.Vector3(sign * .05575, -.19105, .00371);
      const ground = this.rig.root.localToWorld(new THREE.Vector3(-sign * .63, 0, 1.45));
      ground.y = FILM_SETS.film_neb_deck.center.y - 1 + .038;
      const goal = ground.sub(palm.applyQuaternion(orientation)), start = wrist.getWorldPosition(new THREE.Vector3()), rest = wrist.quaternion.clone();
      const origin = shoulder.getWorldPosition(new THREE.Vector3()), initialDirection = start.clone().sub(origin).normalize();
      const target = start.clone().lerp(goal, blend), direction = target.clone().sub(origin).normalize(), finalDirection = goal.clone().sub(origin).normalize();
      const initialPole = elbow.getWorldPosition(new THREE.Vector3()).sub(origin); initialPole.addScaledVector(initialDirection, -initialPole.dot(initialDirection)).normalize();
      const pole = new THREE.Vector3(-sign * .3, 0, -1).applyQuaternion(root); pole.addScaledVector(finalDirection, -pole.dot(finalDirection)).normalize();
      const transported = initialPole.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(initialDirection, finalDirection));
      const roll = Math.atan2(finalDirection.dot(new THREE.Vector3().crossVectors(transported, pole)), transported.dot(pole));
      const bend = initialPole.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(initialDirection, direction)).applyAxisAngle(direction, roll * blend);
      reach(shoulder, elbow, wrist.position, target, bend);
      wrist.quaternion.copy(rest.slerp(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation), blend));
      const axis = wrist.position.clone().normalize(), q = wrist.quaternion, projection = q.x * axis.x + q.y * axis.y + q.z * axis.z;
      const twist = new THREE.Quaternion(axis.x * projection, axis.y * projection, axis.z * projection, q.w).normalize();
      const swing = q.clone().multiply(twist.clone().invert()), angle = swing.angleTo(new THREE.Quaternion()), limit = Math.PI / 3;
      if (angle > limit) q.copy(new THREE.Quaternion().slerp(swing, limit / angle)).multiply(twist);
      this.openHand(side, blend);
      wrist.updateWorldMatrix(false, true);
    }
  }

  private openHand(side: string, amount: number): void {
    let targets = this.flatHands.get(side);
    if (!targets) {
      targets = [];
      const skin = this.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, a = skin.geometry.attributes;
      const tips = Array.from({ length: 5 }, () => new THREE.Vector3()), counts = [0, 0, 0, 0, 0], vertex = new THREE.Vector3();
      const distal = new Map(tips.map((_, i) => [skin.skeleton.bones.indexOf(this.rig.bones.get(`finger${i + 1}-3_${side}`)!), i]));
      for (let id = 0; id < a.position.count; id++) for (let k = 0; k < 4; k++) {
        const joint = a.skinIndex.getComponent(id, k), digit = distal.get(joint);
        if (digit === undefined || a.skinWeight.getComponent(id, k) <= .95) continue;
        tips[digit].add(vertex.fromBufferAttribute(a.position, id).applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[joint])); counts[digit]++; break;
      }
      const sign = side === 'R' ? 1 : -1;
      for (let digit = 2; digit <= 5; digit++) {
        const axes = [this.rig.rest.get(`finger${digit}-2_${side}`)!, this.rig.rest.get(`finger${digit}-3_${side}`)!, tips[digit - 1].divideScalar(counts[digit - 1])];
        const direction = new THREE.Vector3(-sign * .12, -1, (3 - digit) * .06).normalize(), parent = new THREE.Quaternion();
        for (const axis of axes) { const world = new THREE.Quaternion().setFromUnitVectors(axis.clone().normalize(), direction); targets.push(parent.clone().invert().multiply(world)); parent.copy(world); }
      }
      this.flatHands.set(side, targets);
    }
    for (let digit = 2; digit <= 5; digit++) for (let joint = 1; joint <= 3; joint++)
      this.rig.bones.get(`finger${digit}-${joint}_${side}`)!.quaternion.slerp(targets[(digit - 2) * 3 + joint - 1], amount);
    for (let joint = 1; joint <= 3; joint++) this.rig.bones.get(`finger1-${joint}_${side}`)!.quaternion.slerp(new THREE.Quaternion(), amount);
    this.rig.bones.get(`finger1-1_${side}`)!.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (side === 'R' ? -1 : 1) * 1.2 * amount));
  }

  dispose(): void {
    const materials = new Set<THREE.Material>();
    this.battery.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); materials.add(object.material); } });
    materials.forEach(material => material.dispose()); this.battery.removeFromParent();
  }
}
