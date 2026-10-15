import * as THREE from 'three';
import { FILM_SETS, STEAK_DINING, steakPose, type InterludeGesture } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import { createSteakCutlery, createSteakWine, STEAK_FORK_TIP, STEAK_WINE_GRIP } from './SteakProps.js';
import { disposeConsoleProp } from './ConsoleJug.js';
import { ConsoleGrip } from './ConsoleGrip.js';
import { reach } from './SpoonPerformance.js';

/** The same saved clock drives bones, prop ownership and the consumed bite. */
export class SteakPerformance {
  private fork = createSteakCutlery('fork', 'cypher-held-fork');
  private knife = createSteakCutlery('knife', 'cypher-held-knife');
  private wine = createSteakWine('cypher-held-wine');
  private grips: Record<'R' | 'L', ConsoleGrip>;
  private lipSource?: THREE.SkinnedMesh;
  private lips: number[] = [];

  constructor(private rig: HeroRig) {
    rig.bones.get('wrist_R')!.add(this.fork); rig.bones.get('wrist_L')!.add(this.knife, this.wine);
    this.grips = { R: new ConsoleGrip(rig, 'R'), L: new ConsoleGrip(rig, 'L') };
    this.fork.visible = this.knife.visible = this.wine.visible = false;
  }

  private lip(): THREE.Vector3 {
    const face = (this.rig.root.getObjectByName('cypher-anatomical-head') ?? this.rig.root.getObjectByName('Anatomical_head_and_hands')) as THREE.SkinnedMesh;
    if (this.lipSource !== face) {
      this.lipSource = face; this.lips = []; const attrs = face.geometry.attributes, index = face.skeleton.bones.indexOf(this.rig.bones.get('head')!);
      for (let v = 0; v < attrs.position.count; v++) {
        if (![0, 1, 2, 3].some(j => attrs.skinIndex.getComponent(v, j) === index && attrs.skinWeight.getComponent(v, j) > .95)) continue;
        const p = attrs._head_rest ? new THREE.Vector3().fromBufferAttribute(attrs._head_rest, v)
          : new THREE.Vector3().fromBufferAttribute(attrs.position, v).applyMatrix4(face.bindMatrix).applyMatrix4(face.skeleton.boneInverses[index]);
        if (Math.abs(p.x) < .015 && p.y > (attrs._head_rest ? -.211 : -.175) && p.y < (attrs._head_rest ? -.193 : -.152) && p.z > .23) this.lips.push(v);
      }
    }
    const p = new THREE.Vector3(); for (const v of this.lips) p.add(face.localToWorld(face.getVertexPosition(v, new THREE.Vector3())));
    return p.divideScalar(this.lips.length);
  }

