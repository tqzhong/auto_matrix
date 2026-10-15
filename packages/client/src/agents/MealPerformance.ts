import * as THREE from 'three';
import { CREW_MEAL, FILM_SETS, crewMealPose, type InterludeGesture } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import { ConsoleGrip, placeCylinderHand } from './ConsoleGrip.js';
import { createMealBowl, createMealSpoon, MEAL_SPOON_TIP } from './MealProps.js';
import { disposeConsoleProp } from './ConsoleJug.js';

/** Saved serving, scooping and tasting on the actual anatomical hands. */
export class MealPerformance {
  private bowl: THREE.Group;
  private spoon = createMealSpoon('meal-held-spoon');
  private grips: Record<'R' | 'L', ConsoleGrip>;
  private lips?: number[];
  constructor(private rig: HeroRig, private role: 'neo' | 'tank') {
    this.bowl = createMealBowl(role === 'neo' ? 'meal-held-bowl' : 'meal-serving-bowl');
    rig.bones.get(role === 'neo' ? 'wrist_L' : 'wrist_R')!.add(this.bowl); rig.bones.get('wrist_R')!.add(this.spoon);
    this.bowl.visible = this.spoon.visible = false; this.grips = { R: new ConsoleGrip(rig), L: new ConsoleGrip(rig, 'L') };
  }

  mouth(gesture?: InterludeGesture): void {
    const amount = gesture?.kind === 'meal' && this.role === 'neo' ? crewMealPose(gesture).jawOpen : 0;
    for (const name of ['Anatomical_head_and_hands', 'neo-teeth-lower', 'neo-tongue']) {
      const mesh = this.rig.root.getObjectByName(name) as THREE.Mesh | undefined, index = mesh?.morphTargetDictionary?.jawOpen;
      if (index !== undefined && mesh?.morphTargetInfluences) mesh.morphTargetInfluences[index] = amount;
    }
  }

  private lip(): THREE.Vector3 {
    const skin = this.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    if (!this.lips) {
      this.lips = []; const a = skin.geometry.attributes;
      for (let v = 0; v < a.position.count; v++) {
        const p = new THREE.Vector3().fromBufferAttribute(a.position, v);
        if (Math.abs(p.x) < .018 && p.y > 3.93 && p.y < 3.96 && p.z > .28) this.lips.push(v);
      }
    }
    const point = new THREE.Vector3();
    for (const v of this.lips) point.add(skin.localToWorld(skin.getVertexPosition(v, new THREE.Vector3())));
    return point.divideScalar(this.lips.length);
  }

  private hold(prop: THREE.Group, side: 'R' | 'L', at: THREE.Vector3, rotation: THREE.Quaternion, amount: number, grip: number, bowl: boolean): void {
    if (!amount) return;
    const wrist = this.rig.bones.get(`wrist_${side}`)!, localGrip = new THREE.Vector3(0, bowl ? .15 : 0, 0);
    // Tank's broader serving palm and Neo's lower fingers need distinct rim clearances.
    const offset = new THREE.Vector3((side === 'R' ? 1 : -1) * (bowl ? side === 'R' ? .48 : .38 : .17), bowl && side === 'L' ? -.34 : -.24, 0);
    const rootRotation = this.rig.root.getWorldQuaternion(new THREE.Quaternion());
    const pole = new THREE.Vector3(side === 'R' ? -1.2 : 1.2, -.5, -.6).applyQuaternion(rootRotation);
    const approach = new THREE.Vector3(side === 'R' ? -.25 : .25, .18, -.3).applyQuaternion(rootRotation);
    const orientation = placeCylinderHand(this.rig, side, at.clone().add(localGrip.clone().applyQuaternion(rotation)), offset, amount, pole, rotation, approach, !bowl);
    prop.quaternion.copy(orientation.invert().multiply(rotation)); prop.position.copy(offset).sub(localGrip.applyQuaternion(prop.quaternion));
    wrist.updateWorldMatrix(false, true);
    this.grips[side].update(this.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, bowl ? 1 : grip,
      bowl ? 'bowl' : 'spoon', Math.min(1, amount * 2) * (bowl ? grip : 1), prop.matrixWorld);
    wrist.updateWorldMatrix(false, true);
  }

