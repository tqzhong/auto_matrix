import { TruthPerformance } from './TruthPerformance.js';
import { JumpPerformance } from './JumpPerformance.js';
import { poseSpoonBody } from './SpoonPerformance.js';
import { poseMorningBody } from './MorningPerformance.js';
import { posePodWake } from './PodWakePerformance.js';
import { truthKneel, truthSeat, spoonLessonSeat, smithFinaleLocked, smithCraterAmount, steakJawOpen, redDressFrame, trainingRoot } from '@auto_matrix/shared';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { MORNING, FILM_SETS, OFFICE_WINDOW, SENTINEL_TIMING, officeWindowPose, officeCrossingPose, pillPose, lafayetteKnockPose, lafayetteWelcomePose, recoveryBodyPose, recoveryCrewPose, podRescuePose, farewellPose } from '@auto_matrix/shared';
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
import { enableSkinnedCulling } from './SkinnedBounds.js';
import { placeTrackingFeet, poseTrackingHand, wireTrackingElectrode } from './TrackingContact.js';
import { placeHotelFeet } from './HotelFootPlacement.js';
import { prepareTankMaterials } from './TankMaterials.js';
import { AMBUSH_STAIRS, AMBUSH_STOREYS, ambushFloor, ambushShotRecoil, mouseRoomGuard } from '@auto_matrix/shared';
import { placePodBody } from './PodLandingContact.js';
import { cabinContact } from './CabinContact.js';
import { ConstructPerformance } from './ConstructPerformance.js';
import { prepareConstructSleeves, poseConstructSleeves } from './ConstructSelfImage.js';
import { clubCloseness } from '@auto_matrix/shared';
import { FarewellAppearance } from './FarewellAppearance.js';
import { ConstructSuitAppearance } from './ConstructSuitAppearance.js';
import { AmbushWardrobeAppearance } from './AmbushWardrobeAppearance.js';
import { RegularCoatTails } from './RegularCoatTails.js';
import { PHONE_HAND } from './PhoneModel.js';
import { ForearmTwist } from './ForearmTwist.js';
import { ShoulderSupport } from './ShoulderSupport.js';
import { FightingHands } from './FightingHands.js';
import { ConsoleDrinkPerformance } from './ConsoleDrinkPerformance.js';
import { poseConsoleOperator } from './ConsoleOperatorPerformance.js';
import { ConsolePourPerformance } from './ConsolePourPerformance.js';
import { SteakPerformance } from './SteakPerformance.js';
import { setCypherMouth } from './CypherMouth.js';
import { MealPerformance } from './MealPerformance.js';
import { MouseAppearance } from './MouseAppearance.js';
import { crewMealAge } from '@auto_matrix/shared';
import { SkinContinuity, ElbowSleeve } from './SkinContinuity.js';
import { applySkinAlbedo, applyReferencePigment, applyMouthAlbedo } from './SkinAlbedo.js';
import { patientNeckView } from './PatientNeckView.js';
import { poseDojoStance } from './DojoStance.js';
import { RedDressPerformance } from './RedDressPerformance.js';
import { prepareThinCornea } from './ThinCornea.js';
import { prepareIrisRefraction, type IrisRefractionData } from './IrisRefraction.js';
import { prepareEyeSocketVisibility, type EyeSocketVisibilityData } from './EyeSocketVisibility.js';
import { ArticulatedJaw, type ArticulatedJawData } from './ArticulatedJaw.js';
import { EyelidCorrectives, type EyelidCorrectivesData } from './EyelidCorrectives.js';

import { prepareOralAmbientOcclusion, type OralAmbientOcclusionData } from './OralAmbientOcclusion.js';

export type HeroSupport = 'cypher' | 'mouse' | 'switch' | 'apoc' | 'rhineheart' | 'courier' | 'choi' | 'dujour' | 'niobe' | 'ballard' | 'ghost' | 'soren' | 'link' | 'dozer' | 'tank' | 'oracle_priestess' | 'oracle_attendant' | 'citizen_2' | 'citizen_4' | 'citizen_14' | 'pedestrian';
type Pose = ReturnType<typeof advanceMotion>;
interface CoatPanel { mesh: THREE.Mesh; rest: Float32Array; velocity: Float32Array }
export interface HeroRig {
  root: THREE.Group;
  bones: Map<string, THREE.Bone>;
  rest: Map<string, THREE.Vector3>;
  panels: CoatPanel[];
  footHeight: number;
  referenceFaceClip?: THREE.AnimationClip;
  dojoSoles?: { mesh: THREE.SkinnedMesh; indices: number[]; matrices: THREE.Matrix4[] };
  glasses: THREE.Group;
  silver: { value: number };
  trackingSkin?: { mesh: THREE.SkinnedMesh; original: THREE.BufferGeometry; covered: THREE.BufferGeometry; firstPerson: THREE.BufferGeometry; patientFirstPerson: THREE.BufferGeometry };
  patientNeck?: THREE.SkinnedMesh;
  wardrobe: { mesh: THREE.Mesh; color: THREE.Color; map: THREE.Texture | null; bumpMap: THREE.Texture | null; bumpScale: number;
    roughness: number; metalness: number; side: THREE.Side; emissive: THREE.Color; emissiveIntensity: number; outer: boolean; hair: boolean; cloth: boolean }[];
  officeRole?: 'rhineheart' | 'courier' | 'police';
  apartmentRole?: 'choi' | 'dujour';
  support?: HeroSupport;
}

export const HERO_IDS = ['neo', 'trinity', 'smith', 'morpheus'] as const;
export type HeroId = typeof HERO_IDS[number];

const dojoSwingInputs = new Set<keyof MotionInput>([
  'speed', 'grounded', 'verticalVelocity', 'turn', 'attack', 'combo', 'hit', 'impact', 'windingUp', 'cast', 'skill',
  'dojoOutfit', 'dojoSparring', 'glasses', 'inspecting', 'firstPerson',
]);

function mirrorBoneArrival(name: string): number {
  const twist = /^forearm_twist_([RL])_([1-3])$/.exec(name);
  if (twist) return twist[1] === 'R' ? .48 - Number(twist[2]) / 3 * .14 : .83 + Number(twist[2]) / 3 * .05;
  const finger = /^finger([1-5])-([1-3])_R$/.exec(name);
  if (finger) {
    const digit = Number(finger[1]), joint = Number(finger[2]);
    // Index/middle fingertips touch the glass; other fingers coat from the palm out.
    if (digit === 2 || digit === 3) return .035 + (digit - 2) * .025 + (3 - joint) * .055;
    return .36 + digit * .014 + (joint - 1) * .055;
  }
  if (name === 'wrist_R') return .34;
  if (name === 'elbow_R') return .48;
  if (name === 'shoulder_R') return .61;
  if (name === 'chest') return .68;
  if (name === 'spine') return .76;
  if (name === 'head') return .84;
  if (name === 'shoulder_L') return .78;
  if (name === 'elbow_L') return .83;
  if (name === 'wrist_L') return .88;
  if (name.startsWith('finger') && name.endsWith('_L')) return .9;
  if (name === 'pelvis') return .84;
  if (name.startsWith('hip_')) return .88;
  if (name.startsWith('knee_')) return .93;
  return .97;
}

function addMirrorArrival(mesh: THREE.Mesh): void {
  const geometry = mesh.geometry;
  if (geometry.getAttribute('_mirrorArrival')) return;
  const position = geometry.getAttribute('position');
  const arrival = new Float32Array(position.count);
  const indices = geometry.getAttribute('skinIndex'); const weights = geometry.getAttribute('skinWeight');
  let parent = mesh.parent;
  while (parent && !(parent instanceof THREE.Bone)) parent = parent.parent;
  if (mesh instanceof THREE.SkinnedMesh && indices && weights) {
    for (let i = 0; i < position.count; i++) {
      let value = 0; let total = 0;
      for (let joint = 0; joint < 4; joint++) {
        const weight = weights.getComponent(i, joint);
        if (weight <= 0) continue;
        value += mirrorBoneArrival(mesh.skeleton.bones[indices.getComponent(i, joint)]?.name ?? '') * weight;
        total += weight;
      }
      arrival[i] = total ? value / total : 1;
    }
  } else if (parent instanceof THREE.Bone && parent.name === 'pelvis') {
    for (let i = 0; i < position.count; i++) arrival[i] = .76 + THREE.MathUtils.clamp(-position.getY(i) / 1.97, 0, 1) * .22;
  } else arrival.fill(parent instanceof THREE.Bone ? mirrorBoneArrival(parent.name) : .97);
  geometry.setAttribute('_mirrorArrival', new THREE.BufferAttribute(arrival, 1));
}

// The inspector and world share these exact skinned assets and motion solver.
export class HeroModels {
  private assets = new Map<HeroId | 'neo-office' | 'neo-tracking' | 'trinity-club' | 'choi' | 'dujour' | 'club-male' | 'club-female' | 'cypher-reality' | 'mouse' | 'mouse-ship' | 'mouse-head' | 'tank' | 'red-dress', Promise<GLTF>>();
  private disposed = false;
  private pills = new Map<HeroRig, PillPerformance>();
  private consoleDrinks = new Map<HeroRig, ConsoleDrinkPerformance>();
  private consolePours = new Map<HeroRig, ConsolePourPerformance>();
  private steaks = new Map<HeroRig, SteakPerformance>();
  private interrogations = new Map<HeroRig, InterrogationPerformance>();
  private meals = new Map<HeroRig, MealPerformance>();
  private meetings = new Map<HeroRig, MeetingPerformance>();
  private welcomes = new Map<HeroRig, LafayetteWelcomePerformance>();
  private knocks = new Map<HeroRig, LafayetteKnockPerformance>();
  private recoveries = new Map<HeroRig, RecoveryPerformance>();
  private truths = new Map<HeroRig, TruthPerformance>();
  private jumps = new Map<HeroRig, JumpPerformance>();
  private redDressGuides = new Map<HeroRig, RedDressPerformance>();
  private constructs = new Map<HeroRig, ConstructPerformance>();
  private forearms = new ForearmTwist();
  private shoulders = new ShoulderSupport();
  private fightingHands = new Map<HeroRig, FightingHands>();
  private jaws = new Map<HeroRig, ArticulatedJaw>();
  private oralLights = new Map<HeroRig, ReturnType<typeof prepareOralAmbientOcclusion>>();
  private eyelids = new Map<HeroRig, EyelidCorrectives>();
  private skinContinuity = new Map<HeroRig, SkinContinuity[]>();
  private elbowSleeves = new Map<HeroRig, ElbowSleeve>();
  private workdays = new Map<HeroRig, OfficeWorkdayPerformance>();
  private apartments = new Map<HeroRig, ApartmentPerformance>();
  private wakeCalls = new Map<HeroRig, WakeCallPerformance>();
  private farewellAppearances = new Map<HeroRig, FarewellAppearance>();
  private constructSuits = new Map<HeroRig, ConstructSuitAppearance>();
  private ambushWardrobes = new Map<HeroRig, AmbushWardrobeAppearance>();
  private regularCoatTails = new Map<HeroRig, RegularCoatTails>();
  private mice = new Map<HeroRig, MouseAppearance>();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private skeletons = new Set<THREE.Skeleton>();
  private point = new THREE.Vector3();
  private local = new THREE.Vector3();
  private segment = new THREE.Vector3();
  private closest = new THREE.Vector3();
  private soleTransform = new THREE.Matrix4();
  private soleBase = new THREE.Vector3();
  private soleVertex = new THREE.Vector3();
  private handRotation = new THREE.Quaternion();
  private patientSkin: THREE.DataTexture;

