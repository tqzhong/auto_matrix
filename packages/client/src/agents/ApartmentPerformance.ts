import * as THREE from 'three';
import { FILM_SETS, apartmentAfter, apartmentDoor, type ApartmentGesture } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';

export class ApartmentPerformance {
  private disk = new THREE.Group();
  private cash = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private tattoo?: THREE.CanvasTexture;
  constructor(private rig: HeroRig) {
    const silver = new THREE.MeshStandardMaterial({ color: 0xb0b6b3, metalness: .88, roughness: .18 });
    const hole = new THREE.MeshStandardMaterial({ color: 0x343b31, roughness: .9 });
    this.mesh(this.disk, new THREE.CylinderGeometry(.46, .46, .02, 48), silver);
    this.mesh(this.disk, new THREE.CylinderGeometry(.085, .085, .024, 16), hole);
    const money = new THREE.MeshStandardMaterial({ color: 0x8b9677, roughness: .95 });
    this.mesh(this.cash, new THREE.BoxGeometry(.78, .055, .34), money);
    this.mesh(this.cash, new THREE.BoxGeometry(.17, .06, .35), new THREE.MeshStandardMaterial({ color: 0xc4bfa5, roughness: .98 }));
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
  private hand(side: 'R' | 'L', point: THREE.Vector3, blend: number, typing = false): void {
    if (blend <= 0) return;
    const root = this.rig.root; root.updateWorldMatrix(true, true);
    const upper = this.bone('shoulder_' + side); const lower = this.bone('elbow_' + side); const wrist = this.bone('wrist_' + side);
    const rotation = root.getWorldQuaternion(new THREE.Quaternion());
    const palm = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, typing ? 0 : side === 'R' ? Math.PI / 2 : -Math.PI / 2));
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
  update(gesture?: ApartmentGesture): void {
    this.disk.visible = this.cash.visible = false; if (!gesture) return;
    const { role, phase, elapsed: t } = gesture; const root = this.rig.root;
    const smooth = THREE.MathUtils.smoothstep;
    if (role === 'neo' && ['signal', 'reply', 'knocking'].includes(phase)) {
      const pelvis = this.bone('pelvis'); pelvis.position.copy(this.rig.rest.get('pelvis')!); pelvis.position.y = 1.72;
      for (const side of ['R', 'L']) {
        this.bone('hip_' + side).rotation.set(-1.3, 0, 0); this.bone('knee_' + side).rotation.set(1.42, 0, 0); this.bone('ankle_' + side).rotation.set(-.12, 0, 0);
      }
      this.bone('spine').rotation.x += .12; this.bone('chest').rotation.x += .18; this.bone('head').rotation.x += .12;
      root.updateWorldMatrix(true, true);
      for (const side of ['R', 'L'] as const) this.hand(side, this.local(-9 + (side === 'R' ? .6 : -.6), 2.65 + (phase === 'knocking' && t < .6 ? Math.sin(t * 28) * .025 : 0), -10.5), 1, true);
    } else if (role === 'neo' && phase === 'opening') {
      const angle = apartmentDoor(gesture) * 1.42; const hold = smooth(t, 0, .3) * (1 - smooth(t, 1.1, 1.6));
      this.bone('chest').rotation.y -= angle * .12;
      root.updateWorldMatrix(true, true); this.hand('L', this.local(-1.9 + Math.cos(angle) * 3.3 - Math.sin(angle) * .26, 2.85, 12 - Math.sin(angle) * 3.3 - Math.cos(angle) * .26), hold);
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
      this.hand('R', this.local(-.35, 2.9, 11.65), hold);
      this.hand('L', this.local(.4, 2.82, 11.65), hold);
      root.updateWorldMatrix(true, true);
      if (role === (t < 2.3 ? 'neo' : 'choi')) { this.disk.visible = true; this.disk.position.copy(root.worldToLocal(this.bone('wrist_R').localToWorld(new THREE.Vector3(.065, -.17, .01)))); }
      if (role === (t < 2.3 ? 'choi' : 'neo')) { this.cash.visible = true; this.cash.position.copy(root.worldToLocal(this.bone('wrist_L').localToWorld(new THREE.Vector3(-.065, -.17, .01)))); }
    } else if (role === 'choi' && apartmentAfter(gesture, 'invitation')) this.bone('head').rotation.y -= .24;
    root.updateWorldMatrix(true, true);
  }
  dispose(): void { this.disk.removeFromParent(); this.cash.removeFromParent(); this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.tattoo?.dispose(); }
}
