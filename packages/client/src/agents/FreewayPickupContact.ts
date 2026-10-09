import * as THREE from 'three';
import { FILM_SETS, FREEWAY_PICKUP, FREEWAY_BIKE, FREEWAY_HANDOFF, TRUCKS, freewayPickupBike, freewayRideBike, type FreewayPickup, type FreewayRide, type FreewayHandoff, type FreewayHandoffRole } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { PhoneModel } from './PhoneModel.js';

const smooth = (value: number) => THREE.MathUtils.smoothstep(value, 0, 1);

export class FreewayPickupProps {
  readonly phone = new PhoneModel();
  readonly key = new THREE.Group();
  readonly flash: THREE.Mesh;
  private metal = new THREE.MeshStandardMaterial({ color: 0xbeb59c, roughness: .3, metalness: .85 });
  private light = new THREE.MeshBasicMaterial({ color: 0xffe4a4, toneMapped: false });
  private geometries: THREE.BufferGeometry[] = [];
  constructor(parent: THREE.Object3D) {
    this.phone.root.name = 'freeway-call-phone'; this.key.name = 'freeway-ignition-key';
    const part = (geometry: THREE.BufferGeometry, x: number, y: number, z: number) => {
      this.geometries.push(geometry); const mesh = new THREE.Mesh(geometry, this.metal); mesh.position.set(x, y, z); this.key.add(mesh); return mesh;
    };
    part(new THREE.TorusGeometry(.065, .016, 8, 20), 0, 0, -.065);
    part(new THREE.BoxGeometry(.032, .024, .2), 0, 0, .095);
    for (const z of [.13, .17]) part(new THREE.BoxGeometry(.06, .024, .022), .024, 0, z);
    const geometry = new THREE.SphereGeometry(.09, 8, 6); this.geometries.push(geometry);
    this.flash = new THREE.Mesh(geometry, this.light); this.flash.name = 'freeway-chain-shot-flash'; this.flash.scale.set(.7, 1.5, .7);
    parent.add(this.phone.root, this.key, this.flash); this.hide();
  }
  hide(): void { this.phone.root.visible = this.key.visible = this.flash.visible = false; }
  dispose(): void {
    this.phone.dispose(); this.key.removeFromParent(); this.flash.removeFromParent();
    this.geometries.forEach(g => g.dispose()); this.metal.dispose(); this.light.dispose();
  }
}

// The same two-link solve used by the existing rescue/foot placement keeps bone lengths intact.
function reach(joint: THREE.Object3D, hinge: THREE.Object3D, end: THREE.Vector3, target: THREE.Vector3, pole: THREE.Vector3, blend: number): void {
  const first = joint.quaternion.clone(), second = hinge.quaternion.clone();
  const start = joint.getWorldPosition(new THREE.Vector3()), direction = target.clone().sub(start);
  const scale = joint.getWorldScale(new THREE.Vector3()).x;
  const upper = hinge.position.length() * scale, lower = end.length() * scale;
  const distance = THREE.MathUtils.clamp(direction.length(), Math.abs(upper - lower) + .001, upper + lower - .001);
  direction.normalize(); target = start.clone().addScaledVector(direction, distance);
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  pole = pole.clone().addScaledVector(direction, -pole.dot(direction)).normalize();
  const bend = start.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, upper * upper - along * along)));
  const aim = (bone: THREE.Object3D, axis: THREE.Vector3, point: THREE.Vector3) => {
    bone.quaternion.setFromUnitVectors(axis.clone().normalize(), bone.parent!.worldToLocal(point.clone()).sub(bone.position).normalize());
    bone.updateWorldMatrix(false, true);
  };
  aim(joint, hinge.position, bend); aim(hinge, end, target);
  joint.quaternion.copy(first.slerp(joint.quaternion, blend)); hinge.quaternion.copy(second.slerp(hinge.quaternion, blend));
  joint.updateWorldMatrix(false, true);
}

