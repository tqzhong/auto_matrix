import * as THREE from 'three';
import { FILM_SETS, TRUCK_WEAPONS, truckWeaponGrip, truckWeaponDropPose, type TruckWeaponGesture } from '@auto_matrix/shared';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { CharacterRig } from './CharacterModel.js';

export class TruckWeaponProps {
  readonly gun = new THREE.Group();
  readonly sword = new THREE.Group();
  readonly flash = new THREE.Group();
  private geometries: THREE.BufferGeometry[] = [];
  private steel = new THREE.MeshStandardMaterial({ color: '#88918a', metalness: .85, roughness: .45 });
  private dark = new THREE.MeshStandardMaterial({ color: '#252927', metalness: .72, roughness: .34 });
  private grip = new THREE.MeshStandardMaterial({ color: '#181b19', roughness: .82 });
  private brass = new THREE.MeshStandardMaterial({ color: '#8a825a', metalness: .8, roughness: .32 });
  private light = new THREE.MeshBasicMaterial({ color: '#ffda96', toneMapped: false });
  constructor(parent: THREE.Object3D) {
    this.gun.name = 'truck-morpheus-pistol'; this.sword.name = 'truck-morpheus-katana'; this.flash.name = 'truck-pistol-flash';
    const mesh = (group: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, position: number[]) => {
      this.geometries.push(geometry); const part = new THREE.Mesh(geometry, material);
      part.position.set(position[0], position[1], position[2]); part.castShadow = part.receiveShadow = true; group.add(part); return part;
    };
    mesh(this.gun, new RoundedBoxGeometry(.16, .18, .64, 2, .015), this.dark, [0, .18, .2]);
    mesh(this.gun, new RoundedBoxGeometry(.125, .34, .16, 2, .015), this.grip, [0, -.07, -.035]).rotation.x = -.15;
    const barrel = mesh(this.gun, new THREE.CylinderGeometry(.037, .037, .16, 16), this.steel, [0, .185, .54]); barrel.rotation.x = Math.PI / 2;
    mesh(this.gun, new THREE.TorusGeometry(.072, .012, 6, 16), this.dark, [0, .01, .14]).rotation.y = Math.PI / 2;
    mesh(this.gun, new THREE.BoxGeometry(.026, .055, .025), this.dark, [0, .016, .12]).rotation.x = -.3;
    for (const z of [-.035, -.005, .025, .055]) mesh(this.gun, new THREE.BoxGeometry(.166, .014, .009), this.steel, [0, .24, z]);
    mesh(this.gun, new THREE.BoxGeometry(.025, .025, .035), this.dark, [0, .282, .46]);
    const hilt = mesh(this.sword, new THREE.CylinderGeometry(.063, .063, .5, 16), this.grip, [0, 0, 0]); hilt.rotation.x = Math.PI / 2;
    for (let i = 0; i < 9; i++) mesh(this.sword, new THREE.TorusGeometry(.064, .008, 5, 14), this.dark, [0, 0, -.22 + i * .054]);
    mesh(this.sword, new THREE.CylinderGeometry(.08, .08, .025, 16), this.brass, [0, 0, -.265]).rotation.x = Math.PI / 2;
    mesh(this.sword, new THREE.CylinderGeometry(.15, .15, .04, 24), this.dark, [0, 0, .28]).rotation.x = Math.PI / 2;
    mesh(this.sword, new THREE.BoxGeometry(.105, .045, .11), this.brass, [0, 0, .335]);
    const shape = new THREE.Shape(); shape.moveTo(-.052, .37);
    for (let i = 0; i <= 18; i++) { const t = i / 18; shape.lineTo(-.052 - .14 * t * t, .37 + 1.82 * t); }
    shape.lineTo(-.15, 2.3);
    for (let i = 18; i >= 0; i--) { const t = i / 18; shape.lineTo(.052 - .14 * t * t, .37 + 1.82 * t); }
    shape.closePath();
    const blade = new THREE.ExtrudeGeometry(shape, { depth: .018, bevelEnabled: true, bevelThickness: .006, bevelSize: .006, bevelSegments: 1, steps: 1 });
    blade.rotateX(Math.PI / 2); blade.translate(0, .009, 0);
    mesh(this.sword, blade, this.steel, [0, 0, 0]).name = 'truck-katana-blade';
    const glow = mesh(this.flash, new THREE.SphereGeometry(.075, 8, 6), this.light, [0, 0, 0]); glow.scale.set(.5, .7, 2.5); glow.castShadow = false;
    parent.add(this.gun, this.sword, this.flash); this.hide();
  }
  hide(): void { this.gun.visible = this.sword.visible = this.flash.visible = false; }
  muzzle(): THREE.Vector3 { return this.gun.localToWorld(new THREE.Vector3(0, .185, .62)); }
  dispose(): void {
    this.gun.removeFromParent(); this.sword.removeFromParent(); this.flash.removeFromParent();
    this.geometries.forEach(g => g.dispose()); [this.steel, this.dark, this.grip, this.brass, this.light].forEach(m => m.dispose());
  }
}

export function reach(joint: THREE.Object3D, hinge: THREE.Object3D, end: THREE.Vector3, target: THREE.Vector3, pole: THREE.Vector3): void {
  const start = joint.getWorldPosition(new THREE.Vector3()), direction = target.clone().sub(start);
  const scale = joint.getWorldScale(new THREE.Vector3()).x, a = hinge.position.length() * scale, b = end.length() * scale;
  const distance = THREE.MathUtils.clamp(direction.length(), Math.abs(a - b) + .001, a + b - .001);
  direction.normalize(); target = start.clone().addScaledVector(direction, distance);
  const along = (a * a - b * b + distance * distance) / (2 * distance);
  pole = pole.clone().addScaledVector(direction, -pole.dot(direction)).normalize();
  const bend = start.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
  const aim = (bone: THREE.Object3D, axis: THREE.Vector3, point: THREE.Vector3) => {
    bone.quaternion.setFromUnitVectors(axis.clone().normalize(), bone.parent!.worldToLocal(point.clone()).sub(bone.position).normalize());
    bone.updateWorldMatrix(false, true);
  };
  aim(joint, hinge.position, bend); aim(hinge, end, target);
}

