import * as THREE from 'three';
import { FILM_SETS, STEAK_DINING, steakPose, type InterludeGesture } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import { createSteakCutlery, createSteakWine, STEAK_FORK_TIP, STEAK_WINE_GRIP } from './SteakProps.js';
import { disposeConsoleProp } from './ConsoleJug.js';
import { ConsoleGrip, placeCylinderHand } from './ConsoleGrip.js';

/** The same saved clock drives bones, prop ownership and the consumed bite. */
export class SteakPerformance {
  private fork = createSteakCutlery('fork', 'cypher-held-fork');
  private knife = createSteakCutlery('knife', 'cypher-held-knife');
  private wine = createSteakWine('cypher-held-wine');
  private grips: Record<'R' | 'L', ConsoleGrip>;
  private lipSource?: THREE.SkinnedMesh;
  private lips: number[] = [];
  private upperLip: number[] = [];
  private lowerLip: number[] = [];

  constructor(private rig: HeroRig) {
    rig.bones.get('wrist_R')!.add(this.fork); rig.bones.get('wrist_L')!.add(this.knife, this.wine);
    this.grips = { R: new ConsoleGrip(rig, 'R'), L: new ConsoleGrip(rig, 'L') };
    this.fork.visible = this.knife.visible = this.wine.visible = false;
  }

  private lip(opening = false): THREE.Vector3 {
    const face = (this.rig.root.getObjectByName('cypher-anatomical-head') ?? this.rig.root.getObjectByName('Anatomical_head_and_hands')) as THREE.SkinnedMesh;
    if (this.lipSource !== face) {
      this.lipSource = face; this.lips = []; this.upperLip = []; this.lowerLip = [];
      const attrs = face.geometry.attributes, index = face.skeleton.bones.indexOf(this.rig.bones.get('head')!);
      for (let v = 0; v < attrs.position.count; v++) {
        if (![0, 1, 2, 3].some(j => attrs.skinIndex.getComponent(v, j) === index && attrs.skinWeight.getComponent(v, j) > .95)) continue;
        const p = attrs._head_rest ? new THREE.Vector3().fromBufferAttribute(attrs._head_rest, v)
          : new THREE.Vector3().fromBufferAttribute(attrs.position, v).applyMatrix4(face.bindMatrix).applyMatrix4(face.skeleton.boneInverses[index]);
        if (Math.abs(p.x) < .015 && p.y > (attrs._head_rest ? -.211 : -.175) && p.y < (attrs._head_rest ? -.193 : -.152) && p.z > .23) this.lips.push(v);
        if (attrs._jaw_weight && Math.abs(p.x) < .015 && p.z > .25) {
          if (p.y > -.207 && p.y < -.194 && attrs._jaw_weight.getX(v) < .01) this.upperLip.push(v);
          if (p.y > -.219 && p.y < -.211 && attrs._jaw_weight.getX(v) > .7) this.lowerLip.push(v);
        }
      }
    }
    const rims = opening && this.upperLip.length && this.lowerLip.length ? [this.upperLip, this.lowerLip] : [this.lips];
    const p = new THREE.Vector3();
    for (const rim of rims) for (const v of rim) p.addScaledVector(face.localToWorld(face.getVertexPosition(v, new THREE.Vector3())), 1 / rim.length / rims.length);
    return p;
  }

