import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { HEL_DISARM, HEL_BREAKOUT, HEL_TRIO, helAttendantPose, helDisarmGun, helDisarmCollector, helTerraceFloor, helSoleFloor, helBreakoutGuard, type HelDisarm, type HelDisarmRole, type FilmJourney } from '@auto_matrix/shared';
import { reach } from '../agents/SpoonPerformance.js';
import { createHelPistol } from '../agents/HelPistolModel.js';

type Performer = { root: THREE.Group; bones: Map<string, THREE.Bone>; pelvis: THREE.Vector3; feet: THREE.Vector3[];
  rest: Map<string, THREE.Quaternion>; gun?: THREE.Group };

/** Rigged background performers for the Hel coat check and dance floor. */
export class HelClubPerformers {
  private root = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private skeletons = new Set<THREE.Skeleton>();
  private crowd: Performer[] = [];
  private guard?: Performer;
  private attendant?: Performer;
  private disposed = false;
  loaded = false;
  readonly ready: Promise<void>;
  get coatcheckAttendant(): THREE.Group | undefined { return this.attendant?.root; }

  constructor(parent: THREE.Group) {
    this.root.name = 'hel-performers'; parent.add(this.root);
    this.ready = this.load();
  }

  private async load(): Promise<void> {
    const assets = await Promise.all(['male', 'female'].map(sex => new GLTFLoader().loadAsync(`/assets/characters/club-${sex}.glb`)));
    for (const asset of assets) asset.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      this.geometries.add(object.geometry);
      const material = object.material as THREE.MeshStandardMaterial;
      this.materials.add(material);
      for (const texture of [material.map, material.normalMap, material.roughnessMap]) if (texture) this.textures.add(texture);
      if (object instanceof THREE.SkinnedMesh) this.skeletons.add(object.skeleton);
    });
    if (this.disposed) { this.release(); return; }
    for (let i = 0; i < 12; i++) this.crowd.push(this.make(assets[i % 2].scene, `hel-dancer-${i}`, i));
    const steel = new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: .3, metalness: .82 }); this.materials.add(steel);
    this.crowd.slice(0, 3).forEach((person, i) => {
      const gun = createHelPistol(steel); gun.name = `hel-collected-gun-${HEL_TRIO[i]}`; gun.visible = false;
      gun.scale.setScalar(1 / .88); person.root.add(gun); person.gun = gun;
      gun.traverse(object => { if (object instanceof THREE.Mesh) this.geometries.add(object.geometry); });
    });
    this.guard = this.make(assets[0].scene, 'hel-rigged-guard', 12);
    this.attendant = this.make(assets[1].scene, 'hel-coatcheck-attendant', 13);
    this.dressAttendant(this.attendant);
    this.loaded = true;
  }

  private make(source: THREE.Group, name: string, index: number): Performer {
    const root = clone(source) as THREE.Group; root.name = name; root.scale.setScalar(.88);
    const bones = new Map<string, THREE.Bone>();
    const colors = [0x25252b, 0x33252a, 0x49483a, 0x473036, 0x383e3a, 0x302732];
    root.traverse(object => {
      if (object instanceof THREE.Bone) bones.set(object.name, object);
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = false; object.receiveShadow = true;
      if (object instanceof THREE.SkinnedMesh) { object.frustumCulled = false; this.skeletons.add(object.skeleton); }
      const material = object.material as THREE.MeshStandardMaterial;
      if (/Coat|Trousers/.test(material.name)) {
        const copy = material.clone(); copy.color.setHex(index === 13 ? 0x080b09 : colors[index % colors.length]);
        object.material = copy; this.materials.add(copy);
      }
    });
    this.root.add(root);
    root.updateMatrixWorld(true);
    return { root, bones, rest: new Map([...bones].map(([name, bone]) => [name, bone.quaternion.clone()])), pelvis: bones.get('pelvis')?.position.clone() ?? new THREE.Vector3(),
      feet: ['R', 'L'].map(side => root.worldToLocal(bones.get('ankle_' + side)!.getWorldPosition(new THREE.Vector3()))) };
  }

  private dressAttendant(person: Performer): void {
    const green = new THREE.MeshStandardMaterial({ color: 0x218527, roughness: .22, metalness: .14 }); this.materials.add(green);
    const top = person.root.getObjectByName('Black crew neck') as THREE.Mesh; if (top) { top.material = green; top.name = 'hel-attendant-green-bodice'; }
    person.root.traverse(object => {
      if (!(object instanceof THREE.SkinnedMesh) || (object.material as THREE.Material).name !== 'Skin') return;
      const geometry = object.geometry.clone(), colors: number[] = [], index = geometry.attributes.skinIndex, weights = geometry.attributes.skinWeight;
      for (let v = 0; v < geometry.attributes.position.count; v++) {
        let glove = 0;
        for (let i = 0; i < 4; i++) if (/^(elbow|wrist|finger)/.test(object.skeleton.bones[index.getComponent(v, i)].name)) glove += weights.getComponent(v, i);
        const value = glove > .5 ? .035 : 1; colors.push(value, value, value);
      }
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); object.geometry = geometry; this.geometries.add(geometry);
      const material = (object.material as THREE.MeshStandardMaterial).clone(); material.vertexColors = true; object.material = material; this.materials.add(material);
    });
    const chest = person.bones.get('chest')!; person.root.updateMatrixWorld(true);
    for (const side of [-1, 1]) {
      const points = [[side * .35, 3.03, .27], [side * .33, 3.45, .22], [side * .23, 3.69, .04]].map(([x, y, z]) => chest.worldToLocal(person.root.localToWorld(new THREE.Vector3(x, y, z))));
      const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 10, .045, 6, false); this.geometries.add(geometry);
      const strap = new THREE.Mesh(geometry, green); strap.name = 'hel-attendant-halter-strap'; chest.add(strap);
    }
  }

  private crouchAttendant(person: Performer, crouch: number): void {
    const { bones, pelvis } = person, hip = bones.get('pelvis')!;
    hip.position.copy(pelvis); hip.position.y -= 1.12 * crouch;
    bones.get('spine')!.rotation.set(.18 * crouch, 0, 0); bones.get('chest')!.rotation.set(.38 * crouch, 0, 0);
    bones.get('head')!.rotation.set(-.15 * crouch, 0, 0); person.root.updateWorldMatrix(true, true);
    const orientation = person.root.getWorldQuaternion(new THREE.Quaternion());
    for (const [i, side] of ['R', 'L'].entries()) {
      const upper = bones.get('hip_' + side)!, knee = bones.get('knee_' + side)!, ankle = bones.get('ankle_' + side)!;
      const target = person.feet[i].clone(); target.z += crouch * .22; target.x += (i ? 1 : -1) * .08 * crouch;
      if (person.gun) {
        const floorPoint = person.root.parent!.worldToLocal(person.root.localToWorld(target.clone()));
        target.y += (helSoleFloor(floorPoint.x, floorPoint.z, person.root.rotation.y) - person.root.position.y + .035) / .88;
      }
      reach(upper, knee, ankle.position.clone(), person.root.localToWorld(target), new THREE.Vector3(i ? .3 : -.3, .2, 1).applyQuaternion(orientation));
      ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    }
    person.root.updateWorldMatrix(true, true);
    for (const [i, side] of ['R', 'L'].entries()) {
      const upper = bones.get('shoulder_' + side)!, elbow = bones.get('elbow_' + side)!, wrist = bones.get('wrist_' + side)!;
      const target = bones.get('head')!.localToWorld(new THREE.Vector3(i ? .4 : -.4, .12, .07));
      const point = wrist.getWorldPosition(new THREE.Vector3()).lerp(target, crouch);
      reach(upper, elbow, wrist.position.clone(), point, new THREE.Vector3(i ? .5 : -.5, -.3, .2).applyQuaternion(orientation));
    }
    person.root.updateWorldMatrix(true, true);
  }

  private pose(person: Performer, beat: number, crouch = 0, dancer = -1): void {
    const { bones, pelvis } = person;
    const weight = Math.sin(beat) * .07;
    const hip = bones.get('pelvis');
    if (hip) { hip.position.copy(pelvis); hip.position.y -= .04 + Math.abs(weight) * .6 + crouch * .55; hip.rotation.z = weight * .5; }
    bones.get('spine')?.rotation.set(crouch * .3, 0, -weight * .7);
    bones.get('chest')?.rotation.set(crouch * .46, Math.sin(beat * .5) * .08, -weight);
    bones.get('head')?.rotation.set(-crouch * .2, Math.sin(beat * .24) * .12, weight * .3);
    for (const side of ['R', 'L']) {
      const sign = side === 'R' ? 1 : -1;
      const sway = Math.sin(beat + sign) * .12;
      const raised = dancer >= 0 && (dancer + (side === 'R' ? 0 : 1)) % 3 === 0;
      bones.get('shoulder_' + side)?.rotation.set(-.3 + sway - crouch * .45 - (raised ? .24 : 0), 0,
        sign * (.12 + crouch * .24 + (raised ? .6 : 0)));
      bones.get('elbow_' + side)?.rotation.set(-.6 + sway - crouch * .4 - (raised ? .2 : 0), 0, 0);
      bones.get('hip_' + side)?.rotation.set(-.06 + sway * .3 + crouch * .65, 0, sign * .07);
      const knee = bones.get('knee_' + side); if (knee) knee.rotation.x = .12 + Math.abs(sway) * .3 + crouch * 1.1;
    }
  }

  private collect(person: Performer, disarm: HelDisarm, role: HelDisarmRole): void {
    const t = Math.min(HEL_DISARM.seconds, disarm.elapsed), at = helDisarmCollector(disarm, role);
    person.root.position.set(at.x, at.y, at.z); person.root.rotation.set(0, at.yaw, 0);
    const crouch = (role === 'trinity' ? 1.65 : 1.2) * THREE.MathUtils.smoothstep(t, 1.4, HEL_DISARM.pickup)
      * (1 - THREE.MathUtils.smoothstep(t, HEL_DISARM.pickup, HEL_DISARM.seconds));
    this.crouchAttendant(person, crouch);
    person.bones.get('spine')!.rotation.x += (role === 'morpheus' ? .75 : role === 'seraph' ? .85 : .25) * crouch; person.bones.get('chest')!.rotation.x += .22 * crouch;
    person.bones.get('head')!.rotation.x -= .3 * crouch; person.root.updateWorldMatrix(true, true);
    const gun = helDisarmGun({ ...disarm, elapsed: t }, role), world = person.root.parent!.localToWorld(new THREE.Vector3(gun.x, gun.y, gun.z));
    const orientation = new THREE.Quaternion().setFromEuler(new THREE.Euler(gun.pitch, gun.yaw, gun.roll, 'YXZ'));
    const parentRotation = person.root.parent!.getWorldQuaternion(new THREE.Quaternion()); orientation.premultiply(parentRotation);
    const side = role === 'morpheus' ? 'L' : 'R', brace = side === 'R' ? 'L' : 'R';
    const wrist = person.bones.get('wrist_' + side)!, elbow = person.bones.get('elbow_' + side)!, shoulder = person.bones.get('shoulder_' + side)!;
    const grip = world.clone().sub(new THREE.Vector3(0, -.08, .13).applyQuaternion(orientation));
    const target = wrist.getWorldPosition(new THREE.Vector3()).lerp(grip, THREE.MathUtils.smoothstep(t, 1.4, HEL_DISARM.pickup));
    reach(shoulder, elbow, wrist.position.clone(), target, new THREE.Vector3(-.5, -.5, .4).applyQuaternion(person.root.getWorldQuaternion(new THREE.Quaternion())));
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    const left = person.bones.get('wrist_' + brace)!, leftElbow = person.bones.get('elbow_' + brace)!;
    reach(person.bones.get('shoulder_' + brace)!, leftElbow, left.position.clone(), person.bones.get('knee_' + brace)!.localToWorld(new THREE.Vector3(0, .2, .1)),
      new THREE.Vector3(.4, -.5, .3).applyQuaternion(person.root.getWorldQuaternion(new THREE.Quaternion())));
    const fingers = THREE.MathUtils.smoothstep(t, HEL_DISARM.pickup, HEL_DISARM.pickup + .3);
    for (const [name, bone] of person.bones) if (new RegExp(`^finger[3-5]-[1-3]_${side}$`).test(name)) bone.rotation.z += fingers * (side === 'R' ? .7 : -.7);
    person.root.updateWorldMatrix(true, true);
    if (person.gun) {
      person.gun.visible = disarm.elapsed >= HEL_DISARM.seconds;
      person.gun.position.copy(person.root.worldToLocal(world));
      person.gun.quaternion.copy(person.root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    }
  }

  update(journey: FilmJourney | undefined, time: number): void {
    if (!this.loaded) return;
    const scene = journey?.visiting ?? journey?.scene;
    const phase = scene === 'm3_hel_bargain' && !journey?.visiting ? journey?.helBargain?.phase : undefined;
    const entering = scene === 'm3_hel_entry' && !journey?.visiting && ((journey?.step ?? 0) > 3
      || journey?.helDanceDoor?.phase === 'open' || journey?.helDanceDoor?.phase === 'opening' && journey.helDanceDoor.elapsed > .7);
    this.crowd.forEach((person, i) => {
      for (const [name, rotation] of person.rest) person.bones.get(name)!.quaternion.copy(rotation);
      if (person.gun) person.gun.visible = false;
      person.root.visible = entering || Boolean(phase) && phase !== 'released';
      const side = i % 2 ? 1 : -1;
      const beat = time * 2.7 + i * 1.39;
      person.root.position.set(side * (i < 6 ? 2.8 + Math.floor(i / 2) * .35 : 5.5 + Math.floor(i / 4) * 1.1)
        + (['windup', 'evade', 'counter', 'airborne', 'gunpoint'].includes(phase ?? '') ? side * 1.6 : 0),
        phase ? 0 : Math.abs(Math.sin(beat)) * .035, -6 - Math.floor(i / 2) * 4.3);
      person.root.rotation.y = side * .4 + Math.sin(time * .7 + i) * .12;
      this.pose(person, beat, phase ? .18 : 0, phase ? -1 : i);
      if (phase) {
        const disarm = journey!.helBargain!.disarm;
        if (disarm && i < HEL_TRIO.length) {
          this.pose(person, 0); this.collect(person, disarm, HEL_TRIO[i]);
          if (i === 2 && (['catching', 'gunpoint', 'failed'].includes(phase) || phase === 'airborne'
            && (!journey!.helBargain!.breakout || journey!.helBargain!.elapsed >= HEL_BREAKOUT.kick))) person.gun!.visible = false;
        } else {
          const theta = -Math.PI * .88 + i / 11 * Math.PI * 1.76;
          const x = Math.sin(theta) * 6.4, z = -26.5 + Math.cos(theta) * 5.4;
          person.root.position.set(x, helTerraceFloor(x, z), z); person.root.rotation.set(0, Math.atan2(-x, -27.5 - z), 0);
          this.pose(person, 0);
        }
      }
    });
    if (this.guard) {
      for (const [name, rotation] of this.guard.rest) this.guard.bones.get(name)!.quaternion.copy(rotation);
      this.guard.root.visible = Boolean(phase) && !['armed', 'released'].includes(phase ?? '');
      const bargain = journey?.helBargain, start = bargain?.breakout?.guard ?? bargain?.rush;
      if (start) {
        const clock = phase === 'airborne' ? bargain!.elapsed : ['catching', 'gunpoint'].includes(phase ?? '') ? 1 : 0;
        const at = helBreakoutGuard(start, clock);
        this.guard.root.position.set(at.x, at.y, at.z); this.guard.root.rotation.set(0, at.yaw, 0);
        this.pose(this.guard, 0); this.crouchAttendant(this.guard, at.recoil * .22);
        this.guard.bones.get('chest')!.rotation.x -= at.recoil * .35;
        this.guard.bones.get('head')!.rotation.x -= at.recoil * .12;
        this.guard.bones.get('shoulder_R')!.rotation.set(-.85 + at.recoil * .25, 0, .25);
        this.guard.bones.get('elbow_R')!.rotation.set(-.8, 0, 0);
      } else {
        const z = phase === 'windup' || phase === 'evade' ? -30.5 - Math.min(1, bargain?.elapsed ?? 0) : -31.5;
        this.guard.root.position.set(2.1, helTerraceFloor(2.1, z), z);
        this.guard.root.rotation.set(0, Math.PI, 0); this.pose(this.guard, 0, phase === 'gunpoint' ? .3 : 0);
      }
    }
    if (this.attendant) {
      const coatcheck = scene === 'm3_hel_entry' && !journey?.visiting ? journey?.helCoatcheck : undefined;
      this.attendant.root.visible = scene === 'm3_hel_entry' && (journey?.step ?? 0) <= 2;
      const pose = helAttendantPose(coatcheck);
      this.attendant.root.position.set(pose.x, 0, pose.z); this.attendant.root.rotation.y = pose.yaw;
      this.pose(this.attendant, coatcheck?.rescuePhysical ? 0 : time * 1.6, pose.crouch);
      if (coatcheck?.rescuePhysical) this.crouchAttendant(this.attendant, pose.crouch);
    }
  }

  private release(): void {
    this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose());
    this.textures.forEach(t => t.dispose()); this.skeletons.forEach(s => s.dispose());
    this.geometries.clear(); this.materials.clear(); this.textures.clear(); this.skeletons.clear();
  }
  dispose(): void { this.disposed = true; this.release(); this.root.removeFromParent(); }
}
