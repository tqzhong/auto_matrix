import { BOOK_DOOR,bookDoorAngle,bookDoorLocked,bookDoorProgress } from '@auto_matrix/shared';
import { SERAPH_DOOR, seraphDoorAngle, seraphDoorLocked, seraphDoorProgress } from '@auto_matrix/shared';
import { logosBaneInjured, logosBaneLocked } from '@auto_matrix/shared';
import { filmEntry, filmSceneForJourney, logosCloudTop, logosFlightSet, newLogosFlight } from '@auto_matrix/shared';
import { upperDiggerActive, upperDiggerLocked } from '@auto_matrix/shared';
import { diggersActive, diggersLocked } from '@auto_matrix/shared';
import { dockGateActive, dockLastStandLocked, dockReloadLocked } from '@auto_matrix/shared';
import { type TrilogyEpilogueEncounter } from '@auto_matrix/shared';
import { crosscutActive, crosscutPhoneRole } from '@auto_matrix/shared';
import { createLoungeChair } from './LoungeChair.js';
import { BasementSetRenderer } from './BasementSetRenderer.js';
import { TvRepairRenderer } from './TvRepairRenderer.js';
import { WellsStreetRenderer } from './WellsStreetRenderer.js';
import { bitmapUploadImage, stageBitmapTexture } from './BitmapTextureRows.js';
import { HardlineHandset } from '../agents/HardlineHandset.js';
import { OPENING_PHONE, WELLS_AFTERMATH, WELLS_BOOTH, WELLS_CURB, WELLS_STREET, WELLS_TRUCK, openingBoothCrush, openingBoothPartPose, streetLamps, wellsAftermathDoor } from '@auto_matrix/shared';
import { basementLocked, tvExitLocked } from '@auto_matrix/shared';
import { SENTINEL_POWER } from '@auto_matrix/shared';
import { steakAge, crewMealAge } from '@auto_matrix/shared';
import { ReloadedOpeningRenderer } from './ReloadedOpeningRenderer.js';
import { ReloadedCatchRenderer } from './ReloadedCatchRenderer.js';
import { ReloadedFinaleRenderer } from './ReloadedFinaleRenderer.js';
import { ZionHomecomingRenderer } from './ZionHomecomingRenderer.js';
import { DockBriefingRenderer } from './DockBriefingRenderer.js';
import { SourceBriefingRenderer } from './SourceBriefingRenderer.js';
import { SourcePortalRenderer } from './SourcePortalRenderer.js';
import { ArchitectRoomRenderer } from './ArchitectRoomRenderer.js';
import { MobilStationRenderer } from './MobilStationRenderer.js';
import { TrainmanChaseRenderer } from './TrainmanChaseRenderer.js';
import { HelGarageRenderer } from './HelGarageRenderer.js';
import { batchStaticGeometry } from './StaticGeometry.js';
import { helElevatorFloor, helElevatorGate } from '@auto_matrix/shared';
import { HEL_COAT_COUNTERS } from '@auto_matrix/shared';
import { helDanceDoorAngle, type HelDanceDoorEncounter } from '@auto_matrix/shared';
import { helGarageLocked } from '@auto_matrix/shared';
import { trainmanChaseLocked } from '@auto_matrix/shared';
import { TrinityTerminalRenderer } from './TrinityTerminalRenderer.js';
import { trinityTerminalLocked } from '@auto_matrix/shared';
import { PrimaryDemolitionRenderer } from './PrimaryDemolitionRenderer.js';
import { DockEvacuationRenderer } from './DockEvacuationRenderer.js';
import { BaneCopyRenderer } from './BaneCopyRenderer.js';
import * as THREE from 'three';
import { workdayLocked, type OfficeWorkday } from '@auto_matrix/shared';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { createMirrorSurface } from './MirrorSurface.js';
import { trackingContact } from '../agents/TrackingContact.js';
import { MIRROR_FRAME, mirrorTime } from '@auto_matrix/shared';
import { ambushApproachTarget, ambushEscapeTarget } from '@auto_matrix/shared';
import { ORACLE_REQUEST, oracleRequestLocked, ORACLE_WAITING_FURNITURE, ORACLE_KITCHEN_CHAIRS, ORACLE_ENTRANCE, ORACLE_ENTRANCE_WALLS, oracleArrivalDoor, oracleArrivalPending, oracleArrivalTarget } from '@auto_matrix/shared';
import { SpoonModel } from '../agents/SpoonModel.js';
import { FILM_SETS, FILM_SCENE_BY_ID, OPENING_ESCAPE, openingTruckPose, HEL_ELEVATOR, HEL_DANCE_DOOR, helElevatorLocked, helDanceDoorLocked, PILL_ROOM, MIRROR_SEAT, MIRROR_FACE, MIRROR_TIMING, mirrorSilver, pillLocked, pillPose, lafayetteWelcomeLocked, interludeLocked, type PillGesture, FREEWAY_FINISH, GARAGE, ORACLE_FURNITURE, SERAPH_ORACLE, BURLY, EXILES, CHATEAU, awakeningLocked, trainingLocked, phoneLocked, windowOpening, windowCrossing, officeRetreat, OFFICE_RETREAT_WINDOW, filmPosition, filmSetAt, filmObstacles, filmStepPosition, type Vector3, type FilmSet, type FilmJourney, type AgentState, type SandboxState, type CombatImpact } from '@auto_matrix/shared';
import { OPENING_HOTEL, openingHotelBreachTime, openingHotelDoorAngle, openingHotelGlassBroken, openingHotelGlassTime, openingHotelHallOfficer, openingHotelHallTime, openingHotelLanded, openingHotelPhoneHeld, openingHotelTraceTime, openingRoofGlassBroken, type OpeningPursuitCast } from '@auto_matrix/shared';
import { OPENING_ROOF_EXIT, OPENING_ROOF_STAIRS, openingRoofStairHeight } from '@auto_matrix/shared';
import { RELOADED } from '@auto_matrix/shared';
import { meetingBoardPoint, meetingRoot } from '@auto_matrix/shared';
import { LOBBY_POINT_SLOTS, LobbySetRenderer } from './LobbySetRenderer.js';
import { OFFICE_POINT_SLOTS, OfficeSetRenderer } from './OfficeSetRenderer.js';
import { LightCulling } from './LightCulling.js';
import { cacheReadyProgramLocations, shadowCasterProxies } from './PrepareShaderProgram.js';
import { prepareMeshBuffers } from './PrepareMeshBuffers.js';
import { prepareSkinnedMaterial } from '../agents/SkinnedPrecision.js';
import { FreewaySetRenderer } from './FreewaySetRenderer.js';
import { newFreewayPickup } from '@auto_matrix/shared';
import type { TruckEncounter } from '@auto_matrix/shared';
import { PodSetRenderer } from './PodSetRenderer.js';
import { NebDeckRenderer } from './NebDeckRenderer.js';
import { ConstructRenderer } from './ConstructRenderer.js';
import { DesertRenderer } from './DesertRenderer.js';
import { TrainingSetRenderer } from './TrainingSetRenderer.js';
import { OracleVase } from './OracleVase.js';
import { BaneInquiryRenderer } from './BaneInquiryRenderer.js';
import { HammerBriefingRenderer } from './HammerBriefingRenderer.js';
import { MaggieDiscoveryRenderer } from './MaggieDiscoveryRenderer.js';
import { ZionDeploymentRenderer } from './ZionDeploymentRenderer.js';
import { zionDeploymentLocked } from '@auto_matrix/shared';
import { baneInquiryLocked } from '@auto_matrix/shared';
import { hammerBriefingLocked } from '@auto_matrix/shared';
import { OracleLastRenderer } from './OracleLastRenderer.js';
import { OracleAbsorptionRenderer } from './OracleAbsorptionRenderer.js';
import { ORACLE_LAST, oracleLastLocked } from '@auto_matrix/shared';
import { AmbushSetRenderer } from './AmbushSetRenderer.js';
import { createPillGlass } from '../agents/PillPerformance.js';
import { InterrogationSetRenderer } from './InterrogationSetRenderer.js';
import { interrogationLocked } from '@auto_matrix/shared';
import { MEETING_DESTINATION, meetingLocked, type MeetingGesture } from '@auto_matrix/shared';
import { MeetingSetRenderer } from './MeetingSetRenderer.js';
import { LafayetteApproachRenderer } from './LafayetteApproachRenderer.js';
import { LAFAYETTE, HOTEL_WALLS } from '@auto_matrix/shared';
import { apartmentLocked } from '@auto_matrix/shared';
import { clubLocked } from '@auto_matrix/shared';
import { ClubSetRenderer } from './ClubSetRenderer.js';
import { HelClubPerformers } from './HelClubPerformers.js';
import { createHelPistol } from '../agents/HelPistolModel.js';
import { HEL_TERRACE, HEL_DISARM, HEL_BREAKOUT, HEL_TRIO, helDisarmGun, helBreakoutGun, type HelDisarm, type HelBreakoutGesture } from '@auto_matrix/shared';
import { SentinelSetRenderer } from './SentinelSetRenderer.js';
import { CypherRestaurantRenderer } from './CypherRestaurantRenderer.js';
import { betrayalLocked, rescueLocked } from '@auto_matrix/shared';
import { governmentLocked, airRescueLocked } from '@auto_matrix/shared';
import { GovernmentSetRenderer } from './GovernmentSetRenderer.js';
import { SUBWAY_POINT_SLOTS, MatrixEscapeRenderer } from './MatrixEscapeRenderer.js';
import { TheOneRenderer } from './TheOneRenderer.js';
import { MountainSetRenderer } from './MountainSetRenderer.js';
import { MOUNTAIN, garageCarPose, type GarageCarPose } from '@auto_matrix/shared';
import { chateauStairTread, chateauStairWaypoint } from '@auto_matrix/shared';
import { LogosBaneRenderer } from './LogosBaneRenderer.js';
import { RevolutionsPreludeRenderer } from './RevolutionsPreludeRenderer.js';
import { DockEmpRenderer } from './DockEmpRenderer.js';
import { HammerRouteRenderer } from './HammerRouteRenderer.js';
import { LogosFlightRenderer } from './LogosFlightRenderer.js';
import { LogosWreckRenderer } from './LogosWreckRenderer.js';
import { MachineCoreRenderer } from './MachineCoreRenderer.js';
import { deusPactLocked, type DeusPactEncounter } from '@auto_matrix/shared';
import { SmithFinaleRenderer } from './SmithFinaleRenderer.js';
import { smithFinaleLocked, type SmithFinaleEncounter } from '@auto_matrix/shared';
import { trilogyEpilogueLocked } from '@auto_matrix/shared';
import { TrilogyEpilogueRenderer } from './TrilogyEpilogueRenderer.js';

const outdoor = new Set(['rooftop', 'plaza', 'bridge', 'street', 'courtyard', 'freeway', 'machine', 'rain', 'garden', 'desert', 'pods', 'mountain']);
const AMBUSH_POINT_SLOTS = 17;

export function showMirrorSubject(mirror: Reflector, subject: () => THREE.Object3D | undefined, attachments: () => THREE.Object3D[] = () => []): () => void {
  const renderReflection = mirror.onBeforeRender.bind(mirror);
  let reflectedCamera: THREE.Camera | undefined;
  mirror.onBeforeRender = (...args) => {
    // Glass transmission renders the opaque room before the color pass. Both
    // use the same view, so its live reflection only needs to be drawn once.
    if (args[1].overrideMaterial || args[2] === reflectedCamera) return;
    const body = subject(); const wasVisible = body?.visible;
    const props = attachments().map(object => ({ object, visible: object.visible }));
    // Revealing a first-person body also refreshes its conservative skin bounds.
    if (body) { body.visible = true; if (!wasVisible) body.updateMatrixWorld(true); }
    for (const prop of props) { prop.object.visible = true; if (!prop.visible) prop.object.updateMatrixWorld(true); }
    try { renderReflection(...args); reflectedCamera = args[2]; }
    finally { if (body) body.visible = wasVisible!; for (const prop of props) prop.object.visible = prop.visible; }
  };
  return () => { reflectedCamera = undefined; };
}

export function mirrorSurfacePoint(mirror: THREE.Object3D, subject: THREE.Object3D): THREE.Vector2 | undefined {
  const finger = subject.getObjectByName('finger2-3_R');
  if (!finger) return;
  const point = mirror.worldToLocal(finger.getWorldPosition(new THREE.Vector3()));
  return new THREE.Vector2(point.x, point.y);
}

const palettes = {
  day: { sky: 0xb8c9cd, fog: .001, ambient: 1.25, sun: 2.3, color: 0xffedcf },
  night: { sky: 0x121b21, fog: .009, ambient: .55, sun: .35, color: 0xaabdc3 },
  warm: { sky: 0x191512, fog: .003, ambient: 1.05, sun: .9, color: 0xffca8f },
  cold: { sky: 0x131e25, fog: .006, ambient: .95, sun: .85, color: 0xb3d8e0 },
  white: { sky: 0xe4e6e0, fog: .003, ambient: 1.7, sun: 1.1, color: 0xffffff },
  storm: { sky: 0x0d181d, fog: .009, ambient: .48, sun: .55, color: 0xa5c6cd },
  sunrise: { sky: 0xb8d1dc, fog: .0015, ambient: 1.3, sun: 2.6, color: 0xffdba0 },
};

type LafayetteRoomLights = { shell: THREE.Group; fixtures: THREE.Group };
type ColorMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial | THREE.MeshBasicMaterial>;
type ColorSubject = THREE.Mesh | THREE.Sprite | THREE.Line;
type ColorProgram = NonNullable<THREE.WebGLRenderer['info']['programs']>[number] & { isReady(): boolean };
type LafayettePreparation = {
  lights: LafayetteRoomLights;
  actor?: THREE.Group;
  meshes: ColorMesh[];
  programs: ColorProgram[];
  room?: FilmSetRenderer;
  roomSteps?: Generator<void>;
  skin?: { texture: THREE.Texture; version: number; gpu: THREE.WebGLRenderer['properties'] };
};
type ColorPreparation = {
  scene: THREE.Scene;
  meshes: ColorSubject[];
  programs: ColorProgram[];
  readyProgram?: ColorProgram;
  textures: Set<THREE.Texture>;
};
type CastColorPreparation = ColorPreparation & { actors: Set<THREE.Group> };
const DOWNLOAD_WALK_CAST = {
  morpheus: ['Anatomical_head_and_hands', 'Tailored_trousers', 'shoes01', 'high-poly', 'morpheus-hammer-sweater', 'morpheus-hammer-collar'],
  apoc: ['Close-cut_scalp_undercoat', 'Swept_individual_hair_strands'],
  trinity: ['Anatomical_head_and_hands', 'short04'],
  mouse: ['Anatomical_head_and_hands'],
};
const CLUB_POINT_SLOTS = 5;
type ClubPreparation = {
  root: THREE.Group;
  renderer: ClubSetRenderer;
  gpu?: THREE.WebGLRenderer['properties'];
  colors?: CastColorPreparation;
  lighting?: LightCulling;
  textureUpload?: Generator<void, boolean>;
  crowdQueued?: boolean;
};
const OPENING_VISITS = ['m1_room303', 'm1_roofs', 'm1_phone_escape'] as const;
type OpeningVisitScene = typeof OPENING_VISITS[number];
export function openingVisitScene(scene: string): scene is OpeningVisitScene {
  return OPENING_VISITS.some(id => id === scene);
}
type OpeningVisitPreparation = {
  scene: OpeningVisitScene;
  actor: string;
  room: FilmSetRenderer;
  steps?: Generator<void>;
  release?: ReturnType<typeof setTimeout>;
};
type OpeningPreparation = {
  scene: 'm1_roofs' | 'm1_phone_escape';
  room: FilmSetRenderer;
  steps?: Generator<void>;
  textureUpload?: Generator<void, boolean>;
  colors?: CastColorPreparation;
  lighting?: LightCulling;
  gpu?: THREE.WebGLRenderer['properties'];
  eye: THREE.Camera;
  roofFirstColors?: ColorSubject[];
  roofMapsReady?: boolean;
  roofEntryTexturesReady?: boolean;
  roofShadows?: {
    materials: Set<THREE.MeshDepthMaterial>;
    layouts: { lighting: LightCulling; eye: THREE.Camera; meshes: THREE.Mesh[] }[];
  };
};
const OFFICE_STREET_COLOR_MESHES = ['Red_dress_satin', 'Red_dress_hair', 'Red_dress_eyes'] as const;
const OFFICE_DESCENT_ACTORS = [
  ['citizen_2', OFFICE_STREET_COLOR_MESHES],
  ['agent_jackson', ['smith-glasses-lens--1', 'short04']],
  ['citizen_4', ['office-uniform-cap', 'Anatomical_head_and_hands']],
] as const;
const ZION_CUTS: Partial<Record<string, { scene: string; step: number }>> = {
  m2_meeting: { scene: 'm2_dock', step: 4 },
  m2_dock: { scene: 'm2_lock', step: 2 },
  m2_lock: { scene: 'm2_residents', step: 1 },
  m2_residents: { scene: 'm2_temple', step: 3 },
  m2_temple: { scene: 'm2_room', step: 2 },
  m2_bane_copy: { scene: 'm2_hamann', step: 2 },
  m2_hamann: { scene: 'm2_oracle_message', step: 2 },
  m2_oracle_message: { scene: 'm2_departure', step: 1 },
};
const SECOND_ORACLE_CUTS: Partial<Record<string, { scene: string; step: number }>> = {
  m1_meal: { scene: 'm1_spoon', step: 0 },
  m2_departure: { scene: 'm2_seraph', step: 4 },
  m2_seraph: { scene: 'm2_backdoors', step: 1 },
  m2_backdoors: { scene: 'm2_bench', step: 1 },
  m2_burly: { scene: 'm2_merovingian', step: 1 },
  m2_persephone: { scene: 'm2_library', step: 3 },
  m2_library: { scene: 'm2_chateau', step: 4 },
  m2_mountain: { scene: 'm2_garage', step: 2 },
  m2_backup: { scene: 'm2_key_door', step: 1 },
  m2_key_door: { scene: 'm2_architect', step: 4 },
  m2_architect: { scene: 'm2_catch', step: 3 },
  m3_trainman: { scene: 'm3_oracle_request', step: 3 },
  m3_oracle_request: { scene: 'm3_trainman_chase', step: 3 },
  m3_zion_prepare: { scene: 'm3_maggie_discovery', step: 3 },
};
const LAFAYETTE_SECOND_FLOOR_Y = 1 + LAFAYETTE.rise;
const LAFAYETTE_THIRD_FLOOR_Y = 1 + 2 * LAFAYETTE.rise;
const LAFAYETTE_STREET_POINT_SLOTS = 16;

/** Only the current film set is resident; static meshes are merged by material.
 * Texture/geometry ownership is scoped to a set and released on every transition. */
export class FilmSetRenderer {
  readonly root = new THREE.Group();
  private current?: FilmSet;
  private preparedAmbush?: { renderer: AmbushSetRenderer; colors?: CastColorPreparation; gpu?: THREE.WebGLRenderer['properties']; lighting?: LightCulling };
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private roofSurfaceSources?: ReadonlyMap<string, THREE.MeshStandardMaterial>;
  private materialCache = new Map<string, THREE.MeshStandardMaterial>();
  private marker: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private markerLight: THREE.PointLight;
  private moving: { object: THREE.Object3D; update: (time: number) => void }[] = [];
  private metal!: THREE.MeshStandardMaterial;
  private brass!: THREE.MeshStandardMaterial;
  private black!: THREE.MeshStandardMaterial;
  private plaster!: THREE.MeshStandardMaterial;
  private wood!: THREE.MeshStandardMaterial;
  private marble!: THREE.MeshStandardMaterial;
  private leather!: THREE.MeshStandardMaterial;
  private glass!: THREE.MeshPhysicalMaterial;
  private white!: THREE.MeshStandardMaterial;
  private glow!: THREE.MeshBasicMaterial;
  private lobby?: LobbySetRenderer;
  private preparedLobby?: { root: THREE.Group; renderer: LobbySetRenderer; colors?: CastColorPreparation; gpu?: THREE.WebGLRenderer['properties']; lighting?: LightCulling };
  private office?: OfficeSetRenderer;
  private preparedOffice?: {
    renderer: OfficeSetRenderer; ready: boolean; programs: ColorProgram[];
    actor?: THREE.Group; city?: THREE.Group; cleaners?: THREE.Group;
    manager?: { root: THREE.Group; gpu: THREE.WebGLRenderer['properties'] };
  };
  private preparedOfficeCanopy?: { city: THREE.Group; gpu: THREE.WebGLRenderer['properties']; program?: ColorProgram };
  private preparedOfficeStreetPhone?: { phone: THREE.Mesh; gpu: THREE.WebGLRenderer['properties']; program?: ColorProgram };
  private preparedOfficeStreet?: {
    actor?: THREE.Group; driver?: THREE.Group; gpu: THREE.WebGLRenderer['properties'];
    meshes: ColorMesh[]; programs: ColorProgram[]; warmed: Set<ColorProgram>;
  };
  private preparedOfficePhone?: { smith: THREE.Group; gpu: THREE.WebGLRenderer['properties']; depth: THREE.MeshDepthMaterial; programs: ColorProgram[] };
  private preparedOfficeConnection?: ColorPreparation & { gpu: THREE.WebGLRenderer['properties']; courier: THREE.Group; smith: THREE.Group };
  private preparedOfficeWindow?: ColorPreparation & { gpu: THREE.WebGLRenderer['properties']; courier: THREE.Group; patrol: THREE.Group };
  private preparedOfficeDescent?: CastColorPreparation & { gpu: THREE.WebGLRenderer['properties']; city: THREE.Group };
  private officeTowerDepth?: THREE.MeshDepthMaterial;
  private officeStreetDepth?: THREE.MeshDepthMaterial;
  private preparedLafayette?: LafayettePreparation;
  private preparedSecondOracle?: {
    scene: string; room: FilmSetRenderer; steps?: Generator<void>; colors?: CastColorPreparation;
    gpu?: THREE.WebGLRenderer['properties']; lighting?: LightCulling; textureUpload?: Generator<void, boolean>;
  };
  private courtyardCastColors?: CastColorPreparation;
  private preparedLafayetteGround?: { meshes: ColorMesh[]; programs: ColorProgram[] };
  private preparedLafayetteLanding?: { meshes: ColorMesh[]; programs: ColorProgram[] };
  private preparedLafayetteUpper?: ColorPreparation & {
    gpu: THREE.WebGLRenderer['properties']; neo: THREE.Group; trinity: THREE.Group; sceneId: FilmJourney['scene'];
    crew: readonly (THREE.Group | undefined)[]; eightMeshes?: ColorMesh[]; fourMeshes?: ColorMesh[];
  };
  private club?: ClubSetRenderer;
  private preparedClub?: ClubPreparation;
  private freeway?: FreewaySetRenderer;
  private preparedFreeway?: { renderer: FreewaySetRenderer; colors?: CastColorPreparation };
  private pods?: PodSetRenderer;
  private preparedPods?: PodSetRenderer;
  private neb?: NebDeckRenderer;
  private preparedTruthReturn?: { scene: 'm1_truth_return' | 'm1_jump_return'; root: THREE.Group; deck: NebDeckRenderer; gpu?: THREE.WebGLRenderer['properties']; colors?: CastColorPreparation; lighting?: LightCulling };
  private preparedDownloadWalk?: CastColorPreparation & { gpu: THREE.WebGLRenderer['properties']; textureUpload?: Generator<void, boolean> };
  private sourceBriefing?: SourceBriefingRenderer;
  private primaryDemolition?: PrimaryDemolitionRenderer;
  private trinityTerminal?: TrinityTerminalRenderer;
  private construct?: ConstructRenderer;
  private desert?: DesertRenderer;
  private mountain?: MountainSetRenderer;
  private preparedMountain?: { root: THREE.Group; renderer: MountainSetRenderer; colors?: CastColorPreparation };
  private training?: TrainingSetRenderer;
  private preparedDojo?: { root: THREE.Group; renderer: TrainingSetRenderer; gpu?: THREE.WebGLRenderer['properties']; colors?: CastColorPreparation; lighting?: LightCulling };
  private preparedJump?: { root: THREE.Group; renderer: TrainingSetRenderer; gpu?: THREE.WebGLRenderer['properties']; colors?: CastColorPreparation; lighting?: LightCulling };
  private preparedRedDress?: {
    root: THREE.Group; renderer: TrainingSetRenderer; assetsReady: boolean; gpu?: THREE.WebGLRenderer['properties'];
    colors?: CastColorPreparation; lighting?: LightCulling; textureUpload?: Generator<void, boolean>;
  };
  private preparedSentinel?: { root: THREE.Group; renderer: SentinelSetRenderer; gpu?: THREE.WebGLRenderer['properties']; colors?: CastColorPreparation; lighting?: LightCulling };
  private preparedConsole?: { root: THREE.Group; deck: NebDeckRenderer; gpu?: THREE.WebGLRenderer['properties']; colors?: CastColorPreparation; lighting?: LightCulling };
  private preparedRestaurant?: {
    root: THREE.Group; renderer: CypherRestaurantRenderer; gpu?: THREE.WebGLRenderer['properties'];
    colors?: CastColorPreparation; lighting?: LightCulling; textureUpload?: Generator<void, boolean>;
  };
  private preparedMeal?: { root: THREE.Group; deck: NebDeckRenderer; gpu?: THREE.WebGLRenderer['properties']; colors?: CastColorPreparation; lighting?: LightCulling };
  private currentScene?: string;
  private dockApuApproach = false;
  private mirror?: Reflector;
  private resetMirrorFrame?: () => void;
  private mirrorSubject?: THREE.Object3D;
  private mirrorFilament?: THREE.Mesh;
  private recoverySubject?: THREE.Object3D;
  private crosscutBodies?: (id: string) => THREE.Object3D | undefined;
  private phoneBodies?: (id: string) => THREE.Object3D | undefined;
  private trackingElectrode?: THREE.Group;
  private trackingLead?: THREE.Line;
  private oracleVase?: OracleVase;
  private baneInquiry?: BaneInquiryRenderer;
  private hammerBriefing?: HammerBriefingRenderer;
  private zionDeployment?: ZionDeploymentRenderer;
  private maggieDiscovery?: MaggieDiscoveryRenderer;
  private oracleLast?: OracleLastRenderer;
  private oracleAbsorption?: OracleAbsorptionRenderer;
  private oracleBlocks?: THREE.Group;
  private oracleDoor?: THREE.Group;
  private ambush?: AmbushSetRenderer;
  private basement?: BasementSetRenderer;
  private basementFrame?: number;
  private basementColors?: CastColorPreparation & { gpu: THREE.WebGLRenderer['properties'] };
  private tvRepair?: TvRepairRenderer;
  private preparedTvExit?: { renderer: TvRepairRenderer; colors?: CastColorPreparation; gpu?: THREE.WebGLRenderer['properties']; lighting?: LightCulling };
  private crosscutTv?: TvRepairRenderer;
  private crosscutDeck?: { root: THREE.Group; renderer: NebDeckRenderer };
  private pillGlass?: THREE.Group;
  private interrogation?: InterrogationSetRenderer;
  private preparedInterrogation?: { renderer: InterrogationSetRenderer; colors?: CastColorPreparation; gpu?: THREE.WebGLRenderer['properties']; lighting?: LightCulling };
  private meeting?: MeetingSetRenderer;
  private hotel?: LafayetteApproachRenderer;
  private approach?: { root: THREE.Group; renderer: MeetingSetRenderer };
  private sentinel?: SentinelSetRenderer;
  private restaurant?: CypherRestaurantRenderer;
  private government?: GovernmentSetRenderer;
  private preparedGovernment?: { scene: 'm1_smith_question' | 'm1_bullet_dodge' | 'm1_helicopter' | 'm1_rooftop_rescue'; root: THREE.Group; renderer: GovernmentSetRenderer;
    colors?: CastColorPreparation; gpu?: THREE.WebGLRenderer['properties']; lighting?: LightCulling; textureUpload?: Generator<void, boolean> };
  private matrixEscape?: MatrixEscapeRenderer;
  private preparedMatrixEscape?: { root: THREE.Group; renderer: MatrixEscapeRenderer | TheOneRenderer; colors?: CastColorPreparation; gpu?: THREE.WebGLRenderer['properties']; lighting?: LightCulling; textureUpload?: Generator<void, boolean> };
  private preparedOneDeck?: { root: THREE.Group; deck: NebDeckRenderer; overlay: TheOneRenderer; colors?: CastColorPreparation };
  private theOne?: TheOneRenderer;
  private reloaded?: ReloadedOpeningRenderer;
  private preparedMeetingHall?: { renderer: ReloadedOpeningRenderer; colors?: CastColorPreparation };
  private preparedMeetingAgents?: CastColorPreparation;
  private catchSet?: ReloadedCatchRenderer;
  private finale?: ReloadedFinaleRenderer;
  private zion?: ZionHomecomingRenderer;
  private preparedZion?: { scene: string; renderer: ZionHomecomingRenderer; colors?: CastColorPreparation & { seen: Set<ColorMesh> } };
  private baneCopy?: BaneCopyRenderer;
  private preparedBaneCopy?: { renderer: BaneCopyRenderer; colors?: CastColorPreparation };
  private logosBane?: LogosBaneRenderer;
  private logosBanePhase?: string;
  private logosBaneBlind = false;
  private revolutionsPrelude?: RevolutionsPreludeRenderer;
  private dockBriefing?: DockBriefingRenderer;
  private dockEvacuation?: DockEvacuationRenderer;
  private empDock?: DockEmpRenderer;
  private hammerMonitors?: { face: THREE.MeshStandardMaterial; glyphs: THREE.MeshBasicMaterial };
  private hammerRoute?: HammerRouteRenderer;
  private logosFlight?: LogosFlightRenderer;
  private logosAltitude = 22;
  private logosTop = 62;
  private logosWreck?: LogosWreckRenderer;
  private machineCore?: MachineCoreRenderer;
  private smithFinale?: SmithFinaleRenderer;
  private trilogyEpilogue?: TrilogyEpilogueRenderer;
  private portalDoor?: { scene: 'm2_seraph' | 'm2_backdoors'; panel: THREE.Group };
  private oracleLetter?: THREE.Group;
  private courtyardStaff?: THREE.Group;
  private courtyardBirds: THREE.Group[] = [];
  private courtyardDisturbedAt?: number;
  private exileDessert?: THREE.Group;
  private bookDoor?: THREE.Group;
  private chateauVolley?: THREE.Group;
  private chateauDoor?: THREE.Mesh;
  private garageCar?: THREE.Group;
  private garageGhosts: THREE.Group[] = [];
  private mobil?: MobilStationRenderer;
  private preparedOpening?: OpeningPreparation;
  private preparedOpeningVisit?: OpeningVisitPreparation;
  private preparedRoofRetry?: CastColorPreparation & {
    gpu: THREE.WebGLRenderer['properties']; surfacesReady: boolean; textureUpload?: Generator<void, boolean>; normalMeshes?: THREE.Mesh[];
  };
  private preparedHotelPolice?: CastColorPreparation & {
    gpu: THREE.WebGLRenderer['properties']; beam?: THREE.Mesh; cord?: THREE.Line; normalMeshes?: THREE.Mesh[];
    shadowMeshes: THREE.Mesh[]; shadowMaterials: Set<THREE.MeshDepthMaterial>;
    buffers: ColorMesh[]; bufferGeometries: WeakSet<THREE.BufferGeometry>; bufferUpload?: Generator<void>;
  };
  private wellsStreet?: WellsStreetRenderer;
  private openingBooth?: THREE.Group;
  private openingReceiver?: HardlineHandset;
  private openingCord?: THREE.Line;
  private openingGlass?: THREE.Group;
  private openingBoothParts: { root: THREE.Group; kind: 'post' | 'phone' | 'roof'; x: number; z: number }[] = [];
  private openingBoothPanes: THREE.Mesh[] = [];
  private openingGlassPieces: { mesh: THREE.Mesh; origin: THREE.Vector3; side: number }[] = [];
  private hotel303Door?: THREE.Group;
  private hotel303Glass?: THREE.Group;
  private hotel303Shards?: THREE.Group;
  private hotel303Pistol?: THREE.Group;
  private hotel303DeskLight?: THREE.PointLight;
  private hotel303HallLight?: THREE.PointLight;
  private hotel303Beam?: THREE.Mesh;
  private hotel303Receiver?: HardlineHandset;
  private hotel303Cord?: THREE.Line;
  private openingRoofGlass?: THREE.Group;
  private openingRoofShards?: THREE.Group;
  private trainmanChase?: TrainmanChaseRenderer;
  private helGarage?: HelGarageRenderer;
  private helLift?: { cage: THREE.Group; doors: [THREE.Group, THREE.Group]; bands: { mesh: THREE.Mesh; y: number }[]; light: THREE.PointLight };
  private helDanceDoor?: [THREE.Group, THREE.Group];
  private helCoatDamage?: THREE.Group[];
  private helPerformers?: HelClubPerformers;
  private helStandoff?: { crowd: THREE.Group[]; guard: THREE.Group; floorGuns: THREE.Group; flyingGun: THREE.Group; light: THREE.PointLight };
  private powerStatus?: { primary: THREE.MeshBasicMaterial; emergency: THREE.MeshBasicMaterial; lights: THREE.PointLight[] };
  private sourceDoor?: SourcePortalRenderer;
  private architectRoom?: ArchitectRoomRenderer;
  private architectState?: AgentState;

  constructor(private scene: THREE.Scene) {
    scene.add(this.root);
    this.marker = new THREE.Mesh(new THREE.TorusGeometry(1.2, .035, 8, 48), new THREE.MeshBasicMaterial({ color: 0xeac987, transparent: true, opacity: .8, depthWrite: false }));
    this.marker.rotation.x = -Math.PI / 2; this.marker.visible = false; scene.add(this.marker);
    this.markerLight = new THREE.PointLight(0xf6d99c, 0, 5); scene.add(this.markerLight);
  }
  get active(): FilmSet | undefined { return this.current; }
  get goalMarker(): THREE.Mesh { return this.marker; }
  get openingHotelNormalMeshes(): readonly THREE.Mesh[] | undefined {
    const prepared = this.preparedHotelPolice;
    if (prepared && !prepared.meshes.length && !prepared.shadowMeshes.length && !prepared.programs.length && !prepared.readyProgram) return prepared.normalMeshes;
  }
  get openingRoofRetryNormalMeshes(): readonly THREE.Mesh[] | undefined { return this.preparedRoofRetry?.normalMeshes; }
  get lafayetteStreetHidden(): boolean { return this.approach?.root.visible === false; }
  get minimumPointSlots(): number {
    // Keep the prepared layout while the shaft and sixth-floor lamps are revealed.
    if (this.ambush) return AMBUSH_POINT_SLOTS;
    if (this.club) return CLUB_POINT_SLOTS;
    if (this.currentScene === 'm1_pills' && this.approach?.root.visible) return LAFAYETTE_STREET_POINT_SLOTS;
    // Seven fixtures, the objective and the player plus four police muzzle flashes.
    if (this.current?.id === 'film_heart_hotel' && this.currentScene === 'm1_room303') return 13;
    // The three rooftop floods keep their program when the objective goes dark.
    if (this.current?.id === 'film_hotel_roofs' && this.currentScene === 'm1_roofs') return 4;
    // The screen, three loadouts and objective share one layout throughout the reveal.
    if (this.current?.id === 'film_white_construct' && this.currentScene === 'm1_guns') return 5;
    if (this.current?.id === 'film_kungfu_dojo' && this.currentScene === 'm1_dojo') return 1;
    if (this.current?.id === 'film_jump_roofs' && this.currentScene === 'm1_jump') return 2;
    if (this.current?.id === 'film_red_dress_plaza' && this.currentScene === 'm1_red_dress') return 1;
    // Five dream fixtures, the objective and one real muzzle flash share one layout.
    if (this.current?.id === 'film_trinity_roof' && this.currentScene === 'm2_dream') return 7;
    if (this.current?.id === 'film_neb_deck' && this.currentScene === 'm1_jump_return') return 16;
    // Keep the console lamp and objective slots when turning toward Cypher.
    if (this.current?.id === 'film_neb_deck' && this.currentScene === 'm1_cypher_console') return 17;
    // The training jack and objective can overlap the fifteen deck fixtures.
    return this.current?.id === 'film_neb_deck' && (this.currentScene === 'm1_truth_return' || this.currentScene === 'm1_download') ? 17 : 0;
  }
  get stablePointSlots(): boolean {
    const id = this.current?.id;
    return id === 'film_wells_phone' || id === 'film_power_plant_pods' || id === 'film_adams_bridge' || id === 'film_extraction_car' || Boolean(this.club || this.sentinel || this.restaurant || this.lobby || this.mobil || this.desert)
      || Boolean(this.basement || this.tvRepair || this.architectRoom || this.catchSet || this.trainmanChase)
      || id === 'film_neb_deck' && this.currentScene === 'm1_meal'
      || id === 'film_white_construct' && this.currentScene === 'm1_construct'
      || id === 'film_heart_hotel' && this.currentScene === 'm1_room303'
      || this.theOne?.setId === 'film_heart_hotel' || this.theOne?.setId === 'film_neb_deck'
      || this.reloaded?.set === 'film_captains_meeting' || this.reloaded?.set === 'film_trinity_roof'
      || id === 'film_seraph_teahouse' || id === 'film_backdoor_hall'
      || id === 'film_oracle_courtyard' || id === 'film_le_vrai' || id === 'film_keymaker_workshop'
      || this.matrixEscape?.setId === 'film_subway_platform'
      || this.currentScene === 'm2_stop_sentinels' && Boolean(this.finale)
      || id === 'film_oracle_home' && (this.currentScene === 'm3_oracle_request' || this.currentScene === 'm3_oracle_last')
      || Boolean(this.interrogation || this.baneInquiry || this.baneCopy || this.hammerRoute || this.smithFinale)
      || Boolean(this.zionDeployment || this.maggieDiscovery)
      || id === 'film_chateau_hall' && this.currentScene === 'm2_chateau'
      || id === 'film_mountain_range' && this.currentScene === 'm2_mountain'
      || id === 'film_chateau_garage' && this.currentScene === 'm2_garage'
      || Boolean(this.zion && ['m2_lock', 'm2_residents', 'm2_room', 'm2_hamann', 'm2_oracle_message'].includes(this.currentScene ?? ''))
      || id === 'film_zion_temple' && ['m2_temple', 'm3_temple_defense', 'm3_temple_breach', 'm3_ceasefire'].includes(this.currentScene ?? '')
      || this.currentScene === 'm3_farewell' && Boolean(this.logosWreck)
      || id === 'film_zion_hangar' && (this.currentScene === 'm2_dock' || this.currentScene === 'm2_departure' || this.currentScene === 'm3_diggers' || this.currentScene === 'm3_upper_digger' || this.dockApuApproach)
      || id === 'film_zion_command_bunker' && this.currentScene === 'm3_shaft_seal'
      || this.currentScene === 'm3_emp' && Boolean(this.empDock?.group.visible)
      || Boolean(this.government) && (this.currentScene === 'm1_helicopter' || this.currentScene === 'm1_rooftop_rescue')
      || this.currentScene === 'm1_dejavu' && Boolean(this.ambush);
  }
  get helAttendant(): THREE.Group | undefined { return this.helPerformers?.coatcheckAttendant; }
  get televisionPreviewImage(): string | undefined { return this.construct?.televisionPreviewImage; }
  setMirrorSubject(subject?: THREE.Object3D): void { this.mirrorSubject = subject; }
  setRecoverySubject(subject?: THREE.Object3D): void { this.recoverySubject = subject; }
  setArchitectState(state?: AgentState): void { this.architectState = state; }
  setCrosscutSubjects(bodies: (id: string) => THREE.Object3D | undefined, avatars: (id: string) => THREE.Object3D | undefined): void { this.crosscutBodies = bodies; this.phoneBodies = avatars; }
  renderTelevisionPreview(renderer: THREE.WebGLRenderer): void { this.construct?.renderPreview(renderer, this.scene.environment); }
  prepareDockEmp(renderer: THREE.WebGLRenderer, camera: THREE.Camera, journey?: FilmJourney): void {
    if (this.currentScene !== 'm3_emp' || journey?.scene !== 'm3_emp' || journey.visiting || !journey.empOperator || journey.emp || this.empDock
      || !renderer.extensions.has('KHR_parallel_shader_compile')) return;
    this.empDock = new DockEmpRenderer(this.scene);
    this.empDock.prepare(renderer, camera, this.scene, journey, ['mifune', 'charra', 'zee'].map(id => this.phoneBodies?.(id)));
  }
  prepareSmithCrater(renderer: THREE.WebGLRenderer, camera: THREE.Camera, journey?: FilmJourney): void {
    if (!this.smithFinale || journey?.scene !== 'm3_rain' || journey.visiting || !journey.smithFinale) return;
    const { phase, elapsed } = journey.smithFinale;
    if (['approach', 'entrance', 'building', 'relaunch', 'sky_grapple'].includes(phase) || phase === 'descent' && elapsed < .8)
      this.smithFinale.prepareCrater(renderer, camera, this.scene);
  }
  preparePodColors(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, actor?: THREE.Group): void {
    this.preparedPods?.prepareColorPrograms(renderer, camera, this.scene, actor);
  }
  prepareAmbush(renderer: THREE.WebGLRenderer, camera: THREE.Camera, journey: FilmJourney,
    body: (id: string) => THREE.Group | undefined, hero: (id: string) => THREE.Group | undefined): void {
    const phase = journey.oracle?.departure?.phase;
    if (this.current?.id !== 'film_oracle_home' || journey.scene !== 'm1_oracle' || journey.visiting
      || !phase || !['talking', 'bite_ready', 'biting', 'leaving', 'done'].includes(phase)) {
      this.cancelAmbushPreparation(); return;
    }
    const prepared = this.preparedAmbush ??= { renderer: new AmbushSetRenderer() };
    if (!prepared.renderer.prepareStep() || !renderer.extensions.has('KHR_parallel_shader_compile')) return;
    if (prepared.gpu !== renderer.properties) {
      prepared.lighting?.dispose(); prepared.colors = undefined; prepared.gpu = renderer.properties;
    }
    if (!prepared.colors) {
      prepared.renderer.update({ ...journey, scene: 'm1_dejavu', step: 0 }, [], 0);
      prepared.colors = { ...this.colorPreparation(prepared.renderer.root, [], { includeBasic: true }), actors: new Set() };
      let points = 0; prepared.colors.scene.traverseVisible(object => { if (object instanceof THREE.PointLight) points++; });
      for (; points < AMBUSH_POINT_SLOTS; points++) prepared.colors.scene.add(new THREE.PointLight(0xffffff, 0, 1));
      prepared.lighting = new LightCulling(prepared.colors.scene); prepared.lighting.enabled = false;
    }
    const colors = prepared.colors, meshes = new Set<ColorMesh>();
    for (const id of [journey.actor, ...FILM_SCENE_BY_ID.m1_dejavu.cast]) {
      const detailed = hero(id);
      for (const group of [body(id), detailed]) {
        if (!group || colors.actors.has(group)) continue;
        const collected: ColorMesh[] = [];
        if (group === detailed) group.traverse(object => {
          // The old-building coat and shirt are hidden during the Oracle visit.
          if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && !object.userData.reloadedHidden) collected.push(object);
        });
        else collected.push(...this.colorMeshes([group]));
        if (!collected.length) continue;
        colors.actors.add(group); collected.forEach(mesh => meshes.add(mesh));
      }
    }
    colors.meshes.unshift(...meshes); this.queueColorTextures(colors.textures, meshes);
    if (!this.prepareColorTexture(renderer, colors.textures)) this.prepareColorFrame(renderer, camera, colors, prepared.lighting, 'isolated');
  }
  prepareBasement(renderer: THREE.WebGLRenderer, camera: THREE.Camera, lighting: LightCulling, journey: FilmJourney | undefined,
    body: (id: string) => THREE.Group | undefined, hero: (id: string) => THREE.Group | undefined): void {
    if (!this.basement || journey?.scene !== 'm1_basement' || journey.visiting) { this.basementColors = undefined; return; }
    // The camera first exposes the other cast below the ceiling; give the fall its frame budget.
    if (!['ready', 'descending'].includes(journey.basement?.phase ?? '') || !renderer.extensions.has('KHR_parallel_shader_compile')) return;
    if (this.basementColors?.gpu !== renderer.properties) {
      const meshes = this.colorMeshes([this.root], true), textures = new Set<THREE.Texture>();
      this.queueColorTextures(textures, meshes);
      this.basementColors = { scene: this.scene, meshes, textures, programs: [], actors: new Set(), gpu: renderer.properties };
    }
    const colors = this.basementColors, meshes = new Set<ColorMesh>();
    for (const id of [journey.actor, ...FILM_SCENE_BY_ID.m1_basement.cast, 'morpheus', 'smith', 'mouse']) {
      const detailed = hero(id);
      for (const group of [body(id), detailed]) {
        if (!group || colors.actors.has(group)) continue;
        const collected: ColorMesh[] = [];
        if (group === detailed) group.traverse(object => {
          if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && !object.userData.reloadedHidden) collected.push(object);
        });
        else collected.push(...this.colorMeshes([group]));
        if (!collected.length) continue;
        colors.actors.add(group); collected.forEach(mesh => meshes.add(mesh));
      }
    }
    colors.meshes.unshift(...meshes); this.queueColorTextures(colors.textures, meshes);
    if (!this.prepareColorTexture(renderer, colors.textures)) this.prepareColorFrame(renderer, camera, colors, lighting, 'isolated');
  }
  prepareTvExit(renderer: THREE.WebGLRenderer, camera: THREE.Camera, journey: FilmJourney | undefined,
    actor: (id: string) => THREE.Group | undefined, shadowSun: THREE.DirectionalLight): void {
    if (this.current?.id !== 'film_ambush_house' || this.currentScene !== 'm1_basement' || journey?.scene !== 'm1_basement' || journey.visiting
      || !['tunnel', 'done'].includes(journey.basement?.phase ?? '')) {
      this.cancelTvExitPreparation(); return;
    }
    if (!this.preparedTvExit) {
      this.preparedTvExit = { renderer: new TvRepairRenderer(new THREE.Group()) };
      return;
    }
    if (!renderer.extensions.has('KHR_parallel_shader_compile')) return;
    const prepared = this.preparedTvExit;
    if (!prepared.colors || prepared.gpu !== renderer.properties) {
      prepared.lighting?.dispose();
      prepared.colors = { ...this.colorPreparation(prepared.renderer.root, [], { includeBasic: true, shadowSun }), actors: new Set() };
      prepared.lighting = new LightCulling(prepared.colors.scene); prepared.lighting.enabled = false;
      prepared.gpu = renderer.properties;
    }
    const colors = prepared.colors, neo = actor('neo');
    if (neo && !colors.actors.has(neo)) {
      const meshes: ColorMesh[] = [];
      // Neo is the first actor visible in the shaft.
      neo.traverse(object => {
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && !object.userData.reloadedHidden) meshes.push(object);
      });
      if (meshes.length) {
        colors.actors.add(neo); colors.meshes.unshift(...meshes); this.queueColorTextures(colors.textures, meshes);
      }
    }
    this.prepareColorFrame(renderer, camera, colors, prepared.lighting, 'isolated');
  }
  prepareLobby(renderer: THREE.WebGLRenderer, camera: THREE.Camera, journey: FilmJourney | undefined,
    body: (id: string) => THREE.Group | undefined, hero: (id: string) => THREE.Group | undefined, shadowSun: THREE.DirectionalLight): void {
    if (this.current?.id !== 'film_white_construct' || journey?.scene !== 'm1_guns' || journey.visiting
      || !['racks_ready', 'racks_arriving', 'selecting', 'equipping', 'equipped'].includes(journey.rescue?.phase ?? '')) {
      this.cancelLobbyPreparation(); return;
    }
    if (!this.preparedLobby) {
      const root = new THREE.Group();
      this.preparedLobby = { root, renderer: new LobbySetRenderer(root, FILM_SETS.film_government_lobby) };
    }
    const prepared = this.preparedLobby;
    if (!renderer.extensions.has('KHR_parallel_shader_compile')) return;
    if (!prepared.colors || prepared.gpu !== renderer.properties) {
      prepared.lighting?.dispose();
      prepared.colors = { ...this.colorPreparation(prepared.root, [], { includeBasic: true, shadowSun }), actors: new Set() };
      let points = 0; prepared.colors.scene.traverseVisible(object => { if (object instanceof THREE.PointLight) points++; });
      for (; points < LOBBY_POINT_SLOTS; points++) prepared.colors.scene.add(new THREE.PointLight(0xffffff, 0, 1));
      prepared.colors.meshes.push(this.marker);
      prepared.lighting = new LightCulling(prepared.colors.scene); prepared.lighting.enabled = false;
      prepared.gpu = renderer.properties;
    }
    const colors = prepared.colors, meshes = new Set<ColorMesh>();
    for (const id of ['neo', ...FILM_SCENE_BY_ID.m1_lobby.cast, 'agent_jones']) {
      for (const group of [body(id), hero(id)]) {
        if (!group || colors.actors.has(group)) continue;
        const collected: ColorMesh[] = [];
        // The security cast is offstage while the weapons are being selected.
        group.traverse(object => {
          if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && !object.userData.reloadedHidden) collected.push(object);
        });
        if (!collected.length) continue;
        colors.actors.add(group); collected.forEach(mesh => meshes.add(mesh));
      }
    }
    colors.meshes.unshift(...meshes); this.queueColorTextures(colors.textures, meshes);
    this.prepareColorFrame(renderer, camera, colors, prepared.lighting, 'isolated');
  }
  prepareGovernment(renderer: THREE.WebGLRenderer, camera: THREE.Camera, journey: FilmJourney | undefined,
    body: (id: string) => THREE.Group | undefined, hero: (id: string) => THREE.Group | undefined, shadowSun: THREE.DirectionalLight): void {
    const questioning = this.current?.id === 'film_government_lobby' && journey?.scene === 'm1_lobby' && journey.lobby?.phase === 'cleared';
    const roofFight = this.current?.id === 'film_government_office' && journey?.scene === 'm1_smith_question'
      && ['alarm_ready', 'alarm', 'done'].includes(journey.government?.phase ?? '');
    const helicopter = this.current?.id === 'film_government_roof' && journey?.scene === 'm1_bullet_dodge'
      && ['download_ready', 'downloading', 'done'].includes(journey.government?.phase ?? '');
    const rooftop = this.current?.id === 'film_government_office' && journey?.scene === 'm1_helicopter'
      && ['catching', 'done'].includes(journey.airRescue?.phase ?? '');
    if (!journey || journey.visiting || !questioning && !roofFight && !helicopter && !rooftop) {
      this.cancelGovernmentPreparation(); return;
    }
    const scene = roofFight ? 'm1_bullet_dodge' : rooftop ? 'm1_rooftop_rescue' : helicopter ? 'm1_helicopter' : 'm1_smith_question';
    if (this.preparedGovernment?.scene !== scene) {
      this.cancelGovernmentPreparation();
      const root = new THREE.Group();
      const office = new GovernmentSetRenderer(root, roofFight || rooftop ? 'film_government_roof' : 'film_government_office');
      if (roofFight) office.update({ ...journey, scene, government: { kind: 'rooftop', phase: 'ready', elapsed: 0, attempt: 0 }, airRescue: undefined }, 0);
      if (helicopter) office.update({ ...journey, scene, airRescue: { kind: 'office', phase: 'ready', elapsed: 0, attempt: 0, suppression: 0, bursts: 0 } }, 0);
      if (rooftop) office.update({ ...journey, scene, airRescue: { kind: 'roof', phase: 'ready', elapsed: 0, attempt: 0, grip: 1, braces: 0, misses: 0, resolved: [] } }, 0);
      this.preparedGovernment = { scene, root, renderer: office };
    }
    const prepared = this.preparedGovernment;
    if (!renderer.extensions.has('KHR_parallel_shader_compile')) return;
    if (!prepared.colors || prepared.gpu !== renderer.properties) {
      prepared.textureUpload?.return(false); prepared.textureUpload = undefined;
      prepared.lighting?.dispose();
      prepared.colors = { ...this.colorPreparation(prepared.root, [], { includeBasic: true, shadowSun }), actors: new Set() };
      // These entrances hide the objective light, unlike the preceding elevator or cockpit.
      for (const light of prepared.colors.scene.children) if (light instanceof THREE.PointLight) light.intensity = 0;
      prepared.colors.meshes.push(this.marker);
      prepared.lighting = new LightCulling(prepared.colors.scene);
      prepared.lighting.stablePointSlots = !questioning && !roofFight;
      prepared.gpu = renderer.properties;
    }
    const colors = prepared.colors, meshes = new Set<ColorMesh>();
    for (const id of [FILM_SCENE_BY_ID[scene].actor, ...FILM_SCENE_BY_ID[scene].cast]) {
      for (const group of [body(id), hero(id)]) {
        if (!group || colors.actors.has(group)) continue;
        const collected: ColorMesh[] = [];
        group.traverse(object => {
          if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && !object.userData.reloadedHidden) collected.push(object);
        });
        if (!collected.length) continue;
        colors.actors.add(group); collected.forEach(mesh => meshes.add(mesh));
      }
    }
    colors.meshes.unshift(...meshes); this.queueColorTextures(colors.textures, meshes);
    const preparingTexture = questioning || roofFight ? this.prepareStagedColorTexture(renderer, prepared, colors.textures, 2)
      : this.prepareColorTexture(renderer, colors.textures);
    if (!preparingTexture) this.prepareColorProgram(renderer, camera, colors, prepared.lighting, 'isolated');
  }
  prepareInterrogation(renderer: THREE.WebGLRenderer, camera: THREE.Camera, journey: FilmJourney | undefined,
    actor: (id: string) => THREE.Group | undefined, shadowSun: THREE.DirectionalLight): void {
    if (journey?.scene !== 'm1_office_escape' || journey.visiting || journey.office?.custody?.street?.phase !== 'departing') {
      this.cancelInterrogationPreparation(); return;
    }
    const prepared = this.preparedInterrogation ??= { renderer: new InterrogationSetRenderer() };
    if (!prepared.renderer.prepareStep() || !renderer.extensions.has('KHR_parallel_shader_compile')) return;
    if (!prepared.colors || prepared.gpu !== renderer.properties) {
      prepared.lighting?.dispose();
      prepared.colors = { ...this.colorPreparation(prepared.renderer.root, [], { includeBasic: true, shadowSun }), actors: new Set() };
      prepared.colors.meshes.push(this.marker);
      // The room retains its two point-light slots, including the goal light.
      prepared.lighting = new LightCulling(prepared.colors.scene); prepared.lighting.enabled = false;
      prepared.gpu = renderer.properties;
    }
    const colors = prepared.colors;
    for (const id of [journey.actor, ...FILM_SCENE_BY_ID.m1_interrogation.cast]) {
      const group = actor(id);
      if (!group || colors.actors.has(group)) continue;
      const meshes = this.colorMeshes([group], true);
      if (!meshes.length) continue;
      colors.actors.add(group); colors.meshes.unshift(...meshes); this.queueColorTextures(colors.textures, meshes);
    }
    this.prepareColorFrame(renderer, camera, colors, prepared.lighting, 'isolated');
  }
  prepareMatrixEscape(renderer: THREE.WebGLRenderer, camera: THREE.Camera, journey: FilmJourney,
    body: (id: string) => THREE.Group | undefined, hero: (id: string) => THREE.Group | undefined, shadowSun: THREE.DirectionalLight): void {
    const phase = journey.airRescue?.phase;
    const subway = this.currentScene === 'm1_rooftop_rescue' && this.current?.id === 'film_government_roof'
      && journey.scene === 'm1_rooftop_rescue' && (phase === 'pulling' || phase === 'done');
    const escape = journey.matrixEscape;
    const city = this.currentScene === 'm1_subway' && this.current?.id === 'film_subway_platform' && journey.scene === 'm1_subway'
      && (escape?.phase === 'done' || escape?.phase === 'body_swap' && escape.elapsed >= .6);
    const hotel = this.currentScene === 'm1_city_chase' && this.current?.id === 'film_escape_streets' && journey.scene === 'm1_city_chase'
      && (escape?.phase === 'door' || escape?.phase === 'done');
    if (journey.visiting || !subway && !city && !hotel) {
      this.cancelMatrixEscapePreparation();
      return;
    }
    const set = hotel ? 'film_heart_hotel' : subway ? 'film_subway_platform' : 'film_escape_streets';
    if (this.preparedMatrixEscape?.renderer.setId !== set) {
      this.cancelMatrixEscapePreparation();
      const root = new THREE.Group();
      this.preparedMatrixEscape = { root, renderer: set === 'film_heart_hotel' ? new TheOneRenderer(root, set) : new MatrixEscapeRenderer(root, set) };
    }
    const prepared = this.preparedMatrixEscape;
    if (!renderer.extensions.has('KHR_parallel_shader_compile')) return;
    if (!prepared.colors || prepared.gpu !== renderer.properties) {
      prepared.textureUpload?.return(false); prepared.textureUpload = undefined;
      prepared.lighting?.dispose();
      prepared.colors = { ...this.colorPreparation(prepared.root, [], { includeBasic: true, shadowSun }), actors: new Set() };
      if (subway) {
        const debris: ColorMesh[] = [];
        prepared.root.getObjectByName('matrix-subway-phone-debris')?.traverse(object => {
          if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) debris.push(object);
        });
        prepared.colors.meshes.push(...debris, this.marker);
        this.queueColorTextures(prepared.colors.textures, debris);
        let points = 0; prepared.colors.scene.traverseVisible(object => { if (object instanceof THREE.PointLight) points++; });
        for (; points < SUBWAY_POINT_SLOTS; points++) prepared.colors.scene.add(new THREE.PointLight(0xffffff, 0, 1));
      } else if (city) {
        // Tank's briefing starts with only the street's own point light.
        for (const light of prepared.colors.scene.children) if (light instanceof THREE.PointLight) light.visible = false;
      }
      prepared.lighting = new LightCulling(prepared.colors.scene); prepared.lighting.enabled = false;
      prepared.gpu = renderer.properties;
    }
    const colors = prepared.colors, meshes = new Set<ColorMesh>();
    // Prepare Neo's entry under the hotel's eight stable point-light slots.
    const cast = city ? FILM_SCENE_BY_ID.m1_city_chase.cast : subway ? [...FILM_SCENE_BY_ID.m1_subway.cast, 'morpheus', 'trinity'] : [];
    for (const id of ['neo', ...cast]) {
      for (const group of [body(id), hero(id)]) {
        if (!group || colors.actors.has(group)) continue;
        const collected: ColorMesh[] = [];
        group.traverse(object => {
          if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && !object.userData.reloadedHidden) collected.push(object);
        });
        if (!collected.length) continue;
        colors.actors.add(group); collected.forEach(mesh => meshes.add(mesh));
      }
    }
    colors.meshes.unshift(...meshes); this.queueColorTextures(colors.textures, meshes);
    if (!this.prepareStagedColorTexture(renderer, prepared, colors.textures, 2)) this.prepareColorProgram(renderer, camera, colors, prepared.lighting, 'isolated');
  }
  prepareOneDeck(renderer: THREE.WebGLRenderer, camera: THREE.Camera, journey: FilmJourney, actor: (id: string) => THREE.Group | undefined, position: Vector3): void {
    const encounter = journey.theOne;
    const center = FILM_SETS.film_heart_hotel.center, door = FILM_SCENE_BY_ID.m1_death.steps[0];
    const approaching = encounter?.phase === 'ready' && Math.hypot(position.x - center.x - door.x, position.z - center.z - door.z) < 20;
    const shooting = journey.scene === 'm1_death' && encounter?.kind === 'death'
      && (approaching || encounter.phase === 'ambush' || encounter.phase === 'gunfire');
    const exiting = journey.scene === 'm1_return' && encounter?.kind === 'return'
      && (encounter.phase === 'dive' && encounter.elapsed >= .35 || ['burst', 'exit_run', 'exit_ready', 'exit_phone'].includes(encounter.phase));
    if (this.current?.id !== 'film_heart_hotel' || journey.visiting || !encounter || (!shooting && !exiting)) {
      this.cancelOneDeckPreparation();
      return;
    }
    // Give Smith's first frames the render budget and keep any deck already prepared.
    if (encounter.phase === 'ambush' && encounter.elapsed < .35) return;
    if (!this.preparedOneDeck) {
      const root = new THREE.Group();
      const deck = new NebDeckRenderer(root), overlay = new TheOneRenderer(root, 'film_neb_deck');
      this.preparedOneDeck = { root, deck, overlay };
      deck.update(journey, 0);
      overlay.update({ ...journey, theOne: { ...encounter, phase: shooting ? 'flatline' : 'emp', elapsed: 0 } }, 0);
      if (renderer.extensions.has('KHR_parallel_shader_compile'))
        this.preparedOneDeck.colors = { ...this.colorPreparation(root, []), actors: new Set() };
    }
    const colors = this.preparedOneDeck.colors;
    if (colors) this.prepareCastColors(renderer, camera, colors, ['neo', 'trinity', 'morpheus', 'tank', 'cypher', 'dozer'], actor);
  }
  prepareTruthReturn(renderer: THREE.WebGLRenderer, camera: THREE.Camera, journey: FilmJourney | undefined, actor: (id: string) => THREE.Group | undefined): void {
    const truthReturn = this.current?.id === 'film_white_construct' && this.currentScene === 'm1_truth_exit' && journey?.scene === 'm1_truth_exit';
    const jumpReturn = this.current?.id === 'film_jump_roofs' && this.currentScene === 'm1_jump' && journey?.scene === 'm1_jump'
      && journey.training?.kind === 'jump_fall' && journey.training.elapsed >= .5;
    if (!journey || journey.visiting || !truthReturn && !jumpReturn) {
      this.cancelTruthReturnPreparation(); return;
    }
    const scene = jumpReturn ? 'm1_jump_return' : 'm1_truth_return';
    if (this.preparedTruthReturn && this.preparedTruthReturn.scene !== scene) this.cancelTruthReturnPreparation();
    if (!this.preparedTruthReturn) {
      const root = new THREE.Group(), deck = new NebDeckRenderer(root);
      deck.update(jumpReturn ? { ...journey, scene, training: { kind: 'jump_return', elapsed: 0, started: false } }
        : { ...journey, scene, truthRecovery: { phase: 'unplug', elapsed: 0 } }, 0);
      this.preparedTruthReturn = { scene, root, deck };
    }
    if (!renderer.extensions.has('KHR_parallel_shader_compile')) return;
    const prepared = this.preparedTruthReturn;
    if (!prepared.colors || prepared.gpu !== renderer.properties) {
      prepared.lighting?.dispose();
      prepared.colors = { ...this.colorPreparation(prepared.root, [], { includeBasic: true }), actors: new Set() };
      if (scene === 'm1_truth_return') prepared.colors.scene.add(new THREE.PointLight(0xffffff, 0, 1));
      prepared.colors.meshes.push(this.marker);
      prepared.lighting = new LightCulling(prepared.colors.scene); prepared.lighting.enabled = false;
      prepared.gpu = renderer.properties;
    }
    const colors = prepared.colors;
    for (const id of ['neo', 'trinity', 'morpheus', 'tank', 'dozer']) {
      const group = actor(id); if (!group || colors.actors.has(group)) continue;
      const meshes = this.colorMeshes([group]);
      if (jumpReturn) group.traverse(object => {
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial
          && (object.userData.logosCostume || object.userData.hammerBriefingCostume) && !meshes.includes(object)) meshes.push(object);
      });
      if (!meshes.length) continue;
      colors.actors.add(group); colors.meshes.unshift(...meshes); this.queueColorTextures(colors.textures, meshes);
    }
    this.prepareColorFrame(renderer, camera, colors, prepared.lighting, 'isolated');
  }
  prepareDownloadWalk(renderer: THREE.WebGLRenderer, camera: THREE.Camera, lighting: LightCulling,
    journey: FilmJourney | undefined, actor: (id: string) => THREE.Group | undefined): void {
    if (this.current?.id !== 'film_neb_deck' || this.currentScene !== 'm1_download' || journey?.scene !== 'm1_download' || journey.visiting
      || journey.downloadSetup?.phase !== 'waking' || !renderer.extensions.has('KHR_parallel_shader_compile')) {
      this.cancelDownloadWalkPreparation(); return;
    }
    let prepared = this.preparedDownloadWalk;
    if (!prepared || prepared.gpu !== renderer.properties) {
      this.cancelDownloadWalkPreparation();
      const curtain = this.root.getObjectByName('neb-medical-curtain');
      this.preparedDownloadWalk = prepared = { gpu: renderer.properties, scene: this.scene, actors: new Set(),
        meshes: curtain instanceof THREE.Mesh ? [curtain] : [], programs: [], textures: new Set() };
    }
    // The view turns into the corridor when Neo stands up, exposing the deck crew together.
    for (const [id, names] of Object.entries(DOWNLOAD_WALK_CAST)) {
      const group = actor(id); if (!group || prepared.actors.has(group)) continue;
      const meshes: ColorMesh[] = [];
      for (const name of names) {
        const mesh = group.getObjectByName(name);
        if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshStandardMaterial) meshes.push(mesh);
      }
      if (!meshes.length) continue;
      prepared.actors.add(group);
      prepared.meshes.push(...meshes);
      this.queueColorTextures(prepared.textures, meshes);
    }
    if (!this.prepareColorProgram(renderer, camera, prepared, lighting, 'isolated'))
      this.prepareStagedColorTexture(renderer, prepared, prepared.textures);
  }
  private cancelDownloadWalkPreparation(): void {
    this.preparedDownloadWalk?.textureUpload?.return(false);
    this.preparedDownloadWalk = undefined;
  }
  prepareClub(renderer: THREE.WebGLRenderer, camera: THREE.Camera, journey: FilmJourney | undefined,
    actor: (id: string) => THREE.Group | undefined, shadows: (THREE.Mesh | undefined)[] = []): void {
    if (this.current?.id !== 'film_anderson_flat' || journey?.scene !== 'm1_wake_up' || journey.visiting
      || !['handover', 'invitation', 'inspecting', 'noticed', 'accepted'].includes(journey.contact?.phase ?? '')) {
      this.cancelClubPreparation(); return;
    }
    if (!this.preparedClub) {
      const root = new THREE.Group(), club = new ClubSetRenderer(root);
      this.preparedClub = { root, renderer: club };
      void club.ready.catch(error => console.error('夜店人群加载失败', error));
    }
    const prepared = this.preparedClub;
    if (!prepared.colors || prepared.gpu !== renderer.properties) {
      prepared.textureUpload?.return(false); prepared.textureUpload = undefined;
      prepared.lighting?.dispose(); prepared.gpu = renderer.properties;
      prepared.colors = { ...this.colorPreparation(prepared.root, [], { includeBasic: true }), actors: new Set() };
      prepared.colors.meshes.push(this.marker, ...shadows.filter((mesh): mesh is THREE.Mesh => mesh !== undefined));
      prepared.lighting = new LightCulling(prepared.colors.scene);
      prepared.lighting.minimumPointSlots = CLUB_POINT_SLOTS; prepared.lighting.stablePointSlots = true;
      prepared.crowdQueued = prepared.renderer.crowdSources.length > 0;
    }
    const colors = prepared.colors;
    for (const id of ['neo', 'trinity']) {
      const group = actor(id);
      if (!group || colors.actors.has(group)) continue;
      const meshes: ColorMesh[] = [];
      group.traverse(object => {
        if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial || object.material instanceof THREE.MeshBasicMaterial)) return;
        const { office, tracking, patientBody, reloadedHidden, clubJacket, wristSkin } = object.userData;
        if (office || tracking || patientBody || reloadedHidden || id === 'trinity' && (clubJacket || wristSkin)) return;
        meshes.push(object);
      });
      if (!meshes.length) continue;
      colors.actors.add(group); colors.meshes.unshift(...meshes); this.queueColorTextures(colors.textures, meshes);
    }
    if (!prepared.crowdQueued) {
      const crowd = prepared.renderer.crowdSources;
      if (crowd.length) {
        prepared.crowdQueued = true;
        const meshes = this.colorMeshes(crowd, true), crowdTextures = new Set<THREE.Texture>();
        this.queueColorTextures(crowdTextures, meshes);
        colors.meshes.push(...meshes);
        colors.textures = new Set([...crowdTextures, ...colors.textures]);
      }
    }
    if (renderer.extensions.has('KHR_parallel_shader_compile')
      && this.prepareColorProgram(renderer, camera, colors, prepared.lighting, 'isolated')) return;
    this.prepareStagedColorTexture(renderer, prepared, colors.textures);
  }
  prepareDojo(renderer: THREE.WebGLRenderer, camera: THREE.Camera, journey: FilmJourney | undefined, actor: (id: string) => THREE.Group | undefined): void {
    if (this.current?.id !== 'film_neb_deck' || this.currentScene !== 'm1_download' || journey?.scene !== 'm1_download' || journey.visiting
      || journey.training?.kind !== 'download' || !journey.training.started || journey.training.elapsed < .5) {
      this.cancelDojoPreparation(); return;
    }
    if (!this.preparedDojo) {
      const root = new THREE.Group(); this.preparedDojo = { root, renderer: new TrainingSetRenderer(root, 'm1_dojo') };
    }
    const prepared = this.preparedDojo;
    if (!renderer.extensions.has('KHR_parallel_shader_compile')) return;
    if (!prepared.colors || prepared.gpu !== renderer.properties) {
      prepared.lighting?.dispose();
      prepared.colors = { ...this.colorPreparation(prepared.root, [], { includeBasic: true }), actors: new Set() };
      // The dojo owns the shadow sun; keep the world's two colour-light slots.
      for (const light of prepared.colors.scene.children) if (light instanceof THREE.DirectionalLight) light.castShadow = false;
      prepared.lighting = new LightCulling(prepared.colors.scene); prepared.lighting.enabled = false;
      prepared.gpu = renderer.properties;
    }
    const colors = prepared.colors;
    for (const id of ['neo', 'morpheus']) {
      const group = actor(id); if (!group || colors.actors.has(group)) continue;
      const meshes = this.colorMeshes([group]);
      group.traverse(object => {
        if (object instanceof THREE.Mesh && object.userData.dojoCostume && object.material instanceof THREE.MeshStandardMaterial && !meshes.includes(object)) meshes.push(object);
      });
      if (!meshes.length) continue;
      colors.actors.add(group); colors.meshes.unshift(...meshes); this.queueColorTextures(colors.textures, meshes);
    }
    this.prepareColorFrame(renderer, camera, colors, prepared.lighting, 'isolated');
  }
  prepareJump(renderer: THREE.WebGLRenderer, camera: THREE.Camera, journey: FilmJourney | undefined, actor: (id: string) => THREE.Group | undefined, shadowSun: THREE.DirectionalLight): void {
    if (this.current?.id !== 'film_kungfu_dojo' || this.currentScene !== 'm1_dojo' || journey?.scene !== 'm1_dojo' || journey.visiting
      || !journey.dojo?.complete || journey.step < 1) {
      this.cancelJumpPreparation(); return;
    }
    if (!this.preparedJump) {
      const root = new THREE.Group(); this.preparedJump = { root, renderer: new TrainingSetRenderer(root, 'm1_jump') };
    }
    const prepared = this.preparedJump;
    if (!renderer.extensions.has('KHR_parallel_shader_compile')) return;
    if (!prepared.colors || prepared.gpu !== renderer.properties) {
      prepared.lighting?.dispose();
      prepared.colors = { ...this.colorPreparation(prepared.root, [], { includeBasic: true, shadowSun }), actors: new Set() };
      prepared.lighting = new LightCulling(prepared.colors.scene); prepared.lighting.enabled = false;
      prepared.gpu = renderer.properties;
    }
    const colors = prepared.colors;
    for (const id of ['neo', 'morpheus']) {
      const group = actor(id); if (!group || colors.actors.has(group)) continue;
      const meshes: ColorMesh[] = [];
      group.traverse(object => {
        // Ordinary clothes are hidden by the dojo outfit until the program changes.
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && !object.userData.reloadedHidden) meshes.push(object);
      });
      if (!meshes.length) continue;
      colors.actors.add(group); colors.meshes.unshift(...meshes); this.queueColorTextures(colors.textures, meshes);
    }
    this.prepareColorFrame(renderer, camera, colors, prepared.lighting, 'isolated');
  }
  prepareRedDress(renderer: THREE.WebGLRenderer, camera: THREE.Camera, journey: FilmJourney | undefined, actor: (id: string) => THREE.Group | undefined): void {
    if (this.current?.id !== 'film_neb_deck' || this.currentScene !== 'm1_jump_return' || journey?.scene !== 'm1_jump_return' || journey.visiting
      || journey.training?.kind !== 'jump_return' || !journey.training.started || journey.training.elapsed < .5) {
      this.cancelRedDressPreparation(); return;
    }
    if (!this.preparedRedDress) {
      const root = new THREE.Group(), prepared = { root, renderer: new TrainingSetRenderer(root, 'm1_red_dress'), assetsReady: false };
      this.preparedRedDress = prepared;
      void prepared.renderer.ready.then(() => { prepared.assetsReady = true; }, () => { prepared.assetsReady = true; });
    }
    const prepared = this.preparedRedDress;
    if (!prepared.assetsReady || !renderer.extensions.has('KHR_parallel_shader_compile')) return;
    if (!prepared.colors || prepared.gpu !== renderer.properties) {
      prepared.textureUpload?.return(false); prepared.textureUpload = undefined;
      prepared.lighting?.dispose();
      prepared.colors = { ...this.colorPreparation(prepared.root, [], { includeBasic: true }), actors: new Set() };
      for (const light of prepared.colors.scene.children) if (light instanceof THREE.DirectionalLight) light.castShadow = false;
      prepared.lighting = new LightCulling(prepared.colors.scene); prepared.lighting.enabled = false;
      prepared.gpu = renderer.properties;
    }
    const colors = prepared.colors;
    for (const id of ['neo', 'morpheus', 'mouse', 'citizen_1', 'citizen_2', 'smith']) {
      const group = actor(id); if (!group || colors.actors.has(group)) continue;
      const meshes: ColorMesh[] = [];
      group.traverse(object => {
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && !object.userData.reloadedHidden) meshes.push(object);
      });
      if (!meshes.length) continue;
      // Give Neo and the plaza priority when the player enters before preparation finishes.
      if (id === 'neo') colors.meshes.unshift(...meshes); else colors.meshes.push(...meshes);
      colors.actors.add(group); this.queueColorTextures(colors.textures, meshes);
    }
    // Start transferring the decoded cast and crowd maps while their programs are linking.
    this.prepareColorProgram(renderer, camera, colors, prepared.lighting, 'isolated');
    this.prepareStagedColorTexture(renderer, prepared, colors.textures, 4);
  }
  prepareSentinel(renderer: THREE.WebGLRenderer, camera: THREE.Camera, journey: FilmJourney | undefined, actor: (id: string) => THREE.Group | undefined, shadowSun: THREE.DirectionalLight): void {
    if (this.current?.id !== 'film_red_dress_plaza' || this.currentScene !== 'm1_red_dress' || journey?.scene !== 'm1_red_dress' || journey.visiting
      || journey.training?.kind !== 'red_dress' || !['frozen', 'done'].includes(journey.training.attention?.phase ?? '') || journey.training.elapsed < 6.3) {
      this.cancelSentinelPreparation(); return;
    }
    if (!this.preparedSentinel) {
      const root = new THREE.Group(), cockpit = new SentinelSetRenderer(root);
      cockpit.update({ ...journey, scene: 'm1_sentinels', sentinel: { phase: 'ready', elapsed: 0, noise: 0, attempt: 0 } }, 0);
      this.preparedSentinel = { root, renderer: cockpit };
    }
    const prepared = this.preparedSentinel;
    if (!renderer.extensions.has('KHR_parallel_shader_compile')) return;
    if (!prepared.colors || prepared.gpu !== renderer.properties) {
      prepared.lighting?.dispose();
      prepared.colors = { ...this.colorPreparation(prepared.root, [], { includeBasic: true, shadowSun }), actors: new Set() };
      prepared.colors.meshes.push(this.marker);
      prepared.lighting = new LightCulling(prepared.colors.scene); prepared.lighting.enabled = false;
      prepared.gpu = renderer.properties;
    }
    const colors = prepared.colors;
    for (const id of ['neo', 'morpheus', 'trinity', 'tank', 'dozer']) {
      const group = actor(id); if (!group || colors.actors.has(group)) continue;
      const meshes = this.colorMeshes([group]);
      group.traverse(object => {
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial
          && (object.userData.logosCostume || object.userData.hammerBriefingCostume) && !meshes.includes(object)) meshes.push(object);
      });
      if (!meshes.length) continue;
      colors.actors.add(group); colors.meshes.unshift(...meshes); this.queueColorTextures(colors.textures, meshes);
    }
    this.prepareColorFrame(renderer, camera, colors, prepared.lighting, 'isolated');
  }
  prepareConsole(renderer: THREE.WebGLRenderer, camera: THREE.Camera, journey: FilmJourney | undefined, actor: (id: string) => THREE.Group | undefined, shadowSun: THREE.DirectionalLight): void {
    if (this.current?.id !== 'film_service_tunnels' || this.currentScene !== 'm1_sentinels' || journey?.scene !== 'm1_sentinels' || journey.visiting
      || !['clear', 'verify', 'confirming', 'done'].includes(journey.sentinel?.phase ?? '') || journey.sentinel?.phase === 'clear' && journey.sentinel.elapsed < .5) {
      this.cancelConsolePreparation(); return;
    }
    if (!this.preparedConsole) {
      const root = new THREE.Group(), deck = new NebDeckRenderer(root);
      deck.update({ ...journey, scene: 'm1_cypher_console', interlude: { kind: 'console', phase: 'ready', elapsed: 0 } }, 0);
      this.preparedConsole = { root, deck };
    }
    const prepared = this.preparedConsole;
    if (!renderer.extensions.has('KHR_parallel_shader_compile')) return;
    if (!prepared.colors || prepared.gpu !== renderer.properties) {
      prepared.lighting?.dispose();
      prepared.colors = { ...this.colorPreparation(prepared.root, [], { includeBasic: true, shadowSun }), actors: new Set() };
      prepared.colors.meshes.push(this.marker);
      prepared.lighting = new LightCulling(prepared.colors.scene); prepared.lighting.enabled = false;
      prepared.gpu = renderer.properties;
    }
    const colors = prepared.colors;
    for (const id of ['neo', 'cypher', 'apoc', 'switch']) {
      const group = actor(id); if (!group || colors.actors.has(group)) continue;
      const meshes = this.colorMeshes([group]);
      group.traverse(object => {
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial
          && (object.userData.logosCostume || object.userData.hammerBriefingCostume || object.userData.cypherCostume) && !meshes.includes(object)) meshes.push(object);
      });
      if (!meshes.length) continue;
      colors.actors.add(group); colors.meshes.unshift(...meshes); this.queueColorTextures(colors.textures, meshes);
    }
    this.prepareColorFrame(renderer, camera, colors, prepared.lighting, 'isolated');
  }
  prepareRestaurant(renderer: THREE.WebGLRenderer, camera: THREE.Camera, journey: FilmJourney | undefined, actor: (id: string) => THREE.Group | undefined, shadowSun: THREE.DirectionalLight): void {
    const encounter = journey?.interlude;
    if (this.current?.id !== 'film_neb_deck' || this.currentScene !== 'm1_cypher_console' || journey?.scene !== 'm1_cypher_console' || journey.visiting
      || encounter?.kind !== 'console' || !(encounter.phase === 'done' || encounter.phase === 'responding' && encounter.elapsed >= .5)) {
      this.cancelRestaurantPreparation(); return;
    }
    if (!this.preparedRestaurant) {
      const root = new THREE.Group(), restaurant = new CypherRestaurantRenderer(root);
      restaurant.update({ ...journey, scene: 'm1_steak', interlude: { kind: 'steak', phase: 'ready', elapsed: 0 } }, 0);
      this.preparedRestaurant = { root, renderer: restaurant };
    }
    const prepared = this.preparedRestaurant;
    if (!renderer.extensions.has('KHR_parallel_shader_compile')) return;
    if (!prepared.colors || prepared.gpu !== renderer.properties) {
      prepared.textureUpload?.return(false); prepared.textureUpload = undefined;
      prepared.lighting?.dispose();
      prepared.colors = { ...this.colorPreparation(prepared.root, [], { includeBasic: true, shadowSun }), actors: new Set() };
      prepared.colors.meshes.push(this.marker);
      prepared.lighting = new LightCulling(prepared.colors.scene); prepared.lighting.enabled = false;
      prepared.gpu = renderer.properties;
    }
    const colors = prepared.colors;
    for (const id of ['smith', 'cypher']) {
      const group = actor(id); if (!group || colors.actors.has(group)) continue;
      const meshes: ColorMesh[] = [];
      group.traverse(object => {
        // The ship outfit currently hides the ordinary Matrix clothes.
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && !object.userData.reloadedHidden) meshes.push(object);
      });
      if (!meshes.length) continue;
      colors.actors.add(group); colors.meshes.unshift(...meshes); this.queueColorTextures(colors.textures, meshes);
    }
    this.prepareColorProgram(renderer, camera, colors, prepared.lighting, 'isolated');
    this.prepareStagedColorTexture(renderer, prepared, colors.textures, 4);
  }
  prepareMeal(renderer: THREE.WebGLRenderer, camera: THREE.Camera, journey: FilmJourney | undefined, actor: (id: string) => THREE.Group | undefined, shadowSun: THREE.DirectionalLight): void {
    const encounter = journey?.interlude;
    if (this.current?.id !== 'film_cypher_restaurant' || this.currentScene !== 'm1_steak' || journey?.scene !== 'm1_steak' || journey.visiting
      || encounter?.kind !== 'steak' || !['performing', 'done'].includes(encounter.phase) || steakAge(encounter) < 13) {
      this.cancelMealPreparation(); return;
    }
    if (!this.preparedMeal) {
      const root = new THREE.Group(), deck = new NebDeckRenderer(root);
      deck.update({ ...journey, scene: 'm1_meal', interlude: { kind: 'meal', phase: 'ready', elapsed: 0 } }, 0);
      this.preparedMeal = { root, deck };
    }
    const prepared = this.preparedMeal;
    if (!renderer.extensions.has('KHR_parallel_shader_compile')) return;
    if (!prepared.colors || prepared.gpu !== renderer.properties) {
      prepared.lighting?.dispose();
      prepared.colors = { ...this.colorPreparation(prepared.root, [], { includeBasic: true, shadowSun }), actors: new Set() };
      prepared.colors.meshes.push(this.marker);
      prepared.lighting = new LightCulling(prepared.colors.scene); prepared.lighting.enabled = false;
      prepared.gpu = renderer.properties;
    }
    const colors = prepared.colors;
    for (const id of ['neo', 'tank', 'mouse', 'dozer', 'apoc', 'switch']) {
      const group = actor(id); if (!group || colors.actors.has(group)) continue;
      const meshes = this.colorMeshes([group]);
      group.traverse(object => {
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial
          && (object.userData.logosCostume || object.userData.hammerBriefingCostume) && !meshes.includes(object)) meshes.push(object);
      });
      if (!meshes.length) continue;
      colors.actors.add(group); colors.meshes.unshift(...meshes); this.queueColorTextures(colors.textures, meshes);
    }
    this.prepareColorFrame(renderer, camera, colors, prepared.lighting, 'isolated');
  }
  prepareCaptainsMeeting(renderer: THREE.WebGLRenderer, camera: THREE.Camera, journey: FilmJourney, actor: (id: string) => THREE.Group | undefined): void {
    const encounter = journey.reloaded;
    if (journey.scene !== 'm2_meeting' || journey.visiting || encounter?.kind !== 'meeting') return;
    const { phase, elapsed } = encounter;
    if (this.current?.id === 'film_neb_deck' && (phase === 'talking' && elapsed >= .5 || phase === 'connect_ready' || phase === 'connecting')) {
      if (!this.preparedMeetingHall) {
        const hall = new ReloadedOpeningRenderer(new THREE.Group(), 'film_captains_meeting');
        hall.update({ ...journey, reloaded: { ...encounter, phase: 'report_ready', elapsed: 0 } });
        this.preparedMeetingHall = { renderer: hall };
        if (renderer.extensions.has('KHR_parallel_shader_compile'))
          this.preparedMeetingHall.colors = { ...this.colorPreparation(hall.group, []), actors: new Set() };
      }
      const colors = this.preparedMeetingHall.colors;
      if (colors) this.prepareCastColors(renderer, camera, colors, ['neo', 'trinity', 'morpheus', 'niobe', 'ballard', 'ghost', 'soren'], actor);
    } else if (this.reloaded?.set === 'film_captains_meeting' && ['earpiece_ready', 'earpiece', 'evacuate_ready', 'breach'].includes(phase)
      && renderer.extensions.has('KHR_parallel_shader_compile')) {
      if (!this.preparedMeetingAgents) {
        const fixtures = new THREE.Group();
        for (const child of this.reloaded.group.children) if (child instanceof THREE.PointLight) fixtures.add(child.clone());
        this.preparedMeetingAgents = { ...this.colorPreparation(fixtures, []), actors: new Set() };
      }
      this.prepareCastColors(renderer, camera, this.preparedMeetingAgents, RELOADED.agents, actor);
    }
  }
  prepareZionHomecoming(renderer: THREE.WebGLRenderer, camera: THREE.Camera, journey: FilmJourney | undefined,
    actor: (id: string) => THREE.Group | undefined): void {
    this.prepareBaneCopy(renderer, camera, journey, actor);
    const cut = journey && ZION_CUTS[journey.scene];
    if (!journey || !cut || journey.visiting || journey.step < cut.step || this.currentScene !== journey.scene
      || journey.scene === 'm2_bane_copy' && journey.step === 2 && (journey.baneCopy?.progress ?? 0) < .2
      || this.current?.id !== FILM_SCENE_BY_ID[journey.scene].set) {
      this.cancelZionPreparation(); return;
    }
    const next = FILM_SCENE_BY_ID[cut.scene];
    if (!this.preparedZion) {
      const target = new ZionHomecomingRenderer(new THREE.Group(), next.set, next.id);
      target.update({ ...journey, scene: next.id, step: 0 }, 0);
      this.preparedZion = { scene: next.id, renderer: target };
      if (renderer.extensions.has('KHR_parallel_shader_compile')) {
        const colors = this.preparedZion.colors = { ...this.colorPreparation(target.group, []), actors: new Set<THREE.Group>(), seen: new Set<ColorMesh>() };
        const initial = new Set(colors.meshes);
        const crowdLoaded = () => {
          if (this.preparedZion?.renderer !== target) return;
          const meshes = this.colorMeshes([target.group]).filter(mesh => !initial.has(mesh));
          colors.meshes.push(...meshes); this.queueColorTextures(colors.textures, meshes);
        };
        void target.crowdReady?.then(crowdLoaded, crowdLoaded);
      }
    }
    const colors = this.preparedZion.colors;
    if (!colors) return;
    for (const id of [next.actor, ...next.cast]) {
      const group = actor(id); if (!group) continue;
      // The next scene's detailed LOD can still be hidden by distance.
      const visible = group.visible; let meshes: ColorMesh[];
      try { group.visible = true; meshes = this.colorMeshes([group]); }
      finally { group.visible = visible; }
      group.traverse(object => {
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial
          && (object.userData.logosCostume || object.userData.hammerBriefingCostume) && !meshes.includes(object)) meshes.push(object);
      });
      meshes = meshes.filter(mesh => !colors.seen.has(mesh));
      if (!meshes.length) continue;
      meshes.forEach(mesh => colors.seen.add(mesh));
      colors.actors.add(group); colors.meshes.unshift(...meshes); this.queueColorTextures(colors.textures, meshes);
    }
    this.prepareColorFrame(renderer, camera, colors);
  }
  private prepareBaneCopy(renderer: THREE.WebGLRenderer, camera: THREE.Camera, journey: FilmJourney | undefined,
    actor: (id: string) => THREE.Group | undefined): void {
    if (!journey || journey.scene !== 'm2_room' || journey.visiting || journey.step < 1
      || this.currentScene !== journey.scene || this.current?.id !== 'film_zion_bedroom') {
      this.cancelBaneCopyPreparation(); return;
    }
    if (!this.preparedBaneCopy) {
      const target = new BaneCopyRenderer(new THREE.Group());
      target.update({ ...journey, scene: 'm2_bane_copy', step: 0 }, 0);
      this.preparedBaneCopy = { renderer: target };
      if (renderer.extensions.has('KHR_parallel_shader_compile')) {
        const colors = this.preparedBaneCopy.colors = { ...this.colorPreparation(target.group, []), actors: new Set<THREE.Group>() };
        const wave: ColorMesh[] = [];
        target.group.getObjectByName('smith-copy-wave')?.traverse(object => {
          if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) wave.push(object);
        });
        colors.meshes.push(...wave); this.queueColorTextures(colors.textures, wave);
      }
    }
    const colors = this.preparedBaneCopy.colors; if (!colors) return;
    const next = FILM_SCENE_BY_ID.m2_bane_copy;
    for (const id of [next.actor, ...next.cast]) {
      const group = actor(id); if (!group || colors.actors.has(group)) continue;
      const visible = group.visible; let meshes: ColorMesh[];
      try { group.visible = true; meshes = this.colorMeshes([group]); }
      finally { group.visible = visible; }
      if (!meshes.length) continue;
      colors.actors.add(group); colors.meshes.unshift(...meshes); this.queueColorTextures(colors.textures, meshes);
    }
    this.prepareColorFrame(renderer, camera, colors);
  }
  prepareSecondOracle(renderer: THREE.WebGLRenderer, camera: THREE.Camera, journey: FilmJourney | undefined,
    actor: (id: string) => THREE.Group | undefined): void {
    if (this.current?.id === 'film_chateau_garage' && journey?.scene === 'm2_garage' && !journey.visiting && journey.step >= 1) {
      if (journey.garage?.phase === 'wrecked') return;
      const prepared = this.preparedFreeway ??= { renderer: new FreewaySetRenderer(undefined, FILM_SETS.film_freeway_101) };
      if (!prepared.renderer.prepareStep()) return;
      const next = FILM_SCENE_BY_ID.m2_freeway;
      if (!prepared.colors && renderer.extensions.has('KHR_parallel_shader_compile')) {
        prepared.renderer.update({ ...journey, scene: next.id, step: 0, freewayPickup: newFreewayPickup() }, 0);
        prepared.colors = { ...this.colorPreparation(prepared.renderer.root, []), actors: new Set() };
      }
      if (prepared.colors) this.prepareCastColors(renderer, camera, prepared.colors, [next.actor, ...next.cast], actor);
      return;
    }
    this.cancelFreewayPreparation();
    if (this.current?.id === 'film_chateau_hall' && journey?.scene === 'm2_chateau' && !journey.visiting && journey.step >= 1) {
      if (!this.preparedMountain) {
        const root = new THREE.Group();
        this.preparedMountain = { root, renderer: new MountainSetRenderer(root) };
        return;
      }
      const prepared = this.preparedMountain;
      if (!prepared.colors && renderer.extensions.has('KHR_parallel_shader_compile'))
        prepared.colors = { ...this.colorPreparation(prepared.root, []), actors: new Set() };
      if (prepared.colors) this.prepareCastColors(renderer, camera, prepared.colors, [journey.actor], actor);
      return;
    }
    this.cancelMountainPreparation();
    if (this.current?.id === 'film_oracle_courtyard' && journey?.scene === 'm2_bench' && !journey.visiting && journey.step >= 1
      && renderer.extensions.has('KHR_parallel_shader_compile')) {
      const colors = this.courtyardCastColors ??= { ...this.colorPreparation(new THREE.Group(), []), actors: new Set() };
      this.prepareCastColors(renderer, camera, colors, ['smith'], actor);
      return;
    }
    const cut = journey && SECOND_ORACLE_CUTS[journey.scene];
    const firstOracle = journey?.scene === 'm1_meal', meal = journey?.interlude;
    const flight = journey?.mountain;
    const approachingGarage = journey?.scene !== 'm2_mountain' || flight?.phase === 'arrived'
      || flight?.phase === 'flying' && flight.z <= MOUNTAIN.launch.z - 30;
    if (!journey || !cut || journey.visiting || journey.step < cut.step || this.currentScene !== journey.scene
      || !approachingGarage || this.current?.id !== FILM_SCENE_BY_ID[journey.scene].set
      || firstOracle && (meal?.kind !== 'meal' || !['performing', 'accepting', 'done'].includes(meal.phase) || crewMealAge(meal) < 8.2)) {
      this.cancelSecondOraclePreparation(); return;
    }
    if (journey.scene === 'm2_backup' && journey.step === 1 && journey.trinityTerminal?.phase === 'ready' && !this.preparedSecondOracle) return;
    const next = FILM_SCENE_BY_ID[cut.scene];
    const teaEntry = next.id === 'm2_seraph', leVraiEntry = next.id === 'm2_merovingian';
    const chateauEntry = next.id === 'm2_chateau';
    const matrixEntry = firstOracle || teaEntry || leVraiEntry || chateauEntry;
    if (!this.preparedSecondOracle) {
      const set = FILM_SETS[next.set], { x, y, z } = set.center;
      const room = new FilmSetRenderer(new THREE.Scene());
      room.current = set; room.currentScene = next.id;
      room.root.position.set(x, y - 1, z);
      this.preparedSecondOracle = { scene: next.id, room, steps: room.prepareRoomSteps(set) };
    }
    const prepared = this.preparedSecondOracle;
    if (prepared.steps) {
      if (prepared.steps.next().done) prepared.steps = undefined;
      return;
    }
    if (matrixEntry && prepared.gpu !== renderer.properties) {
      prepared.textureUpload?.return(false); prepared.textureUpload = undefined;
      prepared.lighting?.dispose(); prepared.colors = undefined; prepared.gpu = renderer.properties;
    }
    if (!prepared.colors && renderer.extensions.has('KHR_parallel_shader_compile')) {
      // PBR maps are attached after decoding. Compile the mapped variants.
      for (const texture of prepared.room.textures) if (!texture.image) return;
      const room = prepared.room;
      const colors = this.colorPreparation(room.root, [], {
        includeBasic: teaEntry || leVraiEntry || chateauEntry
          || Boolean(room.architectRoom || room.catchSet || room.trainmanChase || room.oracleDoor || room.maggieDiscovery),
      });
      for (const texture of room.architectRoom?.screenTextures ?? []) colors.textures.add(texture);
      prepared.colors = { ...colors, actors: new Set() };
      if (matrixEntry) {
        colors.meshes.push(this.marker);
        if (room.chateauVolley) colors.meshes.push(...this.colorMeshes(room.chateauVolley.children));
        prepared.lighting = new LightCulling(colors.scene); prepared.lighting.enabled = false;
      }
    }
    if (prepared.colors) {
      const cast = [next.actor, ...next.cast];
      if (matrixEntry) {
        const colors = prepared.colors;
        for (const id of cast) {
          const group = actor(id); if (!group || colors.actors.has(group)) continue;
          let meshes: ColorMesh[];
          if (teaEntry && id === 'seraph') {
            if (!group.getObjectByName('seraph-detailed-body') || !group.getObjectByName('seraph-detailed-head')) continue;
            meshes = this.colorMeshes(group.children, true);
          } else {
            meshes = [];
            group.traverse(object => {
              // The returning visitors still wear ship clothes in the current view.
              if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && !object.userData.reloadedHidden) meshes.push(object);
            });
          }
          if (!meshes.length) continue;
          colors.actors.add(group); colors.meshes.unshift(...meshes); this.queueColorTextures(colors.textures, meshes);
        }
        this.prepareColorProgram(renderer, camera, colors, prepared.lighting, 'isolated');
        this.prepareStagedColorTexture(renderer, prepared, colors.textures, 4);
        return;
      }
      // The infirmary shares the Hammer deck with the rest of the crew. Bane is still staged there until the call.
      if (next.id === 'm3_maggie_discovery') cast.push('ak', 'niobe', 'ghost', 'bane');
      this.prepareCastColors(renderer, camera, prepared.colors, cast, actor);
    }
  }
  private prepareCastColors(renderer: THREE.WebGLRenderer, camera: THREE.Camera, colors: CastColorPreparation,
    cast: readonly string[], actor: (id: string) => THREE.Group | undefined): void {
    for (const id of cast) {
      const group = actor(id);
      if (!group || colors.actors.has(group)) continue;
      const meshes = this.colorMeshes([group]);
      if (!meshes.length) continue;
      colors.actors.add(group);
      colors.meshes.unshift(...meshes);
      this.queueColorTextures(colors.textures, meshes);
    }
    this.prepareColorFrame(renderer, camera, colors);
  }
  prepareOpeningHotelPolice(renderer: THREE.WebGLRenderer, camera: THREE.Camera, lighting: LightCulling,
    groups?: THREE.Group[], stage?: 'hall' | 'pursuit', prepareCord = false): void {
    const beam = stage === 'hall' ? this.hotel303Beam : undefined;
    const cord = prepareCord ? this.hotel303Cord : undefined;
    if (this.currentScene !== 'm1_room303' || (!groups?.length && !beam && !cord) || !renderer.extensions.has('KHR_parallel_shader_compile')) {
      this.cancelOpeningHotelPolice();
      return;
    }
    let prepared = this.preparedHotelPolice;
    if (!prepared || prepared.gpu !== renderer.properties) {
      this.cancelOpeningHotelPolice();
      this.preparedHotelPolice = prepared = { gpu: renderer.properties, scene: this.scene, actors: new Set(), meshes: [], programs: [], textures: new Set(),
        shadowMeshes: [], shadowMaterials: new Set(), buffers: [], bufferGeometries: new WeakSet() };
    }
    if (beam && prepared.beam !== beam) {
      // Link the real material before the hallway comes into view under the trace overlay.
      prepared.beam = beam;
      prepared.meshes.unshift(beam);
    }
    if (cord && prepared.cord !== cord) {
      prepared.cord = cord;
      prepared.meshes.push(cord);
    }
    const prepareShadows = stage === 'pursuit' && renderer.shadowMap.enabled && renderer.shadowMap.type !== THREE.VSMShadowMap;
    for (const group of groups ?? []) {
      if (prepared.actors.has(group)) continue;
      const meshes = this.colorMeshes(stage ? group.children : [group], Boolean(stage));
      // The offstage officer hasn't animated into his office uniform yet.
      if (stage === 'pursuit') for (const mesh of group.children) {
        if (mesh instanceof THREE.Mesh && mesh.userData.office && mesh.material instanceof THREE.MeshStandardMaterial && !meshes.includes(mesh)) meshes.push(mesh);
      }
      if (!meshes.length) continue;
      prepared.actors.add(group);
      prepared.meshes.push(...meshes);
      if (stage) {
        const skinned = meshes.filter(mesh => mesh instanceof THREE.SkinnedMesh);
        if (skinned.length) prepared.normalMeshes = [...(prepared.normalMeshes ?? []), ...skinned];
      }
      if (stage === 'pursuit') for (const mesh of meshes) {
        if (prepared.bufferGeometries.has(mesh.geometry)) continue;
        prepared.bufferGeometries.add(mesh.geometry);
        prepared.buffers.push(mesh);
      }
      if (prepareShadows) prepared.shadowMeshes.push(...shadowCasterProxies(meshes, prepared.shadowMaterials));
    }
    if (this.prepareColorProgram(renderer, camera, prepared, lighting, 'isolated', stage === 'pursuit' || Boolean(cord))) return;
    if (prepared.shadowMeshes.length) {
      this.linkColorBatch(renderer, camera, { ...prepared, meshes: prepared.shadowMeshes }, lighting, 'depth');
      return;
    }
    if (prepared.buffers.length) prepared.bufferUpload ??= prepareMeshBuffers(renderer, camera, prepared.buffers);
    if (prepared.bufferUpload?.next().done) prepared.bufferUpload = undefined;
  }
  private cancelOpeningHotelPolice(): void {
    this.preparedHotelPolice?.bufferUpload?.return(undefined);
    this.preparedHotelPolice?.shadowMaterials.forEach(material => material.dispose());
    this.preparedHotelPolice = undefined;
  }
  private openingRoom(scene: OpeningVisitScene, camera: THREE.Camera) {
    const next = FILM_SCENE_BY_ID[scene], set = FILM_SETS[next.set], { x, y, z } = set.center;
    const room = new FilmSetRenderer(new THREE.Scene()), eye = camera.clone(), entry = filmEntry(next);
    room.current = set; room.currentScene = scene; room.root.position.set(x, y - 1, z);
    if (scene === 'm1_roofs' && this.currentScene === 'm1_room303' && this.current?.id === 'film_heart_hotel'
      && this.materials.has(this.metal) && this.materials.has(this.wood) && this.materials.has(this.plaster)) {
      room.roofSurfaceSources = new Map([['metal_plate', this.metal], ['old_wood_floor', this.wood], ['damaged_plaster', this.plaster]]);
    }
    eye.position.set(entry.x, entry.y + 6, entry.z + 11); eye.lookAt(entry.x, entry.y + 2, entry.z - 2);
    return { room, eye, steps: room.prepareRoomSteps(set) };
  }
  beginOpeningVisit(renderer: THREE.WebGLRenderer, camera: THREE.Camera, scene: OpeningVisitScene, actor: string,
    cast: THREE.Object3D[], sourceLights: LightCulling, sun: THREE.DirectionalLight) {
    this.cancelOpeningVisit();
    this.cancelOpeningPreparation();
    const { room, eye, steps } = this.openingRoom(scene, camera);
    const visit: OpeningVisitPreparation = { scene, actor, room,
      steps: this.prepareOpeningVisitSteps(renderer, camera, room, eye, steps, cast, sourceLights, sun) };
    this.preparedOpeningVisit = visit;
    const cancel = () => { if (this.preparedOpeningVisit === visit) this.cancelOpeningVisit(); };
    return {
      step: () => {
        if (this.preparedOpeningVisit !== visit) return undefined;
        if (visit.steps?.next().done) {
          visit.steps = undefined;
          // A declined or interrupted visit has no set change to release its room.
          visit.release = setTimeout(cancel, 5000);
        }
        return visit.steps === undefined;
      },
      cancel,
    };
  }
  private *prepareOpeningVisitSteps(renderer: THREE.WebGLRenderer, camera: THREE.Camera, room: FilmSetRenderer, eye: THREE.Camera,
    build: Generator<void>, cast: THREE.Object3D[], sourceLights: LightCulling, sun: THREE.DirectionalLight): Generator<void> {
    yield* build;
    const deadline = performance.now() + 5000, gpu = renderer.properties;
    while ([...room.textures].some(texture => !texture.image) && performance.now() < deadline) yield;
    const colors = this.colorPreparation(room.root, [], { includeBasic: true, shadowSun: sun });
    const marker = colors.scene.children.find((light): light is THREE.PointLight => light instanceof THREE.PointLight)!;
    marker.visible = room.stablePointSlots; marker.intensity = 0;
    for (const root of cast) {
      const visible = root.visible;
      root.visible = true;
      try { colors.meshes.push(...this.colorMeshes([root], true)); }
      finally { root.visible = visible; }
    }
    this.queueColorTextures(colors.textures, colors.meshes.filter((mesh): mesh is ColorMesh => mesh instanceof THREE.Mesh));
    if (room.openingCord) colors.meshes.push(room.openingCord);
    if (room.hotel303Cord) colors.meshes.push(room.hotel303Cord);
    const lights = new LightCulling(colors.scene);
    lights.minimumPointSlots = room.minimumPointSlots; lights.stablePointSlots = room.stablePointSlots;
    const compile = renderer.extensions.has('KHR_parallel_shader_compile');
    const depthMaterials = new Set<THREE.MeshDepthMaterial>();
    const casters = compile && renderer.shadowMap.enabled && renderer.shadowMap.type !== THREE.VSMShadowMap
      ? shadowCasterProxies(colors.meshes, depthMaterials) : [];
    depthMaterials.forEach(material => room.materials.add(material));
    const shadows = casters.length ? [{ lighting: sourceLights, eye: camera, meshes: casters.slice() }, { lighting: lights, eye, meshes: casters }] : [];
    const upload = this.prepareOpeningVisitTextures(renderer, colors.textures);
    let uploaded = false;
    try {
      while (renderer.properties === gpu && performance.now() < deadline) {
        if (compile && this.prepareColorProgram(renderer, eye, colors, lights, 'isolated')) { yield; continue; }
        const shadow = shadows[0];
        if (shadow) {
          const programs = renderer.info.programs, start = programs?.length ?? 0;
          this.compileColorBatch(renderer, shadow.meshes.splice(0, 4),
            subject => shadow.lighting.compileSubject(renderer, shadow.eye, subject, undefined, undefined, 'depth'));
          if (programs) colors.programs.push(...programs.slice(start) as ColorProgram[]);
          if (!shadow.meshes.length) shadows.shift();
        } else {
          if (!uploaded) uploaded = Boolean(upload.next().done);
          if (uploaded && (!compile || !colors.programs.some(program => renderer.info.programs?.includes(program)))) return;
        }
        yield;
      }
    } finally { upload.return(undefined); lights.dispose(); }
  }
  private *prepareOpeningVisitTextures(renderer: THREE.WebGLRenderer, textures: Set<THREE.Texture>): Generator<void> {
    while (textures.size) {
      for (const texture of textures) {
        const image = texture.image as { complete?: boolean } | undefined;
        if (!texture.version || !image || image.complete === false) continue;
        textures.delete(texture);
        const uploaded = renderer.properties.get(texture) as { __version?: number };
        if (uploaded.__version === texture.version) continue;
        const bitmap = bitmapUploadImage(renderer, texture);
        if (!bitmap || !(yield* stageBitmapTexture(renderer, texture, bitmap))) renderer.initTexture(texture);
        break;
      }
      yield;
    }
  }
  prepareOpening(renderer: THREE.WebGLRenderer, camera: THREE.Camera, journey: FilmJourney | undefined,
    actor: (id: string) => THREE.Group | undefined, shadow?: THREE.Mesh, lighting?: LightCulling, distantNeo?: THREE.Mesh, resumeRoof = false): void {
    const roof = this.current?.id === 'film_hotel_roofs' && this.currentScene === 'm1_roofs'
      && journey?.scene === 'm1_roofs' && !journey.visiting ? journey.openingRoof : undefined;
    if (!this.preparedOpeningVisit && lighting && roof?.phase === 'failed')
      this.prepareOpeningRoofRetry(renderer, camera, lighting, actor, roof.pursuit, shadow);
    else this.cancelOpeningRoofRetry();
    if (this.preparedOpeningVisit) return;
    let scene: OpeningPreparation['scene'] | undefined;
    if (journey && !journey.visiting && this.currentScene === journey.scene) {
      if (resumeRoof && !this.current && journey.scene === 'm1_roofs') scene = 'm1_roofs';
      if (this.current?.id === 'film_heart_hotel' && journey.scene === 'm1_room303'
        && ['dive', 'ladder_ready', 'climbing', 'done'].includes(journey.openingHotel?.phase ?? '')) scene = 'm1_roofs';
      if (this.current?.id === 'film_hotel_roofs' && journey.scene === 'm1_roofs' && journey.step >= 2
        && (journey.openingRoof?.phase === 'running' || journey.openingRoof?.phase === 'escaped')) scene = 'm1_phone_escape';
    }
    if (!scene) { this.cancelOpeningPreparation(); return; }
    const next = FILM_SCENE_BY_ID[scene];
    if (this.preparedOpening?.scene !== scene) {
      this.cancelOpeningPreparation();
      this.preparedOpening = { scene, ...this.openingRoom(scene, camera) };
    }
    const prepared = this.preparedOpening;
    if (prepared.gpu !== renderer.properties) {
      prepared.textureUpload?.return(false); prepared.textureUpload = undefined;
      prepared.lighting?.dispose(); prepared.colors = undefined; prepared.gpu = renderer.properties;
      for (const material of prepared.roofShadows?.materials ?? []) {
        material.dispose(); prepared.room.materials.delete(material);
      }
      prepared.roofShadows = undefined; prepared.roofMapsReady = undefined; prepared.roofFirstColors = undefined;
      prepared.roofEntryTexturesReady = undefined;
    }
    if (resumeRoof) this.prepareOpeningRoofEntryTextures(renderer, prepared, actor);
    if (prepared.steps) {
      if (prepared.steps.next().done) prepared.steps = undefined;
      return;
    }
    if (!renderer.extensions.has('KHR_parallel_shader_compile')) return;
    if (!prepared.colors) {
      if (scene !== 'm1_roofs' && [...prepared.room.textures].some(texture => !texture.image)) return;
      const colors = this.colorPreparation(prepared.room.root, [], { includeBasic: true });
      const goal = filmStepPosition(next, next.steps[0]);
      for (const light of colors.scene.children) if (light instanceof THREE.PointLight) {
        light.position.set(goal.x, goal.y + .68, goal.z); light.intensity = scene === 'm1_roofs' ? 5 : 0;
      }
      colors.meshes.push(this.marker);
      if (shadow) colors.meshes.push(shadow);
      if (prepared.room.openingCord) colors.meshes.push(prepared.room.openingCord);
      if (scene === 'm1_roofs' && prepared.room.openingRoofGlass) {
        const first = new Set<ColorSubject>(distantNeo ? [distantNeo] : []);
        for (const pane of this.colorMeshes([prepared.room.openingRoofGlass], true)) first.add(pane);
        first.add(this.marker);
        colors.meshes = [...first, ...colors.meshes.filter(mesh => !first.has(mesh))];
      }
      prepared.lighting = new LightCulling(colors.scene);
      prepared.lighting.stablePointSlots = prepared.room.stablePointSlots;
      prepared.lighting.minimumPointSlots = prepared.room.minimumPointSlots;
      prepared.colors = { ...colors, actors: new Set() };
      return;
    }
    const colors = prepared.colors;
    const cast = [next.actor, ...next.cast];
    if (scene === 'm1_roofs') cast.push(...OPENING_HOTEL.officers.map(({ id }) => id));
    for (const id of cast) {
      const group = actor(id);
      if (!group || colors.actors.has(group)) continue;
      const meshes: ColorMesh[] = [];
      group.traverse(object => {
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && !object.userData.reloadedHidden) meshes.push(object);
      });
      if (!meshes.length) continue;
      colors.actors.add(group);
      if (scene === 'm1_roofs') {
        const hair = id === next.actor ? meshes.find(mesh => mesh.name === 'short04') : undefined;
        if (hair) colors.meshes.unshift(hair);
        const body = id === next.actor ? meshes.filter(mesh => ['Anatomical_head_and_hands', 'Fitted_leather_jacket', 'shoes01'].includes(mesh.name)
          || mesh.name === 'high-poly' && mesh.material.name === 'Eyes') : [];
        colors.meshes.splice(4, 0, ...body);
        colors.meshes.push(...meshes.filter(mesh => mesh !== hair && !body.includes(mesh)));
      } else colors.meshes.unshift(...meshes);
      this.queueColorTextures(colors.textures, meshes);
    }
    if (scene === 'm1_roofs' && (prepared.roofFirstColors?.length ?? 0) < 8 && colors.meshes.length) {
      // Link the entry's expensive color programs while the uploads are still pending.
      (prepared.roofFirstColors ??= []).push(...colors.meshes.slice(0, 4));
      this.linkColorBatch(renderer, prepared.eye, colors, prepared.lighting, 'isolated');
      return;
    }
    if (scene === 'm1_roofs' && !prepared.roofMapsReady && [...prepared.room.textures].every(texture => texture.image)) {
      // The roof PBR materials attach their maps only after all three images decode.
      prepared.roofMapsReady = true;
      const mapped = this.colorMeshes([prepared.room.root], true).filter(mesh => mesh.material.map);
      colors.meshes = [...new Set([...mapped, ...colors.meshes])];
      this.queueColorTextures(colors.textures, mapped);
    }
    if (!resumeRoof && this.prepareStagedColorTexture(renderer, prepared, colors.textures)) return;
    if (scene === 'm1_roofs' && lighting && prepared.lighting && renderer.shadowMap.enabled && renderer.shadowMap.type !== THREE.VSMShadowMap
      && this.prepareOpeningRoofShadows(renderer, camera, prepared, colors, lighting, prepared.lighting)) return;
    this.prepareColorProgram(renderer, prepared.eye, colors, prepared.lighting, 'isolated', scene === 'm1_roofs' && !resumeRoof);
  }
  private prepareOpeningRoofEntryTextures(renderer: THREE.WebGLRenderer, prepared: OpeningPreparation,
    actor: (id: string) => THREE.Group | undefined): void {
    if (prepared.roofEntryTexturesReady) return;
    const trinity = actor('trinity');
    const hair = trinity?.getObjectByName('short04') ?? actor('agent_brown')?.getObjectByName('short04');
    const textures = new Set<THREE.Texture>();
    for (const mesh of [hair, trinity?.getObjectByName('Anatomical_head_and_hands')]) {
      if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshStandardMaterial && mesh.material.map?.image)
        textures.add(mesh.material.map);
    }
    const ready = textures.size === 2;
    if (!this.prepareStagedColorTexture(renderer, prepared, textures)) prepared.roofEntryTexturesReady = ready;
  }
  private prepareOpeningRoofRetry(renderer: THREE.WebGLRenderer, camera: THREE.Camera, lighting: LightCulling,
    actor: (id: string) => THREE.Group | undefined, pursuit?: OpeningPursuitCast, shadow?: THREE.Mesh): void {
    const prepared = this.preparedRoofRetry;
    if (!prepared || prepared.gpu !== renderer.properties) {
      this.cancelOpeningRoofRetry();
      this.preparedRoofRetry = { gpu: renderer.properties, scene: this.scene, actors: new Set(),
        meshes: shadow ? [this.marker, shadow] : [this.marker], programs: [], textures: new Set(), surfacesReady: false };
      // Let a cold load draw its failure view before preparing the off-camera retry.
      return;
    }
    // A save below the roof can keep the pursuing actors and rooftop out of view until retry.
    const cast = ['agent_brown', ...OPENING_HOTEL.officers.filter(({ id }) => pursuit?.[id]).map(({ id }) => id)];
    for (const id of cast) {
      const group = actor(id);
      if (!group || prepared.actors.has(group)) continue;
      const meshes = this.colorMeshes(group.children, true);
      if (!meshes.length) continue;
      prepared.actors.add(group);
      prepared.meshes.unshift(...meshes);
      this.queueColorTextures(prepared.textures, meshes);
      const skinned = meshes.filter(mesh => mesh instanceof THREE.SkinnedMesh);
      if (skinned.length) prepared.normalMeshes = [...(prepared.normalMeshes ?? []), ...skinned];
    }
    if (!prepared.surfacesReady && [...this.textures].every(texture => texture.image)) {
      const surfaces = this.colorMeshes([this.root], true);
      prepared.meshes.push(...surfaces);
      this.queueColorTextures(prepared.textures, surfaces);
      prepared.surfacesReady = true;
    }
    if (renderer.extensions.has('KHR_parallel_shader_compile'))
      this.prepareColorProgram(renderer, camera, prepared, lighting, 'isolated');
    this.prepareStagedColorTexture(renderer, prepared, prepared.textures);
  }
  private prepareStagedColorTexture(renderer: THREE.WebGLRenderer, prepared: { textureUpload?: Generator<void, boolean> },
    textures: Set<THREE.Texture>, stripsPerFrame = 1): boolean {
    if (!prepared.textureUpload) {
      for (const texture of textures) {
        const image = texture.image as { width?: number; complete?: boolean } | null;
        if (!texture.version || !image || image.complete === false) continue;
        textures.delete(texture);
        const uploaded = renderer.properties.get(texture) as { __version?: number; __webglTexture?: WebGLTexture };
        if ((image.width ?? 0) < 1024 || uploaded.__version === texture.version) continue;
        const bitmap = !uploaded.__webglTexture && bitmapUploadImage(renderer, texture);
        if (!bitmap) { renderer.initTexture(texture); return true; }
        prepared.textureUpload = stageBitmapTexture(renderer, texture, bitmap);
        break;
      }
    }
    if (!prepared.textureUpload) return false;
    for (let strip = 0; strip < stripsPerFrame; strip++) if (prepared.textureUpload.next().done) {
      prepared.textureUpload = undefined; break;
    }
    return true;
  }
  private prepareOpeningRoofShadows(renderer: THREE.WebGLRenderer, camera: THREE.Camera, prepared: OpeningPreparation,
    colors: CastColorPreparation, hotel: LightCulling, roof: LightCulling): boolean {
    if (!prepared.roofShadows) {
      const materials = new Set<THREE.MeshDepthMaterial>();
      const meshes = shadowCasterProxies([...(prepared.roofFirstColors ?? []), ...colors.meshes], materials);
      for (const material of materials) prepared.room.materials.add(material);
      // The first shadow draw uses the previous pass's light counts.
      prepared.roofShadows = { materials, layouts: meshes.length ? [
        { lighting: hotel, eye: camera, meshes: meshes.slice() }, { lighting: roof, eye: prepared.eye, meshes },
      ] : [] };
    }
    const layouts = prepared.roofShadows.layouts, layout = layouts[0];
    if (!layout) return false;
    const programs = renderer.info.programs, start = programs?.length ?? 0;
    this.compileColorBatch(renderer, layout.meshes.splice(0, 4),
      subject => layout.lighting.compileSubject(renderer, layout.eye, subject, undefined, undefined, 'depth'));
    if (programs) colors.programs.push(...programs.slice(start) as ColorProgram[]);
    if (!layout.meshes.length) layouts.shift();
    return true;
  }
  private colorPreparation(root: THREE.Group, actors: THREE.Group[],
    { textureActors = [], includeBasic = false, shadowSun }: { textureActors?: THREE.Group[]; includeBasic?: boolean; shadowSun?: THREE.DirectionalLight } = {}): ColorPreparation {
    const scene = new THREE.Scene();
    scene.environment = this.scene.environment; scene.fog = this.scene.fog;
    // Use the next set's fixtures and the shared world lights without affecting the live set.
    for (const light of this.scene.children) {
      if (light.visible && (light instanceof THREE.DirectionalLight || light instanceof THREE.HemisphereLight)) {
        const clone = light.clone(); if (light === shadowSun) clone.castShadow = true; scene.add(clone);
      }
    }
    const marker = this.markerLight.clone(); marker.visible = true; scene.add(marker, root);
    const meshes = this.colorMeshes([...actors, root], includeBasic), textures = new Set<THREE.Texture>();
    this.queueColorTextures(textures, new Set([...meshes, ...this.colorMeshes(textureActors)]));
    return { scene, meshes, programs: [], textures };
  }
  private queueColorTextures(textures: Set<THREE.Texture>, meshes: Iterable<ColorMesh>): void {
    for (const { material } of meshes) {
      const maps = material instanceof THREE.MeshStandardMaterial
        ? [material.map, material.alphaMap, material.normalMap, material.bumpMap, material.roughnessMap]
        : [material.map, material.alphaMap];
      for (const map of maps) {
        if (map) textures.add(map);
      }
    }
  }
  private prepareColorFrame(renderer: THREE.WebGLRenderer, camera: THREE.Camera, prepared: ColorPreparation, lighting?: LightCulling,
    colorState: 'live' | 'isolated' = 'live'): void {
    if (!this.prepareColorProgram(renderer, camera, prepared, lighting, colorState)) this.prepareColorTexture(renderer, prepared.textures);
  }
  private prepareColorProgram(renderer: THREE.WebGLRenderer, camera: THREE.Camera, prepared: ColorPreparation, lighting: LightCulling | undefined,
    colorState: 'live' | 'isolated', deferBindings = false): boolean {
    const programs = renderer.info.programs;
    let program = prepared.readyProgram;
    if (program) {
      prepared.readyProgram = undefined;
      if (!programs?.includes(program)) program = undefined;
    }
    if (!program) {
      const ready = prepared.programs.findIndex(candidate => programs?.includes(candidate) && candidate.isReady());
      if (ready < 0) return this.linkColorBatch(renderer, camera, prepared, lighting, colorState);
      [program] = prepared.programs.splice(ready, 1);
      // Give the driver a frame between completion and reflecting uniforms.
      if (deferBindings) {
        prepared.readyProgram = program;
        return true;
      }
    }
    if (lighting) cacheReadyProgramLocations(renderer, program);
    else program.getUniforms();
    return true;
  }
  private linkColorBatch(renderer: THREE.WebGLRenderer, camera: THREE.Camera, prepared: ColorPreparation, lighting: LightCulling | undefined,
    colorState: 'live' | 'isolated' | 'depth'): boolean {
    const batch = prepared.meshes.splice(0, 4);
    if (!batch.length) return false;
    const programs = renderer.info.programs, start = programs?.length ?? 0;
    this.compileColorBatch(renderer, batch, subject => {
      if (lighting) lighting.compileSubject(renderer, camera, subject, undefined, undefined, colorState);
      else renderer.compile(subject, camera, prepared.scene);
    });
    if (programs) prepared.programs.push(...programs.slice(start) as ColorProgram[]);
    return true;
  }
  private prepareColorTexture(renderer: THREE.WebGLRenderer, textures: Set<THREE.Texture>): boolean {
    for (const texture of textures) {
      const image = texture.image as { width?: number; complete?: boolean } | null;
      if (!texture.version || !image || image.complete === false) continue;
      textures.delete(texture);
      const uploaded = renderer.properties.get(texture) as { __version?: number };
      if ((image.width ?? 0) >= 1024 && uploaded.__version !== texture.version) {
        renderer.initTexture(texture);
        return true;
      }
    }
    return false;
  }
  prepareOffice(renderer: THREE.WebGLRenderer, camera: THREE.Camera, lighting: LightCulling, player?: AgentState,
    sandbox?: SandboxState, actor?: THREE.Group, city?: THREE.Group, distantActor?: THREE.Mesh, manager?: THREE.Group, streetCaster?: THREE.Group): boolean {
    const journey = sandbox?.neoLife?.journey, lift = sandbox?.neoLife?.lift;
    const live = player?.isInMatrix && player.id === journey?.actor && !journey.visiting;
    if (this.office || !live || journey.scene !== 'm1_commute'
      || !lift?.passenger || lift.target !== 1 || !['closing', 'travel'].includes(lift.phase)) {
      this.cancelOfficePreparation();
      if (this.office && live) {
        if (city?.visible && this.prepareOfficeCanopy(renderer, camera, lighting, city)) return true;
        if (journey.scene === 'm1_commute') return this.office.prepareWindowCleanerTexture(renderer);
      }
      if (live && !this.current && journey.scene === 'm1_commute' && !lift?.passenger && city?.visible)
        return this.prepareOfficeCanopy(renderer, camera, lighting, city);
      return false;
    }
    const set = FILM_SETS.film_metacortex_floor;
    const prepared = this.preparedOffice ??= { renderer: new OfficeSetRenderer(undefined, set), ready: false, programs: [] };
    const cleaners = prepared.renderer.requestWindowCleaners();
    const programs = renderer.info.programs;
    let subject = prepared.renderer.root;
    let shadowGeometry: THREE.BufferGeometry | undefined;
    if (!prepared.ready) {
      if (!prepared.renderer.prepareStep()) return true;
      prepared.ready = true;
      prepared.cleaners = cleaners;
    } else if (actor && actor !== prepared.actor) {
      prepared.actor = subject = actor;
    } else if (city?.visible && city !== prepared.city) {
      prepared.city = city;
      subject = new THREE.Group();
      const sign = city.children.find(object => object instanceof THREE.Sprite);
      const tower = city.children.find(object => object instanceof THREE.InstancedMesh && object.castShadow && Array.isArray(object.material));
      if (tower instanceof THREE.InstancedMesh) shadowGeometry = tower.geometry;
      // Compile the existing street meshes. Their lights are already in the target scene.
      subject.traverse = visit => {
        for (const object of city.children) if (object.visible && object instanceof THREE.Mesh) visit(object);
        // One sprite covers the city signs, and the goal ring becomes visible at the exit.
        if (sign) visit(sign);
        visit(this.marker);
        // One resident mesh covers the vertex-colored program shared by distant characters.
        if (distantActor) visit(distantActor);
      };
    } else if (cleaners && cleaners !== prepared.cleaners) {
      prepared.cleaners = subject = cleaners;
    } else if (manager && (prepared.manager?.root !== manager || prepared.manager.gpu !== renderer.properties)) {
      prepared.manager = { root: manager, gpu: renderer.properties };
      subject = manager;
    } else {
      // Linking alone leaves uniform and attribute queries for the first draw.
      const ready = prepared.programs.findIndex(program => programs?.includes(program) && program.isReady());
      if (ready < 0) return prepared.renderer.prepareWindowCleanerTexture(renderer) || prepared.programs.some(program => programs?.includes(program));
      cacheReadyProgramLocations(renderer, prepared.programs.splice(ready, 1)[0]);
      return true;
    }
    if (!renderer.extensions.has('KHR_parallel_shader_compile')) return true;
    const start = programs?.length ?? 0;
    const eye = camera.clone();
    eye.position.y += set.center.y - player.position.y;
    const previous = renderer.getRenderTarget(), target = new THREE.WebGLRenderTarget(1, 1);
    const liftSlots = lighting.minimumPointSlots;
    try {
      lighting.minimumPointSlots = OFFICE_POINT_SLOTS;
      renderer.setRenderTarget(target);
      if (subject === actor || subject === manager) subject.traverse(object => {
        if (object instanceof THREE.SkinnedMesh && !Array.isArray(object.material)) prepareSkinnedMaterial(object.material);
      });
      let shadow: THREE.Object3D | undefined;
      if (shadowGeometry && renderer.shadowMap.enabled) {
        const material = this.officeTowerDepth ??= new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.BackSide });
        // Match the shared depth material after the skinned cast has used it.
        prepareSkinnedMaterial(material);
        shadow = new THREE.Group().add(new THREE.InstancedMesh(shadowGeometry, material, 0), new THREE.Mesh(shadowGeometry, material));
        // The floor has rigid casters, and Neo's head and clothes have their own skin/morph layouts.
        actor?.traverseVisible(object => {
          if (object instanceof THREE.SkinnedMesh && object.castShadow && !object.customDepthMaterial)
            shadow!.add(new THREE.SkinnedMesh(object.geometry, material));
        });
        const limb = streetCaster?.getObjectByProperty('type', 'SkinnedMesh');
        if (limb instanceof THREE.SkinnedMesh) {
          // The restored street cast has both rigid and skinned double-sided clothing.
          const depth = this.officeStreetDepth ??= new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
          prepareSkinnedMaterial(depth);
          shadow.add(new THREE.SkinnedMesh(limb.geometry, depth), new THREE.Mesh(limb.geometry, depth));
        }
      }
      lighting.compileSubject(renderer, eye, subject, prepared.renderer.root, shadow, 'isolated');
      if (shadow) {
        // The shaft opens onto the street light layout before the office lights attach.
        lighting.minimumPointSlots = liftSlots;
        lighting.compileSubject(renderer, camera, new THREE.Group(), undefined, shadow, 'isolated');
      }
      // Unlit materials do not reselect on light changes. The live draw must
      // return to its cached street variant while the arrival program links.
      subject.traverse(object => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Sprite)) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          if (material instanceof THREE.MeshBasicMaterial || material instanceof THREE.SpriteMaterial) material.needsUpdate = true;
      });
      if (programs) prepared.programs.push(...programs.slice(start) as ColorProgram[]);
    } finally {
      lighting.minimumPointSlots = liftSlots;
      renderer.setRenderTarget(previous);
      target.dispose();
    }
    return true;
  }
  private prepareOfficeCanopy(renderer: THREE.WebGLRenderer, camera: THREE.Camera, lighting: LightCulling, city: THREE.Group): boolean {
    if (!renderer.extensions.has('KHR_parallel_shader_compile')) return false;
    const prepared = this.preparedOfficeCanopy, gpu = renderer.properties;
    if (prepared?.gpu === gpu && prepared.city === city) {
      const program = prepared.program;
      if (!program || !renderer.info.programs?.includes(program) || !program.isReady()) return false;
      prepared.program = undefined;
      cacheReadyProgramLocations(renderer, program);
      return true;
    }
    // A save on the floor bypasses the elevator's preparation of the street.
    const canopy = city.getObjectByName('central-park-canopy');
    if (!(canopy instanceof THREE.InstancedMesh) || !(canopy.material instanceof THREE.MeshStandardMaterial)) return false;
    this.compileColorBatch(renderer, [canopy], subject => lighting.compileSubject(renderer, camera, subject, undefined, undefined, 'isolated'));
    const { currentProgram } = gpu.get(canopy.material) as { currentProgram?: ColorProgram };
    this.preparedOfficeCanopy = { city, gpu, program: currentProgram };
    return true;
  }
  prepareOfficeStreetPhone(renderer: THREE.WebGLRenderer, camera: THREE.Camera, lighting: LightCulling, phone?: THREE.Mesh): boolean {
    if (!phone || !renderer.extensions.has('KHR_parallel_shader_compile')) return false;
    const prepared = this.preparedOfficeStreetPhone, gpu = renderer.properties;
    if (prepared?.gpu === gpu && prepared.phone === phone) {
      const program = prepared.program;
      if (!program || !renderer.info.programs?.includes(program) || !program.isReady()) return false;
      cacheReadyProgramLocations(renderer, program);
      prepared.program = undefined;
      return true;
    }
    this.compileColorBatch(renderer, [phone], subject => lighting.compileSubject(renderer, camera, subject, undefined, undefined, 'isolated'));
    const { currentProgram } = gpu.get(phone.material) as { currentProgram?: ColorProgram };
    this.preparedOfficeStreetPhone = { phone, gpu, program: currentProgram };
    return true;
  }
  prepareOfficeStreetColors(renderer: THREE.WebGLRenderer, camera: THREE.Camera, lighting: LightCulling, actor?: THREE.Group, driver?: THREE.Group): void {
    if ((!actor && !driver) || !renderer.extensions.has('KHR_parallel_shader_compile')) return;
    const gpu = renderer.properties;
    let prepared = this.preparedOfficeStreet;
    if (!prepared || prepared.gpu !== gpu)
      this.preparedOfficeStreet = prepared = { gpu, meshes: [], programs: [], warmed: new Set() };
    if (actor && prepared.actor !== actor) {
      const meshes = this.colorMeshes([actor]).filter(mesh => OFFICE_STREET_COLOR_MESHES.some(name => mesh.name === name));
      if (meshes.length === OFFICE_STREET_COLOR_MESHES.length) {
        prepared.actor = actor;
        prepared.meshes.unshift(...meshes);
      }
    }
    if (driver && prepared.driver !== driver) {
      // Prepare the near model before its LOD root is visible, preserving hidden parts.
      const meshes = this.colorMeshes(driver.children);
      if (meshes.length) {
        // Rigid and skinned cloth share a material; stabilize its key before either links.
        for (const mesh of meshes) if (mesh instanceof THREE.SkinnedMesh) prepareSkinnedMaterial(mesh.material);
        prepared.driver = driver;
        prepared.meshes.push(...meshes);
      }
    }
    const ready = prepared.programs.findIndex(program => renderer.info.programs?.includes(program) && program.isReady());
    if (ready >= 0) {
      const program = prepared.programs.splice(ready, 1)[0];
      cacheReadyProgramLocations(renderer, program);
      prepared.warmed.add(program);
      return;
    }
    const mesh = prepared.meshes.shift();
    if (!mesh) return;
    this.compileColorBatch(renderer, [mesh], subject => lighting.compileSubject(renderer, camera, subject, undefined, undefined, 'isolated'));
    // The exact material variants may include programs already linked by another preparation.
    const { currentProgram } = gpu.get(mesh.material) as { currentProgram?: ColorProgram };
    if (currentProgram && !prepared.warmed.has(currentProgram) && !prepared.programs.includes(currentProgram)) prepared.programs.push(currentProgram);
  }
  prepareOfficePhone(renderer: THREE.WebGLRenderer, camera: THREE.Camera, lighting: LightCulling, city: THREE.Group, smith: THREE.Group): boolean {
    if (!renderer.shadowMap.enabled || !renderer.extensions.has('KHR_parallel_shader_compile')) return false;
    const prepared = this.preparedOfficePhone, gpu = renderer.properties, programs = renderer.info.programs;
    if (prepared?.gpu === gpu && prepared.smith === smith) {
      const ready = prepared.programs.findIndex(program => programs?.includes(program) && program.isReady());
      if (ready < 0) return false;
      cacheReadyProgramLocations(renderer, prepared.programs.splice(ready, 1)[0]);
      return true;
    }
    const sign = city.children.find(object => object instanceof THREE.Sprite);
    const eyes = this.colorMeshes([smith]).find(mesh => mesh instanceof THREE.SkinnedMesh && mesh.castShadow
      && mesh.material.map?.name === 'smith-eyes.png' && mesh.material.side === THREE.DoubleSide);
    if (!sign || !eyes) return false;
    const { map, alphaMap, alphaTest, shadowSide } = eyes.material;
    // The alpha cutout is part of the shadow silhouette. Compile the same packed depth variant.
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking,
      side: shadowSide ?? THREE.DoubleSide, map, alphaMap, alphaTest });
    prepareSkinnedMaterial(depth);
    const shadow = new THREE.SkinnedMesh(eyes.geometry, depth);
    const start = programs?.length ?? 0;
    this.compileColorBatch(renderer, [sign], subject => lighting.compileSubject(renderer, camera, subject, undefined, shadow));
    const linked = (programs?.slice(start) ?? []) as ColorProgram[];
    prepared?.depth.dispose();
    this.preparedOfficePhone = { smith, gpu, depth, programs: linked };
    return true;
  }
  prepareOfficeConnection(renderer: THREE.WebGLRenderer, camera: THREE.Camera, lighting: LightCulling, journey: FilmJourney,
    courier?: THREE.Group, smith?: THREE.Group): void {
    if (!this.office || journey.scene !== 'm1_boss' || journey.visiting || journey.step !== 1 || journey.phone?.phase !== 'answering') {
      this.preparedOfficeConnection = undefined;
      return;
    }
    if (!courier || !smith || !renderer.extensions.has('KHR_parallel_shader_compile')) return;
    let prepared = this.preparedOfficeConnection;
    if (!prepared || prepared.gpu !== renderer.properties || prepared.courier !== courier || prepared.smith !== smith) {
      const meshes = [courier.getObjectByName('Anatomical_head_and_hands'), courier.getObjectByName('shoes01'),
        courier.getObjectByName('office-uniform-cap'), smith.getObjectByName('short04')]
        .filter((mesh): mesh is ColorMesh => mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshStandardMaterial);
      const signature = this.office.root.getObjectByName('delivery-signature-stroke');
      if (meshes.length !== 4 || !(signature instanceof THREE.Line)) return;
      this.preparedOfficeConnection = prepared = { scene: this.scene, gpu: renderer.properties, courier, smith,
        meshes: [...meshes, signature], programs: [], textures: new Set() };
    }
    this.prepareColorFrame(renderer, camera, prepared, lighting);
  }
  prepareOfficeWindow(renderer: THREE.WebGLRenderer, camera: THREE.Camera, lighting: LightCulling, journey: FilmJourney,
    city: THREE.Group, courier?: THREE.Group, patrol?: THREE.Group): void {
    if (!this.office || journey.scene !== 'm1_office_escape' || journey.visiting || (journey.step !== 2 && journey.step !== 3)
      || journey.office?.window === undefined || journey.office.crossing !== undefined || journey.office.outcome) {
      this.preparedOfficeWindow = undefined;
      return;
    }
    if (!courier || !patrol || !renderer.extensions.has('KHR_parallel_shader_compile')) return;
    let prepared = this.preparedOfficeWindow;
    if (!prepared || prepared.gpu !== renderer.properties || prepared.courier !== courier || prepared.patrol !== patrol) {
      const lobby = city.getObjectByName('metacortex-city-lobby');
      const meshes = lobby instanceof THREE.Group ? this.colorMeshes([lobby]) : [];
      const hair = this.colorMeshes([patrol]).find(mesh => mesh.name === 'short04');
      if (hair) meshes.push(hair);
      meshes.push(...this.colorMeshes([courier], true));
      const officeMeshes = this.colorMeshes([this.office.root], true);
      const desk = officeMeshes.find(mesh => mesh.material.name === 'metacortex-manager-desk');
      if (desk) meshes.push(desk);
      meshes.push(this.marker);
      for (const name of ['metacortex-floor-sign', 'metacortex-manager-sign']) {
        const sign = officeMeshes.find(mesh => mesh.material.name === name);
        if (sign) meshes.push(sign);
      }
      const textures = new Set<THREE.Texture>();
      if (desk?.material.map) textures.add(desk.material.map);
      this.preparedOfficeWindow = prepared = { scene: this.scene, gpu: renderer.properties, courier, patrol, meshes, programs: [], textures };
    }
    this.prepareColorFrame(renderer, camera, prepared, lighting);
  }
  prepareOfficeDescent(renderer: THREE.WebGLRenderer, camera: THREE.Camera, lighting: LightCulling, city: THREE.Group,
    actor: (id: string) => THREE.Group | undefined): void {
    if (!renderer.extensions.has('KHR_parallel_shader_compile')) return;
    let prepared = this.preparedOfficeDescent;
    if (!prepared || prepared.gpu !== renderer.properties || prepared.city !== city) {
      const lobby = city.getObjectByName('metacortex-city-lobby');
      const sign = lobby instanceof THREE.Group ? this.colorMeshes([lobby]).find(({ material }) =>
        material instanceof THREE.MeshStandardMaterial && material.map && material.emissiveMap) : undefined;
      this.preparedOfficeDescent = prepared = { scene: this.scene, gpu: renderer.properties, city, actors: new Set(),
        meshes: sign ? [sign] : [], programs: [], textures: new Set() };
    }
    // Prepare the color variants that enter view as the camera lowers past the ledge.
    for (const [id, names] of OFFICE_DESCENT_ACTORS) {
      const root = actor(id);
      if (!root || prepared.actors.has(root)) continue;
      const meshes = this.colorMeshes([root]).filter(mesh => names.some(name => name === mesh.name));
      if (meshes.length) { prepared.actors.add(root); prepared.meshes.push(...meshes); }
    }
    const driver = actor('citizen_11');
    if (driver && !prepared.actors.has(driver)) {
      // The nearby driver can still be on the distant model. Prepare the detailed meshes in place.
      const head = driver.getObjectByName('office-driver-head');
      const clothes = this.colorMeshes(driver.children).filter(({ material }) => material instanceof THREE.MeshPhysicalMaterial && material.bumpMap);
      const sleeve = clothes.find(mesh => mesh instanceof THREE.SkinnedMesh);
      const torso = clothes.find(mesh => !(mesh instanceof THREE.SkinnedMesh));
      if (sleeve && torso) {
        prepared.actors.add(driver);
        if (head instanceof THREE.Mesh) prepared.meshes.push(head);
        prepared.meshes.push(sleeve, torso);
      }
    }
    this.prepareColorFrame(renderer, camera, prepared, lighting);
  }
  private cancelOfficePreparation(): void {
    this.preparedOffice?.renderer.dispose();
    this.preparedOffice = undefined;
  }
  prepareLafayette(renderer: THREE.WebGLRenderer, camera: THREE.Camera, lighting: LightCulling, journey?: FilmJourney, actor?: THREE.Group, morpheus?: THREE.Group): void {
    if (!this.meeting || journey?.scene !== 'm1_bug' || journey.visiting || journey.meeting?.phase !== 'outside') return;
    const prepared = this.preparedLafayette ??= { lights: this.lafayetteRoomLights(), meshes: [], programs: [] };
    const set = FILM_SETS.film_lafayette, { x, y, z } = set.center;
    if (!prepared.room && renderer.extensions.has('KHR_parallel_shader_compile')) {
      if (!actor) return;
      if (prepared.actor !== actor) {
        prepared.actor = actor;
        prepared.meshes = this.colorMeshes([actor, this.root]);
      }
      const batch = prepared.meshes.splice(0, 4);
      if (batch.length) {
        const programs = renderer.info.programs, start = programs?.length ?? 0;
        prepared.lights.shell.position.set(x, y - 1, z);
        this.compileColorBatch(renderer, batch, subject => lighting.compileSubject(renderer, camera, subject, prepared.lights.shell));
        if (programs) prepared.programs.push(...programs.slice(start) as ColorProgram[]);
        return;
      }
    }
    if (!prepared.room) {
      const room = prepared.room = new FilmSetRenderer(new THREE.Scene());
      room.current = set;
      room.root.position.set(x, y - 1, z);
      prepared.roomSteps = room.prepareRoomSteps(set, prepared.lights);
    }
    if (prepared.roomSteps) {
      if (prepared.roomSteps.next().done) prepared.roomSteps = undefined;
      return;
    }
    // A linked program still queries its uniform and attribute locations on first use.
    const ready = prepared.programs.findIndex(program => renderer.info.programs?.includes(program) && program.isReady());
    if (ready >= 0) {
      const [program] = prepared.programs.splice(ready, 1);
      program.getUniforms();
      return;
    }
    // The room's key light uses this map in the depth pass before Morpheus appears in the main view.
    const face = morpheus?.getObjectByName('Anatomical_head_and_hands');
    const texture = face instanceof THREE.Mesh && face.material instanceof THREE.MeshStandardMaterial ? face.material.map : null;
    const skin = prepared.skin;
    if (texture?.image && texture.version > 0 && (skin?.texture !== texture || skin.version !== texture.version || skin.gpu !== renderer.properties)) {
      renderer.initTexture(texture);
      prepared.skin = { texture, version: texture.version, gpu: renderer.properties };
    }
  }
  private *prepareRoomSteps(set: FilmSet, lights?: LafayetteRoomLights): Generator<void> {
    if (set.id === 'film_source_corridor') {
      this.sourceDoor = new SourcePortalRenderer(this.root);
      return;
    }
    if (set.id === 'film_architect_room') {
      this.architectRoom = new ArchitectRoomRenderer(this.root);
      return;
    }
    if (set.id === 'film_trinity_roof' && this.currentScene === 'm2_catch') {
      this.catchSet = new ReloadedCatchRenderer(this.root);
      this.catchSet.update();
      return;
    }
    if (set.id === 'film_trainman_subway') {
      this.trainmanChase = new TrainmanChaseRenderer(this.root, true);
      while (!this.trainmanChase.prepareStep()) yield;
      return;
    }
    if (set.id === 'film_hammer_deck' && this.currentScene === 'm3_maggie_discovery') {
      this.maggieDiscovery = new MaggieDiscoveryRenderer(this.root);
      return;
    }
    yield* this.buildSteps(set, lights, true);
    yield* this.batchSteps(true);
    if (set.id === 'film_chateau_hall') this.buildChateauProps();
  }
  private adoptRoomGeometry(room: FilmSetRenderer): void {
    this.root.add(...room.root.children.slice());
    [this.geometries, room.geometries] = [room.geometries, this.geometries];
    [this.materials, room.materials] = [room.materials, this.materials];
    [this.textures, room.textures] = [room.textures, this.textures];
    [this.materialCache, room.materialCache] = [room.materialCache, this.materialCache];
  }
  private adoptOpeningRoom(room: FilmSetRenderer): void {
    this.adoptRoomGeometry(room);
    this.hotel303Door = room.hotel303Door; this.hotel303Glass = room.hotel303Glass; this.hotel303Shards = room.hotel303Shards;
    this.hotel303Pistol = room.hotel303Pistol; this.hotel303DeskLight = room.hotel303DeskLight;
    this.hotel303HallLight = room.hotel303HallLight; this.hotel303Beam = room.hotel303Beam;
    this.hotel303Receiver = room.hotel303Receiver; this.hotel303Cord = room.hotel303Cord;
    this.openingRoofGlass = room.openingRoofGlass; this.openingRoofShards = room.openingRoofShards;
    this.wellsStreet = room.wellsStreet; room.wellsStreet = undefined;
    this.openingReceiver = room.openingReceiver; room.openingReceiver = undefined;
    this.openingBooth = room.openingBooth; this.openingGlass = room.openingGlass; this.openingCord = room.openingCord;
    this.openingBoothParts = room.openingBoothParts; this.openingBoothPanes = room.openingBoothPanes; this.openingGlassPieces = room.openingGlassPieces;
    room.dispose();
  }
  private adoptLafayetteRoom(room: FilmSetRenderer): void {
    this.adoptRoomGeometry(room);
    this.pillGlass = room.pillGlass;
    this.mirror = room.mirror; room.mirror = undefined;
    this.mirrorFilament = room.mirrorFilament;
    this.trackingElectrode = room.trackingElectrode;
    this.trackingLead = room.trackingLead;
    room.dispose();
  }
  private adoptSecondOracleRoom(room: FilmSetRenderer): void {
    this.adoptRoomGeometry(room);
    this.portalDoor = room.portalDoor;
    this.oracleLetter = room.oracleLetter;
    this.courtyardStaff = room.courtyardStaff;
    this.courtyardBirds = room.courtyardBirds;
    this.exileDessert = room.exileDessert;
    this.bookDoor = room.bookDoor;
    this.chateauVolley = room.chateauVolley;
    this.chateauDoor = room.chateauDoor;
    this.garageCar = room.garageCar;
    this.garageGhosts = room.garageGhosts;
    this.sourceDoor = room.sourceDoor; room.sourceDoor = undefined;
    this.architectRoom = room.architectRoom; room.architectRoom = undefined;
    this.catchSet = room.catchSet; room.catchSet = undefined;
    this.oracleDoor = room.oracleDoor;
    this.oracleBlocks = room.oracleBlocks;
    this.oracleVase = room.oracleVase; room.oracleVase = undefined;
    this.oracleVase?.moveTo(this.root);
    this.trainmanChase = room.trainmanChase; room.trainmanChase = undefined;
    this.maggieDiscovery = room.maggieDiscovery; room.maggieDiscovery = undefined;
    room.dispose();
  }
  private cancelLafayettePreparation(): void {
    const prepared = this.preparedLafayette;
    if (prepared?.room) prepared.room.dispose();
    else prepared?.lights.shell.traverse(object => { if (object instanceof THREE.Light) object.dispose(); });
    this.preparedLafayette = undefined;
  }
  prepareLafayetteGround(renderer: THREE.WebGLRenderer, camera: THREE.Camera, lighting: LightCulling, journey: FilmJourney,
    height: number, actors: readonly [THREE.Group | undefined, THREE.Group | undefined]): void {
    const street = this.approach?.root, hotel = this.hotel, [neo, trinity] = actors;
    if (!street?.visible || !hotel || journey.scene !== 'm1_pills' || journey.visiting || height >= LAFAYETTE_SECOND_FLOOR_Y
      || !neo || !trinity || !renderer.extensions.has('KHR_parallel_shader_compile')) return;
    const prepared = this.preparedLafayetteGround ??= { meshes: this.colorMeshes([neo, trinity, hotel.root, street]), programs: [] };
    const programs = renderer.info.programs;
    const ready = prepared.programs.findIndex(program => programs?.includes(program) && program.isReady());
    if (ready >= 0) {
      cacheReadyProgramLocations(renderer, prepared.programs.splice(ready, 1)[0]);
      return;
    }
    const batch = prepared.meshes.splice(0, 4);
    if (!batch.length) return;
    const start = programs?.length ?? 0;
    this.compileColorBatch(renderer, batch, subject => lighting.compileSubject(renderer, camera, subject, undefined, undefined, 'isolated'));
    if (programs) prepared.programs.push(...programs.slice(start) as ColorProgram[]);
  }
  prepareLafayetteLanding(renderer: THREE.WebGLRenderer, camera: THREE.Camera, lighting: LightCulling, journey: FilmJourney,
    height: number, actors: readonly [THREE.Group | undefined, THREE.Group | undefined]): void {
    const street = this.approach?.root, hotel = this.hotel, [neo, trinity] = actors;
    if (!street?.visible || !hotel || journey.scene !== 'm1_pills' || journey.visiting || height < LAFAYETTE_SECOND_FLOOR_Y
      || height >= LAFAYETTE_THIRD_FLOOR_Y || !neo || !trinity || !renderer.extensions.has('KHR_parallel_shader_compile')) return;
    const prepared = this.preparedLafayetteLanding ??= { meshes: this.colorMeshes([neo, trinity, hotel.root]), programs: [] };
    const programs = renderer.info.programs;
    const ready = prepared.programs.findIndex(program => programs?.includes(program) && program.isReady());
    if (ready >= 0) {
      cacheReadyProgramLocations(renderer, prepared.programs.splice(ready, 1)[0]);
      return;
    }
    const batch = prepared.meshes.splice(0, 4), start = programs?.length ?? 0;
    if (!batch.length) return;
    const eye = camera.clone(); eye.position.y += LAFAYETTE.rise;
    const lowerPointSlots = lighting.minimumPointSlots;
    try {
      street.visible = false;
      lighting.minimumPointSlots = 0;
      hotel.updateLights(height - 1 + LAFAYETTE.rise);
      this.compileColorBatch(renderer, batch, subject => lighting.compileSubject(renderer, eye, subject, undefined, undefined, 'isolated'));
      if (programs) prepared.programs.push(...programs.slice(start) as ColorProgram[]);
    } finally {
      street.visible = true;
      lighting.minimumPointSlots = lowerPointSlots;
      hotel.updateLights(height - 1);
    }
  }
  prepareLafayetteUpper(renderer: THREE.WebGLRenderer, camera: THREE.Camera, lighting: LightCulling, journey: FilmJourney,
    height: number, actors: readonly [THREE.Group | undefined, THREE.Group | undefined], crew: readonly (THREE.Group | undefined)[] = []): void {
    if (!this.hotel || this.current?.id !== 'film_lafayette' || !['m1_pills', 'm1_mirror'].includes(journey.scene) || journey.visiting
      || height < LAFAYETTE_THIRD_FLOOR_Y) { this.preparedLafayetteUpper = undefined; return; }
    const [neo, trinity] = actors;
    if (!neo || !trinity || !renderer.extensions.has('KHR_parallel_shader_compile')) return;
    let prepared = this.preparedLafayetteUpper;
    if (!prepared || prepared.gpu !== renderer.properties || prepared.neo !== neo || prepared.trinity !== trinity
      || prepared.sceneId !== journey.scene || prepared.crew.length !== crew.length || prepared.crew.some((actor, index) => actor !== crew[index])) {
      // Room PBR maps attach together after decoding. Prepare the mapped variants.
      for (const texture of this.textures) if (!texture.image) return;
      const meshes = this.colorMeshes([neo, trinity, ...crew.filter((actor): actor is THREE.Group => actor !== undefined), this.root], true), textures = new Set<THREE.Texture>();
      if (journey.scene === 'm1_mirror') for (const name of ['Tracking_arms', 'Tracking_shirt']) {
        const part = neo.getObjectByName(name);
        if (part instanceof THREE.Mesh && part.material instanceof THREE.MeshStandardMaterial && !meshes.includes(part)) meshes.push(part);
      }
      meshes.push(this.marker);
      this.queueColorTextures(textures, meshes);
      this.preparedLafayetteUpper = prepared = { scene: this.scene, gpu: renderer.properties, neo, trinity,
        sceneId: journey.scene, crew: crew.slice(), meshes, eightMeshes: journey.scene === 'm1_pills' ? meshes.slice() : undefined,
        fourMeshes: meshes.slice(), programs: [], textures };
    }
    if (!prepared.meshes.length && !prepared.programs.length) {
      if (prepared.eightMeshes) { prepared.meshes = prepared.eightMeshes; prepared.eightMeshes = undefined; }
      else if (prepared.fourMeshes) { prepared.meshes = prepared.fourMeshes; prepared.fourMeshes = undefined; }
    }
    if (!prepared.meshes.length && !prepared.programs.length && !prepared.textures.size) return;
    // The chair marker adds a ninth slot after the greeting. Prepare it without displaying it early.
    const slots = prepared.eightMeshes ? 9 : prepared.fourMeshes ? 8 : 4;
    const visible = this.markerLight.visible, enabled = lighting.enabled, hidden: THREE.PointLight[] = [];
    try {
      if (slots === 9) this.markerLight.visible = true;
      const pointLights: THREE.PointLight[] = [];
      this.scene.traverseVisible(object => { if (object instanceof THREE.PointLight && !object.castShadow) pointLights.push(object); });
      if (pointLights.length < slots) return;
      hidden.push(...pointLights.slice(slots));
      for (const light of hidden) light.visible = false;
      lighting.enabled = false;
      this.prepareColorFrame(renderer, camera, prepared, lighting, 'isolated');
    } finally {
      lighting.enabled = enabled;
      for (const light of hidden) light.visible = true;
      this.markerLight.visible = visible;
    }
  }
  private colorMeshes(roots: THREE.Object3D[], includeBasic = false): ColorMesh[] {
    const meshes: ColorMesh[] = [];
    for (const root of roots) root.traverseVisible(object => {
      if (object instanceof THREE.Mesh && (object.material instanceof THREE.MeshStandardMaterial
        || includeBasic && object.material instanceof THREE.MeshBasicMaterial)) meshes.push(object);
    });
    return meshes;
  }
  private compileColorBatch(renderer: THREE.WebGLRenderer, batch: ColorSubject[], compile: (subject: THREE.Group) => void): void {
    if (!batch.length) return;
    const subject = new THREE.Group();
    subject.traverse = visit => batch.forEach(visit);
    for (const object of batch) if (object instanceof THREE.SkinnedMesh) {
      if (Array.isArray(object.material)) object.material.forEach(prepareSkinnedMaterial);
      else prepareSkinnedMaterial(object.material);
    }
    const previous = renderer.getRenderTarget(), target = new THREE.WebGLRenderTarget(1, 1);
    try {
      renderer.setRenderTarget(target);
      compile(subject);
    } finally {
      renderer.setRenderTarget(previous);
      target.dispose();
    }
  }
  update(player: AgentState | undefined, sandbox: SandboxState | undefined, elapsed: number, playerPosition?: Vector3, cameraPosition?: Vector3, workday?: OfficeWorkday, firstPerson = false, timeOfDay = 12000, camera?: THREE.Camera, tick = 0, garageCar?: GarageCarPose, departureCharm?: THREE.Vector3): FilmSet | undefined {
    this.resetMirrorFrame?.();
    let set = player ? filmSetAt(player.position, player.isInMatrix) : undefined;
    if (set?.id === 'film_extraction_car' && player?.currentLocation === 'film_adams_bridge') set = FILM_SETS.film_adams_bridge;
    if (set?.id === 'film_adams_bridge' && player?.currentLocation === 'film_extraction_car') set = FILM_SETS.film_extraction_car;
    const journey = sandbox?.neoLife?.journey;
    const sceneId = journey?.visiting ?? journey?.scene;
    if (this.preparedLafayette && set?.id !== 'film_lafayette'
      && (journey?.scene !== 'm1_bug' || journey.visiting || journey.meeting?.phase !== 'outside'))
      this.cancelLafayettePreparation();
    this.dockApuApproach = Boolean(journey && !journey.visiting && (
      journey.scene === 'm3_dock_battle' && journey.step === 0 && (journey.dockGunnery?.phase ?? 'ready') === 'ready'
      || journey.scene === 'm3_gate' && journey.step <= 1 && !journey.apu));
    if (player && player.id === journey?.actor && !journey.visiting && ['m3_defense', 'm3_sun'].includes(journey.scene))
      set = FILM_SETS[logosFlightSet(journey.logos ?? journey.logosEntry ?? newLogosFlight(journey.scene === 'm3_defense' ? 'defense' : 'sun'))];
    if (this.office && set && ['film_metacortex_floor', 'film_office_ledge'].includes(set.id)) { this.current = set; this.currentScene = sceneId; }
    if (this.meeting && set && ['film_adams_bridge', 'film_extraction_car'].includes(set.id)) { this.current = set; this.currentScene = sceneId; }
    if (this.mobil && set?.id === 'film_mobil_station') this.currentScene = sceneId;
    if (this.neb && set?.id === 'film_neb_deck' && !journey?.visiting
      && this.currentScene === 'm1_truth_return' && sceneId === 'm1_download') this.currentScene = sceneId;
    if (this.helStandoff && set?.id === 'film_club_hel' && this.currentScene === 'm3_hel_entry' && sceneId === 'm3_hel_bargain')
      this.currentScene = sceneId;
    // The curb, pill meeting and mirror route use the same hotel.
    if (this.hotel && set?.id === 'film_lafayette'
      && (this.currentScene === 'm1_bug' && sceneId === 'm1_pills'
        || this.currentScene === 'm1_pills' && sceneId === 'm1_mirror' && !journey?.visiting)) this.currentScene = sceneId;
    if (set?.id === 'film_oracle_home' && this.current?.id === set.id && !journey?.visiting
      && this.currentScene === 'm1_spoon' && sceneId === 'm1_oracle') this.currentScene = sceneId;
    if (set?.id === 'film_oracle_courtyard' && this.current?.id === set.id && !journey?.visiting
      && this.currentScene === 'm2_bench' && sceneId === 'm2_burly') this.currentScene = sceneId;
    if (set?.id === 'film_le_vrai' && this.current?.id === set.id && !journey?.visiting
      && this.currentScene === 'm2_merovingian' && sceneId === 'm2_persephone') this.currentScene = sceneId;
    if (this.freeway && set?.id === 'film_freeway_101' && this.current?.id === set.id && !journey?.visiting
      && this.currentScene === 'm2_freeway' && sceneId === 'm2_trucks' && journey?.trucks?.road) this.currentScene = sceneId;
    if (this.theOne?.setId === 'film_heart_hotel' && set?.id === 'film_heart_hotel' && !journey?.visiting
      && this.currentScene === 'm1_death' && sceneId === 'm1_return') this.currentScene = sceneId;
    if (this.ambush && set?.id === 'film_ambush_house' && !journey?.visiting && (
      this.currentScene === 'm1_dejavu' && sceneId === 'm1_wetwall'
      || this.currentScene === 'm1_wetwall' && sceneId === 'm1_wall_exposed'
      || this.currentScene === 'm1_wall_exposed' && sceneId === 'm1_bathroom')) this.currentScene = sceneId;
    // The drills, APU and gate continue in the same battle-damaged hangar.
    if (this.zion?.set === 'film_zion_hangar' && set?.id === 'film_zion_hangar' && !journey?.visiting && (
      this.currentScene === 'm3_diggers' && sceneId === 'm3_upper_digger'
      || this.currentScene === 'm3_upper_digger' && sceneId === 'm3_dock_battle'
      || this.currentScene === 'm3_dock_battle' && sceneId === 'm3_gate')) this.currentScene = sceneId;
    if (this.logosFlight && set?.id === this.current?.id && ['m3_defense', 'm3_sun'].includes(sceneId ?? '')
      && ['m3_defense', 'm3_sun'].includes(this.currentScene ?? '')) this.currentScene = sceneId;
    // Both chapters continue on the same damaged avenue and reflection pass.
    if (this.smithFinale && set?.id === 'film_smith_avenue' && !journey?.visiting
      && this.currentScene === 'm3_rain' && sceneId === 'm3_surrender') this.currentScene = sceneId;
    const keepCrosscut = crosscutActive(journey) && (set?.id === 'film_tv_repair' || set?.id === 'film_neb_deck');
    if (set?.id !== this.current?.id || sceneId !== this.currentScene || !keepCrosscut && Boolean(this.crosscutTv || this.crosscutDeck)) {
      const visit = this.preparedOpeningVisit;
      const preparedVisit = visit && !visit.steps && visit.scene === journey?.visiting && visit.actor === player?.id
        && visit.room.current?.id === set?.id ? visit : undefined;
      if (preparedVisit) { this.preparedOpeningVisit = undefined; clearTimeout(preparedVisit.release); }
      const preparedOpening = this.preparedOpening && set?.id === this.preparedOpening.room.current?.id
        && sceneId === this.preparedOpening.scene && !journey?.visiting ? this.preparedOpening : undefined;
      if (preparedOpening) {
        this.preparedOpening = undefined;
        preparedOpening.textureUpload?.return(false); preparedOpening.lighting?.dispose();
      }
      const enteringOffice = set?.id === 'film_metacortex_floor' || set?.id === 'film_office_ledge';
      const prepared = enteringOffice ? this.preparedOffice?.renderer : undefined;
      if (prepared) this.preparedOffice = undefined;
      const preparedInterrogation = set?.id === 'film_agent_interrogation' && sceneId === 'm1_interrogation' && !journey?.visiting
        ? this.preparedInterrogation : undefined;
      if (preparedInterrogation) { this.preparedInterrogation = undefined; preparedInterrogation.lighting?.dispose(); }
      const lafayetteRoom = set?.id === 'film_lafayette' ? this.preparedLafayette : undefined;
      if (lafayetteRoom) this.preparedLafayette = undefined;
      const preparedPods = set?.architecture === 'pods' && sceneId === 'm1_pod' && !journey?.visiting ? this.preparedPods : undefined;
      if (preparedPods) this.preparedPods = undefined;
      const preparedAmbush = set?.id === 'film_ambush_house' && sceneId === 'm1_dejavu' && !journey?.visiting ? this.preparedAmbush?.renderer : undefined;
      if (preparedAmbush) { this.preparedAmbush?.lighting?.dispose(); this.preparedAmbush = undefined; }
      const preparedTvExit = set?.id === 'film_tv_repair' && sceneId === 'm1_tv_exit' && !journey?.visiting ? this.preparedTvExit : undefined;
      if (preparedTvExit) { this.preparedTvExit = undefined; preparedTvExit.lighting?.dispose(); }
      const preparedLobby = set?.id === 'film_government_lobby' && sceneId === 'm1_lobby' && !journey?.visiting ? this.preparedLobby : undefined;
      if (preparedLobby) { this.preparedLobby = undefined; preparedLobby.lighting?.dispose(); preparedLobby.root.removeFromParent(); }
      const preparedGovernment = set?.id === this.preparedGovernment?.renderer.setId && sceneId === this.preparedGovernment?.scene && !journey?.visiting ? this.preparedGovernment : undefined;
      if (preparedGovernment) {
        this.preparedGovernment = undefined; preparedGovernment.textureUpload?.return(false);
        preparedGovernment.lighting?.dispose(); preparedGovernment.root.removeFromParent();
      }
      const preparedEscape = (sceneId === 'm1_subway' || sceneId === 'm1_city_chase' || sceneId === 'm1_death')
        && set?.id === this.preparedMatrixEscape?.renderer.setId && !journey?.visiting ? this.preparedMatrixEscape : undefined;
      if (preparedEscape) {
        this.preparedMatrixEscape = undefined; preparedEscape.textureUpload?.return(false);
        preparedEscape.lighting?.dispose(); preparedEscape.root.removeFromParent();
      }
      const preparedOneDeck = set?.id === 'film_neb_deck' && (sceneId === 'm1_death' || sceneId === 'm1_return') && !journey?.visiting ? this.preparedOneDeck : undefined;
      if (preparedOneDeck) this.preparedOneDeck = undefined;
      const preparedTruthReturn = set?.id === 'film_neb_deck' && sceneId === this.preparedTruthReturn?.scene && !journey?.visiting ? this.preparedTruthReturn : undefined;
      if (preparedTruthReturn) { this.preparedTruthReturn = undefined; preparedTruthReturn.lighting?.dispose(); preparedTruthReturn.root.removeFromParent(); }
      const preparedClub = set?.id === 'film_white_rabbit_club' && sceneId === 'm1_club' && !journey?.visiting ? this.preparedClub : undefined;
      if (preparedClub) {
        this.preparedClub = undefined; preparedClub.textureUpload?.return(false);
        preparedClub.lighting?.dispose(); preparedClub.root.removeFromParent();
      }
      const preparedDojo = set?.id === 'film_kungfu_dojo' && sceneId === 'm1_dojo' && !journey?.visiting ? this.preparedDojo : undefined;
      if (preparedDojo) { this.preparedDojo = undefined; preparedDojo.lighting?.dispose(); preparedDojo.root.removeFromParent(); }
      const preparedJump = set?.id === 'film_jump_roofs' && sceneId === 'm1_jump' && !journey?.visiting ? this.preparedJump : undefined;
      if (preparedJump) { this.preparedJump = undefined; preparedJump.lighting?.dispose(); preparedJump.root.removeFromParent(); }
      const preparedRedDress = set?.id === 'film_red_dress_plaza' && sceneId === 'm1_red_dress' && !journey?.visiting ? this.preparedRedDress : undefined;
      if (preparedRedDress) {
        this.preparedRedDress = undefined; preparedRedDress.textureUpload?.return(false);
        preparedRedDress.lighting?.dispose(); preparedRedDress.root.removeFromParent();
      }
      const preparedSentinel = set?.id === 'film_service_tunnels' && sceneId === 'm1_sentinels' && !journey?.visiting ? this.preparedSentinel : undefined;
      if (preparedSentinel) { this.preparedSentinel = undefined; preparedSentinel.lighting?.dispose(); preparedSentinel.root.removeFromParent(); }
      const preparedConsole = set?.id === 'film_neb_deck' && sceneId === 'm1_cypher_console' && !journey?.visiting ? this.preparedConsole : undefined;
      if (preparedConsole) { this.preparedConsole = undefined; preparedConsole.lighting?.dispose(); preparedConsole.root.removeFromParent(); }
      const preparedRestaurant = set?.id === 'film_cypher_restaurant' && sceneId === 'm1_steak' && !journey?.visiting ? this.preparedRestaurant : undefined;
      if (preparedRestaurant) {
        this.preparedRestaurant = undefined; preparedRestaurant.textureUpload?.return(false);
        preparedRestaurant.lighting?.dispose(); preparedRestaurant.root.removeFromParent();
      }
      const preparedMeal = set?.id === 'film_neb_deck' && sceneId === 'm1_meal' && !journey?.visiting ? this.preparedMeal : undefined;
      if (preparedMeal) { this.preparedMeal = undefined; preparedMeal.lighting?.dispose(); preparedMeal.root.removeFromParent(); }
      const preparedMeeting = set?.id === 'film_captains_meeting' && sceneId === 'm2_meeting' && !journey?.visiting ? this.preparedMeetingHall?.renderer : undefined;
      if (preparedMeeting) this.preparedMeetingHall = undefined;
      const preparedZion = this.preparedZion && set?.id === this.preparedZion.renderer.set
        && sceneId === this.preparedZion.scene && !journey?.visiting ? this.preparedZion.renderer : undefined;
      if (preparedZion) this.preparedZion = undefined;
      const preparedBaneCopy = set?.id === 'film_industrial_loft' && sceneId === 'm2_bane_copy' && !journey?.visiting ? this.preparedBaneCopy?.renderer : undefined;
      if (preparedBaneCopy) this.preparedBaneCopy = undefined;
      const reunionExterior = journey?.scene === 'm3_dock_reunion' && !journey.visiting && Boolean(journey.emp);
      const retainedEmpDock = reunionExterior ? this.empDock : undefined;
      if (retainedEmpDock) this.empDock = undefined;
      const preparedSecondOracle = this.preparedSecondOracle && set?.id === this.preparedSecondOracle.room.current?.id
        && sceneId === this.preparedSecondOracle.scene && !journey?.visiting ? this.preparedSecondOracle : undefined;
      if (preparedSecondOracle) {
        this.preparedSecondOracle = undefined; preparedSecondOracle.textureUpload?.return(false);
        preparedSecondOracle.lighting?.dispose();
      }
      const preparedMountain = set?.id === 'film_mountain_range' && sceneId === 'm2_mountain' && !journey?.visiting ? this.preparedMountain : undefined;
      if (preparedMountain) this.preparedMountain = undefined;
      const preparedFreeway = set?.id === 'film_freeway_101' && sceneId === 'm2_freeway' && !journey?.visiting ? this.preparedFreeway?.renderer : undefined;
      if (preparedFreeway) this.preparedFreeway = undefined;
      const previewDesert = set?.id === 'film_real_desert' && sceneId === 'm1_desert' && !journey?.visiting ? this.construct?.takePreviewDesert() : undefined;
      const approach = set?.id === 'film_lafayette' && this.meeting ? { root: new THREE.Group(), renderer: this.meeting } : undefined;
      const transferredHotel = approach?.renderer.moveStreet(approach.root);
      if (approach) this.meeting = undefined;
      if (keepCrosscut && this.tvRepair) {
        this.crosscutTv = this.tvRepair; this.tvRepair.root.removeFromParent(); this.tvRepair = undefined;
      }
      if (keepCrosscut && this.neb && this.crosscutDeck?.renderer === this.neb) {
        this.crosscutDeck.root.removeFromParent(); this.neb = undefined;
      }
      this.clear(keepCrosscut); this.current = set; this.currentScene = sceneId;
      this.empDock = retainedEmpDock;
      if (set) this.root.position.set(set.center.x, set.center.y - 1, set.center.z);
      // LifeInteriors owns the persistent city apartment, even while another actor plays a remote chapter.
      if (set && set.id !== 'film_anderson_flat') {
        if (enteringOffice) {
          this.office = prepared ?? new OfficeSetRenderer(this.root, set);
          prepared?.attach(this.root, set);
        }
        else if (set.id === 'film_white_rabbit_club') {
          this.club = preparedClub?.renderer ?? new ClubSetRenderer(this.root);
          if (preparedClub) this.root.add(preparedClub.root);
          else void this.club.ready.catch(error => console.error('夜店人群加载失败', error));
        }
        else if (set.id === 'film_government_office' || set.id === 'film_government_roof') {
          this.government = preparedGovernment?.renderer ?? new GovernmentSetRenderer(this.root, set.id);
          if (preparedGovernment) this.root.add(preparedGovernment.root);
        }
        else if (sceneId === 'm3_bane' && set.id === 'film_logos_deck') { this.logosBane = new LogosBaneRenderer(this.root); void this.logosBane.ready.catch(error => console.error('金色 Smith 加载失败', error)); }
        else if (sceneId === 'm3_bane_questions' && set.id === 'film_hammer_deck') this.baneInquiry = new BaneInquiryRenderer(this.root);
        else if (sceneId === 'm3_maggie_discovery' && set.id === 'film_hammer_deck' && !preparedSecondOracle) this.maggieDiscovery = new MaggieDiscoveryRenderer(this.root);
        else if (sceneId === 'm3_logos_plan' && set.id === 'film_hammer_deck') this.hammerBriefing = new HammerBriefingRenderer(this.root);
        else if (set.id === 'film_zion_defense_council') this.zionDeployment = new ZionDeploymentRenderer(this.root);
        else if (set.id === 'film_trainman_subway' && !preparedSecondOracle) this.trainmanChase = new TrainmanChaseRenderer(this.root);
        else if (set.id === 'film_hel_garage') this.helGarage = new HelGarageRenderer(this.root, player!);
        else if (sceneId === 'm1_subway' && set.id === 'film_subway_platform' || sceneId === 'm1_city_chase' && set.id === 'film_escape_streets') {
          if (preparedEscape?.renderer instanceof MatrixEscapeRenderer) {
            this.matrixEscape = preparedEscape.renderer; this.matrixEscape.attach(this.root);
          } else this.matrixEscape = new MatrixEscapeRenderer(this.root, set.id);
        }
        else if (['m1_death', 'm1_return', 'm1_final_call'].includes(sceneId ?? '') && (set.id === 'film_heart_hotel' || set.id === 'film_final_phone')) {
          if (preparedEscape?.renderer instanceof TheOneRenderer) {
            this.theOne = preparedEscape.renderer; this.root.add(preparedEscape.root);
          } else this.theOne = new TheOneRenderer(this.root, set.id);
        }
        else if (['m2_dream', 'm2_meeting'].includes(sceneId ?? '') && (set.id === 'film_trinity_roof' || set.id === 'film_captains_meeting')) {
          this.reloaded = preparedMeeting ?? new ReloadedOpeningRenderer(this.root, set.id);
          if (preparedMeeting) this.root.add(preparedMeeting.group);
        }
        else if (sceneId === 'm2_catch' && set.id === 'film_trinity_roof' && !preparedSecondOracle) this.catchSet = new ReloadedCatchRenderer(this.root);
        else if (sceneId === 'm2_bane_copy' && set.id === 'film_industrial_loft') {
          this.baneCopy = preparedBaneCopy ?? new BaneCopyRenderer(this.root);
          if (preparedBaneCopy) this.root.add(preparedBaneCopy.group);
        }
        else if (['film_zion_dock_exit', 'film_zion_command_bunker'].includes(set.id)) this.dockEvacuation = new DockEvacuationRenderer(this.root, set.id === 'film_zion_command_bunker');
        else if (set.id === 'film_zion_personnel') this.dockBriefing = new DockBriefingRenderer(this.root);
        else if (set.id === 'film_zion_hangar' && reunionExterior) this.empDock ??= new DockEmpRenderer(this.scene);
        else if (['film_zion_hangar', 'film_zion_council', 'film_zion_residences', 'film_zion_temple', 'film_zion_bedroom', 'film_zion_engineering'].includes(set.id)) {
          this.zion = preparedZion ?? new ZionHomecomingRenderer(this.root, set.id, sceneId);
          if (preparedZion) this.root.add(preparedZion.group);
        }
        else if (set.architecture === 'lobby') {
          this.lobby = preparedLobby?.renderer ?? new LobbySetRenderer(this.root, set);
          if (preparedLobby) this.root.add(preparedLobby.root);
        }
        else if (set.architecture === 'freeway') {
          this.freeway = preparedFreeway ?? new FreewaySetRenderer(this.root, set);
          preparedFreeway?.attach(this.root);
        }
        else if (set.architecture === 'pods') {
          this.pods = preparedPods ?? new PodSetRenderer();
          this.pods.attach(this.root);
        }
        else if (set.id === 'film_neb_deck') {
          if (preparedTruthReturn) {
            this.root.add(preparedTruthReturn.root); this.neb = preparedTruthReturn.deck;
          } else if (preparedConsole) {
            this.root.add(preparedConsole.root); this.neb = preparedConsole.deck;
          } else if (preparedMeal) {
            this.root.add(preparedMeal.root); this.neb = preparedMeal.deck;
          } else if (preparedOneDeck) {
            this.root.add(preparedOneDeck.root); this.neb = preparedOneDeck.deck; this.theOne = preparedOneDeck.overlay;
          } else if (keepCrosscut) {
            if (!this.crosscutDeck) {
              const root = new THREE.Group();
              this.crosscutDeck = { root, renderer: new NebDeckRenderer(root) };
            }
            this.root.add(this.crosscutDeck.root); this.neb = this.crosscutDeck.renderer;
          } else this.neb = new NebDeckRenderer(this.root);
        }
        else if (set.id === 'film_operation_room') this.sourceBriefing = new SourceBriefingRenderer(this.root);
        else if (set.id === 'film_power_station') this.primaryDemolition = new PrimaryDemolitionRenderer(this.root);
        else if (set.id === 'film_source_corridor' && !preparedSecondOracle) this.sourceDoor = new SourcePortalRenderer(this.root);
        else if (set.id === 'film_architect_room' && !preparedSecondOracle) this.architectRoom = new ArchitectRoomRenderer(this.root);
        else if (set.id === 'film_mobil_station') {
          this.mobil = new MobilStationRenderer(this.root);
          this.resetMirrorFrame = showMirrorSubject(this.mobil.reflection, () => this.mirrorSubject);
        }
        else if (set.id === 'film_backup_station') this.trinityTerminal = new TrinityTerminalRenderer(this.root);
        else if (set.id === 'film_cypher_restaurant') {
          this.restaurant = preparedRestaurant?.renderer ?? new CypherRestaurantRenderer(this.root);
          if (preparedRestaurant) this.root.add(preparedRestaurant.root);
        }
        else if (set.id === 'film_white_construct') this.construct = new ConstructRenderer(this.root, sceneId);
        else if (set.id === 'film_real_desert') {
          this.desert = previewDesert ?? new DesertRenderer(this.root);
          previewDesert?.moveTo(this.root);
        }
        else if (set.id === 'film_mountain_range') {
          if (preparedMountain) this.root.add(preparedMountain.root);
          this.mountain = preparedMountain?.renderer ?? new MountainSetRenderer(this.root);
        }
        else if (set.id === 'film_hammer_route') this.hammerRoute = new HammerRouteRenderer(this.root);
        else if (set.id === 'film_machine_defense' || set.id === 'film_above_clouds') this.logosFlight = new LogosFlightRenderer(this.root, set.id === 'film_machine_defense' ? 'defense' : 'sun');
        else if (set.id === 'film_logos_wreck') this.logosWreck = new LogosWreckRenderer(this.root);
        else if (['m3_deus', 'm3_neo_carried'].includes(sceneId ?? '') && set.id === 'film_machine_core') this.machineCore = new MachineCoreRenderer(this.root);
        else if (set.id === 'film_smith_avenue') this.smithFinale = new SmithFinaleRenderer(this.root);
        else if (set.id === 'film_sunrise_garden') this.trilogyEpilogue = new TrilogyEpilogueRenderer(this.root, 'dawn');
        else if (sceneId === 'm3_reset' && set.id === 'film_escape_streets') this.trilogyEpilogue = new TrilogyEpilogueRenderer(this.root, 'reset');
        else if (['m1_dojo', 'm1_jump', 'm1_red_dress'].includes(sceneId ?? '')) {
          this.training = preparedDojo?.renderer ?? preparedJump?.renderer ?? preparedRedDress?.renderer ?? new TrainingSetRenderer(this.root, sceneId!);
          if (preparedDojo) this.root.add(preparedDojo.root);
          if (preparedJump) this.root.add(preparedJump.root);
          if (preparedRedDress) this.root.add(preparedRedDress.root);
        }
        else if (sceneId === 'm1_sentinels') {
          this.sentinel = preparedSentinel?.renderer ?? new SentinelSetRenderer(this.root);
          if (preparedSentinel) this.root.add(preparedSentinel.root);
        }
        else if (set.id === 'film_ambush_house' && sceneId === 'm1_basement') this.basement = new BasementSetRenderer(this.root);
        else if (set.id === 'film_ambush_house') {
          this.ambush = preparedAmbush ?? new AmbushSetRenderer();
          this.ambush.attach(this.root);
        }
        else if (set.id === 'film_tv_repair') {
          this.tvRepair = (keepCrosscut ? this.crosscutTv : undefined) ?? preparedTvExit?.renderer ?? new TvRepairRenderer(this.root);
          if (keepCrosscut || preparedTvExit) this.root.add(this.tvRepair.root);
        }
        else if (set.id === 'film_agent_interrogation') {
          this.interrogation = preparedInterrogation?.renderer ?? new InterrogationSetRenderer();
          this.interrogation.attach(this.root);
        }
        else if (set.id === 'film_adams_bridge' || set.id === 'film_extraction_car') this.meeting = new MeetingSetRenderer(this.root);
        else if (sceneId === 'm2_stop_sentinels' && set.id === 'film_service_tunnels') this.finale = new ReloadedFinaleRenderer(this.root, sceneId);
        else if (sceneId === 'm2_medical' && set.id === 'film_hammer_deck') this.finale = new ReloadedFinaleRenderer(this.root, sceneId);
        else {
          if (preparedVisit) this.adoptOpeningRoom(preparedVisit.room);
          else if (preparedOpening) {
            if (preparedOpening.steps) for (const _ of preparedOpening.steps) { /* Finish an early handoff. */ }
            this.adoptOpeningRoom(preparedOpening.room);
          } else if (lafayetteRoom?.room) {
            if (lafayetteRoom.roomSteps) for (const _ of lafayetteRoom.roomSteps) { /* Finish the room if the door is reached early. */ }
            this.adoptLafayetteRoom(lafayetteRoom.room);
          } else if (preparedSecondOracle) {
            if (preparedSecondOracle.steps) for (const _ of preparedSecondOracle.steps) { /* Finish an early handoff. */ }
            this.adoptSecondOracleRoom(preparedSecondOracle.room);
          } else {
            this.build(set, lafayetteRoom?.lights); this.batch();
          }
          if (['m3_oracle_last', 'm3_oracle_absorbed'].includes(sceneId ?? '') && set.id === 'film_oracle_home') this.oracleLast = new OracleLastRenderer(this.root);
          if (sceneId === 'm3_oracle_absorbed' && set.id === 'film_oracle_home') this.oracleAbsorption = new OracleAbsorptionRenderer(this.root);
          if (sceneId === 'm3_oracle_absorbed' && set.id === 'film_oracle_home'
            || ['m3_bane_questions', 'm3_logos_plan', 'm3_emp'].includes(sceneId ?? '') && set.id === 'film_hammer_deck')
            this.revolutionsPrelude = new RevolutionsPreludeRenderer(this.root, sceneId as 'm3_oracle_absorbed' | 'm3_bane_questions' | 'm3_logos_plan' | 'm3_emp');
          if (set.id === 'film_club_hel' && typeof window !== 'undefined') {
            this.helPerformers = new HelClubPerformers(this.root);
            void this.helPerformers.ready.catch(error => console.error('Club Hel 演员加载失败', error));
          }
          if (set.architecture === 'power') this.createPowerStatus(set);
          if (set.id === 'film_chateau_hall' && !this.chateauDoor) this.buildChateauProps();
          if (set.id === 'film_lafayette') {
            if (this.mirror) this.resetMirrorFrame = showMirrorSubject(this.mirror, () => this.mirrorSubject,
              () => [this.trackingElectrode!, this.trackingLead!].filter(object => object.userData.active));
            const offset = new THREE.Vector3(0, -LAFAYETTE.upper, 0);
            this.hotel = transferredHotel ?? new LafayetteApproachRenderer(this.root, offset);
            transferredHotel?.attachInterior(this.root, offset);
            const root = approach?.root ?? new THREE.Group(); root.position.set(-MEETING_DESTINATION.x, -LAFAYETTE.upper, 0); this.root.add(root);
            this.approach = approach ?? { root, renderer: new MeetingSetRenderer(root, false) };
          }
        }
        if (sceneId === 'm2_meeting' && set.id === 'film_neb_deck') this.reloaded = new ReloadedOpeningRenderer(this.root, set.id);
        if (!this.theOne && ['m1_death', 'm1_return'].includes(sceneId ?? '') && set.id === 'film_neb_deck') this.theOne = new TheOneRenderer(this.root, set.id);
        if (sceneId === 'm3_ceasefire') this.trilogyEpilogue = new TrilogyEpilogueRenderer(this.root, 'ceasefire');
        if (sceneId === 'm3_neo_carried') this.trilogyEpilogue = new TrilogyEpilogueRenderer(this.root, 'neo_carried');
      }
    }
    if (this.mirror) {
      const healing = journey?.scene === 'm1_mirror' && !journey.visiting;
      const time = mirrorTime(journey?.awakening);
      const progress = !healing ? 0 : journey!.step > 0 ? 1 : THREE.MathUtils.smoothstep(time, MIRROR_TIMING.wired, MIRROR_TIMING.touch - .12);
      const shader = this.mirror.material as THREE.ShaderMaterial;
      shader.uniforms.healProgress.value = progress;
      shader.uniforms.liquidTime.value = healing ? time - MIRROR_TIMING.touch : -1;
      shader.uniforms.liquidAmount.value = healing ? mirrorSilver(time) : 0;
      if (healing && player?.id === 'neo' && this.mirrorSubject && time <= MIRROR_TIMING.touch + .05) {
        const contact = mirrorSurfacePoint(this.mirror, this.mirrorSubject);
        if (contact) shader.uniforms.liquidContact.value.copy(contact);
      }
      const finger = this.mirrorSubject?.getObjectByName('finger2-3_R');
      if (this.mirrorFilament) {
        this.mirrorFilament.visible = Boolean(healing && finger && time >= MIRROR_TIMING.touch && time < MIRROR_TIMING.touch + 1.17);
        if (this.mirrorFilament.visible) {
          const contact = shader.uniforms.liquidContact.value as THREE.Vector2;
          const start = this.root.worldToLocal(this.mirror.localToWorld(new THREE.Vector3(contact.x, contact.y, .006)));
          const end = this.root.worldToLocal(finger!.getWorldPosition(new THREE.Vector3()));
          const stretch = end.sub(start); const radius = .35 * (1 - THREE.MathUtils.smoothstep(time, MIRROR_TIMING.touch + .82, MIRROR_TIMING.touch + 1.17));
          this.mirrorFilament.position.copy(start);
          this.mirrorFilament.scale.set(radius, stretch.length(), radius);
          this.mirrorFilament.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), stretch.normalize());
        }
      }
    }
    if (this.trackingElectrode && this.trackingLead) {
      const contact = this.mirrorSubject && trackingContact(this.mirrorSubject);
      const visible = Boolean(contact && journey?.scene === 'm1_mirror' && !journey.visiting && mirrorTime(journey.awakening) >= MIRROR_TIMING.sit);
      this.trackingElectrode.userData.active = this.trackingLead.userData.active = visible;
      this.trackingElectrode.visible = this.trackingLead.visible = visible && this.mirrorSubject?.visible !== false;
      if (visible) {
        this.trackingElectrode.position.copy(this.root.worldToLocal(contact!));
        const end = this.trackingElectrode.position;
        const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-14.7, 2.1, -17.7), new THREE.Vector3(-12, .13, -15),
          new THREE.Vector3(end.x + .5, .18, end.z + .5), end]);
        const positions = this.trackingLead.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) { const point = curve.getPoint(i / (positions.count - 1)); positions.setXYZ(i, point.x, point.y, point.z); }
        positions.needsUpdate = true; this.trackingLead.geometry.computeBoundingSphere();
      }
    }
    if (this.pillGlass) {
      const gesture = sceneId === 'm1_pills' && !journey?.visiting ? player?.currentAction?.parameters.pills as PillGesture | undefined : undefined;
      const pose = gesture ? pillPose(gesture) : undefined;
      this.pillGlass.visible = !pose?.holdingCup;
      const used = pose?.cupUsed || journey?.pills?.phase === 'done';
      for (const water of this.pillGlass.getObjectsByProperty('name', 'pill-water-level')) { water.scale.y = used ? .45 : 1; water.position.y = used ? -.12 : -.04; }
    }
    this.lobby?.update(journey, elapsed);
    this.interrogation?.update(journey);
    this.meeting?.update(journey, elapsed, player?.id === journey?.actor ? player?.currentAction?.parameters.meeting as MeetingGesture | undefined : undefined);
    this.hotel?.update(journey?.visiting ? undefined : journey?.hotel, (playerPosition?.y ?? 1) - 1);
    if (this.approach) {
      this.approach.root.visible = (playerPosition?.y ?? 1) < LAFAYETTE_THIRD_FLOOR_Y;
      if (this.approach.root.visible) this.approach.renderer.update(journey, elapsed, { phase: 'parked', elapsed: 0, role: 'neo', bugged: false });
    }
    this.office?.update(journey, cameraPosition, playerPosition, workday, elapsed, timeOfDay, camera);
    if (this.hotel303Door && this.hotel303Glass && this.hotel303Shards) {
      const hotel = sceneId === 'm1_room303' && !journey?.visiting ? journey?.openingHotel : undefined;
      const actor = player?.id === journey?.actor ? player : undefined;
      this.hotel303Door.rotation.y = openingHotelDoorAngle(hotel, openingHotelBreachTime(hotel, actor));
      this.updateHotel303Hall(actor && openingHotelHallTime(hotel, openingHotelTraceTime(hotel, actor)));
      const broken = openingHotelGlassBroken(hotel);
      this.hotel303Glass.visible = !broken; this.hotel303Shards.visible = broken;
      if (broken && hotel) {
        const action = player?.id === journey?.actor ? player?.currentAction?.parameters.hotel303 as { phase: string; elapsed: number } | undefined : undefined;
        const time = action?.phase === 'dive' ? Math.max(hotel.elapsed, action.elapsed) : hotel.elapsed;
        this.poseHotel303Shards(hotel.phase === 'dive' ? Math.max(0, time - openingHotelGlassTime(hotel)) : Infinity);
      }
      if (this.hotel303Pistol) {
        this.hotel303Pistol.visible = Boolean(hotel?.fallen && !hotel.disarmed && hotel.phase === 'combat');
        if (hotel?.fallen) this.hotel303Pistol.position.set(hotel.fallen.x - this.current!.center.x, .12, hotel.fallen.z - this.current!.center.z);
      }
      if (this.hotel303DeskLight) {
        const alley = openingHotelLanded(hotel), light = this.hotel303DeskLight;
        // Reuse the room's light slot once the performer is outside.
        light.position.set(alley ? 2.4 : -9.5, alley ? OPENING_HOTEL.alley.y + 5.25 : 4.8,
          alley ? OPENING_HOTEL.alley.back + 1.15 : OPENING_HOTEL.computer.z);
        light.intensity = alley ? 125 : 180;
        light.distance = alley ? 15 : 18;
      }
      this.updateHotelPhone(hotel?.phase === 'answering' ? hotel.elapsed : undefined);
    }
    if (this.openingRoofGlass && this.openingRoofShards) {
      const exit = sceneId === 'm1_roofs' && !journey?.visiting ? player?.currentAction?.parameters.roofExit as { elapsed: number } | undefined : undefined;
      const broken = openingRoofGlassBroken(journey?.scene === 'm1_roofs' && !journey.visiting ? journey.openingRoof : undefined, exit?.elapsed);
      this.openingRoofGlass.visible = !broken; this.openingRoofShards.visible = broken;
    }
    if (this.wellsStreet && this.openingBooth && this.openingGlass) {
      const phone = sceneId === 'm1_phone_escape' && !journey?.visiting ? journey?.openingPhone : undefined;
      const pose = openingTruckPose(phone ?? { phase: 'running', remaining: OPENING_ESCAPE.phoneSeconds, lastTick: 0, attempts: 0, curbside: true });
      this.wellsStreet.update(pose, wellsAftermathDoor(phone?.aftermath?.elapsed));
      const sidewalk = pose.curbside ? WELLS_CURB.height : 0;
      this.openingBooth.position.y = this.openingGlass.position.y = sidewalk;
      const crush = openingBoothCrush(pose);
      for (const part of this.openingBoothParts) {
        const placed = openingBoothPartPose(part.kind, part.x, part.z, pose, crush);
        part.root.position.set(placed.x, placed.y, placed.z);
        part.root.rotation.set(placed.pitch, placed.yaw, placed.roll);
      }
      const broken = crush > WELLS_BOOTH.glassBreakCrush, scatter = THREE.MathUtils.smoothstep(crush, WELLS_BOOTH.glassBreakCrush, 4);
      for (const pane of this.openingBoothPanes) pane.visible = !broken;
      this.openingGlass.visible = broken;
      this.openingGlassPieces.forEach(({ mesh, origin, side }, i) => {
        const z = origin.z - (crush + 2 + i % 7 * .45) * scatter;
        const bounds = mesh.geometry.boundingSphere!;
        mesh.position.set(origin.x + side * (1.7 + i % 5 * .35) * scatter,
          THREE.MathUtils.lerp(origin.y, .08, scatter) + Math.sin(Math.PI * scatter) * (.35 + i % 4 * .18),
          pose.curbside ? Math.max(z, WELLS_CURB.wallZ - OPENING_PHONE.boothZ + bounds.radius + bounds.center.length()) : z);
        mesh.rotation.set(Math.sin(Math.PI * scatter) * (i % 3 - 1) * .6, i * 2.399 * scatter, side * Math.PI / 2 * scatter);
      });
      if (this.openingReceiver && this.openingCord) {
        const held = Boolean(phone?.answer && phone.answer.elapsed >= OPENING_PHONE.graspSeconds);
        const receiver = this.openingReceiver.root, discarded = Boolean(phone?.aftermath);
        receiver.visible = discarded || !held;
        const subject = held && !phone?.hit && (phone?.phase === 'answering' || phone?.phase === 'failed') ? this.phoneBodies?.('trinity')?.getObjectByName('hardline-handset') : undefined;
        const parent = this.openingCord.parent!; parent.updateWorldMatrix(true, true);
        if (discarded) {
          const { x, y, z } = WELLS_AFTERMATH.receiver;
          receiver.position.copy(parent.worldToLocal(this.root.localToWorld(new THREE.Vector3(x, y + sidewalk, z))));
          receiver.quaternion.copy(parent.getWorldQuaternion(new THREE.Quaternion()).invert()
            .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, .4))));
        } else {
          receiver.position.set(OPENING_PHONE.receiver.x, OPENING_PHONE.receiver.y, OPENING_PHONE.receiver.z - OPENING_PHONE.boothZ);
          receiver.quaternion.identity();
        }
        const from = new THREE.Vector3(0, 3.1, .4), to = subject
          ? parent.worldToLocal(subject.getWorldPosition(new THREE.Vector3())) : new THREE.Vector3(-.75, held ? 2.8 : 3.7, .55);
        const positions = this.openingCord.geometry.attributes.position, point = new THREE.Vector3();
        for (let i = 0; i < positions.count; i++) {
          const t = i / (positions.count - 1); point.copy(from).lerp(to, t); point.y -= Math.sin(t * Math.PI) * .35;
          point.x += Math.sin(t * Math.PI * 36) * .035; point.z += Math.cos(t * Math.PI * 36) * .035;
          positions.setXYZ(i, point.x, point.y, point.z);
        }
        positions.needsUpdate = true; this.openingCord.geometry.computeBoundingSphere();
      }
    }
    this.club?.update(elapsed);
    this.freeway?.update(journey, elapsed, playerPosition, player?.id === 'morpheus' && player.id === journey?.actor
      ? player.currentAction?.parameters.truckRescue as TruckEncounter | undefined : undefined,
      player?.id === 'trinity' && player.id === journey?.actor ? player.currentAction?.parameters.freewayPickup as import('@auto_matrix/shared').FreewayPickup | undefined : undefined,
      player?.id === 'trinity' && player.id === journey?.actor ? player.currentAction?.parameters.freewayRide as import('@auto_matrix/shared').FreewayRide | undefined : undefined,
      player?.id === 'trinity' && player.id === journey?.actor ? player.currentAction?.parameters.freewayHandoff as import('@auto_matrix/shared').FreewayHandoff | undefined : undefined,
      player?.id === 'morpheus' && player.id === journey?.actor ? player.currentAction?.parameters.truckRoad as import('@auto_matrix/shared').TruckRoad | undefined : undefined,
      player?.id === 'morpheus' && player.id === journey?.actor ? player.currentAction?.parameters.truckHood as import('@auto_matrix/shared').TruckHood | undefined : undefined);
    if (set?.id === 'film_lafayette' && sceneId === 'm1_mirror' && !journey?.visiting
      && player?.id === journey?.actor && journey?.awakening?.kind === 'mirror') {
      this.preparedPods ??= new PodSetRenderer();
      this.preparedPods.prepareStep();
    } else if (this.preparedPods) {
      this.cancelPodPreparation();
    }
    this.pods?.update(journey, elapsed, firstPerson, this.recoverySubject, camera);
    this.neb?.update(journey, elapsed, journey?.scene === 'm2_relay' ? this.phoneBodies?.('trinity') : this.recoverySubject,
      ['m1_cypher_console', 'm1_meal', 'm2_relay'].includes(journey?.scene ?? '') ? this.phoneBodies : this.crosscutBodies);
    this.finale?.update(journey, elapsed);
    const empTime = player?.currentAction?.parameters.dockEmp;
    let empJourney = journey?.scene === 'm3_emp' && journey.emp?.elapsed !== undefined && typeof empTime === 'number' && empTime >= journey.emp.elapsed
      ? { ...journey, emp: { ...journey.emp, elapsed: empTime } } : journey;
    if (empJourney?.scene === 'm3_emp' && player?.currentAction?.parameters.empOperator)
      empJourney = { ...empJourney, empOperator: player.currentAction.parameters.empOperator as FilmJourney['empOperator'] };
    this.revolutionsPrelude?.update(empJourney, elapsed);
    this.oracleLast?.update(this.currentScene === 'm3_oracle_last' ? journey?.oracleLast : undefined);
    this.baneInquiry?.update(journey?.baneInquiry);
    this.hammerBriefing?.update(journey?.hammerBriefing);
    this.zionDeployment?.update(journey?.zionDeployment);
    this.maggieDiscovery?.update(journey?.maggieDiscovery);
    this.oracleAbsorption?.update(journey?.oracleAbsorption);
    this.dockEvacuation?.update(player?.currentAction?.parameters.dockEvacuation as FilmJourney['dockEvacuation'] ?? journey?.dockEvacuation,
      player?.currentAction?.parameters.shaftSeal as FilmJourney['shaftSeal'] ?? journey?.shaftSeal);
    this.dockBriefing?.update(player?.currentAction?.parameters.dockBriefing as FilmJourney['dockBriefing'] ?? journey?.dockBriefing);
    if (this.hammerMonitors) {
      const blackout = this.revolutionsPrelude?.blackout;
      this.hammerMonitors.face.color.setHex(blackout ? 0x070c0e : 0x587888);
      this.hammerMonitors.face.emissiveIntensity = blackout ? 0 : .7;
      this.hammerMonitors.glyphs.visible = !blackout;
    }
    if (['m3_emp', 'm3_dock_reunion'].includes(this.currentScene ?? '') && empJourney?.emp && !this.empDock) this.empDock = new DockEmpRenderer(this.scene);
    this.empDock?.update(empJourney, cameraPosition, camera);
    if (this.empDock) this.empDock.group.visible = this.empDock.group.visible && (this.currentScene === 'm3_dock_reunion' || !firstPerson && typeof empTime === 'number');
    this.root.visible = !this.empDock?.group.visible;
    const fastHammer = player?.id === journey?.actor ? player?.currentAction?.parameters.hammerPilot as import('@auto_matrix/shared').HammerPilotGesture | undefined : undefined;
    this.hammerRoute?.update(journey?.scene === 'm3_hammer_tunnels' && !journey.visiting ? fastHammer?.flight ?? journey.hammer : undefined, elapsed, firstPerson, journey?.scene === 'm3_hammer_tunnels' && !journey.visiting ? journey.hammerHandover : undefined);
    const fastLogos = player?.id === journey?.actor && typeof player?.currentAction?.parameters.logosPilot === 'object'
      ? player.currentAction.parameters.logosPilot as import('@auto_matrix/shared').LogosPilotGesture : undefined;
    const logos = ['m3_defense', 'm3_sun'].includes(journey?.scene ?? '') && !journey?.visiting
      ? fastLogos?.flight ?? journey?.logos ?? journey?.logosEntry ?? newLogosFlight(journey?.scene === 'm3_defense' ? 'defense' : 'sun') : undefined;
    this.logosAltitude = logos?.altitude ?? 22; this.logosTop = logos ? logosCloudTop(logos) : 62;
    this.logosFlight?.update(logos, elapsed, firstPerson);
    this.logosWreck?.update(journey?.scene === 'm3_farewell' && !journey.visiting ? journey.farewell : undefined, elapsed, firstPerson, firstPerson && player?.id === 'neo');
    const savedDeus = journey?.scene === 'm3_deus' && !journey.visiting ? journey.deus : undefined;
    const fastDeus = player?.id === 'neo' && player.id === journey?.actor && player.currentLocation === 'film_machine_core'
      ? player.currentAction?.parameters.deusPact as DeusPactEncounter | undefined : undefined;
    const deus = savedDeus && fastDeus?.phase === savedDeus.phase && fastDeus.attempts === savedDeus.attempts
      && fastDeus.total >= savedDeus.total ? fastDeus : savedDeus;
    const savedEpilogue = ['m3_ceasefire', 'm3_neo_carried', 'm3_reset', 'm3_dawn'].includes(journey?.scene ?? '') && !journey?.visiting ? journey?.epilogue : undefined;
    const fastEpilogue = player?.id === journey?.actor ? player?.currentAction?.parameters.epilogue as TrilogyEpilogueEncounter | undefined : undefined;
    const epilogue = savedEpilogue && fastEpilogue?.kind === savedEpilogue.kind
      && (savedEpilogue.kind !== 'dawn' || fastEpilogue.parkArrivalVersion === savedEpilogue.parkArrivalVersion)
      && fastEpilogue.total >= savedEpilogue.total ? fastEpilogue : savedEpilogue;
    this.machineCore?.update(deus, elapsed, firstPerson && player?.id === 'neo' && !player.isInMatrix, {
      x: (playerPosition?.x ?? this.current?.center.x ?? 0) - (this.current?.center.x ?? 0),
      z: (playerPosition?.z ?? this.current?.center.z ?? 0) - (this.current?.center.z ?? 0),
    }, this.recoverySubject, epilogue?.kind === 'neo_carried' ? epilogue : undefined);
    const savedSmith = ['m3_rain', 'm3_surrender'].includes(journey?.scene ?? '') && !journey?.visiting ? journey?.smithFinale : undefined;
    const fastSmith = player?.id === 'neo' && player.id === journey?.actor && player.currentLocation === 'film_smith_avenue'
      ? player.currentAction?.parameters.smithFinale as SmithFinaleEncounter | undefined : undefined;
    const smith = savedSmith && fastSmith?.phase === savedSmith.phase && fastSmith.attempts === savedSmith.attempts
      && fastSmith.total >= savedSmith.total ? fastSmith : savedSmith;
    this.smithFinale?.update(smith ?? (sandbox?.structures.some(s => s.id === 'film:smith:crater')
      ? { phase: 'done', elapsed: 0, total: elapsed, focus: 0, hits: 0, lastStrike: -1, lane: 0, checkpoint: 'air', attempts: 0 } : undefined),
      firstPerson, { x: (playerPosition?.x ?? this.current?.center.x ?? 0) - (this.current?.center.x ?? 0),
        z: (playerPosition?.z ?? this.current?.center.z ?? 0) - (this.current?.center.z ?? 0) }, camera);
    this.trilogyEpilogue?.update(epilogue, elapsed, this.recoverySubject);
    this.construct?.update(journey);
    this.desert?.update(journey, elapsed);
    this.mountain?.update(journey?.scene === 'm2_mountain' && !journey.visiting ? journey.mountain : undefined, elapsed);
    this.training?.update(journey, elapsed);
    this.sentinel?.update(journey, elapsed);
    this.restaurant?.update(journey, elapsed, this.crosscutBodies);
    this.ambush?.update(journey, sandbox?.structures ?? [], elapsed);
    this.basement?.update(journey, cameraPosition, this.basementFrame === undefined ? 0 : Math.max(0, elapsed - this.basementFrame));
    this.basementFrame = elapsed;
    this.tvRepair?.update(journey, journey?.tvExit?.crosscut ? this.phoneBodies?.(crosscutPhoneRole(journey.tvExit.crosscut) ?? 'neo') : this.recoverySubject);
    this.government?.update(journey, elapsed);
    const subwayExit = journey?.matrixEscape?.phase === 'crew_exit' ? journey.matrixEscape.crewExit : undefined;
    this.matrixEscape?.update(journey, elapsed, subwayExit ? this.phoneBodies?.(subwayExit.roles[subwayExit.index]) : undefined);
    this.theOne?.update(journey, elapsed);
    this.reloaded?.update(journey);
    this.catchSet?.update(journey, this.phoneBodies?.('trinity'));
    // For fixed slots, the render pass mutes off-view lights without changing the shader layout.
    this.zion?.update(epilogue && journey?.scene === 'm3_ceasefire' && !journey.visiting ? { ...journey, epilogue } : journey,
      elapsed, cameraPosition, this.stablePointSlots ? undefined : camera, departureCharm);
    this.baneCopy?.update(journey, elapsed, player && journey?.actor === player.id ? player.position : undefined, set?.center);
    if (this.logosBane) {
      const encounter = journey?.scene === 'm3_bane' && !journey.visiting ? journey.bane : undefined;
      const neoFirstPerson = firstPerson && player?.id === 'neo';
      this.logosBane.update(encounter, journey?.step ?? 0, elapsed, this.phoneBodies, neoFirstPerson);
      this.logosBanePhase = encounter?.phase; this.logosBaneBlind = neoFirstPerson && logosBaneInjured(encounter);
    }
    if (this.mobil) this.mobil.update(!journey?.visiting ? journey?.mobil : undefined, this.phoneBodies?.('neo'), this.phoneBodies?.('rama_kandra'));
    this.trainmanChase?.update(sceneId === 'm3_trainman_chase' && !journey?.visiting ? journey?.helChase?.performance : undefined);
    this.helGarage?.update(sceneId === 'm3_hel_garage' && !journey?.visiting ? journey?.helGarage : undefined);
    if (this.helLift) {
      const lift = sceneId === 'm3_hel_entry' && !journey?.visiting ? journey?.helElevator : undefined;
      const open = sceneId === 'm3_hel_bargain' || Boolean(journey?.visiting) || (journey?.step ?? 0) > 0 || lift?.phase === 'open';
      const legacy = !lift?.physical;
      const opening = legacy && lift?.phase === 'descending' ? Math.max(0, Math.min(1, (lift.elapsed - 4.2 + .7) / .7)) : 0;
      const travel = open ? 1 : legacy ? opening * opening * (3 - 2 * opening) : helElevatorGate(lift);
      this.helLift.cage.position.y = helElevatorFloor(lift);
      this.helLift.doors[0].position.x = -HEL_ELEVATOR.doorWidth / 4 - travel * 9;
      this.helLift.doors[1].position.x = HEL_ELEVATOR.doorWidth / 4 - travel * 9;
      for (const band of this.helLift.bands) band.mesh.position.y = legacy && lift?.phase === 'descending' ? 1 + (band.y + lift.elapsed * 3.5) % 8 : band.y;
      this.helLift.light.intensity = 150;
    }
    if (this.helDanceDoor) {
      const opening = sceneId === 'm3_hel_bargain' || Boolean(journey?.visiting) || (journey?.step ?? 0) > 3 || journey?.helDanceDoor?.phase === 'open';
      const fast = player?.id === journey?.actor ? player?.currentAction?.parameters.helDoorPush as HelDanceDoorEncounter | undefined : undefined;
      const swing = opening ? 1.28 : helDanceDoorAngle(fast?.physical && fast.phase === 'opening' ? fast : journey?.helDanceDoor);
      this.helDanceDoor[0].rotation.y = swing; this.helDanceDoor[1].rotation.y = -swing;
    }
    this.helCoatDamage?.forEach((mark, index) => { mark.visible = (journey?.helCoatcheck?.coverHits[index] ?? 0) > 0 && !journey?.visiting; });
    const savedBargain = sceneId === 'm3_hel_bargain' && !journey?.visiting ? journey?.helBargain : undefined;
    const fastBreakout = player && player.id === journey?.actor ? player.currentAction?.parameters.helBreakout as HelBreakoutGesture | undefined : undefined;
    const bargain = savedBargain && fastBreakout?.phase === savedBargain.phase
      ? { ...savedBargain, elapsed: fastBreakout.elapsed, breakout: fastBreakout.breakout } : savedBargain;
    if (this.helStandoff) {
      const encounter = bargain;
      const entering = sceneId === 'm3_hel_entry' && !journey?.visiting && ((journey?.step ?? 0) > 3 || helDanceDoorAngle(journey?.helDanceDoor) > .06);
      const phase = encounter?.phase;
      this.helStandoff.crowd.forEach((figure, index) => {
        figure.visible = !this.helPerformers?.loaded && (entering || Boolean(encounter) && phase !== 'released');
        figure.position.x = (index % 2 ? 1 : -1) * (index < 6 ? 2.8 + Math.floor(index / 2) * .35 : 5.5 + Math.floor(index / 4) * 1.1)
          + (['windup', 'evade', 'counter', 'airborne', 'gunpoint'].includes(phase ?? '') ? (index % 2 ? 1 : -1) * 1.6 : 0);
        figure.rotation.y = Math.sin(elapsed * .7 + index) * .12;
      });
      this.helStandoff.guard.visible = !this.helPerformers?.loaded && Boolean(encounter) && !['armed', 'released'].includes(phase ?? '');
      this.helStandoff.guard.position.x = 2.1;
      this.helStandoff.guard.rotation.x = ['airborne', 'gunpoint', 'failed'].includes(phase ?? '') ? -1.2 : 0;
      this.helStandoff.guard.position.z = phase === 'windup' || phase === 'evade' ? -30.5 - Math.min(1, encounter?.elapsed ?? 0) : -31.5;
      const fastDisarm = player && player.id === journey?.actor ? player.currentAction?.parameters.helDisarm as HelDisarm | undefined : undefined;
      const disarm = phase === 'disarming' ? fastDisarm ?? encounter?.disarm : encounter?.disarm;
      this.helStandoff.floorGuns.visible = Boolean(encounter) && (disarm ? disarm.elapsed >= HEL_DISARM.release && disarm.elapsed < HEL_DISARM.seconds
        : !['armed', 'airborne', 'gunpoint', 'released'].includes(phase ?? ''));
      if (disarm) this.helStandoff.floorGuns.children.forEach((gun, index) => {
        const point = helDisarmGun(disarm, HEL_TRIO[index]);
        gun.position.set(point.x, point.y, point.z); gun.rotation.set(point.pitch, point.yaw, point.roll, 'YXZ');
      });
      this.helStandoff.flyingGun.visible = phase === 'airborne' && (!encounter?.breakout || encounter.elapsed >= HEL_BREAKOUT.kick);
      if (phase === 'airborne') {
        if (encounter?.breakout) {
          const point = helBreakoutGun(encounter.breakout, encounter.elapsed);
          this.helStandoff.flyingGun.position.set(point.x, point.y, point.z);
          this.helStandoff.flyingGun.rotation.set(point.pitch, point.yaw, point.roll, 'YXZ');
        } else {
          const flight = Math.min(1, (encounter?.elapsed ?? 0) / 2.8);
          this.helStandoff.flyingGun.position.set(3.2 * (1 - flight), 1.4 + Math.sin(flight * Math.PI) * 1.8, -27 - 4 * flight);
          this.helStandoff.flyingGun.rotation.z = flight * Math.PI * 2;
        }
      }
      this.helStandoff.light.intensity = encounter && phase !== 'armed' && phase !== 'released' ? 80 : 250;
    }
    const fastDisarm = player?.currentAction?.parameters.helDisarm as HelDisarm | undefined;
    this.helPerformers?.update(fastDisarm && journey?.scene === 'm3_hel_bargain' && journey.helBargain?.phase === 'disarming'
      ? { ...journey, helBargain: { ...journey.helBargain, disarm: fastDisarm } }
      : bargain && fastBreakout ? { ...journey!, helBargain: bargain } : journey, elapsed);
    this.sourceBriefing?.update(journey?.scene === 'm2_plan' ? journey.sourceBriefing : undefined);
    this.primaryDemolition?.update(journey?.primaryDemolition, journey?.grid, camera);
    this.trinityTerminal?.update(journey?.trinityTerminal, journey?.grid?.emergency !== 'off');
    if (this.powerStatus) {
      const grid = journey?.grid;
      const energized = grid?.primary !== 'off' && grid?.emergency !== 'off';
      this.powerStatus.primary.color.setHex(grid?.primary === 'off' ? 0x35443d : grid?.primary === 'armed' ? 0xffbd62 : 0x8cdb9b);
      this.powerStatus.emergency.color.setHex(grid?.emergency === 'off' ? 0x35443d : grid?.vigilant === 'lost' ? 0xe26956 : 0x8cdb9b);
      this.powerStatus.lights.forEach(light => { light.intensity = energized ? 210 : 19; light.color.setHex(energized ? 0xf3e7c9 : 0xac5144); });
    }
    this.sourceDoor?.update(journey?.keyDoor);
    const architect = this.architectState;
    this.architectRoom?.update(journey?.architect, architect?.status === 'alive' && architect.currentLocation === 'film_architect_room'
      && architect.currentAction?.parameters.seated ? architect.rotation : undefined);
    if (this.portalDoor) {
      this.portalDoor.panel.rotation.y = seraphDoorAngle(seraphDoorProgress(journey,this.portalDoor.scene));
    }
    if (this.oracleLetter) this.oracleLetter.visible = sceneId === 'm2_bench' && (journey?.step ?? 0) < FILM_SCENE_BY_ID.m2_bench.steps.length;
    if (this.courtyardStaff) this.courtyardStaff.visible = sceneId === 'm2_bench' || sceneId === 'm2_burly' && !journey?.visiting && !['staff', 'flight_ready', 'flight', 'done'].includes(journey?.burly?.phase ?? 'ready');
    if (this.exileDessert) {
      const triggered = sceneId === 'm2_merovingian' && (journey?.step ?? 0) >= 2;
      this.exileDessert.visible = triggered;
      this.exileDessert.scale.setScalar(1 + Math.sin(elapsed * 4) * .08);
    }
    if (this.bookDoor) {
      this.bookDoor.rotation.y = bookDoorAngle(bookDoorProgress(journey));
      const book = this.bookDoor.getObjectByName('library-book-trigger'); if (book) book.rotation.x = BOOK_DOOR.book.angle * (journey?.scene === 'm2_library' && !journey.visiting ? journey.bookDoor?.book ?? 0 : 0);
    }
    if (this.chateauVolley) {
      const encounter = sceneId === 'm2_chateau' && !journey?.visiting ? journey?.chateau : undefined;
      const volley = encounter?.phase === 'duel' && encounter.wave === 1 ? encounter.volleyAt : undefined;
      this.chateauVolley.visible = volley !== undefined && tick >= volley && tick - volley < 3;
    }
    if (this.chateauDoor) this.chateauDoor.position.x = sceneId === 'm2_chateau' && (journey?.step ?? 0) >= 2 ? 5 : 0;
    if (this.garageCar) {
      const escape = sceneId === 'm2_garage' && !journey?.visiting ? journey?.garage : undefined;
      const pose = escape ? garageCar ?? garageCarPose(escape) : undefined;
      this.garageCar.position.set(pose?.x ?? GARAGE.start.x, 0, pose?.z ?? GARAGE.start.z);
      this.garageCar.rotation.y = pose?.yaw ?? 0;
      this.garageGhosts.forEach((ghost, index) => {
        ghost.visible = Boolean(escape && escape.elapsed < escape.ghostUntil[index]);
        ghost.rotation.y = elapsed * (index ? -3 : 3);
        ghost.scale.setScalar(1 + Math.sin(elapsed * 18 + index) * .12);
      });
    }
    if (this.courtyardBirds.length) {
      const startled = sceneId === 'm2_burly' && !journey?.visiting;
      if (startled && this.courtyardDisturbedAt === undefined) this.courtyardDisturbedAt = elapsed;
      if (!startled) this.courtyardDisturbedAt = undefined;
      const time = startled ? elapsed - this.courtyardDisturbedAt! : 0;
      this.courtyardBirds.forEach((bird, index) => {
        const rise = Math.min(1, Math.max(0, time * 1.2 - index * .18));
        bird.position.y = rise * (6 + index * 2); bird.position.x = [-15, -12, -2][index] + rise * (index - 1) * 5;
        bird.position.z = -14 + ([-15, -12, -2][index] % 3) - rise * (9 + index * 3);
        bird.rotation.y = Math.sin(elapsed * 7 + index) * .35;
        for (const wing of bird.children.filter(child => child.name === 'bird-wing')) wing.rotation.z = Math.sin(elapsed * 24 + index) * .8 * rise;
      });
    }
    this.oracleVase?.update(sceneId === 'm1_oracle' ? journey?.visiting || journey!.step > 0 ? 4.5 : journey?.oracle?.vase : undefined);
    if (this.oracleDoor) this.oracleDoor.rotation.y = oracleArrivalDoor(sceneId?.startsWith('m3_') || journey?.visiting ? undefined : journey?.oracle?.arrival);
    if (this.oracleBlocks) {
      this.oracleBlocks.visible = !sceneId?.startsWith('m3_');
      const time = journey?.oracle?.waitingTime ?? 0;
      this.oracleBlocks.children.forEach((block, i) => {
        block.position.y = 1.65 + Math.sin(time * .65 + i * 1.7) * .15;
        block.rotation.set(Math.sin(time * .23 + i) * .13, time * .18 + i * .7, Math.cos(time * .31 + i) * .08);
      });
    }
    const scene = journey && filmSceneForJourney(journey)!; const step = scene?.steps[journey!.step] ?? (!journey?.visiting && journey && ['m2_seraph','m2_backdoors'].includes(journey.scene) && journey.step >= 2 ? scene?.steps[1] : undefined);
    this.marker.visible = Boolean((set && scene?.set === set.id || scene?.id === 'm1_commute' && player?.isInMatrix) && step && !journey?.visiting && journey?.actor === player?.id);
    if (scene?.id === 'm1_room303' && (openingHotelTraceTime(journey?.openingHotel) !== undefined || ['breach', 'dive', 'answering'].includes(journey?.openingHotel?.phase ?? ''))) this.marker.visible = false;
    if (scene?.id === 'm1_roofs' && player?.currentAction?.parameters.roofExit) this.marker.visible = false;
    if (scene?.id === 'm1_commute' && sandbox?.neoLife?.lift?.passenger) this.marker.visible = false;
    if (oracleRequestLocked(journey?.scene === 'm3_oracle_request' ? journey.oracleRequest : undefined)) this.marker.visible = false;
    if (journey?.scene === 'm3_bane_questions' && baneInquiryLocked(journey.baneInquiry)) this.marker.visible = false;
    if (journey?.scene === 'm3_logos_plan' && hammerBriefingLocked(journey.hammerBriefing)) this.marker.visible = false;
    if (journey?.scene === 'm3_zion_prepare' && zionDeploymentLocked(journey.zionDeployment)) this.marker.visible = false;
    if (journey?.scene === 'm3_oracle_last' && (oracleLastLocked(journey.oracleLast) || journey.oracleLast?.phase === 'greeting')) this.marker.visible = false;
    if (journey?.scene === 'm3_trainman_chase' && !journey.visiting && trainmanChaseLocked(journey.helChase?.performance)) this.marker.visible = false;
    if (journey?.scene === 'm3_hel_garage' && helGarageLocked(journey.helGarage)) this.marker.visible = false;
    if (helElevatorLocked(journey) || helDanceDoorLocked(journey) || journey?.scene === 'm3_hel_bargain' && journey.helBargain?.phase === 'disarming') this.marker.visible = false;
    if (['m1_lobby', 'm3_hel_entry'].includes(journey?.scene ?? '') && journey?.fighting) this.marker.visible = false;
    if (journey?.scene === 'm2_burly' && !['ready', 'staff_ready', 'flight_ready'].includes(journey.burly?.phase ?? 'ready')) this.marker.visible = false;
    if (journey?.scene === 'm2_chateau' && journey.step === 0 && !['ready', 'landing'].includes(journey.chateau?.phase ?? 'ready')) this.marker.visible = false;
    if (journey?.scene === 'm2_mountain' && journey.step === 2 && !['ready', 'failed'].includes(journey.mountain?.phase ?? 'ready')) this.marker.visible = false;
    if (journey?.scene === 'm3_bane' && (logosBaneLocked(journey.bane) || journey.step === 1 && journey.bane?.phase !== 'ready')) this.marker.visible = false;
    if (journey?.scene === 'm3_farewell' && journey.farewell && journey.farewell.phase !== 'ready') this.marker.visible = false;
    if (journey?.scene === 'm3_deus' && deusPactLocked(journey.deus)) this.marker.visible = false;
    if (['m3_rain', 'm3_surrender'].includes(journey?.scene ?? '') && smithFinaleLocked(journey?.smithFinale)) this.marker.visible = false;
    if (trilogyEpilogueLocked(journey?.epilogue)) this.marker.visible = false;
    if (journey?.scene === 'm2_backup' && trinityTerminalLocked(journey.trinityTerminal)) this.marker.visible = false;
    if (journey?.scene === 'm2_garage' && journey.garage?.phase === 'riding') this.marker.visible = false;
    if (journey?.scene === 'm3_hammer_tunnels' && journey.hammer?.phase === 'riding') this.marker.visible = false;
    if (['m3_defense', 'm3_sun'].includes(journey?.scene ?? '') && !journey?.visiting) this.marker.visible = false;
    if (upperDiggerActive(journey) && upperDiggerLocked(journey?.upperDigger)) this.marker.visible = false;
    if (diggersActive(journey) && diggersLocked(journey?.diggers)) this.marker.visible = false;
    if (dockGateActive(journey) || journey?.scene === 'm3_gate' && journey.apu?.phase === 'riding') this.marker.visible = false;
    const empExterior = this.currentScene === 'm3_emp' && this.empDock?.group.visible;
    if (empExterior) this.marker.visible = false;
    if (journey?.scene === 'm3_dock_battle' && (journey.dockGunnery?.phase === 'firing' || dockReloadLocked(journey.dockReload) || dockLastStandLocked(journey.dockLastStand))) this.marker.visible = false;
    if (bookDoorLocked(journey?.bookDoor) || seraphDoorLocked(journey?.seraphDoor)) this.marker.visible = false;
    if (journey && pillLocked(journey)) this.marker.visible = false;
    if (journey && interrogationLocked(journey)) this.marker.visible = false;
    if (journey && meetingLocked(journey)) this.marker.visible = false;
    if (journey && lafayetteWelcomeLocked(journey)) this.marker.visible = false;
    if (journey?.hotel && !journey.hotel.entered) this.marker.visible = false;
    if (journey && awakeningLocked(journey)) this.marker.visible = false;
    if (journey && trainingLocked(journey)) this.marker.visible = false;
    if (journey && workdayLocked(journey)) this.marker.visible = false;
    if (journey && apartmentLocked(journey)) this.marker.visible = false;
    if (journey && clubLocked(journey)) this.marker.visible = false;
    if (journey?.scene === 'm1_sentinels' && journey.sentinel && !['ready', 'briefing', 'verify', 'done'].includes(journey.sentinel.phase)) this.marker.visible = false;
    if (journey && interludeLocked(journey)) this.marker.visible = false;
    if (journey && betrayalLocked(journey)) this.marker.visible = false;
    if (journey && (rescueLocked(journey) || journey.scene === 'm1_guns' && journey.rescue?.phase === 'selecting')) this.marker.visible = false;
    if (journey && governmentLocked(journey)) this.marker.visible = false;
    if (journey && airRescueLocked(journey)) this.marker.visible = false;
    if (journey?.matrixEscape && ['m1_subway', 'm1_city_chase'].includes(journey.scene)) this.marker.visible = false;
    if (journey?.reloaded && !journey.visiting) this.marker.visible = false;
    if (journey?.scene === 'm2_catch' && journey.catch && !journey.visiting) this.marker.visible = false;
    if (journey?.theOne && ['m1_death', 'm1_return', 'm1_final_call'].includes(journey.scene)) this.marker.visible = false;
    if (journey && phoneLocked(journey)) this.marker.visible = false;
    if (basementLocked(journey) || tvExitLocked(journey)) this.marker.visible = false;
    if (journey && windowOpening(journey)) this.marker.visible = false;
    const retreat = journey && officeRetreat(journey);
    if (retreat && (journey.office?.climbed !== undefined || windowCrossing(journey))) this.marker.visible = false;
    if (journey?.scene === 'm1_dejavu' && journey.step === 0 && journey.ambush) this.marker.visible = false;
    if (!journey?.visiting && journey?.scene === 'm1_dejavu' && journey.ambushEscape && ['alarm', 'call', 'failed', 'done'].includes(journey.ambushEscape.phase)) this.marker.visible = false;
    if (!journey?.visiting && journey?.scene === 'm1_wetwall' && journey.wetwall?.phase !== 'sealed') this.marker.visible = false;
    if (this.marker.visible && step && scene) {
      const bridgeDoor = scene.id === 'm1_bridge' && journey?.step === 1 && journey.bridgeArrival?.parkedRoadTime !== undefined
        ? meetingBoardPoint(journey.bridgeArrival) : undefined;
      const carSeat = scene.id === 'm1_bug' && journey?.step === 1 && journey.meeting?.phase === 'done'
        ? meetingRoot(journey.meeting, 'neo') : undefined;
      const arrivalGoal = scene.id === 'm1_spoon' && oracleArrivalPending(journey?.oracle?.arrival) ? oracleArrivalTarget(journey!.oracle!.arrival!) : undefined;
      const center = FILM_SETS.film_ambush_house.center;
      const ambushGoal = scene.id === 'm1_dejavu' && journey?.ambushEscape && player
        ? ambushEscapeTarget(journey.ambushEscape, player.position.x - center.x, player.position.y - center.y, player.position.z - center.z)
        : scene.id === 'm1_dejavu' && journey?.step === 0 && journey.ambushApproach && !journey.ambushApproach.ready && player
          ? ambushApproachTarget(player.position.x - center.x, player.position.y - center.y, player.position.z - center.z, journey.ambushApproach.stairCat) : undefined;
      const position = retreat ? { ...OFFICE_RETREAT_WINDOW }
        : ambushGoal ? { x: center.x + ambushGoal.x, y: center.y + ambushGoal.y, z: center.z + ambushGoal.z }
        : scene.id === 'm1_sentinels' && journey?.sentinel?.phase === 'briefing' ? filmPosition(scene.set, SENTINEL_POWER.inspect.x, SENTINEL_POWER.inspect.z)
        : arrivalGoal ? filmPosition(scene.set, arrivalGoal.x, arrivalGoal.z) : bridgeDoor ? filmPosition(scene.set, bridgeDoor.x, bridgeDoor.z)
        : carSeat ? filmPosition(scene.set, carSeat.x, carSeat.z)
        : scene.id === 'm2_burly' && journey?.burly?.phase === 'staff_ready' ? filmPosition(scene.set, BURLY.staff.x, BURLY.staff.z)
        : scene.id === 'm2_chateau' && journey?.chateau?.phase === 'landing'
          ? (player && chateauStairWaypoint(player.position, center)?.position) ?? filmStepPosition(scene, scene.steps[1])
        : step.kind === 'drive' && journey?.ride ? filmPosition(scene.set, 14, FREEWAY_FINISH) : filmStepPosition(scene, step, journey);
      if (scene.id === 'm1_ledge' && journey?.office?.climbed !== undefined) position.y -= 32;
      this.marker.position.set(position.x, position.y - .82, position.z);
      this.marker.scale.setScalar(1 + Math.sin(elapsed * 2) * .07); this.markerLight.position.copy(this.marker.position).y += 1.5;
    }
    // The marker is dark during the Sentinel scan, so the two lights can share a slot.
    this.markerLight.visible = this.marker.visible || (this.stablePointSlots && !this.pods && !empExterior && !this.sentinel?.scanActive);
    this.markerLight.intensity = this.marker.visible && set?.id !== 'film_wells_phone' ? 5 : 0;
    for (const item of this.moving) item.update(elapsed);
    return set;
  }
  atmosphere(): { color: number; ambient: number; sun: number; fill?: number } | undefined {
    if (!this.current || ['film_anderson_flat', 'film_metacortex_floor', 'film_office_ledge'].includes(this.current.id)) return;
    const palette = palettes[this.current.light];
    (this.scene.background as THREE.Color).setHex(palette.sky);
    const fog = this.scene.fog as THREE.FogExp2; fog.color.setHex(palette.sky); fog.density = palette.fog;
    this.scene.environmentIntensity = outdoor.has(this.current.architecture) ? .8 : .6;
    if (this.current.id === 'film_hotel_roofs') {
      fog.color.setHex(0x182327); fog.density = .008;
      (this.scene.background as THREE.Color).copy(fog.color);
      this.scene.environmentIntensity = .44;
      return { color: 0xb9c3bc, ambient: .42, sun: .18, fill: .36 };
    }
    if (this.current.id === 'film_wells_phone') {
      fog.color.setHex(0x0d1813); fog.density = .011;
      (this.scene.background as THREE.Color).copy(fog.color);
      this.scene.environmentIntensity = .29;
      return { color: 0xb8c7ad, ambient: .33, sun: .08, fill: .16 };
    }
    if (this.current.id === 'film_zion_personnel') {
      fog.color.setHex(0x0c1510); fog.density = .003; (this.scene.background as THREE.Color).copy(fog.color);
      this.scene.environmentIntensity = .35;
      return { color: 0xc3c8b0, ambient: .6, sun: .08 };
    }
    const park = this.trilogyEpilogue?.parkAtmosphere();
    if (park) { fog.density = .0009; fog.color.setHex(0x8ba6b2); this.scene.environmentIntensity = park.environment; return park; }
    if (this.currentScene === 'm3_reset') {
      fog.density = .008; fog.color.setHex(0x0b171d); (this.scene.background as THREE.Color).copy(fog.color);
      this.scene.environmentIntensity = .18;
      return { color: 0x8aa8b8, ambient: .25, sun: .05 };
    }
    if (this.revolutionsPrelude && this.currentScene === 'm3_oracle_absorbed') {
      const dark = this.revolutionsPrelude.consumed;
      this.root.traverse(object => {
        if (!(object instanceof THREE.Light) || object.name.startsWith('oracle-corridor-light-')) return;
        object.userData.oracleOriginalIntensity ??= object.intensity; object.intensity = object.userData.oracleOriginalIntensity * (dark ? .45 : 1);
      });
      fog.color.setHex(dark ? 0x24271e : 0x333d31); fog.density = dark ? .006 : .003;
      (this.scene.background as THREE.Color).copy(fog.color);
      this.scene.environmentIntensity = dark ? .22 : .45;
      return { color: dark ? 0x99cfa5 : 0xe1dbc0, ambient: dark ? .32 : .66, sun: .08 };
    }
    if (this.empDock?.group.visible) {
      fog.color.setHex(0x0b151f); fog.density = .003; (this.scene.background as THREE.Color).copy(fog.color);
      if (this.currentScene === 'm3_dock_reunion') {
        this.scene.environmentIntensity = .9;
        return { color: 0xb5c4cc, ambient: 1.22, sun: .34 };
      }
      this.scene.environmentIntensity = .7;
      return { color: 0x9bbacb, ambient: .9, sun: .12 };
    }
    if (this.zionDeployment) {
      fog.color.setHex(0x273239); fog.density = .0015; (this.scene.background as THREE.Color).copy(fog.color);
      this.scene.environmentIntensity = .52; return { color: 0xc2c9c7, ambient: .76, sun: .035 };
    }
    if (this.hammerBriefing) {
      fog.color.setHex(0x17242d); fog.density = .0015; (this.scene.background as THREE.Color).copy(fog.color);
      this.scene.environmentIntensity = .62; return { color: 0xbdcdd4, ambient: .78, sun: .04 };
    }
    if (this.sourceBriefing) {
      fog.color.setHex(0x1d251f); fog.density = .002; (this.scene.background as THREE.Color).copy(fog.color);
      this.scene.environmentIntensity = .5; return { color: 0xd9dfc6, ambient: .58, sun: .08 };
    }
    if (this.helGarage) {
      fog.color.setHex(0x14251a); fog.density = .002; (this.scene.background as THREE.Color).copy(fog.color);
      this.scene.environmentIntensity = .48; return { color: 0xd1ddba, ambient: .64, sun: .02 };
    }
    if (this.trainmanChase) {
      fog.color.setHex(0x18251c); fog.density = .0018; (this.scene.background as THREE.Color).copy(fog.color);
      this.scene.environmentIntensity = .65; return { color: 0xe5e9cf, ambient: .82, sun: .035 };
    }
    if (this.primaryDemolition) {
      fog.color.setHex(0x141f25); fog.density = .002; (this.scene.background as THREE.Color).copy(fog.color);
      this.scene.environmentIntensity = .48; return { color: 0xc4d6d8, ambient: .46, sun: .06 };
    }
    if (this.revolutionsPrelude && this.currentScene === 'm3_emp' && this.revolutionsPrelude.blackout) {
      fog.color.setHex(0x0b1318); fog.density = .005; (this.scene.background as THREE.Color).copy(fog.color);
      this.scene.environmentIntensity = .12;
      return { color: 0x93a9b1, ambient: .24, sun: .02 };
    }
    if (this.logosBane) {
      const phase = this.logosBanePhase;
      const cut = phase && !['ready', 'gun_warning'].includes(phase);
      const blind = this.logosBaneBlind;
      const color = blind ? 0x050a0c : cut ? 0x111b1e : 0x26333a;
      fog.color.setHex(color); fog.density = blind ? .016 : .004;
      (this.scene.background as THREE.Color).setHex(color);
      this.scene.environmentIntensity = blind ? .025 : cut ? .36 : .52;
      return { color: blind ? 0x7d92a0 : 0xc4d5da, ambient: blind ? .065 : cut ? .42 : .68, sun: blind ? .01 : cut ? .04 : .13 };
    }
    if (this.logosFlight) {
      const lit = THREE.MathUtils.smoothstep(this.logosAltitude, this.logosTop - 2, this.logosTop + 3);
      const inside = THREE.MathUtils.smoothstep(this.logosAltitude, this.logosTop - 30, this.logosTop - 21) * (1 - lit);
      fog.density = .003 + inside * .048 - lit * .002;
      fog.color.setHex(0x1d2935).lerp(new THREE.Color(0x4d5965), inside).lerp(new THREE.Color(0xb8b9a7), lit);
      (this.scene.background as THREE.Color).copy(fog.color); this.scene.environmentIntensity = .4 + lit * .7;
      return { color: new THREE.Color(0xa2b7c8).lerp(new THREE.Color(0xffe3b2), lit).getHex(), ambient: .55 + lit * .85, sun: .08 + lit * .2 };
    }
    if (this.logosWreck) {
      fog.density = .008; fog.color.setHex(0x0b121b); (this.scene.background as THREE.Color).copy(fog.color);
      this.scene.environmentIntensity = .34; return { color: 0x96b5cf, ambient: .42, sun: .16 };
    }
    if (this.machineCore) {
      fog.density = .0032; fog.color.setHex(0x172337); (this.scene.background as THREE.Color).copy(fog.color);
      this.scene.environmentIntensity = .38; return { color: 0x9dbbd5, ambient: .42, sun: .12 };
    }
    if (this.smithFinale) {
      fog.density = .006; fog.color.setHex(0x14211f); (this.scene.background as THREE.Color).copy(fog.color);
      this.scene.environmentIntensity = .72; return { color: 0xc3d2bd, ambient: .68, sun: .2 };
    }
    if (this.hammerRoute) {
      fog.density = .003; fog.color.setHex(0x1b2a2c); (this.scene.background as THREE.Color).copy(fog.color);
      this.scene.environmentIntensity = .82; return { color: 0xc2ddd9, ambient: 1.15, sun: .28 };
    }
    if (this.lobby) {
      (this.scene.fog as THREE.FogExp2).density = .003; (this.scene.fog as THREE.FogExp2).color.setHex(0x182820);
      this.scene.environmentIntensity = .75;
      return { color: 0xdce7d2, ambient: .6, sun: .2 };
    }
    if (this.office) return { color: 0xe8e8d7, ambient: .65, sun: .3 };
    if (this.club) { fog.density = .005; fog.color.setHex(0x111913); this.scene.environmentIntensity = .28; return { color: 0xc1c8ac, ambient: .38, sun: .025 }; }
    if (this.interrogation) { fog.density = .001; this.scene.environmentIntensity = .38; return { color: 0xdce4ce, ambient: .48, sun: .08 }; }
    if (this.meeting) { fog.density = .007; fog.color.setHex(0x111b1d); (this.scene.background as THREE.Color).copy(fog.color); this.scene.environmentIntensity = .7; return { color: 0xb8cdc6, ambient: .62, sun: .15 }; }
    if (this.matrixEscape && this.current.id === 'film_subway_platform') { fog.density = .006; fog.color.setHex(0x15231f); this.scene.environmentIntensity = .58; return { color: 0xd5e1d3, ambient: .72, sun: .08 }; }
    if (this.matrixEscape) { fog.density = .0015; fog.color.setHex(0xaebfc0); this.scene.environmentIntensity = .82; return { color: 0xffe2bc, ambient: .86, sun: 1.35 }; }
    if (this.current.id === 'film_oracle_courtyard') { fog.density = .0015; this.scene.environmentIntensity = .88; return { color: 0xf7e8cc, ambient: 1.05, sun: 1.7 }; }
    if (this.reloaded && this.current.id !== 'film_neb_deck') {
      fog.density = this.current.id === 'film_trinity_roof' ? .002 : .003; fog.color.setHex(0x0f1917); (this.scene.background as THREE.Color).copy(fog.color);
      this.scene.environmentIntensity = .56; return { color: 0xc4d1b5, ambient: .6, sun: .14 };
    }
    if (this.catchSet) {
      fog.density = .0014; fog.color.setHex(0x243438); (this.scene.background as THREE.Color).copy(fog.color);
      this.scene.environmentIntensity = .88; return { color: 0xd9ded2, ambient: 1.15, sun: .34 };
    }
    if (this.zion) {
      fog.density = this.current.id === 'film_zion_hangar' ? .0015 : .0008;
      fog.color.setHex(0x211b18); (this.scene.background as THREE.Color).copy(fog.color);
      this.scene.environmentIntensity = .85; return { color: 0xffdbba, ambient: 1.38, sun: .32 };
    }
    if (this.baneCopy) {
      fog.density = .003; fog.color.setHex(0x172627); (this.scene.background as THREE.Color).copy(fog.color);
      this.scene.environmentIntensity = .63; return { color: 0xc9ded5, ambient: .68, sun: .1 };
    }
    if (this.powerStatus) {
      fog.density = .0015; fog.color.setHex(0x202a27);
      this.scene.environmentIntensity = .62;
      return { color: 0xe2decb, ambient: .76, sun: .12 };
    }
    if (this.sourceDoor) {
      fog.density = .001; fog.color.setHex(0x768574); (this.scene.background as THREE.Color).copy(fog.color);
      this.scene.environmentIntensity = .72;
      return { color: 0xe0e8d6, ambient: .88, sun: .08 };
    }
    if (this.architectRoom) {
      fog.density = .001; this.scene.environmentIntensity = .55;
      return { color: 0xf1f1e9, ambient: .95, sun: .08 };
    }
    if (this.theOne && this.current.id === 'film_heart_hotel') { fog.density = .0023; fog.color.setHex(0x151e1b); this.scene.environmentIntensity = .48; return { color: 0xd9dfbc, ambient: .55, sun: .08 }; }
    if (this.currentScene === 'm1_room303') {
      const hall = this.hotel303Beam?.visible;
      fog.density = hall ? .008 : .003; fog.color.setHex(0x121a18);
      this.scene.environmentIntensity = hall ? .23 : .36;
      return { color: 0xb9c8bb, ambient: hall ? .19 : .35, sun: .05 };
    }
    if (this.theOne && this.current.id === 'film_final_phone') { fog.density = .0012; fog.color.setHex(0xaebfc0); this.scene.environmentIntensity = .9; return { color: 0xffe5be, ambient: .96, sun: 1.7 }; }
    if (this.hotel) { fog.density = .001; this.scene.environmentIntensity = .36; return { color: 0xc8ceba, ambient: .4, sun: .06 }; }
    if (this.ambush) { this.scene.environmentIntensity = .4; return { color: 0xd4ddbe, ambient: .52, sun: .15 }; }
    if (this.basement) { fog.color.setHex(0x1a211c); fog.density = .009; this.scene.environmentIntensity = .4; return { color: 0xe0ddc0, ambient: .56, sun: .05 }; }
    if (this.tvRepair) { fog.color.setHex(0xa6b4a1); fog.density = .0015; this.scene.environmentIntensity = .55; return { color: 0xffebc9, ambient: .8, sun: .2 }; }
    if (this.pods) {
      (this.scene.background as THREE.Color).setHex(0x080f14); fog.color.setHex(0x080f14); fog.density = .005;
      this.scene.environmentIntensity = .04;
      return { color: 0xb2cdd7, ambient: .4, sun: .35 };
    }
    if (this.neb) {
      (this.scene.background as THREE.Color).setHex(0x101918); fog.color.setHex(0x101918); fog.density = .0035;
      this.scene.environmentIntensity = .52;
      return { color: 0xc7ddd3, ambient: .68, sun: .18 };
    }
    if (this.construct) {
      (this.scene.background as THREE.Color).setHex(0xeeeeea); fog.color.setHex(0xeeeeea); fog.density = .0012;
      this.scene.environmentIntensity = .82;
      return { color: 0xffffff, ambient: 1.08, sun: .28 };
    }
    if (this.desert) {
      (this.scene.background as THREE.Color).setHex(0x172432); fog.color.setHex(0x172432); fog.density = .007;
      this.scene.environmentIntensity = .38;
      return { color: 0xb3c2d4, ambient: .58, sun: .3 };
    }
    if (this.training) {
      if (this.training.sceneId === 'm1_dojo') {
        (this.scene.background as THREE.Color).setHex(0x3f4036); fog.color.setHex(0x777766); fog.density = .0018;
        this.scene.environmentIntensity = .55; return { color: 0xffefd8, ambient: .48, sun: 0 };
      }
      if (this.training.sceneId === 'm1_jump') {
        (this.scene.background as THREE.Color).setHex(0x9db2b5); fog.color.setHex(0x9db2b5); fog.density = .0042;
        this.scene.environmentIntensity = .7; return { color: 0xf2dfbf, ambient: .78, sun: 1.05 };
      }
      (this.scene.background as THREE.Color).setHex(0xb8c3bd); fog.color.setHex(0xb8c3bd); fog.density = .0025;
      this.scene.environmentIntensity = .74; return { color: 0xffead0, ambient: .9, sun: 0 };
    }
    if (this.sentinel) {
      (this.scene.background as THREE.Color).setHex(0x07100f); fog.color.setHex(0x07100f); fog.density = .008;
      this.scene.environmentIntensity = .28; return { color: 0xa9c9bc, ambient: .34, sun: .04 };
    }
    if (this.restaurant) {
      (this.scene.background as THREE.Color).setHex(0x090d12); fog.color.setHex(0x090d12); fog.density = .0018;
      this.scene.environmentIntensity = .32; return { color: 0xffd5a8, ambient: .38, sun: .05 };
    }
    if (this.government) {
      if (this.government.setId === 'film_government_office') {
        (this.scene.background as THREE.Color).setHex(0x87989a); fog.color.setHex(0x87989a); fog.density = .0012;
        this.scene.environmentIntensity = .48; return { color: 0xd7e2db, ambient: .54, sun: .22 };
      }
      (this.scene.background as THREE.Color).setHex(0x9eafb2); fog.color.setHex(0x9eafb2); fog.density = .0024;
      this.scene.environmentIntensity = .62; return { color: 0xdde8e1, ambient: .58, sun: .72 };
    }
    return palette;
  }
  impact(hit: CombatImpact): void { this.lobby?.impact(hit); }
  private own<T extends THREE.BufferGeometry>(geometry: T): T { this.geometries.add(geometry); return geometry; }
  private mat(color: number, roughness = .65, metalness = 0): THREE.MeshStandardMaterial {
    const key = `${color}:${roughness}:${metalness}`; const cached = this.materialCache.get(key); if (cached) return cached;
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(material); this.materialCache.set(key, material); return material;
  }
  private pbr(id: string, color = 0xffffff, repeat = 4, roughness = .85, metalness = 0, directory = 'film-materials'): THREE.MeshStandardMaterial {
    const loader = new THREE.TextureLoader();
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness, normalScale: new THREE.Vector2(.4, .4) });
    const materials = this.materials; materials.add(material);
    const maps: Partial<Record<'color' | 'normal' | 'roughness', THREE.Texture>> = {};
    const texture = (kind: 'color' | 'normal' | 'roughness', source?: THREE.Texture | null) => {
      const loadedMap = (loaded: THREE.Texture) => {
        if (!materials.has(material)) { loaded.dispose(); return; }
        maps[kind] = loaded;
        if (maps.color && maps.normal && maps.roughness) {
          material.map = maps.color; material.normalMap = maps.normal; material.roughnessMap = maps.roughness;
          material.needsUpdate = true;
        }
      };
      const map = source ? new THREE.Texture() : loader.load(`/assets/${directory}/${id}-${kind}.jpg`, loadedMap);
      map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(repeat, repeat); map.anisotropy = 8;
      if (kind === 'color') map.colorSpace = THREE.SRGBColorSpace; this.textures.add(map);
      if (source) {
        // Mark the new texture before sharing the hotel's already uploaded source.
        map.needsUpdate = true;
        map.source = source.source;
        loadedMap(map);
      }
    };
    const shared = directory === 'film-materials' ? this.roofSurfaceSources?.get(id) : undefined;
    texture('color', shared?.map); texture('normal', shared?.normalMap); texture('roughness', shared?.roughnessMap);
    return material;
  }
  private imageMaterial(id: string, fallback: number, repeat = false, tint = 0xffffff): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color: fallback, roughness: .96 });
    const materials = this.materials; materials.add(material);
    const texture = new THREE.TextureLoader().load(`/assets/film-materials/${id}.jpg`, loaded => {
      if (!materials.has(material)) { loaded.dispose(); return; }
      material.map = loaded; material.color.setHex(tint); material.needsUpdate = true;
    });
    texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
    if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    this.textures.add(texture); return material;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent = this.root): THREE.Mesh {
    const mesh = new THREE.Mesh(this.own(geometry), material); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, bevel = 0): THREE.Mesh {
    return this.mesh(bevel ? new RoundedBoxGeometry(w, h, d, 2, Math.min(bevel, w / 3, h / 3, d / 3)) : new THREE.BoxGeometry(w, h, d), material, x, y, z);
  }
  private cylinder(material: THREE.Material, x: number, y: number, z: number, radius: number, height: number, top = radius): THREE.Mesh {
    return this.mesh(new THREE.CylinderGeometry(top, radius, height, 20), material, x, y, z);
  }
  private sphere(material: THREE.Material, x: number, y: number, z: number, r: number): THREE.Mesh { return this.mesh(new THREE.SphereGeometry(r, 24, 16), material, x, y, z); }
  private pipe(points: number[][], radius = .12, material: THREE.Material = this.metal): THREE.Mesh {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1], p[2])));
    return this.mesh(new THREE.TubeGeometry(curve, 20, radius, 8, false), material, 0, 0, 0);
  }
  private label(text: string, x: number, y: number, z: number, width = 10, color = '#dadace', background = '#182422', fontSize = 46): THREE.Mesh {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 192;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = background; ctx.fillRect(0, 0, 1024, 192);
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.strokeRect(16, 16, 992, 160); ctx.fillStyle = color; ctx.font = `${fontSize}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 512, 98, 942);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; this.textures.add(map);
    const material = new THREE.MeshStandardMaterial({ map, roughness: .72 }); this.materials.add(material);
    return this.mesh(new THREE.PlaneGeometry(width, width * 192 / 1024), material, x, y, z);
  }
  private lamp(x: number, y: number, z: number, warm = true, hanging = false): void {
    this.lampShade(x, y, z, hanging);
    this.root.add(this.lampLight(x, y, z, warm));
  }
  private lampShade(x: number, y: number, z: number, hanging = false): void {
    if (hanging) this.cylinder(this.metal, x, y + 1.8, z, .035, 3.6);
    this.mesh(new THREE.CylinderGeometry(.75, 1.15, .55, 24, 1, true), this.brass, x, y + .15, z);
    this.sphere(this.glow, x, y, z, .18);
  }
  private lampLight(x: number, y: number, z: number, warm = true): THREE.PointLight {
    const light = new THREE.PointLight(warm ? 0xffd6a1 : 0xc7e4e2, warm ? 135 : 185, 30, 2); light.position.set(x, y - .3, z); return light;
  }
  private table(x: number, z: number, w = 6, d = 3, material = this.wood, y = 2.6): void {
    this.box(material, x, y, z, w, .28, d, .07);
    for (const dx of [-w / 2 + .3, w / 2 - .3]) for (const dz of [-d / 2 + .3, d / 2 - .3]) this.box(this.black, x + dx, y / 2, z + dz, .23, y, .23);
  }
  private chair(x: number, z: number, angle = 0, red = false): void {
    const start = this.root.children.length; const mat = red ? this.leather : this.black;
    this.box(mat, 0, 1.5, 0, 2.5, .6, 2.5, .16); this.box(mat, 0, 2.8, -1, 2.5, 2.6, .5, .2);
    for (const dx of [-1, 1]) for (const dz of [-.9, .9]) this.cylinder(this.wood, dx, .65, dz, .13, 1.3);
    if (red) for (const dx of [-1.2, 1.2]) this.box(mat, dx, 2.1, 0, .48, .9, 2.7, .2);
    const group = new THREE.Group(); const children = this.root.children.slice(start); children.forEach(child => group.add(child)); group.scale.setScalar(red ? .85 : .68); group.position.set(x, 0, z); group.rotation.y = angle; this.root.add(group);
  }
  private loungeChair(x: number, z: number, angle: number, template?: THREE.Group): THREE.Group {
    const group = template?.clone() ?? createLoungeChair(this.leather);
    const trim = new Map<THREE.Material, THREE.Material>();
    if (template) {
      // Separate trim materials keep the same batch and material sort order.
      const surfaces = template.children.filter(object => object instanceof THREE.Mesh).map(object => object.material as THREE.Material);
      for (const material of surfaces.sort((a, b) => a.id - b.id)) {
        if (material !== this.leather && !trim.has(material)) trim.set(material, material.clone());
      }
    }
    group.traverse(object => { if (object instanceof THREE.Mesh) {
      object.material = trim.get(object.material) ?? object.material;
      this.own(object.geometry); this.materials.add(object.material);
    } });
    group.position.set(x, 0, z); group.rotation.y = angle; this.root.add(group);
    return group;
  }
  private pillTable(): void {
    const { tableZ: z, tableY: y, tableRadius: radius } = PILL_ROOM;
    const timber = this.mat(0x594632, .77); const edge = this.mat(0x8d7857, .7);
    const profile = [[0, y - .08], [radius - .06, y - .08], [radius, y - .03], [radius, y + .035], [radius - .025, y + .06], [0, y + .06]];
    this.mesh(new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), 64), timber, 0, 0, z);
    this.mesh(new THREE.TorusGeometry(radius - .012, .011, 6, 64), edge, 0, y + .034, z).rotation.x = Math.PI / 2;
    this.cylinder(timber, 0, y / 2, z, .065, y - .15, .075);
    for (let i = 0; i < 3; i++) {
      const angle = i * Math.PI * 2 / 3 + Math.PI / 6;
      const point = (r: number, h: number) => [Math.cos(angle) * r, h, z + Math.sin(angle) * r];
      this.pipe([point(.06, .45), point(.22, .26), point(.47, .055)], .043, timber);
      this.pipe([point(.055, .4), point(.12, 1.2), point(.21, y - .15)], .024, edge);
    }
  }
  private rug(x: number, z: number, width: number, depth: number): void {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#4d3631'; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 7; i++) { ctx.strokeStyle = i % 2 ? '#8b7760' : '#303c35'; ctx.lineWidth = i % 2 ? 3 : 7; ctx.strokeRect(9 + i * 5, 9 + i * 5, 494 - i * 10, 494 - i * 10); }
    for (let row = 0; row < 12; row++) for (let col = 0; col < 11; col++) {
      const px = 53 + col * 40 + row % 2 * 10; const py = 42 + row * 39;
      ctx.strokeStyle = '#887257'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px, py - 9); ctx.lineTo(px + 6, py); ctx.lineTo(px, py + 9); ctx.lineTo(px - 6, py); ctx.closePath(); ctx.stroke();
    }
    for (const size of [135, 111, 91, 67]) {
      ctx.fillStyle = size === 135 || size === 91 ? '#a28b69' : '#3d4840'; ctx.beginPath(); ctx.moveTo(256, 256 - size); ctx.lineTo(256 + size * .72, 256); ctx.lineTo(256, 256 + size); ctx.lineTo(256 - size * .72, 256); ctx.closePath(); ctx.fill();
    }
    for (let y = 0; y < 512; y += 2) { ctx.fillStyle = y % 4 ? '#00000014' : '#d6c1990a'; ctx.fillRect(0, y, 512, 1); }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; this.textures.add(texture);
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }); this.materials.add(material);
    this.box(material, x, .025, z, width, .04, depth);
  }
  private trackingEquipment(): void {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    for (let tile = 0; tile < 6; tile++) {
      const ox = tile % 3 * 256, oy = Math.floor(tile / 3) * 256;
      const ink = tile % 2 ? '#a0c6c8' : '#95b397';
      ctx.fillStyle = '#060e10'; ctx.fillRect(ox, oy, 256, 256);
      ctx.strokeStyle = '#1b3537'; ctx.lineWidth = 1;
      for (let i = 24; i < 256; i += 24) {
        ctx.beginPath(); ctx.moveTo(ox + i, oy + 24); ctx.lineTo(ox + i, oy + 234); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ox + 12, oy + i); ctx.lineTo(ox + 244, oy + i); ctx.stroke();
      }
      ctx.fillStyle = ink; ctx.font = '10px monospace'; ctx.fillText(['SIGNAL / CH 01', 'CARRIER TRACE', 'BODY TELEMETRY', 'LOCAL GRID', 'RETURN PATH', 'ACQUISITION'][tile], ox + 14, oy + 17);
      ctx.strokeStyle = ink; ctx.lineWidth = 1.5;
      if (tile === 3 || tile === 4) {
        for (let i = 0; i < 19; i++) {
          const x = ox + 22 + (i * 37 % 210), y = oy + 36 + (i * 61 % 187);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ox + 22 + ((i + 1) * 37 % 210), oy + 36 + ((i + 1) * 61 % 187)); ctx.stroke();
          ctx.fillRect(x - 2, y - 2, 4, 4);
        }
      } else {
        for (let row = 0; row < 3; row++) {
          ctx.beginPath();
          for (let x = 14; x < 244; x++) {
            const pulse = Math.exp(-(((x % 67 - 31) / 4) ** 2)) * (20 + tile * 3);
            const y = oy + 64 + row * 61 + Math.sin(x * (.05 + row * .03) + tile) * 8 - pulse;
            if (x === 14) ctx.moveTo(ox + x, y); else ctx.lineTo(ox + x, y);
          }
          ctx.stroke();
        }
      }
      for (let y = 0; y < 256; y += 3) { ctx.fillStyle = '#00000038'; ctx.fillRect(ox, oy + y, 256, 1); }
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this.textures.add(texture);
    const phosphor = new THREE.MeshStandardMaterial({ color: 0x718f89, map: texture, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: .65, roughness: .3 }); this.materials.add(phosphor);
    const casing = this.mat(0x444b42, .78, .15), panel = this.mat(0x8a8d77, .75, .25);
    const amber = this.mat(0xae753a, .4); amber.emissive.setHex(0xe89c3a); amber.emissiveIntensity = .65;
    for (const [bank, width, depth] of [[0, 6, 3.5], [1, 5.2, 3]] as const) {
      const start = this.root.children.length;
      this.table(0, 0, width, depth, this.metal, 1.8);
      for (const x of [-width * .28, width * .28]) {
        this.box(this.black, x, .84, -.12, width * .42, 1.35, depth * .7, .06);
        for (const y of [.35, 1.35]) this.box(this.metal, x, y, depth * .35, width * .44, .06, .06);
        for (const dx of [-.3, .3]) this.box(this.metal, x + dx, .9, depth * .35 + .05, .05, .25, .08);
      }
      const units = [[-width * .27, 2.57, .12, .68, 0], [width * .25, 2.73, -.18, .81, 1], [width * .25, 4.12, -.23, .46, 2]];
      for (const [x, y, z, scale, id] of units) {
        this.box(casing, x, y, z, 2.65 * scale, 1.9 * scale, 1.85 * scale, .14 * scale);
        this.box(this.black, x - .12 * scale, y + .07 * scale, z + .94 * scale, 2.28 * scale, 1.54 * scale, .1, .12 * scale);
        const face = new THREE.PlaneGeometry(1.93 * scale, 1.27 * scale, 10, 8);
        const p = face.getAttribute('position'), uv = face.getAttribute('uv'); const tile = bank * 3 + id;
        for (let i = 0; i < p.count; i++) {
          p.setZ(i, .065 * scale * (1 - (p.getX(i) / scale) ** 2 - (p.getY(i) / scale) ** 2));
          uv.setXY(i, (tile % 3 + .03 + uv.getX(i) * .94) / 3, (1 - Math.floor(tile / 3) + .03 + uv.getY(i) * .94) / 2);
        }
        face.computeVertexNormals(); this.mesh(face, phosphor, x - .12 * scale, y + .07 * scale, z + 1.002 * scale);
        for (const dy of [-.42, -.08, .26]) this.cylinder(this.black, x + 1.12 * scale, y + dy * scale, z + .96 * scale, .07 * scale, .08).rotation.x = Math.PI / 2;
        this.box(amber, x + 1.12 * scale, y - .7 * scale, z + .991 * scale, .04, .04, .025);
        for (let i = 0; i < 8; i++) this.box(this.black, x - .7 * scale + i * .2 * scale, y + .956 * scale, z - .25 * scale, .055 * scale, .012, .65 * scale);
        this.pipe([[x - .36 * scale, y + .97 * scale, z], [x - .3 * scale, y + 1.14 * scale, z], [x + .3 * scale, y + 1.14 * scale, z], [x + .36 * scale, y + .97 * scale, z]], .035, this.metal);
      }
      for (let rack = 0; rack < 3; rack++) {
        const y = 3.44 + rack * .32;
        this.box(this.black, -width * .27, y, -.37, width * .46, .3, 1.35, .035);
        this.box(panel, -width * .27, y, .325, width * .43, .24, .045);
        for (let knob = 0; knob < 4; knob++) {
          const x = -width * .45 + knob * width * .08;
          this.cylinder(this.black, x, y, .38, .045, .055).rotation.x = Math.PI / 2;
          this.box(amber, x + .09, y + .06, .359, .025, .025, .018);
        }
      }
      this.box(panel, -.5, 1.995, depth / 2 - .35, 2.2, .12, .62, .045);
      for (let row = 0; row < 4; row++) for (let key = 0; key < 13; key++) this.box(this.black, -1.47 + key * .15, 2.08, depth / 2 - .56 + row * .13, .105, .04, .075, .01);
      for (let i = 0; i < 4; i++) this.pipe([[-width * .25, 2.1, -.6], [-width * .47, 1.2, -.65 + i * .12], [-width * .3 + i * .15, .12, -.75], [.7, .1, -depth * .35]], .015, this.black);
      const group = new THREE.Group(); this.root.children.slice(start).forEach(child => group.add(child));
      group.position.set(bank ? 5 : -16.5, 0, -18.5); group.rotation.y = bank ? 0 : Math.PI / 2; this.root.add(group);
    }
    this.cylinder(this.metal, -5.2, 2.7, -18.7, .045, 5.4);
    for (const [dx, dz] of [[-.6, .4], [.6, .4], [0, -.7]]) this.pipe([[-5.2 + dx, .05, -18.7 + dz], [-5.2, 1.1, -18.7]], .035, this.metal);
    this.box(this.black, -5.2, 5.55, -18.7, 2.15, 1.3, .35, .05);
    this.box(this.glow, -5.2, 5.55, -18.51, 1.95, 1.08, .04);
    const light = new THREE.PointLight(0xc7d8d0, 120, 24, 2); light.position.set(-5.2, 5.55, -18.2); this.root.add(light);
  }
  private crt(x: number, y: number, z: number, scale = 1, blue = false): void {
    this.box(this.black, x, y + .25 * scale, z, 2.5 * scale, 2 * scale, 1.8 * scale, .18);
    const screen = this.box(this.mat(blue ? 0x587888 : 0x354b35, .25), x, y + .3 * scale, z + .92 * scale, 2.1 * scale, 1.5 * scale, .08, .12);
    (screen.material as THREE.MeshStandardMaterial).emissive.setHex(blue ? 0x315367 : 0x1b452e); (screen.material as THREE.MeshStandardMaterial).emissiveIntensity = .7;
    if (this.currentScene === 'm3_emp' && !this.hammerMonitors) {
      const glyphs = this.glow.clone(); glyphs.name = 'hammer-crt-glyphs'; this.materials.add(glyphs);
      this.hammerMonitors = { face: screen.material as THREE.MeshStandardMaterial, glyphs };
    }
    for (let i = 0; i < 6; i++) this.box(this.hammerMonitors?.glyphs ?? this.glow, x - .3 * scale, y + (.7 - i * .18) * scale, z + .971 * scale, (i % 3 + 1) * .4 * scale, .024 * scale, .01);
    this.box(this.metal, x, y - scale, z, 1.2 * scale, .15, 1.1 * scale);
  }
  private window(x: number, y: number, z: number, w: number, h: number, side = false): void {
    const start = this.root.children.length;
    this.box(this.glass, 0, 0, 0, w, h, .12);
    for (const dx of [-w / 2, 0, w / 2]) this.box(this.wood, dx, 0, .1, .16, h + .4, .4);
    for (const dy of [-h / 2, 0, h / 2]) this.box(this.wood, 0, dy, .1, w + .4, .16, .4);
    this.box(this.marble, 0, -h / 2 - .2, .3, w + .8, .35, 1.1, .07);
    const group = new THREE.Group(); this.root.children.slice(start).forEach(c => group.add(c)); group.position.set(x, y, z); if (side) group.rotation.y = Math.PI / 2; this.root.add(group);
  }
  private door(x: number, z: number, number?: string): void {
    this.box(this.wood, x, 4, z, 4.8, 8, .35, .08);
    for (const dx of [-2.65, 2.65]) this.box(this.white, x + dx, 4.3, z + .1, .35, 8.6, .6);
    this.box(this.white, x, 8.5, z + .1, 5.6, .3, .6);
    for (const y of [2, 5.6]) { this.box(this.black, x, y, z + .19, 3.8, 2.6, .06); this.box(this.wood, x, y, z + .24, 3.6, 2.4, .07, .04); }
    this.sphere(this.brass, x + 1.7, 3.6, z + .45, .16);
    if (number) this.label(number, x, 6.4, z + .32, 1.6, '#d8bf7b', '#342f21');
  }
  private impossibleDoor(scene: 'm2_seraph' | 'm2_backdoors', z: number): void {
    const frame = this.mat(scene === 'm2_seraph' ? 0x4b3e32 : 0xd7d8d0, .6);
    const beyond = this.mat(scene === 'm2_seraph' ? 0xdde3d8 : 0x9fac95, .85);
    beyond.emissive.setHex(scene === 'm2_seraph' ? 0xcad9ce : 0x78926f); beyond.emissiveIntensity = .55;
    this.box(this.black, 0, 4.1, z + .12, 6.5, 8.6, .12);
    this.box(beyond, 0, 4.1, z + .25, 5.3, 7.6, .08);
    for (const x of [-3.15, 3.15]) this.box(frame, x, 4.1, z + .55, .5, 8.9, .8);
    this.box(frame, 0, 8.45, z + .55, 6.8, .42, .8);
    const panel = this.box(scene === 'm2_seraph' ? this.wood : this.white, SERAPH_DOOR.width / 2, 4.05, 0, SERAPH_DOOR.width, SERAPH_DOOR.height, SERAPH_DOOR.depth, .08);
    panel.name = `${scene}-keyed-door`;
    const group = new THREE.Group(); group.userData.dynamic = true; group.position.set(SERAPH_DOOR.hingeX,0,z+.68); group.add(panel); this.root.add(group);
    const h = SERAPH_DOOR.handle, handle = this.sphere(this.brass,h.x,h.y,h.z,h.radius); handle.name = 'seraph-door-handle'; group.add(handle);
    const lock = SERAPH_DOOR.lock, hole = this.box(this.black,lock.x,lock.y,lock.z+.01,.045,.12,.015); hole.name = 'seraph-door-keyhole'; group.add(hole);
    this.portalDoor = { scene, panel: group };
  }
  private phone(x: number, z: number, booth = false, handset?: HardlineHandset): void {
    const cabinet = WELLS_BOOTH.cabinet;
    this.box(this.metal, x, cabinet.y, z, cabinet.width, cabinet.height, cabinet.depth, .12); this.box(this.black, x, 4.3, z + .43, .75, .7, .08);
    for (let i = 0; i < 12; i++) this.box(this.white, x - .28 + i % 3 * .23, 3.8 - Math.floor(i / 3) * .18, z + .46, .13, .1, .05);
    if (handset) {
      handset.root.position.set(x + OPENING_PHONE.receiver.x, OPENING_PHONE.receiver.y, z + OPENING_PHONE.receiver.z - OPENING_PHONE.boothZ);
      this.root.add(handset.root);
    } else {
      this.pipe([[x - .67, 4.5, z + .55], [x - .9, 4.1, z + .7], [x - .65, 3.5, z + .55]], .12, this.black);
      this.pipe([[x - .7, 3.7, z + .4], [x - .4, 2.7, z + .5], [x, 3.1, z + .4]], .04, this.black);
    }
    if (booth) {
      for (const dx of [-1.8, 1.8]) for (const dz of [-1.4, 1.4]) this.box(this.metal, x + dx, 3.8, z + dz, .15, 7.6, .15);
      for (const dx of [-1.8, 1.8]) this.box(this.glass, x + dx, 3.8, z, .06, 7, 2.8);
      this.box(this.metal, x, 7.7, z, 3.8, .5, 3.1); this.label('TELEPHONE', x, 7.7, z + 1.57, 3.4);
    }
  }
  private buildWellsBooth(): void {
    this.metal = this.pbr('metal_plate', 0x87948c, 2, .68, .25);
    this.black = this.mat(0x1c241f, .7);
    this.white = this.mat(0xaeb6a4, .76);
    this.glass = new THREE.MeshPhysicalMaterial({ color: 0xa0b7a6, metalness: .12, roughness: .13,
      transparent: true, opacity: .24, side: THREE.DoubleSide, depthWrite: false });
    this.materials.add(this.glass);
    const frame = this.mat(0x889d8c, .52, .53);
    const boothZ = OPENING_PHONE.boothZ;
    this.openingBooth = new THREE.Group(); this.openingBooth.name = 'opening-phone-booth'; this.openingBooth.userData.dynamic = true;
    this.openingBooth.position.z = boothZ; this.root.add(this.openingBooth);
    const phoneStart = this.root.children.length;
    this.openingReceiver = new HardlineHandset(); this.openingReceiver.root.name = 'opening-booth-receiver';
    this.phone(0, 0, false, this.openingReceiver);
    const { backboard, post: postBox, pane: paneBox, roof: roofBox } = WELLS_BOOTH;
    this.box(this.metal, backboard.x, backboard.y, backboard.z, backboard.width, backboard.height, backboard.depth);
    const phonePart = new THREE.Group(); phonePart.name = 'opening-booth-phone';
    this.root.children.slice(phoneStart).forEach(child => phonePart.add(child)); this.openingBooth.add(phonePart);
    this.openingBoothParts.push({ root: phonePart, kind: 'phone', x: 0, z: 0 });
    const wireGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(48 * 3), 3));
    this.geometries.add(wireGeometry);
    const wireMaterial = new THREE.LineBasicMaterial({ color: 0x121611 }); this.materials.add(wireMaterial);
    this.openingCord = new THREE.Line(wireGeometry, wireMaterial); this.openingCord.name = 'opening-phone-cord'; phonePart.add(this.openingCord);
    for (const { x, z } of WELLS_BOOTH.posts) {
      const post = new THREE.Group(); post.name = 'opening-booth-post'; post.position.set(x, 0, z);
      post.add(this.box(frame, 0, postBox.y, 0, postBox.width, postBox.height, postBox.depth)); this.openingBooth.add(post);
      this.openingBoothParts.push({ root: post, kind: 'post', x, z });
    }
    for (const x of WELLS_BOOTH.panes) {
      const pane = this.box(this.glass, x, paneBox.y, 0, paneBox.width, paneBox.height, paneBox.depth); pane.name = 'opening-booth-intact-pane';
      this.openingBooth.add(pane); this.openingBoothPanes.push(pane);
      for (const y of [.78, 2.4, 4.42, 6.83]) pane.add(this.box(frame, 0, y - paneBox.y, 0, .061, .105, paneBox.depth));
      pane.add(this.box(frame, 0, .54 - paneBox.y, 0, .06, .45, paneBox.depth));
    }
    const roofStart = this.root.children.length;
    this.box(frame, 0, roofBox.y, 0, roofBox.width, roofBox.height, roofBox.depth);
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 80;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#31583c'; ctx.fillRect(0, 0, 512, 80);
    ctx.fillStyle = '#e4e9d7'; ctx.font = 'bold 70px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('CITY', 229, 42);
    for (let i = 0; i < 9; i++) ctx.fillRect(330 + i % 3 * 13, 22 + Math.floor(i / 3) * 13, 9, 9);
    const signMap = new THREE.CanvasTexture(canvas); signMap.colorSpace = THREE.SRGBColorSpace; this.textures.add(signMap);
    const fascia = new THREE.MeshStandardMaterial({ map: signMap, emissiveMap: signMap, emissive: 0xe9f2e0, emissiveIntensity: .58, roughness: .74 });
    this.materials.add(fascia);
    const sign = this.mesh(new THREE.PlaneGeometry(3.25, .44), fascia, 0, roofBox.y, roofBox.depth / 2 + .01);
    const back = sign.clone(); back.position.z *= -1; back.rotation.y = Math.PI; this.root.add(back);
    for (const side of [-1, 1]) {
      const sideSign = sign.clone(); sideSign.position.set(side * (roofBox.width / 2 + .01), roofBox.y, 0);
      sideSign.rotation.y = side * Math.PI / 2; sideSign.scale.x = .86; this.root.add(sideSign);
    }
    const roof = new THREE.Group(); roof.name = 'opening-booth-roof'; roof.position.y = roofBox.y;
    this.root.children.slice(roofStart).forEach(child => { child.position.y -= roofBox.y; roof.add(child); }); this.openingBooth.add(roof);
    this.openingBoothParts.push({ root: roof, kind: 'roof', x: 0, z: 0 });
    this.openingGlass = new THREE.Group(); this.openingGlass.name = 'opening-shattered-glass'; this.openingGlass.userData.dynamic = true;
    this.openingGlass.visible = false; this.openingGlass.position.z = boothZ; this.root.add(this.openingGlass);
    for (const side of [-1, 1]) for (let row = 0; row < 4; row++) for (let column = 0; column < 2; column++) for (const triangle of [0, 1]) {
      const y = .3 + row * 1.75, z = -1.4 + column * 1.4;
      const points = triangle === 0 ? [[y, z], [y + 1.75, z], [y + 1.75, z + 1.4]] : [[y, z], [y + 1.75, z + 1.4], [y, z + 1.4]];
      const cy = points.reduce((sum, p) => sum + p[0], 0) / 3, cz = points.reduce((sum, p) => sum + p[1], 0) / 3;
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap(p => [0, p[0] - cy, p[1] - cz]), 3)); geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      const shard = this.mesh(geometry, this.glass, side * 1.8, cy, cz, this.openingGlass); shard.name = 'opening-booth-glass-fragment';
      this.openingGlassPieces.push({ mesh: shard, origin: shard.position.clone(), side });
    }
  }
  private car(x: number, z: number, color = 0x182622, truck = false): THREE.Group {
    const start = this.root.children.length; const paint = this.mat(color, .26, .62);
    const { chassis, windshield, roof, wheels } = WELLS_TRUCK;
    this.box(paint, chassis.x, chassis.y, chassis.z, chassis.width, chassis.height, truck ? chassis.depth : 9, .5);
    this.box(this.glass, windshield.x, windshield.y, windshield.z, windshield.width, windshield.height, truck ? windshield.depth : 4.7, .45);
    this.box(paint, roof.x, roof.y, roof.z, roof.width, roof.height, truck ? roof.depth : 4.8, .1);
    if (truck) this.box(this.white, 0, 4.3, 7, 5.6, 7, 13, .15);
    for (const wheel of wheels) this.cylinder(this.black, wheel.x, wheel.y, wheel.z, wheel.height / 2, wheel.width).rotation.z = Math.PI / 2;
    for (const dx of [-1.35, 1.35]) this.box(this.glow, dx, 2, -4.52, .8, .45, .08, .12);
    this.box(this.metal, 0, 1.3, -4.57, 4.1, .32, .13, .1);
    const group = new THREE.Group(); this.root.children.slice(start).forEach(c => group.add(c)); group.position.set(x, 0, z); this.root.add(group); return group;
  }
  private shell(set: FilmSet): void {
    if (set.architecture === 'lafayette') { this.lafayetteRoomShell(set); return; }
    const { width: w, depth: d, height: h } = set; const exterior = outdoor.has(set.architecture);
    const lavish = ['chateau', 'lobby', 'restaurant', 'hel', 'architect'].includes(set.architecture);
    const industrial = ['ship', 'engineering', 'garage', 'power', 'zion', 'temple', 'pods', 'machine'].includes(set.architecture);
    const floor = set.id === 'film_hotel_roofs' ? this.pbr('asphalt_02', 0x8b8e83, 6, .91, 0, 'surfaces') : this.currentScene === 'm2_key_door' ? this.pbr('damaged_plaster', 0x798380, 8) : set.architecture === 'architect' ? this.mat(0xecece7, .28) : lavish ? this.marble : industrial ? this.metal : ['construct', 'mobil', 'backdoors'].includes(set.architecture) ? this.white : exterior ? this.pbr('damaged_plaster', set.architecture === 'garden' ? 0x6f7851 : 0x6f7879, 14) : this.wood;
    if (set.id === 'film_hotel_roofs') {
      const { roofGapNear: near, roofGapFar: far, roofDrop: drop } = OPENING_ESCAPE;
      this.box(floor, 0, -.3, (near + d / 2) / 2, w, .6, d / 2 - near);
      this.box(floor, 0, -.3, (far - d / 2) / 2, w, .6, far + d / 2);
      this.box(floor, 0, -drop - .25, (near + far) / 2, w + 24, .5, near - far);
      const glass = this.mat(0x26322c, .73), lit = this.mat(0x564933, .73);
      lit.emissive.setHex(0x96744a); lit.emissiveIntensity = .55;
      for (const z of [near, far]) {
        const inside = z === near ? 1 : -1, face = z - inside * .04;
        this.box(this.plaster, 0, -drop / 2, z + inside * .3, w, drop, .6);
        this.box(this.metal, 0, .14, z + inside * .14, w, .28, .28);
        for (let level = 1; level <= 4; level++) for (let bay = -3; bay <= 3; bay++) {
          const x = bay * 7, y = -level * 7;
          this.box((level * 5 + bay + inside) % 9 === 0 ? lit : glass, x, y, face, 2.7, 3.1, .08);
          this.box(this.black, x, y - 1.58, face, 3.1, .15, .26);
        }
      }
      for (const [x, z, length] of [[-12, 31, 21], [11, 31, 19], [-10, -24, 19], [13, -32, 18]])
        this.box(this.black, x, .009, z, .14, .018, length);
    } else if (set.id === 'film_jump_roofs') {
      this.box(floor, 0, -.3, (-13 + d / 2) / 2, w, .6, d / 2 + 13);
      this.box(floor, 0, -.3, (-30 - d / 2) / 2, w, .6, d / 2 - 30);
      this.box(this.plaster, 0, -22.6, -12.8, w, 45, .5); this.box(this.plaster, 0, -22.6, -30.2, w, 45, .5);
      this.box(this.black, 0, -45, -21.5, w + 50, .7, 17);
      this.box(this.white, 0, .05, -10, 12, .04, .15);
    } else if (set.architecture === 'mobil') {
      this.box(floor, -7, -.3, 0, 30, .6, d);
      this.box(this.black, 15, -1.65, 0, 14, .6, d);
    } else this.box(floor, 0, -.3, 0, w, .6, d);
    if (exterior || set.architecture === 'construct' || set.architecture === 'oracle') return;
    const wall = set.id === 'film_power_station' ? this.pbr('damaged_plaster', 0x915b4d, 3) : this.currentScene === 'm2_key_door' ? this.pbr('damaged_plaster', 0x9ba5a0, 12) : set.architecture === 'architect' ? this.mat(0xf1f1eb, .48) : industrial ? this.metal : lavish || ['oracle', 'dojo', 'teahouse', 'mobil', 'backdoors'].includes(set.architecture) ? this.white : this.plaster;
    for (const x of [-w / 2, w / 2]) {
      if (set.id === 'film_le_vrai' && x < 0) {
        this.box(this.glass, x, h / 2, 0, .22, h - 1, d - 2);
        for (let z = -d / 2 + 1; z <= d / 2; z += 6.8) this.box(this.brass, x + .16, h / 2, z, .34, h, .25, .05);
        for (const y of [.6, h / 2, h - .6]) this.box(this.brass, x + .16, y, 0, .32, .2, d, .05);
        continue;
      }
      this.box(wall, x, h / 2, 0, .7, h, d);
      for (const y of [.7, 3.7, h - .6]) this.box(this.currentScene === 'm2_key_door' ? this.metal : lavish ? this.marble : this.wood, x - Math.sign(x) * .45, y, 0, .35, y === 3.7 ? .18 : .7, d);
    }
    if (set.id === 'film_le_vrai') {
      this.box(this.glass, 0, h / 2, -d / 2, w - 1, h - 1, .22);
      for (let x = -w / 2 + 1; x < w / 2; x += 7) this.box(this.brass, x, h / 2, -d / 2 + .2, .25, h, .28, .05);
      for (const y of [.65, h - .65]) this.box(this.brass, 0, y, -d / 2 + .2, w, .23, .28, .05);
    } else if (set.architecture === 'garage') {
      for (const side of [-1, 1]) this.box(wall, side * (w + 12) / 4, h / 2, -d / 2, (w - 12) / 2, h, .7);
      this.box(wall, 0, (h + 9) / 2, -d / 2, 12, h - 9, .7);
      const daylight = new THREE.MeshBasicMaterial({ color: 0x94b6b2 }); this.materials.add(daylight);
      this.box(daylight, 0, 4.5, -d / 2 - 3, 11.2, 9, .12);
      this.box(this.black, 0, 9.15, -d / 2 + .3, 12.8, .35, 1);
      for (const side of [-1, 1]) this.box(this.black, side * 6, 4.5, -d / 2 + .3, .38, 9, .7);
      const light = new THREE.PointLight(0xbadcd4, 175, 36); light.position.set(0, 7, -38); this.root.add(light);
    } else if (this.currentScene === 'm1_room303') {
      for (const x of [-1, 1]) this.box(wall, x * (w + 7.6) / 4, h / 2, -d / 2, (w - 7.6) / 2, h, .7);
      this.box(wall, 0, (h + 7.6) / 2, -d / 2, 7.6, h - 7.6, .7);
    } else this.box(wall, 0, h / 2, -d / 2, w, h, .7);
    this.box(wall, 0, h / 2, d / 2, w, h, .7);
    // Coffers instead of a solid ceiling retain daylight and a readable close camera.
    for (let z = -d / 2; z <= d / 2; z += 12) this.box(industrial || this.currentScene === 'm2_key_door' ? this.metal : this.white, 0, h - .4, z, w, .6, .7);
    for (const x of [-w * .24, w * .24]) this.box(this.currentScene === 'm2_key_door' ? this.metal : this.white, x, h, 0, .6, .5, d);
    for (const o of filmObstacles(set)) {
      if (['film_hel_garage', 'film_club_hel'].includes(set.id)) continue;
      if (['oracle', 'teahouse', 'power'].includes(set.architecture) || ['film_le_vrai', 'film_keymaker_workshop'].includes(set.id)) continue;
      const column = set.architecture === 'lobby' ? this.mat(0x2d4038, .28, .08) : lavish ? this.marble : this.metal;
      this.box(column, o.x, h / 2, o.z, o.width, h, o.depth, .08);
      for (const y of [.35, h - .5]) this.box(lavish ? this.marble : this.metal, o.x, y, o.z, 2.5, .7, 2.5, .06);
    }
    if (['day', 'warm'].includes(set.light) && !['dojo', 'teahouse'].includes(set.architecture) && set.id !== 'film_le_vrai') for (let z = -d / 2 + 9; z < d / 2 - 6; z += 13) this.window(-w / 2 + .45, h * .58, z, 7, h * .53, true);
    for (let z = -d / 2 + 12; z < d / 2 - 4; z += 22) for (const x of [-w * .25, w * .25]) this.lamp(x, h - 2, z, set.light === 'warm' || lavish, true);
  }
  private build(set: FilmSet, preparedLights?: LafayetteRoomLights): void {
    for (const _ of this.buildSteps(set, preparedLights)) { /* Build immediately for direct entry and restore. */ }
  }
  private buildChateauProps(): void {
    const volley = new THREE.Group();
    volley.name = 'chateau-stopped-rounds'; volley.visible = false;
    this.root.add(volley); this.chateauVolley = volley;
    const bullet = this.mat(0xc5b49a, .2, .85);
    for (let i = 0; i < 8; i++) {
      const round = this.mesh(new THREE.CylinderGeometry(.035, .035, .34, 8), bullet, -2.6 + i * .72, 3.05 + Math.sin(i * 2.4) * .26, 2.4 + i % 3 * .4, volley);
      round.rotation.x = Math.PI / 2;
    }
    this.chateauDoor = this.mesh(new THREE.BoxGeometry(5, 7, .38), this.wood, 0, 14.5, -40.7);
    this.chateauDoor.name = 'chateau-upper-door';
  }
  private *buildSteps(set: FilmSet, preparedLights?: LafayetteRoomLights, staged = false): Generator<void> {
    if (set.id === 'film_wells_phone') {
      this.wellsStreet = new WellsStreetRenderer(this.root, set);
      if (staged) yield;
      this.buildWellsBooth();
      return;
    }
    const lafayette = set.architecture === 'lafayette';
    this.metal = this.pbr('metal_plate', 0x9caaa9, 3, .7, .28);
    this.wood = this.pbr('old_wood_floor', lafayette ? 0x7d7968 : 0x96826b, lafayette ? 1 : 3, lafayette ? .88 : .85); this.marble = this.pbr('marble_01', 0xbdcbd1, 4, .25);
    this.plaster = this.pbr(lafayette ? 'white_plaster_02' : 'damaged_plaster', lafayette ? 0x737b67 : set.id === 'film_hotel_roofs' ? 0x716c5e : 0xadae9c, lafayette ? 1 : 5, lafayette ? .95 : .85); this.leather = this.pbr('leather_red_03', lafayette ? 0xb48b79 : 0x71413a, 1, lafayette ? .74 : .48);
    this.roofSurfaceSources = undefined;
    if (lafayette) this.plaster.normalScale.set(.1, .1);
    this.white = this.pbr('white_plaster_02', 0xd8d9ce, 3); this.black = this.mat(0x161b1a, .44); this.brass = this.mat(0x8e7951, .32, .8);
    this.glass = new THREE.MeshPhysicalMaterial({ color: 0xb3c9c7, metalness: .12, roughness: .12, transparent: true, opacity: .3, side: THREE.DoubleSide, depthWrite: false }); this.materials.add(this.glass);
    this.glow = new THREE.MeshBasicMaterial({ color: 0xffdb9e, toneMapped: false }); this.materials.add(this.glow);
    this.shell(set);
    const lights = lafayette ? preparedLights ?? this.lafayetteRoomLights() : undefined;
    if (lights) { lights.shell.position.set(0, 0, 0); this.root.add(lights.shell); }
    if (lafayette || staged) yield;
    const a = set.architecture;
    if (['hotel', 'apartment', 'oracle', 'lafayette', 'tenement'].includes(a)) yield* this.domestic(set);
    // Keep the tracking equipment light between the shell lights and room fixtures.
    if (lights) this.root.add(lights.fixtures);
    if (['office', 'interrogation', 'power', 'workshop', 'backdoors', 'architect'].includes(a)) this.workplace(set);
    if (['chateau', 'restaurant', 'club', 'hel'].includes(a)) this.publicInterior(set);
    if (['ship', 'engineering', 'zion', 'temple', 'pods', 'machine', 'desert'].includes(a)) this.realWorld(set);
    if (['subway', 'mobil'].includes(a)) this.station(set);
    if (['rooftop', 'street', 'rain', 'bridge', 'freeway', 'garage', 'car'].includes(a)) this.transport(set);
    if (staged && set.id === 'film_hotel_roofs') yield;
    if (['dojo', 'teahouse', 'construct', 'plaza', 'courtyard', 'garden'].includes(a)) this.special(set);
    if (outdoor.has(a) && !['pods', 'machine', 'desert'].includes(a)) this.skyline(set);
    if (!outdoor.has(a) && a !== 'lafayette' && a !== 'oracle') {
      const fill = new THREE.HemisphereLight(set.light === 'warm' ? 0xeed9b7 : 0xc7d3d3, 0x3e3830, .5); this.root.add(fill);
      const spot = new THREE.SpotLight(set.light === 'warm' ? 0xffd8b1 : 0xe5eee9, 2100, 120, Math.PI / 3, .7, 2);
      spot.position.set(-set.width * .28, set.height + 5, 10); spot.target.position.set(0, 0, -5); spot.castShadow = true;
      spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -.0002; spot.shadow.normalBias = .05;
      this.root.add(spot, spot.target);
    }
  }
  private lafayetteSurface(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, tile = 6): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const uv = geometry.attributes.uv, position = geometry.attributes.position, normal = geometry.attributes.normal;
    // Keep the scan at the same physical scale across differently sized walls.
    for (let i = 0; i < uv.count; i++) {
      const side = Math.abs(normal.getX(i)) > .5; const top = Math.abs(normal.getY(i)) > .5;
      uv.setXY(i, (side ? z + position.getZ(i) : x + position.getX(i)) / tile,
        (top ? z + position.getZ(i) : y + position.getY(i)) / tile);
    }
    return this.mesh(geometry, material, x, y, z);
  }
  private lafayettePaneling(x: number, z: number, width: number, height: number, angle: number, wallpaper: THREE.Material): void {
    const start = this.root.children.length;
    const paint = this.mat(0x535d4b, .91), lip = this.mat(0x737a66, .9), shadow = this.mat(0x343d31, .96);
    for (const [y, h, depth] of [[.18, .3, .22], [.43, .15, .28], [2.62, .2, .28], [height - .53, .28, .38], [height - .18, .18, .46]])
      this.box(paint, 0, y, .38, width, h, depth);
    const count = Math.max(1, Math.round(width / 5.8)), slot = (width - .7) / count;
    for (let i = 0; i < count; i++) {
      const cx = -.35 - width / 2 + slot * (i + .5) + .7;
      const w = Math.max(.5, slot - .52);
      for (const [bottom, top] of [[.73, 2.25], [3.08, height - 1]]) {
        this.lafayetteSurface(bottom > 3 ? wallpaper : this.plaster, cx, (bottom + top) / 2, .34, w, top - bottom, .03);
        for (const side of [-1, 1]) {
          this.box(shadow, cx + side * (w / 2 + .045), (bottom + top) / 2, .385, .11, top - bottom + .18, .07);
          this.box(paint, cx + side * (w / 2 + .1), (bottom + top) / 2, .465, .18, top - bottom + .32, .28);
          this.box(lip, cx + side * (w / 2 - .005), (bottom + top) / 2, .475, .04, top - bottom, .09);
          const y = side < 0 ? bottom : top;
          this.box(shadow, cx, y, .385, w + .22, .11, .07);
          this.box(paint, cx, y + side * .075, .465, w + .38, .18, .28);
          this.box(lip, cx, y - side * .025, .475, w, .04, .09);
        }
      }
    }
    const group = new THREE.Group(); this.root.children.slice(start).forEach(child => group.add(child));
    group.position.set(x, 0, z); group.rotation.y = angle; this.root.add(group);
  }
  private lafayetteParquet(width: number, depth: number): void {
    this.lafayetteSurface(this.mat(0x302f27, .95), 0, -.33, 0, width, .6, depth);
    const length = 2.4, board = .6;
    const plank = (x: number, z: number, w: number, d: number, vertical: boolean) => {
      const left = Math.max(-width / 2, x), right = Math.min(width / 2, x + w);
      const near = Math.max(-depth / 2, z), far = Math.min(depth / 2, z + d);
      if (right - left <= .02 || far - near <= .02) return;
      const geometry = new THREE.BoxGeometry(right - left - .012, .028, far - near - .012);
      const uv = geometry.attributes.uv, position = geometry.attributes.position, normal = geometry.attributes.normal;
      for (let i = 0; i < uv.count; i++) if (normal.getY(i) > .5) {
        const u = (position.getX(i) + (right - left) / 2) / 6, v = (position.getZ(i) + (far - near) / 2) / 6;
        uv.setXY(i, (vertical ? v : u) + (Math.abs(x * .31 + z * .17) % .6), vertical ? u : v);
      }
      this.mesh(geometry, this.wood, (left + right) / 2, -.014, (near + far) / 2);
    };
    // An L pair repeats along (length,length) and (board,-board), without gaps
    // or stacked boards. Cut edge pieces to the actual room footprint.
    const rows = Math.ceil((width + depth) / length), columns = Math.ceil((width + depth) / board);
    for (let i = -rows; i <= rows; i++) for (let j = -columns; j <= columns; j++) {
      const x = i * length + j * board, z = i * length - j * board;
      plank(x, z, length, board, false); plank(x + length, z, board, length, true);
    }
  }
  private lafayetteRoomShell(set: FilmSet): void {
    const { width: w, depth: d, height: h } = set;
    const trim = this.mat(0x414b3a, .87); const edge = this.mat(0x727561, .91);
    const wallpaper = this.imageMaterial('lafayette-wallpaper-v1', 0x5b6251, true, 0xa0a58e);
    this.lafayetteParquet(w, d);
    this.lafayetteSurface(this.plaster, 0, h, 0, w, .5, d);
    for (const z of [-d / 2, d / 2]) {
      this.lafayetteSurface(this.plaster, 0, h / 2, z, w, h, .7);
      this.lafayettePaneling(0, z, w, h, z < 0 ? 0 : Math.PI, wallpaper);
    }
    // Three recessed sash windows, with solid piers instead of glass over a wall.
    const cloth = this.pbr('white_plaster_02', 0x78604b, 3, 1); cloth.side = THREE.DoubleSide; cloth.normalScale.set(.025, .025);
    const windows = [-18, -2, 14]; let start = -d / 2;
    for (const z of [...windows, d / 2 + 4]) {
      const end = z - 4;
      if (end > start) {
        this.lafayetteSurface(this.plaster, -w / 2, h / 2, (start + end) / 2, .7, h, end - start);
        this.lafayettePaneling(-w / 2, (start + end) / 2, end - start, h, Math.PI / 2, wallpaper);
      }
      if (z <= d / 2) {
        this.lafayetteSurface(this.plaster, -w / 2, .425, z, .7, .85, 8);
        this.lafayetteSurface(this.plaster, -w / 2, h - .7, z, .7, 1.4, 8);
        this.lafayetteWindow(-w / 2, z, trim, edge, cloth, h);
      }
      start = z + 4;
    }
    for (const y of [.18, .43, h - .53, h - .18]) this.box(y > 4 ? edge : trim, -w / 2 + .43, y, 0, .28, .16, d);
    for (const wall of HOTEL_WALLS.filter(wall => wall.x === LAFAYETTE.door.x && wall.y === LAFAYETTE.upper)) {
      this.lafayetteSurface(this.plaster, wall.x - .12, h / 2, wall.z, .7, h, wall.depth);
      this.lafayettePaneling(wall.x - .12, wall.z, wall.depth, h, -Math.PI / 2, wallpaper);
    }
  }
  private lafayetteRoomLights(): LafayetteRoomLights {
    const shell = new THREE.Group(), fixtures = new THREE.Group();
    const fill = new THREE.HemisphereLight(0xc6cfbd, 0x30291f, .18);
    const key = new THREE.SpotLight(0xc8d2b9, 1900, 50, .85, .65, 2);
    key.position.set(-FILM_SETS.film_lafayette.width / 2 + 1.7, 9.4, -2); key.target.position.set(1, 1.9, -6);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.0002; key.shadow.normalBias = .035;
    const bounce = new THREE.PointLight(0xc6c3a5, 35, 24, 2); bounce.position.set(6, 5, -2);
    const rim = new THREE.SpotLight(0xb7c5b2, 300, 40, 1.1, .8, 2);
    rim.position.set(15, 8, 6); rim.target.position.set(-2, 2, -6);
    const sconce = new THREE.PointLight(0xd8bd86, 24, 15, 2); sconce.position.set(8, 5.5, -10.1);
    fixtures.add(this.lampLight(-13, 7, -18), this.lampLight(7, 6, -17), sconce);
    shell.add(fill, key, key.target, bounce, rim, rim.target, fixtures);
    return { shell, fixtures };
  }
  private lafayetteWindow(x: number, z: number, trim: THREE.Material, edge: THREE.Material, cloth: THREE.Material, height: number): void {
    const bottom = .85, top = height - 1.4, center = (bottom + top) / 2;
    const glass = new THREE.MeshStandardMaterial({ color: 0x66766d, roughness: .4, metalness: .1, transparent: true, opacity: .45, side: THREE.DoubleSide, depthWrite: false }); this.materials.add(glass);
    const pane = this.box(glass, x - .12, center, z, .06, top - bottom, 8);
    pane.castShadow = false; pane.userData.dynamic = true;
    const night = new THREE.MeshBasicMaterial({ color: 0x25342f }); this.materials.add(night);
    const beyond = this.box(night, x - 2, center, z, .05, top - bottom + .8, 8.8);
    beyond.castShadow = false; beyond.userData.dynamic = true;
    for (const offset of [-4, 4]) {
      this.box(trim, x + .22, center, z + offset, .5, top - bottom + .4, .25);
      this.box(edge, x + .5, center, z + offset * 1.05, .18, top - bottom + .7, .11);
    }
    for (const y of [bottom, center, top]) this.box(trim, x + .25, y, z, .45, .19, 8.25);
    this.box(trim, x + .25, center, z, .3, top - bottom, .12);
    this.box(edge, x + .55, bottom - .17, z, 1.1, .22, 8.65, .04);
    this.box(trim, x + .6, top + .45, z, .55, .3, 9.5, .04);
    for (const side of [-1, 1]) {
      const curtainHeight = height - .65;
      const geometry = new THREE.PlaneGeometry(2.05, curtainHeight, 32, 28);
      const p = geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i) / 2.05 + .5; const v = p.getY(i) / curtainHeight + .5;
        const fold = Math.sin(u * Math.PI * 12 + v * .22);
        p.setXYZ(i, side * (u - .5) * (1.85 + (1 - v) * .8), p.getY(i) + (1 - v) ** 5 * (.16 * Math.sin(u * 27) + .07 * Math.sin(u * 61)), fold * (.1 + (1 - v) * .16));
      }
      geometry.computeVertexNormals();
      const curtain = this.mesh(geometry, cloth, x + .95, curtainHeight / 2 + .16, z + side * 3.75); curtain.rotation.y = Math.PI / 2;
    }
  }
  private openingHotelSet(set: FilmSet): void {
    const soot = this.pbr('damaged_plaster', 0x3b4540, 4);
    const plaster = this.pbr('damaged_plaster', 0x6a7066, 5);
    const carpet = this.mat(0x302d2a, .95);
    this.box(this.pbr('old_wood_floor', 0x897f72, 5), 0, .04, 12, set.width - 1.6, .07, 25);
    this.box(carpet, 0, .085, 12, 19, .035, 17);
    this.box(carpet, 0, .024, -11.9, 8.8, .035, 24.2);
    this.box(soot, 0, 10.28, -12.3, set.width - .65, .35, 25.9).castShadow = false;
    for (const wall of OPENING_HOTEL.walls.slice(0, 2)) {
      this.box(soot, wall.x, set.height / 2, wall.z, wall.width, set.height, wall.depth);
      for (const y of [1.1, 3.8, 8.5]) this.box(plaster, wall.x, y, wall.z + .42, wall.width, .16, .06);
    }
    this.box(soot, 0, 10, OPENING_HOTEL.doorZ, 7.12, 4, .65);
    const door = new THREE.Group(); door.name = 'hotel-303-door'; door.userData.dynamic = true;
    door.position.set(-3.23, 0, OPENING_HOTEL.doorZ); this.root.add(door); this.hotel303Door = door;
    door.add(this.box(this.wood, 3.23, 3.95, 0, 6.35, 7.9, .3, .1));
    door.add(this.box(this.metal, 5.8, 3.7, .24, .35, .18, .17));
    this.box(this.metal, 0, 8.1, OPENING_HOTEL.doorZ, 7.2, .34, .65);
    for (const x of [-3.55, 3.55]) {
      this.box(this.metal, x, 4, OPENING_HOTEL.doorZ, .3, 8, .65);
      this.box(soot, x * .925, 4, OPENING_HOTEL.doorZ + .16, .32, 8, .32);
    }
    const plaque = this.label('303', 0, 8.8, OPENING_HOTEL.doorZ + .45, 2.1, '#d8d0b6', '#34413e', 108).clone();
    plaque.name = 'hotel-303-hall-number'; plaque.position.set(3.23, 6.2, -.18);
    plaque.scale.set(1.18, 1.65, 1); plaque.rotation.y = Math.PI; door.add(plaque);

    const desk = OPENING_HOTEL.computer;
    this.table(-11, desk.z, 3, 2.2, this.metal, 2.75);
    this.crt(-11.1, 3.6, desk.z, .66);
    this.chair(-7.5, desk.z + 2, Math.PI);
    this.hotelPhone();
    this.hotel303Pistol = new THREE.Group(); this.hotel303Pistol.name = 'hotel-303-dropped-pistol'; this.hotel303Pistol.userData.dynamic = true;
    this.hotel303Pistol.visible = false; this.root.add(this.hotel303Pistol);
    this.hotel303Pistol.add(this.box(this.black, 0, .22, 0, 1.05, .17, .24));
    const grip = this.box(this.metal, -.24, .08, .15, .24, .27, .14); grip.rotation.z = -.35; this.hotel303Pistol.add(grip);
    this.hotel303Pistol.add(this.box(this.brass, .35, .33, 0, .13, .12, .16));
    this.hotel303DeskLight = new THREE.PointLight(0x8fcbb3, 180, 18, 2);
    this.hotel303DeskLight.position.set(-9.5, 4.8, desk.z); this.root.add(this.hotel303DeskLight);
    const corridorLight = this.hotel303HallLight = new THREE.PointLight(0xc3b89a, 125, 30, 2);
    corridorLight.position.set(0, 9, -12); this.root.add(corridorLight);
    const beamMaterial = new THREE.MeshBasicMaterial({ color: 0xc4dacb, transparent: true, opacity: .034, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
    this.materials.add(beamMaterial);
    const beam = this.hotel303Beam = this.mesh(new THREE.CylinderGeometry(.95, .035, 1, 16, 1, true), beamMaterial, 0, 0, 0);
    beam.name = 'hotel-303-hall-flashlight'; beam.userData.dynamic = true;
    beam.visible = beam.castShadow = beam.receiveShadow = false;
    for (const z of [-20, -12, -4]) {
      this.box(plaster, -set.width / 2 + .65, 4.6, z, .18, 8.6, 7.2);
      this.box(plaster, set.width / 2 - .65, 4.6, z, .18, 8.6, 7.2);
      for (const x of [-12, 12]) {
        this.box(this.wood, x, 3.5, z, 4.8, 7.1, .18, .12);
        this.box(this.brass, x + 1.5, 3.2, z + .14, .16, .16, .1);
      }
      this.box(soot, 0, 10, z, set.width - 1, .25, .28);
    }
    this.label('FIRE EXIT', 0, 8.4, -set.depth / 2 + .55, 5.4, '#c9d0b1', '#27302d');
    this.box(this.metal, 0, 7.65, -set.depth / 2 + .34, 8.1, .35, .3);
    for (const x of [-4, 4]) this.box(this.metal, x, 3.8, -set.depth / 2 + .34, .3, 7.6, .3);
    this.hotel303Glass = new THREE.Group(); this.hotel303Glass.name = 'hotel-303-window'; this.hotel303Glass.userData.dynamic = true; this.root.add(this.hotel303Glass);
    this.hotel303Glass.add(this.box(this.glass, 0, 3.75, OPENING_HOTEL.window.paneZ, 7.6, 7.2, .08));
    this.hotel303Shards = new THREE.Group(); this.hotel303Shards.name = 'hotel-303-window-shards'; this.hotel303Shards.userData.dynamic = true;
    this.hotel303Shards.visible = false; this.root.add(this.hotel303Shards);
    for (let i = 0; i < 28; i++) {
      const angle = i * 2.399, radius = .78 + (i % 7) * .4;
      const x = Math.sin(angle) * radius, y = 3.45 + Math.cos(angle) * radius;
      const shard = this.box(this.glass, x, y, OPENING_HOTEL.window.paneZ, .12 + i % 3 * .12, .04, .28 + i % 4 * .14);
      shard.userData.fragment = { x, y, angle, lateral: Math.sin(angle) * 1.35, travel: 3.5 + i % 7 * .3, spin: 2.8 + i % 5 * .42 };
      this.hotel303Shards.add(shard);
    }
    const lowerDeck = OPENING_HOTEL.lowerDeck;
    this.box(this.metal, 0, lowerDeck.y, lowerDeck.z, lowerDeck.width, lowerDeck.thickness, lowerDeck.depth);
    for (const x of [-5.3, 5.3]) {
      this.box(this.metal, x, 2.15, -set.depth / 2 - 4.8, .16, 4.7, 9);
      for (const z of [-set.depth / 2 - 8, -set.depth / 2 - 5, -set.depth / 2 - 2]) this.box(this.metal, x, 2.4, z, .18, .14, .18);
    }
    const ladder = new THREE.Group(); ladder.name = 'hotel-303-fire-escape-ladder'; this.root.add(ladder);
    const { ladderZ, ladderHeight, ladderRungs, ladderRails, landing } = OPENING_HOTEL;
    const railZ = ladderZ + ladderRungs.offsetZ, deckZ = ladderZ + landing.offsetZ, edge = deckZ + landing.depth / 2;
    const railEnd = ladderZ + ladderRails.endOffsetZ, deckTop = ladderHeight + landing.thickness;
    for (const x of [-ladderRails.x, ladderRails.x]) {
      ladder.add(this.box(this.metal, x, (ladderRails.top - .3) / 2, railZ, ladderRungs.height, ladderRails.top + .3, ladderRungs.depth));
      ladder.add(this.box(this.metal, x, ladderHeight + .06, (railZ + edge) / 2, .16, .18, railZ - edge + .12));
      ladder.add(this.box(this.metal, x, ladderRails.top, (railZ + railEnd) / 2, ladderRungs.depth, ladderRungs.height, railZ - railEnd + ladderRungs.height));
      ladder.add(this.box(this.metal, x, (ladderRails.top + deckTop) / 2, railEnd, ladderRungs.height, ladderRails.top - deckTop, ladderRungs.depth));
    }
    for (let y = ladderRungs.bottom; y < ladderHeight; y += ladderRungs.spacing)
      ladder.add(this.box(this.metal, 0, y, railZ, ladderRungs.width, ladderRungs.height, ladderRungs.depth));
    ladder.add(this.box(this.metal, 0, ladderHeight + landing.thickness / 2, deckZ, landing.width, landing.thickness, landing.depth));
    const exterior = this.pbr('damaged_plaster', 0x73746e, 6);
    this.box(exterior, 0, 8, -42, 27, 16, .5);
    const alley = OPENING_HOTEL.alley, pavement = this.pbr('damaged_plaster', 0x414942, 9);
    this.box(pavement, 0, alley.y - .24, (alley.front + alley.back) / 2, alley.width, .48, alley.front - alley.back);
    this.box(exterior, 0, alley.y / 2, alley.back, alley.width, -alley.y, .5);
    this.box(plaster, 0, alley.y / 2, alley.front, alley.width, -alley.y, .55);
    this.box(this.metal, 0, alley.y + .028, alley.back + 1.65, 12, .055, .16);
    for (const x of [-9, -3, 3, 9]) {
      this.box(this.black, x, 9.5, -41.68, 3.2, 5, .12);
      this.box(this.mat(0x6c775e, .7), x, 9.5, -41.6, 2.8, 4.6, .06);
      this.box(this.black, x, 9.5, -41.5, .12, 4.8, .1);
      this.box(this.black, x, 9.5, -41.5, 2.9, .12, .1);
    }
    const fixtureX = -3.4, fixtureZ = -set.depth / 2 - .62;
    this.box(this.metal, fixtureX, 9.9, fixtureZ, .85, .55, .6);
    this.box(this.glow, fixtureX, 9.61, fixtureZ - .12, .64, .06, .35);
    const escapeLight = new THREE.PointLight(0xb1be9d, 155, 31, 2);
    escapeLight.position.set(fixtureX, 9.48, fixtureZ - .4); this.root.add(escapeLight);
  }
  private updateHotel303Hall(elapsed?: number): void {
    const beam = this.hotel303Beam, light = this.hotel303HallLight;
    if (!beam || !light) return;
    if (elapsed === undefined) {
      if (beam.visible) {
        beam.visible = false; light.position.set(0, 9, -12);
        light.color.setHex(0xc3b89a); light.intensity = 125; light.distance = 30;
      }
      return;
    }
    const lead = openingHotelHallOfficer(0, elapsed);
    const focus = THREE.MathUtils.smoothstep(elapsed, 1.35, 2.7);
    const from = new THREE.Vector3(lead.x + .33, 2.85, lead.z + .45);
    const toward = new THREE.Vector3((-3.35 + Math.sin(elapsed * 2.8) * .7) * (1 - focus),
      THREE.MathUtils.lerp(3.25, 6.2, focus), OPENING_HOTEL.doorZ - .33).sub(from);
    beam.visible = true; beam.position.copy(from).addScaledVector(toward, .5);
    beam.scale.y = toward.length();
    light.position.copy(from).addScaledVector(toward, .69);
    light.color.setHex(0xdbe9d9); light.intensity = 110 - focus * 70; light.distance = 13;
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), toward.normalize());
  }
  private hotelPhone(): void {
    const { x, z, width, depth, height, receiver } = OPENING_HOTEL.phone;
    this.table(x, z, width, depth, this.wood, height);
    const base = this.box(this.black, x + .35, 3.065, z + .1, 1.34, .15, 1.05, .06); base.name = 'hotel-303-phone-base';
    for (let i = 0; i < 12; i++) this.box(this.metal, x + .08 + Math.floor(i / 3) * .12, 3.15, z - .23 + i % 3 * .15, .085, .05, .11);
    const handset = this.hotel303Receiver = new HardlineHandset();
    handset.root.name = 'hotel-303-receiver'; handset.root.userData.dynamic = true;
    handset.root.position.set(receiver.x, receiver.y, receiver.z); handset.root.rotation.x = Math.PI / 2;
    this.root.add(handset.root);
    const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3));
    const material = new THREE.LineBasicMaterial({ color: 0x111513 }); this.geometries.add(geometry); this.materials.add(material);
    this.hotel303Cord = new THREE.Line(geometry, material); this.hotel303Cord.name = 'hotel-303-phone-cord';
    this.root.add(this.hotel303Cord); this.updateHotelPhone();
  }
  private updateHotelPhone(elapsed?: number): void {
    const receiver = this.hotel303Receiver?.root, cord = this.hotel303Cord;
    if (!receiver || !cord) return;
    const phone = OPENING_HOTEL.phone;
    const hand = openingHotelPhoneHeld(elapsed)
      ? this.phoneBodies?.('trinity')?.getObjectByName('hardline-handset') : undefined;
    // The docked curve is constant after initialization and after the receiver returns.
    if (!hand?.visible && receiver.visible && cord.geometry.boundingSphere) return;
    receiver.visible = !hand?.visible;
    const from = new THREE.Vector3(phone.x + .68, 3.08, phone.z - .38);
    const to = hand?.visible ? this.root.worldToLocal(hand.localToWorld(new THREE.Vector3(0, -.31, .07)))
      : receiver.position.clone().add(new THREE.Vector3(0, -.07, -.31));
    const points = cord.geometry.attributes.position, point = new THREE.Vector3();
    for (let i = 0; i < points.count; i++) {
      const t = i / (points.count - 1); point.lerpVectors(from, to, t); point.y -= Math.sin(Math.PI * t) * .18;
      points.setXYZ(i, point.x, Math.max(phone.height + .14, point.y), point.z);
    }
    points.needsUpdate = true; cord.geometry.computeBoundingSphere();
  }
  private poseHotel303Shards(age: number): void {
    const shards = this.hotel303Shards!;
    if (shards.userData.age === age) return;
    shards.userData.age = age;
    const { lowerDeck, window } = OPENING_HOTEL, floor = lowerDeck.y + lowerDeck.thickness / 2 + .022;
    const lift = .8, gravity = 7.6;
    for (const piece of shards.children) {
      const { x, y, angle, lateral, travel, spin } = piece.userData.fragment;
      const landing = (lift + Math.sqrt(lift * lift + 4 * gravity * (y - floor))) / (2 * gravity);
      const time = Math.min(age, landing), tilt = 1 - THREE.MathUtils.smoothstep(time / landing, .75, 1);
      piece.position.set(x + lateral * time, Math.max(floor, y + lift * time - gravity * time * time), window.paneZ - travel * time);
      piece.rotation.set((Math.PI / 2 + spin * time) * tilt, angle + spin * time * .6, spin * time * tilt * .4);
    }
  }
  private *domestic(set: FilmSet): Generator<void> {
    const { architecture: a, width: w, depth: d } = set;
    if (set.id === 'film_heart_hotel' && this.currentScene === 'm1_room303') { this.openingHotelSet(set); return; }
    if (a === 'hotel' || a === 'tenement') {
      for (let z = -d / 2 + 6; z < d / 2 - 6; z += 12) {
        for (const side of [-1, 1]) { const start = this.root.children.length; this.door(0, 0, String(301 + Math.round((z + d / 2) / 12))); const group = new THREE.Group(); this.root.children.slice(start).forEach(c => group.add(c)); group.rotation.y = side * Math.PI / 2; group.position.set(side * (w / 2 - .5), 0, z); this.root.add(group); }
        this.box(this.mat(0x6c332a), 0, .05, z, 9, .08, 11.8);
      }
      this.table(-10, -13, 5, 3); this.crt(-10, 3.6, -13); this.phone(-6, -d / 2 + .8);
      this.label(a === 'hotel' ? 'HEART O’ THE CITY / 303' : 'FIRE EXIT', 0, 9.4, -d / 2 + .4, 14);
      if (a === 'tenement') { this.box(this.white, 13, 1, -19, 8, 1.5, 4, .3); for (let i = 0; i < 9; i++) this.box(this.wood, -w / 2 + 5, i * .6, 15 - i * 1.1, 6, .6, 1.2); }
    }
    if (a === 'apartment') {
      this.table(-10, -11, 8, 4); this.crt(-11, 3.7, -11, 1.1); this.crt(-7.5, 3.3, -12, .75);
      this.box(this.black, -11, 1.2, -14, 2, 2.4, 1.6, .12); this.chair(-10, -6, Math.PI);
      for (let i = 0; i < 6; i++) this.pipe([[-12 + i * .2, 1, -12], [-8 + i * .6, .1, -8], [-13, .1, 4 + i]], .04, this.black);
      this.box(this.wood, 9, .7, 7, 8, 1.4, 11, .2); this.box(this.white, 9, 1.6, 7, 7.7, .8, 10.6, .3);
      this.box(this.mat(set.world === 'real' ? 0x7b7364 : 0x5d6053), 9, 2.05, 8.5, 7.5, .2, 7.3, .1); this.box(this.white, 9, 2.2, 3.4, 5.8, .55, 2, .25);
      this.table(11, -11, 4, 3); this.lamp(11, 5, -11); this.door(0, d / 2 - .4, '101');
    }
    if (a === 'lafayette') {
      const rug = this.imageMaterial('lafayette-rug-v1', 0x493b31);
      this.box(rug, 0, .035, -6, 12, .055, 14);
      const chair = this.loungeChair(-PILL_ROOM.seat, PILL_ROOM.z, Math.PI / 2);
      this.loungeChair(PILL_ROOM.seat, PILL_ROOM.z, -Math.PI / 2, chair);
      this.pillTable();
      this.pillGlass = createPillGlass(); this.pillGlass.position.set(PILL_ROOM.cup.x, PILL_ROOM.cup.y, PILL_ROOM.cup.z); this.root.add(this.pillGlass);
      this.pillGlass.traverse(object => { if (object instanceof THREE.Mesh) { this.geometries.add(object.geometry); this.materials.add(object.material as THREE.Material); } });
      yield;
      const wallpaper = this.imageMaterial('lafayette-wallpaper-v1', 0x5b6251, true, 0xa0a58e); const cable = this.mat(0x1a201f, .9);
      const trim = this.mat(0x414b3a, .87); const wornEdge = this.mat(0x727561, .91);
      for (const wall of filmObstacles(set).filter(item => item.z === -11.5)) {
        // The collision includes the projecting mouldings on both faces.
        this.lafayetteSurface(this.plaster, wall.x, wall.height / 2, wall.z, wall.width, wall.height, wall.depth - .6);
        for (const side of [-1, 1]) this.lafayettePaneling(wall.x, wall.z, wall.width, wall.height, side > 0 ? 0 : Math.PI, wallpaper);
      }
      for (const x of [-8, -4]) {
        this.box(trim, x, 4.5, -11.5, .3, 9.2, .9);
        this.box(wornEdge, x + (x === -8 ? -.2 : .2), 4.5, -10.99, .09, 9.2, .12);
      }
      this.box(trim, -6, 9.1, -11.5, 4.4, .35, .9);
      this.box(rug, -7, .035, -17, 19, .055, 14);
      const chairX = MIRROR_SEAT.x; const chairZ = MIRROR_SEAT.z;
      this.box(this.metal, chairX, .98, chairZ + .15, 2.02, .12, 1.4, .04);
      for (const dx of [-.85, .85]) for (const dz of [-.55, .85]) this.cylinder(this.metal, chairX + dx, .475, chairZ + dz, .075, .95);
      this.box(this.leather, chairX, 1.18, chairZ + .25, 2.12, .32, 1.18, .12);
      this.box(this.leather, chairX, 2.48, chairZ + .92, 2.12, 2.1, .38, .17);
      this.box(this.leather, chairX, 3.47, chairZ + 1.03, 1.35, .5, .46, .16);
      for (const dx of [-1.1, 1.1]) {
        this.box(this.metal, chairX + dx, 1.72, chairZ + .1, .18, .18, 1.65, .04);
        this.box(this.leather, chairX + dx, 1.82, chairZ, .28, .14, 1.45, .06);
      }
      const electrodeStart = this.root.children.length;
      this.box(this.mat(0xbab9a4, .92), 0, -.018, 0, .26, .035, .32, .025);
      this.cylinder(this.metal, 0, .011, 0, .06, .025);
      this.pipe([[0, .03, 0], [.08, .045, .03], [.16, -.01, .05]], .013, cable);
      this.trackingElectrode = new THREE.Group(); this.trackingElectrode.name = 'tracking-electrode'; this.trackingElectrode.userData.dynamic = true;
      this.root.children.slice(electrodeStart).forEach(child => this.trackingElectrode!.add(child)); this.root.add(this.trackingElectrode);
      const leadGeometry = this.own(new THREE.BufferGeometry()); leadGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(33 * 3), 3));
      const leadMaterial = new THREE.LineBasicMaterial({ color: 0x28241c }); this.materials.add(leadMaterial);
      this.trackingLead = new THREE.Line(leadGeometry, leadMaterial); this.trackingLead.name = 'tracking-electrode-lead'; this.root.add(this.trackingLead);
      this.trackingEquipment();
      for (const x of [-17.5, -16.5, -15.5]) this.pipe([[x, 0, -20], [x, 6.5, -20], [chairX - 2.2 + (x + 16.5) * .12, 6.5, chairZ + 1.5], [chairX - 1.9, 3.5, chairZ + 1.2]], .014, cable);
      yield;
      const hearth = this.mat(0x30352f, .96); const stone = this.pbr('marble_01', 0x707363, 1, .94); stone.normalScale.set(.12, .12);
      const carving = this.mat(0x59604f, .92); const f = PILL_ROOM.fireplace;
      const front = f.z + f.depth / 2;
      const leafShape = new THREE.Shape(); leafShape.moveTo(0, 0);
      leafShape.bezierCurveTo(-.13, .12, -.1, .28, 0, .38); leafShape.bezierCurveTo(.1, .28, .13, .12, 0, 0);
      const leafBlank = new THREE.ExtrudeGeometry(leafShape, { depth: .045, bevelEnabled: true, bevelSize: .014, bevelThickness: .012, bevelSegments: 2, curveSegments: 6, steps: 1 });
      const leafGeometry = mergeVertices(leafBlank, 1e-6);
      leafBlank.dispose();
      this.box(hearth, f.x, .13, f.z, f.width, .26, f.depth, .025);
      const surround = new THREE.Shape(); surround.moveTo(-3.14, .26); surround.lineTo(3.14, .26);
      surround.lineTo(3.14, 4.18); surround.lineTo(-3.14, 4.18); surround.closePath();
      const opening = new THREE.Path(); opening.moveTo(-2.09, .26); opening.lineTo(-2.09, 1.93);
      opening.bezierCurveTo(-2.09, 2.84, -1.28, 3.35, 0, 3.35);
      opening.bezierCurveTo(1.28, 3.35, 2.09, 2.84, 2.09, 1.93); opening.lineTo(2.09, .26); opening.closePath();
      surround.holes.push(opening);
      this.mesh(new THREE.ExtrudeGeometry(surround, { depth: .6, bevelEnabled: true, bevelSize: .025, bevelThickness: .02,
        bevelSegments: 2, curveSegments: 24, steps: 1 }), stone, f.x, 0, front - .74);
      const soot = this.mat(0x111512, 1);
      this.box(soot, f.x, 1.85, front - .64, 4.25, 3.2, .035);
      this.box(soot, f.x, .29, front - .35, 4.3, .04, .58);
      for (const side of [-1, 1]) {
        const x = f.x + side * 2.72;
        this.box(carving, x, .4, front - .3, 1.05, .22, .45, .025);
        this.box(carving, x, 2.07, front - .18, .32, 3.05, .14, .04);
        for (const y of [.68, 3.45, 3.91]) this.box(stone, x, y, front - .24, .88, .13, .34, .035);
        this.pipe([[f.x + side * .47, 3.48, front - .13], [f.x + side * 1.14, 3.53, front - .1],
          [f.x + side * 1.85, 3.87, front - .1], [x, 3.97, front - .13]], .024, carving);
        this.pipe([[f.x + side * .52, 3.47, front - .11], [f.x + side * 1.14, 3.57, front - .09],
          [f.x + side * 1.76, 3.31, front - .09], [x, 2.99, front - .13]], .021, carving);
        for (let i = 0; i < 11; i++) for (const turn of [-1, 1]) {
          const u = i / 11;
          const leaf = this.mesh(leafGeometry, carving, f.x + side * (.57 + u * 2.1), 3.48 + u * .48, front - .11);
          leaf.rotation.z = side * (turn > 0 ? -.45 : -2.35); leaf.scale.set(.48, .67 + u * .12, .65);
        }
        this.pipe([[x, .77, front - .12], [x - side * .1, 1.3, front - .09], [x + side * .13, 2.05, front - .09], [x, 3.33, front - .12]], .025, carving);
        for (let i = 0; i < 7; i++) for (const turn of [-1, 1]) {
          const leaf = this.mesh(leafGeometry, carving, x, 1.01 + i * .32, front - .105);
          leaf.rotation.z = turn * 1.03; leaf.scale.set(.5, .65, .7);
        }
      }
      for (const [y, width, depth] of [[4.19, 6.4, 1.03], [4.34, 6.6, 1.1], [f.height - .075, f.width, f.depth]] as const)
        this.box(stone, f.x, y, f.z, width, .15, depth, .03);
      const oval = this.mesh(new THREE.TorusGeometry(.34, .03, 8, 40), carving, f.x, 3.76, front - .11); oval.scale.set(1, 1.3, .8);
      for (let i = 0; i < 14; i++) {
        const angle = i / 14 * Math.PI * 2;
        const leaf = this.mesh(leafGeometry, carving, f.x + Math.cos(angle) * .23, 3.76 + Math.sin(angle) * .3, front - .09);
        leaf.rotation.z = angle + Math.PI / 2; leaf.scale.set(.33, .43, .6);
      }
      for (const x of [-1.55, -.93, -.31, .31, .93, 1.55]) this.box(soot, f.x + x, .55, front - .3, .045, .53, .05);
      yield;
      const mirrorY = MIRROR_FACE.y + 1;
      const mirrorWood = this.pbr('old_wood_floor', 0x252b22, 1.5, .66);
      const relief = this.mat(0x303727, .9); const mx = PILL_ROOM.mirror.x;
      this.box(mirrorWood, MIRROR_FRAME.x, MIRROR_FRAME.y, MIRROR_FRAME.z, MIRROR_FRAME.width, MIRROR_FRAME.height, MIRROR_FRAME.depth, .035);
      for (const side of [-1, 1]) {
        const x = mx + side * 2.06;
        this.box(mirrorWood, x, mirrorY, -17.56, .43, 5.95, .26, .04);
        this.box(relief, mx + side * 1.9, mirrorY, -17.49, .045, 5.4, .045);
        this.box(this.black, mx + side * 1.865, mirrorY, -17.56, .025, 5.34, .025);
        for (let i = 0; i < 8; i++) {
          const y = mirrorY - 2.35 + i * .65;
          this.pipe([[x, y - .21, -17.405], [x - side * .11, y - .05, -17.375], [x + side * .11, y + .1, -17.365], [x, y + .3, -17.405]], .013, relief);
          for (const turn of [-1, 1]) {
            const leaf = this.mesh(leafGeometry, relief, x, y, -17.405); leaf.rotation.z = turn * .85; leaf.scale.set(.62, .74, .5);
          }
        }
        for (const offset of [2.79, 2.98]) this.box(offset < 2.9 ? mirrorWood : relief, mx, mirrorY + side * offset, side < 0 ? PILL_ROOM.mirror.z : -17.5, 4.68, offset < 2.9 ? .28 : .1, .28, .025);
        this.box(relief, mx, mirrorY + side * 2.68, -17.49, 3.84, .04, .045);
      }
      this.mirror = createMirrorSurface(); this.own(this.mirror.geometry);
      this.mirror.scale.set(MIRROR_FACE.radiusX, MIRROR_FACE.radiusY, 1);
      this.mirror.position.set(PILL_ROOM.mirror.x, mirrorY, PILL_ROOM.mirror.z); this.mirror.userData.dynamic = true; this.root.add(this.mirror);
      const liquidProfile = [[0, 0], [.14, 0], [.075, .06], [.027, .26], [.012, .5], [.018, .76], [.042, .95], [0, 1]].map(([x, y]) => new THREE.Vector2(x, y));
      this.mirrorFilament = this.mesh(new THREE.LatheGeometry(liquidProfile, 24), this.mat(0xb4c1bd, .08, .96), 0, 0, 0);
      this.mirrorFilament.name = 'mirror-liquid-filament'; this.mirrorFilament.userData.dynamic = true; this.mirrorFilament.visible = false;
      this.table(13, 10); this.crt(13, 3.7, 10); this.crt(10, 3.3, 11, .7); this.lampShade(-13, 7, -18);
      this.chair(8, 5, Math.PI); this.lampShade(7, 6, -17);
      this.box(this.brass, 8, 5.2, -10.98, .22, .7, .15, .03);
      this.pipe([[8, 5.1, -10.9], [8, 5, -10.5], [8, 5.55, -10.3]], .055, this.brass);
      this.mesh(new THREE.CylinderGeometry(.3, .52, .68, 24, 1, true), wornEdge, 8, 5.9, -10.3);
      this.sphere(this.glow, 8, 5.7, -10.3, .11);
      this.door(0, d / 2 - .4);
      yield;
    }
    if (a === 'oracle') {
      const lastVisit = this.currentScene === 'm3_oracle_last' || this.currentScene === 'm3_oracle_absorbed';
      const green = this.mat(lastVisit ? 0x3c6350 : 0x566e4b, .5); const cream = this.mat(0xc8c2a1, .6);
      const paperCanvas = document.createElement('canvas'); paperCanvas.width = paperCanvas.height = 256;
      const ctx = paperCanvas.getContext('2d')!; ctx.fillStyle = '#ccc7ad'; ctx.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 64) {
        const px = x + 20 + (y / 64 % 2) * 12;
        ctx.strokeStyle = '#a6a58d'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(px - 5, y + 9); ctx.lineTo(px + 3, y + 29); ctx.lineTo(px - 2, y + 50); ctx.stroke();
        for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#a3a58b' : '#b2ae94'; ctx.beginPath(); ctx.ellipse(px + (i % 2 ? -3 : 6), y + 18 + i * 8, 4.5, 1.9, i % 2 ? .7 : -.7, 0, Math.PI * 2); ctx.fill(); }
      }
      const map = new THREE.CanvasTexture(paperCanvas); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; this.textures.add(map);
      const paper = new THREE.MeshStandardMaterial({ map, roughness: .95 }); this.materials.add(paper);
      for (const o of filmObstacles(set).filter(o => !ORACLE_FURNITURE.includes(o) && !Object.values(ORACLE_WAITING_FURNITURE).includes(o) && o.z < 0)) this.lafayetteSurface(paper, o.x, o.height / 2, o.z, o.width, o.height, o.depth, 4);
      this.oracleWaitingRoom(paper, cream);
      yield;
      this.lafayetteSurface(paper, 0, 3.9, -29.8, 24, 7.8, .4, 4);
      for (const side of [-1, 1]) {
        this.box(cream, side * 12.25, .22, -19, .3, .44, 21.6); this.box(cream, side * 12.25, 7.4, -19, .3, .22, 21.6);
        this.box(cream, side * 13, .22, -7.7, 16, .44, .3);
      }
      const tiles = document.createElement('canvas'); tiles.width = tiles.height = 128; const tc = tiles.getContext('2d')!;
      tc.fillStyle = '#b4ad88'; tc.fillRect(0, 0, 128, 128); tc.fillStyle = '#757a5a'; tc.fillRect(0, 0, 64, 64); tc.fillRect(64, 64, 64, 64);
      tc.strokeStyle = '#716f57'; tc.lineWidth = 1; for (const v of [0, 64, 128]) { tc.beginPath(); tc.moveTo(v, 0); tc.lineTo(v, 128); tc.moveTo(0, v); tc.lineTo(128, v); tc.stroke(); }
      const tileMap = new THREE.CanvasTexture(tiles); tileMap.colorSpace = THREE.SRGBColorSpace; tileMap.wrapS = tileMap.wrapT = THREE.RepeatWrapping; tileMap.repeat.set(8, 7); this.textures.add(tileMap);
      const tileMaterial = new THREE.MeshStandardMaterial({ map: tileMap, roughness: .68, normalMap: this.marble.normalMap, normalScale: new THREE.Vector2(.08, .08) }); this.materials.add(tileMaterial);
      const tileFloor = this.mesh(new THREE.PlaneGeometry(23.6, 21.6), tileMaterial, 0, .015, -19); tileFloor.rotation.x = -Math.PI / 2;
      for (const x of [-5, 5]) this.box(cream, x, 3.3, -7.7, .35, 6.6, .6);
      this.box(cream, 0, 7.2, -8, 10.4, 1.2, .7); this.box(this.white, 0, 7.9, -19, 24, .3, 22);
      this.label('TEMET NOSCE', 0, 7.15, -7.6, 6, '#675c3e', '#c7c4a8');
      for (let x = -9; x <= 6; x += 3) {
        this.box(green, x, 1.15, -27.5, 2.96, 2.3, 2.7, .05); this.box(this.marble, x, 2.4, -27.5, 3, .18, 2.9);
        this.box(green, x, 5.3, -28.5, 2.96, 2.2, 1.3, .05); this.box(this.brass, x + .8, 1.4, -26.09, .4, .06, .1);
        for (const y of [1.18, 5.3]) {
          const z = y < 3 ? -26.12 : -27.81;
          this.box(this.mat(0x81916c), x, y, z, 2.6, 1.92, .045, .025); this.box(green, x, y, z + .03, 2.27, 1.59, .04, .02);
          this.sphere(this.brass, x + 1, y, z + .08, .065);
        }
      }
      for (let x = -11; x < 9; x++) for (let y = 2.7; y < 4.2; y += .5) this.box(green, x, y, -d / 2 + .47, .97, .47, .08);
      this.box(cream, 9, 2.45, -25.5, 3.4, 4.9, 3.5, .15); this.box(this.brass, 7.8, 2.8, -23.7, .08, .8, .09);
      this.box(this.black, -6, 1.3, -26.07, 2.4, 1.5, .08); this.box(this.glass, -6, 1.4, -25.99, 1.9, .8, .04);
      for (const x of [-6.7, -5.4]) for (const z of [-28.1, -27]) this.cylinder(this.black, x, 2.54, z, .38, .04);
      this.cylinder(this.metal, -6.7, 2.86, -28.1, .43, .65); this.sphere(this.black, -6.7, 3.21, -28.1, .13);
      this.window(-11.72, 4.8, -17, 5.6, 4.6, true);
      const windowLight = new THREE.SpotLight(0xf0e5c9, 450, 30, .85, .7, 2); windowLight.position.set(-10.8, 6.2, -17); windowLight.target.position.set(3, 1.5, -18); this.root.add(windowLight, windowLight.target);
      for (let z = -19.8; z <= -14.2; z += .22) this.box(cream, -11.4, 6.7, z, .16, .9 + Math.sin(z * 12) * .05, .18);
      const kitchenTable = lastVisit ? ORACLE_LAST.table : ORACLE_FURNITURE[2];
      this.table(kitchenTable.x, kitchenTable.z, 5, 3, this.wood, 1.9);
      if (this.currentScene !== 'm3_oracle_absorbed') {
        this.box(this.metal, kitchenTable.x, 2.09, kitchenTable.z, 2, .06, 1.3, .04);
        for (const dx of [-.5, 0, .5]) this.cylinder(this.mat(0xb99260), kitchenTable.x + dx, 2.16, kitchenTable.z, .18, .06);
      }
      if (lastVisit) ORACLE_LAST.chairs.forEach(chair => this.chair(chair.x, chair.z, chair.yaw));
      else ORACLE_KITCHEN_CHAIRS.forEach((chair, i) => this.chair(chair.x, chair.z, i * Math.PI));
      this.table(8, -11, 2.7, 2.2, this.wood, 1.8); this.oracleVase = new OracleVase(this.root);
      this.rug(-6, 10, 12, 9);
      this.lamp(0, 6.6, -19, true);
    }
  }
  private oracleWaitingRoom(paper: THREE.Material, trim: THREE.Material): void {
    const wood = this.pbr('old_wood_floor', 0x514434, 1, .78);
    const request = this.currentScene === 'm3_oracle_request';
    const cloth = this.pbr('white_plaster_02', request ? 0x947b77 : 0x6d7562, 2, 1); cloth.normalScale.set(.035, .035);
    const curtain = this.pbr('white_plaster_02', 0xcfc8b0, 2, 1); curtain.normalScale.set(.035, .035);
    const wall = (x: number, y: number, z: number, w: number, h: number, d: number) => this.lafayetteSurface(paper, x, y, z, w, h, d, 4);
    for (const side of [-1, 1]) {
      const x = side * 14;
      // Open the wall around each sash; glazing must never cover an opaque wall.
      for (const [from, to] of [[-8, -2], [4, 15], [21, 30]]) wall(x, 3.9, (from + to) / 2, .4, 7.8, to - from);
      for (const z of [1, 18]) {
        wall(x, 1.05, z, .4, 2.1, 6); wall(x, 7.25, z, .4, 1.1, 6);
        this.box(this.glass, x, 4.4, z, .06, 4.6, 6);
        for (const dz of [-3, 0, 3]) this.box(trim, x - side * .15, 4.4, z + dz, .34, 4.85, .12);
        for (const y of [2.1, 4.4, 6.7]) this.box(trim, x - side * .15, y, z, .34, .14, 6.3);
        this.box(trim, x - side * .35, 2.02, z, 1, .18, 6.6, .035);
        this.box(wood, x - side * .5, 7.04, z, .16, .16, 7);
        for (const edge of [-1, 1]) for (let fold = 0; fold < 8; fold++) {
          const panel = this.box(curtain, x - side * (.52 + Math.sin(fold * 1.2) * .06), 4.35, z + edge * (3.05 + fold * .07), .12, 5.15, .09);
          panel.rotation.z = side * .012;
        }
        const outside = this.mat(0xc7d4d2, 1); outside.emissive.setHex(0x8babae); outside.emissiveIntensity = .2;
        this.box(outside, side * 24, 8, z, .5, 24, 10);
        for (const y of [2.5, 7.5, 12.5]) for (const dz of [-2.6, 1, 4.6]) {
          this.box(this.mat(0x546a69, .5), side * 23.7, y, z + dz, .08, 2.65, 1.75);
          this.box(trim, side * 23.58, y - 1.4, z + dz, .35, .18, 2.15);
        }
      }
      for (const [y, h, depth] of [[.2, .4, .34], [2, .11, .14], [7.5, .17, .27], [7.7, .14, .38]]) this.box(trim, x - side * .22, y, 11, depth, h, 38);
      this.box(trim, x - side * .21, .93, 11, .06, 1.5, 38);
      for (let z = -7; z < 30; z += 2.8) this.box(trim, x - side * .3, .94, z, .06, 1.33, .045);
    }
    this.oracleEntrance(paper, trim, wood);
    this.box(this.white, 0, 7.95, 11, 28.4, .3, 38.2);
    this.box(trim, 0, 7.56, 29.5, 28, .22, .35);
    const key = new THREE.SpotLight(0xe9f0e5, 1450, 45, .95, .7, 2);
    key.position.set(-15.2, 6.2, 1.8); key.target.position.set(-4, .8, 11); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.0002; key.shadow.normalBias = .025;
    this.root.add(key, key.target);
    const bounce = new THREE.PointLight(0xdac5a2, 130, 29, 2); bounce.position.set(10, 5.5, 16); this.root.add(bounce);
    const fill = new THREE.HemisphereLight(0xcbd5c5, 0x645844, .55); this.root.add(fill);
    this.root.add(new THREE.AmbientLight(0xd4cab1, .45));

    // Upholstered seats stay against the room perimeter, clear of Neo and the child.
    for (const [id, angle] of [['sofa', Math.PI / 2], ['armchair', -Math.PI / 2]] as const) {
      const f = ORACLE_WAITING_FURNITURE[id]; const width = f.depth, depth = f.width;
      const start = this.root.children.length;
      this.box(wood, 0, request ? .45 : .9, 0, width, .65, depth - .3, .07);
      this.box(cloth, 0, request ? 2.05 : 2.32, -depth / 2 + .32, width - .12, request ? 1.9 : f.height - 1.1, .64, .2);
      const seats = id === 'sofa' ? 3 : 1;
      for (let i = 0; i < seats; i++) {
        const x = (i - (seats - 1) / 2) * (width - .88) / seats;
        this.box(cloth, x, request ? ORACLE_REQUEST.oracle.seat - .25 : 1.4, .17, (width - .92) / seats - .045, .5, depth - .82, .15);
        const cushion = this.box(cloth, x, request ? 2.16 : 2.44, -depth / 2 + .7, (width - .95) / seats - .06, 1.53, .42, .18); cushion.rotation.x = -.09;
        for (const z of [-.55, .75]) this.box(trim, x, request ? ORACLE_REQUEST.oracle.seat - .02 : 1.63, z, (width - 1.12) / seats, .012, .012);
      }
      for (const side of [-1, 1]) {
        this.box(cloth, side * (width / 2 - .25), request ? 1.6 : 1.94, .04, .49, .74, depth - .05, .22);
        for (const z of [-depth / 2 + .28, depth / 2 - .28]) this.cylinder(wood, side * (width / 2 - .35), .35, z, .14, .7, .105);
      }
      if (id === 'sofa') {
        const pillow = this.box(this.mat(request ? 0xb79891 : 0x9c8668, 1), -width / 2 + 1.05, request ? 1.8 : 2.05, -.15, 1.2, 1.2, .55, .22); pillow.rotation.set(-.15, .16, .14);
        const blanket = this.box(curtain, width / 2 - 1, request ? 1.16 : 1.71, .15, 1.1, .08, 2.65, .025);
        this.box(curtain, blanket.position.x, request ? .71 : 1.23, 1.43, 1.1, 1.02, .07, .02);
      }
      const group = new THREE.Group(); this.root.children.slice(start).forEach(child => group.add(child));
      group.position.set(f.x, 0, f.z); group.rotation.y = angle; this.root.add(group);
    }
    if (request) {
      const table = ORACLE_REQUEST.table;
      this.box(wood, table.x, table.height - .12, table.z, table.width, .24, table.depth, .055);
      for (const x of [-.8, .8]) for (const z of [-2.05, 2.05]) this.box(wood, table.x + x, (table.height - .24) / 2, table.z + z, .16, table.height - .24, .16);
      this.cylinder(this.brass, table.x, table.height + .055, table.z + .8, .26, .06);
      this.cylinder(this.white, table.x, table.height + .17, table.z - .65, .16, .25);
      this.box(this.mat(0xa79470, .95), table.x + .3, table.height + .05, table.z - 1.3, 1.05, .07, .74);
    }
    const tv = ORACLE_WAITING_FURNITURE.television;
    const tvStart = this.root.children.length;
    this.box(wood, 0, 1.06, 0, tv.depth, 2.05, tv.width, .055);
    for (const x of [-1.45, 1.45]) { this.box(this.wood, x, 1.05, 1.22, 2.72, 1.6, .06, .025); this.sphere(this.brass, x + .8, 1.26, 1.28, .07); }
    this.box(wood, 0, 3.19, -.1, 3.25, 2.3, 2.05, .19);
    this.box(this.black, -.18, 3.2, .96, 2.8, 1.98, .16, .15);
    const tvCanvas = document.createElement('canvas'); tvCanvas.width = 256; tvCanvas.height = 192;
    const tc = tvCanvas.getContext('2d')!;
    tc.fillStyle = '#4b5f53'; tc.fillRect(0, 0, 256, 192); tc.fillStyle = '#889584'; tc.fillRect(9, 8, 89, 143); tc.fillStyle = '#566347'; tc.fillRect(137, 19, 100, 137);
    for (const [x, color] of [[76, '#d4be94'], [179, '#bdaa84']] as const) {
      tc.fillStyle = '#252d29'; tc.beginPath(); tc.ellipse(x, 142, 47, 61, 0, 0, Math.PI * 2); tc.fill();
      tc.fillStyle = color; tc.beginPath(); tc.ellipse(x, 71, 22, 30, 0, 0, Math.PI * 2); tc.fill();
      tc.fillStyle = '#35403a'; tc.beginPath(); tc.ellipse(x - 2, 47, 24, 14, -.12, 0, Math.PI * 2); tc.fill();
    }
    for (let y = 0; y < 192; y += 3) { tc.fillStyle = '#0c180f35'; tc.fillRect(0, y, 256, 1); }
    const tvMap = new THREE.CanvasTexture(tvCanvas); tvMap.colorSpace = THREE.SRGBColorSpace; this.textures.add(tvMap);
    const tvMaterial = new THREE.MeshBasicMaterial({ map: tvMap, color: 0xb5c3a7, toneMapped: false }); this.materials.add(tvMaterial);
    this.box(tvMaterial, -.3, 3.2, 1.054, 2.32, 1.63, .025, .07);
    for (const y of [3.55, 2.95]) this.cylinder(this.black, 1.18, y, 1.03, .12, .13).rotation.x = Math.PI / 2;
    for (let y = 2.56; y < 3.9; y += .1) this.box(this.black, 1.43, y, 1.04, .13, .035, .03);
    this.pipe([[0, 4.32, -.25], [-.8, 5.6, -.4]], .012, this.metal); this.pipe([[0, 4.32, -.25], [1.1, 5.35, -.4]], .012, this.metal);
    const television = new THREE.Group(); this.root.children.slice(tvStart).forEach(child => television.add(child)); television.position.set(tv.x, 0, tv.z); television.rotation.y = -Math.PI / 2; this.root.add(television);

    const shelf = ORACLE_WAITING_FURNITURE.bookcase;
    this.box(wood, shelf.x - .85, 2.9, shelf.z, .14, shelf.height, shelf.depth);
    for (const z of [shelf.z - 2.42, shelf.z + 2.42]) this.box(wood, shelf.x, 2.9, z, shelf.width, shelf.height, .16);
    for (const y of [.16, 1.52, 2.88, 4.24, 5.64]) this.box(wood, shelf.x, y, shelf.z, shelf.width, .16, shelf.depth);
    for (let row = 0; row < 4; row++) for (let i = 0; i < 11; i++) {
      const height = .76 + (i * 3 + row * 7) % 5 * .08, z = shelf.z - 2.12 + i * .39;
      const cover = this.mat([0x6a7664, 0x958367, 0x744c3e, 0x454f4a][(i + row) % 4], .94);
      this.box(cover, shelf.x + .22, .24 + row * 1.36 + height / 2, z, 1.18, height, .26, .012);
      this.box(trim, shelf.x + .82, .39 + row * 1.36, z, .015, .022, .2);
    }
    const table = ORACLE_WAITING_FURNITURE.sideTable;
    this.table(table.x, table.z, table.width, table.depth, wood, 1.48);
    this.cylinder(this.brass, table.x, 2.47, table.z, .045, 1.77); this.cylinder(this.brass, table.x, 1.66, table.z, .4, .1);
    this.mesh(new THREE.CylinderGeometry(.43, .78, 1.08, 32, 1, true), curtain, table.x, 3.32, table.z);
    const lamp = new THREE.PointLight(0xf3c17e, 24, 12, 2); lamp.position.set(table.x, 3.05, table.z); this.root.add(lamp);
    const books = this.box(this.mat(0x66594d), table.x + .66, 1.74, table.z + .42, .67, .16, 1.07, .02); books.rotation.y = -.2;
    for (let i = 0; i < 7; i++) {
      const spoon = new SpoonModel(); spoon.setBend(.55 + i * .065); spoon.root.scale.setScalar(.65);
      spoon.root.position.set(-9.5 + (i % 3) * .32, .14 + Math.floor(i / 3) * .045, 6.35 + Math.floor(i / 3) * .29);
      spoon.root.rotation.set(-Math.PI / 2, 0, -.7 + i * .43);
      const bounds = new THREE.Box3().setFromObject(spoon.root); spoon.root.position.y += .055 + Math.floor(i / 3) * .012 - bounds.min.y;
      spoon.root.traverse(object => { if (object instanceof THREE.Mesh) { this.own(object.geometry); this.materials.add(object.material); } }); this.root.add(spoon.root);
    }
    const blocks = new THREE.Group(); blocks.name = 'oracle-floating-alphabet-blocks'; blocks.userData.dynamic = true; this.root.add(blocks); this.oracleBlocks = blocks;
    for (let i = 0; i < 6; i++) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#c3aa82'; ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = ['#834c41', '#486358', '#817046'][i % 3]; ctx.lineWidth = 6; ctx.strokeRect(7, 7, 114, 114);
      ctx.fillStyle = ctx.strokeStyle; ctx.font = 'bold 88px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('MATRIX'[i], 64, 66);
      const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; this.textures.add(map);
      const material = new THREE.MeshStandardMaterial({ map, roughness: .92 }); this.materials.add(material);
      const block = this.box(material, 6.4 + i % 3 * .72, i < 3 ? 1.65 : .3, 3.15 + Math.floor(i / 3) * .82, .55, .55, .55, .025); block.rotation.y = i * .7;
      if (i < 3) blocks.add(block);
    }
    this.box(curtain, -9, .048, 8, 2.6, .006, 2.2);
  }
  private oracleEntrance(paper: THREE.Material, trim: THREE.Material, wood: THREE.Material): void {
    const door = ORACLE_ENTRANCE.door, plaster = this.pbr('white_plaster_02', 0x62675b, 3, .97);
    for (const wall of ORACLE_ENTRANCE_WALLS) {
      this.lafayetteSurface(wall.z === door.z ? paper : plaster, wall.x, wall.height / 2, wall.z, wall.width, wall.height, wall.depth, 4);
      if (wall.z === door.z) this.box(trim, wall.x, .21, door.z - .27, wall.width, .42, .22);
    }
    this.box(trim, 0, 7.2, door.z, door.width, 1.2, .4);
    for (const x of [-2.55, 2.55]) this.box(trim, x, 3.3, door.z, .3, 6.6, .48, .02);
    this.box(trim, 0, 6.64, door.z, 5.4, .25, .5, .02);
    this.box(wood, 0, .035, door.z, 4.75, .07, .65);
    const start = this.root.children.length;
    this.box(this.wood, door.width / 2, door.height / 2, 0, door.width, door.height, door.depth, .025);
    for (const side of [-1, 1]) {
      for (const [y, h] of [[1.65, 2.5], [4.6, 2.45]]) {
        this.box(wood, door.width / 2, y, side * .12, 3.95, h, .055, .025);
        this.box(this.wood, door.width / 2, y, side * .155, 3.65, h - .3, .04, .02);
      }
      this.sphere(this.brass, 4.18, 3.1, side * .2, .15);
      this.box(this.brass, 4.18, 2.75, side * .125, .18, .38, .05, .035);
    }
    for (const y of [1.05, 3.3, 5.55]) this.cylinder(this.brass, .02, y, 0, .065, .27);
    const pivot = new THREE.Group(); pivot.name = 'oracle-apartment-door'; pivot.userData.dynamic = true;
    this.root.children.slice(start).forEach(child => pivot.add(child)); pivot.position.set(door.x, 0, door.z); this.root.add(pivot); this.oracleDoor = pivot;
    const floor = this.mesh(new THREE.PlaneGeometry(7.6, 20.2), wood, 0, .012, 39.9); floor.rotation.x = -Math.PI / 2;
    this.box(plaster, 0, 7.95, 39.9, 8.4, .3, 20.6);
    for (const side of [-1, 1]) {
      for (const [y, height] of [[.21, .42], [2, .13], [7.55, .22]]) this.box(trim, side * 3.75, y, 39.9, .18, height, 20.2);
      for (const z of [36.8, 44.8]) {
        const panel = this.box(this.wood, side * 3.76, 3.2, z, .13, 6.4, 3.4);
        for (const dz of [-1.85, 1.85]) this.box(trim, side * 3.66, 3.3, z + dz, .22, 6.6, .19);
        this.box(trim, side * 3.66, 6.64, z, .22, .2, 3.9);
        this.sphere(this.brass, side * 3.56, 3, z - 1.2, .12); panel.receiveShadow = true;
      }
    }
    for (const x of [-1.16, 1.16]) this.box(this.metal, x, 3.3, 49.72, 2.28, 6.6, .12);
    for (const x of [-2.5, 2.5]) this.box(this.black, x, 3.4, 49.62, .3, 6.8, .21);
    this.box(this.black, 0, 6.9, 49.62, 5.3, .28, .22);
    this.label('4', 0, 7.37, 49.53, .55, '#ded0a5', '#383c34');
    for (const z of [34.2, 42.5]) {
      this.box(this.brass, 3.72, 5.4, z, .22, .95, .65, .08);
      this.box(this.white, 3.56, 5.4, z, .18, .64, .48, .05);
      const light = new THREE.PointLight(0xe8cf9d, 95, 12, 2); light.position.set(3.2, 5.4, z); this.root.add(light);
    }
  }
  private workplace(set: FilmSet): void {
    const a = set.architecture; const w = set.width; const d = set.depth;
    if (a === 'office') {
      for (const x of [-w * .32, w * .32]) for (let z = -d / 2 + 12; z < d / 2 - 6; z += 12) {
        this.table(x, z, 8, 4, this.mat(0xb0b0a2)); this.crt(x, 3.7, z); this.chair(x, z + 4, Math.PI);
        this.box(this.mat(0x778477), x, 3, z - 3, 10, 6, .25); this.box(this.mat(0x778477), x - Math.sign(x) * 5, 3, z, .25, 6, 6);
      }
      for (let z = -d / 2 + 8; z < d / 2; z += 12) for (let y = 6; y < set.height - 1; y += .65) this.box(this.white, -w / 2 + 1, y, z, .2, .12, 8);
      this.label(set.id.includes('metacortex') ? 'METACORTEX' : 'FEDERAL BUILDING', 0, 10, -d / 2 + .6, 17);
    } else if (a === 'backdoors') {
      if (this.currentScene !== 'm2_key_door') {
        for (let z = -d / 2 + 8; z < d / 2; z += 12) for (const x of [-w / 2 + .5, w / 2 - .5]) {
          const start = this.root.children.length; this.door(0, 0); const g = new THREE.Group(); this.root.children.slice(start).forEach(c => g.add(c)); g.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; g.position.set(x, 0, z); this.root.add(g);
        }
        this.door(0, -d / 2 + .5); this.phone(4, -d / 2 + .6);
        for (let z = -d / 2 + 6; z < d / 2; z += 10) this.box(this.glow, 0, set.height - .6, z, 3, .1, 1.5);
      }
      if (this.currentScene === 'm2_backdoors') {
        this.impossibleDoor('m2_backdoors', -d / 2 + .95);
        for (let z = -d / 2 + 5; z < d / 2; z += 8) {
          this.box(this.mat(0xbec1ba), 0, .018, z, 10, .035, .085);
          this.box(this.white, 0, 9.5, z, 16, .1, .12);
        }
      } else if (this.currentScene === 'm2_key_door') {
        const steel = this.mat(0x465554, .5, .7); const concrete = this.pbr('damaged_plaster', 0x727d7a, 11);
        for (const x of [-w / 2 + .48, w / 2 - .48]) {
          for (let z = -d / 2 + 4; z < d / 2 - 3; z += 6) {
            this.box(concrete, x - Math.sign(x) * .12, 5.3, z, .18, 10.5, .22);
            this.box(steel, x - Math.sign(x) * .38, 8.1, z + 2.4, .18, .12, 3.2);
          }
          this.pipe([[x - Math.sign(x) * .5, 9.9, d / 2 - 2], [x - Math.sign(x) * .5, 9.9, -d / 2 + 2]], .13, steel);
        }
        for (let z = -d / 2 + 8; z < d / 2 - 3; z += 11) {
          this.box(steel, 0, 11.2, z, 6.4, .24, 1.3);
          this.box(this.glow, 0, 10.9, z, 5.4, .08, .38);
        }
        for (const x of [-8.7, 8.7]) this.box(concrete, x, 4, -39, 10.6, 8, .75, .08);
        for (const z of [-39, -55]) {
          for (const x of [-3.4, 3.4]) this.box(steel, x, 4.4, z + .25, .35, 8.8, .7, .08);
          this.box(steel, 0, 8.65, z + .25, 7.1, .4, .7, .08);
        }
        for (const x of [-11, 11]) for (let z = -54; z < -40; z += 3) {
          this.box(steel, x, 5.6, z, .24, 11, .3);
          this.box(this.metal, x - Math.sign(x) * 1.4, .07, z, 2.8, .12, .25);
        }
        for (let z = -54; z < -40; z += 3) this.box(steel, 0, 11, z, 23, .22, .25);
        this.label('SOURCE ACCESS', 0, 10, -54.2, 8, '#c9d3cd', '#263735');
      }
    } else if (a === 'workshop') {
      for (const x of [-w / 2 + 2, w / 2 - 2]) {
        for (const y of [1, 4, 7, 10, 13]) this.box(this.wood, x, y, 0, 3.5, .4, d - 5);
        for (let z = -d / 2 + 4; z < d / 2 - 3; z += .9) for (const y of [2.5, 5.5, 8.5, 11.5]) this.box(this.mat([0x504b3c, 0x43302a, 0x4f5651, 0x6c624d][Math.abs(Math.round(z * 3)) % 4]), x, y, z, 2, 2.5, .6);
      }
      this.rug(0, 8, 22, 24); this.table(0, -25, 9, 4);
      this.lamp(0, 12, -25, true, true);
      this.box(this.mat(0x7e6348, .86), 0, 7, -32.5, 12, 9, .2);
      for (let i = 0; i < 28; i++) { const x = -11 + i % 14 * 1.6; const y = 7 + Math.floor(i / 14) * 2; this.mesh(new THREE.TorusGeometry(.22, .045, 6, 12), this.brass, x, y, -d / 2 + 1); this.box(this.brass, x, y - .5, -d / 2 + 1, .07, .7, .08); }
      for (const [x, width] of [[-16.25, 11.5], [8.25, 27.5]]) {
        this.box(this.wood, x, 6.5, -18, width, 13, .6);
        for (let y = 1.3; y < 13; y += 2.4) this.box(this.brass, x, y, -17.62, width, .1, .15);
        for (let dx = -width / 2 + .55; dx < width / 2 - .2; dx += .7) for (let y = 2.4; y < 12; y += 2.4)
          this.box(this.mat(Math.round(dx * 10 + y * 3) % 3 ? 0x615445 : 0x303d38), x + dx, y, -17.55, .58, 2.1, .4);
      }
      const bookDoor = new THREE.Group(); bookDoor.userData.dynamic = true; bookDoor.name = 'keymaker-book-door'; bookDoor.position.set(BOOK_DOOR.hinge.x,0,BOOK_DOOR.hinge.z); this.root.add(bookDoor);
      const start = this.root.children.length;
      this.box(this.wood, BOOK_DOOR.width/2, 6.5, 0, BOOK_DOOR.width, BOOK_DOOR.height, .55).name='library-book-leaf';
      for (let y = 1.3; y < 13; y += 2.4) { const rail = this.box(this.brass, BOOK_DOOR.width/2, y, .4, BOOK_DOOR.width, .12, .2); if(Math.abs(y-BOOK_DOOR.rail.y)<.01)rail.name='library-book-push-rail'; }
      for (let dx = -2.1; dx <= 2.1; dx += .7) for (let y = 2.4; y < 12; y += 2.4) {
        if(Math.abs(BOOK_DOOR.width/2+dx-BOOK_DOOR.book.x)<.01&&Math.abs(y-2.4)<.01)continue;
        this.box(this.mat(Math.round(dx * 10 + y) % 2 ? 0x69513c : 0x3e5049), BOOK_DOOR.width/2+dx, y, .47, .56, 2.1, .38);
      }
      this.root.children.slice(start).forEach(object => bookDoor.add(object));
      const trigger = new THREE.Group(), b = BOOK_DOOR.book; trigger.name='library-book-trigger';trigger.position.set(b.x,b.y,b.z);bookDoor.add(trigger);
      const spine = this.box(this.mat(0x69513c),0,b.height/2,0,b.width,b.height,b.depth);spine.name='library-trigger-book';trigger.add(spine);this.bookDoor=bookDoor;
      for (const x of [-15, 15]) { this.loungeChair(x, 6, x < 0 ? Math.PI / 2 : -Math.PI / 2); this.lamp(x, 7, 6, true); }
      this.box(this.black, 0, 5, 8, 9, 6, .35); this.box(this.glass, 0, 5, 8.21, 8.6, 5.6, .04);
      this.label('PRIVATE LIBRARY', 0, 11.5, -17.3, 13, '#c4b38c', '#27382f'); this.door(0, d / 2 - .5);
    } else if (a === 'power') {
      const main = set.id === 'film_power_station';
      const banks = filmObstacles(set);
      const terminal = banks[0];
      const casing = this.mat(main ? 0x465c51 : 0x555e61, .48, .55);
      const porcelain = this.mat(0xc5c6ac, .3, .12);
      const copper = this.mat(0x9c6446, .32, .72);
      const safety = this.mat(0xd1b063, .5, .3);
      for (const bank of banks.slice(1)) {
        this.box(casing, bank.x, 4.5, bank.z, bank.width, 9, bank.depth, .12);
        for (const y of [2.2, 4.6, 7]) {
          this.box(this.black, bank.x, y, bank.z + bank.depth / 2 + .06, 5.9, 1.55, .12);
          this.box(main ? copper : this.glass, bank.x, y, bank.z + bank.depth / 2 + .15, 5.35, 1.05, .05);
        }
        for (const dx of [-2.4, 2.4]) {
          this.box(this.metal, bank.x + dx, 4.5, bank.z + 2.65, .09, 8.2, .16);
          if (main) {
            this.cylinder(porcelain, bank.x + dx, 9.75, bank.z, .33, 1.5);
            this.cylinder(copper, bank.x + dx, 10.7, bank.z, .11, .65);
          }
        }
        const inward = bank.x - Math.sign(bank.x) * (bank.width / 2 + .06);
        this.box(this.black, inward, 4.5, bank.z, .1, 8.15, 4.25);
        for (const y of [2.1, 4.45, 6.8]) {
          this.box(main ? copper : this.glass, inward - Math.sign(bank.x) * .07, y, bank.z, .06, 1.45, 3.55);
          for (const dz of [-1.4, -.45, .5, 1.45]) this.box(main ? porcelain : this.glow, inward - Math.sign(bank.x) * .13, y + .5, bank.z + dz, .05, .14, .14);
        }
        if (!main) for (let row = 0; row < 5; row++) this.box(this.glow, bank.x - 2.2 + row * 1.1, 7.3, bank.z + 2.7, .1, .1, .03);
      }
      if (main) {
        for (const x of [-w * .3, w * .3]) {
          this.pipe([[x, 11, d / 2 - 11], [x, 14, 0], [x * .55, 14, terminal.z]], .22, copper);
          for (let z = -d / 2 + 8; z < d / 2; z += 12) this.box(safety, x, .05, z, 8.1, .08, .16);
        }
        for (let z = -d / 2 + 5; z < d / 2 - 4; z += 9) {
          this.box(this.black, 0, .025, z, 7.2, .05, 1.4);
          for (const x of [-3.45, 3.45]) this.box(this.metal, x, .07, z, .1, .08, 1.4);
        }
      } else {
        for (const x of [-10, 10]) {
          this.box(this.glass, x, 5.2, terminal.z + 6, .08, 9, 10);
          for (const z of [terminal.z + 1, terminal.z + 6, terminal.z + 11]) this.box(this.metal, x, 5.2, z, .18, 9, .15);
        }
        this.label('EMERGENCY GRID / CORE NETWORK', 0, 10, -d / 2 + .55, 12, '#cfdacb', '#243436');
      }
      this.box(casing, terminal.x, 3, terminal.z, terminal.width, 6, terminal.depth, .12);
      this.box(this.black, 0, 3.8, terminal.z + 1.58, 6.5, 2.5, .08);
      this.box(this.glass, 0, 3.8, terminal.z + 1.63, 6.1, 2.1, .04);
      this.label(main ? 'SYNCHRONIZED CHARGE' : 'EMERGENCY SYSTEM', 0, 6.6, terminal.z + 1.65, 8.5, '#e6e4cf', '#26332e');
      if (main) this.label('DANGER — HIGH VOLTAGE', 0, 11, -d / 2 + .55, 16, '#201d16', '#ba9e51');
    }
  }
  private createPowerStatus(set: FilmSet): void {
    const terminal = filmObstacles(set)[0];
    const primary = new THREE.MeshBasicMaterial({ color: 0x8cdb9b, toneMapped: false });
    const emergency = new THREE.MeshBasicMaterial({ color: 0x8cdb9b, toneMapped: false });
    this.materials.add(primary); this.materials.add(emergency);
    for (const [index, material] of [primary, emergency].entries())
      this.box(material, (index ? 1 : -1) * 1.6, 5.2, terminal.z + 1.7, .8, .38, .12, .05);
    const tube = new THREE.MeshBasicMaterial({ color: 0xe8dcc0, toneMapped: false }); this.materials.add(tube);
    const lights = [-set.depth * .3, 0, set.depth * .3].map(z => {
      const light = new THREE.PointLight(0xf3e7c9, 210, 32, 2); light.position.set(0, 12, z); this.root.add(light);
      this.box(this.metal, 0, 12.2, z, 5.4, .55, 1.25, .08);
      this.box(tube, 0, 11.9, z, 4.9, .12, .9);
      return light;
    });
    this.powerStatus = { primary, emergency, lights };
  }
  private publicInterior(set: FilmSet): void {
    if (set.id === 'film_club_hel') { this.helClub(set); return; }
    const { architecture: a, width: w, depth: d, height: h } = set;
    if (a === 'chateau') {
      // Two stair wings, a landing, balustrades and a weapons wall define the film's composition.
      const { landing, stairs } = CHATEAU; const { rail } = stairs;
      for (const side of [-1, 1]) {
        for (let i = 0; i < stairs.count; i++) {
          const tread = chateauStairTread(i), x = side * tread.x, { y, z } = tread;
          this.box(this.marble, x, y / 2, z, stairs.width, y + 2 * stairs.tread, stairs.depth, .04);
          for (const edge of [-rail.offset, rail.offset]) {
            this.cylinder(this.marble, x + edge, y + rail.y, z, rail.radius, rail.height);
            this.sphere(this.marble, x + edge, y + rail.capY, z, rail.cap);
          }
        }
        this.pipe([[side * 9.4, 3.3, -4], [side * 15, 8, -16], [side * 20.5, 12.6, -29]], .19, this.wood);
      }
      this.box(this.marble, landing.x, landing.height - .5, landing.z, w - 4, 1, landing.depth, .1);
      this.box(this.mat(0x745744), 0, 16, -d / 2 + .5, 16, 12, .2);
      // A geometric terrazzo inlay and classical busts distinguish the hall from a generic lobby.
      const inlay = this.mat(0x47483d, .3);
      for (const radius of [6, 6.4, 11, 11.4]) this.mesh(new THREE.TorusGeometry(radius, .06, 6, 80), inlay, 0, .065, 3).rotation.x = Math.PI / 2;
      for (let i = 0; i < 8; i++) { const theta = i * Math.PI / 4; this.box(inlay, Math.sin(theta) * 8.5, .065, 3 + Math.cos(theta) * 8.5, .12, .025, 5).rotation.y = theta; }
      for (const x of [-27, 27]) for (const z of [7, 25]) {
        this.box(this.marble, x, 2, z, 2.8, 4, 2.8, .06); this.cylinder(this.marble, x, 4.8, z, .9, 1.5, 1.4);
        const head = this.sphere(this.marble, x, 6.3, z, 1); head.scale.set(.8, 1.25, .8); this.sphere(this.marble, x, 6.15, z + .7, .2);
        this.box(this.marble, x, 5.25, z, 2.6, .5, 1.6, .2);
      }
      for (const side of [-1, 1]) for (let z = 4; z < d / 2 - 5; z += 10) {
        const x = side * (w / 2 - .8); this.box(this.wood, x, 6, z, .4, 10, 6.5);
        this.pipe([[x - side * .4, 3, z - 2], [x - side * .4, 9, z + 2]], .09, this.metal);
        this.pipe([[x - side * .5, 3, z + 2], [x - side * .5, 9, z - 2]], .09, this.metal);
      }
      for (const weapon of ['sword', 'spear'] as const) {
        const { x, z } = CHATEAU.racks[weapon]; const metal = this.mat(0xa9aaa0, .26, .72);
        this.box(this.wood, x, 2.3, z, 2.6, 4.6, .55, .08);
        this.box(this.brass, x, 4.7, z, 2.8, .12, .66);
        if (weapon === 'sword') {
          this.box(metal, x, 2.9, z + .38, .12, 2.6, .09); this.box(this.brass, x, 1.65, z + .44, .8, .1, .18);
          this.cylinder(this.wood, x, 1.22, z + .42, .08, .74);
        } else {
          this.cylinder(this.wood, x, 2.35, z + .42, .06, 3.3);
          this.mesh(new THREE.ConeGeometry(.16, .6, 6), metal, x, 4.25, z + .42);
        }
        this.label(weapon === 'sword' ? '长剑 / SWORD' : '长矛 / SPEAR', x, 5.2, z + .4, 2.8, '#ead9ad', '#302b24');
      }
      this.box(this.brass, 0, 18.3, -40.6, 7, .45, .25);
      for (const x of [-3, 3]) this.box(this.marble, x, 14.4, -40.6, .6, 8, .6);
      this.label('CHÂTEAU', 0, 20, -40.4, 6, '#ead5a6', '#33271e');
      for (const z of [7, 24]) {
        const y = h - 3;
        this.cylinder(this.brass, 0, y, z, 3, .3);
        for (let i = 0; i < 10; i++) this.lampShade(Math.sin(i * Math.PI / 5) * 3, y, z + Math.cos(i * Math.PI / 5) * 3);
        const light = this.lampLight(0, y, z); light.intensity *= 10;
        this.root.add(light);
      }
    } else if (set.id === 'film_le_vrai') {
      const cloth = this.mat(0xb2a796, .94); const gold = this.mat(0x9e8257, .24, .55);
      const jade = this.mat(0x2c5145, .18, .25); const mirror = this.mat(0x687e72, .09, .65);
      // The dining room faces a daylight city, rather than the trilogy's night-green street palette.
      for (let i = 0; i < 16; i++) {
        const z = -d / 2 + 3 + i * 5.1; const height = 15 + (i * 7) % 20;
        const facade = this.mat(i % 3 ? 0x536761 : 0x354e4a, .5, .25);
        this.box(facade, -39 - i % 3 * 3, height / 2 - 12, z, 7.5, height, 4, .05);
        for (let floor = 0; floor < 6; floor++) for (const dz of [-1.3, 1.3]) this.box(this.mat(0x9db9a8, .35), -34.9 - i % 3 * 3, -9 + floor * 3.1, z + dz, .05, 1.5, .8);
      }
      for (let i = 0; i < 9; i++) {
        const x = -35 + i * 9; const height = 17 + (i * 11) % 21;
        this.box(this.mat(i % 2 ? 0x526a65 : 0x839890, .48), x, height / 2 - 11, -d / 2 - 12 - i % 3 * 4, 7.8, height, 6, .04);
        for (let floor = 0; floor < 7; floor++) this.box(this.mat(0xabc7bd, .28), x, -7 + floor * 2.9, -d / 2 - 8 - i % 3 * 4, 5.4, 1, .08);
      }
      for (const x of [-16, 16]) for (const z of [-7, 9]) {
        this.table(x, z, 7, 5, cloth); this.chair(x - 4.7, z, Math.PI / 2, true); this.chair(x + 4.7, z, -Math.PI / 2, true);
        this.cylinder(gold, x, 3.15, z, .12, .65); this.sphere(this.glow, x, 3.55, z, .13);
        for (const dx of [-1.8, 1.8]) { this.cylinder(this.glass, x + dx, 3, z, .22, .6); this.cylinder(gold, x + dx, 2.87, z, .1, .05); }
      }
      this.box(jade, 0, .09, -12, 11, .04, 41); this.table(0, -23, 12, 5, cloth);
      for (const x of [-6.5, 6.5]) this.chair(x, -23, x > 0 ? -Math.PI / 2 : Math.PI / 2, true);
      this.chair(0, -28, 0, true); this.chair(0, -17.5, Math.PI, true);
      for (const x of [-7, 7]) this.cylinder(gold, x, 1.8, -28, .22, 3.6);
      for (let i = 0; i < 4; i++) this.box(gold, -4.5 + i * 3, .08, -14, .045, .04, 45);
      for (const z of [-31, -14, 4, 20]) {
        this.cylinder(gold, 0, h - 2.2, z, 2.3, .18);
        for (let i = 0; i < 8; i++) this.sphere(this.glow, Math.sin(i * Math.PI / 4) * 2, h - 2.6, z + Math.cos(i * Math.PI / 4) * 2, .19);
      }
      // A screened washroom, then a working kitchen and an unremarkable office closet.
      this.box(this.marble, 10, 4, 27, .6, 8, 20); this.box(mirror, 11, 4.5, 31, .13, 6, 7);
      for (const z of [21, 27, 33]) { this.box(this.marble, 21, 3.5, z, .3, 7, .2); this.box(gold, 21, 7.1, z, .5, .2, .5); }
      for (const z of [20, 27]) { this.box(this.marble, 25, 2, z, 2.2, 2.2, 1.3, .12); this.cylinder(gold, 25, 3.15, z, .22, .45); }
      for (const z of [-12, -6, 0]) {
        this.box(this.metal, 16, 1.4, z, 8, 2.8, 4, .08);
        for (const x of [13.6, 17.6]) this.cylinder(this.black, x, 2.95, z, .8, .14);
      }
      this.box(this.wood, 22, 5, -26, 10, 10, .4); this.box(jade, 24, 4.1, -28, 5, 8, .2);
      this.box(gold, 26.1, 4.1, -27, .17, .28, .17); this.label('LE VRAI', 0, h - 3.3, -d / 2 + .7, 11, '#d5bd88', '#243b32');
      const dessert = new THREE.Group(); dessert.userData.dynamic = true; dessert.name = 'causality-dessert';
      this.root.add(dessert); const start = this.root.children.length;
      this.cylinder(this.mat(0x3c201c, .28), 16, 3.12, -7, .85, .22);
      for (let i = 0; i < 18; i++) this.box(this.mat(i % 4 ? 0xd2935b : 0xa9e1bb, .2), 15.4 + i % 6 * .23, 3.4 + Math.floor(i / 6) * .15, -7 + (i % 3 - 1) * .16, .07, .26, .03);
      dessert.position.set(16, 3.1, -7);
      this.root.children.slice(start).forEach(object => { dessert.add(object); object.position.sub(dessert.position); });
      this.exileDessert = dessert;
    } else if (a === 'restaurant') {
      const cloth = this.mat(0xe1ddd0, .9);
      for (const x of [-w * .29, w * .29]) for (let z = -d / 2 + 12; z < d / 2 - 8; z += 15) {
        this.table(x, z, 9, 5, cloth); for (const dz of [-4, 4]) this.chair(x, z + dz, dz > 0 ? Math.PI : 0, true);
        for (const dx of [-2.7, 2.7]) {
          this.cylinder(this.white, x + dx, 2.83, z, 1, .08); this.cylinder(this.glass, x + dx, 3.3, z - 1.6, .25, .65);
          this.cylinder(this.brass, x + dx, 2.95, z - 1.6, .04, .3); this.cylinder(this.white, x + dx, 2.83, z - 1.6, .22, .03);
        }
        this.cylinder(this.brass, x, 3.5, z, .16, 1.6); this.sphere(this.glow, x, 4.3, z, .1);
      }
      this.table(0, -d / 2 + 10, 12, 5, cloth); this.chair(0, -d / 2 + 6, 0, true);
      for (const x of [-w / 2 + 1, w / 2 - 1]) this.box(this.mat(0x42382f), x, h * .65, 0, .4, h * .65, d - 6);
      this.label(set.id.includes('le_vrai') ? 'LE VRAI' : 'FORTY ONE', 0, h - 3, -d / 2 + .6, 12, '#d5bd88', '#27312d');
    } else {
      const red = this.mat(a === 'hel' ? 0x492325 : 0x242c2c, .8);
      for (const side of [-1, 1]) for (let z = -d / 2 + 8; z < d / 2 - 4; z += 13) {
        this.box(red, side * (w / 2 - 2), h / 2, z, 3, h - 1, 9, .2); this.lamp(side * (w / 2 - 4), 8, z, true);
      }
      this.table(-w / 2 + 7, 8, 8, d * .4, this.mat(0x242a29), 3.8);
      for (let i = 0; i < 12; i++) this.cylinder(this.mat(i % 2 ? 0x293e32 : 0x51362b, .2), -w / 2 + 7, 4.4, -8 + i * 2.1, .23, 1.1, .12);
      for (const x of [-w * .3, w * .3]) { this.box(this.black, x, 4, -d / 2 + 4, 4, 8, 3, .1); for (const y of [2.2, 5.4]) this.cylinder(this.mat(0x363b37), x, y, -d / 2 + 5.6, 1.3, .12).rotation.x = Math.PI / 2; }
      if (a === 'hel') { for (let i = 0; i < 7; i++) this.box(this.marble, 0, i * .3, -d / 2 + 9 - i, 26, .5, 1.2); for (const x of [-7, 0, 7]) this.chair(x, -d / 2 + 3, 0, true); }
      const light = new THREE.PointLight(a === 'hel' ? 0xb22324 : 0x2855b3, 1100, 70); light.position.set(0, 9, -12); this.root.add(light);
      this.label(a === 'hel' ? 'HEL' : 'EXIT', 0, h - 2, -d / 2 + .5, 7, '#c59878', '#201513');
    }
  }
  private helClub(set: FilmSet): void {
    const { width: w, depth: d, height: h } = set;
    const basalt = this.mat(0x242729, .88); const red = this.mat(0x5b2027, .5, .14);
    const steel = this.mat(0x52575a, .35, .65); const velvet = this.mat(0x321016, .92);
    const lamp = new THREE.MeshBasicMaterial({ color: 0xd44752, toneMapped: false }); this.materials.add(lamp);
    const shaftLamp = this.mat(0x85434b, .55, .12);
    this.box(basalt, 0, -.07, (HEL_ELEVATOR.doorZ - (d / 2 - 1)) / 2, w - 2, .14, d / 2 - 1 + HEL_ELEVATOR.doorZ).name = 'hel-stone-floor';
    for (const side of [-1, 1]) this.box(basalt, side * ((w - 2) / 4 + 2.2), -.07, 31.15, (w - 2) / 2 - 4.4, .14, 13.1);
    this.box(basalt, 0, -.07, (37.7 + d / 2 - 1) / 2, w - 2, .14, d / 2 - 1 - 37.7);
    for (const side of [-1, 1]) {
      this.box(velvet, side * (w / 2 - .55), h / 2, 0, .12, h - 1, d - 1);
      for (let z = -d / 2 + 6; z < d / 2; z += 8) {
        this.box(steel, side * (w / 2 - 1), h / 2, z, .75, h - 1, .8);
        this.box(lamp, side * (w / 2 - 1.5), 8.5, z, .13, 3.8, .16);
      }
    }
    // Entry cage, weapon check and dance floor occupy one continuous playable room.
    const cage = new THREE.Group(); cage.name = 'hel-elevator-cage'; cage.userData.dynamic = true; this.root.add(cage);
    const liftBox = (x: number, y: number, z: number, width: number, height: number, depth: number) => {
      const mesh = this.box(steel, x, y, z, width, height, depth); cage.add(mesh); return mesh;
    };
    liftBox(0, -.14, 31.15, 8.6, .28, 13.1).name = 'hel-elevator-floor';
    liftBox(0, 9, 31.15, 8.6, .16, 13.1).name = 'hel-elevator-roof';
    for (const side of [-1, 1]) {
      this.box(basalt, side * 4.42, 11.4, 31.15, .18, 23, 13.1);
      for (const z of [24.8, 31, 37.6]) {
        this.box(steel, side * 4.28, 11.4, z, .12, 23, .12);
        liftBox(side * 4.13, 4.45, z, .12, 8.9, .12);
      }
      for (let z = 25.15; z < 37.65; z += .48) liftBox(side * 4.13, 4.45, z, .035, 8.9, .035);
      for (const y of [.35, 1.3, 4.3, 8.5]) liftBox(side * 4.13, y, 31.15, .08, .08, 13.1);
    }
    this.box(basalt, 0, 11.4, 37.76, 8.8, 23, .18);
    for (let x = -4; x <= 4; x += .48) liftBox(x, 4.45, 37.56, .035, 8.9, .035);
    for (const y of [.35, 1.3, 4.3, 8.5]) liftBox(0, y, 37.56, 8.6, .08, .08);
    for (const x of [-3.1, 3.1]) this.box(steel, x, 22, 31.15, .12, 3, .12);
    const elevatorSign = this.label('HEL ↓', 0, 10.5, 24.6, 6, '#cf6064', '#1d171a'); elevatorSign.name = 'hel-elevator-sign'; elevatorSign.userData.dynamic = true;
    const doors = [-1, 1].map((side, index) => {
      const panel = new THREE.Group(); panel.name = index ? 'hel-elevator-right-door' : 'hel-elevator-left-door'; panel.userData.dynamic = true;
      panel.position.set(side * HEL_ELEVATOR.doorWidth / 4, 0, HEL_ELEVATOR.doorZ); cage.add(panel);
      for (const x of [-2.15, 2.15]) panel.add(this.box(steel, x, 4.4, 0, .1, HEL_ELEVATOR.doorHeight, .12));
      for (const y of [.25, 1.25, 4.4, 7.55, 8.7]) panel.add(this.box(steel, 0, y, 0, 4.4, .07, .12));
      for (let x = -2.04; x < 2.15; x += .38) {
        const bar = this.box(steel, x, 4.4, 0, .028, 8.8, .035); panel.add(bar);
      }
      if (!index) {
        const handle = this.box(steel, 2.35, HEL_ELEVATOR.button.y + .5, .3, .09, .45, .09); handle.name = 'hel-elevator-handle'; panel.add(handle);
        for (const y of [2.73, 3.17]) panel.add(this.box(steel, 2.27, y, .15, .23, .05, .3));
      }
      return panel;
    }) as [THREE.Group, THREE.Group];
    const bands: { mesh: THREE.Mesh; y: number }[] = [];
    for (const side of [-1, 1]) for (let i = 0; i < 8; i++) {
      const y = 1 + i * 2.7;
      const mesh = this.box(shaftLamp, side * 3.97, y, 29.5, .08, .13, .8); mesh.name = 'hel-shaft-band'; mesh.userData.dynamic = true;
      bands.push({ mesh, y });
    }
    const liftLight = new THREE.PointLight(0xe0b8a0, 150, 15, 2); liftLight.position.set(0, 7.8, 31); cage.add(liftLight);
    this.helLift = { cage, doors, bands, light: liftLight };
    cage.add(this.box(steel, -3.45, 2.2, 26.1, 1.15, 3.1, .46, .08));
    const button = this.cylinder(lamp, HEL_ELEVATOR.button.x, HEL_ELEVATOR.button.y, HEL_ELEVATOR.button.z - .06, .23, .12); button.rotation.x = Math.PI / 2; cage.add(button);
    button.name = 'hel-elevator-button'; button.userData.dynamic = true;
    cage.add(this.label('HEL', -3.45, 3.35, 26.43, 1.3, '#f4d2c7', '#2e1b20'));
    cage.add(this.box(this.glow, 0, 8.75, 31, 5, .06, .35));
    batchStaticGeometry(cage, new Set()).forEach(geometry => this.own(geometry));
    for (const z of [12]) {
      this.box(this.glow, 0, 9.1, z, 8, .12, .7);
      const light = new THREE.PointLight(0xf0d8cb, z === 31 ? 330 : 290, 24, 2);
      light.position.set(0, 8.5, z); this.root.add(light);
    }
    for (const { x, z, width, depth, height } of HEL_COAT_COUNTERS) {
      const counter = this.box(basalt, x, 1.6, 11, 8, 3.2, 4); counter.name = 'hel-coatcheck-counter'; counter.userData.dynamic = true;
      this.box(steel, x, height - .14, z, width, .28, depth);
      for (let i = 0; i < 7; i++) {
        const hangerX = x - 3 + i;
        this.box(steel, hangerX, 7.5, 14, .06, 2, .06);
        this.box(this.mat(i % 2 ? 0x242127 : 0x34333a, .94), hangerX, 5.35 - i % 2 * .25, 14, .75, 2.9 + i % 2 * .5, .55);
      }
      this.box(steel, x, 8.4, 14, 8, .13, .13);
      const damage = new THREE.Group(); damage.name = 'hel-coatcheck-gouges'; damage.visible = false; damage.userData.dynamic = true;
      for (const [offset, y] of [[-2.5, 1.55], [-1.1, 2.3], [.7, 1.75], [2.9, 2.5]] as const) {
        const gouge = this.box(this.mat(0x100e10, 1), x + offset, y, 13.02, .33, .19, .03); damage.add(gouge);
        const splinter = this.box(steel, x + offset + .27, y - .17, 13.04, .18, .055, .04); splinter.rotation.z = .5; damage.add(splinter);
      }
      this.root.add(damage); (this.helCoatDamage ??= []).push(damage);
    }
    this.box(steel, -8, 5.8, 4.5, 7, 7, .4);
    for (const x of [-10.5, -9, -7.5, -6]) for (const y of [3.5, 6, 8]) {
      this.box(basalt, x, y, 4.78, 1.1, 1.6, .14);
      this.box(steel, x, y + .45, 4.87, .65, .12, .08);
    }
    for (const side of [-1, 1]) {
      this.box(steel, side * 9.5, 5.1, 1, 13, 10.2, .5);
      this.box(red, side * 9.5, 5.1, 1.35, 12.7, 9.6, .12);
    }
    this.label('CLUB HEL', 0, 12.5, 1.45, 8, '#d69a9d', '#1b1417');
    this.helDanceDoor = [-1, 1].map((side, index) => {
      const panel = new THREE.Group(); panel.name = index ? 'hel-dance-right-door' : 'hel-dance-left-door'; panel.userData.dynamic = true;
      panel.position.set(side * HEL_DANCE_DOOR.width / 2, 0, HEL_DANCE_DOOR.z); this.root.add(panel);
      panel.add(this.box(steel, -side * HEL_DANCE_DOOR.width / 4, HEL_DANCE_DOOR.height / 2, 0, HEL_DANCE_DOOR.width / 2, HEL_DANCE_DOOR.height, .52));
      panel.add(this.box(velvet, -side * HEL_DANCE_DOOR.width / 4, HEL_DANCE_DOOR.height / 2, .28, HEL_DANCE_DOOR.width / 2 - .27, HEL_DANCE_DOOR.height - .3, .055));
      for (const y of [1.1, 7.9]) panel.add(this.box(steel, -side * HEL_DANCE_DOOR.width / 4, y, .32, HEL_DANCE_DOOR.width / 2 - .35, .08, .07));
      panel.add(this.box(steel, -side * (HEL_DANCE_DOOR.width / 2 - .4), 3.1, .39, .12, 1.1, .14));
      return panel;
    }) as [THREE.Group, THREE.Group];
    for (const z of [-19, -13, -7]) {
      for (const x of [-19, -12, 12, 19]) {
        const tile = this.box(red, x, .1, z, 6.2, .08, 5.4); tile.name = 'hel-dance-floor';
        this.box(lamp, x, h - 2, z, .18, .12, 4.6);
      }
    }
    for (let z = -23; z < 0; z += 7) {
      this.box(steel, 0, h - 1.2, z, w - 8, .4, .35);
      const light = new THREE.PointLight(z % 2 ? 0x8040a0 : 0xb62738, 45, 24, 2);
      light.position.set(z % 2 ? -15 : 15, h - 2, z); this.root.add(light);
    }
    for (let i = 0; i < HEL_TERRACE.count; i++) {
      const top = HEL_TERRACE.rise * (i + 1);
      this.box(basalt, 0, top / 2, HEL_TERRACE.front - HEL_TERRACE.tread * (i + .5), HEL_TERRACE.width, top, HEL_TERRACE.tread).name = `hel-vip-tread-${i}`;
    }
    const edge = HEL_TERRACE.front - HEL_TERRACE.count * HEL_TERRACE.tread, top = HEL_TERRACE.rise * HEL_TERRACE.count;
    this.box(velvet, 0, top / 2, (edge + HEL_TERRACE.back) / 2, HEL_TERRACE.width, top, edge - HEL_TERRACE.back).name = 'hel-vip-platform';
    for (const x of [-11, 11]) this.box(red, x, 4.6, -36, 1.2, 8, 13);
    const table = this.box(basalt, 0, 2.1, -38, 8, 2.5, 3.1); table.name = 'hel-vip-table'; table.userData.dynamic = true;
    this.box(steel, 0, 3.45, -38, 8.6, .18, 3.6);
    for (const x of [-7, 7]) this.chair(x, -37, x < 0 ? Math.PI / 2 : -Math.PI / 2, true);
    this.label('LE MEROVINGIAN', 0, 12.8, -d / 2 + .8, 13, '#d8b8a0', '#281c1d');
    const vip = new THREE.PointLight(0xc33f49, 190, 24, 2); vip.position.set(0, 11, -35); this.root.add(vip);
    if (this.currentScene === 'm3_hel_entry' || this.currentScene === 'm3_hel_bargain') {
      const crowd: THREE.Group[] = []; const coat = this.mat(0x171b1d, .91); const skin = this.mat(0x685550, .9);
      for (let i = 0; i < 12; i++) {
        const figure = new THREE.Group(); figure.name = 'hel-dance-crowd'; figure.userData.dynamic = true; this.root.add(figure);
        figure.position.z = -6 - Math.floor(i / 2) * 4.3;
        figure.add(this.cylinder(coat, 0, 1.35, 0, .58, 2.5));
        figure.add(this.sphere(skin, 0, 2.94, 0, .43));
        for (const side of [-1, 1]) figure.add(this.cylinder(coat, side * .64, 1.75, 0, .13, 1.6));
        crowd.push(figure);
      }
      const guard = new THREE.Group(); guard.name = 'hel-front-guard'; guard.userData.dynamic = true; this.root.add(guard);
      guard.add(this.cylinder(coat, 0, 1.4, 0, .65, 2.6)); guard.add(this.sphere(skin, 0, 3.02, 0, .45));
      for (const side of [-1, 1]) guard.add(this.cylinder(coat, side * .7, 1.8, -.18, .17, 1.65));
      const floorGuns = new THREE.Group(); floorGuns.name = 'hel-disarmed-guns'; floorGuns.userData.dynamic = true; this.root.add(floorGuns);
      for (const [index, role] of HEL_TRIO.entries()) {
        const gun = createHelPistol(steel); gun.name = `hel-ground-gun-${role}`;
        gun.traverse(object => { if (object instanceof THREE.Mesh) this.geometries.add(object.geometry); });
        gun.position.set((index - 1) * 1.5, top + .085, -30.5); gun.rotation.z = Math.PI / 2; floorGuns.add(gun);
      }
      const flyingGun = createHelPistol(steel); flyingGun.name = 'hel-flying-gun'; flyingGun.userData.dynamic = true; this.root.add(flyingGun);
      flyingGun.traverse(object => { if (object instanceof THREE.Mesh) this.geometries.add(object.geometry); });
      const house = new THREE.PointLight(0xc82235, 250, 30, 2); house.position.set(0, 8, -24); this.root.add(house);
      this.helStandoff = { crowd, guard, floorGuns, flyingGun, light: house };
    }
  }
  private station(set: FilmSet): void {
    const { width: w, depth: d, height: h } = set;
    const tile = this.mat(0x839c92, .35); const border = this.mat(0x526a60, .4);
    for (const side of [-1, 1]) for (let z = -d / 2; z < d / 2; z += 3.5) {
      this.box(tile, side * (w / 2 - .45), h / 2, z, .15, h - .6, 3.44);
      for (let y = .4; y < h; y += 1) this.box(border, side * (w / 2 - .55), y, z, .02, .025, 3.5);
    }
    for (const z of [-d / 2 + 9, -5, d / 2 - 12]) {
      this.label('SUBWAY / PLATFORM 1', 0, h - 3.4, z, 14, '#d9dfc5', '#263831');
      this.table(-9, z + 3, 10, 2, this.wood, 1.4); this.box(this.wood, -9, 2.5, z + 2.2, 10, 1.8, .25);
      for (const x of [-w * .32, w * .32]) for (const y of [2, 4, 6, 8, 10]) this.sphere(this.metal, x, y, z + .94, .09);
    }
    const trackX = w * .43;
    this.box(this.black, trackX, .02, 0, 4.5, .12, d);
    for (const dx of [-1.7, 1.7]) this.box(this.metal, trackX + dx, .21, 0, .14, .22, d);
    for (let z = -d / 2; z < d / 2; z += 2.5) this.box(this.wood, trackX, .13, z, 4.2, .2, .35);
    this.box(this.mat(0xbeb67c), trackX - 3, .07, 0, .6, .07, d);
    this.phone(-7, -d / 2 + 1);
    // The moving train stays beyond the walkable platform aisle.
    const start = this.root.children.length; this.box(this.metal, 0, 3.4, 0, 4, 6, 35, .5);
    for (let z = -13; z <= 13; z += 5) { this.box(this.black, -2.02, 4, z, .06, 2.5, 3.3); this.box(this.glass, -2.06, 4, z, .03, 2.3, 3.1); }
    const train = new THREE.Group(); this.root.children.slice(start).forEach(c => train.add(c)); train.position.x = trackX; train.userData.dynamic = true; this.root.add(train);
    this.moving.push({ object: train, update: t => { train.position.z = ((t * 11) % (d + 90)) - d / 2 - 45; } });
    for (let z = -d / 2; z < d / 2; z += 13) {
      const shape = new THREE.Shape(); shape.moveTo(-w / 2, 0); shape.absellipse(0, 0, w / 2, 7, Math.PI, 0, true, 0); shape.lineTo(w / 2, .6); shape.absellipse(0, .6, w / 2 + .6, 7.6, 0, Math.PI, false, 0); shape.closePath();
      this.mesh(new THREE.ExtrudeGeometry(shape, { depth: .4, bevelEnabled: false, curveSegments: 24 }), border, 0, h - 7.6, z);
    }
  }
  private realWorld(set: FilmSet): void {
    const { architecture: a, width: w, depth: d, height: h } = set;
    if (a === 'ship' || a === 'engineering') {
      for (let z = -d / 2 + 5; z < d / 2; z += 10) {
        this.pipe([[-w / 2 + 1, 0, z], [-w / 2 + 2, h - 4, z], [-w / 2 + 6, h - 1, z], [w / 2 - 6, h - 1, z], [w / 2 - 2, h - 4, z], [w / 2 - 1, 0, z]], .3);
        for (const x of [-w * .4, w * .4]) this.box(this.black, x, .06, z, 4, .12, 9.9);
      }
      for (const x of [-w / 2 + 2, w / 2 - 2]) for (let i = 0; i < 4; i++) this.pipe([[x, 4 + i * 1.4, -d / 2], [x, 4 + i * 1.4, d / 2]], .18 + i * .035, i % 2 ? this.brass : this.metal);
      const logistics = set.id.includes('logos'); const hammer = set.id.includes('hammer');
      if (a === 'ship') {
        for (const x of logistics ? [-6, 6] : [-12, 12]) for (const z of logistics ? [-d / 2 + 14] : [-14, 8, 28]) {
          this.chair(x, z, 0); this.box(this.black, x, 1.3, z + 2.5, 3, .5, 5, .2).rotation.x = -.25;
          this.pipe([[x, 4, z - 1], [x, 7, z - 2], [x + 2, h - 2, z - 5], [w / 2 - 3, h - 2, z - 5]], .08, this.black);
        }
        this.table(0, -d / 2 + 8, 14, 5, this.metal); for (const x of [-4.6, 0, 4.6]) this.crt(x, 4.2, -d / 2 + 8, 1.1, hammer);
        if (logistics) { this.window(0, 9, -d / 2 + .5, w - 7, 9); for (const x of [-w / 2 + 5, w / 2 - 5]) for (const z of [9, 22]) this.box(this.metal, x, 2.1, z, 6, 4.2, 7, .15); }
        if (hammer) for (const x of [-10, 10]) { this.table(x, -25, 4, 9, this.white, 2); this.crt(x + 3, 5, -28, .8, true); }
        if (set.id.includes('wreck')) { for (let i = 0; i < 7; i++) this.box(this.metal, -15 + i * 5, 4, -20 + i % 2 * 7, .4, 15, .4).rotation.z = -.6 + i * .2; this.lamp(10, 4, -16); }
        this.label(logistics ? 'LOGOS' : hammer ? 'HAMMER / MJÖLNIR' : 'NEBUCHADNEZZAR', 0, h - 2, -d / 2 + .5, 17, '#bbb9a3', '#29302d');
      } else {
        for (const x of [-w * .31, w * .31]) for (let z = -d / 2 + 8; z < d / 2; z += 17) {
          this.cylinder(this.metal, x, 5, z, 3, 10); this.pipe([[x, 10, z], [x, 13, z - 4], [x / 2, 13, z - 4]], .65);
          this.mesh(new THREE.TorusGeometry(1, .12, 8, 24), this.brass, x, 4.5, z + 3.1);
        }
      }
    } else if (a === 'zion' || a === 'temple') {
      const rock = this.pbr('damaged_plaster', 0x8e7760, 8);
      for (let i = 0; i < 36; i++) {
        const theta = i / 36 * Math.PI * 2; const r = Math.cos(theta) * w * .51; const z = Math.sin(theta) * d * .51;
        const stone = this.mesh(new THREE.DodecahedronGeometry(1, 1), rock, r, h * .5, z); stone.scale.set(7 + i % 4, h * .62, 8 + i % 3); stone.rotation.y = i;
      }
      if (a === 'temple') {
        for (let i = 0; i < 9; i++) this.box(rock, 0, i * .35, -d / 2 + 8 + i * 1.5, 42 - i, .8, 2);
        for (const x of [-w * .34, w * .34]) for (const z of [-d * .3, 0, d * .3]) { this.cylinder(this.black, x, 2.2, z, 1.8, 3, 2.2); this.sphere(this.glow, x, 4, z, .65); this.lamp(x, 5, z); }
      } else {
        for (const side of [-1, 1]) for (let y = 9; y < h - 7; y += 10) {
          this.box(this.metal, side * (w / 2 - 5), y, 0, 10, .6, d - 15);
          for (let z = -d / 2 + 10; z < d / 2 - 5; z += 4) this.cylinder(this.metal, side * (w / 2 - 10), y + 1.4, z, .06, 2.8);
          this.pipe([[side * (w / 2 - 10), y + 2.8, -d / 2 + 8], [side * (w / 2 - 10), y + 2.8, d / 2 - 8]], .08);
          if (set.id.includes('residences')) for (let z = -d / 2 + 13; z < d / 2 - 8; z += 14) this.lamp(side * (w / 2 - 6), y + 6, z);
        }
        this.box(this.metal, 0, h * .38, -d / 2 + 1, w * .4, h * .76, 1);
        this.label('GATE 03', 0, h * .55, -d / 2 + 1.6, 19, '#bd9f6c', '#262923');
        for (const side of [-1, 1]) { const x = side * w * .31; this.box(this.metal, x, 4, 5, 6, 6, 4, .7); for (const dx of [-2, 2]) { this.box(this.metal, x + dx, 1.5, 5, 1.4, 3, 2, .2); this.pipe([[x + dx, 5, 5], [x + dx * 2, 4, 3], [x + dx * 2, 5, 0]], .45); } this.crt(x, 6, 5, .6); }
      }
    } else if (a === 'pods') {
      const pod = new THREE.MeshPhysicalMaterial({ color: 0x944b42, transparent: true, opacity: .55, roughness: .22, side: THREE.DoubleSide, depthWrite: false }); this.materials.add(pod);
      for (const x of [-w * .4, w * .4]) for (let z = -d / 2; z <= d / 2; z += 14) {
        this.cylinder(this.metal, x, h / 2, z, 3, h);
        for (let y = 4; y < h; y += 7) { const shell = this.sphere(pod, x - Math.sign(x) * 4, y, z, 2.4); shell.scale.set(.9, .7, 1.7); this.pipe([[x, y + 1, z], [x - Math.sign(x) * 4, y + 2, z], [x - Math.sign(x) * 5, y, z + 1]], .2); this.sphere(this.glow, x, y, z + 3, .3); }
      }
      const shell = this.sphere(pod, 0, 1.6, -15, 4); shell.scale.set(1, .5, 1.8); for (let i = 0; i < 5; i++) this.pipe([[-4 + i * 2, 1, -15], [-8 + i * 3, 2, -22], [-w / 2, 3, -28 + i]], .16, this.black);
    } else {
      const gold = this.mat(0x947954, .34, .75);
      if (set.id.includes('above_clouds')) {
        const clouds = this.mat(0xeee7d6, 1); for (let i = 0; i < 35; i++) { const sphere = this.sphere(clouds, Math.sin(i * 7) * 90, -12 + Math.cos(i) * 3, Math.cos(i * 5) * 100, 10 + i % 6); sphere.scale.set(2, .5, 1.5); }
        this.box(this.metal, 0, .3, -4, 17, .8, 27, .2); this.window(0, 7, -19, 20, 12);
      } else {
        for (let i = 0; i < 45; i++) {
          const side = i % 2 ? 1 : -1; const x = side * (w * .3 + i % 4 * 5); const z = -d / 2 + (i * 17) % d; const height = 12 + (i * 11) % h;
          this.box(a === 'desert' ? this.plaster : this.metal, x, height / 2, z, 4 + i % 7, height, 5 + i % 4, .1);
          for (let y = 3; y < height; y += 5) this.box(gold, x, y, z + 3.4, 3, .13, .08);
        }
      }
      if (set.id.includes('machine_core')) {
        const light = new THREE.PointLight(0xffbb77, 16000, 180, 2); light.position.set(0, 25, -d / 2 + 40); this.root.add(light);
        const face = new THREE.Group(); const start = this.root.children.length;
        const skull = this.sphere(this.metal, 0, 20, -d / 2 + 7, 13); skull.scale.set(1, 1.2, .5);
        for (const x of [-5, 5]) { this.sphere(this.black, x, 23, -d / 2 + 14, 2.5).scale.set(1.3, .6, .6); this.sphere(this.glow, x, 23, -d / 2 + 15, 1).scale.set(1.6, .45, .2); }
        this.box(this.black, 0, 14, -d / 2 + 14, 9, 1.1, 1, .4); this.sphere(gold, 0, 19, -d / 2 + 15, 1.9).scale.set(.7, 1.6, 1);
        for (let i = 0; i < 170; i++) { const theta = i * 2.399; const r = Math.sqrt(i / 170) * 12; this.box(i % 7 === 0 ? this.glow : gold, Math.cos(theta) * r, 20 + Math.sin(theta) * r, -d / 2 + 14.2, .5, .45, .8).rotation.z = theta; }
        this.root.children.slice(start).forEach(c => face.add(c)); this.root.add(face);
      }
    }
  }
  private transport(set: FilmSet): void {
    const { architecture: a, width: w, depth: d } = set;
    if (a === 'rooftop') {
      const chase = set.id === 'film_hotel_roofs';
      const spans = chase ? [[-d / 2, OPENING_ESCAPE.roofGapFar], [OPENING_ESCAPE.roofGapNear, d / 2]] : [[-d / 2, d / 2]];
      for (const side of [-1, 1]) for (const [start, end] of spans) {
        const x = side * (w / 2 - .5), z = (start + end) / 2;
        this.box(this.plaster, x, 1.7, z, .7, 3.4, end - start);
        if (chase) this.box(this.black, x, 3.47, z, .82, .14, end - start);
      }
      for (const z of [-d / 2 + .5, d / 2 - .5]) {
        if (chase && z < 0) for (const side of [-1, 1]) this.box(this.plaster, side * (w + 7.4) / 4, 1.7, z, (w - 7.4) / 2, 3.4, .7);
        else this.box(this.plaster, 0, 1.7, z, w, 3.4, .7);
      }
      for (const x of [-w * .34, w * .34]) for (const z of [-d * .26, d * .23]) {
        this.box(this.metal, x, 2.2, z, 6, 4.4, 8, .1); for (let i = 0; i < 7; i++) this.box(this.black, x, 4.45, z - 2.7 + i * .8, 5, .06, .3);
        this.cylinder(this.metal, x, 5.4, z + 2, 1.1, 2); this.cylinder(this.metal, x, 6.4, z + 2, 1.5, .3);
      }
      if (chase) {
        this.root.add(new THREE.HemisphereLight(0xc7d2c9, 0x36352e, .72));
        for (const [x, y, z, color, intensity] of [[-7, 8, OPENING_ESCAPE.roofGapNear + 8, 0xb8c9bc, 305], [7, 8, -10, 0xa6bab4, 320], [-2.8, 5.2, -55, 0xdfb27d, 325]]) {
          const flood = new THREE.PointLight(color, intensity, 34, 2);
          flood.position.set(x, y, z); this.root.add(flood);
        }
        for (const [z, width] of [[OPENING_ESCAPE.roofGapNear + 1.5, 18], [OPENING_ESCAPE.roofGapFar - 1.5, 7]]) {
          this.box(this.black, 0, .11, z, width, .04, .2);
          for (const side of [-1, 1]) this.box(this.brass, side * (width / 2 - .3), .18, z, .16, .04, .75);
        }
        for (const z of [OPENING_ESCAPE.roofGapNear, OPENING_ESCAPE.roofGapFar]) this.box(this.mat(0xb7ad83, .75), 0, .18, z, w - 2, .07, .18);
        for (const x of [-6.6, 6.6]) this.box(this.plaster, x, 7.5, -d / 2 + 1, 5.8, 15, 1);
        this.box(this.plaster, 0, .05, -d / 2 + 1, 7.4, .1, 1);
        this.box(this.plaster, 0, 11.55, -d / 2 + 1, 7.4, 6.9, 1);
        for (const x of [-9.25, 9.25]) this.box(this.plaster, x, 7.5, -d / 2 - 4.6, .55, 15, 10.2);
        this.box(this.black, 0, 15.2, -d / 2 - 4.3, 19.3, .4, 11.3);
        const windowGlow = new THREE.MeshBasicMaterial({ color: 0xa58d5c }); this.materials.add(windowGlow);
        this.openingRoofGlass = new THREE.Group(); this.openingRoofGlass.name = 'opening-roof-window-glass'; this.openingRoofGlass.userData.dynamic = true; this.root.add(this.openingRoofGlass);
        this.openingRoofGlass.add(this.box(windowGlow, 0, 4.1, -d / 2 + 1.6, 7.1, 8, .06));
        this.openingRoofGlass.add(this.box(this.glass, 0, 4.1, -d / 2 + 1.65, 7.1, 8, .08));
        this.openingRoofGlass.add(this.box(this.wood, 0, 4.1, -d / 2 + 1.7, .16, 8, .3));
        this.openingRoofGlass.add(this.box(this.wood, 0, 4.1, -d / 2 + 1.7, 7.4, .16, .3));
        for (const x of [-3.7, 3.7]) this.box(this.wood, x, 4.1, -d / 2 + 1.7, .16, 8.4, .4);
        for (const y of [.1, 8.1]) this.box(this.wood, 0, y, -d / 2 + 1.7, 7.8, .16, .4);
        this.openingRoofStairwell();
        this.openingRoofShards = new THREE.Group(); this.openingRoofShards.name = 'opening-roof-window-shards'; this.openingRoofShards.userData.dynamic = true; this.openingRoofShards.visible = false; this.root.add(this.openingRoofShards);
        for (let i = 0; i < 16; i++) {
          const x = (i % 2 ? 1 : -1) * (1.4 + i % 4 * .4), z = -d / 2 - .4 - i % 6 * .38;
          const y = (openingRoofStairHeight(x, z) ?? -.35) + .025;
          const shard = this.box(i % 4 === 0 ? this.wood : this.glass, x, y, z, .15 + i % 3 * .12, .04, .3 + i % 4 * .15);
          shard.rotation.y = i * 2.4; this.openingRoofShards.add(shard);
        }
      }
      if (set.id.includes('government_roof')) {
        this.mesh(new THREE.TorusGeometry(11, .14, 8, 64), this.white, 0, .05, -15).rotation.x = Math.PI / 2;
        const hull = this.sphere(this.black, 12, 4, -22, 4); hull.scale.set(1, 1, 2.2); this.sphere(this.glass, 12, 4.7, -28, 3.2).scale.set(1, 1, .7);
        this.box(this.metal, 12, 8.2, -22, .2, 1.6, .2); this.box(this.black, 12, 9, -22, 24, .18, .8); this.box(this.black, 12, 9.2, -22, .8, .18, 24);
        this.pipe([[12, 4, -16], [12, 4.5, -7], [12, 6, -3]], .5); for (const x of [9, 15]) this.pipe([[x, 2, -29], [x, .8, -26], [x, .8, -16]], .17);
      }
      if (set.id.includes('office_ledge')) { this.box(this.black, -w / 2, 18, 0, 1, 36, d); for (let z = -d / 2 + 5; z < d / 2; z += 10) this.window(-w / 2 + 1, 12, z, 9, 18, true); }
    } else if (a === 'car') {
      this.car(0, -6); this.chair(-7, 2, Math.PI / 2); this.chair(7, 2, -Math.PI / 2); this.crt(6, 3.5, -7, .65);
      for (const side of [-1, 1]) this.window(side * (w / 2 - 1), 6, 0, d - 6, 6, true);
    } else {
      const road = this.mat(a === 'rain' ? 0x263b3c : 0x333d3e, a === 'rain' ? .16 : .83, a === 'rain' ? .35 : .08);
      this.box(road, 0, .01, 0, a === 'garage' ? w : w * .58, .1, d);
      for (const x of [-w * .19, w * .19]) for (let z = -d / 2; z < d / 2; z += 12) this.box(this.mat(0xb5b4a0), x, .08, z, .18, .04, 5);
      if (a === 'freeway') {
        for (const side of [-1, 1]) { this.box(this.metal, side * w * .39, 2, 0, .5, 1, d); for (let z = -d / 2; z < d / 2; z += 8) this.box(this.metal, side * w * .39, 1, z, .25, 2, .3); }
        for (const z of [-45, 10, 60]) { this.car(-15, z, 0x687773, true); this.car(15, z + 14, 0x292f2e); }
        this.label('101 NORTH / DOWNTOWN', 0, 16, -d / 2 + 10, 27, '#e0dfcc', '#345a46'); for (const x of [-w / 2 + 2, w / 2 - 2]) this.box(this.metal, x, 8, -d / 2 + 10, .6, 16, .6);
      } else if (a === 'bridge') {
        this.box(this.plaster, 0, 19, -15, w + 25, 6, 20); for (const x of [-w / 2 + 3, w / 2 - 3]) this.box(this.plaster, x, 8, -15, 5, 18, 12, .1); this.car(0, -19);
      } else if (a === 'garage') {
        const concrete = this.mat(0x697471, .88); const paint = this.mat(0xd8d2ae, .9);
        for (const side of [-1, 1]) {
          this.box(concrete, side * 10.5, .45, -1, .85, .9, 77);
          for (const z of [-33, -19, -5, 9, 23, 37]) {
            this.box(paint, side * 14.5, .1, z, 9, .05, .22);
            this.box(this.metal, side * 21, 6.5, z, .16, 13, .16);
          }
        }
        for (const z of [-29, -14, 1, 16, 31]) {
          this.box(this.white, 0, 11.9, z, 12, .15, .65);
          this.box(this.glow, 0, 11.7, z, 10, .08, .35);
        }
        for (const x of [-5.5, 5.5]) this.box(paint, x, .12, -35, .25, .04, 6);
        this.box(paint, 0, .12, -35, 11, .04, .27);
        this.car(-17, -14, 0x343f3c); this.car(17, 22, 0x626a65);
        this.garageCar = this.car(GARAGE.start.x, GARAGE.start.z, 0x303b3a);
        this.garageCar.name = 'garage-chase-car';
        this.garageCar.userData.dynamic = true;
        const vapor = new THREE.MeshBasicMaterial({ color: 0xe3f2ed, transparent: true, opacity: .48, depthWrite: false, side: THREE.DoubleSide });
        this.materials.add(vapor);
        for (const twin of GARAGE.twins) {
          const ghost = new THREE.Group(); ghost.userData.dynamic = true; ghost.position.set(twin.x, 0, twin.z); ghost.visible = false; this.root.add(ghost);
          for (let ring = 0; ring < 3; ring++) {
            const wisp = this.mesh(new THREE.TorusGeometry(.7 + ring * .35, .07, 6, 32), vapor, 0, 2.2 + ring * .8, 0, ghost);
            wisp.rotation.y = ring * 1.05; wisp.rotation.x = ring * .38;
          }
          this.garageGhosts.push(ghost);
        }
        this.label('EXIT / CITY ↑', 0, 10, -d / 2 + .5, 11, '#e4e8d8', '#315443');
      }
      else {
        for (const side of [-1, 1]) this.box(this.marble, side * w * WELLS_STREET.sidewalkOffset, WELLS_STREET.sidewalkY, 0, w * WELLS_STREET.sidewalkWidth, WELLS_STREET.sidewalkHeight, d);
        for (const { x, z } of streetLamps(w, d)) {
          this.cylinder(this.metal, x, WELLS_STREET.poleHeight / 2, z, WELLS_STREET.poleRadius, WELLS_STREET.poleHeight);
          this.lamp(x, WELLS_STREET.poleHeight, z, false);
        }
        if (a !== 'rain') this.phone(0, -d * .32, true);
        if (a === 'rain') {
          // Repeated silhouettes read as the occupied avenue without adding hundreds of animated rigs.
          for (const x of [-w * .31, w * .31]) for (let z = -d / 2 + 5; z < d / 2; z += 4.2) {
            this.box(this.black, x, 2.3, z, 1.35, 2.8, .75, .2); this.sphere(this.mat(0x9f9986), x, 4.25, z, .5);
            for (const dx of [-.35, .35]) this.box(this.black, x + dx, .75, z, .4, 1.5, .6, .1);
            this.box(this.black, x, 4.36, z + (x < 0 ? 0 : .44), .7, .16, .06);
          }
          this.mesh(new THREE.TorusGeometry(10, .6, 8, 48), this.plaster, 0, .18, -45).rotation.x = Math.PI / 2;
        }
      }
    }
  }
  private special(set: FilmSet): void {
    const { architecture: a, width: w, depth: d, height: h } = set;
    if (a === 'dojo' || a === 'teahouse') {
      const tatami = this.mat(0x9b9874, 1); const trim = this.mat(0x474c3b);
      for (let x = -w / 2 + 4; x < w / 2; x += 8) for (let z = -d / 2 + 4; z < d / 2; z += 8) { this.box(tatami, x, .04, z, 7.8, .08, 7.8); this.box(trim, x - 3.7, .1, z, .2, .02, 7.8); }
      for (const side of [-1, 1]) for (let z = -d / 2 + 5; z < d / 2; z += 10) {
        this.box(this.white, side * (w / 2 - .6), 6, z, .2, 10, 9.5);
        for (let y = 1; y <= 11; y += 2) this.box(this.wood, side * (w / 2 - .8), y, z, .3, .09, 10);
        for (const dz of [-4.8, -2.4, 0, 2.4, 4.8]) this.box(this.wood, side * (w / 2 - .8), 6, z + dz, .3, 10, .1);
      }
      for (let x = -w / 2 + 1; x < w / 2; x += 8) {
        this.box(this.wood, x, 6, -d / 2 + .6, .35, 12, .5);
        for (const y of [1, 3, 5, 7, 9, 11]) this.box(this.wood, x + 3.8, y, -d / 2 + .6, 7.6, .1, .3);
      }
      for (const side of [-1, 1]) for (let z = -d / 2 + 1; z < d / 2; z += 10) this.box(this.wood, side * (w / 2 - .9), h / 2, z, .5, h, .6);
      this.box(this.wood, 0, 12, -d / 2 + .6, w, .5, .6);
      if (a === 'teahouse') this.label('茶', 0, 13.5, -d / 2 + .5, 3, '#20281c', '#cac7a9');
      if (a === 'teahouse') for (const x of [-15, 15]) for (const z of [-16, 0, 16]) { this.table(x, z, 7, 5); this.chair(x, z + 4, Math.PI); this.chair(x, z - 4); this.sphere(this.mat(0x765843), x, 3.2, z, .55); this.cylinder(this.white, x + 1.2, 2.95, z, .25, .35); }
      if (a === 'teahouse' && this.currentScene === 'm2_seraph') {
        const sunlight = this.mat(0xe2c999, .86); sunlight.emissive.setHex(0xb08a47); sunlight.emissiveIntensity = .38;
        for (const side of [-1, 1]) for (const z of [-15, 1, 17]) {
          this.box(sunlight, side * (w / 2 - .35), 7, z, .08, 8.2, 5.8);
          this.box(this.wood, side * (w / 2 - .55), 7, z, .17, 8.5, .18);
          const beam = new THREE.PointLight(0xffd7a0, 68, 22, 2); beam.position.set(side * (w / 2 - 2.5), 8, z); this.root.add(beam);
        }
        for (const z of [-13, 9]) {
          this.cylinder(this.brass, 0, 12.6, z, .045, 3.5);
          const lantern = this.sphere(this.mat(0xb25f43, .78), 0, 10.4, z, .95); lantern.scale.y = 1.35;
          this.cylinder(this.brass, 0, 9.2, z, .45, .25);
        }
        this.impossibleDoor('m2_seraph', -d / 2 + .95);
      }
    } else if (a === 'construct') {
      this.box(this.white, 0, -.6, 0, w * 3, .5, d * 3); this.loungeChair(-5, -10, -.2); this.loungeChair(5, -10, .2); this.crt(0, 3.1, -18, 2);
      if (this.currentScene === 'm1_guns') for (const x of [-w * .36, w * .36]) for (const z of [-22, 0, 22]) { this.box(this.metal, x, 3.3, z, 5, 6.6, 1); for (let i = 0; i < 5; i++) { this.box(this.black, x - 2 + i, 4.2, z + .6, .25, 3.1, .35); this.box(this.black, x - 2 + i, 2.8, z + .6, .55, .8, .4); } }
    } else if (a === 'courtyard') {
      this.oracleCourtyard(set);
    } else {
      if (a === 'garden' || a === 'plaza') {
        const water = new THREE.MeshPhysicalMaterial({ color: a === 'garden' ? 0x608b94 : 0x588578, roughness: .13, metalness: .45, clearcoat: 1 }); this.materials.add(water);
        if (a === 'plaza') { this.cylinder(this.marble, 12, .4, 2, 9, .8); this.cylinder(water, 12, .87, 2, 8.5, .08); this.cylinder(this.marble, 12, 2, 2, 2, 3, 1.7); this.sphere(water, 12, 3.6, 2, 2.5).scale.y = .17; }
        else { this.box(water, w * .28, .05, -d * .15, w * .33, .1, d * .7, .1); this.box(this.marble, w * .1, .15, -d * .15, .5, .4, d * .72); }
      }
      const leaf = this.mat(a === 'garden' ? 0x496e42 : 0x465a3f, .9);
      for (const x of [-w * .36, w * .36]) for (let z = -d / 2 + 10; z < d / 2; z += 20) {
        this.cylinder(this.wood, x, 4.5, z, .5, 9, .28);
        for (let i = 0; i < 8; i++) { const sphere = this.sphere(leaf, x + Math.sin(i * 4) * 2.8, 10 + i % 3, z + Math.cos(i * 3) * 2.5, 2.6); sphere.scale.y = 1.2; }
      }
      for (const z of [-20, 14]) { this.table(-9, z, 10, 2.4, this.wood, 1.5); this.box(this.wood, -9, 2.6, z - .9, 10, 2, .2); for (const x of [-14, -4]) this.pipe([[x, 0, z - 1], [x, 3, z - 1], [x, 2.3, z + 1]], .08); }
    }
  }
  private oracleCourtyard(set: FilmSet): void {
    const brick = this.pbr('damaged_plaster', 0xd3c7b0, 12);
    const stone = this.mat(0x6c7972, .94), iron = this.mat(0x303836, .6, .6), soil = this.mat(0x403e38, .98), benchPaint = this.mat(0x30443b, .85);
    this.box(stone, 0, -.015, 0, set.width - 4, .06, set.depth - 4);
    for (let z = -set.depth / 2 + 1; z < set.depth / 2; z += 5) this.box(this.mat(0x777a75), 0, .025, z, set.width - 6, .025, .055);
    for (const side of [-1, 1]) {
      this.box(brick, side * (set.width / 2 - 1), 14, 0, 2, 28, set.depth);
      for (let z = -38; z < 42; z += 11) for (const y of [5, 13, 21]) {
        this.box(iron, side * (set.width / 2 - 2.11), y, z, .18, 6, 4.8);
        this.box(this.glass, side * (set.width / 2 - 2.23), y, z, .08, 5.5, 4.2);
        this.box(this.white, side * (set.width / 2 - 2.32), y - 3.2, z, .25, .22, 5.3);
      }
    }
    this.box(brick, 0, 14, -set.depth / 2 + 1, set.width, 28, 2);
    for (const x of [-24, -12, 0, 12, 24]) for (const y of [7, 16, 23]) {
      this.box(iron, x, y, -set.depth / 2 + 2.12, 5.3, 6.2, .15);
      this.box(this.glass, x, y, -set.depth / 2 + 2.24, 4.7, 5.5, .08);
    }
    for (const x of [-24, 24]) for (const z of [-26, 8, 28]) {
      this.box(this.mat(0x555b50), x, .15, z, 9, .3, 5.5);
      this.box(soil, x, .32, z, 8.5, .08, 5);
      for (const dx of [-3.2, -.6, 2.3]) {
        this.cylinder(this.wood, x + dx, 1.6, z, .26, 2.7);
        this.sphere(this.mat(0x435844, .95), x + dx, 3.6, z, 1.5).scale.y = 1.25;
      }
    }
    for (const z of [-31, -7, 18]) this.box(this.mat(0x48514e), 2, .065, z, 31, .018, .1);
    // The Oracle's bench is the interaction anchor, with the folded lead in reach.
    for (const z of [-20.8, -20, -19.2]) this.box(benchPaint, -9, 1.45, z, 4.5, .25, .67);
    for (const y of [2.1, 2.7, 3.3]) this.box(benchPaint, -9, y, -21.12, 4.5, .48, .24);
    for (const x of [-11.1, -6.9]) {
      this.box(iron, x, .78, -20, .23, 1.55, 1.7);
      this.box(iron, x, 2.05, -19.6, .28, .18, 2.1);
    }
    for (const x of [-15, -12, -2]) {
      const bird = new THREE.Group(); bird.userData.dynamic = true; bird.name = 'courtyard-startled-bird'; bird.position.set(x, 0, -14 + (x % 3)); this.root.add(bird);
      this.mesh(new THREE.SphereGeometry(.23, 12, 8), iron, 0, .55, 0, bird).scale.set(1.1, .7, 1.4);
      this.mesh(new THREE.SphereGeometry(.13, 10, 8), iron, .11, .76, 0, bird);
      for (const side of [-1, 1]) { const wing = this.mesh(new THREE.BoxGeometry(.52, .05, .22), iron, side * .27, .6, 0, bird); wing.name = 'bird-wing'; }
      this.courtyardBirds.push(bird);
    }
    const staff = new THREE.Group(); staff.userData.dynamic = true; staff.name = 'courtyard-loose-fence-post'; staff.position.set(BURLY.staff.x, 0, BURLY.staff.z); this.root.add(staff);
    const pole = this.mesh(new THREE.CylinderGeometry(.065, .065, 5.7, 12), iron, 0, 2.85, 0, staff); pole.rotation.z = .25;
    this.mesh(new THREE.BoxGeometry(.42, .1, .42), iron, 0, .16, 0, staff);
    this.courtyardStaff = staff;
    const note = new THREE.Group(); note.userData.dynamic = true; note.name = 'oracle-second-folded-lead'; this.root.add(note);
    this.mesh(new THREE.BoxGeometry(.7, .035, .48), this.white, -7.3, 1.65, -19.45, note).rotation.y = -.22;
    this.mesh(new THREE.BoxGeometry(.45, .022, .018), iron, -7.3, 1.68, -19.23, note);
    this.oracleLetter = note;
    for (const x of [8, 16]) {
      this.box(iron, x, 5.7, -17, .16, 11.4, .16);
      this.box(iron, x, 11.3, -17, .8, .18, 1);
    }
    this.box(iron, 12, 11.3, -17, 8, .18, .18);
    for (const x of [10, 14]) {
      for (const dx of [-.9, .9]) this.cylinder(iron, x + dx, 6.3, -17, .035, 9.5);
      this.box(this.wood, x, 1.6, -17, 2.3, .2, 1);
    }
    this.box(iron, 23, 6.1, -32, .18, 12.2, .18);
    this.box(this.white, 23, 11.3, -32, 6, 3.5, .2);
    const hoop = this.mesh(new THREE.TorusGeometry(.9, .06, 8, 24), this.mat(0xb26b40, .45), 23, 9.6, -30.8); hoop.rotation.x = Math.PI / 2;
    this.box(brick, 0, 5, set.depth / 2 - .8, 14, 10, 1.6);
    this.box(this.white, 0, 4.1, set.depth / 2 - 1.75, 5.6, 8, .12);
    this.box(iron, 0, 4.1, set.depth / 2 - 1.93, 4.8, 7.2, .14);
  }
  private skyline(set: FilmSet): void {
    if (set.id === 'film_hotel_roofs') { this.openingRoofSkyline(); return; }
    const windows = this.mat(set.light === 'night' || set.light === 'storm' ? 0x6f837a : 0x5a737a, .25, .3);
    for (const side of [-1, 1]) for (let i = 0; i < 10; i++) {
      const x = side * (set.width / 2 + 12 + i % 2 * 9); const z = -set.depth / 2 - 5 + i * (set.depth + 20) / 9; const height = 30 + (i * 17 + set.id.length * 3) % 50;
      this.box(this.plaster, x, height / 2, z, 19, height, 15);
      for (let y = 6; y < height - 3; y += 5) for (const dz of [-4.8, 0, 4.8]) {
        this.box(windows, x - side * 9.56, y, z + dz, .08, 3.2, 2.8); this.box(this.white, x - side * 9.66, y - 1.8, z + dz, .35, .2, 3.3);
      }
      this.box(this.white, x, height, z, 20, .5, 16); this.box(this.black, x - side * 9.6, 2.8, z, .1, 5.6, 4.8);
    }
  }
  private openingRoofStairwell(): void {
    const { width, doorZ } = OPENING_ROOF_EXIT, half = width / 2;
    const [upper, middle, lower] = OPENING_ROOF_STAIRS.filter(tread => !tread.rise);
    const concrete = this.mat(0x484f48, .93), paint = this.mat(0x515747, .9), alley = -71.3;
    const base = lower.y - .46, ceiling = 8.55, length = upper.from - doorZ;
    for (const { from, to, y, rise } of OPENING_ROOF_STAIRS) {
      this.box(concrete, 0, (y + base) / 2, (from + to) / 2, width, y - base, from - to);
      if (rise) this.box(this.black, 0, y + .006, to + .045, width - .16, .024, .09);
      for (const side of [-1, 1])
        this.box(paint, side * (half - .035), y + .48, (from + to) / 2, .07, .96, from - to);
    }
    for (const side of [-1, 1]) {
      this.box(this.plaster, side * (half + .18), (ceiling + base) / 2, (upper.from + doorZ) / 2, .36, ceiling - base, length);
      this.box(this.plaster, side * (half + .18), (lower.y + 2.45) / 2, (doorZ + alley) / 2, .36, 2.45 - lower.y, doorZ - alley);
      this.box(this.plaster, side * (half + 2.45) / 2, lower.y + 3.4, doorZ, half - 2.45, 6.8, .38);
      this.box(this.wood, side * 2.44, lower.y + 2.65, doorZ + .14, .18, 5.3, .45);
      for (const z of [-51.7, -54.1, -56.25, -58.7, -60.8, -63.1]) {
        const y = openingRoofStairHeight(0, z, true)!;
        this.box(this.black, side * 3.85, y + .66, z, .12, 1.32, .12);
      }
      const rail = [[-51.7, upper.y], [upper.to, upper.y], [middle.from, middle.y], [middle.to, middle.y], [lower.from, lower.y]];
      this.pipe(rail.map(([z, y]) => [side * 3.85, y + 1.34, z]), .08, this.metal);
    }
    this.box(this.plaster, 0, (ceiling + lower.y + 5.25) / 2, doorZ, width, ceiling - lower.y - 5.25, .38);
    this.box(this.wood, 0, lower.y + 5.25, doorZ + .14, 5.05, .18, .45);
    this.box(this.plaster, 0, ceiling + .18, (upper.from + doorZ) / 2, width + .65, .36, length);
    this.box(this.plaster, 1.62, lower.y + 4.75, lower.to + .75, 5.55, 9.5, .52);
    this.box(this.metal, -2.4, lower.y + .035, -70.3, 1.75, .07, 1.08);
    for (const z of [-53.8, -60.5]) {
      this.box(this.black, -4.2, 4.65, z, .36, .57, 1.27);
      this.box(this.glow, -3.995, 4.65, z, .065, .34, .95);
    }
  }
  private openingRoofSkyline(): void {
    const street = -OPENING_ESCAPE.roofDrop;
    const dark = this.mat(0x2f3732, .96), glass = this.mat(0x26322c, .73), lit = this.mat(0x564933, .73);
    const batches = new Map<THREE.Material, THREE.BoxGeometry[]>();
    const addBox = (material: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number) => {
      const geometry = new THREE.BoxGeometry(width, height, depth);
      geometry.translate(x, y, z);
      const batch = batches.get(material);
      if (batch) batch.push(geometry); else batches.set(material, [geometry]);
    };
    const buildings = [
      [-43, 38, 18, 23, 8], [-48, 10, 22, 22, 18], [-43, -24, 18, 24, 10], [-54, -56, 25, 28, 28],
      [45, 39, 22, 23, 18], [44, 9, 20, 24, 7], [52, -23, 24, 27, 23], [46, -55, 19, 22, 13],
      [-29, -86, 23, 24, 23], [2, -111, 24, 24, 28], [29, -83, 20, 21, 18], [29, -131, 21, 19, 37],
    ];
    for (const [index, [x, z, width, depth, top]] of buildings.entries()) {
      const side = Math.sign(x), face = x - side * (width / 2 + .04);
      addBox(z < -68 ? dark : this.plaster, x, (street + top) / 2, z, width, top - street, depth);
      addBox(dark, x, top + .45, z, width + .8, .9, depth + .8);
      addBox(dark, x + side * 2.2, top + 1.7, z - 2.5, width * .42, 3.4, depth * .44);
      for (let level = 0, y = top - 4.8; y > street + 3; level++, y -= 5.4) {
        for (const bay of [-1, 0, 1]) {
          const material = (index * 3 + level * 5 + bay + 1) % 11 === 0 ? lit : glass;
          addBox(material, face, y, z + bay * depth * .28, .08, 2.5, 2.6);
          addBox(material, x + bay * width * .28, y, z + depth / 2 + .04, 2.6, 2.5, .08);
        }
      }
    }
    const city = new THREE.Group(); city.name = 'opening-roof-skyline'; city.userData.dynamic = true;
    for (const [material, parts] of batches) {
      const geometry = mergeGeometries(parts);
      parts.forEach(part => part.dispose());
      if (!geometry) throw new Error('Opening rooftop skyline geometry could not be merged');
      const mesh = this.mesh(geometry, material, 0, 0, 0, city);
      mesh.castShadow = mesh.receiveShadow = false;
    }
    city.traverse(object => { object.userData.distantBackdrop = true; });
    this.root.add(city);
  }
  private batch(): void {
    for (const _ of this.batchSteps()) { /* Non-staged sets complete in the current frame. */ }
  }
  private *batchSteps(staged = false): Generator<void> {
    this.root.updateMatrixWorld(true);
    const inverse = this.root.matrixWorld.clone().invert(), transform = new THREE.Matrix4();
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>(); const remove: THREE.Object3D[] = [];
    const lafayette = this.current?.id === 'film_lafayette';
    const incremental = lafayette || staged;
    const uses = new Map<THREE.BufferGeometry, number>();
    if (lafayette) this.root.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) uses.set(object.geometry, (uses.get(object.geometry) ?? 0) + 1);
    });
    const meshes: { object: THREE.Mesh; material: THREE.Material }[] = [];
    this.root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
      let ancestor: THREE.Object3D | null = object; while (ancestor && ancestor !== this.root) { if (ancestor.userData.dynamic) return; ancestor = ancestor.parent; }
      meshes.push({ object, material: object.material });
    });
    for (const [index, { object, material }] of meshes.entries()) {
      const source = object.geometry;
      // Static single-use buffers can be transformed and retired by the batch itself.
      const reuse = lafayette && source.index && uses.get(source) === 1 && this.geometries.has(source);
      const geometry = reuse ? source : lafayette ? new THREE.BufferGeometry().copy(source) : source.clone();
      geometry.applyMatrix4(transform.multiplyMatrices(inverse, object.matrixWorld));
      if (reuse) this.geometries.delete(source);
      // Reuse the room's existing indices, especially on the padded chairs.
      let normalized = geometry;
      if (lafayette && !geometry.index) normalized = mergeVertices(geometry, 1e-6);
      else if (!lafayette && geometry.index) normalized = geometry.toNonIndexed();
      if (normalized !== geometry) geometry.dispose();
      // All generated mesh primitives carry position, normal and uv. Extraneous attributes are not needed.
      for (const name of Object.keys(normalized.attributes)) if (!['position', 'normal', 'uv'].includes(name)) normalized.deleteAttribute(name);
      if (incremental) this.geometries.add(normalized);
      const list = batches.get(material) ?? []; list.push(normalized); batches.set(material, list); remove.push(object);
      if (incremental && (index + 1) % 128 === 0) yield;
    }
    for (const object of remove) object.removeFromParent();
    let merged = 0;
    for (const [material, geometries] of batches) {
      const geometry = mergeGeometries(geometries); geometries.forEach(g => { this.geometries.delete(g); g.dispose(); });
      if (!geometry) throw new Error('Film set geometry could not be merged');
      const mesh = new THREE.Mesh(this.own(geometry), material); mesh.castShadow = true; mesh.receiveShadow = true; this.root.add(mesh);
      if (incremental && ++merged % 4 === 0) yield;
    }
    const live = new Set<THREE.BufferGeometry>(); this.root.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Line) live.add(object.geometry); });
    for (const geometry of this.geometries) if (!live.has(geometry)) { geometry.dispose(); this.geometries.delete(geometry); }
  }
  private cancelPodPreparation(): void {
    this.preparedPods?.dispose(); this.preparedPods = undefined;
  }
  private cancelOpeningPreparation(): void {
    const prepared = this.preparedOpening;
    if (!prepared) return;
    this.preparedOpening = undefined;
    prepared.textureUpload?.return(false); prepared.lighting?.dispose(); prepared.steps?.return(undefined); prepared.room.dispose();
  }
  private cancelOpeningRoofRetry(): void {
    this.preparedRoofRetry?.textureUpload?.return(false);
    this.preparedRoofRetry = undefined;
  }
  private cancelOpeningVisit(): void {
    const visit = this.preparedOpeningVisit;
    if (!visit) return;
    this.preparedOpeningVisit = undefined;
    clearTimeout(visit.release); visit.steps?.return(undefined); visit.room.dispose();
  }
  private cancelMatrixEscapePreparation(): void {
    const prepared = this.preparedMatrixEscape; if (!prepared) return;
    prepared.textureUpload?.return(false);
    prepared.lighting?.dispose(); prepared.root.removeFromParent(); prepared.renderer.dispose(); this.preparedMatrixEscape = undefined;
  }
  private cancelOneDeckPreparation(): void {
    const prepared = this.preparedOneDeck;
    if (!prepared) return;
    prepared.root.removeFromParent(); prepared.overlay.dispose(); prepared.deck.dispose(); this.preparedOneDeck = undefined;
  }
  private cancelTruthReturnPreparation(): void {
    const prepared = this.preparedTruthReturn; if (!prepared) return;
    prepared.lighting?.dispose(); prepared.root.removeFromParent(); prepared.deck.dispose(); this.preparedTruthReturn = undefined;
  }
  private cancelClubPreparation(): void {
    const prepared = this.preparedClub; if (!prepared) return;
    this.preparedClub = undefined; prepared.textureUpload?.return(false); prepared.lighting?.dispose();
    prepared.root.removeFromParent(); prepared.renderer.dispose();
  }
  private cancelDojoPreparation(): void {
    const prepared = this.preparedDojo; if (!prepared) return;
    prepared.lighting?.dispose(); prepared.root.removeFromParent(); prepared.renderer.dispose(); this.preparedDojo = undefined;
  }
  private cancelJumpPreparation(): void {
    const prepared = this.preparedJump; if (!prepared) return;
    prepared.lighting?.dispose(); prepared.root.removeFromParent(); prepared.renderer.dispose(); this.preparedJump = undefined;
  }
  private cancelRedDressPreparation(): void {
    const prepared = this.preparedRedDress; if (!prepared) return;
    prepared.textureUpload?.return(false);
    prepared.lighting?.dispose(); prepared.root.removeFromParent(); prepared.renderer.dispose(); this.preparedRedDress = undefined;
  }
  private cancelSentinelPreparation(): void {
    const prepared = this.preparedSentinel; if (!prepared) return;
    prepared.lighting?.dispose(); prepared.root.removeFromParent(); prepared.renderer.dispose(); this.preparedSentinel = undefined;
  }
  private cancelConsolePreparation(): void {
    const prepared = this.preparedConsole; if (!prepared) return;
    prepared.lighting?.dispose(); prepared.root.removeFromParent(); prepared.deck.dispose(); this.preparedConsole = undefined;
  }
  private cancelRestaurantPreparation(): void {
    const prepared = this.preparedRestaurant; if (!prepared) return;
    prepared.textureUpload?.return(false);
    prepared.lighting?.dispose(); prepared.root.removeFromParent(); prepared.renderer.dispose(); this.preparedRestaurant = undefined;
  }
  private cancelMealPreparation(): void {
    const prepared = this.preparedMeal; if (!prepared) return;
    prepared.lighting?.dispose(); prepared.root.removeFromParent(); prepared.deck.dispose(); this.preparedMeal = undefined;
  }
  private cancelTvExitPreparation(): void {
    const prepared = this.preparedTvExit; if (!prepared) return;
    prepared.lighting?.dispose(); prepared.renderer.dispose(); this.preparedTvExit = undefined;
  }
  private cancelLobbyPreparation(): void {
    const prepared = this.preparedLobby; if (!prepared) return;
    prepared.lighting?.dispose(); prepared.root.removeFromParent(); prepared.renderer.dispose(); this.preparedLobby = undefined;
  }
  private cancelGovernmentPreparation(): void {
    const prepared = this.preparedGovernment; if (!prepared) return;
    prepared.textureUpload?.return(false);
    prepared.lighting?.dispose(); prepared.root.removeFromParent(); prepared.renderer.dispose(); this.preparedGovernment = undefined;
  }
  private cancelInterrogationPreparation(): void {
    this.preparedInterrogation?.lighting?.dispose();
    this.preparedInterrogation?.renderer.dispose(); this.preparedInterrogation = undefined;
  }
  private cancelAmbushPreparation(): void {
    this.preparedAmbush?.lighting?.dispose(); this.preparedAmbush?.renderer.dispose(); this.preparedAmbush = undefined;
  }
  private cancelZionPreparation(): void {
    this.preparedZion?.renderer.dispose(); this.preparedZion = undefined;
  }
  private cancelBaneCopyPreparation(): void {
    this.preparedBaneCopy?.renderer.dispose(); this.preparedBaneCopy = undefined;
  }
  private cancelSecondOraclePreparation(): void {
    this.preparedSecondOracle?.textureUpload?.return(false);
    this.preparedSecondOracle?.lighting?.dispose();
    this.preparedSecondOracle?.room.dispose(); this.preparedSecondOracle = undefined;
  }
  private cancelFreewayPreparation(): void {
    this.preparedFreeway?.renderer.dispose(); this.preparedFreeway = undefined;
  }
  private cancelMountainPreparation(): void {
    const prepared = this.preparedMountain;
    if (!prepared) return;
    prepared.root.removeFromParent(); prepared.renderer.dispose(); this.preparedMountain = undefined;
  }
  private clear(keepCrosscut = false): void {
    if (!keepCrosscut) {
      if (this.crosscutTv !== this.tvRepair) this.crosscutTv?.dispose();
      if (this.crosscutDeck?.renderer !== this.neb) this.crosscutDeck?.renderer.dispose();
      this.crosscutTv = undefined; this.crosscutDeck = undefined;
    }
    this.cancelOfficePreparation();
    this.preparedOfficeCanopy = undefined;
    this.preparedOfficeStreet = undefined;
    this.preparedOfficeStreetPhone = undefined;
    this.preparedOfficePhone?.depth.dispose(); this.preparedOfficePhone = undefined;
    this.preparedOfficeConnection = undefined;
    this.preparedOfficeWindow = undefined;
    this.preparedOfficeDescent = undefined;
    this.cancelLafayettePreparation();
    this.cancelOpeningPreparation();
    this.cancelOpeningRoofRetry();
    this.cancelOpeningVisit();
    this.cancelPodPreparation();
    this.cancelMatrixEscapePreparation();
    this.cancelOneDeckPreparation();
    this.cancelTruthReturnPreparation();
    this.cancelDownloadWalkPreparation();
    this.cancelClubPreparation();
    this.cancelDojoPreparation();
    this.cancelJumpPreparation();
    this.cancelRedDressPreparation();
    this.cancelSentinelPreparation();
    this.cancelConsolePreparation();
    this.cancelRestaurantPreparation();
    this.cancelMealPreparation();
    this.cancelTvExitPreparation();
    this.cancelLobbyPreparation();
    this.cancelGovernmentPreparation();
    this.cancelInterrogationPreparation();
    this.cancelZionPreparation();
    this.cancelBaneCopyPreparation();
    this.cancelSecondOraclePreparation();
    this.cancelFreewayPreparation();
    this.cancelMountainPreparation();
    this.courtyardCastColors = undefined;
    this.preparedMeetingHall?.renderer.dispose(); this.preparedMeetingHall = undefined;
    this.preparedMeetingAgents = undefined;
    this.preparedLafayetteGround = undefined;
    this.preparedLafayetteLanding = undefined;
    this.preparedLafayetteUpper = undefined;
    this.helPerformers?.dispose(); this.helPerformers = undefined;
    this.club?.dispose(); this.club = undefined;
    this.approach?.renderer.dispose(); this.approach = undefined;
    this.hotel?.dispose(); this.hotel = undefined;
    this.meeting?.dispose(); this.meeting = undefined;
    this.interrogation?.dispose(); this.interrogation = undefined;
    this.pillGlass = undefined;
    this.cancelAmbushPreparation();
    this.ambush?.dispose(); this.ambush = undefined;
    this.basement?.dispose(); this.basement = undefined; this.basementFrame = undefined; this.basementColors = undefined;
    this.tvRepair?.dispose(); this.tvRepair = undefined;
    this.oracleVase?.dispose(); this.oracleVase = undefined;
    this.oracleBlocks = undefined;
    this.oracleDoor = undefined;
    this.mirror?.dispose(); this.mirror = undefined; this.resetMirrorFrame = undefined; this.mirrorFilament = undefined; this.trackingElectrode = undefined; this.trackingLead = undefined;
    this.pods?.dispose(); this.pods = undefined;
    this.neb?.dispose(); this.neb = undefined;
    this.sourceBriefing?.dispose(); this.sourceBriefing = undefined;
    this.primaryDemolition?.dispose(); this.primaryDemolition = undefined;
    this.trinityTerminal?.dispose(); this.trinityTerminal = undefined;
    this.finale?.dispose(); this.finale = undefined;
    this.construct?.dispose(); this.construct = undefined;
    this.desert?.dispose(); this.desert = undefined;
    this.mountain?.dispose(); this.mountain = undefined;
    this.training?.dispose(); this.training = undefined;
    this.sentinel?.dispose(); this.sentinel = undefined;
    this.restaurant?.dispose(); this.restaurant = undefined;
    this.government?.dispose(); this.government = undefined;
    this.matrixEscape?.dispose(); this.matrixEscape = undefined;
    this.theOne?.dispose(); this.theOne = undefined;
    this.reloaded?.dispose(); this.reloaded = undefined;
    this.catchSet?.dispose(); this.catchSet = undefined;
    this.zion?.dispose(); this.zion = undefined;
    this.baneCopy?.dispose(); this.baneCopy = undefined;
    this.logosBane?.dispose(); this.logosBane = undefined; this.logosBanePhase = undefined; this.logosBaneBlind = false;
    this.revolutionsPrelude?.dispose(); this.revolutionsPrelude = undefined;
    this.oracleLast?.dispose(); this.oracleLast = undefined;
    this.baneInquiry?.dispose(); this.baneInquiry = undefined;
    this.hammerBriefing?.dispose(); this.hammerBriefing = undefined;
    this.zionDeployment?.dispose(); this.zionDeployment = undefined;
    this.maggieDiscovery?.dispose(); this.maggieDiscovery = undefined;
    this.oracleAbsorption?.dispose(); this.oracleAbsorption = undefined;
    this.dockEvacuation?.dispose(); this.dockEvacuation = undefined;
    this.dockBriefing?.dispose(); this.dockBriefing = undefined;
    this.empDock?.dispose(); this.empDock = undefined;
    this.hammerMonitors = undefined;
    this.hammerRoute?.dispose(); this.hammerRoute = undefined;
    this.logosFlight?.dispose(); this.logosFlight = undefined;
    this.logosWreck?.dispose(); this.logosWreck = undefined;
    this.machineCore?.dispose(); this.machineCore = undefined;
    this.smithFinale?.dispose(); this.smithFinale = undefined;
    this.trilogyEpilogue?.dispose(); this.trilogyEpilogue = undefined;
    this.portalDoor = undefined; this.oracleLetter = undefined; this.courtyardStaff = undefined; this.courtyardBirds = []; this.courtyardDisturbedAt = undefined;
    this.exileDessert = undefined; this.bookDoor = undefined; this.chateauVolley = undefined; this.chateauDoor = undefined;
    this.garageCar = undefined; this.garageGhosts = [];
    this.mobil?.dispose(); this.mobil = undefined;
    this.wellsStreet?.dispose(); this.wellsStreet = undefined;
    this.openingBooth = undefined; this.openingGlass = undefined;
    this.openingReceiver?.dispose(); this.openingReceiver = undefined; this.openingCord = undefined;
    this.openingBoothParts = []; this.openingBoothPanes = []; this.openingGlassPieces = [];
    this.hotel303Door = undefined; this.hotel303Glass = undefined; this.hotel303Shards = undefined; this.hotel303Pistol = undefined;
    this.hotel303DeskLight = undefined; this.hotel303HallLight = undefined; this.hotel303Beam = undefined;
    this.hotel303Receiver?.dispose(); this.hotel303Receiver = undefined; this.hotel303Cord = undefined;
    this.cancelOpeningHotelPolice();
    this.openingRoofGlass = undefined; this.openingRoofShards = undefined;
    this.trainmanChase?.dispose(); this.trainmanChase = undefined;
    this.helGarage?.dispose(); this.helGarage = undefined;
    this.helLift = undefined;
    this.helDanceDoor = undefined;
    this.helCoatDamage = undefined;
    this.helStandoff = undefined;
    this.powerStatus = undefined;
    this.sourceDoor?.dispose(); this.sourceDoor = undefined;
    this.architectRoom?.dispose(); this.architectRoom = undefined;
    this.office?.dispose(); this.office = undefined;
    this.freeway?.dispose(); this.freeway = undefined;
    this.lobby?.dispose(); this.lobby = undefined;
    this.root.traverse(object => { if (object instanceof THREE.PointLight || object instanceof THREE.SpotLight) object.dispose(); });
    this.root.clear(); this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose());
    this.geometries.clear(); this.materials.clear(); this.textures.clear(); this.materialCache.clear(); this.moving = [];
  }
  dispose(): void { this.clear(); this.root.removeFromParent(); this.marker.removeFromParent(); this.markerLight.removeFromParent(); this.marker.geometry.dispose(); (this.marker.material as THREE.Material).dispose(); this.markerLight.dispose(); this.officeTowerDepth?.dispose(); this.officeStreetDepth?.dispose(); }
}
