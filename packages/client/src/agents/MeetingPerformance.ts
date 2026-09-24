import * as THREE from 'three';
import { FILM_SETS, meetingCarPose, meetingCarPoint, meetingPose, type MeetingGesture } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';

export class MeetingPerformance {
  private car = meetingCarPose();
  private scanner = new THREE.Group();
  private piston = new THREE.Group();
  private bug = new THREE.Group();
  private gun = new THREE.Group();
  private screen: THREE.MeshBasicMaterial;
  private shirt = { value: 0 };
  private coveredShoulders = { value: 0 };
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  constructor(private rig: HeroRig) {
    const metal = new THREE.MeshStandardMaterial({ color: 0x8a9b94, roughness: .26, metalness: .9 });
    const black = new THREE.MeshStandardMaterial({ color: 0x111916, roughness: .56, metalness: .3 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xadbcaa, transparent: true, opacity: .22, depthWrite: false, roughness: .06, side: THREE.DoubleSide });
    const circuit = new THREE.MeshStandardMaterial({ color: 0x224b32, roughness: .53, metalness: .2 });
    this.screen = new THREE.MeshBasicMaterial({ color: 0x517f57 });
    const tube = (parent: THREE.Group, x: number, y: number, z: number, r: number, h: number, material: THREE.Material) => this.mesh(parent, new THREE.CylinderGeometry(r, r, h, 24), material, x, y, z);
    tube(this.scanner, 0, .045, 0, .22, .09, black);
    tube(this.scanner, 0, .38, 0, .18, .57, glass);
    for (const y of [.11, .67]) tube(this.scanner, 0, y, 0, .21, .055, metal);
    for (const x of [-.37, .37]) tube(this.scanner, x, .45, 0, .034, .75, metal);
    this.box(this.scanner, 0, .86, 0, .83, .08, .13, metal);
    this.box(this.scanner, -.51, .68, -.02, .36, .42, .09, circuit);
    this.box(this.scanner, -.51, .75, -.077, .24, .19, .024, black);
    this.box(this.scanner, -.51, .75, -.093, .19, .16, .009, this.screen);
    for (let i = 0; i < 6; i++) this.box(this.scanner, -.6 + i % 3 * .09, .59 - Math.floor(i / 3) * .09, -.081, .04, .055, .025, metal);
    for (const x of [-.31, .31]) this.box(this.scanner, x, .75, 0, .09, .14, .14, black);
    this.scanner.add(this.piston); tube(this.piston, 0, .63, 0, .035, .47, metal);
    this.box(this.piston, 0, .86, 0, .52, .09, .12, black);
    for (let i = 0; i < 7; i++) {
      const segment = this.mesh(this.bug, new THREE.SphereGeometry(.07 - Math.abs(i - 3) * .008, 12, 8), i % 2 ? metal : black, 0, (i - 3) * .07, 0); segment.scale.set(.75, 1, .65);
      if (i > 0 && i < 6) for (const side of [-1, 1]) {
        const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(side * .03, (i - 3) * .07, 0), new THREE.Vector3(side * .12, (i - 3) * .07 + .025, .015), new THREE.Vector3(side * .08, (i - 3) * .07 - .055, .04)]);
        this.mesh(this.bug, new THREE.TubeGeometry(curve, 8, .009, 5), metal);
      }
    }
    this.scanner.name = 'extraction-scanner'; this.bug.name = 'extracted-tracker'; this.piston.name = 'scanner-pump';
    rig.root.add(this.scanner, this.bug);
    this.box(this.gun, 0, 0, .14, .1, .12, .45, metal);
    const grip = this.box(this.gun, 0, -.13, 0, .1, .22, .13, black); grip.rotation.x = -.2;
    rig.bones.get('wrist_R')!.add(this.gun); this.gun.position.set(.07, -.18, .07); this.gun.rotation.x = -Math.PI / 2;
    this.gun.name = 'switch-warning-pistol';
    for (const part of rig.wardrobe) if (/Black.crew.neck/i.test(part.mesh.name)) {
      // The shipped crew neck ends above the trousers; tuck the full hem until the scanner lifts its front.
      const geometry = part.mesh.geometry;
      if (!geometry.getAttribute('_meetingShirtLift')) {
        const position = geometry.getAttribute('position'); const lift = new Float32Array(position.count); const tuck = new Float32Array(position.count);
        for (let i = 0; i < position.count; i++) {
          tuck[i] = (1 - THREE.MathUtils.smoothstep(position.getY(i), 3, 3.6)) * (1 - THREE.MathUtils.smoothstep(Math.abs(position.getX(i)), .5, .65));
          lift[i] = tuck[i] * THREE.MathUtils.smoothstep(position.getZ(i), -.12, .06);
        }
        geometry.setAttribute('_meetingShirtLift', new THREE.BufferAttribute(lift, 1));
        geometry.setAttribute('_meetingShirtTuck', new THREE.BufferAttribute(tuck, 1));
      }
      const material = part.mesh.material as THREE.MeshStandardMaterial; const source = material.onBeforeCompile; const cache = material.customProgramCacheKey();
      material.onBeforeCompile = (shader, renderer) => {
        source(shader, renderer); shader.uniforms.meetingShirt = this.shirt;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float meetingShirt;\nattribute float _meetingShirtTuck;\nattribute float _meetingShirtLift;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            transformed.y += _meetingShirtTuck * -0.4 + _meetingShirtLift * meetingShirt * 0.48;`);
      };
      material.customProgramCacheKey = () => cache + '-meeting-shirt-v3'; material.needsUpdate = true;
    }
    for (const part of rig.wardrobe) if ((part.mesh.material as THREE.Material).name === 'Skin') {
      const material = part.mesh.material as THREE.MeshStandardMaterial; const source = material.onBeforeCompile; const cache = material.customProgramCacheKey();
      material.onBeforeCompile = (shader, renderer) => {
        source(shader, renderer); shader.uniforms.meetingCoveredShoulders = this.coveredShoulders;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMeetingSkin;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvMeetingSkin = position;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float meetingCoveredShoulders;\nvarying vec3 vMeetingSkin;')
          .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (meetingCoveredShoulders > 0.5 && vMeetingSkin.y > 2.6 && vMeetingSkin.y < 3.68 && abs(vMeetingSkin.x) > 0.24) discard;');
      };
      material.customProgramCacheKey = () => cache + '-meeting-under-jacket'; material.needsUpdate = true;
    }
  }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
    this.geometries.add(geometry); this.materials.add(material); const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material): THREE.Mesh {
    return this.mesh(parent, new THREE.BoxGeometry(w, h, d), material, x, y, z);
  }
  private point(x: number, y: number, z: number): THREE.Vector3 {
    const center = FILM_SETS.film_adams_bridge.center;
    const point = meetingCarPoint(this.car, x, z);
    return this.rig.root.worldToLocal(new THREE.Vector3(center.x + point.x, center.y - 1 + y, center.z + point.z));
  }
  private hand(side: 'R' | 'L', target: THREE.Vector3, grip = .65, worldOrientation?: THREE.Quaternion): void {
    const root = this.rig.root; root.updateWorldMatrix(true, true);
    const upper = this.rig.bones.get('shoulder_' + side)!; const lower = this.rig.bones.get('elbow_' + side)!; const end = this.rig.bones.get('wrist_' + side)!;
    const rotation = root.getWorldQuaternion(new THREE.Quaternion());
    const offset = new THREE.Vector3(side === 'R' ? .06 : -.06, -.17, .015);
    const wristRotation = worldOrientation ? rotation.clone().invert().multiply(worldOrientation) : new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, side === 'R' ? -.3 : .3));
    target = root.localToWorld(target.clone().sub(offset.applyQuaternion(wristRotation)));
    const start = upper.getWorldPosition(new THREE.Vector3()); const direction = target.clone().sub(start);
    const a = lower.position.length(); const b = end.position.length(); const length = THREE.MathUtils.clamp(direction.length(), .02, a + b - .001); direction.normalize();
    const along = (a * a - b * b + length * length) / (2 * length);
    const pole = new THREE.Vector3(side === 'L' ? .6 : -.6, -.65, -.1).applyQuaternion(rotation); pole.addScaledVector(direction, -pole.dot(direction)).normalize();
    const hinge = start.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
    const aim = (joint: THREE.Bone, child: THREE.Bone, point: THREE.Vector3) => {
      joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), joint.parent!.worldToLocal(point.clone()).sub(joint.position).normalize()); joint.updateWorldMatrix(false, true);
    };
    aim(upper, lower, hinge); aim(lower, end, start.addScaledVector(direction, length));
    end.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation).multiply(wristRotation));
    for (let f = 1; f <= 5; f++) for (let s = 1; s <= 3; s++) this.rig.bones.get(`finger${f}-${s}_${side}`)!.rotation.set(f === 1 ? grip * .5 : 0, 0, (side === 'R' ? 1 : -1) * grip * (f === 1 ? .2 : .9));
  }
  update(gesture?: MeetingGesture): void {
    this.scanner.visible = this.bug.visible = this.gun.visible = false; this.shirt.value = 0; this.coveredShoulders.value = 0;
    if (!gesture) return;
    this.car = meetingCarPose(gesture);
    const pose = meetingPose(gesture); const neo = gesture.role === 'neo'; const trinity = gesture.role === 'trinity';
    this.coveredShoulders.value = trinity || gesture.role === 'switch' ? 1 : 0;
    const bone = (name: string) => this.rig.bones.get(name)!; const pelvis = bone('pelvis');
    pelvis.position.copy(this.rig.rest.get('pelvis')!); pelvis.position.y = THREE.MathUtils.lerp(pelvis.position.y, 1.58, pose.seat) - pose.duck * .4;
    pelvis.rotation.set(0, 0, 0);
    pelvis.position.x -= trinity ? pose.probe * .9 : 0;
    if (trinity) pelvis.position.y += pose.probe * .09;
    bone('spine').rotation.set(neo ? -.3 * pose.recline + pose.duck * .7 : trinity ? .08 * pose.probe + .3 * pose.discard : 0, 0, trinity ? .25 * pose.probe : 0);
    bone('chest').rotation.set(neo ? -.12 * pose.recline + pose.duck * .2 : .03, trinity ? -.75 * pose.probe : gesture.role === 'switch' ? -1.3 * pose.alert : 0, trinity ? .08 * pose.probe : 0);
    bone('head').rotation.set(neo ? .15 * pose.recline - pose.duck * .3 : trinity ? .12 * pose.probe : 0, trinity ? -.35 * pose.probe : gesture.role === 'switch' ? -1 * pose.alert : 0, 0);
    for (const [i, side] of ['R', 'L'].entries()) {
      bone('hip_' + side).rotation.set(-1.35 * pose.seat - pose.duck * .3, 0, 0);
      bone('knee_' + side).rotation.set(1.52 * pose.seat + pose.duck * .5, 0, 0);
      bone('ankle_' + side).rotation.set(-.17 * pose.seat, 0, 0);
      bone('shoulder_' + side).rotation.set(-.36, 0, i ? .06 : -.06); bone('elbow_' + side).rotation.set(-1, 0, 0);
    }
    this.rig.root.updateWorldMatrix(true, true); this.rig.glasses.visible = false;
    if (neo) {
      this.shirt.value = pose.recline;
      for (const side of ['R', 'L'] as const) this.hand(side, new THREE.Vector3(side === 'R' ? -.46 : .46, 1.8 + pose.recline * .65, .4), .25);
    }
    if (gesture.role === 'apoc') for (const side of ['R', 'L'] as const) this.hand(side, this.point(-1.28 + (side === 'R' ? .4 : -.4), 2.55, -2.77));
    if (gesture.role === 'switch') {
      this.gun.visible = pose.alert > .1;
      if (this.gun.visible) this.hand('R', this.point(.92, 2.78, -.35));
    }
    if (trinity && ['done', 'driving', 'parked', 'exiting', 'outside'].includes(gesture.phase)) {
      for (const side of ['R', 'L'] as const) this.hand(side, new THREE.Vector3((side === 'R' ? -1 : 1) * (.42 + (1 - pose.seat) * .1), 1.75 + (1 - pose.seat) * .2, .55 * pose.seat), .15);
    } else if (trinity) {
      this.scanner.visible = gesture.phase !== 'done';
      const center = new THREE.Vector3(-.6, 1.82, 1.05).lerp(new THREE.Vector3(1.02, 2.15, 1.38), pose.probe);
      center.lerp(new THREE.Vector3(-2.45, 3, .3), pose.discard);
      this.scanner.position.copy(this.point(center.x, center.y, center.z));
      const worldRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -pose.discard * Math.PI / 2));
      this.scanner.quaternion.copy(this.rig.root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(worldRotation));
      this.piston.position.y = pose.pump * .12;
      this.scanner.updateWorldMatrix(true, true);
      for (const [side, offset] of [['R', new THREE.Vector3(-.2, .86 + this.piston.position.y, 0)], ['L', new THREE.Vector3(-.31, .75, 0)]] as const) {
        const x = side === 'R' ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(-1, 0, 0); const y = new THREE.Vector3(0, 0, 1);
        const grip = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, x.clone().cross(y)));
        this.hand(side, this.rig.root.worldToLocal(this.scanner.localToWorld(offset.clone())), .95, worldRotation.clone().multiply(grip));
      }
      this.bug.visible = gesture.bugged && (gesture.phase === 'removing' && pose.extraction > .04 || gesture.phase === 'discarding');
      this.bug.position.copy(this.rig.root.worldToLocal(this.scanner.localToWorld(new THREE.Vector3(0, .05 + pose.extraction * .35, 0))));
      this.bug.quaternion.copy(this.scanner.quaternion); this.bug.rotation.y += Math.sin(gesture.elapsed * 11) * .25;
      this.bug.scale.setScalar(Math.min(1, pose.extraction * 3));
      if (pose.ejected) { const time = gesture.elapsed - 3.2; this.bug.position.copy(this.point(-2.8 - time * 3.5, 3 - time * time * 2.6, .3 - time)); this.bug.rotation.x = time * 9; }
      this.screen.color.setHex(gesture.bugged && ['located', 'removing'].includes(gesture.phase) ? 0xb2c46a : 0x548263);
    }
    this.rig.root.updateWorldMatrix(true, true);
  }
  dispose(): void { this.scanner.removeFromParent(); this.bug.removeFromParent(); this.gun.removeFromParent(); this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); }
}
