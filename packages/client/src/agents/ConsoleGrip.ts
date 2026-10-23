import * as THREE from 'three';
import type { HeroRig } from './HeroModel.js';
import { CONSOLE_DRINK, CONSOLE_SERVICE, CORE_CONNECTOR } from '@auto_matrix/shared';
import { reach } from './SpoonPerformance.js';

function gripFrame(direction: THREE.Vector3, normal: THREE.Vector3): THREE.Quaternion {
  const y = direction.clone().normalize(), z = normal.clone().addScaledVector(y, -normal.dot(y)).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(y, z), y, z));
}

/** Solve the forearm and palm together, staging outside before closing in.
 * Return the final grip frame while the applied wrist can still be approaching. */
export function placeCylinderHand(rig: HeroRig, side: 'R' | 'L', contact: THREE.Vector3, offset: THREE.Vector3,
  amount: number, pole: THREE.Vector3, prop: THREE.Quaternion, approach: THREE.Vector3, cutlery = false): THREE.Quaternion {
  const wrist = rig.bones.get(`wrist_${side}`)!, elbow = rig.bones.get(`elbow_${side}`)!, shoulder = rig.bones.get(`shoulder_${side}`)!;
  const upperRest = shoulder.quaternion.clone(), lowerRest = elbow.quaternion.clone(), handRest = wrist.getWorldQuaternion(new THREE.Quaternion());
  const scale = shoulder.getWorldScale(new THREE.Vector3()).x, forearm = wrist.position.length() * scale;
  const virtual = offset.clone().multiply(wrist.getWorldScale(new THREE.Vector3())); virtual.y -= forearm;
  const up = new THREE.Vector3(0, cutlery ? -1 : 1, 0).applyQuaternion(prop);
  reach(shoulder, elbow, wrist.position.clone().setLength(virtual.length() / scale), contact, pole.clone());
  const hinge = elbow.getWorldPosition(new THREE.Vector3()), toward = contact.clone().sub(hinge).normalize();
  const orientation = gripFrame(toward, up).multiply(gripFrame(virtual, new THREE.Vector3(0, 0, 1)).invert());
  const goal = hinge.addScaledVector(new THREE.Vector3(0, -1, 0).applyQuaternion(orientation), forearm);
  elbow.quaternion.setFromUnitVectors(wrist.position.clone().normalize(), elbow.parent!.worldToLocal(goal.clone()).sub(elbow.position).normalize());
  const upper = shoulder.quaternion.clone(), lower = elbow.quaternion.clone();
  // Solve the outside staging pose independently. Moving the grip target itself
  // with reach can flip its palm frame and drive the wrist through the prop.
  const away = offset.clone().applyQuaternion(orientation).negate(); away.addScaledVector(up, -away.dot(up)).normalize();
  reach(shoulder, elbow, wrist.position, goal.addScaledVector(away, .45).add(approach), pole.clone());
  const enter = THREE.MathUtils.smoothstep(amount, 0, .65), close = THREE.MathUtils.clamp((amount - .65) / .35, 0, 1) ** 2;
  const stageUpper = shoulder.quaternion.clone(), stageLower = elbow.quaternion.clone();
  shoulder.quaternion.copy(upperRest).slerp(stageUpper, enter).slerp(upper, close);
  elbow.quaternion.copy(lowerRest).slerp(stageLower, enter).slerp(lower, close);
  shoulder.updateWorldMatrix(true, true);
  const grip = orientation.clone(); orientation.slerpQuaternions(handRest, grip, enter);
  wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation)); wrist.updateWorldMatrix(false, true);
  return grip;
}

/** Anatomical finger pads wrap the mug, jug bar and slender dining handles. */
export class ConsoleGrip {
  private pads?: THREE.Vector3[];
  private frames: THREE.Quaternion[][] = [];
  constructor(private rig: HeroRig, private side: 'R' | 'L' = 'R') {}

