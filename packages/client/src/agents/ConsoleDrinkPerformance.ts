import * as THREE from 'three';
import { CONSOLE_DRINK, FILM_SETS, consoleDrinkPose, cypherDrinkPose, cypherCupRest, type InterludeGesture } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import { createConsoleMug } from './ConsoleMug.js';
import { reach } from './SpoonPerformance.js';
import { ConsoleGrip, placeCylinderHand } from './ConsoleGrip.js';

/** Actual fingertip skin, a single cup owner and a rim on the anatomical lip. */
export class ConsoleDrinkPerformance {
  private cup: THREE.Group;
  private grip: ConsoleGrip;
  private lips?: number[];
  private lipSource?: THREE.SkinnedMesh;
  constructor(private rig: HeroRig, private role: 'neo' | 'cypher' = 'neo') {
    this.cup = createConsoleMug(role === 'neo' ? 'console-held-mug' : 'cypher-held-mug'); this.grip = new ConsoleGrip(rig);
    rig.bones.get('wrist_R')!.add(this.cup); this.cup.visible = false;
    this.cup.position.set(.31, -.24, .015); this.cup.rotation.x = Math.PI / 2;
  }

  update(gesture?: InterludeGesture): void {
    this.cup.visible = false;
    if (!gesture || gesture.kind !== 'console' || gesture.role !== this.role) return;
    const pose = this.role === 'neo' ? consoleDrinkPose(gesture) : cypherDrinkPose(gesture); this.cup.visible = pose.holding;
    if (!pose.reach) return;
    const bone = (name: string) => this.rig.bones.get(name)!;
    const root = this.rig.root, wrist = bone('wrist_R'), shoulder = bone('shoulder_R'), elbow = bone('elbow_R');
    const lean = pose.reach * (1 - pose.carry) * (this.role === 'neo' ? .8 : .35);
    bone('spine').rotation.x += lean * .45; bone('chest').rotation.x += lean * .55;
    bone('head').rotation.x -= lean * .55;
    root.updateWorldMatrix(true, true);
    // SkinnedMesh refreshes its bind inverse in updateMatrixWorld, including a cold world-space load.
    root.updateMatrixWorld(true);
    const rotation = root.getWorldQuaternion(new THREE.Quaternion());
    const at = this.role === 'neo' ? CONSOLE_DRINK.cup : cypherCupRest(gesture);
    const tilt = -.65 * pose.tilt, cupRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), at.yaw).slerp(rotation, pose.carry)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt));
    const orientation = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(cupRotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)), pose.reach);
    const center = FILM_SETS.film_neb_deck.center;
    const target = new THREE.Vector3(center.x + at.x, center.y - 1 + at.y, center.z + at.z);
    const held = bone('chest').localToWorld(new THREE.Vector3(-.6, -.52, .65));
    target.lerp(held, pose.carry);
    const skin = root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    const face = (this.role === 'cypher' ? root.getObjectByName('cypher-anatomical-head') as THREE.SkinnedMesh : undefined) ?? skin;
    if (!this.lips || this.lipSource !== face) {
      this.lipSource = face; this.lips = []; const index = face.skeleton.bones.indexOf(bone('head')), attrs = face.geometry.attributes;
      for (let v = 0; v < attrs.position.count; v++) {
        if (![0, 1, 2, 3].some(j => attrs.skinIndex.getComponent(v, j) === index && attrs.skinWeight.getComponent(v, j) > .95)) continue;
        const point = attrs._head_rest ? new THREE.Vector3().fromBufferAttribute(attrs._head_rest, v)
          : new THREE.Vector3().fromBufferAttribute(attrs.position, v).applyMatrix4(face.bindMatrix).applyMatrix4(face.skeleton.boneInverses[index]);
        if (Math.abs(point.x) < .015 && point.y > (attrs._head_rest ? -.211 : -.175) && point.y < (attrs._head_rest ? -.193 : -.152) && point.z > .23) this.lips.push(v);
      }
    }
    const lip = new THREE.Vector3();
    for (const vertex of this.lips) lip.add(face.localToWorld(face.getVertexPosition(vertex, new THREE.Vector3())));
    lip.divideScalar(this.lips.length);
    const rim = new THREE.Vector3(0, CONSOLE_DRINK.height / 2, -CONSOLE_DRINK.radius).applyQuaternion(cupRotation);
    target.lerp(lip.sub(rim), pose.lift);
    const pole = new THREE.Vector3(-.6, -1, -1).applyQuaternion(rotation);
    if (this.role === 'cypher') {
      const approach = new THREE.Vector3(0, .12, 0);
      orientation.copy(placeCylinderHand(this.rig, 'R', target, this.cup.position, pose.reach, pole, cupRotation, approach));
    } else {
      const offset = this.cup.position.clone().multiply(wrist.getWorldScale(new THREE.Vector3())).applyQuaternion(orientation);
      const start = wrist.getWorldPosition(new THREE.Vector3()), goal = start.clone().lerp(target.clone().sub(offset), pose.reach);
      if (!pose.holding) {
        const clearance = Math.sin(Math.PI * pose.reach);
        goal.y += clearance * .25;
        goal.addScaledVector(new THREE.Vector3(-1, 0, 0).applyQuaternion(rotation), clearance * .25);
      }
      reach(shoulder, elbow, wrist.position, goal, pole);
      wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    }
    if (this.role === 'cypher') this.cup.quaternion.copy(orientation.clone().invert().multiply(cupRotation));
    wrist.updateWorldMatrix(false, true);
    const frame = this.role === 'cypher' ? this.cup.matrixWorld : undefined;
    const grip = pose.grip * (this.role === 'cypher' && gesture.phase === 'responding' ? 1 - THREE.MathUtils.smoothstep(gesture.elapsed, 7 + CONSOLE_DRINK.release, 7 + CONSOLE_DRINK.release + .25) : 1);
    this.grip.update(skin, grip, 'mug', this.role === 'cypher' ? Math.min(1, pose.reach * 2) : pose.grip, frame); wrist.updateWorldMatrix(false, true);
    const liquid = this.cup.getObjectByName('console-mug-liquid')!; liquid.position.y = -.035 - pose.drunk * .10;
    liquid.rotation.x = -tilt;
  }

  dispose(): void {
    const materials = new Set<THREE.Material>();
    this.cup.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); materials.add(object.material as THREE.Material); } });
    materials.forEach(material => material.dispose()); this.cup.removeFromParent();
  }
}