  update(gesture?: InterludeGesture): void {
    this.bowl.visible = this.spoon.visible = false;
    if (gesture?.kind !== 'meal' || gesture.role !== this.role) return;
    const pose = crewMealPose(gesture), root = this.rig.root, center = FILM_SETS.film_neb_deck.center;
    const at = (p: { x: number; y: number; z: number }) => new THREE.Vector3(center.x + p.x, center.y - 1 + p.y + .012, center.z + p.z);
    const upright = new THREE.Quaternion(), start = at(CREW_MEAL.bowl.start), end = at(CREW_MEAL.bowl.end);
    if (this.role === 'tank') {
      // Keep pushing with the bowl while opening the fingers, then withdraw the arm.
      const reach = 1 - THREE.MathUtils.smoothstep(pose.t, 1, 2);
      this.rig.bones.get('spine')!.rotation.x += .36 * reach; this.rig.bones.get('chest')!.rotation.x += .24 * reach;
      root.updateWorldMatrix(true, true); root.updateMatrixWorld(true);
      this.bowl.visible = pose.t < .35;
      this.hold(this.bowl, 'R', start.lerp(end, pose.slide), upright, reach, 1 - THREE.MathUtils.smoothstep(pose.t, .35, 1), true); return;
    }
    // The waiting hand rests back from the path of the sliding bowl.
    this.rig.bones.get('shoulder_L')!.rotation.x += .45 * (1 - pose.bowlReach);
    this.rig.bones.get('elbow_L')!.rotation.x += .25 * (1 - pose.bowlReach);
    this.rig.bones.get('spine')!.rotation.x += .12 * pose.bowlReach * (1 - pose.bowlCarry);
    this.rig.bones.get('chest')!.rotation.x += .12 * pose.bowlReach * (1 - pose.bowlCarry);
    root.updateWorldMatrix(true, true); root.updateMatrixWorld(true);
    this.bowl.visible = pose.bowlHeld; this.spoon.visible = pose.spoonHeld;
    const bowl = start.lerp(end, pose.slide).lerp(root.localToWorld(new THREE.Vector3(.3, 2.15, .65)), pose.bowlCarry);
    this.hold(this.bowl, 'L', bowl, upright, pose.bowlReach, pose.bowlHeld ? 1 : pose.bowlReach, true);
    const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, Math.PI));
    const head = this.rig.bones.get('head')!, toward = new THREE.Vector3(0, 0, -1).transformDirection(head.matrixWorld); toward.y = 0; toward.normalize();
    const up = new THREE.Vector3(0, 1, 0), feeding = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(toward, up), toward, up));
    const scooping = flat.clone().premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), .32));
    const rotation = flat.clone().slerp(scooping, pose.scoop).slerp(feeding, pose.mouth).slerp(flat, pose.returnSpoon);
    const food = bowl.clone().add(new THREE.Vector3(0, .227, -.17));
    const tip = at(CREW_MEAL.spoon).add(MEAL_SPOON_TIP.clone().applyQuaternion(flat)).lerp(food, pose.scoop)
      .lerp(this.lip().addScaledVector(toward, -.055), pose.mouth);
    const handle = tip.sub(MEAL_SPOON_TIP.clone().applyQuaternion(rotation)).lerp(at(CREW_MEAL.spoon), pose.returnSpoon);
    this.hold(this.spoon, 'R', handle, rotation, pose.spoonReach, pose.spoonHeld ? 1 : pose.spoonReach, false);
    const portion = this.spoon.getObjectByName('meal-spoon-food')!; portion.visible = pose.t >= 4.2 && pose.eaten < 1;
    portion.position.copy(MEAL_SPOON_TIP).z += .005;
    portion.position.addScaledVector(toward.clone().applyQuaternion(this.spoon.getWorldQuaternion(new THREE.Quaternion()).invert()), .12 * pose.eaten);
  }

  dispose(): void { disposeConsoleProp(this.bowl); disposeConsoleProp(this.spoon); }
}
