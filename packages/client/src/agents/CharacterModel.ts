import { poseOracleRequest } from './OracleRequestPerformance.js';
import { poseBaneInquiry } from './BaneInquiryPerformance.js';
import { poseHammerBriefing } from './HammerBriefingPerformance.js';
import { poseMaggieDiscovery } from './MaggieDiscoveryPerformance.js';
import { poseZionDeployment } from './ZionDeploymentPerformance.js';
import { poseOracleLast } from './OracleLastPerformance.js';
import { poseOracleAbsorption } from './OracleAbsorptionPerformance.js';
import { poseTrainmanChase } from './TrainmanChasePerformance.js';
import { poseHelGarage } from './HelGaragePerformance.js';
import { poseHelElevator } from './HelElevatorPerformance.js';
import { poseHelDanceDoor } from './HelDanceDoorPerformance.js';
import { poseHelPistol } from './HelCoatcheckPerformance.js';
import { createHelPistol } from './HelPistolModel.js';
import { poseHelDisarm } from './HelDisarmPerformance.js';
import { poseHelBreakout } from './HelBreakoutPerformance.js';
import { poseMobilReunion } from './MobilReunionPerformance.js';
import { poseReloadedCatch } from './ReloadedCatchPerformance.js';
import { poseSentinelSignal } from './SentinelSignalPerformance.js';
import { poseMobilRefusal } from './MobilRefusalPerformance.js';
import { poseMobilLuggage } from './MobilLuggagePerformance.js';
import { poseMobilFamily } from './MobilFamilyPerformance.js';
import { poseUpperDigger } from './UpperDiggerPerformance.js';
import { DiggerProps, poseDiggers } from './DiggerPerformance.js';
import * as THREE from 'three';
import { poseDockDeparture, poseDockReunion } from './DockReunionPerformance.js';
import { poseDockBriefing } from './DockBriefingPerformance.js';
import { posePrimaryDemolition } from './PrimaryDemolitionPerformance.js';
import { poseTrinityRelay } from './TrinityRelayPerformance.js';
import { poseSourcePortal, SourcePortalProps } from './SourcePortalPerformance.js';
import { poseArchitect } from './ArchitectPerformance.js';
import { poseTrinityTerminal } from './TrinityTerminalPerformance.js';
import { DockCargoModel } from './DockCargoModel.js';
import { poseDockEvacuation, poseShaftSeal } from './DockEvacuationPerformance.js';
import { poseTempleDefense } from './TempleDefensePerformance.js';
import { poseDeusRecline } from './DeusReclinePerformance.js';
import { FreewayPickupProps, poseFreewayPickup, poseFreewayDriver, poseFreewayRide, poseFreewayHandoff } from './FreewayPickupContact.js';
import { TruckWeaponProps, poseTruckWeapons } from './TruckWeaponPerformance.js';
import { poseTruckHood } from './TruckHoodPerformance.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BURLY, oracleCookieOwner, type AgentState, type RescueLoadout, type ChateauWeapon } from '@auto_matrix/shared';
import { poseSpoonHands } from './SpoonPerformance.js';
import { placeAmbushFeet } from './HotelFootPlacement.js';
import { poseOracleReception, poseOracleWaiting } from './OracleReceptionPerformance.js';
import { poseOracleCookie } from './OracleCookiePerformance.js';
import { poseOracleDeparture } from './OracleDeparturePerformance.js';
import { poseOracleArrival } from './OracleArrivalPerformance.js';
import { poseOracleRestored } from './OracleRestorationPerformance.js';
import { poseGarden } from './GardenPerformance.js';
import { poseDockReload } from './DockReloadPerformance.js';
import { poseDockLastStand } from './DockLastStandPerformance.js';
import { poseDockGate } from './DockGatePerformance.js';
import { poseEmpOperator } from './EmpOperatorPerformance.js';
import { EpilogueHeads } from './EpilogueHeads.js';
import { DiggerBodies } from './DiggerBodies.js';
import { poseWetwall } from './WetwallPerformance.js';
import { poseSixthFloor } from './SixthFloorPerformance.js';
import { poseBathroom } from './BathroomPerformance.js';
import { poseBasement, poseBasementLauncher, poseHardline } from './BasementPerformance.js';
import { poseCrosscut, poseCrosscutContact } from './CrosscutPerformance.js';
import { HardlineHandset } from './HardlineHandset.js';
import { advanceMotion, newMotion, type MotionInput, type MotionState } from './CharacterMotion.js';
import { HERO_IDS, HeroModels, type HeroId, type HeroRig, type HeroSupport } from './HeroModel.js';
import { SpoonModel } from './SpoonModel.js';
import { PhoneModel } from './PhoneModel.js';
import { VisibleGroup } from '../engine/VisibleGroup.js';
import { enableSkinnedCulling } from './SkinnedBounds.js';
import { batchStaticGeometry } from '../engine/StaticGeometry.js';

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
  oracle: { width: 1.05, shoulders: 0.62, waist: 0.43, hips: 0.52, skin: '#77513f', cloth: '#66745d', leather: false, coat: false, hair: 'short', glasses: 'none' },
  architect: { width: 1.02, shoulders: .65, waist: .43, hips: .46, skin: '#c8b19b', cloth: '#c7c7bc', leather: false, coat: false, hair: 'short', glasses: 'none' },
  sati: { width: 1.03, shoulders: .46, waist: .36, hips: .43, skin: '#976e50', cloth: '#b4be92', leather: false, coat: false, hair: 'pixie', glasses: 'none' },
  rama_kandra: { width: 1, shoulders: .61, waist: .39, hips: .44, skin: '#aa8065', cloth: '#c8d0b7', leather: false, coat: false, hair: 'bald', glasses: 'none' },
  kamala: { width: .96, shoulders: .51, waist: .35, hips: .44, skin: '#a47d5d', cloth: '#a5b4a0', leather: false, coat: false, hair: 'short', glasses: 'none' },
  trainman: { width: .9, shoulders: .54, waist: .36, hips: .4, skin: '#c0aa8e', cloth: '#58604e', leather: false, coat: true, hair: 'short', glasses: 'none' },
  charra: { width: .98, shoulders: .56, waist: .36, hips: .46, skin: '#be997e', cloth: '#3e4442', leather: false, coat: false, hair: 'pixie', glasses: 'none' },
  zee: { width: .97, shoulders: .5, waist: .33, hips: .45, skin: '#87583e', cloth: '#505649', leather: false, coat: false, hair: 'pixie', glasses: 'none' },
  niobe: { width: .94, shoulders: .5, waist: .33, hips: .45, skin: '#996c50', cloth: '#563635', leather: false, coat: false, hair: 'pixie', glasses: 'none' },
  lock: { width: 1, shoulders: .62, waist: .39, hips: .45, skin: '#8d6049', cloth: '#5f5b48', leather: false, coat: false, hair: 'short', glasses: 'none' },
  hamann: { width: 1.04, shoulders: .59, waist: .41, hips: .45, skin: '#b89b83', cloth: '#41495a', leather: false, coat: false, hair: 'short', glasses: 'none' },
  west: { width: 1.04, shoulders: .66, waist: .45, hips: .48, skin: '#805b41', cloth: '#665449', leather: false, coat: false, hair: 'short', glasses: 'none' },
  dillard: { width: .96, shoulders: .52, waist: .40, hips: .47, skin: '#c2a38b', cloth: '#616151', leather: false, coat: false, hair: 'short', glasses: 'none' },
  bane: { width: 1.05, shoulders: .66, waist: .42, hips: .46, skin: '#b89883', cloth: '#536374', leather: false, coat: false, hair: 'short', glasses: 'none' },
  maggie: { width: .94, shoulders: .51, waist: .35, hips: .45, skin: '#b99c89', cloth: '#663b3b', leather: false, coat: false, hair: 'pixie', glasses: 'none' },
  colt: { width: 1.02, shoulders: .61, waist: .4, hips: .45, skin: '#b69276', cloth: '#4d4940', leather: false, coat: false, hair: 'short', glasses: 'none' },
  link: { width: .97, shoulders: .57, waist: .37, hips: .43, skin: '#654733', cloth: '#5d554a', leather: false, coat: false, hair: 'short', glasses: 'none' },
  roland: { width: 1.04, shoulders: .64, waist: .43, hips: .47, skin: '#c29982', cloth: '#56403a', leather: false, coat: false, hair: 'short', glasses: 'none' },
  seraph: { width: .94, shoulders: .58, waist: .34, hips: .4, skin: '#c5a27e', cloth: '#d7d4c6', leather: false, coat: false, hair: 'short', glasses: 'none' },
  keymaker: { width: 1.04, shoulders: .55, waist: .40, hips: .44, skin: '#c4a07d', cloth: '#514d40', leather: false, coat: false, hair: 'short', glasses: 'none' },
  merovingian: { width: 1, shoulders: .67, waist: .42, hips: .46, skin: '#d1ad97', cloth: '#171a1b', leather: false, coat: false, hair: 'short', glasses: 'none' },
  persephone: { width: .91, shoulders: .53, waist: .32, hips: .46, skin: '#e1bca9', cloth: '#621923', leather: false, coat: false, hair: 'pixie', glasses: 'none' },
};

export interface CharacterRig {
  root: THREE.Group;
  detail: THREE.Group;
  distant: THREE.Mesh;
  torso: THREE.Group;
  head: THREE.Group;
  shoulders: THREE.Group[];
  elbows: THREE.Object3D[];
  mobilWrists?: THREE.Object3D[];
  fingers: THREE.Group[][];
  hips: THREE.Group[];
  knees: THREE.Object3D[];
  ankles: THREE.Group[];
  tails: THREE.Group[];
  cloth: { mesh: THREE.Mesh; rest: Float32Array }[];
  motion: MotionState;
  smallDetails: THREE.Group;
  oracleClothing?: { blouse: THREE.MeshStandardMaterial; trousers: THREE.MeshStandardMaterial; dry: THREE.Color[] };
  hero?: HeroRig;
  medicalCrew?: boolean;
  zionVariant?: { hero?: HeroRig; fallback: THREE.Object3D[]; realWorld: boolean };
  weapons?: THREE.Group[];
  spoon?: SpoonModel;
  dockCargo?: DockCargoModel;
  phone?: PhoneModel;
  handset?: HardlineHandset;
  cookie?: THREE.Group;
  staff?: THREE.Group;
  chateauBlade?: { weapon: ChateauWeapon; model: THREE.Group };
  infection?: THREE.Group;
  rifle?: boolean;
  weaponStyle?: RescueLoadout | 'pistol' | 'pulse' | 'hel_pistol' | 'gas_launcher' | 'revolver';
  muzzleIndex?: number;
  gateBolt?: THREE.Mesh;
  empCharm?: THREE.Group;
  diggerProps?: DiggerProps;
  sourcePortalProps?: SourcePortalProps;
  architectPen?: THREE.Group;
  freewayProps?: FreewayPickupProps;
  truckProps?: TruckWeaponProps;
}

