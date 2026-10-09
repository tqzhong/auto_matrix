import * as THREE from 'three';
import { FILM_SETS, TRUCK_HOOD, truckHoodRoot, truckHoodCarPoint, truckHoodHeight, truckHoodRunZ, truckHoodBack, type TruckHoodGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './TruckWeaponPerformance.js';

const backSamples = new WeakMap<CharacterRig, { mesh: THREE.SkinnedMesh; indices: number[] }>();

export function poseTruckHood(rig: CharacterRig, h: TruckHoodGesture | undefined): void {
  if (!h) return;
  const center = FILM_SETS.film_freeway_101.center, p = truckHoodRoot(h, h.role);
  const world = (p: { x: number; y: number; z: number }) => new THREE.Vector3(center.x + h.truck.x + p.x, center.y - 1 + p.y, center.z + h.truck.z + p.z);
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw);
  const back = h.role === 'morpheus' ? truckHoodBack(h) : 0, recovering = h.role === 'morpheus' && h.phase === 'impact';
  const falling = h.role === 'morpheus' && h.phase === 'falling', approach = falling ? THREE.MathUtils.smoothstep(back, .7, 1) : 1;
  const car = ['niobe', 'ghost'].includes(h.role), hood = h.role === 'morpheus' && ['impact', 'hood', 'passing', 'ready', 'running'].includes(h.phase);
  if (back) {
    const pelvis = rig.hero?.bones.get('pelvis') ?? rig.torso;
    pelvis.rotation.x = -Math.atan(1.85/1.1) * back + (rig.hero ? 0 : pelvis.rotation.x * (1-back));
  }
  rig.root.updateWorldMatrix(true, true);
  if ((recovering || falling && approach > 0) && rig.hero) {
    // Refresh skinned bind inverses before sampling the newly moved body.
    rig.root.updateMatrixWorld(true);
    let samples = backSamples.get(rig);
    if (!samples) {
      let mesh: THREE.SkinnedMesh | undefined;
      rig.hero.root.traverse(object => { if (object instanceof THREE.SkinnedMesh && /Tailored.coat.upper/.test(object.name)) mesh = object; });
      if (mesh) {
        const position = mesh.geometry.attributes.position, indices: number[] = [];
        const stride = Math.max(1,Math.floor(position.count/360));
        for(let i=0;i<position.count;i+=stride)if(position.getZ(i)<-.12&&position.getY(i)>2.1)indices.push(i);
        samples={mesh,indices}; backSamples.set(rig,samples);
      }
    }
    if (samples) {
      let lowest=Infinity;
      for(const index of samples.indices) {
        const local=samples.mesh.localToWorld(samples.mesh.getVertexPosition(index,new THREE.Vector3())).sub(world({x:h.car.x,y:0,z:h.car.z})).applyAxisAngle(new THREE.Vector3(0,1,0),-h.car.yaw);
        if(Math.abs(local.x)<1.73&&local.z>=-.65&&local.z<=1.2)lowest=Math.min(lowest,local.y-truckHoodHeight(local.z));
      }
      if(Number.isFinite(lowest)) {
        const bounce=h.elapsed<TRUCK_HOOD.back.settle ? TRUCK_HOOD.back.recoil*Math.sin(Math.PI*h.elapsed/TRUCK_HOOD.back.settle) : 0;
        const above = falling ? Math.max(0,p.y-truckHoodHeight(TRUCK_HOOD.back.z)+TRUCK_HOOD.back.rootDrop) : 0;
        const correction = falling ? (.09+above-lowest)*approach : back===1 ? .09+bounce-lowest : Math.max(0,.09-lowest);
        rig.hero.bones.get('pelvis')!.position.y += correction; rig.root.updateWorldMatrix(true,true);
      }
    }
  }
  if (h.role === 'morpheus' && h.phase === 'flight' && h.kickQueued && h.elapsed >= 1) {
    const hip = rig.hero?.bones.get('hip_R') ?? rig.hips[0], knee = rig.hero?.bones.get('knee_R') ?? rig.knees[0], ankle = rig.hero?.bones.get('ankle_R') ?? rig.ankles[0];
    reach(hip, knee, ankle.position, world({ x: .15, y: 9.6, z: -7.54 }), new THREE.Vector3(-.3, .4, -1));
    ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
  }
  for (const [i, side] of ['R', 'L'].entries()) {
    const bones = rig.hero?.bones, hip = bones?.get(`hip_${side}`) ?? rig.hips[i], knee = bones?.get(`knee_${side}`) ?? rig.knees[i], ankle = bones?.get(`ankle_${side}`) ?? rig.ankles[i];
    const footHeight = rig.hero?.footHeight ?? .155;
    if (car || hood || falling && approach > 0 || h.phase === 'landing' || h.role === 'agent_johnson' && h.kicked === undefined) {
      const offset = new THREE.Vector3(i ? .43 : -.43, footHeight, i ? -.22 : .22).applyQuaternion(rotation);
      const foot = world(p).add(offset);
      if (car) {
        const seat = TRUCK_HOOD[h.role === 'niobe' ? 'driver' : 'passenger'];
        foot.copy(world(truckHoodCarPoint(h, { x: seat.x + (i ? .28 : -.28), y: .68 + footHeight, z: .4 })));
      } else if (hood || falling) {
        let lift = 0;
        if (recovering || falling) {
          const z=THREE.MathUtils.lerp(3.1+(i ? -.22 : .22),2.45,back);
          foot.copy(world(truckHoodCarPoint(h,{x:i ? -.43 : .43,y:0,z}))); lift = .75*back;
        }
        if (h.phase === 'running') {
          const cycle = h.elapsed / .24 + (i ? .5 : 0), step = Math.floor(cycle), progress = cycle - step;
          const start = (step - (i ? .5 : 0)) * .24, swing = Math.min(1, progress / .55);
          const z = THREE.MathUtils.lerp(truckHoodRunZ(start), truckHoodRunZ(start + .24), THREE.MathUtils.smoothstep(swing, 0, 1));
          foot.copy(world(truckHoodCarPoint(h, { x: h.balance + (i ? -.43 : .43), y: 0, z })));
          lift = progress < .55 ? Math.sin(Math.PI * swing) * .32 : 0;
        }
        const local = new THREE.Vector3(foot.x - center.x - h.truck.x - h.car.x, 0, foot.z - center.z - h.truck.z - h.car.z)
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), -h.car.yaw);
        const pitch = local.z >= 1.2 ? Math.atan(.085) : Math.atan(1.1 / 1.85);
        foot.y = center.y - 1 + truckHoodHeight(local.z) + footHeight / Math.cos(pitch) + lift;
        if (falling) foot.lerpVectors(ankle.getWorldPosition(new THREE.Vector3()),foot,approach);
        rotation.setFromEuler(new THREE.Euler(pitch, h.car.yaw, 0, 'YXZ')).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p.yaw-h.car.yaw));
      }
      reach(hip, knee, ankle.position, foot, new THREE.Vector3(i ? .3 : -.3, recovering || falling ? 1 : .25, .8).applyQuaternion(rotation));
      ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
      rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw);
    }
    if (h.role === 'niobe' || h.role === 'morpheus' && (h.phase === 'hood' || recovering || falling && approach > 0)) {
      const contact = h.role === 'niobe'
        ? truckHoodCarPoint(h, { x: TRUCK_HOOD.driver.x + (i ? .32 : -.32), ...TRUCK_HOOD.wheel })
        : truckHoodCarPoint(h, { x: h.balance + (i ? 1 : -1)*THREE.MathUtils.lerp(.66,1.3,back),
          y: THREE.MathUtils.lerp(truckHoodHeight(3.7)+.12,truckHoodHeight(.6)+.9,back), z: THREE.MathUtils.lerp(3.7,.6,back) });
      const shoulder = bones?.get(`shoulder_${side}`) ?? rig.shoulders[i], elbow = bones?.get(`elbow_${side}`) ?? rig.elbows[i], wrist = bones?.get(`wrist_${side}`);
      const q = rotation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, i ? Math.PI / 2 : -Math.PI / 2)));
      if (wrist) {
        const palm = new THREE.Vector3(i ? -.09 : .09, -.18, .02).multiply(wrist.getWorldScale(new THREE.Vector3()));
        const target = world(contact);
        if (falling) { target.lerpVectors(wrist.localToWorld(new THREE.Vector3(i ? -.09 : .09,-.18,.02)),target,approach); q.slerp(wrist.getWorldQuaternion(new THREE.Quaternion()),1-approach); }
        reach(shoulder, elbow, wrist.position, target.sub(palm.applyQuaternion(q)), new THREE.Vector3(i ? .8 : -.8, -.2, -.5).applyQuaternion(rotation));
        wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));
      } else reach(shoulder, elbow, new THREE.Vector3(0, -.75, .005), world(contact), new THREE.Vector3(i ? 1 : -1, .2, -.4).applyQuaternion(rotation));
    }
  }
  // Keep the low coat above the shared hood/roof while retaining its saved fold.
  if (rig.hero && h.role === 'morpheus' && (hood || h.phase === 'falling' || h.phase === 'landing')) {
    rig.root.updateWorldMatrix(true, true);
    for (const panel of rig.hero.panels) {
      const position = panel.mesh.geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        const v = panel.mesh.localToWorld(new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i)));
        const carLocal = v.clone().sub(world({ x: h.car.x, y: 0, z: h.car.z })).applyAxisAngle(new THREE.Vector3(0, 1, 0), -h.car.yaw);
        if ((hood || h.phase === 'falling') && Math.abs(carLocal.x) < 2.06 && carLocal.z >= -.65 && carLocal.z <= 4.65) v.y = Math.max(v.y, center.y - 1 + truckHoodHeight(carLocal.z) + .075);
        if (h.phase === 'landing') v.y = Math.max(v.y, center.y - 1 + 6.68);
        panel.mesh.worldToLocal(v); position.setXYZ(i, v.x, v.y, v.z);
      }
      panel.velocity.fill(0); position.needsUpdate = true; panel.mesh.geometry.computeVertexNormals();
    }
  }
  rig.root.updateWorldMatrix(true, true);
}
