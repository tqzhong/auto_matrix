import * as THREE from 'three';
import { FILM_SETS, ORACLE_LAST, oracleLastBowl, oracleLastSeat, type OracleLastGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

function palm(rig: CharacterRig, index: number, hand: THREE.Object3D, point: THREE.Vector3, orientation: THREE.Quaternion): void {
  const offset = new THREE.Vector3(0, -.75 - hand.position.y, .005), scale = hand.getWorldScale(new THREE.Vector3());
  reach(rig.shoulders[index], rig.elbows[index], hand.position, point.clone().sub(offset.clone().multiply(scale).applyQuaternion(orientation)),
    new THREE.Vector3(index ? .8 : -.8, -.4, -.2).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion())));
  hand.quaternion.copy(rig.elbows[index].getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  hand.updateWorldMatrix(false, true);
}

/** Saved kneading, hand washing, seating and bowl carrying; no browser clock. */
export function poseOracleLast(rig: CharacterRig, gesture?: OracleLastGesture): void {
  const dress = rig.root.getObjectByName('oracle-last-dress') as THREE.Mesh<THREE.CylinderGeometry> | undefined;
  if (dress) dress.visible = gesture?.role === 'oracle';
  for (const name of ['oracle-last-candy', 'oracle-last-cigarette', 'oracle-last-necklace']) {
    const prop = rig.root.getObjectByName(name); if (prop) prop.visible = false;
  }
  if (!gesture) return;
  if (gesture.role === 'neo' && rig.hero) {
    const head = rig.hero.bones.get('head')!;
    head.rotation.x += gesture.phase === 'responding' ? .035 : Math.sin(gesture.elapsed * .8) * .015;
    return;
  }
  const orientation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const center = FILM_SETS.film_oracle_home.center;
  const world = (x: number, y: number, z: number) => new THREE.Vector3(center.x + x, center.y - 1 + y, center.z + z);
  rig.root.updateWorldMatrix(true, true);
  if (gesture.role === 'sati' && gesture.arrival >= 2.2) {
    const bowl = oracleLastBowl(gesture);
    const take = THREE.MathUtils.smoothstep(gesture.arrival, 2.2, 3);
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1, hand = rig.root.getObjectByName(`sati-hand-${side}`)!;
      const point = world(bowl.x + Math.cos(bowl.yaw) * side * .455, bowl.y + .28, bowl.z - Math.sin(bowl.yaw) * side * .455);
      const rotation = orientation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -side * Math.PI / 2));
      point.copy(hand.localToWorld(new THREE.Vector3(0, -.07, .005)).lerp(point, take));
      rotation.copy(hand.getWorldQuaternion(new THREE.Quaternion()).slerp(rotation, take));
      palm(rig, i, hand, point, rotation); rig.fingers[i].forEach(finger => { finger.rotation.x = -.32 * take; });
    }
    return;
  }
  if (gesture.role !== 'oracle' || !dress || rig.hero) return;
  rig.detail.userData.oracleLastPose = true;
  const seat = oracleLastSeat(gesture), hip = THREE.MathUtils.lerp(1.86, ORACLE_LAST.oracle.seat + .27, seat);
  const washing = gesture.arrival >= 8.8 && gesture.arrival < 12.8, baking = gesture.arrival < 4;
  const working = washing || baking;
  for (const name of ['oracle-apron-group', 'oracle-daily-collar', 'oracle-daily-tailoring', 'oracle-daily-hem']) rig.root.getObjectByName(name)!.visible = false;
  rig.root.getObjectByName('oracle-request-bodice')!.visible = true;
  rig.root.getObjectByName('oracle-last-necklace')!.visible = true;
  rig.oracleClothing!.blouse.color.set(0x4f6857);
  rig.torso.position.y = hip - (working ? .06 : 0); rig.torso.rotation.x = working ? .16 : -.025 * seat;
  rig.head.rotation.x = working ? .13 : .025; rig.head.rotation.y = 0;
  rig.root.updateWorldMatrix(true, true);
  if (seat > 0) for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1, foot = rig.detail.worldToLocal(rig.ankles[i].getWorldPosition(new THREE.Vector3()));
    rig.hips[i].position.set(side * .225, hip + .06, -.03); rig.hips[i].updateWorldMatrix(false, true);
    reach(rig.hips[i], rig.knees[i], rig.ankles[i].position, rig.detail.localToWorld(foot.lerp(new THREE.Vector3(side * .27, .16, 1.23), seat)),
      new THREE.Vector3(side * .1, .2, 1).applyQuaternion(orientation));
    rig.ankles[i].quaternion.copy(rig.knees[i].getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  }
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1, hand = rig.root.getObjectByName(`oracle-hand-${i ? 'L' : 'R'}`)!;
    let point = rig.detail.localToWorld(new THREE.Vector3(side * .32, hip + .3, .70));
    let rotation = orientation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
    if (washing || baking) {
      point = washing ? world(-1.5 + side * .15, 2.76 + Math.sin(gesture.arrival * 6) * .025, -26.5 + i * .10)
        : world(-6 + side * .17, 2.25 + Math.sin(gesture.arrival * 3 + i) * .05, -20.30);
      rotation = orientation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
    } else if (seat === 1 && gesture.phase === 'answering') {
      if (gesture.step === 1 && gesture.elapsed < ORACLE_LAST.lineSeconds && i === 0) {
        point = rig.detail.localToWorld(new THREE.Vector3(-.30, hip + 1.10, 1.05));
        rig.root.getObjectByName('oracle-last-candy')!.visible = true;
      } else if (gesture.step === 1 && gesture.elapsed >= ORACLE_LAST.lineSeconds * 4 && gesture.elapsed < ORACLE_LAST.lineSeconds * 5 && i === 1) {
        const shoulder = rig.shoulders[i].getWorldPosition(new THREE.Vector3());
        point = world(0, 7.15, -7.6).sub(shoulder).normalize().multiplyScalar(1.35).add(shoulder);
        rotation = hand.getWorldQuaternion(new THREE.Quaternion()); rig.head.rotation.x = -.12;
      } else if (i === 0 && (gesture.step === 2 || gesture.elapsed >= ORACLE_LAST.lineSeconds * 2)) {
        const time = gesture.elapsed % 8, lift = THREE.MathUtils.smoothstep(time, 1, 2) * (1 - THREE.MathUtils.smoothstep(time, 3, 4.4));
        point.lerp(rig.head.localToWorld(new THREE.Vector3(-.18, -.19, .38)), lift);
        rig.root.getObjectByName('oracle-last-cigarette')!.visible = true;
      }
    }
    if (working || seat > 0) palm(rig, i, hand, point, rotation);
    rig.fingers[i].forEach(finger => { finger.rotation.x = working ? -.12 : -.26; });
  }
  rig.root.updateWorldMatrix(true, true);
  const vertices = dress.geometry.attributes.position, standing = dress.userData.standing as Float32Array;
  vertices.array.set(standing);
  if (seat > 0) {
    const { radialSegments: columns, heightSegments: rows } = dress.geometry.parameters;
    for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
      const t = row / rows, angle = column / columns * Math.PI * 2, lap = Math.min(1, t / .45);
      const y = Math.max(.055, t < .45 ? hip + .12 - t * .4 : hip - .06 - (t - .45) * 2.2);
      const z = lap * 1.16 + Math.cos(angle) * (.32 - lap * .17);
      const index = row * (columns + 1) + column;
      const seated = new THREE.Vector3(Math.sin(angle) * (.54 + t * .17), y, y < ORACLE_LAST.oracle.seat + .035 ? Math.max(.93, z) : z);
      vertices.setXYZ(index, THREE.MathUtils.lerp(standing[index * 3], seated.x, seat), THREE.MathUtils.lerp(standing[index * 3 + 1], seated.y, seat), THREE.MathUtils.lerp(standing[index * 3 + 2], seated.z, seat));
    }
  }
  vertices.needsUpdate = true; dress.geometry.computeVertexNormals(); dress.geometry.computeBoundingSphere();
  rig.root.updateWorldMatrix(true, true);
}
