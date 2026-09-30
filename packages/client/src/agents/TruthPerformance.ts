import * as THREE from 'three';
import { FILM_SETS, truthKneel, truthRest, type TruthGesture } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';

/** The aftermath of the first truth lesson, using the current character skeleton. */
export class TruthPerformance {
  private battery = new THREE.Group();
  private soles?: { bone: THREE.Bone; points: THREE.Vector3[] }[];
  constructor(private rig: HeroRig) {
    this.battery.name = 'truth-held-battery'; this.battery.position.set(.08, -.18, .025);
    const shell = new THREE.MeshStandardMaterial({ color: 0x1b1c1a, roughness: .42, metalness: .7 });
    const cap = new THREE.MeshStandardMaterial({ color: 0x937655, roughness: .35, metalness: .8 });
    for (const [radius, height, y, material] of [[.12, .38, 0, shell], [.125, .12, .23, cap], [.045, .025, .3, cap]] as const) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 20), material);
      mesh.position.y = y; mesh.castShadow = true; this.battery.add(mesh);
    }
    rig.bones.get('wrist_R')!.add(this.battery); this.battery.visible = false;
  }

  pose(gesture: TruthGesture | undefined): void {
    this.battery.visible = Boolean(gesture?.role === 'morpheus' && ['ready', 'exit'].includes(gesture.phase));
    if (!gesture) return;
    const bone = (name: string) => this.rig.bones.get(name)!, t = gesture.elapsed;
    if (this.battery.visible) {
      const hold = gesture.phase === 'ready' ? 1 : 1 - THREE.MathUtils.smoothstep(t, 1.5, 3);
      bone('shoulder_R').rotation.x = THREE.MathUtils.lerp(bone('shoulder_R').rotation.x, -.15, hold);
      bone('elbow_R').rotation.x = THREE.MathUtils.lerp(bone('elbow_R').rotation.x, -1.2, hold);
      for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++)
        bone(`finger${finger}-${segment}_R`).rotation.z = finger === 1 ? .15 : .65;
    }
    if (gesture.role === 'neo' && gesture.phase === 'exit') {
      const refuse = THREE.MathUtils.smoothstep(t, .2, 1) * (1 - THREE.MathUtils.smoothstep(t, 4.2, 5.4));
      bone('head').rotation.y += Math.sin(t * 3) * .1 * refuse;
      for (const side of ['L', 'R']) { bone(`shoulder_${side}`).rotation.x -= .6 * refuse; bone(`elbow_${side}`).rotation.x -= .65 * refuse; }
    }
    if (gesture.role === 'neo' && gesture.phase === 'unplug') {
      const strain = 1 - THREE.MathUtils.smoothstep(t, 2.7, 3.3), kneel = truthKneel(t);
      bone('head').rotation.x += .12 * strain;
      bone('pelvis').rotation.x += kneel;
      const away = THREE.MathUtils.smoothstep(t, 4, 5.5) * (1 - THREE.MathUtils.smoothstep(t, 7.2, 8.4));
      for (const side of ['L', 'R']) {
        bone(`shoulder_${side}`).rotation.x -= .75 * away; bone(`elbow_${side}`).rotation.x -= .25 * away;
        bone(`hip_${side}`).rotation.x = THREE.MathUtils.lerp(bone(`hip_${side}`).rotation.x, -1.15, kneel);
        bone(`knee_${side}`).rotation.x = THREE.MathUtils.lerp(bone(`knee_${side}`).rotation.x, 2.0, kneel);
        bone(`ankle_${side}`).rotation.x = THREE.MathUtils.lerp(bone(`ankle_${side}`).rotation.x, -.6, kneel);
      }
      bone('spine').rotation.x += .65 * kneel; bone('chest').rotation.x += .45 * kneel; bone('head').rotation.x -= .4 * kneel;
      if (kneel > 0) {
        this.rig.root.updateWorldMatrix(true, true);
        const knee = this.rig.root.worldToLocal(bone('knee_R').getWorldPosition(new THREE.Vector3()));
        bone('pelvis').position.y -= (knee.y - .15) * kneel;
        this.rig.root.updateWorldMatrix(true, true);
        this.placeShoes();
      }
    }
    if (gesture.role === 'dozer' && gesture.phase === 'unplug') {
      const steady = THREE.MathUtils.smoothstep(t, 0, .7) * (1 - THREE.MathUtils.smoothstep(t, 3.2, 4));
      bone('spine').rotation.x += .3 * steady; bone('chest').rotation.x += .15 * steady;
    }
    if (gesture.role === 'morpheus' && truthRest(gesture)) {
      const explain = gesture.phase === 'rest' ? THREE.MathUtils.smoothstep(t, 5.5, 7) * (1 - THREE.MathUtils.smoothstep(t, 13, 15)) : 0;
      bone('elbow_L').rotation.x -= explain * .55; bone('head').rotation.x += .1;
    }
    if (gesture.role === 'neo' && truthRest(gesture)) {
      for (const [index, side] of ['R', 'L'].entries()) {
        bone(`shoulder_${side}`).rotation.set(.02, 0, (index ? 1 : -1) * .12);
        bone(`elbow_${side}`).rotation.x = -.03;
      }
    }
  }

  private placeShoes(): void {
    if (!this.soles) {
      const shoes = this.rig.root.getObjectByName('shoes01') as THREE.SkinnedMesh;
      const { position, skinIndex, skinWeight } = shoes.geometry.attributes;
      this.soles = ['R', 'L'].map(side => {
        const bone = this.rig.bones.get(`ankle_${side}`)!, joint = shoes.skeleton.bones.indexOf(bone), points: THREE.Vector3[] = [];
        for (let index = 0; index < position.count; index++) {
          if (![0, 1, 2, 3].some(part => skinIndex.getComponent(index, part) === joint && skinWeight.getComponent(index, part) > .5)) continue;
          points.push(new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(shoes.bindMatrix).applyMatrix4(shoes.skeleton.boneInverses[joint]));
        }
        return { bone, points };
      });
    }
    const inverse = this.rig.root.matrixWorld.clone().invert(), point = new THREE.Vector3(); let lowest = 0;
    for (const sole of this.soles) {
      const matrix = new THREE.Matrix4().multiplyMatrices(inverse, sole.bone.matrixWorld);
      for (const vertex of sole.points) lowest = Math.min(lowest, point.copy(vertex).applyMatrix4(matrix).y);
    }
    this.rig.bones.get('pelvis')!.position.y -= lowest;
  }

  contact(gesture: TruthGesture | undefined): void {
    if (gesture?.role !== 'neo' || gesture.phase !== 'unplug') return;
    const blend = truthKneel(gesture.elapsed); if (!blend) return;
    const bones = this.rig.bones; this.rig.root.updateWorldMatrix(true, true);
    for (const side of ['R', 'L']) {
      const shoulder = bones.get(`shoulder_${side}`)!, elbow = bones.get(`elbow_${side}`)!, wrist = bones.get(`wrist_${side}`)!;
      const root = this.rig.root.getWorldQuaternion(new THREE.Quaternion());
      const rotation = root.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)));
      const orientation = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(rotation, blend);
      const palm = new THREE.Vector3(side === 'R' ? .09 : -.09, -.18, .02);
      const ground = this.rig.root.localToWorld(new THREE.Vector3(side === 'R' ? -.48 : .48, 0, 1.02));
      // The wrist-space proxy lies inside the hand; the shipped skin extends
      // another .17 below it with both palms facing the deck.
      ground.y = FILM_SETS.film_neb_deck.center.y - 1 + .18;
      const target = wrist.localToWorld(palm.clone()).lerp(ground, blend).sub(palm.applyQuaternion(orientation));
      const start = shoulder.getWorldPosition(new THREE.Vector3()), direction = target.clone().sub(start);
      const a = elbow.position.length(), b = wrist.position.length(), reach = THREE.MathUtils.clamp(direction.length(), .02, a + b - .001);
      direction.normalize(); target.copy(start).addScaledVector(direction, reach);
      const along = (a * a - b * b + reach * reach) / (2 * reach);
      const pole = new THREE.Vector3(side === 'R' ? -1 : 1, 0, .3).applyQuaternion(root);
      pole.addScaledVector(direction, -pole.dot(direction)).normalize();
      const hinge = start.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
      const aim = (joint: THREE.Bone, child: THREE.Bone, point: THREE.Vector3) => {
        joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), joint.parent!.worldToLocal(point.clone()).sub(joint.position).normalize()); joint.updateWorldMatrix(false, true);
      };
      aim(shoulder, elbow, hinge); aim(elbow, wrist, target);
      wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
      for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) bones.get(`finger${finger}-${segment}_${side}`)!.rotation.z *= 1 - blend;
      wrist.updateWorldMatrix(false, true);
    }
  }

  dispose(): void {
    const materials = new Set<THREE.Material>();
    this.battery.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); materials.add(object.material); } });
    materials.forEach(material => material.dispose()); this.battery.removeFromParent();
  }
}
