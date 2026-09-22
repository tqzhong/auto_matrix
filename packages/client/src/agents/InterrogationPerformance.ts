import * as THREE from 'three';
import { FILM_SETS, INTERROGATION_ROOM, interrogationPose, interrogationRoot, type InterrogationGesture } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';

const smooth = (t: number, from: number, to: number) => THREE.MathUtils.smoothstep(t, from, to);

/** Four actors use the same saved clock; props and hands follow anatomical bones. */
export class InterrogationPerformance {
  private seal = { value: 0 };
  private openShirt = { value: 0 };
  private tracker = new THREE.Group();
  private case = new THREE.Group();
  private tie = new THREE.Group();
  private legs: THREE.Group[] = [];
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  constructor(private rig: HeroRig) {
    const metal = new THREE.MeshStandardMaterial({ color: 0x728079, metalness: .86, roughness: .24 });
    const black = new THREE.MeshStandardMaterial({ color: 0x121a17, roughness: .52 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xb0c5b4, roughness: .12, transmission: .68, thickness: .025, transparent: true, opacity: .8 });
    const core = new THREE.MeshStandardMaterial({ color: 0x601e16, emissive: 0x731307, emissiveIntensity: .28, roughness: .35 });
    const shell = this.mesh(this.tracker, new THREE.LatheGeometry([[0, -.19], [.02, -.185], [.031, -.15], [.034, -.11], [.03, -.08], [.037, -.04], [.033, 0], [.032, .07], [.023, .13], [0, .19]].map(([r, z]) => new THREE.Vector2(r, z)), 24), glass); shell.rotation.x = Math.PI / 2;
    for (let i = 0; i < 6; i++) {
      this.mesh(this.tracker, new THREE.SphereGeometry(.02, 10, 8), i === 2 ? core : metal, 0, 0, -.15 + i * .06);
    }
    const wire = new THREE.CatmullRomCurve3(Array.from({ length: 25 }, (_, i) => new THREE.Vector3(Math.sin(i * .7) * .016, Math.cos(i * .7) * .016, -.17 + i * .015)));
    this.mesh(this.tracker, new THREE.TubeGeometry(wire, 32, .004, 5), black);
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      const joint = new THREE.Group(); joint.position.set(side * .03, 0, -.09 + i * .09); this.tracker.add(joint); this.legs.push(joint);
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(side * .1, .04, -.025), new THREE.Vector3(side * .14, -.035, -.045)]);
      this.mesh(joint, new THREE.TubeGeometry(curve, 12, .006, 6), metal);
    }
    this.mesh(this.case, new THREE.BoxGeometry(.28, .07, .46), black);
    const lid = this.mesh(this.case, new THREE.BoxGeometry(.28, .026, .44), metal, 0, .2, -.2); lid.rotation.x = -1.18;
    this.tracker.name = 'interrogation-tracker'; this.case.name = 'interrogation-device-case';
    rig.root.add(this.tracker, this.case);
    const chest = this.bone('chest'); chest.add(this.tie); this.tie.name = 'office-tie';
    const cloth = new THREE.MeshStandardMaterial({ color: 0x131915, roughness: .89, side: THREE.DoubleSide });
    const shape = new THREE.Shape(); shape.moveTo(-.027, .38); shape.lineTo(.027, .38); shape.lineTo(.075, -.57); shape.lineTo(0, -.66); shape.lineTo(-.075, -.57); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .009, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .008, bevelThickness: .005 });
    this.mesh(this.tie, geometry, cloth, 0, 0, .49);
    const knot = this.mesh(this.tie, new THREE.SphereGeometry(.056, 8, 6), cloth, 0, .41, .49); knot.scale.set(.72, 1, .4);
    rig.root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
      const material = object.material;
      if (material.name === 'Skin') {
        // Sample nearby cheek skin in the same UV atlas, rather than painting
        // lip color over a flattened chin. No new image is projected on the head.
        object.geometry = object.geometry.clone(); this.geometries.add(object.geometry);
        const positions = object.geometry.attributes.position; const uv = object.geometry.attributes.uv;
        const samples = Array.from({ length: positions.count }, (_, i) => i).filter(i => Math.abs(positions.getX(i)) > .09 && Math.abs(positions.getX(i)) < .14 && positions.getY(i) > 3.91 && positions.getY(i) < 3.99 && positions.getZ(i) > .28);
        const sealUv = new Float32Array(uv.array);
        for (let i = 0; i < positions.count; i++) if (Math.abs(positions.getX(i)) < .11 && Math.abs(positions.getY(i) - 3.947) < .06 && positions.getZ(i) > .28) {
          const x = Math.sign(positions.getX(i) || 1) * .105; const y = positions.getY(i);
          let nearest = samples[0]; let distance = Infinity;
          for (const j of samples) { const d = (positions.getX(j) - x) ** 2 + (positions.getY(j) - y) ** 2; if (d < distance) { distance = d; nearest = j; } }
          if (nearest !== undefined) { sealUv[i * 2] = uv.getX(nearest); sealUv[i * 2 + 1] = uv.getY(nearest); }
        }
        object.geometry.setAttribute('sealUv', new THREE.BufferAttribute(sealUv, 2));
        const source = material.onBeforeCompile; const cache = material.customProgramCacheKey();
        material.onBeforeCompile = (shader, renderer) => {
          source(shader, renderer); shader.uniforms.interrogationSeal = this.seal;
          shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float interrogationSeal;\nattribute vec2 sealUv;\nvarying vec2 vSealUv;\nvarying float vMouthSeal;')
            .replace('#include <begin_vertex>', `#include <begin_vertex>
              float lip = (1.0 - smoothstep(0.06, 0.1, abs(position.x))) * (1.0 - smoothstep(0.023, 0.047, abs(position.y - 3.947))) * smoothstep(0.28, 0.33, position.z);
              vMouthSeal = lip * interrogationSeal; vSealUv = sealUv;
              transformed.z = mix(transformed.z, 0.372 - position.x * position.x * 0.6, vMouthSeal);
              transformed.y = mix(transformed.y, 3.947 + sign(3.947 - position.y) * 0.0015, vMouthSeal);`)
            .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
              float sealNormal = (1.0 - smoothstep(0.06, 0.1, abs(position.x))) * (1.0 - smoothstep(0.023, 0.047, abs(position.y - 3.947))) * smoothstep(0.28, 0.33, position.z) * interrogationSeal;
              objectNormal = normalize(mix(objectNormal, vec3(0.0, 0.0, 1.0), sealNormal));`);
          shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vMouthSeal;\nvarying vec2 vSealUv;')
            .replace('#include <map_fragment>', `#include <map_fragment>
              #ifdef USE_MAP
                vec3 surroundingSkin = texture2D(map, vSealUv).rgb;
                diffuseColor.rgb = mix(diffuseColor.rgb, surroundingSkin, vMouthSeal);
              #endif`);
        };
        material.customProgramCacheKey = () => cache + '-interrogation-seal'; material.needsUpdate = true;
      }
      if (material.name === 'Office cotton') {
        const source = material.onBeforeCompile; const cache = material.customProgramCacheKey();
        material.onBeforeCompile = (shader, renderer) => {
          source(shader, renderer); shader.uniforms.interrogationShirt = this.openShirt;
          shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float interrogationShirt;\nvarying vec3 vShirtPosition;')
            .replace('#include <begin_vertex>', `#include <begin_vertex>
              vShirtPosition = position;
              float shirtFront = smoothstep(0.12, 0.27, position.z) * (1.0 - smoothstep(2.92, 3.33, position.y));
              transformed.x += sign(position.x) * (1.0 - smoothstep(0.05, 0.32, abs(position.x))) * shirtFront * interrogationShirt * 0.3;
              transformed.z -= shirtFront * interrogationShirt * 0.035;`);
          shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float interrogationShirt;\nvarying vec3 vShirtPosition;')
            .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
              float opening = interrogationShirt * 0.15 * (1.0 - smoothstep(2.94, 3.24, vShirtPosition.y));
              if (vShirtPosition.z > 0.17 && abs(vShirtPosition.x) < opening) discard;`);
        };
        material.customProgramCacheKey = () => cache + '-interrogation-shirt'; material.needsUpdate = true;
      }
    });
  }
  private bone(name: string): THREE.Bone { return this.rig.bones.get(name)!; }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh);
    this.geometries.add(geometry); this.materials.add(material); return mesh;
  }
  private point(x: number, y: number, z: number): THREE.Vector3 {
    const center = FILM_SETS.film_agent_interrogation.center;
    return this.rig.root.worldToLocal(new THREE.Vector3(center.x + x, center.y - 1 + y, center.z + z));
  }
  private hand(side: 'R' | 'L', target: THREE.Vector3, normal: THREE.Vector3, fingers: THREE.Vector3, blend = 1, elbowUp = false, contact?: THREE.Vector3): void {
    const root = this.rig.root; root.updateWorldMatrix(true, true);
    const upper = this.bone('shoulder_' + side); const lower = this.bone('elbow_' + side); const end = this.bone('wrist_' + side);
    const rootRotation = root.getWorldQuaternion(new THREE.Quaternion());
    const x = normal.clone().multiplyScalar(side === 'R' ? 1 : -1); const y = fingers.clone().negate();
    const desired = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, x.clone().cross(y)));
    const rotation = rootRotation.clone().invert().multiply(end.getWorldQuaternion(new THREE.Quaternion())).slerp(desired, blend);
    const offset = contact?.clone() ?? new THREE.Vector3(side === 'R' ? .065 : -.065, -.17, .01);
    target = root.worldToLocal(end.localToWorld(offset.clone())).lerp(target, blend).sub(offset.applyQuaternion(rotation)); root.localToWorld(target);
    const start = upper.getWorldPosition(new THREE.Vector3()); const direction = target.clone().sub(start);
    const a = lower.position.length(); const b = end.position.length(); const length = THREE.MathUtils.clamp(direction.length(), .02, a + b - .001); direction.normalize();
    const along = (a * a - b * b + length * length) / (2 * length);
    const pole = new THREE.Vector3(side === 'L' ? .6 : -.6, elbowUp ? 1 : -.6, -.1).applyQuaternion(rootRotation); pole.addScaledVector(direction, -pole.dot(direction)).normalize();
    const hinge = start.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
    const aim = (joint: THREE.Bone, child: THREE.Bone, position: THREE.Vector3) => {
      joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), joint.parent!.worldToLocal(position.clone()).sub(joint.position).normalize()); joint.updateWorldMatrix(false, true);
    };
    aim(upper, lower, hinge); aim(lower, end, start.addScaledVector(direction, length));
    end.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rootRotation).multiply(rotation)); end.updateWorldMatrix(false, true);
  }
  update(gesture?: InterrogationGesture, officeShirt = false): void {
    this.tracker.visible = this.case.visible = false; this.tie.visible = officeShirt;
    this.seal.value = 0; this.openShirt.value = 0; this.tie.rotation.z = 0; this.tracker.scale.setScalar(1);
    if (!gesture) return;
    const pose = interrogationPose(gesture); const t = gesture.elapsed; const neo = gesture.role === 'neo'; const smith = gesture.role === 'smith';
    const root = this.rig.root; const pelvis = this.bone('pelvis');
    pelvis.position.copy(this.rig.rest.get('pelvis')!); pelvis.position.y = THREE.MathUtils.lerp(pelvis.position.y, 1.56, pose.seated);
    pelvis.rotation.set(neo ? -Math.PI / 2 * pose.pinned : 0, 0, 0);
    this.bone('spine').rotation.set(neo ? .08 * (1 - pose.pinned) : smith ? .03 + .2 * pose.device : .22 * pose.restrain, 0, 0);
    this.bone('chest').rotation.set(neo ? 0 : smith ? .1 * pose.device : .12 * pose.restrain, 0, 0);
    this.bone('head').rotation.set(neo ? -.12 * pose.touch + pose.pinned * .05 : .04, neo ? 0 : -.12 * pose.device, 0);
    if (neo) pelvis.position.y = THREE.MathUtils.lerp(pelvis.position.y, INTERROGATION_ROOM.table.height + .29, pose.pinned);
    for (const [i, side] of ['R', 'L'].entries()) {
      const sway = pose.gait * (i ? 1 : -1);
      this.bone('hip_' + side).rotation.set(THREE.MathUtils.lerp(-1.37 * pose.seated + sway * .32, 0, neo ? pose.pinned : 0), 0, 0);
      this.bone('knee_' + side).rotation.set(THREE.MathUtils.lerp(1.46 * pose.seated + Math.max(0, -sway) * .35, .05, neo ? pose.pinned : 0), 0, 0);
      this.bone('ankle_' + side).rotation.set(-.09 * pose.seated, 0, 0);
      this.bone('shoulder_' + side).rotation.set(-.15 - pose.seated * .2 - sway * .2, 0, i ? .05 : -.05);
      this.bone('elbow_' + side).rotation.set(-.2 - pose.seated * .9, 0, 0);
      for (let f = 1; f <= 5; f++) for (let s = 1; s <= 3; s++) this.bone(`finger${f}-${s}_${side}`).rotation.set(f === 1 ? .2 : 0, 0, (i ? -1 : 1) * (f === 1 ? .1 : .22));
    }
    root.updateWorldMatrix(true, true);
    const up = new THREE.Vector3(0, 1, 0); const forward = new THREE.Vector3(0, 0, 1);
    if (neo) {
      this.seal.value = pose.seal; this.openShirt.value = pose.device;
      this.tie.rotation.z = pose.pinned * .55;
      for (const side of ['R', 'L'] as const) {
        const sign = side === 'R' ? -1 : 1;
        const lap = new THREE.Vector3(sign * .36, 1.54, .63);
        this.hand(side, lap, up.clone(), forward, pose.seated * (1 - pose.touch));
        if (pose.pinned) this.hand(side, this.point(.35, 2.62, sign * 1.03), up.clone().negate(), new THREE.Vector3(0, 0, -1), pose.pinned, true);
      }
      if (pose.touch) {
        const mouth = root.worldToLocal(this.bone('head').localToWorld(new THREE.Vector3(.015, -.13, .28)));
        this.hand('R', mouth, new THREE.Vector3(0, 0, -1), up.clone(), pose.touch);
      }
    } else if (smith) {
      const file = this.point(-2.6, INTERROGATION_ROOM.table.height + .17, .1);
      this.hand('R', file, up.clone().negate(), forward, pose.seated * (gesture.phase === 'file' ? smooth(t, .7, 2) : 1), true);
      if (pose.device) {
        const offer = this.point(-.9, 3.45, -.85).lerp(this.point(-.43, 3.1, .01), smooth(t, 15.6, 17.6)); const hand = this.bone('wrist_R');
        const pinch = new THREE.Vector3(.14, -.32, .12);
        this.hand('R', offer, up.clone(), forward, pose.device, false, pinch);
        for (let f = 3; f <= 5; f++) for (let s = 1; s <= 3; s++) this.bone(`finger${f}-${s}_R`).rotation.z = s === 1 ? .65 : .9;
        for (const f of [1, 2]) {
          const chain = [1, 2, 3].map(s => this.bone(`finger${f}-${s}_R`)); chain.forEach(joint => joint.quaternion.identity());
          const tip = chain[2].position.clone().normalize().multiplyScalar(.04); const target = pinch.clone(); target.x += f === 1 ? .028 : -.028; hand.localToWorld(target);
          for (let iteration = 0; iteration < 8; iteration++) for (const joint of [...chain].reverse()) {
            root.updateWorldMatrix(true, true);
            joint.quaternion.multiply(new THREE.Quaternion().setFromUnitVectors(joint.worldToLocal(chain[2].localToWorld(tip.clone())).normalize(), joint.worldToLocal(target.clone()).normalize()));
          }
        }
        if (this.case.parent !== this.bone('wrist_L')) this.bone('wrist_L').add(this.case);
        this.case.position.set(-.065, -.17, .01); this.case.rotation.set(Math.PI / 2, 0, 0); this.case.visible = true;
        this.tracker.visible = pose.implant < 1;
        if (!pose.release) {
          hand.add(this.tracker); this.tracker.position.copy(pinch); this.tracker.rotation.set(0, 0, 0);
        } else {
          root.add(this.tracker);
          const start = this.point(-.43, 3.1, .01); const end = this.point(-.43, 2.94, .01);
          this.tracker.position.copy(start.lerp(end, smooth(t, 17.6, 18.8))); this.tracker.position.y -= smooth(t, 20.1, 21.5) * .27;
          this.tracker.rotation.set(0, .3 + Math.sin(t * 7) * .08, 0); this.tracker.scale.setScalar(1 - smooth(t, 20.8, 21.5) * .9);
        }
        this.legs.forEach((leg, i) => { leg.rotation.z = Math.sin(t * 16 + i * 2.1) * .38; });
      }
    } else if (pose.restrain) {
      const side = gesture.role === 'agent_jones' ? -1 : 1;
      const neo = interrogationRoot({ ...gesture, approach: { x: 0, z: 0, yaw: 0 } }, 'neo');
      for (const hand of ['R', 'L'] as const) {
        const target = this.point(neo.x + 1.4 * pose.pinned + (hand === 'R' ? -.13 : .13), THREE.MathUtils.lerp(3.27, 2.67, pose.pinned), side * THREE.MathUtils.lerp(.58, 1.02, pose.pinned));
        this.hand(hand, target, up.clone().negate(), forward, pose.restrain, true);
      }
    }
    root.updateWorldMatrix(true, true);
  }
  dispose(): void {
    this.tracker.removeFromParent(); this.case.removeFromParent(); this.tie.removeFromParent();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
  }
}
