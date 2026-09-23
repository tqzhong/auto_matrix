import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BURLY, oracleVisitPose, type AgentState, type RescueLoadout } from '@auto_matrix/shared';
import { advanceMotion, newMotion, type MotionInput, type MotionState } from './CharacterMotion.js';
import { HERO_IDS, HeroModels, type HeroId, type HeroRig, type HeroSupport } from './HeroModel.js';
import { SpoonModel } from './SpoonModel.js';
import { PhoneModel } from './PhoneModel.js';
import { VisibleGroup } from '../engine/VisibleGroup.js';

interface Look {
  face?: number;
  width: number;
  shoulders: number;
  waist: number;
  hips: number;
  skin: string;
  cloth: string;
  leather: boolean;
  coat: boolean;
  hair: 'short' | 'pixie' | 'bald';
  glasses: 'oval' | 'narrow' | 'square' | 'round' | 'none';
}

const HERO_LOOKS: Record<string, Look> = {
  neo: { face: 0, width: 0.96, shoulders: 0.63, waist: 0.36, hips: 0.43, skin: '#d7af94', cloth: '#151918', leather: false, coat: true, hair: 'short', glasses: 'oval' },
  trinity: { face: 1, width: 0.9, shoulders: 0.53, waist: 0.31, hips: 0.45, skin: '#dcc0aa', cloth: '#141818', leather: true, coat: false, hair: 'pixie', glasses: 'narrow' },
  smith: { face: 2, width: 1.02, shoulders: 0.68, waist: 0.41, hips: 0.46, skin: '#d7b399', cloth: '#252b28', leather: false, coat: false, hair: 'short', glasses: 'square' },
  morpheus: { face: 3, width: 1.13, shoulders: 0.71, waist: 0.44, hips: 0.49, skin: '#89614b', cloth: '#201a18', leather: true, coat: true, hair: 'bald', glasses: 'round' },
  oracle: { width: 1.05, shoulders: 0.62, waist: 0.43, hips: 0.52, skin: '#77513f', cloth: '#79534a', leather: false, coat: false, hair: 'short', glasses: 'none' },
  seraph: { width: .94, shoulders: .58, waist: .34, hips: .4, skin: '#c5a27e', cloth: '#d7d4c6', leather: false, coat: false, hair: 'short', glasses: 'none' },
};

export interface CharacterRig {
  root: THREE.Group;
  detail: THREE.Group;
  distant: THREE.Mesh;
  torso: THREE.Group;
  head: THREE.Group;
  shoulders: THREE.Group[];
  elbows: THREE.Object3D[];
  fingers: THREE.Group[][];
  hips: THREE.Group[];
  knees: THREE.Object3D[];
  ankles: THREE.Group[];
  tails: THREE.Group[];
  cloth: { mesh: THREE.Mesh; rest: Float32Array }[];
  motion: MotionState;
  smallDetails: THREE.Group;
  hero?: HeroRig;
  weapons?: THREE.Group[];
  spoon?: SpoonModel;
  phone?: PhoneModel;
  cookie?: THREE.Group;
  staff?: THREE.Group;
  infection?: THREE.Group;
  rifle?: boolean;
  weaponStyle?: RescueLoadout | 'pistol' | 'pulse';
  muzzleIndex?: number;
}

export function weaponMuzzle(rig: CharacterRig): THREE.Vector3 | undefined {
  if (!rig.weapons?.length) return;
  const gun = rig.weapons[(rig.muzzleIndex ?? 0) % rig.weapons.length]; rig.muzzleIndex = (rig.muzzleIndex ?? 0) + 1;
  gun.updateWorldMatrix(true, false);
  const length = rig.weaponStyle === 'compact' ? .72 : rig.weaponStyle === 'breacher' ? 1.34 : ['rifle', 'pulse'].includes(rig.weaponStyle ?? '') ? 1.2 : .5;
  return gun.localToWorld(new THREE.Vector3(0, -length - .115, 0));
}

// All residents share anatomical proportions and joint animation. The four
// principal characters have distinct face topology, projected albedo and outfits.
export class CharacterModels {
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private skeletons = new Set<THREE.Skeleton>();
  private spoons = new Set<SpoonModel>();
  private phones = new Set<PhoneModel>();
  private sphere = this.geometry(new THREE.SphereGeometry(1, 16, 12));
  private cylinder = this.geometry(new THREE.CylinderGeometry(1, 1, 1, 12));
  private box = this.geometry(new THREE.BoxGeometry(1, 1, 1));
  private atlas: THREE.Texture;
  private fabric: THREE.CanvasTexture;
  private heroes: HeroModels;

  constructor() {
    this.atlas = new THREE.TextureLoader().load('/assets/characters/matrix-faces.png');
    this.atlas.colorSpace = THREE.SRGBColorSpace;
    this.atlas.anisotropy = 8; this.textures.add(this.atlas);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const data = ctx.createImageData(128, 128);
    for (let i = 0; i < data.data.length; i += 4) {
      const n = i / 4; const grain = 112 + ((n * 13 + Math.floor(n / 128) * 17) % 29);
      data.data.set([grain, grain, grain, 255], i);
    }
    ctx.putImageData(data, 0, 0);
    this.fabric = new THREE.CanvasTexture(canvas);
    this.fabric.wrapS = this.fabric.wrapT = THREE.RepeatWrapping;
    this.fabric.repeat.set(5, 5); this.textures.add(this.fabric);
    this.heroes = new HeroModels(this.atlas, this.fabric);
  }

