import * as THREE from 'three';
import { CONSOLE_DRINK, CONSOLE_SERVICE, FILM_SETS, consolePourPose, type InterludeGesture } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import { createConsoleJug, disposeConsoleProp } from './ConsoleJug.js';
import { ConsoleGrip, placeCylinderHand } from './ConsoleGrip.js';

export class ConsolePourPerformance {
  private jug = createConsoleJug('cypher-held-jug');
  private grip: ConsoleGrip;
  constructor(private rig: HeroRig) {
    rig.bones.get('wrist_L')!.add(this.jug); this.jug.visible = false; this.grip = new ConsoleGrip(rig, 'L');
  }

  update(gesture?: InterludeGesture): void {
    this.jug.visible = false;
    if (gesture?.kind !== 'console' || gesture.role !== 'cypher') return;
    const pose = consolePourPose(gesture); this.jug.visible = pose.holding; if (!pose.reach) return;
    const b = this.rig.bones, root = this.rig.root;
    b.get('spine')!.rotation.x += .25 * pose.reach; b.get('chest')!.rotation.x += .25 * pose.reach;
    b.get('spine')!.rotation.z -= .22 * pose.reach; b.get('head')!.rotation.x -= .25 * pose.reach;
    root.updateWorldMatrix(true, true); root.updateMatrixWorld(true);
    const wrist = b.get('wrist_L')!;
    const center = FILM_SETS.film_neb_deck.center, at = CONSOLE_SERVICE.jug;
    const table = new THREE.Vector3(center.x + at.x, center.y - 1 + at.y, center.z + at.z);
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.lerp(at.yaw, .64, pose.carry))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), .85 * pose.pour));
    const handle = new THREE.Vector3(CONSOLE_SERVICE.handle.x, CONSOLE_SERVICE.handle.y, 0);
    const held = root.localToWorld(new THREE.Vector3(.7, 3.2, .65)).sub(handle.clone().applyQuaternion(rotation));
    const spout = new THREE.Vector3(CONSOLE_SERVICE.spout.x, CONSOLE_SERVICE.spout.y, 0);
    const pouring = new THREE.Vector3(center.x + CONSOLE_DRINK.cup.x, center.y - 1 + CONSOLE_DRINK.cup.y + .49, center.z + CONSOLE_DRINK.cup.z).sub(spout.clone().applyQuaternion(rotation));
    const origin = table.clone().lerp(held, pose.carry).lerp(pouring, pose.pour);
    const goal = origin.clone().add(handle.clone().applyQuaternion(rotation));
    const approach = new THREE.Vector3(.7, 0, 0).applyQuaternion(rotation); approach.y += .25;
    const pole = new THREE.Vector3(.8, -.25, -.65).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));
    const orientation = placeCylinderHand(this.rig, 'L', goal, new THREE.Vector3(-.18, -.24, 0), pose.reach, pole, rotation, approach);
    const local = orientation.clone().invert().multiply(rotation); this.jug.quaternion.copy(local);
    this.jug.position.set(-.18, -.24, 0).sub(handle.applyQuaternion(local));
    wrist.updateWorldMatrix(false, true);
    const frame = this.jug.matrixWorld;
    const grip = pose.grip * (1 - THREE.MathUtils.smoothstep(gesture.elapsed, CONSOLE_SERVICE.release, CONSOLE_SERVICE.release + .25));
    this.grip.update(root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, grip, 'jug', Math.min(1, pose.reach * 2), frame);
    wrist.updateWorldMatrix(false, true);
  }

  dispose(): void { disposeConsoleProp(this.jug); }
}