  constructor(private portrait: THREE.Texture, private fabric: THREE.Texture) {
    const size = 96; const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const pore = Math.sin(x * 2.37 + y * .73) * Math.sin(y * 2.11 - x * .41);
      const vein = Math.max(0, 1 - Math.abs(Math.sin(x * .16 + Math.sin(y * .11) * 1.7)) * 15);
      const i = (y * size + x) * 4; const shade = Math.round(226 + pore * 3 - vein * 5);
      data[i] = shade; data[i + 1] = Math.max(0, shade - 4 + Math.round(vein)); data[i + 2] = Math.max(0, shade - 6 + Math.round(vein * 3)); data[i + 3] = 255;
    }
    this.patientSkin = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    this.patientSkin.name = 'Neo patient skin'; this.patientSkin.colorSpace = THREE.SRGBColorSpace;
    this.patientSkin.wrapS = this.patientSkin.wrapT = THREE.RepeatWrapping; this.patientSkin.repeat.set(2, 3); this.patientSkin.needsUpdate = true;
    this.textures.add(this.patientSkin);
  }

  private load(id: HeroId | 'neo-office' | 'neo-tracking' | 'trinity-club' | 'choi' | 'dujour' | 'club-male' | 'club-female' | 'cypher-reality' | 'mouse' | 'mouse-ship' | 'mouse-head' | 'tank' | 'red-dress'): Promise<GLTF> {
    const existing = this.assets.get(id); if (existing) return existing;
    const promise = new GLTFLoader().loadAsync(`/assets/characters/${id}.glb`).then(async asset => {
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
          if (id === 'red-dress') {
            material.color.setHex(0xffffff);
            material.onBeforeCompile = shader => {
              shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\nfloat fiber = sqrt(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)));\ndiffuseColor.rgb = vec3(0.72, 0.48, 0.22) * (0.24 + fiber * 1.2);');
            };
            material.customProgramCacheKey = () => 'red-dress-blonde-fibers';
          }
        }
        if (material.name === 'Coat wool' || material.name === 'Coat leather' || material.name === 'Trousers' || material.name === 'Tracking cotton' || object.userData.mouseCostume) {
          material.bumpMap = this.fabric; material.bumpScale = .001;
        }
      });
      const albedo = asset.parser.json.extras.skinAlbedoOverride as { mesh: string; texture: number; attachments?: string[] } | undefined;
      if (albedo) {
        const texture = await asset.parser.getDependency('texture', albedo.texture) as THREE.Texture;
        texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; texture.needsUpdate = true;
        this.textures.add(texture);
        for (const name of [albedo.mesh, ...(albedo.attachments ?? [])]) {
          applySkinAlbedo((asset.scene.getObjectByName(name) as THREE.Mesh).material as THREE.MeshStandardMaterial, texture);
        }
      }
      if (this.disposed) this.release();
      return asset;
    });
    this.assets.set(id, promise); return promise;
  }

  async create(id: HeroId, guard?: 'agent_jones' | 'agent_brown' | 'agent_johnson' | 'agent_jackson' | 'agent_thompson', support?: HeroSupport): Promise<HeroRig | undefined> {
    const apartmentRole = support === 'choi' || support === 'dujour' ? support : undefined;
    const oracleStaff = support === 'oracle_priestess' || support === 'oracle_attendant';
    const police = support === 'citizen_4' || support === 'citizen_14';
    const pedestrian = support === 'pedestrian';
    const [asset, office, tracking, club, cypherCostume, mouseShip, mouseHead] = await Promise.all([this.load(support === 'citizen_2' ? 'red-dress' : support === 'mouse' ? 'mouse' : pedestrian ? id === 'trinity' ? 'club-female' : 'club-male' : oracleStaff ? 'dujour' : support === 'tank' ? 'tank' : support === 'cypher' ? 'choi' : apartmentRole ?? id),
      id === 'neo' && !pedestrian && !apartmentRole && support !== 'tank' && support !== 'cypher' && support !== 'mouse' ? this.load('neo-office') : undefined,
      id === 'neo' && !support ? this.load('neo-tracking') : undefined,
      id === 'trinity' && !support ? this.load('trinity-club') : undefined,
      support === 'cypher' ? this.load('cypher-reality') : undefined,
      support === 'mouse' ? this.load('mouse-ship') : undefined,
      support === 'mouse' ? this.load('mouse-head') : undefined]);
    if (this.disposed) return;
    const root = clone(asset.scene) as THREE.Group;
    if (support === 'tank') prepareTankMaterials(root).forEach(texture => this.textures.add(texture));
    const bones = new Map<string, THREE.Bone>(); const rest = new Map<string, THREE.Vector3>();
    root.traverse(object => {
      if (object instanceof THREE.Bone) { bones.set(object.name, object); rest.set(object.name, object.position.clone()); }
      if (object instanceof THREE.Mesh) {
        object.castShadow = !(object.material instanceof THREE.MeshPhysicalMaterial && object.material.transmission > 0);
        object.receiveShadow = true;
        if (object instanceof THREE.SkinnedMesh) this.skeletons.add(object.skeleton);
      }
    });
    root.updateMatrixWorld(true);
    if (pedestrian && id === 'trinity') root.traverse(object => {
      if (!(object instanceof THREE.SkinnedMesh) || !/Black.crew.neck/i.test(object.name)) return;
      // Dujour's cropped top has no underlying waist mesh. Extend only this
      // pedestrian garment, preserving the apartment costume and shared asset.
      object.geometry = object.geometry.clone(); this.geometries.add(object.geometry);
      const position = object.geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        const hem = 1 - THREE.MathUtils.smoothstep(position.getY(i), 2.68, 3.04);
        position.setY(i, position.getY(i) - .48 * hem);
      }
      position.needsUpdate = true; object.geometry.computeVertexNormals(); object.geometry.computeBoundingSphere();
    });
    if (office) {
      const meshes: THREE.SkinnedMesh[] = [];
      office.scene.traverse(object => { if (object instanceof THREE.SkinnedMesh) meshes.push(object); });
      for (const source of meshes) {
        // The torso otherwise pierces Neo's black shirt when he reclines for the scanner.
        const geometry = (source.material as THREE.Material).name === 'Office skin' ? source.geometry.clone() : source.geometry;
        if (geometry !== source.geometry) {
          const position = geometry.getAttribute('position');
          for (let i = 0; i < position.count; i++) {
            position.setX(i, position.getX(i) * .98);
            const coveredChest = position.getZ(i) > 0 ? THREE.MathUtils.smoothstep(position.getY(i), 3.02, 3.14) : 0;
            position.setZ(i, position.getZ(i) * (.97 - .08 * coveredChest));
          }
          position.needsUpdate = true; geometry.computeVertexNormals(); this.geometries.add(geometry);
        }
        const mesh = new THREE.SkinnedMesh(geometry, source.material); mesh.name = source.name; mesh.userData.office = true;
        const skeleton = new THREE.Skeleton(source.skeleton.bones.map(bone => bones.get(bone.name)!), source.skeleton.boneInverses.map(matrix => matrix.clone()));
        mesh.bind(skeleton, source.bindMatrix.clone()); mesh.castShadow = mesh.receiveShadow = true; mesh.visible = false;
        this.skeletons.add(skeleton); root.add(mesh);
      }
    }
    if (tracking) tracking.scene.traverse(source => {
      if (!(source instanceof THREE.SkinnedMesh) || !/^(Tracking[ _](arms|shirt)|Patient[ _]body)$/.test(source.name)) return;
      const mesh = new THREE.SkinnedMesh(source.geometry, source.material); mesh.name = source.name;
      mesh.userData.patientBody = source.name.startsWith('Patient'); mesh.userData.tracking = !mesh.userData.patientBody;
      const skeleton = new THREE.Skeleton(source.skeleton.bones.map(bone => bones.get(bone.name)!), source.skeleton.boneInverses.map(matrix => matrix.clone()));
      mesh.bind(skeleton, source.bindMatrix.clone()); mesh.castShadow = mesh.receiveShadow = true; mesh.visible = false;
      this.skeletons.add(skeleton); root.add(mesh);
    });
    if (club) {
      club.scene.traverse(source => {
        if (!(source instanceof THREE.SkinnedMesh) || !/^Club[ _]/.test(source.name)) return;
        const mesh = new THREE.SkinnedMesh(source.geometry, source.material); mesh.name = source.name; mesh.userData.club = true;
        const skeleton = new THREE.Skeleton(source.skeleton.bones.map(bone => bones.get(bone.name)!), source.skeleton.boneInverses.map(matrix => matrix.clone()));
        mesh.bind(skeleton, source.bindMatrix.clone()); mesh.castShadow = mesh.receiveShadow = true; mesh.visible = false;
        this.skeletons.add(skeleton); root.add(mesh);
      });
      root.getObjectByName('Fitted_leather_jacket')!.userData.clubJacket = true;
    }
    if (cypherCostume) cypherCostume.scene.traverse(source => {
      if (!(source instanceof THREE.SkinnedMesh)) return;
      const mesh = new THREE.SkinnedMesh(source.geometry, source.material); mesh.name = source.name;
      mesh.userData.cypherNeckReference = Boolean(source.userData.cypherNeckReference); mesh.userData.cypherCostume = !mesh.userData.cypherNeckReference;
      const skeleton = new THREE.Skeleton(source.skeleton.bones.map(bone => bones.get(bone.name)!), source.skeleton.boneInverses.map(matrix => matrix.clone()));
      mesh.bind(skeleton, source.bindMatrix.clone()); mesh.castShadow = mesh.receiveShadow = true; mesh.visible = false;
      this.skeletons.add(skeleton); root.add(mesh);
    });
    if (mouseShip) mouseShip.scene.traverse(source => {
      if (!(source instanceof THREE.SkinnedMesh)) return;
      const mesh = new THREE.SkinnedMesh(source.geometry, source.material); mesh.name = source.name; mesh.userData = { ...source.userData };
      const skeleton = new THREE.Skeleton(source.skeleton.bones.map(bone => bones.get(bone.name)!), source.skeleton.boneInverses.map(matrix => matrix.clone()));
      mesh.bind(skeleton, source.bindMatrix.clone()); mesh.castShadow = mesh.receiveShadow = true; mesh.visible = false;
      this.skeletons.add(skeleton); root.add(mesh);
    });
    this.forearms.attach(root, bones, rest);
    if (id === 'trinity' && !support && asset.parser.json.extras.trinityShoulderSupport?.version === 1)
      this.shoulders.attach(root, bones, rest);
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
    const metadata = asset.parser.json.extras as { eye: number[]; head: number[]; waist: number[]; glassesTemples?: [number, number, number][][]; articulatedJaw?: ArticulatedJawData; eyelidCorrectives?: EyelidCorrectivesData; filmExpressionReference?: { clip: string }; oralAmbientOcclusion?: OralAmbientOcclusionData };
    const eye = new THREE.Vector3().fromArray(metadata.eye).sub(new THREE.Vector3().fromArray(metadata.head));
    head.userData.cameraEye = eye.clone().setX(0);
    if (support === 'cypher') head.userData.cypherEyeHalfWidth = Math.abs(eye.x);
    if (id === 'neo' && !support) {
      // The old eye markers sit behind the registered face. The exposed patient
      // view needs its centre just outside that surface, before head culling.
      root.updateMatrixWorld(true);
      root.traverse(object => {
        if (!(object instanceof THREE.SkinnedMesh) || (object.material as THREE.Material).name !== 'Skin') return;
        object.skeleton.update(); object.computeBoundingBox(); object.computeBoundingSphere();
        const point = head.localToWorld((head.userData.cameraEye as THREE.Vector3).clone());
        const outward = new THREE.Vector3(0, 0, 1).transformDirection(head.matrixWorld);
        const hit = new THREE.Raycaster(point.addScaledVector(outward, .5), outward.clone().negate(), 0, 1).intersectObject(object)[0];
        if (hit) head.userData.patientEye = head.worldToLocal(hit.point.addScaledVector(outward, .035));
      });
    }
    const glasses = new THREE.Group(); head.add(glasses);
    const glassesId = support === 'mouse' ? 'mouse' : id;
    if (glassesId === 'smith') this.smithGlasses(glasses, eye, root);
    else this.glasses(glasses, eye, glassesId, metadata.glassesTemples);
    if (support === 'courier' || police) {
      const uniform = new THREE.MeshStandardMaterial({ color: 0x273d4e, roughness: .92 });
      this.mesh(head, new THREE.SphereGeometry(.285, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), uniform).position.set(0, .11, -.01);
      const brim = this.mesh(head, new THREE.SphereGeometry(.28, 24, 12), uniform); brim.scale.set(1, .055, .7); brim.position.set(0, .12, .23);
    }
    const pelvis = bones.get('pelvis')!;
    const waist = new THREE.Vector3().fromArray(metadata.waist).sub(pelvis.position);
    const panels = (id === 'neo' || id === 'morpheus') && !pedestrian && !police && support !== 'link' && support !== 'dozer' && support !== 'tank' && support !== 'cypher' && support !== 'mouse' ? [-1, 1].map(side => this.coat(pelvis, waist, side, id)) : [];
    const footHeight = this.point.setFromMatrixPosition(bones.get('ankle_L')!.matrixWorld).y;
    const silver = { value: 0 }; const wardrobe: HeroRig['wardrobe'] = [];
    let trackingSkin: HeroRig['trackingSkin'];
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
      if (object.userData.cypherNeckReference || object.userData.mouseNeckReference) { object.visible = false; return; }
      if (object.userData.hammerBriefingCostume || object.userData.logosCostume || object.userData.dojoCostume || object.userData.cypherCostume) { object.visible = false; object.userData.reloadedHidden = true; }
      const source = object.material; const material = source.clone(); this.materials.add(material); object.material = material;
      if (support === 'citizen_2' && material.name === 'Hair cards' || object.geometry.hasAttribute('_albedo_uv') || object.geometry.hasAttribute('_face_pigment')) {
        material.onBeforeCompile = source.onBeforeCompile; material.customProgramCacheKey = source.customProgramCacheKey;
      }
      if (object.geometry.hasAttribute('_face_pigment')) applyReferencePigment(material);
      if (object.geometry.hasAttribute('_mouth_albedo')) applyMouthAlbedo(material);
      if (material.userData.dojoSkinColorGain) material.color.multiply(new THREE.Color().fromArray(material.userData.dojoSkinColorGain));
      if ((tracking || support === 'link' || id === 'trinity' || id === 'morpheus') && !object.userData.office && !object.userData.dojoSkin && object instanceof THREE.SkinnedMesh && material.name === 'Skin') {
        // The existing head/hands mesh also contains shoulder caps. They sit
        // beneath the new sleeves; preserve the finished face and wrist rings.
        const original = object.geometry; const index = original.index!; const positions = original.attributes.position;
        const covered = (index: number) => (tracking || support === 'link') && positions.getY(index) > 2.6 && positions.getY(index) < 3.68 && Math.abs(positions.getX(index)) > .24;
        const indices: number[] = [];
        for (let i = 0; i < index.count; i += 3) {
          const triangle = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
          if (!triangle.every(covered)) indices.push(...triangle);
        }
        const dressed = new THREE.BufferGeometry(); dressed.setIndex(indices);
        // Share the face/hand vertices and any later performance attributes.
        // Both index buffers belong to disposable geometries, avoiding orphaned
        // GPU buffers when the outfit changes repeatedly.
        dressed.attributes = original.attributes;
        dressed.morphAttributes = original.morphAttributes; dressed.morphTargetsRelative = original.morphTargetsRelative;
        const firstPerson = new THREE.BufferGeometry(), hands: number[] = [];
        const joints = original.attributes.skinIndex, weights = original.attributes.skinWeight;
        const head = (vertex: number) => [0, 1, 2, 3].some(i => weights.getComponent(vertex, i) > .05 && /^(head|neck|MorpheusJaw)$/.test(object.skeleton.bones[joints.getComponent(vertex, i)].name));
        for (let i = 0; i < indices.length; i += 3) {
          const triangle = indices.slice(i, i + 3); if (!triangle.some(head)) hands.push(...triangle);
        }
        firstPerson.setIndex(hands); firstPerson.attributes = original.attributes;
        firstPerson.morphAttributes = original.morphAttributes; firstPerson.morphTargetsRelative = original.morphTargetsRelative;
        const patientFirstPerson = new THREE.BufferGeometry(), exposed: number[] = [];
        // This asset also weights the lower neck to head. Keep that skin and
        // the wrist rings when the patient is exposed, culling above the jaw.
        const toHead = bones.get('head')!.matrixWorld.clone().invert().multiply(object.matrixWorld);
        const skull = new Uint8Array(positions.count), point = new THREE.Vector3(); object.skeleton.update();
        for (let vertex = 0; vertex < positions.count; vertex++) {
          if (![0, 1, 2, 3].some(i => weights.getComponent(vertex, i) > .05 && /^(head|MorpheusJaw)$/.test(object.skeleton.bones[joints.getComponent(vertex, i)].name))) continue;
          object.getVertexPosition(vertex, point).applyMatrix4(toHead); if (point.y > -.24) skull[vertex] = 1;
        }
        for (let i = 0; i < index.count; i += 3) {
          const triangle = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
          if (!triangle.some(vertex => skull[vertex])) exposed.push(...triangle);
        }
        patientFirstPerson.setIndex(exposed); patientFirstPerson.attributes = original.attributes;
        patientFirstPerson.morphAttributes = original.morphAttributes; patientFirstPerson.morphTargetsRelative = original.morphTargetsRelative;
        object.userData.contactSkinGeometry = original;
        this.geometries.add(dressed); this.geometries.add(firstPerson); this.geometries.add(patientFirstPerson);
        trackingSkin = { mesh: object, original, covered: dressed, firstPerson, patientFirstPerson };
      }
      if (support === 'courier' && material.name === 'Office cotton') material.color.setHex(0x455c6b);
      if (police && /Office cotton|Trousers/.test(material.name)) material.color.setHex(0x202e36);
      if (support === 'rhineheart' && /Coat|Trousers/.test(material.name)) material.color.setHex(0x56594f);
      if (oracleStaff && /Coat|Trousers/.test(material.name)) { material.color.setHex(support === 'oracle_priestess' ? 0xdedbd0 : 0xc7c5b9); material.roughness = .95; }
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
      // Supporting cast shares the existing skinned meshes until bespoke likenesses are produced.
      if (support === 'niobe') {
        if (material.name === 'Skin' || material.name === 'Wrist skin') material.color.setHex(0x986d4e);
        if (/jacket/i.test(object.name)) material.color.setHex(0x653327);
        if (/Hair|hair|Groom|groom/.test(material.name)) { object.visible = false; object.userData.reloadedHidden = true; }
      }
      if (support === 'ballard' && /Coat/.test(material.name)) material.color.setHex(0x302d23);
      if (support === 'ghost' && /Coat/.test(material.name)) material.color.setHex(0x394140);
      if (support === 'soren' && /Hair|hair|Groom|groom/.test(material.name)) material.color.setHex(0xb7b1a2);
      if (support === 'link' && /Coat|Trousers/.test(material.name)) { material.color.setHex(/Trousers/.test(material.name) ? 0x282829 : 0x302b3c); material.roughness = .95; material.metalness = 0; }
      if (support === 'dozer' && /Coat|Trousers/.test(material.name)) { material.color.setHex(0x665e45); material.roughness = .96; }
      wardrobe.push({ mesh: object, color: material.color.clone(), map: material.map, bumpMap: material.bumpMap, bumpScale: material.bumpScale,
        roughness: material.roughness, metalness: material.metalness, side: material.side, emissive: material.emissive.clone(), emissiveIntensity: material.emissiveIntensity,
        outer: panels.some(p => p.mesh === object),
        hair: /Hair|hair|Groom|groom/.test(material.name), cloth: /Coat|Trousers/.test(material.name) || Boolean(object.userData.cypherCostume || object.userData.dojoCostume && !object.userData.dojoSkin) });
      if (id !== 'neo' || support === 'mouse') return;
      addMirrorArrival(object);
      material.onBeforeCompile = (shader, renderer) => {
        source.onBeforeCompile(shader, renderer);
        shader.uniforms.matrixSilver = silver;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float matrixSilver;\nattribute float _mirrorArrival;\nvarying float vLiquidArrival;\nvarying vec3 vLiquidPosition;')
          .replace('#include <skinning_vertex>', `#include <skinning_vertex>
            float liquidPhase = matrixSilver - _mirrorArrival;
            float liquidFront = exp(-pow(liquidPhase * 18.0, 2.0)) * step(0.001, matrixSilver);
            float liquidCovered = smoothstep(0.0, 0.09, liquidPhase);
            float liquidRipple = sin(transformed.y * 34.0 + transformed.x * 25.0 - matrixSilver * 58.0) * 0.004;
            transformed += normalize(objectNormal) * (liquidFront * (0.034 + liquidRipple) + liquidCovered * 0.005);
            vLiquidArrival = _mirrorArrival; vLiquidPosition = transformed;`);
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float matrixSilver;\nvarying float vLiquidArrival;\nvarying vec3 vLiquidPosition;')
          .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
            float liquidEdge = vLiquidArrival + sin(vLiquidPosition.y * 21.0) * sin(vLiquidPosition.x * 14.0) * 0.012;
            float liquidMask = smoothstep(liquidEdge - 0.03, liquidEdge + 0.005, matrixSilver) * step(0.001, matrixSilver);
            float liquidRidge = exp(-pow((matrixSilver - vLiquidArrival) * 17.0, 2.0));
            vec3 liquidColor = mix(vec3(0.63, 0.69, 0.71), vec3(0.85, 0.91, 0.90), liquidRidge * 0.6);
            diffuseColor.rgb = mix(diffuseColor.rgb, liquidColor, liquidMask);
            roughnessFactor = mix(roughnessFactor, 0.08 - liquidRidge * 0.045, liquidMask);
            metalnessFactor = mix(metalnessFactor, 0.98, liquidMask);`);
      };
      material.customProgramCacheKey = () => source.customProgramCacheKey() + '-liquid-mirror-v4';
    });
    for (const { mesh } of wardrobe) prepareThinCornea(mesh.material as THREE.Material);
    const iris = asset.parser.json.extras.irisRefraction as IrisRefractionData | undefined;
    if (iris) {
      const lookups = await Promise.all(iris.eyes.map(eye => asset.parser.getDependency('texture', eye.texture) as Promise<THREE.Texture>));
      for (const texture of lookups) { texture.colorSpace = THREE.NoColorSpace; texture.anisotropy = 1; this.textures.add(texture); }
      if (this.disposed) { this.release(); return; }
      iris.eyes.forEach((eye, i) => prepareIrisRefraction(root.getObjectByName(eye.mesh) as THREE.SkinnedMesh, eye, lookups[i]));
    }
    prepareEyeSocketVisibility(root, asset.parser.json.extras.eyeSocketVisibility as EyeSocketVisibilityData | undefined);
    if (support === 'niobe') {
      const hair = new THREE.MeshStandardMaterial({ color: 0x171812, roughness: .82 });
      for (let i = 0; i < 10; i++) {
        const theta = i * Math.PI * 2 / 10; const knot = this.mesh(head, new THREE.SphereGeometry(.092, 12, 10), hair);
        knot.position.set(Math.cos(theta) * .23, .17 + (i % 2) * .07, -.04 + Math.sin(theta) * .17); knot.scale.y = 1.3;
      }
      const wrist = bones.get('wrist_L')!, metal = new THREE.MeshStandardMaterial({ color: 0x87938c, metalness: .85, roughness: .3 });
      const strap = this.mesh(wrist, new THREE.TorusGeometry(.17, .025, 8, 24), metal); strap.name = 'primary-watch-band'; strap.rotation.x = Math.PI / 2; strap.position.y = .09;
      const watch = new THREE.Group(); watch.name = 'primary-watch'; watch.position.set(0, .09, -.18); wrist.add(watch);
      this.mesh(watch, new THREE.BoxGeometry(.23, .27, .045), metal);
      const face = this.mesh(watch, new THREE.CircleGeometry(.105, 32), new THREE.MeshStandardMaterial({ color: 0x101817, roughness: .45 }));
      face.position.z = -.024; face.rotation.y = Math.PI;
      const ink = new THREE.MeshStandardMaterial({ color: 0xd8debc, emissive: 0x65735f, emissiveIntensity: .3, roughness: .6 });
      for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6, tick = this.mesh(watch, new THREE.BoxGeometry(.01, .02, .003), ink);
        tick.position.set(Math.sin(angle) * .082, Math.cos(angle) * .082, -.029); tick.rotation.z = -angle;
      }
      const needle = new THREE.Group(); needle.name = 'primary-watch-second'; needle.position.z = -.031; watch.add(needle);
      this.mesh(needle, new THREE.BoxGeometry(.006, .095, .003), ink).position.y = .03;
      this.mesh(watch, new THREE.BoxGeometry(.012, .058, .005), ink).position.set(-.007, .021, -.034);
    }
    if (support === 'ballard') {
      const cap = this.mesh(head, new THREE.SphereGeometry(.3, 24, 12), new THREE.MeshStandardMaterial({ color: 0x151813, roughness: .94 })); cap.position.set(.03, .21, -.04); cap.scale.set(1.15, .3, .93); cap.rotation.z = -.17;
    }
    if (support === 'link') {
      const hair = new THREE.MeshStandardMaterial({ color: 0x17140f, roughness: .96 });
      const scalp: number[] = [];
      root.updateWorldMatrix(true, true);
      root.traverse(object => {
        if (!(object instanceof THREE.SkinnedMesh) || (object.material as THREE.Material).name !== 'Skin') return;
        object.skeleton.update(); const indices = object.geometry.index!;
        for (let i = 0; i < indices.count; i += 3) {
          const points = [0, 1, 2].map(k => object.localToWorld(object.getVertexPosition(indices.getX(i + k), new THREE.Vector3())));
          if (!points.every(p => p.y > metadata.eye[1] - .34 + THREE.MathUtils.smoothstep(p.z, -.15, .23) * .47)) continue;
          for (const point of points) { head.worldToLocal(point); point.multiplyScalar(1.025); scalp.push(point.x, point.y, point.z); }
        }
      });
      const shell = new THREE.BufferGeometry(); shell.setAttribute('position', new THREE.Float32BufferAttribute(scalp, 3)); shell.computeVertexNormals();
      this.mesh(head, shell, hair).name = 'link-hair-cap';
      for (let i = 0; i < 24; i++) {
        const angle = i * 2.39996323, radius = .1 + Math.sqrt(i / 24) * .21;
        const x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
        const braid = this.mesh(head, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
          new THREE.Vector3(x, .41 - radius * .22, z - .045), new THREE.Vector3(x * 1.12, .34 - i % 3 * .035, -.15),
          new THREE.Vector3(x * 1.2, .03, -.34), new THREE.Vector3(x * 1.3, -.46 - i % 5 * .07, -.37),
        ]), 16, .034, 7), hair); braid.name = 'link-braid';
      }
    }
    const rig: HeroRig = { root, bones, rest, panels, footHeight, glasses, silver, trackingSkin, wardrobe, support, officeRole: police ? 'police' : support === 'rhineheart' || support === 'courier' ? support : undefined, apartmentRole };
    if (!support && metadata.filmExpressionReference) rig.referenceFaceClip = asset.animations.find(clip => clip.name === metadata.filmExpressionReference!.clip);
    if (metadata.oralAmbientOcclusion) this.oralLights.set(rig, prepareOralAmbientOcclusion(root, metadata.oralAmbientOcclusion));
    if (metadata.articulatedJaw) this.jaws.set(rig, new ArticulatedJaw(rig, metadata.articulatedJaw));
    if (metadata.eyelidCorrectives) this.eyelids.set(rig, new EyelidCorrectives(rig, metadata.eyelidCorrectives));
    const dojoSkin = root.getObjectByName(`${id}-dojo-skin`);
    if (dojoSkin instanceof THREE.SkinnedMesh && !support) {
      const position = dojoSkin.geometry.attributes.position, index = dojoSkin.geometry.index!;
      rig.dojoSoles = { mesh: dojoSkin, indices: [...new Set(Array.from({ length: index.count }, (_, i) => index.getX(i)))].filter(i => position.getY(i) < .2),
        matrices: dojoSkin.skeleton.bones.map(() => new THREE.Matrix4()) };
    }
    if (apartmentRole) this.apartments.set(rig, new ApartmentPerformance(rig));
    if (id === 'neo' && !support) this.recoveries.set(rig, new RecoveryPerformance(rig));
    if ((id === 'neo' || id === 'trinity' || id === 'morpheus') && !support) this.farewellAppearances.set(rig, new FarewellAppearance(rig, id, eye));
    if (id === 'morpheus' && !support) this.constructSuits.set(rig, new ConstructSuitAppearance(rig, this.fabric));
    if (id === 'morpheus' && !support) this.ambushWardrobes.set(rig, new AmbushWardrobeAppearance(rig, this.fabric));
    if (id === 'morpheus' && !support) this.regularCoatTails.set(rig, new RegularCoatTails(rig));
    if (mouseHead) this.mice.set(rig, new MouseAppearance(rig, mouseHead, eye));
    if (!support && !guard) this.fightingHands.set(rig, new FightingHands(rig));
    if (id === 'neo' && !support) this.geometries.add(prepareConstructSleeves(rig));
    if (!support && !guard) this.skinContinuity.set(rig, wardrobe
      .filter(part => part.mesh instanceof THREE.SkinnedMesh && /^(Wrist skin|Office skin|Tracking skin)$/.test((part.mesh.material as THREE.Material).name))
      .map(part => new SkinContinuity(rig, part.mesh as THREE.SkinnedMesh)));
    if (id === 'neo' && !support) {
      rig.patientNeck = patientNeckView(rig);
      if (rig.patientNeck) { root.add(rig.patientNeck); this.geometries.add(rig.patientNeck.geometry); this.materials.add(rig.patientNeck.material as THREE.Material); }
    }
    if (id === 'trinity' && !support && asset.parser.json.extras.trinityElbowCurve?.version === 1)
      this.elbowSleeves.set(rig, new ElbowSleeve(rig, asset.parser.json.extras.trinityElbowCurve));
    enableSkinnedCulling(root);
    return rig;
  }

  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
    this.geometries.add(geometry); this.materials.add(material);
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }

  private smithGlasses(parent: THREE.Group, eye: THREE.Vector3, root: THREE.Group): void {
    const head = parent.parent!, skin = root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    skin.skeleton.update(); const toHead = head.matrixWorld.clone().invert().multiply(skin.matrixWorld);
    const points = Array.from({ length: skin.geometry.attributes.position.count }, (_, id) => skin.getVertexPosition(id, new THREE.Vector3()).applyMatrix4(toHead));
    const index = skin.geometry.index!, triangles: THREE.Vector3[][] = [], groomTriangles = new Set<THREE.Vector3[]>();
    for (let i = 0; i < index.count; i += 3) {
      const face = [0, 1, 2].map(k => points[index.getX(i + k)]);
      if (face.every(p => p.y < eye.y - .14) || face.every(p => p.y > eye.y + .12)) continue;
      triangles.push(face);
    }
    // Longer sideburns occupy space outside the skull. Fit the temples over
    // the real undercoat and fibers as well, rather than burying them in hair.
    root.traverse(object => {
      if (!(object instanceof THREE.SkinnedMesh) || !/^Groom/.test((object.material as THREE.Material).name)) return;
      object.skeleton.update(); const space = head.matrixWorld.clone().invert().multiply(object.matrixWorld);
      const vertices = Array.from({ length: object.geometry.attributes.position.count }, (_, id) => object.getVertexPosition(id, new THREE.Vector3()).applyMatrix4(space));
      const indices = object.geometry.index!;
      for (let i = 0; i < indices.count; i += 3) {
        const face = [0, 1, 2].map(k => vertices[indices.getX(i + k)]);
        if (face.every(p => p.y < eye.y - .14) || face.every(p => p.y > eye.y + .12)) continue;
        triangles.push(face); groomTriangles.add(face);
      }
    });
    // Index the actual skull, nose and ears in the two fitting planes. This
    // runs once when the rig is created; no surface search is needed per frame.
    const section = (u: 'x' | 'y', v: 'y' | 'z', depth: 'x' | 'z') => {
      const cell = .025, grid = new Map<string, { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; denominator: number; padding: number; left: number; right: number; bottom: number; top: number }[]>();
      for (const face of triangles) {
        const [a, b, c] = face;
        const denominator = (b[v] - c[v]) * (a[u] - c[u]) + (c[u] - b[u]) * (a[v] - c[v]);
        // A fine fiber can fall between adjacent tube rings. Its local
        // envelope must cover that span, not just the sampled centre points.
        const padding = depth === 'x' && groomTriangles.has(face) ? .004 : 0;
        if (Math.abs(denominator) < 1e-10 && !padding) continue;
        const left = Math.min(a[u], b[u], c[u]) - padding, right = Math.max(a[u], b[u], c[u]) + padding;
        const bottom = Math.min(a[v], b[v], c[v]) - padding, top = Math.max(a[v], b[v], c[v]) + padding;
        const item = { a, b, c, denominator, padding, left, right, bottom, top };
        for (let x = Math.floor(left / cell); x <= Math.floor(right / cell); x++)
          for (let y = Math.floor(bottom / cell); y <= Math.floor(top / cell); y++) {
            const key = `${x},${y}`, entries = grid.get(key) ?? []; entries.push(item); grid.set(key, entries);
          }
      }
      return (x: number, y: number, side = 1) => {
        let outer = -Infinity;
        for (const { a, b, c, denominator, padding, left, right, bottom, top } of grid.get(`${Math.floor(x / cell)},${Math.floor(y / cell)}`) ?? []) {
          if (padding) {
            if (x >= left && x <= right && y >= bottom && y <= top) outer = Math.max(outer, side * a[depth], side * b[depth], side * c[depth]);
            continue;
          }
          const s = ((b[v] - c[v]) * (x - c[u]) + (c[u] - b[u]) * (y - c[v])) / denominator;
          const t = ((c[v] - a[v]) * (x - c[u]) + (a[u] - c[u]) * (y - c[v])) / denominator, w = 1 - s - t;
          if (s >= -1e-6 && t >= -1e-6 && w >= -1e-6) outer = Math.max(outer, side * (s * a[depth] + t * b[depth] + w * c[depth]));
        }
        return outer;
      };
    };
    const outside = section('y', 'z', 'x'), front = section('x', 'y', 'z');
    const black = new THREE.MeshPhysicalMaterial({ color: '#080b0a', metalness: .05, roughness: .12, clearcoat: 1 });
    const metal = new THREE.MeshStandardMaterial({ color: '#171b19', metalness: .85, roughness: .23 });
    const width = .062, height = .030, spacing = Math.max(eye.x, width + .01), radius = .010;
    const shape = new THREE.Shape();
    shape.moveTo(-width + radius, -height); shape.lineTo(width - radius, -height);
    shape.quadraticCurveTo(width, -height, width, -height + radius); shape.lineTo(width, height - radius);
    shape.quadraticCurveTo(width, height, width - radius, height); shape.lineTo(-width + radius, height);
    shape.quadraticCurveTo(-width, height, -width, height - radius); shape.lineTo(-width, -height + radius);
    shape.quadraticCurveTo(-width, -height, -width + radius, -height);
    const lensPoint = (side: number, x: number, y: number) => new THREE.Vector3(x, y, -.17 * x * side - x * x * 1.4)
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), -side * .035).add(new THREE.Vector3(side * spacing, eye.y, eye.z + .077));
    let forward = 0;
    for (const side of [-1, 1]) for (const p of shape.getPoints(48)) {
      const point = lensPoint(side, p.x, p.y); forward = Math.max(forward, front(point.x, point.y) + .006 - point.z);
    }
    const fittedPoint = (side: number, x: number, y: number) => lensPoint(side, x, y).add(new THREE.Vector3(0, 0, forward));
    for (const side of [-1, 1]) {
      const lensGeometry = new THREE.ExtrudeGeometry(shape, { depth: .0025, bevelEnabled: true, bevelThickness: .0004, bevelSize: .0004, bevelSegments: 1, curveSegments: 24, steps: 1 });
      const position = lensGeometry.attributes.position, normal = lensGeometry.attributes.normal;
      lensGeometry.setIndex(Array.from({ length: position.count }, (_, i) => i));
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), p = fittedPoint(side, x, position.getY(i)); p.z += position.getZ(i) - .0025;
        const n = new THREE.Vector3(normal.getX(i) + (.17 * side + 2.8 * x) * normal.getZ(i), normal.getY(i), normal.getZ(i))
          .applyAxisAngle(new THREE.Vector3(0, 0, 1), -side * .035).normalize();
        position.setXYZ(i, p.x, p.y, p.z); normal.setXYZ(i, n.x, n.y, n.z);
      }
      this.mesh(parent, lensGeometry, black).name = `smith-glasses-lens-${side}`;
      const outline = shape.getPoints(48).map(p => fittedPoint(side, p.x, p.y));
      this.mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outline, true), 64, .0018, 6, true), metal).name = `smith-glasses-rim-${side}`;
      const earBand = points.filter(p => side * p.x > 0 && p.y > eye.y - .14 && p.y < eye.y + .06 && p.z > eye.z - .35 && p.z < eye.z - .12);
      const outer = Math.max(...earBand.map(p => side * p.x));
      const helix = earBand.filter(p => side * p.x > outer * .9).sort((a, b) => b.y - a.y)[0];
      const saddle = helix.clone().add(new THREE.Vector3(0, .006, 0));
      const start = fittedPoint(side, side * width, .012);
      const curve = new THREE.CatmullRomCurve3([start,
        new THREE.Vector3(side * (spacing + width + .025), start.y + .004, eye.z - .035),
        new THREE.Vector3(saddle.x, saddle.y, saddle.z + .07), saddle,
        new THREE.Vector3(saddle.x, saddle.y - .008, saddle.z - .028),
        new THREE.Vector3(saddle.x, saddle.y - .042, saddle.z - .065)]);
      const path = curve.getPoints(64);
      for (const p of path) p.x = side * Math.max(side * p.x, outside(p.y, p.z, side) + .004);
      const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path), 96, .0025, 8), vertices = geometry.attributes.position;
      // Keep each circular section outside the ear/skull, including the
      // rear hook; adjusting only the centreline can bury one side of a tube.
      for (let first = 0; first < vertices.count; first += 9) {
        let clearance = 0;
        for (let i = first; i < first + 9; i++) clearance = Math.max(clearance, outside(vertices.getY(i), vertices.getZ(i), side) - side * vertices.getX(i) + .001);
        for (let i = first; i < first + 9; i++) vertices.setX(i, vertices.getX(i) + side * clearance);
      }
      geometry.computeVertexNormals(); geometry.computeBoundingSphere();
      this.mesh(parent, geometry, metal).name = `smith-glasses-temple-${side}`;
    }
    const ends = [-1, 1].map(side => fittedPoint(side, -side * width, .012));
    const crest = ends[0].clone().lerp(ends[1], .5); crest.y += .010; crest.z = Math.max(crest.z, front(crest.x, crest.y) + .005);
    const bridge = new THREE.CatmullRomCurve3([ends[0], crest, ends[1]]).getPoints(24);
    for (const p of bridge) p.z = Math.max(p.z, front(p.x, p.y) + .005);
    this.mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bridge), 32, .0018, 6), metal).name = 'smith-glasses-bridge';
  }

  private glasses(head: THREE.Group, eye: THREE.Vector3, id: Exclude<HeroId, 'smith'> | 'mouse', temples?: [number, number, number][][]): void {
    const black = new THREE.MeshPhysicalMaterial({ color: '#060909', metalness: .55, roughness: .19, clearcoat: 1 });
    const frame = new THREE.MeshStandardMaterial({ color: '#121516', metalness: .7, roughness: .3 });
    const width = id === 'mouse' ? .052 : id === 'morpheus' ? .056 : id === 'trinity' ? .065 : .064;
    const height = id === 'mouse' ? .047 : id === 'morpheus' ? .053 : id === 'trinity' ? .025 : .028;
    const spacing = Math.max(eye.x, width + .01);
    const bridge = new THREE.CatmullRomCurve3([new THREE.Vector3(-spacing + width, .006, .061), new THREE.Vector3(0, .02, .072), new THREE.Vector3(spacing - width, .006, .061)]);
    const origin = new THREE.Vector3(0, eye.y, eye.z);
    this.mesh(head, new THREE.TubeGeometry(bridge, 12, .0035, 6), frame).position.copy(origin);
    for (const side of [-1, 1]) {
      const shape = new THREE.Shape();
      shape.absellipse(0, 0, width, height, 0, Math.PI * 2, false, 0);
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
      const temple = new THREE.CatmullRomCurve3(temples ? temples[side === -1 ? 0 : 1].map(point => new THREE.Vector3().fromArray(point)) : [
        new THREE.Vector3(side * (spacing + width), eye.y, eye.z + .03), new THREE.Vector3(side * (spacing + width + .025), eye.y + .012, eye.z - .08),
        new THREE.Vector3(side * (spacing + width + .025), eye.y - .015, eye.z - .26),
      ]);
      const arm = this.mesh(head, new THREE.TubeGeometry(temple, temples ? 64 : 16, .004, 6), frame);
      if (id === 'mouse') arm.name = `mouse-glasses-temple-${side}`;
      else if (temples) arm.name = `${id}-glasses-temple-${side}`;
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

  private holdPhone(rig: HeroRig, phone: NonNullable<MotionInput['phone']>): void {
    const smooth = (value: number) => { const t = THREE.MathUtils.clamp(value, 0, 1); return t * t * (3 - 2 * t); };
    rig.root.updateWorldMatrix(true, true);
    const shoulder = rig.bones.get('shoulder_R')!; const elbow = rig.bones.get('elbow_R')!; const wrist = rig.bones.get('wrist_R')!;
    const head = rig.bones.get('head')!;
    const ready = new THREE.Vector3(-.38, 2.98, .8); const pickup = new THREE.Vector3(-.5, 2.635, 1.2);
    const rest = rig.root.worldToLocal(wrist.getWorldPosition(new THREE.Vector3()));
    const ear = rig.root.worldToLocal(head.localToWorld(new THREE.Vector3(-.43, -.25, .17)));
    const target = phone.phase === 'pickup' ? phone.elapsed < .65 ? rest.lerp(pickup, smooth(phone.elapsed / .65)) : pickup.lerp(ready, smooth((phone.elapsed - .65) / 1.15))
      : phone.phase === 'ready' ? ready : ready.lerp(ear, phone.phase === 'connected' ? 1 : smooth((phone.elapsed - .35) / 1.1));
    const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, Math.PI));
    const facing = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0));
    const calling = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, -.55));
    const rotation = phone.phase === 'pickup' ? flat.slerp(facing, smooth((phone.elapsed - .65) / 1.15)) : phone.phase === 'ready' ? facing
      : facing.slerp(calling, phone.phase === 'connected' ? 1 : smooth((phone.elapsed - .35) / 1.1));
    const previousGrip = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, Math.PI)).invert();
    const grip = PHONE_HAND.rotation.clone().invert();
    // Preserve the handset's world trajectory while turning the palm so
    // the four fingers can wrap one edge, rather than splitting sideways.
    target.add(new THREE.Vector3(.14, -.19, 0).applyQuaternion(rotation.clone().multiply(previousGrip)))
      .sub(PHONE_HAND.position.clone().applyQuaternion(rotation.clone().multiply(grip)));
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
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rootRotation).multiply(rotation).multiply(grip));
    for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
      const joint = rig.bones.get(`finger${finger}-${segment}_R`); if (joint) joint.rotation.z = finger === 1 ? .25 : .32;
    }
    this.holdMobileFingers(rig, phone.phase === 'pickup' ? THREE.MathUtils.smoothstep(phone.elapsed, .25, .65) : 1);
  }

  private holdMobileFingers(rig: HeroRig, amount: number): void {
    const wrist = rig.bones.get('wrist_R')!;
    let pose = wrist.userData.phoneGrip as THREE.Quaternion[][] | undefined;
    if (!pose) {
      const skin = rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
      const { position, skinIndex, skinWeight } = skin.geometry.attributes;
      const pads = Array.from({ length: 5 }, () => new THREE.Vector3()), count = [0, 0, 0, 0, 0];
      const distal = skin.skeleton.bones.map(bone => /^finger([1-5])-3_R$/.exec(bone.name));
      for (let vertex = 0; vertex < position.count; vertex++) for (let part = 0; part < 4; part++) {
        const index = skinIndex.getComponent(vertex, part), match = distal[index];
        if (!match || skinWeight.getComponent(vertex, part) < .95) continue;
        this.point.fromBufferAttribute(position, vertex).applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[index]);
        pads[Number(match[1]) - 1].add(this.point); count[Number(match[1]) - 1]++;
      }
      pose = pads.map((pad, i) => {
        pad.divideScalar(count[i]); const digit = i + 1;
        const base = rig.rest.get(`finger${digit}-1_R`)!;
        const first = rig.rest.get(`finger${digit}-2_R`)!, second = rig.rest.get(`finger${digit}-3_R`)!;
        const direction = (i === 0 ? new THREE.Vector3(0, -.15, -.989) : new THREE.Vector3(.55, .835, 0)).normalize();
        const target = i === 0 ? new THREE.Vector3(.158, -.078, .04)
          : new THREE.Vector3(i === 4 ? .13 : i === 3 ? .175 : .18, i === 4 ? -.26 : -.245, base.z);
        const end = target.clone().addScaledVector(direction, -pad.length());
        const axis = end.clone().sub(base), a = first.length(), b = second.length();
        const distance = THREE.MathUtils.clamp(axis.length(), .001, a + b - .001); axis.normalize(); end.copy(base).addScaledVector(axis, distance);
        const along = (a * a - b * b + distance * distance) / (2 * distance);
        const bend = new THREE.Vector3(0, i === 0 ? 1 : -1, 0); bend.addScaledVector(axis, -bend.dot(axis)).normalize();
        const hinge = base.clone().addScaledVector(axis, along).addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along)));
        const parent = new THREE.Quaternion();
        return [hinge.clone().sub(base), end.clone().sub(hinge), direction].map((desired, joint) => {
          const rotation = new THREE.Quaternion().setFromUnitVectors([first, second, pad][joint].clone().normalize(), desired.normalize());
          const local = parent.clone().invert().multiply(rotation); parent.copy(rotation); return local;
        });
      });
      wrist.userData.phoneGrip = pose;
    }
    for (let finger = 1; finger <= 5; finger++) for (let joint = 1; joint <= 3; joint++)
      rig.bones.get(`finger${finger}-${joint}_R`)!.quaternion.slerp(pose[finger - 1][joint - 1], amount);
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

  private supportRecovery(rig: HeroRig, gesture: NonNullable<MotionInput['recoveryCrew']>): void {
    const support = recoveryCrewPose(gesture).support;
    if (!gesture.target || support <= .001) return;
    const side = gesture.role === 'morpheus' ? 'R' : 'L';
    rig.root.updateWorldMatrix(true, true);
    const shoulder = rig.bones.get(`shoulder_${side}`)!; const elbow = rig.bones.get(`elbow_${side}`)!; const wrist = rig.bones.get(`wrist_${side}`)!;
    const target = wrist.getWorldPosition(new THREE.Vector3()).lerp(new THREE.Vector3(gesture.target.x, gesture.target.y, gesture.target.z), support);
    const start = shoulder.getWorldPosition(new THREE.Vector3()); const direction = target.clone().sub(start);
    const upper = elbow.position.length(); const lower = wrist.position.length();
    const reach = THREE.MathUtils.clamp(direction.length(), .02, upper + lower - .001); direction.normalize();
    const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
    const rootRotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
    const bend = new THREE.Vector3(side === 'L' ? .4 : -.4, -1, .35).applyQuaternion(rootRotation);
    bend.addScaledVector(direction, -bend.dot(direction)).normalize();
    const hinge = start.clone().addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, upper * upper - along * along)));
    const aim = (joint: THREE.Bone, child: THREE.Bone, point: THREE.Vector3) => {
      const axis = joint.parent!.worldToLocal(point.clone()).sub(joint.position).normalize();
      joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), axis); joint.updateWorldMatrix(false, true);
    };
    aim(shoulder, elbow, hinge); aim(elbow, wrist, target);
    wrist.rotation.z += (side === 'L' ? -.18 : .18) * support;
    for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
      const joint = rig.bones.get(`finger${finger}-${segment}_${side}`); if (joint) joint.rotation.z *= 1 - support * .82;
    }
  }

  private farewellSupport(rig: HeroRig, gesture: NonNullable<MotionInput['farewell']>): void {
    const trinity = gesture.role === 'trinity', pose = farewellPose(gesture);
    const kiss = gesture.phase === 'kiss' ? THREE.MathUtils.smoothstep(gesture.elapsed, 0, 1.25)
      * (1 - THREE.MathUtils.smoothstep(gesture.elapsed, 2.18, 2.8)) : 0;
    // Preserve the pinned upper body while solving the legs against the tilted deck.
    // Standing ankle-height grounding would lift the seat or sink the downhill shoe.
    const pelvis = rig.bones.get('pelvis')!;
    pelvis.position.y = trinity ? 1.875 : THREE.MathUtils.lerp(1.315, 1.8631, kiss);
    if (trinity) rig.bones.get('head')!.rotation.x -= .18 * kiss;
    else {
      // Rise from the low kneel onto planted feet, then incline from above. A
      // deeper standing-style bow would put his lips below the seated face.
      pelvis.position.x = THREE.MathUtils.lerp(pelvis.position.x, .0006, kiss);
      pelvis.position.z = THREE.MathUtils.lerp(pelvis.position.z, .3763, kiss);
      const spine = rig.bones.get('spine')!, chest = rig.bones.get('chest')!, head = rig.bones.get('head')!;
      spine.rotation.x = THREE.MathUtils.lerp(spine.rotation.x, .275, kiss); spine.rotation.z = .135 * kiss;
      chest.rotation.x = THREE.MathUtils.lerp(chest.rotation.x, .03, kiss); chest.rotation.z = -.02 * kiss;
      head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, .0575, kiss);
      head.rotation.y = 0; head.rotation.z = -.9 * kiss;
    }
    const origin = rig.root.getWorldPosition(new THREE.Vector3());
    for (const side of ['R', 'L']) {
      rig.root.updateWorldMatrix(true, true);
      const hip = rig.bones.get(`hip_${side}`)!, knee = rig.bones.get(`knee_${side}`)!, ankle = rig.bones.get(`ankle_${side}`)!;
      const plant = !trinity && gesture.phase === 'kiss'
        ? THREE.MathUtils.smoothstep(gesture.elapsed, side === 'L' ? 0 : .58, side === 'L' ? .58 : 1.18)
          * (1 - THREE.MathUtils.smoothstep(gesture.elapsed, side === 'L' ? 2.18 : 2.48, side === 'L' ? 2.48 : 2.8)) : 0;
      const x = (side === 'R' ? -1 : 1) * (trinity ? .55 : -THREE.MathUtils.lerp(.42, .98, plant));
      const floor = -Math.tan(.035) * (pose[gesture.role].x + x) + .35 / Math.cos(.035) - .35;
      const target = new THREE.Vector3(origin.x + x, origin.y + floor + .2 + Math.sin(plant * Math.PI) * .4,
        origin.z + (trinity ? .2 : THREE.MathUtils.lerp(THREE.MathUtils.lerp(.07, 1.05, pose.neo.kneel), side === 'R' ? -.55 : -.05, plant)));
      const start = hip.getWorldPosition(new THREE.Vector3()), direction = target.clone().sub(start);
      const upper = knee.position.length(), lower = ankle.position.length();
      const reach = THREE.MathUtils.clamp(direction.length(), .02, upper + lower - .001); direction.normalize();
      const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
      const bend = new THREE.Vector3((side === 'R' ? 1 : -1) * plant * 2, trinity ? 1 : -1, trinity ? 1 : -.2);
      bend.addScaledVector(direction, -bend.dot(direction)).normalize();
      const hinge = start.clone().addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, upper * upper - along * along)));
      const aim = (joint: THREE.Bone, child: THREE.Bone, point: THREE.Vector3) => {
        joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), joint.parent!.worldToLocal(point.clone()).sub(joint.position).normalize());
        joint.updateWorldMatrix(false, true);
      };
      aim(hip, knee, hinge); aim(knee, ankle, target);
      ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert()
        .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, trinity ? 0 : Math.PI, -.035, 'ZYX'))));
    }
    rig.root.updateWorldMatrix(true, true);
  }

  farewellContact(rig: HeroRig, gesture: NonNullable<MotionInput['farewell']>, normal?: THREE.Vector3, up?: THREE.Vector3): void {
    if (!gesture.target) return;
    const pose = farewellPose(gesture); const neo = gesture.role === 'neo';
    const blend = neo ? pose.neo.hold : pose.trinity.reach;
    if (blend <= .001) return;
    const side = neo ? 'R' : 'L';
    rig.root.updateWorldMatrix(true, true);
    const shoulder = rig.bones.get(`shoulder_${side}`)!; const elbow = rig.bones.get(`elbow_${side}`)!; const wrist = rig.bones.get(`wrist_${side}`)!;
    const contact = new THREE.Vector3(gesture.target.x, gesture.target.y, gesture.target.z);
    let orientation: THREE.Quaternion | undefined;
    // Keep the palm facing the cheek until the hand has withdrawn clear of it.
    const palmBlend = THREE.MathUtils.smoothstep(blend, 0, .5);
    if (!neo && normal) {
      let palm = wrist.userData.farewellPalm as THREE.Vector3 | undefined;
      if (!palm) {
        let closest = Infinity;
        for (const part of rig.wardrobe) {
          if (!(part.mesh instanceof THREE.SkinnedMesh) || (part.mesh.material as THREE.Material).name !== 'Skin') continue;
          const mesh = part.mesh, ids = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight;
          const bone = mesh.skeleton.bones.indexOf(wrist);
          for (let i = 0; i < ids.count; i++) {
            let weight = 0;
            for (let k = 0; k < 4; k++) if (mesh.skeleton.bones[ids.getComponent(i, k)] === wrist) weight += weights.getComponent(i, k);
            if (weight < .999) continue;
            const point = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i)
              .applyMatrix4(mesh.bindMatrix).applyMatrix4(mesh.skeleton.boneInverses[bone]);
            const distance = point.distanceToSquared(new THREE.Vector3(-.044, -.16, .009));
            if (distance < closest) { closest = distance; palm = point; }
          }
        }
        wrist.userData.farewellPalm = palm;
      }
      if (palm) {
        // The delivered left palm faces local -X; its fingers extend along -Y.
        const x = normal.clone().normalize(), y = up ? up.clone().negate() : new THREE.Vector3(0, -1, 0);
        y.addScaledVector(x, -y.dot(x)).normalize(); const z = x.clone().cross(y).normalize();
        const desired = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
        orientation = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(desired, palmBlend);
        contact.addScaledVector(x, .032).sub(palm.clone().multiply(wrist.getWorldScale(new THREE.Vector3())).applyQuaternion(orientation));
      }
    }
    const target = wrist.getWorldPosition(new THREE.Vector3()).lerp(contact, blend);
    const start = shoulder.getWorldPosition(new THREE.Vector3()); const direction = target.clone().sub(start);
    const upper = elbow.position.length(); const lower = wrist.position.length();
    const reach = THREE.MathUtils.clamp(direction.length(), .02, upper + lower - .001); direction.normalize();
    const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
    const rootRotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
    const bend = new THREE.Vector3(neo ? -.45 : .45, -.8, .32).applyQuaternion(rootRotation);
    bend.addScaledVector(direction, -bend.dot(direction)).normalize();
    const hinge = start.clone().addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, upper * upper - along * along)));
    const aim = (joint: THREE.Bone, child: THREE.Bone, point: THREE.Vector3) => {
      const axis = joint.parent!.worldToLocal(point.clone()).sub(joint.position).normalize();
      joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), axis); joint.updateWorldMatrix(false, true);
    };
    aim(shoulder, elbow, hinge); aim(elbow, wrist, target);
    if (orientation) wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    else wrist.rotation.z += (side === 'L' ? -.16 : .16) * blend;
    for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
      const joint = rig.bones.get(`finger${finger}-${segment}_${side}`);
      if (joint) { joint.rotation.z *= 1 - (orientation ? palmBlend : blend * .76); if (orientation) joint.rotation.x *= 1 - palmBlend; }
    }
    // Open the delivered curled thumb and fingers along the cheek's tangent plane.
    if (orientation) rig.bones.get('finger1-1_L')!.rotation.z += .9 * palmBlend;
    if (orientation) for (let finger = 2; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
      const joint = rig.bones.get(`finger${finger}-${segment}_L`)!;
      const axis = rig.bones.get(`finger${finger}-${Math.min(3, segment + 1)}_L`)!.position.clone();
      const direction = axis.clone().setX(0).normalize().applyQuaternion(orientation)
        .applyQuaternion(joint.parent!.getWorldQuaternion(new THREE.Quaternion()).invert());
      joint.quaternion.slerp(new THREE.Quaternion().setFromUnitVectors(axis.normalize(), direction), palmBlend);
      joint.updateWorldMatrix(false, true);
    }
  }

  private stopAlarm(rig: HeroRig, elapsed: number): void {
    const blend = THREE.MathUtils.smoothstep(elapsed, .08, .5) * (1 - THREE.MathUtils.smoothstep(elapsed, .7, MORNING.stopping));
    if (blend <= 0) return;
    const shoulder = rig.bones.get('shoulder_R')!, elbow = rig.bones.get('elbow_R')!, wrist = rig.bones.get('wrist_R')!;
    const center = FILM_SETS.film_anderson_flat.center;
    const orientation = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2)), blend);
    const palm = new THREE.Vector3(.09, -.18, .02);
    const button = new THREE.Vector3(center.x + MORNING.alarm.x, center.y - 1 + MORNING.alarm.y + .255, center.z + MORNING.alarm.z);
    const target = wrist.localToWorld(palm.clone()).lerp(button, blend).sub(palm.applyQuaternion(orientation));
    const start = shoulder.getWorldPosition(new THREE.Vector3()); const direction = target.clone().sub(start);
    const a = elbow.position.length(); const b = wrist.position.length(); const reach = THREE.MathUtils.clamp(direction.length(), .02, a + b - .001); direction.normalize();
    target.copy(start).addScaledVector(direction, reach);
    const along = (a * a - b * b + reach * reach) / (2 * reach);
    const pole = new THREE.Vector3(-.3, 1, .4); pole.addScaledVector(direction, -pole.dot(direction)).normalize();
    const hinge = start.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
    const aim = (joint: THREE.Bone, child: THREE.Bone, point: THREE.Vector3) => {
      joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), joint.parent!.worldToLocal(point.clone()).sub(joint.position).normalize());
      joint.updateWorldMatrix(false, true);
    };
    aim(shoulder, elbow, hinge); aim(elbow, wrist, target);
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++)
      rig.bones.get(`finger${finger}-${segment}_R`)!.rotation.z *= 1 - blend;
  }
  crosscutInterfaces(rig: HeroRig): void {
    if (!this.recoveries.has(rig)) this.recoveries.set(rig, new RecoveryPerformance(rig));
    this.recoveries.get(rig)!.update(undefined, true);
  }

  mousePistols(rig: HeroRig, guns: THREE.Group[], shotAge: number, roomTime?: number): void {
    const originalKick = Math.max(0, 1 - shotAge / .18) ** 2;
    const delayedKick = ambushShotRecoil(shotAge);
    for (const [hand, side] of ['R', 'L'].entries()) {
      // The film's cylinder props are held low with the elbows bent. Opposite
      // offsets keep the aim without bending wrists. Fire before recoil peaks,
      // using the saved shot age so pause and cold loading give the same pose.
      const shoulder = rig.bones.get('shoulder_' + side)!, elbow = rig.bones.get('elbow_' + side)!;
      shoulder.rotation.x += 1.15 + .16 * originalKick;
      elbow.rotation.x += -1.15 + .12 * originalKick;
      const gun = guns[hand], sign = hand ? -1 : 1;
      let fingers = gun.userData.mouseGrip as THREE.Quaternion[][] | undefined;
      if (!fingers) {
        const skin = rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
        const { position, skinIndex, skinWeight } = skin.geometry.attributes;
        const pads = Array.from({ length: 5 }, () => new THREE.Vector3()), counts = [0, 0, 0, 0, 0];
        const index = rig.rest.get(`finger2-1_${side}`)!, middle = rig.rest.get(`finger3-1_${side}`)!, little = rig.rest.get(`finger5-1_${side}`)!;
        const wristIndex = skin.skeleton.bones.indexOf(rig.bones.get(`wrist_${side}`)!); let palm = 0;
        const distal = skin.skeleton.bones.map(bone => new RegExp(`^finger([1-5])-3_${side}$`).exec(bone.name));
        for (let vertex = 0; vertex < position.count; vertex++) for (let part = 0; part < 4; part++) {
          const index = skinIndex.getComponent(vertex, part), match = distal[index];
          if (index === wristIndex && skinWeight.getComponent(vertex, part) > .9) {
            this.point.fromBufferAttribute(position, vertex).applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[index]);
            if (this.point.y > little.y && this.point.y < -.1 && this.point.z > little.z && this.point.z < rig.rest.get(`finger2-1_${side}`)!.z)
              palm = Math.max(palm, sign * this.point.x);
          }
          if (!match || skinWeight.getComponent(vertex, part) < .95) continue;
          this.point.fromBufferAttribute(position, vertex).applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[index]);
          pads[Number(match[1]) - 1].add(this.point); counts[Number(match[1]) - 1]++;
        }
        pads.forEach((pad, i) => pad.divideScalar(counts[i]));
        const handle = gun.getObjectByName('mouse-weapon-grip') as THREE.Mesh, trigger = gun.getObjectByName('mouse-weapon-trigger') as THREE.Mesh;
        // Index sits above the little finger in this anatomical wrist frame.
        // The generic fallback mount points the grip in the opposite direction.
        gun.rotation.set(0, Math.PI, 0);
        gun.position.set(sign * (palm + handle.scale.x / 2 - .012), middle.y + handle.scale.y / 2 - handle.position.y + .012,
          (index.z + little.z) / 2 + handle.position.z);
        const center = handle.position.clone().applyQuaternion(gun.quaternion).add(gun.position);
        const triggerCenter = trigger.position.clone().applyQuaternion(gun.quaternion).add(gun.position);
        fingers = pads.map((pad, i) => {
          const base = rig.rest.get(`finger${i + 1}-1_${side}`)!, first = rig.rest.get(`finger${i + 1}-2_${side}`)!, second = rig.rest.get(`finger${i + 1}-3_${side}`)!;
          const direction = (i === 0 ? new THREE.Vector3(-sign * .6, -.8, 0) : i === 1 ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(sign * .8, .6, 0)).normalize();
          const target = i === 0 ? new THREE.Vector3(center.x - sign * (handle.scale.x / 2 + .018), center.y + .035, index.z)
            : i === 1 ? triggerCenter.clone().add(new THREE.Vector3(-sign * (trigger.scale.x / 2 + .012), 0, 0))
            : new THREE.Vector3(center.x + sign * (i === 2 ? .045 : i === 3 ? .025 : -.025),
              center.y - handle.scale.y / 2 - .018, base.z);
          const end = target.clone().addScaledVector(direction, -pad.length()), axis = end.clone().sub(base);
          const a = first.length(), b = second.length(), distance = THREE.MathUtils.clamp(axis.length(), .001, a + b - .001);
          axis.normalize(); end.copy(base).addScaledVector(axis, distance);
          const along = (a * a - b * b + distance * distance) / (2 * distance);
          const bend = new THREE.Vector3(sign * .3, i === 0 ? 1 : -1, 0); bend.addScaledVector(axis, -bend.dot(axis)).normalize();
          const hinge = base.clone().addScaledVector(axis, along).addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along))), parent = new THREE.Quaternion();
          return [hinge.clone().sub(base), end.clone().sub(hinge), direction].map((desired, joint) => {
            const rotation = new THREE.Quaternion().setFromUnitVectors([first, second, pad][joint].clone().normalize(), desired.normalize());
            const local = parent.clone().invert().multiply(rotation); parent.copy(rotation); return local;
          });
        });
        gun.userData.mouseGrip = fingers;
      }
      for (let digit = 1; digit <= 5; digit++) for (let joint = 1; joint <= 3; joint++)
        rig.bones.get(`finger${digit}-${joint}_${side}`)!.quaternion.copy(fingers[digit - 1][joint - 1]);
      if (roomTime !== undefined) {
        const guard = mouseRoomGuard(hand, roomTime), center = FILM_SETS.film_ambush_house.center;
        const target = new THREE.Vector3(center.x + guard.x, center.y - 1 + guard.y + 2.55, center.z + guard.z);
        // Aim the held prop at its own officer before recoil. Rotate the whole
        // shoulder chain so the anatomical wrist and all grip contacts survive.
        for (let iteration = 0; iteration < 8; iteration++) {
          rig.root.updateWorldMatrix(true, true);
          const muzzle = gun.getObjectByName('mouse-weapon-muzzle')!.getWorldPosition(new THREE.Vector3());
          const direction = new THREE.Vector3(0, -1, 0).applyQuaternion(gun.getWorldQuaternion(new THREE.Quaternion()));
          const rotation = new THREE.Quaternion().setFromUnitVectors(direction, target.clone().sub(muzzle).normalize());
          const parent = shoulder.parent!.getWorldQuaternion(new THREE.Quaternion());
          shoulder.quaternion.premultiply(parent.clone().invert().multiply(rotation).multiply(parent));
        }
      }
      shoulder.rotation.x -= .16 * delayedKick;
      elbow.rotation.x -= .12 * delayedKick;
    }
  }

  private gripHand(rig: HeroRig, side: string, grip: number): void {
    if (this.fightingHands.get(rig)?.pose(side, grip)) return;
    if (grip <= 0) return;
    const wrist = rig.bones.get(`wrist_${side}`)!;
    let closed = wrist.userData.closedHand as THREE.Quaternion[][] | undefined;
    if (!closed) {
      closed = [];
      const inward = side === 'R' ? 1 : -1;
      const tips = Array.from({ length: 5 }, () => new THREE.Vector3());
      const skin = rig.root.getObjectByName(rig.support === 'citizen_2' ? 'Red_dress_anatomy' : 'Anatomical_head_and_hands') as THREE.SkinnedMesh;
      const { position, skinIndex, skinWeight } = skin.geometry.attributes;
      const distal = skin.skeleton.bones.map(bone => new RegExp(`^finger([1-5])-3_${side}$`).exec(bone.name));
      // Distal bones have no child joint. Infer their actual axis from the
      // bound fingertip skin, rather than copying the preceding phalanx.
      for (let vertex = 0; vertex < position.count; vertex++) for (let part = 0; part < 4; part++) {
        const joint = skinIndex.getComponent(vertex, part), match = distal[joint];
        if (!match || skinWeight.getComponent(vertex, part) < .9) continue;
        this.point.fromBufferAttribute(position, vertex).applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[joint]);
        tips[Number(match[1]) - 1].add(this.point);
      }
      // Bind axes are world-aligned, but the source fingers are already
      // curved and splayed. Aim their segments in wrist space instead of
      // adding the same Euler curl to every digit. The thumb opposes them.
      for (let digit = 1; digit <= 5; digit++) {
        const parent = new THREE.Quaternion(), joints: THREE.Quaternion[] = [];
        const directions = digit === 1 ? [[.83, -.5, .23], [.65, -.73, -.21], [-.1, -.45, -.88]]
          : [[.985, -.173, 0], [.5, .866, 0], [-.9, .436, 0]];
        for (const [i, direction] of directions.entries()) {
          const axis = (i === 2 ? tips[digit - 1] : rig.rest.get(`finger${digit}-${i + 2}_${side}`)!).clone().normalize();
          const target = new THREE.Vector3(inward * direction[0], direction[1], direction[2]).normalize();
          const world = new THREE.Quaternion().setFromUnitVectors(axis, target);
          joints.push(parent.clone().invert().multiply(world)); parent.copy(world);
        }
        closed.push(joints);
      }
      wrist.userData.closedHand = closed;
    }
    const amount = THREE.MathUtils.clamp(grip, 0, 1);
    // Close the fingers first, then lay the thumb over them; simultaneous
    // linear closure sweeps the index fingertip through the thumb.
    for (let digit = 1; digit <= 5; digit++) for (let i = 0; i < 3; i++)
      rig.bones.get(`finger${digit}-${i + 1}_${side}`)!.quaternion.slerp(closed[digit - 1][i], digit === 1 ? amount * amount : amount);
    // The thumb travels around the index finger before settling outside
    // the fist. Keep this arc in wrist space, independent of the arm pose.
    const thumb = rig.bones.get(`finger1-1_${side}`)!, inward = side === 'R' ? 1 : -1;
    const abduction = -inward * .55 * Math.sin(Math.PI * amount) / 2;
    thumb.quaternion.premultiply(this.handRotation.set(0, Math.sin(abduction), 0, Math.cos(abduction)));
    const outside = inward * .14 * amount / 2;
    thumb.quaternion.premultiply(this.handRotation.set(0, 0, Math.sin(outside), Math.cos(outside)));
  }

  animate(rig: HeroRig, pose: Pose, motion: MotionState, input: MotionInput, delta: number): void {
    const fightingHands = this.fightingHands.get(rig); fightingHands?.begin(input);
    if (input.interlude?.kind === 'meal' && (input.interlude.role === 'neo' || input.interlude.role === 'tank') && !this.meals.has(rig))
      this.meals.set(rig, new MealPerformance(rig, input.interlude.role));
    this.meals.get(rig)?.mouth(input.interlude);
    if (rig.support === 'cypher') setCypherMouth(rig.root, steakJawOpen(input.interlude));
    if (input.training?.kind === 'red_dress' && input.training.attention?.phase === 'frozen') delta = 0;
    const constructView = input.construct?.role === 'neo' && input.construct.phase === 'image' || input.reveal?.kind === 'construct' && input.reveal.role === 'neo';
    const truthView = input.truth?.role === 'neo';
    const downloadView = input.cabin?.kind === 'core' && input.cabin.role === 'neo' || input.training && ['download', 'jump_fall', 'jump_return', 'red_dress'].includes(input.training.kind) && input.training.role === 'neo';
    const interactionView = Boolean(input.firstPerson && (constructView || truthView || downloadView || input.interlude && ['console', 'meal'].includes(input.interlude.kind) && input.interlude.role === 'neo' || input.performance === 'recover' || input.cabin?.kind === 'wake' || input.armed && input.weaponStyle === 'hel_pistol' || input.mobilReunion?.reunion.phase === 'embracing' || input.hammerBriefing || input.helDisarm || input.helBreakout || input.helDoorPush || input.helElevator || input.helDanceDoor !== undefined || input.primaryDemolition?.phase === 'mounting' || input.primaryDemolition?.blast?.phase === 'countdown' || input.logosBane || input.logosPilot || input.signal || input.architect?.role === 'neo' || input.catch?.role === 'neo' || input.truckHood || input.truckWeapons || input.freewayPickup || input.freewayRide || input.smithFinale?.pitFight && smithFinaleLocked(input.smithFinale) || input.dockReunion || input.empOperator || input.morning || input.podWake !== undefined || input.podDisconnect !== undefined || input.podRescue !== undefined || input.workday?.role === 'neo' && input.workday.phase === 'signing'));
    if (rig.support === 'link') for (const part of rig.bones.get('head')!.children)
      if (part.name === 'link-hair-cap' || part.name === 'link-braid') part.visible = !interactionView;
    rig.silver.value = input.mirror ?? 0;
    const finaleGlasses = !input.smithFinale || (input.smithFinale.role === 'smith' ? smithCraterAmount(input.smithFinale) === 0
      : ['approach', 'entrance', 'greeting', 'reply', 'prediction', 'charge_ready', 'charging', 'ready', 'ground_warning', 'ground_dodge', 'ground_counter', 'shockwave', 'air_warning', 'air_dodge', 'air_counter'].includes(input.smithFinale.phase));
    rig.glasses.visible = rig.support !== 'citizen_2' && rig.support !== 'tank' && !input.dojoOutfit && !interactionView && !(rig.support === 'cypher' && (input.firstPerson || input.interlude?.kind === 'steak')) && (!input.catch || ['launch', 'departing', 'flight', 'catching', 'ascent'].includes(input.catch.phase) && input.catch.role === 'neo') && !rig.officeRole && !rig.apartmentRole && input.glasses !== false && !input.realWorld && finaleGlasses && !(input.bathroom?.role === 'smith' && input.bathroom.headbutt);
    const officeShirt = input.officeShirt || rig.officeRole === 'courier' || rig.officeRole === 'police';
    const trackingShirt = input.performance === 'touch' || input.homeClothes === true;
    const clubClothes = Boolean(input.clubClothes && !input.realWorld);
    const pod = input.performance && ['pod', 'fall', 'float', 'lift', 'recover'].includes(input.performance);
    const recoveryComplete = input.performance === 'recover' && input.recovery !== undefined && input.recovery >= 11.7;
    const patient = Boolean(input.performance && ['pod', 'fall', 'float', 'lift', 'recover'].includes(input.performance)
      && !recoveryComplete);
    if (rig.trackingSkin) {
      const skin = rig.trackingSkin; skin.mesh.geometry = interactionView ? patient ? skin.patientFirstPerson : skin.firstPerson : trackingShirt ? skin.covered : skin.original;
    }
    if (rig.patientNeck) rig.patientNeck.visible = interactionView && patient && (input.performance === 'recover' || input.cabin?.kind === 'wake');
    const completePatientBody = rig.wardrobe.some(part => part.mesh.userData.patientBody);
    const farewellAppearance = this.farewellAppearances.get(rig);
    const ambushWardrobe = this.ambushWardrobes.get(rig);
    poseConstructSleeves(rig, input);
    for (const part of rig.wardrobe) {
      const material = part.mesh.material as THREE.MeshStandardMaterial;
      const patientLegs = Boolean(patient && !completePatientBody && material.name === 'Trousers' && /Tailored.trousers/i.test(part.mesh.name));
      const patientTorso = Boolean(patient && (part.mesh.userData.patientBody || !completePatientBody && material.name === 'Office skin'));
      const patientSurface = patient && (material.name === 'Skin' || patientLegs || patientTorso);
      part.mesh.visible = !part.mesh.userData.reloadedHidden && !(part.outer && (input.realWorld || input.clubClothes || input.pills?.role === 'neo' || input.meeting || input.wakeCall) || part.hair && (pod || input.realWorld && completePatientBody))
        && (!patient || material.name === 'Skin' || patientLegs || patientTorso);
      if (part.outer && (input.bathroom?.role === 'morpheus' || input.sixth?.role === 'morpheus' && ['breach', 'done'].includes(input.sixth.phase))) part.mesh.visible = false;
      if (part.mesh.userData.office) part.mesh.visible = Boolean(patientTorso || officeShirt || input.meeting?.role === 'neo' && (part.mesh.material as THREE.Material).name === 'Office skin');
      else if (part.mesh.userData.patientBody) part.mesh.visible = patient;
      else if (part.mesh.userData.tracking) part.mesh.visible = trackingShirt;
      else if (part.mesh.userData.club) part.mesh.visible = clubClothes;
      else if (part.mesh.userData.wristSkin && (trackingShirt && completePatientBody || clubClothes && rig.wardrobe.some(part => part.mesh.userData.club))) part.mesh.visible = false;
      else if (part.mesh.userData.clubJacket && clubClothes) part.mesh.visible = false;
      else if ((officeShirt || trackingShirt) && (part.outer || /Tailored.coat.upper|Black.crew.neck/i.test(part.mesh.name))) part.mesh.visible = false;
      const dojoCloth = input.dojoOutfit && part.mesh.userData.dojoCostume && !part.mesh.userData.dojoSkin;
      const map = patientLegs ? this.patientSkin : part.map; const bumpMap = dojoCloth ? this.fabric : patientLegs ? this.patientSkin : part.bumpMap;
      if (!farewellAppearance?.garment(part.mesh, input) && !ambushWardrobe?.garment(part.mesh, input) && (material.map !== map || material.bumpMap !== bumpMap)) { material.map = map; material.bumpMap = bumpMap; material.needsUpdate = true; }
      material.bumpScale = dojoCloth ? .0015 : patientLegs ? .0013 : part.bumpScale;
      const side = input.firstPerson && (constructView || truthView || downloadView) && part.cloth ? THREE.DoubleSide : part.side;
      if (material.side !== side) { material.side = side; material.needsUpdate = true; }
      material.roughness = patientSurface ? .43 : part.roughness; material.metalness = patientSurface ? .01 : part.metalness;
      if (patientSurface) material.emissive.setHex(0x160708); else material.emissive.copy(part.emissive);
      material.emissiveIntensity = patientSurface ? .06 : part.emissiveIntensity;
      if (patientLegs) material.color.setHex(0xa97c70);
      else if (part.cloth && input.realWorld && rig.support !== 'link' && rig.support !== 'tank' && !part.mesh.userData.cypherCostume) material.color.setHex(rig.support === 'ghost' ? 0x232725 : 0x706c62);
      else material.color.copy(part.color);
      if ((part.hair || material.name === 'Eyes' || material.name === 'Eyes cornea') && interactionView) part.mesh.visible = false;
      if (part.mesh.userData.tankHead) part.mesh.visible = !input.firstPerson;
      if (part.mesh.userData.oralSurface || part.mesh.name.startsWith('neo-teeth') || part.mesh.name === 'neo-tongue') part.mesh.visible = !rig.support && !interactionView;
    }
    farewellAppearance?.update(input);
    this.constructSuits.get(rig)?.update(input);
    ambushWardrobe?.update(input);
    for (const part of rig.wardrobe) {
      if (part.mesh.userData.cypherCostume) part.mesh.visible = Boolean(input.realWorld);
      else if (rig.support === 'cypher' && input.realWorld && /Tailored.coat.upper|Black.crew.neck/.test(part.mesh.name)) part.mesh.visible = false;
      if (part.mesh.userData.dojoCostume) {
        part.mesh.visible = Boolean(input.dojoOutfit);
      } else if (input.dojoOutfit && (part.outer || part.cloth || /Black.crew.neck|shoes01/i.test(part.mesh.name))) part.mesh.visible = false;
    }
    this.mice.get(rig)?.update(input);
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
    const phonePickup = input.phone?.phase === 'pickup' ? input.phone : undefined;
    if (phonePickup) {
      const reach = phonePickup.elapsed < .65 ? Math.min(1, phonePickup.elapsed / .65) : Math.max(0, 1 - (phonePickup.elapsed - .65) / 1.15);
      bone('spine').rotation.x += .3 * reach; bone('chest').rotation.x += .6 * reach; bone('head').rotation.x -= .45 * reach;
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
    const relaxedArms = (ambushWardrobe?.relaxedArmOffset(input, motion) ?? 0)
      + (this.regularCoatTails.get(rig)?.relaxedArmOffset(input, motion) ?? 0);
    // The loose gi needs clearance only while the relaxed arm swings forward.
    // Preserve the original back swing, guard and authored story contacts.
    const ordinaryDojoSwing = input.dojoOutfit && !input.dojoSparring && input.grounded
      && rig.dojoSoles?.mesh.name === 'neo-dojo-skin'
      && Object.entries(input).every(([key, value]) => value === undefined || value === false
        || key === 'mirror' && value === 0 || dojoSwingInputs.has(key as keyof MotionInput));
    const dojoSwing = ordinaryDojoSwing ? .16 * THREE.MathUtils.smoothstep(motion.speed, 0, 2.2)
      * THREE.MathUtils.smoothstep(motion.attackAge, 1, 1.3) * THREE.MathUtils.smoothstep(motion.skillAge, 1, 1.3)
      * THREE.MathUtils.smoothstep(motion.hitAge, .3, .5) * (1 - motion.airborne) * (1 - motion.seated) : 0;
    // Tank's own longer thighs need a flatter seat angle. Counter-rotate the
    // knees so grounding still keeps both shins and boot soles upright.
    const operatorSeat = rig.support === 'tank' && input.interlude?.kind === 'meal' ? motion.seated * .045 : 0;
    for (const [i, side] of ['R', 'L'].entries()) {
      bone('hip_' + side).rotation.set(pose.legs[i].hip - operatorSeat, 0, 0);
      bone('knee_' + side).rotation.set(pose.legs[i].knee + operatorSeat, 0, 0);
      bone('ankle_' + side).rotation.set(pose.legs[i].ankle, 0, 0);
      bone('shoulder_' + side).rotation.set(pose.arms[i].shoulder, 0, pose.arms[i].outward * .6 + (i ? 1 : -1) * (relaxedArms + dojoSwing * THREE.MathUtils.smoothstep(-pose.arms[i].shoulder, 0, .15)));
      bone('elbow_' + side).rotation.set(pose.arms[i].elbow, 0, 0);
      bone('wrist_' + side).quaternion.identity();
      const grip = .15;
      for (let f = 1; f <= 5; f++) for (let s = 1; s <= 3; s++) {
        const finger = bone(`finger${f}-${s}_${side}`);
        const inward = side === 'R' ? 1 : -1;
        finger.rotation.set(f === 1 ? grip * (s === 1 ? .8 : .65) : 0, 0,
          inward * grip * (f === 1 ? .2 : s === 1 ? .85 : 1.1));
      }
      this.gripHand(rig, side, input.dojoSparring && !input.armed ? 1 : pose.arms[i].grip);
    }
    poseDojoStance(rig, input, motion);
    if (input.recovery !== undefined) {
      const t = input.recovery;
      const body = recoveryBodyPose(t); const lie = 1 - body.sit, seated = body.sit * (1 - body.rise);
      pelvis.rotation.x = -Math.PI / 2 * lie;
      bone('spine').rotation.x += .08 * seated;
      bone('chest').rotation.x += .12 * seated;
      bone('head').rotation.x += .12 * lie - .18 * seated;
      for (const [i, side] of ['R', 'L'].entries()) {
        bone('hip_' + side).rotation.x = THREE.MathUtils.lerp(bone('hip_' + side).rotation.x, -Math.PI / 2, seated);
        bone('knee_' + side).rotation.x = THREE.MathUtils.lerp(bone('knee_' + side).rotation.x, Math.PI / 2 * body.lower, seated);
        const tremor = t > 2 && t < 7 ? Math.sin(t * 7 + i * 2.1) * .025 : 0;
        bone('shoulder_' + side).rotation.set(-.14 - seated * .22 + tremor, 0, (i ? 1 : -1) * (.32 * lie + .1));
        bone('elbow_' + side).rotation.x = -.24 - seated * .78;
        if (input.performance === 'recover' || input.cabin?.kind === 'wake') {
          // Rest the patient's forearms on the mattress instead of holding the standing arm pose in midair.
          bone('shoulder_' + side).rotation.x = THREE.MathUtils.lerp(bone('shoulder_' + side).rotation.x, (input.cabin?.kind === 'wake' ? .17 : .146) + tremor * .1, lie);
          bone('elbow_' + side).rotation.x *= 1 - lie;
        }
      }
      const inspect = input.cabin?.kind === 'wake' ? 0 : THREE.MathUtils.smoothstep(t, 6.8, 7.8) * (1 - THREE.MathUtils.smoothstep(t, 8.7, 9.3));
      bone('shoulder_R').rotation.x -= inspect * .72; bone('elbow_R').rotation.x -= inspect * 1.05;
      bone('head').rotation.y += inspect * .28;
    }
    if (input.cabin?.role === 'morpheus' && input.cabin.kind === 'wake') {
      const explain = THREE.MathUtils.smoothstep(input.cabin.elapsed, 5, 6) * (1 - THREE.MathUtils.smoothstep(input.cabin.elapsed, 8.5, 9.5));
      bone('elbow_L').rotation.x -= .75 * explain; bone('shoulder_L').rotation.x -= .35 * explain;
      bone('head').rotation.x += .1 * explain;
    }
    if (input.cabin?.role === 'morpheus' && input.cabin.kind === 'core') {
      const reach = THREE.MathUtils.smoothstep(input.cabin.elapsed, 2, 3) * (1 - THREE.MathUtils.smoothstep(input.cabin.elapsed, 5.8, 6.8));
      bone('spine').rotation.x += .29 * reach; bone('chest').rotation.x += .34 * reach; bone('head').rotation.x -= .32 * reach;
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
    if (input.wakeCall?.phase === 'leaving') {
      const t = input.wakeCall.elapsed;
      const reach = THREE.MathUtils.smoothstep(t, .12, .58) * (1 - THREE.MathUtils.smoothstep(t, 1.08, 1.48));
      const glance = THREE.MathUtils.smoothstep(t, .45, 1.15) * (1 - THREE.MathUtils.smoothstep(t, 2.6, 3.5));
      bone('spine').rotation.x += reach * .06; bone('chest').rotation.y -= reach * .11;
      bone('head').rotation.y -= glance * .16;
      bone('shoulder_R').rotation.x -= reach * .72; bone('shoulder_R').rotation.z -= reach * .24;
      bone('elbow_R').rotation.x -= reach * .88; bone('wrist_R').rotation.z += reach * .24;
    }
    if (input.reveal) {
      const { kind, elapsed: t, role } = input.reveal;
      if (kind === 'construct') {
        const explain = THREE.MathUtils.smoothstep(t, 2, 3.2) * (1 - THREE.MathUtils.smoothstep(t, 8.2, 9.5));
        const shock = THREE.MathUtils.smoothstep(t, 8.8, 10.4);
        if (role === 'morpheus') {
          bone('head').rotation.y += explain * .16;
        } else {
          bone('head').rotation.y -= .18 * explain; bone('spine').rotation.x += .14 * shock; bone('chest').rotation.x += .2 * shock;
          bone('shoulder_L').rotation.x -= .2 * shock; bone('shoulder_R').rotation.x -= .2 * shock;
        }
      } else {
        const point = THREE.MathUtils.smoothstep(t, 1.3, 2.8) * (1 - THREE.MathUtils.smoothstep(t, 9.5, 11.2));
        const collapse = THREE.MathUtils.smoothstep(t, 10.2, 12.8);
        if (role === 'morpheus') {
          bone('pelvis').position.z += .15;
          bone('head').rotation.y += point * .13;
        } else {
          bone('head').rotation.y -= point * .18; bone('spine').rotation.x += collapse * .34; bone('chest').rotation.x += collapse * .42;
          for (const side of ['R', 'L']) bone('shoulder_' + side).rotation.x -= collapse * .42;
        }
      }
    }
    if (input.construct?.role === 'neo' && input.construct.phase === 'image') {
      const t = input.construct.elapsed, inspect = THREE.MathUtils.smoothstep(t, .3, 1) * (1 - THREE.MathUtils.smoothstep(t, 5, 6));
      const forearm = THREE.MathUtils.smoothstep(t, .3, 1) * (1 - THREE.MathUtils.smoothstep(t, 2.1, 2.8));
      const neck = THREE.MathUtils.smoothstep(t, 2.4, 3.6) * (1 - THREE.MathUtils.smoothstep(t, 5, 6));
      bone('shoulder_L').rotation.x -= .65 * forearm; bone('elbow_L').rotation.x -= .65 * forearm;
      bone('head').rotation.x += .25 * inspect * (1 - THREE.MathUtils.smoothstep(t, 2.5, 3.5)) + .18 * neck;
    }
    if (input.reveal?.kind === 'construct' && input.reveal.role === 'neo') {
      const t = input.reveal.elapsed, lean = THREE.MathUtils.smoothstep(t, 0, 1) * (1 - THREE.MathUtils.smoothstep(t, 7, 9));
      bone('spine').rotation.x += .26 * lean;
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
      } else if (kind === 'download' && role === 'tank') {
        bone('spine').rotation.x += .12; bone('chest').rotation.x += .08; bone('head').rotation.x += .2;
      } else if (kind === 'red_dress' && input.training.attention) {
        if (role === 'citizen_2') {
          const training = { ...input.training, started: true }, time = redDressFrame(training);
          const neo = trainingRoot(training, 'neo'), woman = trainingRoot(training, 'citizen_2');
          const glance = THREE.MathUtils.smoothstep(time, 1.4, 2.8) * (1 - THREE.MathUtils.smoothstep(time, 4.4, 5.3));
          const yaw = THREE.MathUtils.clamp(Math.atan2(neo.x - woman.x, neo.z - woman.z) - woman.yaw, -1.05, 1.05) * glance;
          bone('chest').rotation.y += yaw * .18; bone('head').rotation.y += yaw * .82;
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
    if (input.sentinel) {
      const { role, phase, elapsed: t } = input.sentinel;
      const alarm = phase === 'ready' || phase === 'done' ? 0 : phase === 'shutdown' ? THREE.MathUtils.smoothstep(t, .3, 1.5)
        : phase === 'confirming' ? 1 - THREE.MathUtils.smoothstep(t, .9, 3.5) : 1;
      const danger = phase === 'detected' || phase === 'failed';
      if (role === 'tank') {
        bone('spine').rotation.x += .16 * alarm; bone('head').rotation.x -= .12 * alarm;
      } else if (role === 'dozer') {
        bone('spine').rotation.x += .12 * alarm; bone('head').rotation.y -= .18 * alarm;
        bone('shoulder_L').rotation.x -= .82 * alarm; bone('elbow_L').rotation.x -= .66 * alarm;
      } else if (role === 'morpheus') {
        const halt = phase === 'ready' || phase === 'done' ? 0 : phase === 'shutdown' ? THREE.MathUtils.smoothstep(t, 1.4, 2.8)
          : phase === 'confirming' ? 1 - THREE.MathUtils.smoothstep(t, .5, 2.3) : 1;
        bone('shoulder_L').rotation.x -= .78 * halt; bone('shoulder_L').rotation.z += .42 * halt; bone('elbow_L').rotation.x -= 1.12 * halt;
        bone('head').rotation.y -= .14 * halt;
      } else if (role === 'trinity') {
        bone('head').rotation.y += .25 * alarm; bone('spine').rotation.x += .06 * alarm;
        bone('shoulder_R').rotation.x -= .18 * alarm; bone('elbow_R').rotation.x -= .36 * alarm;
      } else {
        const observing = danger ? 1 : phase === 'shutdown' || phase === 'confirming'
          ? Math.sin(Math.PI * THREE.MathUtils.smoothstep(t, 0, SENTINEL_TIMING[phase])) : 0;
        bone('head').rotation.y -= .16 * observing; bone('spine').rotation.x += (danger ? .22 : .07) * observing;
        bone('chest').rotation.x += (danger ? .16 : .04) * observing;
        if (danger) for (const side of ['R', 'L']) { bone('shoulder_' + side).rotation.x -= .42; bone('elbow_' + side).rotation.x -= .7; }
      }
      if (phase === 'sweep' || phase === 'clear') bone('head').rotation.x += Math.sin(t * 1.4 + role.length) * .012;
    }
    if (input.interlude) {
      const { kind, role, phase, elapsed: t } = input.interlude;
      if (kind === 'console') {
        if (role !== 'cypher') {
          bone('head').rotation.y -= phase !== 'ready' ? .2 : 0;
        }
      } else if (kind === 'steak') {
        if (role !== 'cypher') {
          const reply = phase === 'performing' ? THREE.MathUtils.smoothstep(t, 7.4, 8.5) : 0;
          bone('spine').rotation.x += .05; bone('head').rotation.y += .11 - reply * .2;
          for (const side of ['R', 'L']) {
            bone('shoulder_' + side).rotation.x -= .28 + reply * .16;
            bone('elbow_' + side).rotation.x -= .82 + reply * .25;
          }
        }
      } else if (kind === 'meal') {
        const age = crewMealAge(input.interlude);
        if (role === 'mouse') {
          const talking = phase === 'performing' || phase === 'accepting' ? THREE.MathUtils.smoothstep(age, 3.1, 4) * (1 - THREE.MathUtils.smoothstep(age, 9.8, 10.7)) : 0;
          bone('head').rotation.y += Math.sin(age * 1.25) * .12 * talking;
          bone('shoulder_R').rotation.x -= (.38 + Math.sin(age * 2.2) * .18) * talking; bone('elbow_R').rotation.x -= .82 * talking;
          bone('shoulder_L').rotation.x -= (.24 - Math.sin(age * 1.7) * .14) * talking; bone('elbow_L').rotation.x -= .52 * talking;
        } else if (role !== 'neo' && role !== 'tank') {
          const listening = phase === 'performing' || phase === 'accepting' ? THREE.MathUtils.smoothstep(age, 2.2, 3.1) : 0;
          bone('head').rotation.y += Math.sin(age * .8 + role.length) * .08 * listening;
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
    posePodWake(rig, input.podWake, input.podBreather, input.podEmergence, input.podDisconnect, input.podRescue);
    if (input.podRescue !== undefined) {
      const landing = podRescuePose(input.podRescue);
      bone('spine').rotation.x += .3 * landing.settle; bone('chest').rotation.x += .25 * landing.settle;
      bone('head').rotation.x -= .4 * landing.settle;
      for (const side of ['R', 'L']) {
        bone('hip_' + side).rotation.x = THREE.MathUtils.lerp(bone('hip_' + side).rotation.x, -1.35, landing.settle);
        bone('knee_' + side).rotation.x = THREE.MathUtils.lerp(bone('knee_' + side).rotation.x, 2.3, landing.settle);
        bone('ankle_' + side).rotation.x = -.65 * landing.settle;
      }
      placePodBody(rig, landing.lower);
    }
    if (input.truth && !this.truths.has(rig)) this.truths.set(rig, new TruthPerformance(rig));
    this.truths.get(rig)?.pose(input.truth);
    if (input.training?.role === 'neo' && ['jump_fall', 'jump_return'].includes(input.training.kind) && !this.jumps.has(rig)) this.jumps.set(rig, new JumpPerformance(rig, fightingHands));
    this.jumps.get(rig)?.pose(input.training);
    rig.root.updateWorldMatrix(true, true);
    if (input.performance === 'touch') placeTrackingFeet(rig, input.mirrorBeat, input.mirrorEntry);
    if (input.training?.kind !== 'jump_fall' && !input.truckHood && input.epilogue?.kind !== 'neo_carried' && !input.farewell && !(input.truth?.role === 'neo' && input.truth.phase === 'unplug' && (truthSeat(input.truth.elapsed) > 0 || truthKneel(input.truth.elapsed) > 0)) && !(input.training && ['download', 'jump_fall', 'jump_return'].includes(input.training.kind) && input.training.role === 'neo') && input.grounded && !input.meeting && !input.interrogation && !(input.wakeCall?.phase === 'waking' && input.wakeCall.elapsed < 3.2) && !input.riding && input.climbing === undefined && (!input.performance || input.performance === 'connect')) {
      let lowest = Infinity;
      for (const side of ['R', 'L']) {
        this.point.setFromMatrixPosition(bone('ankle_' + side).matrixWorld); rig.root.worldToLocal(this.point);
        lowest = Math.min(lowest, this.point.y - rig.footHeight);
      }
      pelvis.position.y -= lowest;
      // Machine-core deck is .025 above the nominal floor; allow the boot sole's .005 extension.
      if (input.deusPact) pelvis.position.y += .03;
      rig.root.updateWorldMatrix(true, true);
      if (input.dojoOutfit && rig.dojoSoles) {
        const { mesh, indices, matrices } = rig.dojoSoles;
        // Refresh the attached bind transform after movement, then share the
        // same mesh-to-body transform across every sole vertex this frame.
        mesh.updateMatrixWorld(true);
        this.soleTransform.copy(rig.root.matrixWorld).invert().multiply(mesh.matrixWorld).multiply(mesh.bindMatrixInverse);
        // Three's per-vertex skinning recomputes this same matrix for each
        // weighted vertex. Keep its full precision and share it within a frame.
        matrices.forEach((matrix, i) => matrix.multiplyMatrices(mesh.skeleton.bones[i].matrixWorld, mesh.skeleton.boneInverses[i]).multiply(mesh.bindMatrix));
        const { skinIndex, skinWeight } = mesh.geometry.attributes;
        const height = this.soleTransform.elements;
        let lowest = Infinity;
        for (const index of indices) {
          THREE.Mesh.prototype.getVertexPosition.call(mesh, index, this.soleBase);
          this.point.set(0, 0, 0);
          for (let joint = 0; joint < 4; joint++) {
            const weight = skinWeight.getComponent(index, joint);
            if (weight !== 0) this.point.addScaledVector(this.soleVertex.copy(this.soleBase).applyMatrix4(matrices[skinIndex.getComponent(index, joint)]), weight);
          }
          // Bind/body transforms are common to the full sole. After blending,
          // only height is needed; keep every vertex and its exact joint weights.
          const { x, y, z } = this.point;
          const w = 1 / (height[3] * x + height[7] * y + height[11] * z + height[15]);
          lowest = Math.min(lowest, (height[1] * x + height[5] * y + height[9] * z + height[13]) * w);
        }
        pelvis.position.y -= lowest; rig.root.updateWorldMatrix(true, true);
      }
      if (!input.dojoOutfit && !input.realWorld && !input.seated && !input.floorSeated && motion.seated < .01 && !input.performance
        && !input.windingUp && motion.attackAge > 1 && motion.skillAge > 1 && motion.hitAge > .5) placeHotelFeet(rig);
    }
    poseSpoonBody(rig, input.spoonLesson);
    if (input.training?.kind === 'red_dress' && input.training.role === 'morpheus' && input.training.attention && !this.redDressGuides.has(rig))
      this.redDressGuides.set(rig, new RedDressPerformance(rig, fightingHands));
    this.redDressGuides.get(rig)?.update(input.training);
    if (input.phone) {
      this.holdPhone(rig, input.phone);
    }
    poseMorningBody(rig, input.morning);
    if (input.morning?.phase === 'stopping') this.stopAlarm(rig, input.morning.elapsed);
    if (input.window !== undefined) this.openWindow(rig, input.window);
    if (input.crossing !== undefined) this.crossWindow(rig, input.crossing);
    if (input.recoveryCrew) this.supportRecovery(rig, input.recoveryCrew);
    if (input.recovery !== undefined && !this.recoveries.has(rig)) this.recoveries.set(rig, new RecoveryPerformance(rig));
    this.recoveries.get(rig)?.update(input.recovery, input.realWorld, patient, interactionView);
    if (input.medical !== undefined || input.cabin || input.truth || input.download || input.training?.kind === 'download') cabinContact(rig, input, fightingHands);
    this.truths.get(rig)?.contact(input.truth);
    if ((input.construct || input.reveal) && !this.constructs.has(rig)) this.constructs.set(rig, new ConstructPerformance(rig, fightingHands));
    this.constructs.get(rig)?.update(input);
    if (input.mirrorCrew !== undefined && input.mirrorContact) wireTrackingElectrode(rig, input.mirrorCrew, input.mirrorContact);
    if (input.performance === 'touch') poseTrackingHand(rig, input.mirrorBeat ?? 0);
    if (input.farewell) { this.farewellSupport(rig, input.farewell); this.farewellContact(rig, input.farewell); }
    if (input.pills && !this.pills.has(rig)) this.pills.set(rig, new PillPerformance(rig));
    this.pills.get(rig)?.update(input.pills);
    poseConsoleOperator(rig, input.interlude);
    if (input.interlude?.kind === 'console' && input.interlude.role === 'cypher' && input.interlude.physicalPour && !this.consolePours.has(rig)) this.consolePours.set(rig, new ConsolePourPerformance(rig));
    this.consolePours.get(rig)?.update(input.interlude);
    if (input.interlude?.kind === 'console' && (input.interlude.role === 'neo' || input.interlude.role === 'cypher' && input.interlude.physicalPour) && !this.consoleDrinks.has(rig)) this.consoleDrinks.set(rig, new ConsoleDrinkPerformance(rig, input.interlude.role as 'neo' | 'cypher'));
    this.consoleDrinks.get(rig)?.update(input.interlude);
    if (input.interlude?.kind === 'steak' && input.interlude.role === 'cypher' && !this.steaks.has(rig)) this.steaks.set(rig, new SteakPerformance(rig));
    this.steaks.get(rig)?.update(input.interlude);
    this.meals.get(rig)?.update(input.interlude);
    if ((input.interrogation || input.officeShirt) && !this.interrogations.has(rig)) this.interrogations.set(rig, new InterrogationPerformance(rig, fightingHands));
    this.interrogations.get(rig)?.update(input.interrogation, input.officeShirt);
    if (input.meeting && !this.meetings.has(rig)) this.meetings.set(rig, new MeetingPerformance(rig));
    this.meetings.get(rig)?.update(input.meeting);
    if (input.welcome && !this.welcomes.has(rig)) this.welcomes.set(rig, new LafayetteWelcomePerformance(rig));
    this.welcomes.get(rig)?.update(input.welcome);
    if (input.knock !== undefined && !this.knocks.has(rig)) this.knocks.set(rig, new LafayetteKnockPerformance(rig));
    this.knocks.get(rig)?.update(input.knock);
    if (input.workday && !this.workdays.has(rig)) this.workdays.set(rig, new OfficeWorkdayPerformance(rig));
    this.workdays.get(rig)?.update(input.workday);
    if ((input.contact || input.computerCheck) && !this.apartments.has(rig)) this.apartments.set(rig, new ApartmentPerformance(rig));
    this.apartments.get(rig)?.update(input.contact, input.computerCheck);
    if (input.wakeCall && !this.wakeCalls.has(rig)) this.wakeCalls.set(rig, new WakeCallPerformance(rig));
    this.wakeCalls.get(rig)?.update(input.wakeCall);
    fightingHands?.update();
    this.skinContinuity.get(rig)?.forEach(skin => skin.update());
    this.poseFace(rig);
    ambushWardrobe?.poseDrape(input, motion);
    const spoonFloor = input.spoonLesson && spoonLessonSeat(input.spoonLesson) > 0 ? rig.root.getWorldPosition(new THREE.Vector3()).y + .025 : undefined;
    const ambushCenter = FILM_SETS.film_ambush_house.center, origin = rig.root.getWorldPosition(new THREE.Vector3());
    const onStairs = Math.abs(origin.x - ambushCenter.x) <= 9 && origin.z >= ambushCenter.z + 12 && origin.z <= ambushCenter.z + 34
      && origin.y >= ambushCenter.y - 1 - AMBUSH_STAIRS.rise * AMBUSH_STOREYS - .1 && origin.y <= ambushCenter.y - 1 + .1;
    const savedCloth = input.ambushCall || input.ambushEscort || input.helGarage || input.trainmanChase || input.truckHood || input.truckRescue || smithFinaleLocked(input.smithFinale);
    const fittedTails = (ambushWardrobe?.poseTails(input, motion, pose.coat) ?? false)
      || (this.regularCoatTails.get(rig)?.update(motion, pose.coat) ?? false);
    if (delta <= 0 && !fittedTails && !savedCloth && spoonFloor === undefined && !onStairs || !rig.panels.some(panel => panel.mesh.visible)) return;
    const dt = Math.max(0, Math.min(delta, 1 / 30));
    // Analytic wind target plus damped springs; the waist is pinned. Thigh and
    // shin capsules stop the running knees from cutting through the coat.
    const capsules = fittedTails ? [] : ['R', 'L'].flatMap(side => ['hip', 'knee'].map((part, i) => {
      const start = new THREE.Vector3().setFromMatrixPosition(bone(part + '_' + side).matrixWorld);
      const end = new THREE.Vector3().setFromMatrixPosition(bone((i ? 'ankle' : 'knee') + '_' + side).matrixWorld);
      pelvis.worldToLocal(start); pelvis.worldToLocal(end); return { start, end, radius: i ? .16 : .195 };
    }));
    for (const panel of rig.panels) {
      if (!panel.mesh.visible) continue;
      const position = panel.mesh.geometry.attributes.position;
      let changed = false;
      for (let i = 0; i < position.count; i++) {
        if (!fittedTails) {
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
            panel.velocity[offset] = savedCloth ? 0 : panel.velocity[offset] + ((target - value) * 150 - panel.velocity[offset] * 24) * dt;
            position.array[offset] = t < .04 ? panel.rest[offset] : savedCloth ? target : value + panel.velocity[offset] * dt;
            changed ||= position.array[offset] !== value;
          }
        }
        if (spoonFloor !== undefined || onStairs) {
          this.point.fromBufferAttribute(position, i); panel.mesh.localToWorld(this.point);
          const tread = onStairs ? ambushFloor(this.point.x - ambushCenter.x, this.point.z - ambushCenter.z, origin.y - ambushCenter.y + 1) : undefined;
          const floor = spoonFloor ?? (tread === undefined ? undefined : ambushCenter.y - 1 + tread + .025);
          if (floor !== undefined && this.point.y < floor) {
            this.point.y = floor; panel.mesh.worldToLocal(this.point); position.setXYZ(i, this.point.x, this.point.y, this.point.z);
            panel.velocity[i * 3 + 1] = 0; changed = true;
          }
        }
      }
      if (changed) {
        position.needsUpdate = true; panel.mesh.geometry.computeVertexNormals();
        if (fittedTails) {
          panel.mesh.geometry.computeBoundingBox(); panel.mesh.geometry.computeBoundingSphere();
          panel.mesh.geometry.boundingSphere!.radius += 1e-6;
        }
      }
    }
  }

  wetwallHands(rig: HeroRig, gesture: MotionInput['wetwall']): void {
    const hanging = !!gesture?.hanging && !(gesture.role === 'neo' && ['falling', 'failed'].includes(gesture.phase));
    if (hanging) this.fightingHands.get(rig)?.poseWetwall();
    const changed = this.elbowSleeves.get(rig)?.update(hanging) ?? false;
    if (hanging || changed) this.skinContinuity.get(rig)?.forEach(skin => skin.update(changed));
  }

  trainingPistolHands(rig: HeroRig): void { this.fightingHands.get(rig)?.posePistol(); }

  poseFace(rig: HeroRig): void { this.jaws.get(rig)?.update(); this.eyelids.get(rig)?.update(); }

  private release(): void {
    this.pills.forEach(p => p.dispose()); this.pills.clear();
    this.consoleDrinks.forEach(p => p.dispose()); this.consoleDrinks.clear();
    this.consolePours.forEach(p => p.dispose()); this.consolePours.clear();
    this.steaks.forEach(p => p.dispose()); this.steaks.clear();
    this.interrogations.forEach(p => p.dispose()); this.interrogations.clear();
    this.meals.forEach(p => p.dispose()); this.meals.clear();
    this.meetings.forEach(p => p.dispose()); this.meetings.clear();
    this.welcomes.forEach(p => p.dispose()); this.welcomes.clear(); this.knocks.forEach(p => p.dispose()); this.knocks.clear();
    this.recoveries.forEach(p => p.dispose()); this.recoveries.clear();
    this.truths.forEach(p => p.dispose()); this.truths.clear();
    this.jumps.forEach(p => p.dispose()); this.jumps.clear();
    this.redDressGuides.clear();
    this.constructs.forEach(p => p.dispose()); this.constructs.clear();
    this.workdays.forEach(p => p.dispose()); this.workdays.clear();
    this.apartments.forEach(p => p.dispose()); this.apartments.clear();
    this.wakeCalls.forEach(p => p.dispose()); this.wakeCalls.clear();
    this.farewellAppearances.forEach(p => p.dispose()); this.farewellAppearances.clear();
    this.constructSuits.forEach(p => p.dispose()); this.constructSuits.clear();
    this.ambushWardrobes.forEach(p => p.dispose()); this.ambushWardrobes.clear();
    this.regularCoatTails.clear();
    this.mice.forEach(p => p.dispose()); this.mice.clear();
    this.fightingHands.forEach(hands => hands.dispose()); this.fightingHands.clear();
    this.oralLights.forEach(light => light.dispose()); this.oralLights.clear();
    this.jaws.clear();
    this.eyelids.clear();
    this.elbowSleeves.forEach(surface => surface.dispose()); this.elbowSleeves.clear();
    this.skinContinuity.forEach(surfaces => surfaces.forEach(skin => skin.dispose())); this.skinContinuity.clear();
    this.forearms.dispose();
    this.shoulders.dispose();
    this.geometries.forEach(value => value.dispose()); this.materials.forEach(value => value.dispose());
    this.textures.forEach(value => value.dispose()); this.skeletons.forEach(value => value.dispose());
    this.geometries.clear(); this.materials.clear(); this.textures.clear(); this.skeletons.clear();
  }
  dispose(): void { this.disposed = true; this.release(); }
}
