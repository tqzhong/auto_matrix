import * as THREE from 'three';
import { FILM_SETS, PILL_ROOM, PILL_TIMING, pillContact, pillEase, pillPose, type PillGesture } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';

export function createPillGlass(): THREE.Group {
  const group = new THREE.Group(); group.name = 'pill-water-glass'; group.userData.dynamic = true;
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .025, metalness: 0, transparent: true, opacity: .15, transmission: .92, thickness: .008, ior: 1.46, depthWrite: false });
  const profile = [[0, -.22], [.104, -.22], [.115, .22], [.1, .22], [.09, -.187], [0, -.187]].map(([x, y]) => new THREE.Vector2(x, y));
  group.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 32), glass));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.108, .004, 6, 40), new THREE.MeshStandardMaterial({ color: 0xbcc8bd, roughness: .2, metalness: .3, transparent: true, opacity: .5 })); rim.rotation.x = Math.PI / 2; rim.position.y = .22; group.add(rim);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(.102, .094, .29, 32), new THREE.MeshPhysicalMaterial({ color: 0xc6d2c9, transparent: true, opacity: .12, roughness: .04, metalness: 0, transmission: .9, depthWrite: false }));
  water.name = 'pill-water-level'; water.position.y = -.04; group.add(water);
  return group;
}

