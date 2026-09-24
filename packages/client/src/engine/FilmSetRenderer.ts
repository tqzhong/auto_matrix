import { ReloadedOpeningRenderer } from './ReloadedOpeningRenderer.js';
import { ReloadedCatchRenderer } from './ReloadedCatchRenderer.js';
import { ReloadedFinaleRenderer } from './ReloadedFinaleRenderer.js';
import { ZionHomecomingRenderer } from './ZionHomecomingRenderer.js';
import { BaneCopyRenderer } from './BaneCopyRenderer.js';
import * as THREE from 'three';
import { workdayLocked, type OfficeWorkday } from '@auto_matrix/shared';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { FILM_SETS, FILM_SCENE_BY_ID, OPENING_ESCAPE, openingTruckPose, HEL_ELEVATOR, HEL_DANCE_DOOR, helElevatorLocked, helDanceDoorLocked, PILL_ROOM, MIRROR_SEAT, MIRROR_TIMING, mirrorSilver, pillLocked, pillPose, lafayetteWelcomeLocked, interludeLocked, type PillGesture, FREEWAY_FINISH, GARAGE, ORACLE_FURNITURE, SERAPH_ORACLE, BURLY, EXILES, CHATEAU, awakeningLocked, trainingLocked, phoneLocked, windowOpening, filmPosition, filmSetAt, filmObstacles, filmStepPosition, type Vector3, type FilmSet, type FilmJourney, type AgentState, type SandboxState, type CombatImpact } from '@auto_matrix/shared';
import { OPENING_HOTEL } from '@auto_matrix/shared';
import { LobbySetRenderer } from './LobbySetRenderer.js';
import { OfficeSetRenderer } from './OfficeSetRenderer.js';
import { FreewaySetRenderer } from './FreewaySetRenderer.js';
import { PodSetRenderer } from './PodSetRenderer.js';
import { NebDeckRenderer } from './NebDeckRenderer.js';
import { ConstructRenderer } from './ConstructRenderer.js';
import { DesertRenderer } from './DesertRenderer.js';
import { TrainingSetRenderer } from './TrainingSetRenderer.js';
import { OracleVase } from './OracleVase.js';
import { AmbushSetRenderer } from './AmbushSetRenderer.js';
import { createPillGlass } from '../agents/PillPerformance.js';
import { InterrogationSetRenderer } from './InterrogationSetRenderer.js';
import { interrogationLocked } from '@auto_matrix/shared';
import { MEETING_DESTINATION, meetingLocked, type MeetingGesture } from '@auto_matrix/shared';
import { MeetingSetRenderer } from './MeetingSetRenderer.js';
import { LafayetteApproachRenderer } from './LafayetteApproachRenderer.js';
import { LAFAYETTE } from '@auto_matrix/shared';
import { ApartmentSetRenderer } from './ApartmentSetRenderer.js';
import { apartmentLocked } from '@auto_matrix/shared';
import { clubLocked } from '@auto_matrix/shared';
import { ClubSetRenderer } from './ClubSetRenderer.js';
import { HelClubPerformers } from './HelClubPerformers.js';
import { SentinelSetRenderer } from './SentinelSetRenderer.js';
import { CypherRestaurantRenderer } from './CypherRestaurantRenderer.js';
import { betrayalLocked, rescueLocked } from '@auto_matrix/shared';
import { governmentLocked, airRescueLocked } from '@auto_matrix/shared';
import { GovernmentSetRenderer } from './GovernmentSetRenderer.js';
import { MatrixEscapeRenderer } from './MatrixEscapeRenderer.js';
import { TheOneRenderer } from './TheOneRenderer.js';
import { MountainSetRenderer } from './MountainSetRenderer.js';
import { LogosBaneRenderer } from './LogosBaneRenderer.js';
import { RevolutionsPreludeRenderer } from './RevolutionsPreludeRenderer.js';
import { HammerRouteRenderer } from './HammerRouteRenderer.js';

const outdoor = new Set(['rooftop', 'plaza', 'bridge', 'street', 'courtyard', 'freeway', 'machine', 'rain', 'garden', 'desert', 'pods', 'mountain']);