export function poseFreewayDriver(rig: CharacterRig, pickup: FreewayPickup | undefined): void {
  if (!pickup?.chase) return;
  const truck = pickup.chase.truck, center = FILM_SETS.film_freeway_101.center;
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), truck.yaw);
  const point = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyQuaternion(rotation)
    .add(new THREE.Vector3(center.x + truck.x, center.y - 1, center.z + truck.z));
  rig.root.updateWorldMatrix(true, true);
  for (const [index, side] of ['R', 'L'].entries()) {
    const sign = index ? 1 : -1, bones = rig.hero?.bones;
    const hip = bones?.get(`hip_${side}`) ?? rig.hips[index], knee = bones?.get(`knee_${side}`) ?? rig.knees[index];
    const ankle = bones?.get(`ankle_${side}`) ?? rig.ankles[index], pedals = FREEWAY_PICKUP.pedals;
    reach(hip, knee, ankle.position, point(pedals.x + sign * .35, pedals.y + .04 + (rig.hero?.footHeight ?? .155), pedals.z),
      new THREE.Vector3(sign * .25, .3, 1).applyQuaternion(rotation), 1);
    ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation)); ankle.updateWorldMatrix(false, true);
    const wheel = FREEWAY_PICKUP.wheel, contact = point(wheel.x + sign * .3, wheel.y, wheel.z);
    const shoulder = bones?.get(`shoulder_${side}`) ?? rig.shoulders[index], elbow = bones?.get(`elbow_${side}`) ?? rig.elbows[index];
    const pole = new THREE.Vector3(sign, -.3, -.5).applyQuaternion(rotation);
    if (bones) {
      const wrist = bones.get(`wrist_${side}`)!, grip = rotation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)));
      const offset = new THREE.Vector3(side === 'R' ? .09 : -.09, -.18, .02).multiply(wrist.getWorldScale(new THREE.Vector3())).applyQuaternion(grip);
      reach(shoulder, elbow, wrist.position, contact.sub(offset), pole, 1);
      wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(grip));
    } else reach(shoulder, elbow, new THREE.Vector3(0, -.75, .005), contact, pole, 1);
  }
  rig.root.updateWorldMatrix(true, true);
}

export function poseFreewayRide(rig: CharacterRig, ride: (FreewayRide & { role: 'trinity' | 'keymaker' }) | undefined): void {
  if (!ride) {
    if (rig.root.userData.freewayRiding) { rig.root.rotation.x = rig.root.rotation.z = 0; delete rig.root.userData.freewayRiding; }
    return;
  }
  rig.root.userData.freewayRiding = true;
  const bike = freewayRideBike(ride); rig.root.rotation.y = bike.yaw;
  poseMotorcycle(rig, bike, ride.role === 'trinity', 1, ride.braking ?? 0);
}

export function poseFreewayHandoff(rig: CharacterRig, gesture: (FreewayHandoff & { role: FreewayHandoffRole }) | undefined): void {
  if (gesture?.role === 'keymaker' && gesture.phase === 'reaching') {
    poseMotorcycle(rig, freewayRideBike(gesture.bike), false, 1 - smooth(gesture.elapsed / FREEWAY_HANDOFF.reach), 0);
  }
  if (!gesture || gesture.role !== 'morpheus') return;
  const reaching = gesture.phase === 'reaching' ? smooth(gesture.elapsed / FREEWAY_HANDOFF.reach)
    : gesture.phase === 'lifting' ? 1 - smooth((gesture.elapsed - 1.7) / .7) : 0;
  if (!reaching) { poseHandoffCoat(rig, gesture); return; }
  const center = FILM_SETS.film_freeway_101.center;
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const pelvis = rig.hero?.bones.get('pelvis');
  if (pelvis) {
    const lift = gesture.phase === 'lifting' ? smooth(gesture.elapsed / FREEWAY_HANDOFF.lift) : 0;
    const rest = pelvis.getWorldPosition(new THREE.Vector3());
    const anchor = new THREE.Vector3(center.x + gesture.truck.x + 2.65,
      THREE.MathUtils.lerp(center.y - 1 + TRUCKS.roof.height + .3, rest.y, smooth(lift / .7)), center.z + gesture.truck.z - 3.5);
    pelvis.position.copy(pelvis.parent!.worldToLocal(rest.lerp(anchor, reaching)));
    pelvis.rotation.x = 2.1 * reaching * (1 - lift * .6);
    rig.hero!.bones.get('head')!.rotation.x = -1.6 * reaching * (1 - lift);
  } else { rig.torso.position.y -= 1.3 * reaching; rig.torso.rotation.x = 1.9 * reaching; }
  rig.root.updateWorldMatrix(true, true);
  for (const [i, side] of ['R', 'L'].entries()) {
    const hip = rig.hero?.bones.get(`hip_${side}`) ?? rig.hips[i], knee = rig.hero?.bones.get(`knee_${side}`) ?? rig.knees[i];
    const ankle = rig.hero?.bones.get(`ankle_${side}`) ?? rig.ankles[i];
    const foot = new THREE.Vector3(center.x + gesture.truck.x + 2.2, center.y - 1 + TRUCKS.roof.height + (rig.hero?.footHeight ?? .155), center.z + gesture.truck.z - 3.5 + (i ? .5 : -.5));
    reach(hip, knee, ankle.position, foot, new THREE.Vector3(1, .4, i ? .4 : -.4), reaching);
    ankle.quaternion.slerp(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation), reaching);
  }
  poseHandoffCoat(rig, gesture);
}