// Gestures are evaluated from saved elapsed time, including a paused first frame.
// Each prop belongs to a hand; only the table/hand ownership changes at contact.
export class PillPerformance {
  private red: THREE.Mesh;
  private blue: THREE.Mesh;
  private cup = createPillGlass();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  constructor(private rig: HeroRig) {
    const capsule = (name: string, color: number) => {
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(.016, .04, 8, 16), new THREE.MeshPhysicalMaterial({ color, roughness: .2, clearcoat: 1 }));
      mesh.name = name; mesh.castShadow = true; return mesh;
    };
    this.red = capsule('held-red-pill', 0xc12522); this.blue = capsule('held-blue-pill', 0x2459c8);
    for (const object of [this.red, this.blue, this.cup]) {
      rig.root.add(object);
      object.traverse(child => { if (child instanceof THREE.Mesh) { this.geometries.add(child.geometry); this.materials.add(child.material as THREE.Material); } });
    }
  }
  private bone(name: string): THREE.Bone { return this.rig.bones.get(name)!; }
  private local(point: { x: number; y: number; z: number }): THREE.Vector3 {
    const center = FILM_SETS.film_lafayette.center;
    return this.rig.root.worldToLocal(new THREE.Vector3(center.x + point.x, center.y - 1 + point.y, center.z + point.z));
  }
  private hand(side: 'R' | 'L', contact: THREE.Vector3, rotation: THREE.Quaternion, offset: THREE.Vector3, blend = 1): void {
    const root = this.rig.root; root.updateWorldMatrix(true, true);
    const upper = this.bone('shoulder_' + side); const lower = this.bone('elbow_' + side); const end = this.bone('wrist_' + side);
    const rootRotation = root.getWorldQuaternion(new THREE.Quaternion());
    const orientation = rootRotation.clone().invert().multiply(end.getWorldQuaternion(new THREE.Quaternion())).slerp(rotation, blend);
    const target = root.worldToLocal(end.localToWorld(offset.clone())).lerp(contact, blend).sub(offset.clone().applyQuaternion(orientation)); root.localToWorld(target);
    const start = upper.getWorldPosition(new THREE.Vector3()); const direction = target.clone().sub(start);
    const a = lower.position.length(); const b = end.position.length(); const reach = THREE.MathUtils.clamp(direction.length(), .02, a + b - .001); direction.normalize();
    target.copy(start).addScaledVector(direction, reach);
    const along = (a * a - b * b + reach * reach) / (2 * reach);
    const pole = new THREE.Vector3(side === 'L' ? .3 : -.3, -1, .15).applyQuaternion(rootRotation); pole.addScaledVector(direction, -pole.dot(direction)).normalize();
    const hinge = start.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
    const aim = (joint: THREE.Bone, child: THREE.Bone, position: THREE.Vector3) => {
      joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), joint.parent!.worldToLocal(position.clone()).sub(joint.position).normalize()); joint.updateWorldMatrix(false, true);
    };
    aim(upper, lower, hinge); aim(lower, end, target);
    end.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rootRotation).multiply(orientation));
    end.updateWorldMatrix(false, true);
  }
  private fingers(side: 'R' | 'L', grip: number): void {
    for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
      this.bone(`finger${finger}-${segment}_${side}`).rotation.set(finger === 1 ? grip * .6 : 0, 0, (side === 'R' ? 1 : -1) * grip * (finger === 1 ? .2 : segment === 1 ? .65 : .9));
    }
  }
  private orientation(side: 'R' | 'L', normal: THREE.Vector3, fingers: THREE.Vector3): THREE.Quaternion {
    const x = normal.clone().multiplyScalar(side === 'R' ? 1 : -1); const y = fingers.clone().negate();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, x.clone().cross(y)));
  }
  private pinch(side: 'R' | 'L', point: THREE.Vector3): void {
    // The imported hands rest edge-on: their palm normals are +X / -X.
    // Place thumb/index pads around the capsule, leaving the other fingers curled.
    for (const finger of [1, 2]) {
      const chain = [1, 2, 3].map(segment => this.bone(`finger${finger}-${segment}_${side}`));
      chain.forEach(joint => joint.quaternion.identity());
      const tip = chain[2].position.clone().normalize().multiplyScalar(.04);
      const target = point.clone(); target.x += (side === 'R' ? 1 : -1) * (finger === 1 ? .019 : -.019);
      this.bone('wrist_' + side).localToWorld(target);
      for (let iteration = 0; iteration < 8; iteration++) for (const joint of [...chain].reverse()) {
        this.rig.root.updateWorldMatrix(true, true);
        const current = joint.worldToLocal(chain[2].localToWorld(tip.clone())).normalize();
        const desired = joint.worldToLocal(target.clone()).normalize();
        joint.quaternion.multiply(new THREE.Quaternion().setFromUnitVectors(current, desired));
      }
    }
  }
  private attach(object: THREE.Object3D, side: 'R' | 'L', offset: THREE.Vector3): void {
    const hand = this.bone('wrist_' + side); if (object.parent !== hand) hand.add(object);
    object.position.copy(offset); object.quaternion.identity();
  }
  update(gesture?: PillGesture): void {
    this.red.visible = this.blue.visible = this.cup.visible = false;
    if (!gesture) return;
    const pose = pillPose(gesture); const time = gesture.elapsed;
    const root = this.rig.root; root.updateWorldMatrix(true, true);
    if (gesture.role === 'morpheus') {
      for (const [side, color, object] of [['R', 'red', this.red], ['L', 'blue', this.blue]] as const) {
        const palm = new THREE.Vector3(side === 'R' ? .082 : -.082, -.18, .015);
        this.fingers(side, .025);
        this.hand(side, this.local(pillContact(color)), this.orientation(side, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)), palm, pose.offer);
        this.attach(object, side, palm);
        object.visible = pose.offer > .1 && !(gesture.choice === color && (gesture.phase === 'done' || gesture.phase === 'taking' && time >= PILL_TIMING.transfer));
      }
      return;
    }
    const side = gesture.choice === 'blue' ? 'R' : 'L';
    const pinch = new THREE.Vector3(side === 'R' ? .14 : -.14, -.32, .12);
    const contact = this.local(pillContact(gesture.choice ?? 'red')); contact.y += .022;
    const mouth = root.worldToLocal(this.bone('head').localToWorld(new THREE.Vector3(0, -.2, .36)));
    const reach = gesture.phase === 'taking' ? pillEase(time, .35, PILL_TIMING.transfer) * (1 - pillEase(time, 3.85, 4.35)) : 0;
    if (reach) {
      const rotation = this.orientation(side, new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1))
        .slerp(this.orientation(side, new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0)), pillEase(time, 2.15, 3.45));
      this.fingers(side, .7);
      this.hand(side, contact.lerp(mouth, pillEase(time, 2.15, 3.45)), rotation, pinch, reach);
      this.pinch(side, pinch);
      const pill = gesture.choice === 'blue' ? this.blue : this.red;
      this.attach(pill, side, pinch); pill.visible = pose.holdingPill;
    }
    if (pose.cupReach) {
      const offset = new THREE.Vector3(.14, -.18, 0);
      const cupRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-.55 * pose.tilt, 0, 0));
      const rotation = cupRotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2));
      const rim = new THREE.Vector3(0, .22, -.1).applyQuaternion(cupRotation);
      const center = this.local(PILL_ROOM.cup).lerp(mouth.clone().sub(rim), pose.drink);
      this.fingers('R', .8);
      this.hand('R', center, rotation, offset, pose.cupReach);
      this.attach(this.cup, 'R', offset); this.cup.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2); this.cup.visible = pose.holdingCup;
      const level = this.cup.getObjectByName('pill-water-level')!;
      const sip = pillEase(time, 6.8, 7.7); level.scale.y = 1 - sip * .55; level.position.y = -.04 - sip * .08;
    }
  }
  dispose(): void {
    this.red.removeFromParent(); this.blue.removeFromParent(); this.cup.removeFromParent();
    this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose());
  }
}
