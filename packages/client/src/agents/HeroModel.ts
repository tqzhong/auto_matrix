import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { APARTMENT, FILM_SETS, OFFICE_WINDOW, officeWindowPose, officeCrossingPose, pillPose, lafayetteKnockPose, lafayetteWelcomePose } from '@auto_matrix/shared';
import type { advanceMotion, MotionInput, MotionState } from './CharacterMotion.js';

import { PillPerformance } from './PillPerformance.js';
import { InterrogationPerformance } from './InterrogationPerformance.js';
import { MeetingPerformance } from './MeetingPerformance.js';
import { LafayetteWelcomePerformance } from './LafayetteWelcomePerformance.js';
import { LafayetteKnockPerformance } from './LafayetteKnockPerformance.js';
import { RecoveryPerformance } from './RecoveryPerformance.js';
import { OfficeWorkdayPerformance } from './OfficeWorkdayPerformance.js';
import { ApartmentPerformance } from './ApartmentPerformance.js';
import { WakeCallPerformance } from './WakeCallPerformance.js';
import { clubCloseness } from '@auto_matrix/shared';

type Pose = ReturnType<typeof advanceMotion>;
interface CoatPanel { mesh: THREE.Mesh; rest: Float32Array; velocity: Float32Array }
export interface HeroRig {
  root: THREE.Group;
  bones: Map<string, THREE.Bone>;
  rest: Map<string, THREE.Vector3>;
  panels: CoatPanel[];
  footHeight: number;
  glasses: THREE.Group;
  silver: { value: number };
  wardrobe: { mesh: THREE.Mesh; color: THREE.Color; outer: boolean; hair: boolean; cloth: boolean }[];
  officeRole?: 'rhineheart' | 'courier';
  apartmentRole?: 'choi' | 'dujour';
}

export const HERO_IDS = ['neo', 'trinity', 'smith', 'morpheus'] as const;
export type HeroId = typeof HERO_IDS[number];

// The inspector and world share these exact skinned assets and motion solver.
export class HeroModels {
  private assets = new Map<HeroId | 'neo-office' | 'choi' | 'dujour', Promise<GLTF>>();
  private disposed = false;
  private pills = new Map<HeroRig, PillPerformance>();
  private interrogations = new Map<HeroRig, InterrogationPerformance>();
  private meetings = new Map<HeroRig, MeetingPerformance>();
  private welcomes = new Map<HeroRig, LafayetteWelcomePerformance>();
  private knocks = new Map<HeroRig, LafayetteKnockPerformance>();
  private recoveries = new Map<HeroRig, RecoveryPerformance>();
  private workdays = new Map<HeroRig, OfficeWorkdayPerformance>();
  private apartments = new Map<HeroRig, ApartmentPerformance>();
  private wakeCalls = new Map<HeroRig, WakeCallPerformance>();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private skeletons = new Set<THREE.Skeleton>();
  private point = new THREE.Vector3();
  private local = new THREE.Vector3();
  private segment = new THREE.Vector3();
  private closest = new THREE.Vector3();

  constructor(private portrait: THREE.Texture, private fabric: THREE.Texture) {}