function poseHandoffCoat(rig: CharacterRig, gesture: FreewayHandoff): void {
  if (!rig.hero) return;
  rig.root.updateWorldMatrix(true, true);
  const center = FILM_SETS.film_freeway_101.center, pelvis = rig.hero.bones.get('pelvis')!;
  const hanging = 1 - Math.max(0, Math.cos(pelvis.rotation.x));
  const capsules = ['R', 'L'].flatMap(side => ['hip', 'knee'].map((part, i) => ({
    start: rig.hero!.bones.get(`${part}_${side}`)!.getWorldPosition(new THREE.Vector3()),
    end: rig.hero!.bones.get(`${i ? 'ankle' : 'knee'}_${side}`)!.getWorldPosition(new THREE.Vector3()), radius: i ? .2 : .24,
  })));
  for (const panel of rig.hero.panels) {
    const position = panel.mesh.geometry.attributes.position, scale = panel.mesh.getWorldScale(new THREE.Vector3()).y;
    const down = new THREE.Vector3(0, -1, 0).transformDirection(panel.mesh.matrixWorld);
    for (let i = 0; i < position.count; i++) {
      const x = panel.rest[i * 3], y = panel.rest[i * 3 + 1], z = panel.rest[i * 3 + 2], t = Math.max(0, -y / 1.97);
      const point = panel.mesh.localToWorld(new THREE.Vector3(x, 0, z));
      point.addScaledVector(down.clone().lerp(new THREE.Vector3(0, -1, 0), hanging * smooth(t / .35)).normalize(), -y * scale);
      if (t > .04) for (const capsule of capsules) {
        const line = capsule.end.clone().sub(capsule.start), along = THREE.MathUtils.clamp(point.clone().sub(capsule.start).dot(line) / line.lengthSq(), 0, 1);
        const closest = capsule.start.clone().addScaledVector(line, along), offset = point.clone().sub(closest), distance = offset.length();
        if (distance > .001 && distance < capsule.radius) point.addScaledVector(offset, (capsule.radius - distance) / distance);
      }
      if (Math.abs(point.x - center.x - gesture.truck.x) < TRUCKS.roof.width / 2 + .06
        && point.z > center.z + gesture.truck.z - 13.6 && point.z < center.z + gesture.truck.z + 6.6)
        point.y = Math.max(point.y, center.y - 1 + TRUCKS.roof.height + .13);
      panel.mesh.worldToLocal(point); position.setXYZ(i, point.x, point.y, point.z);
    }
    panel.velocity.fill(0); position.needsUpdate = true; panel.mesh.geometry.computeVertexNormals();
  }
}