export function weaponMuzzle(rig: CharacterRig): THREE.Vector3 | undefined {
  if (rig.truckProps?.gun.visible) return rig.truckProps.muzzle();
  if (!rig.weapons?.length) return;
  const gun = rig.weapons[(rig.muzzleIndex ?? 0) % rig.weapons.length]; rig.muzzleIndex = (rig.muzzleIndex ?? 0) + 1;
  gun.updateWorldMatrix(true, false);
  if (gun.userData.helPistol) return gun.localToWorld(new THREE.Vector3(0, .065, .475));
  const length = rig.weaponStyle === 'compact' ? .72 : rig.weaponStyle === 'breacher' || rig.weaponStyle === 'gas_launcher' ? 1.34 : ['rifle', 'pulse'].includes(rig.weaponStyle ?? '') ? 1.2 : .5;
  return gun.localToWorld(new THREE.Vector3(0, -length - .115, 0));
}

// All residents share anatomical proportions and joint animation. The four
// principal characters have distinct face topology, projected albedo and outfits.
export class CharacterModels {
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private satiPlaids = new WeakMap<THREE.MeshPhysicalMaterial, THREE.Texture>();
  private textures = new Set<THREE.Texture>();
  private skeletons = new Set<THREE.Skeleton>();
  private diggerProps = new Set<DiggerProps>();
  private sourcePortalProps = new Set<SourcePortalProps>();
  private freewayProps = new Set<FreewayPickupProps>();
  private truckProps = new Set<TruckWeaponProps>();
  private spoons = new Set<SpoonModel>();
  private dockCargo = new Set<DockCargoModel>();
  private phones = new Set<PhoneModel>();
  private handsets = new Set<HardlineHandset>();
  private sphere = this.geometry(new THREE.SphereGeometry(1, 16, 12));
  private cylinder = this.geometry(new THREE.CylinderGeometry(1, 1, 1, 12));
  private box = this.geometry(new THREE.BoxGeometry(1, 1, 1));
  private atlas: THREE.Texture;
  private fabric: THREE.CanvasTexture;
  private heroes: HeroModels;
  private epilogueHeads = new EpilogueHeads();
  private diggerBodies = new DiggerBodies();

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
    const digger = state.id === 'zee' || state.id === 'charra';
    const captain = ['niobe', 'lock', 'roland'].includes(state.id);
    const council = state.id === 'hamann' || state.id === 'west' || state.id === 'dillard';
    const hammerCrew = ['maggie', 'colt', 'link'].includes(state.id);
    const program = state.id === 'architect' || state.id === 'seraph' || state.id === 'keymaker';
    const mobilCast = state.id === 'rama_kandra' || state.id === 'kamala' || state.id === 'trainman';
    const sealOperator = state.id === 'citizen_15';
    const look: Look = HERO_LOOKS[state.id] ?? {
      width: 1, shoulders: 0.6, waist: 0.39, hips: 0.43, skin: state.appearance.headColor,
      cloth: state.faction === 'zion' && !state.isInMatrix ? '#665d4d' : state.appearance.clothing,
      leather: state.faction === 'zion' && state.isInMatrix, coat: false,
      hair: state.id === 'spoon_boy' ? 'bald' : 'short', glasses: state.faction === 'civilians' || state.faction === 'oracle' || state.faction === 'zion' && !state.isInMatrix ? 'none' : 'square',
    };
    if (state.id === 'citizen_2') look.cloth = '#a21722';
    if (sealOperator) { look.cloth = '#49352e'; look.hair = 'bald'; look.glasses = 'none'; look.leather = false; }
    if (state.id.startsWith('hel_garage_guard_')) {
      look.hair = 'bald'; look.glasses = 'narrow'; look.cloth = '#171b18'; look.skin = '#b49c80';
      look.leather = true; look.coat = true; look.shoulders = .78; look.waist = .55; look.hips = .54;
    }
    if (state.id.startsWith('chateau_guard_')) {
      look.glasses = 'none'; look.hair = state.id.endsWith('mace') || state.id.endsWith('axe') ? 'bald' : 'short';
      look.shoulders = state.id.endsWith('mace') ? .69 : .61;
    }
    const root = new THREE.Group(); const detail = new VisibleGroup(); root.add(detail);
    if (state.id === 'sati') root.scale.setScalar(.64);
    if (state.id === 'keymaker') root.scale.setScalar(.88);
    if (state.id === 'spoon_boy') { root.scale.setScalar(.73); look.cloth = '#d5c7ac'; look.skin = '#d8b99b'; }
    if (state.id.startsWith('potential_')) {
      root.scale.setScalar(state.id === 'potential_blocks' ? .65 : .62 + Number(state.id.slice(-1)) * .025);
      detail.position.y = .04;
      look.cloth = state.id === 'potential_blocks' ? '#d4cbb7' : '#b6b39f'; look.shoulders = .48; look.waist = .33; look.hips = .37;
      look.hair = state.id === 'potential_1' || state.id === 'potential_3' ? 'bald' : 'short';
    }
    if (state.id.startsWith('oracle_')) { look.cloth = '#dcd9cd'; look.leather = false; look.glasses = 'none'; }
    const torso = this.joint(detail, 0, 1.86); const smallDetails = this.joint(detail, 0, 0);
    const skin = this.material(new THREE.MeshStandardMaterial({ color: look.skin, roughness: 0.64, metalness: 0, bumpMap: this.fabric, bumpScale: 0.0012 }));
    if (digger) {
      const texture = new THREE.TextureLoader().load('/assets/characters/digger-faces.png');
      texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = false; texture.anisotropy = 8;
      texture.repeat.set(.035, .02); texture.offset.set(.232, state.id === 'zee' ? .452 : .952); this.textures.add(texture);
      skin.map = texture; skin.color.set('#ffffff'); skin.roughness = .73; skin.bumpScale = .0006;
    }
    if (captain) {
      const texture = new THREE.TextureLoader().load('/assets/characters/zion-captains-faces.png');
      texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = false; texture.anisotropy = 8;
      texture.repeat.set(.035, .012); texture.offset.set(.232, (state.id === 'niobe' ? 453 : state.id === 'lock' ? 944 : 1484) / 1536 - .002); this.textures.add(texture);
      skin.map = texture; skin.color.set('#ffffff'); skin.roughness = .73; skin.bumpScale = .0006;
    }
    if (council) {
      const texture = new THREE.TextureLoader().load('/assets/characters/zion-council-faces.png');
      texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = false; texture.anisotropy = 8;
      texture.repeat.set(.035, .012); texture.offset.set(.232, (state.id === 'hamann' ? 480 : state.id === 'west' ? 1000 : 1510) / 1536 - .002); this.textures.add(texture);
      skin.map = texture; skin.color.set('#ffffff'); skin.roughness = .76; skin.bumpScale = .0006;
    }
    if (hammerCrew) {
      const texture = new THREE.TextureLoader().load('/assets/characters/hammer-crew-faces.png');
      texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = false; texture.anisotropy = 8;
      texture.repeat.set(.035, .012); texture.offset.set(.232, (state.id === 'maggie' ? 468 : state.id === 'colt' ? 1008 : 1491) / 1536 - .002); this.textures.add(texture);
      skin.map = texture; skin.color.set('#ffffff'); skin.roughness = .76; skin.bumpScale = .0006;
    }
    if (program) {
      const texture = new THREE.TextureLoader().load(`/assets/characters/${state.id}-face-reference.png`);
      texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = false; texture.anisotropy = 8;
      texture.repeat.set(.035, .012); texture.offset.set(.232, (state.id === 'architect' ? 1080 : 1030) / 1254 - .002); this.textures.add(texture);
      skin.map = texture; skin.color.set('#ffffff'); skin.roughness = .76; skin.bumpScale = .0006;
    }
    if (mobilCast) {
      const texture = new THREE.TextureLoader().load(`/assets/characters/${state.id}-face-reference.png`);
      texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = false; texture.anisotropy = 8;
      texture.repeat.set(.035, .012); texture.offset.set(.232, (state.id === 'kamala' ? 1005 : state.id === 'trainman' ? 1010 : 1030) / 1254 - .002); this.textures.add(texture);
      skin.map = texture; skin.color.set('#ffffff'); skin.roughness = .76; skin.bumpScale = .0006;
    }
    if (look.face !== undefined) {
      const skinTexture = this.atlas.clone();
      skinTexture.repeat.set(0.12, 0.025); skinTexture.offset.set((look.face % 2) * 0.5 + 0.19, (look.face < 2 ? 0.5 : 0) + 0.02);
      skinTexture.needsUpdate = true; this.textures.add(skinTexture);
      skin.color.set('#ffffff'); skin.map = skinTexture;
    }
    const cloth = this.material(new THREE.MeshPhysicalMaterial({ color: look.cloth, roughness: look.leather ? 0.43 : 0.88,
      metalness: 0, clearcoat: look.leather ? 0.22 : 0, clearcoatRoughness: 0.4, bumpMap: this.fabric, bumpScale: look.leather ? 0.003 : 0.002, side: THREE.DoubleSide }));
    if (council) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#c5c2b5'; ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = state.id === 'hamann' ? '#697387' : '#9d9684'; ctx.lineWidth = 3;
      for (let x = -128; x < 256; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 128, 128); ctx.stroke(); }
      ctx.strokeStyle = '#b5ae93'; ctx.lineWidth = 1;
      for (let y = 0; y < 128; y += 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(128, y); ctx.stroke(); }
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(8, 8); texture.anisotropy = 4;
      cloth.map = texture; this.textures.add(texture);
    }
    if (state.id === 'sati') { cloth.map = this.satiPlaid(); this.satiPlaids.set(cloth, cloth.map); cloth.color.set(0xffffff); }
    const trousers = state.id === 'sati' || state.id === 'kamala' ? skin : state.id === 'rama_kandra' || state.id === 'seraph' || state.id === 'keymaker' || state.id === 'oracle' || digger || captain || council || sealOperator ? this.material(new THREE.MeshStandardMaterial({ color: state.id === 'oracle' ? '#554a40' : '#282c29', roughness: .9, bumpMap: this.fabric, bumpScale: .002 })) : cloth;
    const seams = this.material(new THREE.MeshStandardMaterial({ color: look.leather ? '#292e2a' : '#252c28', roughness: 0.75 }));
    const black = this.material(new THREE.MeshStandardMaterial({ color: '#070b0a', roughness: 0.32 }));
    const metal = this.material(new THREE.MeshStandardMaterial({ color: '#969c90', metalness: 0.88, roughness: 0.24 }));
    const shirt = this.material(new THREE.MeshStandardMaterial({ color: '#dbd9c8', roughness: 0.8, side: THREE.DoubleSide }));
    const bodyPoints = [[look.hips, 0], [look.hips + .01, .18], [look.waist + 0.02, 0.35], [look.waist, 0.63], [look.shoulders * .74, .9], [look.shoulders * 0.83, 1.15], [look.shoulders * .88, 1.39], [look.shoulders * .76, 1.52], [0.21, 1.66]].map(([r, y]) => new THREE.Vector2(r, y));
    const jacket = this.geometry(new THREE.LatheGeometry(bodyPoints, 40));
    if (sealOperator) {
      shirt.color.set('#beb39b'); shirt.bumpMap = this.fabric; shirt.bumpScale = .002;
      this.mesh(torso, this.geometry(jacket.clone()), shirt, [0, 0, 0], [.97, 1, .57]);
      const position = jacket.attributes.position;
      for (let i = 0; i < position.count; i++) {
        const front = Math.max(0, position.getZ(i) / Math.max(.01, Math.hypot(position.getX(i), position.getZ(i))));
        position.setY(i, position.getY(i) - .34 * front ** 6 * THREE.MathUtils.smoothstep(position.getY(i), 1.25, 1.66));
      }
      jacket.computeVertexNormals();
    }
    if (digger) {
      // Small cloth folds keep the vest off the skin without changing the joints.
      const position = jacket.attributes.position;
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), y = position.getY(i), z = position.getZ(i), angle = Math.atan2(x, z);
        const fold = 1 + Math.sin(angle * 9 + y * 14) * .017 * Math.sin(y / 1.66 * Math.PI);
        position.setXYZ(i, x * fold, y, z * fold);
      }
      jacket.computeVertexNormals();
    }
    if (state.id === 'sati') {
      const position = jacket.attributes.position;
      for (let i = 0; i < position.count; i++) {
        const front = Math.max(0, position.getZ(i) / Math.max(.01, Math.hypot(position.getX(i), position.getZ(i))));
        position.setY(i, position.getY(i) - .20 * front ** 4 * THREE.MathUtils.smoothstep(position.getY(i), 1.3, 1.66));
      }
      jacket.computeVertexNormals();
      const neckline = this.geometry(new THREE.LatheGeometry([[.255, 1.45], [.24, 1.5], [.16, 1.59], [.135, 1.68], [.13, 1.75]].map(([x, y]) => new THREE.Vector2(x, y)), 40));
      this.mesh(torso, neckline, skin, [0, 0, 0], [1, 1, .65]);
    }
    const blouse = this.mesh(torso, jacket, cloth, [0, 0, 0], [1, 1, 0.59]);
    let mobilCotton: THREE.MeshStandardMaterial | undefined;
    if (state.id === 'sati') {
      mobilCotton = this.material(new THREE.MeshStandardMaterial({ color: 0xd1d9a8, roughness: .94, bumpMap: this.fabric, bumpScale: .001, side: THREE.DoubleSide }));
      const overcoat = this.geometry(new THREE.LatheGeometry(bodyPoints.filter(point => point.y >= .35)
        .map(point => new THREE.Vector2(point.x + .025, point.y)), 40, .22, Math.PI * 2 - .44));
      const garment = this.mesh(torso, overcoat, mobilCotton, [0, .012, 0], [1, 1, .62]);
      garment.name = 'sati-mobil-jacket'; garment.visible = false;
      for (const side of [-1, 1]) {
        const lapel = this.mesh(garment, this.geometry(new RoundedBoxGeometry(.15, .49, .022, 2, .009)), mobilCotton,
          [side * .20, 1.29, .248]); lapel.rotation.z = side * .16;
      }
    }
    const hem = this.mesh(torso, this.sphere, cloth, [0, .02, 0], [look.hips, .22, look.hips * .59]);
    if (state.id === 'kamala') {
      const skirt = this.mesh(torso, this.geometry(new THREE.CylinderGeometry(.45, .60, 1.14, 40, 8, true)),
        this.material(new THREE.MeshStandardMaterial({ color: '#554839', roughness: .95, bumpMap: this.fabric, bumpScale: .0015, side: THREE.DoubleSide })), [0, 0, 0]);
      skirt.name = 'kamala-skirt'; skirt.geometry.scale(1, 1, .6); skirt.geometry.translate(0, -.51, 0);
      skirt.userData.standing = Float32Array.from(skirt.geometry.attributes.position.array);
      for (const side of [-1, 1]) this.surface(torso, [[side * .13, 1.77, .16], [side * .29, 1.56, .26], [side * .13, 1.40, .28], [side * .045, 1.65, .22]], cloth);
    }
    if (state.id === 'oracle') { blouse.name = 'oracle-daily-blouse'; hem.name = 'oracle-daily-hem'; }
    if (state.id === 'citizen_2') {
      const skirt = this.mesh(detail, this.geometry(new THREE.CylinderGeometry(.49, .82, 2.35, 32, 4, true)), cloth, [0, 1.27, 0]);
      skirt.name = 'red-dress-skirt'; skirt.scale.z = .68;
    }
    if (state.id === 'persephone') {
      const skirt = this.mesh(detail, this.geometry(new THREE.CylinderGeometry(.36, .74, 2.12, 32, 4, true)), cloth, [0, 1.18, 0]);
      skirt.name = 'persephone-dress'; skirt.scale.z = .7;
    }
    if (state.id === 'oracle') {
      const apronGroup = new THREE.Group(); apronGroup.name = 'oracle-apron-group'; torso.add(apronGroup);
      const apron = this.material(new THREE.MeshStandardMaterial({ color: '#d7c19a', roughness: .93, bumpMap: this.fabric, bumpScale: .002, side: THREE.DoubleSide }));
      const positions: number[] = [], indices: number[] = [];
      // Follow the blouse profile; a flat bib cut through its rounded chest.
      for (const [row, point] of bodyPoints.entries()) for (let column = 0; column <= 12; column++) {
        const width = Math.min(point.x * .88, point.y > .7 ? .31 : .44), x = (column / 6 - 1) * width;
        positions.push(x, point.y + .02, Math.sqrt(Math.max(0, point.x * point.x - x * x)) * .59 + .035);
        if (row > 0 && column < 12) {
          const a = (row - 1) * 13 + column, b = row * 13 + column;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices); geometry.computeVertexNormals();
      const bib = this.mesh(apronGroup, this.geometry(geometry), apron, [0, 0, 0]); bib.name = 'oracle-apron';
      for (const side of [-1, 1]) this.mesh(apronGroup, this.cylinder, apron, [side * .22, 1.7, .22], [.018, .42, .018]).rotation.z = side * .16;
    }
    if (state.id === 'oracle') {
      const fabric = this.material(new THREE.MeshStandardMaterial({ color: 0x526e56, roughness: .98, side: THREE.DoubleSide, bumpMap: this.fabric, bumpScale: .0015 }));
      const geometry = this.geometry(new THREE.CylinderGeometry(.51, .75, 1.8, 48, 32, true));
      geometry.scale(1, 1, .66); geometry.translate(0, 1.1, 0);
      const dress = this.mesh(detail, geometry, fabric, [0, 0, 0]); dress.name = 'oracle-request-dress'; dress.visible = false;
      const lastGeometry = this.geometry(geometry.clone());
      const lastDress = this.mesh(detail, lastGeometry, fabric, [0, 0, 0]); lastDress.name = 'oracle-last-dress'; lastDress.visible = false;
      lastDress.userData.standing = Float32Array.from(lastGeometry.attributes.position.array);
      const pearls = new THREE.Group(); pearls.name = 'oracle-last-necklace'; pearls.visible = false; torso.add(pearls);
      const pearl = this.material(new THREE.MeshStandardMaterial({ color: 0xcabfa4, roughness: .35, metalness: .15 }));
      for (let i = 0; i < 22; i++) {
        const angle = i / 21 * Math.PI; this.mesh(pearls, this.sphere, pearl, [Math.cos(angle) * .22, 1.65 - Math.sin(angle) * .13, .17 + Math.sin(angle) * .15], [.025, .025, .025]);
      }
      const bodice = new THREE.Group(); bodice.name = 'oracle-request-bodice'; bodice.visible = false; torso.add(bodice);
      for (const side of [-1, 1]) this.surface(bodice, [[side * .17, 1.70, .15], [side * .04, 1.50, .30], [side * .29, 1.44, .28], [side * .35, 1.56, .20]], fabric);
      for (const y of [.45, .68, .91, 1.13, 1.35]) this.mesh(bodice, this.sphere, this.material(new THREE.MeshStandardMaterial({ color: 0x253d2e, roughness: .8 })), [0, y, .343], [.018, .018, .014]);
    }
    if (state.id === 'oracle' || state.id === 'sati') {
      const outfit = new THREE.Group(); outfit.name = `${state.id}-park-outfit`; outfit.visible = state.id === 'sati'; detail.add(outfit);
      const dress = state.id === 'sati' ? cloth : this.material(new THREE.MeshStandardMaterial({ map: this.oracleFloral(), roughness: .94, side: THREE.DoubleSide, bumpMap: this.fabric, bumpScale: .0015 }));
      const geometry = new THREE.CylinderGeometry(.51, .7, 1.58, state.id === 'sati' ? 64 : 32, state.id === 'sati' ? 16 : 10, true);
      const skirt = this.mesh(outfit, this.geometry(geometry), dress, [0, 0, 0]); skirt.name = state.id === 'oracle' ? 'oracle-park-skirt' : 'sati-skirt';
      // Keep the neutral dress valid outside an epilogue pose as well.
      if (state.id === 'sati') {
        geometry.scale(.95, 1.07 / 1.58, .66); geometry.translate(0, 1.565, 0);
      } else geometry.translate(0, 1.19, 0);
      skirt.userData.standing = Float32Array.from(geometry.attributes.position.array);
      if (state.id === 'oracle') {
        const coat = this.material(new THREE.MeshStandardMaterial({ color: '#304b59', roughness: .91, side: THREE.DoubleSide, bumpMap: this.fabric, bumpScale: .002 }));
        const upper = new THREE.Group(); upper.name = 'oracle-park-upper'; upper.visible = false; torso.add(upper);
        this.mesh(upper, this.geometry(jacket.clone()), dress, [0, 0, 0], [1, 1, .59]);
        const outer = new THREE.LatheGeometry(bodyPoints.map(p => new THREE.Vector2(p.x + .055, p.y)), 40, .49, Math.PI * 2 - .98);
        this.mesh(upper, this.geometry(outer), coat, [0, 0, 0], [1, 1, .65]);
        const collar = this.material(new THREE.MeshStandardMaterial({ color: '#d3cbb6', roughness: .95, side: THREE.DoubleSide, bumpMap: this.fabric, bumpScale: .001 }));
        for (const side of [-1, 1]) {
          this.surface(upper, [[side * .13, 1.76, .15], [side * .29, 1.60, .28], [side * .33, 1.24, .31], [side * .12, 1.44, .30]], collar);
          this.surface(upper, [[side * .31, 1.49, .31], [side * .44, 1.30, .30], [side * .29, .91, .30], [side * .23, 1.24, .34]], coat);
          this.mesh(upper, this.cylinder, coat, [side * .41, .48, .27], [.008, .26, .008]).rotation.z = side * 1.35;
        }
        const tails = new THREE.CylinderGeometry(.57, .81, 1.92, 48, 16, true, .49, Math.PI * 2 - .98);
        tails.scale(1, 1, .69); tails.translate(0, 1.08, 0);
        const lower = this.mesh(outfit, this.geometry(tails), coat, [0, 0, 0]); lower.name = 'oracle-park-coat';
        lower.userData.standing = Float32Array.from(tails.attributes.position.array);
        const bag = new THREE.Group(); bag.name = 'oracle-park-handbag'; outfit.add(bag);
        const leather = this.material(new THREE.MeshPhysicalMaterial({ color: '#3d6264', roughness: .64, clearcoat: .12, bumpMap: this.fabric, bumpScale: .001 }));
        const piping = this.material(new THREE.MeshStandardMaterial({ color: '#243c3d', roughness: .75 }));
        this.mesh(bag, this.geometry(new RoundedBoxGeometry(.94, .49, .33, 4, .07)), leather, [0, 0, 0]).name = 'oracle-handbag-body';
        this.mesh(bag, this.geometry(new RoundedBoxGeometry(.81, .045, .25, 3, .015)), piping, [0, .245, 0]);
        for (const z of [-.11, .11]) {
          const handle = new THREE.CatmullRomCurve3([[-.32, .22, z], [-.29, .57, z], [0, .68, z], [.29, .57, z], [.32, .22, z]].map(p => new THREE.Vector3(...p as [number, number, number])));
          this.mesh(bag, this.geometry(new THREE.TubeGeometry(handle, 48, .023, 8, false)), leather, [0, 0, 0]).name = `oracle-handbag-handle-${z}`;
          for (const side of [-1, 1]) this.mesh(bag, this.geometry(new THREE.TorusGeometry(.035, .006, 6, 16)), metal, [side * .32, .22, z]);
        }
        const edge = new THREE.CatmullRomCurve3([[-.37, .16, .167], [-.42, -.13, .167], [0, -.20, .167], [.42, -.13, .167], [.37, .16, .167]]
          .map(p => new THREE.Vector3(...p as [number, number, number])));
        this.mesh(bag, this.geometry(new THREE.TubeGeometry(edge, 48, .006, 5, false)), piping, [0, 0, 0]);
      }
    }
    const neck = this.mesh(torso, this.cylinder, skin, [0, 1.79, 0], [0.145, 0.25, 0.135]);
    if (state.id === 'oracle' || state.id === 'sati' || digger || captain || council || program || mobilCast) neck.name = `${state.id}-neck`;
    // Raised collars, seams, belt and tailored panels are visible from all sides.
    if (state.faction !== 'machines' && state.id !== 'sati') {
      const collar = this.geometry(new THREE.CylinderGeometry(0.17, 0.195, state.id === 'neo' ? 0.15 : 0.095, 24, 1, true));
      const rim = this.mesh(torso, collar, sealOperator ? shirt : cloth, [0, state.id === 'neo' ? 1.71 : 1.64, 0], [1, 1, 0.86]);
      if (state.id === 'oracle') rim.name = 'oracle-daily-collar';
    }
    if (state.id !== 'sati') {
      const tailoring = state.id === 'oracle' ? this.joint(torso, 0, 0) : torso;
      if (state.id === 'oracle') tailoring.name = 'oracle-daily-tailoring';
      this.mesh(tailoring, this.cylinder, black, [0, 0.24, 0], [look.hips + 0.018, 0.10, (look.hips + 0.018) * 0.6]);
      this.mesh(tailoring, this.box, metal, [0, 0.24, look.hips * 0.6 + 0.022], [0.16, 0.1, 0.018]);
      this.mesh(tailoring, this.cylinder, seams, [0, 0.99, look.waist * 0.6 + 0.015], [0.008, 1.1, 0.008]);
    }
    if (state.id === 'smith' || state.id === 'merovingian' || state.id === 'rama_kandra' || state.faction === 'machines') {
      this.surface(torso, [[-0.18, 1.76, 0.19], [0.18, 1.76, 0.19], [0.10, 0.7, 0.32], [-0.10, 0.7, 0.32]], shirt);
      this.surface(torso, [[-0.28, 1.62, 0.23], [-0.45, 1.25, 0.23], [-0.12, 0.61, 0.32], [-0.02, 1.26, 0.33]], cloth);
      this.surface(torso, [[0.28, 1.62, 0.23], [0.02, 1.26, 0.33], [0.12, 0.61, 0.32], [0.45, 1.25, 0.23]], cloth);
      for (const side of [-1, 1]) this.surface(torso, [[side * 0.18, 1.78, 0.20], [side * 0.04, 1.66, 0.275], [side * 0.13, 1.48, 0.30]], shirt);
      this.surface(torso, [[-0.035, 1.61, 0.30], [0.035, 1.61, 0.30], [0.062, 0.88, 0.35], [0, 0.78, 0.35]], black);
      this.mesh(torso, this.box, black, [0, 1.65, 0.285], [0.085, 0.08, 0.022]);
      for (const y of [0.45, 0.67]) this.mesh(torso, this.sphere, black, [0.095, y, 0.26], [0.027, 0.027, 0.014]);
    }
    const head = this.joint(torso, 0, 2.13);
    if (['oracle', 'mifune', 'kid', 'charra', 'zee', 'niobe', 'lock', 'roland', 'architect', 'seraph', 'keymaker', 'hamann', 'west', 'dillard'].includes(state.id)) head.name = `${state.id}-head`;
    if (state.id === 'citizen_15' || state.id === 'citizen_16') head.name = `${state.id}-head`;
    if (state.id === 'sati') { head.name = 'sati-head'; head.position.y = 1.99; }
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
        const eye = ['oracle', 'mifune'].includes(state.id) ? this.joint(head, 0, 0) : head;
        if (['oracle', 'mifune'].includes(state.id)) {
          eye.name = `${state.id}-open-eye`;
          const lid = this.mesh(head, this.sphere, skin, [side * .10, -.012, .222], [.058, .021, .016]);
          lid.name = `${state.id}-closed-eye`; lid.visible = false;
        }
        this.mesh(eye, this.sphere, shirt, [side * 0.10, -0.012, 0.219], [0.058, 0.021, 0.016]);
        this.mesh(eye, this.sphere, black, [side * 0.10, -0.012, 0.233], [0.018, 0.019, 0.009]);
        this.mesh(head, this.box, black, [side * 0.105, 0.036, 0.22], [0.1, 0.016, 0.017]);
      }
      this.mesh(head, this.sphere, this.material(new THREE.MeshStandardMaterial({ color: '#916756', roughness: 0.7 })), [0, -0.24, 0.224], [0.078, 0.014, 0.012]);
    }
    if (look.hair !== 'bald') this.addHair(head, look, state.id === 'architect' || state.id === 'hamann' || state.id === 'dillard' ? '#c4c5bc' : '#100f0d');
    if (state.id === 'rama_kandra' || state.id === 'kamala' || state.id === 'trainman') {
      const hair = this.material(new THREE.MeshStandardMaterial({ color: state.id === 'trainman' ? '#55594c' : '#211e17', roughness: .96, bumpMap: this.fabric, bumpScale: .002 }));
      if (state.id === 'rama_kandra') {
        this.mesh(head, this.geometry(new THREE.SphereGeometry(1, 32, 20, Math.PI, Math.PI)), hair, [0, -.015, -.05], [.283, .32, .22]);
        this.mesh(head, this.sphere, hair, [0, -.20, -.17], [.245, .22, .15]);
        for (let i = 0; i < 15; i++) {
          const a = -1.25 + i * 2.5 / 14;
          this.mesh(head, this.sphere, hair, [Math.sin(a) * .18, -.235 - Math.cos(a) * .1, Math.cos(a) * .195], [.055, .065, .055]);
        }
        this.mesh(head, this.sphere, hair, [0, -.18, .25], [.077, .015, .018]);
      } else if (state.id === 'kamala') this.mesh(head, this.sphere, hair, [0, -.04, -.19], [.265, .38, .135]);
      else for (const side of [-1, 1]) for (let i = 0; i < 8; i++) {
        const x = side * (.2 + i % 3 * .03), z = -.07 + i / 7 * .21;
        const path = new THREE.CatmullRomCurve3([[x, .2, z], [x + side * .025, -.1, z + .02], [x - side * .02, -.41, z], [x + side * .015, -.68 + i % 3 * .055, z - .06]].map(p => new THREE.Vector3(...p as [number, number, number])));
        this.mesh(head, this.geometry(new THREE.TubeGeometry(path, 16, .013, 5, false)), hair, [0, 0, 0]);
      }
    }
    if (sealOperator) {
      const cap = this.material(new THREE.MeshStandardMaterial({ color: '#323328', roughness: .98, bumpMap: this.fabric, bumpScale: .0015 }));
      this.mesh(head, this.geometry(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI * .45)), cap, [0, .14, -.02], [.298, .242, .28]);
      this.mesh(head, this.sphere, cap, [0, .177, .22], [.30, .018, .18]);
    }
    if (state.id === 'architect') {
      const beard = this.material(new THREE.MeshStandardMaterial({ color: '#c4c5bc', roughness: .96 }));
      for (let i = 0; i < 15; i++) {
        const angle = -1.15 + i / 14 * 2.3;
        this.mesh(head, this.sphere, beard, [Math.sin(angle) * .18, -.26 - Math.cos(angle) * .04, Math.cos(angle) * .19], [.07, .09, .055]);
      }
    }
    if (state.id === 'persephone') {
      this.mesh(head, this.sphere, black, [0, .20, -.19], [.27, .25, .19]);
      this.mesh(head, this.sphere, black, [0, .28, .13], [.27, .10, .15]);
      for (const side of [-1, 1]) this.mesh(head, this.sphere, black, [side * .23, -.15, -.07], [.07, .29, .13]);
    }
    if (state.id === 'merovingian') {
      this.mesh(head, this.sphere, black, [0, .24, -.10], [.29, .14, .2]);
      this.mesh(head, this.sphere, black, [0, .28, .13], [.28, .10, .15]);
      for (const side of [-1, 1]) this.mesh(head, this.sphere, black, [side * .25, -.13, -.08], [.065, .23, .12]);
    }
    if (state.id === 'seraph') {
      this.mesh(head, this.sphere, black, [0, .035, -.14], [.275, .30, .145]);
      this.mesh(head, this.sphere, black, [0, .27, .11], [.255, .11, .16]);
    }
    if (state.id === 'zee') {
      const wrap = this.mesh(head, this.sphere, cloth, [0, .18, -.06], [.3, .22, .29]); wrap.name = 'zee-cloth-headwrap';
      for (const side of [-1, 1]) this.mesh(head, this.box, cloth, [side * .07, -.16, -.3], [.12, .45, .07]);
    }
    if (look.glasses !== 'none') this.addGlasses(head, look, black, metal);

    const shoulders: THREE.Group[] = []; const elbows: THREE.Object3D[] = []; const hips: THREE.Group[] = []; const knees: THREE.Object3D[] = []; const ankles: THREE.Group[] = []; const tails: THREE.Group[] = [];
    const clothPanels: CharacterRig['cloth'] = [];
    const fingers: THREE.Group[][] = [];
    const mobilWrists: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const shoulder = this.joint(torso, side * look.shoulders * 0.87, 1.39);
      shoulders.push(shoulder);
      const arm = [[.10, -1.43], [.115, -1.23], [.14, -1.03], [.15, -.91], [.16, -.82], [.155, -.73], [.17, -.62], [.18, -.45], [.195, -.24], [.215, -.04], [.19, .08], [.10, .15], [.002, .18]];
      if (state.id === 'sati') for (const point of arm) point[0] *= .78;
      if (digger) for (const point of arm) point[0] *= .9;
      const elbow = this.limb(shoulder, arm, .81, state.id === 'sati' || state.id === 'bane' || digger || sealOperator ? skin : cloth, .94);
      elbows.push(elbow);
      if (mobilCotton) {
        const armMesh = shoulder.children.find(child => child instanceof THREE.SkinnedMesh) as THREE.SkinnedMesh;
        armMesh.name = `sati-covered-arm-${side}`;
        const sleeve = new THREE.SkinnedMesh(this.geometry(armMesh.geometry.clone().scale(1.18, 1, 1.18)), mobilCotton);
        sleeve.name = `sati-mobil-sleeve-${side}`; sleeve.visible = false;
        sleeve.castShadow = sleeve.receiveShadow = true; sleeve.frustumCulled = false;
        shoulder.add(sleeve); sleeve.bind(armMesh.skeleton, armMesh.bindMatrix);
      }
      if (sealOperator || state.id === 'bane') {
        const sleeve = this.geometry(new THREE.LatheGeometry([[.18, -.69], [.197, -.67], [.20, -.58], [.207, -.39], [.225, -.20], [.239, 0], [.218, .09], [.13, .16], [.003, .18]].map(([r, y]) => new THREE.Vector2(r, y)), 24));
        this.mesh(shoulder, sleeve, state.id === 'bane' ? cloth : shirt, [0, 0, 0], [1, 1, .94]);
        this.mesh(shoulder, this.cylinder, shirt, [0, -.65, 0], [.203, .075, .193]);
      }
      if (state.id !== 'sati' && !digger && !sealOperator) this.mesh(elbow, this.cylinder, seams, [0, -0.56, 0], [0.13, 0.045, 0.14]);
      const handMaterial = look.leather ? black : skin;
      const parentHand = state.id === 'oracle' || state.id.startsWith('hel_garage_guard_') || council || ['rama_kandra', 'kamala', 'trainman', 'seraph', 'bane', 'maggie', 'colt', 'link', 'roland', 'morpheus', 'niobe'].includes(state.id);
      const wristOffset = state.id === 'sati' ? .68 : parentHand ? .65 : 0;
      const hand = wristOffset ? this.joint(elbow, 0, -wristOffset) : elbow;
      if (parentHand) { hand.name = `${state.id === 'oracle' ? 'oracle-hand' : 'mobil-palm'}-${side < 0 ? 'R' : 'L'}`; if (state.id !== 'oracle') mobilWrists.push(hand); }
      if (state.id === 'oracle' && side < 0) {
        const candy = this.mesh(hand, this.sphere, this.material(new THREE.MeshStandardMaterial({ color: 0xa1201d, roughness: .3 })), [-.025, -.18, .055], [.052, .037, .04]); candy.name = 'oracle-last-candy'; candy.visible = false;
        const cigarette = new THREE.Group(); cigarette.name = 'oracle-last-cigarette'; cigarette.visible = false; hand.add(cigarette); cigarette.position.set(-.028, -.21, .045);
        const paper = this.material(new THREE.MeshStandardMaterial({ color: 0xdcd4bc, roughness: .92 }));
        const body = this.mesh(cigarette, this.cylinder, paper, [0, 0, .10], [.02, .22, .02]); body.rotation.x = Math.PI / 2;
        const ember = this.material(new THREE.MeshStandardMaterial({ color: 0x5c2e18, emissive: 0x7d2609, emissiveIntensity: .3, roughness: 1 }));
        this.mesh(cigarette, this.sphere, ember, [0, 0, .213], [.021, .021, .013]);
      }
      if (state.id === 'bane') {
        const scar = this.material(new THREE.MeshStandardMaterial({ color: 0x9f6b5d, roughness: .92 }));
        for (let cut = 0; cut < 4; cut++) {
          const line = new THREE.CatmullRomCurve3([new THREE.Vector3(-.08, -.22 - cut * .095, .137), new THREE.Vector3(0, -.245 - cut * .095, .155), new THREE.Vector3(.085, -.26 - cut * .095, .135)]);
          const mark = this.mesh(elbow, this.geometry(new THREE.TubeGeometry(line, 12, .006, 5, false)), scar, [0, 0, 0]); mark.name = `bane-healed-cut-${side}-${cut}`;
        }
      }
      if (state.id === 'sati') hand.name = `sati-hand-${side}`;
      const palm = this.mesh(hand, this.sphere, handMaterial, [0, -0.75 + wristOffset, 0.005], [0.095, 0.145, 0.055]);
      if (state.id === 'oracle') palm.name = `oracle-palm-${side}`;
      const handFingers: THREE.Group[] = [];
      for (let finger = 0; finger < 4; finger++) {
        const joint = this.joint(hand, -0.063 + finger * 0.041, -.82 + wristOffset, .01);
        this.mesh(joint, this.sphere, handMaterial, [0, -.055, 0], [.024, .073 - Math.abs(1.5 - finger) * .009, .027]);
        handFingers.push(joint);
      }
      fingers.push(handFingers);
      const thumb = this.mesh(hand, this.sphere, handMaterial, [side * -0.10, -0.75 + wristOffset, 0.02], [0.03, 0.08, 0.03]); thumb.rotation.z = side * 0.5;

      const hip = this.joint(detail, side * 0.225, 1.86); hips.push(hip);
      const leg = [[.125, -1.8], [.14, -1.63], [.155, -1.39], [.165, -1.17], [.15, -1.03], [.16, -.94], [.17, -.85], [.185, -.68], [.21, -.40], [.24, -.13], [.22, .04], [.002, .1]];
      if (state.id === 'sati') for (const point of leg) point[0] *= 1 - .23 * THREE.MathUtils.smoothstep(point[1], -.7, -.13);
      const knee = this.limb(hip, leg, .94, trousers, 1.13);
      knees.push(knee);
      if (digger) {
        const pocket = this.mesh(hip, this.box, trousers, [side * .20, -.39, 0], [.06, .33, .25]); pocket.rotation.z = side * -.08;
        this.mesh(hip, this.box, seams, [side * .237, -.26, 0], [.012, .045, .27]);
      }
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
    if (mobilWrists.length) rig.mobilWrists = mobilWrists;
    if (state.id === 'colt' || state.id === 'link') rig.medicalCrew = true;
    if (state.id === 'niobe' || state.id === 'link') rig.zionVariant = { fallback: [...detail.children], realWorld: !state.isInMatrix && (!rig.medicalCrew || Boolean(state.currentAction?.parameters.maggieDiscovery)) };
    if (state.id === 'oracle') rig.oracleClothing = { blouse: cloth, trousers, dry: [cloth.color.clone(), trousers.color.clone()] };
    const guard = ['agent_jones', 'agent_brown', 'agent_johnson', 'agent_jackson', 'agent_thompson'].includes(state.id) ? state.id as 'agent_jones' | 'agent_brown' | 'agent_johnson' | 'agent_jackson' | 'agent_thompson' : undefined;
    const reloadedBase: Record<string, HeroId> = { niobe: 'trinity', ballard: 'morpheus', ghost: 'neo', soren: 'smith', link: 'morpheus', dozer: 'morpheus', tank: 'neo', cypher: 'neo', oracle_priestess: 'trinity', oracle_attendant: 'trinity', citizen_4: 'neo', citizen_14: 'neo' };
    const support = state.id === 'switch' || state.id === 'apoc' || state.id === 'rhineheart' || state.id === 'courier' || state.id === 'choi' || state.id === 'dujour' || state.id in reloadedBase ? state.id as HeroSupport : undefined;
    if (HERO_IDS.includes(state.id as HeroId) || guard || support) {
      this.heroes.create(reloadedBase[state.id] ?? (guard || support === 'rhineheart' ? 'smith' : support === 'switch' || support === 'dujour' ? 'trinity' : support === 'apoc' || support === 'courier' || support === 'choi' ? 'neo' : state.id as HeroId), guard, support).then(model => {
        if (!model) return;
        rig.weapons?.forEach(gun => gun.removeFromParent()); rig.weapons = undefined; rig.weaponStyle = undefined;
        if (rig.zionVariant) {
          rig.zionVariant.hero = model; model.root.visible = !rig.zionVariant.realWorld;
          if (!rig.zionVariant.realWorld) { rig.zionVariant.fallback.forEach(child => { child.visible = false; }); rig.hero = model; }
        } else { for (const child of detail.children) child.visible = false; rig.hero = model; }
        detail.add(model.root);
        if (rig.staff) { rig.staff.removeFromParent(); rig.staff.position.set(0, -.16, .06); model.bones.get('wrist_R')!.add(rig.staff); }
        if (rig.chateauBlade) { rig.chateauBlade.model.removeFromParent(); rig.chateauBlade.model.position.set(0, -.16, .06); model.bones.get('wrist_R')!.add(rig.chateauBlade.model); }
      }).catch(error => console.warn(`${state.id} asset could not load; retaining the procedural character.`, error));
    }
    batchStaticGeometry(detail, new Set(clothPanels.map(panel => panel.mesh))).forEach(geometry => this.geometries.add(geometry));
    if (state.id === 'oracle' || state.id === 'sati' || state.id === 'zee' || state.id === 'charra' || state.id === 'niobe' || state.id === 'lock' || state.id === 'roland' || state.id === 'architect' || state.id === 'seraph' || state.id === 'keymaker' || state.id === 'rama_kandra' || state.id === 'kamala' || state.id === 'trainman' || state.id === 'hamann' || state.id === 'west' || state.id === 'dillard' || state.id === 'maggie' || state.id === 'colt' || state.id === 'link') this.epilogueHeads.track(rig, state.id);
    if (state.id === 'zee' || state.id === 'charra' || state.id === 'niobe' || state.id === 'lock' || state.id === 'roland' || state.id === 'architect' || state.id === 'seraph' || state.id === 'keymaker' || state.id === 'rama_kandra' || state.id === 'kamala' || state.id === 'trainman' || state.id === 'hamann' || state.id === 'west' || state.id === 'dillard' || state.id === 'maggie' || state.id === 'colt' || state.id === 'link') this.diggerBodies.track(rig, state.id, skin, cloth, trousers);
    enableSkinnedCulling(detail);
    return rig;
  }

  private addHair(head: THREE.Group, look: Look, color: string): void {
    const material = this.material(new THREE.MeshStandardMaterial({ color, roughness: 0.84, bumpMap: this.fabric, bumpScale: 0.003 }));
    // Portraits already contain a frontal hairline; untextured residents need
    // a complete crown outside the skin, including while a detailed head loads.
    if (look.face === undefined) this.mesh(head, this.geometry(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI * .35)), material,
      [0, .03, -.015], [.288 * look.width, .365, .27]);
    const back = new THREE.SphereGeometry(1, 24, 16, Math.PI, Math.PI, 0, Math.PI * 0.76);
    this.mesh(head, this.geometry(back), material, [0, 0.03, -0.015], [0.275 * look.width, 0.32, 0.235]);
  }

  private satiPlaid(): THREE.DataTexture {
    const size = 128, pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let color = [224, 226, 202];
      if (x % 64 < 25 || y % 64 < 25) color = [201, 213, 196];
      if ([0, 4, 25, 29].includes(x % 64) || [0, 4, 25, 29].includes(y % 64)) color = [115, 143, 156];
      if (x % 64 === 43 || y % 64 === 43) color = [176, 166, 121];
      const weave = ((x + y) % 2 ? 2 : -2) + Math.sin(x * 7.13 + y * 5.37) * 2;
      pixels.set([...color.map(value => value + weave), 255], (y * size + x) * 4);
    }
    const texture = new THREE.DataTexture(pixels, size, size); texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(5, 4); texture.anisotropy = 8;
    texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true;
    texture.needsUpdate = true; this.textures.add(texture); return texture;
  }

  private oracleFloral(): THREE.DataTexture {
    const size = 256, pixels = new Uint8Array(size * size * 4);
    const flowers = Array.from({ length: 12 }, (_, i) => ({ x: (i % 4) * 64 + 18 + i * 13 % 27,
      y: Math.floor(i / 4) * 85 + 25 + i * 19 % 37, angle: i * 1.71 }));
    const wrap = (value: number) => (value + size * 1.5) % size - size / 2;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let color = [117, 143, 131];
      for (const flower of flowers) {
        const dx = wrap(x - flower.x), dy = wrap(y - flower.y);
        if (dy > 0 && dy < 42 && Math.abs(dx - Math.sin(dy * .10 + flower.angle) * 4) < 1.1) color = [56, 83, 76];
        for (const side of [-1, 1]) {
          const lx = dx - side * 8, ly = dy - 18 - side * 5;
          const across = lx * .75 + side * ly * .66, along = ly * .75 - side * lx * .66;
          if ((across / 3.2) ** 2 + (along / 9) ** 2 < 1) color = [65, 101, 89];
        }
        const radius = Math.hypot(dx, dy), angle = Math.atan2(dy, dx) - flower.angle;
        if (radius < 9 + Math.cos(angle * 5) * 3) color = [88 + Math.cos(angle * 5) * 12, 68, 82];
        if (radius < 3) color = [162, 146, 107];
      }
      const weave = (x + y) % 2 ? 1.5 : -1.5;
      pixels.set([...color.map(value => value + weave), 255], (y * size + x) * 4);
    }
    const texture = new THREE.DataTexture(pixels, size, size); texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(2, 2); texture.anisotropy = 8;
    texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true;
    texture.needsUpdate = true; this.textures.add(texture); return texture;
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
    for (const side of ['R', 'L']) rig.root.getObjectByName(`oracle-hand-${side}`)?.quaternion.identity();
    if (rig.detail.userData.oracleLastPose && !input.oracleLast && !input.oracleAbsorption) {
      delete rig.detail.userData.oracleLastPose;
      rig.hips.forEach((hip, i) => { hip.position.x = (i ? 1 : -1) * .225; hip.position.z = 0; });
      rig.oracleClothing?.blouse.color.copy(rig.oracleClothing.dry[0]);
    }
    if (rig.detail.userData.helPistol) { rig.mobilWrists?.forEach(wrist => wrist.quaternion.identity()); delete rig.detail.userData.helPistol; }
    const skirt = rig.detail.getObjectByName('sati-skirt') as THREE.Mesh | undefined;
    if (skirt) {
      const cloth = skirt.material as THREE.MeshPhysicalMaterial, map = input.mobilStation ? null : this.satiPlaids.get(cloth) ?? null;
      if (cloth.map !== map) { cloth.map = map; cloth.needsUpdate = true; }
      cloth.color.setHex(input.mobilStation ? 0xd4dbad : 0xffffff);
      for (const name of ['sati-mobil-jacket', 'sati-mobil-sleeve--1', 'sati-mobil-sleeve-1']) {
        const garment = rig.detail.getObjectByName(name); if (garment) garment.visible = Boolean(input.mobilStation);
      }
      for (const side of [-1, 1]) rig.detail.getObjectByName(`sati-covered-arm-${side}`)!.visible = !input.mobilStation;
    }
    if (rig.architectPen) { rig.architectPen.visible = input.architect?.role === 'architect'; if (!input.architect) rig.detail.position.y = .04; }
    if (input.architect?.role === 'architect' && !rig.architectPen) {
      const pen = new THREE.Group(); pen.name = 'architect-metal-pen'; rig.detail.add(pen); rig.architectPen = pen;
      const metal = this.material(new THREE.MeshStandardMaterial({ color: 0xaeb3ae, roughness: .28, metalness: .85 }));
      this.mesh(pen, this.geometry(new THREE.CylinderGeometry(.022, .022, .36, 10)), metal, [0, 0, 0]);
      this.mesh(pen, this.geometry(new THREE.ConeGeometry(.021, .05, 10)), metal, [0, -.2, 0]).rotation.z = Math.PI;
    }
    if (rig.sourcePortalProps && !rig.hero) { rig.detail.position.set(0, .04, 0); rig.detail.rotation.set(0, 0, 0); }
    if (input.sourcePortal && input.sourcePortal.role !== 'morpheus' && !rig.sourcePortalProps) {
      rig.sourcePortalProps = new SourcePortalProps(rig.detail); this.sourcePortalProps.add(rig.sourcePortalProps);
    }
    const near = distance < 100 || Boolean(input.oracleRestored);
    rig.detail.visible = near; rig.distant.visible = !near;
    if (!near) return;
    if (rig.zionVariant) {
      const variant = rig.zionVariant, realWorld = Boolean(input.realWorld) && (!rig.medicalCrew || Boolean(input.maggieDiscovery));
      if (variant.realWorld !== realWorld) {
        variant.realWorld = realWorld; variant.fallback.forEach(child => { child.visible = realWorld; });
        rig.weapons?.forEach(gun => gun.removeFromParent()); rig.weapons = undefined; rig.weaponStyle = undefined;
      }
      rig.hero = realWorld ? undefined : variant.hero;
      if (variant.hero) variant.hero.root.visible = !realWorld;
      if (!realWorld) this.diggerBodies.update(rig, false);
    }
    this.epilogueHeads.update(rig, input);
    if (poseOracleRestored(rig, input.oracleRestored)) return;
    if ((input.diggers || input.upperDigger) && !rig.diggerProps) { rig.diggerProps = new DiggerProps(rig.detail); this.diggerProps.add(rig.diggerProps); }
    if (input.freewayPickup && !rig.freewayProps) { rig.freewayProps = new FreewayPickupProps(rig.root); this.freewayProps.add(rig.freewayProps); }
    rig.freewayProps?.hide();
    if (input.truckWeapons?.role === 'morpheus' && !rig.truckProps) { rig.truckProps = new TruckWeaponProps(rig.root); this.truckProps.add(rig.truckProps); }
    rig.truckProps?.hide();
    const pickupArmed = input.freewayPickup?.role === 'trinity' && input.freewayPickup.phase === 'shooting';
    const armed = !input.helDoorPush && !input.helElevator && !input.helGarage && !input.architect && !input.sourcePortal && !input.trinityTerminal && !input.truckWeapons && (input.armed || pickupArmed || Boolean(input.helDisarm));
    const pulseRifle = Boolean(input.dockGateCover || input.crosscut && ['cypher', 'tank'].includes(input.crosscut.role) || input.betrayal && ['cypher', 'tank'].includes(input.betrayal.role));
    const weaponStyle: CharacterRig['weaponStyle'] = pickupArmed ? 'hel_pistol' : pulseRifle ? 'pulse' : input.weaponStyle ?? (rig.rifle ? 'rifle' : 'pistol');
    const helPistol = weaponStyle === 'hel_pistol' && !input.freewayPickup;
    if (armed && rig.weapons && (rig.weaponStyle !== weaponStyle || Boolean(rig.weapons[0].userData.helPistol) !== helPistol)) {
      rig.weapons.forEach(gun => gun.removeFromParent()); rig.weapons = undefined;
    }
    if (armed && !rig.weapons) {
      const material = this.material(new THREE.MeshStandardMaterial({ color: 0x242b2c, metalness: .75, roughness: .28 }));
      const charge = pulseRifle ? this.material(new THREE.MeshBasicMaterial({ color: 0x8fd8ba, toneMapped: false })) : material;
      const dual = weaponStyle === 'pistol' || weaponStyle === 'compact';
      rig.weaponStyle = weaponStyle;
      rig.weapons = (dual ? [0, 1] : [0]).map(i => {
        const gun = helPistol ? createHelPistol(material) : new THREE.Group(); const length = weaponStyle === 'compact' ? .72 : weaponStyle === 'breacher' || weaponStyle === 'gas_launcher' ? 1.34 : ['rifle', 'pulse'].includes(weaponStyle) ? 1.2 : .5;
        gun.name = pulseRifle ? 'neb-pulse-rifle' : `character-${weaponStyle}`;
        if (helPistol) {
          gun.traverse(object => { if (object instanceof THREE.Mesh) this.geometries.add(object.geometry); });
        } else {
          this.mesh(gun, this.box, material, [0, -length / 2, 0], [.12, length, .14]);
          this.mesh(gun, this.cylinder, material, [0, -length, 0], [weaponStyle === 'gas_launcher' ? .14 : .045, .23, weaponStyle === 'gas_launcher' ? .14 : .045]);
          this.mesh(gun, this.box, material, [0, -.09, .13], [.105, .18, .27]);
          this.mesh(gun, this.box, material, [0, -length * .5, .08], [.08, .1, dual ? weaponStyle === 'compact' ? .22 : .06 : .35]);
        }
        if (weaponStyle === 'breacher') {
          this.mesh(gun, this.cylinder, material, [0, -1.02, 0], [.075, .52, .075]);
          this.mesh(gun, this.box, material, [0, -.62, .11], [.18, .42, .24]);
        }
        if (weaponStyle === 'gas_launcher') {
          this.mesh(gun, this.cylinder, material, [0, -.88, 0], [.14, .9, .14]);
          this.mesh(gun, this.box, material, [0, .18, -.1], [.23, .48, .22]);
        }
        if (weaponStyle === 'rifle') this.mesh(gun, this.box, material, [0, -.48, -.14], [.17, .58, .34]);
        if (weaponStyle === 'revolver') {
          this.mesh(gun, this.cylinder, material, [0, -.25, 0], [.14, .23, .14]).name = 'trainman-revolver-cylinder';
          this.mesh(gun, this.box, this.material(new THREE.MeshStandardMaterial({ color: 0x503b28, roughness: .73 })), [0, .04, .18], [.14, .26, .2]);
          this.mesh(gun, this.geometry(new THREE.TorusGeometry(.09, .013, 8, 18)), material, [0, -.08, .17]).rotation.y = Math.PI / 2;
        }
        if (pulseRifle) {
          this.mesh(gun, this.cylinder, charge, [0, -.62, .13], [.075, .34, .075]);
          this.mesh(gun, this.box, material, [0, -.2, -.17], [.22, .48, .42]);
        }
        gun.position.set(0, -.08, .03);
        const parent = rig.hero?.bones.get(i ? 'wrist_L' : 'wrist_R') ?? (helPistol ? rig.mobilWrists?.[i] : undefined) ?? rig.elbows[i];
        if (parent === rig.elbows[i]) gun.position.y -= .69;
        parent.add(gun); return gun;
      });
    }
    rig.weapons?.forEach((gun, i) => {
      if (helPistol && armed) {
        const parent = rig.hero?.bones.get(i ? 'wrist_L' : 'wrist_R') ?? rig.mobilWrists?.[i] ?? rig.elbows[i];
        if (gun.parent !== parent) { parent.add(gun); gun.position.set(0, parent === rig.elbows[i] ? -.77 : -.08, .03); }
      }
      if (gun.userData.freewayShot && !pickupArmed) { gun.position.set(0, rig.hero ? -.08 : -.77, .03); gun.rotation.set(0, 0, 0); delete gun.userData.freewayShot; }
      gun.visible = Boolean(armed);
    });
    if (input.dockGateCover && !rig.gateBolt) {
      rig.gateBolt = this.mesh(rig.root, this.geometry(new THREE.CylinderGeometry(.025, .045, 1, 6)),
        this.material(new THREE.MeshBasicMaterial({ color: 0xb8e7ff, toneMapped: false })), [0, 0, 0]);
      rig.gateBolt.name = 'zee-rescue-discharge'; rig.gateBolt.castShadow = false;
    }
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
      rig.phone.root.position.set(.14, -.19, 0); rig.phone.root.rotation.set(0, Math.PI / 2, Math.PI); rig.hero.bones.get('wrist_R')!.add(rig.phone.root);
    }
    if (rig.phone) {
      rig.phone.root.visible = Boolean(input.phone && (input.phone.phase !== 'pickup' || input.phone.elapsed >= .65));
      rig.phone.update(input.phone?.phase === 'answering' ? Math.min(1, input.phone.elapsed / .4) : input.phone?.phase === 'connected' ? 1 : 0);
    }
    if ((input.oracleVisit || input.oracleDeparture?.role === 'neo') && !rig.cookie) {
      const biscuit = this.material(new THREE.MeshStandardMaterial({ color: '#c98945', roughness: .88 }));
      const chocolate = this.material(new THREE.MeshStandardMaterial({ color: '#342017', roughness: .9 }));
      rig.cookie = new THREE.Group(); rig.cookie.name = 'oracle-cookie';
      const whole = new THREE.Group(); whole.name = 'cookie-whole'; rig.cookie.add(whole);
      const base = this.mesh(whole, this.cylinder, biscuit, [0, 0, 0], [.13, .025, .13]); base.rotation.x = Math.PI / 2;
      const outline = new THREE.Shape();
      for (let i = 0; i <= 32; i++) {
        const angle = Math.PI / 2 + .62 + (Math.PI * 2 - 1.24) * i / 32, x = Math.cos(angle) * .13, y = Math.sin(angle) * .13;
        if (!i) outline.moveTo(x, y); else outline.lineTo(x, y);
      }
      outline.quadraticCurveTo(.048, .054, .015, .074); outline.quadraticCurveTo(-.025, .048, -.0755, .1058); outline.closePath();
      const bitten = new THREE.Group(); bitten.name = 'cookie-bitten'; rig.cookie.add(bitten);
      this.mesh(bitten, this.geometry(new THREE.ExtrudeGeometry(outline, { depth: .045, bevelEnabled: false, curveSegments: 8 })), biscuit, [0, 0, -.0225], [1, 1, 1]);
      for (const group of [whole, bitten]) for (const [x, y] of [[-.05, .03], [.035, .055], [.058, -.035], [-.02, -.06]]) this.mesh(group, this.sphere, chocolate, [x, y, .029], [.018, .018, .009]);
      const parent = rig.hero?.bones.get('wrist_R') ?? rig.elbows[0];
      rig.cookie.position.set(.02, rig.hero ? -.13 : -.84, .08); rig.cookie.rotation.x = -.18; parent.add(rig.cookie);
    }
    if (rig.cookie) {
      const visit = input.oracleVisit;
      const departure = input.oracleDeparture;
      rig.cookie.visible = Boolean(visit && oracleCookieOwner(visit) === visit.role || departure?.role === 'neo');
      const bitten = departure?.role === 'neo' && (['leaving', 'done'].includes(departure.phase) || departure.phase === 'biting' && departure.elapsed >= 1.35);
      rig.cookie.getObjectByName('cookie-whole')!.visible = !bitten; rig.cookie.getObjectByName('cookie-bitten')!.visible = Boolean(bitten);
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
    if (input.chateauWeapon && rig.chateauBlade?.weapon !== input.chateauWeapon) {
      rig.chateauBlade?.model.removeFromParent();
      const weapon = input.chateauWeapon; const model = new THREE.Group(); model.name = `chateau-${weapon}`;
      const steel = this.material(new THREE.MeshStandardMaterial({ color: 0xa7aaa1, metalness: .84, roughness: .26 }));
      const dark = this.material(new THREE.MeshStandardMaterial({ color: 0x362e25, metalness: .24, roughness: .58 }));
      const brass = this.material(new THREE.MeshStandardMaterial({ color: 0x9c8151, metalness: .72, roughness: .3 }));
      if (weapon === 'spear') {
        this.mesh(model, this.cylinder, dark, [0, -1.25, 0], [.035, 3.1, .035]);
        this.mesh(model, this.geometry(new THREE.ConeGeometry(.11, .48, 8)), steel, [0, .53, 0]);
        this.mesh(model, this.cylinder, brass, [0, .24, 0], [.075, .2, .075]);
      } else {
        this.mesh(model, this.cylinder, dark, [0, -.48, 0], [.055, .85, .055]);
        this.mesh(model, this.cylinder, brass, [0, -.02, 0], [.2, .09, .08]);
        if (weapon === 'mace') {
          this.mesh(model, this.sphere, steel, [0, .8, 0], [.26, .28, .26]);
          for (const side of [-1, 1]) this.mesh(model, this.box, steel, [side * .27, .8, 0], [.24, .12, .12]);
        } else if (weapon === 'axe') {
          this.mesh(model, this.box, steel, [0, .75, 0], [.18, .56, .12]);
          this.mesh(model, this.geometry(new THREE.ConeGeometry(.37, .72, 3)), steel, [.27, .75, 0]).rotation.z = -Math.PI / 2;
        } else {
          this.mesh(model, this.box, steel, [0, .85, 0], [.11, 1.48, .045]);
          this.mesh(model, this.geometry(new THREE.ConeGeometry(.077, .31, 4)), steel, [0, 1.7, 0]);
        }
      }
      const parent = rig.hero?.bones.get('wrist_R') ?? rig.elbows[0];
      model.position.set(0, rig.hero ? -.16 : -.76, .06); parent.add(model);
      rig.chateauBlade = { weapon, model };
    }
    if (rig.chateauBlade) {
      rig.chateauBlade.model.visible = Boolean(input.chateauWeapon);
      const sweep = rig.motion.attackAge < .6 ? Math.sin(rig.motion.attackAge / .6 * Math.PI) : 0;
      rig.chateauBlade.model.rotation.z = input.chateauWeapon === 'spear' ? Math.PI / 2 + sweep * .55 : sweep * 1.1;
    }
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
    if ((input.empOperator || input.dockReunion?.role === 'link') && !rig.empCharm) {
      rig.empCharm = new THREE.Group(); rig.empCharm.name = 'zee-keepsake'; rig.detail.add(rig.empCharm);
      const metal = this.material(new THREE.MeshStandardMaterial({ color: 0x9c8b68, roughness: .47, metalness: .65 }));
      const charm = this.mesh(rig.empCharm, this.geometry(new THREE.SphereGeometry(.075, 16, 12)), metal, [0, -.18, 0], [.65, 1.35, .4]);
      charm.name = 'zee-pendant';
      this.mesh(rig.empCharm, this.geometry(new THREE.TorusGeometry(.055, .009, 6, 16)), metal, [0, -.08, 0]);
    }
    if (input.dockReunion?.role === 'link' && rig.empCharm && !rig.empCharm.getObjectByName('zee-pendant-cord')) {
      const points = [[-.28, .47, -.7], [-.36, .28, -.1], [0, -.1, 0], [.36, .28, -.1], [.28, .47, -.7]].map(p => new THREE.Vector3(...p as [number, number, number]));
      const cord = this.mesh(rig.empCharm, this.geometry(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, .013, 6, false)),
        this.material(new THREE.MeshStandardMaterial({ color: 0x70624a, roughness: .8 })), [0, 0, 0]); cord.name = 'zee-pendant-cord';
    }
    if (input.oracleWaiting) rig.motion.seated = 1;
    const carryingCargo = input.dockEvacuation?.role === 'kid' && ['lifting', 'carrying', 'depositing'].includes(input.dockEvacuation.phase);
    if (carryingCargo && !rig.dockCargo) { rig.dockCargo = new DockCargoModel(); this.dockCargo.add(rig.dockCargo); rig.root.add(rig.dockCargo.root); }
    if (rig.dockCargo) rig.dockCargo.root.visible = carryingCargo;
    const pose = advanceMotion(rig.motion, input, delta);
    const kamalaSkirt = rig.detail.getObjectByName('kamala-skirt') as THREE.Mesh | undefined;
    if (kamalaSkirt) {
      const rest = kamalaSkirt.userData.standing as Float32Array, position = kamalaSkirt.geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        const t = THREE.MathUtils.clamp((.06 - rest[i * 3 + 1]) / 1.14, 0, 1);
        const fold = THREE.MathUtils.smoothstep(t, .45, 1);
        position.setXYZ(i, rest[i * 3], THREE.MathUtils.lerp(rest[i * 3 + 1], .06 - .54 * fold, rig.motion.seated),
          rest[i * 3 + 2] + .85 * Math.sin(t * Math.PI / 2) * rig.motion.seated);
      }
      position.needsUpdate = true; kamalaSkirt.geometry.computeVertexNormals(); kamalaSkirt.geometry.computeBoundingSphere();
    }
    const staffSweep = holdsStaff && rig.motion.attackAge < .65 ? Math.sin(rig.motion.attackAge / .65 * Math.PI) : 0;
    if (rig.staff) rig.staff.rotation.z = Math.PI / 2 + staffSweep * .65;
    if (rig.hero) {
      this.heroes.animate(rig.hero, pose, rig.motion, input, delta);
      if (armed && helPistol && input.helDanceDoor === undefined && !input.helDisarm) poseHelPistol(rig, input.aimPitch);
      poseHelDisarm(rig, input.helDisarm);
      poseHelBreakout(rig, input.helBreakout);
      poseFreewayRide(rig, input.freewayRide);
      poseFreewayPickup(rig, input.freewayPickup, rig.motion.seated);
      poseFreewayDriver(rig, input.freewayDriver);
      poseFreewayHandoff(rig, input.freewayHandoff);
      poseDeusRecline(rig.hero, input.deusPact);
      poseEmpOperator(rig, input.empOperator);
      poseDockReunion(rig, input.dockReunion);
      poseDockDeparture(rig, input.dockDeparture);
      poseDockBriefing(rig, input.dockBriefing);
      posePrimaryDemolition(rig, input.primaryDemolition);
      poseTrinityRelay(rig, input.trinityRelay);
      poseTrinityTerminal(rig, input.trinityTerminal);
      poseSourcePortal(rig, input.sourcePortal);
      poseArchitect(rig, input.architect);
      poseReloadedCatch(rig, input.catch);
      if (input.trinityTerminal) rig.hero.glasses.visible = false;
      if (input.trinityRelay?.role === 'trinity') this.heroes.crosscutInterfaces(rig.hero);
      poseDockEvacuation(rig, input.dockEvacuation); poseShaftSeal(rig, input.shaftSeal);
      poseTempleDefense(rig, input.templeDefense);
      poseTrainmanChase(rig, input.trainmanChase);
      poseHelGarage(rig, input.helGarage);
      poseHelElevator(rig, input.helElevator);
      poseHelDanceDoor(rig, input.helDoorPush);
      if (input.spoon !== undefined && rig.spoon) {
        const wrist = rig.hero.bones.get('wrist_R')!;
        rig.hero.bones.get('finger1-1_R')!.rotation.z = -.28;
        wrist.updateWorldMatrix(true, true);
        const thumb = rig.hero.bones.get('finger1-3_R')!.localToWorld(new THREE.Vector3(.02, -.02, .012));
        const index = rig.hero.bones.get('finger2-3_R')!.localToWorld(new THREE.Vector3(.015, -.015, 0));
        const contact = wrist.worldToLocal(thumb.lerp(index, .5));
        if (rig.spoon.root.parent !== wrist) wrist.add(rig.spoon.root);
        const grip = new THREE.Vector3(0, .08, 0).multiply(rig.spoon.root.scale).applyQuaternion(rig.spoon.root.quaternion);
        rig.spoon.root.position.copy(contact.sub(grip));
      }
      poseSpoonHands(rig, input.spoonLesson);
      poseOracleReception(rig, input.oracleReception);
      poseOracleWaiting(rig, input.oracleWaiting);
      poseOracleCookie(rig, input.oracleVisit);
      poseOracleDeparture(rig, input.oracleDeparture);
      poseOracleArrival(rig, input.oracleArrival);
      poseWetwall(rig, input.wetwall, input.speed < .05 && Math.abs(input.climbing ?? 0) < .05);
      poseSixthFloor(rig, input.sixth);
      poseBathroom(rig, input.bathroom, input.sixth);
      poseBasement(rig, input.basement);
      poseBasementLauncher(rig, input.basementGas);
      poseCrosscut(rig, input.crosscut);
      if (input.crosscut?.body) this.heroes.crosscutInterfaces(rig.hero);
      poseCrosscutContact(rig, input.crosscut);
      if (input.tvExit && input.tvExit.phase !== 'emerging' && !rig.handset) { rig.handset = new HardlineHandset(); this.handsets.add(rig.handset); rig.hero.bones.get('wrist_R')!.add(rig.handset.root); }
      poseHardline(rig, input.tvExit);
      if (holdsStaff) {
        rig.hero.bones.get('shoulder_R')!.rotation.x -= .7 + staffSweep * .5;
        rig.hero.bones.get('shoulder_L')!.rotation.x -= .55 + staffSweep * .35;
        rig.hero.bones.get('chest')!.rotation.y += staffSweep * .42;
      }
      if (input.chateauWeapon) rig.hero.bones.get('shoulder_R')!.rotation.x -= .55;
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
      poseTruckWeapons(rig, input.truckWeapons);
      poseTruckHood(rig, input.truckHood);
      poseSentinelSignal(rig, input.signal);
      poseMobilRefusal(rig, input.mobilRefusal);
      poseMobilReunion(rig, input.mobilReunion);
      poseMobilFamily(rig, input.mobilFamily);
      poseMobilLuggage(rig, input.mobilLuggage);
      poseOracleLast(rig, input.oracleLast);
      poseOracleAbsorption(rig, input.oracleAbsorption);
      poseBaneInquiry(rig, input.baneInquiry);
      poseHammerBriefing(rig, input.hammerBriefing);
      poseZionDeployment(rig, input.zionDeployment);
      poseMaggieDiscovery(rig, input.maggieDiscovery);
      return;
    }
    rig.torso.position.y = pose.hipHeight;
    rig.torso.position.x = pose.sway; rig.torso.position.z = pose.lunge;
    rig.torso.rotation.set(pose.lean, pose.twist, pose.roll);
    rig.head.rotation.set(-pose.lean * .6, pose.headTurn, -pose.roll * .5);
    if (holdsStaff) rig.torso.rotation.y += staffSweep * .42;
    if (input.chateauWeapon) rig.torso.rotation.y += rig.motion.attackAge < .6 ? Math.sin(rig.motion.attackAge / .6 * Math.PI) * .2 : 0;
    if (input.burly?.phase === 'flight' && input.burly.role === 'neo') rig.torso.rotation.x -= .55;
    if (input.persephone?.phase === 'enacting') {
      const weight = Math.sin(Math.min(1, input.persephone.elapsed / 2.8) * Math.PI);
      rig.torso.rotation.x -= weight * .08; rig.head.rotation.x -= weight * .16;
    }
    for (let i = 0; i < 2; i++) {
      rig.hips[i].position.y = pose.hipHeight;
      rig.hips[i].rotation.set(pose.legs[i].hip, 0, 0);
      rig.knees[i].rotation.set(pose.legs[i].knee, 0, 0);
      rig.ankles[i].rotation.set(pose.legs[i].ankle, 0, 0);
      if (input.floorSeated) {
        // Fold the shins inward in model space; an X-only knee bend puts them below the rug.
        const down = new THREE.Vector3(0, -1, 0), side = i ? 1 : -1;
        const hip = rig.hips[i], knee = rig.knees[i];
        const thigh = new THREE.Vector3(side * .675, -.25, .64).normalize();
        hip.quaternion.setFromUnitVectors(down, thigh);
        const kneePoint = hip.position.clone().addScaledVector(thigh, .94);
        const foot = new THREE.Vector3(side * .08, i ? .25 : .39, i ? .78 : 1.03);
        const shin = foot.sub(kneePoint).normalize().applyQuaternion(hip.quaternion.clone().invert());
        knee.quaternion.setFromUnitVectors(down, shin);
        const leg = hip.quaternion.clone().multiply(knee.quaternion);
        rig.ankles[i].quaternion.copy(leg.invert()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -side * Math.PI / 2));
      }
      rig.shoulders[i].rotation.set(pose.arms[i].shoulder, 0, pose.arms[i].outward);
      rig.elbows[i].rotation.set(pose.arms[i].elbow, 0, 0);
      if (i === 0 && input.persephone?.phase === 'enacting') rig.shoulders[i].rotation.x -= Math.sin(Math.min(1, input.persephone.elapsed / 2.8) * Math.PI) * .45;
      if (holdsStaff) rig.shoulders[i].rotation.x -= (i ? .55 : .7) + staffSweep * (i ? .35 : .5);
      if (input.chateauWeapon && i === 0) rig.shoulders[i].rotation.x -= .55;
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
    if (input.grounded && input.climbing === undefined && !input.realWorld && !input.seated && !input.floorSeated && !input.performance
      && !input.windingUp && rig.motion.attackAge > 1 && rig.motion.skillAge > 1 && rig.motion.hitAge > .5) placeAmbushFeet(rig);
    poseFreewayRide(rig, input.freewayRide);
    poseFreewayPickup(rig, input.freewayPickup, rig.motion.seated);
    poseFreewayDriver(rig, input.freewayDriver);
    poseFreewayHandoff(rig, input.freewayHandoff);
    poseTruckWeapons(rig, input.truckWeapons);
    poseTruckHood(rig, input.truckHood);
    poseSpoonHands(rig, input.spoonLesson);
    poseOracleReception(rig, input.oracleReception);
    poseOracleWaiting(rig, input.oracleWaiting);
    poseOracleCookie(rig, input.oracleVisit);
    poseOracleDeparture(rig, input.oracleDeparture);
    poseOracleArrival(rig, input.oracleArrival);
    poseGarden(rig, input.epilogue, input.parkOutfit);
    poseOracleRequest(rig, input.oracleRequest);
    poseOracleLast(rig, input.oracleLast);
    poseOracleAbsorption(rig, input.oracleAbsorption);
    poseBaneInquiry(rig, input.baneInquiry);
    poseHammerBriefing(rig, input.hammerBriefing);
    poseZionDeployment(rig, input.zionDeployment);
    poseDiggers(rig, input.diggers);
    poseUpperDigger(rig, input.upperDigger);
    poseDockReload(rig, input.dockReload);
    poseDockLastStand(rig, input.dockLastStand);
    poseDockGate(rig, input.dockGate, input.dockGateCover, input.dockGunnery, input.apuDriving);
    poseEmpOperator(rig, input.empOperator);
    poseDockReunion(rig, input.dockReunion);
    poseDockDeparture(rig, input.dockDeparture);
    poseDockBriefing(rig, input.dockBriefing);
    posePrimaryDemolition(rig, input.primaryDemolition);
    poseDockEvacuation(rig, input.dockEvacuation); poseShaftSeal(rig, input.shaftSeal);
    poseTempleDefense(rig, input.templeDefense);
    poseWetwall(rig, input.wetwall, input.speed < .05 && Math.abs(input.climbing ?? 0) < .05);
    poseSixthFloor(rig, input.sixth);
    poseBasement(rig, input.basement);
    poseBasementLauncher(rig, input.basementGas);
    if (input.training?.kind === 'download' && input.training.role === 'tank') {
      const engaged = input.training.elapsed > 0 ? 1 : .35;
      for (let i = 0; i < 2; i++) {
        rig.shoulders[i].rotation.x = -.72 * engaged; rig.shoulders[i].rotation.z = (i ? 1 : -1) * .24;
        rig.elbows[i].rotation.x = -1.05 + Math.sin(input.training.elapsed * 11 + i * 2) * .08 * engaged;
        for (const finger of rig.fingers[i]) finger.rotation.x = -.45 - Math.sin(input.training.elapsed * 15 + i) * .18 * engaged;
      }
      rig.head.rotation.y = Math.sin(input.training.elapsed * .8) * .12;
    }
    poseSourcePortal(rig, input.sourcePortal);
    poseArchitect(rig, input.architect);
    poseMobilRefusal(rig, input.mobilRefusal);
    poseMobilReunion(rig, input.mobilReunion);
    poseMobilFamily(rig, input.mobilFamily);
    poseMobilLuggage(rig, input.mobilLuggage);
    poseTrainmanChase(rig, input.trainmanChase);
    poseHelGarage(rig, input.helGarage);
    poseHelElevator(rig, input.helElevator);
    poseHelDanceDoor(rig, input.helDoorPush);
    if (armed && helPistol && input.helDanceDoor === undefined && !input.helDisarm) poseHelPistol(rig, input.aimPitch);
    poseHelDisarm(rig, input.helDisarm);
    poseHelBreakout(rig, input.helBreakout);
    poseMaggieDiscovery(rig, input.maggieDiscovery);
    this.diggerBodies.update(rig, !rig.medicalCrew || Boolean(input.maggieDiscovery), Boolean(input.parkOutfit || input.epilogue?.kind === 'dawn'), Boolean(input.hammerBriefing));
  }

  refreshFarewellContact(rig: CharacterRig, gesture: NonNullable<MotionInput['farewell']>, normal?: THREE.Vector3, up?: THREE.Vector3): void {
    if (rig.hero) this.heroes.farewellContact(rig.hero, gesture, normal, up);
  }

  dispose(): void {
    this.freewayProps.forEach(props => props.dispose());
    this.truckProps.forEach(props => props.dispose());
    this.sourcePortalProps.forEach(props => props.dispose()); this.sourcePortalProps.clear();
    this.diggerProps.forEach(props => props.dispose());
    this.phones.forEach(phone => phone.dispose());
    this.handsets.forEach(handset => handset.dispose());
    this.spoons.forEach(spoon => spoon.dispose());
    this.dockCargo.forEach(prop => prop.dispose());
    this.heroes.dispose();
    this.epilogueHeads.dispose();
    this.diggerBodies.dispose();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); this.textures.forEach(texture => texture.dispose()); this.skeletons.forEach(skeleton => skeleton.dispose());
  }
}
