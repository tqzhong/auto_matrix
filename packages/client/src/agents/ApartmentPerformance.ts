import * as THREE from 'three';
import { FILM_SETS, APARTMENT_BOOK, APARTMENT_NETWORK, computerCheckLocked, computerNetworkPull, apartmentAfter, apartmentDoor, apartmentComputerPose, apartmentBookCrouch, type ApartmentGesture, type ComputerInvestigation } from '@auto_matrix/shared';
import { apartmentDisc } from './ApartmentDisc.js';
import type { HeroRig } from './HeroModel.js';

export class ApartmentPerformance {
  private disk = apartmentDisc();
  private cash = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private tattoo?: THREE.CanvasTexture;
  constructor(private rig: HeroRig) {
    this.disk.name = 'apartment-held-disc'; this.cash.name = 'apartment-held-cash';
    this.disk.traverse(object => { if (object instanceof THREE.Mesh) { this.geometries.add(object.geometry); this.materials.add(object.material as THREE.Material); } });
    const money = new THREE.MeshStandardMaterial({ color: 0x8b9677, roughness: .95 });
    this.mesh(this.cash, new THREE.BoxGeometry(.36, .04, .18), money);
    this.mesh(this.cash, new THREE.BoxGeometry(.08, .045, .19), new THREE.MeshStandardMaterial({ color: 0xc4bfa5, roughness: .98 }));
    rig.root.add(this.disk, this.cash);
    if (rig.apartmentRole === 'dujour') {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#d4d0bf'; ctx.strokeStyle = '#555a4e'; ctx.lineWidth = 7;
      const oval = (x: number, y: number, rx: number, ry: number, angle: number) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); };
      oval(162, 173, 20, 12, -.2); oval(96, 158, 57, 39, -.25); oval(172, 103, 26, 28, -.25);
      oval(162, 60, 9, 35, -.32); oval(185, 63, 9, 33, .22); oval(45, 154, 15, 14, 0); oval(79, 187, 30, 9, -.1);
      ctx.fillStyle = '#363d33'; ctx.beginPath(); ctx.arc(180, 98, 4, 0, Math.PI * 2); ctx.fill();
      this.tattoo = new THREE.CanvasTexture(canvas); this.tattoo.colorSpace = THREE.SRGBColorSpace;
      rig.root.traverse(object => {
        if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial) || object.material.name !== 'Skin') return;
        const mat = object.material; const previous = mat.onBeforeCompile;
        mat.onBeforeCompile = (shader, renderer) => {
          previous(shader, renderer); shader.uniforms.rabbitTattoo = { value: this.tattoo };
          shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 rabbitSurface;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nrabbitSurface = position;');
          shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D rabbitTattoo;\nvarying vec3 rabbitSurface;')
            .replace('#include <map_fragment>', `#include <map_fragment>
              vec2 rabbitUv = vec2((rabbitSurface.x - 0.12) / 0.28, (rabbitSurface.y - 3.29) / 0.22);
              if (rabbitSurface.z < -0.03 && rabbitUv.x > 0.0 && rabbitUv.x < 1.0 && rabbitUv.y > 0.0 && rabbitUv.y < 1.0) {
                vec4 ink = texture2D(rabbitTattoo, rabbitUv);
                diffuseColor.rgb = mix(diffuseColor.rgb, ink.rgb, ink.a * 0.84);
              }`);
        };
        mat.customProgramCacheKey = () => 'dujour-shoulder-rabbit-v1'; mat.needsUpdate = true;
      });
    }
  }
  private mesh(parent: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material) {
    this.geometries.add(geo); this.materials.add(mat); const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; parent.add(mesh); return mesh;
  }
  private bone(name: string) { return this.rig.bones.get(name)!; }
  private local(x: number, y: number, z: number) {
    const center = FILM_SETS.film_anderson_flat.center;
    return this.rig.root.worldToLocal(new THREE.Vector3(center.x + x, center.y - 1 + y, center.z + z));
  }
  private hand(side: 'R' | 'L', point: THREE.Vector3, blend: number, typing = false, tilt = 0): void {
    if (blend <= 0) return;
    const root = this.rig.root; root.updateWorldMatrix(true, true);
    const upper = this.bone('shoulder_' + side); const lower = this.bone('elbow_' + side); const wrist = this.bone('wrist_' + side);
    const rotation = root.getWorldQuaternion(new THREE.Quaternion());
    const palm = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, typing ? 0 : side === 'R' ? Math.PI / 2 : -Math.PI / 2));
    if (tilt) palm.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, tilt)));
    const desired = rotation.clone().invert().multiply(wrist.getWorldQuaternion(new THREE.Quaternion())).slerp(palm, blend);
    const offset = new THREE.Vector3(side === 'R' ? .065 : -.065, -.17, .01);
    const target = root.worldToLocal(wrist.localToWorld(offset.clone())).lerp(point, blend).sub(offset.clone().applyQuaternion(desired)); root.localToWorld(target);
    const start = upper.getWorldPosition(new THREE.Vector3()); const direction = target.clone().sub(start);
    const a = lower.position.length(); const b = wrist.position.length(); const length = THREE.MathUtils.clamp(direction.length(), .02, a + b - .001); direction.normalize();
    const along = (a * a - b * b + length * length) / (2 * length);
    const pole = new THREE.Vector3(side === 'R' ? -.45 : .45, -.6, -.2).applyQuaternion(rotation); pole.addScaledVector(direction, -pole.dot(direction)).normalize();
    const hinge = start.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
    const aim = (joint: THREE.Bone, child: THREE.Bone, target: THREE.Vector3) => {
      joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), joint.parent!.worldToLocal(target.clone()).sub(joint.position).normalize()); joint.updateWorldMatrix(false, true);
    };
    aim(upper, lower, hinge); aim(lower, wrist, start.addScaledVector(direction, length));
    wrist.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation).multiply(desired));
    for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) this.bone(`finger${finger}-${segment}_${side}`).rotation.z = (side === 'R' ? 1 : -1) * (typing ? .06 : .28) * blend;
  }
  private feet(seated: number, contacts?: Record<'R' | 'L', { x: number; z: number; yaw: number; lift: number }>): void {
    const root = this.rig.root; root.updateWorldMatrix(true, true);
    const rotation = root.getWorldQuaternion(new THREE.Quaternion());
    const forward = new THREE.Vector3(0, 0, 1.2 * seated).applyQuaternion(rotation);
    const floor = root.getWorldPosition(new THREE.Vector3()).y + this.rig.footHeight + .015;
    for (const side of ['R', 'L'] as const) {
      const hip = this.bone('hip_' + side), knee = this.bone('knee_' + side), ankle = this.bone('ankle_' + side);
      const foot = contacts?.[side];
      const start = hip.getWorldPosition(new THREE.Vector3()), target = foot ? this.local(foot.x, floor + foot.lift, foot.z) : start.clone().add(forward);
      if (foot) root.localToWorld(target); else target.y = floor;
      const direction = target.clone().sub(start), a = knee.position.length(), b = ankle.position.length();
      const length = THREE.MathUtils.clamp(direction.length(), .02, a + b - .002); direction.normalize();
      const along = (a * a - b * b + length * length) / (2 * length);
      const pole = new THREE.Vector3(0, .1, 1).applyQuaternion(rotation); pole.addScaledVector(direction, -pole.dot(direction)).normalize();
      const hinge = start.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
      const aim = (joint: THREE.Bone, child: THREE.Bone, point: THREE.Vector3) => {
        joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), joint.parent!.worldToLocal(point.clone()).sub(joint.position).normalize()); joint.updateWorldMatrix(false, true);
      };
      aim(hip, knee, hinge); aim(knee, ankle, start.addScaledVector(direction, length));
      const heading = foot ? new THREE.Quaternion().setFromEuler(new THREE.Euler(0, foot.yaw, 0)) : rotation;
      ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(heading)); ankle.updateWorldMatrix(false, true);
    }
  }
  update(gesture?: ApartmentGesture, check?: ComputerInvestigation): void {
    this.disk.visible = this.cash.visible = false;
    if (computerCheckLocked(check)) {
      const t = check!.elapsed, pull = computerNetworkPull(check);
      const hold = THREE.MathUtils.smoothstep(t, .1, .45) * (1 - THREE.MathUtils.smoothstep(t, 1.2, APARTMENT_NETWORK.seconds));
      const clearance = 1 - THREE.MathUtils.smoothstep(t, .35, .5) + THREE.MathUtils.smoothstep(t, 1.12, 1.38);
      this.bone('spine').rotation.x += .04 * hold; this.bone('chest').rotation.x += .06 * hold; this.bone('head').rotation.x += .15 * hold;
      this.rig.root.updateWorldMatrix(true, true);
      this.hand('R', this.local(APARTMENT_NETWORK.plug.x, APARTMENT_NETWORK.plug.y - .16 * pull + APARTMENT_NETWORK.gripHeight + .32 * clearance, APARTMENT_NETWORK.plug.z + .31 * pull + .38 * clearance), hold, true);
      return;
    }
    if (!gesture) return;
    const { role, phase, elapsed: t } = gesture; const root = this.rig.root;
    const smooth = THREE.MathUtils.smoothstep;
    const cartridge = gesture.propMotion === 'minidisc';
    const ownsDisk = cartridge && (role === 'neo' && (phase === 'retrieving' && t >= APARTMENT_BOOK.pickup || phase === 'disk' || phase === 'handover' && t < 2.3)
      || role === 'choi' && (phase === 'handover' && t >= 2.3 || apartmentAfter(gesture, 'invitation')));
    const diskSide = role === 'choi' ? 'L' : 'R', cashSide = role === 'choi' ? 'R' : 'L';
    if (ownsDisk && phase !== 'retrieving') this.hand(diskSide, new THREE.Vector3(diskSide === 'R' ? -.5 : .5, 2.5, .38), 1, true);
    if (role === 'neo' && ['signal', 'reply', 'knocking'].includes(phase)) {
      const pose = apartmentComputerPose(gesture), { seated, walking } = pose;
      const pelvis = this.bone('pelvis'); pelvis.position.copy(this.rig.rest.get('pelvis')!); pelvis.position.y = THREE.MathUtils.lerp(pelvis.position.y - .25 * walking, pose.feet ? 1.65 : 1.6, seated);
      if (pose.feet) {
        pelvis.rotation.set(0, 0, 0);
        this.bone('spine').rotation.set(.12 * walking, 0, 0); this.bone('chest').rotation.set(.08 * walking, 0, 0); this.bone('head').rotation.set(-.12 * walking, .35 * walking, 0);
        for (const side of ['R', 'L']) {
          this.bone('shoulder_' + side).rotation.set(.2, 0, side === 'R' ? -.045 : .045);
          this.bone('elbow_' + side).rotation.x = -.35;
        }
      }
      this.feet(seated, pose.feet);
      this.bone('spine').rotation.x += .16 * seated; this.bone('chest').rotation.x += .2 * seated; this.bone('head').rotation.x += .12 * seated;
      root.updateWorldMatrix(true, true);
      for (const side of ['R', 'L'] as const) this.hand(side, this.local(-9 + (side === 'R' ? .6 : -.6), 2.65 + .45 * Math.sin(Math.PI * seated) + (phase === 'knocking' && t < .6 ? Math.sin(t * 28) * .025 : 0), -10.49 + .6 * (1 - seated)), seated, true);
    } else if (role === 'neo' && phase === 'opening') {
      const angle = apartmentDoor(gesture) * 1.42; const hold = smooth(t, 0, .3) * (1 - smooth(t, 1.1, 1.6));
      this.bone('chest').rotation.y -= angle * .12;
      root.updateWorldMatrix(true, true); this.hand('L', this.local(-1.9 + Math.cos(angle) * 3.3 - Math.sin(angle) * .26, 2.85, 12 - Math.sin(angle) * 3.3 - Math.cos(angle) * .26), hold);
    } else if (role === 'neo' && phase === 'retrieving' && cartridge) {
      const crouch = apartmentBookCrouch(gesture), pelvis = this.bone('pelvis');
      pelvis.position.y = THREE.MathUtils.lerp(pelvis.position.y, .88, crouch); pelvis.position.z += .15 * crouch;
      pelvis.rotation.set(0, 0, 0); this.bone('spine').rotation.x += 1.5 * crouch; this.bone('chest').rotation.x += .12 * crouch; this.bone('head').rotation.x += .12 * crouch;
      const approach = APARTMENT_BOOK.approach;
      this.feet(0, { R: { x: approach.x - .276, z: approach.z, yaw: 0, lift: 0 }, L: { x: approach.x + .276, z: approach.z, yaw: 0, lift: 0 } });
      const angle = smooth(Math.min(t, .8), .35, 1.35) * 2.88, size = APARTMENT_BOOK.scale, withdraw = smooth(t, .8, 1.1);
      root.updateWorldMatrix(true, true);
      this.hand('L', this.local(6 + (-.84 + .35 * Math.cos(angle)) * size - Math.sin(angle) * .21 - .4 * withdraw,
        APARTMENT_BOOK.y + (.39 + .35 * Math.sin(angle)) * size + Math.cos(angle) * .21 + .3 * withdraw, APARTMENT_BOOK.z - .3 - .45 * withdraw), smooth(t, .25, .55) * (1 - smooth(t, 1.1, 1.5)), true, angle);
      const grip = this.local(6, APARTMENT_BOOK.y + .09 * size + .17 + .45 * (1 - smooth(t, 1.75, APARTMENT_BOOK.pickup)), APARTMENT_BOOK.z);
      grip.lerp(new THREE.Vector3(-.5, 2.5, .38), smooth(t, APARTMENT_BOOK.pickup, 3.1));
      this.hand('R', grip, smooth(t, 1.35, 1.8), true);
    } else if (role === 'neo' && phase === 'retrieving') {
      const lean = smooth(t, 0, .65) * (1 - smooth(t, 2.5, 3.2));
      this.bone('spine').rotation.x += .26 * lean; this.bone('chest').rotation.x += .36 * lean; this.bone('head').rotation.x += .2 * lean;
      root.updateWorldMatrix(true, true);
      this.hand('L', this.local(5.5, 2.26, 5.45), lean);
      this.hand('R', this.local(6.2, 2.1 + smooth(t, 2.1, 2.65) * .8, 5.6 - smooth(t, 2.1, 2.65) * .6), smooth(t, 1.4, 2.2) * (1 - smooth(t, 2.8, 3.2)));
      if (t > 2.3 && t < 2.9) {
        root.updateWorldMatrix(true, true); this.disk.position.copy(root.worldToLocal(this.bone('wrist_R').localToWorld(new THREE.Vector3(.065, -.17, .01)))); this.disk.visible = true;
      }
    } else if (role === 'choi' && phase === 'knocking') {
      const tap = [1.05, 1.36, 1.68].reduce((amount, beat) => Math.max(amount, Math.max(0, 1 - Math.abs(t - beat) / .14)), 0);
      root.updateWorldMatrix(true, true); this.hand('R', this.local(-.35, 3.7, 12.25 + (1 - tap) * .16), smooth(t, .2, .8) * (1 - smooth(t, 1.9, 2.6)));
    } else if ((role === 'neo' || role === 'choi') && phase === 'handover') {
      const hold = smooth(t, .2, 1.5) * (1 - smooth(t, 3, 4));
      this.bone('spine').rotation.x += .12 * hold; this.bone('chest').rotation.x += .14 * hold;
      root.updateWorldMatrix(true, true);
      const diskGrip = new THREE.Vector3(0, .17, diskSide === 'R' ? -.125 : .125), cashGrip = new THREE.Vector3(cashSide === 'R' ? -.18 : .18, .17, 0);
      if (cartridge) this.hand(cashSide, new THREE.Vector3(cashSide === 'R' ? -.5 : .5, 2.5, .38), 1, true);
      this.hand(cartridge ? diskSide : 'R', this.local(-.35, 2.9 + (cartridge ? diskGrip.y : 0), 11.65 + (cartridge ? diskGrip.z : 0)), hold, cartridge);
      this.hand(cartridge ? cashSide : 'L', this.local(.4 + (cartridge ? cashGrip.x : 0), 2.82 + (cartridge ? cashGrip.y : 0), 11.65), hold, cartridge);
      root.updateWorldMatrix(true, true);
      if (!cartridge && role === (t < 2.3 ? 'neo' : 'choi')) { this.disk.visible = true; this.disk.position.copy(root.worldToLocal(this.bone('wrist_R').localToWorld(new THREE.Vector3(.065, -.17, .01)))); }
      if (role === (t < 2.3 ? 'choi' : 'neo')) {
        this.cash.visible = true; const side = cartridge ? cashSide : 'L';
        const position = this.bone('wrist_' + side).localToWorld(new THREE.Vector3(side === 'R' ? .065 : -.065, -.17, .01));
        if (cartridge) {
          const rotation = this.bone('wrist_' + side).getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)));
          rotation.copy(new THREE.Quaternion().slerp(rotation, smooth(t, 3, 4))); position.sub(cashGrip.clone().applyQuaternion(rotation));
          this.cash.quaternion.copy(root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
        }
        this.cash.position.copy(root.worldToLocal(position));
      }
    } else if (role === 'choi' && apartmentAfter(gesture, 'invitation')) this.bone('head').rotation.y -= .24;
    root.updateWorldMatrix(true, true);
    if (ownsDisk) {
      const heading = root.getWorldQuaternion(new THREE.Quaternion()), wrist = this.bone('wrist_' + diskSide);
      const rotation = wrist.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)));
      if (phase === 'handover') rotation.copy(new THREE.Quaternion().slerp(rotation, smooth(t, 3, 4)));
      const gripZ = (diskSide === 'R' ? -.125 : .125) * (phase === 'retrieving' ? smooth(t, APARTMENT_BOOK.pickup, 3.1) : 1);
      const position = wrist.localToWorld(new THREE.Vector3(diskSide === 'R' ? .065 : -.065, -.17, .01)).sub(new THREE.Vector3(0, .17, gripZ).applyQuaternion(rotation));
      this.disk.position.copy(root.worldToLocal(position)); this.disk.visible = true;
      this.disk.quaternion.copy(heading.invert().multiply(rotation));
    }
  }
  dispose(): void { this.disk.removeFromParent(); this.cash.removeFromParent(); this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.tattoo?.dispose(); }
}