/** Both palms follow the delivered passenger jacket, rather than a fixed scene marker. */
export function poseFreewayTransferContact(morpheus: CharacterRig, keymaker: CharacterRig, state: FreewayHandoff): void {
  if (!['reaching', 'lifting'].includes(state.phase)) return;
  const blend = state.phase === 'reaching' ? smooth(state.elapsed / FREEWAY_HANDOFF.reach)
    : 1 - smooth((state.elapsed - 1.7) / .7);
  if (!blend) return;
  keymaker.root.updateWorldMatrix(true, true); morpheus.root.updateWorldMatrix(true, true);
  const jacket = keymaker.hero?.bones.get('chest') ?? keymaker.torso;
  for (const [i, side] of ['R', 'L'].entries()) {
    const contact = jacket.localToWorld(new THREE.Vector3(.32, keymaker.hero ? .3 : 1.45, keymaker.hero ? -.025 : i ? .2215 : -.2215));
    const shoulder = morpheus.hero?.bones.get(`shoulder_${side}`) ?? morpheus.shoulders[i];
    const elbow = morpheus.hero?.bones.get(`elbow_${side}`) ?? morpheus.elbows[i];
    const wrist = morpheus.hero?.bones.get(`wrist_${side}`);
    if (wrist) {
      const grip = jacket.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, i ? Math.PI / 2 : -Math.PI / 2, 0)));
      const palm = new THREE.Vector3(side === 'R' ? .09 : -.09, -.18, .02).multiply(wrist.getWorldScale(new THREE.Vector3()));
      reach(shoulder, elbow, wrist.position, contact.sub(palm.applyQuaternion(grip)), new THREE.Vector3(1, 0, i ? .6 : -.6), blend);
      wrist.quaternion.slerp(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(grip), blend);
    } else reach(shoulder, elbow, new THREE.Vector3(0, -.75, .005), contact, new THREE.Vector3(1, 0, i ? .6 : -.6), blend);
  }
}

export function poseFreewayPickup(rig: CharacterRig, pickup: (FreewayPickup & { role: 'trinity' | 'keymaker' }) | undefined, blend: number): void {
  rig.freewayProps?.hide();
  if (!pickup) return;
  if (blend <= 0) { posePickupProps(rig, pickup); return; }
  poseMotorcycle(rig, { ...freewayPickupBike(pickup), roll: 0 }, pickup.role === 'trinity', blend, 0);
  posePickupProps(rig, pickup);
}

function poseMotorcycle(rig: CharacterRig, bike: ReturnType<typeof freewayRideBike>, trinity: boolean, blend: number, braking: number): void {
  const center = FILM_SETS.film_freeway_101.center;
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-bike.pitch, bike.yaw, bike.roll, 'YXZ'));
  const origin = new THREE.Vector3(center.x + bike.x, center.y - 1 + bike.y, center.z + bike.z);
  const point = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyQuaternion(rotation).add(origin);
  const seat = trinity ? FREEWAY_BIKE.rider : FREEWAY_BIKE.passenger;
  rig.root.rotation.order = 'YXZ'; rig.root.rotation.x = -bike.pitch * blend; rig.root.rotation.z = bike.roll * blend;
  rig.root.updateWorldMatrix(true, true);
  // Ground placement must not lower the rider's pelvis to make a seated boot touch the road.
  if (rig.hero) {
    const pelvis = rig.hero.bones.get('pelvis')!;
    pelvis.position.lerp(pelvis.parent!.worldToLocal(point(0, 2.45, seat)), blend);
    if (trinity) {
      pelvis.rotation.x = (1.05 - braking * .08) * blend;
      rig.hero.bones.get('spine')!.rotation.x = .12 * blend;
      rig.hero.bones.get('chest')!.rotation.x = .08 * blend;
      rig.hero.bones.get('head')!.rotation.x = (-1.12 + braking * .08) * blend;
      pelvis.updateWorldMatrix(false, true);
    }
  } else {
    const hip = rig.detail.worldToLocal(point(0, 2.45, seat));
    rig.torso.position.lerp(hip, blend);
    for (const joint of rig.hips) joint.position.y = THREE.MathUtils.lerp(joint.position.y, hip.y, blend);
  }
  rig.root.updateWorldMatrix(true, true);
  for (const [index, side] of ['R', 'L'].entries()) {
    const sign = index ? 1 : -1, bones = rig.hero?.bones;
    const hip = bones?.get(`hip_${side}`) ?? rig.hips[index], knee = bones?.get(`knee_${side}`) ?? rig.knees[index];
    const ankle = bones?.get(`ankle_${side}`) ?? rig.ankles[index];
    const target = point(sign * 1.05, .96 + (rig.hero?.footHeight ?? .155), trinity ? -.43 : -1.78);
    reach(hip, knee, ankle.position, target, new THREE.Vector3(sign * 1.2, .15, .6).applyQuaternion(rotation), blend);
    const orientation = knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation);
    ankle.quaternion.slerp(orientation, blend); ankle.updateWorldMatrix(false, true);

    const shoulder = bones?.get(`shoulder_${side}`) ?? rig.shoulders[index], elbow = bones?.get(`elbow_${side}`) ?? rig.elbows[index];
    // Passenger contact is calibrated against Trinity's shipped leather waist, below the crouched shoulders.
    const contact = trinity ? point(sign * .9, 2.5, 1.55) : point(sign * .27, 2.7, -.61);
    const pole = new THREE.Vector3(sign, -.1, -.5).applyQuaternion(rotation);
    if (bones) {
      const wrist = bones.get(`wrist_${side}`)!;
      const grip = rotation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)));
      const palm = new THREE.Vector3(side === 'R' ? .09 : -.09, -.18, .02).multiply(wrist.getWorldScale(new THREE.Vector3()));
      const target = contact.clone().sub(palm.applyQuaternion(grip));
      reach(shoulder, elbow, wrist.position, target, pole, blend);
      wrist.quaternion.slerp(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(grip), blend);
      for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
        const joint = bones.get(`finger${finger}-${segment}_${side}`)!;
        joint.rotation.z = THREE.MathUtils.lerp(joint.rotation.z, sign * (finger === 1 ? -.12 : -.45), blend);
      }
    } else reach(shoulder, elbow, new THREE.Vector3(0, -.75, .005), contact, pole, blend);
  }
  rig.root.updateWorldMatrix(true, true);
}