export function poseTruckWeapons(rig: CharacterRig, gesture: TruckWeaponGesture | undefined): void {
  rig.truckProps?.hide(); if (!gesture) return;
  const center = FILM_SETS.film_freeway_101.center, body = gesture.bodies[gesture.role];
  const world = (p: { x: number; y: number; z: number }) => new THREE.Vector3(center.x + gesture.truck.x + p.x, center.y - 1 + p.y, center.z + gesture.truck.z + p.z);
  const orientation = (yaw: number, pitch = 0, roll = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ'));
  const place = (object: THREE.Object3D, p: THREE.Vector3, q: THREE.Quaternion) => {
    object.position.copy(object.parent!.worldToLocal(p.clone())); object.quaternion.copy(object.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));
    object.updateWorldMatrix(false, true);
  };
  rig.root.updateWorldMatrix(true, true);
  const hold = (side: 'R' | 'L', point: THREE.Vector3, q: THREE.Quaternion) => {
    const index = side === 'R' ? 0 : 1, bones = rig.hero?.bones;
    const shoulder = bones?.get(`shoulder_${side}`) ?? rig.shoulders[index], elbow = bones?.get(`elbow_${side}`) ?? rig.elbows[index];
    const grip = q.clone().multiply(orientation(0, -Math.PI / 2));
    if (bones) {
      const wrist = bones.get(`wrist_${side}`)!, palm = new THREE.Vector3(side === 'R' ? .09 : -.09, -.18, .02);
      const offset = palm.clone().multiply(wrist.getWorldScale(new THREE.Vector3())).applyQuaternion(grip);
      reach(shoulder, elbow, wrist.position, point.clone().sub(offset), new THREE.Vector3(index ? 1 : -1, -.25, -.4).applyQuaternion(orientation(body.yaw)));
      wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(grip));
      for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
        const joint = bones.get(`finger${finger}-${segment}_${side}`)!; joint.rotation.z = (index ? 1 : -1) * (finger === 1 ? -.18 : -.5);
      }
      wrist.updateWorldMatrix(false, true);
      return wrist.localToWorld(palm);
    }
    reach(shoulder, elbow, new THREE.Vector3(0, -.75, .005), point, new THREE.Vector3(index ? 1 : -1, -.25, -.4).applyQuaternion(orientation(body.yaw)));
    return elbow.localToWorld(new THREE.Vector3(0, -.75, .005));
  };
  if (gesture.role === 'morpheus' && rig.truckProps) {
    for (const weapon of ['gun', 'sword'] as const) {
      const prop = rig.truckProps[weapon], drop = gesture[weapon]; prop.visible = true;
      if (drop) {
        const pose = truckWeaponDropPose(drop, gesture.total, weapon); place(prop, world(pose), orientation(pose.yaw, pose.pitch, pose.roll));
      } else {
        const grip = truckWeaponGrip(gesture, body, weapon), q = orientation(grip.yaw, grip.pitch);
        const palm = hold(weapon === 'gun' ? 'R' : 'L', world(grip), q); place(prop, palm, q);
      }
    }
    const shotAge = gesture.shotAt === undefined ? Infinity : gesture.total - gesture.shotAt;
    rig.truckProps.flash.visible = !gesture.gun && shotAge >= 0 && shotAge < .09;
    place(rig.truckProps.flash, rig.truckProps.muzzle(), rig.truckProps.gun.getWorldQuaternion(new THREE.Quaternion()));
  }
  if (gesture.role === 'agent_johnson' && ['gun_disarm', 'counter', 'sword_disarm'].includes(gesture.phase)) {
    const weapon = gesture.phase === 'gun_disarm' ? 'gun' : 'sword';
    const contact = truckWeaponGrip(gesture, gesture.bodies.morpheus, weapon);
    const t = THREE.MathUtils.smoothstep(gesture.elapsed / TRUCK_WEAPONS.release, 0, 1);
    const rest = rig.root.localToWorld(new THREE.Vector3(weapon === 'gun' ? .55 : -.55, 2.55, .45));
    hold(weapon === 'gun' ? 'L' : 'R', rest.lerp(world(contact).add(new THREE.Vector3(0, .06, 0)), t), orientation(body.yaw));
  }
  if (gesture.phase !== 'unarmed') {
    // Paired attacks plant the actual delivered boots, rather than changing leg lengths.
    for (const [index, side] of ['R', 'L'].entries()) {
      const bones = rig.hero?.bones, hip = bones?.get(`hip_${side}`) ?? rig.hips[index], knee = bones?.get(`knee_${side}`) ?? rig.knees[index], ankle = bones?.get(`ankle_${side}`) ?? rig.ankles[index];
      const point = rig.root.localToWorld(new THREE.Vector3(index ? .4 : -.4, (rig.hero?.footHeight ?? .155), index ? -.25 : .25));
      point.y = center.y - 1 + body.y + (rig.hero?.footHeight ?? .155);
      reach(hip, knee, ankle.position, point, new THREE.Vector3(index ? .3 : -.3, .35, .8).applyQuaternion(orientation(body.yaw)));
      ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation(body.yaw)));
    }
  }
  rig.root.updateWorldMatrix(true, true);
}
