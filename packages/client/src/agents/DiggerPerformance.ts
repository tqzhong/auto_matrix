import * as THREE from 'three';
import { diggerLauncher, diggerLoaderPose, diggersLocked, type DiggerGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

export class DiggerProps {
  readonly group = new THREE.Group();
  readonly gun = new THREE.Group();
  readonly belt = new THREE.Group();
  readonly rounds = new THREE.Group();
  private geometry: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  constructor(parent: THREE.Group) {
    this.group.name = 'infantry-launcher-props'; parent.add(this.group); this.group.add(this.gun, this.rounds, this.belt);
    this.belt.name = 'charra-support-belt'; this.belt.visible = false;
    this.gun.name = 'charra-double-launcher'; this.rounds.name = 'zee-loading-rockets';
    const steel = new THREE.MeshStandardMaterial({ color: 0x657070, metalness: .72, roughness: .45 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x182322, metalness: .6, roughness: .75 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xa49167, metalness: .7, roughness: .5 }); this.materials.push(steel, dark, brass);
    const beltGeometry = new THREE.TorusGeometry(.41, .07, 6, 28); this.geometry.push(beltGeometry);
    const belt = new THREE.Mesh(beltGeometry, dark); belt.rotation.x = Math.PI / 2; belt.scale.y = .68; this.belt.add(belt);
    for (const x of [-.21, .21]) {
      this.sleeve(steel, .195, 2.6, x, .25).name = 'launcher-open-barrel';
      for (const z of [-1.06, -.4, .6, 1.46]) this.sleeve(brass, .212, .085, x, z);
      this.tube(brass, .145, .65, x, 0, 0, this.rounds);
      this.tube(dark, .16, .06, x, 0, -.28, this.rounds);
    }
    const grip = new THREE.BoxGeometry(.14, .34, .18); this.geometry.push(grip);
    for (const z of [-.12, .85]) { const handle = new THREE.Mesh(grip, dark); handle.position.set(.05, -.3, z); this.gun.add(handle); }
    const sight = new THREE.Mesh(new THREE.TorusGeometry(.08, .025, 8, 16), dark); sight.position.set(.21, .31, .9); this.gun.add(sight); this.geometry.push(sight.geometry);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(.5, .13, .6), dark); pad.position.set(0, -.2, -.5); this.gun.add(pad); this.geometry.push(pad.geometry);
  }
  private tube(material: THREE.Material, radius: number, length: number, x: number, y: number, z: number, parent: THREE.Group): void {
    const geometry = new THREE.CylinderGeometry(radius, radius, length, 20); this.geometry.push(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.rotation.x = Math.PI / 2; mesh.castShadow = true; parent.add(mesh);
  }
  private sleeve(material: THREE.Material, radius: number, length: number, x: number, z: number): THREE.Mesh {
    const section = [[.17, -length / 2], [radius, -length / 2], [radius, length / 2], [.17, length / 2], [.17, -length / 2]];
    const geometry = new THREE.LatheGeometry(section.map(([r, y]) => new THREE.Vector2(r, y)), 24); this.geometry.push(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.rotation.x = Math.PI / 2; mesh.position.set(x, 0, z); mesh.castShadow = true;
    this.gun.add(mesh); return mesh;
  }
  dispose(): void { this.group.removeFromParent(); this.geometry.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); }
}

export function poseDiggers(rig: CharacterRig, gesture?: DiggerGesture): void {
  const props = rig.diggerProps; if (!props) return;
  props.group.visible = Boolean(gesture); if (!gesture || rig.hero) return;
  props.belt.visible = false;
  const posed = diggersLocked(gesture), loading = gesture.phase === 'loading', loader = diggerLoaderPose(gesture);
  const preparing = loading && !loader.ready, carrying = gesture.role === 'zee' && (preparing || !posed && gesture.phase !== 'done');
  props.gun.visible = gesture.role === 'charra'; props.rounds.visible = gesture.role === 'zee' && gesture.rounds >= 2 && (carrying || loading && gesture.load < .99);
  const gun = diggerLauncher(gesture);
  const brace = posed ? preparing ? loader.brace : 1 : 0;
  props.gun.position.set(gun.x, THREE.MathUtils.lerp(2.45, gun.y, brace), gun.z); props.gun.rotation.set(THREE.MathUtils.lerp(.45, gun.pitch, brace), 0, 0);
  if (!posed && gesture.role === 'zee' && !carrying) return;
  if (posed) {
    rig.detail.position.set(0, 0, 0); rig.detail.rotation.set(0, 0, 0);
    rig.torso.position.set(0, 1.91, 0); rig.torso.rotation.set(0, 0, 0); rig.head.rotation.set(gesture.role === 'charra' ? gun.pitch * .45 : .13, 0, 0);
  }
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const lift = THREE.MathUtils.smoothstep(gesture.load, .05, .4), load = THREE.MathUtils.smoothstep(gesture.load, .4, .8);
  // Align both rounds with the open breeches before pushing them inside.
  const breech = new THREE.Vector3(0, 0, -.55 - 1.2 * (1 - load)).applyEuler(new THREE.Euler(gun.pitch, 0, 0));
  const rounds = new THREE.Vector3(gun.x, gun.y, 1.95 + gun.z).add(breech);
  rounds.y -= (1 - lift) * 1.1;
  if (carrying) {
    const raise = preparing ? loader.brace : 0;
    rounds.lerp(new THREE.Vector3(-.25, 2.15, .55), 1 - raise);
  }
  props.rounds.position.copy(rounds); props.rounds.rotation.x = gun.pitch;
  // A raised launcher lowers its rear breeches. Zee bends to the carried
  // rounds instead of stretching straight arms beyond the contact solver.
  const hipHeight = gesture.role === 'zee' && loading && !preparing ? Math.max(1.2, Math.min(1.91, rounds.y + .95 - 1.39)) : 1.91;
  if (posed) rig.torso.position.y = hipHeight;
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1;
    if (posed) {
      rig.hips[i].position.set(side * .225, hipHeight, 0); rig.hips[i].rotation.set(0, 0, 0); rig.knees[i].rotation.set(0, 0, 0);
      const stride = gesture.role === 'zee' && preparing && loader.walk ? Math.sin(gesture.loader!.elapsed * 8 + i * Math.PI) : 0;
      const foot = new THREE.Vector3(side * .3, .155 + Math.max(0, -stride) * .18, (i ? -.2 : .2) + stride * .35);
      rig.root.updateWorldMatrix(true, true);
      reach(rig.hips[i], rig.knees[i], rig.ankles[i].position, rig.root.localToWorld(foot), new THREE.Vector3(0, .1, 1).applyQuaternion(rotation));
      rig.ankles[i].quaternion.copy(rig.knees[i].getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
    }
    let hand: THREE.Vector3;
    if (gesture.role === 'charra') {
      props.gun.updateWorldMatrix(true, true);
      hand = props.gun.localToWorld(new THREE.Vector3(.05, -.31, i ? .85 : -.12));
    } else if (loading || carrying) {
      hand = rounds.clone().add(new THREE.Vector3(side * .21, -.12, -.2));
      if (loading && !preparing) hand.lerp(new THREE.Vector3(side * .42, 2.15, .4), THREE.MathUtils.smoothstep(gesture.load, .82, 1));
      rig.root.localToWorld(hand);
    } else hand = rig.root.localToWorld(new THREE.Vector3(side * .42, 2.15, .4));
    rig.root.updateWorldMatrix(true, true);
    reach(rig.shoulders[i], rig.elbows[i], new THREE.Vector3(0, -.79, .055), hand, new THREE.Vector3(side * .7, -.55, -.3).applyQuaternion(rotation));
    rig.fingers[i].forEach(finger => { finger.rotation.x = -.8; });
  }
  rig.root.updateWorldMatrix(true, true);
}