export function showMirrorSubject(mirror: Reflector, subject: () => THREE.Object3D | undefined): void {
  const renderReflection = mirror.onBeforeRender.bind(mirror);
  mirror.onBeforeRender = (...args) => {
    const body = subject(); const wasVisible = body?.visible;
    if (body) body.visible = true;
    try { renderReflection(...args); }
    finally { if (body) body.visible = wasVisible!; }
  };
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

/** Only the current film set is resident; static meshes are merged by material.
 * Texture/geometry ownership is scoped to a set and released on every transition. */
export class FilmSetRenderer {
  readonly root = new THREE.Group();
  private current?: FilmSet;
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private materialCache = new Map<string, THREE.MeshStandardMaterial>();
  private marker: THREE.Mesh;
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
  private office?: OfficeSetRenderer;
  private apartment?: ApartmentSetRenderer;
  private club?: ClubSetRenderer;
  private freeway?: FreewaySetRenderer;
  private pods?: PodSetRenderer;
  private neb?: NebDeckRenderer;
  private construct?: ConstructRenderer;
  private desert?: DesertRenderer;
  private mountain?: MountainSetRenderer;
  private training?: TrainingSetRenderer;
  private currentScene?: string;
  private mirror?: Reflector;
  private mirrorSubject?: THREE.Object3D;
  private mirrorCracks?: THREE.Group;
  private trackingHeadset?: THREE.Group;
  private oracleVase?: OracleVase;
  private ambush?: AmbushSetRenderer;
  private pillGlass?: THREE.Group;
  private interrogation?: InterrogationSetRenderer;
  private meeting?: MeetingSetRenderer;
  private hotel?: LafayetteApproachRenderer;
  private approach?: { root: THREE.Group; renderer: MeetingSetRenderer };
  private sentinel?: SentinelSetRenderer;
  private restaurant?: CypherRestaurantRenderer;
  private government?: GovernmentSetRenderer;
  private matrixEscape?: MatrixEscapeRenderer;
  private theOne?: TheOneRenderer;
  private reloaded?: ReloadedOpeningRenderer;
  private catchSet?: ReloadedCatchRenderer;
  private finale?: ReloadedFinaleRenderer;
  private zion?: ZionHomecomingRenderer;
  private baneCopy?: BaneCopyRenderer;
  private logosBane?: LogosBaneRenderer;
  private logosBanePhase?: string;
  private revolutionsPrelude?: RevolutionsPreludeRenderer;
  private hammerRoute?: HammerRouteRenderer;
  private portalDoor?: { scene: 'm2_seraph' | 'm2_backdoors'; panel: THREE.Group };
  private oracleLetter?: THREE.Group;
  private courtyardStaff?: THREE.Group;
  private courtyardBirds: THREE.Group[] = [];
  private courtyardDisturbedAt?: number;
  private exileDessert?: THREE.Group;
  private bookDoor?: THREE.Group;
  private chateauVolley?: THREE.Group;
  private chateauVolleyTick?: number;
  private chateauVolleyStart = 0;
  private chateauDoor?: THREE.Mesh;
  private garageCar?: THREE.Group;
  private garageGhosts: THREE.Group[] = [];
  private mobilTrain?: { car: THREE.Group; doors: [THREE.Mesh, THREE.Mesh] };
  private openingTruck?: THREE.Group;
  private openingBooth?: THREE.Group;
  private openingGlass?: THREE.Group;
  private hotel303Door?: THREE.Group;
  private hotel303Glass?: THREE.Group;
  private hotel303Shards?: THREE.Group;
  private hotel303Pistol?: THREE.Group;
  private mobilLastFrame?: number;
  private helChaseTrain?: THREE.Group;
  private helLift?: { doors: [THREE.Group, THREE.Group]; bands: { mesh: THREE.Mesh; y: number }[]; light: THREE.PointLight };
  private helDanceDoor?: [THREE.Group, THREE.Group];
  private helCoatDamage?: THREE.Group[];
  private helPerformers?: HelClubPerformers;
  private helStandoff?: { crowd: THREE.Group[]; guard: THREE.Group; floorGuns: THREE.Group; flyingGun: THREE.Group; light: THREE.PointLight };
  private powerStatus?: { primary: THREE.MeshBasicMaterial; emergency: THREE.MeshBasicMaterial; lights: THREE.PointLight[] };
  private sourceDoor?: { portal: THREE.Group; source: THREE.Group; glow: THREE.Mesh };
  private architectScreens?: { materials: THREE.MeshBasicMaterial[]; neo: THREE.Texture[]; trinity: THREE.Texture; leftDoor: THREE.Mesh; leftLight: THREE.PointLight };

  constructor(private scene: THREE.Scene) {
    scene.add(this.root);
    this.marker = new THREE.Mesh(new THREE.TorusGeometry(1.2, .035, 8, 48), new THREE.MeshBasicMaterial({ color: 0xeac987, transparent: true, opacity: .8, depthWrite: false }));
    this.marker.rotation.x = -Math.PI / 2; this.marker.visible = false; scene.add(this.marker);
    this.markerLight = new THREE.PointLight(0xf6d99c, 5, 5); scene.add(this.markerLight);
  }
  get active(): FilmSet | undefined { return this.current; }
  get televisionPreviewImage(): string | undefined { return this.construct?.televisionPreviewImage; }
  setMirrorSubject(subject?: THREE.Object3D): void { this.mirrorSubject = subject; }
  renderTelevisionPreview(renderer: THREE.WebGLRenderer): void { this.construct?.renderPreview(renderer, this.scene.environment); }
  update(player: AgentState | undefined, sandbox: SandboxState | undefined, elapsed: number, playerPosition?: Vector3, cameraPosition?: Vector3, workday?: OfficeWorkday, firstPerson = false): FilmSet | undefined {
    let set = player ? filmSetAt(player.position, player.isInMatrix) : undefined;
    if (set?.id === 'film_extraction_car' && player?.currentLocation === 'film_adams_bridge') set = FILM_SETS.film_adams_bridge;
    if (set?.id === 'film_adams_bridge' && player?.currentLocation === 'film_extraction_car') set = FILM_SETS.film_extraction_car;
    const journey = sandbox?.neoLife?.journey;
    const sceneId = journey?.visiting ?? journey?.scene;
    if (this.office && set && ['film_metacortex_floor', 'film_office_ledge'].includes(set.id)) { this.current = set; this.currentScene = sceneId; }
    if (this.meeting && set && ['film_adams_bridge', 'film_extraction_car'].includes(set.id)) { this.current = set; this.currentScene = sceneId; }
    if (set?.id !== this.current?.id || sceneId !== this.currentScene) {
      this.clear(); this.current = set; this.currentScene = sceneId;
      if (set) {
        this.root.position.set(set.center.x, set.center.y - 1, set.center.z);
        if (['film_metacortex_floor', 'film_office_ledge'].includes(set.id)) this.office = new OfficeSetRenderer(this.root, set);
        else if (set.id === 'film_anderson_flat') this.apartment = new ApartmentSetRenderer(this.root);
        else if (set.id === 'film_white_rabbit_club') { this.club = new ClubSetRenderer(this.root); void this.club.ready.catch(error => console.error('夜店人群加载失败', error)); }
        else if (set.id === 'film_government_office' || set.id === 'film_government_roof') this.government = new GovernmentSetRenderer(this.root, set.id);
        else if (sceneId === 'm1_subway' && set.id === 'film_subway_platform' || sceneId === 'm1_city_chase' && set.id === 'film_escape_streets') this.matrixEscape = new MatrixEscapeRenderer(this.root, set.id as 'film_subway_platform' | 'film_escape_streets');
        else if (['m1_death', 'm1_return', 'm1_final_call'].includes(sceneId ?? '') && (set.id === 'film_heart_hotel' || set.id === 'film_final_phone')) this.theOne = new TheOneRenderer(this.root, set.id);
        else if (['m2_dream', 'm2_meeting'].includes(sceneId ?? '') && (set.id === 'film_trinity_roof' || set.id === 'film_captains_meeting')) this.reloaded = new ReloadedOpeningRenderer(this.root, set.id);
        else if (sceneId === 'm2_catch' && set.id === 'film_trinity_roof') this.catchSet = new ReloadedCatchRenderer(this.root);
        else if (sceneId === 'm2_bane_copy' && set.id === 'film_industrial_loft') this.baneCopy = new BaneCopyRenderer(this.root);
        else if (['film_zion_hangar', 'film_zion_council', 'film_zion_residences', 'film_zion_temple', 'film_zion_bedroom', 'film_zion_engineering'].includes(set.id)) this.zion = new ZionHomecomingRenderer(this.root, set.id);
        else if (set.architecture === 'lobby') this.lobby = new LobbySetRenderer(this.root, set);
        else if (set.architecture === 'freeway') this.freeway = new FreewaySetRenderer(this.root, set);
        else if (set.architecture === 'pods') this.pods = new PodSetRenderer(this.root);
        else if (set.id === 'film_neb_deck') this.neb = new NebDeckRenderer(this.root);
        else if (set.id === 'film_cypher_restaurant') this.restaurant = new CypherRestaurantRenderer(this.root);
        else if (set.id === 'film_white_construct') this.construct = new ConstructRenderer(this.root, sceneId);
        else if (set.id === 'film_real_desert') this.desert = new DesertRenderer(this.root);
        else if (set.id === 'film_mountain_range') this.mountain = new MountainSetRenderer(this.root);
        else if (set.id === 'film_hammer_route') this.hammerRoute = new HammerRouteRenderer(this.root);
        else if (['m1_dojo', 'm1_jump', 'm1_red_dress'].includes(sceneId ?? '')) this.training = new TrainingSetRenderer(this.root, sceneId!);
        else if (sceneId === 'm1_sentinels') this.sentinel = new SentinelSetRenderer(this.root);
        else if (set.id === 'film_ambush_house') this.ambush = new AmbushSetRenderer(this.root);
        else if (set.id === 'film_agent_interrogation') this.interrogation = new InterrogationSetRenderer(this.root);
        else if (set.id === 'film_adams_bridge' || set.id === 'film_extraction_car') this.meeting = new MeetingSetRenderer(this.root);
        else {
          this.build(set); this.batch();
          if (sceneId === 'm3_bane' && set.id === 'film_logos_deck') this.logosBane = new LogosBaneRenderer(this.root);
          if (sceneId === 'm3_oracle_absorbed' && set.id === 'film_oracle_home'
            || ['m3_bane_questions', 'm3_logos_plan', 'm3_maggie_discovery', 'm3_emp'].includes(sceneId ?? '') && set.id === 'film_hammer_deck')
            this.revolutionsPrelude = new RevolutionsPreludeRenderer(this.root, sceneId as 'm3_oracle_absorbed' | 'm3_bane_questions' | 'm3_logos_plan' | 'm3_maggie_discovery' | 'm3_emp');
          if (set.id === 'film_club_hel' && typeof window !== 'undefined') {
            this.helPerformers = new HelClubPerformers(this.root);
            void this.helPerformers.ready.catch(error => console.error('Club Hel 演员加载失败', error));
          }
          if (sceneId === 'm2_stop_sentinels' && set.id === 'film_service_tunnels' || sceneId === 'm2_medical' && set.id === 'film_hammer_deck') this.finale = new ReloadedFinaleRenderer(this.root, sceneId);
          if (set.architecture === 'power') this.createPowerStatus(set);
          if (sceneId === 'm2_key_door') this.createSourceDoor();
          if (sceneId === 'm2_architect') this.createArchitectScreens();
          if (set.id === 'film_chateau_hall') {
            this.chateauVolley = new THREE.Group(); this.chateauVolley.visible = false; this.root.add(this.chateauVolley);
            const bullet = this.mat(0xc5b49a, .2, .85);
            for (let i = 0; i < 8; i++) {
              const round = this.mesh(new THREE.CylinderGeometry(.035, .035, .34, 8), bullet, -2.6 + i * .72, 3.05 + Math.sin(i * 2.4) * .26, 2.4 + i % 3 * .4, this.chateauVolley);
              round.rotation.x = Math.PI / 2;
            }
            this.chateauDoor = this.mesh(new THREE.BoxGeometry(5, 7, .38), this.wood, 0, 14.5, -40.7);
          }
          if (set.id === 'film_lafayette') {
            this.hotel = new LafayetteApproachRenderer(this.root, new THREE.Vector3(0, -LAFAYETTE.upper, 0));
            const root = new THREE.Group(); root.position.set(-MEETING_DESTINATION.x, -LAFAYETTE.upper, 0); this.root.add(root);
            this.approach = { root, renderer: new MeetingSetRenderer(root, false) };
          }
        }
        if (sceneId === 'm2_meeting' && set.id === 'film_neb_deck') this.reloaded = new ReloadedOpeningRenderer(this.root, set.id);
        if (!this.theOne && ['m1_death', 'm1_return'].includes(sceneId ?? '') && set.id === 'film_neb_deck') this.theOne = new TheOneRenderer(this.root, set.id);
      }
    }
    if (this.mirrorCracks) {
      const healing = journey?.scene === 'm1_mirror' && !journey.visiting;
      const time = journey?.awakening?.elapsed ?? 0;
      const progress = !healing ? 0 : journey!.step > 0 ? 1 : THREE.MathUtils.smoothstep(time, MIRROR_TIMING.wired, MIRROR_TIMING.touch + .4);
      this.mirrorCracks.visible = progress < 1;
      this.mirrorCracks.scale.y = Math.max(.001, 1 - progress);
      const shader = this.mirror!.material as THREE.ShaderMaterial;
      shader.uniforms.liquidTime.value = elapsed; shader.uniforms.liquidAmount.value = healing ? mirrorSilver(time) * .003 : 0;
    }
    if (this.trackingHeadset) {
      const time = journey?.scene === 'm1_mirror' ? journey.awakening?.elapsed ?? 0 : 0;
      const lowered = THREE.MathUtils.smoothstep(time, MIRROR_TIMING.sit, MIRROR_TIMING.wired);
      this.trackingHeadset.position.set(MIRROR_SEAT.x + 1.9 * (1 - lowered), 4.4 - 1.1 * lowered, MIRROR_SEAT.z + .65);
    }
    if (this.pillGlass) {
      const gesture = sceneId === 'm1_pills' && !journey?.visiting ? player?.currentAction?.parameters.pills as PillGesture | undefined : undefined;
      const pose = gesture ? pillPose(gesture) : undefined;
      this.pillGlass.visible = !pose?.holdingCup;
      const used = pose?.cupUsed || journey?.pills?.phase === 'done';
      const water = this.pillGlass.getObjectByName('pill-water-level')!;
      water.scale.y = used ? .45 : 1; water.position.y = used ? -.12 : -.04;
    }
    this.lobby?.update(journey, elapsed);
    this.interrogation?.update(journey);
    this.meeting?.update(journey, elapsed, player?.id === journey?.actor ? player?.currentAction?.parameters.meeting as MeetingGesture | undefined : undefined);
    this.hotel?.update(journey?.visiting ? undefined : journey?.hotel, (playerPosition?.y ?? 1) - 1);
    if (this.approach) {
      this.approach.root.visible = (playerPosition?.y ?? 1) < 15;
      if (this.approach.root.visible) this.approach.renderer.update(journey, elapsed, { phase: 'parked', elapsed: 0, role: 'neo', bugged: false });
    }
    this.office?.update(journey, cameraPosition, playerPosition, workday, elapsed);
    if (this.hotel303Door && this.hotel303Glass && this.hotel303Shards) {
      const hotel = sceneId === 'm1_room303' && !journey?.visiting ? journey?.openingHotel : undefined;
      const opening = hotel?.phase === 'breach' ? Math.min(1, hotel.elapsed / OPENING_HOTEL.breachSeconds) : hotel?.phase === 'trace' || !hotel ? 0 : 1;
      this.hotel303Door.rotation.y = -opening * 1.35;
      const broken = hotel?.phase === 'dive' && hotel.elapsed > .35 || ['ladder_ready', 'climbing', 'done'].includes(hotel?.phase ?? '');
      this.hotel303Glass.visible = !broken; this.hotel303Shards.visible = Boolean(broken);
      if (this.hotel303Pistol) {
        this.hotel303Pistol.visible = Boolean(hotel?.fallen && !hotel.disarmed && hotel.phase === 'combat');
        if (hotel?.fallen) this.hotel303Pistol.position.set(hotel.fallen.x - this.current!.center.x, .12, hotel.fallen.z - this.current!.center.z);
      }
    }
    if (this.openingTruck && this.openingBooth && this.openingGlass) {
      const phone = sceneId === 'm1_phone_escape' && !journey?.visiting ? journey?.openingPhone : undefined;
      const pose = openingTruckPose(phone ?? { phase: 'running', remaining: OPENING_ESCAPE.phoneSeconds, lastTick: 0, attempts: 0 });
      this.openingTruck.position.set(pose.x, 0, pose.z); this.openingTruck.rotation.y = pose.yaw;
      const strike = phone?.phase === 'done' || phone?.phase === 'failed' ? 1
        : phone?.phase === 'connected' ? Math.min(1, (phone.impactElapsed ?? 0) / OPENING_ESCAPE.truckImpactSeconds) : 0;
      this.openingBooth.rotation.x = -.46 * strike;
      this.openingGlass.visible = strike > .35;
      this.openingGlass.scale.setScalar(Math.max(.01, strike));
    }
    this.apartment?.update(journey);
    this.club?.update(elapsed);
    this.freeway?.update(journey, elapsed, playerPosition);
    this.pods?.update(journey, elapsed, firstPerson);
    this.neb?.update(journey, elapsed);
    this.finale?.update(journey, elapsed);
    this.revolutionsPrelude?.update(journey, elapsed);
    this.hammerRoute?.update(journey?.scene === 'm3_hammer_tunnels' && !journey.visiting ? journey.hammer : undefined, elapsed, firstPerson);
    this.construct?.update(journey);
    this.desert?.update(journey, elapsed);
    this.mountain?.update(journey?.scene === 'm2_mountain' && !journey.visiting ? journey.mountain : undefined, elapsed);
    this.training?.update(journey, elapsed);
    this.sentinel?.update(journey, elapsed);
    this.restaurant?.update(journey, elapsed);
    this.ambush?.update(journey, sandbox?.structures ?? [], elapsed);
    this.government?.update(journey, elapsed);
    this.matrixEscape?.update(journey, elapsed);
    this.theOne?.update(journey, elapsed);
    this.reloaded?.update(journey);
    this.catchSet?.update(journey);
    this.zion?.update(journey, elapsed);
    this.baneCopy?.update(journey, elapsed, player && journey?.actor === player.id ? player.position : undefined, set?.center);
    if (this.logosBane) {
      const encounter = journey?.scene === 'm3_bane' && !journey.visiting ? journey.bane : undefined;
      this.logosBane.update(encounter, journey?.step ?? 0, elapsed);
      this.logosBanePhase = encounter?.phase;
    }
    if (this.mobilTrain) this.updateMobilStation(journey, elapsed);
    if (this.helChaseTrain) {
      const chase = sceneId === 'm3_trainman_chase' && !journey?.visiting ? journey?.helChase : undefined;
      this.helChaseTrain.visible = chase?.phase === 'running' && chase.elapsed >= 3;
      this.helChaseTrain.position.z = 60 - Math.max(0, (chase?.elapsed ?? 0) - 3) / 3 * 130;
    }
    if (this.helLift) {
      const lift = sceneId === 'm3_hel_entry' && !journey?.visiting ? journey?.helElevator : undefined;
      const open = sceneId === 'm3_hel_bargain' || Boolean(journey?.visiting) || (journey?.step ?? 0) > 0 || lift?.phase === 'open';
      const opening = lift?.phase === 'descending' ? Math.max(0, Math.min(1, (lift.elapsed - HEL_ELEVATOR.seconds + .7) / .7)) : 0;
      const travel = open ? 1 : opening * opening * (3 - 2 * opening);
      this.helLift.doors[0].position.x = -HEL_ELEVATOR.doorWidth / 4 - travel * 4.5;
      this.helLift.doors[1].position.x = HEL_ELEVATOR.doorWidth / 4 + travel * 4.5;
      for (const band of this.helLift.bands) band.mesh.position.y = lift?.phase === 'descending' ? 1 + (band.y + lift.elapsed * 3.5) % 8 : band.y;
      this.helLift.light.intensity = lift?.phase === 'descending' ? 190 + Math.sin(lift.elapsed * 17) * 65 : 90;
    }
    if (this.helDanceDoor) {
      const opening = sceneId === 'm3_hel_bargain' || Boolean(journey?.visiting) || (journey?.step ?? 0) > 3 || journey?.helDanceDoor?.phase === 'open';
      const progress = opening ? 1 : helDanceDoorLocked(journey) ? Math.min(1, journey!.helDanceDoor!.elapsed / HEL_DANCE_DOOR.seconds) : 0;
      const swing = (progress * progress * (3 - 2 * progress)) * 1.28;
      this.helDanceDoor[0].rotation.y = swing; this.helDanceDoor[1].rotation.y = -swing;
    }
    this.helCoatDamage?.forEach((mark, index) => { mark.visible = (journey?.helCoatcheck?.coverHits[index] ?? 0) > 0 && !journey?.visiting; });
    if (this.helStandoff) {
      const encounter = sceneId === 'm3_hel_bargain' && !journey?.visiting ? journey?.helBargain : undefined;
      const entering = sceneId === 'm3_hel_entry' && !journey?.visiting && ((journey?.step ?? 0) > 3 || journey?.helDanceDoor?.phase === 'open' || journey?.helDanceDoor?.phase === 'opening' && journey.helDanceDoor.elapsed > HEL_DANCE_DOOR.seconds * .3);
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
      this.helStandoff.floorGuns.visible = Boolean(encounter) && !['armed', 'airborne', 'gunpoint', 'released'].includes(phase ?? '');
      this.helStandoff.flyingGun.visible = phase === 'airborne';
      if (phase === 'airborne') {
        const flight = Math.min(1, (encounter?.elapsed ?? 0) / 2.8);
        this.helStandoff.flyingGun.position.set(3.2 * (1 - flight), 1.4 + Math.sin(flight * Math.PI) * 1.8, -27 - 4 * flight);
        this.helStandoff.flyingGun.rotation.z = flight * Math.PI * 2;
      }
      this.helStandoff.light.intensity = encounter && phase !== 'armed' && phase !== 'released' ? 80 : 250;
    }
    this.helPerformers?.update(journey, elapsed);
    if (this.powerStatus) {
      const grid = journey?.grid;
      const energized = grid?.primary !== 'off' && grid?.emergency !== 'off';
      this.powerStatus.primary.color.setHex(grid?.primary === 'off' ? 0x35443d : grid?.primary === 'armed' ? 0xffbd62 : 0x8cdb9b);
      this.powerStatus.emergency.color.setHex(grid?.emergency === 'off' ? 0x35443d : grid?.vigilant === 'lost' ? 0xe26956 : 0x8cdb9b);
      this.powerStatus.lights.forEach(light => { light.intensity = energized ? 210 : 19; light.color.setHex(energized ? 0xf3e7c9 : 0xac5144); });
    }
    if (this.sourceDoor) {
      this.sourceDoor.portal.position.x = journey?.keyDoor?.portalOpened ? 6.3 : 0;
      this.sourceDoor.source.position.x = journey?.grid?.phase === 'opened' ? 5.5 : 0;
      this.sourceDoor.glow.visible = journey?.grid?.phase === 'window' || journey?.grid?.phase === 'opened';
    }
    if (this.architectScreens) {
      const live = sceneId === 'm2_architect' && !journey?.visiting && (journey?.step ?? 0) >= 4;
      this.architectScreens.materials.forEach((material, index) => {
        const map = live ? this.architectScreens!.trinity : this.architectScreens!.neo[index];
        if (material.map !== map) { material.map = map; material.needsUpdate = true; }
      });
      const open = journey?.architect?.door === 'matrix';
      this.architectScreens.leftDoor.position.x = open ? -12.8 : -8;
      this.architectScreens.leftLight.intensity = live ? 15 : 4;
    }
    if (this.portalDoor) {
      const open = journey?.completed.includes(this.portalDoor.scene) || journey?.scene === this.portalDoor.scene && journey.step >= FILM_SCENE_BY_ID[this.portalDoor.scene].steps.length;
      this.portalDoor.panel.position.x = open ? 5.2 : 0;
    }
    if (this.oracleLetter) this.oracleLetter.visible = sceneId === 'm2_bench' && (journey?.step ?? 0) < FILM_SCENE_BY_ID.m2_bench.steps.length;
    if (this.courtyardStaff) this.courtyardStaff.visible = sceneId === 'm2_bench' || sceneId === 'm2_burly' && !journey?.visiting && !['staff', 'flight_ready', 'flight', 'done'].includes(journey?.burly?.phase ?? 'ready');
    if (this.exileDessert) {
      const triggered = sceneId === 'm2_merovingian' && (journey?.step ?? 0) >= 2;
      this.exileDessert.visible = triggered;
      this.exileDessert.scale.setScalar(1 + Math.sin(elapsed * 4) * .08);
    }
    if (this.bookDoor) this.bookDoor.position.x = sceneId === 'm2_library' && !journey?.visiting && (journey?.step ?? 0) >= 3 ? -5.8 : 0;
    if (this.chateauVolley) {
      const volley = sceneId === 'm2_chateau' && !journey?.visiting ? journey?.chateau?.volleyAt : undefined;
      if (volley !== undefined && volley !== this.chateauVolleyTick) { this.chateauVolleyTick = volley; this.chateauVolleyStart = elapsed; }
      this.chateauVolley.visible = volley !== undefined && elapsed - this.chateauVolleyStart < 1.25;
    }
    if (this.chateauDoor) this.chateauDoor.position.x = sceneId === 'm2_chateau' && (journey?.step ?? 0) >= 2 ? 5 : 0;
    if (this.garageCar) {
      const escape = sceneId === 'm2_garage' && !journey?.visiting ? journey?.garage : undefined;
      this.garageCar.position.set(escape?.x ?? GARAGE.start.x, 0, escape?.z ?? GARAGE.start.z);
      this.garageCar.rotation.y = escape ? -Math.atan2(escape.lateral, Math.max(1, escape.speed)) : 0;
      this.garageGhosts.forEach((ghost, index) => {
        ghost.visible = Boolean(escape && escape.elapsed < escape.ghostUntil[index]);
        ghost.rotation.y = elapsed * (index ? -3 : 3);
        ghost.scale.setScalar(1 + Math.sin(elapsed * 18 + index) * .12);
      });
    }
    if (this.courtyardBirds.length) {
      const startled = sceneId === 'm2_burly' && !journey?.visiting && journey?.burly?.phase !== 'ready';
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
    const scene = journey && FILM_SCENE_BY_ID[journey.scene]; const step = scene?.steps[journey!.step];
    this.marker.visible = Boolean(set && scene?.set === set.id && step && !journey?.visiting && journey?.actor === player?.id);
    if (helElevatorLocked(journey) || helDanceDoorLocked(journey)) this.marker.visible = false;
    if (['m1_lobby', 'm3_hel_entry'].includes(journey?.scene ?? '') && journey?.fighting) this.marker.visible = false;
    if (journey?.scene === 'm2_burly' && !['ready', 'staff_ready', 'flight_ready'].includes(journey.burly?.phase ?? 'ready')) this.marker.visible = false;
    if (journey?.scene === 'm2_chateau' && journey.step === 0 && !['ready', 'landing'].includes(journey.chateau?.phase ?? 'ready')) this.marker.visible = false;
    if (journey?.scene === 'm2_mountain' && journey.step === 2 && !['ready', 'failed'].includes(journey.mountain?.phase ?? 'ready')) this.marker.visible = false;
    if (journey?.scene === 'm3_bane' && journey.step === 1 && journey.bane?.phase !== 'ready') this.marker.visible = false;
    if (journey?.scene === 'm2_garage' && journey.garage?.phase === 'riding') this.marker.visible = false;
    if (journey?.scene === 'm3_hammer_tunnels' && journey.hammer?.phase === 'riding') this.marker.visible = false;
    if (journey?.scene === 'm3_gate' && journey.apu?.phase === 'riding') this.marker.visible = false;
    if (journey?.scene === 'm3_dock_battle' && journey.dockGunnery?.phase === 'firing') this.marker.visible = false;
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
    if (journey?.scene === 'm1_sentinels' && journey.sentinel && !['ready', 'verify', 'done'].includes(journey.sentinel.phase)) this.marker.visible = false;
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
    if (journey && windowOpening(journey)) this.marker.visible = false;
    if (journey?.scene === 'm1_dejavu' && journey.step === 0 && journey.ambush) this.marker.visible = false;
    if (this.marker.visible && step && scene) {
      const position = scene.id === 'm2_burly' && journey?.burly?.phase === 'staff_ready' ? filmPosition(scene.set, BURLY.staff.x, BURLY.staff.z)
        : scene.id === 'm2_chateau' && journey?.chateau?.phase === 'landing' ? filmStepPosition(scene, scene.steps[1])
        : step.kind === 'drive' && journey?.ride ? filmPosition(scene.set, 14, FREEWAY_FINISH) : filmStepPosition(scene, step);
      if (scene.id === 'm1_ledge' && journey?.office?.climbed !== undefined) position.y -= 32;
      this.marker.position.set(position.x, position.y - .82, position.z);
      this.marker.scale.setScalar(1 + Math.sin(elapsed * 2) * .07); this.markerLight.position.copy(this.marker.position).y += 1.5;
    }
    this.markerLight.visible = this.marker.visible;
    for (const item of this.moving) item.update(elapsed);
    return set;
  }
  atmosphere(): { color: number; ambient: number; sun: number } | undefined {
    if (!this.current) return;
    const palette = palettes[this.current.light];
    (this.scene.background as THREE.Color).setHex(palette.sky);
    const fog = this.scene.fog as THREE.FogExp2; fog.color.setHex(palette.sky); fog.density = palette.fog;
    this.scene.environmentIntensity = outdoor.has(this.current.architecture) ? .8 : .6;
    if (this.revolutionsPrelude && this.currentScene === 'm3_oracle_absorbed') {
      const dark = this.revolutionsPrelude.consumed;
      fog.color.setHex(dark ? 0x101e19 : 0x333d31); fog.density = dark ? .006 : .003;
      (this.scene.background as THREE.Color).copy(fog.color);
      this.scene.environmentIntensity = dark ? .22 : .45;
      return { color: dark ? 0x99cfa5 : 0xe1dbc0, ambient: dark ? .32 : .66, sun: .08 };
    }
    if (this.revolutionsPrelude && this.currentScene === 'm3_emp' && this.revolutionsPrelude.blackout) {
      fog.color.setHex(0x0b1318); fog.density = .005; (this.scene.background as THREE.Color).copy(fog.color);
      this.scene.environmentIntensity = .12;
      return { color: 0x93a9b1, ambient: .24, sun: .02 };
    }
    if (this.logosBane) {
      const phase = this.logosBanePhase;
      const cut = phase && !['ready', 'gun_warning'].includes(phase);
      const blind = phase && ['blind', 'pipe_window', 'counter', 'failed'].includes(phase);
      const color = blind ? 0x050a0c : cut ? 0x111b1e : 0x26333a;
      fog.color.setHex(color); fog.density = blind ? .016 : .004;
      (this.scene.background as THREE.Color).setHex(color);
      this.scene.environmentIntensity = blind ? .025 : cut ? .12 : .52;
      return { color: blind ? 0x7d92a0 : 0xc4d5da, ambient: blind ? .065 : cut ? .18 : .68, sun: blind ? .01 : cut ? .04 : .13 };
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
    if (this.apartment) { fog.density = .001; this.scene.environmentIntensity = .42; return { color: 0xcbd2b8, ambient: .52, sun: .06 }; }
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
      fog.density = .0012; fog.color.setHex(0x1d2829);
      this.scene.environmentIntensity = .54;
      return { color: 0xb9d0c6, ambient: .58, sun: .08 };
    }
    if (this.architectScreens) {
      fog.density = .001; this.scene.environmentIntensity = .55;
      return { color: 0xf1f1e9, ambient: .95, sun: .08 };
    }
    if (this.theOne && this.current.id === 'film_heart_hotel') { fog.density = .0023; fog.color.setHex(0x151e1b); this.scene.environmentIntensity = .48; return { color: 0xd9dfbc, ambient: .55, sun: .08 }; }
    if (this.currentScene === 'm1_room303') { fog.density = .003; fog.color.setHex(0x121a18); this.scene.environmentIntensity = .36; return { color: 0xb9c8bb, ambient: .35, sun: .05 }; }
    if (this.theOne && this.current.id === 'film_final_phone') { fog.density = .0012; fog.color.setHex(0xaebfc0); this.scene.environmentIntensity = .9; return { color: 0xffe5be, ambient: .96, sun: 1.7 }; }
    if (this.hotel) { fog.density = .001; this.scene.environmentIntensity = .42; return { color: 0xd4d1b2, ambient: .62, sun: .12 }; }
    if (this.ambush) { this.scene.environmentIntensity = .4; return { color: 0xd4ddbe, ambient: .52, sun: .15 }; }
    if (this.pods) {
      (this.scene.background as THREE.Color).setHex(0x080f14); fog.color.setHex(0x080f14); fog.density = .005;
      this.scene.environmentIntensity = .45;
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
      (this.scene.background as THREE.Color).setHex(0x303b3e); fog.color.setHex(0x303b3e); fog.density = .0055;
      this.scene.environmentIntensity = .55;
      return { color: 0xb4c7c6, ambient: .7, sun: .48 };
    }
    if (this.training) {
      if (this.training.sceneId === 'm1_dojo') {
        (this.scene.background as THREE.Color).setHex(0xb7c6bd); fog.color.setHex(0xb7c6bd); fog.density = .002;
        this.scene.environmentIntensity = .78; return { color: 0xffe9c2, ambient: .88, sun: .58 };
      }
      if (this.training.sceneId === 'm1_jump') {
        (this.scene.background as THREE.Color).setHex(0x9db2b5); fog.color.setHex(0x9db2b5); fog.density = .0042;
        this.scene.environmentIntensity = .7; return { color: 0xf2dfbf, ambient: .78, sun: 1.05 };
      }
      (this.scene.background as THREE.Color).setHex(0xb8c3bd); fog.color.setHex(0xb8c3bd); fog.density = .0025;
      this.scene.environmentIntensity = .74; return { color: 0xffead0, ambient: .9, sun: .9 };
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
  private pbr(id: string, color = 0xffffff, repeat = 4, roughness = .85, metalness = 0): THREE.MeshStandardMaterial {
    const loader = new THREE.TextureLoader();
    const texture = (kind: string) => {
      const map = loader.load(`/assets/film-materials/${id}-${kind}.jpg`); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(repeat, repeat); map.anisotropy = 8;
      if (kind === 'color') map.colorSpace = THREE.SRGBColorSpace; this.textures.add(map); return map;
    };
    const material = new THREE.MeshStandardMaterial({ color, map: texture('color'), normalMap: texture('normal'), roughnessMap: texture('roughness'), roughness, metalness, normalScale: new THREE.Vector2(.4, .4) });
    this.materials.add(material); return material;
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
  private label(text: string, x: number, y: number, z: number, width = 10, color = '#dadace', background = '#182422'): THREE.Mesh {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 192;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = background; ctx.fillRect(0, 0, 1024, 192);
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.strokeRect(16, 16, 992, 160); ctx.fillStyle = color; ctx.font = '46px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 512, 98, 942);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; this.textures.add(map);
    const material = new THREE.MeshStandardMaterial({ map, roughness: .72 }); this.materials.add(material);
    return this.mesh(new THREE.PlaneGeometry(width, width * 192 / 1024), material, x, y, z);
  }
  private lamp(x: number, y: number, z: number, warm = true, hanging = false): void {
    if (hanging) this.cylinder(this.metal, x, y + 1.8, z, .035, 3.6);
    this.mesh(new THREE.CylinderGeometry(.75, 1.15, .55, 24, 1, true), this.brass, x, y + .15, z);
    this.sphere(this.glow, x, y, z, .18);
    const light = new THREE.PointLight(warm ? 0xffd6a1 : 0xc7e4e2, warm ? 135 : 185, 30, 2); light.position.set(x, y - .3, z); this.root.add(light);
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
  private loungeChair(x: number, z: number, angle: number): void {
    const start = this.root.children.length;
    const seam = this.mat(0x43221c, .68); const trim = this.mat(0x856747, .38, .65);
    for (const dx of [-1.35, 1.35]) for (const dz of [-1.05, 1.05]) {
      this.cylinder(this.wood, dx, .48, dz, .16, .92, .22); this.sphere(this.wood, dx, .19, dz, .22);
    }
    this.box(this.leather, 0, 1.02, 0, 3.65, .6, 3.05, .22);
    this.box(this.leather, 0, 1.48, .1, 2.8, .55, 2.65, .25);
    this.pipe([[-1.3, 1.55, 1.36], [0, 1.56, 1.4], [1.3, 1.55, 1.36]], .018, seam);
    this.box(this.leather, 0, 3.23, -1.23, 3.7, 3.65, .65, .3).rotation.x = -.09;
    const buttons: [number, number][] = [];
    for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) {
      const bx = -1.44 + col * .72 + row % 2 * .36;
      if (bx < 1.6) buttons.push([bx, 2 + row * .62]);
    }
    const positions: number[] = []; const uv: number[] = []; const indices: number[] = [];
    const surface = (sx: number, sy: number) => {
      const v = (sy - 1.65) / 3.3;
      const radius = Math.min(...buttons.map(([bx, by]) => ((sx - bx) / .65) ** 2 + ((sy - by) / .55) ** 2));
      return -.8 - v * .2 + sx * sx * .095 + .19 * Math.min(1, radius * 3) - .13 * Math.exp(-radius * 20);
    };
    for (let row = 0; row <= 48; row++) for (let col = 0; col <= 48; col++) {
      const sx = (col / 48 - .5) * 3.4; const sy = 1.65 + row / 48 * 3.3;
      positions.push(sx, sy, surface(sx, sy)); uv.push(col / 48, row / 48);
      if (row < 48 && col < 48) { const a = row * 49 + col; indices.push(a, a + 1, a + 49, a + 1, a + 50, a + 49); }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
    this.mesh(geometry, this.leather, 0, 0, 0);
    for (const [bx, by] of buttons) this.sphere(seam, bx, by, surface(bx, by) + .035, .065).scale.z = .45;
    for (const side of [-1, 1]) {
      this.box(this.leather, side * 1.58, 2.04, 0, .65, 1.85, 2.9, .3);
      this.cylinder(this.leather, side * 1.6, 2.78, .1, .42, 2.8).rotation.x = Math.PI / 2;
      this.sphere(this.leather, side * 1.6, 2.78, 1.5, .43).scale.z = .5;
      for (let i = 0; i < 11; i++) this.sphere(trim, side * 1.86, 1.1 + i * .32, -1.17, .033);
      this.pipe([[side * 1.9, 1.2, 1.43], [side * 1.9, 2.6, 1.43], [side * 1.6, 3.17, 1.43], [side * 1.25, 2.65, 1.43]], .025, seam);
    }
    for (let i = 0; i < 26; i++) this.sphere(trim, -1.72 + i * .138, .89, 1.55, .033);
    const group = new THREE.Group(); this.root.children.slice(start).forEach(child => group.add(child)); group.scale.setScalar(.65); group.position.set(x, 0, z); group.rotation.y = angle; this.root.add(group);
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
  private crt(x: number, y: number, z: number, scale = 1, blue = false): void {
    this.box(this.black, x, y + .25 * scale, z, 2.5 * scale, 2 * scale, 1.8 * scale, .18);
    const screen = this.box(this.mat(blue ? 0x587888 : 0x354b35, .25), x, y + .3 * scale, z + .92 * scale, 2.1 * scale, 1.5 * scale, .08, .12);
    (screen.material as THREE.MeshStandardMaterial).emissive.setHex(blue ? 0x315367 : 0x1b452e); (screen.material as THREE.MeshStandardMaterial).emissiveIntensity = .7;
    for (let i = 0; i < 6; i++) this.box(this.glow, x - .3 * scale, y + (.7 - i * .18) * scale, z + .971 * scale, (i % 3 + 1) * .4 * scale, .024 * scale, .01);
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
    const panel = this.box(scene === 'm2_seraph' ? this.wood : this.white, 0, 4.05, z + .68, 5.2, 7.55, .28, .08);
    panel.name = `${scene}-keyed-door`;
    const group = new THREE.Group(); group.userData.dynamic = true; group.add(panel); this.root.add(group);
    group.add(this.sphere(this.brass, 1.8, 3.65, z + .94, .17));
    this.portalDoor = { scene, panel: group };
  }
  private phone(x: number, z: number, booth = false): void {
    this.box(this.metal, x, 3.8, z, 1.45, 2.4, .8, .12); this.box(this.black, x, 4.3, z + .43, .75, .7, .08);
    for (let i = 0; i < 12; i++) this.box(this.white, x - .28 + i % 3 * .23, 3.8 - Math.floor(i / 3) * .18, z + .46, .13, .1, .05);
    this.pipe([[x - .67, 4.5, z + .55], [x - .9, 4.1, z + .7], [x - .65, 3.5, z + .55]], .12, this.black);
    this.pipe([[x - .7, 3.7, z + .4], [x - .4, 2.7, z + .5], [x, 3.1, z + .4]], .04, this.black);
    if (booth) {
      for (const dx of [-1.8, 1.8]) for (const dz of [-1.4, 1.4]) this.box(this.metal, x + dx, 3.8, z + dz, .15, 7.6, .15);
      for (const dx of [-1.8, 1.8]) this.box(this.glass, x + dx, 3.8, z, .06, 7, 2.8);
      this.box(this.metal, x, 7.7, z, 3.8, .5, 3.1); this.label('TELEPHONE', x, 7.7, z + 1.57, 3.4);
    }
  }
  private car(x: number, z: number, color = 0x182622, truck = false): THREE.Group {
    const start = this.root.children.length; const paint = this.mat(color, .26, .62);
    this.box(paint, 0, 1.9, 0, 4.2, 1.9, truck ? 15 : 9, .5);
    this.box(this.glass, 0, 3.3, -.4, 3.7, 1.7, truck ? 4 : 4.7, .45);
    this.box(paint, 0, 4.2, -.5, 3.9, .18, truck ? 4.2 : 4.8, .1);
    if (truck) this.box(this.white, 0, 4.3, 7, 5.6, 7, 13, .15);
    for (const dx of [-2.1, 2.1]) for (const dz of [-2.9, 2.9]) this.cylinder(this.black, dx, 1.2, dz, 1, .6).rotation.z = Math.PI / 2;
    for (const dx of [-1.35, 1.35]) this.box(this.glow, dx, 2, -4.52, .8, .45, .08, .12);
    this.box(this.metal, 0, 1.3, -4.57, 4.1, .32, .13, .1);
    const group = new THREE.Group(); this.root.children.slice(start).forEach(c => group.add(c)); group.position.set(x, 0, z); this.root.add(group); return group;
  }
  private shell(set: FilmSet): void {
    const { width: w, depth: d, height: h } = set; const exterior = outdoor.has(set.architecture);
    const lavish = ['chateau', 'lobby', 'restaurant', 'hel', 'architect'].includes(set.architecture);
    const industrial = ['ship', 'engineering', 'garage', 'power', 'zion', 'temple', 'pods', 'machine'].includes(set.architecture);
    const floor = set.id === 'film_hotel_roofs' ? this.mat(0x485653, .92) : this.currentScene === 'm2_key_door' ? this.pbr('damaged_plaster', 0x798380, 8) : set.architecture === 'architect' ? this.mat(0xecece7, .28) : lavish ? this.marble : industrial ? this.metal : ['construct', 'mobil', 'backdoors'].includes(set.architecture) ? this.white : exterior ? this.pbr('damaged_plaster', set.architecture === 'garden' ? 0x6f7851 : 0x6f7879, 14) : this.wood;
    if (set.id === 'film_hotel_roofs') {
      const near = OPENING_ESCAPE.roofGapNear; const far = OPENING_ESCAPE.roofGapFar;
      this.box(floor, 0, -.3, (near + d / 2) / 2, w, .6, d / 2 - near);
      this.box(floor, 0, -.3, (far - d / 2) / 2, w, .6, far + d / 2);
      this.box(this.black, 0, -OPENING_ESCAPE.roofDrop, (near + far) / 2, w + 24, .5, near - far);
      for (const z of [near, far]) {
        this.box(this.plaster, 0, -OPENING_ESCAPE.roofDrop / 2, z, w, OPENING_ESCAPE.roofDrop, .6);
        this.box(this.metal, 0, .14, z, w, .28, .28);
      }
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
    if (exterior || set.architecture === 'construct') return;
    const wall = set.id === 'film_power_station' ? this.pbr('damaged_plaster', 0x915b4d, 3) : this.currentScene === 'm2_key_door' ? this.pbr('damaged_plaster', 0x9ba5a0, 12) : set.architecture === 'architect' ? this.mat(0xf1f1eb, .48) : industrial ? this.metal : lavish || ['oracle', 'dojo', 'teahouse', 'mobil', 'backdoors'].includes(set.architecture) ? this.white : this.plaster;
    for (const x of [-w / 2, w / 2]) {
      if (set.architecture === 'lafayette' && x > 0) continue;
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
    if (set.architecture === 'lafayette') {
      this.box(this.plaster, 0, h, 0, w, .5, d);
      for (const y of [.2, .55, 3.7, h - 1.1, h - .8, h - .4]) {
        const trim = y > 4 ? this.white : this.wood;
        for (const side of [-1, 1]) { if (side < 0) this.box(trim, side * (w / 2 - .45), y, 0, .35, .15, d); this.box(trim, 0, y, side * (d / 2 - .45), w, .15, .35); }
      }
      for (let z = -d / 2 + 3; z < d / 2; z += 6) for (const side of [-1, 1]) if (side < 0 || Math.abs(z) > 3.3) this.box(this.wood, side * (w / 2 - .4), 1.9, z, .12, 3.2, .12);
      return;
    }
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
  private build(set: FilmSet): void {
    this.metal = this.pbr('metal_plate', 0x9caaa9, 3, .7, .28);
    this.wood = this.pbr('old_wood_floor', 0x96826b, 3); this.marble = this.pbr('marble_01', 0xbdcbd1, 4, .25);
    this.plaster = this.pbr('damaged_plaster', 0xadae9c, 5); this.leather = this.pbr('leather_red_03', 0x71413a, 1, .48);
    this.white = this.pbr('white_plaster_02', 0xd8d9ce, 3); this.black = this.mat(0x161b1a, .44); this.brass = this.mat(0x8e7951, .32, .8);
    this.glass = new THREE.MeshPhysicalMaterial({ color: 0xb3c9c7, metalness: .12, roughness: .12, transparent: true, opacity: .3, side: THREE.DoubleSide, depthWrite: false }); this.materials.add(this.glass);
    this.glow = new THREE.MeshBasicMaterial({ color: 0xffdb9e, toneMapped: false }); this.materials.add(this.glow);
    this.shell(set);
    const a = set.architecture;
    if (['hotel', 'apartment', 'oracle', 'lafayette', 'tenement'].includes(a)) this.domestic(set);
    if (['office', 'interrogation', 'power', 'workshop', 'backdoors', 'architect'].includes(a)) this.workplace(set);
    if (['chateau', 'restaurant', 'club', 'hel'].includes(a)) this.publicInterior(set);
    if (['ship', 'engineering', 'zion', 'temple', 'pods', 'machine', 'desert'].includes(a)) this.realWorld(set);
    if (['subway', 'mobil'].includes(a)) this.station(set);
    if (['rooftop', 'street', 'rain', 'bridge', 'freeway', 'garage', 'car'].includes(a)) this.transport(set);
    if (['dojo', 'teahouse', 'construct', 'plaza', 'courtyard', 'garden'].includes(a)) this.special(set);
    if (outdoor.has(a) && !['pods', 'machine', 'desert'].includes(a)) this.skyline(set);
    if (!outdoor.has(a)) {
      const fill = new THREE.HemisphereLight(set.light === 'warm' ? 0xeed9b7 : 0xc7d3d3, 0x3e3830, .5); this.root.add(fill);
      const spot = new THREE.SpotLight(set.light === 'warm' ? 0xffd8b1 : 0xe5eee9, 2100, 120, Math.PI / 3, .7, 2);
      spot.position.set(-set.width * .28, set.architecture === 'lafayette' ? set.height - 2 : set.height + 5, 10); spot.target.position.set(0, 0, -5); spot.castShadow = true;
      spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -.0002; spot.shadow.normalBias = .05;
      this.root.add(spot, spot.target);
    }
  }
  private openingHotelSet(set: FilmSet): void {
    const soot = this.pbr('damaged_plaster', 0x3b4540, 4);
    const plaster = this.pbr('damaged_plaster', 0x6a7066, 5);
    const carpet = this.mat(0x302d2a, .95);
    const ember = this.mat(0x1b201e, 1);
    this.box(this.pbr('old_wood_floor', 0x897f72, 5), 0, .04, 12, set.width - 1.6, .07, 25);
    this.box(carpet, 0, .085, 12, 19, .035, 17);
    for (let i = 0; i < 14; i++) {
      const x = Math.sin(i * 3.8) * 12; const z = 4 + i * 1.31;
      const mark = this.box(ember, x, .11, z, 2 + i % 3, .012, 1.4 + i % 4); mark.rotation.y = i * .77;
    }
    for (const wall of OPENING_HOTEL.walls.slice(0, 2)) {
      this.box(soot, wall.x, set.height / 2, wall.z, wall.width, set.height, wall.depth);
      for (const y of [1.1, 3.8, 8.5]) this.box(plaster, wall.x, y, wall.z + .42, wall.width, .16, .06);
    }
    this.box(soot, 0, 10, OPENING_HOTEL.doorZ, 6.7, 4, .65);
    const door = new THREE.Group(); door.name = 'hotel-303-door'; door.userData.dynamic = true;
    door.position.set(-3.23, 0, OPENING_HOTEL.doorZ); this.root.add(door); this.hotel303Door = door;
    door.add(this.box(this.wood, 3.23, 3.95, 0, 6.35, 7.9, .3, .1));
    door.add(this.box(this.metal, 5.8, 3.7, .24, .35, .18, .17));
    this.box(this.metal, 0, 8.1, OPENING_HOTEL.doorZ, 7.2, .34, .65);
    for (const x of [-3.55, 3.55]) this.box(this.metal, x, 4, OPENING_HOTEL.doorZ, .3, 8, .65);
    this.label('303', 0, 8.8, OPENING_HOTEL.doorZ + .45, 2.1, '#d8d0b6', '#34413e');

    const desk = OPENING_HOTEL.computer;
    this.table(-11, desk.z, 3, 2.2, this.metal, 2.75);
    this.crt(-11.1, 3.6, desk.z, .66);
    this.chair(-7.5, desk.z + 2, Math.PI);
    this.phone(OPENING_HOTEL.phone.x, OPENING_HOTEL.phone.z);
    this.hotel303Pistol = new THREE.Group(); this.hotel303Pistol.name = 'hotel-303-dropped-pistol'; this.hotel303Pistol.userData.dynamic = true;
    this.hotel303Pistol.visible = false; this.root.add(this.hotel303Pistol);
    this.hotel303Pistol.add(this.box(this.black, 0, .22, 0, 1.05, .17, .24));
    const grip = this.box(this.metal, -.24, .08, .15, .24, .27, .14); grip.rotation.z = -.35; this.hotel303Pistol.add(grip);
    this.hotel303Pistol.add(this.box(this.brass, .35, .33, 0, .13, .12, .16));
    const computerLight = new THREE.PointLight(0x8fcbb3, 180, 18, 2); computerLight.position.set(-9.5, 4.8, desk.z); this.root.add(computerLight);
    const corridorLight = new THREE.PointLight(0xc3b89a, 125, 30, 2); corridorLight.position.set(0, 9, -12); this.root.add(corridorLight);
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
    this.hotel303Glass.add(this.box(this.glass, 0, 3.75, -set.depth / 2 + .39, 7.6, 7.2, .08));
    this.hotel303Shards = new THREE.Group(); this.hotel303Shards.name = 'hotel-303-window-shards'; this.hotel303Shards.userData.dynamic = true;
    this.hotel303Shards.visible = false; this.root.add(this.hotel303Shards);
    for (let i = 0; i < 28; i++) {
      const angle = i * 2.399; const radius = 1.5 + (i % 6) * .42;
      const shard = this.box(this.glass, Math.sin(angle) * radius, .1 + i % 5 * .16, -set.depth / 2 - .3 - Math.cos(angle) * radius,
        .12 + i % 3 * .12, .04, .28 + i % 4 * .14); shard.rotation.y = angle; this.hotel303Shards.add(shard);
    }
    this.box(this.metal, 0, -.35, -set.depth / 2 - 4.8, 11, .4, 9);
    for (const x of [-5.3, 5.3]) {
      this.box(this.metal, x, 2.15, -set.depth / 2 - 4.8, .16, 4.7, 9);
      for (const z of [-set.depth / 2 - 8, -set.depth / 2 - 5, -set.depth / 2 - 2]) this.box(this.metal, x, 2.4, z, .18, .14, .18);
    }
    const ladder = new THREE.Group(); ladder.name = 'hotel-303-fire-escape-ladder'; this.root.add(ladder);
    for (const x of [-.8, .8]) ladder.add(this.box(this.metal, x, OPENING_HOTEL.ladderHeight / 2, OPENING_HOTEL.ladderZ - .4, .16, OPENING_HOTEL.ladderHeight + .6, .18));
    for (let y = .35; y < OPENING_HOTEL.ladderHeight; y += .65) ladder.add(this.box(this.metal, 0, y, OPENING_HOTEL.ladderZ - .4, 1.75, .12, .16));
    ladder.add(this.box(this.metal, 0, OPENING_HOTEL.ladderHeight + .12, OPENING_HOTEL.ladderZ - 1.2, 5.4, .24, 4.3));
    const exterior = this.pbr('damaged_plaster', 0x73746e, 6);
    this.box(exterior, 0, 8, -42, 27, 16, .5);
    for (const x of [-9, -3, 3, 9]) {
      this.box(this.black, x, 9.5, -41.68, 3.2, 5, .12);
      this.box(this.mat(0x6c775e, .7), x, 9.5, -41.6, 2.8, 4.6, .06);
      this.box(this.black, x, 9.5, -41.5, .12, 4.8, .1);
      this.box(this.black, x, 9.5, -41.5, 2.9, .12, .1);
    }
    const escapeLight = new THREE.PointLight(0xb1be9d, 155, 31, 2); escapeLight.position.set(0, 8, -32); this.root.add(escapeLight);
  }
  private domestic(set: FilmSet): void {
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
      this.rug(0, -6, 19, 22);
      this.loungeChair(-PILL_ROOM.seat, PILL_ROOM.z, Math.PI / 2); this.loungeChair(PILL_ROOM.seat, PILL_ROOM.z, -Math.PI / 2);
      this.table(0, PILL_ROOM.tableZ, 3.2, 1.8, this.wood, PILL_ROOM.tableY);
      this.box(this.black, -.65, PILL_ROOM.tableY + .21, PILL_ROOM.tableZ, .5, .12, .35, .04);
      this.pillGlass = createPillGlass(); this.pillGlass.position.set(PILL_ROOM.cup.x, PILL_ROOM.cup.y, PILL_ROOM.cup.z); this.root.add(this.pillGlass);
      this.pillGlass.traverse(object => { if (object instanceof THREE.Mesh) { this.geometries.add(object.geometry); this.materials.add(object.material as THREE.Material); } });
      const plaster = this.mat(0x8b897b, .9); const cable = this.mat(0x1a201f, .9);
      for (const wall of filmObstacles(set).filter(item => item.z === -11.5)) {
        this.box(plaster, wall.x, wall.height / 2, wall.z, wall.width, wall.height, wall.depth, .04);
        this.box(this.wood, wall.x, .65, wall.z + .37, wall.width, 1.3, .1);
        this.box(this.wood, wall.x, 8.8, wall.z + .37, wall.width, .45, .15);
      }
      for (const x of [-8, -4]) this.box(this.wood, x, 4.5, -11.5, .3, 9.2, .9);
      this.box(this.wood, -6, 9.1, -11.5, 4.4, .35, .9);
      this.rug(-7, -17, 19, 14);
      const chairX = MIRROR_SEAT.x; const chairZ = MIRROR_SEAT.z;
      this.box(this.metal, chairX, .35, chairZ, 2.1, .28, 2.1, .12);
      for (const dx of [-.85, .85]) for (const dz of [-.85, .85]) this.cylinder(this.metal, chairX + dx, .75, chairZ + dz, .075, 1.5);
      this.box(this.leather, chairX, 1.58, chairZ, 2.12, .4, 2.1, .16);
      this.box(this.leather, chairX, 2.48, chairZ + .92, 2.12, 2.1, .38, .17);
      this.box(this.leather, chairX, 3.47, chairZ + 1.03, 1.35, .5, .46, .16);
      for (const dx of [-1.1, 1.1]) {
        this.box(this.metal, chairX + dx, 1.72, chairZ, .18, .18, 2.05, .04);
        this.box(this.leather, chairX + dx, 1.82, chairZ, .28, .14, 1.45, .06);
      }
      const headsetStart = this.root.children.length;
      this.pipe([[-.72, -.18, 0], [-.7, .36, 0], [0, .59, 0], [.7, .36, 0], [.72, -.18, 0]], .07, this.black);
      for (const x of [-.72, .72]) this.sphere(this.black, x, -.16, 0, .17);
      for (const x of [-.5, 0, .5]) this.sphere(this.metal, x, .38, -.14, .12);
      this.trackingHeadset = new THREE.Group(); this.root.children.slice(headsetStart).forEach(child => this.trackingHeadset!.add(child));
      this.root.add(this.trackingHeadset);
      this.box(this.black, -16.5, 2.28, -18.5, 3.5, 4.55, 6, .08);
      for (const z of [-20.2, -17.8]) this.crt(-16.5, 3.1, z, .72);
      this.box(this.black, 5, 2.3, -18.5, 5.2, 4.6, 3, .08);
      for (const x of [3.55, 6.45]) this.crt(x, 3.1, -17.2, .78);
      for (const x of [-17.5, -16.5, -15.5]) this.pipe([[x, 0, -20], [x, 6.5, -20], [chairX - 2.2 + (x + 16.5) * .12, 6.5, chairZ + 1.5], [chairX - 1.9, 3.5, chairZ + 1.2]], .014, cable);
      this.lamp(-6, 7.6, -15.4, false, true);
      this.box(this.marble, 0, 4, -d / 2 + 1, 14, 8, 1.5, .08); this.box(this.black, 0, 2.8, -d / 2 + 2, 8, 5, .2); this.box(this.wood, 0, 8.2, -d / 2 + 1, 15, .6, 2, .06);
      for (const x of [-5.5, 5.5]) for (const y of [1.8, 4.3, 6.8]) this.box(this.white, x, y, -d / 2 + 1.9, 1.9, 2.1, .14, .04);
      const oval = this.mesh(new THREE.CircleGeometry(1, 96), this.wood, -10, 5, -17.8);
      oval.scale.set(3.2, 4.8, 1);
      for (const [rx, ry, z, radius, material] of [[3.05, 4.64, -17.58, .12, this.brass], [2.88, 4.48, -17.56, .055, this.black]] as const) {
        const rim = Array.from({ length: 65 }, (_, i) => { const theta = i / 64 * Math.PI * 2; return [-10 + Math.cos(theta) * rx, 5 + Math.sin(theta) * ry, z]; });
        this.pipe(rim, radius, material);
      }
      this.mirror = new Reflector(this.own(new THREE.CircleGeometry(1, 96)), { color: 0xb4beb8, textureWidth: 768, textureHeight: 1024, clipBias: .003, multisample: 0 });
      this.mirror.scale.set(2.78, 4.36, 1);
      showMirrorSubject(this.mirror, () => this.mirrorSubject);
      this.mirror.position.set(PILL_ROOM.mirror.x, 5, PILL_ROOM.mirror.z); this.mirror.userData.dynamic = true; this.root.add(this.mirror);
      const shader = this.mirror.material as THREE.ShaderMaterial;
      shader.uniforms.liquidTime = { value: 0 }; shader.uniforms.liquidAmount = { value: 0 };
      shader.fragmentShader = shader.fragmentShader.replace('void main()', 'uniform float liquidTime;\nuniform float liquidAmount;\nvoid main()')
        .replace('vec4 base = texture2DProj( tDiffuse, vUv );', `vec2 mirrorUv = vUv.xy / vUv.w;
          vec2 liquidOffset = vec2(sin(mirrorUv.y * 28.0 - liquidTime * 2.0), cos(mirrorUv.x * 24.0 + liquidTime * 1.6)) * liquidAmount;
          vec4 base = texture2D(tDiffuse, mirrorUv + liquidOffset);`);
      const crackStart = this.root.children.length;
      for (let i = 0; i < 8; i++) {
        const theta = i / 8 * Math.PI * 2 + .22;
        this.pipe([[-10.15, -.3, -17.53], [-10 + Math.cos(theta + .23) * 1.2, Math.sin(theta + .23) * 2.1, -17.53],
          [-10 + Math.cos(theta) * 2.5, Math.sin(theta) * 3.95, -17.53]], .013, this.black);
      }
      this.mirrorCracks = new THREE.Group(); this.root.children.slice(crackStart).forEach(c => this.mirrorCracks!.add(c)); this.mirrorCracks.position.y = 5; this.mirrorCracks.userData.dynamic = true; this.root.add(this.mirrorCracks);
      this.table(13, 10); this.crt(13, 3.7, 10); this.crt(10, 3.3, 11, .7); this.lamp(-13, 7, -18);
      this.chair(8, 5, Math.PI); this.lamp(7, 6, -17); this.lamp(-15, 10, 9, false);
      for (const z of [-13, 1, 15]) {
        this.window(-w / 2 + .5, 8, z, 8, 9, true);
        for (let i = 0; i < 12; i++) this.box(this.wood, -w / 2 + 1, 8, z - 3.8 + i * .69, .16, 8.7, .35).rotation.y = .2;
        this.box(this.wood, -w / 2 + .9, 12.9, z, .6, .4, 9.5);
      }
      this.door(0, d / 2 - .4);
    }
    if (a === 'oracle') {
      const green = this.mat(0x566e4b, .5); const cream = this.mat(0xc8c2a1, .6);
      const paperCanvas = document.createElement('canvas'); paperCanvas.width = paperCanvas.height = 256;
      const ctx = paperCanvas.getContext('2d')!; ctx.fillStyle = '#bdc0a0'; ctx.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 64) {
        ctx.strokeStyle = '#899271'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x + 32, y + 32, 14, 27, 0, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#929779' : '#77816a'; ctx.beginPath(); ctx.ellipse(x + 32, y + 20 + i * 8, 6, 3, i % 2 ? .5 : -.5, 0, Math.PI * 2); ctx.fill(); }
      }
      const map = new THREE.CanvasTexture(paperCanvas); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(5, 2); this.textures.add(map);
      const paper = new THREE.MeshStandardMaterial({ map, roughness: .95 }); this.materials.add(paper);
      for (const o of filmObstacles(set).filter(o => !ORACLE_FURNITURE.includes(o))) this.box(paper, o.x, o.height / 2, o.z, o.width, o.height, o.depth);
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
      for (const x of [-w / 2 + .42, w / 2 - .42]) this.box(paper, x, 3.2, 8, .08, 6.4, d - 18);
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
      this.table(3, -17, 5, 3, this.wood, 1.9); this.box(this.metal, 3, 2.09, -17, 2, .06, 1.3, .04);
      for (const x of [2.5, 3, 3.5]) this.cylinder(this.mat(0xb99260), x, 2.16, -17, .18, .06);
      this.chair(3, -13.7); this.chair(3, -20.3, Math.PI);
      for (const x of [-12, -6, 6, 12]) this.chair(x, 11, 0, x === -12);
      this.table(8, -11, 2.7, 2.2, this.wood, 1.8); this.oracleVase = new OracleVase(this.root);
      this.rug(-6, 10, 12, 9);
      this.lamp(0, 6.6, -19, true);
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
    } else if (a === 'architect') {
      const ivory = this.mat(0xe6e5de, .32); const portal = this.mat(0x101312, .42);
      this.box(this.black, 0, .04, -8, 30, .08, 31);
      this.box(ivory, 0, .14, -8, 28, .13, 29);
      this.box(ivory, 0, 1.5, -14, 2.4, .6, 2.4, .16);
      this.box(ivory, 0, 2.8, -15, 2.4, 2.6, .55, .18);
      for (const x of [-8, 8]) {
        this.box(portal, x, 4.1, -30.45, 5.3, 8.2, .15);
        for (const dx of [-2.8, 2.8]) this.box(ivory, x + dx, 4.1, -30.1, .38, 8.7, .75);
        this.box(ivory, x, 8.5, -30.1, 6, .35, .75);
      }
      this.box(ivory, 8, 4.05, -30.13, 4.8, 7.9, .23);
      this.label('SOURCE / RELOAD', 8, 9.4, -30.04, 2.4, '#56635d', '#efefea');
      this.label('MATRIX / TRINITY', -8, 9.4, -30.04, 2.4, '#56635d', '#efefea');
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
      const bookDoor = new THREE.Group(); bookDoor.userData.dynamic = true; this.root.add(bookDoor);
      const start = this.root.children.length;
      this.box(this.wood, EXILES.bookshelf.x, 6.5, EXILES.bookshelf.z, 5, 13, .55);
      for (let y = 1.3; y < 13; y += 2.4) this.box(this.brass, EXILES.bookshelf.x, y, -17.6, 5, .12, .2);
      for (let dx = -2.1; dx <= 2.1; dx += .7) for (let y = 2.4; y < 12; y += 2.4)
        this.box(this.mat(Math.round(dx * 10 + y) % 2 ? 0x69513c : 0x3e5049), EXILES.bookshelf.x + dx, y, -17.53, .56, 2.1, .38);
      this.root.children.slice(start).forEach(object => bookDoor.add(object)); this.bookDoor = bookDoor;
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
  private createArchitectScreens(): void {
    const loader = new THREE.TextureLoader();
    const neo = [0, 1, 2, 3].map(index => {
      const texture = loader.load('/assets/architect/neo-reactions-atlas.png');
      texture.repeat.set(.5, .5); texture.offset.set(index % 2 * .5, index < 2 ? .5 : 0);
      return texture;
    });
    const trinity = loader.load('/assets/architect/trinity-signal.png');
    for (const texture of [...neo, trinity]) { texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; this.textures.add(texture); }
    const materials = neo.map(map => new THREE.MeshBasicMaterial({ color: 0xf4f5ef, map, side: THREE.DoubleSide, toneMapped: false }));
    materials.forEach(material => this.materials.add(material));
    const columns = 21; const rows = 8; const count = columns * rows;
    const frames = new THREE.InstancedMesh(this.own(new THREE.BoxGeometry(2.76, 1.64, .16)), this.mat(0x101615, .3), count);
    const screenGeometry = this.own(new THREE.PlaneGeometry(2.58, 1.45));
    const screens = materials.map(material => new THREE.InstancedMesh(screenGeometry, material, count));
    const screenCounts = [0, 0, 0, 0];
    const dummy = new THREE.Object3D();
    let index = 0;
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const theta = Math.PI + (column + .5) / columns * Math.PI;
      const x = Math.cos(theta) * 21; const z = Math.sin(theta) * 21 - .5;
      if (row < 4 && Math.abs(x) < 12) continue;
      const yaw = Math.atan2(-x, -z - .5); const y = 2 + row * 1.8;
      dummy.position.set(x, y, z); dummy.rotation.set(0, yaw, 0); dummy.updateMatrix(); frames.setMatrixAt(index, dummy.matrix);
      dummy.position.set(x + Math.sin(yaw) * .14, y, z + Math.cos(yaw) * .14);
      dummy.updateMatrix();
      const variant = (row * 7 + column * 11) % 4; const slot = screenCounts[variant]++;
      screens[variant].setMatrixAt(slot, dummy.matrix);
      const brightness = .78 + ((row * 7 + column * 11) % 5) * .05;
      screens[variant].setColorAt(slot, new THREE.Color().setRGB(brightness, brightness, brightness));
      index++;
    }
    frames.count = index; frames.instanceMatrix.needsUpdate = true; frames.castShadow = false;
    screens.forEach((screen, variant) => { screen.count = screenCounts[variant]; screen.instanceMatrix.needsUpdate = true; screen.castShadow = false; });
    this.root.add(frames, ...screens);
    const leftDoor = this.box(this.mat(0xe6e5de, .32), -8, 4.05, -30.13, 4.8, 7.9, .23);
    leftDoor.userData.dynamic = true;
    const leftLight = new THREE.PointLight(0xd8eee5, 4, 12);
    leftLight.position.set(-8, 5, -28); this.root.add(leftLight);
    this.architectScreens = { materials, neo, trinity, leftDoor, leftLight };
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
  private createSourceDoor(): void {
    const glow = new THREE.MeshBasicMaterial({ color: 0xe5efe5, toneMapped: false }); this.materials.add(glow);
    this.box(this.black, 0, 4, -39.1, 6.45, 8, .1);
    this.box(this.black, 0, 4, -55.15, 6.45, 8, .1);
    const light = this.box(glow, 0, 4, -55, 5.5, 7.6, .06); light.visible = false;
    const portal = new THREE.Group(); this.root.add(portal);
    portal.add(this.box(this.mat(0x435652, .35, .55), 0, 4, -38.75, 6.1, 7.7, .28, .08));
    portal.add(this.box(this.brass, 1.65, 3.5, -38.48, .23, .23, .16));
    const source = new THREE.Group(); this.root.add(source);
    source.add(this.box(this.white, 0, 4, -54.8, 5.4, 7.7, .28, .08));
    source.add(this.box(this.brass, 1.55, 3.5, -54.52, .23, .23, .16));
    this.sourceDoor = { portal, source, glow: light };
  }
  private publicInterior(set: FilmSet): void {
    if (set.id === 'film_club_hel') { this.helClub(set); return; }
    const { architecture: a, width: w, depth: d, height: h } = set;
    if (a === 'chateau') {
      // Two stair wings, a landing, balustrades and a weapons wall define the film's composition.
      for (const side of [-1, 1]) {
        for (let i = 0; i < 18; i++) {
          const x = side * (14 + i * .65); const z = -4 - i * 1.45; const y = i * .55;
          this.box(this.marble, x, y / 2, z, 10, y + .5, 1.6, .04);
          for (const edge of [-4.6, 4.6]) { this.cylinder(this.marble, x + edge, y + 1.7, z, .14, 2.7); this.sphere(this.marble, x + edge, y + 3.1, z, .22); }
        }
        this.pipe([[side * 9.4, 3.3, -4], [side * 15, 8, -16], [side * 20.5, 12.6, -29]], .19, this.wood);
      }
      this.box(this.marble, 0, 9.5, -d / 2 + 7, w - 4, 1, 12, .1);
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
      for (const z of [7, 24]) { this.cylinder(this.brass, 0, h - 3, z, 3, .3); for (let i = 0; i < 10; i++) this.lamp(Math.sin(i * Math.PI / 5) * 3, h - 3, z + Math.cos(i * Math.PI / 5) * 3); }
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
    this.box(basalt, 0, .035, 0, w - 2, .09, d - 2).name = 'hel-stone-floor';
    for (const side of [-1, 1]) {
      this.box(velvet, side * (w / 2 - .55), h / 2, 0, .12, h - 1, d - 1);
      for (let z = -d / 2 + 6; z < d / 2; z += 8) {
        this.box(steel, side * (w / 2 - 1), h / 2, z, .75, h - 1, .8);
        this.box(lamp, side * (w / 2 - 1.5), 8.5, z, .13, 3.8, .16);
      }
    }
    // Entry cage, weapon check and dance floor occupy one continuous playable room.
    for (const side of [-1, 1]) for (const z of [25, 31, 37]) {
      this.box(steel, side * 4.2, 4.8, z, .22, 9.6, .22);
      for (const y of [1.3, 4, 6.7, 9.3]) this.box(steel, side * 4.2, y, z - 2.8, .12, .12, 5.6);
    }
    this.box(basalt, 0, 9.8, 31, 9, .65, 16);
    const elevatorSign = this.label('HEL ↓', 0, 10.5, 24.6, 6, '#cf6064', '#1d171a'); elevatorSign.name = 'hel-elevator-sign'; elevatorSign.userData.dynamic = true;
    const doors = [-1, 1].map((side, index) => {
      const panel = new THREE.Group(); panel.name = index ? 'hel-elevator-right-door' : 'hel-elevator-left-door'; panel.userData.dynamic = true;
      panel.position.set(side * HEL_ELEVATOR.doorWidth / 4, 0, HEL_ELEVATOR.doorZ); this.root.add(panel);
      panel.add(this.box(steel, 0, 4.4, 0, HEL_ELEVATOR.doorWidth / 2, HEL_ELEVATOR.doorHeight, .32, .06));
      panel.add(this.box(basalt, 0, 4.4, .19, HEL_ELEVATOR.doorWidth / 2 - .42, 7.9, .04));
      for (const y of [1.25, 4.4, 7.55]) panel.add(this.box(steel, 0, y, .23, HEL_ELEVATOR.doorWidth / 2 - .35, .09, .08));
      return panel;
    }) as [THREE.Group, THREE.Group];
    const bands: { mesh: THREE.Mesh; y: number }[] = [];
    for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
      const y = 1 + i * 1.6;
      const mesh = this.box(shaftLamp, side * 3.97, y, 29.5, .08, .13, .8); mesh.name = 'hel-shaft-band'; mesh.userData.dynamic = true;
      bands.push({ mesh, y });
    }
    const liftLight = new THREE.PointLight(0xd64f5b, 90, 14, 2); liftLight.position.set(0, 6, 27); this.root.add(liftLight);
    this.helLift = { doors, bands, light: liftLight };
    this.box(steel, -3.45, 2.2, 26.1, 1.15, 3.1, .46, .08);
    const button = this.cylinder(lamp, -3.45, 2.45, 26.42, .23, .12); button.rotation.x = Math.PI / 2;
    button.name = 'hel-elevator-button'; button.userData.dynamic = true;
    this.label('HEL', -3.45, 3.35, 26.43, 1.3, '#f4d2c7', '#2e1b20');
    for (const z of [31, 12]) {
      this.box(this.glow, 0, 9.1, z, 8, .12, .7);
      const light = new THREE.PointLight(0xf0d8cb, z === 31 ? 330 : 290, 24, 2);
      light.position.set(0, 8.5, z); this.root.add(light);
    }
    for (const x of [-14, 14]) {
      const counter = this.box(basalt, x, 1.6, 11, 8, 3.2, 4); counter.name = 'hel-coatcheck-counter'; counter.userData.dynamic = true;
      this.box(steel, x, 3.25, 11, 8.6, .28, 4.4);
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
      panel.add(this.box(steel, -side * .6, 4.1, .39, .12, 1.3, .14));
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
    for (let i = 0; i < 4; i++) this.box(basalt, 0, .2 + i * .35, -24 - i * 1.6, 23, .4 + i * .7, 1.65);
    this.box(velvet, 0, .8, -36, 24, 1.6, 17);
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
      for (const x of [-1.5, 1.5]) {
        floorGuns.add(this.box(steel, x, .17, -28.6, .14, .12, .68));
        floorGuns.add(this.box(coat, x, .12, -28.4, .16, .2, .18));
      }
      const flyingGun = new THREE.Group(); flyingGun.name = 'hel-flying-gun'; flyingGun.userData.dynamic = true; this.root.add(flyingGun);
      flyingGun.add(this.box(steel, 0, 0, 0, .14, .12, .65));
      flyingGun.add(this.box(coat, 0, -.1, .18, .18, .24, .18));
      const house = new THREE.PointLight(0xc82235, 250, 30, 2); house.position.set(0, 8, -24); this.root.add(house);
      this.helStandoff = { crowd, guard, floorGuns, flyingGun, light: house };
    }
  }
  private station(set: FilmSet): void {
    if (set.architecture === 'mobil') { this.mobilStation(set); return; }
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
    if (this.currentScene === 'm3_trainman_chase') { train.name = 'hel-chase-train'; train.visible = false; this.helChaseTrain = train; }
    else this.moving.push({ object: train, update: t => { train.position.z = ((t * 11) % (d + 90)) - d / 2 - 45; } });
    for (let z = -d / 2; z < d / 2; z += 13) {
      const shape = new THREE.Shape(); shape.moveTo(-w / 2, 0); shape.absellipse(0, 0, w / 2, 7, Math.PI, 0, true, 0); shape.lineTo(w / 2, .6); shape.absellipse(0, .6, w / 2 + .6, 7.6, 0, Math.PI, false, 0); shape.closePath();
      this.mesh(new THREE.ExtrudeGeometry(shape, { depth: .4, bevelEnabled: false, curveSegments: 24 }), border, 0, h - 7.6, z);
    }
  }
  private mobilStation(set: FilmSet): void {
    const { width: w, depth: d, height: h } = set;
    const porcelain = this.mat(0xdce2db, .25); const grout = this.mat(0xaebbb4, .82);
    const charcoal = this.mat(0x252d2b, .43); const edge = this.mat(0xb9b286, .63);
    const light = new THREE.MeshBasicMaterial({ color: 0xf4fff4, toneMapped: false }); this.materials.add(light);
    for (const side of [-1, 1]) {
      for (let z = -d / 2 + 1.5; z < d / 2; z += 3) {
        this.box(porcelain, side * (w / 2 - .58), h / 2, z, .14, h - .7, 2.96);
        for (const y of [2, 4, 6, 8, 10, 12, 14]) this.box(grout, side * (w / 2 - .66), y, z, .025, .035, 3);
      }
      this.box(charcoal, side * (w / 2 - .68), 1.05, 0, .08, 2.1, d);
      this.box(edge, side * (w / 2 - .7), 2.25, 0, .09, .11, d);
    }
    for (const side of [-1, 1]) {
      this.box(charcoal, 0, 5.3, side * (d / 2 - 1.3), 17.5, 10.6, .2);
      for (const x of [-9, 9]) this.box(porcelain, x, 5.3, side * (d / 2 - 1.4), .5, 10.7, .45);
      this.box(porcelain, 0, 10.8, side * (d / 2 - 1.4), 18.5, .55, .45);
      const sign = this.label('MOBIL AVE', 0, 12.2, side * (d / 2 - 1.7), 14, '#e8ece4', '#29312f');
      if (side > 0) sign.rotation.y = Math.PI;
      for (const x of [-9.2, 9.2]) this.box(charcoal, x, 5.2, side * (d / 2 - 5.2), 1.2, 10.4, 7);
    }
    for (const z of [-22, 16]) {
      const sign = this.label('MOBIL AVE', -21.05, 9.5, z, 13, '#e9ede5', '#202927');
      sign.rotation.y = Math.PI / 2;
    }
    for (let z = -d / 2 + 2; z < d / 2; z += 3) {
      this.box(charcoal, 15, -.98, z, 12.5, .2, .6);
      for (const x of [12, 18]) this.box(this.metal, x, -.76, z, .22, .27, 3.05);
    }
    this.box(edge, 7.55, .03, 0, .55, .08, d);
    this.box(charcoal, 8.05, -.55, 0, .22, 1.3, d);
    for (let z = -d / 2 + 5; z < d / 2 - 3; z += 9) {
      this.box(charcoal, -6, h - .65, z, 14, .55, .85);
      this.box(light, -6, h - 1, z, 12.8, .07, .72);
      this.box(charcoal, 13, h - .65, z, 6, .55, .85);
      this.box(light, 13, h - 1, z, 5.3, .07, .72);
    }
    for (const z of [-30, 0, 28]) {
      const lamp = new THREE.PointLight(0xe7fff2, 115, 34, 2); lamp.position.set(-7, h - 2, z); this.root.add(lamp);
    }
    this.box(this.metal, -12, 1.35, -8, 8, .32, 1.8, .12);
    this.box(this.metal, -12, 2.28, -8.65, 8, 1.4, .28, .1);
    for (const x of [-15.5, -8.5]) for (const z of [-8.5, -7.5]) this.box(charcoal, x, .72, z, .23, 1.45, .23);
    for (const [x, z, size] of [[-13, -10.1, 1.2], [-11.3, -10.4, .9]] as const) {
      this.box(charcoal, x, size / 2, z, size, size, size * .67, .08);
      this.box(this.metal, x, size + .04, z, size * .8, .13, size * .53);
      this.box(this.metal, x, size + .18, z, size * .42, .22, .11);
    }
    const start = this.root.children.length;
    const enamel = this.mat(0xc8d3cf, .22, .35); const window = this.mat(0x223c3a, .12, .28);
    this.box(enamel, 0, .2, 0, 6.6, .35, 28);
    this.box(enamel, 0, 6.4, 0, 6.6, .5, 28);
    this.box(enamel, 3.25, 3.2, 0, .18, 5.9, 28);
    for (const z of [-7.8, 7.8]) this.box(enamel, -3.25, 3.2, z, .18, 5.9, 11.5);
    for (const z of [-13.9, 13.9]) this.box(enamel, 0, 3.2, z, 6.6, 5.9, .22);
    for (const z of [-10.8, -6, 6, 10.8]) {
      this.box(window, -3.35, 4.1, z, .12, 2.35, 2.2);
      this.box(charcoal, -3.43, 4.1, z, .08, 2.52, 2.35);
    }
    for (const z of [-13.2, 13.2]) for (const x of [-1.3, 1.3]) this.box(light, x, 2.7, z + (z < 0 ? -.12 : .12), .8, .48, .06);
    const left = this.box(enamel, -3.42, 3.1, -.84, .19, 5.35, 1.62); left.name = 'mobil-train-door-left';
    const right = this.box(enamel, -3.42, 3.1, .84, .19, 5.35, 1.62); right.name = 'mobil-train-door-right';
    for (const door of [left, right]) {
      const pane = this.box(window, -3.54, 4.15, door.position.z, .04, 1.7, 1.3);
      door.add(pane); pane.position.set(-.12, 1.05, 0);
    }
    const car = new THREE.Group(); car.name = 'mobil-train'; this.root.children.slice(start).forEach(c => car.add(c)); car.userData.dynamic = true;
    car.position.set(14.3, -1.35, -80); this.root.add(car); this.mobilTrain = { car, doors: [left, right] };
  }
  private updateMobilStation(journey: FilmJourney | undefined, elapsed: number): void {
    const train = this.mobilTrain!;
    const encounter = ['m3_trainman', 'm3_mobil_release'].includes(journey?.scene ?? '') && !journey?.visiting ? journey?.mobil : undefined;
    const phase = encounter?.phase ?? 'waiting';
    train.car.visible = phase !== 'waiting' && phase !== 'gone';
    const progress = Math.max(0, Math.min(1, (encounter?.elapsed ?? 0) / (phase === 'approaching' ? 4.5 : 3)));
    const z = phase === 'approaching' ? -80 + 60 * (progress * progress * (3 - 2 * progress))
      : phase === 'departing' ? -20 - 60 * (progress * progress * (3 - 2 * progress))
        : phase === 'stopped' || phase === 'refusing' ? -20 : -80;
    train.car.position.z = this.mobilLastFrame === undefined ? z
      : THREE.MathUtils.damp(train.car.position.z, z, 12, Math.max(0, elapsed - this.mobilLastFrame));
    this.mobilLastFrame = elapsed;
    const open = phase === 'stopped' || phase === 'refusing' && (encounter?.elapsed ?? 0) < 1.75;
    train.doors[0].position.z = -.84 - (open ? 1.45 : 0);
    train.doors[1].position.z = .84 + (open ? 1.45 : 0);
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
    if (set.id === 'film_hel_garage') { this.helGarage(set); return; }
    const { architecture: a, width: w, depth: d } = set;
    if (a === 'rooftop') {
      for (const side of [-1, 1]) this.box(this.plaster, side * (w / 2 - .5), 1.7, 0, .7, 3.4, d);
      for (const z of [-d / 2 + .5, d / 2 - .5]) this.box(this.plaster, 0, 1.7, z, w, 3.4, .7);
      for (const x of [-w * .34, w * .34]) for (const z of [-d * .26, d * .23]) {
        this.box(this.metal, x, 2.2, z, 6, 4.4, 8, .1); for (let i = 0; i < 7; i++) this.box(this.black, x, 4.45, z - 2.7 + i * .8, 5, .06, .3);
        this.cylinder(this.metal, x, 5.4, z + 2, 1.1, 2); this.cylinder(this.metal, x, 6.4, z + 2, 1.5, .3);
      }
      if (set.id === 'film_hotel_roofs') {
        this.root.add(new THREE.HemisphereLight(0xc4d4c9, 0x31403b, .9));
        for (const z of [11, -10, -35]) {
          const flood = new THREE.PointLight(z === -35 ? 0xe6c597 : 0xaacbc0, 450, 34, 2);
          flood.position.set(0, 8, z); this.root.add(flood);
        }
        for (const z of [OPENING_ESCAPE.roofGapNear + 1.5, OPENING_ESCAPE.roofGapFar - 1.5]) {
          this.box(this.black, 0, .11, z, 7, .04, .2);
          this.box(this.brass, -3.2, .18, z, .16, .04, .75);
          this.box(this.brass, 3.2, .18, z, .16, .04, .75);
        }
        for (const z of [OPENING_ESCAPE.roofGapNear, OPENING_ESCAPE.roofGapFar]) this.box(this.mat(0xb7ad83, .75), 0, .18, z, w - 2, .07, .18);
        this.box(this.plaster, 0, 7.5, -d / 2 + 1, 19, 15, 1);
        const windowGlow = new THREE.MeshBasicMaterial({ color: 0x8a9a7c }); this.materials.add(windowGlow);
        this.box(windowGlow, 0, 5.8, -d / 2 + 1.38, 7.1, 7.6, .06);
        this.window(0, 5.8, -d / 2 + 1.6, 7.4, 8, false);
        for (let i = 0; i < 5; i++) {
          const z = -d / 2 + 3 + i * 2.2;
          this.box(this.metal, 12, -i * 1.2, z, 6, .18, 2.5);
          this.box(this.metal, 15, 1.1 - i * 1.2, z, .12, 2.4, 2.4);
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
        for (const x of [-w * .34, w * .34]) { this.box(this.marble, x, .2, 0, w * .15, .45, d); for (let z = -d / 2 + 8; z < d / 2; z += 23) { this.cylinder(this.metal, x, 7, z, .14, 14); this.lamp(x, 14, z, false); } }
        if (set.id === 'film_wells_phone') {
          this.root.add(new THREE.HemisphereLight(0xc7d6cd, 0x364540, .78));
          for (const [x, z, color] of [[0, -27, 0xb8d9c8], [14, 2, 0xd3ded0]] as const) {
            const streetlight = new THREE.PointLight(color, 650, 46, 2); streetlight.position.set(x, 11, z); this.root.add(streetlight);
          }
          const boothZ = -d * .32; const start = this.root.children.length;
          this.phone(0, boothZ, true);
          this.openingBooth = new THREE.Group(); this.openingBooth.name = 'opening-phone-booth'; this.openingBooth.userData.dynamic = true;
          this.root.children.slice(start).forEach(child => { child.position.z -= boothZ; this.openingBooth!.add(child); });
          this.openingBooth.position.z = boothZ; this.root.add(this.openingBooth);
          this.openingTruck = this.car(15, 4, 0x555e58, true);
          this.openingTruck.name = 'opening-garbage-truck'; this.openingTruck.userData.dynamic = true;
          const cargo = this.mat(0x829189, .82, .08);
          this.openingTruck.add(this.box(cargo, 0, 4.3, 7, 5.65, 7.05, 13.05, .15));
          for (const z of [2, 5, 8, 11]) for (const side of [-1, 1]) this.openingTruck.add(this.box(this.metal, side * 2.86, 4.3, z, .1, 6.6, .14));
          this.openingTruck.add(this.box(this.black, 0, 2.8, 13.58, 4.5, 3.5, .08));
          this.openingTruck.add(this.box(this.mat(0xc4a769), 0, 1.1, 13.64, 4.6, .2, .09));
          const tail = new THREE.MeshBasicMaterial({ color: 0xc9503d, toneMapped: false }); this.materials.add(tail);
          for (const x of [-2.2, 2.2]) this.openingTruck.add(this.box(tail, x, 1.75, 13.68, .3, .48, .08));
          this.openingGlass = new THREE.Group(); this.openingGlass.name = 'opening-shattered-glass'; this.openingGlass.userData.dynamic = true;
          this.openingGlass.visible = false; this.openingGlass.position.z = boothZ; this.root.add(this.openingGlass);
          for (let i = 0; i < 18; i++) {
            const angle = i * 2.399; const radius = 1.4 + i % 5 * .47;
            const shard = this.box(this.glass, Math.cos(angle) * radius, .2 + i % 4 * .13, Math.sin(angle) * radius, .13 + i % 3 * .07, .03, .35 + i % 4 * .13);
            shard.rotation.y = angle; this.openingGlass.add(shard);
          }
        } else if (a !== 'rain') this.phone(0, -d * .32, true);
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
  private helGarage(set: FilmSet): void {
    const { width: w, depth: d, height: h } = set;
    const concrete = this.mat(0x515657, .91); const stripe = this.mat(0x9b8b7d, .86);
    const steel = this.mat(0x272e31, .48, .53);
    this.box(concrete, 0, .04, 0, w - 1, .1, d - 1);
    for (const side of [-1, 1]) {
      this.box(steel, side * (w / 2 - 1), 1.2, 0, .13, 2.4, d);
      for (const z of [-23, -5, 13, 29]) {
        this.box(concrete, side * 11, h / 2, z, 1.3, h - .6, 1.3);
        this.box(stripe, side * 11, 2, z, 1.34, .55, 1.34);
      }
      for (const z of [-17, 9, 24]) {
        const car = this.car(side * 18, z, z === 9 ? 0x1c2427 : 0x3a3d3e); car.name = 'hel-parked-car'; car.userData.dynamic = true;
        this.box(stripe, side * 11, .12, z, .19, .04, 13);
      }
    }
    for (const z of [-26, -10, 6, 22]) {
      this.box(steel, 0, h - .7, z, w - 4, .45, .42);
      this.box(this.glow, 0, h - 1.1, z, 15, .07, .6);
      const light = new THREE.PointLight(0xe5e4d6, 82, 30, 2); light.position.set(0, h - 1.7, z); this.root.add(light);
    }
    const gate = this.box(steel, 0, 4.5, -d / 2 + 1.3, 12, 9, .7); gate.name = 'hel-garage-steel-door'; gate.userData.dynamic = true;
    this.label('HEL / PRIVATE ENTRANCE', 0, 10.8, -d / 2 + 2, 12, '#e9ddd1', '#262125');
    for (const x of [-5.8, 5.8]) this.box(stripe, x, 4.5, -d / 2 + 2, .22, 9, .4);
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
  private batch(): void {
    this.root.updateMatrixWorld(true);
    const inverse = this.root.matrixWorld.clone().invert(); const batches = new Map<THREE.Material, THREE.BufferGeometry[]>(); const remove: THREE.Object3D[] = [];
    this.root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
      let ancestor: THREE.Object3D | null = object; while (ancestor && ancestor !== this.root) { if (ancestor.userData.dynamic) return; ancestor = ancestor.parent; }
      const geometry = object.geometry.clone().applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      const normalized = geometry.index ? geometry.toNonIndexed() : geometry;
      if (normalized !== geometry) geometry.dispose();
      // All generated mesh primitives carry position, normal and uv. Extraneous attributes are not needed.
      for (const name of Object.keys(normalized.attributes)) if (!['position', 'normal', 'uv'].includes(name)) normalized.deleteAttribute(name);
      const list = batches.get(object.material) ?? []; list.push(normalized); batches.set(object.material, list); remove.push(object);
    });
    for (const object of remove) object.removeFromParent();
    for (const [material, geometries] of batches) {
      const geometry = mergeGeometries(geometries); geometries.forEach(g => g.dispose());
      if (!geometry) throw new Error('Film set geometry could not be merged');
      const mesh = new THREE.Mesh(this.own(geometry), material); mesh.castShadow = true; mesh.receiveShadow = true; this.root.add(mesh);
    }
    const live = new Set<THREE.BufferGeometry>(); this.root.traverse(object => { if (object instanceof THREE.Mesh) live.add(object.geometry); });
    for (const geometry of this.geometries) if (!live.has(geometry)) { geometry.dispose(); this.geometries.delete(geometry); }
  }
  private clear(): void {
    this.helPerformers?.dispose(); this.helPerformers = undefined;
    this.club?.dispose(); this.club = undefined;
    this.apartment?.dispose(); this.apartment = undefined;
    this.approach?.renderer.dispose(); this.approach = undefined;
    this.hotel?.dispose(); this.hotel = undefined;
    this.meeting?.dispose(); this.meeting = undefined;
    this.interrogation?.dispose(); this.interrogation = undefined;
    this.pillGlass = undefined;
    this.ambush?.dispose(); this.ambush = undefined;
    this.oracleVase?.dispose(); this.oracleVase = undefined;
    this.mirror?.dispose(); this.mirror = undefined; this.mirrorCracks = undefined; this.trackingHeadset = undefined;
    this.pods?.dispose(); this.pods = undefined;
    this.neb?.dispose(); this.neb = undefined;
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
    this.logosBane?.dispose(); this.logosBane = undefined; this.logosBanePhase = undefined;
    this.revolutionsPrelude?.dispose(); this.revolutionsPrelude = undefined;
    this.hammerRoute?.dispose(); this.hammerRoute = undefined;
    this.portalDoor = undefined; this.oracleLetter = undefined; this.courtyardStaff = undefined; this.courtyardBirds = []; this.courtyardDisturbedAt = undefined;
    this.exileDessert = undefined; this.bookDoor = undefined; this.chateauVolley = undefined; this.chateauVolleyTick = undefined; this.chateauDoor = undefined;
    this.garageCar = undefined; this.garageGhosts = [];
    this.mobilTrain = undefined;
    this.openingTruck = undefined; this.openingBooth = undefined; this.openingGlass = undefined;
    this.hotel303Door = undefined; this.hotel303Glass = undefined; this.hotel303Shards = undefined; this.hotel303Pistol = undefined;
    this.mobilLastFrame = undefined;
    this.helChaseTrain = undefined;
    this.helLift = undefined;
    this.helDanceDoor = undefined;
    this.helCoatDamage = undefined;
    this.helStandoff = undefined;
    this.powerStatus = undefined;
    this.sourceDoor = undefined;
    this.architectScreens = undefined;
    this.office?.dispose(); this.office = undefined;
    this.freeway?.dispose(); this.freeway = undefined;
    this.lobby?.dispose(); this.lobby = undefined;
    this.root.traverse(object => { if (object instanceof THREE.PointLight || object instanceof THREE.SpotLight) object.dispose(); });
    this.root.clear(); this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose());
    this.geometries.clear(); this.materials.clear(); this.textures.clear(); this.materialCache.clear(); this.moving = [];
  }
  dispose(): void { this.clear(); this.root.removeFromParent(); this.marker.removeFromParent(); this.markerLight.removeFromParent(); this.marker.geometry.dispose(); (this.marker.material as THREE.Material).dispose(); this.markerLight.dispose(); }
}