function posePickupProps(rig: CharacterRig, pickup: FreewayPickup & { role: 'trinity' | 'keymaker' }): void {
  const props = rig.freewayProps; if (!props) return;
  const trinity = pickup.role === 'trinity', center = FILM_SETS.film_freeway_101.center;
  const call = pickup.phase === 'key' || pickup.phase === 'keyhandoff' && pickup.elapsed < .5;
  const handoff = pickup.phase === 'keyhandoff', offer = pickup.phase === 'key' || handoff;
  const actorRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rig.root.rotation.y);
  const palmOffset = (side: 'R' | 'L') => new THREE.Vector3(side === 'R' ? .09 : -.09, -.18, .02);
  const hold = (side: 'R' | 'L', contact: THREE.Vector3, orientation: THREE.Quaternion, amount = 1) => {
    const index = side === 'R' ? 0 : 1, bones = rig.hero?.bones;
    const shoulder = bones?.get(`shoulder_${side}`) ?? rig.shoulders[index], elbow = bones?.get(`elbow_${side}`) ?? rig.elbows[index];
    if (bones) {
      const wrist = bones.get(`wrist_${side}`)!;
      const offset = palmOffset(side).multiply(wrist.getWorldScale(new THREE.Vector3())).applyQuaternion(orientation);
      reach(shoulder, elbow, wrist.position, contact.clone().sub(offset), new THREE.Vector3(index ? 1 : -1, -.15, -.2).applyQuaternion(actorRotation), amount);
      wrist.quaternion.slerp(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation), amount);
      for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
        const joint = bones.get(`finger${finger}-${segment}_${side}`)!;
        joint.rotation.z = THREE.MathUtils.lerp(joint.rotation.z, (index ? 1 : -1) * (finger === 1 ? -.2 : -.55), amount);
      }
      wrist.updateWorldMatrix(false, true);
      return wrist.localToWorld(palmOffset(side));
    }
    reach(shoulder, elbow, new THREE.Vector3(0, -.75, .005), contact, new THREE.Vector3(index ? 1 : -1, -.1, -.2).applyQuaternion(actorRotation), amount);
    return elbow.localToWorld(new THREE.Vector3(0, -.75, .005));
  };
  const place = (object: THREE.Object3D, point: THREE.Vector3, orientation: THREE.Quaternion) => {
    object.position.copy(object.parent!.worldToLocal(point));
    object.quaternion.copy(object.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    object.updateWorldMatrix(false, true);
  };
  if (call && trinity && rig.hero) {
    const lift = pickup.phase === 'key' ? smooth(pickup.elapsed / .6) : 1 - smooth(pickup.elapsed / .5);
    const head = rig.hero.bones.get('head')!;
    const phonePosition = head.localToWorld(new THREE.Vector3(-.36, -1.25 + lift * 1.18, .01));
    const orientation = actorRotation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)));
    const grip = new THREE.Vector3(0, -.09, -.03).applyQuaternion(orientation);
    const contact = hold('R', phonePosition.clone().add(grip), orientation);
    place(props.phone.root, contact.sub(grip), orientation);
    props.phone.root.visible = pickup.phase === 'key' ? pickup.elapsed > .1 : pickup.elapsed < .45; props.phone.update(lift);
  }
  if (offer) {
    const contact = new THREE.Vector3(center.x + pickup.x + .25, center.y - 1 + FREEWAY_PICKUP.carrier.deck + 2.65,
      center.z + FREEWAY_PICKUP.carrier.start + pickup.total * FREEWAY_PICKUP.carrier.speed + pickup.z - .65);
    const orientation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const t = handoff ? pickup.elapsed : 0;
    if (trinity && handoff) {
      const amount = smooth(t / .7);
      const withdrawing = smooth((t - 1.05) / .6);
      const pocket = rig.root.localToWorld(new THREE.Vector3(.4, 2.05, .2));
      const palm = hold('L', contact.clone().lerp(pocket, withdrawing), orientation, amount);
      place(props.key, t <= 1.05 ? contact.clone() : palm, orientation); props.key.visible = pickup.key;
    } else if (!trinity) {
      const amount = handoff ? 1 : smooth(pickup.elapsed / .65), withdrawing = smooth((t - 1.05) / .6);
      const pocket = rig.root.localToWorld(new THREE.Vector3(-.3, 2, .2));
      const palm = hold('R', contact.clone().lerp(pocket, withdrawing), orientation, amount);
      place(props.key, handoff && t <= 1.05 ? contact.clone() : palm, orientation); props.key.visible = !pickup.key;
    }
  }
  if (pickup.phase === 'shooting' && trinity && rig.weapons?.[0]) {
    const gun = rig.weapons[0], bike = freewayPickupBike(pickup);
    const target = new THREE.Vector3(center.x + FREEWAY_PICKUP.carrier.x + FREEWAY_PICKUP.bike.x - .78,
      center.y - 1 + FREEWAY_PICKUP.carrier.deck + .35, center.z + FREEWAY_PICKUP.carrier.start + pickup.total * FREEWAY_PICKUP.carrier.speed + 7.9);
    const contact = new THREE.Vector3(center.x + bike.x - .65, center.y - 1 + bike.y + 3.05, center.z + bike.z + 1.35);
    const recoilAge = pickup.elapsed - FREEWAY_PICKUP.fireAt;
    if (recoilAge > 0) contact.y += Math.sin(Math.min(1, recoilAge / .2) * Math.PI) * .07;
    const aim = (palm: THREE.Vector3) => {
      const direction = target.clone().sub(palm);
      // Offset the barrel line from the actual grip rather than aiming the grip at the chain.
      const axis = new THREE.Vector3(0, -Math.sqrt(Math.max(.001, direction.lengthSq() - .13 ** 2)), -.13);
      return new THREE.Quaternion().setFromUnitVectors(axis.normalize(), direction.normalize());
    };
    let orientation = aim(contact);
    const amount = smooth(pickup.elapsed / .3) * (1 - smooth((pickup.elapsed - .8) / .35));
    const palm = hold('R', contact, orientation, amount);
    orientation = aim(palm);
    place(gun, palm.clone().sub(new THREE.Vector3(0, -.09, .13).applyQuaternion(orientation)), orientation);
    gun.userData.freewayShot = true;
    gun.visible = amount > .03;
    const age = pickup.shotAt === undefined ? Infinity : pickup.total - pickup.shotAt;
    props.flash.visible = age >= 0 && age < .09;
    place(props.flash, gun.localToWorld(new THREE.Vector3(0, -.615, 0)), orientation);
  }
}