  private hold(prop: THREE.Group, side: 'R' | 'L', origin: THREE.Vector3, rotation: THREE.Quaternion, amount: number, grip: number, wine = false): void {
    if (!amount) return;
    const wrist = this.rig.bones.get(`wrist_${side}`)!;
    const localGrip = wine ? STEAK_WINE_GRIP : new THREE.Vector3(), contact = origin.clone().add(localGrip.clone().applyQuaternion(rotation));
    const approach = new THREE.Vector3(side === 'R' ? -.45 : .45, .35, wine ? -.8 : -.3)
      .applyQuaternion(this.rig.root.getWorldQuaternion(new THREE.Quaternion()));
    const offset = new THREE.Vector3((side === 'R' ? 1 : -1) * (wine ? .14 : .17), -.24, 0);
    const pole = new THREE.Vector3(side === 'R' ? -1.2 : 1.2, wine ? .3 : .4, -.6).applyQuaternion(this.rig.root.getWorldQuaternion(new THREE.Quaternion()));
    const orientation = placeCylinderHand(this.rig, side, contact, offset, amount, pole, rotation, approach, !wine);
    const local = orientation.clone().invert().multiply(rotation); prop.quaternion.copy(local); prop.position.copy(offset).sub(localGrip.clone().applyQuaternion(local));
    wrist.updateWorldMatrix(false, true);
    const frame = prop.matrixWorld;
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
    const cuttingFork = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), STEAK_DINING.gripTilt)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI));
    const displayFork = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), .15);
    const feedingFork = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -.3)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI * 5 / 3))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2))
      .premultiply(b.get('head')!.getWorldQuaternion(new THREE.Quaternion()));
    // After the bite, set the fork down from its display grip. Reversing the
    // cutting rotation as well can switch the feeding slerp to its other arc.
    const rotation = cuttingFork.slerp(displayFork, THREE.MathUtils.smoothstep(pose.t, 3.5, 5.2))
      .slerp(feedingFork, pose.mouth).slerp(flat, pose.forkReturn);
    const forward = new THREE.Vector3(0, 0, 1).transformDirection(b.get('head')!.matrixWorld);
    const mouth = this.lip(true).addScaledVector(forward, .055);
    const bite = at(STEAK_DINING.bite).lerp(root.localToWorld(new THREE.Vector3(-.33, 3.03, .72)), pose.lift).lerp(mouth, pose.mouth);
    // Turn the fork in front of the shoulder, rather than collapsing the
    // forearm and palm inside their reachable inner radius mid-lift.
    bite.add(new THREE.Vector3(0, 0, .5 * Math.sin(Math.PI * pose.lift) * (1 - pose.mouth))
      .applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion())));
    const fork = bite.sub(STEAK_FORK_TIP.clone().applyQuaternion(rotation)).lerp(at(STEAK_DINING.fork), pose.forkReturn);
    this.hold(this.fork, 'R', fork, rotation, pose.forkReach, 1 - THREE.MathUtils.smoothstep(pose.t, 11.2, 11.45));
    const food = this.fork.getObjectByName('cypher-held-bite')!; food.visible = pose.t >= 3.5 && pose.eaten < 1;
    food.scale.setScalar(1); food.position.copy(STEAK_FORK_TIP);
    // The same full-sized piece slides off the tines through the open lips.
    if (pose.eaten) food.position.add(forward.clone().applyQuaternion(this.fork.getWorldQuaternion(new THREE.Quaternion()).invert()).multiplyScalar(-.11 * pose.eaten));
    const cuttingRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -STEAK_DINING.gripTilt)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI));
    const knifeRotation = cuttingRotation.clone().slerp(flat, pose.knifeReturn);
    const knife = at({ x: STEAK_DINING.steak.cutX, y: STEAK_DINING.bite.y, z: STEAK_DINING.plate.z + pose.cut })
      .sub(new THREE.Vector3(-.024, .63, 0).applyQuaternion(cuttingRotation)).lerp(at(STEAK_DINING.knife), pose.knifeReturn);
    this.hold(this.knife, 'L', knife, knifeRotation, pose.knifeReach, 1 - THREE.MathUtils.smoothstep(pose.t, 4.8, 5.05));
    const wineRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -.55 * pose.wineSip);
    const wine = at(STEAK_DINING.wine).lerp(root.localToWorld(new THREE.Vector3(.55, 2.52, .65)), pose.wineCarry);
    const rim = new THREE.Vector3(0, .65, -.18).applyQuaternion(wineRotation);
    wine.lerp(this.lip().sub(rim), pose.wineSip);
    this.hold(this.wine, 'L', wine, wineRotation, pose.wineReach, pose.wineGrip, true);
    const liquid = this.wine.getObjectByName('steak-wine-liquid')!; liquid.position.y = .41 - pose.drunk * .045; liquid.rotation.x = .55 * pose.wineSip;
  }

  dispose(): void { for (const prop of [this.fork, this.knife, this.wine]) disposeConsoleProp(prop); }
}