  private load(id: HeroId | 'neo-office' | 'choi' | 'dujour'): Promise<GLTF> {
    const existing = this.assets.get(id); if (existing) return existing;
    const promise = new GLTFLoader().loadAsync(`/assets/characters/${id}.glb`).then(asset => {
      asset.scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        this.geometries.add(object.geometry);
        if (object instanceof THREE.SkinnedMesh) this.skeletons.add(object.skeleton);
        const material = object.material as THREE.MeshStandardMaterial;
        this.materials.add(material);
        for (const map of [material.map, material.normalMap]) if (map) { map.anisotropy = 8; this.textures.add(map); }
        if (material.name === 'Skin' && !asset.parser.json.extras.skinBaked) {
          material.onBeforeCompile = shader => {
            shader.uniforms.portraitAtlas = { value: this.portrait };
            shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
              #ifndef USE_UV1
                attribute vec2 uv1;
              #endif
              attribute float _face_weight;
              varying vec2 vPortraitUv;
              varying float vPortraitWeight;`)
              .replace('#include <begin_vertex>', `#include <begin_vertex>
                vPortraitUv = uv1; vPortraitWeight = _face_weight;`);
            shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
              uniform sampler2D portraitAtlas;
              varying vec2 vPortraitUv;
              varying float vPortraitWeight;`)
              .replace('#include <map_fragment>', `#include <map_fragment>
                diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(portraitAtlas, vPortraitUv).rgb, vPortraitWeight);`);
          };
          material.customProgramCacheKey = () => 'hero-registered-face-v2';
        }
        if (material.name === 'Hair cards') {
          material.depthWrite = true; material.alphaToCoverage = true;
          material.bumpMap = material.map; material.bumpScale = .003;
        }
        if (material.name === 'Coat wool' || material.name === 'Coat leather' || material.name === 'Trousers') {
          material.bumpMap = this.fabric; material.bumpScale = .001;
        }
      });
      if (this.disposed) this.release();
      return asset;
    });
    this.assets.set(id, promise); return promise;
  }

  async create(id: HeroId, guard?: 'agent_jones' | 'agent_brown', support?: 'switch' | 'apoc' | 'rhineheart' | 'courier' | 'choi' | 'dujour'): Promise<HeroRig | undefined> {
    const apartmentRole = support === 'choi' || support === 'dujour' ? support : undefined;
    const [asset, office] = await Promise.all([this.load(apartmentRole ?? id), id === 'neo' && !apartmentRole ? this.load('neo-office') : undefined]);
    if (this.disposed) return;
    const root = clone(asset.scene) as THREE.Group;
    const bones = new Map<string, THREE.Bone>(); const rest = new Map<string, THREE.Vector3>();
    root.traverse(object => {
      if (object instanceof THREE.Bone) { bones.set(object.name, object); rest.set(object.name, object.position.clone()); }
      if (object instanceof THREE.Mesh) {
        object.castShadow = object.receiveShadow = true;
        if (object instanceof THREE.SkinnedMesh) { object.frustumCulled = false; this.skeletons.add(object.skeleton); }
      }
    });
    root.updateMatrixWorld(true);
    if (office) {
      const meshes: THREE.SkinnedMesh[] = [];
      office.scene.traverse(object => { if (object instanceof THREE.SkinnedMesh) meshes.push(object); });
      for (const source of meshes) {
        const mesh = new THREE.SkinnedMesh(source.geometry, source.material); mesh.name = source.name; mesh.userData.office = true;
        const skeleton = new THREE.Skeleton(source.skeleton.bones.map(bone => bones.get(bone.name)!), source.skeleton.boneInverses.map(matrix => matrix.clone()));
        mesh.bind(skeleton, source.bindMatrix.clone()); mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = true; mesh.visible = false;
        this.skeletons.add(skeleton); root.add(mesh);
      }
    }
    if (guard) root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !object.name.includes('Anatomical')) return;
      object.geometry = object.geometry.clone(); this.geometries.add(object.geometry);
      const position = object.geometry.attributes.position;
      for (let i = 0; i < position.count; i++) if (position.getY(i) > 3.78) {
        position.setX(i, position.getX(i) * (guard === 'agent_jones' ? .93 : 1.08));
        position.setY(i, 3.78 + (position.getY(i) - 3.78) * (guard === 'agent_jones' ? 1.03 : .96));
      }
      position.needsUpdate = true; object.geometry.computeVertexNormals();
    });
    const head = bones.get('head')!;
    const metadata = asset.parser.json.extras as { eye: number[]; head: number[]; waist: number[] };
    const eye = new THREE.Vector3().fromArray(metadata.eye).sub(new THREE.Vector3().fromArray(metadata.head));
    const glasses = new THREE.Group(); head.add(glasses); this.glasses(glasses, eye, id);
    if (support === 'courier') {
      const uniform = new THREE.MeshStandardMaterial({ color: 0x273d4e, roughness: .92 });
      this.mesh(head, new THREE.SphereGeometry(.285, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), uniform).position.set(0, .11, -.01);
      const brim = this.mesh(head, new THREE.SphereGeometry(.28, 24, 12), uniform); brim.scale.set(1, .055, .7); brim.position.set(0, .12, .23);
    }
    const pelvis = bones.get('pelvis')!;
    const waist = new THREE.Vector3().fromArray(metadata.waist).sub(pelvis.position);
    const panels = id === 'neo' || id === 'morpheus' ? [-1, 1].map(side => this.coat(pelvis, waist, side, id)) : [];
    const footHeight = this.point.setFromMatrixPosition(bones.get('ankle_L')!.matrixWorld).y;
    const silver = { value: 0 }; const wardrobe: HeroRig['wardrobe'] = [];
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
      const source = object.material; const material = source.clone(); this.materials.add(material); object.material = material;
      if (support === 'courier' && material.name === 'Office cotton') material.color.setHex(0x455c6b);
      if (support === 'rhineheart' && /Coat|Trousers/.test(material.name)) material.color.setHex(0x56594f);
      if (support === 'rhineheart' && /Hair|hair|Groom|groom/.test(material.name)) {
        material.onBeforeCompile = shader => { shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.23, 0.24, 0.21), 0.55);'); };
        material.customProgramCacheKey = () => 'manager-hair-standin';
      }
      if ((support === 'switch' || support === 'dujour') && /Hair|hair|Groom|groom/.test(material.name)) {
        material.onBeforeCompile = shader => {
          shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.61, 0.56, 0.41), 0.78);');
        };
        material.customProgramCacheKey = () => 'switch-hair-standin';
      }
      wardrobe.push({ mesh: object, color: material.color.clone(), outer: panels.some(p => p.mesh === object),
        hair: /Hair|hair|Groom|groom/.test(material.name), cloth: /Coat|Trousers/.test(material.name) });
      if (id !== 'neo') return;
      material.onBeforeCompile = (shader, renderer) => {
        source.onBeforeCompile(shader, renderer);
        shader.uniforms.matrixSilver = silver;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLiquidPosition;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLiquidPosition = position;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float matrixSilver;\nvarying vec3 vLiquidPosition;')
          .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
            float liquidRadius = max(0.0, (matrixSilver - 0.15) / 0.85) * 6.0;
            float liquidDistance = distance(vLiquidPosition, vec3(-0.55, 1.8, 0.3));
            liquidDistance += sin(vLiquidPosition.y * 21.0) * sin(vLiquidPosition.x * 14.0) * 0.035;
            float liquidMask = matrixSilver > 0.15 ? 1.0 - smoothstep(liquidRadius - 0.08, liquidRadius, liquidDistance) : 0.0;
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82, 0.86, 0.87), liquidMask);
            roughnessFactor = mix(roughnessFactor, 0.07, liquidMask);
            metalnessFactor = mix(metalnessFactor, 1.0, liquidMask);`);
      };
      material.customProgramCacheKey = () => source.customProgramCacheKey() + '-liquid-mirror-v1';
    });
    const rig: HeroRig = { root, bones, rest, panels, footHeight, glasses, silver, wardrobe, officeRole: support === 'rhineheart' || support === 'courier' ? support : undefined, apartmentRole };
    if (apartmentRole) this.apartments.set(rig, new ApartmentPerformance(rig));
    if (id === 'neo' && !support) this.recoveries.set(rig, new RecoveryPerformance(rig));
    return rig;
  }

  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
    this.geometries.add(geometry); this.materials.add(material);
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }

  private glasses(head: THREE.Group, eye: THREE.Vector3, id: HeroId): void {
    const black = new THREE.MeshPhysicalMaterial({ color: '#060909', metalness: .55, roughness: .19, clearcoat: 1 });
    const frame = new THREE.MeshStandardMaterial({ color: '#121516', metalness: .7, roughness: .3 });
    const width = id === 'morpheus' ? .056 : id === 'smith' ? .062 : id === 'trinity' ? .065 : .064;
    const height = id === 'morpheus' ? .053 : id === 'smith' ? .031 : id === 'trinity' ? .025 : .028;
    const spacing = Math.max(eye.x, width + .01);
    const bridge = new THREE.CatmullRomCurve3([new THREE.Vector3(-spacing + width, .006, .061), new THREE.Vector3(0, .02, .072), new THREE.Vector3(spacing - width, .006, .061)]);
    const origin = new THREE.Vector3(0, eye.y, eye.z);
    this.mesh(head, new THREE.TubeGeometry(bridge, 12, .0035, 6), frame).position.copy(origin);
    for (const side of [-1, 1]) {
      const shape = new THREE.Shape();
      if (id === 'smith') {
        const r = .009;
        shape.moveTo(-width + r, -height); shape.lineTo(width - r, -height); shape.quadraticCurveTo(width, -height, width, -height + r);
        shape.lineTo(width, height - r); shape.quadraticCurveTo(width, height, width - r, height);
        shape.lineTo(-width + r, height); shape.quadraticCurveTo(-width, height, -width, height - r);
        shape.lineTo(-width, -height + r); shape.quadraticCurveTo(-width, -height, -width + r, -height);
      } else shape.absellipse(0, 0, width, height, 0, Math.PI * 2, false, 0);
      const geometry = new THREE.ShapeGeometry(shape, 40);
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) positions.setZ(i, -.17 * positions.getX(i) * side - positions.getX(i) ** 2 * 1.4);
      geometry.computeVertexNormals();
      const lens = this.mesh(head, geometry, black); lens.position.set(side * spacing, eye.y, eye.z + .077);
      lens.rotation.z = -side * (id === 'trinity' ? .1 : .035);
      const outline = shape.getPoints(48).map(p => new THREE.Vector3(p.x, p.y, -.17 * p.x * side - p.x ** 2 * 1.4));
      const rim = this.mesh(head, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outline, true), 64, .0028, 5, true), frame);
      rim.position.copy(lens.position); rim.rotation.copy(lens.rotation);
      if (id === 'morpheus') continue; // Morpheus wears a rimless pince-nez.
      const temple = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * (spacing + width), eye.y, eye.z + .03), new THREE.Vector3(side * (spacing + width + .025), eye.y + .012, eye.z - .08),
        new THREE.Vector3(side * (spacing + width + .025), eye.y - .015, eye.z - .26),
      ]);
      this.mesh(head, new THREE.TubeGeometry(temple, 16, .004, 6), frame);
    }
  }

  private coat(parent: THREE.Bone, origin: THREE.Vector3, side: number, id: HeroId): CoatPanel {
    const positions: number[] = []; const uv: number[] = []; const indices: number[] = [];
    const rows = 32; const columns = 40;
    for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
      const t = row / rows; const angle = side * (.25 + column / columns * (Math.PI - .29));
      const fold = Math.sin(angle * 11 + t * 1.8) * .012 * t;
      const width = (id === 'morpheus' ? .55 : .49) + .14 * t + fold;
      positions.push(Math.sin(angle) * width, -t * 1.97, Math.cos(angle) * (.33 + .12 * t + fold) + .035);
      uv.push(column / columns, t);
    }
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column; const b = a + columns + 1;
      if (side > 0) indices.push(a, b, a + 1, b, b + 1, a + 1);
      else indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const cloth = new THREE.MeshStandardMaterial({ color: id === 'morpheus' ? new THREE.Color(.012, .009, .008) : new THREE.Color(.007, .009, .011), roughness: id === 'morpheus' ? .36 : .72, side: THREE.DoubleSide, bumpMap: this.fabric, bumpScale: .001 });
    const mesh = this.mesh(parent, geometry, cloth); mesh.position.copy(origin);
    return { mesh, rest: Float32Array.from(positions), velocity: new Float32Array(positions.length) };
  }

  private holdPhone(rig: HeroRig, phone: NonNullable<MotionInput['phone']>, physicalPickup?: THREE.Vector3): void {
    const smooth = (value: number) => { const t = THREE.MathUtils.clamp(value, 0, 1); return t * t * (3 - 2 * t); };
    rig.root.updateWorldMatrix(true, true);
    const shoulder = rig.bones.get('shoulder_R')!; const elbow = rig.bones.get('elbow_R')!; const wrist = rig.bones.get('wrist_R')!;
    const head = rig.bones.get('head')!;
    const ready = new THREE.Vector3(-.38, 2.98, .8); const pickup = physicalPickup?.clone() ?? new THREE.Vector3(-.5, 2.635, 1.2);
    const rest = rig.root.worldToLocal(wrist.getWorldPosition(new THREE.Vector3()));
    const ear = rig.root.worldToLocal(head.localToWorld(new THREE.Vector3(-.43, -.25, .17)));
    const target = phone.phase === 'pickup' ? phone.elapsed < .65 ? rest.lerp(pickup, smooth(phone.elapsed / .65)) : pickup.lerp(ready, smooth((phone.elapsed - .65) / 1.15))
      : phone.phase === 'ready' ? ready : ready.lerp(ear, phone.phase === 'connected' ? 1 : smooth((phone.elapsed - .35) / 1.1));
    rig.root.localToWorld(target);
    const start = shoulder.getWorldPosition(new THREE.Vector3()); const direction = target.clone().sub(start);
    const upper = elbow.position.length(); const lower = wrist.position.length();
    const reach = THREE.MathUtils.clamp(direction.length(), .02, upper + lower - .001); direction.normalize();
    const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
    const rootRotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
    const bend = new THREE.Vector3(-.3, -1, .2).applyQuaternion(rootRotation);
    bend.addScaledVector(direction, -bend.dot(direction)).normalize();
    const hinge = start.clone().addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, upper * upper - along * along)));
    const aim = (joint: THREE.Bone, child: THREE.Bone, point: THREE.Vector3) => {
      const axis = joint.parent!.worldToLocal(point.clone()).sub(joint.position).normalize();
      joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), axis); joint.updateWorldMatrix(false, true);
    };
    aim(shoulder, elbow, hinge); aim(elbow, wrist, target);
    const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, Math.PI));
    const facing = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0));
    const calling = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, -.55));
    const rotation = phone.phase === 'pickup' ? flat.slerp(facing, smooth((phone.elapsed - .65) / 1.15)) : phone.phase === 'ready' ? facing
      : facing.slerp(calling, phone.phase === 'connected' ? 1 : smooth((phone.elapsed - .35) / 1.1));
    const grip = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, Math.PI)).invert();
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rootRotation).multiply(rotation).multiply(grip));
    for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
      const joint = rig.bones.get(`finger${finger}-${segment}_R`); if (joint) joint.rotation.z = finger === 1 ? .25 : .32;
    }
  }

  private openWindow(rig: HeroRig, elapsed: number): void {
    const pose = officeWindowPose(elapsed); if (!pose.reach) return;
    rig.root.updateWorldMatrix(true, true);
    const shoulder = rig.bones.get('shoulder_L')!; const elbow = rig.bones.get('elbow_L')!; const wrist = rig.bones.get('wrist_L')!;
    const grip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), pose.angle))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pose.latch + Math.PI / 2));
    const palm = new THREE.Vector3(0, -.16, .03).applyQuaternion(grip);
    const contact = new THREE.Vector3(pose.handle.z - OFFICE_WINDOW.approachZ, pose.handle.y, OFFICE_WINDOW.approachX - pose.handle.x).sub(palm);
    const target = rig.root.worldToLocal(wrist.getWorldPosition(new THREE.Vector3())).lerp(contact, pose.reach);
    rig.root.localToWorld(target);
    const start = shoulder.getWorldPosition(new THREE.Vector3()); const direction = target.clone().sub(start);
    const upper = elbow.position.length(); const lower = wrist.position.length();
    const reach = THREE.MathUtils.clamp(direction.length(), .02, upper + lower - .001); direction.normalize();
    const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
    const rootRotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
    const bend = new THREE.Vector3(.35, -1, .2).applyQuaternion(rootRotation);
    bend.addScaledVector(direction, -bend.dot(direction)).normalize();
    const hinge = start.clone().addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, upper * upper - along * along)));
    const aim = (joint: THREE.Bone, child: THREE.Bone, point: THREE.Vector3) => {
      const axis = joint.parent!.worldToLocal(point.clone()).sub(joint.position).normalize();
      joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), axis); joint.updateWorldMatrix(false, true);
    };
    aim(shoulder, elbow, hinge); aim(elbow, wrist, target);
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rootRotation).multiply(grip));
    for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
      rig.bones.get(`finger${finger}-${segment}_L`)!.rotation.set(finger === 1 ? .5 * pose.reach : 0, 0, -(finger === 1 ? .2 : segment === 1 ? .7 : 1.05) * pose.reach);
    }
  }

  private crossWindow(rig: HeroRig, elapsed: number): void {
    const pose = officeCrossingPose(elapsed);
    const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
    const local = (point: { x: number; y: number; z: number }) => new THREE.Vector3(point.x - pose.x, point.y - pose.y, point.z - pose.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), -pose.yaw);
    const solve = (upper: THREE.Bone, lower: THREE.Bone, end: THREE.Bone, contact: THREE.Vector3, pole: THREE.Vector3, blend: number) => {
      rig.root.updateWorldMatrix(true, true);
      const target = rig.root.worldToLocal(end.getWorldPosition(new THREE.Vector3())).lerp(contact, blend); rig.root.localToWorld(target);
      const start = upper.getWorldPosition(new THREE.Vector3()); const direction = target.clone().sub(start);
      const a = lower.position.length(); const b = end.position.length();
      const reach = THREE.MathUtils.clamp(direction.length(), .02, a + b - .001); direction.normalize();
      const along = (a * a - b * b + reach * reach) / (2 * reach);
      const bend = pole.applyQuaternion(rotation); bend.addScaledVector(direction, -bend.dot(direction)).normalize();
      const hinge = start.clone().addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along)));
      const aim = (joint: THREE.Bone, child: THREE.Bone, point: THREE.Vector3) => {
        joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), joint.parent!.worldToLocal(point.clone()).sub(joint.position).normalize()); joint.updateWorldMatrix(false, true);
      };
      aim(upper, lower, hinge); aim(lower, end, target);
      return lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation);
    };
    for (const side of ['L', 'R'] as const) {
      const ankle = rig.bones.get('ankle_' + side)!;
      const orientation = solve(rig.bones.get('hip_' + side)!, rig.bones.get('knee_' + side)!, ankle, local(side === 'L' ? pose.left : pose.right), new THREE.Vector3(side === 'L' ? .1 : -.1, 1, .25), pose.blend);
      ankle.quaternion.slerp(orientation, pose.blend);
    }
    const palm = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, Math.PI));
    const wrist = rig.bones.get('wrist_L')!;
    const contact = local(pose.hand).sub(new THREE.Vector3(0, -.16, .03).applyQuaternion(palm));
    const orientation = solve(rig.bones.get('shoulder_L')!, rig.bones.get('elbow_L')!, wrist, contact, new THREE.Vector3(.5, -.4, -.6), pose.grip).multiply(palm);
    wrist.quaternion.slerp(orientation, pose.grip);
    for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) rig.bones.get(`finger${finger}-${segment}_L`)!.rotation.z *= 1 - pose.grip;
  }

  animate(rig: HeroRig, pose: Pose, motion: MotionState, input: MotionInput, delta: number): void {
    rig.silver.value = input.mirror ?? 0;
    rig.glasses.visible = !rig.officeRole && !rig.apartmentRole && input.glasses !== false && !input.realWorld;
    const officeShirt = input.officeShirt || rig.officeRole === 'courier';
    const pod = input.performance && !['touch', 'connect'].includes(input.performance);
    for (const part of rig.wardrobe) {
      part.mesh.visible = !(part.outer && (input.realWorld || input.clubClothes || input.pills?.role === 'neo' || input.meeting || input.wakeCall) || part.hair && pod);
      if (part.mesh.userData.office) part.mesh.visible = Boolean(officeShirt || input.meeting?.role === 'neo' && (part.mesh.material as THREE.Material).name === 'Office skin');
      else if (officeShirt && (part.outer || /Tailored.coat.upper|Black.crew.neck/i.test(part.mesh.name))) part.mesh.visible = false;
      const material = part.mesh.material as THREE.MeshStandardMaterial;
      if (part.cloth && input.realWorld) material.color.setHex(0x706c62); else material.color.copy(part.color);
    }
    const bone = (name: string) => rig.bones.get(name)!;
    const pelvis = bone('pelvis');
    pelvis.position.copy(rig.rest.get('pelvis')!);
    pelvis.position.y += (pose.hipHeight - 1.98) * 1.14;
    pelvis.position.x += pose.sway;
    pelvis.position.z += pose.lunge;
    pelvis.rotation.set(0, -pose.twist * .18, pose.roll * .35);
    bone('spine').rotation.set(pose.lean * .35, pose.twist * .3, pose.roll * .35);
    bone('chest').rotation.set(pose.lean * .65, pose.twist * .7, pose.roll * .3);
    bone('head').rotation.set(-pose.lean * .55, pose.headTurn, -pose.roll * .5);
    if (input.pills) {
      const pills = pillPose(input.pills);
      pelvis.position.z += pills.reach * .16;
      bone('spine').rotation.x += pills.lean * .5; bone('chest').rotation.x += pills.lean * .5;
      bone('head').rotation.x -= pills.lean * .7 + pills.tilt * .08;
    }
    if (input.welcome) {
      const welcome = lafayetteWelcomePose(input.welcome);
      bone('head').rotation.x += welcome.nod * .14;
      bone('spine').rotation.x += welcome.handshake * .045;
      bone('chest').rotation.x += welcome.handshake * .08;
    }
    if (input.knock !== undefined) {
      const knock = lafayetteKnockPose(input.knock);
      bone('spine').rotation.x += knock.raised * .035; bone('chest').rotation.x += knock.raised * .065;
      bone('head').rotation.y -= knock.raised * .1;
    }
    const phonePickup = input.phone?.phase === 'pickup' ? input.phone : input.wakeCall?.phase === 'pickup' ? input.wakeCall : undefined;
    if (phonePickup) {
      const reach = phonePickup.elapsed < .65 ? Math.min(1, phonePickup.elapsed / .65) : Math.max(0, 1 - (phonePickup.elapsed - .65) / 1.15);
      const landline = input.wakeCall?.phase === 'pickup';
      pelvis.position.y -= (landline ? .18 : 0) * reach;
      bone('spine').rotation.x += (landline ? .36 : .3) * reach; bone('chest').rotation.x += (landline ? .7 : .6) * reach; bone('head').rotation.x -= .45 * reach;
    }
    if (input.window !== undefined) {
      const reach = officeWindowPose(input.window).reach;
      bone('spine').rotation.x += .32 * reach; bone('chest').rotation.x += .16 * reach; bone('head').rotation.x -= .25 * reach;
    }
    if (input.crossing !== undefined) {
      const crossing = officeCrossingPose(input.crossing);
      pelvis.rotation.set(0, 0, 0); pelvis.position.x = rig.rest.get('pelvis')!.x; pelvis.position.z = rig.rest.get('pelvis')!.z;
      bone('spine').rotation.set(crossing.lean * .45, 0, 0); bone('chest').rotation.set(crossing.lean * .55, 0, 0); bone('head').rotation.set(-crossing.lean * .7, 0, 0);
    }
    for (const [i, side] of ['R', 'L'].entries()) {
      bone('hip_' + side).rotation.set(pose.legs[i].hip, 0, 0);
      bone('knee_' + side).rotation.set(pose.legs[i].knee, 0, 0);
      bone('ankle_' + side).rotation.set(pose.legs[i].ankle, 0, 0);
      bone('shoulder_' + side).rotation.set(pose.arms[i].shoulder, 0, pose.arms[i].outward * .6);
      bone('elbow_' + side).rotation.set(pose.arms[i].elbow, 0, 0);
      bone('wrist_' + side).quaternion.identity();
      const grip = .15 + pose.arms[i].grip * .9;
      for (let f = 1; f <= 5; f++) for (let s = 1; s <= 3; s++) {
        const finger = bone(`finger${f}-${s}_${side}`);
        const inward = side === 'R' ? 1 : -1;
        finger.rotation.set(f === 1 ? grip * (s === 1 ? .8 : .65) : 0, 0,
          inward * grip * (f === 1 ? .2 : s === 1 ? .85 : 1.1));
      }
    }
    if (input.recovery !== undefined) {
      const t = input.recovery;
      const lie = 1 - THREE.MathUtils.smoothstep(t, 7, 8.6);
      const seated = THREE.MathUtils.smoothstep(t, 7.2, 8.8) * (1 - THREE.MathUtils.smoothstep(t, 9.5, 11.7));
      pelvis.rotation.x = -Math.PI / 2 * lie - .18 * seated;
      bone('spine').rotation.x += .16 * seated;
      bone('chest').rotation.x += .22 * seated;
      bone('head').rotation.x += .12 * lie - .18 * seated;
      for (const [i, side] of ['R', 'L'].entries()) {
        bone('hip_' + side).rotation.x = THREE.MathUtils.lerp(bone('hip_' + side).rotation.x, -1.35, seated);
        bone('knee_' + side).rotation.x = THREE.MathUtils.lerp(bone('knee_' + side).rotation.x, 1.48, seated);
        const tremor = t > 2 && t < 7 ? Math.sin(t * 7 + i * 2.1) * .025 : 0;
        bone('shoulder_' + side).rotation.set(-.14 - seated * .22 + tremor, 0, (i ? 1 : -1) * (.32 * lie + .1));
        bone('elbow_' + side).rotation.x = -.24 - seated * .78;
      }
      const inspect = THREE.MathUtils.smoothstep(t, 6.8, 7.8) * (1 - THREE.MathUtils.smoothstep(t, 8.7, 9.3));
      bone('shoulder_R').rotation.x -= inspect * .72; bone('elbow_R').rotation.x -= inspect * 1.05;
      bone('head').rotation.y += inspect * .28;
    }
    if (input.wakeCall?.phase === 'waking') {
      const t = input.wakeCall.elapsed; const smooth = THREE.MathUtils.smoothstep;
      const lie = 1 - smooth(t, 1.3, 2.75); const sit = smooth(t, 1.15, 2.05) * (1 - smooth(t, 2.7, 3.45));
      pelvis.position.y = THREE.MathUtils.lerp(pelvis.position.y, .62, lie);
      pelvis.rotation.x = THREE.MathUtils.lerp(pelvis.rotation.x, -Math.PI / 2, lie);
      bone('spine').rotation.x += .18 * sit; bone('chest').rotation.x += .28 * sit;
      bone('head').rotation.x += (input.wakeCall.nightmare ? -.18 * Math.sin(Math.min(1, t / .55) * Math.PI) : .08) * lie - .16 * sit;
      for (const side of ['R', 'L']) {
        bone('hip_' + side).rotation.x = THREE.MathUtils.lerp(bone('hip_' + side).rotation.x, -1.28, sit);
        bone('knee_' + side).rotation.x = THREE.MathUtils.lerp(bone('knee_' + side).rotation.x, 1.42, sit);
      }
      if (input.wakeCall.nightmare) {
        const inspect = smooth(t, 1.45, 1.9) * (1 - smooth(t, 2.75, 3.25));
        bone('shoulder_R').rotation.x -= .9 * inspect; bone('elbow_R').rotation.x -= 1.05 * inspect;
        bone('shoulder_L').rotation.x -= .52 * inspect; bone('elbow_L').rotation.x -= .72 * inspect;
        bone('head').rotation.y += .2 * inspect;
      }
    }
    if (input.reveal) {
      const { kind, elapsed: t, role } = input.reveal;
      if (kind === 'construct') {
        const explain = THREE.MathUtils.smoothstep(t, 2, 3.2) * (1 - THREE.MathUtils.smoothstep(t, 8.2, 9.5));
        const shock = THREE.MathUtils.smoothstep(t, 8.8, 10.4);
        if (role === 'morpheus') {
          bone('shoulder_R').rotation.x -= explain * .72; bone('shoulder_R').rotation.z -= explain * .42;
          bone('elbow_R').rotation.x -= explain * .95; bone('head').rotation.y += explain * .16;
        } else {
          bone('head').rotation.y -= .18 * explain; bone('spine').rotation.x += .14 * shock; bone('chest').rotation.x += .2 * shock;
          bone('shoulder_L').rotation.x -= .2 * shock; bone('shoulder_R').rotation.x -= .2 * shock;
        }
      } else {
        const point = THREE.MathUtils.smoothstep(t, 1.3, 2.8) * (1 - THREE.MathUtils.smoothstep(t, 9.5, 11.2));
        const collapse = THREE.MathUtils.smoothstep(t, 10.2, 12.8);
        if (role === 'morpheus') {
          bone('shoulder_R').rotation.x -= point * 1.12; bone('shoulder_R').rotation.z -= point * .35;
          bone('elbow_R').rotation.x -= point * .34; bone('head').rotation.y += point * .13;
        } else {
          bone('head').rotation.y -= point * .18; bone('spine').rotation.x += collapse * .34; bone('chest').rotation.x += collapse * .42;
          for (const side of ['R', 'L']) bone('shoulder_' + side).rotation.x -= collapse * .42;
        }
      }
    }
    if (input.training) {
      const { kind, elapsed: t, role } = input.training;
      if (kind === 'download' && role === 'neo') {
        const connected = THREE.MathUtils.smoothstep(t, .4, 1.8); const waking = THREE.MathUtils.smoothstep(t, 8.2, 9.7);
        pelvis.rotation.x -= .2 * connected * (1 - waking); bone('spine').rotation.x += .12 * connected; bone('chest').rotation.x += .18 * connected;
        bone('head').rotation.x += .08 * connected - .13 * waking;
        const tremor = t > 2 && t < 7.4 ? Math.sin(t * 18) * .022 : 0;
        for (const side of ['R', 'L']) { bone('shoulder_' + side).rotation.x -= .18 * connected + tremor; bone('elbow_' + side).rotation.x -= .42 * connected; }
        bone('wrist_R').rotation.z += Math.sin(t * 11) * .025 * connected;
      } else if (kind === 'jump' && role === 'morpheus') {
        const launch = THREE.MathUtils.smoothstep(t, .65, 1.22); const land = THREE.MathUtils.smoothstep(t, 2.85, 3.35);
        bone('spine').rotation.x -= .34 * launch * (1 - land); bone('chest').rotation.x -= .28 * launch * (1 - land);
        for (const side of ['R', 'L']) {
          bone('shoulder_' + side).rotation.x = THREE.MathUtils.lerp(bone('shoulder_' + side).rotation.x, .9, launch * (1 - land));
          bone('elbow_' + side).rotation.x = THREE.MathUtils.lerp(bone('elbow_' + side).rotation.x, -.65, launch * (1 - land));
          bone('hip_' + side).rotation.x -= .32 * launch * (1 - land); bone('knee_' + side).rotation.x += .58 * launch * (1 - land);
        }
      } else if (kind === 'red_dress') {
        const freeze = THREE.MathUtils.smoothstep(t, 4.7, 5.35); const reveal = THREE.MathUtils.smoothstep(t, 6.1, 6.9);
        if (role === 'neo') {
          bone('head').rotation.y += THREE.MathUtils.lerp(-.22, .18, reveal) * freeze;
          bone('spine').rotation.y -= .08 * reveal; bone('chest').rotation.y -= .12 * reveal;
        } else if (role === 'morpheus') {
          bone('shoulder_R').rotation.x -= .72 * freeze; bone('shoulder_R').rotation.z -= .35 * freeze;
          bone('elbow_R').rotation.x -= .76 * freeze; bone('head').rotation.y += .16 * reveal;
        } else if (role === 'smith') {
          bone('shoulder_R').rotation.x = THREE.MathUtils.lerp(bone('shoulder_R').rotation.x, -1.16, reveal);
          bone('shoulder_R').rotation.z -= .18 * reveal; bone('elbow_R').rotation.x = THREE.MathUtils.lerp(bone('elbow_R').rotation.x, -.34, reveal);
          bone('shoulder_L').rotation.x -= .34 * reveal; bone('elbow_L').rotation.x -= .5 * reveal;
        }
      }
    }
    if (input.club) {
      const close = clubCloseness(input.club); const { role, phase, elapsed: t } = input.club;
      if (role === 'neo') {
        bone('head').rotation.y += close * .38; bone('head').rotation.x += close * .08;
        bone('chest').rotation.y += close * .08;
      } else if (!['crowd', 'approaching', 'departing', 'done'].includes(phase)) {
        bone('spine').rotation.x += close * .07; bone('chest').rotation.x += close * .1;
        bone('head').rotation.y += close * .23; bone('head').rotation.x -= close * .08;
        const emphasis = ['introduction', 'reply'].includes(phase) ? Math.sin(Math.min(1, t / 6) * Math.PI) : 0;
        bone('head').rotation.x += Math.sin(t * 2) * .025 * emphasis;
        bone('shoulder_R').rotation.x -= .18 * emphasis; bone('elbow_R').rotation.x -= .23 * emphasis;
      }
    }
    rig.root.updateWorldMatrix(true, true);
    if (input.grounded && !input.meeting && !input.interrogation && !(input.wakeCall?.phase === 'waking' && input.wakeCall.elapsed < 3.2) && !input.riding && input.climbing === undefined && (!input.performance || input.performance === 'connect')) {
      let lowest = Infinity;
      for (const side of ['R', 'L']) {
        this.point.setFromMatrixPosition(bone('ankle_' + side).matrixWorld); rig.root.worldToLocal(this.point);
        lowest = Math.min(lowest, this.point.y - rig.footHeight);
      }
      pelvis.position.y -= lowest;
      rig.root.updateWorldMatrix(true, true);
    }
    if (input.phone) this.holdPhone(rig, input.phone);
    if (input.wakeCall && input.wakeCall.phase !== 'waking') {
      if (input.wakeCall.phase === 'pickup') {
        const center = FILM_SETS.film_anderson_flat.center; rig.root.updateWorldMatrix(true, true);
        const handset = rig.root.worldToLocal(new THREE.Vector3(center.x + APARTMENT.phone.x, center.y - 1 + APARTMENT.phone.y + .48, center.z + APARTMENT.phone.z + .22));
        this.holdPhone(rig, { phase: 'pickup', elapsed: Math.min(1.8, input.wakeCall.elapsed) }, handset);
      }
      else if (input.wakeCall.phase !== 'reply' || input.wakeCall.elapsed < 3.15) this.holdPhone(rig, { phase: 'connected', elapsed: 2 });
    }
    if (input.window !== undefined) this.openWindow(rig, input.window);
    if (input.crossing !== undefined) this.crossWindow(rig, input.crossing);
    if (input.pills && !this.pills.has(rig)) this.pills.set(rig, new PillPerformance(rig));
    this.pills.get(rig)?.update(input.pills);
    if ((input.interrogation || input.officeShirt) && !this.interrogations.has(rig)) this.interrogations.set(rig, new InterrogationPerformance(rig));
    this.interrogations.get(rig)?.update(input.interrogation, input.officeShirt);
    if (input.meeting && !this.meetings.has(rig)) this.meetings.set(rig, new MeetingPerformance(rig));
    this.meetings.get(rig)?.update(input.meeting);
    if (input.welcome && !this.welcomes.has(rig)) this.welcomes.set(rig, new LafayetteWelcomePerformance(rig));
    this.welcomes.get(rig)?.update(input.welcome);
    if (input.knock !== undefined && !this.knocks.has(rig)) this.knocks.set(rig, new LafayetteKnockPerformance(rig));
    this.knocks.get(rig)?.update(input.knock);
    if (input.recovery !== undefined && !this.recoveries.has(rig)) this.recoveries.set(rig, new RecoveryPerformance(rig));
    this.recoveries.get(rig)?.update(input.recovery, input.realWorld);
    if (input.workday && !this.workdays.has(rig)) this.workdays.set(rig, new OfficeWorkdayPerformance(rig));
    this.workdays.get(rig)?.update(input.workday);
    if (input.contact && !this.apartments.has(rig)) this.apartments.set(rig, new ApartmentPerformance(rig));
    this.apartments.get(rig)?.update(input.contact);
    if (input.wakeCall && !this.wakeCalls.has(rig)) this.wakeCalls.set(rig, new WakeCallPerformance(rig));
    this.wakeCalls.get(rig)?.update(input.wakeCall);
    if (delta <= 0) return;
    const dt = Math.min(delta, 1 / 30);
    // Analytic wind target plus damped springs; the waist is pinned. Thigh and
    // shin capsules stop the running knees from cutting through the coat.
    const capsules = ['R', 'L'].flatMap(side => ['hip', 'knee'].map((part, i) => {
      const start = new THREE.Vector3().setFromMatrixPosition(bone(part + '_' + side).matrixWorld);
      const end = new THREE.Vector3().setFromMatrixPosition(bone((i ? 'ankle' : 'knee') + '_' + side).matrixWorld);
      pelvis.worldToLocal(start); pelvis.worldToLocal(end); return { start, end, radius: i ? .16 : .195 };
    }));
    for (const panel of rig.panels) {
      const position = panel.mesh.geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        const x = panel.rest[i * 3]; const y = panel.rest[i * 3 + 1]; const z = panel.rest[i * 3 + 2];
        const t = Math.max(0, -y / 1.97); const hem = t * t;
        const flare = pose.coat * hem;
        this.point.set(x * (1 + flare * .24), y + flare * .18,
          z - flare * .65 + Math.sin(motion.phase * Math.PI * 2 + y * 3 + x * 3) * flare * .09);
        this.point.x += Math.sin(motion.time * 5 + y * 3) * flare * .035;
        this.point.add(panel.mesh.position);
        if (t > .04) for (const capsule of capsules) {
          this.segment.subVectors(capsule.end, capsule.start);
          const length = this.segment.lengthSq();
          this.local.subVectors(this.point, capsule.start);
          this.closest.copy(capsule.start).addScaledVector(this.segment, THREE.MathUtils.clamp(this.local.dot(this.segment) / length, 0, 1));
          this.local.subVectors(this.point, this.closest); const distance = this.local.length();
          if (distance > .001 && distance < capsule.radius) this.point.addScaledVector(this.local, (capsule.radius - distance) / distance);
        }
        this.point.sub(panel.mesh.position);
        for (let axis = 0; axis < 3; axis++) {
          const offset = i * 3 + axis; const value = position.array[offset]; const target = this.point.getComponent(axis);
          panel.velocity[offset] += ((target - value) * 150 - panel.velocity[offset] * 24) * dt;
          position.array[offset] = t < .04 ? panel.rest[offset] : value + panel.velocity[offset] * dt;
        }
      }
      position.needsUpdate = true; panel.mesh.geometry.computeVertexNormals();
    }
  }

  private release(): void {
    this.pills.forEach(p => p.dispose()); this.pills.clear();
    this.interrogations.forEach(p => p.dispose()); this.interrogations.clear();
    this.meetings.forEach(p => p.dispose()); this.meetings.clear();
    this.welcomes.forEach(p => p.dispose()); this.welcomes.clear(); this.knocks.forEach(p => p.dispose()); this.knocks.clear();
    this.recoveries.forEach(p => p.dispose()); this.recoveries.clear();
    this.workdays.forEach(p => p.dispose()); this.workdays.clear();
    this.apartments.forEach(p => p.dispose()); this.apartments.clear();
    this.wakeCalls.forEach(p => p.dispose()); this.wakeCalls.clear();
    this.geometries.forEach(value => value.dispose()); this.materials.forEach(value => value.dispose());
    this.textures.forEach(value => value.dispose()); this.skeletons.forEach(value => value.dispose());
    this.geometries.clear(); this.materials.clear(); this.textures.clear(); this.skeletons.clear();
  }
  dispose(): void { this.disposed = true; this.release(); }
}
