import * as THREE from 'three';
import { CONSOLE_DRINK, CONSOLE_SERVICE, FILM_SETS, consolePourPose, type InterludeGesture } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import { createConsoleJug, disposeConsoleProp } from './ConsoleJug.js';
import { ConsoleGrip } from './ConsoleGrip.js';
import { reach } from './SpoonPerformance.js';

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
    const wrist = b.get('wrist_L')!, elbow = b.get('elbow_L')!, shoulder = b.get('shoulder_L')!;
    const restingPole = elbow.getWorldPosition(new THREE.Vector3()).sub(shoulder.getWorldPosition(new THREE.Vector3())).normalize();
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
    if (!pose.holding) {
      const clearance = Math.sin(Math.PI * pose.reach);
      goal.y += clearance * .25;
      goal.addScaledVector(new THREE.Vector3(1, 0, 0).applyQuaternion(rotation), clearance * .7);
    }
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation);
    const pole = restingPole.lerp(up, pose.reach);
    // Swivel around the cylindrical handle so its wrist axis follows the forearm.
    const base = wrist.getWorldQuaternion(new THREE.Quaternion()), orientation = base.clone(), start = wrist.getWorldPosition(new THREE.Vector3());
    let aim = goal.clone().sub(shoulder.getWorldPosition(new THREE.Vector3()));
    for (let iteration = 0; iteration < 12; iteration++) {
      aim.addScaledVector(up, -aim.dot(up)).normalize();
      const x = new THREE.Vector3().crossVectors(up, aim).normalize();
      const desired = base.clone().slerp(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, aim.clone().negate(), up)), pose.reach);
      // Moving the wrist also changes its forearm direction. Damping avoids
      // alternating between two grips when the tilted handle approaches it.
      if (iteration === 0) orientation.copy(desired); else orientation.slerp(desired, .5);
      const offset = new THREE.Vector3(-.18, -.24, 0).applyQuaternion(orientation);
      const target = start.clone().lerp(goal.clone().sub(offset), pose.reach);
      reach(shoulder, elbow, wrist.position, target, pole.clone());
      aim = wrist.getWorldPosition(new THREE.Vector3()).sub(elbow.getWorldPosition(new THREE.Vector3()));
    }
    const forearm = wrist.getWorldPosition(new THREE.Vector3()).sub(elbow.getWorldPosition(new THREE.Vector3())).normalize();
    const palmAxis = new THREE.Vector3(0, -1, 0).applyQuaternion(orientation), bend = palmAxis.angleTo(forearm);
    if (!pose.holding && bend > 1.25) {
      const straight = new THREE.Quaternion().setFromUnitVectors(palmAxis, forearm).multiply(orientation);
      orientation.slerp(straight, (bend - 1.25) / bend);
    }
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    const local = orientation.clone().invert().multiply(rotation); this.jug.quaternion.copy(local);
    this.jug.position.set(-.18, -.24, 0).sub(handle.applyQuaternion(local));
    wrist.updateWorldMatrix(false, true);
    const frame = pose.holding ? this.jug.matrixWorld.clone() : new THREE.Matrix4().compose(table,
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), at.yaw), new THREE.Vector3(1, 1, 1));
    this.grip.update(root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, pose.grip, 'jug', Math.min(1, pose.reach * 2), frame);
    wrist.updateWorldMatrix(false, true);
  }

  dispose(): void { disposeConsoleProp(this.jug); }
}