  private hold(prop: THREE.Group, side: 'R' | 'L', origin: THREE.Vector3, rotation: THREE.Quaternion, amount: number, grip: number, wine = false): void {
    if (!amount) return;
    const b = this.rig.bones, wrist = b.get(`wrist_${side}`)!, elbow = b.get(`elbow_${side}`)!, shoulder = b.get(`shoulder_${side}`)!;
    const localGrip = wine ? STEAK_WINE_GRIP : new THREE.Vector3(), contact = origin.clone().add(localGrip.clone().applyQuaternion(rotation));
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation), start = wrist.getWorldPosition(new THREE.Vector3());
    const base = wrist.getWorldQuaternion(new THREE.Quaternion()), orientation = base.clone(), offset = new THREE.Vector3(side === 'R' ? .14 : -.14, -.24, 0);
    let aim = contact.clone().sub(shoulder.getWorldPosition(new THREE.Vector3()));
    const pole = new THREE.Vector3(side === 'R' ? -.65 : .65, -.6, -.6).applyQuaternion(this.rig.root.getWorldQuaternion(new THREE.Quaternion()));
    const arc = Math.sin(Math.PI * amount);
    const clearance = prop.visible ? new THREE.Vector3() : new THREE.Vector3(side === 'R' ? -.45 : .45, .35, wine ? -.8 : -.12)
      .applyQuaternion(this.rig.root.getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(wine ? Math.sqrt(arc) : arc * amount);
    for (let iteration = 0; iteration < 12; iteration++) {
      aim.addScaledVector(up, -aim.dot(up)).normalize();
      const right = new THREE.Vector3().crossVectors(up, aim).normalize();
      const desired = base.clone().slerp(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, aim.clone().negate(), up)), amount);
      if (!iteration) orientation.copy(desired); else orientation.slerp(desired, .5);
      const target = contact.clone().sub(offset.clone().applyQuaternion(orientation));
      reach(shoulder, elbow, wrist.position, start.clone().lerp(target, amount).add(clearance), pole.clone());
      aim = wrist.getWorldPosition(new THREE.Vector3()).sub(elbow.getWorldPosition(new THREE.Vector3()));
    }
    // The utensil may swivel in the palm as it rises; forcing its axis to the
    // wrist axis folds the hand when the fork passes through a diagonal pose.
    for (let iteration = 0; iteration < 8; iteration++) {
      const forearm = wrist.getWorldPosition(new THREE.Vector3()).sub(elbow.getWorldPosition(new THREE.Vector3())).normalize();
      const palm = new THREE.Vector3(0, -1, 0).applyQuaternion(orientation), bend = palm.angleTo(forearm);
      if (bend <= .8) break;
      orientation.slerp(new THREE.Quaternion().setFromUnitVectors(palm, forearm).multiply(orientation), (bend - .8) / bend);
      reach(shoulder, elbow, wrist.position, start.clone().lerp(contact.clone().sub(offset.clone().applyQuaternion(orientation)), amount).add(clearance), pole.clone());
    }
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    const local = orientation.clone().invert().multiply(rotation); prop.quaternion.copy(local); prop.position.copy(offset).sub(localGrip.clone().applyQuaternion(local));
    wrist.updateWorldMatrix(false, true);
    const frame = prop.visible ? prop.matrixWorld : new THREE.Matrix4().compose(origin, rotation, new THREE.Vector3(1, 1, 1));
    this.grips[side].update(this.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, grip, wine ? 'wine' : 'cutlery', wine ? Math.min(1, amount * 2) : amount, frame);
    wrist.updateWorldMatrix(false, true);
  }

  update(gesture?: InterludeGesture): void {
    this.fork.visible = this.knife.visible = this.wine.visible = false;
    if (gesture?.kind !== 'steak' || gesture.role !== 'cypher') return;
    const pose = steakPose(gesture), b = this.rig.bones, root = this.rig.root;
    b.get('spine')!.rotation.x += .08; b.get('head')!.rotation.x += .04 * pose.lift;
    root.updateWorldMatrix(true, true); root.updateMatrixWorld(true);
    const center = FILM_SETS.film_cypher_restaurant.center, at = (p: { x: number; y: number; z: number }) => new THREE.Vector3(center.x + p.x, center.y - 1 + p.y, center.z + p.z);
    const flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    this.fork.visible = pose.forkHeld; this.knife.visible = pose.knifeHeld; this.wine.visible = pose.wineHeld;
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), STEAK_DINING.gripTilt * (1 - pose.lift))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI + Math.PI / 2 * pose.lift)).slerp(flat, pose.forkReturn);
    const mouth = this.lip().addScaledVector(new THREE.Vector3(0, 0, 1).transformDirection(b.get('head')!.matrixWorld), .075);
    const bite = at(STEAK_DINING.bite).lerp(root.localToWorld(new THREE.Vector3(-.33, 3.03, .72)), pose.lift).lerp(mouth, pose.mouth);
    const fork = bite.sub(STEAK_FORK_TIP.clone().applyQuaternion(rotation)).lerp(at(STEAK_DINING.fork), pose.forkReturn);
    this.hold(this.fork, 'R', fork, rotation, pose.forkReach, pose.forkHeld ? 1 : pose.forkReach);
    const food = this.fork.getObjectByName('cypher-held-bite')!; food.visible = pose.t >= 3.5 && pose.eaten < 1; food.scale.setScalar(1 - pose.eaten);
    const cuttingRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -STEAK_DINING.gripTilt)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI));
    const knifeRotation = cuttingRotation.clone().slerp(flat, pose.knifeReturn);
    const knife = at({ x: STEAK_DINING.steak.cutX, y: STEAK_DINING.bite.y, z: STEAK_DINING.plate.z + pose.cut })
      .sub(new THREE.Vector3(-.024, .63, 0).applyQuaternion(cuttingRotation)).lerp(at(STEAK_DINING.knife), pose.knifeReturn);
    this.hold(this.knife, 'L', knife, knifeRotation, pose.knifeReach, pose.knifeHeld ? 1 : pose.knifeReach);
    const wineRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -.55 * pose.wineSip);
    const wine = at(STEAK_DINING.wine).lerp(root.localToWorld(new THREE.Vector3(.55, 2.52, .65)), pose.wineCarry);
    const rim = new THREE.Vector3(0, .65, -.18).applyQuaternion(wineRotation);
    wine.lerp(this.lip().sub(rim), pose.wineSip);
    this.hold(this.wine, 'L', wine, wineRotation, pose.wineReach, pose.wineGrip, true);
    const liquid = this.wine.getObjectByName('steak-wine-liquid')!; liquid.position.y = .41 - pose.drunk * .045; liquid.rotation.x = .55 * pose.wineSip;
  }

  dispose(): void { for (const prop of [this.fork, this.knife, this.wine]) disposeConsoleProp(prop); }
}