  update(skin: THREE.SkinnedMesh, amount: number, prop: 'mug' | 'jug' | 'cutlery' | 'spoon' | 'wine' | 'bowl' | 'handset' | 'connector' = 'mug', blend = amount, frame?: THREE.Matrix4): void {
    if (!amount) return;
    if (!this.pads) {
      this.pads = Array.from({ length: 5 }, () => new THREE.Vector3()); const counts = [0, 0, 0, 0, 0];
      const { position, skinIndex, skinWeight } = skin.geometry.attributes;
      const digits = skin.skeleton.bones.map(bone => new RegExp(`^finger([1-5])-3_${this.side}$`).exec(bone.name));
      for (let v = 0; v < position.count; v++) for (let part = 0; part < 4; part++) {
        const index = skinIndex.getComponent(v, part), digit = digits[index];
        if (!digit || skinWeight.getComponent(v, part) < .95) continue;
        this.pads[Number(digit[1]) - 1].add(new THREE.Vector3().fromBufferAttribute(position, v).applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[index]));
        counts[Number(digit[1]) - 1]++;
      }
      this.pads.forEach((pad, i) => pad.divideScalar(counts[i]));
      this.frames = this.pads.map((pad, i) => [this.rig.rest.get(`finger${i + 1}-2_${this.side}`)!,
        this.rig.rest.get(`finger${i + 1}-3_${this.side}`)!, pad].map(axis => gripFrame(axis, new THREE.Vector3(0, 0, 1)).invert()));
    }
    // Neo's mug is fixed in wrist space; other props supply their actual frame.
    const contact = frame ? this.rig.bones.get(`wrist_${this.side}`)!.matrixWorld.clone().invert().multiply(frame)
      : new THREE.Matrix4().makeTranslation(.31, -.24, .015).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    for (let digit = 1; digit <= 5; digit++) {
      const base = this.rig.rest.get(`finger${digit}-1_${this.side}`)!, first = this.rig.rest.get(`finger${digit}-2_${this.side}`)!, second = this.rig.rest.get(`finger${digit}-3_${this.side}`)!;
      const sign = this.side === 'R' ? 1 : -1;
      const axis = new THREE.Vector3(0, prop === 'cutlery' || prop === 'spoon' ? -1 : 1, 0).transformDirection(contact), narrow = prop === 'cutlery' || prop === 'spoon' || prop === 'wine';
      const center = (prop === 'jug' ? new THREE.Vector3(CONSOLE_SERVICE.handle.x, CONSOLE_SERVICE.handle.y, 0) : prop === 'wine' ? new THREE.Vector3(0, .19, 0) : prop === 'bowl' ? new THREE.Vector3(0, .15, 0) : new THREE.Vector3()).applyMatrix4(contact);
      const section = prop === 'connector' ? Math.abs(axis.z) : 1;
      const along = prop === 'connector' ? 0 : THREE.MathUtils.clamp(base.clone().sub(center).dot(axis), prop === 'bowl' ? -.10 : narrow ? -.14 : prop === 'jug' ? -.18 : -CONSOLE_DRINK.height / 2 + .04, prop === 'bowl' ? .13 : prop === 'wine' ? .08 : narrow ? .14 : prop === 'jug' ? .22 : CONSOLE_DRINK.height / 2 - .04);
      if (prop === 'connector') {
        // A diagonal shaft cuts an ellipse through each finger's own bend
        // plane. Its outer circle preserves finger spacing and clears the
        // barrel; bending in the shaft-normal plane crowds adjacent fingers.
        center.y += (base.z - center.z) * axis.y / axis.z; center.z = base.z; axis.set(0, 0, 1);
      } else center.addScaledVector(axis, along);
      const radius = prop === 'connector' ? CORE_CONNECTOR.grip.radius / section : prop === 'handset' ? .07 : prop === 'bowl' ? THREE.MathUtils.lerp(.235, .32, (along + .10) / .23) : prop === 'spoon' ? .013 : prop === 'cutlery' ? .027 : prop === 'wine' ? .014 : prop === 'jug' ? .035 : CONSOLE_DRINK.radius;
      const clearance = (prop === 'wine' ? .14 : prop === 'jug' ? .1 : .08) * (1 - amount);
      const pad = this.pads[digit - 1], directions = this.curl(base, first.length(), second.length(), pad.length(), center, axis,
        radius, radius + .034 + clearance, sign * (digit === 1 ? -1 : 1), digit === 1);
      const normal = axis;
      const parent = new THREE.Quaternion();
      directions.forEach((desired, part) => {
        // A full bending frame also fixes nail roll. A single aimed axis can
        // flip a phalanx by 180 degrees near the opposite bind direction.
        const world = gripFrame(desired, normal).multiply(this.frames[digit - 1][part]);
        this.rig.bones.get(`finger${digit}-${part + 1}_${this.side}`)!.quaternion.slerp(parent.clone().invert().multiply(world), blend * amount * (prop === 'spoon' && digit > 3 ? .35 : 1)); parent.copy(world);
      });
    }
  }

  /** Choose the contact and all three segment directions together around the cylinder. */
  private curl(base: THREE.Vector3, a: number, b: number, c: number, center: THREE.Vector3, axis: THREE.Vector3,
    radius: number, contactRadius: number, turn: number, thumb: boolean): THREE.Vector3[] {
    const relative = base.clone().sub(center), height = relative.dot(axis);
    const radial = relative.addScaledVector(axis, -height), distance = radial.length(); radial.normalize();
    const endRadius = contactRadius + c;
    const evaluate = (degrees: number) => {
      const reach = Math.sqrt(a * a + b * b + 2 * a * b * Math.cos(degrees * Math.PI / 180));
      const arc = Math.acos(THREE.MathUtils.clamp((distance * distance + endRadius * endRadius + height * height - reach * reach) / (2 * distance * endRadius), -1, 1));
      const outward = radial.clone().applyAxisAngle(axis, turn * arc), direction = outward.clone().negate();
      const end = center.clone().addScaledVector(outward, endRadius), toward = end.clone().sub(base);
      const length = THREE.MathUtils.clamp(toward.length(), Math.abs(a - b) + .001, a + b - .001); toward.normalize(); end.copy(base).addScaledVector(toward, length);
      const along = (a * a - b * b + length * length) / (2 * length), side = new THREE.Vector3().crossVectors(toward, axis).normalize();
      const hinge = base.clone().addScaledVector(toward, along).addScaledVector(side, turn * Math.sqrt(Math.max(0, a * a - along * along)));
      const proximal = hinge.clone().sub(base).normalize(), middle = end.clone().sub(hinge).normalize();
      const pip = proximal.angleTo(middle), dip = middle.angleTo(direction);
      const curls = [new THREE.Vector3().crossVectors(proximal, middle).dot(axis), new THREE.Vector3().crossVectors(middle, direction).dot(axis)];
      let cost = (pip - 1.3) ** 2 + (dip - .7) ** 2;
      cost += 1000 * (Math.max(0, pip - (thumb ? 1.7 : 1.95)) ** 2 + Math.max(0, dip - 1.5) ** 2);
      cost += 1000 * curls.reduce((sum, curl) => sum + Math.min(0, curl * turn) ** 2, 0);
      for (const [start, finish] of [[base, hinge], [hinge, end]]) {
        const p = start.clone().sub(center); p.addScaledVector(axis, -p.dot(axis));
        const segment = finish.clone().sub(start); segment.addScaledVector(axis, -segment.dot(axis));
        const closest = p.addScaledVector(segment, THREE.MathUtils.clamp(-p.dot(segment) / segment.lengthSq(), 0, 1));
        cost += 10000 * Math.max(0, radius + .02 - closest.length()) ** 2;
      }
      return { cost, directions: [proximal, middle, direction] };
    };
    // A fixed saved-pose solve avoids both history dependence and jumps between
    // discrete candidate curls while the utensil swivels in the palm.
    let lo = 10, hi = thumb ? 95 : 110;
    const ratio = (Math.sqrt(5) - 1) / 2;
    let left = hi - ratio * (hi - lo), right = lo + ratio * (hi - lo);
    let l = evaluate(left), r = evaluate(right);
    for (let iteration = 0; iteration < 16; iteration++) {
      if (l.cost < r.cost) { hi = right; right = left; r = l; left = hi - ratio * (hi - lo); l = evaluate(left); }
      else { lo = left; left = right; l = r; right = lo + ratio * (hi - lo); r = evaluate(right); }
    }
    return evaluate((lo + hi) / 2).directions;
  }
}
