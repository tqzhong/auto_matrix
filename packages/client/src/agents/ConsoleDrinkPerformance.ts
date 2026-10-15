import * as THREE from 'three';
import { CONSOLE_DRINK, FILM_SETS, consoleDrinkPose, type InterludeGesture } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import { createConsoleMug } from './ConsoleMug.js';
import { reach } from './SpoonPerformance.js';

/** Actual fingertip skin, a single cup owner and a rim on the anatomical lip. */
export class ConsoleDrinkPerformance {
  private cup = createConsoleMug('console-held-mug');
  private pads?: THREE.Vector3[];
  private lips?: number[];
  constructor(private rig: HeroRig) {
    rig.bones.get('wrist_R')!.add(this.cup); this.cup.visible = false;
    this.cup.position.set(.31, -.24, .015); this.cup.rotation.x = Math.PI / 2;
  }

  update(gesture?: InterludeGesture): void {
    this.cup.visible = false;
    if (!gesture || gesture.kind !== 'console' || gesture.role !== 'neo') return;
    const pose = consoleDrinkPose(gesture); this.cup.visible = pose.holding;
    if (!pose.reach) return;
    const bone = (name: string) => this.rig.bones.get(name)!;
    const root = this.rig.root, wrist = bone('wrist_R'), shoulder = bone('shoulder_R'), elbow = bone('elbow_R');
    const lean = pose.reach * (1 - pose.carry) * .35;
    bone('spine').rotation.x += lean * .45; bone('chest').rotation.x += lean * .55;
    bone('head').rotation.x -= lean * .55;
    root.updateWorldMatrix(true, true);
    // SkinnedMesh refreshes its bind inverse in updateMatrixWorld, including a cold world-space load.
    root.updateMatrixWorld(true);
    const rotation = root.getWorldQuaternion(new THREE.Quaternion());
    const tilt = -.65 * pose.tilt, cupRotation = rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt));
    const orientation = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(cupRotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)), pose.reach);
    const center = FILM_SETS.film_neb_deck.center, at = CONSOLE_DRINK.cup;
    const target = new THREE.Vector3(center.x + at.x, center.y - 1 + at.y, center.z + at.z);
    const held = bone('chest').localToWorld(new THREE.Vector3(-.6, -.52, .65));
    target.lerp(held, pose.carry);
    const skin = root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    if (!this.lips) {
      this.lips = []; const index = skin.skeleton.bones.indexOf(bone('head')), attrs = skin.geometry.attributes;
      for (let v = 0; v < attrs.position.count; v++) {
        if (![0, 1, 2, 3].some(j => attrs.skinIndex.getComponent(v, j) === index && attrs.skinWeight.getComponent(v, j) > .95)) continue;
        const point = new THREE.Vector3().fromBufferAttribute(attrs.position, v).applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[index]);
        if (Math.abs(point.x) < .015 && point.y > -.175 && point.y < -.152 && point.z > .23) this.lips.push(v);
      }
    }
    const lip = new THREE.Vector3();
    for (const vertex of this.lips) lip.add(skin.localToWorld(skin.getVertexPosition(vertex, new THREE.Vector3())));
    lip.divideScalar(this.lips.length);
    const rim = new THREE.Vector3(0, CONSOLE_DRINK.height / 2, -CONSOLE_DRINK.radius).applyQuaternion(cupRotation);
    target.lerp(lip.sub(rim), pose.lift);
    const offset = this.cup.position.clone().multiply(wrist.getWorldScale(new THREE.Vector3())).applyQuaternion(orientation);
    const start = wrist.getWorldPosition(new THREE.Vector3()), goal = start.clone().lerp(target.clone().sub(offset), pose.reach);
    if (!pose.holding) {
      const clearance = Math.sin(Math.PI * pose.reach);
      goal.y += clearance * .25;
      goal.addScaledVector(new THREE.Vector3(-1, 0, 0).applyQuaternion(rotation), clearance * .25);
    }
    reach(shoulder, elbow, wrist.position, goal, new THREE.Vector3(-.6, -1, -1).applyQuaternion(rotation));
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    this.grip(skin, pose.grip); wrist.updateWorldMatrix(false, true);
    const liquid = this.cup.getObjectByName('console-mug-liquid')!; liquid.position.y = -.035 - pose.drunk * .10;
    liquid.rotation.x = -tilt;
  }

  private grip(skin: THREE.SkinnedMesh, amount: number): void {
    if (!this.pads) {
      this.pads = Array.from({ length: 5 }, () => new THREE.Vector3()); const counts = [0, 0, 0, 0, 0];
      const { position, skinIndex, skinWeight } = skin.geometry.attributes;
      const digits = skin.skeleton.bones.map(bone => /^finger([1-5])-3_R$/.exec(bone.name));
      for (let v = 0; v < position.count; v++) for (let part = 0; part < 4; part++) {
        const index = skinIndex.getComponent(v, part), digit = digits[index];
        if (!digit || skinWeight.getComponent(v, part) < .95) continue;
        this.pads[Number(digit[1]) - 1].add(new THREE.Vector3().fromBufferAttribute(position, v).applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[index]));
        counts[Number(digit[1]) - 1]++;
      }
      this.pads.forEach((pad, i) => pad.divideScalar(counts[i]));
    }
    for (let digit = 1; digit <= 5; digit++) {
      const base = this.rig.rest.get(`finger${digit}-1_R`)!, first = this.rig.rest.get(`finger${digit}-2_R`)!, second = this.rig.rest.get(`finger${digit}-3_R`)!;
      const angles = [120 * Math.PI / 180, -130 * Math.PI / 180, -130 * Math.PI / 180, -140 * Math.PI / 180, -165 * Math.PI / 180];
      const radius = digit === 1 ? .205 : .194, angle = angles[digit - 1];
      const target = new THREE.Vector3(.31 + Math.cos(angle) * radius, -.24 + Math.sin(angle) * radius, digit === 1 ? .145 : base.z);
      const direction = new THREE.Vector3(digit === 5 ? .866 : .9, digit === 5 ? -.5 : -.436, 0).normalize();
      const pad = this.pads[digit - 1], end = target.addScaledVector(direction, -pad.length());
      const axis = end.clone().sub(base), a = first.length(), b = second.length();
      const length = THREE.MathUtils.clamp(axis.length(), Math.abs(a - b) + .001, a + b - .001); axis.normalize(); end.copy(base).addScaledVector(axis, length);
      const along = (a * a - b * b + length * length) / (2 * length), bend = new THREE.Vector3(1, digit === 1 ? 1 : -1, 0);
      bend.addScaledVector(axis, -bend.dot(axis)).normalize();
      const hinge = base.clone().addScaledVector(axis, along).addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along))), parent = new THREE.Quaternion();
      [hinge.clone().sub(base), end.clone().sub(hinge), direction].forEach((desired, part) => {
        const world = new THREE.Quaternion().setFromUnitVectors([first, second, pad][part].clone().normalize(), desired.normalize());
        this.rig.bones.get(`finger${digit}-${part + 1}_R`)!.quaternion.slerp(parent.clone().invert().multiply(world), amount); parent.copy(world);
      });
    }
  }

  dispose(): void {
    const materials = new Set<THREE.Material>();
    this.cup.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); materials.add(object.material as THREE.Material); } });
    materials.forEach(material => material.dispose()); this.cup.removeFromParent();
  }
}
