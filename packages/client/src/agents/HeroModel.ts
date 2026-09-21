import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { advanceMotion, MotionInput, MotionState } from './CharacterMotion.js';

type Pose = ReturnType<typeof advanceMotion>;
interface CoatPanel { mesh: THREE.Mesh; rest: Float32Array; velocity: Float32Array }
export interface HeroRig {
  root: THREE.Group;
  bones: Map<string, THREE.Bone>;
  rest: Map<string, THREE.Vector3>;
  panels: CoatPanel[];
  footHeight: number;
  glasses: THREE.Group;
}

export const HERO_IDS = ['neo', 'trinity', 'smith', 'morpheus'] as const;
export type HeroId = typeof HERO_IDS[number];

// The inspector and world share these exact skinned assets and motion solver.
export class HeroModels {
  private assets = new Map<HeroId, Promise<GLTF>>();
  private disposed = false;
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private skeletons = new Set<THREE.Skeleton>();
  private point = new THREE.Vector3();
  private local = new THREE.Vector3();
  private segment = new THREE.Vector3();
  private closest = new THREE.Vector3();

  constructor(private portrait: THREE.Texture, private fabric: THREE.Texture) {}

  private load(id: HeroId): Promise<GLTF> {
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

  async create(id: HeroId): Promise<HeroRig | undefined> {
    const asset = await this.load(id);
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
    const head = bones.get('head')!;
    const metadata = asset.parser.json.extras as { eye: number[]; head: number[]; waist: number[] };
    const eye = new THREE.Vector3().fromArray(metadata.eye).sub(new THREE.Vector3().fromArray(metadata.head));
    const glasses = new THREE.Group(); head.add(glasses); this.glasses(glasses, eye, id);
    const pelvis = bones.get('pelvis')!;
    const waist = new THREE.Vector3().fromArray(metadata.waist).sub(pelvis.position);
    const panels = id === 'neo' || id === 'morpheus' ? [-1, 1].map(side => this.coat(pelvis, waist, side, id)) : [];
    const footHeight = this.point.setFromMatrixPosition(bones.get('ankle_L')!.matrixWorld).y;
    return { root, bones, rest, panels, footHeight, glasses };
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

  animate(rig: HeroRig, pose: Pose, motion: MotionState, input: MotionInput, delta: number): void {
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
    for (const [i, side] of ['R', 'L'].entries()) {
      bone('hip_' + side).rotation.set(pose.legs[i].hip, 0, 0);
      bone('knee_' + side).rotation.x = pose.legs[i].knee;
      bone('ankle_' + side).rotation.x = pose.legs[i].ankle;
      bone('shoulder_' + side).rotation.set(pose.arms[i].shoulder, 0, pose.arms[i].outward * .6);
      bone('elbow_' + side).rotation.x = pose.arms[i].elbow;
      const grip = .15 + pose.arms[i].grip * .9;
      for (let f = 1; f <= 5; f++) for (let s = 1; s <= 3; s++) {
        const finger = bone(`finger${f}-${s}_${side}`);
        const inward = side === 'R' ? 1 : -1;
        finger.rotation.set(f === 1 ? grip * (s === 1 ? .8 : .65) : 0, 0,
          inward * grip * (f === 1 ? .2 : s === 1 ? .85 : 1.1));
      }
    }
    rig.root.updateWorldMatrix(true, true);
    if (input.grounded) {
      let lowest = Infinity;
      for (const side of ['R', 'L']) {
        this.point.setFromMatrixPosition(bone('ankle_' + side).matrixWorld); rig.root.worldToLocal(this.point);
        lowest = Math.min(lowest, this.point.y - rig.footHeight);
      }
      pelvis.position.y -= lowest;
      rig.root.updateWorldMatrix(true, true);
    }
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
    this.geometries.forEach(value => value.dispose()); this.materials.forEach(value => value.dispose());
    this.textures.forEach(value => value.dispose()); this.skeletons.forEach(value => value.dispose());
    this.geometries.clear(); this.materials.clear(); this.textures.clear(); this.skeletons.clear();
  }
  dispose(): void { this.disposed = true; this.release(); }
}