  private geometry<T extends THREE.BufferGeometry>(geometry: T): T { this.geometries.add(geometry); return geometry; }
  private material<T extends THREE.Material>(material: T): T { this.materials.add(material); return material; }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], position: number[], scale?: number[]): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private joint(parent: THREE.Object3D, x: number, y: number, z = 0): THREE.Group {
    const joint = new THREE.Group(); joint.position.set(x, y, z); parent.add(joint); return joint;
  }
  private limb(parent: THREE.Group, profile: number[][], length: number, material: THREE.Material, depth = 1): THREE.Bone {
    const geometry = this.geometry(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 24));
    geometry.scale(1, 1, depth);
    const indices: number[] = []; const weights: number[] = [];
    for (let i = 0; i < geometry.attributes.position.count; i++) {
      const t = THREE.MathUtils.clamp((-geometry.attributes.position.getY(i) - length + .14) / .28, 0, 1);
      const weight = t * t * (3 - 2 * t);
      indices.push(0, 1, 0, 0); weights.push(1 - weight, weight, 0, 0);
    }
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    const root = new THREE.Bone(); const bend = new THREE.Bone(); bend.position.y = -length; root.add(bend); parent.add(root);
    const mesh = new THREE.SkinnedMesh(geometry, material); parent.add(mesh);
    parent.updateWorldMatrix(true, true);
    const skeleton = new THREE.Skeleton([root, bend]); this.skeletons.add(skeleton); mesh.bind(skeleton);
    mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
    return bend;
  }
  private surface(parent: THREE.Object3D, points: number[][], material: THREE.Material): THREE.Mesh {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
    geometry.setIndex(points.length === 3 ? [0, 1, 2] : [0, 1, 2, 0, 2, 3]);
    geometry.computeVertexNormals();
    return this.mesh(parent, this.geometry(geometry), material, [0, 0, 0]);
  }

  private coatPanel(side: number, radius: number): THREE.BufferGeometry {
    const positions: number[] = []; const uvs: number[] = []; const indices: number[] = [];
    const rows = 14; const columns = 28;
    for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
      const t = row / rows; const a = side * (0.19 + column / columns * (Math.PI - 0.24));
      const r = radius + 0.20 * t + Math.sin(a * 9) * 0.012 * t;
      positions.push(Math.sin(a) * r, -t * 1.92, Math.cos(a) * r * 0.65);
      uvs.push(column / columns, t);
    }
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column; const b = a + columns + 1;
      if (side > 0) indices.push(a, b, a + 1, b, b + 1, a + 1);
      else indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals(); return this.geometry(geometry);
  }

  private headGeometry(width: number): THREE.BufferGeometry {
    const positions: number[] = []; const uvs: number[] = []; const indices: number[] = [];
    const rings = 40; const segments = 64;
    for (let ring = 0; ring <= rings; ring++) {
      const t = ring / rings; const y = -0.36 + t * 0.72;
      const radius = Math.max(0.002, Math.sqrt(1 - (t * 2 - 1) ** 2) * 0.28 * (t < 0.5 ? 0.79 + t * 0.42 : 1));
      for (let segment = 0; segment <= segments; segment++) {
        const angle = segment / segments * Math.PI * 2;
        const c = Math.cos(angle); const x = Math.sin(angle) * radius * width;
        let z = Math.sign(c) * Math.pow(Math.abs(c), c >= 0 ? 0.55 : 1) * radius * (c >= 0 ? 0.83 : 0.9);
        if (c > 0) {
          const gaussian = (cx: number, cy: number, sx: number, sy: number) => Math.exp(-(((x / width - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));
          // Nose, brow ridge, cheekbones and chin remain geometry when viewed in profile.
          z += Math.pow(c, 4) * (0.105 * gaussian(0, -0.13, 0.042, 0.065) + 0.042 * gaussian(0, -0.045, 0.028, 0.13)
            + 0.027 * gaussian(-0.13, -0.075, 0.085, 0.055) + 0.027 * gaussian(0.13, -0.075, 0.085, 0.055)
            + 0.017 * gaussian(0, -0.265, 0.12, 0.05));
        }
        positions.push(x, y, z);
        uvs.push(0.5 + x / width * 1.07, 0.12 + t * 0.88);
      }
    }
    const geometry = new THREE.BufferGeometry();
    for (let ring = 0; ring < rings; ring++) for (let segment = 0; segment < segments; segment++) {
      const a = ring * (segments + 1) + segment; const b = a + segments + 1;
      const start = indices.length;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
      const front = Math.cos((segment + 0.5) / segments * Math.PI * 2) > 0.05;
      geometry.addGroup(start, 6, front ? 0 : 1);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    // Merge adjacent material groups; do not create a draw call per face.
    const groups = geometry.groups; geometry.clearGroups();
    const front: number[] = []; const back: number[] = [];
    for (const group of groups) (group.materialIndex === 0 ? front : back).push(...indices.slice(group.start, group.start + group.count));
    geometry.setIndex([...front, ...back]); geometry.addGroup(0, front.length, 0); geometry.addGroup(front.length, back.length, 1);
    return this.geometry(geometry);
  }

  create(state: AgentState): CharacterRig {
    const look: Look = HERO_LOOKS[state.id] ?? {
      width: 1, shoulders: 0.6, waist: 0.39, hips: 0.43, skin: state.appearance.headColor,
      cloth: state.faction === 'zion' && !state.isInMatrix ? '#665d4d' : state.appearance.clothing,
      leather: state.faction === 'zion' && state.isInMatrix, coat: false,
      hair: state.id === 'spoon_boy' ? 'bald' : 'short', glasses: state.faction === 'civilians' || state.faction === 'oracle' || state.faction === 'zion' && !state.isInMatrix ? 'none' : 'square',
    };
    if (state.id === 'citizen_2') look.cloth = '#a21722';
    const root = new THREE.Group(); const detail = new VisibleGroup(); root.add(detail);
    if (state.id === 'spoon_boy') { root.scale.setScalar(.73); look.cloth = '#d5c7ac'; look.skin = '#d8b99b'; }
    const torso = this.joint(detail, 0, 1.86); const smallDetails = this.joint(detail, 0, 0);
    const skin = this.material(new THREE.MeshStandardMaterial({ color: look.skin, roughness: 0.64, metalness: 0, bumpMap: this.fabric, bumpScale: 0.0012 }));
    if (look.face !== undefined) {
      const skinTexture = this.atlas.clone();
      skinTexture.repeat.set(0.12, 0.025); skinTexture.offset.set((look.face % 2) * 0.5 + 0.19, (look.face < 2 ? 0.5 : 0) + 0.02);
      skinTexture.needsUpdate = true; this.textures.add(skinTexture);
      skin.color.set('#ffffff'); skin.map = skinTexture;
    }
    const cloth = this.material(new THREE.MeshPhysicalMaterial({ color: look.cloth, roughness: look.leather ? 0.43 : 0.88,
      metalness: 0, clearcoat: look.leather ? 0.22 : 0, clearcoatRoughness: 0.4, bumpMap: this.fabric, bumpScale: look.leather ? 0.003 : 0.002, side: THREE.DoubleSide }));
    const trousers = state.id === 'seraph' ? this.material(new THREE.MeshStandardMaterial({ color: '#282c29', roughness: .9, bumpMap: this.fabric, bumpScale: .002 })) : cloth;
    const seams = this.material(new THREE.MeshStandardMaterial({ color: look.leather ? '#292e2a' : '#252c28', roughness: 0.75 }));
    const black = this.material(new THREE.MeshStandardMaterial({ color: '#070b0a', roughness: 0.32 }));
    const metal = this.material(new THREE.MeshStandardMaterial({ color: '#969c90', metalness: 0.88, roughness: 0.24 }));
    const shirt = this.material(new THREE.MeshStandardMaterial({ color: '#dbd9c8', roughness: 0.8, side: THREE.DoubleSide }));
    const bodyPoints = [[look.hips, 0], [look.hips + .01, .18], [look.waist + 0.02, 0.35], [look.waist, 0.63], [look.shoulders * .74, .9], [look.shoulders * 0.83, 1.15], [look.shoulders * .88, 1.39], [look.shoulders * .76, 1.52], [0.21, 1.66]].map(([r, y]) => new THREE.Vector2(r, y));
    const jacket = this.geometry(new THREE.LatheGeometry(bodyPoints, 40));
    this.mesh(torso, jacket, cloth, [0, 0, 0], [1, 1, 0.59]);
    this.mesh(torso, this.sphere, cloth, [0, .02, 0], [look.hips, .22, look.hips * .59]);
    if (state.id === 'citizen_2') {
      const skirt = this.mesh(detail, this.geometry(new THREE.CylinderGeometry(.49, .82, 2.35, 32, 4, true)), cloth, [0, 1.27, 0]);
      skirt.name = 'red-dress-skirt'; skirt.scale.z = .68;
    }
    if (state.id === 'oracle') {
      const apron = this.material(new THREE.MeshStandardMaterial({ color: '#d7c19a', roughness: .93, bumpMap: this.fabric, bumpScale: .002, side: THREE.DoubleSide }));
      const skirt = this.mesh(torso, this.geometry(new THREE.CylinderGeometry(.43, .55, 1.2, 28, 3, true)), apron, [0, .68, 0], [1, 1, .62]);
      skirt.name = 'oracle-apron';
      this.surface(torso, [[-.28, 1.64, .28], [.28, 1.64, .28], [.38, .72, .34], [-.38, .72, .34]], apron);
      for (const side of [-1, 1]) this.mesh(torso, this.cylinder, apron, [side * .22, 1.7, .22], [.018, .42, .018]).rotation.z = side * .16;
    }
    this.mesh(torso, this.cylinder, skin, [0, 1.79, 0], [0.145, 0.25, 0.135]);
    // Raised collars, seams, belt and tailored panels are visible from all sides.
    if (state.faction !== 'machines') {
      const collar = this.geometry(new THREE.CylinderGeometry(0.17, 0.195, state.id === 'neo' ? 0.15 : 0.095, 24, 1, true));
      this.mesh(torso, collar, cloth, [0, state.id === 'neo' ? 1.71 : 1.64, 0], [1, 1, 0.86]);
    }
    this.mesh(torso, this.cylinder, black, [0, 0.24, 0], [look.hips + 0.018, 0.10, (look.hips + 0.018) * 0.6]);
    this.mesh(torso, this.box, metal, [0, 0.24, look.hips * 0.6 + 0.022], [0.16, 0.1, 0.018]);
    this.mesh(torso, this.cylinder, seams, [0, 0.99, look.waist * 0.6 + 0.015], [0.008, 1.1, 0.008]);
    if (state.id === 'smith' || state.faction === 'machines') {
      this.surface(torso, [[-0.18, 1.76, 0.19], [0.18, 1.76, 0.19], [0.10, 0.7, 0.32], [-0.10, 0.7, 0.32]], shirt);
      this.surface(torso, [[-0.28, 1.62, 0.23], [-0.45, 1.25, 0.23], [-0.12, 0.61, 0.32], [-0.02, 1.26, 0.33]], cloth);
      this.surface(torso, [[0.28, 1.62, 0.23], [0.02, 1.26, 0.33], [0.12, 0.61, 0.32], [0.45, 1.25, 0.23]], cloth);
      for (const side of [-1, 1]) this.surface(torso, [[side * 0.18, 1.78, 0.20], [side * 0.04, 1.66, 0.275], [side * 0.13, 1.48, 0.30]], shirt);
      this.surface(torso, [[-0.035, 1.61, 0.30], [0.035, 1.61, 0.30], [0.062, 0.88, 0.35], [0, 0.78, 0.35]], black);
      this.mesh(torso, this.box, black, [0, 1.65, 0.285], [0.085, 0.08, 0.022]);
      for (const y of [0.45, 0.67]) this.mesh(torso, this.sphere, black, [0.095, y, 0.26], [0.027, 0.027, 0.014]);
    }
    const head = this.joint(torso, 0, 2.13);
    let face = skin;
    if (look.face !== undefined) {
      const texture = this.atlas.clone();
      texture.repeat.set(0.5, 0.5); texture.offset.set((look.face % 2) * 0.5, look.face < 2 ? 0.5 : 0);
      texture.needsUpdate = true; this.textures.add(texture);
      face = this.material(new THREE.MeshStandardMaterial({ map: texture, roughness: 0.67, bumpMap: this.fabric, bumpScale: 0.0008 }));
    }
    this.mesh(head, this.headGeometry(look.width), [face, skin], [0, 0, 0]);
    for (const side of [-1, 1]) {
      this.mesh(head, this.sphere, skin, [side * 0.267 * look.width, -0.08, -0.035], [0.040, 0.09, 0.028]);
    }
    if (look.face === undefined) {
      for (const side of [-1, 1]) {
        this.mesh(head, this.sphere, shirt, [side * 0.10, -0.012, 0.219], [0.058, 0.021, 0.016]);
        this.mesh(head, this.sphere, black, [side * 0.10, -0.012, 0.233], [0.018, 0.019, 0.009]);
        this.mesh(head, this.box, black, [side * 0.105, 0.036, 0.22], [0.1, 0.016, 0.017]);
      }
      this.mesh(head, this.sphere, this.material(new THREE.MeshStandardMaterial({ color: '#916756', roughness: 0.7 })), [0, -0.24, 0.224], [0.078, 0.014, 0.012]);
    }
    if (look.hair !== 'bald') this.addHair(head, look);
    if (state.id === 'seraph') {
      this.mesh(head, this.sphere, black, [0, .035, -.14], [.275, .30, .145]);
      this.mesh(head, this.sphere, black, [0, .27, .11], [.255, .11, .16]);
    }
    if (look.glasses !== 'none') this.addGlasses(head, look, black, metal);

    const shoulders: THREE.Group[] = []; const elbows: THREE.Object3D[] = []; const hips: THREE.Group[] = []; const knees: THREE.Object3D[] = []; const ankles: THREE.Group[] = []; const tails: THREE.Group[] = [];
    const clothPanels: CharacterRig['cloth'] = [];
    const fingers: THREE.Group[][] = [];
    for (const side of [-1, 1]) {
      const shoulder = this.joint(torso, side * look.shoulders * 0.87, 1.39);
      shoulders.push(shoulder);
      const elbow = this.limb(shoulder, [[.10, -1.43], [.115, -1.23], [.14, -1.03], [.15, -.91], [.16, -.82], [.155, -.73], [.17, -.62], [.18, -.45], [.195, -.24], [.215, -.04], [.19, .08], [.10, .15], [.002, .18]], .81, cloth, .94);
      elbows.push(elbow);
      this.mesh(elbow, this.cylinder, seams, [0, -0.56, 0], [0.13, 0.045, 0.14]);
      const handMaterial = look.leather ? black : skin;
      this.mesh(elbow, this.sphere, handMaterial, [0, -0.75, 0.005], [0.095, 0.145, 0.055]);
      const handFingers: THREE.Group[] = [];
      for (let finger = 0; finger < 4; finger++) {
        const joint = this.joint(elbow, -0.063 + finger * 0.041, -.82, .01);
        this.mesh(joint, this.sphere, handMaterial, [0, -.055, 0], [.024, .073 - Math.abs(1.5 - finger) * .009, .027]);
        handFingers.push(joint);
      }
      fingers.push(handFingers);
      const thumb = this.mesh(elbow, this.sphere, handMaterial, [side * -0.10, -0.75, 0.02], [0.03, 0.08, 0.03]); thumb.rotation.z = side * 0.5;

      const hip = this.joint(detail, side * 0.225, 1.86); hips.push(hip);
      const knee = this.limb(hip, [[.125, -1.8], [.14, -1.63], [.155, -1.39], [.165, -1.17], [.15, -1.03], [.16, -.94], [.17, -.85], [.185, -.68], [.21, -.40], [.24, -.13], [.22, .04], [.002, .1]], .94, trousers, 1.13);
      knees.push(knee);
      const ankle = this.joint(knee, 0, -.9); ankles.push(ankle);
      this.mesh(ankle, this.cylinder, black, [0, .1, 0], [.14, look.leather ? .4 : .20, .17]);
      this.mesh(ankle, this.sphere, black, [0, -.045, .125], [.16, .10, .28]);
      this.mesh(ankle, this.sphere, black, [0, -.11, .13], [.164, .045, .285]);
      if (look.coat) {
        const tail = this.joint(torso, 0, 0.37, 0); tails.push(tail);
        const mesh = this.mesh(tail, this.coatPanel(side, look.waist + 0.04), cloth, [0, 0, 0]);
        clothPanels.push({ mesh, rest: Float32Array.from(mesh.geometry.attributes.position.array) });
      }
    }
    const distant = this.makeDistant(look, root);
    const rig: CharacterRig = { root, detail, distant, torso, head, shoulders, elbows, fingers, hips, knees, ankles, tails, cloth: clothPanels, motion: newMotion(), smallDetails, rifle: state.id === 'film_soldier' };
    const guard = ['agent_jones', 'agent_brown', 'agent_johnson', 'agent_jackson', 'agent_thompson'].includes(state.id) ? state.id as 'agent_jones' | 'agent_brown' | 'agent_johnson' | 'agent_jackson' | 'agent_thompson' : undefined;
    const reloadedBase: Record<string, HeroId> = { niobe: 'trinity', ballard: 'morpheus', ghost: 'neo', soren: 'smith', link: 'morpheus' };
    const support = state.id === 'switch' || state.id === 'apoc' || state.id === 'rhineheart' || state.id === 'courier' || state.id === 'choi' || state.id === 'dujour' || state.id in reloadedBase ? state.id as HeroSupport : undefined;
    if (HERO_IDS.includes(state.id as HeroId) || guard || support) {
      this.heroes.create(reloadedBase[state.id] ?? (guard || support === 'rhineheart' ? 'smith' : support === 'switch' || support === 'dujour' ? 'trinity' : support === 'apoc' || support === 'courier' || support === 'choi' ? 'neo' : state.id as HeroId), guard, support).then(model => {
        if (!model) return;
        rig.weapons?.forEach(gun => gun.removeFromParent()); rig.weapons = undefined; rig.weaponStyle = undefined;
        for (const child of detail.children) child.visible = false;
        detail.add(model.root); rig.hero = model;
        if (rig.staff) { rig.staff.removeFromParent(); rig.staff.position.set(0, -.16, .06); model.bones.get('wrist_R')!.add(rig.staff); }
      }).catch(error => console.warn(`${state.id} asset could not load; retaining the procedural character.`, error));
    }
    return rig;
  }

  private addHair(head: THREE.Group, look: Look): void {
    const material = this.material(new THREE.MeshStandardMaterial({ color: '#100f0d', roughness: 0.84, bumpMap: this.fabric, bumpScale: 0.003 }));
    // The front uses the albedo hairline. Only the back needs a separate cap.
    const back = new THREE.SphereGeometry(1, 24, 16, Math.PI, Math.PI, 0, Math.PI * 0.76);
    this.mesh(head, this.geometry(back), material, [0, 0.03, -0.015], [0.275 * look.width, 0.32, 0.235]);
  }

  private addGlasses(head: THREE.Group, look: Look, black: THREE.Material, metal: THREE.Material): void {
    const lenses = this.material(new THREE.MeshPhysicalMaterial({ color: '#060d0b', roughness: 0.12, metalness: 0.45, clearcoat: 1, clearcoatRoughness: 0.1, side: THREE.DoubleSide }));
    for (const side of [-1, 1]) {
      const round = look.glasses === 'round';
      const width = look.glasses === 'narrow' ? 0.12 : 0.113;
      const height = round ? 0.096 : look.glasses === 'narrow' ? 0.047 : 0.064;
      const shape = new THREE.Shape();
      if (look.glasses === 'square') {
        shape.moveTo(-width, -height); shape.lineTo(width * 0.78, -height); shape.lineTo(width, height * 0.8); shape.lineTo(-width, height); shape.closePath();
      } else shape.absellipse(0, 0, width, height, 0, Math.PI * 2, false, 0);
      const lens = this.mesh(head, this.geometry(new THREE.ShapeGeometry(shape, 24)), lenses, [side * 0.13 * look.width, -0.017, 0.267]);
      lens.rotation.y = side * -0.16;
      lens.rotation.z = look.glasses === 'narrow' ? side * 0.10 : 0;
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(side * 0.245 * look.width, -0.005, 0.255), new THREE.Vector3(side * 0.29 * look.width, 0.002, 0.12), new THREE.Vector3(side * 0.28 * look.width, -0.03, -0.1)]);
      this.mesh(head, this.geometry(new THREE.TubeGeometry(curve, 8, round ? 0.005 : 0.008, 5)), round ? metal : black, [0, 0, 0]);
    }
    this.mesh(head, this.box, metal, [0, -0.004, 0.283], [0.06, 0.013, 0.014]);
  }

  private makeDistant(look: Look, parent: THREE.Group): THREE.Mesh {
    const pieces: THREE.BufferGeometry[] = [];
    const add = (source: THREE.BufferGeometry, position: number[], scale: number[], color: string): void => {
      const geometry = source.clone(); geometry.clearGroups();
      geometry.scale(scale[0], scale[1], scale[2]); geometry.translate(position[0], position[1], position[2]);
      const rgb = new THREE.Color(color); const colors: number[] = [];
      for (let i = 0; i < geometry.attributes.position.count; i++) colors.push(rgb.r, rgb.g, rgb.b);
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); pieces.push(geometry);
    };
    add(this.cylinder, [0, 2.86, 0], [look.shoulders * 0.8, 1.65, 0.29], look.cloth);
    add(this.sphere, [0, 4.25, 0], [0.275 * look.width, 0.36, 0.25], look.skin);
    for (const side of [-1, 1]) {
      add(this.cylinder, [side * 0.235, 1, 0], [0.19, 1.95, 0.21], look.cloth);
      add(this.cylinder, [side * look.shoulders, 2.74, 0], [0.15, 1.55, 0.16], look.cloth);
    }
    if (look.coat) add(this.cylinder, [0, 1.58, 0], [0.64, 2.4, 0.35], look.cloth);
    const merged = this.geometry(mergeGeometries(pieces)!); pieces.forEach(piece => piece.dispose());
    const material = this.material(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
    const mesh = this.mesh(parent, merged, material, [0, 0, 0]); mesh.visible = false; return mesh;
  }

  animate(rig: CharacterRig, delta: number, input: MotionInput, distance: number): void {
    const near = distance < 100;
    rig.detail.visible = near; rig.distant.visible = !near;
    if (!near) return;
    const pulseRifle = Boolean(input.betrayal && ['cypher', 'tank'].includes(input.betrayal.role));
    const weaponStyle: CharacterRig['weaponStyle'] = pulseRifle ? 'pulse' : input.weaponStyle ?? (rig.rifle ? 'rifle' : 'pistol');
    if (input.armed && rig.weapons && rig.weaponStyle !== weaponStyle) {
      rig.weapons.forEach(gun => gun.removeFromParent()); rig.weapons = undefined;
    }
    if (input.armed && !rig.weapons) {
      const material = this.material(new THREE.MeshStandardMaterial({ color: 0x242b2c, metalness: .75, roughness: .28 }));
      const charge = pulseRifle ? this.material(new THREE.MeshBasicMaterial({ color: 0x8fd8ba, toneMapped: false })) : material;
      const dual = weaponStyle === 'pistol' || weaponStyle === 'compact';
      rig.weaponStyle = weaponStyle;
      rig.weapons = (dual ? [0, 1] : [0]).map(i => {
        const gun = new THREE.Group(); const length = weaponStyle === 'compact' ? .72 : weaponStyle === 'breacher' ? 1.34 : ['rifle', 'pulse'].includes(weaponStyle) ? 1.2 : .5;
        gun.name = pulseRifle ? 'neb-pulse-rifle' : `character-${weaponStyle}`;
        this.mesh(gun, this.box, material, [0, -length / 2, 0], [.12, length, .14]);
        this.mesh(gun, this.cylinder, material, [0, -length, 0], [.045, .23, .045]);
        this.mesh(gun, this.box, material, [0, -.09, .13], [.105, .18, .27]);
        this.mesh(gun, this.box, material, [0, -length * .5, .08], [.08, .1, dual ? weaponStyle === 'compact' ? .22 : .06 : .35]);
        if (weaponStyle === 'breacher') {
          this.mesh(gun, this.cylinder, material, [0, -1.02, 0], [.075, .52, .075]);
          this.mesh(gun, this.box, material, [0, -.62, .11], [.18, .42, .24]);
        }
        if (weaponStyle === 'rifle') this.mesh(gun, this.box, material, [0, -.48, -.14], [.17, .58, .34]);
        if (pulseRifle) {
          this.mesh(gun, this.cylinder, charge, [0, -.62, .13], [.075, .34, .075]);
          this.mesh(gun, this.box, material, [0, -.2, -.17], [.22, .48, .42]);
        }
        gun.position.set(0, -.08, .03);
        const parent = rig.hero?.bones.get(i ? 'wrist_L' : 'wrist_R') ?? rig.elbows[i];
        if (!rig.hero) gun.position.y -= .69;
        parent.add(gun); return gun;
      });
    }
    rig.weapons?.forEach(gun => { gun.visible = Boolean(input.armed); });
    if (input.spoon !== undefined && !rig.spoon) {
      rig.spoon = new SpoonModel(); this.spoons.add(rig.spoon);
      rig.spoon.root.name = 'held-spoon';
      rig.spoon.root.scale.setScalar(.55);
      const parent = rig.hero?.bones.get('wrist_R') ?? rig.elbows[0];
      rig.spoon.root.position.set(0, rig.hero ? -.15 : -.84, .05); rig.spoon.root.rotation.x = 2.17;
      parent.add(rig.spoon.root);
    }
    if (rig.spoon) { rig.spoon.root.visible = input.spoon !== undefined; rig.spoon.setBend(input.spoon ?? 0); }
    if (input.phone && rig.hero && !rig.phone) {
      rig.phone = new PhoneModel(); this.phones.add(rig.phone);
      rig.phone.root.position.set(.09, -.19, 0); rig.phone.root.rotation.set(0, Math.PI / 2, Math.PI); rig.hero.bones.get('wrist_R')!.add(rig.phone.root);
    }
    if (rig.phone) {
      rig.phone.root.visible = Boolean(input.phone && (input.phone.phase !== 'pickup' || input.phone.elapsed >= .65));
      rig.phone.update(input.phone?.phase === 'answering' ? Math.min(1, input.phone.elapsed / .4) : input.phone?.phase === 'connected' ? 1 : 0);
    }
    if (input.oracleVisit && !rig.cookie) {
      const biscuit = this.material(new THREE.MeshStandardMaterial({ color: '#c98945', roughness: .88 }));
      const chocolate = this.material(new THREE.MeshStandardMaterial({ color: '#342017', roughness: .9 }));
      rig.cookie = new THREE.Group(); rig.cookie.name = 'oracle-cookie';
      const base = this.mesh(rig.cookie, this.cylinder, biscuit, [0, 0, 0], [.13, .025, .13]); base.rotation.x = Math.PI / 2;
      for (const [x, y] of [[-.05, .03], [.035, .055], [.058, -.035], [-.02, -.06]]) this.mesh(rig.cookie, this.sphere, chocolate, [x, y, .029], [.018, .018, .009]);
      const parent = rig.hero?.bones.get('wrist_R') ?? rig.elbows[0];
      rig.cookie.position.set(.02, rig.hero ? -.13 : -.84, .08); rig.cookie.rotation.x = -.18; parent.add(rig.cookie);
    }
    if (rig.cookie) {
      const visit = input.oracleVisit; const gesture = visit && oracleVisitPose(visit);
      rig.cookie.visible = Boolean(visit && gesture && (visit.role === 'oracle' ? gesture.offer > .12 && gesture.receive < .72 : gesture.receive > .55));
    }
    const holdsStaff = input.burly?.role === 'neo' && ['staff', 'flight_ready'].includes(input.burly.phase);
    if (holdsStaff && !rig.staff) {
      const steel = this.material(new THREE.MeshStandardMaterial({ color: 0x555b59, metalness: .78, roughness: .36 }));
      const grip = this.material(new THREE.MeshStandardMaterial({ color: 0x202b29, metalness: .4, roughness: .63 }));
      rig.staff = new THREE.Group(); rig.staff.name = 'burly-fence-staff';
      this.mesh(rig.staff, this.cylinder, steel, [0, 0, 0], [.045, 5.7, .045]);
      this.mesh(rig.staff, this.cylinder, grip, [0, -.34, 0], [.06, .55, .06]);
      for (const y of [-2.75, 2.75]) this.mesh(rig.staff, this.cylinder, steel, [0, y, 0], [.09, .08, .09]);
      const parent = rig.hero?.bones.get('wrist_R') ?? rig.elbows[0];
      rig.staff.position.set(0, rig.hero ? -.16 : -.76, .06); rig.staff.rotation.z = Math.PI / 2; parent.add(rig.staff);
    }
    if (rig.staff) rig.staff.visible = holdsStaff;
    const infected = input.burly?.role === 'neo' && (input.burly.phase === 'grapple' || input.burly.assimilation > 0 && ['swarm', 'staff_ready', 'staff', 'flight_ready'].includes(input.burly.phase));
    if (infected && !rig.infection) {
      const black = this.material(new THREE.MeshBasicMaterial({ color: 0x030b09, transparent: true, opacity: .9, depthWrite: false }));
      const code = this.material(new THREE.MeshBasicMaterial({ color: 0x8bfc92, transparent: true, opacity: .85, depthWrite: false }));
      rig.infection = new THREE.Group(); rig.infection.name = 'smith-assimilation'; rig.detail.add(rig.infection);
      for (let i = 0; i < 22; i++) {
        const x = ((i * 7) % 17 - 8) * .055; const y = 1.05 + ((i * 11) % 19) * .07;
        const mark = this.mesh(rig.infection, this.box, i % 4 ? black : code, [x, y, .38 + i % 3 * .015], [.025 + i % 3 * .015, .08 + i % 5 * .085, .012]);
        mark.rotation.z = (i % 5 - 2) * .19; mark.castShadow = false;
      }
    }
    if (rig.infection) {
      rig.infection.visible = Boolean(infected);
      const spread = input.burly?.phase === 'grapple' ? .25 + Math.min(1, input.burly.elapsed / BURLY.grapple) * .85 : .2 + (input.burly?.assimilation ?? 0) * .008;
      rig.infection.scale.setScalar(spread);
      rig.infection.position.y = Math.sin(rig.motion.time * 9) * .015;
    }
    const pose = advanceMotion(rig.motion, input, delta);
    const staffSweep = holdsStaff && rig.motion.attackAge < .65 ? Math.sin(rig.motion.attackAge / .65 * Math.PI) : 0;
    if (rig.staff) rig.staff.rotation.z = Math.PI / 2 + staffSweep * .65;
    if (rig.hero) {
      this.heroes.animate(rig.hero, pose, rig.motion, input, delta);
      if (holdsStaff) {
        rig.hero.bones.get('shoulder_R')!.rotation.x -= .7 + staffSweep * .5;
        rig.hero.bones.get('shoulder_L')!.rotation.x -= .55 + staffSweep * .35;
        rig.hero.bones.get('chest')!.rotation.y += staffSweep * .42;
      }
      if (input.burly?.phase === 'flight' && input.burly.role === 'neo') {
        rig.hero.bones.get('chest')!.rotation.x -= .55;
        for (const side of ['R', 'L']) rig.hero.bones.get(`shoulder_${side}`)!.rotation.x -= 1.1;
      }
      if (input.burly?.phase === 'grapple' && input.burly.role === 'smith') {
        rig.hero.bones.get('shoulder_R')!.rotation.x -= 1.15;
        rig.hero.bones.get('elbow_R')!.rotation.x -= .65;
      }
      if (input.persephone?.phase === 'enacting' && input.persephone.role === 'neo') {
        const weight = Math.sin(Math.min(1, input.persephone.elapsed / 2.8) * Math.PI);
        rig.hero.bones.get('chest')!.rotation.x -= weight * .12;
        rig.hero.bones.get('shoulder_R')!.rotation.x -= weight * .4;
      }
      return;
    }
    rig.torso.position.y = pose.hipHeight;
    rig.torso.position.x = pose.sway; rig.torso.position.z = pose.lunge;
    rig.torso.rotation.set(pose.lean, pose.twist, pose.roll);
    rig.head.rotation.set(-pose.lean * .6, pose.headTurn, -pose.roll * .5);
    if (holdsStaff) rig.torso.rotation.y += staffSweep * .42;
    if (input.burly?.phase === 'flight' && input.burly.role === 'neo') rig.torso.rotation.x -= .55;
    if (input.persephone?.phase === 'enacting') {
      const weight = Math.sin(Math.min(1, input.persephone.elapsed / 2.8) * Math.PI);
      rig.torso.rotation.x -= weight * .08; rig.head.rotation.x -= weight * .16;
    }
    for (let i = 0; i < 2; i++) {
      rig.hips[i].position.y = pose.hipHeight;
      rig.hips[i].rotation.set(input.floorSeated ? -1.2 : pose.legs[i].hip, input.floorSeated ? (i ? 1 : -1) * .4 : 0, input.floorSeated ? (i ? 1 : -1) * .6 : 0);
      rig.knees[i].rotation.x = input.floorSeated ? 2.4 : pose.legs[i].knee;
      rig.ankles[i].rotation.x = pose.legs[i].ankle;
      rig.shoulders[i].rotation.set(pose.arms[i].shoulder, 0, pose.arms[i].outward);
      rig.elbows[i].rotation.x = pose.arms[i].elbow;
      if (i === 0 && input.persephone?.phase === 'enacting') rig.shoulders[i].rotation.x -= Math.sin(Math.min(1, input.persephone.elapsed / 2.8) * Math.PI) * .45;
      if (holdsStaff) rig.shoulders[i].rotation.x -= (i ? .55 : .7) + staffSweep * (i ? .35 : .5);
      if (input.burly?.phase === 'flight' && input.burly.role === 'neo') rig.shoulders[i].rotation.x -= 1.1;
      if (i === 0 && input.burly?.phase === 'grapple' && input.burly.role === 'smith') { rig.shoulders[i].rotation.x -= 1.15; rig.elbows[i].rotation.x -= .65; }
      for (const finger of rig.fingers[i]) finger.rotation.x = -.12 - pose.arms[i].grip * 2.1;
      const panel = rig.cloth[i];
      if (!panel) continue;
      const spread = Math.max(pose.moving, pose.airborne);
      const vertices = panel.mesh.geometry.attributes.position;
      for (let v = 0; v < vertices.count; v++) {
        const x = panel.rest[v * 3]; const y = panel.rest[v * 3 + 1]; const z = panel.rest[v * 3 + 2];
        const length = Math.min(1, -y / 1.92); const hem = length * length;
        const front = Math.max(0, z) * spread * (.7 + pose.run + pose.airborne * 1.1) * Math.sin(length * Math.PI);
        const angle = (i ? 1 : -1) * spread * (.26 + pose.run * .30 + pose.airborne * .24) * length;
        const clothX = x + Math.sin(rig.motion.time * 7 + y * 3 + i) * hem * pose.coat * .12;
        const clothZ = z + front - hem * pose.coat * .75 + Math.sin(rig.motion.phase * Math.PI * 2 + i * Math.PI + y * 2) * hem * pose.coat * .22;
        vertices.setXYZ(v, clothX * Math.cos(angle) + clothZ * Math.sin(angle), y + hem * pose.coat * .18, clothZ * Math.cos(angle) - clothX * Math.sin(angle));
      }
      vertices.needsUpdate = true; panel.mesh.geometry.computeVertexNormals();
    }
    if (input.training?.kind === 'download' && input.training.role === 'tank') {
      const engaged = input.training.elapsed > 0 ? 1 : .35;
      for (let i = 0; i < 2; i++) {
        rig.shoulders[i].rotation.x = -.72 * engaged; rig.shoulders[i].rotation.z = (i ? 1 : -1) * .24;
        rig.elbows[i].rotation.x = -1.05 + Math.sin(input.training.elapsed * 11 + i * 2) * .08 * engaged;
        for (const finger of rig.fingers[i]) finger.rotation.x = -.45 - Math.sin(input.training.elapsed * 15 + i) * .18 * engaged;
      }
      rig.head.rotation.y = Math.sin(input.training.elapsed * .8) * .12;
    }
  }

  dispose(): void {
    this.phones.forEach(phone => phone.dispose());
    this.spoons.forEach(spoon => spoon.dispose());
    this.heroes.dispose();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); this.textures.forEach(texture => texture.dispose()); this.skeletons.forEach(skeleton => skeleton.dispose());
  }
}
